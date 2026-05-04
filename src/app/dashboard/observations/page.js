'use client';
import { useState, useEffect, useCallback } from 'react';
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
    const bs = lang === 'bs';
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
    const [newFormData, setNewFormData] = useState({ opis: '', lokacija: '', ime: '' });
    const [newFormSaving, setNewFormSaving] = useState(false);

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
        if (deepLinkId && items.length > 0 && !viewingItem) {
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
        if (await confirm(bs ? `Obrisati ${selectedIds.size} prijava?` : `Delete ${selectedIds.size} reports?`)) {
            for (const id of selectedIds) remove(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations', id);
            setSelectedIds(new Set()); loadData();
        }
    };

    const handleNewSubmit = async () => {
        if (!newFormData.opis.trim() || !newFormData.lokacija.trim()) {
            await alert(bs ? 'Popunite obavezna polja: Opis i Lokacija.' : 'Description and location are required.');
            return;
        }
        setNewFormSaving(true);
        try {
            create(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations', {
                opis: newFormData.opis,
                lokacija: newFormData.lokacija,
                ime: newFormData.ime || (bs ? 'Admin' : 'Admin'),
                status: 'Novo',
                datum: new Date().toISOString(),
            });
            loadData(); showFlash(); setShowNewForm(false);
            setNewFormData({ opis: '', lokacija: '', ime: '' });
        } catch (e) {
            await alert((bs ? 'Greška: ' : 'Error: ') + e.message);
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
        const msg = bs ? 'Da li ste sigurni da želite obrisati ovu prijavu?' : 'Are you sure you want to delete this report?';
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
        'Novo': { label: bs ? 'Novo' : 'New', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
        'U obradi': { label: bs ? 'U obradi' : 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
        'Riješeno': { label: bs ? 'Riješeno' : 'Resolved', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
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
            <PageHeader icon={<Icon3D name="Obzervacije.png" size={64} />} title={bs ? 'Prijave Opasnosti' : 'Hazard Reports'} subtitle={`${items.length} ${bs ? 'zabilježenih obzervacija s terena' : 'recorded field observations'}`} />

            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={() => setShowNewForm(true)} title={bs ? 'Ručno prijavi opasnost iz administracije' : 'Manually report a hazard from administration'}>
                            + {bs ? 'Nova prijava' : 'New Report'}
                        </button>
                        <div className="search-bar" style={{ width: 250 }}>
                            <span style={{ opacity: 0.5 }}>🔍</span>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                        <button className="btn btn-outline" style={{ height: 38, flexShrink: 0 }} onClick={() => setShowQR(true)} title={bs ? 'Isprintaj QR kod plakat' : 'Print QR code poster'}>
                            🖨️ {bs ? 'QR Kod' : 'QR Code'}
                        </button>
                        <SavedFlash />
                        
                        {selectedIds.size > 0 && (<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}><span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {bs ? 'odabrano' : 'selected'}:</span><button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button></div>)}
                        {selectedIds.size === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto', flexShrink: 0 }}>{sortedItems.length} {t('records')}</span>}
                    </div>
                    <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sortedItems.length && sortedItems.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                    <th style={{ width: 90 }}>{t('actions')}</th>
                                    <th onClick={() => requestSort('datum')} style={thStyle('datum')}>{bs ? 'Datum' : 'Date'} {sortIcon('datum')}</th>
                                    <th onClick={() => requestSort('lokacija')} style={thStyle('lokacija')}>{bs ? 'Lokacija' : 'Location'} {sortIcon('lokacija')}</th>
                                    <th onClick={() => requestSort('opis')} style={thStyle('opis')}>{bs ? 'Opis' : 'Description'} {sortIcon('opis')}</th>
                                    <th onClick={() => requestSort('ime')} style={thStyle('ime')}>{bs ? 'Prijavio/la' : 'Reported by'} {sortIcon('ime')}</th>
                                    <th onClick={() => requestSort('status')} style={{...thStyle('status'), textAlign: 'center'}}>Status {sortIcon('status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedItems.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>{bs ? 'Nema prijavljenih opasnosti' : 'No hazard reports found'}</td></tr>
                                ) : pagedItems.map(item => (
                                    <tr key={item.id} onClick={() => setViewingItem(item)} style={{ background: lastEditedId === item.id ? 'rgba(102,126,234,0.15)' : undefined, cursor: 'pointer', transition: 'background 0.5s ease' }} onMouseEnter={e => e.currentTarget.style.background= lastEditedId === item.id ? 'rgba(102,126,234,0.25)' : 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background= lastEditedId === item.id ? 'rgba(102,126,234,0.15)' : ''}>
                                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleOne(item.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                        </td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); if (actionMenuId === item.id) { setActionMenuId(null); return; } const rect = e.currentTarget.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom - 8; const spaceAbove = rect.top - 8; const flipUp = spaceBelow < 200 && spaceAbove > spaceBelow; setMenuPos(flipUp ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) } : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }); setActionMenuId(item.id); }}>Akcije ▼</button>
                                                {actionMenuId === item.id && (<><div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} /><div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}><span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prijava</span><button onClick={() => setActionMenuId(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>✕</button></div>
                                                    <button onClick={() => { setActionMenuId(null); setViewingItem(item); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>📷 {bs ? 'Otvori pregled' : 'View'}</button>
                                                    <button onClick={() => { setActionMenuId(null); handleStatusCycle(item); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>🔄 {bs ? `Status → ${{ 'Novo': 'U obradi', 'U obradi': 'Riješeno', 'Riješeno': 'Novo' }[item.status] || 'U obradi'}` : `Status → ${{ 'Novo': 'In Progress', 'U obradi': 'Resolved', 'Riješeno': 'New' }[item.status] || 'In Progress'}`}</button>
                                                    {isAdmin && (
                                                        <>
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <button onClick={() => { setActionMenuId(null); handleDelete(item); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.06)'} onMouseLeave={e => e.currentTarget.style.background=''}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                                        </>
                                                    )}
                                                </div></>)}
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)' }}>{item.datum ? new Date(item.datum).toLocaleDateString() : ''}</td>
                                        <td style={{ fontWeight: 600 }}>{item.lokacija} {item.orgJedinicaId && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{getOrgUnitName(item.orgJedinicaId)}</div>}</td>
                                        <td>{item.opis}</td>
                                        <td>{item.ime}</td>
                                        <td style={{ textAlign: 'center' }}>{getStatusBadge(item.status)}</td>
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
                            <h2>🚨 {bs ? 'Nova prijava opasnosti' : 'New Hazard Report'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowNewForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">{bs ? 'Kratki opis problema' : 'Short description'} *</label>
                                <textarea className="form-input" rows={3} placeholder={bs ? 'Npr. Oštećena ograda na 2. spratu...' : 'E.g. Damaged railing on 2nd floor...'} value={newFormData.opis} onChange={e => setNewFormData({ ...newFormData, opis: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{bs ? 'Tačna lokacija' : 'Exact location'} *</label>
                                <input className="form-input" placeholder={bs ? 'Npr. Gradilište A, Pogon 3' : 'E.g. Site A, Unit 3'} value={newFormData.lokacija} onChange={e => setNewFormData({ ...newFormData, lokacija: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{bs ? 'Prijavio/la (opcionalno)' : 'Reported by (optional)'}</label>
                                <input className="form-input" placeholder={bs ? 'Ime osobe koja prijavljuje' : 'Name of reporter'} value={newFormData.ime} onChange={e => setNewFormData({ ...newFormData, ime: e.target.value })} />
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
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
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
