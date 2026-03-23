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

// Force white background in the iframe so dark-mode never bleeds in
function makeHtml(title, body) {
  return `<!DOCTYPE html>
<html style="color-scheme:light;background:#fff">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  html,body{color-scheme:light!important;background:#ffffff!important;color:#222!important;
    font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;padding:32px 40px;line-height:1.6}
  img{max-width:100%}
  table{border-collapse:collapse;width:100%;margin:16px 0}
  td,th{border:1px solid #bbb;padding:6px 10px}
  h1,h2,h3,h4{color:#111}
  p{margin:0 0 10px}
</style>
</head>
<body>${body}</body>
</html>`;
}

async function convertDocxToHtmlUrl(source) {
  // source: File object or base64 data URI string
  const mammoth = (await import('mammoth/mammoth.browser')).default;
  let arrayBuffer;
  if (source instanceof File) {
    arrayBuffer = await source.arrayBuffer();
  } else {
    // base64 data URI → ArrayBuffer
    const base64 = source.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    arrayBuffer = bytes.buffer;
  }
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = makeHtml('Word dokument', result.value);
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
}

async function convertPdfToDocx(dataUri, filename) {
  // Extract text from PDF using pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.5.207/pdf.worker.min.mjs`;

  const base64 = dataUri.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const paragraphs = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const lines = [];
    let lastY = null;
    for (const item of content.items) {
      if ('str' in item) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
          lines.push('');
        }
        lines.push(item.str);
        lastY = item.transform[5];
      }
    }
    paragraphs.push(lines.join(' '));
    if (pageNum < pdf.numPages) paragraphs.push('\n\n--- Stranica ' + pageNum + ' ---\n\n');
  }

  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const docParagraphs = paragraphs.flatMap(block =>
    block.split('\n').map(line => new Paragraph({ children: [new TextRun(line)] }))
  );
  const doc = new Document({ sections: [{ children: docParagraphs }] });
  const blob = await Packer.toBlob(doc);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.pdf$/i, '.docx');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function ConverterPage() {
  const { lang } = useLanguage();
  const { alert, DialogRenderer } = useDialog();
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(null); // { name, data, iframeSrc, ext }
  const [processing, setProcessing] = useState(''); // '' | 'converting' | 'word2pdf'
  const [archiveSearch, setArchiveSearch] = useState('');
  const fileInputRef = useRef(null);

  const archiveFiles = getAll(COLLECTIONS.DIGITAL_ARCHIVE);
  const { sorted: filteredArchive } = useSortedList(
    archiveFiles.filter(f =>
      !archiveSearch || f.name?.toLowerCase().includes(archiveSearch.toLowerCase())
    ),
    'name'
  );

  const processFile = useCallback(async (sourceFile, name, dataUri) => {
    const ext = getExt(name);
    if (isWordExt(ext)) {
      setProcessing('converting');
      try {
        const htmlUrl = await convertDocxToHtmlUrl(sourceFile || dataUri);
        setLoaded({ name, data: dataUri, iframeSrc: htmlUrl, ext });
      } catch (e) {
        console.error(e);
        await alert(lang === 'bs' ? 'Greška pri čitanju Word dokumenta.' : 'Error reading Word document.');
        setLoaded({ name, data: dataUri, iframeSrc: dataUri, ext });
      } finally {
        setProcessing('');
      }
    } else {
      // PDF or other — display directly
      setLoaded({ name, data: dataUri, iframeSrc: dataUri, ext });
    }
  }, [lang, alert]);

  const loadFromFile = async (file) => {
    if (file.size > 30 * 1024 * 1024) {
      await alert(lang === 'bs' ? 'Datoteka mora biti manja od 30MB!' : 'File must be under 30MB!');
      return;
    }
    const dataUri = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    await processFile(file, file.name, dataUri);
  };

  const loadFromArchive = async (file) => {
    await processFile(null, file.name, file.data);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFromFile(file);
  };

  const openInTab = () => {
    if (!loaded) return;
    const w = window.open(loaded.iframeSrc);
    if (!w) window.open(loaded.iframeSrc, '_blank');
  };

  const printDoc = () => {
    if (!loaded) return;
    const w = window.open(loaded.iframeSrc);
    if (w) w.addEventListener('load', () => { w.focus(); w.print(); });
  };

  const download = () => {
    if (!loaded) return;
    const a = document.createElement('a');
    a.href = loaded.data;
    a.download = loaded.name;
    a.click();
  };

  const handleConvertPdfToWord = async () => {
    if (!loaded) return;
    setProcessing('pdf2word');
    try {
      await convertPdfToDocx(loaded.data, loaded.name);
    } catch (e) {
      console.error(e);
      await alert(lang === 'bs'
        ? 'Greška pri konverziji PDF-a. Mogući uzrok: zaštićeni PDF ili samo slike.'
        : 'Conversion error. The PDF may be protected or image-only.');
    } finally {
      setProcessing('');
    }
  };

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
            {lang === 'bs'
              ? 'PDF i Word dokumenti — pregled, ispis, preuzimanje i konverzija'
              : 'PDF and Word documents — preview, print, download and convert'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 20 }}>
        {/* Left: main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Drop zone — only when nothing loaded */}
          {!loaded && !processing && (
            <div
              className="card"
              style={{
                border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)',
                background: dragging ? 'rgba(0,191,166,0.04)' : 'transparent',
                transition: 'all 0.2s', cursor: 'pointer',
              }}
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
                  <span style={{ color: 'var(--text-muted)' }}>📕 PDF → <strong style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'pregled + konverzija u Word' : 'preview + convert to Word'}</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>📘 Word → <strong style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'pregled + konverzija u PDF' : 'preview + convert to PDF'}</strong></span>
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
                    ? (lang === 'bs' ? 'Konvertovanje Word dokumenta u HTML...' : 'Converting Word to HTML...')
                    : (lang === 'bs' ? 'Ekstrakcija teksta iz PDF-a i kreiranje Word dokumenta...' : 'Extracting text from PDF and creating Word file...')}
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
                {/* ── Toolbar ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{getIcon(loaded.name)}</span>
                  <span style={{
                    fontWeight: 600, fontSize: '0.9rem', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {loaded.name}
                    {isWord && (
                      <span style={{
                        marginLeft: 8, fontSize: '0.7rem', background: 'rgba(0,191,166,0.12)',
                        color: 'var(--primary)', padding: '1px 7px', borderRadius: 8, fontWeight: 700
                      }}>Word → HTML</span>
                    )}
                  </span>

                  {/* Otvori */}
                  <button className="btn btn-ghost btn-sm" onClick={openInTab} title={lang === 'bs' ? 'Otvori u novoj kartici' : 'Open in new tab'}>
                    👁 {lang === 'bs' ? 'Otvori' : 'Open'}
                  </button>

                  {/* Convert to PDF (Word only) */}
                  {isWord && (
                    <button className="btn btn-primary btn-sm" onClick={printDoc} title={lang === 'bs' ? 'Ispiši / Spremi kao PDF' : 'Print / Save as PDF'}>
                      🖨️ {lang === 'bs' ? 'Konvertuj u PDF' : 'Convert to PDF'}
                    </button>
                  )}

                  {/* Convert to Word (PDF only) */}
                  {isPdf && (
                    <button className="btn btn-primary btn-sm" onClick={handleConvertPdfToWord}
                      disabled={!!processing}
                      title={lang === 'bs' ? 'Konvertuj u Word (.docx)' : 'Convert to Word (.docx)'}>
                      📘 {lang === 'bs' ? 'Konvertuj u Word' : 'Convert to Word'}
                    </button>
                  )}

                  {/* Print (PDF only) */}
                  {isPdf && (
                    <button className="btn btn-ghost btn-sm" onClick={printDoc}>
                      🖨️ {lang === 'bs' ? 'Ispiši' : 'Print'}
                    </button>
                  )}

                  {/* Download original */}
                  <button className="btn btn-ghost btn-sm" onClick={download}>
                    ⬇️ {lang === 'bs' ? 'Preuzmi original' : 'Download original'}
                  </button>

                  {/* Close */}
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                    onClick={() => setLoaded(null)}>✕</button>
                </div>

                {/* Hint for Word → PDF */}
                {isWord && (
                  <div style={{
                    padding: '5px 14px', background: 'rgba(0,191,166,0.06)',
                    borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)'
                  }}>
                    💡 {lang === 'bs'
                      ? '"Konvertuj u PDF" otvara dijaloški okvir za ispis — odaberite "Spremi kao PDF" u pregledniku.'
                      : '"Convert to PDF" opens the print dialog — select "Save as PDF" in your browser.'}
                  </div>
                )}

                {/* Hint for PDF → Word */}
                {isPdf && (
                  <div style={{
                    padding: '5px 14px', background: 'rgba(99,102,241,0.05)',
                    borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)'
                  }}>
                    💡 {lang === 'bs'
                      ? '"Konvertuj u Word" ekstrahira tekst iz PDF-a i preuzima .docx datoteku. Formatiranje se može razlikovati.'
                      : '"Convert to Word" extracts text from the PDF and downloads a .docx file. Formatting may differ.'}
                  </div>
                )}

                {/* Iframe — ALWAYS white background regardless of app theme */}
                <iframe
                  key={loaded.iframeSrc}
                  src={loaded.iframeSrc}
                  style={{
                    width: '100%', height: '72vh', border: 'none', display: 'block',
                    background: '#ffffff', colorScheme: 'light',
                  }}
                  title={loaded.name}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Archive picker */}
        <div>
          <div className="card">
            <div className="card-body">
              <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                🗄️ {lang === 'bs' ? 'Iz Digitalne Arhive' : 'From Digital Archive'}
              </div>
              <div className="search-bar" style={{ marginBottom: 12 }}>
                <input
                  placeholder={lang === 'bs' ? 'Pretraži arhivu...' : 'Search archive...'}
                  value={archiveSearch}
                  onChange={e => setArchiveSearch(e.target.value)}
                  style={{
                    border: 'none', background: 'transparent', outline: 'none',
                    fontFamily: 'var(--font-body)', fontSize: '0.85rem', flex: 1, width: '100%'
                  }}
                />
                {archiveSearch && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setArchiveSearch('')}>✕</button>
                )}
              </div>
              {filteredArchive.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {lang === 'bs' ? 'Nema datoteka u arhivi' : 'No files in archive'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '74vh', overflowY: 'auto' }}>
                  {filteredArchive.map(file => (
                    <button
                      key={file.id}
                      onClick={() => loadFromArchive(file)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                        background: loaded?.name === file.name ? 'rgba(0,191,166,0.08)' : 'var(--bg-card)',
                        cursor: 'pointer', textAlign: 'left', fontSize: '0.82rem',
                        fontFamily: 'var(--font-body)', color: 'var(--text)', transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{getIcon(file.name)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                      {isWordExt(getExt(file.name)) && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>WD</span>
                      )}
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
