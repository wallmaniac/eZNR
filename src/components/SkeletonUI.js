'use client';
import { useLoadingProgress } from '@/hooks/useLoadingProgress';

/**
 * Thin progress bar at the top of the page showing data loading progress.
 * Automatically fades out when all data is loaded.
 */
export function LoadingProgressBar() {
    const { percent, fullyLoaded } = useLoadingProgress();

    if (fullyLoaded) return null;

    return (
        <div
            className={`loading-progress-bar${fullyLoaded ? ' done' : ''}`}
            style={{ width: `${Math.max(percent, 8)}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
        />
    );
}

/**
 * Skeleton placeholder for stat/KPI cards.
 * Shows 4 shimmer cards matching the dashboard StatCard layout.
 */
export function SkeletonStats({ count = 4 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))`, gap: 12 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="skeleton skeleton-stat">
                    <div className="skeleton skeleton-stat-icon" />
                    <div className="skeleton-stat-content">
                        <div className="skeleton skeleton-stat-value" />
                        <div className="skeleton skeleton-stat-label" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Skeleton placeholder for table rows.
 * Shows shimmer rows matching typical data tables.
 */
export function SkeletonTable({ rows = 5 }) {
    return (
        <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 16px 8px' }}>
                <div className="skeleton skeleton-heading" />
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="skeleton-row">
                    <div className="skeleton skeleton-row-avatar" />
                    <div className="skeleton-row-content">
                        <div className="skeleton skeleton-row-line" />
                        <div className="skeleton skeleton-row-line" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Generic skeleton block — a shimmering rectangle.
 */
export function SkeletonBlock({ width = '100%', height = 120, borderRadius, style = {} }) {
    return (
        <div
            className="skeleton"
            style={{
                width,
                height,
                borderRadius: borderRadius || 'var(--radius-lg)',
                ...style,
            }}
        />
    );
}
