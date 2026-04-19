'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getUndoStack, undoLastDelete } from '@/lib/dataStore';

/**
 * UndoBar — global floating undo notification.
 * Appears at the bottom-center after any deletion.
 * Auto-dismisses after 12 seconds with a countdown ring.
 * Listens to the 'eznr:undo-stack-changed' CustomEvent.
 * 
 * Mobile: positioned above bottom nav (56px), with reduced padding
 * and responsive width to prevent cutoff.
 */
export default function UndoBar({ onUndo }) {
    const [entry, setEntry] = useState(null);      // current pending undo entry
    const [secondsLeft, setSecondsLeft] = useState(12);
    const [isMobile, setIsMobile] = useState(false);
    const timerRef = useRef(null);
    const TIMEOUT = 12;

    // Detect mobile
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const dismiss = useCallback(() => {
        setEntry(null);
        setSecondsLeft(TIMEOUT);
        clearInterval(timerRef.current);
    }, []);

    const handleUndo = useCallback(() => {
        const restored = undoLastDelete();
        dismiss();
        if (restored && onUndo) onUndo(restored);
        // Show a brief confirmation
        window.dispatchEvent(new CustomEvent('eznr:toast', { detail: { msg: 'Vraćeno ✓', type: 'success' } }));
    }, [dismiss, onUndo]);

    // Listen for stack changes
    useEffect(() => {
        const handleChange = () => {
            const stack = getUndoStack();
            if (stack.length > 0) {
                setEntry(stack[0]);
                setSecondsLeft(TIMEOUT);
                clearInterval(timerRef.current);
                timerRef.current = setInterval(() => {
                    setSecondsLeft(s => {
                        if (s <= 1) {
                            clearInterval(timerRef.current);
                            setEntry(null);
                            return TIMEOUT;
                        }
                        return s - 1;
                    });
                }, 1000);
            } else {
                setEntry(null);
                clearInterval(timerRef.current);
            }
        };
        window.addEventListener('eznr:undo-stack-changed', handleChange);
        return () => {
            window.removeEventListener('eznr:undo-stack-changed', handleChange);
            clearInterval(timerRef.current);
        };
    }, []);

    if (!entry) return null;

    const progress = (secondsLeft / TIMEOUT) * 100;
    const circumference = 2 * Math.PI * 10; // r=10

    const cascadeText = entry.cascade && entry.cascadeCount > 0
        ? ` + ${entry.cascadeCount} povezanih`
        : '';

    return (
        <div style={{
            position: 'fixed',
            // Mobile: above bottom nav (56px) + safe margin; Desktop: above Zia FAB
            bottom: isMobile ? 68 : 88,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 8 : 10,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: isMobile ? 12 : 14,
            padding: isMobile ? '8px 10px 8px 8px' : '10px 16px 10px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            animation: 'slideUpIn 0.25s ease',
            backdropFilter: 'blur(8px)',
            // Mobile: fit within screen with margins; Desktop: normal
            width: isMobile ? 'calc(100vw - 24px)' : 'auto',
            minWidth: isMobile ? 0 : 260,
            maxWidth: isMobile ? 'calc(100vw - 24px)' : 440,
            boxSizing: 'border-box',
        }}>
            {/* Countdown ring */}
            <svg width={isMobile ? 24 : 28} height={isMobile ? 24 : 28} style={{ flexShrink: 0 }}>
                <circle cx={isMobile ? 12 : 14} cy={isMobile ? 12 : 14} r={isMobile ? 8 : 10} fill="none" stroke="var(--border)" strokeWidth={2.5} />
                <circle
                    cx={isMobile ? 12 : 14} cy={isMobile ? 12 : 14} r={isMobile ? 8 : 10}
                    fill="none"
                    stroke="var(--danger, #f44336)"
                    strokeWidth={2.5}
                    strokeDasharray={isMobile ? 2 * Math.PI * 8 : circumference}
                    strokeDashoffset={(isMobile ? 2 * Math.PI * 8 : circumference) * (1 - progress / 100)}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${isMobile ? 12 : 14} ${isMobile ? 12 : 14})`}
                    style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
                <text x={isMobile ? 12 : 14} y={isMobile ? 15 : 18} textAnchor="middle" fontSize={isMobile ? 7 : 9} fontWeight={700} fill="var(--text-muted)">{secondsLeft}</text>
            </svg>

            {/* Message */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? '0.72rem' : '0.78rem', color: 'var(--text-muted)', marginBottom: 1 }}>
                    🗑️ Obrisano
                </div>
                <div style={{
                    fontSize: isMobile ? '0.82rem' : '0.9rem', fontWeight: 700, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {entry.label}
                    {cascadeText && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>{cascadeText}</span>
                    )}
                </div>
            </div>

            {/* Undo button */}
            <button
                onClick={handleUndo}
                style={{
                    background: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: isMobile ? '5px 10px' : '6px 14px',
                    fontWeight: 700,
                    fontSize: isMobile ? '0.78rem' : '0.85rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'opacity 0.15s',
                    fontFamily: 'var(--font-body)',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
                ↩ Vrati
            </button>

            {/* Dismiss */}
            <button
                onClick={dismiss}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: '1rem', padding: '2px 4px', flexShrink: 0,
                }}
                title="Odbaci"
            >✕</button>

            <style>{`
                @keyframes slideUpIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(16px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
}
