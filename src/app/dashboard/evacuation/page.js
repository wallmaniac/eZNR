'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { uploadDocument } from '@/lib/storageService';
import { getActiveCompanyId, getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useSortedList } from '@/hooks/useSortedList';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import PageHeader from '@/components/PageHeader';

const EMPTY = {
    lokacija: '', datumIzrade: '', datumRevizije: '',
    odgovornaOsobaId: '', odgovornaOsobaIme: '',
    brojEvakuacijskihPuteva: '', kapacitetOsoba: '',
    opis: '', napomena: '', status: 'aktivan',
    attachedFile: '', attachedFileName: '', documents: [],
};

export default function EvacuationPage() {
    const { t, lang } = useLanguage();
    const bs = lang !== 'en';
    const hr = lang === 'hr';
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const { markDirty, markClean } = useUnsavedChanges();

    const [plans, setPlans] = useState([]);
    const [drills, setDrills] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY });
    const [viewWorkerId, setViewWorkerId] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());

    const [workerSearch, setWorkerSearch] = useState('');
    const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
    const workerRef = useRef(null);

    const loadData = useCallback(() => {
        setPlans(getAll(COLLECTIONS.EVACUATION_PLANS));
        setDrills(getAll(COLLECTIONS.EVACUATION_DRILLS));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);
    useEffect(() => {
        const handler = (e) => { if (workerRef.current && !workerRef.current.contains(e.target)) setShowWorkerDropdown(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const set = (k, v) => { setFormData(f => ({ ...f, [k]: v })); markDirty(); };

    const filteredWorkers = workers.filter(w => {
        if (!workerSearch) return true;
        return `${w.ime} ${w.prezime}`.toLowerCase().includes(workerSearch.toLowerCase());
    });

    const handleWorkerSelect = (w) => {
        set('odgovornaOsobaId', w.id); set('odgovornaOsobaIme', `${w.ime} ${w.prezime}`);
        setWorkerSearch(`${w.ime} ${w.prezime}`); setShowWorkerDropdown(false);
    };

    // Stats
    const lastDrill = drills.sort((a, b) => (b.datumVjezbe || '').localeCompare(a.datumVjezbe || ''))[0];
    const daysSinceLastDrill = lastDrill ? Math.floor((Date.now() - new Date(lastDrill.datumVjezbe).getTime()) / 86400000) : null;

    const stats = {
        totalPlans: plans.length,
        activePlans: plans.filter(p => p.status === 'aktivan').length,
        totalDrills: drills.length,
        daysSinceDrill: daysSinceLastDrill,
    };

    const filtered = plans.filter(p => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (p.lokacija || '').toLowerCase().includes(q) || (p.odgovornaOsobaIme || '').toLowerCase().includes(q);
    });

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'lokacija');

    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({});

    const openNew = () => { setEditingId(null); setFormData({ ...EMPTY }); setWorkerSearch(''); setShowForm(true); };
    const openEdit = (p) => { setEditingId(p.id); setFormData({ ...p }); setWorkerSearch(p.odgovornaOsobaIme || ''); setShowForm(true); };

    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const handleSave = async () => {
        if (!formData.lokacija) { await alert(t('locationIsRequired')); return; }
        if (editingId) { update(COLLECTIONS.EVACUATION_PLANS, editingId, formData); }
        else { create(COLLECTIONS.EVACUATION_PLANS, formData); }
        loadData(); markClean(); setShowForm(false); showFlash();
    };

    const handleDelete = async (id) => {
        if (await confirm(t('deleteThisPlan'))) {
            remove(COLLECTIONS.EVACUATION_PLANS, id); setActionMenuId(null); loadData();
        }
    };

    const toggleAll = (e) => { if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id))); else setSelectedIds(new Set()); };
    const toggleOne = (id) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(t('deletePlans').replace('{0}', selectedIds.size))) {
            for (let id of selectedIds) remove(COLLECTIONS.EVACUATION_PLANS, id);
            setSelectedIds(new Set()); loadData();
        }
    };

    const openMenu = (id, e) => {
        e.stopPropagation();
        if (actionMenuId === id) { setActionMenuId(null); return; }
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 8;
        const flipUp = spaceBelow < 200;
        setMenuPos(flipUp
            ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, rect.top - 8) }
            : { top: rect.bottom + 4, left: rect.left, maxH: Math.max(120, spaceBelow - 15) });
        setActionMenuId(id);
    };

    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    const getDrillsForPlan = (planId) => drills.filter(d => d.planId === planId);

    return (
        <>
            <div className="animate-fadeIn">
                <DialogRenderer />
                {/* Header */}
                <PageHeader icon="🚨" title={t('evacuationPlans')} />

                {/* Info banner */}
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginTop: 12, marginBottom: 16, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem' }}>📋</span>
                    {t('perFireProtectionLawEvacuation')}
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                        { label: t('totalPlans'), val: stats.totalPlans, icon: '🗺️', color: 'var(--primary)' },
                        { label: t('activePlans'), val: stats.activePlans, icon: '✅', color: '#22C55E' },
                        { label: t('totalDrills'), val: stats.totalDrills, icon: '🏃', color: '#6366F1' },
                        { label: t('daysSinceLastDrill'), val: stats.daysSinceDrill !== null ? stats.daysSinceDrill : '—', icon: stats.daysSinceDrill> 365 ? '🔴' : '📅', color: stats.daysSinceDrill> 365 ? '#EF4444' : '#F59E0B' },
                    ].map((s, i) => (
                        <div key={i} className="card" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)', marginTop: 2 }}>{s.val}</div>
                                </div>
                                <span style={{ fontSize: '1.3rem' }}>{s.icon}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Form modal */}
                {showForm && (
                    <div className="modal-overlay" onClick={() => setShowForm(false)}>
                        <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{editingId ? '✏️' : '+'} {t('evacuationPlan')}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div className="form-grid-2">
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" style={{ fontWeight: 700 }}>{t('locationBuilding')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                        <input className="form-input" value={formData.lokacija} onChange={e => set('lokacija', e.target.value)} placeholder={t('hall1OfficeBuilding')} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('createdDate')}</label>
                                        <DateInput value={formData.datumIzrade} onChange={v => set('datumIzrade', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('revisionDate')}</label>
                                        <DateInput value={formData.datumRevizije} onChange={v => set('datumRevizije', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('noEvacuationRoutes')}</label>
                                        <input className="form-input" type="number" value={formData.brojEvakuacijskihPuteva} onChange={e => set('brojEvakuacijskihPuteva', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('capacityPersons')}</label>
                                        <input className="form-input" type="number" value={formData.kapacitetOsoba} onChange={e => set('kapacitetOsoba', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('status')}</label>
                                        <select className="form-select" value={formData.status} onChange={e => set('status', e.target.value)}>
                                            <option value="aktivan">{t('aktivan')}</option>
                                            <option value="revizija">{t('needsRevision')}</option>
                                            <option value="neaktivan">{t('neaktivan')}</option>
                                        </select>
                                    </div>

                                    {/* Responsible person */}
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }} ref={workerRef}>
                                        <label className="form-label">{hr ? 'Odgovorna osoba' : t('odgovornaOsoba')}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input className="form-input" placeholder={t('pretrazi')} value={workerSearch}
                                                onChange={e => { setWorkerSearch(e.target.value); setShowWorkerDropdown(true); set('odgovornaOsobaId', ''); set('odgovornaOsobaIme', ''); }}
                                                onFocus={() => setShowWorkerDropdown(true)} autoComplete="off" />
                                            {showWorkerDropdown && (
                                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                                                    {filteredWorkers.length === 0 ? (
                                                        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('nemaRadnika')}</div>
                                                    ) : filteredWorkers.slice(0, 15).map(w => (
                                                        <button key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}
                                                            
                                                            
                                                            onClick={() => handleWorkerSelect(w)}>
                                                            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>{w.ime?.[0]}{w.prezime?.[0]}</span>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{w.ime} {w.prezime}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {formData.odgovornaOsobaId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {formData.odgovornaOsobaIme}</div>}
                                    </div>

                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">{t('description')}</label>
                                        <textarea className="form-input" rows={2} value={formData.opis} onChange={e => set('opis', e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">{t('note')}</label>
                                        <textarea className="form-input" rows={2} value={formData.napomena} onChange={e => set('napomena', e.target.value)} />
                                    </div>
                                </div>

                                    {/* Document Upload */}
                                    <div className="form-group" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12, marginTop: 4 }}>
                                        <label className="form-label" style={{ fontWeight: 700 }}>{t('documentEvacuationPlan')}</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                            {formData.attachedFile && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                                                    <span>📄</span>
                                                    <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>{formData.attachedFileName}</span>
                                                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '2px 8px' }} onClick={() => { set('attachedFile', ''); set('attachedFileName', ''); }}>✕</button>
                                                </div>
                                            )}
                                            {formData.documents && formData.documents.map((doc, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                                                    <span>📄</span>
                                                    <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>{doc.name}</span>
                                                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '2px 8px' }} onClick={() => { const newDocs = [...formData.documents]; newDocs.splice(idx, 1); set('documents', newDocs); }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={async e => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length === 0) return;
                                            
                                            setUploadingDoc(true);
                                            setUploadProgress(0);
                                            const cid = getActiveCompanyId();
                                            const newDocs = [...(formData.documents || [])];
                                            
                                            try {
                                                for (let i = 0; i < files.length; i++) {
                                                    const file = files[i];
                                                    if (file.size > 15 * 1024 * 1024) { 
                                                        alert(hr ? `Fajl ${file.name} je prevelik (max 15MB)!` : t('fileIsTooLargeMax').replace('{0}', file.name)); 
                                                        continue; 
                                                    }
                                                    
                                                    const res = await uploadDocument(file, cid, 'evacuations', (prog) => {
                                                        setUploadProgress(Math.round(((i / files.length) * 100) + (prog / files.length)));
                                                    });
                                                    newDocs.push({ url: res.url, name: file.name });
                                                }
                                                set('documents', newDocs);
                                            } catch (err) {
                                                console.error("Upload error", err);
                                                const errMsg = err?.code === 'storage/unauthorized' 
                                                    ? (t('uploadUnauthorizedCheckFirebaseStorage'))
                                                    : err?.code === 'storage/canceled'
                                                    ? (t('uploadWasCancelled'))
                                                    : (t('uploadError').replace('{0}', err?.message || err?.code || 'Nepoznata greška').replace('{1}', err?.message || err?.code || 'Unknown error'));
                                                await alert(errMsg);
                                            } finally {
                                                setUploadingDoc(false);
                                                e.target.value = ''; // reset input
                                            }
                                        }} style={{ fontSize: '0.85rem' }} disabled={uploadingDoc} />
                                        {uploadingDoc && (
                                            <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--primary)' }}>
                                                {t('uploadingDocuments')} {uploadProgress}%
                                            </div>
                                        )}
                                    </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                                <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                            <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={openNew}>+ {t('newPlan')}</button>
                            <div className="search-bar" style={{ width: 250 }}>
                                <span style={{ opacity: 0.5 }}>🔍</span>
                                <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                            </div>
                            <SavedFlash />
                            {selectedIds.size> 0 ? (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {t('odabrano1')}:</span>
                                    <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {t('obrisi')}</button>
                                </div>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto', flexShrink: 0 }}>{sorted.length} {t('plans')}</span>}
                        </div>
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                        <th style={{ width: 90 }}>{t('actions')}</th>
                                        <th onClick={() => toggleSort('lokacija')} style={thStyle('lokacija')}>{t('lokacija')}{sortIcon('lokacija')}</th>
                                        <th onClick={() => toggleSort('odgovornaOsobaIme')} style={thStyle('odgovornaOsobaIme')}>{t('odgovornaOsoba')}{sortIcon('odgovornaOsobaIme')}</th>
                                        <th onClick={() => toggleSort('datumIzrade')} style={thStyle('datumIzrade')}>{t('created')}{sortIcon('datumIzrade')}</th>
                                        <th onClick={() => toggleSort('datumRevizije')} style={thStyle('datumRevizije')}>{t('revision')}{sortIcon('datumRevizije')}</th>
                                        <th>{t('dokument')}</th>
                                        <th>{t('routes')}</th>
                                        <th>{t('status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.length === 0 ? (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    ) : sorted.map(p => {
                                        const colSpanCount = 9;
                                        const planDrills = getDrillsForPlan(p.id);
                                        const statusMap = {
                                            aktivan: { bs: 'Aktivan', en: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
                                            revizija: { bs: 'Revizija', en: 'Revision', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                                            neaktivan: { bs: 'Neaktivan', en: 'Inactive', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
                                        };
                                        const st = statusMap[p.status] || statusMap.aktivan;
                                        return (
                                            <tr key={p.id} onClick={() => openEdit(p)} style={{ cursor: 'pointer' }}>
                                                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleOne(p.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div style={{ position: 'relative' }}>
                                                        <button className="btn btn-primary btn-sm" data-menu-trigger onMouseDown={(e) => e.preventDefault()} onClick={e => openMenu(p.id, e)}>{t('akcije')} ▾</button>
                                                        {actionMenuId === p.id && (
                                                            <>
                                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setActionMenuId(null); }} />
                                                                <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                    <button onClick={() => { setActionMenuId(null); openEdit(p); }} className="dropdown-item">✏️ {t('otvori')}</button>
                                                                    <button onClick={() => { setActionMenuId(null); if (p.attachedFile) { const a = document.createElement('a'); a.href = p.attachedFile; a.download = p.attachedFileName || 'document'; a.click(); } if (p.documents) { p.documents.forEach(d => { const a = document.createElement('a'); a.href = d.url; a.download = d.name; a.click(); }); } }} className="dropdown-item">⬇️ {hr ? 'Preuzmi dokumente' : t('downloadDocuments')}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const copy = { ...p }; delete copy.id; copy.lokacija = copy.lokacija + (t('copy')); copy.status = 'aktivan'; create(COLLECTIONS.EVACUATION_PLANS, copy); loadData(); showFlash(); }} className="dropdown-item">📋 {t('kopiraj')}</button>
                                                                    
                                                                    
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); handleDelete(p.id); }} className="dropdown-item text-danger">🗑️ {t('izbrisi')}</button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{p.lokacija}</td>
                                                <td>
                                                    <button onClick={e => { e.stopPropagation(); if (p.odgovornaOsobaId) setViewWorkerId(p.odgovornaOsobaId); }}
                                                        style={{ background: 'none', border: 'none', cursor: p.odgovornaOsobaId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: p.odgovornaOsobaId ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}>
                                                        {p.odgovornaOsobaIme || '—'}
                                                    </button>
                                                </td>
                                                <td>{formatDate(p.datumIzrade)}</td>
                                                <td>{formatDate(p.datumRevizije)}</td>
                                                <td onClick={e => e.stopPropagation()} style={{ padding: '8px' }}>
                                                    {((p.documents && p.documents.length > 0) || p.attachedFile) ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            {p.attachedFile && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>1.</span>
                                                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'underline', textAlign: 'left' }} onClick={() => { const w = window.open(); w.document.write(`<iframe src="${p.attachedFile}" style="width:100%;height:100%;border:none"></iframe>`); }}>
                                                                        {p.attachedFileName || 'Dokument'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {p.documents && p.documents.map((doc, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.attachedFile ? idx + 2 : idx + 1}.</span>
                                                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'underline', textAlign: 'left', wordBreak: 'break-all' }} onClick={() => { const w = window.open(); w.document.write(`<iframe src="${doc.url}" style="width:100%;height:100%;border:none"></iframe>`); }}>
                                                                        {doc.name}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{p.brojEvakuacijskihPuteva || '—'}</td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div style={{ position: 'relative' }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const key = `status_${p.id}`;
                                                                if (actionMenuId === key) { setActionMenuId(null); return; }
                                                                const rect = e.currentTarget.getBoundingClientRect();
                                                                const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                                const flipUp = spaceBelow < 160;
                                                                setMenuPos(flipUp
                                                                    ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, rect.top - 8) }
                                                                    : { top: rect.bottom + 4, left: rect.left, maxH: Math.max(120, spaceBelow - 15) });
                                                                setActionMenuId(key);
                                                            }}
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color, border: `1.5px solid ${st.color}30`, cursor: 'pointer', outline: 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                                        >
                                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                                                            {bs ? st.bs : st.en} ▾
                                                        </button>
                                                        {actionMenuId === `status_${p.id}` && (<>
                                                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                                                            <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', minWidth: 180, maxHeight: menuPos.maxH, overflowY: 'auto', padding: '4px 0' }}>
                                                                {Object.entries(statusMap).map(([k, v]) => (
                                                                    <button key={k} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); update(COLLECTIONS.EVACUATION_PLANS, p.id, { status: k }); loadData(); }}
                                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', background: (p.status || 'aktivan') === k ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: v.color, textAlign: 'left', transition: 'background 0.12s' }}
                                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                                        onMouseLeave={e => e.currentTarget.style.background = (p.status || 'aktivan') === k ? 'rgba(255,255,255,0.06)' : 'transparent'}
                                                                    >
                                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                                                                        {bs ? v.bs : v.en}
                                                                        {(p.status || 'aktivan') === k && <span style={{ marginLeft: 'auto', fontSize: '0.9rem' }}>✓</span>}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>)}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            {viewWorkerId && <WorkerProfileModal workerId={viewWorkerId} onClose={() => setViewWorkerId(null)} onSaved={() => setViewWorkerId(null)} />}
        </>
    );
}
