'use client';
import { t as _t } from '@/i18n/translations';
import { useMemo } from 'react';
import PrintableAnnualReport from './PrintableAnnualReport';

// ============================================================================
// ANALYTICS WIDGETS — Pure SVG charts for the Kontrolna ploča dashboard
// No external dependencies — uses CSS variables from eZNR design system
// ============================================================================

// ── Donut Chart ─────────────────────────────────────────────────────────────
function DonutChart({ segments, size = 160, strokeWidth = 22, label, subLabel }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = segments.reduce((s, seg) => s + seg.value, 0);

    let offset = 0;
    const arcs = segments.map((seg) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const currentOffset = offset;
        offset += dash;
        return { ...seg, dash, gap, offset: currentOffset, pct };
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                {/* Background ring */}
                <circle cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="var(--border)" strokeWidth={strokeWidth} opacity={0.3} />
                {/* Segments */}
                {arcs.map((arc, i) => (
                    <circle key={i} cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke={arc.color} strokeWidth={strokeWidth}
                        strokeDasharray={`${arc.dash} ${arc.gap}`}
                        strokeDashoffset={-arc.offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
                    />
                ))}
                {/* Center text */}
                <text x={size / 2} y={size / 2 - 6} textAnchor="middle" dominantBaseline="central"
                    fill="var(--text)" fontSize="1.6rem" fontWeight="800"
                    style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
                    {total}
                </text>
                <text x={size / 2} y={size / 2 + 14} textAnchor="middle" dominantBaseline="central"
                    fill="var(--text-muted)" fontSize="0.65rem" fontWeight="600"
                    style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
                    {subLabel || ''}
                </text>
            </svg>
            {label && <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>{label}</div>}
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {segments.filter(s => s.value > 0).map((seg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                        {seg.label}: <strong style={{ color: 'var(--text)' }}>{seg.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ data, height = 140, barColor, title }) {
    const maxVal = Math.max(...data.map(d => d.value), 1);

    return (
        <div>
            {title && (
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: 10, textAlign: 'center' }}>
                    {title}
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, padding: '0 2px' }}>
                {data.map((d, i) => {
                    const barH = Math.max((d.value / maxVal) * (height - 24), d.value > 0 ? 6 : 2);
                    const color = typeof barColor === 'function' ? barColor(d) : (barColor || 'var(--primary)');
                    return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            {d.value > 0 && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d.value}</span>
                            )}
                            <div
                                style={{
                                    width: '100%', maxWidth: 32,
                                    height: barH, borderRadius: '4px 4px 2px 2px',
                                    background: color,
                                    transition: 'height 0.5s ease',
                                    opacity: d.value > 0 ? 1 : 0.2,
                                }}
                                title={`${d.label}: ${d.value}`}
                            />
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontWeight: 600, writingMode: data.length > 8 ? 'vertical-rl' : 'initial', whiteSpace: 'nowrap' }}>
                                {d.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Mini Stat Card ──────────────────────────────────────────────────────────
function MiniStat({ icon, label, value, color, suffix }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-input)', border: '1px solid var(--border-light)',
            flex: '1 1 0',
        }}>
            <span style={{ fontSize: '1.3rem' }}>{icon}</span>
            <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: color || 'var(--text)', lineHeight: 1.1 }}>
                    {value}{suffix && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: 2 }}>{suffix}</span>}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN ANALYTICS WIDGET
// ============================================================================

export default function AnalyticsWidgets({
    workers, certs, equipment, injuries, diseases, riskItems, riskAssessments, medicalExams,
    fireExtinguishers = [], hydrants = [], fleetVehicles = [],
    lang, companyName, companyLogo
}) {
    const now = new Date();
    const d30 = 30 * 86400000;

    // ── Certificate Status ──────────────────────────────────────────────────
    const certStats = useMemo(() => {
        const valid = certs.filter(c => !c.vrijediDo || new Date(c.vrijediDo) > now).length;
        const expiringSoon = certs.filter(c => {
            if (!c.vrijediDo) return false;
            const diff = new Date(c.vrijediDo) - now;
            return diff >= 0 && diff <= d30;
        }).length;
        const expired = certs.filter(c => c.vrijediDo && new Date(c.vrijediDo) < now).length;
        return { valid: valid - expiringSoon, expiringSoon, expired };
    }, [certs]);

    const certSegments = [
        { label: _t('vazeca', lang), value: certStats.valid, color: 'var(--success)' },
        { label: _t('istice30d', lang), value: certStats.expiringSoon, color: 'var(--warning)' },
        { label: _t('istekla', lang), value: certStats.expired, color: 'var(--danger)' },
    ];

    // ── Injuries per Month (last 12 months) ─────────────────────────────────
    const injuryMonths = useMemo(() => {
        const allIncidents = [...(injuries || []), ...(diseases || [])];
        const months = [];
        const localizedMonths = {
            bs: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
            hr: ['Jan', 'Feb', 'Ožu', 'Tra', 'Svi', 'Lip', 'Srp', 'Kol', 'Ruj', 'Lis', 'Stu', 'Pro'],
            sr: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
            en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
            sl: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec']
        };
        const monthLabels = localizedMonths[lang] || localizedMonths.bs;

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth();
            const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
            const count = allIncidents.filter(inj => (inj.datum || '').startsWith(prefix)).length;
            months.push({ label: monthLabels[m], value: count });
        }
        return months;
    }, [injuries, diseases, lang]);

    // ── Risk Score Distribution ─────────────────────────────────────────────
    const riskDistribution = useMemo(() => {
        const activeRAs = (riskAssessments || []).filter(ra => ra.status === 'aktivan');
        const activeIds = new Set(activeRAs.map(ra => ra.id));
        const items = (riskItems || []).filter(ri => ri.procjenaId && activeIds.has(ri.procjenaId) && ri.rizik > 0);

        const buckets = [
            { label: _t('neznatan', lang), min: 1, max: 5, color: '#4caf50' },
            { label: _t('dopustiv', lang), min: 6, max: 10, color: '#ffc107' },
            { label: _t('umjeren', lang), min: 11, max: 15, color: '#ff9800' },
            { label: _t('znatan', lang), min: 16, max: 20, color: '#f44336' },
            { label: _t('nedopustiv', lang), min: 21, max: 25, color: '#b71c1c' },
        ];

        return buckets.map(b => ({
            label: b.label,
            value: items.filter(ri => ri.rizik >= b.min && ri.rizik <= b.max).length,
            color: b.color,
        }));
    }, [riskItems, riskAssessments]);

    // ── Mini stats ──────────────────────────────────────────────────────────
    const activeWorkerCount = (workers || []).filter(w => w.aktivan !== false).length;
    const equipCompliance = useMemo(() => {
        const total = (equipment || []).length;
        if (total === 0) return 100;
        const overdue = equipment.filter(e => e.iduci && new Date(e.iduci) < now).length;
        return Math.round(((total - overdue) / total) * 100);
    }, [equipment]);

    const avgRisk = useMemo(() => {
        const activeRAs = (riskAssessments || []).filter(ra => ra.status === 'aktivan');
        const activeIds = new Set(activeRAs.map(ra => ra.id));
        const items = (riskItems || []).filter(ri => ri.procjenaId && activeIds.has(ri.procjenaId) && ri.rizik > 0);
        if (items.length === 0) return 0;
        return (items.reduce((s, ri) => s + ri.rizik, 0) / items.length).toFixed(1);
    }, [riskItems, riskAssessments]);

    const medOverdue = useMemo(() => {
        return (medicalExams || []).filter(m => m.vrijediDo && new Date(m.vrijediDo) < now).length;
    }, [medicalExams]);

    const complianceMetrics = useMemo(() => {
        const activeWorkers = (workers || []).filter(w => w.aktivan !== false);
        const activeWorkerIds = activeWorkers.map(w => w.id);
        
        const daysUntil = (dateStr) => {
            if (!dateStr) return null;
            return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
        };

        const nonCompliantWorkers = activeWorkers.filter(w => {
            const workerCerts = (certs || []).filter(c => c.workerId === w.id);
            return workerCerts.some(c => {
                const d = daysUntil(c.vrijediDo);
                return d !== null && d < 0;
            });
        }).length;
        
        const workerPct = activeWorkers.length > 0 
            ? ((activeWorkers.length - nonCompliantWorkers) / activeWorkers.length) * 100 
            : 100;

        const overdueEquip = (equipment || []).filter(e => {
            const d = daysUntil(e.iduci || e.sljedeciPregled || e.datumIsteka);
            return d !== null && d < 0;
        }).length;
        const equipPct = (equipment || []).length > 0 
            ? (((equipment || []).length - overdueEquip) / (equipment || []).length) * 100 
            : 100;

        const overdueFireExt = (fireExtinguishers || []).filter(f => {
            const d = daysUntil(f.sljedeciPregled || f.sljedeciServis || f.datumIsteka);
            return d !== null && d < 0;
        }).length;
        const overdueHydrants = (hydrants || []).filter(h => {
            const d = daysUntil(h.sljedeciPregled);
            return d !== null && d < 0;
        }).length;
        const totalFireItems = (fireExtinguishers || []).length + (hydrants || []).length;
        const totalOverdueFire = overdueFireExt + overdueHydrants;
        const firePct = totalFireItems > 0 
            ? ((totalFireItems - totalOverdueFire) / totalFireItems) * 100 
            : 100;

        const overdueVehicles = (fleetVehicles || []).filter(v => {
            const dReg = daysUntil(v.registracijaIstice);
            const dTeh = daysUntil(v.tehnickiIstice);
            return (dReg !== null && dReg < 0) || (dTeh !== null && dTeh < 0);
        }).length;
        const fleetPct = (fleetVehicles || []).length > 0 
            ? (((fleetVehicles || []).length - overdueVehicles) / (fleetVehicles || []).length) * 100 
            : 100;

        const overallPct = (workerPct + equipPct + firePct + fleetPct) / 4;

        return {
            worker: { pct: workerPct, total: activeWorkers.length, nonCompliant: nonCompliantWorkers },
            equip: { pct: equipPct, total: (equipment || []).length, nonCompliant: overdueEquip },
            fire: { pct: firePct, total: totalFireItems, nonCompliant: totalOverdueFire },
            fleet: { pct: fleetPct, total: (fleetVehicles || []).length, nonCompliant: overdueVehicles },
            overall: overallPct
        };
    }, [workers, certs, equipment, fireExtinguishers, hydrants, fleetVehicles]);

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

    // Don't render if no data at all
    if (certs.length === 0 && (injuries || []).length === 0 && (riskItems || []).length === 0 && activeWorkerCount === 0) {
        return null;
    }

    const handleDownloadPDF = async () => {
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.getElementById('print-document-container');
            const opt = {
                margin: 0,
                filename: _t('godisnjiizvjestajznrpdf', lang),
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().from(element).set(opt).save();

            if (window.eznrToast) {
                window.eznrToast(_t('izvjestajUspjesnoPreuzet', lang), 'success');
            }
        } catch (err) {
            console.error('PDF export failed', err);
            if (window.eznrToast) window.eznrToast(_t('greskaPriIzradiPdfa', lang), 'error');
        }
    };

    return (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {_t('automatskaAnalitikaIzStvarnihPodataka', lang)}
                </span>
                <button 
                    onClick={handleDownloadPDF}
                    style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: 'var(--primary)', color: 'white',
                        cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                        display: 'flex', alignItems: 'center', gap: 6
                    }}
                >
                    📑 {_t('godisnjiIzvjestajPdf', lang)}
                </button>
            </div>

            <div id="analytics-dashboard-export" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
                {/* PDF Header (only visible strictly during html2canvas, or just visually clean) */}
                <h2 style={{ fontSize: '1.2rem', marginBottom: 4, display: 'none' }} className="pdf-only-header">
                    {_t('godisnjiIzvjestajZastiteNaRadu', lang)}
                </h2>

                {/* ZNR Compliance Analytics Hub */}
                <div className="card" style={{
                    marginBottom: '16px',
                    background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(255, 255, 255, 0.01) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '24px',
                    boxShadow: 'var(--shadow-lg)'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '30px', alignItems: 'center' }}>
                        {/* Left side: Large Circular Meter */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px' }}>
                            <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3.2" />
                                    <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.overall)} strokeWidth="3.2"
                                            strokeDasharray={`${complianceMetrics.overall} ${100 - complianceMetrics.overall}`}
                                            strokeLinecap="round"
                                            style={{ transition: 'stroke-dasharray 0.8s ease-in-out', filter: `drop-shadow(0 0 6px ${getComplianceColor(complianceMetrics.overall)}80)` }} />
                                </svg>
                                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--text)', lineHeight: 1 }}>
                                        {complianceMetrics.overall.toFixed(1)}%
                                    </span>
                                    <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1, marginTop: 2 }}>
                                        {lang === 'en' ? 'Compliance' : 'Usklađenost'}
                                    </span>
                                </div>
                            </div>
                            <div style={{ marginTop: '12px' }}>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800 }}>
                                    {lang === 'en' ? 'Overall ZNR Compliance' : 'Ukupna ZNR Usklađenost'}
                                </h3>
                                <span className="badge" style={{
                                    background: getComplianceBg(complianceMetrics.overall),
                                    color: getComplianceColor(complianceMetrics.overall),
                                    border: `1px solid ${getComplianceColor(complianceMetrics.overall)}`,
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    padding: '3px 12px',
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
                        <div style={{ padding: '5px' }}>
                            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                                {lang === 'en' ? 'Compliance Breakdown' : 'Pregled po modulima'}
                            </h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '18px' }}>
                                {/* Module 1: Workers */}
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
                                        <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                            <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                                            <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.worker.pct)} strokeWidth="3"
                                                    strokeDasharray={`${complianceMetrics.worker.pct} ${100 - complianceMetrics.worker.pct}`}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'stroke-dasharray 0.8s ease-in-out' }} />
                                        </svg>
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                                            {complianceMetrics.worker.pct.toFixed(0)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{lang === 'en' ? 'Worker Certifications' : 'Uvjerenja radnika'}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {complianceMetrics.worker.nonCompliant > 0 
                                                ? (lang === 'en' ? `${complianceMetrics.worker.nonCompliant} expired` : `${complianceMetrics.worker.nonCompliant} isteklo`)
                                                : (lang === 'en' ? 'All valid' : 'Sve uredno')}
                                        </div>
                                    </div>
                                </div>

                                {/* Module 2: Equipment */}
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
                                        <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                            <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                                            <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.equip.pct)} strokeWidth="3"
                                                    strokeDasharray={`${complianceMetrics.equip.pct} ${100 - complianceMetrics.equip.pct}`}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'stroke-dasharray 0.8s ease-in-out' }} />
                                        </svg>
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                                            {complianceMetrics.equip.pct.toFixed(0)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{lang === 'en' ? 'Equipment Safety' : 'Ispravnost opreme'}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {complianceMetrics.equip.nonCompliant > 0 
                                                ? (lang === 'en' ? `${complianceMetrics.equip.nonCompliant} expired` : `${complianceMetrics.equip.nonCompliant} isteklo`)
                                                : (lang === 'en' ? 'All valid' : 'Sve uredno')}
                                        </div>
                                    </div>
                                </div>

                                {/* Module 3: Fire Protection */}
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
                                        <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                            <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                                            <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.fire.pct)} strokeWidth="3"
                                                    strokeDasharray={`${complianceMetrics.fire.pct} ${100 - complianceMetrics.fire.pct}`}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'stroke-dasharray 0.8s ease-in-out' }} />
                                        </svg>
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                                            {complianceMetrics.fire.pct.toFixed(0)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{lang === 'en' ? 'Fire Protection' : 'Zaštita od požara'}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {complianceMetrics.fire.nonCompliant > 0 
                                                ? (lang === 'en' ? `${complianceMetrics.fire.nonCompliant} expired` : `${complianceMetrics.fire.nonCompliant} isteklo`)
                                                : (lang === 'en' ? 'All valid' : 'Sve uredno')}
                                        </div>
                                    </div>
                                </div>

                                {/* Module 4: Fleet */}
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
                                        <svg width="100%" height="100%" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                            <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-light)" strokeWidth="3" />
                                            <circle cx="18" cy="18" r="15.915" fill="none" stroke={getComplianceColor(complianceMetrics.fleet.pct)} strokeWidth="3"
                                                    strokeDasharray={`${complianceMetrics.fleet.pct} ${100 - complianceMetrics.fleet.pct}`}
                                                    strokeLinecap="round"
                                                    style={{ transition: 'stroke-dasharray 0.8s ease-in-out' }} />
                                        </svg>
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                                            {complianceMetrics.fleet.pct.toFixed(0)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{lang === 'en' ? 'Vehicle Fleet' : 'Vozni park'}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {complianceMetrics.fleet.nonCompliant > 0 
                                                ? (lang === 'en' ? `${complianceMetrics.fleet.nonCompliant} expired` : `${complianceMetrics.fleet.nonCompliant} isteklo`)
                                                : (lang === 'en' ? 'All valid' : 'Sve uredno')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mini stats row */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <MiniStat icon="👷" label={_t('aktivniRadnici', lang)} value={activeWorkerCount} color="var(--primary)" />
                    <MiniStat icon="⚙️" label={_t('usklaenostOpreme', lang)} value={equipCompliance} suffix="%" color={equipCompliance >= 80 ? 'var(--success)' : 'var(--danger)'} />
                    <MiniStat icon="⚠️" label={_t('prosjRizik', lang)} value={avgRisk} color={avgRisk <= 10 ? 'var(--success)' : avgRisk <= 15 ? 'var(--warning)' : 'var(--danger)'} />
                    {medOverdue > 0 && (
                        <MiniStat icon="🩺" label={_t('prekoraceniPregledi', lang)} value={medOverdue} color="var(--danger)" />
                    )}
                </div>

                {/* Charts row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 14,
                }}>
                    {/* Certificate donut */}
                    {certs.length > 0 && (
                        <div className="card" style={{ padding: '20px 16px', display: 'flex', justifyContent: 'center' }}>
                            <DonutChart
                                segments={certSegments}
                                label={_t('statusUvjerenja', lang)}
                                subLabel={_t('ukupno1', lang)}
                            />
                        </div>
                    )}

                    {/* Injuries bar chart */}
                    <div className="card" style={{ padding: '20px 16px' }}>
                        <BarChart
                            data={injuryMonths}
                            title={_t('povredeIBolesti12Mj', lang)}
                            barColor={(d) => d.value >= 3 ? 'var(--danger)' : d.value >= 1 ? 'var(--warning)' : 'var(--border)'}
                            height={150}
                        />
                    </div>

                    {/* Risk distribution */}
                    {riskDistribution.some(b => b.value > 0) && (
                        <div className="card" style={{ padding: '20px 16px' }}>
                            <BarChart
                                data={riskDistribution}
                                title={_t('distribucijaRizika', lang)}
                                barColor={(d) => d.color}
                                height={150}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden A4 Printable Template */}
            <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '210mm' }}>
                <div id="print-document-container">
                    <PrintableAnnualReport 
                        workers={workers}
                        certs={certs}
                        equipment={equipment}
                        injuries={injuries}
                        diseases={diseases}
                        riskItems={riskItems}
                        riskAssessments={riskAssessments}
                        medicalExams={medicalExams}
                        lang={lang}
                        companyName={companyName}
                        companyLogo={companyLogo}
                    />
                </div>
            </div>
        </div>
    );
}
