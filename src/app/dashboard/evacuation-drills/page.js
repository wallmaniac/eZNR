'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useSortedList } from '@/hooks/useSortedList';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import WorkerProfileModal from '@/components/WorkerProfileModal';

const EMPTY = {
    planId: '', datumVjezbe: '',
    vrijemePocetka: '', trajanjeMinuta: '',
    brojEvakuisanihOsoba: '',
    opisTokaVjezbe: '',
    uoceniNedostaci: '',
    korektivneMjere: '',
    odgovornaOsobaId: '', odgovornaOsobaIme: '',
    sudjelovaliVatrogasci: false,
    sudjelovalaHitna: false,
    napomena: '', status: 'uspješno',
};

const STATUS_MAP = {
    uspješno: { bs: 'Uspješno', en: 'Successful', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    djelimično: { bs: 'Djelimično uspješno', en: 'Partially Successful', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    neuspješno: { bs: 'Neuspješno', en: 'Failed', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

export default function EvacuationDrillsPage() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const { markDirty, markClean } = useUnsavedChanges();

    const [drills, setDrills] = useState([]);
    const [plans, setPlans] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [viewWorkerId, setViewWorkerId] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());

    const [workerSearch, setWorkerSearch] = useState('');
    const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
    const workerRef = useRef(null);

    const loadData = useCallback(() => {
        setDrills(getAll(COLLECTIONS.EVACUATION_DRILLS));
        setPlans(getAll(COLLECTIONS.EVACUATION_PLANS));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);
    useEffect(() => {
        const handler = (e) => { if (workerRef.current && !workerRef.current.contains(e.target)) setShowWorkerDropdown(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const set = (k, v) => { setFormData(f => ({ ...f, [k]: v })); markDirty(); };

    const filteredWorkers = workers.filter(w => {
        if (!workerSearch) return true;
        return `${w.ime} ${w.prezime}`.toLowerCase().includes(workerSearch.toLowerCase());
    });

    const handleWorkerSelect = (w) => {
        set('odgovornaOsobaId', w.id); set('odgovornaOsobaIme', `${w.ime} ${w.prezime}`);
        setWorkerSearch(`${w.ime} ${w.prezime}`); setShowWorkerDropdown(false);
    };

    // Stats
    const stats = {
        total: drills.length,
        successful: drills.filter(d => d.status === 'uspješno').length,
        failed: drills.filter(d => d.status === 'neuspješno').length,
        withEmergencyServices: drills.filter(d => d.sudjelovaliVatrogasci || d.sudjelovalaHitna).length,
    };

    const getPlanName = (id) => { const p = plans.find(x => x.id === id); return p ? p.lokacija : '—'; };

    const filtered = drills.filter(d => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (getPlanName(d.planId) || '').toLowerCase().includes(q) 
            || (d.odgovornaOsobaIme || '').toLowerCase().includes(q)
            || (d.datumVjezbe || '').includes(q);
    });

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datumVjezbe');

    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({});

    const openNew = () => { setEditingId(null); setFormData({ ...EMPTY }); setWorkerSearch(''); setShowForm(true); };
    const openEdit = (d) => { setEditingId(d.id); setFormData({ ...d }); setWorkerSearch(d.odgovornaOsobaIme || ''); setShowForm(true); };

    const handleSave = async () => {
        if (!formData.planId) { await alert(bs ? 'Plan evakuacije je obavezan!' : 'Evacuation Plan is required!'); return; }
        if (!formData.datumVjezbe) { await alert(bs ? 'Datum vježbe je obavezan!' : 'Drill Date is required!'); return; }
        if (editingId) { update(COLLECTIONS.EVACUATION_DRILLS, editingId, formData); }
        else { create(COLLECTIONS.EVACUATION_DRILLS, formData); }
        loadData(); markClean(); setShowForm(false); showFlash();
    };

    const handleDelete = async (id) => {
        if (await confirm(bs ? 'Obrisati ovu vježbu?' : 'Delete this drill?')) {
            remove(COLLECTIONS.EVACUATION_DRILLS, id); setActionMenuId(null); loadData();
        }
    };

    const toggleAll = (e) => { if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id))); else setSelectedIds(new Set()); };
    const toggleOne = (id) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(bs ? `Obrisati ${selectedIds.size} vježbi?` : `Delete ${selectedIds.size} drills?`)) {
            for (let id of selectedIds) remove(COLLECTIONS.EVACUATION_DRILLS, id);
            setSelectedIds(new Set()); loadData();
        }
    };

    const openMenu = (id, e) => {
        e.stopPropagation();
        if (actionMenuId === id) { setActionMenuId(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const flipUp = spaceBelow < 200;
        setMenuPos(flipUp
            ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, rect.top - 8) }
            : { top: rect.bottom + 4, left: rect.left, maxH: Math.max(120, spaceBelow) });
        setActionMenuId(id);
    };

    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    return (
        <>
            <div className="animate-fadeIn">
                <DialogRenderer />
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.6rem' }}>🏃</span>
                    <div>
                        <h1 style={{ margin: 0 }}>{bs ? 'Vježbe evakuacije' : 'Evacuation Drills'}</h1>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {bs ? 'Evidencija provođenja vježbi evakuacije i spašavanja' : 'Records of evacuation and rescue drills'}
                        </p>
                    </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20, marginTop: 16 }}>
                    {[
                        { label: bs ? 'Ukupno vježbi' : 'Total Drills', val: stats.total, icon: '🏃', color: 'var(--primary)' },
                        { label: bs ? 'Uspješno provedene' : 'Successfully Completed', val: stats.successful, icon: '✅', color: '#22C55E' },
                        { label: bs ? 'Neuspješne vježbe' : 'Failed Drills', val: stats.failed, icon: '🔴', color: '#EF4444' },
                        { label: bs ? 'Uz učešće žurnih službi' : 'With Emergency Svc.', val: stats.withEmergencyServices, icon: '🚒', color: '#6366F1' },
                    ].map((s, i) => (
                        <div key={i} className="card" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)', marginTop: 2 }}>{s.val}</div>
                                </div>
                                <span style={{ fontSize: '1.3rem' }}>{s.icon}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Form modal */}
                {showForm && (
                    <div className="modal-overlay" onClick={() => setShowForm(false)}>
                        <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{editingId ? '✏️' : '+'} {bs ? 'Vježba evakuacije' : 'Evacuation Drill'}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" style={{ fontWeight: 700 }}>{bs ? 'Plan evakuacije (Lokacija)' : 'Evacuation Plan (Location)'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                        <select className="form-select" value={formData.planId} onChange={e => set('planId', e.target.value)}>
                                            <option value="">—</option>
                                            {plans.map(p => <option key={p.id} value={p.id}>{p.lokacija}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700 }}>{bs ? 'Datum vježbe' : 'Drill Date'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                        <DateInput value={formData.datumVjezbe} onChange={v => set('datumVjezbe', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Vrijeme početka' : 'Start Time'}</label>
                                        <input className="form-input" type="time" pattern="[0-2][0-9]:[0-5][0-9]" step="60" value={formData.vrijemePocetka} onChange={e => set('vrijemePocetka', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Trajanje (minute)' : 'Duration (minutes)'}</label>
                                        <input className="form-input" type="number" value={formData.trajanjeMinuta} onChange={e => set('trajanjeMinuta', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Broj evakuiranih osoba' : 'No. of evacuated persons'}</label>
                                        <input className="form-input" type="number" value={formData.brojEvakuisanihOsoba} onChange={e => set('brojEvakuisanihOsoba', e.target.value)} />
                                    </div>

                                    {/* Responsible person */}
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }} ref={workerRef}>
                                        <label className="form-label">{bs ? 'Rukovodilac vježbe' : 'Drill Supervisor'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input className="form-input" placeholder={bs ? '🔍 Pretraži...' : '🔍 Search...'} value={workerSearch}
                                                onChange={e => { setWorkerSearch(e.target.value); setShowWorkerDropdown(true); set('odgovornaOsobaId', ''); set('odgovornaOsobaIme', ''); }}
                                                onFocus={() => setShowWorkerDropdown(true)} autoComplete="off" />
                                            {showWorkerDropdown && (
                                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                                                    {filteredWorkers.length === 0 ? (
                                                        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{bs ? 'Nema radnika' : 'No workers'}</div>
                                                    ) : filteredWorkers.slice(0, 15).map(w => (
                                                        <button key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            onClick={() => handleWorkerSelect(w)}>
                                                            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>{w.ime?.[0]}{w.prezime?.[0]}</span>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{w.ime} {w.prezime}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {formData.odgovornaOsobaId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {formData.odgovornaOsobaIme}</div>}
                                    </div>

                                    {/* Additional Services */}
                                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', marginTop: 4, paddingTop: 12 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>
                                            🚨 {bs ? 'Učešće hitnih službi' : 'Emergency Services Participation'}
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" checked={formData.sudjelovaliVatrogasci} onChange={e => set('sudjelovaliVatrogasci', e.target.checked)} style={{ cursor: 'pointer' }} id="chk-fire" />
                                        <label htmlFor="chk-fire" style={{ cursor: 'pointer', margin: 0, userSelect: 'none' }}>{bs ? 'Vatrogasci' : 'Fire Department'}</label>
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="checkbox" checked={formData.sudjelovalaHitna} onChange={e => set('sudjelovalaHitna', e.target.checked)} style={{ cursor: 'pointer' }} id="chk-med" />
                                        <label htmlFor="chk-med" style={{ cursor: 'pointer', margin: 0, userSelect: 'none' }}>{bs ? 'Hitna medicinska pomoć' : 'Ambulance'}</label>
                                    </div>

                                    {/* Textareas */}
                                    <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 4 }}>
                                        <label className="form-label">{bs ? 'Opis toka vježbe' : 'Drill Sequence Description'}</label>
                                        <textarea className="form-input" rows={3} value={formData.opisTokaVjezbe} onChange={e => set('opisTokaVjezbe', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Uočeni nedostaci' : 'Observed Deficiencies'}</label>
                                        <textarea className="form-input" rows={3} value={formData.uoceniNedostaci} onChange={e => set('uoceniNedostaci', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Predložene korektivne mjere' : 'Proposed Corrective Measures'}</label>
                                        <textarea className="form-input" rows={3} value={formData.korektivneMjere} onChange={e => set('korektivneMjere', e.target.value)} />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Status' : 'Status'}</label>
                                        <select className="form-select" value={formData.status} onChange={e => set('status', e.target.value)}>
                                            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{bs ? v.bs : v.en}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="form-group">
                                        <label className="form-label">{t('note')}</label>
                                        <textarea className="form-input" rows={1} value={formData.napomena} onChange={e => set('napomena', e.target.value)} />
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

                {/* Table */}
                <div className="card">
                    <div className="card-body">
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button className="btn btn-primary btn-sm" onClick={openNew}>+ {bs ? 'Nova vježba' : 'New Drill'}</button>
                            <SavedFlash />
                            <input className="form-input" style={{ maxWidth: 280 }} placeholder={bs ? '🔍 Pretraži...' : '🔍 Search...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            {selectedIds.size > 0 ? (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {bs ? 'odabrano' : 'selected'}</span>
                                    <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                                </div>
                            ) : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sorted.length} {bs ? 'vježbi' : 'drills'}</span>}
                        </div>
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                        <th style={{ width: 90 }}>{t('actions')}</th>
                                        <th onClick={() => toggleSort('datumVjezbe')} style={thStyle('datumVjezbe')}>{bs ? 'Datum' : 'Date'}{sortIcon('datumVjezbe')}</th>
                                        <th>{bs ? 'Plan evakuacije (Lokacija)' : 'Evacuation Plan'}</th>
                                        <th>{bs ? 'Rukovodilac' : 'Supervisor'}</th>
                                        <th onClick={() => toggleSort('trajanjeMinuta')} style={thStyle('trajanjeMinuta')}>{bs ? 'Trajanje' : 'Duration'}{sortIcon('trajanjeMinuta')}</th>
                                        <th onClick={() => toggleSort('brojEvakuisanihOsoba')} style={thStyle('brojEvakuisanihOsoba')}>{bs ? 'Evakuisano' : 'Evacuated'}{sortIcon('brojEvakuisanihOsoba')}</th>
                                        <th>{bs ? 'Hitne službe' : 'Emergency Svc.'}</th>
                                        <th>{bs ? 'Status' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.length === 0 ? (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    ) : sorted.map(d => {
                                        const st = STATUS_MAP[d.status] || STATUS_MAP.uspješno;
                                        return (
                                            <tr key={d.id} onClick={() => openEdit(d)} style={{ cursor: 'pointer' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleOne(d.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div style={{ position: 'relative' }}>
                                                        <button className="btn btn-primary btn-sm" onClick={e => openMenu(d.id, e)}>{bs ? 'Akcije' : 'Actions'} ▼</button>
                                                        {actionMenuId === d.id && (
                                                            <>
                                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setActionMenuId(null); }} />
                                                                <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                    <button onClick={() => { setActionMenuId(null); openEdit(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✏️ {bs ? 'Otvori' : 'Open'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const copy = { ...d }; delete copy.id; copy.datumVjezbe = new Date().toISOString().split('T')[0]; copy.napomena = (copy.napomena ? copy.napomena + ' ' : '') + (bs ? '(Kopija)' : '(Copy)'); create(COLLECTIONS.EVACUATION_DRILLS, copy); loadData(); showFlash(); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📋 {bs ? 'Kopiraj' : 'Copy'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const cycle = { 'uspješno': 'djelimično', 'djelimično': 'neuspješno', 'neuspješno': 'uspješno' }; update(COLLECTIONS.EVACUATION_DRILLS, d.id, { status: cycle[d.status] || 'uspješno' }); loadData(); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🔄 {bs ? `Status → ${STATUS_MAP[({ 'uspješno': 'djelimično', 'djelimično': 'neuspješno', 'neuspješno': 'uspješno' })[d.status]]?.bs || 'Uspješno'}` : `Status → ${STATUS_MAP[({ 'uspješno': 'djelimično', 'djelimično': 'neuspješno', 'neuspješno': 'uspješno' })[d.status]]?.en || 'Successful'}`}</button>
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); handleDelete(d.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{formatDate(d.datumVjezbe)} {d.vrijemePocetka && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 4 }}>{d.vrijemePocetka}</span>}</td>
                                                <td><span style={{ fontWeight: 600 }}>{getPlanName(d.planId)}</span></td>
                                                <td>
                                                    <button onClick={e => { e.stopPropagation(); if (d.odgovornaOsobaId) setViewWorkerId(d.odgovornaOsobaId); }}
                                                        style={{ background: 'none', border: 'none', cursor: d.odgovornaOsobaId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: d.odgovornaOsobaId ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}>
                                                        {d.odgovornaOsobaIme || '—'}
                                                    </button>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{d.trajanjeMinuta ? `${d.trajanjeMinuta} min` : '—'}</td>
                                                <td style={{ textAlign: 'center' }}>{d.brojEvakuisanihOsoba || '—'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        {d.sudjelovaliVatrogasci && <span title="Vatrogasci" style={{ fontSize: '1.2rem' }}>🚒</span>}
                                                        {d.sudjelovalaHitna && <span title="Hitna pomoć" style={{ fontSize: '1.2rem' }}>🚑</span>}
                                                        {(!d.sudjelovaliVatrogasci && !d.sudjelovalaHitna) && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                    </div>
                                                </td>
                                                <td><span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color }}>{bs ? st.bs : st.en}</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            {viewWorkerId && <WorkerProfileModal workerId={viewWorkerId} onClose={() => setViewWorkerId(null)} onSaved={() => setViewWorkerId(null)} />}
        </>
    );
}
