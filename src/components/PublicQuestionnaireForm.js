'use client';
import { useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════
   Public Questionnaire Form — Renders a questionnaire
   for external workers to fill out (no login required)
   ═══════════════════════════════════════════════════════ */

// Calculate grade from answers vs correct answers in questions
function calculateGrade(questions, answers) {
    const gradeable = questions.filter(q =>
        q.correctAnswer != null &&
        q.correctAnswer !== '' &&
        (Array.isArray(q.correctAnswer) ? q.correctAnswer.length > 0 : true)
    );
    if (gradeable.length === 0) return null; // no grading defined

    let correct = 0;
    const details = gradeable.map(q => {
        const qId = q.id || q.name;
        const given = answers[qId];
        let isCorrect = false;

        if (Array.isArray(q.correctAnswer)) {
            // checkbox: both arrays must match (order-independent)
            const givenArr = Array.isArray(given) ? given : [];
            isCorrect = q.correctAnswer.length === givenArr.length &&
                q.correctAnswer.every(a => givenArr.includes(a));
        } else {
            isCorrect = String(given || '').trim() === String(q.correctAnswer).trim();
        }

        if (isCorrect) correct++;
        return { qId, title: q.title || q.name, isCorrect, given, correct: q.correctAnswer };
    });

    const percentage = Math.round((correct / gradeable.length) * 100);
    return { correct, total: gradeable.length, percentage, details };
}

const QUESTION_TYPE_LABELS = {
    text: 'Tekst',
    textarea: 'Komentar',
    radio: 'Odabir',
    checkbox: 'Višestruki odabir',
    dropdown: 'Padajući izbornik',
    number: 'Numeričko polje',
    date: 'Datum',
    rating: 'Ocjena',
    yesno: 'Da/Ne',
    heading: 'Naslov',
    html: 'HTML',
};

export default function PublicQuestionnaireForm({ surveyJson, questionnaireName, onSubmit, submitting, prolazniPrag = 70, prikaziRezultate = true }) {
    const [answers, setAnswers] = useState({});
    const [errors, setErrors] = useState({});
    const [gradeResult, setGradeResult] = useState(null); // shown after submit if grading is set

    // Parse survey JSON — handles our native format { questions: [] }
    // and legacy SurveyJS format { pages: [{ elements: [] }] }
    let questions = [];
    try {
        const parsed = typeof surveyJson === 'string' ? JSON.parse(surveyJson) : surveyJson;
        if (Array.isArray(parsed)) {
            questions = parsed; // plain array
        } else if (parsed?.questions) {
            questions = parsed.questions; // our native format
        } else if (parsed?.pages?.[0]?.elements) {
            questions = parsed.pages[0].elements; // SurveyJS format
        }
    } catch {
        questions = [];
    }

    const setAnswer = useCallback((questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
        setErrors(prev => {
            const next = { ...prev };
            delete next[questionId];
            return next;
        });
    }, []);

    const toggleCheckboxAnswer = useCallback((questionId, choice) => {
        setAnswers(prev => {
            const current = prev[questionId] || [];
            if (current.includes(choice)) {
                return { ...prev, [questionId]: current.filter(c => c !== choice) };
            }
            return { ...prev, [questionId]: [...current, choice] };
        });
        setErrors(prev => {
            const next = { ...prev };
            delete next[questionId];
            return next;
        });
    }, []);

    const handleSubmit = () => {
        // Validate required fields
        const newErrors = {};
        questions.forEach(q => {
            if (q.type === 'heading' || q.type === 'html') return;
            if (q.isRequired || q.required) {
                const val = answers[q.id || q.name];
                if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
                    newErrors[q.id || q.name] = 'Ovo polje je obavezno';
                }
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            const firstErrorId = Object.keys(newErrors)[0];
            document.getElementById(`q-${firstErrorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Calculate grade if questions have correctAnswer set
        const grade = calculateGrade(questions, answers);

        // If grading is defined and we want to show results, show score screen first
        if (grade !== null && prikaziRezultate) {
            const passed = grade.percentage >= (prolazniPrag ?? 70);
            setGradeResult({ ...grade, passed, prolazniPrag: prolazniPrag ?? 70 });
        }

        // Always submit with grade info attached
        onSubmit?.(answers, grade);
    };

    // ─── Grade result screen ─────────────────────────────────────────────────
    if (gradeResult) {
        const { percentage, correct, total, passed, prolazniPrag: threshold, details } = gradeResult;
        const passColor = passed ? '#10b981' : '#ef4444';
        const passBg = passed ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)';
        return (
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: '20px 0 40px' }}>
                {/* Big score circle */}
                <div style={{
                    width: 140, height: 140, borderRadius: '50%',
                    border: `6px solid ${passColor}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                    background: passBg,
                    boxShadow: `0 0 32px ${passColor}30`,
                    animation: 'popIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)',
                }}>
                    <style>{`@keyframes popIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: passColor }}>{percentage}%</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{correct}/{total}</span>
                </div>

                {/* Pass / Fail badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 24px', borderRadius: 30,
                    background: passBg, border: `1px solid ${passColor}40`,
                    color: passColor, fontWeight: 700, fontSize: '1rem',
                    marginBottom: 8,
                }}>
                    {passed ? '✅ Položeno' : '❌ Nije položeno'}
                </div>

                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '6px 0 28px' }}>
                    Prag prolaza: {threshold}% — {passed ? 'Čestitamo!' : 'Nažalost, niste dosegli prag prolaza.'}
                </p>

                {/* Per-question breakdown */}
                <div style={{ textAlign: 'left' }}>
                    {details.map((d, i) => (
                        <div key={i} style={{
                            padding: '12px 16px', marginBottom: 8, borderRadius: 10,
                            background: d.isCorrect ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                            border: `1px solid ${d.isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            display: 'flex', alignItems: 'flex-start', gap: 12,
                        }}>
                            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{d.isCorrect ? '✅' : '❌'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#e2e8f0', marginBottom: 2 }}>
                                    {d.title}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                    Vaš odgovor: <span style={{ color: d.isCorrect ? '#10b981' : '#ef4444' }}>
                                        {Array.isArray(d.given) ? d.given.join(', ') : (d.given || '—')}
                                    </span>
                                    {!d.isCorrect && (
                                        <> · Tačan: <span style={{ color: '#10b981' }}>
                                            {Array.isArray(d.correct) ? d.correct.join(', ') : d.correct}
                                        </span></>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {questions.map((q, idx) => {
                const qId = q.id || q.name || `q_${idx}`;
                const hasError = !!errors[qId];

                // HEADING
                if (q.type === 'heading') {
                    return (
                        <div key={qId} style={{
                            marginBottom: 24, marginTop: idx > 0 ? 32 : 0,
                            borderBottom: '2px solid rgba(99,102,241,0.3)',
                            paddingBottom: 8,
                        }}>
                            <h3 style={{
                                fontSize: '1.15rem', fontWeight: 700,
                                color: '#6366f1', margin: 0,
                            }}>
                                {q.title || q.text || ''}
                            </h3>
                            {q.description && (
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0' }}>
                                    {q.description}
                                </p>
                            )}
                        </div>
                    );
                }

                // HTML
                if (q.type === 'html') {
                    return (
                        <div key={qId} style={{ marginBottom: 24 }}
                            dangerouslySetInnerHTML={{ __html: q.html || q.content || '' }}
                        />
                    );
                }

                return (
                    <div key={qId} id={`q-${qId}`} style={{
                        marginBottom: 24, padding: '20px 24px',
                        background: hasError
                            ? 'rgba(239,68,68,0.05)'
                            : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${hasError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 12,
                        transition: 'all 0.2s',
                    }}>
                        {/* Question label */}
                        <label style={{
                            display: 'block', fontWeight: 600,
                            fontSize: '0.95rem', color: '#e2e8f0',
                            marginBottom: 8,
                        }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center',
                                justifyContent: 'center', width: 24, height: 24,
                                borderRadius: 6, background: 'rgba(99,102,241,0.15)',
                                color: '#818cf8', fontSize: '0.75rem', fontWeight: 700,
                                marginRight: 8,
                            }}>
                                {idx + 1}
                            </span>
                            {q.title || q.text || `Pitanje ${idx + 1}`}
                            {(q.isRequired || q.required) && (
                                <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>
                            )}
                        </label>

                        {q.description && (
                            <p style={{
                                fontSize: '0.8rem', color: '#94a3b8',
                                margin: '0 0 12px 32px',
                            }}>
                                {q.description}
                            </p>
                        )}

                        {/* Input by type */}
                        <div style={{ marginLeft: 32 }}>
                            {q.type === 'text' && (
                                <input
                                    type="text"
                                    value={answers[qId] || ''}
                                    onChange={e => setAnswer(qId, e.target.value)}
                                    placeholder="Unesite odgovor..."
                                    style={inputStyle}
                                />
                            )}

                            {q.type === 'textarea' && (
                                <textarea
                                    value={answers[qId] || ''}
                                    onChange={e => setAnswer(qId, e.target.value)}
                                    placeholder="Unesite odgovor..."
                                    rows={4}
                                    style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                                />
                            )}

                            {q.type === 'number' && (
                                <input
                                    type="number"
                                    value={answers[qId] || ''}
                                    onChange={e => setAnswer(qId, e.target.value)}
                                    placeholder="0"
                                    style={{ ...inputStyle, maxWidth: 200 }}
                                />
                            )}

                            {q.type === 'date' && (
                                <input
                                    type="date"
                                    value={answers[qId] || ''}
                                    onChange={e => setAnswer(qId, e.target.value)}
                                    style={{ ...inputStyle, maxWidth: 220 }}
                                />
                            )}

                            {q.type === 'radio' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {(q.choices || []).map((choice, ci) => (
                                        <label key={ci} style={radioLabelStyle}>
                                            <input
                                                type="radio"
                                                name={`radio-${qId}`}
                                                value={typeof choice === 'string' ? choice : choice.value}
                                                checked={answers[qId] === (typeof choice === 'string' ? choice : choice.value)}
                                                onChange={e => setAnswer(qId, e.target.value)}
                                                style={{ accentColor: '#6366f1' }}
                                            />
                                            <span>{typeof choice === 'string' ? choice : choice.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {q.type === 'checkbox' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {(q.choices || []).map((choice, ci) => {
                                        const val = typeof choice === 'string' ? choice : choice.value;
                                        return (
                                            <label key={ci} style={radioLabelStyle}>
                                                <input
                                                    type="checkbox"
                                                    checked={(answers[qId] || []).includes(val)}
                                                    onChange={() => toggleCheckboxAnswer(qId, val)}
                                                    style={{ accentColor: '#6366f1' }}
                                                />
                                                <span>{typeof choice === 'string' ? choice : choice.text}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {q.type === 'dropdown' && (
                                <select
                                    value={answers[qId] || ''}
                                    onChange={e => setAnswer(qId, e.target.value)}
                                    style={{ ...inputStyle, cursor: 'pointer' }}
                                >
                                    <option value="">— Odaberite —</option>
                                    {(q.choices || []).map((choice, ci) => (
                                        <option key={ci} value={typeof choice === 'string' ? choice : choice.value}>
                                            {typeof choice === 'string' ? choice : choice.text}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {q.type === 'rating' && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setAnswer(qId, star)}
                                            style={{
                                                fontSize: '1.6rem',
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                opacity: (answers[qId] || 0) >= star ? 1 : 0.3,
                                                transition: 'all 0.15s',
                                                transform: (answers[qId] || 0) >= star ? 'scale(1.15)' : 'scale(1)',
                                            }}
                                        >
                                            ⭐
                                        </button>
                                    ))}
                                </div>
                            )}

                            {(q.type === 'yesno' || q.type === 'boolean') && (
                                <div style={{ display: 'flex', gap: 12 }}>
                                    {['Da', 'Ne'].map(opt => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setAnswer(qId, opt)}
                                            style={{
                                                padding: '10px 28px',
                                                borderRadius: 8,
                                                border: answers[qId] === opt
                                                    ? '2px solid #6366f1'
                                                    : '2px solid rgba(255,255,255,0.1)',
                                                background: answers[qId] === opt
                                                    ? 'rgba(99,102,241,0.15)'
                                                    : 'rgba(255,255,255,0.03)',
                                                color: answers[qId] === opt ? '#818cf8' : '#94a3b8',
                                                fontWeight: 600,
                                                fontSize: '0.95rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {opt === 'Da' ? '✅ Da' : '❌ Ne'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Error message */}
                        {hasError && (
                            <p style={{
                                color: '#ef4444', fontSize: '0.8rem',
                                margin: '8px 0 0 32px', fontWeight: 500,
                            }}>
                                ⚠️ {errors[qId]}
                            </p>
                        )}
                    </div>
                );
            })}

            {/* Submit button */}
            <div style={{ textAlign: 'center', padding: '24px 0 40px' }}>
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                        padding: '14px 48px',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        borderRadius: 12,
                        border: 'none',
                        cursor: submitting ? 'wait' : 'pointer',
                        background: submitting
                            ? 'rgba(99,102,241,0.3)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        boxShadow: submitting
                            ? 'none'
                            : '0 4px 20px rgba(99,102,241,0.4)',
                        transition: 'all 0.3s',
                        letterSpacing: '0.02em',
                    }}
                >
                    {submitting ? '⏳ Slanje...' : '📤 Pošalji odgovore'}
                </button>
            </div>
        </div>
    );
}


// ─── Reusable styles ─────────────────────────────────────────────────────────

const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    fontSize: '0.92rem',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#e2e8f0',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
};

const radioLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: 8,
    transition: 'background 0.15s',
    fontSize: '0.9rem',
    color: '#cbd5e1',
};
