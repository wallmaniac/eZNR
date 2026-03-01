'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, getById, create, update, remove, COLLECTIONS, formatDate,
} from '@/lib/dataStore';

const emptyDoc = {
    partyId: '', naslov: '', tipDokumentaId: '', datum: '', potpisano: false, datoteka: '',
};

export default function ISZNRDocumentsPage() {
    const { t, lang } = useLanguage();
    const [docs, setDocs] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyDoc });
    const [searchTerm, setSearchTerm] = useState('');
    const [parties, setParties] = useState([]);
    const [docTypes, setDocTypes] = useState([]);
    const [actionMenuId, setActionMenuId] = useState(null);
    const actionRef = useRef(null);

    const loadData = useCallback(() => {
        setDocs(getAll(COLLECTIONS.ISZNR_DOCUMENTS));
        setParties(getAll(COLLECTIONS.ISZNR_PARTIES));
        setDocTypes(getAll(COLLECTIONS.ISZNR_DOC_TYPES));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => {
        const handleClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filtered = docs.filter(d =>
        !searchTerm || d.naslov.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getPartyName = (id) => { const p = parties.find(x => x.id === id); return p ? p.naziv : '-'; };
    const getDocTypeName = (id) => { const dt = docTypes.find(x => x.id === id); return dt ? dt.naziv : '-'; };

    const handleNew = () => { setFormData({ ...emptyDoc }); setEditingId(null); setShowForm(true); };
    const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); setActionMenuId(null); };
    const handleDelete = (id) => {
        if (confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?')) { remove(COLLECTIONS.ISZNR_DOCUMENTS, id); setActionMenuId(null); loadData(); }
    };
    const handleSave = () => {
        if (!formData.naslov || !formData.partyId) { alert(lang === 'bs' ? 'Naslov i stranka su obavezna polja!' : 'Title and party are required!'); return; }
        if (editingId) { update(COLLECTIONS.ISZNR_DOCUMENTS, editingId, formData); } else { create(COLLECTIONS.ISZNR_DOCUMENTS, formData); }
        setShowForm(false); loadData();
    };
    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>🏛️ {t('documents')} — ISZNR</h1>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '✏️' : '+'} {lang === 'bs' ? 'Dokument' : 'Document'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>{lang === 'bs' ? 'Naslov' : 'Title'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naslov} onChange={e => updateField('naslov', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('parties')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <select className="form-select" value={formData.partyId} onChange={e => updateField('partyId', e.target.value)}>
                                        <option value="">-</option>
                                        {parties.map(p => <option key={p.id} value={p.id}>{p.naziv}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('documentTypes')}</label>
                                    <select className="form-select" value={formData.tipDokumentaId} onChange={e => updateField('tipDokumentaId', e.target.value)}>
                                        <option value="">-</option>
                                        {docTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.naziv}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('date')}</label>
                                    <input className="form-input" type="date" value={formData.datum} onChange={e => updateField('datum', e.target.value)} />
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.potpisano} onChange={e => updateField('potpisano', e.target.checked)} />
                                        {t('digitalSigning')}
                                    </label>
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

            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {t('add')}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                            <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                        </div>
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th>{lang === 'bs' ? 'Stranka' : 'Party'}</th>
                                    <th>{lang === 'bs' ? 'Naslov' : 'Title'}</th>
                                    <th>{t('type')}</th>
                                    <th>{t('date')}</th>
                                    <th>{lang === 'bs' ? 'Potpisano' : 'Signed'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : filtered.map((doc) => (
                                    <tr key={doc.id}>
                                        <td style={{ position: 'relative' }} ref={actionMenuId === doc.id ? actionRef : null}>
                                            <button className="btn btn-primary btn-sm" onClick={() => setActionMenuId(actionMenuId === doc.id ? null : doc.id)}>
                                                {t('actions')} ▼
                                            </button>
                                            {actionMenuId === doc.id && (
                                                <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0 }}>
                                                    <button className="dropdown-item" onClick={() => handleEdit(doc)}>📂 {t('open')}</button>
                                                    <button className="dropdown-item">✍️ {t('digitalSigning')}</button>
                                                    <div className="dropdown-divider" />
                                                    <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(doc.id)}>🗑️ {t('delete')}</button>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{getPartyName(doc.partyId)}</td>
                                        <td>{doc.naslov}</td>
                                        <td><span className="badge badge-info">{getDocTypeName(doc.tipDokumentaId)}</span></td>
                                        <td>{formatDate(doc.datum)}</td>
                                        <td>
                                            {doc.potpisano
                                                ? <span className="badge badge-success">✓ {lang === 'bs' ? 'Potpisano' : 'Signed'}</span>
                                                : <span className="badge badge-warning">{lang === 'bs' ? 'Nije potpisano' : 'Not signed'}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
