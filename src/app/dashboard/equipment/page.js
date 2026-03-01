'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS,
    getOrgUnitName, formatDate,
} from '@/lib/dataStore';

const emptyEQ = {
    naziv: '', vrsta: '', tip: '', tvBroj: '', invBroj: '',
    orgJedinicaId: '', zaduzenOsoba: '', datumUpisa: '', uPrimjeniOd: '',
    izvanUpotrebeOd: '', evidencijskiBroj: '', brojMjernihMjesta: 0,
    proizvodjac: '', godinaProizvodnje: '', posljednji: '', iduci: '', status: 'active',
};

export default function EquipmentPage() {
    const { t, lang } = useLanguage();
    const [items, setItems] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyEQ });
    const [searchTerm, setSearchTerm] = useState('');
    const [showOutOfUse, setShowOutOfUse] = useState(false);
    const [actionMenuId, setActionMenuId] = useState(null);
    const actionRef = useRef(null);

    const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.EQUIPMENT)); }, []);
    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => {
        const handleClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filtered = items.filter(eq => {
        const matchSearch = !searchTerm || eq.naziv.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = showOutOfUse ? !!eq.izvanUpotrebeOd : !eq.izvanUpotrebeOd;
        return matchSearch && matchStatus;
    });

    const equipmentTypes = getAll(COLLECTIONS.EQUIPMENT_TYPES);
    const orgUnits = getAll(COLLECTIONS.ORG_UNITS);

    const handleNew = () => { setFormData({ ...emptyEQ }); setEditingId(null); setShowForm(true); };
    const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); setActionMenuId(null); };
    const handleDelete = (id) => {
        if (confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?')) { remove(COLLECTIONS.EQUIPMENT, id); setActionMenuId(null); loadData(); }
    };
    const handleSave = () => {
        if (!formData.naziv) { alert(lang === 'bs' ? 'Naziv je obavezno polje!' : 'Name is required!'); return; }
        if (editingId) { update(COLLECTIONS.EQUIPMENT, editingId, formData); } else { create(COLLECTIONS.EQUIPMENT, formData); }
        setShowForm(false); loadData();
    };
    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>⚙️ {t('equipment')}</h1>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '✏️' : '+'} {lang === 'bs' ? 'Radna oprema / objekt' : 'Equipment / Object'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={e => updateField('naziv', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Proizvođač' : 'Manufacturer'}</label>
                                    <input className="form-input" value={formData.proizvodjac} onChange={e => updateField('proizvodjac', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Vrsta' : 'Type'}</label>
                                    <select className="form-select" value={formData.vrsta} onChange={e => updateField('vrsta', e.target.value)}>
                                        <option value="">-</option>
                                        {equipmentTypes.map(et => <option key={et.id} value={et.naziv}>{et.naziv}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Tip/Model' : 'Model'}</label>
                                    <input className="form-input" value={formData.tip} onChange={e => updateField('tip', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Tv. broj' : 'Serial no.'}</label>
                                    <input className="form-input" value={formData.tvBroj} onChange={e => updateField('tvBroj', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Inv. broj' : 'Inventory no.'}</label>
                                    <input className="form-input" value={formData.invBroj} onChange={e => updateField('invBroj', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Godina proizvodnje' : 'Year of production'}</label>
                                    <input className="form-input" value={formData.godinaProizvodnje} onChange={e => updateField('godinaProizvodnje', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('orgUnit')}</label>
                                    <select className="form-select" value={formData.orgJedinicaId} onChange={e => updateField('orgJedinicaId', e.target.value)}>
                                        <option value="">-</option>
                                        {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Zadužena osoba' : 'Responsible person'}</label>
                                    <input className="form-input" value={formData.zaduzenOsoba} onChange={e => updateField('zaduzenOsoba', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Datum upisa' : 'Entry date'}</label>
                                    <input className="form-input" type="date" value={formData.datumUpisa} onChange={e => updateField('datumUpisa', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'U primjeni od' : 'In use from'}</label>
                                    <input className="form-input" type="date" value={formData.uPrimjeniOd} onChange={e => updateField('uPrimjeniOd', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Izvan upotrebe od' : 'Out of use from'}</label>
                                    <input className="form-input" type="date" value={formData.izvanUpotrebeOd} onChange={e => updateField('izvanUpotrebeOd', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('evidenceNumber')}</label>
                                    <input className="form-input" value={formData.evidencijskiBroj} onChange={e => updateField('evidencijskiBroj', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Broj mjernih mjesta' : 'No. of measuring points'}</label>
                                    <input className="form-input" type="number" value={formData.brojMjernihMjesta} onChange={e => updateField('brojMjernihMjesta', Number(e.target.value))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Posljednji pregled' : 'Last examination'}</label>
                                    <input className="form-input" type="date" value={formData.posljednji} onChange={e => updateField('posljednji', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Idući pregled' : 'Next examination'}</label>
                                    <input className="form-input" type="date" value={formData.iduci} onChange={e => updateField('iduci', e.target.value)} />
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
                            <input type="checkbox" checked={showOutOfUse} onChange={e => setShowOutOfUse(e.target.checked)} />
                            {lang === 'bs' ? 'Radna oprema izvan upotrebe' : 'Out of use equipment'}
                        </label>
                        <div style={{ marginLeft: 'auto', position: 'relative' }}>
                            <button className="btn btn-dark btn-sm" onClick={() => {
                                const el = document.getElementById('group-action-menu-eq');
                                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                            }}>{t('selectGroupAction')} ▼</button>
                            <div id="group-action-menu-eq" className="dropdown-menu" style={{ display: 'none', right: 0, top: 'calc(100% + 4px)', minWidth: 200 }}>
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
                                    <th>{lang === 'bs' ? 'Vrsta' : 'Type'}</th>
                                    <th>{t('name')} ↑</th>
                                    <th>{lang === 'bs' ? 'Tv. broj' : 'Serial'}</th>
                                    <th>{lang === 'bs' ? 'Inv. broj' : 'Inv.'}</th>
                                    <th>{lang === 'bs' ? 'Org.' : 'Org.'}</th>
                                    <th>{lang === 'bs' ? 'Posljednji' : 'Last'}</th>
                                    <th>{lang === 'bs' ? 'Iduci' : 'Next'}</th>
                                    <th><input type="checkbox" /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : filtered.map((eq) => {
                                    const isExpired = eq.iduci && new Date(eq.iduci) < new Date();
                                    return (
                                        <tr key={eq.id}>
                                            <td style={{ position: 'relative' }} ref={actionMenuId === eq.id ? actionRef : null}>
                                                <button className="btn btn-primary btn-sm" onClick={() => setActionMenuId(actionMenuId === eq.id ? null : eq.id)}>
                                                    {t('actions')} ▼
                                                </button>
                                                {actionMenuId === eq.id && (
                                                    <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0 }}>
                                                        <button className="dropdown-item" onClick={() => handleEdit(eq)}>📂 {t('open')}</button>
                                                        <div className="dropdown-divider" />
                                                        <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(eq.id)}>🗑️ {t('delete')}</button>
                                                    </div>
                                                )}
                                            </td>
                                            <td>{eq.vrsta}</td>
                                            <td style={{ fontWeight: 600 }}>{eq.naziv}</td>
                                            <td><code>{eq.tvBroj}</code></td>
                                            <td>{eq.invBroj}</td>
                                            <td>{getOrgUnitName(eq.orgJedinicaId)}</td>
                                            <td>{formatDate(eq.posljednji)}</td>
                                            <td style={{ color: isExpired ? 'var(--danger)' : undefined, fontWeight: isExpired ? 700 : undefined }}>{formatDate(eq.iduci)}</td>
                                            <td><input type="checkbox" /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
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
