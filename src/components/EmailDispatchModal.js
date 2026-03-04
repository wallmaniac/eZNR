'use client';
import { useState, useEffect, useCallback } from 'react';
import { getAll, COLLECTIONS } from '@/lib/dataStore';
import { createQuestionnaireSession, generateToken } from '@/lib/firebaseSync';
import { sendBatchEmails, isEmailConfigured } from '@/lib/emailService';

/* ═══════════════════════════════════════════════════════
   Email Dispatch Modal
   Select workers/emails → Send questionnaire via EmailJS
   ═══════════════════════════════════════════════════════ */

export default function EmailDispatchModal({ isOpen, onClose, questionnaire, lang = 'bs' }) {
    const [workers, setWorkers] = useState([]);
    const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
    const [manualEmails, setManualEmails] = useState('');
    const [deadline, setDeadline] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [step, setStep] = useState('select'); // select | sending | done
    const [progress, setProgress] = useState({ current: 0, total: 0, email: '' });
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setWorkers(getAll(COLLECTIONS.WORKERS) || []);
            setSelectedWorkerIds([]);
            setManualEmails('');
            setDeadline('');
            setSearchQuery('');
            setStep('select');
            setProgress({ current: 0, total: 0, email: '' });
            setResult(null);
        }
    }, [isOpen]);

    const toggleWorker = useCallback((workerId) => {
        setSelectedWorkerIds(prev =>
            prev.includes(workerId)
                ? prev.filter(id => id !== workerId)
                : [...prev, workerId]
        );
    }, []);

    const selectAll = useCallback(() => {
        const validWorkers = filteredWorkers.filter(w => w.email);
        setSelectedWorkerIds(prev => {
            const allSelected = validWorkers.every(w => prev.includes(w.id));
            if (allSelected) return prev.filter(id => !validWorkers.find(w => w.id === id));
            return [...new Set([...prev, ...validWorkers.map(w => w.id)])];
        });
    }, []);

    const filteredWorkers = workers.filter(w => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const name = `${w.ime || ''} ${w.prezime || ''}`.toLowerCase();
        return name.includes(q) || (w.email || '').toLowerCase().includes(q);
    });

    const handleSend = async () => {
        if (!questionnaire) return;

        // Build recipient list
        const recipients = [];

        // From selected workers
        for (const wId of selectedWorkerIds) {
            const worker = workers.find(w => w.id === wId);
            if (worker?.email) {
                recipients.push({
                    toEmail: worker.email,
                    toName: `${worker.ime || ''} ${worker.prezime || ''}`.trim(),
                    workerId: worker.id,
                });
            }
        }

        // From manual emails
        if (manualEmails.trim()) {
            const emails = manualEmails.split(/[,;\n]+/).map(e => e.trim()).filter(e => e && e.includes('@'));
            for (const email of emails) {
                if (!recipients.find(r => r.toEmail === email)) {
                    recipients.push({ toEmail: email, toName: email });
                }
            }
        }

        if (recipients.length === 0) return;

        setStep('sending');

        // Create sessions in Firestore and generate tokens
        const tokens = [];
        const baseUrl = typeof window !== 'undefined'
            ? `${window.location.origin}/q/`
            : 'https://eznr.vercel.app/q/';

        for (const r of recipients) {
            const token = generateToken();
            try {
                await createQuestionnaireSession({
                    token,
                    questionnaireId: questionnaire.id,
                    questionnaireName: questionnaire.naziv || 'Upitnik',
                    recipientEmail: r.toEmail,
                    recipientName: r.toName,
                    workerId: r.workerId || null,
                    deadline: deadline || null,
                    surveyJson: questionnaire.surveyJson,
                });
                tokens.push(`${baseUrl}${token}`);
            } catch (err) {
                console.error('Failed to create session:', err);
                tokens.push(`${baseUrl}error`);
            }
        }

        // Send emails via EmailJS
        const sendResult = await sendBatchEmails(
            recipients,
            {
                questionnaireName: questionnaire.naziv || 'Upitnik',
                tokens,
                deadline: deadline || null,
                senderName: 'eZNR Admin',
                companyName: '',
            },
            (current, total, email) => {
                setProgress({ current, total, email });
            }
        );

        setResult(sendResult);
        setStep('done');
    };

    if (!isOpen) return null;

    const emailConfigured = isEmailConfigured();
    const totalRecipients = selectedWorkerIds.filter(id => workers.find(w => w.id === id)?.email).length
        + (manualEmails.trim() ? manualEmails.split(/[,;\n]+/).filter(e => e.trim() && e.includes('@')).length : 0);

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
                width: '90vw', maxWidth: 680, maxHeight: '85vh',
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
                        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text, #e2e8f0)' }}>
                            📧 {lang === 'bs' ? 'Pošalji upitnik' : 'Send Questionnaire'}
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
                    {!emailConfigured && (
                        <div style={{
                            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                            borderRadius: 10, padding: '14px 18px', marginBottom: 20,
                        }}>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#fbbf24', fontWeight: 600 }}>
                                ⚠️ {lang === 'bs' ? 'EmailJS nije konfiguriran' : 'EmailJS not configured'}
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                                {lang === 'bs'
                                    ? 'Dodajte NEXT_PUBLIC_EMAILJS_SERVICE_ID, NEXT_PUBLIC_EMAILJS_TEMPLATE_ID i NEXT_PUBLIC_EMAILJS_PUBLIC_KEY u .env.local datoteku. Linkovi će biti generirani, ali emailovi neće biti poslani.'
                                    : 'Add EMAILJS env vars to .env.local. Links will be generated but emails won\'t be sent.'}
                            </p>
                        </div>
                    )}

                    {step === 'select' && (
                        <>
                            {/* Worker selection */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={labelStyle}>
                                    👥 {lang === 'bs' ? 'Odaberite radnike' : 'Select workers'}
                                </label>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                    <input
                                        type="text"
                                        placeholder={lang === 'bs' ? 'Pretraži radnike...' : 'Search workers...'}
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        style={searchInputStyle}
                                    />
                                    <button onClick={selectAll} style={selectAllBtnStyle}>
                                        {lang === 'bs' ? 'Odaberi sve' : 'Select all'}
                                    </button>
                                </div>
                                <div style={{
                                    maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border, rgba(255,255,255,0.08))',
                                    borderRadius: 10, background: 'rgba(0,0,0,0.15)',
                                }}>
                                    {filteredWorkers.length === 0 ? (
                                        <p style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
                                            {lang === 'bs' ? 'Nema radnika' : 'No workers'}
                                        </p>
                                    ) : filteredWorkers.map(w => (
                                        <label key={w.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 14px', cursor: w.email ? 'pointer' : 'not-allowed',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            opacity: w.email ? 1 : 0.4,
                                            background: selectedWorkerIds.includes(w.id) ? 'rgba(99,102,241,0.08)' : 'transparent',
                                            transition: 'background 0.15s',
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedWorkerIds.includes(w.id)}
                                                onChange={() => w.email && toggleWorker(w.id)}
                                                disabled={!w.email}
                                                style={{ accentColor: '#6366f1' }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text, #e2e8f0)' }}>
                                                    {w.ime} {w.prezime}
                                                </div>
                                                <div style={{ fontSize: '0.78rem', color: w.email ? 'var(--text-muted, #94a3b8)' : '#ef4444' }}>
                                                    {w.email || (lang === 'bs' ? '(nema email)' : '(no email)')}
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Manual emails */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={labelStyle}>
                                    ✉️ {lang === 'bs' ? 'Dodatni emailovi (ručni unos)' : 'Additional emails (manual)'}
                                </label>
                                <textarea
                                    value={manualEmails}
                                    onChange={e => setManualEmails(e.target.value)}
                                    placeholder={lang === 'bs'
                                        ? 'Unesite email adrese, odvojene zarezom ili novim redom...'
                                        : 'Enter email addresses separated by commas or new lines...'}
                                    rows={3}
                                    style={textareaStyle}
                                />
                            </div>

                            {/* Deadline */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={labelStyle}>
                                    📅 {lang === 'bs' ? 'Rok za ispunjavanje (opcionalno)' : 'Deadline (optional)'}
                                </label>
                                <input
                                    type="date"
                                    value={deadline}
                                    onChange={e => setDeadline(e.target.value)}
                                    style={{ ...searchInputStyle, maxWidth: 220 }}
                                />
                            </div>
                        </>
                    )}

                    {step === 'sending' && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{
                                width: 56, height: 56, border: '4px solid rgba(99,102,241,0.2)',
                                borderTopColor: '#6366f1', borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                                margin: '0 auto 20px',
                            }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text, #e2e8f0)', margin: '0 0 8px' }}>
                                {lang === 'bs' ? 'Slanje u tijeku...' : 'Sending...'}
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
                                {progress.current}/{progress.total} — {progress.email}
                            </p>
                            <div style={{
                                width: '80%', height: 6, borderRadius: 3,
                                background: 'rgba(255,255,255,0.06)',
                                margin: '16px auto 0', overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%`,
                                    height: '100%', borderRadius: 3,
                                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                    transition: 'width 0.3s',
                                }} />
                            </div>
                        </div>
                    )}

                    {step === 'done' && result && (
                        <div style={{ textAlign: 'center', padding: '30px 0' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 16 }}>
                                {result.failed === 0 ? '✅' : '⚠️'}
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text, #e2e8f0)', margin: '0 0 12px' }}>
                                {lang === 'bs' ? 'Slanje završeno' : 'Sending complete'}
                            </h3>
                            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 16 }}>
                                <div style={statBoxStyle('#10b981')}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.sent}</div>
                                    <div style={{ fontSize: '0.75rem' }}>{lang === 'bs' ? 'Poslano' : 'Sent'}</div>
                                </div>
                                {result.failed > 0 && (
                                    <div style={statBoxStyle('#ef4444')}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.failed}</div>
                                        <div style={{ fontSize: '0.75rem' }}>{lang === 'bs' ? 'Neuspjelo' : 'Failed'}</div>
                                    </div>
                                )}
                            </div>
                            {result.errors?.length > 0 && (
                                <div style={{
                                    textAlign: 'left', background: 'rgba(239,68,68,0.06)',
                                    borderRadius: 10, padding: 14, marginTop: 12,
                                }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#ef4444', margin: '0 0 8px' }}>
                                        {lang === 'bs' ? 'Greške:' : 'Errors:'}
                                    </p>
                                    {result.errors.map((e, i) => (
                                        <p key={i} style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0' }}>
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
                    {step === 'select' && (
                        <>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
                                {totalRecipients} {lang === 'bs' ? 'primatelja' : 'recipients'}
                            </span>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={onClose} style={cancelBtnStyle}>
                                    {lang === 'bs' ? 'Odustani' : 'Cancel'}
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={totalRecipients === 0}
                                    style={{
                                        ...sendBtnStyle,
                                        opacity: totalRecipients === 0 ? 0.4 : 1,
                                        cursor: totalRecipients === 0 ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    📤 {lang === 'bs' ? `Pošalji (${totalRecipients})` : `Send (${totalRecipients})`}
                                </button>
                            </div>
                        </>
                    )}
                    {step === 'done' && (
                        <button onClick={onClose} style={{ ...sendBtnStyle, marginLeft: 'auto' }}>
                            {lang === 'bs' ? 'Zatvori' : 'Close'}
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const labelStyle = {
    display: 'block', fontWeight: 600, fontSize: '0.85rem',
    color: 'var(--text, #e2e8f0)', marginBottom: 8,
};

const searchInputStyle = {
    flex: 1, padding: '9px 14px', fontSize: '0.88rem',
    borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))',
    background: 'var(--bg-input, rgba(0,0,0,0.2))',
    color: 'var(--text, #e2e8f0)', outline: 'none',
    fontFamily: 'inherit',
};

const textareaStyle = {
    width: '100%', padding: '10px 14px', fontSize: '0.88rem',
    borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))',
    background: 'var(--bg-input, rgba(0,0,0,0.2))',
    color: 'var(--text, #e2e8f0)', outline: 'none',
    fontFamily: 'inherit', resize: 'vertical',
};

const selectAllBtnStyle = {
    padding: '8px 14px', fontSize: '0.8rem', fontWeight: 600,
    borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))',
    background: 'transparent', color: 'var(--primary, #6366f1)',
    cursor: 'pointer', whiteSpace: 'nowrap',
};

const cancelBtnStyle = {
    padding: '9px 20px', fontSize: '0.88rem', fontWeight: 600,
    borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))',
    background: 'transparent', color: 'var(--text, #e2e8f0)',
    cursor: 'pointer',
};

const sendBtnStyle = {
    padding: '9px 24px', fontSize: '0.88rem', fontWeight: 700,
    borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff', cursor: 'pointer',
    boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
};

const statBoxStyle = (color) => ({
    padding: '12px 24px', borderRadius: 10,
    background: `${color}15`, border: `1px solid ${color}30`,
    color,
});
