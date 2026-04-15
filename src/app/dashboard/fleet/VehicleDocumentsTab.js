import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { update, COLLECTIONS, formatDate, genId } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import DateInput from '@/components/DateInput';

export default function VehicleDocumentsTab({ vehicleId, vehicles, reloadData }) {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const { confirm } = useDialog();
    const vehicle = vehicles.find(v => v.id === vehicleId) || {};
    const docs = vehicle.dokumenti || [];
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ naziv: '', kategorija: 'Ostalo', datumIzdavanja: '', datumIsteka: '' });
    const [selectedFile, setSelectedFile] = useState(null);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
    const [selectedIds, setSelectedIds] = useState(new Set());
    const toggleAll = (e) => setSelectedIds(e.target.checked ? new Set(docs.map(x => x.id)) : new Set());
    const toggleOne = (id) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(bs ? `Obrisati ${selectedIds.size} dokumenata?` : `Delete ${selectedIds.size} documents?`)) {
            const updatedDocs = docs.filter(d => !selectedIds.has(d.id));
            update(COLLECTIONS.VEHICLES, vehicleId, { dokumenti: updatedDocs });
            setSelectedIds(new Set()); reloadData();
        }
    };

    const handleFileChange = (e) => { const file = e.target.files[0]; if (file) { setSelectedFile(file); if (!form.naziv) setForm(f => ({...f, naziv: file.name})); } };

    const handleSave = async () => {
        if (!selectedFile && !form.naziv && !editingId) { alert(bs ? 'Unesite naziv ili odaberite datoteku!' : 'Enter name or select file!'); return; }
        const buildPayload = (dataUri) => {
            if (editingId) {
                return docs.map(d => d.id === editingId ? { ...d, naziv: form.naziv || d.naziv, kategorija: form.kategorija, datumIzdavanja: form.datumIzdavanja, datumIsteka: form.datumIsteka, ...(selectedFile ? { velicina: (selectedFile.size / 1024).toFixed(1) + ' KB', docData: dataUri } : {}) } : d);
            } else {
                return [...docs, { id: genId(), naziv: form.naziv || (selectedFile ? selectedFile.name : 'Dokument'), kategorija: form.kategorija, datumIzdavanja: form.datumIzdavanja, datumIsteka: form.datumIsteka, velicina: selectedFile ? (selectedFile.size / 1024).toFixed(1) + ' KB' : '', datumUpisa: new Date().toISOString(), docData: dataUri }];
            }
        };
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = (e) => { update(COLLECTIONS.VEHICLES, vehicleId, { dokumenti: buildPayload(e.target.result) }); setShowForm(false); setSelectedFile(null); setEditingId(null); reloadData(); };
            reader.readAsDataURL(selectedFile);
        } else {
            update(COLLECTIONS.VEHICLES, vehicleId, { dokumenti: buildPayload(null) }); setShowForm(false); setSelectedFile(null); setEditingId(null); reloadData();
        }
    };

    const handleEdit = (doc) => { setEditingId(doc.id); setForm({ naziv: doc.naziv || '', kategorija: doc.kategorija || 'Ostalo', datumIzdavanja: doc.datumIzdavanja || '', datumIsteka: doc.datumIsteka || '' }); setSelectedFile(null); setShowForm(true); };
    const handleCopy = (doc) => { setEditingId(null); setForm({ naziv: (doc.naziv || 'Dokument') + ' (Kopija)', kategorija: doc.kategorija || 'Ostalo', datumIzdavanja: doc.datumIzdavanja || '', datumIsteka: doc.datumIsteka || '' }); setSelectedFile(null); setShowForm(true); };
    const handleDownload = (doc) => { if (!doc.docData) return; const a = document.createElement('a'); a.href = doc.docData; a.download = doc.naziv; a.click(); };
    const handlePrint = (doc) => {
        if (!doc.docData) return;
        const pw = window.open('', '_blank');
        if (doc.docData.startsWith('data:image/')) { pw.document.write(`<html><body style="margin:0;display:flex;justify-content:center"><img src="${doc.docData}" style="max-width:100%"/></body></html>`); pw.document.close(); setTimeout(() => pw.print(), 500); }
        else if (doc.docData.startsWith('data:application/pdf')) { pw.document.write(`<html><body style="margin:0"><embed width="100%" height="100%" src="${doc.docData}" type="application/pdf"/></body></html>`); pw.document.close(); }
        else { handleDownload(doc); pw.close(); }
    };
    const handleDelete = async (docId) => { if (await confirm(bs ? 'Brisati dokument?' : 'Delete document?')) { const updatedDocs = docs.filter(d => d.id !== docId); update(COLLECTIONS.VEHICLES, vehicleId, { dokumenti: updatedDocs }); reloadData(); } };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                    <h3 style={{ margin: '0 0 4px 0' }}>{bs ? 'Arhiva dokumenata' : 'Document Archive'}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{bs ? 'Police osiguranja, saobraćajne dozvole, tehnički pregledi.' : 'Insurance policies, registration, and technical inspections.'}</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {selectedIds.size > 0 && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {bs ? 'odabrano' : 'selected'}</span>
                            <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                        </div>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => { setEditingId(null); setForm({ naziv: '', kategorija: 'Ostalo', datumIzdavanja: '', datumIsteka: '' }); setSelectedFile(null); setShowForm(true); }}>
                        + {bs ? 'Novi dokument' : 'New Document'}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay" style={{ zIndex: 12000 }} onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? (bs ? 'Uredi dokument' : 'Edit Document') : (bs ? 'Novi dokument' : 'New Document')}</h2>
                            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Datoteka' : 'File'}</label>
                                    <input type="file" className="form-input" onChange={handleFileChange} />
                                    {editingId && !selectedFile && <div style={{ fontSize: '0.78rem', marginTop: 4, color: 'var(--text-muted)' }}>{bs ? 'Ostavite prazno ako ne mijenjate datoteku.' : 'Leave empty to keep current file.'}</div>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Naziv dokumenta' : 'Document Name'} <span style={{color:'var(--danger)'}}>*</span></label>
                                    <input className="form-input" value={form.naziv} onChange={e => setForm(f => ({...f, naziv: e.target.value}))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Kategorija' : 'Category'}</label>
                                    <select className="form-select" value={form.kategorija} onChange={e => setForm(f => ({...f, kategorija: e.target.value}))}>
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
                                        <DateInput value={form.datumIzdavanja} onChange={v => setForm(f => ({...f, datumIzdavanja: v}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum isteka' : 'Expiry Date'}</label>
                                        <DateInput value={form.datumIsteka} onChange={v => setForm(f => ({...f, datumIsteka: v}))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-card)' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                            <button type="button" className="btn btn-primary" onClick={handleSave}>💾 {bs ? 'Spremi dokument' : 'Save Document'}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="data-table-wrapper" style={{ marginTop: 8 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === docs.length && docs.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                            <th>{bs ? 'Naziv dokumenta' : 'Document Name'}</th>
                            <th>{bs ? 'Kategorija' : 'Category'}</th>
                            <th>{bs ? 'Datumi (Izd/Ist)' : 'Dates (Iss/Exp)'}</th>
                            <th>{bs ? 'Datum upisa' : 'Uploaded On'}</th>
                            <th>{bs ? 'Veličina' : 'Size'}</th>
                            <th style={{ width: 100 }}>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>{bs ? 'Nema učitanih dokumenata' : 'No documents uploaded'}</td></tr>
                        ) : docs.sort((a,b)=> new Date(b.datumUpisa) - new Date(a.datumUpisa)).map(d => (
                            <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(d)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggleOne(d.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></td>
                                <td style={{ fontWeight: 600 }}>📄 {d.naziv}</td>
                                <td><span className="badge badge-info">{d.kategorija || 'Ostalo'}</span></td>
                                <td style={{ fontSize: '0.85rem' }}>{d.datumIzdavanja ? formatDate(d.datumIzdavanja) : '—'} <br/><span style={{color:'var(--text-muted)'}}>{d.datumIsteka ? formatDate(d.datumIsteka) : '—'}</span></td>
                                <td>{formatDate(d.datumUpisa)}</td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{d.velicina}</td>
                                <td onClick={e => e.stopPropagation()}>
                                    <div style={{ position: 'relative' }}>
                                        <button className="btn btn-primary btn-sm" onClick={(e) => { if (actionMenuId === d.id) { setActionMenuId(null); return; } const rect = e.currentTarget.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom - 8; const flipUp = spaceBelow < 170; setMenuPos(flipUp ? { bottom: window.innerHeight - rect.top + 4, left: rect.left - 80, maxH: Math.max(120, rect.top - 8) } : { top: rect.bottom + 4, left: rect.left - 80, maxH: Math.max(120, spaceBelow) }); setActionMenuId(d.id); }}>{bs ? 'Akcije' : 'Actions'} ▼</button>
                                        {actionMenuId === d.id && (<>
                                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setActionMenuId(null)} />
                                            <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 160, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                <button onClick={() => { setActionMenuId(null); handleEdit(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✏️ {bs ? 'Uredi meta' : 'Edit meta'}</button>
                                                {d.docData && <button onClick={() => { setActionMenuId(null); handleDownload(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📑 {bs ? 'Preuzmi' : 'Download'}</button>}
                                                {d.docData && <button onClick={() => { setActionMenuId(null); handlePrint(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🖨️ {bs ? 'Printaj' : 'Print'}</button>}
                                                <button onClick={() => { setActionMenuId(null); handleCopy(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📋 {bs ? 'Kopiraj metadate' : 'Copy metadata'}</button>
                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                <button onClick={() => { setActionMenuId(null); handleDelete(d.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                            </div>
                                        </>)}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
