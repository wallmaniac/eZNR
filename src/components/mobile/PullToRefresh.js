'use client';
import { useRef, useState, useCallback } from 'react';

/**
 * PullToRefresh — wraps content with a native-feeling pull-down-to-refresh gesture.
 * Only active when scrollTop <= 0. Shows circular spinner that scales with pull distance.
 *
 * @param {Function} onRefresh  — async callback to reload data
 * @param {number}   threshold  — px to pull before triggering (default 70)
 * @param {ReactNode} children
 */
export default function PullToRefresh({ onRefresh, threshold = 70, children }) {
    const [pulling, setPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const touchRef = useRef({ startY: 0, active: false });
    const containerRef = useRef(null);

    const onTouchStart = useCallback((e) => {
        // Only activate if scroll is at top
        const el = containerRef.current;
        if (el && el.scrollTop > 0) return;
        if (refreshing) return;
        touchRef.current = { startY: e.touches[0].clientY, active: true };
    }, [refreshing]);

    const onTouchMove = useCallback((e) => {
        if (!touchRef.current.active || refreshing) return;
        const dy = e.touches[0].clientY - touchRef.current.startY;
        if (dy > 0) {
            // Dampen the pull (logarithmic feel)
            const dampened = Math.min(dy * 0.5, threshold * 1.8);
            setPullDistance(dampened);
            setPulling(true);
            if (dy > 10) e.preventDefault(); // prevent scroll
        } else {
            touchRef.current.active = false;
            setPulling(false);
            setPullDistance(0);
        }
    }, [refreshing, threshold]);

    const onTouchEnd = useCallback(async () => {
        if (!touchRef.current.active) return;
        touchRef.current.active = false;

        if (pullDistance >= threshold && onRefresh) {
            setRefreshing(true);
            setPullDistance(threshold * 0.6); // snap to spinner position
            try {
                await onRefresh();
            } catch (e) { console.error('Pull-to-refresh error:', e); }
            setRefreshing(false);
        }

        setPulling(false);
        setPullDistance(0);
    }, [pullDistance, threshold, onRefresh]);

    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = refreshing ? undefined : pullDistance * 4;

    return (
        <div
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ position: 'relative' }}
        >
            {/* Pull indicator */}
            {(pulling || refreshing) && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: pullDistance,
                    overflow: 'hidden',
                    transition: refreshing ? 'height 0.3s ease' : 'none',
                }}>
                    <div style={{
                        width: 36, height: 36,
                        borderRadius: '50%',
                        border: '3px solid rgba(0,191,166,0.2)',
                        borderTopColor: 'var(--primary)',
                        transform: refreshing
                            ? undefined
                            : `rotate(${rotation}deg) scale(${progress})`,
                        animation: refreshing ? 'spin 0.7s linear infinite' : 'none',
                        opacity: Math.min(progress * 1.5, 1),
                        transition: refreshing ? 'none' : 'transform 0.05s ease-out',
                    }} />
                </div>
            )}
            {children}
        </div>
    );
}
