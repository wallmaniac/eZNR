'use client';
import DateInput from '@/components/DateInput';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { matchWorkers, confidenceLabel, extractNameTokens } from '@/lib/textMatch';
import { idbSaveFile, idbDeleteFile, idbDownloadFile, idbOpenFile, idbKey as makeIdbKey } from '@/lib/idbFiles';
import PageHeader from '@/components/PageHeader';
import { useCountry } from '@/contexts/CountryContext';

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
async function extractPdfText(ab) {
    const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const W   = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    await loadScript(CDN);
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = W;
    const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
    let t = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const p = await pdf.getPage(i);
        const tc = await p.getTextContent();
        t += tc.items.map(x => x.str).join(' ') + '\n';
    }
    return t;
}
async function extractDocxText(ab) {
    const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    await loadScript(CDN);
    if (!window.JSZip) throw new Error('JSZip not loaded');
    const zip = await window.JSZip.loadAsync(ab);
    const f = zip.file('word/document.xml');
    if (!f) throw new Error('Not a valid .docx file');
    const xml = await f.async('string');
    return xml.replace(/<w:p[>]/g, '\n<w:p ').replace(/<w:br[^>]*>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
        .replace(/\n{3,}/g, '\n\n').trim();
}
async function generateCorrectedDocx(ab, replacements) {
    const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    await loadScript(CDN);
    const zip = await window.JSZip.loadAsync(ab);
    const f = zip.file('word/document.xml');
    if (!f) throw new Error('Not a valid .docx');
    let xml = await f.async('string');
    for (const { original, corrected } of replacements) {
        if (!original || !corrected || original === corrected) continue;
        xml = xml.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), corrected);
    }
    zip.file('word/document.xml', xml);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadText(text, name) {
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), name);
}
function fmtDate(iso) {
    if (!iso) return '—';
    const [y,m,d] = iso.split('-');
    return `${d}.${m}.${y}.`;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EMPTY_ZAP = {
    naziv: '', broj: '', datum: '', vrsta: '', napomena: '',
    idbKey: null, attachedFileName: '', attachedFileSize: 0, attachedFileType: '',
};
const VRSTE = ['Zapisnik o ispitivanju', 'Zapisnik o osposobljenosti', 'Zapisnik o pregledu', 'Zapisnik o vježbi', 'Ostalo'];

const menuItemSt = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
    background: 'none', border: 'none', cursor: 'pointer', width: '100%',
    fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left',
    transition: 'background 0.12s', fontFamily: 'var(--font-body)',
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ZapisniciPage() {
    const { lang, t } = useLanguage();
    const country = useCountry();
    const { alert, confirm, DialogRenderer } = useDialog();
    const [activeTab, setActiveTab] = useState('list');

    // ── LIST tab ──────────────────────────────────────────────────────────────
    const [items, setItems]           = useState(() => getAll(COLLECTIONS.ZAPISNICI));
    const [search, setSearch]         = useState('');
    const [showForm, setShowForm]     = useState(false);
    const [editId, setEditId]         = useState(null);
    const [form, setForm]             = useState({ ...EMPTY_ZAP });
    const [pendingFile, setPendingFile] = useState(null);
    const [saving, setSaving]         = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos]       = useState({ top: 0, left: 0, maxH: 400 });
    // Email modal state
    const [emailModal, setEmailModal] = useState(null); // null | { item }
    const [emailTo, setEmailTo]       = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody]   = useState('');
    const fileRef = useRef(null);

    const reload = useCallback(() => setItems(getAll(COLLECTIONS.ZAPISNICI)), []);
    const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const filtered = items.filter(it => {
        if (!search) return true;
        const q = search.toLowerCase();
        return `${it.naziv} ${it.broj} ${it.vrsta}`.toLowerCase().includes(q);
    });
    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datum', 'desc');

    // Close menu on outside click
    useEffect(() => {
        if (!actionMenuId) return;
        const close = () => setActionMenuId(null);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [actionMenuId]);

    const toggleAll = () => {
        if (selectedIds.size === sorted.length && sorted.length> 0) setSelectedIds(new Set());
        else setSelectedIds(new Set(sorted.map(x => x.id)));
    };
    const toggleOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const handleNew = () => {
        setForm({ ...EMPTY_ZAP, datum: new Date().toISOString().split('T')[0] });
        setPendingFile(null); setEditId(null); setShowForm(true);
        // scroll to top so form is visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleEdit = (item) => {
        setForm({ ...EMPTY_ZAP, ...item });
        setPendingFile(null); setEditId(item.id); setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleDuplicate = (item) => {
        // Open new form pre-filled with the copied item (minus id, idbKey, file refs)
        setForm({
            ...EMPTY_ZAP,
            naziv: (t('kopija')) + item.naziv,
            broj: '', datum: new Date().toISOString().split('T')[0],
            vrsta: item.vrsta, napomena: item.napomena,
            // Note: file is NOT copied (lives in IDB under old key)
        });
        setPendingFile(null); setEditId(null); setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleOpenEmailModal = (item) => {
        setEmailTo('');
        setEmailSubject(`Zapisnik: ${item.naziv}${item.broj ? ` (${item.broj})` : ''}`);
        setEmailBody(
            (lang !== 'en'
                ? `Poštovani,\n\nU prilogu se nalazi zapisnik:\n\nNaziv: ${item.naziv}\nBroj: ${item.broj || '—'}\nDatum: ${fmtDate(item.datum)}\nVrsta: ${item.vrsta || '—'}${item.napomena ? `\nNapomena: ${item.napomena}` : ''}\n\nS poštovanjem`
                : `Dear,\n\nPlease find the attached record:\n\nName: ${item.naziv}\nNo.: ${item.broj || '—'}\nDate: ${fmtDate(item.datum)}\nType: ${item.vrsta || '—'}${item.napomena ? `\nNote: ${item.napomena}` : ''}\n\nBest regards`
            )
        );
        setEmailModal({ item });
    };
    const handleSendEmail = () => {
        const recipients = emailTo.split(/[,;\s]+/).filter(Boolean).join(',');
        if (!recipients) { alert(t('unesiteBarJednuEmailAdresu')); return; }
        const mailtoLink = `mailto:${recipients}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.open(mailtoLink, '_blank');
        setEmailModal(null);
    };

    const handleSave = async () => {
        if (!form.naziv.trim()) { await alert(t('nazivJeObavezan')); return; }
        setSaving(true);
        try {
            let fileFields = {
                idbKey: form.idbKey || null,
                attachedFileName: form.attachedFileName || '',
                attachedFileSize: form.attachedFileSize || 0,
                attachedFileType: form.attachedFileType || '',
            };
            if (pendingFile) {
                const newKey = makeIdbKey('zap', Date.now());
                await idbSaveFile(newKey, pendingFile);
                if (form.idbKey) await idbDeleteFile(form.idbKey).catch(() => {});
                fileFields = { idbKey: newKey, attachedFileName: pendingFile.name, attachedFileSize: pendingFile.size, attachedFileType: pendingFile.type };
            }
            const payload = { naziv: form.naziv, broj: form.broj, datum: form.datum, vrsta: form.vrsta, napomena: form.napomena, ...fileFields };
            if (editId) { update(COLLECTIONS.ZAPISNICI, editId, payload); }
            else { create(COLLECTIONS.ZAPISNICI, payload); }
            reload(); setShowForm(false); setEditId(null); setForm({ ...EMPTY_ZAP }); setPendingFile(null);
        } catch (err) {
            await alert(lang !== 'en' ? `Greška pri čuvanju: ${err?.message}` : `Save error: ${err?.message}`);
        } finally { setSaving(false); }
    };

    const handleDelete = async (item) => {
        const ok = await confirm(lang !== 'en' ? `Obrisati "${item.naziv}"?` : `Delete "${item.naziv}"?`);
        if (!ok) return;
        if (item.idbKey) await idbDeleteFile(item.idbKey).catch(() => {});
        remove(COLLECTIONS.ZAPISNICI, item.id);
        reload();
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        const ok = await confirm(lang !== 'en' ? `Obrisati ${selectedIds.size} zapisa?` : `Delete ${selectedIds.size} records?`);
        if (!ok) return;
        for (const id of selectedIds) {
            const it = items.find(x => x.id === id);
            if (it?.idbKey) await idbDeleteFile(it.idbKey).catch(() => {});
            remove(COLLECTIONS.ZAPISNICI, id);
        }
        setSelectedIds(new Set()); reload();
    };

    const handleDownload = async (item) => {
        if (!item.idbKey) return;
        try { await idbDownloadFile(item.idbKey, item.attachedFileName); }
        catch { await alert(t('datotekaNijeDostupna')); }
    };
    const handleOpen = async (item) => {
        if (!item.idbKey) return;
        try { await idbOpenFile(item.idbKey); }
        catch { await alert(t('datotekaNijeDostupna')); }
    };
    const handleCopy = (item) => navigator.clipboard.writeText(item.naziv || '').catch(() => {});

    const handleFileUpload = (file) => {
        if (!file) return;
        if (file.size> 50 * 1024 * 1024) { alert('Max 50MB!'); return; }
        setPendingFile(file);
        setF('attachedFileName', file.name);
        setF('attachedFileSize', file.size);
        setF('attachedFileType', file.type);
    };
    const handleRemoveFile = async () => {
        if (form.idbKey) await idbDeleteFile(form.idbKey).catch(() => {});
        setPendingFile(null);
        setForm(f => ({ ...f, idbKey: null, attachedFileName: '', attachedFileSize: 0, attachedFileType: '' }));
    };

    const labelStyle = {
        display: 'block', fontSize: '0.72rem', fontWeight: 600,
        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
    };

    // ── KOREKCIJA tab ─────────────────────────────────────────────────────────
    const [docFile, setDocFile]           = useState(null);
    const [dragging, setDragging]         = useState(false);
    const [extracting, setExtracting]     = useState(false);
    const [extractError, setExtractError] = useState('');
    const corrFileRef = useRef(null);
    const [rawText, setRawText]           = useState('');
    const [step, setStep]                 = useState('upload');
    const [rows, setRows]                 = useState([]);
    const [generating, setGenerating]     = useState(false);
    const workersRef = useRef([]);
    useEffect(() => { workersRef.current = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false); }, []);

    const handleFileRead = useCallback(async (file) => {
        if (file.size> 20 * 1024 * 1024) { await alert('Max 20MB!'); return; }
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
            const ws = workersRef.current;
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
        if (!activeRows.length) { await alert(t('nemaIzmjena')); return; }
        const replacements = activeRows.map(r => ({ original: r.original, corrected: r.correctedName }));
        const baseName = (docFile?.name || 'zapisnik').replace(/\.[^.]+$/, '');
        setGenerating(true);
        try {
            if (docFile?.arrayBuffer && docFile.name.toLowerCase().endsWith('.docx')) {
                const blob = await generateCorrectedDocx(docFile.arrayBuffer, replacements);
                downloadBlob(blob, `${baseName}_ispravljen.docx`);
            } else {
                let corrected = rawText;
                for (const { original, corrected: rep } of replacements)
                    corrected = corrected.replace(new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), rep);
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
            <PageHeader icon="📋" title={t('zapisnici')}
                subtitle={`${items.length} ${t('zapisnika')}`}
                actions={activeTab === 'korekcija' && step !== 'upload' ? <button className="btn btn-ghost btn-sm" onClick={handleReset}>↺ {t('noviDokument')}</button> : null}
            />

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
                {[
                    { id: 'list',      icon: '📋', label_bs: 'Zapisnici',       label_en: 'Records' },
                    { id: 'korekcija', icon: '🔧', label_bs: 'Korekcija imena', label_en: 'Name Correction' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}>
                        {tab.icon} {lang !== 'en' ? tab.label_bs : tab.label_en}
                    </button>
                ))}
            </div>

            {/* ══════════════ TAB 1 — ZAPISNICI LIST ══════════════ */}
            {activeTab === 'list' && (
                <>
                    {/* ── FORM ── */}
                    {showForm && (
                        <div className="card" style={{ marginBottom: 20, border: '1px solid var(--primary)' }}>
                            <div className="card-header" style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary)' }}>
                                {editId ? (t('urediZapisnik')) : (t('noviZapisnik'))}
                            </div>
                            <div className="card-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                                    <div>
                                        <div style={labelStyle}>{t('naziv1')}</div>
                                        <input className="form-input" value={form.naziv} onChange={e => setF('naziv', e.target.value)} placeholder={t('nazivZapisnika')} autoFocus />
                                    </div>
                                    <div>
                                        <div style={labelStyle}>{t('brojZapisnika')}</div>
                                        <input className="form-input" value={form.broj} onChange={e => setF('broj', e.target.value)} placeholder="ZAP-001" />
                                    </div>
                                    <div>
                                        <div style={labelStyle}>{t('datum')}</div>
                                        <DateInput value={form.datum} onChange={v => setF('datum', v)} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                                    <div>
                                        <div style={labelStyle}>{t('vrsta')}</div>
                                        <select className="form-select" value={form.vrsta} onChange={e => setF('vrsta', e.target.value)}>
                                            <option value="">—</option>
                                            {VRSTE.map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <div style={labelStyle}>{t('napomena')}</div>
                                        <input className="form-input" value={form.napomena} onChange={e => setF('napomena', e.target.value)} />
                                    </div>
                                </div>

                                {/* File attach */}
                                <div style={{ marginBottom: 16 }}>
                                    <div style={labelStyle}>{t('priloziDatotekuOpciono')}</div>
                                    <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.jpg,.png"
                                        style={{ display: 'none' }}
                                        onChange={e => { handleFileUpload(e.target.files[0]); e.target.value = ''; }} />
                                    {(pendingFile || form.attachedFileName) ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                            <span style={{ fontSize: '1.2rem' }}>{form.attachedFileName?.endsWith('.pdf') ? '📕' : '📄'}</span>
                                            {/* Clickable filename — opens in new tab if saved, plain text if still pending */}
                                            {form.idbKey && !pendingFile ? (
                                                <button
                                                    onClick={() => handleOpen({ idbKey: form.idbKey, attachedFileName: form.attachedFileName })}
                                                    style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    title={t('klikniZaPregledavanjeIspis')}>
                                                    {form.attachedFileName}
                                                </button>
                                            ) : (
                                                <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {form.attachedFileName}
                                                    {pendingFile && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-muted)' }}>({(pendingFile.size/1024).toFixed(0)} KB)</span>}
                                                </span>
                                            )}
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }} onClick={() => fileRef.current?.click()}>{t('zamijeni')}</button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={handleRemoveFile}>✕</button>
                                        </div>
                                    ) : (
                                        <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: 14, textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            📎 {t('klikniteZaUploadDokumentaPdf1')}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                        💾 {t('save')}
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditId(null); }}>
                                        ↩ {t('cancel')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TOOLBAR ── */}
                    <div className="card" style={{ marginBottom: 16 }}>
                        <div className="card-body scrollable-toolbar" style={{ padding: 0, gap: 10 }}>
                            <button className="btn btn-primary" onClick={handleNew} title={t('klikniteZaKreiranjeNovogZapisnika')}>
                                + {t('noviZapisnik1')}
                            </button>

                            <button className="btn btn-dark btn-sm" style={{ height: 38 }} onClick={() => window.open(`/print-template?type=ZOS&country=${country}`, '_blank')} title={t('generirajtePrazanZapisnikOOcjeni')}>
                                📝 {t('zapisnikZos')}
                            </button>
                            <button className="btn btn-dark btn-sm" style={{ height: 38, background: '#d32f2f', color: 'white', borderColor: '#b71c1c' }} onClick={() => window.open(`/print-template?type=ZOP&country=${country}`, '_blank')} title={t('generirajtePrazanZapisnikOOcjeni1')}>
                                🔥 {t('zapisnikZop')}
                            </button>

                            <div className="search-bar" style={{ flex: 1, minWidth: 200, maxWidth: 360 }}>
                                <input
                                    placeholder={t('pretraziZapisnike')}
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%' }}
                                />
                                {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>✕</button>}
                            </div>

                            {/* Grupne akcije */}
                            {selectedIds.size> 0 ? (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                        {selectedIds.size} {t('odabrano')} — Grupne akcije:
                                    </span>
                                    <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>
                                        🗑️ {t('obrisi')}
                                    </button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>✕</button>
                                </div>
                            ) : (
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                    {filtered.length} {t('zapisa')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── TABLE ── */}
                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}>
                            {sorted.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
                                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('nemaZapisnika')}</div>
                                    <div style={{ fontSize: '0.82rem', marginBottom: 16 }}>{t('kreirajtePrviZapisnikKlikomNa')}</div>
                                    <button className="btn btn-primary" onClick={handleNew}>+ {t('noviZapisnik1')}</button>
                                </div>
                            ) : (
                                <div className="data-table-wrapper">
                                    <table className="data-table" style={{ width: '100%' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40, textAlign: 'center' }}>
                                                    <input type="checkbox"
                                                        checked={selectedIds.size === sorted.length && sorted.length> 0}
                                                        onChange={toggleAll}
                                                        style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                                                    />
                                                </th>
                                                <th style={{ width: 100 }}>{t('akcije')}</th>
                                                <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{t('naziv')}{sortIcon('naziv')}</th>
                                                <th onClick={() => toggleSort('broj')} style={{ ...thStyle('broj'), width: 120 }}>{lang !== 'en' ? 'Broj' : 'No.'}{sortIcon('broj')}</th>
                                                <th onClick={() => toggleSort('datum')} style={{ ...thStyle('datum'), width: 110 }}>{t('datum')}{sortIcon('datum')}</th>
                                                <th style={{ width: 200 }}>{t('vrsta')}</th>
                                                <th style={{ width: 70, textAlign: 'center' }}>{t('dokument')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sorted.map(item => (
                                                <tr key={item.id}>
                                                    {/* Checkbox */}
                                                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                        <input type="checkbox"
                                                            checked={selectedIds.has(item.id)}
                                                            onChange={() => toggleOne(item.id)}
                                                            style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                                                        />
                                                    </td>

                                                    {/* Akcije */}
                                                    <td onClick={e => e.stopPropagation()}>
                                                        <div style={{ position: 'relative' }}>
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    if (actionMenuId === item.id) { setActionMenuId(null); return; }
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                                    const spaceAbove = rect.top - 8;
                                                                    const flipUp = spaceBelow < 280 && spaceAbove> spaceBelow;
                                                                    setMenuPos(flipUp
                                                                        ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                                                                        : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                                                                    );
                                                                    setActionMenuId(item.id);
                                                                }}>
                                                                {t('akcije')} ▼
                                                            </button>

                                                            {actionMenuId === item.id && (
                                                                <>
                                                                    {/* Transparent backdrop — pointer-events none so menu buttons receive clicks */}
                                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setActionMenuId(null)} />
                                                                    <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom,
                                                                        left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none',
                                                                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                                        borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                                                                        minWidth: 210, maxHeight: menuPos.maxH, overflowY: 'auto',
                                                                    }}>
                                                                        <button onMouseDown={e => { e.stopPropagation(); setActionMenuId(null); handleEdit(item); }} className="dropdown-item">✏️ {t('otvori')}</button>
                                                                        {item.idbKey && <>
                                                                            <button onMouseDown={e => { e.stopPropagation(); setActionMenuId(null); handleOpen(item); }} className="dropdown-item">📂 {t('otvoriZapisnik')}</button>
                                                                            <button onMouseDown={e => { e.stopPropagation(); setActionMenuId(null); handleDownload(item); }} className="dropdown-item">📥 {lang !== 'en' ? 'Preuzmi zapisnik' : 'Download record'}</button>
                                                                        </>}
                                                                        <button onMouseDown={e => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(item); }} className="dropdown-item">📋 {t('kopiraj')}</button>
                                                                        <button onMouseDown={e => { e.stopPropagation(); setActionMenuId(null); handleOpenEmailModal(item); }} className="dropdown-item">✉️ {t('posaljiEmail')}</button>
                                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                        <button onMouseDown={e => { e.stopPropagation(); setActionMenuId(null); handleDelete(item); }} className="dropdown-item text-danger">🗑️ {t('obrisi')}</button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Data cells */}
                                                    <td>
                                                        <div
                                                            onClick={() => handleEdit(item)}
                                                            style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                                                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
                                                            {item.naziv}
                                                        </div>
                                                        {item.napomena && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{item.napomena}</div>}
                                                    </td>
                                                    <td><code style={{ fontSize: '0.82rem' }}>{item.broj || '—'}</code></td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(item.datum)}</td>
                                                    <td>
                                                        {item.vrsta ? (
                                                            <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: 'var(--secondary)', fontWeight: 600 }}>
                                                                {item.vrsta}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {item.idbKey ? (
                                                            <button className="btn btn-ghost btn-sm btn-icon" title={`${item.attachedFileName} — klikni za otvaranje`} onClick={e => { e.stopPropagation(); handleOpen(item); }}>
                                                                {item.attachedFileName?.endsWith('.pdf') ? '📕' : '📄'}
                                                            </button>
                                                        ) : '—'}
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

            {/* ══════════════ EMAIL MODAL ══════════════ */}
            {emailModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700 }}>✉️ {t('posaljiZapisnikEmailom')}</span>
                            <button className="btn btn-ghost btn-icon" onClick={() => setEmailModal(null)}>✕</button>
                        </div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,191,166,0.07)', border: '1px solid rgba(0,191,166,0.2)', fontSize: '0.82rem' }}>
                                <strong>{emailModal.item.naziv}</strong>
                                {emailModal.item.broj && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{emailModal.item.broj}</span>}
                                {emailModal.item.idbKey && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>📎 {emailModal.item.attachedFileName} — {t('dokumentCetePrilozitiRucnoU')}</div>}
                            </div>

                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                                    {t('primateljiOdvojiteZarezom')}
                                </div>
                                <input className="form-input" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                                    placeholder="ime@kompanija.ba, drugi@kompanija.ba" autoFocus />
                            </div>

                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                                    {t('predmet')}
                                </div>
                                <input className="form-input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                            </div>

                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                                    {t('poruka')}
                                </div>
                                <textarea className="form-input" rows={8} value={emailBody} onChange={e => setEmailBody(e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }} />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="btn btn-primary" onClick={handleSendEmail}>✉️ {t('otvoriEmailKlijent')}</button>
                                <button className="btn btn-ghost" onClick={() => setEmailModal(null)}>{t('cancel')}</button>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: -6 }}>💡 {t('otvoritCeSeVasEmail')}</div>
                        </div>
                    </div>
                </div>
            )}

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
                                    onClick={() => corrFileRef.current?.click()}>
                                    <div style={{ fontSize: '3rem', marginBottom: 12 }}>{extracting ? '⏳' : dragging ? '📂' : '📋'}</div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>
                                        {extracting ? (t('citanjeDokumenta'))
                                            : dragging ? (t('ispustiZapisnikOvdje'))
                                            : (t('prevuciZapisnikIliKlikniZa'))}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>PDF, DOCX, TXT — max 20MB</div>
                                    {extractError && <div style={{ marginTop: 16, color: 'var(--danger)', fontWeight: 600 }}>⚠️ {extractError}</div>}
                                    <input ref={corrFileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                                        onChange={e => { const f = e.target.files[0]; if (f) handleFileRead(f); e.target.value = ''; }} />
                                </div>
                                <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.82rem' }}>
                                    <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--secondary)' }}>💡 {t('kakoFunkcionise')}</div>
                                    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-muted)' }}>
                                        <li>{t('aplikacijaIzDokumentaIzvlaciSva')}</li>
                                        <li>{t('svakoImeUsporeujeSRadnicima')}</li>
                                        <li>{t('prikazujeTabeluSOriginalnimI')}</li>
                                        <li>{t('generiraIspravljenDokumentDocxIli')}</li>
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
                                        {lang !== 'en' ? `Pronađeno ${rows.length} potencijalnih imena · ${activeChanges} izmjena` : `Found ${rows.length} names · ${activeChanges} changes`}
                                    </div>
                                </div>
                                <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || activeChanges === 0}>
                                    {generating ? '⏳' : '📥'} {t('generisiIspravljenDokument')}
                                </button>
                            </div>

                            <div className="card">
                                <div className="card-body" style={{ padding: 0 }}>
                                    <div className="data-table-wrapper">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: 40 }}>✓</th>
                                                    <th>{t('izDokumenta')}</th>
                                                    <th>{t('radnikUSustavu')}</th>
                                                    <th style={{ width: 80, textAlign: 'center' }}>{t('match')}</th>
                                                    <th>{t('ispravnoIme')}</th>
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
                                                                <input type="checkbox" checked={row.keep} onChange={e => updateRow(row.id, { keep: e.target.checked })} style={{ accentColor: 'var(--primary)' }} />
                                                            </td>
                                                            <td><span style={{ fontWeight: 500 }}>{row.original}</span></td>
                                                            <td>
                                                                {row.matchedWorker
                                                                    ? <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{row.matchedWorker.ime} {row.matchedWorker.prezime}</div>
                                                                    : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.82rem' }}>— nije pronađen —</span>}
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                {conf ? <div><div style={{ fontSize: '1.1rem' }}>{conf.emoji}</div><div style={{ fontSize: '0.68rem', fontWeight: 700, color: conf.color }}>{conf.label}</div></div> : '—'}
                                                            </td>
                                                            <td>
                                                                <input className="form-input" style={{ fontSize: '0.88rem', padding: '5px 8px', borderColor: isChanged ? 'var(--primary)' : undefined }}
                                                                    value={row.correctedName} onChange={e => updateRow(row.id, { correctedName: e.target.value })} disabled={!row.keep} />
                                                            </td>
                                                            <td>
                                                                <button className="btn btn-ghost btn-sm" title="Reset" onClick={() => updateRow(row.id, { correctedName: row.original })}>↺</button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                                <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || activeChanges === 0}>
                                    {generating ? '⏳' : '📥'} {t('generisiIspravljenDokument')}
                                    {activeChanges> 0 && <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem' }}>{activeChanges}</span>}
                                </button>
                                <button className="btn btn-ghost" onClick={() => setRows(r => r.map(x => ({ ...x, keep: true })))}>✓ {t('oznaciSve')}</button>
                                <button className="btn btn-ghost" onClick={() => setRows(r => r.map(x => ({ ...x, keep: false })))}>✗ {t('odznaciSve')}</button>
                                <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{activeChanges} {t('izmjena')}</span>
                            </div>
                        </>
                    )}

                    {step === 'done' && (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
                                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>✅</div>
                                <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }}>{t('ispravljenDokumentGenerisan')}</div>
                                <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{t('datotekaJePreuzeta')}</div>
                                <button className="btn btn-primary" onClick={handleReset}>↺ {t('obradiNoviDokument')}</button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
