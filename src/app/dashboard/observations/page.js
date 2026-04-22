'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { getAll, getRawAll, update, remove, COLLECTIONS, getOrgUnitName } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { QRCodeSVG } from 'qrcode.react';

export default function ObservationsPage() {
    const { t, lang } = useLanguage();
    const { isAdmin, activeCompanyId } = useAuth();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();

    const [items, setItems] = useState([]);
    
    // View Modal
    const [viewingItem, setViewingItem] = useState(null);
    const [showQR, setShowQR] = useState(false);
    
    // Status Dropdown State
    const [statusDropdownId, setStatusDropdownId] = useState(null);
    const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, left: 0 });

    const loadData = useCallback(() => {
        const obs = getAll(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations');
        // Sort newest first
        obs.sort((a, b) => new Date(b.datum || 0) - new Date(a.datum || 0));
        setItems(obs);
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    // Capture initial deep link ID safely to survive Next.js router soft-navigation lifecycle
    const [deepLinkId, setDeepLinkId] = useState(() => {
        if (typeof window !== 'undefined') {
             return new URLSearchParams(window.location.search).get('id');
        }
        return null;
    });

    // Handle deep link to open specific hazard observation from Email
    useEffect(() => {
        if (deepLinkId && items.length > 0 && !viewingItem) {
            const h = items.find(i => i.id === deepLinkId);
            if (h) {
                setViewingItem(h);
                setDeepLinkId(null);
                // Remove ?id= from URL so it doesn't persistently re-open on refresh
                window.history.replaceState({}, '', window.location.pathname);
            }
        }
    }, [items, viewingItem, deepLinkId]);

    const { sorted: sortedItems, toggleSort: requestSort, sortIcon, thStyle } = useSortedList(items, 'datum', 'desc');

    const handleStatusChange = async (item, novistatus) => {
        try {
            await update(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations', item.id, { status: novistatus });
            showFlash();
            loadData(); // local reload to reflect changes
        } catch(e) {
            alert('Greška pri promjeni statusa: ' + e.message);
        }
    };

    const handleDelete = async (item) => {
        if (!isAdmin) return;
        const msg = lang === 'bs' ? 'Da li ste sigurni da želite obrisati ovu prijavu?' : 'Are you sure you want to delete this report?';
        if (await confirm(msg)) {
            try {
                await remove(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations', item.id);
                showFlash();
                loadData();
            } catch(e) {
                alert('Greška pri brisanju: ' + e.message);
            }
        }
    };

    const STATUS_MAP = {
        'Novo': { label: lang === 'bs' ? 'Novo' : 'New', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
        'U obradi': { label: lang === 'bs' ? 'U obradi' : 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
        'Riješeno': { label: lang === 'bs' ? 'Riješeno' : 'Resolved', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    };

    const getStatusBadge = (status) => {
        const s = STATUS_MAP[status] || STATUS_MAP['Novo'];
        return (
            <span style={{
                background: s.bg, color: s.color, border: `1px solid ${s.color}40`,
                padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600
            }}>
                {s.label}
            </span>
        );
    };

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <SavedFlash />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: '1.6rem' }}>🚨</span>
                <div>
                    <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Prijave Opasnosti' : 'Hazard Reports'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {items.length} {lang === 'bs' ? 'zabilježenih obzervacija s terena' : 'recorded field observations'}
                    </p>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <button className="btn btn-primary" onClick={() => setShowQR(true)}>
                        🖨️ {lang === 'bs' ? 'Isprintaj QR Kod' : 'Print QR Code'}
                    </button>
                </div>
            </div>

            <p style={{ marginBottom: 24, fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                {lang === 'bs' 
                    ? 'Popis prijavljenih opasnosti koje su radnici slikali i poslali putem QR koda.' 
                    : 'List of hazard reports submitted by workers via QR code scans.'}
            </p>

            <div className="card">
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('datum')} style={{...thStyle('datum'), width: 120}}>
                                    {lang === 'bs' ? 'Datum' : 'Date'} {sortIcon('datum')}
                                </th>
                                <th onClick={() => requestSort('lokacija')} style={thStyle('lokacija')}>
                                    {lang === 'bs' ? 'Lokacija' : 'Location'} {sortIcon('lokacija')}
                                </th>
                                <th onClick={() => requestSort('opis')} style={thStyle('opis')}>
                                    {lang === 'bs' ? 'Opis' : 'Description'} {sortIcon('opis')}
                                </th>
                                <th onClick={() => requestSort('ime')} style={thStyle('ime')}>
                                    {lang === 'bs' ? 'Prijavio/la' : 'Reported by'} {sortIcon('ime')}
                                </th>
                                <th onClick={() => requestSort('status')} style={{...thStyle('status'), width: 100, textAlign: 'center'}}>
                                    Status {sortIcon('status')}
                                </th>
                                <th style={{ width: 140, textAlign: 'right' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                                        {lang === 'bs' ? 'Nema prijavljenih opasnosti' : 'No hazard reports found'}
                                    </td>
                                </tr>
                            ) : null}
                            {sortedItems.map(item => (
                                <tr key={item.id}>
                                    <td style={{ color: 'var(--text-muted)' }}>
                                        {item.datum ? new Date(item.datum).toLocaleDateString() : ''}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>
                                        {item.lokacija}
                                        {item.orgJedinicaId && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{getOrgUnitName(item.orgJedinicaId)}</div>}
                                    </td>
                                    <td>{item.opis}</td>
                                    <td>{item.ime}</td>
                                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center', position: 'relative' }}>
                                        {(() => {
                                            const st = STATUS_MAP[item.status] || STATUS_MAP['Novo'];
                                            return (
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (statusDropdownId === item.id) { setStatusDropdownId(null); return; }
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                    const flipUp = spaceBelow < 120;
                                                    setStatusMenuPos(flipUp
                                                        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left - 20 }
                                                        : { top: rect.bottom + 4, left: rect.left - 20 });
                                                    setStatusDropdownId(item.id);
                                                }}
                                                    style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.color}33`, cursor: 'pointer', transition: 'all 0.15s', minWidth: 90 }}
                                                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                                                    title={lang === 'bs' ? 'Kliknite za izmjenu' : 'Click to edit'}
                                                >{st.label} ▾</button>
                                            );
                                        })()}
                                        {statusDropdownId === item.id && (<>
                                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setStatusDropdownId(null); }} />
                                            <div style={{ position: 'fixed', top: statusMenuPos.top, bottom: statusMenuPos.bottom, left: statusMenuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 140, padding: '4px 0' }}>
                                                {Object.entries(STATUS_MAP).map(([key, s]) => (
                                                    <button key={key} onClick={(e) => { e.stopPropagation(); handleStatusChange(item, key); setStatusDropdownId(null); loadData(); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: item.status === key ? s.bg : 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.82rem', fontWeight: item.status === key ? 700 : 500, color: item.status === key ? s.color : 'var(--text)', textAlign: 'left', transition: 'background 0.12s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = s.bg}
                                                        onMouseLeave={e => e.currentTarget.style.background = item.status === key ? s.bg : 'none'}>
                                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                                                        {s.label}
                                                        {item.status === key && <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>✓</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </>)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => setViewingItem(item)} title={lang === 'bs' ? 'Otvori pregled' : 'View report'}>
                                                📷 {lang === 'bs' ? 'Pregled' : 'View'}
                                            </button>
                                            {isAdmin && (
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(item)} style={{ color: 'var(--danger)' }} title={t('delete')}>
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* QR Code Printable Modal */}
            {showQR && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card animate-fadeIn" style={{ background: '#fff', padding: 40, textAlign: 'center', maxWidth: 450, borderRadius: 16, position: 'relative' }}>
                        {/* X close button */}
                        <button
                            onClick={() => setShowQR(false)}
                            style={{
                                position: 'absolute', top: 12, right: 12,
                                width: 32, height: 32, borderRadius: '50%',
                                border: '1px solid #e2e8f0', background: '#f8fafc',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1rem', color: '#64748b', lineHeight: 1,
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                            title="Zatvori"
                        >✕</button>
                        <h2 style={{ color: '#000', marginBottom: 10, fontSize: 24, fontWeight: 900 }}>🚨 PRIJAVA OPASNOSTI</h2>
                        <p style={{ color: '#555', marginBottom: 30, fontSize: 14 }}>Skenirajte kod ispod i odmah prijavite kvar, štetu ili opasnu situaciju na gradilištu. Prijava ide direktno nadležnoj službi.</p>
                        <div style={{ background: '#fff', padding: 20, display: 'inline-block', borderRadius: 12, border: '4px solid #ef4444' }}>
                            <QRCodeSVG value={`${window.location.origin}/q/obs/${activeCompanyId || 'all'}`} size={220} />
                        </div>
                        <div style={{ marginTop: 30, display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button className="btn btn-ghost" style={{ background: '#f1f5f9', color: '#333' }} onClick={() => setShowQR(false)}>Zatvori</button>
                            <button className="btn btn-primary" style={{ background: '#ef4444', color: '#fff' }} onClick={() => window.print()}>🖨️ Printaj plakat</button>
                        </div>
                    </div>
                    {/* Hide backdrop and show ONLY poster when printing */}
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            .card.animate-fadeIn, .card.animate-fadeIn * { visibility: visible; }
                            .card.animate-fadeIn { position: absolute; left: 0; top: 0; width: 100vw; height: 100vh; padding: 100px; text-align: center; box-shadow: none !important; border-radius: 0 !important; }
                            .btn { display: none !important; }
                        }
                    `}</style>
                </div>
            )}

            {/* Viewing Modal */}
            {viewingItem && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(4px)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
                }}>
                    <div className="card animate-fadeIn" style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)' }}>
                            <div style={{ fontWeight: 700 }}>
                                🚨 Prijava Opasnosti <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 12 }}>{new Date(viewingItem.datum).toLocaleString()}</span>
                            </div>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewingItem(null)}>✕</button>
                        </div>
                        <div className="card-body" style={{ overflowY: 'auto', padding: 0 }}>
                            <div style={{ padding: 24 }}>
                                <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                                    {viewingItem.opis}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div>📍 <strong>Lokacija:</strong> {viewingItem.lokacija}</div>
                                    {viewingItem.orgJedinicaId && <div>🏢 <strong>Odjel:</strong> {getOrgUnitName(viewingItem.orgJedinicaId)}</div>}
                                    <div>👤 <strong>Prijavio:</strong> <span style={{ color: 'var(--text)' }}>{viewingItem.ime || 'Anonimno'}</span></div>
                                    <div>🏷️ <strong>Status:</strong> {getStatusBadge(viewingItem.status)}</div>
                                </div>
                            </div>
                            <div style={{ background: '#000', textAlign: 'center', padding: 20 }}>
                                {viewingItem.slika?.url ? (
                                    <img 
                                        src={viewingItem.slika.url} 
                                        style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }} 
                                        alt="Hazard" 
                                    />
                                ) : (
                                    <div style={{ padding: '60px 0', color: '#555' }}>Nema priložene slike</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
