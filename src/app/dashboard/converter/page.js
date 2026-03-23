'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, getRawAll, COLLECTIONS } from '@/lib/dataStore';
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
  const body = result.value;
  const html = makeHtml(title, body);
  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  return { blobUrl, body }; // Return BOTH for direct PDF use
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
    HeadingLevel, AlignmentType, Table, TableRow, TableCell,
    WidthType, BorderStyle,
  } = await import('docx');

  const NAVY = '1F3864';
  const DARK = '222222';
  const GRAY = '666666';

  const none  = () => ({ style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' });
  const thin  = () => ({ style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' });

  // Detect section headings: Roman numerals or all-caps bold
  const isHeading = (text, bold, size, body) => {
    const t = text.trim();
    if (/^(I{1,3}|IV|V{1,3}I{0,3}|IX|X{1,3}I{0,3})\.\s+\p{Lu}/u.test(t)) return true;
    if (t.length > 3 && t === t.toUpperCase() && (bold || size >= body)) return true;
    return false;
  };

  // Is text a solo checkbox symbol?
  const CB_RE = /^[✓✔☑☒☐□]$/;

  const allChildren = [];

  for (let pi = 0; pi < pages.length; pi++) {
    const { blocks = [], pageWidth = 595 } = pages[pi];
    const pageCenterX = pageWidth / 2;

    // ── Flatten all lines from all text blocks ──────────────────────────────
    // Each line: { text, font:{weight,style,size,name}, bbox, blockBbox, x, y }
    const allLines = [];
    for (const block of blocks) {
      if (block.type !== 'text') continue;
      for (const line of block.lines || []) {
        const text = line.text || (line.spans || []).map(s => s.text).join('') || '';
        if (!text.trim()) continue;
        allLines.push({
          text:     text.trim(),
          font:     line.font || {},
          x:        line.x ?? block.bbox.x,
          y:        Math.round(line.y ?? block.bbox.y),
          bbox:     line.bbox || block.bbox,
          blockW:   block.bbox.w,
        });
      }
    }

    // Skip header/footer lines (very top or very bottom of page)
    const margin = 30;
    const bodyLines = allLines.filter(l => l.y > margin && l.y < (pages[pi].pageHeight || 842) - margin);

    // Body font size (mode)
    const sizes = bodyLines.map(l => Math.round(l.font.size || 9)).filter(s => s > 0);
    const sizeCounts = sizes.reduce((a, s) => { a[s] = (a[s] || 0) + 1; return a; }, {});
    const bodySize = sizes.length ? Number(Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0][0]) : 9;

    // ── Group lines by Y position (same Y = same table row) ─────────────────
    const tol = Math.max(bodySize * 0.5, 4);
    const yGroups = []; // [{y, lines:[...]}]
    for (const line of bodyLines) {
      let placed = false;
      for (const g of yGroups) {
        if (Math.abs(g.y - line.y) <= tol) {
          g.lines.push(line);
          g.y = g.lines.reduce((s, l) => s + l.y, 0) / g.lines.length;
          placed = true; break;
        }
      }
      if (!placed) yGroups.push({ y: line.y, lines: [line] });
    }
    yGroups.sort((a, b) => a.y - b.y);

    // ── Classify each Y-group and build DOCX elements ───────────────────────
    // A Y-group with 2+ lines at same Y = potential table row (label | value)
    // A Y-group with 1 line = paragraph

    // Accumulate consecutive 2-col table rows
    let tableAcc = [];
    const flushTable = () => {
      if (!tableAcc.length) return;
      if (tableAcc.length === 1 && tableAcc[0].length <= 3) {
        // Single-row multi-col (signature) — emit as table
        buildTable(tableAcc);
      } else if (tableAcc.length >= 2) {
        buildTable(tableAcc);
      } else {
        // Single-row, 1 col — emit as paragraph
        for (const row of tableAcc) for (const ln of row) emitLine(ln);
      }
      tableAcc = [];
    };

    const buildTable = (rows) => {
      const numCols = Math.max(...rows.map(r => r.length));

      // Calculate column widths from x positions
      // Col boundary: x position of second column (first unique x > first col x)
      // Use consistent x across all rows
      const col0xs = rows.map(r => r[0]?.x ?? 0);
      const col1xs = rows.filter(r => r[1]).map(r => r[1]?.x ?? 0);
      const col0x = Math.min(...col0xs);
      const col1x = col1xs.length ? Math.min(...col1xs) : col0x + 100;
      // Page content width from left col start to ~right margin
      const rightEdge = Math.max(...rows.flatMap(r => r.map(l => (l.x || 0) + (l.blockW || 0))));
      const totalW = Math.max(rightEdge - col0x, 1);
      const col0pct = numCols === 1 ? 100 : Math.max(Math.round((col1x - col0x) / totalW * 100), 10);
      const col1pct = 100 - col0pct;

      const isSingle = rows.length === 1;
      const tableRows = rows.map(row => {
        const cells = Array.from({ length: numCols }, (_, ci) => {
          const ln = row[ci];
          if (!ln) return new TableCell({ children: [new Paragraph({ children: [] })], width: { size: ci === 0 ? col0pct : col1pct, type: WidthType.PERCENTAGE }, borders: { top: none(), bottom: thin(), left: none(), right: none() }, margins: { top: 40, bottom: 40, left: 100, right: 100 } });
          const bold = ln.font.weight === 'bold' || (ln.font.name || '').toLowerCase().includes('bold') || (ln.font.name || '').toLowerCase().includes('semibold');
          const italic = ln.font.style === 'italic' || (ln.font.name || '').toLowerCase().includes('italic');
          const size = Math.max(Math.round((ln.font.size || bodySize) * 2 * 0.75), 16);
          const centered = isSingle && Math.abs((ln.x + ln.blockW / 2) - pageCenterX) < pageWidth * 0.1;
          const isSmall = (ln.font.size || bodySize) < bodySize * 0.85;
          const color = bold ? NAVY : (isSmall ? GRAY : DARK);
          const runs = CB_RE.test(ln.text)
            ? [new TextRun({ text: ln.text, font: 'Segoe UI Symbol', size, color })]
            : [new TextRun({ text: ln.text, bold, italics: italic, size, color })];
          return new TableCell({
            width: { size: ci === 0 ? col0pct : col1pct, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: runs, alignment: centered ? AlignmentType.CENTER : AlignmentType.LEFT })],
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            borders: { top: none(), bottom: thin(), left: none(), right: none() },
          });
        });
        return new TableRow({ children: cells });
      });

      allChildren.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: none(), bottom: none(), left: none(), right: none(), insideH: thin(), insideV: none() },
        }),
        new Paragraph({ children: [], spacing: { after: 80 } })
      );
    };

    const emitLine = (ln) => {
      const text = ln.text;
      const bold = ln.font.weight === 'bold' || (ln.font.name || '').toLowerCase().includes('bold') || (ln.font.name || '').toLowerCase().includes('semibold') || (ln.font.name || '').toLowerCase().includes('black');
      const italic = ln.font.style === 'italic' || (ln.font.name || '').toLowerCase().includes('italic');
      const size = ln.font.size || bodySize;
      const halfPt = Math.max(Math.round(size * 2 * 0.75), 16);
      const isLarger = size > bodySize * 1.2;
      const isMuchLarger = size > bodySize * 1.5;
      const isHead = isHeading(text, bold, size, bodySize);
      const isSmall = size < bodySize * 0.85;
      const blockCX = (ln.x || 0) + (ln.blockW || 0) / 2;
      const blockWide = (ln.blockW || 0) > pageWidth * 0.55;
      const isCentered = !blockWide && Math.abs(blockCX - pageCenterX) < pageWidth * 0.08;
      const color = isHead || isMuchLarger ? NAVY : (isSmall ? GRAY : DARK);

      let run;
      if (CB_RE.test(text)) {
        run = new TextRun({ text, font: 'Segoe UI Symbol', size: halfPt, color });
      } else {
        run = new TextRun({ text, bold: bold || isHead || isMuchLarger, italics: italic, size: halfPt, color });
      }

      if (isHead) {
        allChildren.push(new Paragraph({
          children: [run],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 4 } },
        }));
      } else if (isMuchLarger) {
        allChildren.push(new Paragraph({
          children: [run],
          spacing: { before: 160, after: 80 },
          alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        }));
      } else if (isLarger || bold) {
        allChildren.push(new Paragraph({
          children: [run],
          spacing: { before: 100, after: 40 },
          alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        }));
      } else {
        allChildren.push(new Paragraph({
          children: [run],
          spacing: { after: isSmall ? 20 : 60 },
          alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        }));
      }
    };

    for (const g of yGroups) {
      const { lines } = g;
      // Sort lines within group by x
      lines.sort((a, b) => (a.x || 0) - (b.x || 0));

      // Checkbox row: first line is solo checkbox, second is text
      if (lines.length === 2 && CB_RE.test(lines[0].text)) {
        flushTable();
        const ln = lines[1];
        const bold = (ln.font.name || '').toLowerCase().includes('bold') || (ln.font.name || '').toLowerCase().includes('semibold');
        const italic = ln.font.style === 'italic' || (ln.font.name || '').toLowerCase().includes('italic');
        const sz = Math.max(Math.round((ln.font.size || bodySize) * 2 * 0.75), 16);
        allChildren.push(new Paragraph({
          children: [
            new TextRun({ text: lines[0].text + '  ', font: 'Segoe UI Symbol', size: sz }),
            new TextRun({ text: ln.text, bold, italics: italic, size: sz, color: DARK }),
          ],
          spacing: { after: 40 },
          indent: { left: 0 },
        }));
        continue;
      }

      // Multi-column row (label | value or signature)
      if (lines.length >= 2) {
        tableAcc.push(lines);
        continue;
      }

      // Single line = paragraph
      flushTable();
      emitLine(lines[0]);
    }
    flushTable();

    if (pi < pages.length - 1)
      allChildren.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }

  const doc = new WDoc({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: DARK }, paragraph: { spacing: { line: 276 } } },
        heading2: { run: { bold: true, color: NAVY, size: 22, font: 'Calibri' } },
      },
    },
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
  const [loaded, setLoaded] = useState(null);  // loaded.htmlBody = raw mammoth HTML for PDF export
  const [processing, setProcessing] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveFiles, setArchiveFiles] = useState([]);
  const fileInputRef = useRef(null);
  const blobUrlsRef = useRef([]);

  // Read archive from localStorage on mount to pick up ALL files
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const da = getRawAll(COLLECTIONS.DIGITAL_ARCHIVE);
    const ed = getRawAll(COLLECTIONS.EMPLOYER_DOCS)
      .filter(d => d.data && (d.naziv || d.name))
      .map(d => ({ ...d, name: (d.naziv || d.name) + (d.ekstenzija || '.pdf') }));
    setArchiveFiles([...da, ...ed]);
  }, []);

  const { sorted: filteredArchive } = useSortedList(
    archiveFiles.filter(f =>
      !archiveSearch || (f.name || f.naziv || '').toLowerCase().includes(archiveSearch.toLowerCase())
    ), 'name'
  );


  const cleanup = () => {
    blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    blobUrlsRef.current = [];
  };

  const loadFile = useCallback(async (arrayBuffer, name, originalDataUri) => {
    const ext = getExt(name);
    cleanup();
    if (isWordExt(ext)) {
      setProcessing('converting');
      try {
        const { blobUrl, body } = await convertDocxToBlob(arrayBuffer, name);
        blobUrlsRef.current.push(blobUrl);
        setLoaded({ name, data: originalDataUri, iframeSrc: blobUrl, htmlBody: body, ext });
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

  const handleConvertWordToPdf = async () => {
    if (!loaded) return;
    setProcessing('word2pdf');
    try {
      // Use stored HTML body directly — no re-fetch needed, blob URL may be gone
      const body = loaded.htmlBody || '';
      if (!body) throw new Error('HTML content not available — please reload the document');

      const html = makeHtml(loaded.name, body);

      // Render into a container at FULL opacity but behind all UI (z-index:-9999)
      // html2canvas needs full-opacity elements to capture real colors
      const container = document.createElement('div');
      container.style.cssText = [
        'position:fixed',
        'top:0', 'left:0',
        'width:794px',
        'background:#fff',
        'color:#222',
        'font-family:Arial,Helvetica,sans-serif',
        'font-size:11pt',
        'line-height:1.5',
        'padding:60px 70px',
        'box-sizing:border-box',
        'z-index:-9999',  // Behind all UI — fully opaque so canvas captures real colors
        'pointer-events:none',
      ].join(';');
      // Use innerHTML of just the body content (not full HTML doc)
      container.innerHTML = body;
      document.body.appendChild(container);

      // Two rAF + small delay to ensure full paint
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 500));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 794,
        windowWidth: 794,
        logging: false,
      });

      document.body.removeChild(container);

      // Slice canvas into A4 pages
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const A4W = 210, A4H = 297;
      const pxPerMm = canvas.width / A4W;
      const pageHPx  = A4H * pxPerMm;

      let yPx = 0, page = 0;
      while (yPx < canvas.height) {
        if (page > 0) pdf.addPage();
        const sliceH = Math.min(pageHPx, canvas.height - yPx);
        const slice = document.createElement('canvas');
        slice.width  = canvas.width;
        slice.height = Math.ceil(sliceH);
        slice.getContext('2d').drawImage(
          canvas, 0, Math.floor(yPx), canvas.width, Math.ceil(sliceH),
          0, 0, canvas.width, Math.ceil(sliceH)
        );
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4W, sliceH / pxPerMm);
        yPx += pageHPx;
        page++;
      }

      pdf.save(loaded.name.replace(/\.(docx|doc)$/i, '.pdf'));
    } catch (e) {
      console.error('[word2pdf]', e);
      await alert(lang === 'bs' ? `Greška: ${e?.message || e}` : `Error: ${e?.message || e}`);
    } finally {
      setProcessing('');
    }
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
                  {isWord && <button className="btn btn-primary btn-sm" onClick={handleConvertWordToPdf} disabled={!!processing}>📥 {lang === 'bs' ? 'Konvertuj u PDF' : 'Convert to PDF'}</button>}
                  {isWord && <button className="btn btn-ghost btn-sm" onClick={printDoc}>🖨️ {lang === 'bs' ? 'Ispiši' : 'Print'}</button>}
                  {isPdf && <button className="btn btn-ghost btn-sm" onClick={printDoc}>🖨️ {lang === 'bs' ? 'Ispiši' : 'Print'}</button>}
                  <button className="btn btn-ghost btn-sm" onClick={downloadOriginal}>⬇️ {lang === 'bs' ? 'Preuzmi original' : 'Download'}</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={close}>✕</button>
                </div>

                {isWord && (
                  <div style={{ padding: '5px 14px', background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 {lang === 'bs' ? '"Konvertuj u PDF" automatski preuzima PDF. "Ispiši" otvara dijaloški okvir za ispis.' : '"Convert to PDF" auto-downloads a PDF. "Print" opens the print dialog.'}
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
