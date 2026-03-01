'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS,
    getWorkersInWorkplace, getOrgUnitName,
} from '@/lib/dataStore';

const emptyWP = {
    naziv: '', oznaka: '', strucnaSprema: '', grupaRM: '',
    radNaRacunalu: false, posebniUvjetiRada: false, orgUnitId: '',
    opis: '',
};

export default function WorkplacesPage() {
    const { t, lang } = useLanguage();
    const [items, setItems] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyWP });
    const [searchTerm, setSearchTerm] = useState('');
    const [showActive, setShowActive] = useState(false);
    const [actionMenuId, setActionMenuId] = useState(null);
    const actionRef = useRef(null);

    const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.WORKPLACES)); }, []);
    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => {
        const handleClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filtered = items.filter(w =>
        !searchTerm || w.naziv.toLowerCase().includes(searchTerm.toLowerCase()) || (w.oznaka || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleNew = () => { setFormData({ ...emptyWP }); setEditingId(null); setShowForm(true); };
    const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); setActionMenuId(null); };
    const handleDelete = (id) => {
        const workers = getWorkersInWorkplace(id);
        if (workers.length > 0) {
            alert(lang === 'bs' ? 'Ne možete obrisati radno mjesto koje ima zaposlenike.' : 'Cannot delete workplace with assigned workers.');
            return;
        }
        if (confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?')) { remove(COLLECTIONS.WORKPLACES, id); setActionMenuId(null); loadData(); }
    };
    const handleSave = () => {
        if (!formData.naziv) { alert(lang === 'bs' ? 'Naziv je obavezno polje!' : 'Name is required!'); return; }
        if (editingId) { update(COLLECTIONS.WORKPLACES, editingId, formData); } else { create(COLLECTIONS.WORKPLACES, formData); }
        setShowForm(false); loadData();
    };
    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>🔧 {t('workplaces')}</h1>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '✏️' : '+'} {lang === 'bs' ? 'Radno mjesto' : 'Workplace'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={e => updateField('naziv', e.target.value)} placeholder={t('mandatory')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>{lang === 'bs' ? 'Oznaka' : 'Code'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.oznaka} onChange={e => updateField('oznaka', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Zahtjevana stručna sprema' : 'Required education'}</label>
                                    <select className="form-select" value={formData.strucnaSprema} onChange={e => updateField('strucnaSprema', e.target.value)}>
                                        <option value="">-</option>
                                        <option value="NKV">NKV</option><option value="PKV">PKV</option>
                                        <option value="KV">KV</option><option value="SSS">SSS</option>
                                        <option value="VŠS">VŠS</option><option value="VSS">VSS</option>
                                        <option value="MR">MR</option><option value="DR">DR</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Grupa RM' : 'Workplace Group'}</label>
                                    <input className="form-input" value={formData.grupaRM} onChange={e => updateField('grupaRM', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('orgUnit')}</label>
                                    <select className="form-select" value={formData.orgUnitId} onChange={e => updateField('orgUnitId', e.target.value)}>
                                        <option value="">-</option>
                                        {getAll(COLLECTIONS.ORG_UNITS).map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 24 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.radNaRacunalu} onChange={e => updateField('radNaRacunalu', e.target.checked)} />
                                        {lang === 'bs' ? 'Rad na računalu' : 'Computer work'}
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.posebniUvjetiRada} onChange={e => updateField('posebniUvjetiRada', e.target.checked)} />
                                        {lang === 'bs' ? 'Posebni uvjeti rada' : 'Special working conditions'}
                                    </label>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">{t('description')}</label>
                                    <textarea className="form-textarea" value={formData.opis || ''} onChange={e => updateField('opis', e.target.value)} rows={3} />
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
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={showActive} onChange={e => setShowActive(e.target.checked)} />
                            {lang === 'bs' ? 'Prikaži aktivne' : 'Show active'}
                        </label>
                        <div style={{ marginLeft: 'auto', position: 'relative' }}>
                            <button className="btn btn-dark btn-sm" onClick={() => {
                                const el = document.getElementById('group-action-menu');
                                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                            }}>{t('selectGroupAction')} ▼</button>
                            <div id="group-action-menu" className="dropdown-menu" style={{ display: 'none', right: 0, top: 'calc(100% + 4px)', minWidth: 200 }}>
                                <button className="dropdown-item" onClick={() => { alert(lang === 'bs' ? 'Grupna akcija: Generisanje dokumenata' : 'Group action: Generate documents'); }}>📄 {t('generateDocuments')}</button>
                                <button className="dropdown-item" onClick={() => { alert(lang === 'bs' ? 'Grupna akcija: Slanje obavijesti' : 'Group action: Send notifications'); }}>✉️ {t('sendNotifications')}</button>
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => { if (confirm(t('confirmDelete'))) alert(lang === 'bs' ? 'Grupno brisanje' : 'Group delete'); }}>🗑️ {t('delete')}</button>
                            </div>
                        </div>
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th>{t('name')} ↑</th>
                                    <th>{lang === 'bs' ? 'Stručna sprema' : 'Education'}</th>
                                    <th>{lang === 'bs' ? 'Grupa RM' : 'WP Group'}</th>
                                    <th>{lang === 'bs' ? 'Radnici' : 'Workers'}</th>
                                    <th><input type="checkbox" /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : filtered.map((w) => (
                                    <tr key={w.id}>
                                        <td style={{ position: 'relative' }} ref={actionMenuId === w.id ? actionRef : null}>
                                            <button className="btn btn-primary btn-sm" onClick={() => setActionMenuId(actionMenuId === w.id ? null : w.id)}>
                                                {t('actions')} ▼
                                            </button>
                                            {actionMenuId === w.id && (
                                                <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0 }}>
                                                    <button className="dropdown-item" onClick={() => handleEdit(w)}>📂 {t('open')}</button>
                                                    <div className="dropdown-divider" />
                                                    <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(w.id)}>🗑️ {t('delete')}</button>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{w.naziv}</td>
                                        <td>{w.strucnaSprema || '-'}</td>
                                        <td>{w.grupaRM || '-'}</td>
                                        <td><span className="badge badge-info">{getWorkersInWorkplace(w.id).length}</span></td>
                                        <td><input type="checkbox" /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: '0.85rem' }}>
                        <a href="#" style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'Popis zahtjevane zaštitne opreme' : 'Required PPE list'}</a>
                        <a href="#" style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'Popis zahtjevane zaštitne opreme po radnom mjestu' : 'Required PPE by workplace'}</a>
                    </div>

                    <div className="pagination" style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            1 - {filtered.length} {t('of')} {filtered.length} {t('records')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
