'use client';
import { useState, useEffect, use } from 'react';
import { getQuestionnaireSession, markSessionOpened, saveQuestionnaireResponse } from '@/lib/firebaseSync';
import PublicQuestionnaireForm from '@/components/PublicQuestionnaireForm';

/* ═══════════════════════════════════════════════════════
   Public Questionnaire Fill Page
   Route: /q/[token]
   No login required — worker opens link from email
   ═══════════════════════════════════════════════════════ */

export default function PublicQuestionnairePage({ params }) {
    const resolvedParams = use(params);
    const token = resolvedParams.token;

    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function loadSession() {
            if (!token) {
                setError('Nevažeći link');
                setLoading(false);
                return;
            }

            try {
                const data = await getQuestionnaireSession(token);
                if (!data) {
                    setError('Upitnik nije pronađen ili je link nevažeći.');
                    setLoading(false);
                    return;
                }

                if (data.status === 'completed') {
                    setSubmitted(true);
                    setSession(data);
                    setLoading(false);
                    return;
                }

                // Check deadline
                if (data.deadline && new Date(data.deadline) < new Date()) {
                    setError('Rok za ispunjavanje ovog upitnika je istekao.');
                    setLoading(false);
                    return;
                }

                // Mark as opened
                if (data.status === 'sent') {
                    await markSessionOpened(data.id);
                }

                setSession(data);
            } catch (err) {
                console.error('Failed to load session:', err);
                setError('Greška pri učitavanju upitnika. Pokušajte ponovo.');
            } finally {
                setLoading(false);
            }
        }

        loadSession();
    }, [token]);

    const handleSubmit = async (answers, grade) => {
        if (!session?.id) return;
        setSubmitting(true);
        try {
            await saveQuestionnaireResponse(session.id, answers, grade);

            const showResultsToWorker = grade && (session.prikaziRezultateNakonRjesavanja !== false);
            if (!showResultsToWorker) {
                // No grading or results hidden — go straight to thank-you screen
                setSubmitted(true);
            }
            // If grade results are enabled, keep the form mounted so it can
            // display its built-in grade screen. The session is already marked
            // as 'completed' in Firestore, so re-opening the link shows "Hvala".
        } catch (err) {
            console.error('Failed to submit response:', err);
            alert('Greška pri slanju odgovora: ' + (err?.message || err?.code || 'Nepoznata greška'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={pageStyle}>
            {/* Decorative background */}
            <div style={bgGradient1} />
            <div style={bgGradient2} />

            <div className="pqf-page-container" style={containerStyle}>
                <style>{`
                    @media (max-width: 600px) {
                        .pqf-page-container { padding: 12px !important; }
                        .pqf-page-container h1 { font-size: 1.15rem !important; }
                        .pqf-page-container h2 { font-size: 1.1rem !important; }
                    }
                `}</style>

                {/* Loading */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{
                            width: 52, height: 52,
                            border: '4px solid rgba(99,102,241,0.15)',
                            borderTopColor: '#6366f1',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 20px',
                        }} />
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                        <p style={{ color: '#94a3b8', fontSize: '1rem' }}>Učitavanje upitnika...</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div style={{
                        textAlign: 'center', padding: '60px 20px',
                        maxWidth: 480, margin: '0 auto',
                    }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: 20,
                            background: 'rgba(239,68,68,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2rem', margin: '0 auto 20px',
                        }}>
                            ❌
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
                            Upitnik nije dostupan
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                            {error}
                        </p>
                    </div>
                )}

                {/* Already submitted */}
                {!loading && !error && submitted && (
                    <div style={{
                        textAlign: 'center', padding: '60px 20px',
                        maxWidth: 480, margin: '0 auto',
                    }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: 20,
                            background: 'rgba(16,185,129,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '2.5rem', margin: '0 auto 20px',
                            animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        }}>
                            ✅
                        </div>
                        <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
                        <h2 style={{
                            fontSize: '1.3rem', fontWeight: 700, color: '#10b981',
                            marginBottom: 8,
                        }}>
                            Hvala na ispunjavanju!
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6 }}>
                            Vaši odgovori su uspješno primljeni.
                            Možete zatvoriti ovu stranicu.
                        </p>
                    </div>
                )}

                {/* Questionnaire form */}
                {!loading && !error && !submitted && session && (
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        {/* Company header */}
                        {(session.companyLogo || session.companyName) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 16, padding: '10px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {session.companyLogo && <img src={session.companyLogo} alt={session.companyName} style={{ height: 40, maxWidth: 120, objectFit: 'contain' }} />}
                                {session.companyName && <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>{session.companyName}</span>}
                            </div>
                        )}

                        {/* Title card */}
                        <div style={{
                            textAlign: 'center', marginBottom: 32,
                            padding: '24px 20px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 16,
                        }}>
                            <h1 style={{
                                fontSize: '1.4rem', fontWeight: 800,
                                color: '#e2e8f0', margin: '0 0 8px',
                            }}>
                                📝 {session.questionnaireName || 'Upitnik'}
                            </h1>
                            {session.assignedBy && <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '4px 0 0' }}>👤 Dodijelio/la: <strong style={{ color: '#e2e8f0' }}>{session.assignedBy}</strong></p>}
                            {session.senderEmail && (
                                <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '4px 0 0' }}>
                                    📧 Od: <span style={{ color: '#818cf8' }}>{session.senderEmail}</span>
                                </p>
                            )}
                            {session.recipientEmail && (
                                <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '4px 0 0' }}>
                                    📬 Za: <span style={{ color: '#818cf8' }}>{session.recipientEmail}</span>
                                    {session.recipientName && session.recipientName !== session.recipientEmail && ` (${session.recipientName})`}
                                </p>
                            )}
                            {session.deadline && (
                                <p style={{
                                    color: '#f59e0b', fontSize: '0.85rem',
                                    fontWeight: 600, margin: '8px 0 0',
                                }}>
                                    ⏰ Rok: {new Date(session.deadline).toLocaleDateString('hr-HR')}
                                </p>
                            )}
                        </div>

                        {/* The form */}
                        <PublicQuestionnaireForm
                            surveyJson={session.surveyJson}
                            questionnaireName={session.questionnaireName}
                            onSubmit={handleSubmit}
                            submitting={submitting}
                            prolazniPrag={session.prolazniPrag ?? 70}
                            prikaziRezultate={session.prikaziRezultateNakonRjesavanja !== false}
                        />
                    </div>
                )}

                {/* Footer */}
                <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
                    <img src="/blulogo.jpg" alt="eZNR" style={{ height: 128, maxWidth: 440, objectFit: 'contain' }} />
                </div>
            </div>
        </div>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle = {
    minHeight: '100vh',
    background: '#0f172a',
    position: 'relative',
    overflow: 'hidden',
};

const bgGradient1 = {
    position: 'fixed', top: '-30%', right: '-20%',
    width: '60vw', height: '60vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
};

const bgGradient2 = {
    position: 'fixed', bottom: '-20%', left: '-15%',
    width: '50vw', height: '50vw',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
};

const containerStyle = {
    maxWidth: 800, margin: '0 auto',
    padding: '20px 20px',
    position: 'relative',
    zIndex: 1,
};
