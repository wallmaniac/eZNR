'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import QRCodeLabel from '@/components/QRCodeLabel';
import { QRCodeSVG } from 'qrcode.react';
import PrintPortal from '@/components/PrintPortal';
import { getById, getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useSortedList } from '@/hooks/useSortedList';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import PDFExportButton from '@/components/PDFExportButton';
import { generateFireProtectionReport } from '@/lib/pdfReportGenerator';
import * as XLSX from 'xlsx';
import PageHeader from '@/components/PageHeader';
import { uploadDocument } from '@/lib/storageService';

// ── Fire Extinguisher ──
const EMPTY_EXT = {
    serijskiBroj: '', tip: 'prah', tezina: '', lokacija: '',
    datumNabavke: '', zadnjiServis: '', sljedeciServis: '',
    status: 'ispravan', odgovornaOsoba: '', napomena: '',
    pritisak: '', plomba: 'da', dokumenti: [],
};

const EXT_TYPES = {
    prah: { bs: 'Prah (ABC)', en: 'Powder (ABC)' },
    co2: { bs: 'CO₂', en: 'CO₂' },
    pjena: { bs: 'Pjena', en: 'Foam' },
    voda: { bs: 'Voda', en: 'Water' },
};

// ── Hydrant ──
const EMPTY_HYD = {
    oznaka: '', lokacija: '', tip: 'unutarnji',
    datumZadnjegPregleda: '', sljedeciPregled: '',
    status: 'ispravan', napomena: '',
    pritisak: '', plomba: 'da', dokumenti: [],
};

const STATUS_MAP = {
    ispravan: { bs: 'Ispravan', en: 'OK', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    neispravan: { bs: 'Neispravan', en: 'Faulty', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
    servis: { bs: 'Na servisu', en: 'In Service', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    povucen: { bs: 'Povučen', en: 'Retired', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
};

const EXT_STATUS_CYCLE = {
    ispravan: 'neispravan',
    neispravan: 'servis',
    servis: 'povucen',
    povucen: 'ispravan',
};

const HYD_STATUS_CYCLE = {
    ispravan: 'neispravan',
    neispravan: 'servis',
    servis: 'ispravan',
};

export default function FireProtectionPage() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const { markDirty, markClean } = useUnsavedChanges();
    const { activeCompanyId } = useAuth();
    
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printSelection, setPrintSelection] = useState([]);

    const [tab, setTab] = useState('extinguishers'); // 'extinguishers' | 'hydrants'

    // ── Extinguishers ──
    const [extinguishers, setExtinguishers] = useState([]);
    const [showExtForm, setShowExtForm] = useState(false);
    const [editingExtId, setEditingExtId] = useState(null);
    const [extForm, setExtForm] = useState({ ...EMPTY_EXT });
    const [extSearch, setExtSearch] = useState('');
    const [extSelectedIds, setExtSelectedIds] = useState(new Set());
    const [extUploading, setExtUploading] = useState(false);
    const [hydUploading, setHydUploading] = useState(false);

    // ── Hydrants ──
    const [hydrants, setHydrants] = useState([]);
    const [showHydForm, setShowHydForm] = useState(false);
    const [editingHydId, setEditingHydId] = useState(null);
    const [hydForm, setHydForm] = useState({ ...EMPTY_HYD });
    const [hydSearch, setHydSearch] = useState('');
    const [hydSelectedIds, setHydSelectedIds] = useState(new Set());

    const loadData = useCallback(() => {
        setExtinguishers(getAll(COLLECTIONS.FIRE_EXTINGUISHERS));
        setHydrants(getAll(COLLECTIONS.HYDRANTS));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    // ── Deep-link: open specific item from QR code scan ──
    const openItemHandledRef = useRef(false);
    useEffect(() => {
        if (openItemHandledRef.current) return;
        const qs = new URLSearchParams(window.location.search);
        const openId = qs.get('openItem');
        if (!openId) return;
        // Try extinguishers first
        const ext = extinguishers.find(e => e.id === openId);
        if (ext) {
            openItemHandledRef.current = true;
            setTab('extinguishers');
            openEditExt(ext);
            window.history.replaceState(null, '', '/dashboard/fire-protection');
            return;
        }
        // Try hydrants
        const hyd = hydrants.find(h => h.id === openId);
        if (hyd) {
            openItemHandledRef.current = true;
            setTab('hydrants');
            openEditHyd(hyd);
            window.history.replaceState(null, '', '/dashboard/fire-protection');
            return;
        }
    }, [extinguishers, hydrants]);

    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const getExpiryBadge = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr < today) return <span className="badge badge-danger">{t('isteklo')}</span>;
        if (dateStr <= in30) return <span className="badge badge-warning">{t('soon')}</span>;
        return <span className="badge badge-success">{t('uRedu')}</span>;
    };

    // ── Stats ──
    const extStats = {
        total: extinguishers.length,
        ok: extinguishers.filter(e => e.status === 'ispravan').length,
        faulty: extinguishers.filter(e => e.status === 'neispravan').length,
        serviceSoon: extinguishers.filter(e => e.sljedeciServis && e.sljedeciServis <= in30 && e.sljedeciServis>= today).length,
    };
    const hydStats = {
        total: hydrants.length,
        ok: hydrants.filter(h => h.status === 'ispravan').length,
        faulty: hydrants.filter(h => h.status === 'neispravan').length,
    };

    // ── Extinguisher handlers ──
    const setExt = (k, v) => { setExtForm(f => ({ ...f, [k]: v })); markDirty(); };

    const filteredExt = extinguishers.filter(e => {
        if (!extSearch) return true;
        const q = extSearch.toLowerCase();
        return (e.serijskiBroj || '').toLowerCase().includes(q) || (e.lokacija || '').toLowerCase().includes(q) || (e.tip || '').toLowerCase().includes(q);
    });
    const { sorted: sortedExt, toggleSort: toggleExtSort, sortIcon: extSortIcon, thStyle: extThStyle } = useSortedList(filteredExt, 'serijskiBroj');

    const openNewExt = () => { setEditingExtId(null); setExtForm({ ...EMPTY_EXT }); setShowExtForm(true); };
    const openEditExt = (e) => { setEditingExtId(e.id); setExtForm({ ...e }); setShowExtForm(true); };

    const handleSaveExt = async () => {
        if (!extForm.serijskiBroj) { await alert(t('serialNumberIsRequired')); return; }
        if (editingExtId) { update(COLLECTIONS.FIRE_EXTINGUISHERS, editingExtId, extForm); }
        else { create(COLLECTIONS.FIRE_EXTINGUISHERS, extForm); }
        loadData(); markClean(); setShowExtForm(false); showFlash();
    };

    const handleDeleteExt = async (id) => {
        if (await confirm(t('deleteThisExtinguisher'))) { remove(COLLECTIONS.FIRE_EXTINGUISHERS, id); loadData(); }
    };

    const handleDeleteSelectedExt = async () => {
        if (extSelectedIds.size === 0) return;
        if (await confirm(t('deleteExtinguishers').replace('{0}', extSelectedIds.size))) {
            for (let id of extSelectedIds) remove(COLLECTIONS.FIRE_EXTINGUISHERS, id);
            setExtSelectedIds(new Set()); loadData();
        }
    };

    // ── Hydrant handlers ──
    const setHyd = (k, v) => { setHydForm(f => ({ ...f, [k]: v })); markDirty(); };

    const filteredHyd = hydrants.filter(h => {
        if (!hydSearch) return true;
        const q = hydSearch.toLowerCase();
        return (h.oznaka || '').toLowerCase().includes(q) || (h.lokacija || '').toLowerCase().includes(q);
    });
    const { sorted: sortedHyd, toggleSort: toggleHydSort, sortIcon: hydSortIcon, thStyle: hydThStyle } = useSortedList(filteredHyd, 'oznaka');

    const openNewHyd = () => { setEditingHydId(null); setHydForm({ ...EMPTY_HYD }); setShowHydForm(true); };
    const openEditHyd = (h) => { setEditingHydId(h.id); setHydForm({ ...h }); setShowHydForm(true); };

    const handleSaveHyd = async () => {
        if (!hydForm.oznaka) { await alert(t('codeIsRequired')); return; }
        if (editingHydId) { update(COLLECTIONS.HYDRANTS, editingHydId, hydForm); }
        else { create(COLLECTIONS.HYDRANTS, hydForm); }
        loadData(); markClean(); setShowHydForm(false); showFlash();
    };

    const handleDeleteHyd = async (id) => {
        if (await confirm(t('deleteThisHydrant'))) { remove(COLLECTIONS.HYDRANTS, id); loadData(); }
    };

    const handleDeleteSelectedHyd = async () => {
        if (hydSelectedIds.size === 0) return;
        if (await confirm(t('deleteHydrants').replace('{0}', hydSelectedIds.size))) {
            for (let id of hydSelectedIds) remove(COLLECTIONS.HYDRANTS, id);
            setHydSelectedIds(new Set()); loadData();
        }
    };

    const handleExtExcelExport = useCallback((forceAll = false) => {
        const targetRows = (!forceAll && extSelectedIds.size > 0)
            ? sortedExt.filter(e => extSelectedIds.has(e.id))
            : sortedExt;
            
        const dataRows = targetRows.map(e => ({
            [t('tvBroj')]: e.serijskiBroj,
            [t('tip')]: t('extType_' + e.tip) || e.tip,
            [t('weight')]: e.tezina ? `${e.tezina} kg` : '—',
            [t('lokacija')]: e.lokacija || '—',
            [t('nextService1')]: e.sljedeciServis ? e.sljedeciServis.split('T')[0].split('-').reverse().join('.') : '—',
            [t('status')]: t('status_' + e.status) || e.status || '—'
        }));

        const ws = XLSX.utils.json_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PP Aparati');
        XLSX.writeFile(wb, `PPAparati_izvoz_${new Date().toISOString().split('T')[0]}.xlsx`);
    }, [extSelectedIds, sortedExt, t]);

    const handleHydExcelExport = useCallback((forceAll = false) => {
        const targetRows = (!forceAll && hydSelectedIds.size > 0)
            ? sortedHyd.filter(h => hydSelectedIds.has(h.id))
            : sortedHyd;
            
        const dataRows = targetRows.map(h => ({
            [t('oznaka')]: h.oznaka,
            [t('tip')]: h.tip === 'unutarnji' ? 'Unutarnji' : 'Vanjski',
            [t('lokacija')]: h.lokacija || '—',
            [t('nextExam')]: h.sljedeciPregled ? h.sljedeciPregled.split('T')[0].split('-').reverse().join('.') : '—',
            [t('status')]: t('status_' + h.status) || h.status || '—'
        }));

        const ws = XLSX.utils.json_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Hidranti');
        XLSX.writeFile(wb, `Hidranti_izvoz_${new Date().toISOString().split('T')[0]}.xlsx`);
    }, [hydSelectedIds, sortedHyd, t]);

    // ── Action menus ──
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({});
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

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

    const renderStatusBadge = (status) => {
        const s = STATUS_MAP[status] || STATUS_MAP.ispravan;
        return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>{t('status_' + status)}</span>;
    };

    const tabBtn = (key, label, icon) => (
        <button onClick={() => setTab(key)} style={{
            padding: '10px 20px', background: tab === key ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
            color: tab === key ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-md)',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', fontFamily: 'var(--font-body)', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 8,
        }}>{icon} {label}</button>
    );

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            
            <PrintPortal isPrinting={showPrintModal}>
                <div id="qr-print-area" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 60mm)', gap: '4mm', alignContent: 'start', justifyContent: 'center', padding: '10mm' }}>
                    {(() => {
                        const company = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                        return printSelection.map((item, i) => (
                            <QRCodeLabel 
                                key={i} 
                                type="fp" 
                                id={item.id} 
                                title={item.title} 
                                subtitle={item.sub} 
                                companyLogo={company?.logo} 
                                companyId={activeCompanyId}
                            />
                        ));
                    })()}
                </div>
            </PrintPortal>

            {showPrintModal && (
                <div className="modal-overlay no-print" style={{ zIndex: 11000 }} onClick={() => setShowPrintModal(false)}>
                    <div className="modal" style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🖨️ Isprintaj QR kodove</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowPrintModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ background: '#f5f5f5', padding: 20 }}>
                            <div style={{ marginBottom: 16, fontSize: '0.85rem', color: '#555' }}>
                                Pripremljeno <strong>{printSelection.length}</strong> etiketa za print. 
                                Koristite uobičajeni A4 papir ili formatirajte ladicu na samoljepljivi papir.
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 60mm)', gap: '4mm', alignContent: 'start', justifyContent: 'center', opacity: 0.5, pointerEvents: 'none' }}>
                                {(() => {
                                    const company = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                                    return printSelection.map((item, i) => (
                                        <QRCodeLabel 
                                            key={i} 
                                            type="fp" 
                                            id={item.id} 
                                            title={item.title} 
                                            subtitle={item.sub} 
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
            <PageHeader icon="🧯" title={t('fireTraining')} />

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20, marginTop: 16 }}>
                {[
                    { label: t('ppAparati'), val: extStats.total, icon: '🧯', color: 'var(--primary)' },
                    { label: t('uRedu'), val: extStats.ok, icon: '✅', color: '#22C55E' },
                    { label: t('faulty'), val: extStats.faulty, icon: '🔴', color: '#EF4444' },
                    { label: t('serviceSoon'), val: extStats.serviceSoon, icon: '⚠️', color: '#F59E0B' },
                    { label: t('hidranti'), val: hydStats.total, icon: '🚰', color: '#6366F1' },
                ].map((s, i) => (
                    <div key={i} className="card" style={{ padding: '14px 18px' }}>
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

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {tabBtn('extinguishers', t('ppAparati'), '🧯')}
                {tabBtn('hydrants', t('hydrantNetwork1'), '🚰')}
            </div>

            {/* ════════ EXTINGUISHERS TAB ════════ */}
            {tab === 'extinguishers' && (
                <>
                    {showExtForm && (
                        <div className="modal-overlay" onClick={() => setShowExtForm(false)}>
                            <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                                <div className="modal-header" style={{ display: 'flex', alignItems: 'center' }}>
                                    <h2>{editingExtId ? '✏️' : '+'} {t('fireExtinguisher')}</h2>
                                    {editingExtId && (
                                        <div 
                                            onClick={() => {
                                                setPrintSelection([{ id: editingExtId, title: `APARAT ${extForm.serijskiBroj}`, sub: t('extType_' + extForm.tip) || extForm.tip }]);
                                                setShowPrintModal(true);
                                            }}
                                            title="Kliknite za ispis QR koda"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '5px 10px',
                                                borderRadius: 8,
                                                border: '1.5px solid var(--border)',
                                                background: 'var(--bg-input)',
                                                cursor: 'pointer',
                                                marginLeft: 'auto',
                                                marginRight: 10,
                                                transition: 'all 0.15s ease',
                                                userSelect: 'none'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                        >
                                            <div style={{ padding: 2, background: 'white', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                                                <QRCodeSVG 
                                                    value={activeCompanyId ? `${window.location.origin}/q/fp/${editingExtId}?c=${activeCompanyId}` : `${window.location.origin}/q/fp/${editingExtId}`} 
                                                    size={26} 
                                                    level="M" 
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>QR KOD</span>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>🖨️ {t('isprintajQr') || 'Print'}</span>
                                            </div>
                                        </div>
                                    )}
                                    <button className="btn btn-ghost btn-icon" onClick={() => setShowExtForm(false)}>✕</button>
                                </div>
                                <div className="modal-body">
                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontWeight: 700 }}>{t('serialNumber')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                            <input className="form-input" value={extForm.serijskiBroj} onChange={e => setExt('serijskiBroj', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('vrstaPregleda')}</label>
                                            <select className="form-select" value={extForm.tip} onChange={e => setExt('tip', e.target.value)}>
                                                {Object.entries(EXT_TYPES).map(([k]) => <option key={k} value={k}>{t('extType_' + k)}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('weightKg')}</label>
                                            <input className="form-input" value={extForm.tezina} onChange={e => setExt('tezina', e.target.value)} placeholder="6, 9, 12..." />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('lokacija')}</label>
                                            <input className="form-input" value={extForm.lokacija} onChange={e => setExt('lokacija', e.target.value)} placeholder={t('hall1Floor2')} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('purchased')}</label>
                                            <DateInput value={extForm.datumNabavke} onChange={v => setExt('datumNabavke', v)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('status')}</label>
                                            <select className="form-select" value={extForm.status} onChange={e => setExt('status', e.target.value)}>
                                                {Object.entries(STATUS_MAP).map(([k]) => <option key={k} value={k}>{t('status_' + k)}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('lastService')}</label>
                                            <DateInput value={extForm.zadnjiServis} onChange={v => setExt('zadnjiServis', v)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('nextService')}</label>
                                            <DateInput value={extForm.sljedeciServis} onChange={v => setExt('sljedeciServis', v)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('odgovornaOsoba')}</label>
                                            <input className="form-input" value={extForm.odgovornaOsoba} onChange={e => setExt('odgovornaOsoba', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('pritisak')}</label>
                                            <input className="form-input" value={extForm.pritisak || ''} onChange={e => setExt('pritisak', e.target.value)} placeholder="npr. 15 bar" />
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                                💡 {t('extPressureHint')}
                                            </span>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('plomba')}</label>
                                            <select className="form-select" value={extForm.plomba || 'da'} onChange={e => setExt('plomba', e.target.value)}>
                                                <option value="da">{t('yes')}</option>
                                                <option value="ne">{t('no')}</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">{t('note')}</label>
                                            <textarea className="form-input" rows={2} value={extForm.napomena} onChange={e => setExt('napomena', e.target.value)} />
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                                            <label className="form-label" style={{ fontWeight: 700 }}>📁 {t('ucitaniDokumenti')}</label>
                                            
                                            {(!extForm.dokumenti || extForm.dokumenti.length === 0) ? (
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>{t('nemaDokumenata')}</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                                    {extForm.dokumenti.map((doc, idx) => (
                                                        <div key={doc.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
                                                                <span>📎</span>
                                                                <span style={{ fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{doc.name}</span>
                                                                {doc.size && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({(doc.size / 1024).toFixed(1)} KB)</span>}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => window.open(doc.url, '_blank')} title={t('otvori')}>👁️</button>
                                                                <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => {
                                                                    const updated = extForm.dokumenti.filter((_, i) => i !== idx);
                                                                    setExt('dokumenti', updated);
                                                                }} title={t('obrisi')}>🗑️</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <input 
                                                    type="file" 
                                                    id="ext-file-upload" 
                                                    style={{ display: 'none' }} 
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setExtUploading(true);
                                                        try {
                                                            const res = await uploadDocument(file, activeCompanyId, 'fire-protection');
                                                            const newDoc = {
                                                                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                                                                name: file.name,
                                                                url: res.url,
                                                                size: file.size,
                                                                uploadedAt: new Date().toISOString()
                                                            };
                                                            setExt('dokumenti', [...(extForm.dokumenti || []), newDoc]);
                                                        } catch (err) {
                                                            console.error('Upload failed:', err);
                                                            alert(t('greskaPriUcitavanjuDatoteke'));
                                                        } finally {
                                                            setExtUploading(false);
                                                        }
                                                    }} 
                                                />
                                                <button 
                                                    type="button" 
                                                    className="btn btn-ghost btn-sm" 
                                                    disabled={extUploading} 
                                                    onClick={() => document.getElementById('ext-file-upload')?.click()}
                                                    style={{ border: '1px dashed var(--border)', padding: '8px 16px' }}
                                                >
                                                    {extUploading ? '⏳ ' + t('ucitavanjeDokumenta') : '＋ ' + t('dodajDokument')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-ghost" onClick={() => setShowExtForm(false)}>{t('cancel')}</button>
                                    <button className="btn btn-primary" onClick={handleSaveExt}>💾 {t('save')}</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}><div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                                <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={openNewExt}>+ {t('newExtinguisher')}</button>
                                <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                                    <input placeholder={t('pretrazi') + '...'} value={extSearch} onChange={e => setExtSearch(e.target.value)}
                                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                                    {extSearch && <button onClick={() => setExtSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title={t('ponistiPretragu')}>✕</button>}
                                </div>
                                <PDFExportButton
                                    label={lang !== 'en' ? 'Izvještaji' : 'Reports'}
                                    title={t('prikaziPdfIzvjestaje')}
                                    buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }}
                                    options={[
                                        { header: lang !== 'en' ? 'PDF Izvještaji' : 'PDF Reports' },
                                        { label: t('allExtinguishers'), icon: '🧯', onClick: () => generateFireProtectionReport(sortedExt.map(e => e.id), lang) },
                                        ...(extSelectedIds.size > 0 ? [{ label: `${t('odabrano1')} (${extSelectedIds.size})`, icon: '✓', onClick: () => generateFireProtectionReport(sortedExt.filter(e => extSelectedIds.has(e.id)).map(e => e.id), lang) }] : []),
                                        { divider: true },
                                        { header: lang !== 'en' ? 'Excel Izvoz' : 'Excel Export' },
                                        { label: lang !== 'en' ? 'Svi PP aparati' : 'All Extinguishers', icon: '📥', onClick: () => handleExtExcelExport(true) },
                                        ...(extSelectedIds.size > 0 ? [{ label: lang !== 'en' ? `Odabrani PP aparati (${extSelectedIds.size})` : `Selected Extinguishers (${extSelectedIds.size})`, icon: '📥', onClick: () => handleExtExcelExport(false) }] : []),
                                    ]}
                                />
                                <PDFExportButton label={t('qrKod')} buttonStyle={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', height: 38 }} options={[
                                    { label: t('sviKodovi'), icon: '🖨️', onClick: () => { setPrintSelection(sortedExt.map(e => ({ id: e.id, title: `APARAT ${e.serijskiBroj}`, sub: t('extType_' + e.tip) || e.tip }))); setShowPrintModal(true); } },
                                    ...(extSelectedIds.size > 0 ? [{ label: `${t('odabrani')} (${extSelectedIds.size})`, icon: '✓', onClick: () => { setPrintSelection(sortedExt.filter(e => extSelectedIds.has(e.id)).map(e => ({ id: e.id, title: `APARAT ${e.serijskiBroj}`, sub: t('extType_' + e.tip) || e.tip }))); setShowPrintModal(true); } }] : []),
                                ]} />
                                <SavedFlash />
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{sortedExt.length} {t('extinguishers')}</span>
                            </div>

                            {/* ── Bulk Action Bar ────────────────────────────────────────── */}
                            {extSelectedIds.size > 0 && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                                    background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid rgba(0,191,166,0.2)',
                                    flexWrap: 'wrap',
                                }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                                        ✓ {extSelectedIds.size} {t('odabrano1')} — {t('grupneAkcije') || 'Grupne akcije'}:
                                    </span>
                                    <button className="btn btn-sm btn-primary" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 }} onClick={() => generateFireProtectionReport(sortedExt.filter(e => extSelectedIds.has(e.id)).map(e => e.id), lang)} title={lang !== 'en' ? 'Generiši PDF za odabrane aparate' : 'Generate PDF for selected extinguishers'}>
                                        🖨️ {lang !== 'en' ? 'Generiši PDF' : 'Generate PDF'} ({extSelectedIds.size})
                                    </button>
                                    <button className="btn btn-sm" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0, background: '#107c41', color: 'white' }} onClick={() => handleExtExcelExport(false)} title={lang !== 'en' ? 'Izvezi odabrane aparate u Excel' : 'Export selected extinguishers to Excel'}>
                                        📥 {lang !== 'en' ? 'Izvoz u Excel' : 'Export to Excel'} ({extSelectedIds.size})
                                    </button>
                                    <button className="btn btn-sm btn-danger" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 }} onClick={handleDeleteSelectedExt} title={t('obrisi')}>
                                        🗑️ {t('obrisi')}
                                    </button>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center' }} onClick={() => setExtSelectedIds(new Set())} title={t('ponistiOdabir')}>
                                        ✕
                                    </button>
                                </div>
                            )}
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={extSelectedIds.size === sortedExt.length && sortedExt.length> 0} onChange={e => { if (e.target.checked) setExtSelectedIds(new Set(sortedExt.map(x => x.id))); else setExtSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                            <th style={{ width: 90 }}>{t('actions')}</th>
                                            <th onClick={() => toggleExtSort('serijskiBroj')} style={extThStyle('serijskiBroj')}>{t('tvBroj')}{extSortIcon('serijskiBroj')}</th>
                                            <th onClick={() => toggleExtSort('tip')} style={extThStyle('tip')}>{t('tip')}{extSortIcon('tip')}</th>
                                            <th onClick={() => toggleExtSort('tezina')} style={extThStyle('tezina')}>{t('weight')}{extSortIcon('tezina')}</th>
                                            <th onClick={() => toggleExtSort('lokacija')} style={extThStyle('lokacija')}>{t('lokacija')}{extSortIcon('lokacija')}</th>
                                            <th onClick={() => toggleExtSort('sljedeciServis')} style={extThStyle('sljedeciServis')}>{t('nextService1')}{extSortIcon('sljedeciServis')}</th>
                                            <th>{t('status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedExt.length === 0 ? (
                                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                        ) : sortedExt.map(e => (
                                            <tr key={e.id} onClick={() => openEditExt(e)} style={{ cursor: 'pointer' }}>
                                                <td onClick={ev => ev.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" checked={extSelectedIds.has(e.id)} onChange={() => { const n = new Set(extSelectedIds); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); setExtSelectedIds(n); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                                </td>
                                                <td onClick={ev => ev.stopPropagation()}>
                                                    <div style={{ position: 'relative' }}>
                                                        <button className="btn btn-primary btn-sm" onClick={ev => openMenu(e.id, ev)}>{t('akcije')} ▼</button>
                                                        {actionMenuId === e.id && (
                                                            <>
                                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={ev => { ev.stopPropagation(); setActionMenuId(null); }} />
                                                                <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                    <button onClick={() => { setActionMenuId(null); openEditExt(e); }} className="dropdown-item">✏️ {t('otvori')}</button>
                                                                    <button onClick={() => { setActionMenuId(null); setPrintSelection([{ id: e.id, title: `APARAT ${e.serijskiBroj}`, sub: t('extType_' + e.tip) || e.tip }]); setShowPrintModal(true); }} className="dropdown-item">🖨️ {t('printajQrKod')}</button>
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); const copy = { ...e }; delete copy.id; copy.serijskiBroj = copy.serijskiBroj + '-COPY'; copy.napomena = (copy.napomena ? copy.napomena + ' ' : '') + (t('copy2')); create(COLLECTIONS.FIRE_EXTINGUISHERS, copy); loadData(); showFlash(); }} className="dropdown-item">📋 {t('kopiraj')}</button>
                                                                    <button onClick={() => { setActionMenuId(null); update(COLLECTIONS.FIRE_EXTINGUISHERS, e.id, { status: EXT_STATUS_CYCLE[e.status] || 'ispravan' }); loadData(); }} className="dropdown-item">🔄 {t('status')} → {t('status_' + (EXT_STATUS_CYCLE[e.status] || 'ispravan'))}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]; update(COLLECTIONS.FIRE_EXTINGUISHERS, e.id, { sljedeciServis: nextYear, zadnjiServis: today }); loadData(); showFlash(); }} className="dropdown-item">📅 {t('scheduleService1yr')}</button>
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); handleDeleteExt(e.id); }} className="dropdown-item text-danger">🗑️ {t('izbrisi')}</button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{e.serijskiBroj}</td>
                                                <td><span className="badge badge-info">{t('extType_' + e.tip) || e.tip}</span></td>
                                                <td>{e.tezina ? `${e.tezina} kg` : '—'}</td>
                                                <td>{e.lokacija || '—'}</td>
                                                <td>{formatDate(e.sljedeciServis)} {getExpiryBadge(e.sljedeciServis)}</td>
                                                <td>{renderStatusBadge(e.status)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ════════ HYDRANTS TAB ════════ */}
            {tab === 'hydrants' && (
                <>
                    {showHydForm && (
                        <div className="modal-overlay" onClick={() => setShowHydForm(false)}>
                            <div className="modal" style={{ maxWidth: 550 }} onClick={e => e.stopPropagation()}>
                                <div className="modal-header" style={{ display: 'flex', alignItems: 'center' }}>
                                    <h2>{editingHydId ? '✏️' : '+'} {t('hidrant')}</h2>
                                    {editingHydId && (
                                        <div 
                                            onClick={() => {
                                                setPrintSelection([{ id: editingHydId, title: `HIDRANT ${hydForm.oznaka}`, sub: hydForm.tip === 'unutarnji' ? 'Unutarnji' : 'Vanjski' }]);
                                                setShowPrintModal(true);
                                            }}
                                            title="Kliknite za ispis QR koda"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '5px 10px',
                                                borderRadius: 8,
                                                border: '1.5px solid var(--border)',
                                                background: 'var(--bg-input)',
                                                cursor: 'pointer',
                                                marginLeft: 'auto',
                                                marginRight: 10,
                                                transition: 'all 0.15s ease',
                                                userSelect: 'none'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                        >
                                            <div style={{ padding: 2, background: 'white', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                                                <QRCodeSVG 
                                                    value={activeCompanyId ? `${window.location.origin}/q/fp/${editingHydId}?c=${activeCompanyId}` : `${window.location.origin}/q/fp/${editingHydId}`} 
                                                    size={26} 
                                                    level="M" 
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>QR KOD</span>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>🖨️ {t('isprintajQr') || 'Print'}</span>
                                            </div>
                                        </div>
                                    )}
                                    <button className="btn btn-ghost btn-icon" onClick={() => setShowHydForm(false)}>✕</button>
                                </div>
                                <div className="modal-body">
                                    <div className="form-grid-2">
                                        <div className="form-group">
                                            <label className="form-label" style={{ fontWeight: 700 }}>{t('oznaka')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                            <input className="form-input" value={hydForm.oznaka} onChange={e => setHyd('oznaka', e.target.value)} placeholder="H-01, VH-03..." />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('tip')}</label>
                                            <select className="form-select" value={hydForm.tip} onChange={e => setHyd('tip', e.target.value)}>
                                                <option value="unutarnji">{t('indoor')}</option>
                                                <option value="vanjski">{t('outdoor')}</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">{t('lokacija')}</label>
                                            <input className="form-input" value={hydForm.lokacija} onChange={e => setHyd('lokacija', e.target.value)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('lastInspection')}</label>
                                            <DateInput value={hydForm.datumZadnjegPregleda} onChange={v => setHyd('datumZadnjegPregleda', v)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('nextExam')}</label>
                                            <DateInput value={hydForm.sljedeciPregled} onChange={v => setHyd('sljedeciPregled', v)} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('status')}</label>
                                            <select className="form-select" value={hydForm.status} onChange={e => setHyd('status', e.target.value)}>
                                                {Object.entries(STATUS_MAP).filter(([k]) => k !== 'povucen').map(([k]) => <option key={k} value={k}>{t('status_' + k)}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('pritisak')}</label>
                                            <input className="form-input" value={hydForm.pritisak || ''} onChange={e => setHyd('pritisak', e.target.value)} placeholder="npr. 8 bar" />
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                                💡 {t('hydPressureHint')}
                                            </span>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('plomba')}</label>
                                            <select className="form-select" value={hydForm.plomba || 'da'} onChange={e => setHyd('plomba', e.target.value)}>
                                                <option value="da">{t('yes')}</option>
                                                <option value="ne">{t('no')}</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                            <label className="form-label">{t('note')}</label>
                                            <textarea className="form-input" rows={2} value={hydForm.napomena} onChange={e => setHyd('napomena', e.target.value)} />
                                        </div>
                                        <div className="form-group" style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                                            <label className="form-label" style={{ fontWeight: 700 }}>📁 {t('ucitaniDokumenti')}</label>
                                            
                                            {(!hydForm.dokumenti || hydForm.dokumenti.length === 0) ? (
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>{t('nemaDokumenata')}</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                                                    {hydForm.dokumenti.map((doc, idx) => (
                                                        <div key={doc.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
                                                                <span>📎</span>
                                                                <span style={{ fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>{doc.name}</span>
                                                                {doc.size && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({(doc.size / 1024).toFixed(1)} KB)</span>}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => window.open(doc.url, '_blank')} title={t('otvori')}>👁️</button>
                                                                <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => {
                                                                    const updated = hydForm.dokumenti.filter((_, i) => i !== idx);
                                                                    setHyd('dokumenti', updated);
                                                                }} title={t('obrisi')}>🗑️</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <input 
                                                    type="file" 
                                                    id="hyd-file-upload" 
                                                    style={{ display: 'none' }} 
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setHydUploading(true);
                                                        try {
                                                            const res = await uploadDocument(file, activeCompanyId, 'fire-protection');
                                                            const newDoc = {
                                                                id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                                                                name: file.name,
                                                                url: res.url,
                                                                size: file.size,
                                                                uploadedAt: new Date().toISOString()
                                                            };
                                                            setHyd('dokumenti', [...(hydForm.dokumenti || []), newDoc]);
                                                        } catch (err) {
                                                            console.error('Upload failed:', err);
                                                            alert(t('greskaPriUcitavanjuDatoteke'));
                                                        } finally {
                                                            setHydUploading(false);
                                                        }
                                                    }} 
                                                />
                                                <button 
                                                    type="button" 
                                                    className="btn btn-ghost btn-sm" 
                                                    disabled={hydUploading} 
                                                    onClick={() => document.getElementById('hyd-file-upload')?.click()}
                                                    style={{ border: '1px dashed var(--border)', padding: '8px 16px' }}
                                                >
                                                    {hydUploading ? '⏳ ' + t('ucitavanjeDokumenta') : '＋ ' + t('dodajDokument')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-ghost" onClick={() => setShowHydForm(false)}>{t('cancel')}</button>
                                    <button className="btn btn-primary" onClick={handleSaveHyd}>💾 {t('save')}</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="card">
                        <div className="card-body" style={{ padding: 0 }}><div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                                <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={openNewHyd}>+ {t('newHydrant')}</button>
                                <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, display: 'flex', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                                    <input placeholder={t('pretrazi') + '...'} value={hydSearch} onChange={e => setHydSearch(e.target.value)}
                                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                                    {hydSearch && <button onClick={() => setHydSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title={t('ponistiPretragu')}>✕</button>}
                                </div>
                                <PDFExportButton
                                    label={lang !== 'en' ? 'Izvještaji' : 'Reports'}
                                    title={t('prikaziPdfIzvjestaje')}
                                    buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }}
                                    options={[
                                        { header: lang !== 'en' ? 'PDF Izvještaji' : 'PDF Reports' },
                                        { label: t('allHydrants'), icon: '🚰', onClick: () => generateFireProtectionReport(sortedHyd.map(h => h.id), lang, 'hydrants') },
                                        ...(hydSelectedIds.size > 0 ? [{ label: `${t('odabrano1')} (${hydSelectedIds.size})`, icon: '✓', onClick: () => generateFireProtectionReport(sortedHyd.filter(h => hydSelectedIds.has(h.id)).map(h => h.id), lang, 'hydrants') }] : []),
                                        { divider: true },
                                        { header: lang !== 'en' ? 'Excel Izvoz' : 'Excel Export' },
                                        { label: lang !== 'en' ? 'Svi hidranti' : 'All Hydrants', icon: '📥', onClick: () => handleHydExcelExport(true) },
                                        ...(hydSelectedIds.size > 0 ? [{ label: lang !== 'en' ? `Odabrani hidranti (${hydSelectedIds.size})` : `Selected Hydrants (${hydSelectedIds.size})`, icon: '📥', onClick: () => handleHydExcelExport(false) }] : []),
                                    ]}
                                />
                                <PDFExportButton label={t('qrKod')} buttonStyle={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', height: 38 }} options={[
                                    { label: t('sviKodovi'), icon: '🖨️', onClick: () => { setPrintSelection(sortedHyd.map(h => ({ id: h.id, title: `HIDRANT ${h.oznaka}`, sub: h.tip === 'unutarnji' ? 'Unutarnji' : 'Vanjski' }))); setShowPrintModal(true); } },
                                    ...(hydSelectedIds.size > 0 ? [{ label: `${t('odabrani')} (${hydSelectedIds.size})`, icon: '✓', onClick: () => { setPrintSelection(sortedHyd.filter(h => hydSelectedIds.has(h.id)).map(h => ({ id: h.id, title: `HIDRANT ${h.oznaka}`, sub: h.tip === 'unutarnji' ? 'Unutarnji' : 'Vanjski' }))); setShowPrintModal(true); } }] : []),
                                ]} />
                                <SavedFlash />
                                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{sortedHyd.length} {t('hidranti')}</span>
                            </div>

                            {/* ── Bulk Action Bar ────────────────────────────────────────── */}
                            {hydSelectedIds.size > 0 && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                                    background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid rgba(0,191,166,0.2)',
                                    flexWrap: 'wrap',
                                }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                                        ✓ {hydSelectedIds.size} {t('odabrano1')} — {t('grupneAkcije') || 'Grupne akcije'}:
                                    </span>
                                    <button className="btn btn-sm btn-primary" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 }} onClick={() => generateFireProtectionReport(sortedHyd.filter(h => hydSelectedIds.has(h.id)).map(h => h.id), lang, 'hydrants')} title={lang !== 'en' ? 'Generiši PDF za odabrane hidrante' : 'Generate PDF for selected hydrants'}>
                                        🖨️ {lang !== 'en' ? 'Generiši PDF' : 'Generate PDF'} ({hydSelectedIds.size})
                                    </button>
                                    <button className="btn btn-sm" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0, background: '#107c41', color: 'white' }} onClick={() => handleHydExcelExport(false)} title={lang !== 'en' ? 'Izvezi odabrane hidrante u Excel' : 'Export selected hydrants to Excel'}>
                                        📥 {lang !== 'en' ? 'Izvoz u Excel' : 'Export to Excel'} ({hydSelectedIds.size})
                                    </button>
                                    <button className="btn btn-sm btn-danger" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 }} onClick={handleDeleteSelectedHyd} title={t('obrisi')}>
                                        🗑️ {t('obrisi')}
                                    </button>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center' }} onClick={() => setHydSelectedIds(new Set())} title={t('ponistiOdabir')}>
                                        ✕
                                    </button>
                                </div>
                            )}
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={hydSelectedIds.size === sortedHyd.length && sortedHyd.length> 0} onChange={e => { if (e.target.checked) setHydSelectedIds(new Set(sortedHyd.map(x => x.id))); else setHydSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                            <th style={{ width: 90 }}>{t('actions')}</th>
                                            <th onClick={() => toggleHydSort('oznaka')} style={hydThStyle('oznaka')}>{t('oznaka')}{hydSortIcon('oznaka')}</th>
                                            <th onClick={() => toggleHydSort('tip')} style={hydThStyle('tip')}>{t('tip')}{hydSortIcon('tip')}</th>
                                            <th onClick={() => toggleHydSort('lokacija')} style={hydThStyle('lokacija')}>{t('lokacija')}{hydSortIcon('lokacija')}</th>
                                            <th onClick={() => toggleHydSort('sljedeciPregled')} style={hydThStyle('sljedeciPregled')}>{t('nextExam')}{hydSortIcon('sljedeciPregled')}</th>
                                            <th>{t('status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedHyd.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                        ) : sortedHyd.map(h => (
                                            <tr key={h.id} onClick={() => openEditHyd(h)} style={{ cursor: 'pointer' }}>
                                                <td onClick={ev => ev.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" checked={hydSelectedIds.has(h.id)} onChange={() => { const n = new Set(hydSelectedIds); if (n.has(h.id)) n.delete(h.id); else n.add(h.id); setHydSelectedIds(n); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                                </td>
                                                <td onClick={ev => ev.stopPropagation()}>
                                                    <div style={{ position: 'relative' }}>
                                                        <button className="btn btn-primary btn-sm" onClick={ev => openMenu(h.id, ev)}>{t('akcije')} ▼</button>
                                                        {actionMenuId === h.id && (
                                                            <>
                                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={ev => { ev.stopPropagation(); setActionMenuId(null); }} />
                                                                <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                    <button onClick={() => { setActionMenuId(null); openEditHyd(h); }} className="dropdown-item">✏️ {t('otvori')}</button>
                                                                    <button onClick={() => { setActionMenuId(null); setPrintSelection([{ id: h.id, title: `HIDRANT ${h.oznaka}`, sub: h.tip === 'unutarnji' ? 'Unutarnji' : 'Vanjski' }]); setShowPrintModal(true); }} className="dropdown-item">🖨️ {t('printajQrKod')}</button>
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); const copy = { ...h }; delete copy.id; copy.oznaka = copy.oznaka + '-COPY'; copy.napomena = (copy.napomena ? copy.napomena + ' ' : '') + (t('copy3')); create(COLLECTIONS.HYDRANTS, copy); loadData(); showFlash(); }} className="dropdown-item">📋 {t('kopiraj')}</button>
                                                                    <button onClick={() => { setActionMenuId(null); update(COLLECTIONS.HYDRANTS, h.id, { status: HYD_STATUS_CYCLE[h.status] || 'ispravan' }); loadData(); }} className="dropdown-item">🔄 {t('status')} → {STATUS_MAP[HYD_STATUS_CYCLE[h.status]]?.[lang] || STATUS_MAP[HYD_STATUS_CYCLE[h.status]]?.bs || 'Ispravan'}</button>
                                                                    <button onClick={() => { setActionMenuId(null); const in6m = new Date(Date.now() + 182 * 86400000).toISOString().split('T')[0]; update(COLLECTIONS.HYDRANTS, h.id, { sljedeciPregled: in6m, datumZadnjegPregleda: today }); loadData(); showFlash(); }} className="dropdown-item">📅 {t('scheduleInspection6mo')}</button>
                                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                    <button onClick={() => { setActionMenuId(null); handleDeleteHyd(h.id); }} className="dropdown-item text-danger">🗑️ {t('izbrisi')}</button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 700 }}>{h.oznaka}</td>
                                                <td><span className="badge badge-info">{h.tip === 'unutarnji' ? (t('indoor1')) : (t('outdoor1'))}</span></td>
                                                <td>{h.lokacija || '—'}</td>
                                                <td>{formatDate(h.sljedeciPregled)} {getExpiryBadge(h.sljedeciPregled)}</td>
                                                <td>{renderStatusBadge(h.status)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
