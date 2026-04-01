'use client';
import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, update, COLLECTIONS, formatDate, genId } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';

function FleetDocumentsInner() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();

    const [vehicles, setVehicles] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ vehicleId: '', naziv: '', kategorija: 'Ostalo', datumIzdavanja: '', datumIsteka: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [showVSearch, setShowVSearch] = useState(false);
    const vRef = useRef(null);

    const loadData = useCallback(() => {
        setVehicles(getAll(COLLECTIONS.VEHICLES));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        const handler = (e) => {
            if (vRef.current && !vRef.current.contains(e.target)) setShowVSearch(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            if (!formData.naziv) setFormData(f => ({...f, naziv: file.name}));
        }
    };

    const handleSave = async () => {
        if (!formData.vehicleId) { await alert(bs ? 'Odaberite vozilo!' : 'Select vehicle!'); return; }
        if (!selectedFile && !formData.naziv) { await alert(bs ? 'Odaberite datoteku i unesite naziv!' : 'Select file and enter name!'); return; }

        const v = vehicles.find(x => x.id === formData.vehicleId);
        if (!v) return;

        // If a file is selected we process it using standard logic, or just push metadata.
        const newDoc = {
            id: genId(),
            naziv: formData.naziv || (selectedFile ? selectedFile.name : 'Dokument'),
            kategorija: formData.kategorija,
            datumIzdavanja: formData.datumIzdavanja,
            datumIsteka: formData.datumIsteka,
            velicina: selectedFile ? (selectedFile.size / 1024).toFixed(1) + ' KB' : '',
            datumUpisa: new Date().toISOString(),
        };

        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                newDoc.docData = e.target.result;
                const updatedDocs = [...(v.dokumenti || []), newDoc];
                update(COLLECTIONS.VEHICLES, v.id, { dokumenti: updatedDocs });
                setShowForm(false);
                setSelectedFile(null);
                loadData();
                showFlash();
            };
            reader.readAsDataURL(selectedFile);
        } else {
            const updatedDocs = [...(v.dokumenti || []), newDoc];
            update(COLLECTIONS.VEHICLES, v.id, { dokumenti: updatedDocs });
            setShowForm(false);
            loadData();
            showFlash();
        }
    };

    const fv = vehicles.filter(v => !vehicleSearch || `${v.registracija} ${v.marka}`.toLowerCase().includes(vehicleSearch.toLowerCase()));

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

            {/* Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>+ {bs ? 'Novi dokument' : 'New Document'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                
                                <div className="form-group" ref={vRef} style={{ position: 'relative' }}>
                                    <label className="form-label">{bs ? 'Vozilo' : 'Vehicle'} <span style={{color: 'var(--danger)'}}>*</span></label>
                                    <input className="form-input" placeholder="🔍 Pretraži vozila..." value={vehicleSearch} 
                                        onChange={e => { setVehicleSearch(e.target.value); setShowVSearch(true); setFormData(f => ({...f, vehicleId: ''})); }} 
                                        onFocus={() => setShowVSearch(true)} />
                                    {showVSearch && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
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

                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Datoteka' : 'File'} <span style={{color: 'var(--danger)'}}>*</span></label>
                                    <input type="file" className="form-input" onChange={handleFileChange} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Naziv dokumenta' : 'Document Name'} <span style={{color: 'var(--danger)'}}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={e => setFormData(f => ({...f, naziv: e.target.value}))} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Kategorija' : 'Category'}</label>
                                    <select className="form-select" value={formData.kategorija} onChange={e => setFormData(f => ({...f, kategorija: e.target.value}))}>
                                        <option value="Osiguranje">Osiguranje / Insurance</option>
                                        <option value="Saobraćajna / Prometna">Saobraćajna / Registration</option>
                                        <option value="Tehnički pregled">Tehnički pregled / Technical</option>
                                        <option value="Zeleni karton">Zeleni karton / Green Card</option>
                                        <option value="Ostalo">Ostalo / Other</option>
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum izdavanja' : 'Issue Date'}</label>
                                        <input className="form-input" type="date" value={formData.datumIzdavanja} onChange={e => setFormData(f => ({...f, datumIzdavanja: e.target.value}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum isteka' : 'Expiry Date'}</label>
                                        <input className="form-input" type="date" value={formData.datumIsteka} onChange={e => setFormData(f => ({...f, datumIsteka: e.target.value}))} />
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
                            setFormData({ vehicleId: '', naziv: '', kategorija: 'Ostalo', datumIzdavanja: '', datumIsteka: '' }); 
                            setVehicleSearch(''); setSelectedFile(null); setShowForm(true); 
                        }}>+ {bs ? 'Novi dokument' : 'New Document'}</button>
                        <SavedFlash />
                        <input className="form-input" style={{ maxWidth: 300, marginLeft: 12 }} placeholder={bs ? '🔍 Pretraži dokumente...' : '🔍 Search documents...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
