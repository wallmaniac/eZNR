'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { getAll, getRawAll, update, remove, COLLECTIONS } from '@/lib/dataStore';
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

    // Handle deep link to open specific hazard observation from Email
    useEffect(() => {
        if (items.length > 0 && !viewingItem) {
            const urlParams = new URLSearchParams(window.location.search);
            const hazardIdQuery = urlParams.get('id');
            if (hazardIdQuery) {
                const h = items.find(i => i.id === hazardIdQuery);
                if (h) {
                    setViewingItem(h);
                    // Remove ?id= from URL so it doesn't persistently re-open on refresh
                    window.history.replaceState({}, '', '/dashboard/observations');
                }
            }
        }
    }, [items, viewingItem]);

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

    const getStatusBadge = (status) => {
        if (status === 'Riješeno') return <span className="badge badge-success">Riješeno</span>;
        if (status === 'U obradi') return <span className="badge badge-warning">U obradi</span>;
        return <span className="badge badge-danger">Novo</span>;
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
                                    <td style={{ fontWeight: 600 }}>{item.lokacija}</td>
                                    <td>{item.opis}</td>
                                    <td>{item.ime}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <select 
                                            value={item.status || 'Novo'} 
                                            onChange={e => handleStatusChange(item, e.target.value)}
                                            style={{
                                                fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px',
                                                borderRadius: '3px', background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                                border: '1px solid var(--border)', outline: 'none', cursor: 'pointer'
                                            }}
                                        >
                                            <option value="Novo">Novo</option>
                                            <option value="U obradi">U obradi</option>
                                            <option value="Riješeno">Riješeno</option>
                                        </select>
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
                    <div className="card animate-fadeIn" style={{ background: '#fff', padding: 40, textAlign: 'center', maxWidth: 450, borderRadius: 16 }}>
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
