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
const getExt = (name = '') => name.split('.').pop()?.toLowerCase() || '';
const getIcon = (name = '') => FILE_ICONS[getExt(name)] || '📎';

export default function ConverterPage() {
  const { lang } = useLanguage();
  const { alert, DialogRenderer } = useDialog();
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(null); // { name, data, htmlBlob, ext }
  const [converting, setConverting] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const fileInputRef = useRef(null);

  const archiveFiles = getAll(COLLECTIONS.DIGITAL_ARCHIVE);
  const { sorted: filteredArchive } = useSortedList(
    archiveFiles.filter(f =>
      !archiveSearch || f.name?.toLowerCase().includes(archiveSearch.toLowerCase())
    ),
    'name'
  );

  const loadFile = async (file) => {
    if (file.size > 20 * 1024 * 1024) {
      await alert(lang === 'bs' ? 'Datoteka mora biti manja od 20MB!' : 'File must be under 20MB!');
      return;
    }
    const ext = getExt(file.name);
    const data = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    if (ext === 'docx' || ext === 'doc') {
      // Convert DOCX → HTML using mammoth
      setConverting(true);
      try {
        const mammoth = (await import('mammoth/mammoth.browser')).default;
        // mammoth needs ArrayBuffer
        const arrayBuf = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuf });
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${file.name}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 40px; line-height: 1.6; color: #222; }
  img { max-width: 100%; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  td, th { border: 1px solid #ccc; padding: 6px 10px; }
  h1,h2,h3 { color: #111; }
</style>
</head><body>${result.value}</body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(blob);
        setLoaded({ name: file.name, data, htmlBlob: htmlUrl, ext });
      } catch (e) {
        console.error('mammoth error', e);
        // Fallback: just load as-is
        setLoaded({ name: file.name, data, htmlBlob: null, ext });
        await alert(lang === 'bs' ? 'Greška pri čitanju Word dokumenta. Pokušajte s PDF.' : 'Error reading Word document. Try PDF instead.');
      } finally {
        setConverting(false);
      }
    } else {
      setLoaded({ name: file.name, data, htmlBlob: null, ext });
    }
  };

  const loadFromArchive = async (file) => {
    const ext = getExt(file.name);
    if (ext === 'docx' || ext === 'doc') {
      // Decode base64 → ArrayBuffer
      setConverting(true);
      try {
        const mammoth = (await import('mammoth/mammoth.browser')).default;
        const base64 = file.data.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${file.name}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 40px;line-height:1.6;color:#222;}img{max-width:100%;}table{border-collapse:collapse;width:100%;margin:16px 0;}td,th{border:1px solid #ccc;padding:6px 10px;}h1,h2,h3{color:#111;}</style>
</head><body>${result.value}</body></html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(blob);
        setLoaded({ name: file.name, data: file.data, htmlBlob: htmlUrl, ext });
      } catch(e) {
        setLoaded({ name: file.name, data: file.data, htmlBlob: null, ext });
      } finally {
        setConverting(false);
      }
    } else {
      setLoaded({ name: file.name, data: file.data, htmlBlob: null, ext });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const iframeSrc = loaded ? (loaded.htmlBlob || loaded.data) : null;
  const isWord = loaded && (loaded.ext === 'docx' || loaded.ext === 'doc');

  const openInTab = () => {
    if (!iframeSrc) return;
    const w = window.open();
    if (w) {
      if (loaded.htmlBlob) {
        w.location.href = iframeSrc;
      } else {
        w.document.write(`<html><head><title>${loaded.name}</title></head><body style="margin:0"><iframe src="${iframeSrc}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
        w.document.close();
      }
    }
  };

  const printAsPDF = () => {
    if (!iframeSrc) return;
    const w = window.open(iframeSrc);
    if (w) {
      w.addEventListener('load', () => {
        w.focus();
        w.print();
      });
    }
  };

  const download = () => {
    if (!loaded) return;
    const a = document.createElement('a');
    a.href = loaded.data;
    a.download = loaded.name;
    a.click();
  };

  return (
    <div className="animate-fadeIn">
      <DialogRenderer />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: '1.6rem' }}>🔄</span>
        <div>
          <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Word/PDF Konverter' : 'Word/PDF Converter'}</h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {lang === 'bs'
              ? 'Word (.docx) dokumenti se prikazuju i mogu se ispisati kao PDF. PDF dokumenti se otvaraju direktno.'
              : 'Word (.docx) documents are rendered and can be printed/saved as PDF. PDFs open directly.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 20 }}>
        {/* Left: main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Drop zone */}
          {!loaded && !converting && (
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
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                  {lang === 'bs' ? 'ili kliknite da odaberete datoteku' : 'or click to select a file'}
                </div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <span>📕 PDF → {lang === 'bs' ? 'pregled + ispis' : 'preview + print'}</span>
                  <span>📘 Word (.docx) → {lang === 'bs' ? 'pregled + Spremi kao PDF' : 'preview + Save as PDF'}</span>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }} />
              </div>
            </div>
          )}

          {converting && (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
                <div style={{ fontWeight: 600 }}>{lang === 'bs' ? 'Konvertovanje Word dokumenta...' : 'Converting Word document...'}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {lang === 'bs' ? 'Ovo može potrajati nekoliko sekundi.' : 'This may take a few seconds.'}
                </div>
              </div>
            </div>
          )}

          {/* Document viewer */}
          {loaded && !converting && (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.2rem' }}>{getIcon(loaded.name)}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loaded.name}
                    {isWord && <span style={{ marginLeft: 8, fontSize: '0.72rem', background: 'rgba(0,191,166,0.12)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>Word → HTML</span>}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={openInTab}>👁 {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                  <button className="btn btn-primary btn-sm" onClick={printAsPDF}>
                    🖨️ {isWord ? (lang === 'bs' ? 'Spremi kao PDF' : 'Save as PDF') : (lang === 'bs' ? 'Ispiši' : 'Print')}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={download}>⬇️ {lang === 'bs' ? 'Preuzmi original' : 'Download original'}</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setLoaded(null)}>✕</button>
                </div>

                {isWord && (
                  <div style={{ padding: '6px 14px', background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    💡 {lang === 'bs'
                      ? 'Word dokument je konvertovan u HTML prikaz. Kliknite "Spremi kao PDF" → odaberite "Spremi kao PDF" u dijalogu ispisa.'
                      : 'Word document converted to HTML preview. Click "Save as PDF" → choose "Save as PDF" in the print dialog.'}
                  </div>
                )}

                {/* Iframe preview */}
                <iframe
                  key={iframeSrc}
                  src={iframeSrc}
                  style={{ width: '100%', height: '70vh', border: 'none', display: 'block' }}
                  title={loaded.name}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Digitalna Arhiva picker */}
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
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.85rem', flex: 1, width: '100%' }}
                />
                {archiveSearch && <button className="btn btn-ghost btn-sm" onClick={() => setArchiveSearch('')}>✕</button>}
              </div>
              {filteredArchive.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {lang === 'bs' ? 'Nema datoteka u arhivi' : 'No files in archive'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '70vh', overflowY: 'auto' }}>
                  {filteredArchive.map(file => (
                    <button
                      key={file.id}
                      onClick={() => loadFromArchive(file)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left',
                        fontSize: '0.82rem', fontFamily: 'var(--font-body)', color: 'var(--text)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{getIcon(file.name)}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
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
