'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';

function FleetOrdersInner() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const router = useRouter();
    const { confirm, DialogRenderer } = useDialog();

    const [orders, setOrders] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = useCallback(() => {
        setOrders(getAll(COLLECTIONS.TRAVEL_ORDERS));
        setVehicles(getAll(COLLECTIONS.VEHICLES));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

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

            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input className="form-input" style={{ maxWidth: 300 }} placeholder={bs ? '🔍 Pretraži naloge...' : '🔍 Search orders...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
