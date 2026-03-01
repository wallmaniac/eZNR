'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS,
    getChildOrgUnits, getWorkersInOrgUnit, getById,
} from '@/lib/dataStore';

const emptyOU = {
    naziv: '', skraceniNaziv: '', parentId: null,
    mjesto: '', ulica: '', kucniBroj: '',
    tip: '', mjestroTroska: '', odgovornaOsoba: '',
    grupaOrgJed: '', odabraniLijecnik: '',
};

export default function OrgUnitsPage() {
    const { t, lang } = useLanguage();
    const [units, setUnits] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyOU });
    const [searchTerm, setSearchTerm] = useState('');
    const [actionMenuId, setActionMenuId] = useState(null);
    const actionRef = useRef(null);

    const loadData = useCallback(() => {
        setUnits(getAll(COLLECTIONS.ORG_UNITS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        const handleClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filteredUnits = units.filter(u =>
        !searchTerm || u.naziv.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getParentName = (id) => {
        const parent = units.find(u => u.id === id);
        return parent ? parent.naziv : '-';
    };

    const handleNew = (parentId = null) => {
        setFormData({ ...emptyOU, parentId });
        setEditingId(null);
        setShowForm(true);
        setActionMenuId(null);
    };

    const handleEdit = (unit) => {
        setFormData({ ...unit });
        setEditingId(unit.id);
        setShowForm(true);
        setActionMenuId(null);
    };

    const handleDelete = (id) => {
        const children = getChildOrgUnits(id);
        if (children.length > 0) {
            alert(lang === 'bs' ? 'Ne možete obrisati org. jedinicu koja ima podorganizacije.' : 'Cannot delete org. unit with child units.');
            return;
        }
        const workers = getWorkersInOrgUnit(id);
        if (workers.length > 0) {
            alert(lang === 'bs' ? 'Ne možete obrisati org. jedinicu koja ima zaposlenike.' : 'Cannot delete org. unit with employees.');
            return;
        }
        if (confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?')) {
            remove(COLLECTIONS.ORG_UNITS, id);
            setActionMenuId(null);
            loadData();
        }
    };

    const handleSave = () => {
        if (!formData.naziv || !formData.skraceniNaziv) {
            alert(lang === 'bs' ? 'Naziv i skraćeni naziv su obavezna polja!' : 'Name and short name are required!');
            return;
        }
        if (editingId) {
            update(COLLECTIONS.ORG_UNITS, editingId, formData);
        } else {
            create(COLLECTIONS.ORG_UNITS, formData);
        }
        setShowForm(false);
        loadData();
    };

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                🏢 {t('orgUnits')}
            </h1>

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? (lang === 'bs' ? '✏️ Uredi organizacijsku jedinicu' : '✏️ Edit Organizational Unit')
                                : (lang === 'bs' ? '+ Nova organizacijska jedinica' : '+ New Organizational Unit')}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={e => updateField('naziv', e.target.value)} placeholder={t('mandatory')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>{lang === 'bs' ? 'Skraćeni naziv' : 'Short name'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.skraceniNaziv} onChange={e => updateField('skraceniNaziv', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('place')}</label>
                                    <select className="form-select" value={formData.mjesto} onChange={e => updateField('mjesto', e.target.value)}>
                                        <option value="">-- {t('place')} --</option>
                                        {getAll(COLLECTIONS.PLACES).map(p => <option key={p.id} value={p.naziv}>{p.naziv} ({p.postBroj})</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Nadređena org. jedinica' : 'Parent Unit'}</label>
                                    <select className="form-select" value={formData.parentId || ''} onChange={e => updateField('parentId', e.target.value || null)}>
                                        <option value="">-</option>
                                        {units.filter(u => u.id !== editingId).map(u => <option key={u.id} value={u.id}>{u.naziv}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('street')}</label>
                                    <input className="form-input" value={formData.ulica} onChange={e => updateField('ulica', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('houseNumber')}</label>
                                    <input className="form-input" value={formData.kucniBroj} onChange={e => updateField('kucniBroj', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Tip' : 'Type'}</label>
                                    <input className="form-input" value={formData.tip} onChange={e => updateField('tip', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Mjesto troška' : 'Cost center'}</label>
                                    <input className="form-input" value={formData.mjestroTroska} onChange={e => updateField('mjestroTroska', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Odgovorna osoba' : 'Responsible person'}</label>
                                    <input className="form-input" value={formData.odgovornaOsoba} onChange={e => updateField('odgovornaOsoba', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Odabrani liječnik' : 'Selected doctor'}</label>
                                    <select className="form-select" value={formData.odabraniLijecnik} onChange={e => updateField('odabraniLijecnik', e.target.value)}>
                                        <option value="">-</option>
                                        {getAll(COLLECTIONS.DOCTORS).map(d => <option key={d.id} value={d.id}>{d.ime}</option>)}
                                    </select>
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

            {/* List */}
            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleNew()}>+ {t('add')}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                            <input
                                placeholder={t('searchBtn') + '...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
                            />
                            <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                        </div>
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th>{t('name')} ↑</th>
                                    <th>{lang === 'bs' ? 'Skraćeni' : 'Short'}</th>
                                    <th>{lang === 'bs' ? 'Nadređena' : 'Parent'}</th>
                                    <th>{t('place')}</th>
                                    <th>{lang === 'bs' ? 'Radnici' : 'Workers'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUnits.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : (
                                    filteredUnits.map((u) => (
                                        <tr key={u.id}>
                                            <td style={{ position: 'relative' }} ref={actionMenuId === u.id ? actionRef : null}>
                                                <button className="btn btn-primary btn-sm"
                                                    onClick={() => setActionMenuId(actionMenuId === u.id ? null : u.id)}>
                                                    {t('actions')} ▼
                                                </button>
                                                {actionMenuId === u.id && (
                                                    <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 220 }}>
                                                        <button className="dropdown-item" onClick={() => handleEdit(u)}>📂 {t('open')}</button>
                                                        <button className="dropdown-item" onClick={() => handleNew(u.id)}>➕ {lang === 'bs' ? 'Dodaj podorganizaciju' : 'Add sub-unit'}</button>
                                                        <button className="dropdown-item">👥 {lang === 'bs' ? 'Pregled zaposlenih' : 'View employees'}</button>
                                                        <div className="dropdown-divider" />
                                                        <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(u.id)}>🗑️ {t('delete')}</button>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600, paddingLeft: u.parentId ? 24 : 0 }}>
                                                {u.parentId ? '└ ' : ''}{u.naziv}
                                            </td>
                                            <td>{u.skraceniNaziv}</td>
                                            <td>{getParentName(u.parentId)}</td>
                                            <td>{u.mjesto}</td>
                                            <td><span className="badge badge-info">{getWorkersInOrgUnit(u.id).length}</span></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
