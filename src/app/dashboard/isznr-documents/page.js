'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS, formatDate,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import PageHeader from '@/components/PageHeader';

const emptyDoc = {
    partyId: '', naslov: '', tipDokumentaId: '', datum: '', potpisano: false, datoteka: '',
};

export default function ISZNRDocumentsPage() {
    const { t, lang } = useLanguage();
    
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    
    const [docs, setDocs] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyDoc });
    const [searchTerm, setSearchTerm] = useState('');
    const [parties, setParties] = useState([]);
    const [docTypes, setDocTypes] = useState([]);
    
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const [selectedIds, setSelectedIds] = useState(new Set());

    const loadData = useCallback(() => {
        setDocs(getAll(COLLECTIONS.ISZNR_DOCUMENTS));
        setParties(getAll(COLLECTIONS.ISZNR_PARTIES));
        setDocTypes(getAll(COLLECTIONS.ISZNR_DOC_TYPES));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);
    
    useEffect(() => {
        const handleClick = (e) => {
            if (actionMenuId && !e.target.closest('[data-menu]') && !e.target.closest('[data-menu-trigger]')) {
                setActionMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [actionMenuId]);

    const filtered = docs.filter(d =>
        !searchTerm || d.naslov.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datum');

    const getPartyName = (id) => { const p = parties.find(x => x.id === id); return p ? p.naziv : '-'; };
    const getDocTypeName = (id) => { const dt = docTypes.find(x => x.id === id); return dt ? dt.naziv : '-'; };

    const handleNew = () => { setFormData({ ...emptyDoc }); setEditingId(null); setShowForm(true); };
    const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); setActionMenuId(null); };
    const handleDelete = async (id) => {
        const ok = await confirm(t('jesteLiSigurni'));
        if (ok) { remove(COLLECTIONS.ISZNR_DOCUMENTS, id); setActionMenuId(null); loadData(); }
    };
    const handleSave = async () => {
        if (!formData.naslov || !formData.partyId) {
            await alert(t('titleAndPartyAreRequired'));
            return;
        }
        if (editingId) { update(COLLECTIONS.ISZNR_DOCUMENTS, editingId, formData); } else { create(COLLECTIONS.ISZNR_DOCUMENTS, formData); }
        setShowForm(false); showFlash(); loadData();
    };
    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    const toggleAll = (e) => { if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id))); else setSelectedIds(new Set()); };
    const toggleOne = (id) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(t('deleteDocuments2').replace('{0}', selectedIds.size))) {
            for (const id of selectedIds) remove(COLLECTIONS.ISZNR_DOCUMENTS, id);
            setSelectedIds(new Set()); loadData();
        }
    };

    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader icon="🏛️" title={`${t('documents')} — ISZNR`} />

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '✏️' : '+'} {t('dokument')}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid-2">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('naslov')} <span style={{ color: 'var(--danger)' }}>*</span></label>
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
                                    <DateInput value={formData.datum} onChange={v => updateField('datum', v)} />
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
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={handleNew}>+ {t('noviDokument')}</button>
                        <div className="search-bar" style={{ width: 250, flexShrink: 0 }}>
                            <span style={{ opacity: 0.5 }}>🔍</span>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                        <SavedFlash />
                        {selectedIds.size> 0 ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {t('odabrano1')}:</span>
                                <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {t('obrisi')}</button>
                            </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto', flexShrink: 0 }}>{sorted.length} {t('records')}</span>}
                    </div>

                    <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                    <th style={{ width: 90 }}>{t('actions')}</th>
                                    <th onClick={() => toggleSort('partyId')} style={thStyle('partyId')}>{t('party')} {sortIcon('partyId')}</th>
                                    <th onClick={() => toggleSort('naslov')} style={thStyle('naslov')}>{t('naslov')} {sortIcon('naslov')}</th>
                                    <th onClick={() => toggleSort('tipDokumentaId')} style={thStyle('tipDokumentaId')}>{t('type')} {sortIcon('tipDokumentaId')}</th>
                                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{t('date')} {sortIcon('datum')}</th>
                                    <th onClick={() => toggleSort('potpisano')} style={thStyle('potpisano')}>{t('signed')} {sortIcon('potpisano')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map((doc) => (
                                    <tr key={doc.id} onClick={() => handleEdit(doc)} style={{ cursor: 'pointer', transition: 'background 0.12s' }}>
                                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(doc.id)} onChange={() => toggleOne(doc.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" data-menu-trigger onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); if (actionMenuId === doc.id) { setActionMenuId(null); return; } const rect = e.currentTarget.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom - 8; const spaceAbove = rect.top - 8; const flipUp = spaceBelow < 150 && spaceAbove> spaceBelow; setMenuPos(flipUp ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) } : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }); setActionMenuId(doc.id); }}>Akcije ▼</button>
                                                {actionMenuId === doc.id && (
                                                    <div data-menu onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                        <button onClick={() => handleEdit(doc)} className="dropdown-item">📂 {t('open')}</button>
                                                        <button onClick={() => { setActionMenuId(null); update(COLLECTIONS.ISZNR_DOCUMENTS, doc.id, { potpisano: !doc.potpisano }); loadData(); showFlash(); }} className="dropdown-item">✍️ {doc.potpisano ? (t('removeSignature')) : t('digitalSigning')}</button>
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => handleDelete(doc.id)} className="dropdown-item text-danger">🗑️ {t('delete')}</button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{getPartyName(doc.partyId)}</td>
                                        <td>{doc.naslov}</td>
                                        <td><span className="badge badge-info" style={{ fontWeight: 600 }}>{getDocTypeName(doc.tipDokumentaId)}</span></td>
                                        <td>{formatDate(doc.datum)}</td>
                                        <td>
                                            {doc.potpisano
                                                ? <span className="badge badge-success">✓ {t('signed1')}</span>
                                                : <span className="badge badge-warning">{t('notSigned')}</span>}
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
