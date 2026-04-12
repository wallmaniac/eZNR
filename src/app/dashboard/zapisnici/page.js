'use client';
import { useState, useRef, useEffect, useCallback, createPortal } from 'react';
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
    const PDFJS_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    await loadScript(PDFJS_CDN);
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
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
    const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    await loadScript(JSZIP_CDN);
    if (!window.JSZip) throw new Error('JSZip not loaded');
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) throw new Error('Not a valid .docx file');
    const xml = await xmlFile.async('string');
    return xml
        .replace(/<w:p[ >]/g, '\n<w:p ')
        .replace(/<w:br[^>]*>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n').trim();
}

async function generateCorrectedDocx(originalArrayBuffer, nameReplacements) {
    const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    await loadScript(JSZIP_CDN);
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

function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}.`;
}

// ── Akcije dropdown (portal) ─────────────────────────────────────────────────
function AkcijeMenu({ item, onEdit, onDelete, onDownload, onCopy, lang }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const handleToggle = (e) => {
        const rect = btnRef.current.getBoundingClientRect();
        setPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 180) });
        setOpen(v => !v);
    };

    const menuItems = [
        { icon: '✏️', label: lang === 'bs' ? 'Uredi' : 'Edit', action: onEdit },
        { icon: '📥', label: lang === 'bs' ? 'Preuzmi' : 'Download', action: onDownload, disabled: !item.attachedFileData },
        { icon: '📋', label: lang === 'bs' ? 'Kopiraj naziv' : 'Copy name', action: onCopy },
        { divider: true },
        { icon: '🗑️', label: lang === 'bs' ? 'Obriši' : 'Delete', action: onDelete, danger: true },
    ];

    return (
        <div ref={btnRef} style={{ display: 'inline-block' }}>
            <button
                className="btn btn-ghost btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={handleToggle}
            >
                {lang === 'bs' ? 'Akcije' : 'Actions'} ▾
            </button>
            {open && createPortal(
                <div style={{
                    position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', minWidth: 160,
                    overflow: 'hidden',
                }}>
                    {menuItems.map((mi, i) =>
                        mi.divider ? (
                            <div key={i} style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />
                        ) : (
                            <button key={i}
                                disabled={mi.disabled}
                                onClick={() => { setOpen(false); mi.action?.(); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '9px 14px', width: '100%', border: 'none',
                                    background: 'transparent', cursor: mi.disabled ? 'not-allowed' : 'pointer',
                                    fontFamily: 'var(--font-body)', fontSize: '0.85rem', textAlign: 'left',
                                    color: mi.danger ? 'var(--danger)' : mi.disabled ? 'var(--text-muted)' : 'var(--text)',
                                    opacity: mi.disabled ? 0.5 : 1,
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => { if (!mi.disabled) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                <span>{mi.icon}</span> {mi.label}
                            </button>
                        )
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}

// ── EMPTY form ────────────────────────────────────────────────────────────────
const EMPTY_ZAP = {
    naziv: '', broj: '', datum: '', vrsta: '', napomena: '',
    attachedFileData: null, attachedFileName: '', attachedFileType: '',
};

const VRSTE = ['Zapisnik o ispitivanju', 'Zapisnik o osposobljenosti', 'Zapisnik o pregledu', 'Zapisnik o vježbi', 'Ostalo'];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ZapisniciPage() {
    const { lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'korekcija'

    // ── LIST tab state ────────────────────────────────────────────────────────
    const [items, setItems] = useState(() => getAll(COLLECTIONS.ZAPISNICI));
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ ...EMPTY_ZAP });
    const [saving, setSaving] = useState(false);
    const fileRef = useRef(null);

    const reload = useCallback(() => setItems(getAll(COLLECTIONS.ZAPISNICI)), []);

    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const filtered = items.filter(it => {
        if (!search) return true;
        const q = search.toLowerCase();
        return `${it.naziv} ${it.broj} ${it.vrsta}`.toLowerCase().includes(q);
    });

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datum', 'desc');

    const handleNew = () => {
        setForm({ ...EMPTY_ZAP, datum: new Date().toISOString().split('T')[0] });
        setEditId(null); setShowForm(true);
    };

    const handleEdit = (item) => {
        setForm({ ...EMPTY_ZAP, ...item });
        setEditId(item.id); setShowForm(true);
    };

    const handleSave = async () => {
        if (!form.naziv.trim()) { await alert(lang === 'bs' ? 'Naziv je obavezan!' : 'Name is required!'); return; }
        setSaving(true);
        try {
            if (editId) {
                update(COLLECTIONS.ZAPISNICI, editId, form);
            } else {
                create(COLLECTIONS.ZAPISNICI, form);
            }
            reload(); setShowForm(false); setEditId(null); setForm({ ...EMPTY_ZAP });
        } finally { setSaving(false); }
    };

    const handleDelete = async (item) => {
        const ok = await confirm(lang === 'bs' ? `Obrisati "${item.naziv}"?` : `Delete "${item.naziv}"?`);
        if (!ok) return;
        remove(COLLECTIONS.ZAPISNICI, item.id);
        reload();
    };

    const handleDownload = (item) => {
        if (!item.attachedFileData) return;
        const link = document.createElement('a');
        link.href = item.attachedFileData;
        link.download = item.attachedFileName || `${item.naziv || 'zapisnik'}.pdf`;
        link.click();
    };

    const handleCopy = (item) => {
        navigator.clipboard.writeText(item.naziv || '').catch(() => {});
    };

    const handleFileUpload = (file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { alert('Max 10MB!'); return; }
        const reader = new FileReader();
        reader.onload = e => {
            setF('attachedFileData', e.target.result);
            setF('attachedFileName', file.name);
            setF('attachedFileType', file.type);
        };
        reader.readAsDataURL(file);
    };

    const labelStyle = {
        display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
        color: 'white', background: '#455a64', padding: '2px 8px', borderRadius: 3, marginBottom: 4,
    };

    // ── KOREKCIJA tab state ───────────────────────────────────────────────────
    const [docFile, setDocFile]         = useState(null);
    const [dragging, setDragging]       = useState(false);
    const [extracting, setExtracting]   = useState(false);
    const [extractError, setExtractError] = useState('');
    const corrFileRef = useRef(null);
    const [rawText, setRawText]         = useState('');
    const [step, setStep]               = useState('upload');
    const [rows, setRows]               = useState([]);
    const [generating, setGenerating]   = useState(false);
    const workers = useRef([]);

    useEffect(() => { workers.current = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false); }, []);

    const handleFileRead = useCallback(async (file) => {
        if (file.size > 20 * 1024 * 1024) { await alert('Max 20MB!'); return; }
        setDocFile({ name: file.name, type: file.type });
        setExtractError(''); setExtracting(true); setStep('upload');
        try {
            const ab = await file.arrayBuffer();
            setDocFile({ name: file.name, type: file.type, arrayBuffer: ab });
            let text = '';
            if (file.name.toLowerCase().endsWith('.docx')) text = await extractDocxText(ab);
            else if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') text = await extractPdfText(ab);
            else text = await file.text();
            setRawText(text);
            const tokens = extractNameTokens(text);
            const ws = workers.current;
            setRows(tokens.map((tok, i) => {
                const matches = matchWorkers(tok.original, '', ws);
                const top = matches[0];
                return { id: i, original: tok.original, matchedWorker: top?.worker || null, correctedName: top ? `${top.worker.ime} ${top.worker.prezime}` : tok.original, confidence: top?.score || 0, keep: true };
            }));
            setStep('review');
        } catch (err) { setExtractError(err.message || 'Greška'); }
        finally { setExtracting(false); }
    }, [alert]);

    const updateRow = (id, patch) => setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

    const handleGenerate = async () => {
        const activeRows = rows.filter(r => r.keep && r.original !== r.correctedName);
        if (!activeRows.length) { await alert(lang === 'bs' ? 'Nema izmjena.' : 'No changes.'); return; }
        const replacements = activeRows.map(r => ({ original: r.original, corrected: r.correctedName }));
        const baseName = (docFile?.name || 'zapisnik').replace(/\.[^.]+$/, '');
        setGenerating(true);
        try {
            if (docFile?.arrayBuffer && docFile.name.toLowerCase().endsWith('.docx')) {
                const blob = await generateCorrectedDocx(docFile.arrayBuffer, replacements);
                downloadBlob(blob, `${baseName}_ispravljen.docx`);
            } else {
                let corrected = rawText;
                for (const { original, corrected: rep } of replacements) {
                    corrected = corrected.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), rep);
                }
                downloadText(corrected, `${baseName}_ispravljen.txt`);
            }
            setStep('done');
        } catch (err) { await alert(`Greška: ${err.message}`); }
        finally { setGenerating(false); }
    };

    const handleReset = () => { setDocFile(null); setRawText(''); setRows([]); setStep('upload'); setExtractError(''); };
    const activeChanges = rows.filter(r => r.keep && r.original !== r.correctedName).length;

    // ── RENDER ────────────────────────────────────────────────────────────────
    return (
        <div className="animate-fadeIn">
            <DialogRenderer />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: '1.6rem' }}>📋</span>
                <div>
                    <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Korekcija zapisnika' : 'Minutes Correction'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {items.length} {lang === 'bs' ? 'zapisnika' : 'records'}
                    </p>
                </div>
                {activeTab === 'list' && (
                    <div style={{ marginLeft: 'auto' }}>
                        <button className="btn btn-primary" onClick={handleNew}>
                            + {lang === 'bs' ? 'Novi zapisnik' : 'New record'}
                        </button>
                    </div>
                )}
                {activeTab === 'korekcija' && step !== 'upload' && (
                    <div style={{ marginLeft: 'auto' }}>
                        <button className="btn btn-ghost btn-sm" onClick={handleReset}>↺ {lang === 'bs' ? 'Novi dokument' : 'New document'}</button>
                    </div>
                )}
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
                {[
                    { id: 'list',      icon: '📋', label_bs: 'Zapisnici',         label_en: 'Records' },
                    { id: 'korekcija', icon: '🔧', label_bs: 'Korekcija imena',   label_en: 'Name Correction' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        padding: '9px 20px', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-body)', fontSize: '0.88rem',
                        fontWeight: activeTab === tab.id ? 700 : 500,
                        background: 'transparent',
                        borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                        color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                        marginBottom: -2, transition: 'all 0.15s',
                    }}>
                        {tab.icon} {lang === 'bs' ? tab.label_bs : tab.label_en}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════
                TAB 1 — ZAPISNICI LIST
            ══════════════════════════════════════════════════ */}
            {activeTab === 'list' && (
                <>
                    {/* Create / Edit form */}
                    {showForm && (
                        <div className="card" style={{ marginBottom: 20, border: '1px solid var(--primary)' }}>
                            <div className="card-header" style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary)' }}>
                                {editId ? (lang === 'bs' ? '✏️ Uredi zapisnik' : '✏️ Edit record') : (lang === 'bs' ? '+ Novi zapisnik' : '+ New record')}
                            </div>
                            <div className="card-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Naziv *' : 'Name *'}</div>
                                        <input className="form-input" value={form.naziv} onChange={e => setF('naziv', e.target.value)} placeholder={lang === 'bs' ? 'Naziv zapisnika...' : 'Record name...'} autoFocus />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Broj zapisnika' : 'Record no.'}</div>
                                        <input className="form-input" value={form.broj} onChange={e => setF('broj', e.target.value)} placeholder="ZAP-001" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Datum' : 'Date'}</div>
                                        <input className="form-input" type="date" value={form.datum} onChange={e => setF('datum', e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Vrsta' : 'Type'}</div>
                                        <select className="form-select" value={form.vrsta} onChange={e => setF('vrsta', e.target.value)}>
                                            <option value="">—</option>
                                            {VRSTE.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Napomena' : 'Note'}</div>
                                        <input className="form-input" value={form.napomena} onChange={e => setF('napomena', e.target.value)} />
                                    </div>
                                </div>

                                {/* File attach */}
                                <div style={{ marginBottom: 14 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Priloži datoteku (opciono)' : 'Attach file (optional)'}</div>
                                    <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.jpg,.png"
                                        style={{ display: 'none' }}
                                        onChange={e => { handleFileUpload(e.target.files[0]); e.target.value = ''; }} />
                                    {form.attachedFileData ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                            <span style={{ fontSize: '1.2rem' }}>{form.attachedFileName?.endsWith('.pdf') ? '📕' : '📄'}</span>
                                            <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.attachedFileName}</span>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }} onClick={() => fileRef.current?.click()}>
                                                {lang === 'bs' ? 'Zamijeni' : 'Replace'}
                                            </button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                                onClick={() => { setF('attachedFileData', null); setF('attachedFileName', ''); setF('attachedFileType', ''); }}>✕</button>
                                        </div>
                                    ) : (
                                        <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                                            📎 {lang === 'bs' ? 'Odaberi datoteku...' : 'Choose file...'}
                                        </button>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                        💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>
                                        ✕ {lang === 'bs' ? 'Odustani' : 'Cancel'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <div style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
                            <input
                                placeholder={lang === 'bs' ? '🔍 Pretraži zapisnike...' : '🔍 Search records...'}
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%' }}
                            />
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {filtered.length} {lang === 'bs' ? 'rezultata' : 'results'}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}>
                            {sorted.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{lang === 'bs' ? 'Nema zapisnika' : 'No records'}</div>
                                    <div style={{ fontSize: '0.82rem', marginBottom: 16 }}>{lang === 'bs' ? 'Kreirajte prvi zapisnik klikom na gumb iznad.' : 'Create your first record using the button above.'}</div>
                                    <button className="btn btn-primary" onClick={handleNew}>+ {lang === 'bs' ? 'Novi zapisnik' : 'New record'}</button>
                                </div>
                            ) : (
                                <div className="data-table-wrapper">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{lang === 'bs' ? 'Naziv' : 'Name'}{sortIcon('naziv')}</th>
                                                <th onClick={() => toggleSort('broj')} style={{ ...thStyle('broj'), width: 120 }}>{lang === 'bs' ? 'Broj' : 'No.'}{sortIcon('broj')}</th>
                                                <th onClick={() => toggleSort('datum')} style={{ ...thStyle('datum'), width: 110 }}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>
                                                <th style={{ width: 180 }}>{lang === 'bs' ? 'Vrsta' : 'Type'}</th>
                                                <th style={{ width: 80, textAlign: 'center' }}>{lang === 'bs' ? 'Prilog' : 'File'}</th>
                                                <th style={{ width: 120 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sorted.map(item => (
                                                <tr key={item.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{item.naziv}</div>
                                                        {item.napomena && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.napomena}</div>}
                                                    </td>
                                                    <td><code style={{ fontSize: '0.82rem' }}>{item.broj || '—'}</code></td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(item.datum)}</td>
                                                    <td>
                                                        {item.vrsta ? (
                                                            <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: 'var(--secondary)', fontWeight: 600 }}>
                                                                {item.vrsta}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {item.attachedFileData ? (
                                                            <button className="btn btn-ghost btn-sm btn-icon" title={item.attachedFileName} onClick={() => handleDownload(item)}>
                                                                {item.attachedFileName?.endsWith('.pdf') ? '📕' : '📄'}
                                                            </button>
                                                        ) : '—'}
                                                    </td>
                                                    <td>
                                                        <AkcijeMenu
                                                            item={item}
                                                            lang={lang}
                                                            onEdit={() => handleEdit(item)}
                                                            onDelete={() => handleDelete(item)}
                                                            onDownload={() => handleDownload(item)}
                                                            onCopy={() => handleCopy(item)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════
                TAB 2 — KOREKCIJA
            ══════════════════════════════════════════════════ */}
            {activeTab === 'korekcija' && (
                <>
                    {step === 'upload' && (
                        <div className="card">
                            <div className="card-body">
                                <div
                                    style={{
                                        border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)',
                                        borderRadius: 'var(--radius-md)', padding: '48px 20px', textAlign: 'center',
                                        background: dragging ? 'rgba(0,191,166,0.04)' : 'transparent',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileRead(f); }}
                                    onClick={() => corrFileRef.current?.click()}
                                >
                                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>{extracting ? '⏳' : dragging ? '📂' : '📋'}</div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>
                                        {extracting ? (lang === 'bs' ? 'Čitanje dokumenta...' : 'Extracting text...')
                                            : dragging ? (lang === 'bs' ? 'Ispusti zapisnik ovdje' : 'Drop record here')
                                            : (lang === 'bs' ? 'Prevuci zapisnik ili klikni za odabir' : 'Drag & drop or click to select')}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>PDF, DOCX, TXT — max 20MB</div>
                                    {extractError && <div style={{ marginTop: 16, color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem' }}>⚠️ {extractError}</div>}
                                    <input ref={corrFileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                                        onChange={e => { const f = e.target.files[0]; if (f) handleFileRead(f); e.target.value = ''; }} />
                                </div>

                                <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.82rem' }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--secondary)' }}>💡 {lang === 'bs' ? 'Kako funkcioniše?' : 'How does it work?'}</div>
                                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-muted)' }}>
                                        <li>{lang === 'bs' ? 'Aplikacija iz dokumenta izvlači sva vlastita imena (2-3 kapitalizovane riječi).' : 'App extracts all proper names from the document.'}</li>
                                        <li>{lang === 'bs' ? 'Svako ime uspoređuje s radnicima u sustavu koristeći fuzzy matching.' : 'Each name is compared against workers using fuzzy matching.'}</li>
                                        <li>{lang === 'bs' ? 'Prikazuje se tabela s originalnim i ispravnim imenima — možete ih ručno ispraviti.' : 'A table shows original and corrected names — you can edit them.'}</li>
                                        <li>{lang === 'bs' ? 'Na kraju se generira ispravljen dokument (.docx ili .txt).' : 'Finally, a corrected document (.docx or .txt) is generated.'}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'review' && (
                        <>
                            <div style={{ padding: '12px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.25)', display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.88rem' }}>
                                <span style={{ fontSize: '1.4rem' }}>📋</span>
                                <div style={{ flex: 1 }}>
                                    <strong>{docFile?.name}</strong>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>
                                        {lang === 'bs' ? `Pronađeno ${rows.length} potencijalnih imena · ${activeChanges} izmjena` : `Found ${rows.length} potential names · ${activeChanges} changes`}
                                    </div>
                                </div>
                                <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || activeChanges === 0}>
                                    {generating ? '⏳' : '📥'} {lang === 'bs' ? 'Generiši ispravljen dokument' : 'Generate corrected document'}
                                </button>
                            </div>

                            {rows.length === 0 ? (
                                <div className="card">
                                    <div className="card-body" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔎</div>
                                        <div style={{ fontWeight: 600 }}>{lang === 'bs' ? 'Nije pronađeno nijedno vlastito ime.' : 'No proper names found.'}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="card">
                                    <div className="card-body" style={{ padding: 0 }}>
                                        <div className="data-table-wrapper">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: 40 }}>{lang === 'bs' ? 'Uključi' : 'Include'}</th>
                                                        <th>{lang === 'bs' ? 'Iz dokumenta' : 'From document'}</th>
                                                        <th>{lang === 'bs' ? 'Radnik u sustavu' : 'Worker in system'}</th>
                                                        <th style={{ width: 80, textAlign: 'center' }}>{lang === 'bs' ? 'Podudaranje' : 'Match'}</th>
                                                        <th>{lang === 'bs' ? 'Ispravno ime' : 'Corrected name'}</th>
                                                        <th style={{ width: 50 }}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map(row => {
                                                        const conf = row.matchedWorker ? confidenceLabel(row.confidence) : null;
                                                        const isChanged = row.correctedName !== row.original;
                                                        return (
                                                            <tr key={row.id} style={{ opacity: row.keep ? 1 : 0.4, background: isChanged && row.keep ? 'rgba(0,191,166,0.04)' : undefined }}>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <input type="checkbox" checked={row.keep} onChange={e => updateRow(row.id, { keep: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                                                                </td>
                                                                <td><span style={{ fontWeight: 500 }}>{row.original}</span></td>
                                                                <td>
                                                                    {row.matchedWorker ? (
                                                                        <div>
                                                                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{row.matchedWorker.ime} {row.matchedWorker.prezime}</div>
                                                                            {row.matchedWorker.datumRodjenja && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🎂 {row.matchedWorker.datumRodjenja}</div>}
                                                                        </div>
                                                                    ) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>{lang === 'bs' ? '— nije pronađen —' : '— not found —'}</span>}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    {conf ? <div><div style={{ fontSize: '1.1rem' }}>{conf.emoji}</div><div style={{ fontSize: '0.68rem', fontWeight: 700, color: conf.color }}>{conf.label}</div></div> : '—'}
                                                                </td>
                                                                <td>
                                                                    <input className="form-input" style={{ fontSize: '0.88rem', padding: '5px 8px', borderColor: isChanged ? 'var(--primary)' : undefined }} value={row.correctedName} onChange={e => updateRow(row.id, { correctedName: e.target.value })} disabled={!row.keep} />
                                                                </td>
                                                                <td>
                                                                    <button className="btn btn-ghost btn-sm" title={lang === 'bs' ? 'Vrati original' : 'Reset'} onClick={() => updateRow(row.id, { correctedName: row.original })}>↺</button>
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

                            {rows.length > 0 && (
                                <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                                    <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || activeChanges === 0}>
                                        {generating ? '⏳' : '📥'} {lang === 'bs' ? 'Generiši ispravljen dokument' : 'Generate corrected document'}
                                        {activeChanges > 0 && <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem' }}>{activeChanges}</span>}
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => setRows(r => r.map(x => ({ ...x, keep: true })))}>✓ {lang === 'bs' ? 'Označi sve' : 'Select all'}</button>
                                    <button className="btn btn-ghost" onClick={() => setRows(r => r.map(x => ({ ...x, keep: false })))}>✗ {lang === 'bs' ? 'Odznači sve' : 'Deselect all'}</button>
                                    <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{activeChanges} {lang === 'bs' ? 'izmjena' : 'changes'}</span>
                                </div>
                            )}
                        </>
                    )}

                    {step === 'done' && (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
                                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>✅</div>
                                <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }}>{lang === 'bs' ? 'Ispravljen dokument generisan!' : 'Corrected document generated!'}</div>
                                <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{lang === 'bs' ? 'Datoteka je preuzeta.' : 'File downloaded.'}</div>
                                <button className="btn btn-primary" onClick={handleReset}>↺ {lang === 'bs' ? 'Obradi novi dokument' : 'Process another'}</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
