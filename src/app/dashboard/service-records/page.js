'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS, formatDate, getActiveCompanyId } from '@/lib/dataStore';
import { useAuth } from '@/contexts/AuthContext';
import { useSortedList } from '@/hooks/useSortedList';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { uploadDocument } from '@/lib/storageService';
import PageHeader from '@/components/PageHeader';

const emptyServiceEntry = {
    datum: '', tip: 'pregled', servisirao: '', napomena: '', iduciServis: '', docName: '', docData: '', fileObj: null, equipmentId: ''
};

function ServiceRecordsInner() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const { activeCompanyId } = useAuth();
    
    const [logs, setLogs] = useState([]);
    const [equipmentList, setEquipmentList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ ...emptyServiceEntry });
    const [editingId, setEditingId] = useState(null);
    const serviceDocRef = useRef(null);

    // Equipment Search Dropdown in modal
    const [eqSearch, setEqSearch] = useState('');
    const [showEqSearch, setShowEqSearch] = useState(false);
    const eqRef = useRef(null);

    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({});
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    const loadData = useCallback(() => {
        setLogs(getAll(COLLECTIONS.SERVICE_LOG).sort((a,b) => new Date(b.datum) - new Date(a.datum)));
        setEquipmentList(getAll(COLLECTIONS.EQUIPMENT));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    useEffect(() => {
        const handler = (e) => {
            if (eqRef.current && !eqRef.current.contains(e.target)) setShowEqSearch(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const enrichedLogs = logs.map(l => {
        const eq = equipmentList.find(e => e.id === l.equipmentId);
        return { ...l, equipmentName: eq ? eq.naziv : 'Nepoznato', equipmentInv: eq ? eq.invBroj : '' };
    });

    const filtered = enrichedLogs.filter(item => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (item.equipmentName || '').toLowerCase().includes(q) ||
               (item.equipmentInv || '').toLowerCase().includes(q) ||
               (item.servisirao || '').toLowerCase().includes(q) ||
               (item.napomena || '').toLowerCase().includes(q);
    });

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datum', 'desc');

    const openInEquipment = (eqId) => {
        router.push(`/dashboard/equipment?openItem=${eqId}&tab=servis&returnTo=/dashboard/service-records`);
    };

    const handleNewService = () => {
        const today = new Date().toISOString().slice(0, 10);
        setFormData({ ...emptyServiceEntry, datum: today });
        setEditingId(null);
        setEqSearch('');
        setShowForm(true);
    };

    const handleEditService = (log) => {
        setFormData({ ...log });
        setEditingId(log.id);
        const eq = equipmentList.find(e => e.id === log.equipmentId);
        if(eq) setEqSearch(eq.naziv);
        setShowForm(true);
        setActionMenuId(null);
    };

    const handleSaveService = async () => {
        if (!formData.datum) { await alert(bs ? 'Datum servisa je obavezan!' : 'Service date is required!'); return; }
        if (!formData.equipmentId) { await alert(bs ? 'Odaberite radnu opremu!' : 'Select equipment!'); return; }

        let uploadedUrl = formData.docData;
        if (formData.fileObj) {
            try {
                const res = await uploadDocument(formData.fileObj, activeCompanyId, 'service-logs');
                uploadedUrl = res.url;
            } catch (e) {
                await alert('Upload failed: ' + e.message); return;
            }
        }

        const data = { ...formData, docData: uploadedUrl };
        delete data.fileObj;
        
        if (editingId) {
            update(COLLECTIONS.SERVICE_LOG, editingId, data);
        } else {
            create(COLLECTIONS.SERVICE_LOG, data);
        }
        
        // Auto-update posljednji/iduci dates on equipment
        const eq = equipmentList.find(e => e.id === formData.equipmentId);
        if (eq && formData.datum) {
            const updates = { posljednji: formData.datum };
            if (formData.iduciServis) updates.iduci = formData.iduciServis;
            update(COLLECTIONS.EQUIPMENT, eq.id, { ...eq, ...updates });
        }

        setShowForm(false);
        loadData();
        showFlash();
    };

    const handleDeleteService = async (id) => {
        setActionMenuId(null);
        if (await confirm(bs ? 'Obrisati servisni zapis?' : 'Delete service record?')) {
            remove(COLLECTIONS.SERVICE_LOG, id);
            loadData();
        }
    };

    const handleDocUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) {
            await alert(bs ? 'Dokument mora biti manji od 15MB!' : 'Document must be under 15MB!');
            return;
        }
        setFormData(prev => ({ ...prev, fileObj: file, docName: file.name }));
    };

    const openDocInTab = (log) => {
        setActionMenuId(null);
        if (!log.docData) return;
        if (log.docData.startsWith('http')) {
            window.open(log.docData, '_blank');
            return;
        }
        const isPdf = log.docData.startsWith('data:application/pdf');
        const isImage = log.docData.startsWith('data:image/');
        if (isPdf || isImage) {
            const byteString = atob(log.docData.split(',')[1]);
            const mimeString = log.docData.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeString });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        } else {
            const a = document.createElement('a');
            a.href = log.docData;
            a.download = log.docName || 'servisni_dokument';
            a.click();
        }
    };

    const fEq = equipmentList.filter(e => !eqSearch || e.naziv.toLowerCase().includes(eqSearch.toLowerCase()) || (e.invBroj || '').toLowerCase().includes(eqSearch.toLowerCase()));

    const tipLabel = (tip) => ({
        pregled: bs ? '🔍 Pregled' : '🔍 Inspection',
        servis: bs ? '🔧 Servis' : '🔧 Service',
        popravak: bs ? '🛠️ Popravak' : '🛠️ Repair',
        kalibracija: bs ? '📏 Kalibracija' : '📏 Calibration',
        zamjena: bs ? '🔄 Zamjena dijela' : '🔄 Part replacement',
    }[tip] || tip);

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader icon="🔧" title={bs ? 'Servisni Zapisnici' : 'Service Records'} />

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 560, zIndex: 1100 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🔧 {editingId ? (bs ? 'Uredi servisni zapis' : 'Edit service record') : (bs ? 'Novi servisni zapis' : 'New service record')}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid-2">
                                
                                <div className="form-group" ref={eqRef} style={{ gridColumn: '1 / -1', position: 'relative' }}>
                                    <label className="form-label">{bs ? 'Radna oprema / Objekt' : 'Equipment'} <span style={{color: 'var(--danger)'}}>*</span></label>
                                    <input className="form-input" placeholder={bs ? '🔍 Pretraži opremu...' : '🔍 Search equipment...'} value={eqSearch} 
                                        onChange={e => { setEqSearch(e.target.value); setShowEqSearch(true); setFormData(f => ({...f, equipmentId: ''})); }} 
                                        onFocus={() => setShowEqSearch(true)} />
                                    {showEqSearch && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                                            {fEq.length === 0 ? <div style={{ padding: 8 }}>Nema rezultata</div> : fEq.slice(0, 10).map(e => (
                                                <div key={e.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} 
                                                    onClick={() => { setFormData(f => ({...f, equipmentId: e.id})); setEqSearch(e.naziv); setShowEqSearch(false); }}>
                                                    <strong>{e.naziv}</strong> {e.invBroj ? `- ${e.invBroj}` : ''}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {formData.equipmentId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ Odabrano</div>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>📅 {bs ? 'Datum servisa' : 'Service date'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <DateInput value={formData.datum} onChange={v => setFormData(p => ({ ...p, datum: v }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Tip servisa' : 'Service type'}</label>
                                    <select className="form-select" value={formData.tip} onChange={e => setFormData(p => ({ ...p, tip: e.target.value }))}>
                                        <option value="pregled">{bs ? '🔍 Pregled' : '🔍 Inspection'}</option>
                                        <option value="servis">{bs ? '🔧 Servis' : '🔧 Service'}</option>
                                        <option value="popravak">{bs ? '🛠️ Popravak' : '🛠️ Repair'}</option>
                                        <option value="kalibracija">{bs ? '📏 Kalibracija' : '📏 Calibration'}</option>
                                        <option value="zamjena">{bs ? '🔄 Zamjena dijela' : '🔄 Part replacement'}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">👤 {bs ? 'Servisirao / Ovlaštena firma' : 'Serviced by'}</label>
                                    <input className="form-input" value={formData.servisirao} onChange={e => setFormData(p => ({ ...p, servisirao: e.target.value }))} placeholder={bs ? 'Ime ili naziv firme...' : 'Name or company...'} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">📅 {bs ? 'Idući servis' : 'Next service date'}</label>
                                    <DateInput value={formData.iduciServis} onChange={v => setFormData(p => ({ ...p, iduciServis: v }))} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">📝 {bs ? 'Napomena / Opis radova' : 'Notes / Description'}</label>
                                    <textarea className="form-textarea" rows={3} value={formData.napomena} onChange={e => setFormData(p => ({ ...p, napomena: e.target.value }))} placeholder={bs ? 'Opis obavljenih radova, zamijenjeni dijelovi...' : 'Describe work done, replaced parts...'} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">📎 {bs ? 'Prilog (dokaz servisa, maks. 2MB)' : 'Attachment (proof of service, max 2MB)'}</label>
                                    {formData.docName ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>📎 {formData.docName}</span>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setFormData(p => ({ ...p, docName: '', docData: '' }))} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>✕ {bs ? 'Ukloni' : 'Remove'}</button>
                                        </div>
                                    ) : (
                                        <div onClick={() => serviceDocRef.current?.click()} style={{
                                            border: '2px dashed var(--border)', borderRadius: 8, padding: '16px',
                                            textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)',
                                            transition: 'all 0.15s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                        >
                                            📂 {bs ? 'Kliknite za upload dokumenta (PDF, slike)' : 'Click to upload document (PDF, images)'}
                                        </div>
                                    )}
                                    <input ref={serviceDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
                                </div>
                            </div>
                            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,191,166,0.04)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                💡 {bs ? 'Datum posljednjeg i idućeg pregleda na opremi biće automatski ažurirani.' : "Equipment's last/next examination dates will be updated automatically."}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSaveService}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNewService}>+ {bs ? 'Novi servisni zapis' : 'New Service Record'}</button>
                        <SavedFlash />
                        <input className="form-input" style={{ maxWidth: 300, marginLeft: 12 }} placeholder={bs ? '🔍 Pretraži zapise...' : '🔍 Search records...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 90 }}>{t('actions')}</th>
                                    <th onClick={() => toggleSort('equipmentName')} style={thStyle('equipmentName')}>{bs ? 'Radna oprema' : 'Equipment'}{sortIcon('equipmentName')}</th>
                                    <th onClick={() => toggleSort('tip')} style={thStyle('tip')}>{bs ? 'Tip servisa' : 'Service Type'}{sortIcon('tip')}</th>
                                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{bs ? 'Datum' : 'Date'}{sortIcon('datum')}</th>
                                    <th onClick={() => toggleSort('servisirao')} style={thStyle('servisirao')}>{bs ? 'Servisirao' : 'Serviced By'}{sortIcon('servisirao')}</th>
                                    <th onClick={() => toggleSort('iduciServis')} style={thStyle('iduciServis')}>{bs ? 'Idući servis' : 'Next Service'}{sortIcon('iduciServis')}</th>
                                    <th>{bs ? 'Prilog' : 'Attachment'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sorted.map(d => (
                                    <tr key={d.id} onClick={() => openInEquipment(d.equipmentId)} style={{ cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onClick={e => {
                                                    e.stopPropagation();
                                                    if (actionMenuId === d.id) { setActionMenuId(null); return; }
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                    const flipUp = spaceBelow < 120;
                                                    setMenuPos(flipUp
                                                        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left }
                                                        : { top: rect.bottom + 4, left: rect.left });
                                                    setActionMenuId(d.id);
                                                }}>{bs ? 'Akcije' : 'Actions'} ▼</button>
                                                {actionMenuId === d.id && (<>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setActionMenuId(null); }} />
                                                    <div style={{ position: 'fixed', ...menuPos, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 160, overflowY: 'auto' }}>
                                                        <button onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEditService(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✏️ {bs ? 'Uredi' : 'Edit'}</button>
                                                        {d.docData && <button onClick={(e) => { e.stopPropagation(); openDocInTab(d); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📎 {bs ? 'Otvori prilog' : 'Open Attachment'}</button>}
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteService(d.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                                    </div>
                                                </>)}
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{d.equipmentName}</td>
                                        <td>{tipLabel(d.tip)}</td>
                                        <td>{formatDate(d.datum)}</td>
                                        <td>{d.servisirao || '—'}</td>
                                        <td style={{ color: (d.iduciServis && new Date(d.iduciServis) < new Date()) ? 'var(--danger)' : undefined, fontWeight: (d.iduciServis && new Date(d.iduciServis) < new Date()) ? 700 : undefined }}>
                                            {d.iduciServis ? formatDate(d.iduciServis) : '—'} {(d.iduciServis && new Date(d.iduciServis) < new Date()) && '⚠️'}
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            {d.docData ? (
                                                <button onClick={(e) => { e.stopPropagation(); openDocInTab(d); }} style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.2)',
                                                    borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--info)'
                                                }}>📎 {d.docName || 'Dokument'}</button>
                                            ) : '—'}
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

export default function ServiceRecords() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
            <ServiceRecordsInner />
        </Suspense>
    );
}
