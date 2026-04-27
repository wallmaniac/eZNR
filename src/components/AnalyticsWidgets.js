'use client';
import { useMemo } from 'react';

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

export default function AnalyticsWidgets({ workers, certs, equipment, injuries, diseases, riskItems, riskAssessments, medicalExams, lang }) {
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
        { label: lang === 'bs' ? 'Važeća' : 'Valid', value: certStats.valid, color: 'var(--success)' },
        { label: lang === 'bs' ? 'Ističe ≤30d' : 'Expiring ≤30d', value: certStats.expiringSoon, color: 'var(--warning)' },
        { label: lang === 'bs' ? 'Istekla' : 'Expired', value: certStats.expired, color: 'var(--danger)' },
    ];

    // ── Injuries per Month (last 12 months) ─────────────────────────────────
    const injuryMonths = useMemo(() => {
        const allIncidents = [...(injuries || []), ...(diseases || [])];
        const months = [];
        const monthLabels = lang === 'bs'
            ? ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
            : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const y = d.getFullYear();
            const m = d.getMonth();
            const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
            const count = allIncidents.filter(inj => (inj.datum || '').startsWith(prefix)).length;
            months.push({ label: monthLabels[m], value: count });
        }
        return months;
    }, [injuries, diseases]);

    // ── Risk Score Distribution ─────────────────────────────────────────────
    const riskDistribution = useMemo(() => {
        const activeRAs = (riskAssessments || []).filter(ra => ra.status === 'aktivan');
        const activeIds = new Set(activeRAs.map(ra => ra.id));
        const items = (riskItems || []).filter(ri => ri.procjenaId && activeIds.has(ri.procjenaId) && ri.rizik > 0);

        const buckets = [
            { label: lang === 'bs' ? 'Neznatan' : 'Negligible', min: 1, max: 5, color: '#4caf50' },
            { label: lang === 'bs' ? 'Dopustiv' : 'Tolerable', min: 6, max: 10, color: '#ffc107' },
            { label: lang === 'bs' ? 'Umjeren' : 'Moderate', min: 11, max: 15, color: '#ff9800' },
            { label: lang === 'bs' ? 'Znatan' : 'Significant', min: 16, max: 20, color: '#f44336' },
            { label: lang === 'bs' ? 'Nedopustiv' : 'Intolerable', min: 21, max: 25, color: '#b71c1c' },
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

    // Don't render if no data at all
    if (certs.length === 0 && (injuries || []).length === 0 && (riskItems || []).length === 0 && activeWorkerCount === 0) {
        return null;
    }

    return (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Mini stats row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <MiniStat icon="👷" label={lang === 'bs' ? 'Aktivni radnici' : 'Active workers'} value={activeWorkerCount} color="var(--primary)" />
                <MiniStat icon="⚙️" label={lang === 'bs' ? 'Usklađenost opreme' : 'Equipment compliance'} value={equipCompliance} suffix="%" color={equipCompliance >= 80 ? 'var(--success)' : 'var(--danger)'} />
                <MiniStat icon="⚠️" label={lang === 'bs' ? 'Prosj. rizik' : 'Avg. risk score'} value={avgRisk} color={avgRisk <= 10 ? 'var(--success)' : avgRisk <= 15 ? 'var(--warning)' : 'var(--danger)'} />
                {medOverdue > 0 && (
                    <MiniStat icon="🩺" label={lang === 'bs' ? 'Prekoračeni pregledi' : 'Overdue exams'} value={medOverdue} color="var(--danger)" />
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
                            label={lang === 'bs' ? 'Status uvjerenja' : 'Certificate Status'}
                            subLabel={lang === 'bs' ? 'ukupno' : 'total'}
                        />
                    </div>
                )}

                {/* Injuries bar chart */}
                <div className="card" style={{ padding: '20px 16px' }}>
                    <BarChart
                        data={injuryMonths}
                        title={lang === 'bs' ? 'Povrede i bolesti (12 mj.)' : 'Injuries & Diseases (12 mo.)'}
                        barColor={(d) => d.value >= 3 ? 'var(--danger)' : d.value >= 1 ? 'var(--warning)' : 'var(--border)'}
                        height={150}
                    />
                </div>

                {/* Risk distribution */}
                {riskDistribution.some(b => b.value > 0) && (
                    <div className="card" style={{ padding: '20px 16px' }}>
                        <BarChart
                            data={riskDistribution}
                            title={lang === 'bs' ? 'Distribucija rizika' : 'Risk Distribution'}
                            barColor={(d) => d.color}
                            height={150}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
