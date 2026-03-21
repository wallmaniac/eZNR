'use client';
import { useState, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';

const FILE_ICONS = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
  gif: '🖼️', zip: '📦', rar: '📦', txt: '📄',
};
const getIcon = (name = '') => FILE_ICONS[name.split('.').pop()?.toLowerCase()] || '📎';

export default function ConverterPage() {
  const { lang } = useLanguage();
  const { alert, DialogRenderer } = useDialog();
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(null); // { name, data }
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const fileInputRef = useRef(null);

  const archiveFiles = getAll(COLLECTIONS.DIGITAL_ARCHIVE);
  const { sorted: filteredArchive } = useSortedList(
    archiveFiles.filter(f =>
      !archiveSearch || f.name?.toLowerCase().includes(archiveSearch.toLowerCase())
    ),
    'name'
  );

  const loadFile = async (file) => {
    if (file.size > 10 * 1024 * 1024) {
      await alert(lang === 'bs' ? 'Datoteka mora biti manja od 10MB!' : 'File must be under 10MB!');
      return;
    }
    const data = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    setLoaded({ name: file.name, data });
  };

  const loadFromArchive = (file) => {
    setLoaded({ name: file.name, data: file.data });
    setArchiveOpen(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const openInTab = () => {
    if (!loaded) return;
    const w = window.open();
    if (w) {
      w.document.write(`<html><head><title>${loaded.name}</title></head><body style="margin:0"><iframe src="${loaded.data}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
      w.document.close();
    }
  };

  const download = () => {
    if (!loaded) return;
    const a = document.createElement('a');
    a.href = loaded.data;
    a.download = loaded.name;
    a.click();
  };

  const printDoc = () => {
    if (!loaded) return;
    const w = window.open();
    if (w) {
      w.document.write(`<html><head><title>${loaded.name}</title></head><body style="margin:0"><iframe src="${loaded.data}" id="fr" style="width:100%;height:100vh;border:none"></iframe><script>document.getElementById('fr').onload=function(){this.contentWindow.print();}<\/script></body></html>`);
      w.document.close();
    }
  };

  return (
    <div className="animate-fadeIn">
      <DialogRenderer />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: '1.6rem' }}>🔄</span>
        <div>
          <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Word/PDF Konverter' : 'Word/PDF Converter'}</h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {lang === 'bs' ? 'Otvorite, pregledajte, preuzmite ili ispišite PDF i Word dokumente' : 'Open, preview, download or print PDF and Word documents'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginTop: 20 }}>
        {/* Left: main panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Drop zone */}
          {!loaded && (
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  PDF, .doc, .docx — max 10MB
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }} />
              </div>
            </div>
          )}

          {/* Document viewer */}
          {loaded && (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.2rem' }}>{getIcon(loaded.name)}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loaded.name}</span>
                  <button className="btn btn-ghost btn-sm" onClick={openInTab} title={lang === 'bs' ? 'Otvori u novoj kartici' : 'Open in new tab'}>👁 {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={printDoc} title={lang === 'bs' ? 'Ispiši / Spremi kao PDF' : 'Print / Save as PDF'}>🖨️ {lang === 'bs' ? 'Ispiši / PDF' : 'Print / PDF'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={download} title={lang === 'bs' ? 'Preuzmi' : 'Download'}>⬇️ {lang === 'bs' ? 'Preuzmi' : 'Download'}</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setLoaded(null)}>✕</button>
                </div>
                {/* Iframe preview */}
                <iframe
                  src={loaded.data}
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
              <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '60vh', overflowY: 'auto' }}>
                  {filteredArchive.map(file => (
                    <button
                      key={file.id}
                      onClick={() => loadFromArchive(file)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                        background: loaded?.name === file.name ? 'rgba(0,191,166,0.08)' : 'var(--bg-card)',
                        cursor: 'pointer', textAlign: 'left', fontSize: '0.82rem', fontFamily: 'var(--font-body)',
                        color: 'var(--text)', transition: 'all 0.15s',
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
