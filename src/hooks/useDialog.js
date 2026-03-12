'use client';
/**
 * useDialog — in-app replacement for window.alert(), window.confirm(), and window.prompt().
 *
 * Usage:
 *   const { alert, confirm, prompt, choose, DialogRenderer } = useDialog();
 *   // In JSX: <DialogRenderer />
 *   // In handlers: await alert('Something went wrong!');
 *                   const ok = await confirm('Delete this item?');
 *                   const val = await prompt('Enter name:');
 *                   // choose returns the value of whichever button was clicked, or null if dismissed
 *                   const action = await choose('What would you like to do?', [
 *                       { label: '🔄 Zamijeni', value: 'replace', primary: true },
 *                       { label: '➕ Dodaj', value: 'append' },
 *                       { label: 'Odustani', value: null },
 *                   ]);
 *
 * The DialogRenderer must be placed once inside the component's return JSX.
 */
import { useState, useCallback, useRef } from 'react';

export function useDialog() {
    const [dialog, setDialog] = useState(null);
    const promptRef = useRef(null);
    // Use a ref for the resolver so close() never has a stale reference
    const resolverRef = useRef(null);

    const showAlert = useCallback((message, title) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setDialog({ type: 'alert', message, title: title || null });
        });
    }, []);

    const showConfirm = useCallback((message, title) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setDialog({ type: 'confirm', message, title: title || null });
        });
    }, []);

    const showPrompt = useCallback((message, title, defaultValue = '') => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setDialog({ type: 'prompt', message, title: title || null, defaultValue });
        });
    }, []);

    // choose: shows a dialog with N custom buttons. Returns the `value` of the clicked button.
    // buttons: [{ label, value, primary, danger, icon }]
    const showChoose = useCallback((message, buttons, title) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setDialog({ type: 'choose', message, title: title || null, buttons });
        });
    }, []);

    const close = useCallback((result) => {
        const resolver = resolverRef.current;
        resolverRef.current = null;
        setDialog(null);
        // Resolve after clearing state to prevent re-render with stale dialog
        if (resolver) {
            // Use microtask to ensure setDialog(null) commits first
            Promise.resolve().then(() => resolver(result));
        }
    }, []);

    function DialogRenderer() {
        if (!dialog) return null;
        const isConfirm = dialog.type === 'confirm';
        const isPrompt = dialog.type === 'prompt';
        const isChoose = dialog.type === 'choose';
        const isDanger = dialog.message && (
            dialog.message.toLowerCase().includes('obrisat') ||
            dialog.message.toLowerCase().includes('delet') ||
            dialog.message.toLowerCase().includes('poništit') ||
            dialog.message.toLowerCase().includes('revoke')
        );

        const handlePromptSubmit = () => {
            const val = promptRef.current?.value?.trim() || null;
            close(val);
        };

        // Icon
        let icon = 'ℹ️';
        if (isChoose) icon = '❔';
        else if (isDanger) icon = '⚠️';
        else if (isConfirm || isPrompt) icon = '❓';

        // Default title
        let defaultTitle = 'Obavijest';
        if (isChoose) defaultTitle = 'Odaberite opciju';
        else if (isDanger && isConfirm) defaultTitle = 'Potvrda brisanja';
        else if (isDanger) defaultTitle = 'Upozorenje';
        else if (isPrompt) defaultTitle = 'Unos';
        else if (isConfirm) defaultTitle = 'Potvrda';

        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 99998,
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'fadeIn 0.12s ease-out',
            }}>
                <div style={{
                    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                    padding: '28px 32px', maxWidth: isChoose ? 460 : 420, width: '90%',
                    boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
                    animation: 'slideUp 0.15s ease-out',
                }}>
                    {/* Icon + Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <span style={{ fontSize: '1.6rem' }}>{icon}</span>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                            {dialog.title || defaultTitle}
                        </h3>
                    </div>

                    {/* Message */}
                    <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.92rem' }}>
                        {dialog.message}
                    </p>

                    {/* Prompt input */}
                    {isPrompt && (
                        <input
                            ref={promptRef}
                            className="form-input"
                            style={{ marginBottom: 16 }}
                            defaultValue={dialog.defaultValue || ''}
                            onKeyDown={e => { if (e.key === 'Enter') handlePromptSubmit(); }}
                            autoFocus
                        />
                    )}

                    {/* ── CHOOSE: custom button list ── */}
                    {isChoose && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(dialog.buttons || []).map((btn, i) => (
                                <button
                                    key={i}
                                    autoFocus={i === 0}
                                    onClick={() => close(btn.value)}
                                    style={{
                                        width: '100%',
                                        padding: '11px 18px',
                                        borderRadius: 'var(--radius-md)',
                                        border: btn.primary ? 'none' : '1px solid var(--border)',
                                        cursor: 'pointer',
                                        fontWeight: btn.primary ? 700 : 600,
                                        fontSize: '0.92rem',
                                        fontFamily: 'var(--font-heading)',
                                        textAlign: 'left',
                                        background: btn.danger
                                            ? 'var(--danger, #EF4444)'
                                            : btn.primary
                                            ? 'var(--primary)'
                                            : btn.value === null
                                            ? 'transparent'
                                            : 'var(--bg-input)',
                                        color: (btn.primary || btn.danger)
                                            ? 'white'
                                            : btn.value === null
                                            ? 'var(--text-muted)'
                                            : 'var(--text)',
                                        transition: 'opacity 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── ALERT / CONFIRM / PROMPT: standard footer ── */}
                    {!isChoose && (
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            {(isConfirm || isPrompt) && (
                                <button
                                    style={{
                                        padding: '9px 20px', borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-input)', color: 'var(--text)',
                                        border: '1px solid var(--border)', cursor: 'pointer',
                                        fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-heading)',
                                    }}
                                    onClick={() => close(isPrompt ? null : false)}
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
                                onClick={() => isPrompt ? handlePromptSubmit() : close(isConfirm ? true : undefined)}
                                autoFocus={!isPrompt}
                            >
                                {isPrompt ? 'Potvrdi' : isConfirm ? (isDanger ? '🗑️ Da, obriši' : 'Da, potvrdi') : 'U redu'}
                            </button>
                        </div>
                    )}
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

    return { alert: showAlert, confirm: showConfirm, prompt: showPrompt, choose: showChoose, DialogRenderer };
}
