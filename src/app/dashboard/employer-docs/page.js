'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS, formatDate,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
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

    const loadData = useCallback(() => { setDocs(getAll(COLLECTIONS.EMPLOYER_DOCS)); }, []);
    useEffect(() => { loadData(); }, [loadData]);

    // Scroll to highlighted doc from calendar event click
    useEffect(() => {
        if (highlightId && docs.length > 0) {
            // Switch to the correct tab for the highlighted doc
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

    const handleDownloadFromForm = (doc) => {
        if (!doc.docData) return;
        const a = document.createElement('a');
        a.href = doc.docData;
        a.download = doc.docName || doc.naziv;
        a.click();
    };

    const filtered = docs.filter(d => d.kategorija === activeTab);

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
                                            <button className="btn btn-outline btn-sm" onClick={() => handleDownloadFromForm(formData)} title={lang === 'bs' ? 'Preuzmi datoteku' : 'Download file'}>⬇️ {formData.docName}</button>
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
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {t('add')}</button>
                        <SavedFlash />
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('actions')}</th>
                                    <th>{t('name')}</th>
                                    <th>{lang === 'bs' ? 'Datoteka' : 'File'}</th>
                                    <th>{t('status')}</th>
                                    <th>{lang === 'bs' ? 'Datum izdavanja' : 'Issue date'}</th>
                                    <th>{lang === 'bs' ? 'Datum isteka' : 'Expiry date'}</th>
                                    <th>{t('note')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : filtered.map((doc) => {
                                    const isExpiring = doc.datumIsteka && new Date(doc.datumIsteka) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                                    const isHighlighted = doc.id === highlightId;
                                    return (
                                        <tr key={doc.id}
                                            onClick={() => handleEdit(doc)}
                                            onMouseEnter={e => { if (!isHighlighted) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                            onMouseLeave={e => { if (!isHighlighted) e.currentTarget.style.background = ''; }}
                                            ref={isHighlighted ? highlightRef : null}
                                            style={{ cursor: 'pointer', transition: 'background 0.12s', ...(isHighlighted ? { background: 'rgba(0,191,166,0.12)', outline: '2px solid var(--primary)', outlineOffset: -2, borderRadius: 4, animation: 'pulse-highlight 1.5s ease-in-out 2' } : {}) }}>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-primary btn-sm" onClick={() => handleEdit(doc)}>✏️</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(doc.id)} style={{ color: 'var(--danger)' }}>🗑️</button>
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{doc.naziv}</td>
                                            <td>
                                                {doc.docData ? (
                                                    <span style={{ textDecoration: 'underline', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }} onClick={(e) => { e.stopPropagation(); handleDownloadFromForm(doc); }} title={lang === 'bs' ? 'Preuzmi' : 'Download'}>
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
