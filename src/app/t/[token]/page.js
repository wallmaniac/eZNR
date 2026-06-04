'use client';
import { useState, useEffect, use } from 'react';
import { getTrainingSession, markTrainingSessionOpened, saveTrainingResponse } from '@/lib/firebaseSync';
import { generateTrainingCertificate } from '@/lib/trainingCertificate';
import { useLanguage } from '@/contexts/LanguageContext';

/* ═══════════════════════════════════════════════════════
   Public Training Page — /t/[token]
   Phase 1: Slide viewer
   Phase 2: Quiz
   Phase 3: Result
   ═══════════════════════════════════════════════════════ */

const LANGUAGES = [
    { code: 'bs', label: 'BA', flag: 'https://flagcdn.com/ba.svg', title: 'Bosanski' },
    { code: 'hr', label: 'HR', flag: 'https://flagcdn.com/hr.svg', title: 'Hrvatski' },
    { code: 'en', label: 'EN', flag: 'https://flagcdn.com/gb.svg', title: 'English' },
    { code: 'de', label: 'DE', flag: 'https://flagcdn.com/de.svg', title: 'Deutsch' },
    { code: 'sl', label: 'SL', flag: 'https://flagcdn.com/si.svg', title: 'Slovenščina' },
    { code: 'sr', label: 'SR', flag: 'https://flagcdn.com/rs.svg', title: 'Srpski' }
];

export default function PublicTrainingPage({ params }) {
    const { t, lang, setLang } = useLanguage();
    const resolvedParams = use(params);
    const token = resolvedParams.token;

    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Phase: 'slides' | 'quiz' | 'result'
    const [phase, setPhase] = useState('slides');
    const [slideIdx, setSlideIdx] = useState(0);

    // Quiz state
    const [answers, setAnswers] = useState({}); // { qIdx: optionIdx }
    const [quizIdx, setQuizIdx] = useState(0);   // current question
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [grade, setGrade] = useState(null);    // { percentage, passed, details }

    useEffect(() => {
        async function load() {
            if (!token) { setError('invalidLink'); setLoading(false); return; }
            try {
                const data = await getTrainingSession(token);
                if (!data) { setError('trainingNotFound'); setLoading(false); return; }
                if (data.status === 'completed') { setSubmitted(true); setSession(data); setLoading(false); return; }
                if (data.deadline && new Date(data.deadline) < new Date()) { setError('trainingExpired'); setLoading(false); return; }
                if (data.status === 'sent') await markTrainingSessionOpened(data.id);
                setSession(data);
            } catch (err) {
                console.error(err);
                setError('errorLoadingTraining');
            } finally { setLoading(false); }
        }
        load();
    }, [token]);

    const slides = session?.slides || [];
    const questions = session?.questions || [];
    const prolazniPrag = session?.prolazniPrag ?? 70;
    const dozvoliPovratak = session?.dozvoliPovratak ?? false;
    const prikaziHintove = session?.prikaziHintove !== false;
    const assignedBy = session?.assignedBy || '';
    const companyName = session?.companyName || '';
    const companyLogo = session?.companyLogo || '';

    const handlePrint = () => window.print();

    const handleSubmitQuiz = async () => {
        if (!session?.id) return;
        setSubmitting(true);
        try {
            // Compute grade
            let correct = 0;
            const details = questions.map((q, i) => {
                const userAnswer = answers[i] ?? -1;
                const isCorrect = userAnswer === q.tacno;
                if (isCorrect) correct++;
                return { question: q.pitanje, userAnswer, correctAnswer: q.tacno, isCorrect };
            });
            const percentage = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 100;
            const passed = questions.length === 0 || percentage >= prolazniPrag;
            const result = { percentage, passed, correct, total: questions.length, details };
            setGrade(result);
            await saveTrainingResponse(session.id, answers, result);
            setPhase('result');
        } catch (err) {
            console.error(err);
            alert(t('errorLoadingTraining') + ': ' + (err?.message || ''));
        } finally { setSubmitting(false); }
    };

    // When entering quiz phase with no questions, auto-complete via useEffect (never during render)
    useEffect(() => {
        if (phase === 'quiz' && questions.length === 0 && !submitting && !submitted) {
            handleSubmitQuiz();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, questions.length]);

    // ── Loading ────────────────────────────────────────────────────────────
    if (loading) return (
        <div style={pageStyle}>
            <BgGlow />
            <div style={containerStyle}>
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spinner size={52} />
                    <p style={{ color: '#94a3b8', marginTop: 20 }}>{t('loadingTraining')}</p>
                </div>
            </div>
        </div>
    );

    // ── Error ──────────────────────────────────────────────────────────────
    if (error) return (
        <div style={pageStyle}>
            <BgGlow />
            <div style={containerStyle}>
                <div style={{ textAlign: 'center', padding: '60px 0', maxWidth: 480, margin: '0 auto' }}>
                    <div style={iconBox('rgba(239,68,68,0.1)', 72)}>❌</div>
                    <h2 style={{ color: '#e2e8f0', marginBottom: 8 }}>{t('trainingNotAvailable')}</h2>
                    <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{t(error)}</p>
                </div>
                <Footer />
            </div>
        </div>
    );

    // ── Already completed ─────────────────────────────────────────────────
    if (submitted) return (
        <div style={pageStyle}>
            <BgGlow />
            <div style={containerStyle}>
                <div style={{ textAlign: 'center', padding: '60px 0', maxWidth: 480, margin: '0 auto' }}>
                    <div style={{ ...iconBox('rgba(16,185,129,0.1)', 80), animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)', fontSize: '2.5rem' }}>✅</div>
                    <style>{`@keyframes popIn { from { transform:scale(0.5);opacity:0; } to { transform:scale(1);opacity:1; } }`}</style>
                    <h2 style={{ color: '#10b981', marginBottom: 8 }}>{t('trainingCompleted')}</h2>
                    <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>Vaši odgovori su uspješno primljeni. Možete zatvoriti ovu stranicu.</p>
                </div>
                <Footer />
            </div>
        </div>
    );

    if (!session) return null;

    // ══════════════════════════════════════════════════════════════════════
    // PHASE: SLIDES
    // ══════════════════════════════════════════════════════════════════════
    if (phase === 'slides') {
        const currentSlide = slides[slideIdx] || {};
        const isLast = slideIdx === slides.length - 1;
        const progress = slides.length > 0 ? ((slideIdx + 1) / slides.length) * 100 : 0;

        return (
            <div style={pageStyle}>
                <BgGlow />
                <MobileStyles />
                <div style={{ ...containerStyle, maxWidth: 860 }} className="t-container">
                    {/* Floating Premium Language Switcher */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
                        {LANGUAGES.map(l => (
                            <button
                                key={l.code}
                                onClick={() => setLang(l.code)}
                                title={l.title}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    border: lang === l.code ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.15)',
                                    background: lang === l.code ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    transition: 'all 0.15s',
                                    boxShadow: lang === l.code ? '0 0 8px rgba(99,102,241,0.4)' : 'none'
                                }}
                            >
                                <img src={l.flag} width={16} height={16} alt={l.label} style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: (l.code === 'sl' || l.code === 'sr') ? '28% 50%' : 'center' }} />
                            </button>
                        ))}
                    </div>


                    {/* Company header */}
                    {(companyLogo || companyName) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 16, padding: '10px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {companyLogo && <img src={companyLogo} alt={companyName} style={{ height: 40, maxWidth: 120, objectFit: 'contain' }} />}
                            {companyName && <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#e2e8f0' }}>{companyName}</span>}
                        </div>
                    )}

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 12 }}>
                            <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 700 }}>🎬 {t('presentationLabel')}</span>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#e2e8f0', margin: '0 0 8px' }}>
                            {session.trainingName || t('obuka')}
                        </h1>
                        {assignedBy && <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 4px' }}>👤 {t('ispitivac')}: <strong style={{ color: '#e2e8f0' }}>{assignedBy}</strong></p>}
                        {session.deadline && (
                            <p style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                                ⏰ {t('vrijediDo')}: {new Date(session.deadline).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'de' ? 'de-DE' : lang === 'sl' ? 'sl-SI' : 'hr-HR')}
                            </p>
                        )}
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', color: '#94a3b8' }}>
                            <span>{t('slideWord')} {slideIdx + 1} {t('ofWord')} {slides.length}</span>
                            <span>{t('viewedPct').replace('{0}', Math.round(progress))}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 3, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.4s ease' }} />
                        </div>
                    </div>

                    {/* Slide card */}
                    <div className="t-slide-card" style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 20, padding: '40px 48px', marginBottom: 24, minHeight: 340,
                        position: 'relative', overflow: 'hidden',
                        animation: 'fadeSlide 0.2s ease',
                    }}>
                        {/* Slide number badge */}
                        <div style={{ position: 'absolute', top: 20, right: 24, fontSize: '0.72rem', color: '#475569', fontWeight: 700, letterSpacing: '0.08em' }}>
                            {slideIdx + 1}/{slides.length}
                        </div>

                        {currentSlide.naslov && (
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#e2e8f0', margin: '0 0 20px', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', lineHeight: 1.3 }}>
                                {currentSlide.naslov}
                            </h2>
                        )}
                        <div className="t-slide-content" style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.9, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {currentSlide.sadrzaj || <span style={{ color: '#475569', fontStyle: 'italic' }}>({t('noContent')})</span>}
                        </div>
                    </div>

                    {/* Navigation row: Prev | counter | Next (always horizontal) */}
                    <div className="t-nav" style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <button
                            className="t-nav-btn"
                            onClick={() => setSlideIdx(i => Math.max(0, i - 1))}
                            disabled={slideIdx === 0}
                            style={{ ...navBtnStyle, opacity: slideIdx === 0 ? 0.3 : 1, minWidth: 110 }}>
                            ← {t('prevBtn')}
                        </button>

                        <span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {slideIdx + 1} / {slides.length}
                        </span>

                        {isLast ? (
                            <button
                                className="t-nav-btn-green"
                                onClick={() => { setPhase('quiz'); setQuizIdx(0); }}
                                style={{ minWidth: 110, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 20px rgba(34,197,94,0.3)', whiteSpace: 'nowrap' }}>
                                {questions.length > 0
                                    ? (Object.keys(answers).length > 0 ? '▶️ ' + t('continueTest') + ' →' : '✅ ' + t('startTest') + ' →')
                                    : '✅ ' + t('finishBtn')}
                            </button>
                        ) : (
                            <button
                                className="t-nav-btn"
                                onClick={() => setSlideIdx(i => Math.min(slides.length - 1, i + 1))}
                                style={{ ...navBtnStyle, minWidth: 110 }}>
                                {t('nextBtn')} →
                            </button>
                        )}
                    </div>

                    {/* Slide picker — numbered buttons, always horizontal, wraps to multiple rows */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 6,
                        justifyContent: 'center', marginBottom: 8,
                        padding: '10px 8px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        {slides.map((_, i) => (
                            <button key={i} onClick={() => setSlideIdx(i)}
                                style={{
                                    width: 32, height: 32, borderRadius: 7,
                                    border: `1px solid ${i === slideIdx ? '#6366f1' : i < slideIdx ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.1)'}`,
                                    background: i === slideIdx ? '#6366f1' : i < slideIdx ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                                    color: i === slideIdx ? '#fff' : i < slideIdx ? '#818cf8' : '#475569',
                                    cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                                    transition: 'all 0.15s', flexShrink: 0,
                                }}>
                                {i + 1}
                            </button>
                        ))}
                    </div>


                    <Footer />
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // PHASE: QUIZ
    // ══════════════════════════════════════════════════════════════════════
    if (phase === 'quiz') {
        // No questions — show spinner while auto-submitting via useEffect
        if (questions.length === 0) {
            return (
                <div style={pageStyle}>
                    <BgGlow />
                    <div style={containerStyle}>
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <Spinner size={52} />
                            <p style={{ color: '#94a3b8', marginTop: 20 }}>{t('submittingBtn')}</p>
                        </div>
                    </div>
                </div>
            );
        }

        const currentQ = questions[quizIdx];
        const isAnswered = answers[quizIdx] !== undefined;
        const isLastQ = quizIdx === questions.length - 1;
        const answered = Object.keys(answers).length;
        const progress = (answered / questions.length) * 100;

        return (
            <div style={pageStyle}>
                <BgGlow />
                <style>{`@keyframes spin { to { transform:rotate(360deg); } } @keyframes fadeSlide { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }`}</style>
                <MobileStyles />
                <div style={{ ...containerStyle, maxWidth: 720 }} className="t-container">
                    {/* Floating Premium Language Switcher */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
                        {LANGUAGES.map(l => (
                            <button
                                key={l.code}
                                onClick={() => setLang(l.code)}
                                title={l.title}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    border: lang === l.code ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.15)',
                                    background: lang === l.code ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    transition: 'all 0.15s',
                                    boxShadow: lang === l.code ? '0 0 8px rgba(99,102,241,0.4)' : 'none'
                                }}
                            >
                                <img src={l.flag} width={16} height={16} alt={l.label} style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: (l.code === 'sl' || l.code === 'sr') ? '28% 50%' : 'center' }} />
                            </button>
                        ))}
                    </div>


                    {/* Header — back button only if officer enabled it */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 4 }}>
                                <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700 }}>❓ {t('quizLabel')}</span>
                            </div>
                            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{session.trainingName}</h1>
                        </div>
                        {dozvoliPovratak ? (
                            <button onClick={() => setPhase('slides')}
                                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                ← {t('backToSlides')}
                            </button>
                        ) : (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>{t('cannotInterrupt')}</div>
                        )}
                    </div>

                    {/* Progress */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', color: '#94a3b8' }}>
                            <span>{t('questionWord')} {quizIdx + 1} {t('ofWord')} {questions.length}</span>
                            <span>{answered} {t('answeredWord')}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 3, background: 'linear-gradient(90deg,#f59e0b,#f97316)', transition: 'width 0.4s' }} />
                        </div>
                    </div>

                    {/* Question card */}
                    <div key={quizIdx} className="t-q-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 36px', marginBottom: 20, animation: 'fadeSlide 0.25s ease' }}>
                        <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 12 }}>{t('questionWordUpper')} {quizIdx + 1}</div>
                        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.5, margin: '0 0 24px' }}>
                            {currentQ?.pitanje || ''}
                        </p>

                        {/* Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(currentQ?.opcije || []).map((opt, oIdx) => {
                                const selected = answers[quizIdx] === oIdx;
                                return (
                                    <button key={oIdx} onClick={() => setAnswers(prev => ({ ...prev, [quizIdx]: oIdx }))}
                                        className="t-q-opt"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                                            borderRadius: 12, border: `2px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                                            background: selected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                                            color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: '0.92rem',
                                            transition: 'all 0.15s', fontFamily: 'inherit', width: '100%',
                                            minHeight: 44,
                                        }}>
                                        <span style={{
                                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                            border: `2px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.2)'}`,
                                            background: selected ? '#6366f1' : 'transparent',
                                            color: selected ? '#fff' : '#94a3b8',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 800, fontSize: '0.78rem',
                                        }}>
                                            {String.fromCharCode(65 + oIdx)}
                                        </span>
                                        <span style={{ flex: 1 }}>{opt}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation (shown after answered) */}
                        {isAnswered && prikaziHintove && currentQ?.objasnjenje && (
                            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                                💡 {currentQ.objasnjenje}
                            </div>
                        )}
                    </div>

                    {/* Question picker — always horizontal, wraps to multiple rows */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 6,
                        justifyContent: 'center', marginBottom: 14,
                        padding: '10px 8px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                        {questions.map((_, i) => (
                            <button key={i} onClick={() => setQuizIdx(i)}
                                style={{
                                    width: 34, height: 34, borderRadius: 8,
                                    border: `1px solid ${i === quizIdx ? '#6366f1' : answers[i] !== undefined ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.12)'}`,
                                    background: i === quizIdx ? '#6366f1' : answers[i] !== undefined ? 'rgba(99,102,241,0.15)' : 'transparent',
                                    color: i === quizIdx ? '#fff' : answers[i] !== undefined ? '#818cf8' : '#475569',
                                    cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                                    flexShrink: 0, transition: 'all 0.15s',
                                }}>
                                {i + 1}
                            </button>
                        ))}
                    </div>

                    {/* Quiz nav row: Prev | answered/total | Next/Submit — always horizontal */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                        <button className="t-nav-btn" onClick={() => setQuizIdx(i => Math.max(0, i - 1))} disabled={quizIdx === 0}
                            style={{ ...navBtnStyle, opacity: quizIdx === 0 ? 0.3 : 1, minWidth: 110 }}>← {t('prevBtn')}</button>

                        <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {answered}/{questions.length} {t('answeredWord')}
                        </span>

                        {isLastQ ? (
                            <button className="t-nav-btn-green" onClick={handleSubmitQuiz} disabled={submitting}
                                style={{ minWidth: 110, padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: submitting ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                                {submitting ? <><Spinner size={14} /> {t('submittingBtn')}</> : '✅ ' + t('submitTest')}
                            </button>
                        ) : (
                            <button className="t-nav-btn" onClick={() => setQuizIdx(i => Math.min(questions.length - 1, i + 1))} style={{ ...navBtnStyle, minWidth: 110 }}>
                                Sljedeće →
                            </button>
                        )}
                    </div>

                    {/* Submit from any question */}
                    {!isLastQ && Object.keys(answers).length === questions.length && (
                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <button onClick={handleSubmitQuiz} disabled={submitting}
                                style={{ padding: '12px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                                ✅ {t('submitTest')} ({Object.keys(answers).length}/{questions.length} {t('answeredWord')})
                            </button>
                        </div>
                    )}

                    <Footer />
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════
    // PHASE: RESULT
    // ══════════════════════════════════════════════════════════════════════
    if (phase === 'result' && grade) {
        const showResults = session.prikaziRezultate !== false;

        return (
            <div style={pageStyle}>
                <BgGlow />
                <style>{`@keyframes popIn { from { transform:scale(0.5);opacity:0; } to { transform:scale(1);opacity:1; } } @keyframes fadeSlide { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }`}</style>
                <div style={{ ...containerStyle, maxWidth: 640 }}>
                    {/* Floating Premium Language Switcher */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
                        {LANGUAGES.map(l => (
                            <button
                                key={l.code}
                                onClick={() => setLang(l.code)}
                                title={l.title}
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    border: lang === l.code ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.15)',
                                    background: lang === l.code ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 0,
                                    transition: 'all 0.15s',
                                    boxShadow: lang === l.code ? '0 0 8px rgba(99,102,241,0.4)' : 'none'
                                }}
                            >
                                <img src={l.flag} width={16} height={16} alt={l.label} style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: (l.code === 'sl' || l.code === 'sr') ? '28% 50%' : 'center' }} />
                            </button>
                        ))}
                    </div>


                    {/* Result hero */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ ...iconBox(grade.passed ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', 90), animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)', fontSize: '3rem', marginBottom: 20 }}>
                            {grade.passed ? '🏆' : '📚'}
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: grade.passed ? '#22c55e' : '#f05252', margin: '0 0 8px' }}>
                            {grade.passed ? t('congratsPassed') : t('failedTest')}
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '1rem', margin: 0 }}>
                            {session.trainingName}
                        </p>
                    </div>

                    {showResults && (
                        <>
                            {/* Score card */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${grade.passed ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 20, padding: 28, marginBottom: 24, textAlign: 'center' }}>
                                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: grade.passed ? '#22c55e' : '#f05252', lineHeight: 1 }}>{grade.percentage}%</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: 8 }}>
                                    {t('correctAnswersOf').replace('{0}', grade.correct).replace('{1}', grade.total)} · {t('pragProlaza')}: {prolazniPrag}%
                                </div>
                                <div style={{ marginTop: 16, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${grade.percentage}%`, borderRadius: 4, background: grade.passed ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#f05252,#dc2626)', transition: 'width 1s ease' }} />
                                </div>
                            </div>

                            {/* Answer review */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeSlide 0.4s ease' }}>
                                {(grade.details || []).map((d, i) => (
                                    <div key={i} style={{ background: d.isCorrect ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${d.isCorrect ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 12, padding: '14px 18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 2 }}>{d.isCorrect ? '✅' : '❌'}</span>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 6px' }}>{d.question}</p>
                                                {!d.isCorrect && questions[i] && (
                                                    <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                                        <span style={{ color: '#f05252' }}>{t('yourAnswer')} {d.userAnswer >= 0 ? (questions[i].opcije?.[d.userAnswer] || String.fromCharCode(65 + d.userAnswer)) : `(${t('nijePostavljeno')})`}</span>
                                                        <br />
                                                        <span style={{ color: '#22c55e' }}>{t('correctAnswerLabel')} {questions[i].opcije?.[d.correctAnswer] || String.fromCharCode(65 + d.correctAnswer)}</span>
                                                    </div>
                                                )}
                                                {d.isCorrect && prikaziHintove && questions[i]?.objasnjenje && (
                                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>💡 {questions[i].objasnjenje}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {!showResults && (
                        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '0.95rem' }}>
                            Vaši odgovori su uspješno primljeni. Rezultati će biti dostavljeni vašem poslodavcu.
                        </div>
                    )}

                    {/* Certificate download (only if passed) */}
                    {grade.passed && (
                        <div style={{ textAlign: 'center', marginTop: 24 }}>
                            <button onClick={() => generateTrainingCertificate({
                                workerName: session.recipientName || session.recipientEmail || '',
                                trainingName: session.trainingName || 'Obuka',
                                date: session.completedAt || new Date().toISOString(),
                                score: grade.percentage,
                                companyName: companyName || '',
                                companyLogo: companyLogo || '',
                                officerName: assignedBy || '',
                                lang: lang,
                            })}
                                style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
                                📄 {t('downloadCert')}
                            </button>
                        </div>
                    )}

                    {/* Review button */}
                    {!grade.passed && (
                        <div style={{ textAlign: 'center', marginTop: 24 }}>
                            <button onClick={() => { setPhase('slides'); setSlideIdx(0); }}
                                style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                                📖 {t('reviewSlides')}
                            </button>
                        </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: 24, color: '#475569', fontSize: '0.85rem' }}>
                        {t('closePageNotice')}
                    </div>

                    <Footer />
                </div>
            </div>
        );
    }

    return null;
}

// ─── Shared UI Components ────────────────────────────────────────────────────

function Footer() {
    return (
        <div style={{ textAlign: 'center', padding: '40px 0 24px' }}>
            <img src="/blulogo.jpg" alt="eZNR" style={{ height: 128, maxWidth: 440, objectFit: 'contain' }} />
        </div>
    );
}

function MobileStyles() {
    return (
        <style>{`
            @keyframes spin { to { transform:rotate(360deg); } }
            @keyframes fadeSlide { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
            @media (max-width: 600px) {
                .t-container { padding: 10px 12px !important; }
                .t-slide-card { padding: 18px 14px !important; min-height: 260px !important; }
                .t-slide-card h2 { font-size: 1.05rem !important; }
                .t-slide-content { font-size: 0.95rem !important; line-height: 1.7 !important; }
                .t-nav-btn { padding: 11px 14px !important; font-size: 0.92rem !important; }
                .t-nav-btn-green { padding: 11px 14px !important; font-size: 0.88rem !important; }
                .t-q-card { padding: 18px 14px !important; }
                .t-q-opt { padding: 12px 12px !important; font-size: 0.95rem !important; min-height: 50px !important; }
            }
        `}</style>
    );
}

function Spinner({ size = 40 }) {
    return (
        <div style={{ width: size, height: size, border: `${size > 30 ? 4 : 2}px solid rgba(99,102,241,0.15)`, borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
    );
}

function BgGlow() {
    return (
        <>
            <div style={{ position: 'fixed', top: '-30%', right: '-20%', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '-20%', left: '-15%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />
        </>
    );
}


function iconBox(bg, size = 72) {
    return {
        width: size, height: size, borderRadius: 20, background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto', fontSize: Math.round(size * 0.4) + 'px',
    };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle = { minHeight: '100vh', background: '#0f172a', position: 'relative', overflow: 'hidden', fontFamily: 'var(--font-body, system-ui, sans-serif)' };

const containerStyle = { maxWidth: 800, margin: '0 auto', padding: '20px 20px', position: 'relative', zIndex: 1 };

const navBtnStyle = {
    padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', cursor: 'pointer',
    fontSize: '0.92rem', fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit',
    whiteSpace: 'nowrap',
};
