'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useSortedList } from '@/hooks/useSortedList';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

// ── Fire Extinguisher ──
const EMPTY_EXT = {
    serijskiBroj: '', tip: 'prah', tezina: '', lokacija: '',
    datumNabavke: '', zadnjiServis: '', sljedeciServis: '',
    status: 'ispravan', odgovornaOsoba: '', napomena: '',
};

const EXT_TYPES = {
    prah: { bs: 'Prah (ABC)', en: 'Powder (ABC)' },
    co2: { bs: 'CO₂', en: 'CO₂' },
    pjena: { bs: 'Pjena', en: 'Foam' },
    voda: { bs: 'Voda', en: 'Water' },
};

// ── Hydrant ──
const EMPTY_HYD = {
    oznaka: '', lokacija: '', tip: 'unutarnji',
    datumZadnjegPregleda: '', sljedeciPregled: '',
    status: 'ispravan', napomena: '',
};

const STATUS_MAP = {
    ispravan: { bs: 'Ispravan', en: 'OK', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    neispravan: { bs: 'Neispravan', en: 'Faulty', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
    servis: { bs: 'Na servisu', en: 'In Service', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    povucen: { bs: 'Povučen', en: 'Retired', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
};

export default function FireProtectionPage() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const { markDirty, markClean } = useUnsavedChanges();

    const [tab, setTab] = useState('extinguishers'); // 'extinguishers' | 'hydrants'

    // ── Extinguishers ──
    const [extinguishers, setExtinguishers] = useState([]);
    const [showExtForm, setShowExtForm] = useState(false);
    const [editingExtId, setEditingExtId] = useState(null);
    const [extForm, setExtForm] = useState({ ...EMPTY_EXT });
    const [extSearch, setExtSearch] = useState('');
    const [extSelectedIds, setExtSelectedIds] = useState(new Set());

    // ── Hydrants ──
    const [hydrants, setHydrants] = useState([]);
    const [showHydForm, setShowHydForm] = useState(false);
    const [editingHydId, setEditingHydId] = useState(null);
    const [hydForm, setHydForm] = useState({ ...EMPTY_HYD });
    const [hydSearch, setHydSearch] = useState('');
    const [hydSelectedIds, setHydSelectedIds] = useState(new Set());

    const loadData = useCallback(() => {
        setExtinguishers(getAll(COLLECTIONS.FIRE_EXTINGUISHERS));
        setHydrants(getAll(COLLECTIONS.HYDRANTS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const getExpiryBadge = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr < today) return <span className="badge badge-danger">{bs ? 'Isteklo' : 'Expired'}</span>;
        if (dateStr <= in30) return <span className="badge badge-warning">{bs ? 'Uskoro' : 'Soon'}</span>;
        return <span className="badge badge-success">{bs ? 'OK' : 'OK'}</span>;
    };

    // ── Stats ──
    const extStats = {
        total: extinguishers.length,
        ok: extinguishers.filter(e => e.status === 'ispravan').length,
        faulty: extinguishers.filter(e => e.status === 'neispravan').length,
        serviceSoon: extinguishers.filter(e => e.sljedeciServis && e.sljedeciServis <= in30 && e.sljedeciServis >= today).length,
    };
    const hydStats = {
        total: hydrants.length,
        ok: hydrants.filter(h => h.status === 'ispravan').length,
        faulty: hydrants.filter(h => h.status === 'neispravan').length,
    };

    // ── Extinguisher handlers ──
    const setExt = (k, v) => { setExtForm(f => ({ ...f, [k]: v })); markDirty(); };

    const filteredExt = extinguishers.filter(e => {
        if (!extSearch) return true;
        const q = extSearch.toLowerCase();
        return (e.serijskiBroj || '').toLowerCase().includes(q) || (e.lokacija || '').toLowerCase().includes(q) || (e.tip || '').toLowerCase().includes(q);
    });
    const { sorted: sortedExt, toggleSort: toggleExtSort, sortIcon: extSortIcon, thStyle: extThStyle } = useSortedList(filteredExt, 'serijskiBroj');

    const openNewExt = () => { setEditingExtId(null); setExtForm({ ...EMPTY_EXT }); setShowExtForm(true); };
    const openEditExt = (e) => { setEditingExtId(e.id); setExtForm({ ...e }); setShowExtForm(true); };

    const handleSaveExt = async () => {
        if (!extForm.serijskiBroj) { await alert(bs ? 'Serijski broj je obavezan!' : 'Serial number is required!'); return; }
        if (editingExtId) { update(COLLECTIONS.FIRE_EXTINGUISHERS, editingExtId, extForm); }
        else { create(COLLECTIONS.FIRE_EXTINGUISHERS, extForm); }
        loadData(); markClean(); setShowExtForm(false); showFlash();
    };

    const handleDeleteExt = async (id) => {
        if (await confirm(bs ? 'Obrisati ovaj aparat?' : 'Delete this extinguisher?')) { remove(COLLECTIONS.FIRE_EXTINGUISHERS, id); loadData(); }
    };

    const handleDeleteSelectedExt = async () => {
        if (extSelectedIds.size === 0) return;
        if (await confirm(bs ? `Obrisati ${extSelectedIds.size} aparata?` : `Delete ${extSelectedIds.size} extinguishers?`)) {
            for (let id of extSelectedIds) remove(COLLECTIONS.FIRE_EXTINGUISHERS, id);
            setExtSelectedIds(new Set()); loadData();
        }
    };

    // ── Hydrant handlers ──
    const setHyd = (k, v) => { setHydForm(f => ({ ...f, [k]: v })); markDirty(); };

    const filteredHyd = hydrants.filter(h => {
        if (!hydSearch) return true;
        const q = hydSearch.toLowerCase();
        return (h.oznaka || '').toLowerCase().includes(q) || (h.lokacija || '').toLowerCase().includes(q);
    });
    const { sorted: sortedHyd, toggleSort: toggleHydSort, sortIcon: hydSortIcon, thStyle: hydThStyle } = useSortedList(filteredHyd, 'oznaka');

    const openNewHyd = () => { setEditingHydId(null); setHydForm({ ...EMPTY_HYD }); setShowHydForm(true); };
    const openEditHyd = (h) => { setEditingHydId(h.id); setHydForm({ ...h }); setShowHydForm(true); };

    const handleSaveHyd = async () => {
        if (!hydForm.oznaka) { await alert(bs ? 'Oznaka je obavezna!' : 'Code is required!'); return; }
        if (editingHydId) { update(COLLECTIONS.HYDRANTS, editingHydId, hydForm); }
        else { create(COLLECTIONS.HYDRANTS, hydForm); }
        loadData(); markClean(); setShowHydForm(false); showFlash();
    };

    const handleDeleteHyd = async (id) => {
        if (await confirm(bs ? 'Obrisati ovaj hidrant?' : 'Delete this hydrant?')) { remove(COLLECTIONS.HYDRANTS, id); loadData(); }
    };

    const handleDeleteSelectedHyd = async () => {
        if (hydSelectedIds.size === 0) return;
        if (await confirm(bs ? `Obrisati ${hydSelectedIds.size} hidranata?` : `Delete ${hydSelectedIds.size} hydrants?`)) {
            for (let id of hydSelectedIds) remove(COLLECTIONS.HYDRANTS, id);
            setHydSelectedIds(new Set()); loadData();
        }
    };

    // ── Action menus ──
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({});
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

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

    const renderStatusBadge = (status) => {
        const s = STATUS_MAP[status] || STATUS_MAP.ispravan;
        return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>{bs ? s.bs : s.en}</span>;
    };

    const tabBtn = (key, label, icon) => (
        <button onClick={() => setTab(key)} style={{
            padding: '10px 20px', background: tab === key ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: tab === key ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', fontFamily: 'var(--font-body)', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 8,
        }}>{icon} {label}</button>
    );

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: '1.6rem' }}>🧯</span>
                <div>
                    <h1 style={{ margin: 0 }}>{bs ? 'Zaštita od požara' : 'Fire Protection'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {bs ? 'Protupožarni aparati, hidrantska mreža i servisni rokovi' : 'Fire extinguishers, hydrant network & service schedules'}
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20, marginTop: 16 }}>
                {[
                    { label: bs ? 'PP aparati' : 'Extinguishers', val: extStats.total, icon: '🧯', color: 'var(--primary)' },
                    { label: bs ? 'Ispravni' : 'OK', val: extStats.ok, icon: '✅', color: '#22C55E' },
                    { label: bs ? 'Neispravni' : 'Faulty', val: extStats.faulty, icon: '🔴', color: '#EF4444' },
                    { label: bs ? 'Servis uskoro' : 'Service Soon', val: extStats.serviceSoon, icon: '⚠️', color: '#F59E0B' },
                    { label: bs ? 'Hidranti' : 'Hydrants', val: hydStats.total, icon: '🚰', color: '#6366F1' },
                ].map((s, i) => (
                    <div key={i} className="card" style={{ padding: '14px 18px' }}>
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

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {tabBtn('extinguishers', bs ? 'Protupožarni aparati' : 'Fire Extinguishers', '🧯')}
                {tabBtn('hydrants', bs ? 'Hidrantska mreža' : 'Hydrant Network', '🚰')}
            </div>

            {/* ════════ EXTINGUISHERS TAB ════════ */}
            {tab === 'extinguishers' && (
                <>
                    {showExtForm && (
                        <div className="modal-overlay" onClick={() => setShowExtForm(false)}>
                            <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>{editingExtId ? '✏️' : '+'} {bs ? 'Protupožarni aparat' : 'Fire Extinguisher'}</h2>
                                    <button className="btn btn-ghost btn-icon" onClick={() => setShowExtForm(false)}>✕</button>
                                </div>
                                <div className="modal-body">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontWeight: 700 }}>{bs ? 'Serijski broj' : 'Serial No.'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                            <input className="form-input" value={extForm.serijskiBroj} onChange={e => setExt('serijskiBroj', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Tip aparata' : 'Type'}</label>
                                            <select className="form-select" value={extForm.tip} onChange={e => setExt('tip', e.target.value)}>
                                                {Object.entries(EXT_TYPES).map(([k, v]) => <option key={k} value={k}>{bs ? v.bs : v.en}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Težina (kg)' : 'Weight (kg)'}</label>
                                            <input className="form-input" value={extForm.tezina} onChange={e => setExt('tezina', e.target.value)} placeholder="6, 9, 12..." />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Lokacija' : 'Location'}</label>
                                            <input className="form-input" value={extForm.lokacija} onChange={e => setExt('lokacija', e.target.value)} placeholder={bs ? 'Hala 1, Kat 2...' : 'Hall 1, Floor 2...'} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Datum nabavke' : 'Purchased'}</label>
                                            <input className="form-input" type="date" value={extForm.datumNabavke} onChange={e => setExt('datumNabavke', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Status' : 'Status'}</label>
                                            <select className="form-select" value={extForm.status} onChange={e => setExt('status', e.target.value)}>
                                                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{bs ? v.bs : v.en}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Zadnji servis' : 'Last Service'}</label>
                                            <input className="form-input" type="date" value={extForm.zadnjiServis} onChange={e => setExt('zadnjiServis', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Sljedeći servis' : 'Next Service'}</label>
                                            <input className="form-input" type="date" value={extForm.sljedeciServis} onChange={e => setExt('sljedeciServis', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Odgovorna osoba' : 'Responsible Person'}</label>
                                            <input className="form-input" value={extForm.odgovornaOsoba} onChange={e => setExt('odgovornaOsoba', e.target.value)} />
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">{t('note')}</label>
                                            <textarea className="form-input" rows={2} value={extForm.napomena} onChange={e => setExt('napomena', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-ghost" onClick={() => setShowExtForm(false)}>{t('cancel')}</button>
                                    <button className="btn btn-primary" onClick={handleSaveExt}>💾 {t('save')}</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="card">
                        <div className="card-body">
                            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button className="btn btn-primary btn-sm" onClick={openNewExt}>+ {bs ? 'Novi aparat' : 'New Extinguisher'}</button>
                                <SavedFlash />
                                <input className="form-input" style={{ maxWidth: 260 }} placeholder={bs ? '🔍 Pretraži...' : '🔍 Search...'} value={extSearch} onChange={e => setExtSearch(e.target.value)} />
                                {extSelectedIds.size > 0 ? (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{extSelectedIds.size} {bs ? 'odabrano' : 'selected'}</span>
                                        <button className="btn btn-danger btn-sm" onClick={handleDeleteSelectedExt}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                                    </div>
                                ) : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sortedExt.length} {bs ? 'aparata' : 'extinguishers'}</span>}
                            </div>
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={extSelectedIds.size === sortedExt.length && sortedExt.length > 0} onChange={e => { if (e.target.checked) setExtSelectedIds(new Set(sortedExt.map(x => x.id))); else setExtSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                            <th style={{ width: 90 }}>{t('actions')}</th>
                                            <th onClick={() => toggleExtSort('serijskiBroj')} style={extThStyle('serijskiBroj')}>{bs ? 'Ser. broj' : 'Serial No.'}{extSortIcon('serijskiBroj')}</th>
                                            <th onClick={() => toggleExtSort('tip')} style={extThStyle('tip')}>{bs ? 'Tip' : 'Type'}{extSortIcon('tip')}</th>
                                            <th onClick={() => toggleExtSort('tezina')} style={extThStyle('tezina')}>{bs ? 'Težina' : 'Weight'}{extSortIcon('tezina')}</th>
                                            <th onClick={() => toggleExtSort('lokacija')} style={extThStyle('lokacija')}>{bs ? 'Lokacija' : 'Location'}{extSortIcon('lokacija')}</th>
                                            <th onClick={() => toggleExtSort('sljedeciServis')} style={extThStyle('sljedeciServis')}>{bs ? 'Sljedeći servis' : 'Next Service'}{extSortIcon('sljedeciServis')}</th>
                                            <th>{bs ? 'Status' : 'Status'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedExt.length === 0 ? (
                                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                        ) : sortedExt.map(e => (
                                            <tr key={e.id} onClick={() => openEditExt(e)} style={{ cursor: 'pointer' }} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                                                <td onClick={ev => ev.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" checked={extSelectedIds.has(e.id)} onChange={() => { const n = new Set(extSelectedIds); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); setExtSelectedIds(n); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                                </td>
                                                <td onClick={ev => ev.stopPropagation()}>
                                                    <div style={{ position: 'relative' }}>
                                                        <button className="btn btn-primary btn-sm" onClick={ev => openMenu(e.id, ev)}>{bs ? 'Akcije' : 'Actions'} ▼</button>
                                                        {actionMenuId === e.id && (
                                                            <>
                                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={ev => { ev.stopPropagation(); setActionMenuId(null); }} />
                                                                <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                    <button onClick={() => { setActionMenuId(null); openEditExt(e); }} style={menuItemSt} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>✏️ {bs ? 'Otvori' : 'Open'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const copy = { ...e }; delete copy.id; copy.serijskiBroj = copy.serijskiBroj + '-COPY'; copy.napomena = (copy.napomena ? copy.napomena + ' ' : '') + (bs ? '(Kopija)' : '(Copy)'); create(COLLECTIONS.FIRE_EXTINGUISHERS, copy); loadData(); showFlash(); }} style={menuItemSt} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>📋 {bs ? 'Kopiraj' : 'Copy'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const cycle = { ispravan: 'neispravan', neispravan: 'servis', servis: 'povucen', povucen: 'ispravan' }; update(COLLECTIONS.FIRE_EXTINGUISHERS, e.id, { status: cycle[e.status] || 'ispravan' }); loadData(); }} style={menuItemSt} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>🔄 {bs ? `Status → ${STATUS_MAP[({ ispravan: 'neispravan', neispravan: 'servis', servis: 'povucen', povucen: 'ispravan' })[e.status]]?.bs || 'Ispravan'}` : `Status → ${STATUS_MAP[({ ispravan: 'neispravan', neispravan: 'servis', servis: 'povucen', povucen: 'ispravan' })[e.status]]?.en || 'OK'}`}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]; update(COLLECTIONS.FIRE_EXTINGUISHERS, e.id, { sljedeciServis: nextYear, zadnjiServis: today }); loadData(); showFlash(); }} style={menuItemSt} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>📅 {bs ? 'Zakaži servis (+1 god.)' : 'Schedule Service (+1yr)'}</button>
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); handleDeleteExt(e.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{e.serijskiBroj}</td>
                                                <td><span className="badge badge-info">{bs ? EXT_TYPES[e.tip]?.bs : EXT_TYPES[e.tip]?.en || e.tip}</span></td>
                                                <td>{e.tezina ? `${e.tezina} kg` : '—'}</td>
                                                <td>{e.lokacija || '—'}</td>
                                                <td>{formatDate(e.sljedeciServis)} {getExpiryBadge(e.sljedeciServis)}</td>
                                                <td>{renderStatusBadge(e.status)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ════════ HYDRANTS TAB ════════ */}
            {tab === 'hydrants' && (
                <>
                    {showHydForm && (
                        <div className="modal-overlay" onClick={() => setShowHydForm(false)}>
                            <div className="modal" style={{ maxWidth: 550 }} onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2>{editingHydId ? '✏️' : '+'} {bs ? 'Hidrant' : 'Hydrant'}</h2>
                                    <button className="btn btn-ghost btn-icon" onClick={() => setShowHydForm(false)}>✕</button>
                                </div>
                                <div className="modal-body">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontWeight: 700 }}>{bs ? 'Oznaka' : 'Code'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                            <input className="form-input" value={hydForm.oznaka} onChange={e => setHyd('oznaka', e.target.value)} placeholder="H-01, VH-03..." />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Tip' : 'Type'}</label>
                                            <select className="form-select" value={hydForm.tip} onChange={e => setHyd('tip', e.target.value)}>
                                                <option value="unutarnji">{bs ? 'Unutarnji' : 'Indoor'}</option>
                                                <option value="vanjski">{bs ? 'Vanjski' : 'Outdoor'}</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">{bs ? 'Lokacija' : 'Location'}</label>
                                            <input className="form-input" value={hydForm.lokacija} onChange={e => setHyd('lokacija', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Zadnji pregled' : 'Last Inspection'}</label>
                                            <input className="form-input" type="date" value={hydForm.datumZadnjegPregleda} onChange={e => setHyd('datumZadnjegPregleda', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Sljedeći pregled' : 'Next Inspection'}</label>
                                            <input className="form-input" type="date" value={hydForm.sljedeciPregled} onChange={e => setHyd('sljedeciPregled', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{bs ? 'Status' : 'Status'}</label>
                                            <select className="form-select" value={hydForm.status} onChange={e => setHyd('status', e.target.value)}>
                                                {Object.entries(STATUS_MAP).filter(([k]) => k !== 'povucen').map(([k, v]) => <option key={k} value={k}>{bs ? v.bs : v.en}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">{t('note')}</label>
                                            <textarea className="form-input" rows={2} value={hydForm.napomena} onChange={e => setHyd('napomena', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-ghost" onClick={() => setShowHydForm(false)}>{t('cancel')}</button>
                                    <button className="btn btn-primary" onClick={handleSaveHyd}>💾 {t('save')}</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="card">
                        <div className="card-body">
                            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                                <button className="btn btn-primary btn-sm" onClick={openNewHyd}>+ {bs ? 'Novi hidrant' : 'New Hydrant'}</button>
                                <SavedFlash />
                                <input className="form-input" style={{ maxWidth: 260 }} placeholder={bs ? '🔍 Pretraži...' : '🔍 Search...'} value={hydSearch} onChange={e => setHydSearch(e.target.value)} />
                                {hydSelectedIds.size > 0 ? (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{hydSelectedIds.size} {bs ? 'odabrano' : 'selected'}</span>
                                        <button className="btn btn-danger btn-sm" onClick={handleDeleteSelectedHyd}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                                    </div>
                                ) : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sortedHyd.length} {bs ? 'hidranata' : 'hydrants'}</span>}
                            </div>
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={hydSelectedIds.size === sortedHyd.length && sortedHyd.length > 0} onChange={e => { if (e.target.checked) setHydSelectedIds(new Set(sortedHyd.map(x => x.id))); else setHydSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                            <th style={{ width: 90 }}>{t('actions')}</th>
                                            <th onClick={() => toggleHydSort('oznaka')} style={hydThStyle('oznaka')}>{bs ? 'Oznaka' : 'Code'}{hydSortIcon('oznaka')}</th>
                                            <th onClick={() => toggleHydSort('tip')} style={hydThStyle('tip')}>{bs ? 'Tip' : 'Type'}{hydSortIcon('tip')}</th>
                                            <th onClick={() => toggleHydSort('lokacija')} style={hydThStyle('lokacija')}>{bs ? 'Lokacija' : 'Location'}{hydSortIcon('lokacija')}</th>
                                            <th onClick={() => toggleHydSort('sljedeciPregled')} style={hydThStyle('sljedeciPregled')}>{bs ? 'Sljedeći pregled' : 'Next Inspection'}{hydSortIcon('sljedeciPregled')}</th>
                                            <th>{bs ? 'Status' : 'Status'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedHyd.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                        ) : sortedHyd.map(h => (
                                            <tr key={h.id} onClick={() => openEditHyd(h)} style={{ cursor: 'pointer' }} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = ''}>
                                                <td onClick={ev => ev.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" checked={hydSelectedIds.has(h.id)} onChange={() => { const n = new Set(hydSelectedIds); if (n.has(h.id)) n.delete(h.id); else n.add(h.id); setHydSelectedIds(n); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                                </td>
                                                <td onClick={ev => ev.stopPropagation()}>
                                                    <div style={{ position: 'relative' }}>
                                                        <button className="btn btn-primary btn-sm" onClick={ev => openMenu(h.id, ev)}>{bs ? 'Akcije' : 'Actions'} ▼</button>
                                                        {actionMenuId === h.id && (
                                                            <>
                                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={ev => { ev.stopPropagation(); setActionMenuId(null); }} />
                                                                <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                    <button onClick={() => { setActionMenuId(null); openEditHyd(h); }} style={menuItemSt} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>✏️ {bs ? 'Otvori' : 'Open'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const copy = { ...h }; delete copy.id; copy.oznaka = copy.oznaka + '-COPY'; copy.napomena = (copy.napomena ? copy.napomena + ' ' : '') + (bs ? '(Kopija)' : '(Copy)'); create(COLLECTIONS.HYDRANTS, copy); loadData(); showFlash(); }} style={menuItemSt} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>📋 {bs ? 'Kopiraj' : 'Copy'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const cycle = { ispravan: 'neispravan', neispravan: 'servis', servis: 'ispravan' }; update(COLLECTIONS.HYDRANTS, h.id, { status: cycle[h.status] || 'ispravan' }); loadData(); }} style={menuItemSt} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>🔄 {bs ? `Status → ${STATUS_MAP[({ ispravan: 'neispravan', neispravan: 'servis', servis: 'ispravan' })[h.status]]?.bs || 'Ispravan'}` : `Status → ${STATUS_MAP[({ ispravan: 'neispravan', neispravan: 'servis', servis: 'ispravan' })[h.status]]?.en || 'OK'}`}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const in6m = new Date(Date.now() + 182 * 86400000).toISOString().split('T')[0]; update(COLLECTIONS.HYDRANTS, h.id, { sljedeciPregled: in6m, datumZadnjegPregleda: today }); loadData(); showFlash(); }} style={menuItemSt} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>📅 {bs ? 'Zakaži pregled (+6 mj.)' : 'Schedule Inspection (+6mo)'}</button>
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); handleDeleteHyd(h.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={ev => ev.currentTarget.style.background = 'none'}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{h.oznaka}</td>
                                                <td><span className="badge badge-info">{h.tip === 'unutarnji' ? (bs ? 'Unutarnji' : 'Indoor') : (bs ? 'Vanjski' : 'Outdoor')}</span></td>
                                                <td>{h.lokacija || '—'}</td>
                                                <td>{formatDate(h.sljedeciPregled)} {getExpiryBadge(h.sljedeciPregled)}</td>
                                                <td>{renderStatusBadge(h.status)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
