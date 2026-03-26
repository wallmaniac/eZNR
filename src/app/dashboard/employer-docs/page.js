'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS, formatDate,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSearchParams } from 'next/navigation';
import HelpTip from '@/components/HelpTip';
import { useSavedFlash } from '@/hooks/useSavedFlash';

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
    const [formData, setFormData] = useState({ naziv: '', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '', datumIsteka: '', napomena: '', docData: null, docName: '', docType: '' });

    // Dropdown & bulk selection state
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const [selected, setSelected] = useState(new Set());

    // Click outside listener for actions dropdown
    useEffect(() => {
        const close = () => setOpenDropdownId(null);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, []);

    const loadData = useCallback(() => { setDocs(getAll(COLLECTIONS.EMPLOYER_DOCS)); }, []);
    useEffect(() => { loadData(); }, [loadData]);

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

    const handleNew = () => { setFormData({ naziv: '', kategorija: activeTab, status: 'aktivan', datumIzdavanja: '', datumIsteka: '', napomena: '', docData: null, docName: '', docType: '' }); setEditingId(null); setShowForm(true); };
    const handleEdit = (item) => { setFormData({ docData: null, docName: '', docType: '', ...item }); setEditingId(item.id); setShowForm(true); };
    const handleSave = async () => {
        if (!formData.naziv) { await alert(lang === 'bs' ? 'Naziv je obavezno polje!' : 'Name is required!'); return; }
        if (editingId) { update(COLLECTIONS.EMPLOYER_DOCS, editingId, formData); } else { create(COLLECTIONS.EMPLOYER_DOCS, formData); }
        setShowForm(false); loadData(); showFlash();
    };
    const handleDelete = async (id) => {
        const delOk = await confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?'); if (delOk) { remove(COLLECTIONS.EMPLOYER_DOCS, id); loadData(); }
    };

    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { await alert(lang === 'bs' ? 'Datoteka mora biti manja od 5MB!' : 'File must be under 5MB!'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setFormData(prev => ({ ...prev, docData: ev.target.result, docName: file.name, docType: file.type }));
        };
        reader.readAsDataURL(file);
    };

    const handleDownloadFile = (doc) => {
        if (!doc.docData) return;
        const a = document.createElement('a');
        a.href = doc.docData;
        a.download = doc.docName || doc.naziv;
        a.click();
    };

    // Filtered list by active tab
    const filtered = docs.filter(d => d.kategorija === activeTab);

    // Sortable columns via reusable hook
    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'naziv');

    // ── Bulk actions ──
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
.badge { padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 8pt; display: inline-block; }
@media print { button { display: none !important; } }
</style></head><body>
<h1>📋 Dokumentacija za poslodavca</h1>
<table>
<thead><tr><th>#</th><th>Naziv</th><th>Status</th><th>Datum izdavanja</th><th>Datum isteka</th><th>Napomena</th></tr></thead>
<tbody>
${toPrint.map((d, i) => `<tr>
<td>${i + 1}</td><td>${d.naziv || '—'}</td>
<td>${d.status === 'aktivan' ? '✓ Aktivan' : '✕ Istekao'}</td>
<td>${d.datumIzdavanja ? new Date(d.datumIzdavanja).toLocaleDateString('hr-HR') : '—'}</td>
<td>${d.datumIsteka ? new Date(d.datumIsteka).toLocaleDateString('hr-HR') : '—'}</td>
<td>${d.napomena || '—'}</td></tr>`).join('')}
</tbody></table>
<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:12px 24px;font-size:14px;cursor:pointer;background:#3f51b5;color:white;border:none;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:999">🖨️ Print</button>
<script>setTimeout(() => window.print(), 500);</script>
</body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const tabs = [
        { key: 'obavezna', label: t('mandatoryDocs'), icon: '📋' },
        { key: 'periodicni', label: t('periodicReviews'), icon: '🔄' },
        { key: 'dodatne', label: t('additionalRecords'), icon: '📑' },
    ];

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>📋 {t('employerDocs')}</h1>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '✏️' : '+'} {lang === 'bs' ? 'Dokument' : 'Document'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={(e) => updateField('naziv', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Kategorija' : 'Category'}<HelpTip text="Obavezna = dokumenti zakonom propisani za svakog poslodavca. Periodični = pregledi koji se ponavljaju redovno (PP aparati, hidranti, elektro). Dodatne = ostala dokumentacija korisna za firmu." /></label>
                                    <select className="form-select" value={formData.kategorija} onChange={e => updateField('kategorija', e.target.value)}>
                                        <option value="obavezna">{t('mandatoryDocs')}</option>
                                        <option value="periodicni">{t('periodicReviews')}</option>
                                        <option value="dodatne">{t('additionalRecords')}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('status')}<HelpTip text="Aktivan = dokument je važeći i na snazi. Istekao = rok važenja dokumenta je prošao, treba obnova." /></label>
                                    <select className="form-select" value={formData.status} onChange={e => updateField('status', e.target.value)}>
                                        <option value="aktivan">{t('active')}</option>
                                        <option value="istekao">{t('expired')}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Datum izdavanja' : 'Issue date'}</label>
                                    <input className="form-input" type="date" value={formData.datumIzdavanja} onChange={e => updateField('datumIzdavanja', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Datum isteka' : 'Expiry date'}</label>
                                    <input className="form-input" type="date" value={formData.datumIsteka} onChange={e => updateField('datumIsteka', e.target.value)} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">{lang === 'bs' ? 'Povezana datoteka (opcionalno)' : 'Attached file (optional)'}</label>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileUpload} style={{ flex: 1, fontSize: '0.85rem' }} />
                                        {formData.docName && (
                                            <button className="btn btn-outline btn-sm" onClick={() => handleDownloadFile(formData)} title={lang === 'bs' ? 'Preuzmi datoteku' : 'Download file'}>⬇️ {formData.docName}</button>
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
                            <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {tabs.map(tb => (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)} style={{
                        padding: '12px 24px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.85rem',
                        background: activeTab === tb.key ? 'var(--dark)' : 'var(--bg-input)',
                        color: activeTab === tb.key ? 'white' : 'var(--text)',
                        boxShadow: activeTab === tb.key ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                        transition: 'all 0.2s',
                    }}>
                        {tb.icon} {tb.label} <span style={{ marginLeft: 8, background: activeTab === tb.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-badge)', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem' }}>{docs.filter(d => d.kategorija === tb.key).length}</span>
                    </button>
                ))}
            </div>

            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {t('add')}</button>
                        <SavedFlash />

                        {/* ── Bulk Actions Bar ── */}
                        {selected.size > 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selected.size} {lang === 'bs' ? 'odabrano' : 'selected'}
                                </span>
                                <button className="btn btn-ghost btn-sm" onClick={bulkPrint} title={lang === 'bs' ? 'Isprintaj odabrane' : 'Print selected'} style={{ fontWeight: 600 }}>🖨️ {lang === 'bs' ? 'Isprintaj' : 'Print'}</button>
                                <button className="btn btn-ghost btn-sm" onClick={bulkDownload} title={lang === 'bs' ? 'Preuzmi datoteke' : 'Download files'} style={{ fontWeight: 600, color: '#11998e' }}>⬇️ {lang === 'bs' ? 'Preuzmi' : 'Download'}</button>
                                <button className="btn btn-ghost btn-sm" onClick={bulkDelete} title={lang === 'bs' ? 'Obriši odabrane' : 'Delete selected'} style={{ fontWeight: 600, color: 'var(--danger)' }}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
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
                                    <th style={{ width: 60 }}>{t('actions')}</th>
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
                                            {/* Actions dropdown */}
                                            <td onClick={e => e.stopPropagation()}>
                                                <div style={{ position: 'relative' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === doc.id ? null : doc.id); }} style={{ padding: '0 8px', fontSize: '1rem', fontWeight: 900 }}>⋮</button>
                                                    {openDropdownId === doc.id && (
                                                        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, minWidth: 160, padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', fontWeight: 600 }} onClick={() => { setOpenDropdownId(null); handleEdit(doc); }}>✏️ Otvori</button>
                                                            {doc.docData && (
                                                                <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: '#11998e' }} onClick={() => { setOpenDropdownId(null); handleDownloadFile(doc); }}>⬇️ Preuzmi</button>
                                                            )}
                                                            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                                            <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--danger)' }} onClick={() => { setOpenDropdownId(null); handleDelete(doc.id); }}>🗑️ Izbriši</button>
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
                                                    {doc.status === 'aktivan' ? (lang === 'bs' ? '✓ Aktivan' : '✓ Active') : (lang === 'bs' ? '✕ Istekao' : '✕ Expired')}
                                                </span>
                                            </td>
                                            <td>{formatDate(doc.datumIzdavanja)}</td>
                                            <td style={{ color: isExpiring ? 'var(--warning)' : undefined, fontWeight: isExpiring ? 700 : undefined }}>
                                                {doc.datumIsteka ? formatDate(doc.datumIsteka) : '-'}
                                                {isExpiring && ' ⚠️'}
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
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
            <EmployerDocsInner />
        </Suspense>
    );
}
