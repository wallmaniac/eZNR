'use client';
import { useState, useEffect, use } from 'react';
import { getTrainingSession, markTrainingSessionOpened, saveTrainingResponse } from '@/lib/firebaseSync';

/* ═══════════════════════════════════════════════════════
   Public Training Page — /t/[token]
   Phase 1: Slide viewer
   Phase 2: Quiz
   Phase 3: Result
   ═══════════════════════════════════════════════════════ */

export default function PublicTrainingPage({ params }) {
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
            if (!token) { setError('Nevažeći link.'); setLoading(false); return; }
            try {
                const data = await getTrainingSession(token);
                if (!data) { setError('Obuka nije pronađena ili je link nevažeći.'); setLoading(false); return; }
                if (data.status === 'completed') { setSubmitted(true); setSession(data); setLoading(false); return; }
                if (data.deadline && new Date(data.deadline) < new Date()) { setError('Rok za ovu obuku je istekao.'); setLoading(false); return; }
                if (data.status === 'sent') await markTrainingSessionOpened(data.id);
                setSession(data);
            } catch (err) {
                console.error(err);
                setError('Greška pri učitavanju obuke. Pokušajte ponovo.');
            } finally { setLoading(false); }
        }
        load();
    }, [token]);

    const slides = session?.slides || [];
    const questions = session?.questions || [];
    const prolazniPrag = session?.prolazniPrag ?? 70;
    const dozvoliPovratak = session?.dozvoliPovratak ?? false;
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
            alert('Greška pri slanju odgovora: ' + (err?.message || 'Nepoznata greška'));
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
                <Logo />
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <Spinner size={52} />
                    <p style={{ color: '#94a3b8', marginTop: 20 }}>Učitavanje obuke...</p>
                </div>
            </div>
        </div>
    );

    // ── Error ──────────────────────────────────────────────────────────────
    if (error) return (
        <div style={pageStyle}>
            <BgGlow />
            <div style={containerStyle}>
                <Logo />
                <div style={{ textAlign: 'center', padding: '60px 0', maxWidth: 480, margin: '0 auto' }}>
                    <div style={iconBox('rgba(239,68,68,0.1)', 72)}>❌</div>
                    <h2 style={{ color: '#e2e8f0', marginBottom: 8 }}>Obuka nije dostupna</h2>
                    <p style={{ color: '#94a3b8', lineHeight: 1.6 }}>{error}</p>
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
                <Logo />
                <div style={{ textAlign: 'center', padding: '60px 0', maxWidth: 480, margin: '0 auto' }}>
                    <div style={{ ...iconBox('rgba(16,185,129,0.1)', 80), animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)', fontSize: '2.5rem' }}>✅</div>
                    <style>{`@keyframes popIn { from { transform:scale(0.5);opacity:0; } to { transform:scale(1);opacity:1; } }`}</style>
                    <h2 style={{ color: '#10b981', marginBottom: 8 }}>Obuka završena!</h2>
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
                <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
                <div style={{ ...containerStyle, maxWidth: 860 }}>
                    <Logo />

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
                            <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 700 }}>🎬 PREZENTACIJA</span>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#e2e8f0', margin: '0 0 8px' }}>
                            {session.trainingName || 'Obuka'}
                        </h1>
                        {assignedBy && <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: '0 0 4px' }}>👤 Dodijelio/la: <strong style={{ color: '#e2e8f0' }}>{assignedBy}</strong></p>}
                        {session.deadline && (
                            <p style={{ color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                                ⏰ Rok: {new Date(session.deadline).toLocaleDateString('hr-HR')}
                            </p>
                        )}
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', color: '#94a3b8' }}>
                            <span>Slajd {slideIdx + 1} od {slides.length}</span>
                            <span>{Math.round(progress)}% pregledano</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 3, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', transition: 'width 0.4s ease' }} />
                        </div>
                    </div>

                    {/* Slide card */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 20, padding: '40px 48px', marginBottom: 24, minHeight: 340,
                        position: 'relative', overflow: 'hidden',
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
                        <div style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: 1.9, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {currentSlide.sadrzaj || <span style={{ color: '#475569', fontStyle: 'italic' }}>(Slajd nema sadržaja)</span>}
                        </div>
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                            onClick={() => setSlideIdx(i => Math.max(0, i - 1))}
                            disabled={slideIdx === 0}
                            style={{ ...navBtnStyle, opacity: slideIdx === 0 ? 0.3 : 1 }}>
                            ← Prethodni
                        </button>

                        {/* Slide dots */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {slides.map((_, i) => (
                                <button key={i} onClick={() => setSlideIdx(i)}
                                    style={{ width: i === slideIdx ? 24 : 8, height: 8, borderRadius: 4, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: i === slideIdx ? '#6366f1' : i < slideIdx ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.15)' }} />
                            ))}
                        </div>

                        {isLast ? (
                            <button
                                onClick={() => { setPhase('quiz'); setQuizIdx(0); }}
                                style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
                                {questions.length > 0
                                    ? (Object.keys(answers).length > 0 ? '▶️ Nastavi test →' : '✅ Počni test →')
                                    : '✅ Završi prezentaciju'}
                            </button>
                        ) : (
                            <button
                                onClick={() => setSlideIdx(i => Math.min(slides.length - 1, i + 1))}
                                style={navBtnStyle}>
                                Sljedeći →
                            </button>
                        )}
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
                        <Logo />
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <Spinner size={52} />
                            <p style={{ color: '#94a3b8', marginTop: 20 }}>Završavanje obuke...</p>
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
                <div style={{ ...containerStyle, maxWidth: 720 }}>
                    <Logo />

                    {/* Header — back button only if officer enabled it */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 4 }}>
                                <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700 }}>❓ TEST ZNANJA</span>
                            </div>
                            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>{session.trainingName}</h1>
                        </div>
                        {dozvoliPovratak ? (
                            <button onClick={() => setPhase('slides')}
                                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                ← Vrati se na prezentaciju
                            </button>
                        ) : (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>Test se ne može prekinuti</div>
                        )}
                    </div>

                    {/* Progress */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', color: '#94a3b8' }}>
                            <span>Pitanje {quizIdx + 1} od {questions.length}</span>
                            <span>{answered} odgovoreno</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 3, background: 'linear-gradient(90deg,#f59e0b,#f97316)', transition: 'width 0.4s' }} />
                        </div>
                    </div>

                    {/* Question card */}
                    <div key={quizIdx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 36px', marginBottom: 20, animation: 'fadeSlide 0.25s ease' }}>
                        <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 12 }}>PITANJE {quizIdx + 1}</div>
                        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.5, margin: '0 0 24px' }}>
                            {currentQ?.pitanje || ''}
                        </p>

                        {/* Options */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(currentQ?.opcije || []).map((opt, oIdx) => {
                                const selected = answers[quizIdx] === oIdx;
                                return (
                                    <button key={oIdx} onClick={() => setAnswers(prev => ({ ...prev, [quizIdx]: oIdx }))}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                                            borderRadius: 12, border: `2px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
                                            background: selected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                                            color: '#e2e8f0', cursor: 'pointer', textAlign: 'left', fontSize: '0.92rem',
                                            transition: 'all 0.15s', fontFamily: 'inherit', width: '100%',
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
                        {isAnswered && currentQ?.objasnjenje && (
                            <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                                💡 {currentQ.objasnjenje}
                            </div>
                        )}
                    </div>

                    {/* Quiz navigation */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <button onClick={() => setQuizIdx(i => Math.max(0, i - 1))} disabled={quizIdx === 0}
                            style={{ ...navBtnStyle, opacity: quizIdx === 0 ? 0.3 : 1 }}>← Prethodno</button>

                        {/* Question dots */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', flex: 1 }}>
                            {questions.map((_, i) => (
                                <button key={i} onClick={() => setQuizIdx(i)}
                                    style={{
                                        width: 28, height: 28, borderRadius: 6, border: '1px solid',
                                        borderColor: i === quizIdx ? '#6366f1' : answers[i] !== undefined ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.12)',
                                        background: i === quizIdx ? '#6366f1' : answers[i] !== undefined ? 'rgba(99,102,241,0.15)' : 'transparent',
                                        color: i === quizIdx ? '#fff' : answers[i] !== undefined ? '#818cf8' : '#475569',
                                        cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                                    }}>
                                    {i + 1}
                                </button>
                            ))}
                        </div>

                        {isLastQ ? (
                            <button onClick={handleSubmitQuiz} disabled={submitting}
                                style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: submitting ? 0.7 : 1 }}>
                                {submitting ? <><Spinner size={14} /> Šaljem...</> : '✅ Predaj test'}
                            </button>
                        ) : (
                            <button onClick={() => setQuizIdx(i => Math.min(questions.length - 1, i + 1))} style={navBtnStyle}>
                                Sljedeće →
                            </button>
                        )}
                    </div>

                    {/* Submit from any question */}
                    {!isLastQ && Object.keys(answers).length === questions.length && (
                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <button onClick={handleSubmitQuiz} disabled={submitting}
                                style={{ padding: '12px 32px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                                ✅ Predaj test ({Object.keys(answers).length}/{questions.length} odgovoreno)
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
                    <Logo />

                    {/* Result hero */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ ...iconBox(grade.passed ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', 90), animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)', fontSize: '3rem', marginBottom: 20 }}>
                            {grade.passed ? '🏆' : '📚'}
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: grade.passed ? '#22c55e' : '#f05252', margin: '0 0 8px' }}>
                            {grade.passed ? 'Čestitamo! Prošli ste test!' : 'Niste prošli test'}
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
                                    {grade.correct} od {grade.total} tačnih odgovora · Prag prolaza: {prolazniPrag}%
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
                                                        <span style={{ color: '#f05252' }}>Vaš odgovor: {d.userAnswer >= 0 ? (questions[i].opcije?.[d.userAnswer] || `Opcija ${d.userAnswer + 1}`) : '(nije odgovoreno)'}</span>
                                                        <br />
                                                        <span style={{ color: '#22c55e' }}>Tačan odgovor: {questions[i].opcije?.[d.correctAnswer] || `Opcija ${d.correctAnswer + 1}`}</span>
                                                    </div>
                                                )}
                                                {d.isCorrect && questions[i]?.objasnjenje && (
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

                    {/* Review button */}
                    {!grade.passed && (
                        <div style={{ textAlign: 'center', marginTop: 24 }}>
                            <button onClick={() => { setPhase('slides'); setSlideIdx(0); }}
                                style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                                📖 Pregledaj prezentaciju ponovo
                            </button>
                        </div>
                    )}

                    <div style={{ textAlign: 'center', marginTop: 24, color: '#475569', fontSize: '0.85rem' }}>
                        Možete zatvoriti ovu stranicu.
                    </div>

                    <Footer />
                </div>
            </div>
        );
    }

    return null;
}

// ─── Shared UI Components ────────────────────────────────────────────────────

function Logo() {
    return (
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img src="/transparentlogo.png" alt="eZNR" style={{ height: 56, maxWidth: 200, objectFit: 'contain' }} />
        </div>
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

function Footer() {
    return (
        <div style={{ textAlign: 'center', padding: '32px 0 16px', color: '#475569', fontSize: '0.75rem' }}>
            Powered by <span style={{ color: '#6366f1', fontWeight: 600 }}>eZNR</span> — Zaštita na radu
        </div>
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

const containerStyle = { maxWidth: 800, margin: '0 auto', padding: '40px 20px', position: 'relative', zIndex: 1 };

const navBtnStyle = {
    padding: '9px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', cursor: 'pointer',
    fontSize: '0.88rem', fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit',
};
