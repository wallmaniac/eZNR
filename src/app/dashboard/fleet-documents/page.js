'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate, update } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';

function FleetDocumentsInner() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const router = useRouter();
    const { confirm, DialogRenderer } = useDialog();

    const [vehicles, setVehicles] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = useCallback(() => {
        setVehicles(getAll(COLLECTIONS.VEHICLES));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const docs = [];
    vehicles.forEach(v => {
        if (Array.isArray(v.dokumenti)) {
            v.dokumenti.forEach(d => {
                docs.push({ ...d, vehicleId: v.id, vehicleReg: v.registracija || 'Nepoznato' });
            });
        }
    });

    const filtered = docs.filter(item => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (item.vehicleReg || '').toLowerCase().includes(q) ||
               (item.naziv || '').toLowerCase().includes(q) ||
               (item.kategorija || '').toLowerCase().includes(q);
    });

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datumIzdavanja', 'desc');

    const openInFleet = (vehicleId) => {
        router.push(`/dashboard/fleet?openId=${vehicleId}&tab=arhiva`);
    };

    const handleDownload = (e, doc) => {
        e.stopPropagation();
        if (!doc.docData) return;
        const a = document.createElement('a');
        a.href = doc.docData;
        a.download = doc.docName || doc.naziv;
        a.click();
    };

    const handleDelete = async (e, doc) => {
        e.stopPropagation();
        if (await confirm(bs ? 'Obrisati ovaj dokument?' : 'Delete this document?')) {
            const v = vehicles.find(x => x.id === doc.vehicleId);
            if (v && v.dokumenti) {
                const newDocs = v.dokumenti.filter(d => d.id !== doc.id);
                update(COLLECTIONS.VEHICLES, doc.vehicleId, { dokumenti: newDocs });
                loadData();
            }
        }
    };

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <span style={{ fontSize: '1.6rem' }}>📁</span>
                <div>
                    <h1 style={{ margin: 0 }}>{bs ? 'Dokumentacija Vozila' : 'Vehicle Documents'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {bs ? 'Pregled svih učitanih dokumenata na nivou cijelog voznog parka.' : 'Central archive of all uploaded vehicle documents.'}
                    </p>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input className="form-input" style={{ maxWidth: 300 }} placeholder={bs ? '🔍 Pretraži dokumente...' : '🔍 Search documents...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sorted.length} {bs ? 'dokumenata' : 'documents'}</span>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th onClick={() => toggleSort('vehicleReg')} style={thStyle('vehicleReg')}>{bs ? 'Vozilo' : 'Vehicle'}{sortIcon('vehicleReg')}</th>
                                    <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{bs ? 'Naziv dokumenta' : 'Document Name'}{sortIcon('naziv')}</th>
                                    <th onClick={() => toggleSort('kategorija')} style={thStyle('kategorija')}>{bs ? 'Kategorija' : 'Category'}{sortIcon('kategorija')}</th>
                                    <th onClick={() => toggleSort('datumIzdavanja')} style={thStyle('datumIzdavanja')}>{bs ? 'Datum Izdavanja' : 'Date Issued'}{sortIcon('datumIzdavanja')}</th>
                                    <th onClick={() => toggleSort('datumIsteka')} style={thStyle('datumIsteka')}>{bs ? 'Datum Isteka' : 'Expiry Date'}{sortIcon('datumIsteka')}</th>
                                    <th>{bs ? 'Datoteka' : 'File'}</th>
                                    <th style={{ width: 80, textAlign: 'center' }}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map(d => (
                                    <tr key={d.id} onClick={() => openInFleet(d.vehicleId)} style={{ cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td style={{ fontWeight: 600 }}>{d.vehicleReg}</td>
                                        <td>{d.naziv}</td>
                                        <td>{d.kategorija}</td>
                                        <td>{formatDate(d.datumIzdavanja) || '—'}</td>
                                        <td>{formatDate(d.datumIsteka) || '—'}</td>
                                        <td>
                                            {d.docData ? (
                                                 <button onClick={(e) => handleDownload(e, d)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, padding: 0 }}>📑 {bs ? 'Preuzmi' : 'Download'}</button>
                                            ) : '—'}
                                        </td>
                                        <td style={{ textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center' }}>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: 4 }} onClick={(e) => handleDelete(e, d)} title={bs ? 'Briši' : 'Delete'}>🗑️</button>
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

export default function FleetDocuments() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
            <FleetDocumentsInner />
        </Suspense>
    );
}
