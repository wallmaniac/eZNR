'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { matchWorkers, confidenceLabel, extractNameTokens } from '@/lib/textMatch';

// ── CDN loader ────────────────────────────────────────────────────────────────
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src; s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}
async function extractPdfText(arrayBuffer) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        text += tc.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
}
async function extractDocxText(arrayBuffer) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    if (!window.JSZip) throw new Error('JSZip not loaded');
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) throw new Error('Not a valid .docx file');
    const xml = await xmlFile.async('string');
    return xml.replace(/<w:p[ >]/g, '\n<w:p ').replace(/<w:br[^>]*>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();
}
async function generateCorrectedDocx(originalArrayBuffer, nameReplacements) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    const zip = await window.JSZip.loadAsync(originalArrayBuffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) throw new Error('Not a valid .docx');
    let xml = await xmlFile.async('string');
    for (const { original, corrected } of nameReplacements) {
        if (!original || !corrected || original === corrected) continue;
        const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        xml = xml.replace(new RegExp(escaped, 'gi'), corrected);
    }
    zip.file('word/document.xml', xml);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadText(text, filename) {
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}

// ── Label style (consistent with other eZNR forms) ────────────────────────────
const LS = {
    display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
    color: 'white', background: '#455a64', padding: '2px 8px', borderRadius: 3, marginBottom: 4,
};

const COLLECTION_KEY = 'zapisnici'; // localStorage key via dataStore pattern

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ZapisniciPage() {
    const { lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const bs = lang === 'bs';

    // ── List / view state ─────────────────────────────────────────────────────
    const [items, setItems]         = useState([]);
    const [search, setSearch]       = useState('');
    const [view, setView]           = useState('list'); // 'list' | 'create' | 'correct'
    const [editItem, setEditItem]   = useState(null);   // item being edited in form

    // ── Akcije dropdown portal ────────────────────────────────────────────────
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos]       = useState({ top: 0, left: 0, maxH: 300 });

    // ── Create / Edit form state ──────────────────────────────────────────────
    const EMPTY_FORM = { naziv: '', datum: new Date().toISOString().split('T')[0], mjesto: '', predmet: '', komisija: '', sadrzaj: '', napomena: '', fileData: null, fileName: '', fileType: '' };
    const [form, setForm]           = useState({ ...EMPTY_FORM });
    const [saving, setSaving]       = useState(false);
    const formFileRef               = useRef(null);

    // ── Korekcija state ───────────────────────────────────────────────────────
    const [corrItem, setCorrItem]     = useState(null);   // zapisnik being corrected
    const [corrText, setCorrText]     = useState('');
    const [corrRows, setCorrRows]     = useState([]);
    const [corrExtracting, setCorrExtracting] = useState(false);
    const [corrExtracted, setCorrExtracted] = useState(false);
    const [corrError, setCorrError]   = useState('');
    const [corrGenerating, setCorrGenerating] = useState(false);

    // ── Sorting ───────────────────────────────────────────────────────────────
    const { sorted, sortKey, sortDir, toggleSort } = useSortedList(
        items.filter(it => {
            if (!search) return true;
            const q = search.toLowerCase();
            return [it.naziv, it.datum, it.mjesto, it.predmet, it.komisija].some(f => (f || '').toLowerCase().includes(q));
        }),
        'datum', 'desc'
    );
    const thSt = (col) => ({
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        color: sortKey === col ? 'var(--primary)' : undefined,
    });
    const sortIco = (col) => sortKey !== col ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓';

    // ── Load data ─────────────────────────────────────────────────────────────
    const load = useCallback(() => {
        try {
            const raw = localStorage.getItem('eznr_zapisnici') || '[]';
            const all = JSON.parse(raw);
            // Company scope
            const cid = localStorage.getItem('eznr_activeCompany') || '';
            setItems(cid && cid !== 'all' ? all.filter(i => !i.companyId || i.companyId === cid) : all);
        } catch { setItems([]); }
    }, []);

    const saveToStore = (list) => {
        try { localStorage.setItem('eznr_zapisnici', JSON.stringify(list)); } catch {}
    };

    useEffect(() => { load(); }, [load]);

    // ── Close akcije on outside click ─────────────────────────────────────────
    useEffect(() => {
        const h = (e) => { if (!e.target.closest('[data-akcije-menu]') && !e.target.closest('[data-akcije-btn]')) setOpenMenuId(null); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const openMenu = (id, e) => {
        if (openMenuId === id) { setOpenMenuId(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const flipUp = spaceBelow < 180;
        setMenuPos(flipUp
            ? { bottom: window.innerHeight - rect.top + 4, left: rect.left - 140, maxH: Math.max(120, rect.top - 8) }
            : { top: rect.bottom + 4, left: rect.left - 140, maxH: Math.max(120, spaceBelow) }
        );
        setOpenMenuId(id);
    };

    // ── CRUD helpers ──────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.naziv.trim()) { await alert(bs ? 'Naziv je obavezan!' : 'Name is required!'); return; }
        setSaving(true);
        try {
            const cid = localStorage.getItem('eznr_activeCompany') || '';
            const raw = JSON.parse(localStorage.getItem('eznr_zapisnici') || '[]');
            if (editItem) {
                const idx = raw.findIndex(r => r.id === editItem.id);
                if (idx !== -1) { raw[idx] = { ...raw[idx], ...form, updatedAt: new Date().toISOString() }; }
            } else {
                const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
                raw.push({ ...form, id, companyId: cid && cid !== 'all' ? cid : '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
            }
            saveToStore(raw);
            load();
            setView('list');
            setForm({ ...EMPTY_FORM });
            setEditItem(null);
        } finally { setSaving(false); }
    };

    const handleEdit = (item) => {
        setEditItem(item);
        setForm({
            naziv: item.naziv || '', datum: item.datum || '', mjesto: item.mjesto || '',
            predmet: item.predmet || '', komisija: item.komisija || '',
            sadrzaj: item.sadrzaj || '', napomena: item.napomena || '',
            fileData: item.fileData || null, fileName: item.fileName || '', fileType: item.fileType || '',
        });
        setView('create');
        setOpenMenuId(null);
    };

    const handleDelete = async (item) => {
        setOpenMenuId(null);
        const ok = await confirm(bs ? `Obrisati zapisnik "${item.naziv}"?` : `Delete record "${item.naziv}"?`);
        if (!ok) return;
        const raw = JSON.parse(localStorage.getItem('eznr_zapisnici') || '[]');
        saveToStore(raw.filter(r => r.id !== item.id));
        load();
    };

    const handlePrint = (item) => {
        setOpenMenuId(null);
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<html><head><title>${item.naziv}</title><style>body{font-family:Arial,sans-serif;margin:40px;font-size:14px;}h2{margin-bottom:4px;}table{width:100%;border-collapse:collapse;margin-top:12px;}td{padding:6px 10px;border:1px solid #ccc;}td:first-child{font-weight:bold;width:160px;background:#f5f5f5;}</style></head><body>
        <h2>${item.naziv}</h2>
        <table>
            <tr><td>Datum</td><td>${item.datum || '—'}</td></tr>
            <tr><td>Mjesto</td><td>${item.mjesto || '—'}</td></tr>
            <tr><td>Predmet</td><td>${item.predmet || '—'}</td></tr>
            <tr><td>Komisija</td><td>${item.komisija || '—'}</td></tr>
            <tr><td>Sadržaj</td><td>${(item.sadrzaj || '').replace(/\n/g, '<br>')}</td></tr>
            <tr><td>Napomena</td><td>${item.napomena || '—'}</td></tr>
        </table>
        </body></html>`);
        w.document.close();
        w.print();
    };

    const handleDownload = (item) => {
        setOpenMenuId(null);
        if (item.fileData) {
            const a = document.createElement('a');
            a.href = item.fileData; a.download = item.fileName || `${item.naziv}.pdf`; a.click();
        } else {
            const txt = `ZAPISNIK: ${item.naziv}\nDatum: ${item.datum}\nMjesto: ${item.mjesto}\nPredmet: ${item.predmet}\nKomisija: ${item.komisija}\n\n${item.sadrzaj}\n\nNapomena: ${item.napomena}`;
            downloadText(txt, `${item.naziv.replace(/\s+/g, '_')}.txt`);
        }
    };

    const handleSendEmail = async (item) => {
        setOpenMenuId(null);
        const email = window.prompt(bs ? 'Unesite email adresu:' : 'Enter email address:', '');
        if (!email) return;
        window.location.href = `mailto:${email}?subject=${encodeURIComponent(item.naziv)}&body=${encodeURIComponent(`Zapisnik: ${item.naziv}\nDatum: ${item.datum}\nPredmet: ${item.predmet}`)}`;
    };

    // ── Korekcija (name correction) ───────────────────────────────────────────
    const startKorekcija = async (item) => {
        setOpenMenuId(null);
        setCorrItem(item);
        setCorrError('');
        setCorrRows([]);
        setCorrText('');
        setCorrExtracted(false);
        setView('correct');

        if (!item.fileData) {
            setCorrError(bs ? 'Ovaj zapisnik nema priloženu datoteku.' : 'This record has no attached file.');
            return;
        }
        setCorrExtracting(true);
        try {
            // Decode base64 to ArrayBuffer
            const b64 = item.fileData.split(',')[1] || item.fileData;
            const bin = atob(b64);
            const ab = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) ab[i] = bin.charCodeAt(i);
            const buf = ab.buffer;

            let text = '';
            const fn = (item.fileName || '').toLowerCase();
            if (fn.endsWith('.docx')) text = await extractDocxText(buf);
            else if (fn.endsWith('.pdf')) text = await extractPdfText(buf);
            else {
                // Fallback: try to display as text from sadrzaj
                text = item.sadrzaj || '';
            }

            if (!text && item.sadrzaj) text = item.sadrzaj;
            setCorrText(text);

            const tokens = extractNameTokens(text || item.sadrzaj || '');
            const workers = JSON.parse(localStorage.getItem('eznr_workers') || '[]').filter(w => w.aktivan !== false);
            const newRows = tokens.map((tok, i) => {
                const matches = matchWorkers(tok.original, '', workers);
                const top = matches[0];
                return { id: i, original: tok.original, matchedWorker: top?.worker || null, correctedName: top ? `${top.worker.ime} ${top.worker.prezime}` : tok.original, confidence: top?.score || 0, keep: true };
            });
            // Also add manual text from sadrzaj if no file
            setCorrRows(newRows);
            setCorrExtracted(true);
        } catch (err) {
            setCorrError(err.message || 'Greška pri obradi datoteke.');
        } finally {
            setCorrExtracting(false);
        }
    };

    const updateCorrRow = (id, patch) => setCorrRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

    const handleGenerateCorrected = async () => {
        const active = corrRows.filter(r => r.keep && r.original !== r.correctedName);
        if (active.length === 0) { await alert(bs ? 'Nema izmjena.' : 'No changes to apply.'); return; }
        const replacements = active.map(r => ({ original: r.original, corrected: r.correctedName }));
        const baseName = (corrItem?.fileName || corrItem?.naziv || 'zapisnik').replace(/\.[^.]+$/, '');
        setCorrGenerating(true);
        try {
            const fn = (corrItem?.fileName || '').toLowerCase();
            if (fn.endsWith('.docx') && corrItem?.fileData) {
                const b64 = corrItem.fileData.split(',')[1] || corrItem.fileData;
                const bin = atob(b64); const ab = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) ab[i] = bin.charCodeAt(i);
                const blob = await generateCorrectedDocx(ab.buffer, replacements);
                downloadBlob(blob, `${baseName}_ispravljen.docx`);
            } else {
                let corrected = corrText || corrItem?.sadrzaj || '';
                for (const { original, corrected: rep } of replacements) {
                    const esc = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    corrected = corrected.replace(new RegExp(esc, 'gi'), rep);
                }
                downloadText(corrected, `${baseName}_ispravljen.txt`);
            }
        } catch (err) { await alert(`Greška: ${err.message}`); }
        finally { setCorrGenerating(false); }
    };

    // ── Form view: Create / Edit ──────────────────────────────────────────────
    if (view === 'create') return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button className="btn btn-ghost" onClick={() => { setView('list'); setForm({ ...EMPTY_FORM }); setEditItem(null); }}>←</button>
                <h1 style={{ margin: 0 }}>{editItem ? (bs ? '✏️ Uredi Zapisnik' : '✏️ Edit Record') : (bs ? '+ Novi Zapisnik' : '+ New Record')}</h1>
            </div>
            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                            <div style={LS}>{bs ? 'Naziv zapisnika *' : 'Record name *'}</div>
                            <input className="form-input" value={form.naziv} onChange={e => setForm(f => ({ ...f, naziv: e.target.value }))} placeholder={bs ? 'npr. Zapisnik o provjeri znanja' : 'e.g. Training minutes'} />
                        </div>
                        <div>
                            <div style={LS}>{bs ? 'Datum' : 'Date'}</div>
                            <input className="form-input" type="date" value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                            <div style={LS}>{bs ? 'Mjesto' : 'Location'}</div>
                            <input className="form-input" value={form.mjesto} onChange={e => setForm(f => ({ ...f, mjesto: e.target.value }))} placeholder={bs ? 'npr. Sarajevo' : 'e.g. Zagreb'} />
                        </div>
                        <div>
                            <div style={LS}>{bs ? 'Predmet / Svrha' : 'Subject / Purpose'}</div>
                            <input className="form-input" value={form.predmet} onChange={e => setForm(f => ({ ...f, predmet: e.target.value }))} placeholder={bs ? 'npr. Provjera znanja ZNR' : 'e.g. OSH knowledge review'} />
                        </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <div style={LS}>{bs ? 'Komisija / Prisutni' : 'Committee / Attendees'}</div>
                        <input className="form-input" value={form.komisija} onChange={e => setForm(f => ({ ...f, komisija: e.target.value }))} placeholder={bs ? 'npr. Mujo Mujić, Fatima Fatić...' : 'e.g. John Smith, Jane Doe...'} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <div style={LS}>{bs ? 'Sadržaj zapisnika' : 'Record content'}</div>
                        <textarea className="form-input" rows={6} value={form.sadrzaj} onChange={e => setForm(f => ({ ...f, sadrzaj: e.target.value }))} style={{ resize: 'vertical' }} placeholder={bs ? 'Unesite sadržaj zapisnika...' : 'Enter record content...'} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <div style={LS}>{bs ? 'Napomena' : 'Note'}</div>
                        <input className="form-input" value={form.napomena} onChange={e => setForm(f => ({ ...f, napomena: e.target.value }))} />
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, marginBottom: 24 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                            {bs ? 'Priloži datoteku (opciono)' : 'Attach file (optional)'}
                        </div>
                        <input type="file" ref={formFileRef} accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png" style={{ display: 'none' }}
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 20 * 1024 * 1024) { alert('Max 20MB!'); return; }
                                const reader = new FileReader();
                                reader.onload = ev => setForm(f => ({ ...f, fileData: ev.target.result, fileName: file.name, fileType: file.type }));
                                reader.readAsDataURL(file);
                                e.target.value = '';
                            }} />
                        {form.fileData ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '1.4rem' }}>{form.fileName?.endsWith('.pdf') ? '📕' : form.fileName?.match(/docx?/) ? '📘' : '🖼️'}</span>
                                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.fileName}</span>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setForm(f => ({ ...f, fileData: null, fileName: '', fileType: '' }))}>✕</button>
                            </div>
                        ) : (
                            <button className="btn btn-outline btn-sm" onClick={() => formFileRef.current?.click()}>
                                📎 {bs ? 'Dodaj datoteku' : 'Attach file'}
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? '⏳' : '💾'} {bs ? 'Sačuvaj' : 'Save'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => { setView('list'); setForm({ ...EMPTY_FORM }); setEditItem(null); }}>
                            ↩ {bs ? 'Odustani' : 'Cancel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // ── Korekcija view ────────────────────────────────────────────────────────
    if (view === 'correct') return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button className="btn btn-ghost" onClick={() => { setView('list'); setCorrItem(null); setCorrRows([]); }}>←</button>
                <h1 style={{ margin: 0 }}>🔧 {bs ? 'Korekcija imena' : 'Name Correction'}</h1>
                {corrItem && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 4 }}>— {corrItem.naziv}</span>}
            </div>
            <DialogRenderer />
            {corrExtracting && (
                <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
                    <div style={{ fontWeight: 600 }}>{bs ? 'Čitanje dokumenta...' : 'Reading document...'}</div>
                </div></div>
            )}
            {corrError && (
                <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)', marginBottom: 16 }}>
                    ⚠️ {corrError}
                </div>
            )}
            {!corrExtracting && corrExtracted && (
                <>
                    <div style={{ padding: '12px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.25)', display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.88rem' }}>
                        <span style={{ fontSize: '1.4rem' }}>📋</span>
                        <div style={{ flex: 1 }}>
                            <strong>{corrItem?.fileName || corrItem?.naziv}</strong>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>
                                {bs ? `Pronađeno ${corrRows.length} potencijalnih imena` : `Found ${corrRows.length} potential names`}
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={handleGenerateCorrected} disabled={corrGenerating || corrRows.filter(r => r.keep && r.original !== r.correctedName).length === 0}>
                            {corrGenerating ? '⏳' : '📥'} {bs ? 'Generiši ispravljen' : 'Generate corrected'}
                        </button>
                    </div>
                    {corrRows.length === 0 ? (
                        <div className="card"><div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔎</div>
                            <div style={{ fontWeight: 600 }}>{bs ? 'Nema pronađenih imena.' : 'No names found.'}</div>
                        </div></div>
                    ) : (
                        <div className="card">
                            <div className="card-body" style={{ padding: 0 }}>
                                <div className="data-table-wrapper">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40 }}></th>
                                                <th>{bs ? 'Iz dokumenta' : 'From document'}</th>
                                                <th>{bs ? 'Radnik u sustavu' : 'Worker in system'}</th>
                                                <th style={{ width: 80, textAlign: 'center' }}>%</th>
                                                <th>{bs ? 'Ispravno ime' : 'Corrected name'}</th>
                                                <th style={{ width: 40 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {corrRows.map(row => {
                                                const conf = row.matchedWorker ? confidenceLabel(row.confidence) : null;
                                                const changed = row.correctedName !== row.original;
                                                return (
                                                    <tr key={row.id} style={{ opacity: row.keep ? 1 : 0.4, background: changed && row.keep ? 'rgba(0,191,166,0.04)' : undefined }}>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input type="checkbox" checked={row.keep} onChange={e => updateCorrRow(row.id, { keep: e.target.checked })} style={{ width: 15, height: 15, accentColor: 'var(--primary)' }} />
                                                        </td>
                                                        <td style={{ fontWeight: 500 }}>{row.original}</td>
                                                        <td>
                                                            {row.matchedWorker
                                                                ? <div><div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{row.matchedWorker.ime} {row.matchedWorker.prezime}</div>
                                                                    {row.matchedWorker.datumRodjenja && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🎂 {row.matchedWorker.datumRodjenja}</div>}
                                                                  </div>
                                                                : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>—</span>}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {conf ? <div><div style={{ fontSize: '1rem' }}>{conf.emoji}</div><div style={{ fontSize: '0.68rem', fontWeight: 700, color: conf.color }}>{conf.label}</div></div> : '—'}
                                                        </td>
                                                        <td>
                                                            <input className="form-input" style={{ fontSize: '0.88rem', padding: '4px 8px', borderColor: changed ? 'var(--primary)' : undefined }}
                                                                value={row.correctedName} disabled={!row.keep}
                                                                onChange={e => updateCorrRow(row.id, { correctedName: e.target.value })} />
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-ghost btn-sm btn-icon" title={bs ? 'Vrati original' : 'Reset'} onClick={() => updateCorrRow(row.id, { correctedName: row.original })}>↺</button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                        <button className="btn btn-primary" onClick={handleGenerateCorrected}
                            disabled={corrGenerating || corrRows.filter(r => r.keep && r.original !== r.correctedName).length === 0}>
                            {corrGenerating ? '⏳' : '📥'} {bs ? 'Generiši ispravljen dokument' : 'Generate corrected document'}
                        </button>
                        <button className="btn btn-ghost" onClick={() => { setRows => setCorrRows(r => r.map(x => ({ ...x, keep: true })))(undefined); }}>✓ Sve</button>
                        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {corrRows.filter(r => r.keep && r.original !== r.correctedName).length} {bs ? 'izmjena' : 'changes'}
                        </span>
                    </div>
                </>
            )}
            {!corrExtracting && !corrExtracted && !corrError && corrItem && !corrItem.fileData && (
                <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    ⚠️ {bs ? 'Ovaj zapisnik nema priloženu datoteku. Možete koristiti sadržaj iz polja "Sadržaj zapisnika".' : 'This record has no attached file. Content from the "Record content" field will be used.'}
                </div>
            )}
        </div>
    );

    // ── List view ─────────────────────────────────────────────────────────────
    return (
        <div className="animate-fadeIn">
            <DialogRenderer />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: '1.6rem' }}>📋</span>
                <div>
                    <h1 style={{ margin: 0 }}>{bs ? 'Zapisnici' : 'Records'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {sorted.length} {bs ? 'zapisnik(a)' : 'record(s)'}
                    </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY_FORM }); setEditItem(null); setView('create'); }}>
                        + {bs ? 'Novi zapisnik' : 'New record'}
                    </button>
                </div>
            </div>

            {/* Search */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, marginTop: 12 }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: 380, display: 'flex', alignItems: 'center' }}>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={bs ? '🔍 Pretraži zapisnike...' : '🔍 Search records...'}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                    {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>✕</button>}
                </div>
            </div>

            {/* Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {sorted.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>{search ? (bs ? 'Nema rezultata' : 'No results') : (bs ? 'Nema zapisnika' : 'No records yet')}</div>
                            {!search && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => { setForm({ ...EMPTY_FORM }); setEditItem(null); setView('create'); }}>+ {bs ? 'Novi zapisnik' : 'New record'}</button>}
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th onClick={() => toggleSort('naziv')} style={thSt('naziv')}>
                                            {bs ? 'Naziv' : 'Name'}{sortIco('naziv')}
                                        </th>
                                        <th onClick={() => toggleSort('datum')} style={{ ...thSt('datum'), width: 110 }}>
                                            {bs ? 'Datum' : 'Date'}{sortIco('datum')}
                                        </th>
                                        <th onClick={() => toggleSort('mjesto')} style={{ ...thSt('mjesto'), width: 130 }}>
                                            {bs ? 'Mjesto' : 'Location'}{sortIco('mjesto')}
                                        </th>
                                        <th>{bs ? 'Predmet' : 'Subject'}</th>
                                        <th style={{ width: 70, textAlign: 'center' }}>{bs ? 'Prilog' : 'File'}</th>
                                        <th style={{ width: 90, textAlign: 'center' }}>{bs ? 'Akcije' : 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(item => (
                                        <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(item)}>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.naziv}</div>
                                                {item.komisija && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>👥 {item.komisija.slice(0, 60)}{item.komisija.length > 60 ? '...' : ''}</div>}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{item.datum ? item.datum.split('-').reverse().join('.') : '—'}</td>
                                            <td style={{ fontSize: '0.85rem' }}>{item.mjesto || '—'}</td>
                                            <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 200 }}>
                                                    {item.predmet || '—'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {item.fileData
                                                    ? <span title={item.fileName} style={{ fontSize: '1.2rem' }}>{item.fileName?.endsWith('.pdf') ? '📕' : item.fileName?.match(/docx?/) ? '📘' : '📎'}</span>
                                                    : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>}
                                            </td>
                                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    data-akcije-btn
                                                    onClick={e => openMenu(item.id, e)}
                                                >
                                                    {bs ? 'Akcije' : 'Actions'} ▼
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Aksije portal dropdown */}
            {openMenuId && typeof window !== 'undefined' && createPortal(
                <div data-akcije-menu style={{
                    position: 'fixed',
                    ...(menuPos.top ? { top: menuPos.top } : { bottom: menuPos.bottom }),
                    left: menuPos.left, zIndex: 9000,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                    minWidth: 190, overflow: 'hidden',
                    maxHeight: menuPos.maxH, overflowY: 'auto',
                }}>
                    {(() => {
                        const item = items.find(i => i.id === openMenuId);
                        if (!item) return null;
                        const menuBtn = (icon, label, onClick, danger) => (
                            <button key={label} onClick={onClick} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', padding: '9px 14px', border: 'none',
                                background: 'transparent', cursor: 'pointer', fontSize: '0.85rem',
                                fontFamily: 'var(--font-body)', textAlign: 'left',
                                color: danger ? 'var(--danger)' : 'var(--text)',
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span style={{ width: 18, textAlign: 'center' }}>{icon}</span> {label}
                            </button>
                        );
                        return (
                            <>
                                {menuBtn('✏️', bs ? 'Uredi' : 'Edit', () => handleEdit(item))}
                                {menuBtn('🖨️', bs ? 'Printaj' : 'Print', () => handlePrint(item))}
                                {menuBtn('⬇️', bs ? 'Preuzmi' : 'Download', () => handleDownload(item))}
                                {menuBtn('✉️', bs ? 'Pošalji email' : 'Send email', () => handleSendEmail(item))}
                                <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
                                {menuBtn('🔧', bs ? 'Korekcija imena' : 'Name correction', () => startKorekcija(item))}
                                <div style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
                                {menuBtn('🗑️', bs ? 'Obriši' : 'Delete', () => handleDelete(item), true)}
                            </>
                        );
                    })()}
                </div>,
                document.body
            )}
        </div>
    );
}
