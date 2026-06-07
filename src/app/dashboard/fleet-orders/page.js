'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import PageHeader from '@/components/PageHeader';
import SubscriptionGate from '@/components/SubscriptionGate';

function FleetOrdersInner() {
    const { t, lang } = useLanguage();
    
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();

    const [orders, setOrders] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewWorkerId, setViewWorkerId] = useState(null);

    // Modal state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ 
        vehicleId: '', vozacId: '', vozacIme: '', 
        brojNaloga: '', relacija: '', svrha: '',
        datumPolaska: new Date().toISOString().split('T')[0], datumPovratka: '' 
    });
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
        setOrders(getAll(COLLECTIONS.TRAVEL_ORDERS));
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

    const enriched = orders.map(o => {
        const v = vehicles.find(x => x.id === o.vehicleId);
        const w = workers.find(x => x.id === o.vozacId);
        return {
            ...o,
            vehicleReg: v ? v.registracija : t('nepoznato'),
            vehicleMarka: v ? `${v.marka || ''} ${v.model || ''}`.trim() : '',
            workerName: w ? `${w.ime} ${w.prezime}` : (o.vozacIme || t('nepoznato')),
        };
    });

    const filtered = enriched.filter(item => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (item.vehicleReg || '').toLowerCase().includes(q) ||
               (item.workerName || '').toLowerCase().includes(q) ||
               (item.relacija || '').toLowerCase().includes(q) ||
               (item.brojNaloga || '').toLowerCase().includes(q) ||
               (item.svrha || '').toLowerCase().includes(q);
    });

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datumPolaska', 'desc');

    const openInFleet = (vehicleId) => {
        router.push(`/dashboard/fleet?openId=${vehicleId}&tab=nalozi&returnTo=${encodeURIComponent('/dashboard/fleet-orders')}`);
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
        if (await confirm(t('deleteThisOrder'))) {
            remove(COLLECTIONS.TRAVEL_ORDERS, id);
            setActionMenuId(null);
            loadData();
        }
    };

    const handleCopy = (o) => {
        create(COLLECTIONS.TRAVEL_ORDERS, {
            vehicleId: o.vehicleId,
            vozacId: o.vozacId,
            vozacIme: o.vozacIme || o.workerName,
            brojNaloga: `PN-${new Date().getFullYear()}-`,
            relacija: o.relacija || '',
            svrha: o.svrha || '',
            datumPolaska: new Date().toISOString().split('T')[0],
            datumPovratka: '',
            status: 'otvoren',
        });
        setActionMenuId(null);
        loadData();
        showFlash();
    };

    const handlePrint = (o) => {
        const v = vehicles.find(x => x.id === o.vehicleId) || {};
        const win = window.open('', '_blank');
        win.document.write(`<html><head><title>${t('travelOrderForVehicle')} ${o.brojNaloga}</title><style>body{font-family:sans-serif;padding:40px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #333;padding:8px;text-align:left}.header{text-align:center;margin-bottom:30px}</style></head><body><div class="header"><h2>${t('travelOrderForVehicleTitle')}</h2><h3>${t('orderNo')}: ${o.brojNaloga}</h3></div><p><strong>${t('vozilo1')}:</strong> ${v.marka || ''} ${v.model || ''} (${v.registracija || ''})</p><p><strong>${t('driver7')}:</strong> ${o.vozacIme || o.workerName || ''}</p><p><strong>${t('route2')}:</strong> ${o.relacija || ''}</p><p><strong>${t('dateOut')}:</strong> ${formatDate(o.datumPolaska)}</p><p><strong>${t('dateIn')}:</strong> ${formatDate(o.datumPovratka) || '—'}</p><p><strong>${t('purpose')}:</strong> ${o.svrha || ''}</p><h4 style="margin-top:40px">${t('vehicleMovementLog')}</h4><table><tr><th>${t('datum')}</th><th>${t('departureFrom')}</th><th>${t('arrivedAt')}</th><th>${t('departureTime')}</th><th>${t('arrivalTime')}</th><th>${t('startKm')}</th><th>${t('endKm')}</th><th>${t('potpis')}</th></tr><tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table><p style="margin-top:50px">${t('authorizedPersonSignature')}: ___________________________</p></body></html>`);
        win.document.close(); win.focus(); setTimeout(() => { win.print(); }, 500);
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(t('deleteOrders1').replace('{0}', selectedIds.size))) {
            for (let id of selectedIds) remove(COLLECTIONS.TRAVEL_ORDERS, id);
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
        if (!formData.vehicleId) { await alert(t('selectVehicle2')); return; }
        if (!formData.brojNaloga) { await alert(t('enterOrderNumber')); return; }
        
        create(COLLECTIONS.TRAVEL_ORDERS, { ...formData });
        
        setShowForm(false);
        loadData();
        showFlash();
    };

    const fw = workers.filter(w => !workerSearch || `${w.ime} ${w.prezime}`.toLowerCase().includes(workerSearch.toLowerCase()));
    const fv = vehicles.filter(v => !vehicleSearch || `${v.registracija} ${v.marka}`.toLowerCase().includes(vehicleSearch.toLowerCase()));

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader icon="📝" title={t('fleetOrders')} />

            {/* Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>+ {t('newTravelOrder1')}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                
                                <div className="form-grid-2">
                                    <div className="form-group" ref={vRef} style={{ position: 'relative' }}>
                                        <label className="form-label">{t('vozilo1')}</label>
                                        <input className="form-input" placeholder={`🔍 ${t('pretrazi')}...`} value={vehicleSearch} 
                                            onChange={e => { setVehicleSearch(e.target.value); setShowVSearch(true); setFormData(f => ({...f, vehicleId: ''})); }} 
                                            onFocus={() => setShowVSearch(true)} />
                                        {showVSearch && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                                                {fv.length === 0 ? <div style={{ padding: 8 }}>{t('nemaRezultata')}</div> : fv.slice(0, 10).map(v => (
                                                    <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} 
                                                        onClick={() => { setFormData(f => ({...f, vehicleId: v.id})); setVehicleSearch(v.registracija); setShowVSearch(false); }}>
                                                        <strong>{v.registracija}</strong> - {v.marka}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {formData.vehicleId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {t('odabrano')}</div>}
                                    </div>

                                    <div className="form-group" ref={wRef} style={{ position: 'relative' }}>
                                        <label className="form-label">{t('driver7')}</label>
                                        <input className="form-input" placeholder={`🔍 ${t('pretrazi')}...`} value={workerSearch} 
                                            onChange={e => { setWorkerSearch(e.target.value); setShowWSearch(true); setFormData(f => ({...f, vozacId: '', vozacIme: ''})); }} 
                                            onFocus={() => setShowWSearch(true)} />
                                        {showWSearch && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                                                {fw.length === 0 ? <div style={{ padding: 8 }}>{t('nemaRezultata')}</div> : fw.slice(0, 10).map(w => (
                                                    <div key={w.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} 
                                                        onClick={() => { setFormData(f => ({...f, vozacId: w.id, vozacIme: `${w.ime} ${w.prezime}`})); setWorkerSearch(`${w.ime} ${w.prezime}`); setShowWSearch(false); }}>
                                                        {w.ime} {w.prezime}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {formData.vozacId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {formData.vozacIme}</div>}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('orderNo')} <span style={{color: 'var(--danger)'}}>*</span></label>
                                    <input className="form-input" value={formData.brojNaloga} onChange={e => setFormData(f => ({...f, brojNaloga: e.target.value}))} />
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">{t('route2')}</label>
                                    <input className="form-input" value={formData.relacija} onChange={e => setFormData(f => ({...f, relacija: e.target.value}))} />
                                </div>

                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">{t('dateOut')}</label>
                                        <DateInput value={formData.datumPolaska} onChange={v => setFormData(f => ({...f, datumPolaska: v}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('dateIn')}</label>
                                        <DateInput value={formData.datumPovratka} onChange={v => setFormData(f => ({...f, datumPovratka: v}))} />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{t('purpose')}</label>
                                    <textarea className="form-input" rows="2" value={formData.svrha} onChange={e => setFormData(f => ({...f, svrha: e.target.value}))} />
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
                            setFormData({ vehicleId: '', vozacId: '', vozacIme: '', brojNaloga: '', relacija: '', svrha: '', datumPolaska: new Date().toISOString().split('T')[0], datumPovratka: '' }); 
                            setVehicleSearch(''); setWorkerSearch(''); setShowForm(true); 
                        }}>+ {t('newOrder1')}</button>
                        <SavedFlash />
                        <input className="form-input" style={{ maxWidth: 300, marginLeft: 12 }} placeholder={t('searchOrders')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        {selectedIds.size> 0 ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {t('odabrano1')}</span>
                                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {t('obrisi')}</button>
                            </div>
                        ) : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sorted.length} {t('orders')}</span>}
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                    <th style={{ width: 90 }}>{t('actions')}</th>
                                    <th onClick={() => toggleSort('brojNaloga')} style={thStyle('brojNaloga')}>{t('orderNo1')}{sortIcon('brojNaloga')}</th>
                                    <th onClick={() => toggleSort('vehicleReg')} style={thStyle('vehicleReg')}>{t('vozilo1')}{sortIcon('vehicleReg')}</th>
                                    <th onClick={() => toggleSort('workerName')} style={thStyle('workerName')}>{t('driver8')}{sortIcon('workerName')}</th>
                                    <th onClick={() => toggleSort('relacija')} style={thStyle('relacija')}>{t('route3')}{sortIcon('relacija')}</th>
                                    <th onClick={() => toggleSort('datumPolaska')} style={thStyle('datumPolaska')}>{t('dateOut1')}{sortIcon('datumPolaska')}</th>
                                    <th onClick={() => toggleSort('datumPovratka')} style={thStyle('datumPovratka')}>{t('dateIn1')}{sortIcon('datumPovratka')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map(o => (
                                    <tr key={o.id} onClick={() => openInFleet(o.vehicleId)} style={{ cursor: 'pointer' }}>
                                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleOne(o.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onClick={e => openMenu(o.id, e)}>{t('akcije')} ▼</button>
                                                {actionMenuId === o.id && (<>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setActionMenuId(null); }} />
                                                    <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                        <button onClick={() => { setActionMenuId(null); openInFleet(o.vehicleId); }} className="dropdown-item">✏️ {t('otvori')}</button>
                                                        <button onClick={() => { setActionMenuId(null); handleCopy(o); }} className="dropdown-item">📋 {t('kopiraj')}</button>
                                                        <button onClick={() => { setActionMenuId(null); handlePrint(o); }} className="dropdown-item">🖨️ {t('printaj')}</button>
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => { setActionMenuId(null); handleDelete(o.id); }} className="dropdown-item text-danger">🗑️ {t('izbrisi')}</button>
                                                    </div>
                                                </>)}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{o.brojNaloga || '—'}</td>
                                        <td style={{ fontWeight: 600 }}>{o.vehicleReg}</td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <button onClick={() => { if (o.vozacId) setViewWorkerId(o.vozacId); }}
                                                style={{ background: 'none', border: 'none', cursor: o.vozacId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: o.vozacId ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}>
                                                {o.workerName}
                                            </button>
                                        </td>
                                        <td>{o.relacija || '—'}</td>
                                        <td>{formatDate(o.datumPolaska)}</td>
                                        <td>{formatDate(o.datumPovratka) || '—'}</td>
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

export default function FleetOrders() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>⏳</div>}>
            <SubscriptionGate moduleKey="grpFleet">
                <FleetOrdersInner />
            </SubscriptionGate>
        </Suspense>
    );
}
