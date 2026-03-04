'use client';
import { useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════
   Public Questionnaire Form — Renders a questionnaire
   for external workers to fill out (no login required)
   ═══════════════════════════════════════════════════════ */

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

export default function PublicQuestionnaireForm({ surveyJson, questionnaireName, onSubmit, submitting }) {
    const [answers, setAnswers] = useState({});
    const [errors, setErrors] = useState({});

    // Parse survey JSON
    let questions = [];
    try {
        const parsed = typeof surveyJson === 'string' ? JSON.parse(surveyJson) : surveyJson;
        if (parsed?.pages?.[0]?.elements) {
            questions = parsed.pages[0].elements;
        } else if (Array.isArray(parsed)) {
            questions = parsed;
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
            if (q.isRequired) {
                const val = answers[q.id || q.name];
                if (!val || (Array.isArray(val) && val.length === 0) || val === '') {
                    newErrors[q.id || q.name] = 'Ovo polje je obavezno';
                }
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Scroll to first error
            const firstErrorId = Object.keys(newErrors)[0];
            document.getElementById(`q-${firstErrorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        onSubmit?.(answers);
    };

    if (questions.length === 0) {
        return (
            <div style={{
                textAlign: 'center', padding: '60px 20px',
                color: '#94a3b8',
            }}>
                <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
                <p style={{ fontSize: '1.1rem' }}>Ovaj upitnik nema pitanja.</p>
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
                            {q.isRequired && (
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

                            {q.type === 'yesno' && (
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
