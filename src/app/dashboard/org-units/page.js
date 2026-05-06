'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS,
    getChildOrgUnits, getWorkersInOrgUnit,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useSortedList } from '@/hooks/useSortedList';
import PageHeader from '@/components/PageHeader';

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
    const [showRespMenu, setShowRespMenu] = useState(false);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, maxH: 300 });
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Workers panel state
    const [workersPanel, setWorkersPanel] = useState(null);
    const [viewWorkerId, setViewWorkerId] = useState(null);

    const loadData = useCallback(() => {
        setUnits(getAll(COLLECTIONS.ORG_UNITS));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

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

    // Selection helpers
    const toggleAll = () => {
        const allIds = new Set(treeUnits.map(u => u.id));
        setSelectedIds(prev => prev.size === treeUnits.length ? new Set() : allIds);
    };
    const toggleOne = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        const ok = await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} org. jedinica?` : `Delete ${selectedIds.size} org. units?`);
        if (ok) {
            for (const id of selectedIds) remove(COLLECTIONS.ORG_UNITS, id);
            setSelectedIds(new Set());
            loadData();
        }
    };

    const getParentName = (id) => {
        const parent = units.find(u => u.id === id);
        return parent ? parent.naziv : '-';
    };

    const getWorkersForUnit = (unitId) =>
        workers.filter(w => w.aktivan !== false && (w.orgJedinicaId === unitId || w.orgJedinica === unitId));

    const handleNew = (parentId = null) => {
        setFormData({ ...emptyOU, parentId, workplaceIds: [], childUnitIds: [] });
        setEditingId(null);
        setShowForm(true);
        setActionMenuId(null);
    };

    const handleEdit = (unit) => {
        const wpIds = getAll(COLLECTIONS.WORKPLACES).filter(w => w.orgUnitId === unit.id).map(w => w.id);
        const chIds = getAll(COLLECTIONS.ORG_UNITS).filter(u => u.parentId === unit.id).map(u => u.id);
        setFormData({ ...unit, workplaceIds: wpIds, childUnitIds: chIds });
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
        const ok = await confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?');
        if (ok) {
            remove(COLLECTIONS.ORG_UNITS, id);
            setActionMenuId(null);
            loadData();
        }
    };

    const handleSave = async () => {
        if (!formData.naziv) {
            await alert(lang === 'bs' ? 'Naziv je obavezno polje!' : 'Name is a required field!');
            return;
        }
        let savedId = editingId;
        if (editingId) {
            update(COLLECTIONS.ORG_UNITS, editingId, formData);
        } else {
            const newDoc = create(COLLECTIONS.ORG_UNITS, formData);
            savedId = newDoc.id;
        }

        const selectedWpIds = formData.workplaceIds || [];
        getAll(COLLECTIONS.WORKPLACES).forEach(wp => {
            if (selectedWpIds.includes(wp.id) && wp.orgUnitId !== savedId) {
                update(COLLECTIONS.WORKPLACES, wp.id, { ...wp, orgUnitId: savedId });
            } else if (!selectedWpIds.includes(wp.id) && wp.orgUnitId === savedId) {
                update(COLLECTIONS.WORKPLACES, wp.id, { ...wp, orgUnitId: '' });
            }
        });
        
        const selectedChIds = formData.childUnitIds || [];
        getAll(COLLECTIONS.ORG_UNITS).forEach(ou => {
            if (selectedChIds.includes(ou.id) && ou.parentId !== savedId) {
                update(COLLECTIONS.ORG_UNITS, ou.id, { ...ou, parentId: savedId });
            } else if (!selectedChIds.includes(ou.id) && ou.parentId === savedId) {
                update(COLLECTIONS.ORG_UNITS, ou.id, { ...ou, parentId: null });
            }
        });
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

    const menuItemSt = {
        display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
        color: 'var(--text)', fontFamily: 'var(--font-body)', transition: 'background 0.12s',
    };

    return (
        <div className="animate-fadeIn">
            <PageHeader icon="🏢" title={lang === 'bs' ? 'Organizacijske jedinice' : 'Organizational Units'} />

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
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={e => updateField('naziv', e.target.value)} placeholder={t('mandatory')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Skraćeni naziv (opcionalno)' : 'Short name (optional)'}</label>
                                    <input className="form-input" value={formData.skraceniNaziv} onChange={e => updateField('skraceniNaziv', e.target.value)} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">{lang === 'bs' ? 'Radna mjesta u ovoj org. jedinici' : 'Workplaces in this org. unit'}</label>
                                    <div style={{ maxHeight: 180, overflowY: 'auto', background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 8 }}>
                                        {getAll(COLLECTIONS.WORKPLACES).map(w => (
                                            <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                                                <input type="checkbox" checked={(formData.workplaceIds || []).includes(w.id)} onChange={e => {
                                                    const current = new Set(formData.workplaceIds || []);
                                                    if (e.target.checked) current.add(w.id); else current.delete(w.id);
                                                    updateField('workplaceIds', Array.from(current));
                                                }} />
                                                <span style={{ fontSize: '0.85rem' }}>{w.naziv}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">{lang === 'bs' ? 'Podređene org. jedinice' : 'Child org. units'}</label>
                                    <div style={{ maxHeight: 180, overflowY: 'auto', background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 8 }}>
                                        {getAll(COLLECTIONS.ORG_UNITS).filter(u => u.id !== editingId).map(u => (
                                            <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                                                <input type="checkbox" checked={(formData.childUnitIds || []).includes(u.id)} onChange={e => {
                                                    const current = new Set(formData.childUnitIds || []);
                                                    if (e.target.checked) current.add(u.id); else current.delete(u.id);
                                                    updateField('childUnitIds', Array.from(current));
                                                }} />
                                                <span style={{ fontSize: '0.85rem' }}>{u.naziv}</span>
                                            </label>
                                        ))}
                                    </div>
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
                                <div className="form-group" style={{ position: 'relative' }}>
                                    <label className="form-label">{lang === 'bs' ? 'Odgovorna osoba' : 'Responsible person'}</label>
                                    <input className="form-input" value={formData.odgovornaOsoba} onChange={e => { updateField('odgovornaOsoba', e.target.value); setShowRespMenu(true); }} onFocus={() => setShowRespMenu(true)} onBlur={() => setTimeout(() => setShowRespMenu(false), 200)} placeholder={lang === 'bs' ? 'Upiši ime za pretragu...' : 'Search by name...'} />
                                    {showRespMenu && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 180, overflowY: 'auto', borderRadius: 'var(--radius-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                            {workers.filter(w => `${w.ime} ${w.prezime}`.toLowerCase().includes((formData.odgovornaOsoba || '').toLowerCase())).map(w => (
                                                <div key={w.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid var(--border-light)' }} onMouseDown={() => { updateField('odgovornaOsoba', `${w.ime} ${w.prezime}`); setShowRespMenu(false); }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    {w.ime} {w.prezime} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: 6 }}>({getAll(COLLECTIONS.WORKPLACES).find(x => x.id === w.radnoMjestoId)?.naziv || ''})</span>
                                                </div>
                                            ))}
                                            {workers.filter(w => `${w.ime} ${w.prezime}`.toLowerCase().includes((formData.odgovornaOsoba || '').toLowerCase())).length === 0 && (
                                                <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Nema rezultata' : 'No results'}</div>
                                            )}
                                        </div>
                                    )}
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
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={() => handleNew()} title={lang === 'bs' ? 'Dodaj novog organizacijsku jedinicu' : 'Add new org unit'}>+ {lang === 'bs' ? 'Nova org. jedinica' : 'New Org Unit'}</button>
                        <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                            <input
                                placeholder={t('searchBtn') + '...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%', minWidth: 0 }}
                            />
                            {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title={lang === 'bs' ? 'Poništi pretragu' : 'Clear search'}>✕</button>}
                        </div>
                        {selectedIds.size > 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'}:
                                </span>
                                <button className="btn btn-primary" style={{ height: 38 }} onClick={() => window.print()}>🖨️ {lang === 'bs' ? 'Isprintaj' : 'Print'}</button>
                                <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                            </div>
                        )}
                        {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}></span>}
                    </div>

                    <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === treeUnits.length && treeUnits.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th style={thStyle('naziv')} onClick={() => toggleSort('naziv')}>{t('name')}{sortIcon('naziv')}</th>
                                    <th style={thStyle('skraceniNaziv')} onClick={() => toggleSort('skraceniNaziv')}>{lang === 'bs' ? 'Skraćeni' : 'Short'}{sortIcon('skraceniNaziv')}</th>
                                    <th>{lang === 'bs' ? 'Nadređena' : 'Parent'}</th>
                                    <th style={thStyle('mjesto')} onClick={() => toggleSort('mjesto')}>{t('place')}{sortIcon('mjesto')}</th>
                                    <th style={thStyle('odgovornaOsoba')} onClick={() => toggleSort('odgovornaOsoba')}>{lang === 'bs' ? 'Odgovorna osoba' : 'Resp. Person'}{sortIcon('odgovornaOsoba')}</th>
                                    <th>{lang === 'bs' ? 'Radnici' : 'Workers'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {treeUnits.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : (
                                    treeUnits.map((u) => {
                                        const count = getWorkersInOrgUnit(u.id).length;
                                        return (
                                            <tr key={u.id} onClick={() => handleEdit(u)} style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                    <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleOne(u.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                                                </td>
                                                <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                                                    <button className="btn btn-primary btn-sm" onClick={e => {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const spaceBelow = window.innerHeight - rect.bottom;
                                                        const spaceAbove = rect.top;
                                                        const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
                                                        setMenuPos(flipUp
                                                            ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                                                            : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                                                        );
                                                        setActionMenuId(actionMenuId === u.id ? null : u.id);
                                                    }} title={lang === 'bs' ? 'Prikaži akcije za jedinicu' : 'Show unit actions'}>
                                                        {t('actions')} ▼
                                                    </button>
                                                    {actionMenuId === u.id && (
                                                        <>
                                                        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setActionMenuId(null)} />
                                                        <div data-menu style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                            <button onClick={() => handleEdit(u)} style={menuItemSt}>📂 {t('open')}</button>
                                                            <button onClick={() => openWorkersPanel(u)} style={menuItemSt}>👥 {lang === 'bs' ? 'Pregled zaposlenih' : 'View employees'}</button>
                                                            <button onClick={() => handleNew(u.id)} style={menuItemSt}>➕ {lang === 'bs' ? 'Dodaj podorganizaciju' : 'Add sub-unit'}</button>
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <button onClick={() => { setActionMenuId(null); handleDelete(u.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ {t('delete')}</button>
                                                        </div>
                                                        </>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600, paddingLeft: u.parentId ? 24 : 0 }}>
                                                    {u._depth > 0 ? (
                                                        <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>
                                                            {'│  '.repeat(u._depth - 1)}{'└ '}
                                                        </span>
                                                    ) : null}
                                                    <span style={{ fontWeight: u._depth === 0 ? 700 : 500 }}>{u.naziv}</span>
                                                </td>
                                                <td>{u.skraceniNaziv}</td>
                                                <td>{getParentName(u.parentId)}</td>
                                                <td>{u.mjesto}</td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    {u.odgovornaOsoba ? (
                                                        <span style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline', textDecorationStyle: 'solid' }} onClick={() => {
                                                            const w = workers.find(x => `${x.ime} ${x.prezime}` === u.odgovornaOsoba);
                                                            if (w) setViewWorkerId(w.id);
                                                            else alert(lang === 'bs' ? 'Radnik nije pronađen u bazi.' : 'Worker not found in database.');
                                                        }} title={lang === 'bs' ? 'Klikni za pregled profila' : 'View profile'}>
                                                            {u.odgovornaOsoba}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                {/* Clickable badge */}
                                                <td onClick={e => e.stopPropagation()}>
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
            <DialogRenderer />
        </div>
    );
}
