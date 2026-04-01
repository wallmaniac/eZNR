import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

export default function VehicleAssignmentsTab({ vehicleId, vehicles, assignments, workers, reloadData }) {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const { confirm, prompt } = useDialog();

    // The vehicle
    const vehicle = vehicles.find(v => v.id === vehicleId) || {};
    
    // Filter assignments for this vehicle
    const history = assignments.filter(a => a.vehicleId === vehicleId).sort((a,b) => new Date(b.datumZaduzenja) - new Date(a.datumZaduzenja));
    
    // Check if there's an active assignment (no datumRazduzenja)
    const activeAssig = history.find(a => !a.datumRazduzenja);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ workerId: '', workerIme: '', datumZaduzenja: new Date().toISOString().split('T')[0], pocetnaKilometraza: '' });
    
    // worker dropdown
    const [search, setSearch] = useState('');
    const [showW, setShowW] = useState(false);

    const handleAssign = async () => {
        if (!form.workerId) {
            alert("Odaberite vozača!");
            return;
        }
        // create assignment
        create(COLLECTIONS.VEHICLE_ASSIGNMENTS, {
            vehicleId,
            workerId: form.workerId,
            workerIme: form.workerIme,
            datumZaduzenja: form.datumZaduzenja,
            pocetnaKilometraza: form.pocetnaKilometraza,
            datumRazduzenja: '',
            zavrsnaKilometraza: ''
        });
        // update vehicle
        update(COLLECTIONS.VEHICLES, vehicleId, { vozacId: form.workerId, vozacIme: form.workerIme });
        setShowForm(false);
        reloadData();
    };

    const handleUnassign = async (assigId) => {
        const d = await prompt(bs ? 'Unesite datum razduženja (YYYY-MM-DD)' : 'Enter return date', new Date().toISOString().split('T')[0]);
        if (d === null) return;
        const k = await prompt(bs ? 'Unesite završnu kilometražu' : 'Enter final mileage', '');
        if (k === null) return;

        update(COLLECTIONS.VEHICLE_ASSIGNMENTS, assigId, { datumRazduzenja: d, zavrsnaKilometraza: k });
        // remove driver from vehicle
        update(COLLECTIONS.VEHICLES, vehicleId, { vozacId: '', vozacIme: '' });
        reloadData();
    };

    const handleDelete = async (assigId) => {
        if (await confirm(bs ? 'Brisati ovu historiju?' : 'Delete history record?')) {
            remove(COLLECTIONS.VEHICLE_ASSIGNMENTS, assigId);
            reloadData();
        }
    };

    const fw = workers.filter(w => (search ? `${w.ime} ${w.prezime}`.toLowerCase().includes(search.toLowerCase()) : true));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px 0' }}>{bs ? 'Historija zaduženja' : 'Assignment History'}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {bs ? 'Mjesto za kreiranje novog zaduženja i razduženja vozila.' : 'Space for assigning drivers and tracking mileage parameters.'}
                    </p>
                </div>
                {!activeAssig && !showForm && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setForm({ workerId: '', workerIme: '', datumZaduzenja: new Date().toISOString().split('T')[0], pocetnaKilometraza: '' }); setSearch(''); }}>
                        + {bs ? 'Novo zaduženje' : 'New Assignment'}
                    </button>
                )}
            </div>

            {showForm && (
                <div style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{bs ? 'Dodijeli vozilo vozaču' : 'Assign to Driver'}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group" style={{ position: 'relative' }}>
                            <label className="form-label">{bs ? 'Vozač' : 'Driver'}</label>
                            <input className="form-input" placeholder={bs ? '🔍 Pretraži...' : 'Search...'} value={search} onChange={e => { setSearch(e.target.value); setShowW(true); setForm(f => ({...f, workerId:'', workerIme:''})) }} onFocus={() => setShowW(true)} />
                            {showW && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                                    {fw.length === 0 ? <div style={{ padding: 8 }}>Nema</div> : fw.slice(0, 10).map(w => (
                                        <div key={w.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} onClick={() => { setForm(f => ({...f, workerId: w.id, workerIme: `${w.ime} ${w.prezime}`})); setSearch(`${w.ime} ${w.prezime}`); setShowW(false); }}>
                                            {w.ime} {w.prezime}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">{bs ? 'Datum zaduženja' : 'Date Given'}</label>
                            <input className="form-input" type="date" value={form.datumZaduzenja} onChange={e => setForm(f => ({...f, datumZaduzenja: e.target.value}))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{bs ? 'Početna kilometraža' : 'Starting Mileage'}</label>
                            <input className="form-input" type="number" value={form.pocetnaKilometraza} onChange={e => setForm(f => ({...f, pocetnaKilometraza: e.target.value}))} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button className="btn btn-primary btn-sm" onClick={handleAssign}>💾 {t('save')}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                    </div>
                </div>
            )}

            <div className="data-table-wrapper" style={{ marginTop: 8 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{bs ? 'Vozač' : 'Driver'}</th>
                            <th>{bs ? 'Preuzeo' : 'Assigned On'}</th>
                            <th>{bs ? 'Početna KM' : 'Start KM'}</th>
                            <th>{bs ? 'Vratio' : 'Returned On'}</th>
                            <th>{bs ? 'Završna KM' : 'End KM'}</th>
                            <th style={{ width: 80 }}>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>{bs ? 'Nema zaduženja' : 'No history found'}</td></tr>
                        ) : history.map((h, i) => (
                            <tr key={h.id} style={{ opacity: (!h.datumRazduzenja || i===0) ? 1 : 0.75 }}>
                                <td style={{ fontWeight: 700 }}>
                                    {h.workerIme} 
                                    {!h.datumRazduzenja && <span className="badge badge-success" style={{ marginLeft: 6 }}>Aktivno</span>}
                                </td>
                                <td>{formatDate(h.datumZaduzenja)}</td>
                                <td>{h.pocetnaKilometraza ? `${h.pocetnaKilometraza} km` : '—'}</td>
                                <td>{h.datumRazduzenja ? formatDate(h.datumRazduzenja) : '—'}</td>
                                <td>{h.zavrsnaKilometraza ? `${h.zavrsnaKilometraza} km` : '—'}</td>
                                <td>
                                    {!h.datumRazduzenja ? (
                                        <button className="btn btn-warning btn-sm" onClick={() => handleUnassign(h.id)} title="Razduži">↩️ {bs ? 'Razduži' : 'Unassign'}</button>
                                    ) : (
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(h.id)} style={{ color: 'var(--danger)' }}>🗑️</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
