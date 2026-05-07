'use client';
import { useState, useCallback, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════
   Custom Questionnaire Builder
   A drag-and-drop-like survey creator that works in production
   ═══════════════════════════════════════════════════════ */

const QUESTION_TYPES = [
    { type: 'text', icon: '📝', label: 'Tekst polje', labelEn: 'Text Input' },
    { type: 'textarea', icon: '📄', label: 'Komentar', labelEn: 'Comment' },
    { type: 'radio', icon: '🔘', label: 'Radiogumb', labelEn: 'Radio Group' },
    { type: 'checkbox', icon: '☑️', label: 'Potvrdni okvir', labelEn: 'Checkbox' },
    { type: 'dropdown', icon: '📋', label: 'Padajući izbornik', labelEn: 'Dropdown' },
    { type: 'rating', icon: '⭐', label: 'Ocjena', labelEn: 'Rating' },
    { type: 'boolean', icon: '✅', label: 'Da/Ne', labelEn: 'Yes/No' },
    { type: 'date', icon: '📅', label: 'Datum', labelEn: 'Date' },
    { type: 'number', icon: '🔢', label: 'Broj', labelEn: 'Number' },
    { type: 'file', icon: '📎', label: 'Prilog', labelEn: 'File Upload' },
    { type: 'heading', icon: '🏷️', label: 'Naslov/Sekcija', labelEn: 'Heading/Section' },
    { type: 'html', icon: '🌐', label: 'HTML sadržaj', labelEn: 'HTML Content' },
];

// Types that support automatic grading
const GRADEABLE_TYPES = ['radio', 'checkbox', 'dropdown', 'boolean'];

const createQuestion = (type) => ({
    id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type,
    title: '',
    description: '',
    required: false,
    choices: type === 'radio' || type === 'checkbox' || type === 'dropdown'
        ? ['Opcija 1', 'Opcija 2', 'Opcija 3']
        : [],
    correctAnswer: null, // null = not graded; string or array = graded
    ratingMax: type === 'rating' ? 5 : undefined,
    placeholder: '',
    htmlContent: type === 'html' ? '<p>Vaš HTML sadržaj ovdje</p>' : undefined,
});

export default function QuestionnaireBuilder({ json, onJsonChange, lang = 'bs' }) {
    // Parse questions from JSON
    const parseQuestions = useCallback(() => {
        try {
            const parsed = typeof json === 'string' ? JSON.parse(json || '{}') : (json || {});
            // Native builder format
            if (parsed.questions && parsed.questions.length > 0) return parsed.questions;
            // SurveyJS format from AI (pages → elements)
            if (parsed.pages && Array.isArray(parsed.pages)) {
                const converted = [];
                parsed.pages.forEach(page => {
                    // Add page title as heading
                    if (page.title) {
                        converted.push({
                            id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                            type: 'heading', title: page.title, description: '', required: false, choices: [],
                        });
                    }
                    (page.elements || []).forEach(el => {
                        // Map SurveyJS types → builder types
                        const typeMap = { radiogroup: 'radio', comment: 'textarea', text: 'text', checkbox: 'checkbox', rating: 'rating', boolean: 'boolean', dropdown: 'dropdown' };
                        const builderType = typeMap[el.type] || el.type || 'text';
                        converted.push({
                            id: el.name || 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                            type: builderType,
                            title: el.title || '',
                            description: el.description || '',
                            required: el.isRequired || false,
                            choices: (el.choices || []).map(c => typeof c === 'string' ? c : (c.text || c.value || '')),
                            correctAnswer: null,
                            ratingMax: builderType === 'rating' ? (el.rateMax || 5) : undefined,
                            placeholder: el.placeholder || '',
                        });
                    });
                });
                return converted;
            }
            return [];
        } catch { return []; }
    }, [json]);

    const [questions, setQuestions] = useState(parseQuestions);
    const [selectedId, setSelectedId] = useState(null);
    const [activeTab, setActiveTab] = useState('designer'); // designer | preview | json

    useEffect(() => {
        setQuestions(parseQuestions());
    }, [json, parseQuestions]);

    const saveQuestions = useCallback((updatedQuestions) => {
        setQuestions(updatedQuestions);
        if (onJsonChange) {
            onJsonChange(JSON.stringify({ questions: updatedQuestions }, null, 2));
        }
    }, [onJsonChange]);

    // Add question
    const addQuestion = (type) => {
        const newQ = createQuestion(type);
        const updated = [...questions, newQ];
        saveQuestions(updated);
        setSelectedId(newQ.id);
    };

    // Remove question
    const removeQuestion = (id) => {
        saveQuestions(questions.filter(q => q.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    // Update question
    const updateQuestion = (id, field, value) => {
        saveQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    // Move question up/down
    const moveQuestion = (id, direction) => {
        const idx = questions.findIndex(q => q.id === id);
        if ((direction === -1 && idx === 0) || (direction === 1 && idx === questions.length - 1)) return;
        const updated = [...questions];
        [updated[idx], updated[idx + direction]] = [updated[idx + direction], updated[idx]];
        saveQuestions(updated);
    };

    // Duplicate question
    const duplicateQuestion = (id) => {
        const idx = questions.findIndex(q => q.id === id);
        const newQ = { ...questions[idx], id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) };
        const updated = [...questions];
        updated.splice(idx + 1, 0, newQ);
        saveQuestions(updated);
        setSelectedId(newQ.id);
    };

    // Choice management
    const addChoice = (qId) => {
        const q = questions.find(q => q.id === qId);
        updateQuestion(qId, 'choices', [...(q.choices || []), `Opcija ${(q.choices || []).length + 1}`]);
    };
    const updateChoice = (qId, index, value) => {
        const q = questions.find(q => q.id === qId);
        const updated = [...(q.choices || [])];
        updated[index] = value;
        updateQuestion(qId, 'choices', updated);
    };
    const removeChoice = (qId, index) => {
        const q = questions.find(q => q.id === qId);
        updateQuestion(qId, 'choices', (q.choices || []).filter((_, i) => i !== index));
    };

    const selectedQuestion = questions.find(q => q.id === selectedId);
    const getTypeLabel = (type) => {
        const t = QUESTION_TYPES.find(qt => qt.type === type);
        return t ? (lang !== 'en' ? t.label : t.labelEn) : type;
    };
    const getTypeIcon = (type) => {
        const t = QUESTION_TYPES.find(qt => qt.type === type);
        return t ? t.icon : '❓';
    };

    const tabSt = (key) => ({
        padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
        borderBottom: activeTab === key ? '3px solid var(--primary)' : '3px solid transparent',
        color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
        background: 'none', border: 'none',
    });

    return (
        <div>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border-light)', padding: '0 16px' }}>
                <button style={tabSt('designer')} onClick={() => setActiveTab('designer')}>
                    📝 {lang !== 'en' ? 'Uređivač' : 'Designer'}
                </button>
                <button style={tabSt('preview')} onClick={() => setActiveTab('preview')}>
                    ▶ {lang !== 'en' ? 'Pregled' : 'Preview'}
                </button>
                <button style={tabSt('json')} onClick={() => setActiveTab('json')}>
                    {'{ }'} JSON
                </button>
            </div>

            {/* ═══ DESIGNER TAB ═══ */}
            {activeTab === 'designer' && (
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', minHeight: 450 }}>
                    {/* LEFT: Toolbox */}
                    <div style={{ borderRight: '1px solid var(--border-light)', padding: 12, overflowY: 'auto', maxHeight: 600 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                            {lang !== 'en' ? 'Alatna traka' : 'Toolbox'}
                        </div>
                        {QUESTION_TYPES.map(qt => (
                            <button key={qt.type} onClick={() => addQuestion(qt.type)} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                                background: 'var(--bg-input)', border: '1px solid var(--border-light)',
                                borderRadius: 'var(--radius-sm)', cursor: 'pointer', width: '100%',
                                marginBottom: 6, fontSize: '0.82rem', fontWeight: 500,
                                color: 'var(--text)', transition: 'all 0.15s',
                            }}
                                onMouseEnter={e => { e.target.style.background = 'var(--primary)'; e.target.style.color = '#fff'; }}
                                onMouseLeave={e => { e.target.style.background = 'var(--bg-input)'; e.target.style.color = 'var(--text)'; }}
                            >
                                <span style={{ fontSize: '1rem' }}>{qt.icon}</span>
                                {lang !== 'en' ? qt.label : qt.labelEn}
                            </button>
                        ))}
                    </div>

                    {/* CENTER: Canvas */}
                    <div style={{ padding: 16, overflowY: 'auto', maxHeight: 600, background: 'var(--bg-input)' }}>
                        {questions.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12, color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', opacity: 0.3 }}>📝</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                                    {lang !== 'en' ? 'Kliknite na pitanje iz alatne trake za dodavanje' : 'Click a question from the toolbar to add'}
                                </div>
                            </div>
                        ) : questions.map((q, idx) => (
                            <div key={q.id} onClick={() => setSelectedId(q.id)} style={{
                                padding: 16, marginBottom: 10, borderRadius: 'var(--radius-md)',
                                border: selectedId === q.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                                background: 'var(--bg-card)', cursor: 'pointer',
                                boxShadow: selectedId === q.id ? '0 0 0 3px rgba(0,200,150,0.15)' : 'none',
                                transition: 'all 0.15s',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>Q{idx + 1}</span>
                                    <span style={{ fontSize: '0.9rem' }}>{getTypeIcon(q.type)}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{getTypeLabel(q.type)}</span>
                                    {q.required && <span style={{ fontSize: '0.7rem', background: 'var(--danger)', color: '#fff', padding: '1px 6px', borderRadius: 10 }}>*</span>}
                                    {GRADEABLE_TYPES.includes(q.type) && q.correctAnswer != null && q.correctAnswer !== '' && (
                                        <span title={lang !== 'en' ? 'Tačan odgovor postavljen' : 'Correct answer set'}
                                            style={{ fontSize: '0.7rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                                            ✓
                                        </span>
                                    )}
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                        <button onClick={e => { e.stopPropagation(); moveQuestion(q.id, -1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 2 }}>⬆</button>
                                        <button onClick={e => { e.stopPropagation(); moveQuestion(q.id, 1); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 2 }}>⬇</button>
                                        <button onClick={e => { e.stopPropagation(); duplicateQuestion(q.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 2 }}>📋</button>
                                        <button onClick={e => { e.stopPropagation(); removeQuestion(q.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: 2, color: 'var(--danger)' }}>✖</button>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: q.title ? 'var(--text)' : 'var(--text-muted)' }}>
                                    {q.title || (lang !== 'en' ? 'Unesite naslov pitanja...' : 'Enter question title...')}
                                </div>
                                {q.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{q.description}</div>}
                                {q.imageUrl && <img src={q.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 6, marginTop: 6, objectFit: 'contain', border: '1px solid var(--border-light)' }} />}

                                {/* Preview of choices */}
                                {(q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown') && q.choices && (
                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {q.choices.slice(0, 4).map((c, ci) => (
                                            <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                {q.type === 'radio' ? '○' : q.type === 'checkbox' ? '☐' : '•'} {c}
                                            </div>
                                        ))}
                                        {q.choices.length > 4 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{q.choices.length - 4} more</div>}
                                    </div>
                                )}
                                {q.type === 'rating' && (
                                    <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                                        {Array.from({ length: q.ratingMax || 5 }, (_, i) => (
                                            <span key={i} style={{ fontSize: '1.1rem', opacity: 0.4 }}>⭐</span>
                                        ))}
                                    </div>
                                )}
                                {q.type === 'boolean' && (
                                    <div style={{ marginTop: 8, display: 'flex', gap: 10, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                        <span>○ {lang !== 'en' ? 'Da' : 'Yes'}</span>
                                        <span>○ {lang !== 'en' ? 'Ne' : 'No'}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* RIGHT: Properties Panel */}
                    <div style={{ borderLeft: '1px solid var(--border-light)', padding: 14, overflowY: 'auto', maxHeight: 600 }}>
                        {selectedQuestion ? (
                            <>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                                    {lang !== 'en' ? 'Svojstva pitanja' : 'Question Properties'}
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                                        {lang !== 'en' ? 'NASLOV' : 'TITLE'}
                                    </div>
                                    <input className="form-input" value={selectedQuestion.title}
                                        onChange={e => updateQuestion(selectedId, 'title', e.target.value)}
                                        placeholder={lang !== 'en' ? 'Naslov pitanja' : 'Question title'} />
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                                        {lang !== 'en' ? 'OPIS' : 'DESCRIPTION'}
                                    </div>
                                    <input className="form-input" value={selectedQuestion.description}
                                        onChange={e => updateQuestion(selectedId, 'description', e.target.value)}
                                        placeholder={lang !== 'en' ? 'Opis (opcionalno)' : 'Description (optional)'} />
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={selectedQuestion.required}
                                            onChange={e => updateQuestion(selectedId, 'required', e.target.checked)} />
                                        {lang !== 'en' ? 'Obavezno' : 'Required'}
                                    </label>
                                </div>

                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                                        🖼️ {lang !== 'en' ? 'SLIKA (URL)' : 'IMAGE (URL)'}
                                    </div>
                                    <input className="form-input" value={selectedQuestion.imageUrl || ''}
                                        onChange={e => updateQuestion(selectedId, 'imageUrl', e.target.value || null)}
                                        placeholder={lang !== 'en' ? 'https://... ili ostavite prazno' : 'https://... or leave empty'}
                                        style={{ fontSize: '0.82rem' }} />
                                    {selectedQuestion.imageUrl && (
                                        <img src={selectedQuestion.imageUrl} alt="" style={{
                                            maxWidth: '100%', maxHeight: 120, borderRadius: 8,
                                            border: '1px solid var(--border-light)',
                                            objectFit: 'contain', marginTop: 6,
                                        }} />
                                    )}
                                </div>

                                {selectedQuestion.type === 'text' && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>PLACEHOLDER</div>
                                        <input className="form-input" value={selectedQuestion.placeholder || ''}
                                            onChange={e => updateQuestion(selectedId, 'placeholder', e.target.value)} />
                                    </div>
                                )}

                                {selectedQuestion.type === 'rating' && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                                            {lang !== 'en' ? 'MAX OCJENA' : 'MAX RATING'}
                                        </div>
                                        <input className="form-input" type="number" min={2} max={10}
                                            value={selectedQuestion.ratingMax || 5}
                                            onChange={e => updateQuestion(selectedId, 'ratingMax', parseInt(e.target.value) || 5)} />
                                    </div>
                                )}

                                {selectedQuestion.type === 'html' && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>HTML</div>
                                        <textarea className="form-input" rows={4} value={selectedQuestion.htmlContent || ''}
                                            onChange={e => updateQuestion(selectedId, 'htmlContent', e.target.value)}
                                            style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                                    </div>
                                )}

                                {/* Choices editor for radio/checkbox/dropdown */}
                                {(selectedQuestion.type === 'radio' || selectedQuestion.type === 'checkbox' || selectedQuestion.type === 'dropdown') && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                            {lang !== 'en' ? 'OPCIJE' : 'CHOICES'}
                                        </div>
                                        {(selectedQuestion.choices || []).map((choice, ci) => (
                                            <div key={ci} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                                                <input className="form-input" value={choice}
                                                    onChange={e => updateChoice(selectedId, ci, e.target.value)}
                                                    style={{ flex: 1, fontSize: '0.82rem', padding: '4px 8px' }} />
                                                <button onClick={() => removeChoice(selectedId, ci)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '0.8rem', padding: 2 }}>✖</button>
                                            </div>
                                        ))}
                                        <button onClick={() => addChoice(selectedId)}
                                            style={{ fontSize: '0.78rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '4px 0' }}>
                                            + {lang !== 'en' ? 'Dodaj opciju' : 'Add choice'}
                                        </button>
                                    </div>
                                )}

                                {/* ── Correct answer (for grading) ── */}
                                {GRADEABLE_TYPES.includes(selectedQuestion.type) && (
                                    <div style={{
                                        marginBottom: 10, marginTop: 14,
                                        padding: '10px 12px',
                                        background: 'rgba(16,185,129,0.06)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        borderRadius: 8,
                                    }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            ✅ {lang !== 'en' ? 'Tačan odgovor' : 'Correct answer'}
                                        </div>

                                        {/* radio / dropdown — single correct answer */}
                                        {(selectedQuestion.type === 'radio' || selectedQuestion.type === 'dropdown') && (
                                            <select className="form-select"
                                                value={selectedQuestion.correctAnswer || ''}
                                                onChange={e => updateQuestion(selectedId, 'correctAnswer', e.target.value || null)}
                                                style={{ fontSize: '0.82rem' }}
                                            >
                                                <option value="">{lang !== 'en' ? '— Nije postavljeno (ne ocjenjuje se) —' : '— Not set (not graded) —'}</option>
                                                {(selectedQuestion.choices || []).map((c, ci) => (
                                                    <option key={ci} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        )}

                                        {/* checkbox — multiple correct answers */}
                                        {selectedQuestion.type === 'checkbox' && (
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                                                    {lang !== 'en' ? 'Odaberite sve tačne odgovore:' : 'Select all correct answers:'}
                                                </div>
                                                {(selectedQuestion.choices || []).map((c, ci) => {
                                                    const currentCorrect = Array.isArray(selectedQuestion.correctAnswer) ? selectedQuestion.correctAnswer : [];
                                                    const isChecked = currentCorrect.includes(c);
                                                    return (
                                                        <label key={ci} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, cursor: 'pointer', fontSize: '0.82rem' }}>
                                                            <input type="checkbox" checked={isChecked}
                                                                style={{ accentColor: '#10b981' }}
                                                                onChange={() => {
                                                                    const updated = isChecked
                                                                        ? currentCorrect.filter(x => x !== c)
                                                                        : [...currentCorrect, c];
                                                                    updateQuestion(selectedId, 'correctAnswer', updated.length > 0 ? updated : null);
                                                                }} />
                                                            {c}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* boolean — Da or Ne */}
                                        {selectedQuestion.type === 'boolean' && (
                                            <select className="form-select"
                                                value={selectedQuestion.correctAnswer ?? ''}
                                                onChange={e => updateQuestion(selectedId, 'correctAnswer', e.target.value === '' ? null : e.target.value)}
                                                style={{ fontSize: '0.82rem' }}
                                            >
                                                <option value="">{lang !== 'en' ? '— Nije postavljeno —' : '— Not set —'}</option>
                                                <option value="Da">✅ Da</option>
                                                <option value="Ne">❌ Ne</option>
                                            </select>
                                        )}

                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                            {lang !== 'en'
                                                ? 'Pitanja bez tačnog odgovora ne ulaze u ocjenu.'
                                                : 'Questions without a correct answer are not graded.'}
                                        </div>
                                    </div>
                                )}

                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 16, borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
                                    {lang !== 'en' ? 'Tip' : 'Type'}: {getTypeLabel(selectedQuestion.type)} · ID: {selectedQuestion.id}
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '1.5rem', opacity: 0.3 }}>👈</div>
                                <div style={{ fontSize: '0.82rem', textAlign: 'center' }}>
                                    {lang !== 'en' ? 'Odaberite pitanje za uređivanje' : 'Select a question to edit'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ PREVIEW TAB ═══ */}
            {activeTab === 'preview' && (
                <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
                    {questions.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                            {lang !== 'en' ? 'Nema pitanja za pregled. Dodajte pitanja u uređivaču.' : 'No questions to preview. Add questions in the designer.'}
                        </div>
                    ) : questions.map((q, idx) => (
                        <div key={q.id} style={{ marginBottom: 24 }}>
                            {q.type === 'heading' ? (
                                <h3 style={{ color: 'var(--primary)', borderBottom: '2px solid var(--primary)', paddingBottom: 8 }}>
                                    {q.title || `Section ${idx + 1}`}
                                </h3>
                            ) : q.type === 'html' ? (
                                <div dangerouslySetInnerHTML={{ __html: q.htmlContent || '' }} />
                            ) : (
                                <>
                                    <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.92rem' }}>
                                        {idx + 1}. {q.title || (lang !== 'en' ? 'Bez naslova' : 'Untitled')}
                                        {q.required && <span style={{ color: 'var(--danger)', marginLeft: 4 }}>*</span>}
                                    </div>
                                    {q.description && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 8 }}>{q.description}</div>}

                                    {q.type === 'text' && <input className="form-input" placeholder={q.placeholder} readOnly />}
                                    {q.type === 'textarea' && <textarea className="form-input" rows={3} readOnly />}
                                    {q.type === 'number' && <input className="form-input" type="number" readOnly />}
                                    {q.type === 'date' && <input className="form-input" type="date" readOnly />}
                                    {q.type === 'file' && <input type="file" disabled style={{ fontSize: '0.85rem' }} />}
                                    {q.type === 'radio' && (q.choices || []).map((c, ci) => (
                                        <label key={ci} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                                            <input type="radio" name={q.id} disabled /> {c}
                                        </label>
                                    ))}
                                    {q.type === 'checkbox' && (q.choices || []).map((c, ci) => (
                                        <label key={ci} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                                            <input type="checkbox" disabled /> {c}
                                        </label>
                                    ))}
                                    {q.type === 'dropdown' && (
                                        <select className="form-select" disabled>
                                            <option>{lang !== 'en' ? '— Odaberite —' : '— Select —'}</option>
                                            {(q.choices || []).map((c, ci) => <option key={ci}>{c}</option>)}
                                        </select>
                                    )}
                                    {q.type === 'rating' && (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {Array.from({ length: q.ratingMax || 5 }, (_, i) => (
                                                <span key={i} style={{ fontSize: '1.5rem', cursor: 'pointer', opacity: 0.3 }}>⭐</span>
                                            ))}
                                        </div>
                                    )}
                                    {q.type === 'boolean' && (
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                                <input type="radio" name={q.id} disabled /> {lang !== 'en' ? 'Da' : 'Yes'}
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                                <input type="radio" name={q.id} disabled /> {lang !== 'en' ? 'Ne' : 'No'}
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ JSON TAB ═══ */}
            {activeTab === 'json' && (
                <div style={{ padding: 16 }}>
                    <textarea
                        className="form-input"
                        value={JSON.stringify({ questions }, null, 2)}
                        onChange={e => {
                            try {
                                const parsed = JSON.parse(e.target.value);
                                if (parsed.questions) {
                                    setQuestions(parsed.questions);
                                    if (onJsonChange) onJsonChange(e.target.value);
                                }
                            } catch { /* ignore parse errors while typing */ }
                        }}
                        style={{ fontFamily: 'monospace', fontSize: '0.82rem', minHeight: 350, lineHeight: 1.5 }}
                    />
                </div>
            )}
        </div>
    );
}
