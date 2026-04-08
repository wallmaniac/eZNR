'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext({});

const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
const TOAST_COLORS = {
    success: { bg: 'rgba(0,191,166,0.95)', border: 'rgba(0,191,166,0.5)' },
    error: { bg: 'rgba(244,67,54,0.95)', border: 'rgba(244,67,54,0.5)' },
    info: { bg: 'rgba(33,150,243,0.95)', border: 'rgba(33,150,243,0.5)' },
    warning: { bg: 'rgba(255,152,0,0.95)', border: 'rgba(255,152,0,0.5)' },
};

let globalId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef({});

    const showToast = useCallback((message, type = 'success', duration = 3000) => {
        const id = ++globalId;
        setToasts(prev => [...prev, { id, message, type, visible: true }]);

        // Auto-dismiss
        timersRef.current[id] = setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
                delete timersRef.current[id];
            }, 300);
        }, duration);

        return id;
    }, []);

    const dismissToast = useCallback((id) => {
        clearTimeout(timersRef.current[id]);
        setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, []);

    // Expose globally so any file can call window.eznrToast('msg', 'success')
    if (typeof window !== 'undefined') {
        window.eznrToast = showToast;
    }

    return (
        <ToastContext.Provider value={{ showToast, dismissToast }}>
            {children}
            {/* Toast container — fixed above bottom nav */}
            {toasts.length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: 64, left: 12, right: 12,
                    zIndex: 10000,
                    display: 'flex', flexDirection: 'column-reverse',
                    gap: 8, pointerEvents: 'none',
                }}>
                    {toasts.map(toast => {
                        const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
                        return (
                            <div
                                key={toast.id}
                                onClick={() => dismissToast(toast.id)}
                                style={{
                                    background: colors.bg,
                                    backdropFilter: 'blur(12px)',
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: 14,
                                    padding: '12px 16px',
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                                    color: 'white',
                                    fontFamily: 'var(--font-body)',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                    transform: toast.visible ? 'translateY(0)' : 'translateY(20px)',
                                    opacity: toast.visible ? 1 : 0,
                                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                                }}
                            >
                                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
                                    {TOAST_ICONS[toast.type] || 'ℹ️'}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>{toast.message}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.7, flexShrink: 0 }}>✕</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx.showToast) {
        // Fallback if used outside provider
        return {
            showToast: (msg) => { if (typeof window !== 'undefined') alert(msg); },
            dismissToast: () => {},
        };
    }
    return ctx;
}
