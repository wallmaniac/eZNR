'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS,
    getChildOrgUnits, getWorkersInOrgUnit, getById,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useSortedList } from '@/hooks/useSortedList';

const emptyOU = {
    naziv: '', skraceniNaziv: '', parentId: null,
    mjesto: '', ulica: '', kucniBroj: '',
    tip: '', mjestroTroska: '', odgovornaOsoba: '',
    grupaOrgJed: '', odabraniLijecnik: '',
};

export default function OrgUnitsPage() {
    const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
    const router = useRouter();
    const [units, setUnits] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyOU });
    const [searchTerm, setSearchTerm] = useState('');
    const [actionMenuId, setActionMenuId] = useState(null);
    const actionRef = useRef(null);

    // Workers panel state
    const [workersPanel, setWorkersPanel] = useState(null); // { id, naziv }
    const [viewWorkerId, setViewWorkerId] = useState(null);

    const loadData = useCallback(() => {
        setUnits(getAll(COLLECTIONS.ORG_UNITS));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        const handleClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // ── Tree hierarchy sort ────────────────────────────────────────────────────
    const [sortField, setSortField] = useState('naziv');
    const [sortDir, setSortDir] = useState('asc');

    const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };
    const sortIcon = (field) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    const thStyle = (field) => ({ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: sortField === field ? 'var(--primary)' : undefined });

    // Build depth-first flat list preserving parent → child order
    const buildTree = (allUnits, parentId, depth) => {
        const matchSearch = (u) => !searchTerm || u.naziv.toLowerCase().includes(searchTerm.toLowerCase());
        let children = allUnits.filter(u => (u.parentId || null) === (parentId || null));
        children = [...children].sort((a, b) => {
            const av = (a[sortField] || '').toString().toLowerCase();
            const bv = (b[sortField] || '').toString().toLowerCase();
            const cmp = av.localeCompare(bv, 'hr', { sensitivity: 'base' });
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return children.flatMap(u => {
            const descendants = buildTree(allUnits, u.id, depth + 1);
            if (!matchSearch(u) && descendants.length === 0) return [];
            return [{ ...u, _depth: depth }, ...descendants];
        });
    };
    const treeUnits = buildTree(units, null, 0);

    const getParentName = (id) => {
        const parent = units.find(u => u.id === id);
        return parent ? parent.naziv : '-';
    };

    const getWorkersForUnit = (unitId) =>
        workers.filter(w => w.aktivan !== false && (w.orgJedinicaId === unitId || w.orgJedinica === unitId));

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

    const handleDelete = async (id) => {
        const children = getChildOrgUnits(id);
        if (children.length > 0) {
            await alert(lang === 'bs' ? 'Ne možete obrisati org. jedinicu koja ima podorganizacije.' : 'Cannot delete org. unit with child units.');
            return;
        }
        const unitWorkers = getWorkersInOrgUnit(id);
        if (unitWorkers.length > 0) {
            await alert(lang === 'bs' ? 'Ne možete obrisati org. jedinicu koja ima zaposlenike.' : 'Cannot delete org. unit with employees.');
            return;
        }
        if (confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?')) {
            remove(COLLECTIONS.ORG_UNITS, id);
            setActionMenuId(null);
            loadData();
        }
    };

    const handleSave = async () => {
        if (!formData.naziv || !formData.skraceniNaziv) {
            await alert(lang === 'bs' ? 'Naziv i skraćeni naziv su obavezna polja!' : 'Name and short name are required!');
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

    const openWorkersPanel = (unit) => {
        setWorkersPanel(unit);
        setActionMenuId(null);
    };

    const panelWorkers = workersPanel ? getWorkersForUnit(workersPanel.id) : [];

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                🏢 {t('orgUnits')}
            </h1>

            {/* Workers Panel Modal */}
            {workersPanel && (
                <div className="modal-overlay" onClick={() => setWorkersPanel(null)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>👥 {lang === 'bs' ? 'Radnici' : 'Workers'} — {workersPanel.naziv}</h2>
                                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                                    {panelWorkers.length} {lang === 'bs' ? 'zaposlenih' : 'employees'}
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setWorkersPanel(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: 0, maxHeight: 480, overflowY: 'auto' }}>
                            {panelWorkers.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {lang === 'bs' ? 'Nema zaposlenika u ovoj organizacijskoj jedinici.' : 'No employees in this organizational unit.'}
                                </div>
                            ) : panelWorkers.map((w, idx) => {
                                const workplaces = getAll(COLLECTIONS.WORKPLACES);
                                const wp = workplaces.find(p => p.id === w.radnoMjestoId);
                                return (
                                    <div key={w.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: '12px 20px',
                                            borderBottom: idx < panelWorkers.length - 1 ? '1px solid var(--border-light)' : 'none',
                                            cursor: 'pointer',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => { setViewWorkerId(w.id); }}
                                    >
                                        <div style={{
                                            width: 42, height: 42, borderRadius: '50%',
                                            background: 'linear-gradient(135deg, var(--primary), #4CAF50)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                                        }}>
                                            {w.ime?.[0]}{w.prezime?.[0]}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>
                                                {w.ime} {w.prezime}
                                            </div>
                                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                {wp ? wp.naziv : (lang === 'bs' ? 'Bez radnog mjesta' : 'No workplace')}
                                                {w.evidencijskiBroj ? ` · Ev.br: ${w.evidencijskiBroj}` : ''}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                                            {lang === 'bs' ? 'Otvori →' : 'Open →'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setWorkersPanel(null)}>{lang === 'bs' ? 'Zatvori' : 'Close'}</button>
                            <button className="btn btn-primary" onClick={() => { setWorkersPanel(null); router.push('/dashboard/workers'); }}>
                                👥 {lang === 'bs' ? 'Svi radnici' : 'All workers'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Worker Profile Modal */}
            {viewWorkerId && (
                <WorkerProfileModal
                    workerId={viewWorkerId}
                    onClose={() => setViewWorkerId(null)}
                    onSaved={() => { loadData(); setViewWorkerId(null); }}
                />
            )}

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
                                    <th style={thStyle('naziv')} onClick={() => toggleSort('naziv')}>{t('name')}{sortIcon('naziv')}</th>
                                    <th style={thStyle('skraceniNaziv')} onClick={() => toggleSort('skraceniNaziv')}>{lang === 'bs' ? 'Skraćeni' : 'Short'}{sortIcon('skraceniNaziv')}</th>
                                    <th>{lang === 'bs' ? 'Nadređena' : 'Parent'}</th>
                                    <th style={thStyle('mjesto')} onClick={() => toggleSort('mjesto')}>{t('place')}{sortIcon('mjesto')}</th>
                                    <th>{lang === 'bs' ? 'Radnici' : 'Workers'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {treeUnits.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : (
                                    treeUnits.map((u) => {
                                        const count = getWorkersInOrgUnit(u.id).length;
                                        return (
                                            <tr key={u.id}>
                                                <td style={{ position: 'relative' }} ref={actionMenuId === u.id ? actionRef : null}>
                                                    <button className="btn btn-primary btn-sm"
                                                        onClick={() => setActionMenuId(actionMenuId === u.id ? null : u.id)}>
                                                        {t('actions')} ▼
                                                    </button>
                                                    {actionMenuId === u.id && (
                                                        <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 220 }}>
                                                            <button className="dropdown-item" onClick={() => handleEdit(u)}>📂 {t('open')}</button>
                                                            <button className="dropdown-item" onClick={() => openWorkersPanel(u)}>👥 {lang === 'bs' ? 'Pregled zaposlenih' : 'View employees'}</button>
                                                            <button className="dropdown-item" onClick={() => handleNew(u.id)}>➕ {lang === 'bs' ? 'Dodaj podorganizaciju' : 'Add sub-unit'}</button>
                                                            <div className="dropdown-divider" />
                                                            <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(u.id)}>🗑️ {t('delete')}</button>
                                                        </div>
                                                    )}
                                                </td>
                                                {/* Clickable name */}
                                                <td style={{ fontWeight: 600, paddingLeft: u.parentId ? 24 : 0 }}>
                                                    <button
                                                        onClick={() => openWorkersPanel(u)}
                                                        style={{
                                                            background: 'none', border: 'none', cursor: 'pointer',
                                                            color: 'var(--text)', fontWeight: 600, fontSize: 'inherit',
                                                            textAlign: 'left', padding: 0, fontFamily: 'inherit',
                                                            textDecoration: 'underline', textDecorationStyle: 'dotted',
                                                            textDecorationColor: 'var(--text-muted)',
                                                        }}
                                                        title={lang === 'bs' ? 'Klikni za pregled radnika' : 'Click to view workers'}
                                                    >
                                                        {u._depth > 0 ? (
                                                <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>
                                                    {'│  '.repeat(u._depth - 1)}{'└ '}
                                                </span>
                                            ) : null}
                                            <span style={{ fontWeight: u._depth === 0 ? 700 : 500 }}>{u.naziv}</span>
                                                    </button>
                                                </td>
                                                <td>{u.skraceniNaziv}</td>
                                                <td>{getParentName(u.parentId)}</td>
                                                <td>{u.mjesto}</td>
                                                {/* Clickable badge */}
                                                <td>
                                                    <button
                                                        onClick={() => openWorkersPanel(u)}
                                                        style={{
                                                            background: 'none', border: 'none', cursor: count > 0 ? 'pointer' : 'default',
                                                            padding: 0,
                                                        }}
                                                        title={count > 0 ? (lang === 'bs' ? 'Klikni za pregled radnika' : 'Click to view workers') : ''}
                                                    >
                                                        <span className={`badge ${count > 0 ? 'badge-primary' : 'badge-info'}`}
                                                            style={{
                                                                cursor: count > 0 ? 'pointer' : 'default',
                                                                transition: 'transform 0.15s',
                                                            }}
                                                            onMouseEnter={e => count > 0 && (e.target.style.transform = 'scale(1.1)')}
                                                            onMouseLeave={e => (e.target.style.transform = 'scale(1)')}
                                                        >
                                                            {count} {count > 0 ? '👁' : ''}
                                                        </span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
