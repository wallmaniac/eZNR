'use client';
import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';

function FleetOrdersInner() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();

    const [orders, setOrders] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

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

    const loadData = useCallback(() => {
        setOrders(getAll(COLLECTIONS.TRAVEL_ORDERS));
        setVehicles(getAll(COLLECTIONS.VEHICLES));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

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
            vehicleReg: v ? v.registracija : 'Nepoznato',
            workerName: w ? `${w.ime} ${w.prezime}` : (o.vozacIme || 'Nepoznato'),
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
        router.push(`/dashboard/fleet?openId=${vehicleId}&tab=nalozi`);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (await confirm(bs ? 'Obrisati ovaj nalog?' : 'Delete this order?')) {
            remove(COLLECTIONS.TRAVEL_ORDERS, id);
            loadData();
        }
    };

    const handleSave = async () => {
        if (!formData.vehicleId) { await alert(bs ? 'Odaberite vozilo!' : 'Select vehicle!'); return; }
        if (!formData.brojNaloga) { await alert(bs ? 'Unesite broj naloga!' : 'Enter order number!'); return; }
        
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: '1.6rem' }}>📝</span>
                <div>
                    <h1 style={{ margin: 0 }}>{bs ? 'Putni Nalozi' : 'Travel Orders'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {bs ? 'Evidencija svih putnih naloga unutar voznog parka.' : 'Log of all travel orders generated within the fleet.'}
                    </p>
                </div>
            </div>

            {/* Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>+ {bs ? 'Novi putni nalog' : 'New Travel Order'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" ref={vRef} style={{ position: 'relative' }}>
                                        <label className="form-label">{bs ? 'Vozilo' : 'Vehicle'}</label>
                                        <input className="form-input" placeholder="🔍 Pretraži..." value={vehicleSearch} 
                                            onChange={e => { setVehicleSearch(e.target.value); setShowVSearch(true); setFormData(f => ({...f, vehicleId: ''})); }} 
                                            onFocus={() => setShowVSearch(true)} />
                                        {showVSearch && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                                                {fv.length === 0 ? <div style={{ padding: 8 }}>Nema rezultata</div> : fv.slice(0, 10).map(v => (
                                                    <div key={v.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} 
                                                        onClick={() => { setFormData(f => ({...f, vehicleId: v.id})); setVehicleSearch(v.registracija); setShowVSearch(false); }}>
                                                        <strong>{v.registracija}</strong> - {v.marka}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {formData.vehicleId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ Odabrano</div>}
                                    </div>

                                    <div className="form-group" ref={wRef} style={{ position: 'relative' }}>
                                        <label className="form-label">{bs ? 'Vozač' : 'Driver'}</label>
                                        <input className="form-input" placeholder="🔍 Pretraži..." value={workerSearch} 
                                            onChange={e => { setWorkerSearch(e.target.value); setShowWSearch(true); setFormData(f => ({...f, vozacId: '', vozacIme: ''})); }} 
                                            onFocus={() => setShowWSearch(true)} />
                                        {showWSearch && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                                                {fw.length === 0 ? <div style={{ padding: 8 }}>Nema rezultata</div> : fw.slice(0, 10).map(w => (
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
                                    <label className="form-label">{bs ? 'Broj naloga' : 'Order No.'} <span style={{color: 'var(--danger)'}}>*</span></label>
                                    <input className="form-input" value={formData.brojNaloga} onChange={e => setFormData(f => ({...f, brojNaloga: e.target.value}))} />
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Relacija' : 'Route'}</label>
                                    <input className="form-input" value={formData.relacija} onChange={e => setFormData(f => ({...f, relacija: e.target.value}))} />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum polaska' : 'Date Out'}</label>
                                        <input className="form-input" type="date" value={formData.datumPolaska} onChange={e => setFormData(f => ({...f, datumPolaska: e.target.value}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum povratka' : 'Date In'}</label>
                                        <input className="form-input" type="date" value={formData.datumPovratka} onChange={e => setFormData(f => ({...f, datumPovratka: e.target.value}))} />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Svrha puta' : 'Purpose'}</label>
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
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => { 
                            setFormData({ vehicleId: '', vozacId: '', vozacIme: '', brojNaloga: '', relacija: '', svrha: '', datumPolaska: new Date().toISOString().split('T')[0], datumPovratka: '' }); 
                            setVehicleSearch(''); setWorkerSearch(''); setShowForm(true); 
                        }}>+ {bs ? 'Novi nalog' : 'New Order'}</button>
                        <SavedFlash />
                        <input className="form-input" style={{ maxWidth: 300, marginLeft: 12 }} placeholder={bs ? '🔍 Pretraži naloge...' : '🔍 Search orders...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sorted.length} {bs ? 'naloga' : 'orders'}</span>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th onClick={() => toggleSort('brojNaloga')} style={thStyle('brojNaloga')}>{bs ? 'Broj Naloga' : 'Order No.'}{sortIcon('brojNaloga')}</th>
                                    <th onClick={() => toggleSort('vehicleReg')} style={thStyle('vehicleReg')}>{bs ? 'Vozilo' : 'Vehicle'}{sortIcon('vehicleReg')}</th>
                                    <th onClick={() => toggleSort('workerName')} style={thStyle('workerName')}>{bs ? 'Vozač' : 'Driver'}{sortIcon('workerName')}</th>
                                    <th onClick={() => toggleSort('relacija')} style={thStyle('relacija')}>{bs ? 'Relacija' : 'Route'}{sortIcon('relacija')}</th>
                                    <th onClick={() => toggleSort('datumPolaska')} style={thStyle('datumPolaska')}>{bs ? 'Datum Polaska' : 'Date Out'}{sortIcon('datumPolaska')}</th>
                                    <th onClick={() => toggleSort('datumPovratka')} style={thStyle('datumPovratka')}>{bs ? 'Datum Povratka' : 'Date In'}{sortIcon('datumPovratka')}</th>
                                    <th style={{ width: 80, textAlign: 'center' }}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map(o => (
                                    <tr key={o.id} onClick={() => openInFleet(o.vehicleId)} style={{ cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td style={{ fontWeight: 600 }}>{o.brojNaloga || '—'}</td>
                                        <td style={{ fontWeight: 600 }}>{o.vehicleReg}</td>
                                        <td>{o.workerName}</td>
                                        <td>{o.relacija || '—'}</td>
                                        <td>{formatDate(o.datumPolaska)}</td>
                                        <td>{formatDate(o.datumPovratka) || '—'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: 4 }} onClick={(e) => handleDelete(e, o.id)} title={bs ? 'Briši' : 'Delete'}>🗑️</button>
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

export default function FleetOrders() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
            <FleetOrdersInner />
        </Suspense>
    );
}
