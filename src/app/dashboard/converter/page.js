'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, getRawAll, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { callFirebaseFunction } from '@/lib/firebaseCallable';
import PageHeader from '@/components/PageHeader';

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

// ─── Firebase Backend PDF → DOCX ─────────────────────────────────────────────
async function convertPdfToDocxMuPDF(dataUri) {
  const base64Data = dataUri.split(',')[1];
  const result = await callFirebaseFunction('pdfToWord', { base64Data, filename: 'document.pdf' });
  const rawBase64 = result.base64Data;
  const binary = atob(rawBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export default function ConverterPage() {
  const { lang, t } = useLanguage();
  const { alert, DialogRenderer } = useDialog();
  const [activeTab, setActiveTab] = useState('convert'); // 'convert' | 'merge'
  const [mergeFiles, setMergeFiles] = useState([]); // array of { id, name, arrayBuffer }
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(null);  // loaded.htmlBody = raw mammoth HTML
  const [processing, setProcessing] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const fileInputRef = useRef(null);
  const blobUrlsRef = useRef([]);

  // Same form collections as the Digital Archive page (archive/page.js)
  const FORM_SOURCES = [
    { col: 'requests',      label: 'Zahtjevnica' },
    { col: 'formsOir1',     label: 'Obrazac OIR-1' },
    { col: 'formsRo1',      label: 'Obrazac RO-1' },
    { col: 'formsRo2',      label: 'Obrazac RO-2' },
    { col: 'referralsNr1',  label: 'Lj. uputnica (NR1)' },
    { col: 'referralsRa1',  label: 'Lj. uputnica (RA1)' },
    { col: 'employerDocs',  label: 'Dokumentacija za poslodavca' },
    { col: 'certificates',  label: 'Uvjerenje radnika' },
  ];

  const readArchive = () => {
    if (typeof window === 'undefined') return [];
    
    // 1. All digitalArchive items (with or without binary data)
    const da = getRawAll(COLLECTIONS.DIGITAL_ARCHIVE).map(f => ({
      ...f,
      name: f.name || f.naziv || 'Dokument',
      hasData: !!(f.data?.startsWith?.('data:')),
    }));
    const seen = new Set(da.map(f => f.id));
    
    const docs = [];

    // 2. Form/referral generated docs — exactly mirroring archive/page.js FORM_SOURCES
    FORM_SOURCES.forEach(({ col, label }) => {
      try {
        const recs = getRawAll(col);
        recs.forEach(r => {
          const fName = r.docName || r.attachedFileName || r.fileName || r.datotekaIme;
          const fData = r.docData || r.attachedFileData || r.fileData || r.datotekaSadrzaj;
          if (fName && fData) {
            const uid = `form-${col}-${r.id}`;
            if (seen.has(uid)) return;
            seen.add(uid);
            docs.push({
              id: uid,
              name: fName,
              data: fData,
              hasData: true,
              category: label.includes('Uvjerenje') ? 'Certifikati' : 'Obrasci',
              description: r.ime ? `${r.ime}` : label,
              _sourceLabel: label,
            });
          }
        });
      } catch { /* ignore */ }
    });

    // 3. Aggregate fleet vehicle documents (nested inside vehicle records)
    try {
      const vehicles = getRawAll('vehicles');
      vehicles.forEach(v => {
        const vDocs = v.dokumenti || [];
        vDocs.forEach(d => {
          if (d.naziv && d.docData) {
            const uid = `fleet-doc-${v.id}-${d.id}`;
            if (seen.has(uid)) return;
            seen.add(uid);
            docs.push({
              id: uid,
              name: d.naziv,
              data: d.docData,
              hasData: true,
              category: d.kategorija === 'Osiguranje' ? 'Ugovori' : d.kategorija === 'Tehnički pregled' ? 'Certifikati' : 'Ostalo',
              description: `${v.registracija || 'Vozilo'} — ${d.kategorija || 'Ostalo'}`,
              _sourceLabel: 'Vozni park',
            });
          }
        });
      });
    } catch { /* ignore */ }

    // 4. Aggregate fleet-documents module docs
    try {
      const fleetDocs = getRawAll('fleetDocuments');
      fleetDocs.forEach(fd => {
        const fName = fd.docName || fd.attachedFileName || fd.fileName || fd.datotekaIme;
        const fData = fd.docData || fd.attachedFileData || fd.fileData || fd.datotekaSadrzaj;
        if (fName && fData) {
          const uid = `fleet-fdoc-${fd.id}`;
          if (seen.has(uid)) return;
          seen.add(uid);
          docs.push({
            id: uid,
            name: fName,
            data: fData,
            hasData: true,
            category: 'Ostalo',
            description: fd.naziv || fd.ime || 'Flota dokument',
            _sourceLabel: 'Flota dokumenti',
          });
        }
      });
    } catch { /* ignore */ }

    // 5. Aggregate fleet-orders travel orders
    try {
      const fleetOrders = getRawAll('fleetOrders');
      fleetOrders.forEach(fo => {
        const fName = fo.docName || fo.attachedFileName || fo.fileName || fo.datotekaIme;
        const fData = fo.docData || fo.attachedFileData || fo.fileData || fo.datotekaSadrzaj;
        if (fName && fData) {
          const uid = `fleet-order-${fo.id}`;
          if (seen.has(uid)) return;
          seen.add(uid);
          docs.push({
            id: uid,
            name: fName,
            data: fData,
            hasData: true,
            category: 'Obrasci',
            description: fo.opis || fo.naziv || 'Putni nalog',
            _sourceLabel: 'Putni nalozi',
          });
        }
      });
    } catch { /* ignore */ }

    return [...da, ...docs];
  };

  const [archiveFiles, setArchiveFiles] = useState([]); // populated by useEffect below

  // useEffect runs CLIENT-SIDE ONLY.
  // useState lazy init runs on server too (returns []) so we MUST load here.
  useEffect(() => {
    setArchiveFiles(readArchive()); // load immediately on mount
    const onFocus = () => setArchiveFiles(readArchive()); // refresh when tab regains focus
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
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
        await alert(t('greskaPriCitanjuWordDokumenta'));
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

  const loadFromFile = async (files) => {
    const fileList = Array.from(files);
    
    if (activeTab === 'merge') {
      const pdfFiles = fileList.filter(f => getExt(f.name) === 'pdf');
      if (pdfFiles.length === 0) return alert(t('samoPdfDatotekeSeMogu'));
      
      const newMergeFiles = [];
      for (const file of pdfFiles) {
        if (file.size> 30 * 1024 * 1024) continue;
        const arrayBuffer = await file.arrayBuffer();
        newMergeFiles.push({ id: Math.random().toString(36).substr(2, 9), name: file.name, arrayBuffer });
      }
      setMergeFiles(prev => [...prev, ...newMergeFiles]);
      return;
    }

    // Convert mode (single file)
    const file = fileList[0];
    if (file.size> 30 * 1024 * 1024) {
      await alert(t('datotekaMoraBitiManjaOd'));
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
    if (!file.hasData && !file.data?.startsWith?.('data:')) {
      await alert(
        t('sadrzajOveDatotekeNijePohranjen')
      );
      return;
    }
    const arrayBuffer = dataUriToBuffer(file.data);
    
    if (activeTab === 'merge') {
      if (getExt(file.name) !== 'pdf') return alert(t('samoPdfDatotekeSeMogu'));
      setMergeFiles(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: file.name, arrayBuffer }]);
      return;
    }

    // Convert mode
    await loadFile(arrayBuffer, file.name, file.data);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) loadFromFile(e.dataTransfer.files);
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
      const body = loaded.htmlBody || '';
      if (!body) throw new Error('Reload the document first');

      // ── Render in a HIDDEN IFRAME (isolated context, no visual interference) ──
      // The iframe is off-screen to the LEFT so it never overlaps the visible UI.
      // Its rendering context is completely separate from the main page.
      const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:50px 60px;background:#fff!important;color:#111!important;
    font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.6;
    width:794px;max-width:794px}
  h1,h2,h3,h4,h5,h6{color:#1a2e50!important;page-break-after:avoid;break-after:avoid}
  table{border-collapse:collapse;width:100%;margin:10px 0}
  td,th{border:1px solid #ccc;padding:5px 8px}
  p{margin:0 0 8px}img{max-width:100%}
</style></head><body>${body}</body></html>`;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = [
        'position:fixed', 'left:-9999px', 'top:0',
        'width:794px', 'height:1123px',
        'border:none', 'pointer-events:none',
      ].join(';');
      // srcdoc = same-origin → html2canvas can access contentDocument
      iframe.srcdoc = fullHtml;
      document.body.appendChild(iframe);

      // Wait for iframe to load content + settle
      await new Promise(r => {
        iframe.addEventListener('load', r, { once: true });
        setTimeout(r, 2000); // fallback
      });
      await new Promise(r => setTimeout(r, 400));

      const iframeDoc  = iframe.contentDocument;
      const iframeBody = iframeDoc.body;

      // Expand iframe to full document height so nothing is clipped
      const contentH = iframeBody.scrollHeight;
      iframe.style.height = contentH + 'px';
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      // ── Record heading Y positions inside iframe for smart page breaks ──
      const SCALE = 2;
      const bodyTop = iframeBody.getBoundingClientRect().top;
      const headingYsCanvas = [];
      for (const h of iframeBody.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        const relY = h.getBoundingClientRect().top - bodyTop;
        if (relY> 0) headingYsCanvas.push(Math.round(relY * SCALE));
      }
      headingYsCanvas.sort((a, b) => a - b);

      // ── Capture iframe body to canvas (no main-page interference) ──
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(iframeBody, {
        scale: SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        logging: false,
      });

      document.body.removeChild(iframe);

      // ── Smart page breaks: prefer to break just before each heading ──
      const findBreakY = (targetY, radiusPx) => {
        const windowStart = targetY - radiusPx * 2;
        const windowEnd   = targetY + Math.round(radiusPx * 0.3);
        let bestHeadingY = null;
        for (const hY of headingYsCanvas) {
          if (hY>= windowStart && hY <= windowEnd) bestHeadingY = hY;
        }
        if (bestHeadingY !== null) return Math.max(0, bestHeadingY - 8);
        // Fallback: find whitest row scanning backward
        const ctx  = canvas.getContext('2d');
        const from = Math.max(0, targetY - radiusPx);
        const to   = Math.min(canvas.height - 1, targetY);
        let bestY = targetY, bestWhite = -1;
        for (let y = to; y>= from; y--) {
          const row = ctx.getImageData(0, y, canvas.width, 1).data;
          let white = 0;
          for (let i = 0; i < row.length; i += 4) {
            if (row[i]>= 240 && row[i+1]>= 240 && row[i+2]>= 240) white++;
          }
          if (white> bestWhite) { bestWhite = white; bestY = y; }
        }
        return bestY;
      };

      // ── Build PDF ──
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const A4W = 210, A4H = 297;
      const pxPerMm = canvas.width / A4W;
      const nominalPageHPx = A4H * pxPerMm;

      let startY = 0, pageNum = 0;
      while (startY < canvas.height) {
        if (pageNum> 0) pdf.addPage();
        const nomBottom = startY + nominalPageHPx;
        const breakY = nomBottom>= canvas.height
          ? canvas.height
          : findBreakY(Math.round(nomBottom), Math.round(pxPerMm * 45));
        const sliceH = breakY - startY;
        if (sliceH < 2) break; // safety
        const slice  = document.createElement('canvas');
        slice.width  = canvas.width;
        slice.height = Math.ceil(sliceH);
        slice.getContext('2d').drawImage(
          canvas, 0, Math.floor(startY), canvas.width, Math.ceil(sliceH),
          0, 0, canvas.width, Math.ceil(sliceH)
        );
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, A4W, Math.min(sliceH / pxPerMm, A4H));
        startY = breakY;
        pageNum++;
      }

      pdf.save(loaded.name.replace(/\.(docx|doc)$/i, '.pdf'));
    } catch (e) {
      console.error('[word2pdf]', e);
      await alert(lang !== 'en' ? `Greška: ${e?.message || e}` : `Error: ${e?.message || e}`);
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
      await alert(lang !== 'en' ? `Greška: ${msg}` : `Error: ${msg}`);
    } finally {
      setProcessing('');
    }
  };

  const handleMerge = async () => {
    if (mergeFiles.length < 2) return alert(t('odaberiteBarem2PdfDatoteke'));
    setProcessing('merging');
    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of mergeFiles) {
        const pdfDoc = await PDFDocument.load(file.arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_${new Date().getTime()}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMergeFiles([]);
    } catch (e) {
      console.error('[pdf-merge]', e);
      await alert(lang !== 'en' ? `Greška pri spajanju: ${e?.message || e}` : `Merge error: ${e?.message || e}`);
    } finally {
      setProcessing('');
    }
  };

  const moveMergeFile = (index, direction) => {
    const newFiles = [...mergeFiles];
    if (direction === 'up' && index> 0) {
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
    } else if (direction === 'down' && index < newFiles.length - 1) {
      [newFiles[index + 1], newFiles[index]] = [newFiles[index], newFiles[index + 1]];
    }
    setMergeFiles(newFiles);
  };

  const removeMergeFile = (index) => {
    setMergeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const close = () => { cleanup(); setLoaded(null); };

  const isWord = loaded && isWordExt(loaded.ext);
  const isPdf = loaded && loaded.ext === 'pdf';

  return (
    <div className="animate-fadeIn">
      <DialogRenderer />
      {/* Header — stacks on mobile */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <PageHeader icon="🔄" title={t('converter')} subtitle={t('pdfIWordPregledIspis')} />
        
        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: 4, borderRadius: 10, border: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={() => setActiveTab('convert')} style={{ padding: '8px 16px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, border: 'none', background: activeTab === 'convert' ? 'var(--primary)' : 'transparent', color: activeTab === 'convert' ? '#fff' : 'var(--text)', cursor: 'pointer', transition: 'all 0.2s' }}>
            {t('konverzija')}
          </button>
          <button onClick={() => setActiveTab('merge')} style={{ padding: '8px 16px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, border: 'none', background: activeTab === 'merge' ? 'var(--primary)' : 'transparent', color: activeTab === 'merge' ? '#fff' : 'var(--text)', cursor: 'pointer', transition: 'all 0.2s' }}>
            {t('spajanjePdf')}
          </button>
        </div>
      </div>

      {/* Main grid — responsive: 2 columns on desktop, 1 on mobile */}
      <div className="converter-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Convert Tab Drop Zone */}
          {activeTab === 'convert' && !loaded && !processing && (
            <div className="card"
              style={{ border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)', background: dragging ? 'rgba(0,191,166,0.04)' : 'transparent', transition: 'all 0.2s', cursor: 'pointer' }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}>
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>{dragging ? '📂' : '🔄'}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                  {t('prevuciPdfIliWordDokument')}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                  {t('iliKlikniteDaOdabereteDatoteku')}
                </div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-muted)' }}>📕 PDF → <strong style={{ color: 'var(--primary)' }}>{t('pregledWord')}</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>📘 Word → <strong style={{ color: 'var(--primary)' }}>{t('pregledPdf')}</strong></span>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" multiple={activeTab === 'merge'} style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.length) loadFromFile(e.target.files); }} />
              </div>
            </div>
          )}
          
          {/* Merge Tab UI */}
          {activeTab === 'merge' && !processing && (
            <div className="card">
              <div className="card-body">
                <div style={{ marginBottom: 20, textAlign: 'center', padding: '30px 20px', border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)', borderRadius: 12, background: dragging ? 'rgba(0,191,166,0.04)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>{dragging ? '📂' : '📑'}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
                    {t('prevuciPdfDatotekeOvdje')}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {t('iliKlikniteZaOdabir')}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.length) loadFromFile(e.target.files); setDragging(false); }} />
                </div>

                {mergeFiles.length> 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span>{lang !== 'en' ? 'Odabrane datoteke (' + mergeFiles.length + ')' : 'Selected files (' + mergeFiles.length + ')'}</span>
                      <button className="btn btn-primary btn-sm" onClick={handleMerge} disabled={mergeFiles.length < 2}>
                        📑 {t('spojiPdfove')}
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {mergeFiles.map((file, i) => (
                        <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 8 }}>
                          <span style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 700, opacity: 0.5 }}>{i + 1}.</span>
                          <span style={{ fontSize: '1rem' }}>📕</span>
                          <span style={{ flex: 1, fontWeight: 500, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{file.name}</span>
                          
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => moveMergeFile(i, 'up')} title={t('pomakniGore')}>↑</button>
                            <button className="btn btn-ghost btn-icon btn-sm" disabled={i === mergeFiles.length - 1} onClick={() => moveMergeFile(i, 'down')} title={t('pomakniDolje')}>↓</button>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeMergeFile(i)} title={t('ukloni')}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                    ? (t('konvertovanjeWordDokumenta'))
                    : processing === 'merging' 
                      ? (t('spajanjePdfDatoteka'))
                      : (t('konvertovanjePdfaUWordMupdf'))}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {t('ovoMozePotrajatiNekolikoSekundi')}
                </div>
              </div>
            </div>
          )}

          {/* Document viewer (Convert Mode Only) */}
          {activeTab === 'convert' && loaded && !processing && (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {/* Toolbar — wraps on mobile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{getIcon(loaded.name)}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {loaded.name}
                    {isWord && <span style={{ marginLeft: 8, fontSize: '0.7rem', background: 'rgba(0,191,166,0.12)', color: 'var(--primary)', padding: '1px 7px', borderRadius: 8, fontWeight: 700 }}>Word → HTML</span>}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm" onClick={openInTab}>👁 {t('otvori')}</button>
                    {isPdf && <button className="btn btn-primary btn-sm" onClick={handleConvertPdfToWord} disabled={!!processing}>📘 {t('uWord')}</button>}
                    {isWord && <button className="btn btn-primary btn-sm" onClick={handleConvertWordToPdf} disabled={!!processing}>📥 {t('uPdf')}</button>}
                    {(isWord || isPdf) && <button className="btn btn-ghost btn-sm" onClick={printDoc}>🖨️ {t('ispisi')}</button>}
                    <button className="btn btn-ghost btn-sm" onClick={downloadOriginal}>⬇️ {t('preuzmi')}</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={close}>✕</button>
                  </div>
                </div>

                {isWord && (
                  <div style={{ padding: '5px 14px', background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 {t('uPdfAutomatskiPreuzimaPdf')}
                  </div>
                )}
                {isPdf && (
                  <div style={{ padding: '5px 14px', background: 'rgba(99,102,241,0.05)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 {t('konverzijaPutemMupdfEditabilniTekst')}
                  </div>
                )}

                {/* Iframe preview */}
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
                🗄️ {t('izDigitalneArhive')}
              </div>
              <div className="search-bar" style={{ marginBottom: 12 }}>
                <input placeholder={t('pretraziArhivu')}
                  value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.85rem', flex: 1, width: '100%' }} />
                {archiveSearch && <button className="btn btn-ghost btn-sm" onClick={() => setArchiveSearch('')}>✕</button>}
              </div>
              {filteredArchive.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {t('nemaDatotekaUArhivi')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '74vh', overflowY: 'auto' }}>
                  {filteredArchive.map(file => {
                      const noData = !file.hasData && !file.data?.startsWith?.('data:');
                      return (
                        <button key={file.id} onClick={() => loadFromArchive(file)}
                          title={noData ? (t('datotekaBezSadrzaja')) : file.name}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: loaded?.name === file.name ? 'rgba(0,191,166,0.08)' : 'var(--bg-card)', cursor: noData ? 'not-allowed' : 'pointer', textAlign: 'left', fontSize: '0.82rem', fontFamily: 'var(--font-body)', color: noData ? 'var(--text-muted)' : 'var(--text)', opacity: noData ? 0.6 : 1, transition: 'all 0.15s' }}>
                          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{noData ? '🔒' : getIcon(file.name)}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{file.name}</span>
                          {!noData && isWordExt(getExt(file.name)) && <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>WD</span>}
                          {noData && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', flexShrink: 0 }}>no file</span>}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .converter-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .converter-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
