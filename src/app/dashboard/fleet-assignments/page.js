'use client';
import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';

function FleetAssignmentsInner() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();

    const [assignments, setAssignments] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ vehicleId: '', workerId: '', workerIme: '', datumZaduzenja: new Date().toISOString().split('T')[0], pocetnaKilometraza: '' });
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [showVSearch, setShowVSearch] = useState(false);
    const [workerSearch, setWorkerSearch] = useState('');
    const [showWSearch, setShowWSearch] = useState(false);
    const vRef = useRef(null);
    const wRef = useRef(null);

    const loadData = useCallback(() => {
        setAssignments(getAll(COLLECTIONS.VEHICLE_ASSIGNMENTS));
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
        router.push(`/dashboard/fleet?openId=${vehicleId}&tab=istorija`);
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (await confirm(bs ? 'Obrisati ovo zaduženje?' : 'Delete this assignment?')) {
            remove(COLLECTIONS.VEHICLE_ASSIGNMENTS, id);
            loadData();
        }
    };

    const handleSave = async () => {
        if (!formData.vehicleId) { await alert(bs ? 'Odaberite vozilo!' : 'Select vehicle!'); return; }
        if (!formData.workerId) { await alert(bs ? 'Odaberite vozača!' : 'Select driver!'); return; }
        
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: '1.6rem' }}>🔄</span>
                <div>
                    <h1 style={{ margin: 0 }}>{bs ? 'Zaduženja vozila' : 'Vehicle Assignments'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {bs ? 'Pregled svih zaduženja i razduženja u voznom parku.' : 'Overview of all active and past vehicle assignments.'}
                    </p>
                </div>
            </div>

            {/* Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>+ {bs ? 'Novo zaduženje vozila' : 'New Vehicle Assignment'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                
                                <div className="form-group" ref={vRef} style={{ position: 'relative' }}>
                                    <label className="form-label">{bs ? 'Vozilo' : 'Vehicle'}</label>
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
                                    <label className="form-label">{bs ? 'Vozač' : 'Driver'}</label>
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

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum zaduženja' : 'Date Given'}</label>
                                        <input className="form-input" type="date" value={formData.datumZaduzenja} onChange={e => setFormData(f => ({...f, datumZaduzenja: e.target.value}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Početna kilometraža' : 'Starting Mileage'}</label>
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
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => { 
                            setFormData({ vehicleId: '', workerId: '', workerIme: '', datumZaduzenja: new Date().toISOString().split('T')[0], pocetnaKilometraza: '' }); 
                            setVehicleSearch(''); setWorkerSearch(''); setShowForm(true); 
                        }}>+ {bs ? 'Novo zaduženje' : 'New Assignment'}</button>
                        <SavedFlash />
                        <input className="form-input" style={{ maxWidth: 300, marginLeft: 12 }} placeholder={bs ? '🔍 Pretraži zaduženja...' : '🔍 Search assignments...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sorted.length} {bs ? 'zabilješki' : 'records'}</span>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th onClick={() => toggleSort('vehicleReg')} style={thStyle('vehicleReg')}>{bs ? 'Vozilo' : 'Vehicle'}{sortIcon('vehicleReg')}</th>
                                    <th onClick={() => toggleSort('workerName')} style={thStyle('workerName')}>{bs ? 'Vozač' : 'Driver'}{sortIcon('workerName')}</th>
                                    <th onClick={() => toggleSort('datumZaduzenja')} style={thStyle('datumZaduzenja')}>{bs ? 'Datum Zaduženja' : 'Date Assigned'}{sortIcon('datumZaduzenja')}</th>
                                    <th onClick={() => toggleSort('pocetnaKilometraza')} style={thStyle('pocetnaKilometraza')}>{bs ? 'Km Zaduženja' : 'Km Assigned'}{sortIcon('pocetnaKilometraza')}</th>
                                    <th onClick={() => toggleSort('datumRazduzenja')} style={thStyle('datumRazduzenja')}>{bs ? 'Datum Razduženja' : 'Date Returned'}{sortIcon('datumRazduzenja')}</th>
                                    <th onClick={() => toggleSort('zavrsnaKilometraza')} style={thStyle('zavrsnaKilometraza')}>{bs ? 'Km Razduženja' : 'Km Returned'}{sortIcon('zavrsnaKilometraza')}</th>
                                    <th style={{ width: 80, textAlign: 'center' }}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map(a => (
                                    <tr key={a.id} onClick={() => openInFleet(a.vehicleId)} style={{ cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td style={{ fontWeight: 600 }}>{a.vehicleReg}</td>
                                        <td>{a.workerName}</td>
                                        <td>{formatDate(a.datumZaduzenja)}</td>
                                        <td>{a.pocetnaKilometraza || '—'}</td>
                                        <td>{formatDate(a.datumRazduzenja) || <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{bs ? 'Zaduženo' : 'Assigned'}</span>}</td>
                                        <td>{a.zavrsnaKilometraza || '—'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: 4 }} onClick={(e) => handleDelete(e, a.id)} title={bs ? 'Briši zapis' : 'Delete log'}>🗑️</button>
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

export default function FleetAssignments() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
            <FleetAssignmentsInner />
        </Suspense>
    );
}
