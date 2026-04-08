'use client';
import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * PullToRefresh — wraps content with a native-feeling pull-down-to-refresh gesture.
 * Only active when page scroll is at top. Shows circular spinner that scales with pull distance.
 */
export default function PullToRefresh({ onRefresh, threshold = 70, children }) {
    const [pulling, setPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const touchRef = useRef({ startY: 0, active: false });
    const containerRef = useRef(null);
    const pullDistRef = useRef(0); // mirror for non-stale access in touchEnd

    // Use native event listeners for { passive: false } so we can preventDefault
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleTouchStart = (e) => {
            // Do not activate inside modals or dropdowns
            if (e.target.closest('.modal, .modal-overlay, .dropdown-menu, .drawer')) return;

            // Only activate if page is scrolled to top
            const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
            if (scrollY > 5) return;
            if (refreshing) return;
            touchRef.current = { startY: e.touches[0].clientY, active: true };
        };

        const handleTouchMove = (e) => {
            if (!touchRef.current.active || refreshing) return;
            const dy = e.touches[0].clientY - touchRef.current.startY;
            if (dy > 0) {
                const dampened = Math.min(dy * 0.45, threshold * 1.6);
                setPullDistance(dampened);
                pullDistRef.current = dampened;
                setPulling(true);
                if (dy > 10) {
                    e.preventDefault(); // prevent native scroll while pulling
                }
            } else {
                touchRef.current.active = false;
                setPulling(false);
                setPullDistance(0);
                pullDistRef.current = 0;
            }
        };

        const handleTouchEnd = async () => {
            if (!touchRef.current.active) return;
            touchRef.current.active = false;

            const dist = pullDistRef.current;
            if (dist >= threshold && onRefresh) {
                setRefreshing(true);
                setPullDistance(threshold * 0.6);
                try {
                    // Artificial delay to show the spinner
                    await new Promise(r => setTimeout(r, 600));
                    await onRefresh();
                } catch (err) { console.error('Pull-to-refresh error:', err); }
                setRefreshing(false);
            }

            setPulling(false);
            setPullDistance(0);
            pullDistRef.current = 0;
        };

        const handleTouchCancel = (e) => {
            // Browser took over the gesture (e.g., native scroll/swipe). Reset state immediately.
            touchRef.current.active = false;
            setPulling(false);
            setPullDistance(0);
            pullDistRef.current = 0;
            setRefreshing(false);
        };

        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: false }); // passive:false to allow preventDefault
        el.addEventListener('touchend', handleTouchEnd, { passive: true });
        el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
            el.removeEventListener('touchend', handleTouchEnd);
            el.removeEventListener('touchcancel', handleTouchCancel);
        };
    }, [refreshing, threshold, onRefresh]);

    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = refreshing ? undefined : pullDistance * 4;

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
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
