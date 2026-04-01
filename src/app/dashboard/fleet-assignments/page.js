'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';

function FleetAssignmentsInner() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();

    const [assignments, setAssignments] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = useCallback(() => {
        setAssignments(getAll(COLLECTIONS.VEHICLE_ASSIGNMENTS));
        setVehicles(getAll(COLLECTIONS.VEHICLES));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

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

            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input className="form-input" style={{ maxWidth: 300 }} placeholder={bs ? '🔍 Pretraži zaduženja...' : '🔍 Search assignments...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
