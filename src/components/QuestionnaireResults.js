'use client';
import { useState, useEffect, useCallback } from 'react';
import { getSessionsForQuestionnaire, getQuestionnaireResponse } from '@/lib/firebaseSync';
import { fmtDateTime } from '@/lib/dateUtils';

/* ═══════════════════════════════════════════════════════
   Questionnaire Results Dashboard
   Shows who received, opened, and submitted responses
   ═══════════════════════════════════════════════════════ */

const STATUS_CONFIG = {
    sent: { label: 'Poslano', labelEn: 'Sent', color: '#f59e0b', icon: '📤', bg: 'rgba(245,158,11,0.1)' },
    opened: { label: 'Otvoreno', labelEn: 'Opened', color: '#3b82f6', icon: '👁️', bg: 'rgba(59,130,246,0.1)' },
    completed: { label: 'Završeno', labelEn: 'Completed', color: '#10b981', icon: '✅', bg: 'rgba(16,185,129,0.1)' },
    expired: { label: 'Isteklo', labelEn: 'Expired', color: '#ef4444', icon: '⏰', bg: 'rgba(239,68,68,0.1)' },
};

export default function QuestionnaireResults({ questionnaire, onBack, onReminderClick, lang = 'bs' }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const [responseData, setResponseData] = useState(null);
    const [loadingResponse, setLoadingResponse] = useState(false);

    const loadSessions = useCallback(async () => {
        if (!questionnaire?.id) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getSessionsForQuestionnaire(questionnaire.id);
            setSessions(data || []);
        } catch (err) {
            console.error('Failed to load sessions:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [questionnaire?.id]);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    const viewResponse = useCallback(async (session) => {
        setSelectedSession(session);
        setLoadingResponse(true);
        try {
            const resp = await getQuestionnaireResponse(session.id);
            setResponseData(resp);
        } catch (err) {
            console.error('Failed to load response:', err);
            setResponseData(null);
        } finally {
            setLoadingResponse(false);
        }
    }, []);

    // Parse survey JSON — handles native {questions:[]} format
    // Uses selectedSession.surveyJson if available (stored at send time)
    // Falls back to questionnaire.surveyJson
    function parseQuestions(json) {
        try {
            const parsed = typeof json === 'string' ? JSON.parse(json) : json;
            if (!parsed) return [];
            if (Array.isArray(parsed)) return parsed;
            if (parsed.questions) return parsed.questions; // native format
            if (parsed.pages?.[0]?.elements) return parsed.pages[0].elements; // SurveyJS
            return [];
        } catch { return []; }
    }

    // Stats
    const stats = {
        total: sessions.length,
        sent: sessions.filter(s => s.status === 'sent').length,
        opened: sessions.filter(s => s.status === 'opened').length,
        completed: sessions.filter(s => s.status === 'completed').length,
        expired: sessions.filter(s => s.status === 'expired').length,
    };

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button className="btn btn-ghost" onClick={onBack}>←</button>
                <h1 style={{ margin: 0, flex: 1 }}>
                    📊 {t('rezultatiUpitnika')}
                </h1>
                {onReminderClick && (
                    <button 
                        className="btn btn-outline btn-sm" 
                        onClick={onReminderClick}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                    >
                        📩 {t('posaljiPodsjetnik')}
                    </button>
                )}
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
                {questionnaire?.naziv || ''}
            </p>

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { key: 'total', label: t('ukupno'), value: stats.total, color: '#8b5cf6', icon: '📋', bg: 'rgba(139,92,246,0.1)' },
                    { key: 'sent', ...STATUS_CONFIG.sent, value: stats.sent, label: lang !== 'en' ? STATUS_CONFIG.sent.label : STATUS_CONFIG.sent.labelEn },
                    { key: 'opened', ...STATUS_CONFIG.opened, value: stats.opened, label: lang !== 'en' ? STATUS_CONFIG.opened.label : STATUS_CONFIG.opened.labelEn },
                    { key: 'completed', ...STATUS_CONFIG.completed, value: stats.completed, label: lang !== 'en' ? STATUS_CONFIG.completed.label : STATUS_CONFIG.completed.labelEn },
                ].map(s => (
                    <div key={s.key} className="card" style={{ textAlign: 'center' }}>
                        <div className="card-body" style={{ padding: '16px 12px' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{s.icon}</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {s.label}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Sessions table */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                            {t('poslaneAnkete')}
                        </h3>
                        <button className="btn btn-ghost btn-sm" onClick={loadSessions} style={{ fontSize: '0.8rem' }}>
                            🔄 {t('osvjezi')}
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <div style={{
                                width: 36, height: 36, border: '3px solid var(--border)',
                                borderTopColor: 'var(--primary)', borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                                margin: '0 auto 12px',
                            }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {lang !== 'en' ? 'Učitavanje...' : 'Loading...'}
                            </p>
                        </div>
                    ) : error ? (
                        <div style={{
                            textAlign: 'center', padding: 40,
                            color: '#ef4444', fontSize: '0.9rem',
                        }}>
                            ⚠️ {error}
                        </div>
                    ) : sessions.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: 40,
                            color: 'var(--text-muted)', fontSize: '0.9rem',
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
                            {t('nemaPoslanihAnketaZaOvaj')}
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('primatelj')}</th>
                                        <th>{t('email')}</th>
                                        <th>{t('status')}</th>
                                        <th>{t('ocjena')}</th>
                                        <th>{t('poslano')}</th>
                                        <th>{t('zavrseno')}</th>
                                        <th>{t('akcije')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map(s => {
                                        const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.sent;
                                        return (
                                            <tr key={s.id}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {s.recipientName || '—'}
                                                </td>
                                                <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                    {s.recipientEmail || '—'}
                                                </td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                                        padding: '4px 10px', borderRadius: 6,
                                                        background: sc.bg, color: sc.color,
                                                        fontSize: '0.8rem', fontWeight: 600,
                                                    }}>
                                                        {sc.icon} {lang !== 'en' ? sc.label : sc.labelEn}
                                                    </span>
                                                </td>
                                                <td>
                                                    {s.grade != null ? (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                                            padding: '4px 10px', borderRadius: 6,
                                                            background: s.grade.passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                            color: s.grade.passed ? '#10b981' : '#ef4444',
                                                            fontSize: '0.8rem', fontWeight: 700,
                                                        }}>
                                                            {s.grade.passed ? '✅' : '❌'} {s.grade.percentage}%
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                    {fmtDateTime(s.createdAt) || '—'}
                                                </td>
                                                <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                    {fmtDateTime(s.completedAt) || '—'}
                                                </td>
                                                <td>
                                                    {s.status === 'completed' && (
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            onClick={() => viewResponse(s)}
                                                            style={{ fontSize: '0.78rem' }}
                                                        >
                                                            👁️ {t('odgovori')}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Response viewer modal */}
            {selectedSession && (
                <>
                    <div onClick={() => { setSelectedSession(null); setResponseData(null); }} style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)', zIndex: 10000,
                    }} />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '90vw', maxWidth: 600, maxHeight: '80vh',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                        zIndex: 10001, display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            padding: '18px 24px', display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid var(--border-light)',
                        }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                                📝 {t('odgovori')} — {selectedSession.recipientName || selectedSession.recipientEmail}
                            </h3>
                            <button onClick={() => { setSelectedSession(null); setResponseData(null); }} style={{
                                background: 'none', border: 'none', fontSize: '1.2rem',
                                cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px',
                            }}>✕</button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                            {loadingResponse ? (
                                <div style={{ textAlign: 'center', padding: 40 }}>
                                    <p style={{ color: 'var(--text-muted)' }}>
                                        {lang !== 'en' ? 'Učitavanje...' : 'Loading...'}
                                    </p>
                                </div>
                            ) : !responseData ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    {t('nemaOdgovora1')}
                                </div>
                            ) : (<div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                                    {t('predano')}: {fmtDateTime(responseData.submittedAt) || '—'}
                                </div>
                                {(() => {
                                    // Get ordered questions from session surveyJson
                                    const qs = parseQuestions(selectedSession.surveyJson || questionnaire?.surveyJson);
                                    const answers = responseData.answers || {};

                                    // Build ordered list: questions in their defined order, skip heading/html
                                    const ordered = qs
                                        .filter(q => q.type !== 'heading' && q.type !== 'html')
                                        .map((q, idx) => ({
                                            key: q.id || q.name,
                                            title: q.title || q.text || q.name || q.id,
                                            num: idx + 1,
                                            value: answers[q.id || q.name],
                                        }))
                                        .filter(item => item.value !== undefined && item.value !== null && item.value !== '');

                                    // Append any answers not matched to a question (fallback)
                                    const matchedKeys = new Set(ordered.map(o => o.key));
                                    const unmatched = Object.entries(answers)
                                        .filter(([k]) => !matchedKeys.has(k))
                                        .map(([k, v]) => ({ key: k, title: k, num: null, value: v }));

                                    return [...ordered, ...unmatched].map(item => (
                                        <div key={item.key} style={{
                                            padding: '12px 16px', marginBottom: 10,
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            borderRadius: 10,
                                        }}>
                                            <div style={{
                                                fontSize: '0.78rem', fontWeight: 600,
                                                color: 'var(--primary)', marginBottom: 4,
                                            }}>
                                                {item.num ? `#${item.num}. ` : ''}{item.title}
                                            </div>
                                            <div style={{ fontSize: '0.92rem', color: 'var(--text)' }}>
                                                {Array.isArray(item.value) ? item.value.join(', ') : String(item.value)}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>)
                            }
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
