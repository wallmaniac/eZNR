'use client';
import { useState, useEffect, useCallback } from 'react';
import { getSessionsForQuestionnaire, getSessionsForTraining } from '@/lib/firebaseSync';
import { sendReminderEmail } from '@/lib/emailService';

/* =======================================================
   Reminder Modal — shows who hasn't completed, allows batch resend
   ======================================================= */

export default function ReminderModal({ isOpen, onClose, questionnaire, isTraining = false, lang = 'bs', officerName = '', companyName = '' }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [selectedTokens, setSelectedTokens] = useState(new Set());

    useEffect(() => {
        if (!isOpen || !questionnaire?.id) return;
        setLoading(true);
        setSending(false);
        setResult(null);
        setProgress({ current: 0, total: 0 });

        const fetchFn = isTraining ? getSessionsForTraining : getSessionsForQuestionnaire;
        fetchFn(questionnaire.id)
            .then(data => {
                const fetchedSessions = data || [];
                setSessions(fetchedSessions);
                setSelectedTokens(new Set(fetchedSessions.filter(s => s.status !== 'completed').map(s => s.token)));
            })
            .catch(err => { console.error(err); setSessions([]); })
            .finally(() => setLoading(false));
    }, [isOpen, questionnaire?.id]);

    const incomplete = sessions.filter(s => s.status !== 'completed');
    const completed = sessions.filter(s => s.status === 'completed');

    const handleSendReminders = useCallback(async () => {
        const toSend = incomplete.filter(s => selectedTokens.has(s.token));
        if (toSend.length === 0) return;
        setSending(true);
        setProgress({ current: 0, total: toSend.length });

        let sent = 0, failed = 0;
        const errors = [];
        const baseUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/${isTraining ? 't' : 'q'}/`
            : `https://zastitanaradu.ba/${isTraining ? 't' : 'q'}/`;

        for (let i = 0; i < toSend.length; i++) {
            const s = toSend[i];
            setProgress({ current: i, total: toSend.length });

            const res = await sendReminderEmail({
                toEmail: s.recipientEmail,
                toName: s.recipientName || s.recipientEmail,
                questionnaireName: questionnaire?.naziv || s.questionnaireName || 'Upitnik',
                link: `${baseUrl}${s.token}`,
                deadline: s.deadline || null,
                senderName: officerName || 'eZNR Admin',
                companyName: companyName || '',
                isTraining,
            });

            if (res.success) sent++;
            else { failed++; errors.push({ email: s.recipientEmail, error: res.error }); }

            // Rate limit
            if (i < toSend.length - 1) await new Promise(r => setTimeout(r, 250));
        }

        setProgress({ current: toSend.length, total: toSend.length });
        setResult({ sent, failed, errors });
        setSending(false);
    }, [incomplete, selectedTokens, questionnaire, officerName, companyName]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div onClick={onClose} style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)', zIndex: 10000,
            }} />

            {/* Modal */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '90vw', maxWidth: 560, maxHeight: '80vh',
                background: 'var(--bg-card, #1e293b)',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
                borderRadius: 16,
                boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                zIndex: 10001, display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.06))',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
                            📩 {lang !== 'en' ? 'Pošalji podsjetnik' : 'Send Reminders'}
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
                            {questionnaire?.naziv || ''}
                        </p>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', fontSize: '1.3rem',
                        cursor: 'pointer', color: 'var(--text-muted, #94a3b8)',
                        padding: '4px 8px', borderRadius: 8,
                    }}>✕</button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{
                                width: 40, height: 40, border: '3px solid rgba(99,102,241,0.2)',
                                borderTopColor: '#6366f1', borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
                            }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {lang !== 'en' ? 'Učitavanje sesija...' : 'Loading sessions...'}
                            </p>
                        </div>
                    )}

                    {!loading && sessions.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📭</div>
                            <p>{lang !== 'en'
                                ? (isTraining ? 'Nema poslatih sesija za ovu obuku.' : 'Nema poslatih sesija za ovaj upitnik.')
                                : (isTraining ? 'No sessions sent for this training.' : 'No sessions sent for this questionnaire.')}
                        </p>
                        </div>
                    )}

                    {!loading && sessions.length > 0 && !sending && !result && (
                        <>
                            {/* Stats */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                                <div style={statBox('#22c55e')}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{completed.length}</div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.8 }}>{lang !== 'en' ? 'Završeno' : 'Done'}</div>
                                </div>
                                <div style={statBox('#f59e0b')}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{incomplete.length}</div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.8 }}>{lang !== 'en' ? 'Čeka' : 'Pending'}</div>
                                </div>
                                <div style={statBox('#6366f1')}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{sessions.length}</div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.8 }}>{lang !== 'en' ? 'Ukupno' : 'Total'}</div>
                                </div>
                            </div>

                            {/* Incomplete list */}
                            {incomplete.length > 0 ? (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            {lang !== 'en' ? 'Nisu ispunili:' : 'Not completed:'}
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                if (selectedTokens.size === incomplete.length) {
                                                    setSelectedTokens(new Set());
                                                } else {
                                                    setSelectedTokens(new Set(incomplete.map(s => s.token)));
                                                }
                                            }}
                                            style={{
                                                background: 'none', border: 'none', color: 'var(--primary, #00BFA6)',
                                                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                                textDecoration: 'underline'
                                            }}
                                        >
                                            {selectedTokens.size === incomplete.length 
                                                ? (lang !== 'en' ? 'Odznači sve' : 'Deselect all')
                                                : (lang !== 'en' ? 'Označi sve' : 'Select all')}
                                        </button>
                                    </div>
                                    <div style={{
                                        maxHeight: 180, overflowY: 'auto', borderRadius: 10,
                                        border: '1px solid var(--border, rgba(255,255,255,0.08))',
                                        background: 'rgba(0,0,0,0.1)', marginBottom: 16,
                                    }}>
                                        {incomplete.map((s, i) => (
                                            <div key={i} style={{
                                                padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                                                borderBottom: i < incomplete.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                            }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedTokens.has(s.token)}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedTokens);
                                                        if (e.target.checked) newSet.add(s.token);
                                                        else newSet.delete(s.token);
                                                        setSelectedTokens(newSet);
                                                    }}
                                                    style={{ cursor: 'pointer', accentColor: 'var(--primary, #00BFA6)', width: 16, height: 16 }}
                                                />
                                                <span style={{ fontSize: '0.85rem' }}>
                                                    {s.status === 'opened' ? '👀' : '📩'}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                                                        {s.recipientName || s.recipientEmail}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {s.recipientEmail}
                                                        {s.status === 'opened' && <span style={{ marginLeft: 8, color: '#f59e0b' }}>• Otvorio/la</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
                                    <p style={{ fontWeight: 600 }}>{lang !== 'en'
                                        ? (isTraining ? 'Svi su završili obuku!' : 'Svi su ispunili upitnik!')
                                        : 'Everyone completed!'}
                                </p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Sending progress */}
                    {sending && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{
                                width: 48, height: 48, border: '4px solid rgba(245,158,11,0.2)',
                                borderTopColor: '#f59e0b', borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
                            }} />
                            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
                                {lang !== 'en' ? 'Slanje podsjetnika...' : 'Sending reminders...'}
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                                {progress.current}/{progress.total}
                            </p>
                            <div style={{
                                width: '70%', height: 6, borderRadius: 3,
                                background: 'rgba(255,255,255,0.06)',
                                margin: '16px auto 0', overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                                    height: '100%', borderRadius: 3,
                                    background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                                    transition: 'width 0.3s',
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div style={{ textAlign: 'center', padding: '30px 0' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>{result.failed === 0 ? '✅' : '⚠️'}</div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
                                {lang !== 'en' ? 'Podsjetnici poslani' : 'Reminders sent'}
                            </h3>
                            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                                <div style={statBox('#22c55e')}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.sent}</div>
                                    <div style={{ fontSize: '0.72rem' }}>{lang !== 'en' ? 'Poslano' : 'Sent'}</div>
                                </div>
                                {result.failed > 0 && (
                                    <div style={statBox('#ef4444')}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.failed}</div>
                                        <div style={{ fontSize: '0.72rem' }}>{lang !== 'en' ? 'Neuspjelo' : 'Failed'}</div>
                                    </div>
                                )}
                            </div>
                            {result.errors?.length > 0 && (
                                <div style={{ textAlign: 'left', background: 'rgba(239,68,68,0.06)', borderRadius: 10, padding: 12, marginTop: 16 }}>
                                    {result.errors.map((e, i) => (
                                        <p key={i} style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0' }}>
                                            {e.email}: {e.error}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid var(--border-light, rgba(255,255,255,0.06))',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    {!sending && !result && (
                        <>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {selectedTokens.size} {lang !== 'en' ? 'od' : 'of'} {incomplete.length} {lang !== 'en' ? 'odabrano' : 'selected'}
                            </span>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={onClose} style={cancelBtn}>
                                    {lang !== 'en' ? 'Zatvori' : 'Close'}
                                </button>
                                {incomplete.length > 0 && (
                                    <button onClick={handleSendReminders} disabled={selectedTokens.size === 0} style={{...sendBtn, opacity: selectedTokens.size === 0 ? 0.5 : 1, cursor: selectedTokens.size === 0 ? 'not-allowed' : 'pointer'}}>
                                        📩 {lang !== 'en' ? `Pošalji podsjetnik (${selectedTokens.size})` : `Send reminders (${selectedTokens.size})`}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                    {result && (
                        <button onClick={onClose} style={{ ...sendBtn, marginLeft: 'auto' }}>
                            {lang !== 'en' ? 'Zatvori' : 'Close'}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

const statBox = (color) => ({
    flex: 1, padding: '12px 16px', borderRadius: 10,
    background: `${color}15`, border: `1px solid ${color}30`,
    color, textAlign: 'center',
});

const cancelBtn = {
    padding: '9px 18px', fontSize: '0.85rem', fontWeight: 600,
    borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))',
    background: 'transparent', color: 'var(--text)', cursor: 'pointer',
};

const sendBtn = {
    padding: '9px 22px', fontSize: '0.85rem', fontWeight: 700,
    borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: '#fff', cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(245,158,11,0.3)',
};
