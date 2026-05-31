'use client';

/**
 * SkeletonLoader — Reusable loading skeleton components for eZNR
 * 
 * Provides premium shimmer animations that match the design system.
 * Use these to replace content areas while data is loading.
 * 
 * Components:
 *   <SkeletonLine />      — Single animated line
 *   <SkeletonCard />      — Card placeholder with multiple lines
 *   <SkeletonTable />     — Table placeholder with header + rows
 *   <SkeletonStatCards /> — Dashboard stat card grid placeholder
 */

/** Single animated line/block */
export function SkeletonLine({ width = '100%', height = 14, style, className = '' }) {
    return (
        <div
            className={`skeleton ${className}`}
            style={{
                width, height, borderRadius: 6,
                ...style,
            }}
        />
    );
}

/** Card placeholder with 3–4 lines */
export function SkeletonCard({ lines = 3, style }) {
    return (
        <div className="card" style={{ ...style }}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SkeletonLine width="40%" height={12} />
                <SkeletonLine width="75%" height={18} />
                {Array.from({ length: lines - 1 }, (_, i) => (
                    <SkeletonLine key={i} width={`${65 + Math.random() * 30}%`} height={12} />
                ))}
            </div>
        </div>
    );
}

/** Table placeholder */
export function SkeletonTable({ rows = 5, cols = 4, style }) {
    return (
        <div className="card" style={{ ...style }}>
            <div className="card-body" style={{ padding: 0 }}>
                <div className="data-table-wrapper">
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                {Array.from({ length: cols }, (_, i) => (
                                    <th key={i}>
                                        <SkeletonLine width={60 + i * 15} height={10} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: rows }, (_, r) => (
                                <tr key={r}>
                                    {Array.from({ length: cols }, (_, c) => (
                                        <td key={c}>
                                            <SkeletonLine
                                                width={`${50 + ((r + c) * 7) % 45}%`}
                                                height={12}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/** Dashboard stat cards grid placeholder — responsive */
export function SkeletonStatCards({ count = 4 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="card" style={{ borderLeft: '4px solid var(--border)' }}>
                    <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 10px' }}>
                        <div className="skeleton" style={{ width: 'clamp(32px, 5vw, 40px)', height: 'clamp(32px, 5vw, 40px)', borderRadius: '50%', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <SkeletonLine width={40} height={20} />
                            <SkeletonLine width="70%" height={10} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Full dashboard skeleton (stats + alerts + calendar outline) — responsive */
export function SkeletonDashboard() {
    return (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SkeletonStatCards count={4} />
            <SkeletonCard lines={2} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                <SkeletonCard lines={4} />
                <SkeletonCard lines={4} />
            </div>
        </div>
    );
}

