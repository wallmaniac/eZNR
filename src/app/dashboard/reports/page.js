'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { getAll, COLLECTIONS } from '@/lib/dataStore';
import {
    generateWorkersReport,
    generateCertificatesReport,
    generatePPEReport,
    generateEquipmentReport,
    generateFleetReport,
    generateFireProtectionReport
} from '@/lib/pdfReportGenerator';

export default function ReportsPage() {
    const { t, lang } = useLanguage();
    const { user, activeCompanyId } = useAuth();

    // Data states
    const [workers, setWorkers] = useState([]);
    const [certs, setCerts] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [equipment, setEquipment] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [fireExt, setFireExt] = useState([]);
    const [hydrants, setHydrants] = useState([]);
    const [orgUnits, setOrgUnits] = useState([]);

    // Filter states
    const [workerOrgUnit, setWorkerOrgUnit] = useState('all');
    const [certStatus, setCertStatus] = useState('all');
    const [ppeOrgUnit, setPpeOrgUnit] = useState('all');
    const [equipLocation, setEquipLocation] = useState('all');
    const [fleetType, setFleetType] = useState('all');
    const [fireType, setFireType] = useState('extinguishers');

    // Load data
    const loadData = () => {
        setWorkers(getAll(COLLECTIONS.WORKERS) || []);
        setCerts(getAll(COLLECTIONS.CERTIFICATES) || []);
        setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS) || []);
        setEquipment(getAll(COLLECTIONS.EQUIPMENT) || []);
        setVehicles(getAll(COLLECTIONS.VEHICLES) || []);
        setFireExt(getAll(COLLECTIONS.FIRE_EXTINGUISHERS) || []);
        setHydrants(getAll(COLLECTIONS.HYDRANTS) || []);
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS) || []);
    };

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, []);

    // Helper: days until expiry
    const daysUntil = (dateStr) => {
        if (!dateStr) return null;
        return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    };

    // Filter calculations
    const filteredWorkerIds = useMemo(() => {
        const active = workers.filter(w => w.aktivan !== false);
        if (workerOrgUnit === 'all') return active.map(w => w.id);
        return active.filter(w => w.orgJedinicaId === workerOrgUnit).map(w => w.id);
    }, [workers, workerOrgUnit]);

    const filteredCertIds = useMemo(() => {
        if (certStatus === 'all') return certs.map(c => c.id);
        return certs.filter(c => {
            const days = daysUntil(c.vrijediDo);
            if (certStatus === 'expired') return days !== null && days < 0;
            if (certStatus === 'expiring') return days !== null && days >= 0 && days <= 30;
            if (certStatus === 'valid') return days === null || days > 30;
            return true;
        }).map(c => c.id);
    }, [certs, certStatus]);

    const filteredAssignmentIds = useMemo(() => {
        if (ppeOrgUnit === 'all') return assignments.map(a => a.id);
        return assignments.filter(a => {
            const w = workers.find(x => x.id === a.workerId);
            return w && w.orgJedinicaId === ppeOrgUnit;
        }).map(a => a.id);
    }, [assignments, workers, ppeOrgUnit]);

    const filteredEquipmentIds = useMemo(() => {
        if (equipLocation === 'all') return equipment.map(e => e.id);
        return equipment.filter(e => e.lokacija === equipLocation).map(e => e.id);
    }, [equipment, equipLocation]);

    const filteredVehicleIds = useMemo(() => {
        if (fleetType === 'all') return vehicles.map(v => v.id);
        return vehicles.filter(v => (v.tip || v.vrsta) === fleetType).map(v => v.id);
    }, [vehicles, fleetType]);

    const filteredFireItemIds = useMemo(() => {
        const items = fireType === 'hydrants' ? hydrants : fireExt;
        return items.map(i => i.id);
    }, [fireExt, hydrants, fireType]);

    // Unique values for filters
    const uniqueLocations = useMemo(() => {
        return [...new Set(equipment.map(e => e.lokacija).filter(Boolean))].sort();
    }, [equipment]);

    const uniqueVehicleTypes = useMemo(() => {
        return [...new Set(vehicles.map(v => v.tip || v.vrsta).filter(Boolean))].sort();
    }, [vehicles]);

    // Stat counts for cards
    const stats = useMemo(() => {
        const activeWorkers = workers.filter(w => w.aktivan !== false).length;

        const expiredCerts = certs.filter(c => {
            const d = daysUntil(c.vrijediDo);
            return d !== null && d < 0;
        }).length;

        const expiringCerts = certs.filter(c => {
            const d = daysUntil(c.vrijediDo);
            return d !== null && d >= 0 && d <= 30;
        }).length;

        const overdueEquip = equipment.filter(e => {
            const d = daysUntil(e.iduci || e.sljedeciPregled || e.datumIsteka);
            return d !== null && d < 0;
        }).length;

        const overdueFireExt = fireExt.filter(f => {
            const d = daysUntil(f.sljedeciPregled || f.sljedeciServis || f.datumIsteka);
            return d !== null && d < 0;
        }).length;

        return {
            activeWorkers,
            expiredCerts,
            expiringCerts,
            overdueEquip,
            overdueFireExt
        };
    }, [workers, certs, equipment, fireExt]);

    // Action handlers
    const handleGenerateWorkers = () => {
        generateWorkersReport(filteredWorkerIds, lang);
    };

    const handleGenerateCerts = () => {
        generateCertificatesReport(filteredCertIds, lang);
    };

    const handleGeneratePpe = () => {
        generatePPEReport(filteredAssignmentIds, lang);
    };

    const handleGenerateEquipment = () => {
        generateEquipmentReport(filteredEquipmentIds, lang);
    };

    const handleGenerateFleet = () => {
        generateFleetReport(filteredVehicleIds, lang);
    };

    const handleGenerateFire = () => {
        generateFireProtectionReport(filteredFireItemIds, lang, fireType);
    };

    // Styling configurations
    const cardSt = {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform var(--transition-normal), box-shadow var(--transition-normal)',
    };

    const gridSt = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
    };

    const labelSt = {
        display: 'inline-block',
        fontSize: '0.72rem',
        fontWeight: 700,
        color: 'white',
        background: '#455a64',
        padding: '2px 8px',
        borderRadius: 3,
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
    };

    const complianceMetrics = useMemo(() => {
        // 1. Worker training compliance
        const activeWorkers = workers.filter(w => w.aktivan !== false);
        const activeWorkerIds = activeWorkers.map(w => w.id);
        const activeWorkerCerts = certs.filter(c => activeWorkerIds.includes(c.workerId));
        
        const nonCompliantWorkers = activeWorkers.filter(w => {
            const workerCerts = certs.filter(c => c.workerId === w.id);
            return workerCerts.some(c => {
                const d = daysUntil(c.vrijediDo);
                return d !== null && d < 0;
            });
        }).length;
        
        const workerPct = activeWorkers.length > 0 
            ? ((activeWorkers.length - nonCompliantWorkers) / activeWorkers.length) * 100 
            : 100;

        // 2. Equipment compliance
        const overdueEquip = equipment.filter(e => {
            const d = daysUntil(e.iduci || e.sljedeciPregled || e.datumIsteka);
            return d !== null && d < 0;
        }).length;
        const equipPct = equipment.length > 0 
            ? ((equipment.length - overdueEquip) / equipment.length) * 100 
            : 100;

        // 3. Fire Protection compliance
        const overdueFireExt = fireExt.filter(f => {
            const d = daysUntil(f.sljedeciPregled || f.sljedeciServis || f.datumIsteka);
            return d !== null && d < 0;
        }).length;
        const overdueHydrants = hydrants.filter(h => {
            const d = daysUntil(h.sljedeciPregled);
            return d !== null && d < 0;
        }).length;
        const totalFireItems = fireExt.length + hydrants.length;
        const totalOverdueFire = overdueFireExt + overdueHydrants;
        const firePct = totalFireItems > 0 
            ? ((totalFireItems - totalOverdueFire) / totalFireItems) * 100 
            : 100;

        // 4. Fleet compliance
        const overdueVehicles = vehicles.filter(v => {
            const dReg = daysUntil(v.registracijaIstice);
            const dTeh = daysUntil(v.tehnickiIstice);
            return (dReg !== null && dReg < 0) || (dTeh !== null && dTeh < 0);
        }).length;
        const fleetPct = vehicles.length > 0 
            ? ((vehicles.length - overdueVehicles) / vehicles.length) * 100 
            : 100;

        // 5. Overall score
        const overallPct = (workerPct + equipPct + firePct + fleetPct) / 4;

        return {
            worker: { pct: workerPct, total: activeWorkers.length, nonCompliant: nonCompliantWorkers },
            equip: { pct: equipPct, total: equipment.length, nonCompliant: overdueEquip },
            fire: { pct: firePct, total: totalFireItems, nonCompliant: totalOverdueFire },
            fleet: { pct: fleetPct, total: vehicles.length, nonCompliant: overdueVehicles },
            overall: overallPct
        };
    }, [workers, certs, equipment, fireExt, hydrants, vehicles]);

    const getComplianceColor = (pct) => {
        if (pct >= 90) return '#22C55E';
        if (pct >= 70) return '#F59E0B';
        return '#EF4444';
    };

    const getComplianceBg = (pct) => {
        if (pct >= 90) return 'rgba(34,197,94,0.1)';
        if (pct >= 70) return 'rgba(245,158,11,0.1)';
        return 'rgba(239,68,68,0.1)';
    };

    return (
        <div className="animate-fadeIn" style={{ minHeight: '100%', paddingBottom: '96px' }}>
            <PageHeader icon="📈" title={t('reports')} subtitle={t('reportsSubtitle')} />

            {/* ZNR Compliance Analytics Hub */}
            <div className="card" style={{
                marginBottom: '32px',
                background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(255, 255, 255, 0.01) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '28px',
                boxShadow: 'var(--shadow-lg)'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'center' }}>
                    {/* Left side: Large Circular Meter */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px' }}>
                        <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3.2" />
                                <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.overall)} strokeWidth="3.2"
                                        strokeDasharray={`${complianceMetrics.overall} ${100 - complianceMetrics.overall}`}
                                        strokeLinecap="round"
                                        style={{ transition: 'stroke-dasharray 0.8s ease-in-out', filter: `drop-shadow(0 0 6px ${getComplianceColor(complianceMetrics.overall)}80)` }} />
                            </svg>
                            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '2.4rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--text)', lineHeight: 1 }}>
                                    {complianceMetrics.overall.toFixed(1)}%
                                </span>
                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginTop: 4 }}>
                                    {lang === 'en' ? 'Compliance' : 'Usklađenost'}
                                </span>
                            </div>
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 800 }}>
                                {lang === 'en' ? 'Overall ZNR Compliance' : 'Ukupna ZNR Usklađenost'}
                            </h3>
                            <span className="badge" style={{
                                background: getComplianceBg(complianceMetrics.overall),
                                color: getComplianceColor(complianceMetrics.overall),
                                border: `1px solid ${getComplianceColor(complianceMetrics.overall)}`,
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                padding: '4px 14px',
                                borderRadius: '20px',
                                display: 'inline-block'
                            }}>
                                {complianceMetrics.overall >= 90
                                    ? (lang === 'en' ? 'Excellent Status' : 'Odličan status')
                                    : complianceMetrics.overall >= 70
                                        ? (lang === 'en' ? 'Warning - Needs review' : 'Upozorenje - Potreban pregled')
                                        : (lang === 'en' ? 'Critical Action Required' : 'Kritično - Potrebna akcija')}
                            </span>
                        </div>
                    </div>

                    {/* Right side: Detailed Modules Grid */}
                    <div style={{ padding: '10px' }}>
                        <h4 style={{ margin: '0 0 24px 0', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                            {lang === 'en' ? 'Compliance Breakdown' : 'Pregled po modulima'}
                        </h4>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '28px' }}>
                            {/* Module 1: Workers */}
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                                    <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.worker.pct)} strokeWidth="3"
                                                strokeDasharray={`${complianceMetrics.worker.pct} ${100 - complianceMetrics.worker.pct}`}
                                                strokeLinecap="round"
                                                style={{ transition: 'stroke-dasharray 0.8s ease-in-out' }} />
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
                                        {complianceMetrics.worker.pct.toFixed(0)}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{lang === 'en' ? 'Worker Certifications' : 'Uvjerenja radnika'}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {complianceMetrics.worker.nonCompliant > 0 
                                            ? (lang === 'en' ? `${complianceMetrics.worker.nonCompliant} workers expired` : `${complianceMetrics.worker.nonCompliant} radnika isteklo`)
                                            : (lang === 'en' ? 'All workers valid' : 'Svi radnici uredni')}
                                    </div>
                                </div>
                            </div>

                            {/* Module 2: Equipment */}
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                                    <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.equip.pct)} strokeWidth="3"
                                                strokeDasharray={`${complianceMetrics.equip.pct} ${100 - complianceMetrics.equip.pct}`}
                                                strokeLinecap="round"
                                                style={{ transition: 'stroke-dasharray 0.8s ease-in-out' }} />
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
                                        {complianceMetrics.equip.pct.toFixed(0)}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{lang === 'en' ? 'Equipment Safety' : 'Ispravnost opreme'}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {complianceMetrics.equip.nonCompliant > 0 
                                            ? (lang === 'en' ? `${complianceMetrics.equip.nonCompliant} machines overdue` : `${complianceMetrics.equip.nonCompliant} mašina isteklo`)
                                            : (lang === 'en' ? 'All machines valid' : 'Sva oprema uredna')}
                                    </div>
                                </div>
                            </div>

                            {/* Module 3: Fire Protection */}
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                                    <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.fire.pct)} strokeWidth="3"
                                                strokeDasharray={`${complianceMetrics.fire.pct} ${100 - complianceMetrics.fire.pct}`}
                                                strokeLinecap="round"
                                                style={{ transition: 'stroke-dasharray 0.8s ease-in-out' }} />
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
                                        {complianceMetrics.fire.pct.toFixed(0)}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{lang === 'en' ? 'Fire Protection' : 'Zaštita od požara'}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {complianceMetrics.fire.nonCompliant > 0 
                                            ? (lang === 'en' ? `${complianceMetrics.fire.nonCompliant} items expired` : `${complianceMetrics.fire.nonCompliant} stavki isteklo`)
                                            : (lang === 'en' ? 'All apparatus valid' : 'Sve uredno')}
                                    </div>
                                </div>
                            </div>

                            {/* Module 4: Fleet */}
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                <div style={{ position: 'relative', width: '56px', height: '56px', flexShrink: 0 }}>
                                    <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.fleet.pct)} strokeWidth="3"
                                                strokeDasharray={`${complianceMetrics.fleet.pct} ${100 - complianceMetrics.fleet.pct}`}
                                                strokeLinecap="round"
                                                style={{ transition: 'stroke-dasharray 0.8s ease-in-out' }} />
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
                                        {complianceMetrics.fleet.pct.toFixed(0)}%
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{lang === 'en' ? 'Vehicle Fleet' : 'Vozni park'}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {complianceMetrics.fleet.nonCompliant > 0 
                                            ? (lang === 'en' ? `${complianceMetrics.fleet.nonCompliant} vehicles expired` : `${complianceMetrics.fleet.nonCompliant} vozila isteklo`)
                                            : (lang === 'en' ? 'All vehicles valid' : 'Sva vozila uredna')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Overview Cards */}
            <div style={gridSt}>
                
                {/* 1. Workers Card */}
                <div style={cardSt} className="card-hover-effect">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '1.4rem' }}>👥</span>
                        <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                            {stats.activeWorkers} {t('active')}
                        </span>
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800 }}>{t('repWorkersTitle')}</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t('repWorkersDesc')}</p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <div style={labelSt}>{t('orgUnit')}</div>
                            <select className="form-select" value={workerOrgUnit} onChange={e => setWorkerOrgUnit(e.target.value)}>
                                <option value="all">{t('all')}</option>
                                {orgUnits.map(ou => (
                                    <option key={ou.id} value={ou.id}>{ou.naziv}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={handleGenerateWorkers} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }}>
                            🖨️ {t('generateReport')} ({filteredWorkerIds.length})
                        </button>
                    </div>
                </div>

                {/* 2. Certificates Card */}
                <div style={cardSt} className="card-hover-effect">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '1.4rem' }}>📜</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {stats.expiredCerts > 0 && (
                                <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>
                                    {stats.expiredCerts} {t('expired')}
                                </span>
                            )}
                            {stats.expiringCerts > 0 && (
                                <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                                    {stats.expiringCerts} {t('upcoming')}
                                </span>
                            )}
                        </div>
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800 }}>{t('repCertsTitle')}</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t('repCertsDesc')}</p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <div style={labelSt}>{t('status')}</div>
                            <select className="form-select" value={certStatus} onChange={e => setCertStatus(e.target.value)}>
                                <option value="all">{t('all')}</option>
                                <option value="valid">{t('vazeca')}</option>
                                <option value="expiring">{t('istice30d')}</option>
                                <option value="expired">{t('istekla')}</option>
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={handleGenerateCerts} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }}>
                            🖨️ {t('generateReport')} ({filteredCertIds.length})
                        </button>
                    </div>
                </div>

                {/* 3. PPE Assignment Card */}
                <div style={cardSt} className="card-hover-effect">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '1.4rem' }}>🦺</span>
                        <span className="badge" style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                            {assignments.length} {t('records')}
                        </span>
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800 }}>{t('repPpeTitle')}</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t('repPpeDesc')}</p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <div style={labelSt}>{t('orgUnit')}</div>
                            <select className="form-select" value={ppeOrgUnit} onChange={e => setPpeOrgUnit(e.target.value)}>
                                <option value="all">{t('all')}</option>
                                {orgUnits.map(ou => (
                                    <option key={ou.id} value={ou.id}>{ou.naziv}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={handleGeneratePpe} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }}>
                            🖨️ {t('generateReport')} ({filteredAssignmentIds.length})
                        </button>
                    </div>
                </div>

                {/* 4. Equipment Card */}
                <div style={cardSt} className="card-hover-effect">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '1.4rem' }}>⚙️</span>
                        {stats.overdueEquip > 0 && (
                            <span className="badge badge-danger" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                                {stats.overdueEquip} {t('expired')}
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800 }}>{t('repEquipTitle')}</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t('repEquipDesc')}</p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <div style={labelSt}>{t('lokacija')}</div>
                            <select className="form-select" value={equipLocation} onChange={e => setEquipLocation(e.target.value)}>
                                <option value="all">{t('all')}</option>
                                {uniqueLocations.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={handleGenerateEquipment} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }}>
                            🖨️ {t('generateReport')} ({filteredEquipmentIds.length})
                        </button>
                    </div>
                </div>

                {/* 5. Fleet Card */}
                <div style={cardSt} className="card-hover-effect">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '1.4rem' }}>🚗</span>
                        <span className="badge" style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'rgba(0,191,166,0.1)', color: 'var(--primary)' }}>
                            {vehicles.length} {t('vozila')}
                        </span>
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800 }}>{t('repFleetTitle')}</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t('repFleetDesc')}</p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <div style={labelSt}>{t('type')}</div>
                            <select className="form-select" value={fleetType} onChange={e => setFleetType(e.target.value)}>
                                <option value="all">{t('all')}</option>
                                {uniqueVehicleTypes.map(vt => (
                                    <option key={vt} value={vt}>{vt}</option>
                                ))}
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={handleGenerateFleet} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }}>
                            🖨️ {t('generateReport')} ({filteredVehicleIds.length})
                        </button>
                    </div>
                </div>

                {/* 6. Fire Protection Card */}
                <div style={cardSt} className="card-hover-effect">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '1.4rem' }}>🧯</span>
                        {stats.overdueFireExt > 0 && (
                            <span className="badge badge-danger" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                                {stats.overdueFireExt} {t('expired')}
                            </span>
                        )}
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 800 }}>{t('repFireTitle')}</h3>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t('repFireDesc')}</p>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <div style={labelSt}>{t('type')}</div>
                            <select className="form-select" value={fireType} onChange={e => setFireType(e.target.value)}>
                                <option value="extinguishers">{t('fireExtinguishers')}</option>
                                <option value="hydrants">{t('hydrantNetwork')}</option>
                            </select>
                        </div>
                        <button className="btn btn-primary" onClick={handleGenerateFire} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700 }}>
                            🖨️ {t('generateReport')} ({filteredFireItemIds.length})
                        </button>
                    </div>
                </div>

            </div>

            {/* Custom Interactive Hover Styles */}
            <style>{`
                .card-hover-effect {
                    transform: translateY(0);
                    box-shadow: var(--shadow-sm);
                }
                .card-hover-effect:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow-lg);
                    border-color: var(--primary) !important;
                }
            `}</style>
        </div>
    );
}
