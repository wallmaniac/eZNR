'use client';
import { useRef, useState, useCallback } from 'react';

/**
 * SwipeRow — wraps a table row or card with swipe-left-to-reveal actions.
 * On desktop, renders children directly without swipe behavior.
 * 
 * @param {{ label: string, icon: string, color: string, onClick: Function }[]} actions
 * @param {boolean} isMobile — only enable swipe on mobile
 * @param {ReactNode} children
 */
export default function SwipeRow({ actions = [], isMobile = false, children }) {
    const [offset, setOffset] = useState(0);
    const [swiped, setSwiped] = useState(false);
    const touchRef = useRef({ startX: 0, startY: 0, active: false });

    const actionWidth = actions.length * 72; // 72px per action button

    const onTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        touchRef.current = { startX: touch.clientX, startY: touch.clientY, active: true };
    }, []);

    const onTouchMove = useCallback((e) => {
        if (!touchRef.current.active) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchRef.current.startX;
        const dy = touch.clientY - touchRef.current.startY;

        // If vertical movement is more, cancel swipe
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
            touchRef.current.active = false;
            setOffset(0);
            return;
        }

        if (dx < -10) {
            // Swipe left — reveal actions
            const clamped = Math.max(dx, -actionWidth - 20);
            setOffset(clamped);
            e.preventDefault();
        } else if (dx > 10 && swiped) {
            // Swipe right — hide actions
            setOffset(Math.min(dx - 10, 0));
        }
    }, [actionWidth, swiped]);

    const onTouchEnd = useCallback(() => {
        touchRef.current.active = false;
        if (Math.abs(offset) > actionWidth * 0.4) {
            setOffset(-actionWidth);
            setSwiped(true);
        } else {
            setOffset(0);
            setSwiped(false);
        }
    }, [offset, actionWidth]);

    const resetSwipe = useCallback(() => {
        setOffset(0);
        setSwiped(false);
    }, []);

    // Desktop: no swipe
    if (!isMobile || actions.length === 0) return children;

    return (
        <div style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Action buttons behind the row */}
            <div style={{
                position: 'absolute',
                top: 0, right: 0, bottom: 0,
                width: actionWidth,
                display: 'flex',
                alignItems: 'stretch',
            }}>
                {actions.map((action, idx) => (
                    <button
                        key={idx}
                        onClick={() => { action.onClick(); resetSwipe(); }}
                        style={{
                            flex: 1,
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: 2,
                            border: 'none',
                            background: action.color || 'var(--primary)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            fontFamily: 'var(--font-heading)',
                        }}
                    >
                        <span style={{ fontSize: '1.1rem' }}>{action.icon}</span>
                        {action.label}
                    </button>
                ))}
            </div>

            {/* Main row content — slides left */}
            <div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    transform: `translateX(${offset}px)`,
                    transition: touchRef.current.active ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: 'var(--bg-card)',
                }}
            >
                {children}
            </div>
        </div>
    );
}
