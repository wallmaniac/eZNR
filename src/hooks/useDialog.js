'use client';
/**
 * useDialog — in-app replacement for window.alert() and window.confirm().
 *
 * Usage:
 *   const { alert, confirm, DialogRenderer } = useDialog();
 *   // In JSX: <DialogRenderer />
 *   // In handlers: await alert('Something went wrong!');
 *                   const ok = await confirm('Delete this item?');
 *
 * The DialogRenderer must be placed once inside the component's return JSX.
 */
import { useState, useCallback, useRef } from 'react';

export function useDialog() {
    const [dialog, setDialog] = useState(null);
    // { type: 'alert'|'confirm', title, message, resolve }

    const showAlert = useCallback((message, title) => {
        return new Promise((resolve) => {
            setDialog({ type: 'alert', message, title: title || null, resolve });
        });
    }, []);

    const showConfirm = useCallback((message, title) => {
        return new Promise((resolve) => {
            setDialog({ type: 'confirm', message, title: title || null, resolve });
        });
    }, []);

    const close = (result) => {
        if (dialog?.resolve) dialog.resolve(result);
        setDialog(null);
    };

    function DialogRenderer() {
        if (!dialog) return null;
        const isConfirm = dialog.type === 'confirm';
        const isDanger = dialog.message && (
            dialog.message.toLowerCase().includes('obrisat') ||
            dialog.message.toLowerCase().includes('delet') ||
            dialog.message.toLowerCase().includes('poništit') ||
            dialog.message.toLowerCase().includes('revoke')
        );

        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 99998,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 0.12s ease-out',
            }}>
                <div style={{
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                    padding: '28px 32px', maxWidth: 420, width: '90%',
                    boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
                    animation: 'slideUp 0.15s ease-out',
                }}>
                    {/* Icon + Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <span style={{ fontSize: '1.6rem' }}>
                            {isDanger ? '⚠️' : isConfirm ? '❓' : 'ℹ️'}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                            {dialog.title || (isDanger ? (isConfirm ? 'Potvrda brisanja' : 'Upozorenje') : isConfirm ? 'Potvrda' : 'Obavijest')}
                        </h3>
                    </div>

                    {/* Message */}
                    <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.92rem' }}>
                        {dialog.message}
                    </p>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        {isConfirm && (
                            <button
                                style={{
                                    padding: '9px 20px', borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-input)', color: 'var(--text)',
                                    border: '1px solid var(--border)', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-heading)',
                                }}
                                onClick={() => close(false)}
                            >
                                Odustani
                            </button>
                        )}
                        <button
                            style={{
                                padding: '9px 22px', borderRadius: 'var(--radius-md)',
                                background: isDanger && isConfirm ? 'var(--danger, #EF4444)' : 'var(--primary)',
                                color: 'white', border: 'none', cursor: 'pointer',
                                fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-heading)',
                            }}
                            onClick={() => close(isConfirm ? true : undefined)}
                            autoFocus
                        >
                            {isConfirm ? (isDanger ? '🗑️ Da, obriši' : 'Da, potvrdi') : 'U redu'}
                        </button>
                    </div>
                </div>

                <style>{`
                    @keyframes slideUp {
                        from { transform: translateY(12px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `}</style>
            </div>
        );
    }

    return { alert: showAlert, confirm: showConfirm, DialogRenderer };
}
