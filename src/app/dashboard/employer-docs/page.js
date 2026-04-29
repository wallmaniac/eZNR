'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS, formatDate, getActiveCompanyId
} from '@/lib/dataStore';
import { uploadDocument } from '@/lib/storageService';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSearchParams } from 'next/navigation';
import HelpTip from '@/components/HelpTip';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import PageHeader from '@/components/PageHeader';

function EmployerDocsInner() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const searchParams = useSearchParams();
    const highlightId = searchParams?.get('highlight');
    const highlightRef = useRef(null);

    const [docs, setDocs] = useState([]);
    const [activeTab, setActiveTab] = useState('obavezna');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [search, setSearch] = useState('');
    const [formData, setFormData] = useState({ naziv: '', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '', datumIsteka: '', napomena: '', docData: null, docName: '', docType: '', fileObj: null });

    // Akcije dropdown state (per-row, fixed position)
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const menuButtonRef = useRef(null);

    // Bulk selection state
    const [selected, setSelected] = useState(new Set());

    // Click outside listener for actions dropdown
    useEffect(() => {
        const close = (e) => {
            if (openMenuId && !e.target.closest('[data-menu]') && !e.target.closest('[data-menu-trigger]')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [openMenuId]);

    const loadData = useCallback(() => { setDocs(getAll(COLLECTIONS.EMPLOYER_DOCS)); }, []);
    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    useEffect(() => {
        const openId = searchParams?.get('openId');
        if (openId && docs.length > 0 && !showForm) {
            const rec = docs.find(d => d.id === openId);
            if (rec) handleEdit(rec);
        }
    }, [searchParams, docs]);

    // Scroll to highlighted doc from calendar event click
    useEffect(() => {
        if (highlightId && docs.length > 0) {
            const found = docs.find(d => d.id === highlightId);
            if (found && found.kategorija) setActiveTab(found.kategorija);
            setTimeout(() => {
                highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 400);
        }
    }, [highlightId, docs]);

    const handleNew = () => { setFormData({ naziv: '', kategorija: activeTab, status: 'aktivan', datumIzdavanja: '', datumIsteka: '', napomena: '', docData: null, docName: '', docType: '', fileObj: null }); setEditingId(null); setShowForm(true); };
    const handleEdit = (item) => { setOpenMenuId(null); setFormData({ docData: null, docName: '', docType: '', fileObj: null, ...item }); setEditingId(item.id); setShowForm(true); };
    const handleSave = async () => {
        if (!formData.naziv) { await alert(lang === 'bs' ? 'Naziv je obavezno polje!' : 'Name is required!'); return; }
        
        let uploadedUrl = formData.docData;
        
        if (formData.fileObj) {
            try {
                const cid = getActiveCompanyId();
                const res = await uploadDocument(formData.fileObj, cid, 'employer-docs');
                uploadedUrl = res.url;
            } catch (e) {
                await alert('Upload failed: ' + e.message); return;
            }
        }
        
        const payload = { ...formData, docData: uploadedUrl };
        delete payload.fileObj; // drop non-serializable blob

        if (editingId) { update(COLLECTIONS.EMPLOYER_DOCS, editingId, payload); } else { create(COLLECTIONS.EMPLOYER_DOCS, payload); }
        setShowForm(false); loadData(); showFlash();
    };
    const handleDelete = async (id) => {
        setOpenMenuId(null);
        const delOk = await confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?'); if (delOk) { remove(COLLECTIONS.EMPLOYER_DOCS, id); loadData(); }
    };
    const handleCopy = async (doc) => {
        setOpenMenuId(null);
        if (!await confirm(`Kopirati dokument "${doc.naziv || 'Bez naziva'}"?`)) return;
        const copyData = { ...doc };
        delete copyData.id;
        copyData.naziv = (copyData.naziv || '') + ' (Kopija)';
        copyData.status = 'aktivan';
        create(COLLECTIONS.EMPLOYER_DOCS, copyData);
        loadData(); showFlash();
    };
    const handlePrintSingle = (doc) => {
        setOpenMenuId(null);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.naziv}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1a1a1a;padding:20px}h1{font-size:18pt;color:#1a237e}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#e8eaf6;font-weight:700;color:#283593;width:200px}@media print{button{display:none!important}}</style></head><body>
<h1>\u{1F4CB} ${doc.naziv}</h1>
<table>
<tr><th>Naziv</th><td>${doc.naziv || '\u2014'}</td></tr>
<tr><th>Kategorija</th><td>${doc.kategorija === 'obavezna' ? 'Obavezna dokumentacija' : doc.kategorija === 'periodicni' ? 'Periodi\u010Dni pregledi' : 'Dodatne evidencije'}</td></tr>
<tr><th>Status</th><td>${doc.status === 'aktivan' ? '\u2713 Aktivan' : '\u2715 Istekao'}</td></tr>
<tr><th>Datum izdavanja</th><td>${doc.datumIzdavanja ? new Date(doc.datumIzdavanja).toLocaleDateString('hr-HR') : '\u2014'}</td></tr>
<tr><th>Datum isteka</th><td>${doc.datumIsteka ? new Date(doc.datumIsteka).toLocaleDateString('hr-HR') : '\u2014'}</td></tr>
<tr><th>Napomena</th><td>${doc.napomena || '\u2014'}</td></tr>
<tr><th>Datoteka</th><td>${doc.docName || '\u2014'}</td></tr>
</table>
<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:12px 24px;font-size:14px;cursor:pointer;background:#3f51b5;color:white;border:none;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:999">\u{1F5A8}\uFE0F Print</button>
<script>setTimeout(()=>window.print(),500);</script>
</body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) { await alert(lang === 'bs' ? 'Datoteka mora biti manja od 15MB!' : 'File must be under 15MB!'); return; }
        setFormData(prev => ({ ...prev, fileObj: file, docName: file.name, docType: file.type }));
    };

    const handleDownloadFile = (doc) => {
        if (!doc.docData) return;
        if (doc.docData.startsWith('http')) {
            window.open(doc.docData, '_blank');
            return;
        }
        const a = document.createElement('a');
        a.href = doc.docData;
        a.download = doc.docName || doc.naziv;
        a.click();
    };

    const filtered = (search ? docs.filter(d => (d.naziv||'').toLowerCase().includes(search.toLowerCase()) || (d.napomena||'').toLowerCase().includes(search.toLowerCase())) : docs).filter(d => d.kategorija === activeTab);

    // Sortable columns via reusable hook
    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'naziv');

    // ���� Bulk actions ����
    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const allSelected = sorted.length > 0 && sorted.every(d => selected.has(d.id));
    const toggleAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(sorted.map(d => d.id)));
        }
    };

    // Clear selection when switching tabs
    useEffect(() => { setSelected(new Set()); }, [activeTab]);

    const bulkDownload = () => {
        const toDownload = sorted.filter(d => selected.has(d.id) && d.docData);
        toDownload.forEach(doc => handleDownloadFile(doc));
    };
    const bulkDelete = async () => {
        const count = selected.size;
        if (count === 0) return;
        const ok = await confirm(lang === 'bs' ? `Obrisati ${count} odabranih dokumenata?` : `Delete ${count} selected documents?`);
        if (!ok) return;
        selected.forEach(id => remove(COLLECTIONS.EMPLOYER_DOCS, id));
        setSelected(new Set());
        loadData();
    };
    const bulkPrint = () => {
        const toPrint = sorted.filter(d => selected.has(d.id));
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dokumenti</title>
<style>
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
h1 { font-size: 18pt; color: #1a237e; margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9pt; }
th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
th { background: #e8eaf6; font-weight: 700; color: #283593; }
tr:nth-child(even) { background: #fafafa; }
@media print { button { display: none !important; } }
</style></head><body>
<h1>\u{1F4CB} Dokumentacija za poslodavca</h1>
<table>
<thead><tr><th>#</th><th>Naziv</th><th>Status</th><th>Datum izdavanja</th><th>Datum isteka</th><th>Napomena</th></tr></thead>
<tbody>
${toPrint.map((d, i) => `<tr>
<td>${i + 1}</td><td>${d.naziv || '\u2014'}</td>
<td>${d.status === 'aktivan' ? '\u2713 Aktivan' : '\u2715 Istekao'}</td>
<td>${d.datumIzdavanja ? new Date(d.datumIzdavanja).toLocaleDateString('hr-HR') : '\u2014'}</td>
<td>${d.datumIsteka ? new Date(d.datumIsteka).toLocaleDateString('hr-HR') : '\u2014'}</td>
<td>${d.napomena || '\u2014'}</td></tr>`).join('')}
</tbody></table>
<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:12px 24px;font-size:14px;cursor:pointer;background:#3f51b5;color:white;border:none;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:999">\u{1F5A8}\uFE0F Print</button>
<script>setTimeout(() => window.print(), 500);</script>
</body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    // ���� Shared menu item style (matching trainings/workers pattern) ����
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    const tabs = [
        { key: 'obavezna', label: t('mandatoryDocs'), icon: '\u{1F4CB}' },
        { key: 'periodicni', label: t('periodicReviews'), icon: '\u{1F504}' },
        { key: 'dodatne', label: t('additionalRecords'), icon: '\u{1F4D1}' },
    ];

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>{'\u{1F4CB}'} {t('employerDocs')}</h1>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '\u270F\uFE0F' : '+'} {lang === 'bs' ? 'Dokument' : 'Document'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>{'\u2715'}</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={(e) => updateField('naziv', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Kategorija' : 'Category'}<HelpTip text="Obavezna = dokumenti zakonom propisani za svakog poslodavca. Periodi\u010Dni = pregledi koji se ponavljaju redovno (PP aparati, hidranti, elektro). Dodatne = ostala dokumentacija korisna za firmu." /></label>
                                    <select className="form-select" value={formData.kategorija} onChange={e => updateField('kategorija', e.target.value)}>
                                        <option value="obavezna">{t('mandatoryDocs')}</option>
                                        <option value="periodicni">{t('periodicReviews')}</option>
                                        <option value="dodatne">{t('additionalRecords')}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('status')}<HelpTip text="Aktivan = dokument je va\u017Ee\u0107i i na snazi. Istekao = rok va\u017Eenja dokumenta je pro\u0161ao, treba obnova." /></label>
                                    <select className="form-select" value={formData.status} onChange={e => updateField('status', e.target.value)}>
                                        <option value="aktivan">{t('active')}</option>
                                        <option value="istekao">{t('expired')}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Datum izdavanja' : 'Issue date'}</label>
                                    <DateInput value={formData.datumIzdavanja} onChange={v => updateField('datumIzdavanja', v)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Datum isteka' : 'Expiry date'}</label>
                                    <DateInput value={formData.datumIsteka} onChange={v => updateField('datumIsteka', v)} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">{lang === 'bs' ? 'Povezana datoteka (opcionalno)' : 'Attached file (optional)'}</label>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileUpload} style={{ flex: 1, fontSize: '0.85rem' }} />
                                        {formData.docName && (
                                            <button className="btn btn-outline btn-sm" onClick={() => handleDownloadFile(formData)} title={lang === 'bs' ? 'Preuzmi datoteku' : 'Download file'}>{'\u2B07\uFE0F'} {formData.docName}</button>
                                        )}
                                    </div>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">{t('note')}</label>
                                    <textarea className="form-textarea" value={formData.napomena} onChange={e => updateField('napomena', e.target.value)} rows={3} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave}>{'\u{1F4BE}'} {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)' }}>
                {tabs.map(tb => (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)} title={`Prika~i dokumente iz kategorije: ${tb.label}`}
                        className={`tab-btn ${activeTab === tb.key ? 'active' : ''}`}>
                        {tb.icon} {tb.label} <span style={{ marginLeft: 8, background: activeTab === tb.key ? 'rgba(0,191,166,0.15)' : 'var(--bg-badge)', color: activeTab === tb.key ? 'var(--primary)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700 }}>{docs.filter(d => d.kategorija === tb.key).length}</span>
                    </button>
                ))}
            </div>

            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" title="Dodajte novi dokument poslodavca (zapisnik, akt, uvjerenje...)" onClick={handleNew}>+ {lang === 'bs' ? 'Novi dokument' : 'New Document'}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
                            <input
                                placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%' }}
                            />
                            {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>✕</button>}
                        </div>
                        <SavedFlash />

                        {/* ���� Grupne akcije bar ���� */}
                        {selected.size > 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selected.size} {lang === 'bs' ? 'odabrano' : 'selected'} &mdash; Grupne akcije:
                                </span>
                                <button className="btn btn-primary btn-sm" onClick={bulkPrint} title={lang === 'bs' ? 'Isprintaj odabrane' : 'Print selected'}>{'\u{1F5A8}\uFE0F'} {lang === 'bs' ? 'Isprintaj' : 'Print'}</button>
                                <button className="btn btn-primary btn-sm" onClick={bulkDownload} title={lang === 'bs' ? 'Preuzmi datoteke' : 'Download files'}>{'\u{1F4D7}'} {lang === 'bs' ? 'Preuzmi' : 'Download'}</button>
                                <button className="btn btn-danger btn-sm" onClick={bulkDelete} title={lang === 'bs' ? 'Obri\u0161i odabrane' : 'Delete selected'}>{'\u{1F5D1}\uFE0F'} {lang === 'bs' ? 'Obri\u0161i' : 'Delete'}</button>
                            </div>
                        )}
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}>
                                        <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                    </th>
                                    <th style={{ width: 90 }}>{t('actions')}</th>
                                    <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{t('name')}{sortIcon('naziv')}</th>
                                    <th onClick={() => toggleSort('docName')} style={thStyle('docName')}>{lang === 'bs' ? 'Datoteka' : 'File'}{sortIcon('docName')}</th>
                                    <th onClick={() => toggleSort('status')} style={thStyle('status')}>{t('status')}{sortIcon('status')}</th>
                                    <th onClick={() => toggleSort('datumIzdavanja')} style={thStyle('datumIzdavanja')}>{lang === 'bs' ? 'Datum izdavanja' : 'Issue date'}{sortIcon('datumIzdavanja')}</th>
                                    <th onClick={() => toggleSort('datumIsteka')} style={thStyle('datumIsteka')}>{lang === 'bs' ? 'Datum isteka' : 'Expiry date'}{sortIcon('datumIsteka')}</th>
                                    <th>{t('note')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map((doc) => {
                                    const isExpiring = doc.datumIsteka && new Date(doc.datumIsteka) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                                    const isHighlighted = doc.id === highlightId;
                                    const isChecked = selected.has(doc.id);
                                    return (
                                        <tr key={doc.id}
                                            onClick={() => handleEdit(doc)}
                                            className="hover-row"
                                            ref={isHighlighted ? highlightRef : null}
                                            style={{ cursor: 'pointer', transition: 'background 0.12s', ...(isHighlighted ? { background: 'rgba(0,191,166,0.12)', outline: '2px solid var(--primary)', outlineOffset: -2, borderRadius: 4, animation: 'pulse-highlight 1.5s ease-in-out 2' } : {}) }}>
                                            {/* Checkbox */}
                                            <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(doc.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                            </td>
                                            {/* Akcije button � green btn-primary, matching trainings/workers pattern */}
                                            <td onClick={e => e.stopPropagation()}>
                                                <div style={{ position: 'relative' }}>
                                                    <button className="btn btn-primary btn-sm" data-menu-trigger title="Prikaži padaju�!i izbornik akcija za dokument"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (openMenuId === doc.id) { setOpenMenuId(null); return; }
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            menuButtonRef.current = e.currentTarget;
                                                            const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                            const spaceAbove = rect.top - 8;
                                                            const flipUp = spaceBelow < 240 && spaceAbove > spaceBelow;
                                                            setMenuPos(flipUp
                                                                ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                                                                : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                                                            );
                                                            setOpenMenuId(doc.id);
                                                        }}>
                                                        Akcije {'\u25BC'}
                                                    </button>
                                                    {openMenuId === doc.id && (
                                                        <div data-menu style={{
                                                            position: 'fixed',
                                                            top: menuPos.top,
                                                            bottom: menuPos.bottom,
                                                            left: menuPos.left,
                                                            zIndex: 9999,
                                                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                                                            minWidth: 210, maxHeight: menuPos.maxH, overflowY: 'auto',
                                                        }}>
                                                            <button onClick={() => handleEdit(doc)} style={menuItemSt}>{'\u270F\uFE0F'} Otvori</button>
                                                            <button onClick={() => handleCopy(doc)} style={menuItemSt}>{'\u{1F4CB}'} Kopiraj</button>
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <button onClick={() => handlePrintSingle(doc)} style={menuItemSt}>{'\u{1F5A8}\uFE0F'} Isprintaj</button>
                                                            <button onClick={() => { setOpenMenuId(null); handleDownloadFile(doc); }} style={menuItemSt}>{'\u{1F4D7}'} Preuzmi</button>
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <button onClick={() => handleDelete(doc.id)} style={{ ...menuItemSt, color: 'var(--danger)' }}>{'=� Izbriai'}</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{doc.naziv}</td>
                                            <td>
                                                {doc.docData ? (
                                                    <span style={{ textDecoration: 'underline', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); handleDownloadFile(doc); }} title={lang === 'bs' ? 'Preuzmi' : 'Download'}>
                                                        {doc.docName || doc.naziv}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td>
                                                <span className={`badge ${doc.status === 'aktivan' ? 'badge-success' : 'badge-danger'}`}>
                                                    {doc.status === 'aktivan' ? (lang === 'bs' ? '\u2713 Aktivan' : '\u2713 Active') : (lang === 'bs' ? '\u2715 Istekao' : '\u2715 Expired')}
                                                </span>
                                            </td>
                                            <td>{formatDate(doc.datumIzdavanja)}</td>
                                            <td style={{ color: isExpiring ? 'var(--warning)' : undefined, fontWeight: isExpiring ? 700 : undefined }}>
                                                {doc.datumIsteka ? formatDate(doc.datumIsteka) : '-'}
                                                {isExpiring && ' \u26A0\uFE0F'}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{doc.napomena || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <DialogRenderer />
            <style>{`@keyframes pulse-highlight { 0%,100% { background: rgba(0,191,166,0.12); } 50% { background: rgba(0,191,166,0.28); } }`}</style>
        </div>
    );
}

export default function EmployerDocsPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>U\u010Ditavanje...</div>}>
            <EmployerDocsInner />
        </Suspense>
    );
}


