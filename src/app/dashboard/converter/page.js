'use client';
import { useState, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';

const FILE_ICONS = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
};
const getExt = (name = '') => (name.split('.').pop() || '').toLowerCase();
const getIcon = (name = '') => FILE_ICONS[getExt(name)] || '📎';
const isWordExt = (ext) => ext === 'docx' || ext === 'doc';

// Convert data URI → Blob URL (Chrome blocks data: URIs for PDFs in iframes)
function dataUriToBlobUrl(dataUri) {
  const [header, base64] = dataUri.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

// Decode data URI base64 → ArrayBuffer
function dataUriToBuffer(dataUri) {
  const base64 = dataUri.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Force white background HTML wrapper for Word docs
function makeHtml(title, body) {
  return `<!DOCTYPE html>
<html style="color-scheme:light;background:#fff">
<head><meta charset="utf-8"><title>${title}</title>
<style>
html,body{color-scheme:light!important;background:#fff!important;color:#222!important;
  font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;padding:32px 40px;line-height:1.6}
img{max-width:100%}table{border-collapse:collapse;width:100%;margin:16px 0}
td,th{border:1px solid #bbb;padding:6px 10px}h1,h2,h3,h4{color:#111}p{margin:0 0 10px}
</style></head><body>${body}</body></html>`;
}

async function convertDocxToBlob(arrayBuffer, title) {
  const mammoth = (await import('mammoth/mammoth.browser')).default;
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = makeHtml(title, result.value);
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}

// ─── MuPDF-powered PDF → DOCX ────────────────────────────────────────────────
// mupdf runs server-side (Node.js API route /api/pdf-parse)
// Actual mupdf JSON structure:
//   block: { type, bbox:{x,y,w,h}, lines:[{ font:{name,weight,style,size}, x, y, text, bbox }] }

function getLineText(line) {
  // Lines may have spans[] OR direct .text depending on mupdf version
  if (line.spans?.length) return line.spans.map(s => s.text || '').join('');
  return line.text || '';
}

function getBlockText(block) {
  return (block.lines || []).map(getLineText).join('\n');
}

function getLineFontInfo(line) {
  const font = line.font || {};
  const size = font.size || line.bbox?.h || 11;
  const bold = font.weight === 'bold' || (font.name || '').toLowerCase().includes('bold');
  const italic = font.style === 'italic' || (font.name || '').toLowerCase().includes('italic');
  return { size, bold, italic };
}

function getBlockFontInfo(block) {
  const lines = block.lines || [];
  if (!lines.length) return { size: 11, bold: false, italic: false };
  // Use the dominant font info from the first non-empty line
  for (const line of lines) {
    const text = getLineText(line);
    if (text.trim()) return getLineFontInfo(line);
  }
  return getLineFontInfo(lines[0]);
}

// bbox helper: mupdf returns {x, y, w, h}  (origin is top-left in screen coords)
function bboxCY(bbox) { return bbox.y + bbox.h / 2; }
function bboxX(bbox)  { return bbox.x; }
function bboxY(bbox)  { return bbox.y; }

async function buildDocxFromPages(pages) {
  const {
    Document: WDoc, Packer, Paragraph, TextRun,
    HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType,
  } = await import('docx');

  const allChildren = [];

  for (let pi = 0; pi < pages.length; pi++) {
    const { blocks = [] } = pages[pi];
    const textBlocks = blocks.filter(b => b.type === 'text');

    // Body font size (mode across all lines on page)
    const sizes = textBlocks.flatMap(b =>
      (b.lines || []).map(l => Math.round((l.font?.size || l.bbox?.h || 0)))
    ).filter(s => s > 0);
    const sizeCounts = sizes.reduce((a, s) => { a[s] = (a[s] || 0) + 1; return a; }, {});
    const bodySize = sizes.length
      ? Number(Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0][0]) : 11;

    // Cluster text blocks into rows by Y centre (tolerance = half body size)
    const tolerance = Math.max(bodySize * 0.6, 6);
    const rows = [];
    for (const block of textBlocks) {
      const cy = bboxCY(block.bbox);
      let placed = false;
      for (const row of rows) {
        if (Math.abs(row.cy - cy) < tolerance) {
          row.blocks.push(block);
          row.cy = row.blocks.reduce((s, b) => s + bboxCY(b.bbox), 0) / row.blocks.length;
          placed = true; break;
        }
      }
      if (!placed) rows.push({ cy, y: bboxY(block.bbox), blocks: [block] });
    }
    rows.sort((a, b) => a.y - b.y);

    // Detect tables: ≥2 consecutive rows each with 2+ side-by-side blocks
    const groups = [];
    let tableAcc = [];
    const flushTable = () => {
      if (tableAcc.length >= 2) groups.push({ type: 'table', rows: tableAcc });
      else if (tableAcc.length === 1) tableAcc[0].forEach(b => groups.push({ type: 'text', block: b }));
      tableAcc = [];
    };
    for (const row of rows) {
      const sorted = [...row.blocks].sort((a, b) => bboxX(a.bbox) - bboxX(b.bbox));
      if (sorted.length > 1) { tableAcc.push(sorted); }
      else { flushTable(); groups.push({ type: 'text', block: sorted[0] }); }
    }
    flushTable();

    // Groups → DOCX elements
    for (const g of groups) {
      if (g.type === 'table') {
        const numCols = Math.max(...g.rows.map(r => r.length));
        allChildren.push(
          new Table({
            rows: g.rows.map(rb => new TableRow({
              children: Array.from({ length: numCols }, (_, ci) => {
                const block = rb[ci];
                const txt = block ? getBlockText(block) : '';
                const { bold } = block ? getBlockFontInfo(block) : { bold: false };
                return new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: txt, bold })] })],
                  margins: { top: 60, bottom: 60, left: 100, right: 100 },
                });
              }),
            })),
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ children: [] })
        );
      } else {
        const { block } = g;
        const text = getBlockText(block); if (!text.trim()) continue;
        const { size, bold, italic } = getBlockFontInfo(block);
        const halfPt = Math.max(Math.round(size * 2 * 0.75), 18);
        const isLarger = size > bodySize * 1.22;
        const isMuchLarger = size > bodySize * 1.6;
        const runs = (block.lines || []).map((line, li) =>
          new TextRun({
            text: getLineText(line),
            bold: bold || isMuchLarger,
            italics: italic,
            size: halfPt,
            break: li > 0 ? 1 : 0,
          })
        );
        if (isMuchLarger) allChildren.push(new Paragraph({ children: runs, heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER }));
        else if (isLarger || bold) allChildren.push(new Paragraph({ children: runs, heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 } }));
        else allChildren.push(new Paragraph({ children: runs, spacing: { after: 60 } }));
      }
    }
    if (pi < pages.length - 1) allChildren.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }

  const doc = new WDoc({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { line: 276 } } } } },
    sections: [{ children: allChildren }],
  });
  return Packer.toBlob(doc);
}

async function convertPdfToDocxMuPDF(dataUri) {
  const form = new FormData();
  form.append('file', new Blob([dataUriToBuffer(dataUri)], { type: 'application/pdf' }), 'document.pdf');

  const resp = await fetch('/api/pdf-parse', { method: 'POST', body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Parse failed: ${resp.status}`);
  }
  const { pages } = await resp.json();
  return buildDocxFromPages(pages);
}

export default function ConverterPage() {
  const { lang } = useLanguage();
  const { alert, DialogRenderer } = useDialog();
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(null);
  const [processing, setProcessing] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const fileInputRef = useRef(null);
  const blobUrlsRef = useRef([]);

  const cleanup = () => {
    blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    blobUrlsRef.current = [];
  };

  const archiveFiles = getAll(COLLECTIONS.DIGITAL_ARCHIVE);
  const { sorted: filteredArchive } = useSortedList(
    archiveFiles.filter(f =>
      !archiveSearch || f.name?.toLowerCase().includes(archiveSearch.toLowerCase())
    ), 'name'
  );

  const loadFile = useCallback(async (arrayBuffer, name, originalDataUri) => {
    const ext = getExt(name);
    cleanup();
    if (isWordExt(ext)) {
      setProcessing('converting');
      try {
        const htmlBlobUrl = await convertDocxToBlob(arrayBuffer, name);
        blobUrlsRef.current.push(htmlBlobUrl);
        setLoaded({ name, data: originalDataUri, iframeSrc: htmlBlobUrl, ext });
      } catch (e) {
        console.error(e);
        await alert(lang === 'bs' ? 'Greška pri čitanju Word dokumenta.' : 'Error reading Word document.');
      } finally {
        setProcessing('');
      }
    } else {
      // PDF / other — convert data URI to blob URL (Chrome blocks data: URIs in iframes)
      const blobUrl = originalDataUri ? dataUriToBlobUrl(originalDataUri) : URL.createObjectURL(new Blob([arrayBuffer]));
      blobUrlsRef.current.push(blobUrl);
      setLoaded({ name, data: originalDataUri, iframeSrc: blobUrl, ext });
    }
  }, [lang, alert]);

  const loadFromFile = async (file) => {
    if (file.size > 30 * 1024 * 1024) {
      await alert(lang === 'bs' ? 'Datoteka mora biti manja od 30MB!' : 'File must be under 30MB!');
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const dataUri = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    await loadFile(arrayBuffer, file.name, dataUri);
  };

  const loadFromArchive = async (file) => {
    if (!file.data) return;
    const arrayBuffer = dataUriToBuffer(file.data);
    await loadFile(arrayBuffer, file.name, file.data);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFromFile(file);
  };

  const openInTab = () => {
    if (!loaded?.iframeSrc) return;
    window.open(loaded.iframeSrc, '_blank');
  };

  const printDoc = () => {
    if (!loaded?.iframeSrc) return;
    const w = window.open(loaded.iframeSrc, '_blank');
    if (w) w.addEventListener('load', () => { w.focus(); w.print(); });
  };

  const downloadOriginal = () => {
    if (!loaded?.data) return;
    const a = document.createElement('a');
    a.href = loaded.data;
    a.download = loaded.name;
    a.click();
  };

  const handleConvertPdfToWord = async () => {
    if (!loaded?.data) return;
    setProcessing('pdf2word');
    try {
      const blob = await convertPdfToDocxMuPDF(loaded.data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = loaded.name.replace(/\.pdf$/i, '.docx');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('[pdf2word]', e);
      const msg = e?.message || String(e) || 'Unknown error';
      await alert(lang === 'bs' ? `Greška: ${msg}` : `Error: ${msg}`);
    } finally {
      setProcessing('');
    }
  };

  const close = () => { cleanup(); setLoaded(null); };

  const isWord = loaded && isWordExt(loaded.ext);
  const isPdf = loaded && loaded.ext === 'pdf';

  return (
    <div className="animate-fadeIn">
      <DialogRenderer />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: '1.6rem' }}>🔄</span>
        <div>
          <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Word/PDF Konverter' : 'Word/PDF Converter'}</h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {lang === 'bs' ? 'PDF i Word dokumenti — pregled, ispis, preuzimanje i konverzija' : 'PDF and Word documents — preview, print, download and convert'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Drop zone */}
          {!loaded && !processing && (
            <div className="card"
              style={{ border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)', background: dragging ? 'rgba(0,191,166,0.04)' : 'transparent', transition: 'all 0.2s', cursor: 'pointer' }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>{dragging ? '📂' : '🔄'}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                  {lang === 'bs' ? 'Prevuci PDF ili Word dokument ovdje' : 'Drag a PDF or Word document here'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                  {lang === 'bs' ? 'ili kliknite da odaberete datoteku' : 'or click to select a file'}
                </div>
                <div style={{ display: 'flex', gap: 24, justifyContent: 'center', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>📕 PDF → <strong style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'pregled + preuzmi kao Word' : 'preview + download as Word'}</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>📘 Word → <strong style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'pregled + spremi kao PDF' : 'preview + save as PDF'}</strong></span>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.[0]) loadFromFile(e.target.files[0]); }} />
              </div>
            </div>
          )}

          {/* Processing spinner */}
          {processing && (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
                <div style={{ fontWeight: 600 }}>
                  {processing === 'converting'
                    ? (lang === 'bs' ? 'Konvertovanje Word dokumenta...' : 'Converting Word document...')
                    : (lang === 'bs' ? 'Konvertovanje PDF-a u Word (MuPDF)...' : 'Converting PDF to editable Word (MuPDF)...')}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {lang === 'bs' ? 'Ovo može potrajati nekoliko sekundi.' : 'This may take a few seconds.'}
                </div>
              </div>
            </div>
          )}

          {/* Document viewer */}
          {loaded && !processing && (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{getIcon(loaded.name)}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loaded.name}
                    {isWord && <span style={{ marginLeft: 8, fontSize: '0.7rem', background: 'rgba(0,191,166,0.12)', color: 'var(--primary)', padding: '1px 7px', borderRadius: 8, fontWeight: 700 }}>Word → HTML</span>}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={openInTab}>👁 {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                  {isPdf && <button className="btn btn-primary btn-sm" onClick={handleConvertPdfToWord} disabled={!!processing}>📘 {lang === 'bs' ? 'Konvertuj u Word' : 'Convert to Word'}</button>}
                  {isWord && <button className="btn btn-primary btn-sm" onClick={printDoc}>🖨️ {lang === 'bs' ? 'Konvertuj u PDF' : 'Convert to PDF'}</button>}
                  {isPdf && <button className="btn btn-ghost btn-sm" onClick={printDoc}>🖨️ {lang === 'bs' ? 'Ispiši' : 'Print'}</button>}
                  <button className="btn btn-ghost btn-sm" onClick={downloadOriginal}>⬇️ {lang === 'bs' ? 'Preuzmi original' : 'Download'}</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={close}>✕</button>
                </div>

                {isWord && (
                  <div style={{ padding: '5px 14px', background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 {lang === 'bs' ? '"Konvertuj u PDF" otvara dijaloški okvir za ispis — odaberite "Spremi kao PDF".' : '"Convert to PDF" opens the print dialog — select "Save as PDF".'}
                  </div>
                )}
                {isPdf && (
                  <div style={{ padding: '5px 14px', background: 'rgba(99,102,241,0.05)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 {lang === 'bs' ? 'Konverzija putem MuPDF (WASM) — editabilni tekst + tabele, bez vanjskog servisa.' : 'Conversion via MuPDF (WASM) — editable text + tables, no external service.'}
                  </div>
                )}


                {/* Iframe preview — no sandbox so PDFs work, explicit white bg */}
                <iframe
                  key={loaded.iframeSrc}
                  src={loaded.iframeSrc}
                  style={{ width: '100%', height: '72vh', border: 'none', display: 'block', background: '#ffffff' }}
                  title={loaded.name}
                />
              </div>
            </div>
          )}
        </div>

        {/* Archive picker */}
        <div>
          <div className="card">
            <div className="card-body">
              <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                🗄️ {lang === 'bs' ? 'Iz Digitalne Arhive' : 'From Digital Archive'}
              </div>
              <div className="search-bar" style={{ marginBottom: 12 }}>
                <input placeholder={lang === 'bs' ? 'Pretraži arhivu...' : 'Search archive...'}
                  value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.85rem', flex: 1, width: '100%' }} />
                {archiveSearch && <button className="btn btn-ghost btn-sm" onClick={() => setArchiveSearch('')}>✕</button>}
              </div>
              {filteredArchive.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {lang === 'bs' ? 'Nema datoteka u arhivi' : 'No files in archive'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '74vh', overflowY: 'auto' }}>
                  {filteredArchive.map(file => (
                    <button key={file.id} onClick={() => loadFromArchive(file)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: loaded?.name === file.name ? 'rgba(0,191,166,0.08)' : 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontSize: '0.82rem', fontFamily: 'var(--font-body)', color: 'var(--text)', transition: 'all 0.15s' }}>
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{getIcon(file.name)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      {isWordExt(getExt(file.name)) && <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>WD</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
