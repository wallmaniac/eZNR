import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { update, COLLECTIONS, formatDate, genId } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

export default function VehicleDocumentsTab({ vehicleId, vehicles, reloadData }) {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const { confirm } = useDialog();
    const fileRef = useRef(null);

    const vehicle = vehicles.find(v => v.id === vehicleId) || {};
    const docs = vehicle.dokumenti || [];

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const newDoc = {
            id: genId(),
            naziv: file.name,
            kategorija: 'Ostalo', // can be Osiguranje, Saobraćajna...
            velicina: (file.size / 1024).toFixed(1) + ' KB',
            datumUpisa: new Date().toISOString(),
        };

        const updatedDocs = [...docs, newDoc];
        update(COLLECTIONS.VEHICLES, vehicleId, { dokumenti: updatedDocs });
        reloadData();
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleDelete = async (docId) => {
        if (await confirm(bs ? 'Brisati dokument?' : 'Delete document?')) {
            const updatedDocs = docs.filter(d => d.id !== docId);
            update(COLLECTIONS.VEHICLES, vehicleId, { dokumenti: updatedDocs });
            reloadData();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                    <h3 style={{ margin: '0 0 4px 0' }}>{bs ? 'Arhiva dokumenata' : 'Document Archive'}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {bs ? 'Police osiguranja, saobraćajne dozvole, tehnički pregledi.' : 'Insurance policies, registration, and technical inspections.'}
                    </p>
                </div>
                <div>
                    <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleFileUpload} />
                    <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
                        📁 {bs ? 'Učitaj dokument' : 'Upload File'}
                    </button>
                </div>
            </div>

            <div className="data-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{bs ? 'Naziv dokumenta' : 'Document Name'}</th>
                            <th>{bs ? 'Datum' : 'Date Added'}</th>
                            <th>{bs ? 'Veličina' : 'Size'}</th>
                            <th style={{ width: 80 }}>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>{bs ? 'Nema učitanih dokumenata' : 'No documents uploaded'}</td></tr>
                        ) : docs.sort((a,b)=> new Date(b.datumUpisa) - new Date(a.datumUpisa)).map(d => (
                            <tr key={d.id}>
                                <td style={{ fontWeight: 600 }}>📄 {d.naziv}</td>
                                <td>{formatDate(d.datumUpisa)}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{d.velicina}</td>
                                <td>
                                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(d.id)} style={{ color: 'var(--danger)' }} title={bs ? 'Obriši' : 'Delete'}>
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
