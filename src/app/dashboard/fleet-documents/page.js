'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, update, COLLECTIONS, formatDate, genId } from '@/lib/dataStore';
import { useAuth } from '@/contexts/AuthContext';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { uploadSecureFile, deleteSecureFile } from '@/lib/storageService';
import PageHeader from '@/components/PageHeader';

function FleetDocumentsInner() {
    const { t, lang } = useLanguage();
    const { activeCompanyId } = useAuth();
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

    // Action menu
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({});
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    // Upload progress
    const [uploadProgress, setUploadProgress] = useState(null);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState(new Set());

    const loadData = useCallback(() => {
        setVehicles(getAll(COLLECTIONS.VEHICLES));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

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
        router.push(`/dashboard/fleet?openId=${vehicleId}&tab=arhiva&returnTo=${encodeURIComponent('/dashboard/fleet-documents')}`);
    };

    const openMenu = (id, e) => {
        e.stopPropagation();
        if (actionMenuId === id) { setActionMenuId(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const flipUp = spaceBelow < 220;
        setMenuPos(flipUp
            ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, rect.top - 8) }
            : { top: rect.bottom + 4, left: rect.left, maxH: Math.max(120, spaceBelow) });
        setActionMenuId(id);
    };

    const handleDownload = (doc) => {
        const url = doc.fileUrl || doc.docData;
        if (!url) return;
        if (doc.fileUrl) {
            // Firebase Storage URL — open directly, browser handles download
            window.open(doc.fileUrl, '_blank');
        } else {
            // Legacy base64 fallback
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.docName || doc.naziv;
            a.click();
        }
    };

    const handlePrint = (doc) => {
        const url = doc.fileUrl || doc.docData;
        if (!url) return;
        window.open(url, '_blank');
    };

    const handleCopy = (doc) => {
        const v = vehicles.find(x => x.id === doc.vehicleId);
        if (!v) return;
        const newDoc = {
            id: genId(),
            naziv: (doc.naziv || 'Dokument') + ' (Kopija)',
            kategorija: doc.kategorija || 'Ostalo',
            datumIzdavanja: doc.datumIzdavanja || '',
            datumIsteka: doc.datumIsteka || '',
            velicina: doc.velicina || '',
            datumUpisa: new Date().toISOString(),
            docData: doc.docData || null,
        };
        const updatedDocs = [...(v.dokumenti || []), newDoc];
        update(COLLECTIONS.VEHICLES, v.id, { dokumenti: updatedDocs });
        setActionMenuId(null);
        loadData();
        showFlash();
    };

    const handleDelete = async (doc) => {
        if (await confirm(bs ? 'Obrisati ovaj dokument?' : 'Delete this document?')) {
            const v = vehicles.find(x => x.id === doc.vehicleId);
            if (v && v.dokumenti) {
                // Delete from Firebase Storage if it was uploaded there
                if (doc.storagePath) await deleteSecureFile(activeCompanyId, doc.storagePath, doc.fileSize || 0);
                const newDocs = v.dokumenti.filter(d => d.id !== doc.id);
                update(COLLECTIONS.VEHICLES, doc.vehicleId, { dokumenti: newDocs });
                setActionMenuId(null);
                loadData();
            }
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(bs ? `Obrisati ${selectedIds.size} dokumenata?` : `Delete ${selectedIds.size} documents?`)) {
            const vehicleUpdates = {};
            for (const doc of docs) {
                if (selectedIds.has(doc.id)) {
                    if (!vehicleUpdates[doc.vehicleId]) {
                        const v = vehicles.find(x => x.id === doc.vehicleId);
                        vehicleUpdates[doc.vehicleId] = [...(v?.dokumenti || [])];
                    }
                    vehicleUpdates[doc.vehicleId] = vehicleUpdates[doc.vehicleId].filter(d => d.id !== doc.id);
                }
            }
            for (const [vid, updatedDocs] of Object.entries(vehicleUpdates)) {
                update(COLLECTIONS.VEHICLES, vid, { dokumenti: updatedDocs });
            }
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
            try {
                setUploadProgress(0);
                const { url, storagePath } = await uploadSecureFile(
                    activeCompanyId,
                    'fleet-documents',
                    selectedFile,
                    (pct) => setUploadProgress(pct)
                );
                newDoc.fileUrl = url;
                newDoc.storagePath = storagePath;
                newDoc.docName = selectedFile.name;
            } catch (err) {
                setUploadProgress(null);
                await alert(bs ? `Greška pri uploadu: ${err.message}` : `Upload error: ${err.message}`);
                return;
            }
            setUploadProgress(null);
        }

        const updatedDocs = [...(v.dokumenti || []), newDoc];
        update(COLLECTIONS.VEHICLES, v.id, { dokumenti: updatedDocs });
        setShowForm(false);
        setSelectedFile(null);
        loadData();
        showFlash();
    };

    const fv = vehicles.filter(v => !vehicleSearch || `${v.registracija} ${v.marka}`.toLowerCase().includes(vehicleSearch.toLowerCase()));

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader icon="📁" title={bs ? 'Dokumentacija Vozila' : 'Vehicle Documents'} />

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
                                    {uploadProgress !== null && (
                                        <div style={{ marginTop: 8 }}>
                                            <div style={{ height: 6, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--primary)', transition: 'width 0.2s', borderRadius: 4 }} />
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{bs ? 'Učitavanje' : 'Uploading'} {uploadProgress}%...</div>
                                        </div>
                                    )}
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

                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum izdavanja' : 'Issue Date'}</label>
                                        <DateInput value={formData.datumIzdavanja} onChange={v => setFormData(f => ({...f, datumIzdavanja: v}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum isteka' : 'Expiry Date'}</label>
                                        <DateInput value={formData.datumIsteka} onChange={v => setFormData(f => ({...f, datumIsteka: v}))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={uploadProgress !== null}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={uploadProgress !== null}>
                                {uploadProgress !== null ? `${bs ? 'Učitavanje' : 'Uploading'} ${uploadProgress}%...` : `💾 ${t('save')}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>`n<div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => { 
                            setFormData({ vehicleId: '', naziv: '', kategorija: 'Ostalo', datumIzdavanja: '', datumIsteka: '' }); 
                            setVehicleSearch(''); setSelectedFile(null); setShowForm(true); 
                        }}>+ {bs ? 'Novi dokument' : 'New Document'}</button>
                        <SavedFlash />
                        <input className="form-input" style={{ maxWidth: 300, marginLeft: 12 }} placeholder={bs ? '🔍 Pretraži dokumente...' : '🔍 Search documents...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        {selectedIds.size > 0 ? (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {bs ? 'odabrano' : 'selected'}</span>
                                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                            </div>
                        ) : <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sorted.length} {bs ? 'dokumenata' : 'documents'}</span>}
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                    <th style={{ width: 90 }}>{t('actions')}</th>
                                    <th onClick={() => toggleSort('vehicleReg')} style={thStyle('vehicleReg')}>{bs ? 'Vozilo' : 'Vehicle'}{sortIcon('vehicleReg')}</th>
                                    <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{bs ? 'Naziv dokumenta' : 'Document Name'}{sortIcon('naziv')}</th>
                                    <th onClick={() => toggleSort('kategorija')} style={thStyle('kategorija')}>{bs ? 'Kategorija' : 'Category'}{sortIcon('kategorija')}</th>
                                    <th onClick={() => toggleSort('datumIzdavanja')} style={thStyle('datumIzdavanja')}>{bs ? 'Datum Izdavanja' : 'Date Issued'}{sortIcon('datumIzdavanja')}</th>
                                    <th onClick={() => toggleSort('datumIsteka')} style={thStyle('datumIsteka')}>{bs ? 'Datum Isteka' : 'Expiry Date'}{sortIcon('datumIsteka')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map(d => (
                                    <tr key={d.id} onClick={() => openInFleet(d.vehicleId)} style={{ cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleOne(d.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onClick={e => openMenu(d.id, e)}>{bs ? 'Akcije' : 'Actions'} ▼</button>
                                                {actionMenuId === d.id && (<>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setActionMenuId(null); }} />
                                                    <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 210, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                        <button onClick={() => { setActionMenuId(null); openInFleet(d.vehicleId); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✏️ {bs ? 'Otvori' : 'Open'}</button>
                                                        {d.docData && <button onClick={() => { setActionMenuId(null); handleDownload(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📑 {bs ? 'Preuzmi dokument' : 'Download'}</button>}
                                                        {d.docData && <button onClick={() => { setActionMenuId(null); handlePrint(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🖨️ {bs ? 'Printaj' : 'Print'}</button>}
                                                        <button onClick={() => { setActionMenuId(null); handleCopy(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📋 {bs ? 'Kopiraj' : 'Copy'}</button>
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => { setActionMenuId(null); handleDelete(d); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                                    </div>
                                                </>)}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{d.vehicleReg}</td>
                                        <td>{d.naziv}</td>
                                        <td>{d.kategorija}</td>
                                        <td>{formatDate(d.datumIzdavanja) || '—'}</td>
                                        <td>{formatDate(d.datumIsteka) || '—'}</td>
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
