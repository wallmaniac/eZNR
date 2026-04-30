'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getById, getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useSortedList } from '@/hooks/useSortedList';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useAuth } from '@/contexts/AuthContext';
import QRCodeLabel from '@/components/QRCodeLabel';
import PrintPortal from '@/components/PrintPortal';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import PDFExportButton from '@/components/PDFExportButton';
import { generateFleetReport } from '@/lib/pdfReportGenerator';
import VehicleAssignmentsTab from './VehicleAssignmentsTab';
import VehicleDocumentsTab from './VehicleDocumentsTab';
import VehicleTravelOrdersTab from './VehicleTravelOrdersTab';
import Icon3D from '@/components/Icon3D';
import { getNotificationSettings } from '@/lib/systemMonitor';
import PageHeader from '@/components/PageHeader';

const EMPTY = {
    registracija: '', marka: '', model: '', godinaProizvodnje: '',
    tip: 'osobno', vin: '', boja: '',
    datumRegistracije: '', registracijaIstice: '',
    datumTehnickogPregleda: '', tehnickiIstice: '',
    osiguranjeIstice: '',
    vatrogasniAparatDatum: '', prvaPomocIstice: '',
    vozacId: '', vozacIme: '',
    orgJedinicaId: '',
    napomena: '', status: 'aktivan',
};

const STATUS_MAP = {
    aktivan: { bs: 'Aktivno', en: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    servis: { bs: 'Na servisu', en: 'In Service', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    neaktivan: { bs: 'Neaktivno', en: 'Inactive', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
};

const TYPE_MAP = {
    osobno: { bs: 'Osobno vozilo', en: 'Car' },
    teretno: { bs: 'Teretno vozilo', en: 'Truck' },
    specijalno: { bs: 'Specijalno vozilo', en: 'Special' },
    motocikl: { bs: 'Motocikl', en: 'Motorcycle' },
    prikolica: { bs: 'Prikolica', en: 'Trailer' },
};

function FleetInner() {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const searchParams = useSearchParams();
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const { markDirty, markClean } = useUnsavedChanges();

    const [vehicles, setVehicles] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [orgUnits, setOrgUnits] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [activeTab, setActiveTab] = useState('osnovno');
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY, dokumenti: [] });
    const [viewWorkerId, setViewWorkerId] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [statusDropdownId, setStatusDropdownId] = useState(null);
    const [statusMenuPos, setStatusMenuPos] = useState({ top: 0, left: 0 });
    const { activeCompanyId } = useAuth();
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printSelection, setPrintSelection] = useState([]);

    // Worker search dropdown
    const [workerSearch, setWorkerSearch] = useState('');
    const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
    const workerRef = useRef(null);

    const loadData = useCallback(() => {
        setVehicles(getAll(COLLECTIONS.VEHICLES));
        setAssignments(getAll(COLLECTIONS.VEHICLE_ASSIGNMENTS));
        setWorkers(getAll(COLLECTIONS.WORKERS));
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    useEffect(() => {
        const handler = (e) => {
            if (workerRef.current && !workerRef.current.contains(e.target)) setShowWorkerDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Track return-to path for navigation back to originating page
    const returnTo = searchParams?.get('returnTo');

    // Safely capture initial deep link
    const [deepLinkId, setDeepLinkId] = useState(() => {
        if (typeof window !== 'undefined') {
            return new URLSearchParams(window.location.search).get('openId');
        }
        return null;
    });

    useEffect(() => {
        if (deepLinkId && vehicles.length > 0 && !showForm) {
            const openTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
            const rec = vehicles.find(v => v.id === deepLinkId);
            if (rec) {
                setEditingId(rec.id);
                setActiveTab(openTab || 'osnovno');
                setFormData({ dokumenti: [], ...rec });
                setWorkerSearch(rec.vozacIme || '');
                setShowForm(true);
            }
        }
    }, [deepLinkId, vehicles, showForm]);

    const closeForm = () => {
        setShowForm(false); setDeepLinkId(null);
        // If opened from another page, navigate back there
        if (returnTo) {
            router.push(returnTo);
        } else {
            // Clear openId from URL without full navigation
            window.history.replaceState(null, '', '/dashboard/fleet');
        }
    };

    const set = (k, v) => { setFormData(f => ({ ...f, [k]: v })); markDirty(); };

    const filteredWorkers = workers.filter(w => {
        if (!workerSearch) return true;
        const q = workerSearch.toLowerCase();
        return `${w.ime} ${w.prezime}`.toLowerCase().includes(q);
    });

    const handleWorkerSelect = (w) => {
        set('vozacId', w.id);
        set('vozacIme', `${w.ime} ${w.prezime}`);
        setWorkerSearch(`${w.ime} ${w.prezime}`);
        setShowWorkerDropdown(false);
    };

    // Expiry helpers
    const notifSettings = getNotificationSettings();
    const alertDays = notifSettings.fleetExpiryDays || 30;
    const today = new Date().toISOString().split('T')[0];
    const alertDate = new Date(Date.now() + alertDays * 86400000).toISOString().split('T')[0];

    const getExpiryBadge = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr < today) return <span className="badge badge-danger">{bs ? 'Isteklo' : 'Expired'}</span>;
        if (dateStr <= alertDate) return <span className="badge badge-warning">{bs ? 'Uskoro' : 'Soon'}</span>;
        return <span className="badge badge-success">{bs ? 'Vrijedi' : 'Valid'}</span>;
    };

    // Stats
    const stats = {
        total: vehicles.length,
        active: vehicles.filter(v => v.status === 'aktivan').length,
        regExpired: vehicles.filter(v => v.registracijaIstice && v.registracijaIstice <= alertDate).length,
        serviceSoon: vehicles.filter(v => v.tehnickiIstice && v.tehnickiIstice <= alertDate).length,
    };

    // Filter & sort
    const filtered = vehicles.filter(v => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (v.registracija || '').toLowerCase().includes(q)
            || (v.marka || '').toLowerCase().includes(q)
            || (v.model || '').toLowerCase().includes(q)
            || (v.vozacIme || '').toLowerCase().includes(q);
    });

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'registracija');

    // Action menu
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

    const openNew = () => {
        setEditingId(null); setActiveTab('osnovno'); setFormData({ ...EMPTY, dokumenti: [] }); setWorkerSearch(''); setShowForm(true);
    };

    const openEdit = (v) => {
        setEditingId(v.id); setActiveTab('osnovno'); setFormData({ dokumenti: [], ...v }); setWorkerSearch(v.vozacIme || ''); setShowForm(true);
    };

    const handleSave = async () => {
        if (!formData.registracija) {
            await alert(bs ? 'Registracija je obavezna!' : 'Registration is required!');
            return;
        }
        if (editingId) { update(COLLECTIONS.VEHICLES, editingId, formData); }
        else { create(COLLECTIONS.VEHICLES, formData); }
        loadData(); markClean(); showFlash(); closeForm();
    };

    const handleDelete = async (id) => {
        if (await confirm(bs ? 'Obrisati ovo vozilo?' : 'Delete this vehicle?')) {
            remove(COLLECTIONS.VEHICLES, id); setActionMenuId(null); loadData();
        }
    };

    const toggleAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id)));
        else setSelectedIds(new Set());
    };
    const toggleOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(bs ? `Obrisati ${selectedIds.size} vozila?` : `Delete ${selectedIds.size} vehicles?`)) {
            for (let id of selectedIds) remove(COLLECTIONS.VEHICLES, id);
            setSelectedIds(new Set()); loadData();
        }
    };

    const getOrgName = (id) => { const o = orgUnits.find(x => x.id === id); return o ? o.naziv : '—'; };
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    return (
        <>
            <div className="animate-fadeIn">
                <DialogRenderer />
                
                <PrintPortal isPrinting={showPrintModal}>
                    <div id="qr-print-area" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 60mm)', gap: '4mm', alignContent: 'start', justifyContent: 'center', padding: '10mm' }}>
                        {(() => {
                            const company = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                            return printSelection.map((v, i) => (
                                <QRCodeLabel 
                                    key={i} 
                                    type="fleet" 
                                    id={v.id} 
                                    title={v.registracija || 'VOZILO'} 
                                    subtitle={`${v.marka} ${v.model}`} 
                                    companyLogo={company?.logo} 
                                    companyId={activeCompanyId}
                                />
                            ));
                        })()}
                    </div>
                </PrintPortal>

                {showPrintModal && (
                    <div className="modal-overlay no-print" onClick={() => setShowPrintModal(false)}>
                        <div className="modal" style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>🖨️ Isprintaj QR kodove</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setShowPrintModal(false)}>✕</button>
                            </div>
                            <div className="modal-body" style={{ background: '#f5f5f5', padding: 20 }}>
                                <div style={{ marginBottom: 16, fontSize: '0.85rem', color: '#555' }}>
                                    Pripremljeno <strong>{printSelection.length}</strong> etiketa za print. 
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 60mm)', gap: '4mm', alignContent: 'start', justifyContent: 'center', opacity: 0.5, pointerEvents: 'none' }}>
                                    {(() => {
                                        const company = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                                        return printSelection.map((v, i) => (
                                            <QRCodeLabel 
                                                key={i} 
                                                type="fleet" 
                                                id={v.id} 
                                                title={v.registracija || 'VOZILO'} 
                                                subtitle={`${v.marka} ${v.model}`} 
                                                companyLogo={company?.logo} 
                                                companyId={activeCompanyId}
                                            />
                                        ));
                                    })()}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setShowPrintModal(false)}>{t('cancel')}</button>
                                <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Printaj stranicu</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <PageHeader icon={<Icon3D name="Vozni park.png" size={64} />} title={bs ? 'Vozni park' : 'Fleet Management'} subtitle={bs ? 'Evidencija vozila, registracija, tehnički pregledi i osiguranja' : 'Vehicle tracking, registration, inspections & insurance'} />

                {/* Stats cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20, marginTop: 16 }}>
                    {[
                        { label: bs ? 'Ukupno vozila' : 'Total Vehicles', val: stats.total, icon: '🚗', color: 'var(--primary)' },
                        { label: bs ? 'Aktivna' : 'Active', val: stats.active, icon: '✅', color: '#22C55E' },
                        { label: bs ? 'Registracija uskoro' : 'Reg. Expiring Soon', val: stats.regExpired, icon: '🔴', color: '#EF4444' },
                        { label: bs ? 'Tehnički uskoro' : 'Inspection Soon', val: stats.serviceSoon, icon: '⚠️', color: '#F59E0B' },
                    ].map((s, i) => (
                        <div key={i} className="card" style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)', marginTop: 2 }}>{s.val}</div>
                                </div>
                                <span style={{ fontSize: '1.4rem' }}>{s.icon}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Form Modal */}
                {showForm && (
                    <div className="modal-overlay" onClick={closeForm}>
                        <div className="modal" style={{ width: '100%', maxWidth: 850, minHeight: 650, padding: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', padding: '24px 32px 16px 32px' }}>
                                <h2>{editingId ? '✏️' : '+'} {bs ? 'Vozilo: ' : 'Vehicle: '} {formData.registracija || ''}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={closeForm}>✕</button>
                            </div>

                            {/* Tab bar */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0 24px', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
                                {[
                                    { key: 'osnovno', icon: '📄', label: bs ? 'Osnovni podaci' : 'Basic Info', show: true },
                                    { key: 'istorija', icon: '🔄', label: bs ? 'Zaduženja' : 'Assignments', show: !!editingId },
                                    { key: 'arhiva', icon: '📁', label: bs ? 'Arhiva dokumenata' : 'Documents', show: !!editingId },
                                    { key: 'nalozi', icon: '📝', label: bs ? 'Putni nalozi' : 'Travel Orders', show: !!editingId }
                                ].filter(t => t.show).map(tab => (
                                    <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                                        padding: '9px 16px', border: 'none', cursor: 'pointer',
                                        fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: 600,
                                        background: 'transparent',
                                        borderBottom: '2px solid',
                                        borderBottomColor: activeTab === tab.key ? 'var(--primary)' : 'transparent',
                                        color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                                        marginBottom: -2, transition: 'all 0.15s',
                                        display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
                                    }}>
                                        {tab.icon} <span style={{ opacity: activeTab === tab.key ? 1 : 0.85 }}>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                                {activeTab === 'osnovno' && (
                                    <div className="form-grid-2">
                                        {/* Registration */}
                                        <div className="form-group">
                                        <label className="form-label" style={{ fontWeight: 700 }}>{bs ? 'Registracija' : 'Registration'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                        <input className="form-input" value={formData.registracija} onChange={e => set('registracija', e.target.value)} placeholder="A12-B-345" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Tip vozila' : 'Vehicle Type'}</label>
                                        <select className="form-select" value={formData.tip} onChange={e => set('tip', e.target.value)}>
                                            {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{bs ? v.bs : v.en}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Marka' : 'Brand'}</label>
                                        <input className="form-input" value={formData.marka} onChange={e => set('marka', e.target.value)} placeholder="VW, Mercedes..." />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Model' : 'Model'}</label>
                                        <input className="form-input" value={formData.model} onChange={e => set('model', e.target.value)} placeholder="Golf 8, Sprinter..." />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Godina proizvodnje' : 'Year'}</label>
                                        <input className="form-input" type="number" value={formData.godinaProizvodnje} onChange={e => set('godinaProizvodnje', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'VIN broj' : 'VIN Number'}</label>
                                        <input className="form-input" value={formData.vin} onChange={e => set('vin', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Boja' : 'Color'}</label>
                                        <input className="form-input" value={formData.boja} onChange={e => set('boja', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Status' : 'Status'}</label>
                                        <select className="form-select" value={formData.status} onChange={e => set('status', e.target.value)}>
                                            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{bs ? v.bs : v.en}</option>)}
                                        </select>
                                    </div>

                                    {/* Dates section */}
                                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', marginTop: 4, paddingTop: 12 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>
                                            📅 {bs ? 'Rokovi i datumi' : 'Deadlines & Dates'}
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Registracija od' : 'Registered On'}</label>
                                        <DateInput value={formData.datumRegistracije} onChange={v => set('datumRegistracije', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Registracija ističe' : 'Reg. Expires'}</label>
                                        <DateInput value={formData.registracijaIstice} onChange={v => set('registracijaIstice', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Zadnji tehnički pregled' : 'Last Technical Inspection'}</label>
                                        <DateInput value={formData.datumTehnickogPregleda} onChange={v => set('datumTehnickogPregleda', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Sljedeći tehnički' : 'Next Inspection'}</label>
                                        <DateInput value={formData.tehnickiIstice} onChange={v => set('tehnickiIstice', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Osiguranje ističe' : 'Insurance Expires'}</label>
                                        <DateInput value={formData.osiguranjeIstice} onChange={v => set('osiguranjeIstice', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'PP aparat ističe' : 'Fire Ext. Expires'}</label>
                                        <DateInput value={formData.vatrogasniAparatDatum} onChange={v => set('vatrogasniAparatDatum', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Prva pomoć ističe' : 'First Aid Kit Expires'}</label>
                                        <DateInput value={formData.prvaPomocIstice} onChange={v => set('prvaPomocIstice', v)} />
                                    </div>

                                    {/* Driver section */}
                                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', marginTop: 4, paddingTop: 12 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>
                                            👤 {bs ? 'Zaduženi vozač' : 'Assigned Driver'}
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }} ref={workerRef}>
                                        <label className="form-label">{bs ? 'Vozač' : 'Driver'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input className="form-input" placeholder={bs ? '🔍 Pretraži radnika...' : '🔍 Search worker...'} value={workerSearch}
                                                onChange={e => { setWorkerSearch(e.target.value); setShowWorkerDropdown(true); set('vozacId', ''); set('vozacIme', ''); }}
                                                onFocus={() => setShowWorkerDropdown(true)} autoComplete="off" />
                                            {showWorkerDropdown && (
                                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                                                    {filteredWorkers.length === 0 ? (
                                                        <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{bs ? 'Nema radnika' : 'No workers'}</div>
                                                    ) : filteredWorkers.slice(0, 15).map(w => (
                                                        <button key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                            onClick={() => handleWorkerSelect(w)}>
                                                            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                                                                {w.ime?.[0]}{w.prezime?.[0]}
                                                            </span>
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{w.ime} {w.prezime}</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {formData.vozacId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {formData.vozacIme}</div>}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Org. jedinica' : 'Org. Unit'}</label>
                                        <select className="form-select" value={formData.orgJedinicaId} onChange={e => set('orgJedinicaId', e.target.value)}>
                                            <option value="">—</option>
                                            {orgUnits.map(o => <option key={o.id} value={o.id}>{o.naziv}</option>)}
                                        </select>
                                    </div>

                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">{t('note')}</label>
                                            <textarea className="form-input" rows={2} value={formData.napomena} onChange={e => set('napomena', e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'istorija' && (
                                    <VehicleAssignmentsTab 
                                        vehicleId={editingId} 
                                        vehicles={vehicles} 
                                        assignments={assignments} 
                                        workers={workers} 
                                        reloadData={loadData} 
                                    />
                                )}

                                {activeTab === 'arhiva' && (
                                    <VehicleDocumentsTab 
                                        vehicleId={editingId} 
                                        vehicles={vehicles} 
                                        reloadData={loadData} 
                                    />
                                )}

                                {activeTab === 'nalozi' && (
                                    <VehicleTravelOrdersTab
                                        vehicleId={editingId} 
                                        vehicles={vehicles}
                                        workers={workers}
                                        reloadData={loadData} 
                                    />
                                )}

                            </div>
                            <div className="modal-footer" style={{ padding: '20px 32px', background: 'var(--bg-card)', borderTop: '1px solid var(--border-light)' }}>
                                <button className="btn btn-ghost" onClick={closeForm}>{t('cancel')}</button>
                                {activeTab === 'osnovno' && <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Main table */}
                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                            <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={openNew}>+ {bs ? 'Novo vozilo' : 'New Vehicle'}</button>
                            <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                                <input placeholder={bs ? 'Pretraži vozila...' : 'Search vehicles...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                                {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                            </div>
                            <PDFExportButton buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38, flexShrink: 0 }} options={[
                                { label: bs ? 'Sva vozila' : 'All vehicles', icon: '🚐', onClick: () => generateFleetReport(sorted.map(v => v.id), lang) },
                                ...(selectedIds.size > 0 ? [{ label: `${bs ? 'Odabrana' : 'Selected'} (${selectedIds.size})`, icon: '✓', onClick: () => generateFleetReport(sorted.filter(v => selectedIds.has(v.id)).map(v => v.id), lang) }] : []),
                            ]} />
                            <PDFExportButton label={bs ? '🖨️ QR Kod' : '🖨️ QR Code'} buttonStyle={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', height: 38, flexShrink: 0 }} options={[
                                { label: bs ? 'Svi kodovi' : 'All codes', icon: '🖨️', onClick: () => { setPrintSelection(sorted); setShowPrintModal(true); } },
                                ...(selectedIds.size > 0 ? [{ label: `${bs ? 'Odabrani' : 'Selected'} (${selectedIds.size})`, icon: '✓', onClick: () => { setPrintSelection(sorted.filter(v => selectedIds.has(v.id))); setShowPrintModal(true); } }] : []),
                            ]} />
                            <SavedFlash />
                            {selectedIds.size > 0 && (
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {bs ? 'odabrano' : 'selected'}:</span>
                                    <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                                </div>
                            )}
                            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{sorted.length} {bs ? 'vozila' : 'vehicles'}</span>}
                        </div>
                        <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                        <th style={{ width: 90 }}>{t('actions')}</th>
                                        <th onClick={() => toggleSort('registracija')} style={thStyle('registracija')}>{bs ? 'Registracija' : 'Registration'}{sortIcon('registracija')}</th>
                                        <th onClick={() => toggleSort('marka')} style={thStyle('marka')}>{bs ? 'Marka/Model' : 'Brand/Model'}{sortIcon('marka')}</th>
                                        <th onClick={() => toggleSort('tip')} style={{ ...thStyle('tip'), textAlign: 'center' }}>{bs ? 'Tip' : 'Type'}{sortIcon('tip')}</th>
                                        <th onClick={() => toggleSort('vozacIme')} style={thStyle('vozacIme')}>{bs ? 'Vozač' : 'Driver'}{sortIcon('vozacIme')}</th>
                                        <th onClick={() => toggleSort('registracijaIstice')} style={{ ...thStyle('registracijaIstice'), textAlign: 'center' }}>{bs ? 'Reg. ističe' : 'Reg. Expires'}{sortIcon('registracijaIstice')}</th>
                                        <th onClick={() => toggleSort('tehnickiIstice')} style={{ ...thStyle('tehnickiIstice'), textAlign: 'center' }}>{bs ? 'Tehnički' : 'Inspection'}{sortIcon('tehnickiIstice')}</th>
                                        <th onClick={() => toggleSort('osiguranjeIstice')} style={{ ...thStyle('osiguranjeIstice'), textAlign: 'center' }}>{bs ? 'Osiguranje' : 'Insurance'}{sortIcon('osiguranjeIstice')}</th>
                                        <th style={{ textAlign: 'center' }}>{bs ? 'Status' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.length === 0 ? (
                                        <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    ) : sorted.map(v => {
                                        const st = STATUS_MAP[v.status] || STATUS_MAP.aktivan;
                                        return (
                                            <tr key={v.id} onClick={() => openEdit(v)} style={{ cursor: 'pointer' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" checked={selectedIds.has(v.id)} onChange={() => toggleOne(v.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div style={{ position: 'relative' }}>
                                                        <button className="btn btn-primary btn-sm" onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (actionMenuId === v.id) { setActionMenuId(null); return; }
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                            const flipUp = spaceBelow < 200;
                                                            setMenuPos(flipUp
                                                                ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, rect.top - 8) }
                                                                : { top: rect.bottom + 4, left: rect.left, maxH: Math.max(120, spaceBelow) });
                                                            setActionMenuId(v.id);
                                                        }}>{bs ? 'Akcije' : 'Actions'} ▼</button>
                                                        {actionMenuId === v.id && (
                                                            <>
                                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setActionMenuId(null); }} />
                                                                <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                    <button onClick={() => { setActionMenuId(null); openEdit(v); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✏️ {bs ? 'Otvori' : 'Open'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const copy = { ...v }; delete copy.id; copy.registracija = ''; copy.napomena = (copy.napomena ? copy.napomena + ' ' : '') + (bs ? '(Kopija)' : '(Copy)'); create(COLLECTIONS.VEHICLES, copy); loadData(); showFlash(); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📋 {bs ? 'Kopiraj' : 'Copy'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); setPrintSelection([v]); setShowPrintModal(true); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🖨️ {bs ? 'Printaj QR kod' : 'Print QR code'}</button>
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); handleDelete(v.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700, letterSpacing: 0.5 }}>{v.registracija || '—'}</td>
                                                <td>{v.marka} {v.model}</td>
                                                <td style={{ textAlign: 'center' }}><span className="badge badge-info" style={{ display: 'inline-block', textAlign: 'center', minWidth: 80 }}>{bs ? TYPE_MAP[v.tip]?.bs : TYPE_MAP[v.tip]?.en || v.tip}</span></td>
                                                <td>
                                                    <button onClick={e => { e.stopPropagation(); if (v.vozacId) setViewWorkerId(v.vozacId); }}
                                                        style={{ background: 'none', border: 'none', cursor: v.vozacId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: v.vozacId ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}>
                                                        {v.vozacIme || '—'}
                                                    </button>
                                                </td>
                                                <td style={{ textAlign: 'center' }}><div>{formatDate(v.registracijaIstice)}</div><div style={{ marginTop: 2 }}>{getExpiryBadge(v.registracijaIstice)}</div></td>
                                                <td style={{ textAlign: 'center' }}><div>{formatDate(v.tehnickiIstice)}</div><div style={{ marginTop: 2 }}>{getExpiryBadge(v.tehnickiIstice)}</div></td>
                                                <td style={{ textAlign: 'center' }}><div>{formatDate(v.osiguranjeIstice)}</div><div style={{ marginTop: 2 }}>{getExpiryBadge(v.osiguranjeIstice)}</div></td>
                                                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center', position: 'relative' }}>
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (statusDropdownId === v.id) { setStatusDropdownId(null); return; }
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                        const flipUp = spaceBelow < 140;
                                                        setStatusMenuPos(flipUp
                                                            ? { bottom: window.innerHeight - rect.top + 4, left: rect.left - 20 }
                                                            : { top: rect.bottom + 4, left: rect.left - 20 });
                                                        setStatusDropdownId(v.id);
                                                    }}
                                                        style={{ padding: '4px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color, border: `1px solid ${st.color}33`, cursor: 'pointer', transition: 'all 0.15s', minWidth: 80 }}
                                                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
                                                        title={bs ? 'Klikni za promjenu statusa' : 'Click to change status'}
                                                    >{bs ? st.bs : st.en} ▾</button>
                                                    {statusDropdownId === v.id && (<>
                                                        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setStatusDropdownId(null); }} />
                                                        <div style={{ position: 'fixed', top: statusMenuPos.top, bottom: statusMenuPos.bottom, left: statusMenuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 160, padding: '4px 0' }}>
                                                            {Object.entries(STATUS_MAP).map(([key, s]) => (
                                                                <button key={key} onClick={(e) => { e.stopPropagation(); update(COLLECTIONS.VEHICLES, v.id, { status: key }); setStatusDropdownId(null); loadData(); }}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: v.status === key ? s.bg : 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.82rem', fontWeight: v.status === key ? 700 : 500, color: v.status === key ? s.color : 'var(--text)', textAlign: 'left', transition: 'background 0.12s' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = s.bg}
                                                                    onMouseLeave={e => e.currentTarget.style.background = v.status === key ? s.bg : 'none'}>
                                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                                                                    {bs ? s.bs : s.en}
                                                                    {v.status === key && <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>✓</span>}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>)}
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

export default function FleetPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje / Loading...</div>}>
            <FleetInner />
        </Suspense>
    );
}
