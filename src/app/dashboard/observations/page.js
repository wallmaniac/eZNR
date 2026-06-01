'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getAll, create, update, remove, COLLECTIONS, getOrgUnitName } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { QRCodeSVG } from 'qrcode.react';
import Icon3D from '@/components/Icon3D';
import PageHeader from '@/components/PageHeader';

export default function ObservationsPage() {
    const { t, lang } = useLanguage();
    
    const { isAdmin, activeCompanyId } = useAuth();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();

    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // View Modal
    const [viewingItem, setViewingItem] = useState(null);
    const [lastEditedId, setLastEditedId] = useState(null);
    const [showQR, setShowQR] = useState(false);
    
    // New Hazard Form State
    const [showNewForm, setShowNewForm] = useState(false);
    const [newFormData, setNewFormData] = useState({ opis: '', lokacija: '', ime: '', orgJedinicaId: '' });
    const [newFormSaving, setNewFormSaving] = useState(false);
    const [newImageFile, setNewImageFile] = useState(null);
    const [newImagePreview, setNewImagePreview] = useState(null);
    const fileInputRef = useRef(null);
    const orgUnits = useMemo(() => getAll(COLLECTIONS.ORG_UNITS || 'org_units'), []);

    // Standard list states
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

    const loadData = useCallback(() => {
        const obs = getAll(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations');
        obs.sort((a, b) => new Date(b.datum || 0) - new Date(a.datum || 0));
        setItems(obs);
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    const [deepLinkId, setDeepLinkId] = useState(() => {
        if (typeof window !== 'undefined') return new URLSearchParams(window.location.search).get('id');
        return null;
    });

    useEffect(() => {
        if (deepLinkId && items.length> 0 && !viewingItem) {
            const h = items.find(i => i.id === deepLinkId);
            if (h) {
                setViewingItem(h);
                setDeepLinkId(null);
                window.history.replaceState({}, '', window.location.pathname);
            }
        }
    }, [items, viewingItem, deepLinkId]);

    const filteredItems = items.filter(i => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (i.opis || '').toLowerCase().includes(q) ||
               (i.lokacija || '').toLowerCase().includes(q) ||
               (i.ime || '').toLowerCase().includes(q);
    });

    const { sorted: sortedItems, toggleSort: requestSort, sortIcon, thStyle } = useSortedList(filteredItems, 'datum', 'desc');
    const { page, perPage, setPage, setPerPage, totalPages, pagedData: pagedItems, nextPage, prevPage } = usePagination(sortedItems, 25);

    const toggleAll = (e) => { if (e.target.checked) setSelectedIds(new Set(sortedItems.map(x => x.id))); else setSelectedIds(new Set()); };
    const toggleOne = (id) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(t('deleteReports').replace('{0}', selectedIds.size))) {
            for (const id of selectedIds) remove(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations', id);
            setSelectedIds(new Set()); loadData();
        }
    };

    const handleNewFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return;
        setNewImageFile(file);
        setNewImagePreview(URL.createObjectURL(file));
    };

    const handleNewSubmit = async () => {
        if (!newFormData.opis.trim() || !newFormData.lokacija.trim()) {
            await alert(t('descriptionAndLocationAreRequired'));
            return;
        }
        setNewFormSaving(true);
        try {
            const record = {
                opis: newFormData.opis,
                lokacija: newFormData.lokacija,
                ime: newFormData.ime || (t('admin1')),
                orgJedinicaId: newFormData.orgJedinicaId || '',
                status: 'Novo',
                datum: new Date().toISOString(),
            };
            // If image selected, convert to base64 data URL and store inline
            if (newImageFile) {
                const dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(newImageFile);
                });
                record.slika = { url: dataUrl, name: newImageFile.name };
            }
            create(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations', record);
            loadData(); showFlash(); setShowNewForm(false);
            setNewFormData({ opis: '', lokacija: '', ime: '', orgJedinicaId: '' });
            setNewImageFile(null); setNewImagePreview(null);
        } catch (e) {
            await alert((t('error3')) + e.message);
        } finally {
            setNewFormSaving(false);
        }
    };

    const handleStatusCycle = async (item) => {
        const cycle = { 'Novo': 'U obradi', 'U obradi': 'Riješeno', 'Riješeno': 'Novo' };
        try {
            await update(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations', item.id, { status: cycle[item.status] || 'U obradi' });
            showFlash(); loadData();
        } catch(e) {
            alert('Greška: ' + e.message);
        }
    };

    const handleDelete = async (item) => {
        if (!isAdmin) return;
        const msg = t('areYouSureYouWant');
        if (await confirm(msg)) {
            try {
                await remove(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations', item.id);
                showFlash(); loadData();
            } catch(e) {
                alert('Greška: ' + e.message);
            }
        }
    };

    const STATUS_MAP = {
        'Novo': { label: t('novaProcjena'), color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
        'U obradi': { label: t('uObradi'), color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
        'Riješeno': { label: t('resolved'), color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    };

    const getStatusBadge = (status) => {
        const s = STATUS_MAP[status] || STATUS_MAP['Novo'];
        return (
            <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                {s.label}
            </span>
        );
    };

    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader icon={<Icon3D name="⚠️" size={64} />} title={t('observations')} subtitle={`${items.length} ${t('recordedFieldObservations')}`} />

            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={() => setShowNewForm(true)} title={t('manuallyReportAHazardFrom')}>
                            + {t('newReport')}
                        </button>
                        <div className="search-bar" style={{ width: 250 }}>
                            <span style={{ opacity: 0.5 }}>🔍</span>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                        <button className="btn btn-outline" style={{ height: 38, flexShrink: 0 }} onClick={() => setShowQR(true)} title={t('printQrCodePoster')}>
                            🖨️ {t('qrCode')}
                        </button>
                        <SavedFlash />
                        
                        {selectedIds.size> 0 && (<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}><span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {t('odabrano1')}:</span><button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected} title={t('deleteSelectedReports')}>🗑️ {t('obrisi')}</button></div>)}
                        {selectedIds.size === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto', flexShrink: 0 }}>{sortedItems.length} {t('records')}</span>}
                    </div>
                    <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sortedItems.length && sortedItems.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                    <th style={{ width: 90 }}>{t('actions')}</th>
                                    <th onClick={() => requestSort('datum')} style={thStyle('datum')}>{t('datum')} {sortIcon('datum')}</th>
                                    <th onClick={() => requestSort('lokacija')} style={thStyle('lokacija')}>{t('lokacija')} {sortIcon('lokacija')}</th>
                                    <th onClick={() => requestSort('opis')} style={thStyle('opis')}>{t('opis')} {sortIcon('opis')}</th>
                                    <th onClick={() => requestSort('ime')} style={thStyle('ime')}>{t('reportedBy')} {sortIcon('ime')}</th>
                                    <th onClick={() => requestSort('status')} style={{...thStyle('status'), textAlign: 'center'}}>Status {sortIcon('status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedItems.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>{t('noHazardReportsFound')}</td></tr>
                                ) : pagedItems.map(item => (
                                    <tr key={item.id} onClick={() => setViewingItem(item)} style={{ background: lastEditedId === item.id ? 'rgba(102,126,234,0.15)' : undefined, cursor: 'pointer', transition: 'background 0.5s ease' }}>
                                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleOne(item.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); if (actionMenuId === item.id) { setActionMenuId(null); return; } const rect = e.currentTarget.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom - 8; const spaceAbove = rect.top - 8; const flipUp = spaceBelow < 200 && spaceAbove> spaceBelow; setMenuPos(flipUp ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) } : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }); setActionMenuId(item.id); }} title={t('showReportActions')}>{t('actions1')}</button>
                                                {actionMenuId === item.id && (<><div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} /><div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}><span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prijava</span><button onClick={() => setActionMenuId(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>✕</button></div>
                                                    <button onClick={() => { setActionMenuId(null); setViewingItem(item); }} className="dropdown-item">📷 {t('prikazi')}</button>
                                                    <button onClick={() => { setActionMenuId(null); handleStatusCycle(item); }} className="dropdown-item">🔄 {t('status')} → {STATUS_MAP[{ 'Novo': 'U obradi', 'U obradi': 'Riješeno', 'Riješeno': 'Novo' }[item.status] || 'U obradi']?.label || 'U obradi'}</button>
                                                    {isAdmin && (
                                                        <>
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <button onClick={() => { setActionMenuId(null); handleDelete(item); }} className="dropdown-item text-danger">🗑️ {t('izbrisi')}</button>
                                                        </>
                                                    )}
                                                </div></>)}
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>{item.datum ? new Date(item.datum).toLocaleDateString() : ''}</td>
                                        <td style={{ fontWeight: 600 }}>{item.lokacija} {item.orgJedinicaId && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{getOrgUnitName(item.orgJedinicaId)}</div>}</td>
                                        <td>{item.opis}</td>
                                        <td>{item.ime}</td>
                                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                            <button onClick={() => handleStatusCycle(item)} 
                                                title={`${t('clickToChangeStatus')} → ${STATUS_MAP[{ 'Novo': 'U obradi', 'U obradi': 'Riješeno', 'Riješeno': 'Novo' }[item.status] || 'U obradi']?.label || 'U obradi'}`}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'transform 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                            >
                                                {getStatusBadge(item.status)}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    <Pagination
                        page={page}
                        perPage={perPage}
                        totalPages={totalPages}
                        totalItems={filteredItems.length}
                        setPage={setPage}
                        setPerPage={setPerPage}
                        prevPage={prevPage}
                        nextPage={nextPage}
                        onPerPageChangeExtra={() => setSelectedIds(new Set())}
                    />
                    </div>
                </div>
            </div>

            {showNewForm && (
                <div className="modal-overlay" onClick={() => setShowNewForm(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🚨 {t('newHazardReport')}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowNewForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">{t('shortDescription')} *</label>
                                <textarea className="form-input" rows={3} placeholder={t('egDamagedRailingOn2nd')} value={newFormData.opis} onChange={e => setNewFormData({ ...newFormData, opis: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('exactLocation')} *</label>
                                <input className="form-input" placeholder={t('egSiteAUnit3')} value={newFormData.lokacija} onChange={e => setNewFormData({ ...newFormData, lokacija: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('reportedByOptional')}</label>
                                <input className="form-input" placeholder={t('nameOfReporter')} value={newFormData.ime} onChange={e => setNewFormData({ ...newFormData, ime: e.target.value })} />
                            </div>
                            {orgUnits.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">{t('departmentOptional')}</label>
                                    <select className="form-select" value={newFormData.orgJedinicaId} onChange={e => setNewFormData({ ...newFormData, orgJedinicaId: e.target.value })}>
                                        <option value="">-</option>
                                        {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">{t('photoOptional')}</label>
                                <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center', background: 'rgba(0,191,166,0.03)', position: 'relative', overflow: 'hidden' }}>
                                    {newImagePreview ? (
                                        <img src={newImagePreview} style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} alt="Preview" />
                                    ) : (
                                        <div>
                                            <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                                            <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
                                                {t('chooseImage')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {newImagePreview && (
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6, color: 'var(--danger)', display: 'block', margin: '6px auto 0' }} onClick={() => { setNewImageFile(null); setNewImagePreview(null); }}>
                                        {t('removePhoto')}
                                    </button>
                                )}
                                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleNewFileSelect} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowNewForm(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleNewSubmit} disabled={newFormSaving}>
                                {newFormSaving ? '⏳' : '💾'} {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showQR && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card animate-fadeIn" style={{ background: '#fff', padding: 40, textAlign: 'center', maxWidth: 450, borderRadius: 16, position: 'relative' }}>
                        <button onClick={() => setShowQR(false)} style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#64748b', lineHeight: 1 }} title="Zatvori">✕</button>
                        <h2 style={{ color: '#000', marginBottom: 10, fontSize: 24, fontWeight: 900 }}>🚨 PRIJAVA OPASNOSTI</h2>
                        <p style={{ color: '#555', marginBottom: 30, fontSize: 14 }}>Skenirajte kod ispod i odmah prijavite kvar, štetu ili opasnu situaciju na gradilištu. Prijava ide direktno nadležnoj službi.</p>
                        <div style={{ background: '#fff', padding: 20, display: 'inline-block', borderRadius: 12, border: '4px solid #ef4444' }}><QRCodeSVG value={`${window.location.origin}/q/obs/${activeCompanyId || 'all'}`} size={220} /></div>
                        <div style={{ marginTop: 30, display: 'flex', gap: 10, justifyContent: 'center' }}><button className="btn btn-ghost" style={{ background: '#f1f5f9', color: '#333' }} onClick={() => setShowQR(false)}>Zatvori</button><button className="btn btn-primary" style={{ background: '#ef4444', color: '#fff' }} onClick={() => window.print()}>🖨️ Printaj plakat</button></div>
                    </div>
                    <style>{`@media print { body * { visibility: hidden; } .card.animate-fadeIn, .card.animate-fadeIn * { visibility: visible; } .card.animate-fadeIn { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; padding: 100px; text-align: center; box-shadow: none !important; border-radius: 0 !important; } .btn { display: none !important; } }`}</style>
                </div>
            )}

            {viewingItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(4px)', zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div className="card animate-fadeIn" style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
                            <div style={{ fontWeight: 700 }}>🚨 Prijava Opasnosti <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 12 }}>{new Date(viewingItem.datum).toLocaleString()}</span></div>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setLastEditedId(viewingItem.id); setViewingItem(null); }}>✕</button>
                        </div>
                        <div className="card-body" style={{ overflowY: 'auto', padding: 0 }}>
                            <div style={{ padding: 24 }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>{viewingItem.opis}</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div>📍 <strong>Lokacija:</strong> {viewingItem.lokacija}</div>
                                    {viewingItem.orgJedinicaId && <div>🏢 <strong>Odjel:</strong> {getOrgUnitName(viewingItem.orgJedinicaId)}</div>}
                                    <div>👤 <strong>Prijavio:</strong> <span style={{ color: 'var(--text)' }}>{viewingItem.ime || 'Anonimno'}</span></div>
                                    <div>🏷️ <strong>Status:</strong> {getStatusBadge(viewingItem.status)}</div>
                                </div>
                            </div>
                            <div style={{ background: '#000', textAlign: 'center', padding: 20 }}>
                                {viewingItem.slika?.url ? <img src={viewingItem.slika.url} style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} alt="Hazard" /> : <div style={{ padding: '60px 0', color: '#555' }}>Nema priložene slike</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
