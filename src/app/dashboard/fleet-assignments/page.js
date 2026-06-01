'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import PageHeader from '@/components/PageHeader';

function FleetAssignmentsInner() {
    const { t, lang } = useLanguage();
    
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();

    const [assignments, setAssignments] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewWorkerId, setViewWorkerId] = useState(null);

    // Modal state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ vehicleId: '', workerId: '', workerIme: '', datumZaduzenja: new Date().toISOString().split('T')[0], pocetnaKilometraza: '' });
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [showVSearch, setShowVSearch] = useState(false);
    const [workerSearch, setWorkerSearch] = useState('');
    const [showWSearch, setShowWSearch] = useState(false);
    const vRef = useRef(null);
    const wRef = useRef(null);

    // Action menu
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({});
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState(new Set());

    const loadData = useCallback(() => {
        setAssignments(getAll(COLLECTIONS.VEHICLE_ASSIGNMENTS));
        setVehicles(getAll(COLLECTIONS.VEHICLES));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    useEffect(() => {
        const handler = (e) => {
            if (vRef.current && !vRef.current.contains(e.target)) setShowVSearch(false);
            if (wRef.current && !wRef.current.contains(e.target)) setShowWSearch(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const enriched = assignments.map(a => {
        const v = vehicles.find(x => x.id === a.vehicleId);
        const w = workers.find(x => x.id === a.workerId);
        return {
            ...a,
            vehicleReg: v ? v.registracija : 'Nepoznato',
            workerName: w ? `${w.ime} ${w.prezime}` : 'Nepoznato',
        };
    });

    const filtered = enriched.filter(item => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (item.vehicleReg || '').toLowerCase().includes(q) ||
               (item.workerName || '').toLowerCase().includes(q) ||
               (item.svrha || '').toLowerCase().includes(q);
    });

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datumZaduzenja', 'desc');

    const openInFleet = (vehicleId) => {
        router.push(`/dashboard/fleet?openId=${vehicleId}&tab=istorija&returnTo=${encodeURIComponent('/dashboard/fleet-assignments')}`);
    };

    const openMenu = (id, e) => {
        e.stopPropagation();
        if (actionMenuId === id) { setActionMenuId(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const flipUp = spaceBelow < 200;
        setMenuPos(flipUp
            ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, rect.top - 8) }
            : { top: rect.bottom + 4, left: rect.left, maxH: Math.max(120, spaceBelow - 15) });
        setActionMenuId(id);
    };

    const handleDelete = async (id) => {
        if (await confirm(t('deleteThisAssignment'))) {
            remove(COLLECTIONS.VEHICLE_ASSIGNMENTS, id);
            setActionMenuId(null);
            loadData();
        }
    };

    const handleCopy = (a) => {
        create(COLLECTIONS.VEHICLE_ASSIGNMENTS, {
            vehicleId: a.vehicleId,
            workerId: a.workerId,
            workerIme: a.workerIme || a.workerName,
            datumZaduzenja: new Date().toISOString().split('T')[0],
            pocetnaKilometraza: '',
            datumRazduzenja: '',
            zavrsnaKilometraza: ''
        });
        setActionMenuId(null);
        loadData();
        showFlash();
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(t('deleteRecords1').replace('{0}', selectedIds.size))) {
            for (let id of selectedIds) remove(COLLECTIONS.VEHICLE_ASSIGNMENTS, id);
            setSelectedIds(new Set());
            loadData();
        }
    };

    const toggleAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id)));
        else setSelectedIds(new Set());
    };
    const toggleOne = (id) => {
        const n = new Set(selectedIds);
        if (n.has(id)) n.delete(id); else n.add(id);
        setSelectedIds(n);
    };

    const handleSave = async () => {
        if (!formData.vehicleId) { await alert(t('selectVehicle')); return; }
        if (!formData.workerId) { await alert(t('selectDriver')); return; }
        
        create(COLLECTIONS.VEHICLE_ASSIGNMENTS, {
            ...formData,
            datumRazduzenja: '',
            zavrsnaKilometraza: ''
        });
        update(COLLECTIONS.VEHICLES, formData.vehicleId, { vozacId: formData.workerId, vozacIme: formData.workerIme });
        
        setShowForm(false);
        loadData();
        showFlash();
    };

    const fw = workers.filter(w => !workerSearch || `${w.ime} ${w.prezime}`.toLowerCase().includes(workerSearch.toLowerCase()));
    const fv = vehicles.filter(v => !vehicleSearch || `${v.registracija} ${v.marka}`.toLowerCase().includes(vehicleSearch.toLowerCase()));

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader icon="🔄" title={t('fleetAssignments')} />

            {/* Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>+ {t('newVehicleAssignment')}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                
                                <div className="form-group" ref={vRef} style={{ position: 'relative' }}>
                                    <label className="form-label">{t('vozilo1')}</label>
                                    <input className="form-input" placeholder="🔍 Pretraži vozila..." value={vehicleSearch} 
                                        onChange={e => { setVehicleSearch(e.target.value); setShowVSearch(true); setFormData(f => ({...f, vehicleId: ''})); }} 
                                        onFocus={() => setShowVSearch(true)} />
                                    {showVSearch && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius-sm)' }}>
                                            {fv.length === 0 ? <div style={{ padding: 8 }}>Nema rezultata</div> : fv.slice(0, 10).map(v => (
                                                <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} 
                                                    onClick={() => { setFormData(f => ({...f, vehicleId: v.id})); setVehicleSearch(`${v.registracija} - ${v.marka || ''}`); setShowVSearch(false); }}>
                                                    <strong>{v.registracija}</strong> - {v.marka} {v.model}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {formData.vehicleId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ Odabrano</div>}
                                </div>

                                <div className="form-group" ref={wRef} style={{ position: 'relative' }}>
                                    <label className="form-label">{t('driver5')}</label>
                                    <input className="form-input" placeholder="🔍 Pretraži vozače..." value={workerSearch} 
                                        onChange={e => { setWorkerSearch(e.target.value); setShowWSearch(true); setFormData(f => ({...f, workerId: '', workerIme: ''})); }} 
                                        onFocus={() => setShowWSearch(true)} />
                                    {showWSearch && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius-sm)' }}>
                                            {fw.length === 0 ? <div style={{ padding: 8 }}>Nema rezultata</div> : fw.slice(0, 10).map(w => (
                                                <div key={w.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} 
                                                    onClick={() => { setFormData(f => ({...f, workerId: w.id, workerIme: `${w.ime} ${w.prezime}`})); setWorkerSearch(`${w.ime} ${w.prezime}`); setShowWSearch(false); }}>
                                                    {w.ime} {w.prezime}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {formData.workerId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {formData.workerIme}</div>}
                                </div>

                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">{t('datumZaduzenja')}</label>
                                        <DateInput value={formData.datumZaduzenja} onChange={v => setFormData(f => ({...f, datumZaduzenja: v}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('startingMileage1')}</label>
                                        <input className="form-input" type="number" value={formData.pocetnaKilometraza} onChange={e => setFormData(f => ({...f, pocetnaKilometraza: e.target.value}))} />
                                    </div>
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
                <div className="card-body" style={{ padding: 0 }}><div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => { 
                            setFormData({ vehicleId: '', workerId: '', workerIme: '', datumZaduzenja: new Date().toISOString().split('T')[0], pocetnaKilometraza: '' }); 
                            setVehicleSearch(''); setWorkerSearch(''); setShowForm(true); 
                        }}>+ {t('novoZaduzenje')}</button>
                        <SavedFlash />
                        <input className="form-input" style={{ maxWidth: 300, marginLeft: 12 }} placeholder={t('searchAssignments')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        {selectedIds.size> 0 ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {t('odabrano1')}</span>
                                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {t('obrisi')}</button>
                            </div>
                        ) : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sorted.length} {t('zapisnika')}</span>}
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                    <th style={{ width: 90 }}>{t('actions')}</th>
                                    <th onClick={() => toggleSort('vehicleReg')} style={thStyle('vehicleReg')}>{t('vozilo1')}{sortIcon('vehicleReg')}</th>
                                    <th onClick={() => toggleSort('workerName')} style={thStyle('workerName')}>{t('driver6')}{sortIcon('workerName')}</th>
                                    <th onClick={() => toggleSort('datumZaduzenja')} style={thStyle('datumZaduzenja')}>{t('datumZaduzenja')}{sortIcon('datumZaduzenja')}</th>
                                    <th onClick={() => toggleSort('pocetnaKilometraza')} style={thStyle('pocetnaKilometraza')}>{t('kmAssigned')}{sortIcon('pocetnaKilometraza')}</th>
                                    <th onClick={() => toggleSort('datumRazduzenja')} style={thStyle('datumRazduzenja')}>{t('datumRazduzenja')}{sortIcon('datumRazduzenja')}</th>
                                    <th onClick={() => toggleSort('zavrsnaKilometraza')} style={thStyle('zavrsnaKilometraza')}>{t('kmReturned')}{sortIcon('zavrsnaKilometraza')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map(a => (
                                    <tr key={a.id} onClick={() => openInFleet(a.vehicleId)} style={{ cursor: 'pointer' }}>
                                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleOne(a.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onClick={e => openMenu(a.id, e)}>{t('akcije')} ▼</button>
                                                {actionMenuId === a.id && (<>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setActionMenuId(null); }} />
                                                    <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                        <button onClick={() => { setActionMenuId(null); openInFleet(a.vehicleId); }} className="dropdown-item">✏️ {t('otvori')}</button>
                                                        <button onClick={() => { setActionMenuId(null); handleCopy(a); }} className="dropdown-item">📋 {t('kopiraj')}</button>
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => { setActionMenuId(null); handleDelete(a.id); }} className="dropdown-item text-danger">🗑️ {t('izbrisi')}</button>
                                                    </div>
                                                </>)}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{a.vehicleReg}</td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <button onClick={() => { const w = workers.find(x => x.id === a.workerId); if (w) setViewWorkerId(w.id); }}
                                                style={{ background: 'none', border: 'none', cursor: a.workerId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: a.workerId ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}>
                                                {a.workerName}
                                            </button>
                                        </td>
                                        <td>{formatDate(a.datumZaduzenja)}</td>
                                        <td>{a.pocetnaKilometraza || '—'}</td>
                                        <td>{formatDate(a.datumRazduzenja) || <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('zaduz')}</span>}</td>
                                        <td>{a.zavrsnaKilometraza || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            {viewWorkerId && <WorkerProfileModal workerId={viewWorkerId} onClose={() => setViewWorkerId(null)} onSaved={() => setViewWorkerId(null)} />}
        </div>
    );
}

export default function FleetAssignments() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
            <FleetAssignmentsInner />
        </Suspense>
    );
}
