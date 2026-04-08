'use client';
import { useEffect, useRef } from 'react';

/**
 * LongPressMenu — contextual popup triggered by long-press on mobile.
 * 
 * @param {boolean} isOpen
 * @param {{ x: number, y: number }} position — screen coordinates
 * @param {{ label: string, icon: string, onClick: Function, danger?: boolean }[]} items
 * @param {Function} onClose
 */
export default function LongPressMenu({ isOpen, position, items = [], onClose }) {
    const menuRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };
        // Use timeout to avoid immediate close from the same touch
        const id = setTimeout(() => {
            document.addEventListener('touchstart', handler, { passive: true });
            document.addEventListener('mousedown', handler);
        }, 50);
        return () => {
            clearTimeout(id);
            document.removeEventListener('touchstart', handler);
            document.removeEventListener('mousedown', handler);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !position) return null;

    // Clamp position so menu doesn't go off-screen
    const menuWidth = 200;
    const menuHeight = items.length * 48 + 16;
    const x = Math.min(position.x, window.innerWidth - menuWidth - 12);
    const y = Math.min(position.y, window.innerHeight - menuHeight - 70);

    return (
        <>
            {/* Backdrop */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 9998,
                background: 'rgba(0,0,0,0.2)',
            }} />
            {/* Menu */}
            <div
                ref={menuRef}
                style={{
                    position: 'fixed',
                    left: Math.max(12, x),
                    top: Math.max(56, y),
                    zIndex: 9999,
                    minWidth: menuWidth,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    animation: 'fadeIn 0.15s ease',
                    transform: 'scale(1)',
                }}
            >
                {items.map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => { item.onClick(); onClose(); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            width: '100%',
                            padding: '13px 18px',
                            border: 'none',
                            borderBottom: idx < items.length - 1 ? '1px solid var(--border-light)' : 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-body)',
                            color: item.danger ? '#EF5350' : 'var(--text)',
                            transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(244,67,54,0.08)' : 'rgba(0,191,166,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </div>
        </>
    );
}

/**
 * useLongPress — hook that detects long-press on touch devices.
 * Returns { onTouchStart, onTouchEnd, onTouchMove } handlers.
 * 
 * @param {Function} onLongPress — called with { x, y } screen coords
 * @param {number} delay — ms to hold (default 500)
 */
export function useLongPress(onLongPress, delay = 500) {
    const timerRef = useRef(null);
    const posRef = useRef({ x: 0, y: 0 });
    const movedRef = useRef(false);

    const onTouchStart = (e) => {
        movedRef.current = false;
        const touch = e.touches[0];
        posRef.current = { x: touch.clientX, y: touch.clientY };
        timerRef.current = setTimeout(() => {
            if (!movedRef.current) {
                onLongPress(posRef.current);
            }
        }, delay);
    };

    const onTouchMove = (e) => {
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - posRef.current.x);
        const dy = Math.abs(touch.clientY - posRef.current.y);
        if (dx > 10 || dy > 10) {
            movedRef.current = true;
            clearTimeout(timerRef.current);
        }
    };

    const onTouchEnd = () => {
        clearTimeout(timerRef.current);
    };

    return { onTouchStart, onTouchMove, onTouchEnd };
}
