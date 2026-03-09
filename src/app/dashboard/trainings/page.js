'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getAll, create, update, remove, COLLECTIONS, getUserCompanies } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import EmailDispatchModal from '@/components/EmailDispatchModal';
import {
    createTrainingSession, generateToken, getSessionsForTraining,
} from '@/lib/firebaseSync';
import { sendBatchEmails } from '@/lib/emailService';

/* ═══════════════════════════════════════════════
   Obuke i prezentacije — Training Module Builder
   Officer creates slides + auto-generated quiz
   ═══════════════════════════════════════════════ */

const EMPTY_SLIDE = () => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), naslov: '', sadrzaj: '' });
const EMPTY_QUESTION = () => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), pitanje: '', opcije: ['', '', '', ''], tacno: 0, objasnjenje: '' });

const EMPTY_TRAINING = {
    naziv: '',
    opis: '',
    slides: [],
    questions: [],
    prolazniPrag: 70,
    prikaziRezultate: true,
    dozvoliPovratak: false,
    responses: [],
};

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function TrainingsPage() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { user, activeCompanyId } = useAuth();
    const officerName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'eZNR Admin';
    const activeCompany = getUserCompanies(user?.id).find(c => c.id === activeCompanyId);
    const companyName = activeCompany?.naziv || '';
    const companyLogo = activeCompany?.logo || '';

    const [view, setView] = useState('list'); // list | form | results
    const [records, setRecords] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_TRAINING });
    const [search, setSearch] = useState('');
    const [activeFormTab, setActiveFormTab] = useState('slides'); // slides | quiz | settings
    const [generatingQuiz, setGeneratingQuiz] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadStatus, setUploadStatus] = useState(''); // message shown during upload
    const fileInputRef = useRef(null);
    const [dispatchOpen, setDispatchOpen] = useState(false);
    const [dispatchTraining, setDispatchTraining] = useState(null);
    const [resultsTraining, setResultsTraining] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const menuButtonRef = useRef(null);

    const loadData = useCallback(() => setRecords(getAll(COLLECTIONS.TRAININGS)), []);
    useEffect(() => { loadData(); }, [loadData]);

    // Close dropdown on outside click — ignore clicks on the trigger button itself
    useEffect(() => {
        if (!openMenuId) return;
        let id;
        const close = (e) => {
            if (e.target.closest?.('[data-menu]')) return;
            if (e.target.closest?.('[data-menu-trigger]')) return;
            setOpenMenuId(null);
        };
        id = requestAnimationFrame(() => document.addEventListener('mousedown', close));
        return () => { cancelAnimationFrame(id); document.removeEventListener('mousedown', close); };
    }, [openMenuId]);

    // Close menu if trigger button scrolls out of view — do NOT reposition (causes bounce)
    useEffect(() => {
        if (!openMenuId || !menuButtonRef.current) return;
        const checkVisible = () => {
            if (!menuButtonRef.current) return;
            const rect = menuButtonRef.current.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) setOpenMenuId(null);
        };
        window.addEventListener('scroll', checkVisible, true);
        return () => window.removeEventListener('scroll', checkVisible, true);
    }, [openMenuId]);

    // ── CRUD ─────────────────────────────────
    const setF = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleNew = () => {
        setFormData({ ...EMPTY_TRAINING, slides: [EMPTY_SLIDE()], questions: [] });
        setEditingId(null);
        setActiveFormTab('slides');
        setView('form');
    };

    const handleEdit = (item) => {
        setFormData({ ...EMPTY_TRAINING, ...item });
        setEditingId(item.id);
        setActiveFormTab('slides');
        setView('form');
    };

    const handleSave = () => {
        if (!formData.naziv.trim()) { alert('Unesite naziv obuke.'); return; }
        if (editingId) update(COLLECTIONS.TRAININGS, editingId, formData);
        else create(COLLECTIONS.TRAININGS, formData);
        loadData();
        setView('list');
    };

    const handleDelete = async (id) => {
        setOpenMenuId(null);
        if (await confirm('Obrisati ovu obuku?')) { remove(COLLECTIONS.TRAININGS, id); loadData(); }
    };

    // ── SLIDES ────────────────────────────────
    const addSlide = () => setF('slides', [...(formData.slides || []), EMPTY_SLIDE()]);
    const removeSlide = (idx) => setF('slides', formData.slides.filter((_, i) => i !== idx));
    const updateSlide = (idx, field, value) => {
        const slides = [...formData.slides];
        slides[idx] = { ...slides[idx], [field]: value };
        setF('slides', slides);
    };
    const moveSlide = (idx, dir) => {
        const slides = [...formData.slides];
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= slides.length) return;
        [slides[idx], slides[newIdx]] = [slides[newIdx], slides[idx]];
        setF('slides', slides);
    };

    // ── QUESTIONS ─────────────────────────────
    const addQuestion = () => setF('questions', [...(formData.questions || []), EMPTY_QUESTION()]);
    const removeQuestion = (idx) => setF('questions', formData.questions.filter((_, i) => i !== idx));
    const updateQuestion = (idx, field, value) => {
        const questions = [...formData.questions];
        questions[idx] = { ...questions[idx], [field]: value };
        setF('questions', questions);
    };
    const updateOption = (qIdx, oIdx, value) => {
        const questions = [...formData.questions];
        const opcije = [...questions[qIdx].opcije];
        opcije[oIdx] = value;
        questions[qIdx] = { ...questions[qIdx], opcije };
        setF('questions', questions);
    };

    // ── AI QUIZ GENERATION ────────────────────
    const generateQuiz = async () => {
        const slides = formData.slides || [];
        if (slides.length === 0 || slides.every(s => !s.sadrzaj.trim())) {
            await alert('Dodajte sadržaj slajdova prije generiranja testa.');
            return;
        }
        setGeneratingQuiz(true);
        try {
            const res = await fetch('/api/generate-quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slides: slides.map(s => ({ naslov: s.naslov, sadrzaj: s.sadrzaj })) }),
            });
            const data = await res.json();
            if (data.questions?.length > 0) {
                const withIds = data.questions.map(q => ({ ...q, id: genId() }));
                setF('questions', withIds);
                setActiveFormTab('quiz');
            } else {
                await alert('Nije moguće generirati pitanja. Provjerite sadržaj slajdova.');
            }
        } catch (err) {
            console.error('Quiz gen error:', err);
            await alert('Greška pri generiranju testa.');
        } finally {
            setGeneratingQuiz(false);
        }
    };

    // ── FILE UPLOAD (PDF / PPTX) ──────────────────
    const handleFileUpload = async (file) => {
        if (!file) return;
        const name = file.name?.toLowerCase() || '';
        if (!name.endsWith('.pdf') && !name.endsWith('.pptx') && !name.endsWith('.ppt')) {
            setUploadError('Podržani formati: .pdf i .pptx');
            return;
        }
        setUploadError('');
        setUploadingFile(true);
        setUploadStatus(name.endsWith('.pdf')
            ? '🤖 Gemini čita dokument i kreira slajdove... (10-20s)'
            : '📦 Izvlačim slajdove iz prezentacije...');
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/parse-presentation', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok || data.error) {
                setUploadError(data.error || 'Greška pri obradi fajla.');
                return;
            }
            if ((data.slides || []).length === 0) {
                setUploadError('Nije pronađen nijedan slajd u fajlu.');
                return;
            }
            // Confirm if slides already exist
            if ((formData.slides || []).some(s => s.naslov || s.sadrzaj)) {
                if (!window.confirm(`Pronađeno ${data.slides.length} slajdova. Zamijeniti postojeće slajdove?`)) return;
            }
            setF('slides', data.slides);
            // Auto-fill name from filename if empty
            if (!formData.naziv.trim()) {
                const nameWithout = file.name.replace(/\.(pdf|pptx?)$/i, '').replace(/[-_]/g, ' ');
                setF('naziv', nameWithout.charAt(0).toUpperCase() + nameWithout.slice(1));
            }
            setUploadError('');
            // Show success note
            const src = data.source;
            setUploadStatus(src === 'pdf-ai'
                ? `✅ AI kreirao ${data.count} slajdova iz dokumenta`
                : `✅ Uvezeno ${data.count} slajdova`);
            setTimeout(() => setUploadStatus(''), 4000);
        } catch (err) {
            console.error('Upload error:', err);
            setUploadError('Greška pri slanju fajla. Pokušajte ponovo.');
        } finally {
            setUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const openDispatch = (training) => {
        setDispatchTraining(training);
        setDispatchOpen(true);
    };

    // ── RESULTS ───────────────────────────────
    const openResults = async (training) => {
        setResultsTraining(training);
        setView('results');
        setLoadingSessions(true);
        try {
            const data = await getSessionsForTraining(training.id);
            setSessions(data);
        } catch { setSessions([]); }
        finally { setLoadingSessions(false); }
    };

    // ── PRINT ──────────────────────────────────
    const handlePrintTraining = (training, what = 'both') => {
        setOpenMenuId(null);
        const slides = what !== 'test' ? (training.slides || []) : [];
        const questions = what !== 'prezentacija' ? (training.questions || []) : [];
        const logoHtml = companyLogo ? `<img src="${companyLogo}" style="height:60px;max-width:200px;object-fit:contain;margin-bottom:6px" />` : '';
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${training.naziv || 'Obuka'}</title>
          <style>body{font-family:Arial,sans-serif;padding:32px 48px;color:#000}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 12px}hr{border:none;border-top:2px solid #000;margin:16px 0 24px}.slide{margin-bottom:20px;page-break-inside:avoid}.sn{font-size:13px;font-weight:700;margin-bottom:4px}.sc{font-size:11px;white-space:pre-wrap;line-height:1.6}.q{margin-bottom:16px;page-break-inside:avoid}.qt{font-size:12px;font-weight:700;margin-bottom:4px}.opt{font-size:11px;padding:2px 0 2px 16px}.meta{font-size:11px;color:#666;margin-bottom:4px}@media print{button{display:none}}</style>
        </head><body>
          ${logoHtml}
          ${companyName ? `<div class="meta">${companyName}</div>` : ''}
          <h1>${training.naziv || 'Obuka'}</h1>
          <div class="meta">${officerName} &mdash; ${new Date().toLocaleDateString('hr-HR')}</div>
          <hr />
          ${slides.map((s, i) => `<div class="slide">
            <div class="sn">Slajd ${i + 1}: ${s.naslov || ''}</div>
            <div class="sc">${s.sadrzaj || ''}</div>
          </div>`).join('')}
          ${questions.length > 0 ? `<hr /><h2>TEST ZNANJA</h2>
          ${questions.map((q, i) => `<div class="q">
            <div class="qt">${i + 1}. ${q.pitanje || ''}</div>
            ${(q.opcije || []).map((o, j) => `<div class="opt">${String.fromCharCode(65 + j)}) ${o}</div>`).join('')}
          </div>`).join('')}` : ''}
          <button onclick="window.print()" style="margin-top:24px;padding:8px 20px;font-size:14px;cursor:pointer">🖨️ Isprintaj</button>
        </body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    // ═══════════════════════════════ STYLES ════════════════════════════════
    const lbl = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
    const tabSt = (active) => ({
        padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: active ? 700 : 500,
        background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s',
    });

    /* ── LIST VIEW ──────────────────────────────────────────────────────── */
    if (view === 'list') {
        const filtered = search
            ? records.filter(r => (r.naziv || '').toLowerCase().includes(search.toLowerCase()))
            : records;

        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <span style={{ fontSize: '1.6rem' }}>🎬</span>
                    <div>
                        <h1 style={{ margin: 0 }}>Obuke i prezentacije</h1>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>Kreirajte prezentacije s automatski generiranim testovima i šaljite radnicima</p>
                    </div>
                </div>
                <DialogRenderer />

                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ Nova obuka</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input placeholder="Pretraži obuke..." value={search} onChange={e => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} zapisa</span>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Akcije</th>
                                        <th>Naziv obuke</th>
                                        <th>Slajdova</th>
                                        <th>Pitanja</th>
                                        <th>Prag prolaza</th>
                                        <th>Kreirano</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎬</div>
                                            <div style={{ fontWeight: 600 }}>Nema kreiranih obuka</div>
                                            <div style={{ fontSize: '0.85rem', marginTop: 4 }}>Kliknite &quot;+ Nova obuka&quot; da kreirate prvu</div>
                                        </td></tr>
                                    ) : filtered.map(r => (
                                        <tr key={r.id}>
                                            <td>
                                                <div style={{ position: 'relative' }}>
                                                    <button className="btn btn-primary btn-sm" data-menu-trigger
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (openMenuId === r.id) { setOpenMenuId(null); return; }
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            menuButtonRef.current = e.currentTarget;
                                                            const estimatedHeight = 300;
                                                            const spaceBelow = window.innerHeight - rect.bottom;
                                                            const top = spaceBelow < estimatedHeight
                                                                ? Math.max(8, rect.top - estimatedHeight - 4)
                                                                : rect.bottom + 4;
                                                            setMenuPos({ top, left: rect.left });
                                                            setOpenMenuId(r.id);
                                                        }}>
                                                        Akcije ▼
                                                    </button>
                                                    {openMenuId === r.id && (
                                                        <div data-menu style={{
                                                            position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999,
                                                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                                                            minWidth: 210, maxHeight: '90vh', overflowY: 'auto',
                                                        }}>
                                                            <button onClick={() => handleEdit(r)} style={menuItemSt}>📝 Uredi</button>
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <button onClick={() => { setOpenMenuId(null); openDispatch(r); }} style={menuItemSt}>📧 Pošalji radnicima</button>
                                                            <button onClick={() => openResults(r)} style={menuItemSt}>📊 Rezultati</button>
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <button onClick={() => handleDelete(r.id)} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Obriši</button>
                                                            {/* Print sub-options — last */}
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <div style={{ padding: '5px 14px 2px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🖨️ Isprintaj</div>
                                                            {(r.slides?.length > 0) && <button onClick={() => handlePrintTraining(r, 'prezentacija')} style={{ ...menuItemSt, paddingLeft: 24 }}>🎬 Prezentaciju</button>}
                                                            {(r.questions?.length > 0) && <button onClick={() => handlePrintTraining(r, 'test')} style={{ ...menuItemSt, paddingLeft: 24 }}>📝 Test</button>}
                                                            {(r.slides?.length > 0 && r.questions?.length > 0) && <button onClick={() => handlePrintTraining(r, 'both')} style={{ ...menuItemSt, paddingLeft: 24 }}>📚 Prezentaciju + Test</button>}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span onClick={() => handleEdit(r)} style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}
                                                    onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                                                    onMouseLeave={e => e.target.style.textDecoration = 'none'}>
                                                    {r.naziv || '—'}
                                                </span>
                                                {r.opis && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.opis}</div>}
                                            </td>
                                            <td><span style={{ fontWeight: 600 }}>{(r.slides || []).length}</span> slajdova</td>
                                            <td><span style={{ fontWeight: 600 }}>{(r.questions || []).length}</span> pitanja</td>
                                            <td><span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 700, fontSize: '0.8rem' }}>{r.prolazniPrag ?? 70}%</span></td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('hr-HR') : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Training Dispatch Modal */}
                <TrainingDispatchModal
                    isOpen={dispatchOpen}
                    onClose={() => { setDispatchOpen(false); setDispatchTraining(null); }}
                    training={dispatchTraining}
                />
            </div>
        );
    }

    /* ── RESULTS VIEW ───────────────────────────────────────────────────── */
    if (view === 'results' && resultsTraining) {
        const passed = sessions.filter(s => s.grade?.passed).length;
        const failed = sessions.filter(s => s.status === 'completed' && !s.grade?.passed).length;
        const pending = sessions.filter(s => s.status !== 'completed').length;

        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn btn-ghost" onClick={() => { setView('list'); setResultsTraining(null); }}>←</button>
                    <h1 style={{ margin: 0 }}>📊 Rezultati: {resultsTraining.naziv}</h1>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[{ label: 'Prošli ✅', value: passed, color: '#22c55e' }, { label: 'Nisu prošli ❌', value: failed, color: '#f05252' }, { label: 'Na čekanju ⏳', value: pending, color: '#f59e0b' }].map(s => (
                        <div key={s.label} className="card">
                            <div className="card-body" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="card">
                    <div className="card-body">
                        {loadingSessions ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Učitavanje...</div>
                        ) : sessions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Još nema poslatih sesija za ovu obuku.</div>
                        ) : (
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead><tr><th>Radnik</th><th>Email</th><th>Status</th><th>Rezultat</th><th>Datum</th></tr></thead>
                                    <tbody>
                                        {sessions.map(s => (
                                            <tr key={s.id}>
                                                <td style={{ fontWeight: 600 }}>{s.recipientName || '—'}</td>
                                                <td style={{ fontSize: '0.82rem' }}>{s.recipientEmail}</td>
                                                <td>
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                                                        background: s.status === 'completed' ? 'rgba(34,197,94,0.12)' : s.status === 'opened' ? 'rgba(245,158,11,0.12)' : 'rgba(148,163,184,0.12)',
                                                        color: s.status === 'completed' ? '#22c55e' : s.status === 'opened' ? '#f59e0b' : 'var(--text-muted)',
                                                    }}>
                                                        {s.status === 'completed' ? 'Završeno' : s.status === 'opened' ? 'Otvoreno' : 'Poslano'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {s.grade != null ? (
                                                        <span style={{ fontWeight: 700, color: s.grade.passed ? '#22c55e' : '#f05252' }}>
                                                            {s.grade.percentage}% — {s.grade.passed ? 'Prošao/la' : 'Nije prošao/la'}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {s.completedAt ? new Date(s.completedAt).toLocaleDateString('hr-HR') : s.createdAt ? new Date(s.createdAt).toLocaleDateString('hr-HR') : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /* ── FORM VIEW ──────────────────────────────────────────────────────── */
    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button className="btn btn-ghost" onClick={() => setView('list')}>←</button>
                <h1 style={{ margin: 0 }}>{editingId ? '✏️ Uredi obuku' : '🎬 Nova obuka'}</h1>
            </div>

            {/* Tab navigation */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
                    {[
                        { key: 'slides', label: `🖼️ Slajdovi (${(formData.slides || []).length})` },
                        { key: 'quiz', label: `❓ Test (${(formData.questions || []).length})` },
                        { key: 'settings', label: '⚙️ Postavke' },
                    ].map(tab => (
                        <button key={tab.key} style={tabSt(activeFormTab === tab.key)} onClick={() => setActiveFormTab(tab.key)}>
                            {tab.label}
                        </button>
                    ))}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" onClick={() => setView('list')}>Odustani</button>
                        <button className="btn btn-primary" onClick={handleSave}>💾 Snimi</button>
                    </div>
                </div>
            </div>

            {/* Basic info */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
                        <div>
                            <div style={lbl}>Naziv obuke *</div>
                            <input className="form-input" value={formData.naziv} onChange={e => setF('naziv', e.target.value)} placeholder="npr. Osnove zaštite na radu" />
                        </div>
                        <div>
                            <div style={lbl}>Kratki opis</div>
                            <input className="form-input" value={formData.opis} onChange={e => setF('opis', e.target.value)} placeholder="Kratki opis sadržaja obuke..." />
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── SLIDES TAB ─────────────────────────────── */}
            {activeFormTab === 'slides' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* ── Import from file ── */}
                    <div className="card" style={{ border: '1px dashed var(--border)', background: uploadingFile ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#6366f1'; }}
                        onDragLeave={e => { e.currentTarget.style.borderColor = ''; }}
                        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = ''; const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}>
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '16px 20px' }}>
                            <div style={{ fontSize: '1.8rem' }}>{uploadingFile ? '⏳' : '📂'}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, marginBottom: 2 }}>Uvezi iz PowerPoint ili PDF fajla</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <b>.pptx</b> → slajdovi se uvaze direktno &nbsp;·&nbsp; <b>.pdf</b> → 🤖 Gemini AI kreira slajdove iz teksta
                                </div>
                                {uploadStatus && !uploadError && (
                                    <div style={{ fontSize: '0.82rem', color: uploadStatus.startsWith('✅') ? '#22c55e' : '#6366f1', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {uploadingFile && <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
                                        {uploadStatus}
                                    </div>
                                )}
                                {uploadError && <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: 4 }}>⚠️ {uploadError}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button className="btn btn-outline btn-sm" disabled={uploadingFile} onClick={() => fileInputRef.current?.click()}>
                                    📂 Odaberi fajl
                                </button>
                                <input ref={fileInputRef} type="file" accept=".pdf,.pptx" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                            </div>
                        </div>
                    </div>

                    {(formData.slides || []).length === 0 && (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🖼️</div>
                                Nema slajdova. Kliknite &quot;+ Dodaj slajd&quot; da počnete.
                            </div>
                        </div>
                    )}
                    {(formData.slides || []).map((slide, idx) => (
                        <div key={slide.id} className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                            <div className="card-body">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 6 }}>SLAJD {idx + 1}</span>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => moveSlide(idx, -1)} disabled={idx === 0} title="Pomakni gore">↑</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => moveSlide(idx, 1)} disabled={idx === (formData.slides.length - 1)} title="Pomakni dolje">↓</button>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeSlide(idx)} title="Obriši slajd">🗑️</button>
                                    </div>
                                </div>
                                <div style={{ marginBottom: 10 }}>
                                    <div style={lbl}>Naslov slajda</div>
                                    <input className="form-input" value={slide.naslov} onChange={e => updateSlide(idx, 'naslov', e.target.value)} placeholder={`Naslov slajda ${idx + 1}...`} />
                                </div>
                                <div>
                                    <div style={lbl}>Sadržaj slajda</div>
                                    <textarea className="form-input" rows={6} value={slide.sadrzaj} onChange={e => updateSlide(idx, 'sadrzaj', e.target.value)}
                                        placeholder="Unesite tekst sadržaja slajda... Koristite novi red za odvajanje tačaka. Što više sadržaja, to bolji AI generira test."
                                        style={{ resize: 'vertical', lineHeight: 1.7 }} />
                                </div>
                            </div>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-outline" onClick={addSlide}>+ Dodaj slajd</button>
                    </div>
                </div>
            )}

            {/* ─── QUIZ TAB ──────────────────────────────── */}
            {activeFormTab === 'quiz' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* AI Generate button */}
                    <div className="card">
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>🤖 AI generisanje testa</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Gemini AI čita vaše slajdove i automatski kreira pitanja višestrukog izbora za provjeru znanja radnika.</div>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={generateQuiz}
                                disabled={generatingQuiz || (formData.slides || []).length === 0}
                                style={{ whiteSpace: 'nowrap', gap: 8, display: 'flex', alignItems: 'center' }}>
                                {generatingQuiz ? (
                                    <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Generišem...</>
                                ) : '✨ Generiraj test iz prezentacije'}
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={addQuestion}>+ Dodaj ručno</button>
                        </div>
                    </div>

                    {(formData.questions || []).length === 0 && !generatingQuiz && (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>❓</div>
                                Nema pitanja. Kliknite &quot;Generiraj test&quot; ili &quot;+ Dodaj ručno&quot;.
                            </div>
                        </div>
                    )}

                    {(formData.questions || []).map((q, qIdx) => (
                        <div key={q.id} className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                            <div className="card-body">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 6 }}>PITANJE {qIdx + 1}</span>
                                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => removeQuestion(qIdx)}>🗑️</button>
                                </div>
                                <div style={{ marginBottom: 12 }}>
                                    <div style={lbl}>Tekst pitanja</div>
                                    <input className="form-input" value={q.pitanje} onChange={e => updateQuestion(qIdx, 'pitanje', e.target.value)} placeholder="Unesite pitanje..." />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                    {(q.opcije || ['', '', '', '']).map((opt, oIdx) => (
                                        <div key={oIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <button
                                                onClick={() => updateQuestion(qIdx, 'tacno', oIdx)}
                                                style={{
                                                    width: 28, height: 28, borderRadius: '50%', border: '2px solid',
                                                    borderColor: q.tacno === oIdx ? '#22c55e' : 'var(--border)',
                                                    background: q.tacno === oIdx ? '#22c55e' : 'transparent',
                                                    color: q.tacno === oIdx ? '#fff' : 'var(--text-muted)',
                                                    cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
                                                }}
                                                title="Klikni da označiš kao tačan odgovor">
                                                {String.fromCharCode(65 + oIdx)}
                                            </button>
                                            <input className="form-input" style={{ flex: 1, fontSize: '0.85rem' }}
                                                value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                                                placeholder={`Opcija ${String.fromCharCode(65 + oIdx)}...`} />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div style={lbl}>Objašnjenje (opcionalno)</div>
                                    <input className="form-input" style={{ fontSize: '0.85rem' }} value={q.objasnjenje || ''} onChange={e => updateQuestion(qIdx, 'objasnjenje', e.target.value)} placeholder="Kratko objašnjenje tačnog odgovora..." />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── SETTINGS TAB ──────────────────────────── */}
            {activeFormTab === 'settings' && (
                <div className="card">
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <div style={lbl}>Prag prolaza (%)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <input className="form-input" type="number" min={0} max={100} value={formData.prolazniPrag ?? 70}
                                    onChange={e => setF('prolazniPrag', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                    style={{ maxWidth: 120 }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    % tačnih odgovora potrebno za prolaz (trenutno: {formData.prolazniPrag ?? 70}%)
                                </span>
                            </div>
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                                <input type="checkbox" className="form-checkbox" checked={formData.prikaziRezultate ?? true}
                                    onChange={e => setF('prikaziRezultate', e.target.checked)} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Prikaži rezultate radniku odmah po završetku</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Radnik vidi postotak i prolaz/pad odmah</div>
                                </div>
                            </label>
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                                <input type="checkbox" className="form-checkbox" checked={formData.dozvoliPovratak ?? false}
                                    onChange={e => setF('dozvoliPovratak', e.target.checked)} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Dozvoli povratak na prezentaciju tokom testa</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Radnik može otvoriti prezentaciju tokom testa — odgovori se čuvaju</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Save */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-body" style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" onClick={handleSave}>💾 Snimi obuku</button>
                    <button className="btn btn-ghost" onClick={() => setView('list')}>Odustani</button>
                    {editingId && (
                        <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginLeft: 'auto' }}
                            onClick={() => handleDelete(editingId)}>🗑️ Obriši</button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   Training Dispatch Modal — sends training link to workers
   ═══════════════════════════════════════════════ */
function TrainingDispatchModal({ isOpen, onClose, training }) {
    const { user, activeCompanyId } = useAuth();
    const officerName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'eZNR Admin';
    const activeCompany = getUserCompanies(user?.id).find(c => c.id === activeCompanyId);
    const companyName = activeCompany?.naziv || '';
    const companyLogo = activeCompany?.logo || '';

    const [workers, setWorkers] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [manualEmails, setManualEmails] = useState('');
    const [replyTo, setReplyTo] = useState('');
    const [deadline, setDeadline] = useState('');
    const [searchQ, setSearchQ] = useState('');
    const [step, setStep] = useState('select');
    const [progress, setProgress] = useState({ current: 0, total: 0, email: '' });
    const [result, setResult] = useState(null);
    const [sendWhat, setSendWhat] = useState('both'); // 'both' | 'prezentacija' | 'test'

    useEffect(() => {
        if (isOpen) {
            setWorkers(getAll(COLLECTIONS.WORKERS) || []);
            setSelectedIds([]); setManualEmails(''); setReplyTo(''); setDeadline(''); setSearchQ('');
            setStep('select'); setResult(null); setSendWhat('both');
        }
    }, [isOpen]);

    const filtered = workers.filter(w => {
        if (!searchQ) return true;
        const name = `${w.ime || ''} ${w.prezime || ''}`.toLowerCase();
        return name.includes(searchQ.toLowerCase()) || (w.email || '').toLowerCase().includes(searchQ.toLowerCase());
    });

    const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const selectAll = () => {
        const valid = filtered.filter(w => w.email);
        setSelectedIds(prev => {
            const all = valid.every(w => prev.includes(w.id));
            return all ? prev.filter(id => !valid.find(w => w.id === id)) : [...new Set([...prev, ...valid.map(w => w.id)])];
        });
    };

    const totalRecipients = selectedIds.filter(id => workers.find(w => w.id === id)?.email).length
        + (manualEmails.trim() ? manualEmails.split(/[,;\n]+/).filter(e => e.trim() && e.includes('@')).length : 0);

    const handleSend = async () => {
        if (!training) return;
        const recipients = [];
        for (const wId of selectedIds) {
            const w = workers.find(x => x.id === wId);
            if (w?.email) recipients.push({ toEmail: w.email, toName: `${w.ime || ''} ${w.prezime || ''}`.trim(), workerId: w.id });
        }
        if (manualEmails.trim()) {
            const emails = manualEmails.split(/[,;\n]+/).map(e => e.trim()).filter(e => e && e.includes('@'));
            for (const email of emails) {
                if (!recipients.find(r => r.toEmail === email)) recipients.push({ toEmail: email, toName: email });
            }
        }
        if (recipients.length === 0) return;
        setStep('sending');

        const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}/t/` : 'https://eznr.vercel.app/t/';
        const tokens = [];

        for (const r of recipients) {
            const token = generateToken();
            try {
                await createTrainingSession({
                    token, trainingId: training.id, trainingName: training.naziv || 'Obuka',
                    recipientEmail: r.toEmail, recipientName: r.toName, workerId: r.workerId || null,
                    deadline: deadline || null,
                    slides: sendWhat !== 'test' ? (training.slides || []) : [],
                    questions: sendWhat !== 'prezentacija' ? (training.questions || []) : [],
                    prolazniPrag: training.prolazniPrag ?? 70, prikaziRezultate: training.prikaziRezultate ?? true,
                    dozvoliPovratak: training.dozvoliPovratak ?? false,
                    assignedBy: officerName,
                    companyName,
                    companyLogo,
                    sendWhat,
                });
                tokens.push(`${baseUrl}${token}`);
            } catch { tokens.push(`${baseUrl}error`); }
        }

        const sendResult = await sendBatchEmails(
            recipients,
            { questionnaireName: training.naziv || 'Obuka', tokens, deadline: deadline || null,
              senderName: officerName, companyName, replyTo: replyTo.trim() || null },
            (current, total, email) => setProgress({ current, total, email })
        );
        setResult(sendResult);
        setStep('done');
    };

    if (!isOpen) return null;

    const inputSt = { flex: 1, padding: '9px 14px', fontSize: '0.88rem', borderRadius: 8, border: '1px solid var(--border, rgba(255,255,255,0.1))', background: 'var(--bg-input, rgba(0,0,0,0.2))', color: 'var(--text, #e2e8f0)', outline: 'none', fontFamily: 'inherit' };
    const sendBtnSt = { padding: '9px 24px', fontSize: '0.88rem', fontWeight: 700, borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer' };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 10000 }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '90vw', maxWidth: 680, maxHeight: '85vh', background: 'var(--bg-card,#1e293b)', border: '1px solid var(--border,rgba(255,255,255,0.1))', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', zIndex: 10001, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light,rgba(255,255,255,0.06))' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text,#e2e8f0)' }}>📧 Pošalji obuku radnicima</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted,#94a3b8)' }}>{training?.naziv || ''}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted,#94a3b8)' }}>✕</button>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                    {step === 'select' && (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text,#e2e8f0)', marginBottom: 8 }}>👥 Odaberite radnike</div>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                    <input style={inputSt} placeholder="Pretraži radnike..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                                    <button onClick={selectAll} style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 600, borderRadius: 8, border: '1px solid var(--border,rgba(255,255,255,0.1))', background: 'transparent', color: 'var(--primary,#6366f1)', cursor: 'pointer' }}>Odaberi sve</button>
                                </div>
                                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border,rgba(255,255,255,0.08))', borderRadius: 10, background: 'rgba(0,0,0,0.15)' }}>
                                    {filtered.map(w => (
                                        <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: w.email ? 'pointer' : 'not-allowed', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: w.email ? 1 : 0.4, background: selectedIds.includes(w.id) ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                                            <input type="checkbox" checked={selectedIds.includes(w.id)} onChange={() => w.email && toggle(w.id)} disabled={!w.email} style={{ accentColor: '#6366f1' }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text,#e2e8f0)' }}>{w.ime} {w.prezime}</div>
                                                <div style={{ fontSize: '0.78rem', color: w.email ? 'var(--text-muted,#94a3b8)' : '#ef4444' }}>{w.email || '(nema email)'}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text,#e2e8f0)', marginBottom: 8 }}>✉️ Dodatni emailovi</div>
                                <textarea value={manualEmails} onChange={e => setManualEmails(e.target.value)} rows={2} style={{ ...inputSt, width: '100%', resize: 'vertical' }} placeholder="email1@firma.ba, email2@firma.ba..." />
                            </div>
                            {/* What to send */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text,#e2e8f0)', marginBottom: 8 }}>📋 Što uključiti u obuku?</div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {[{ v: 'both', label: '📚 Prezentacija + Test', disabled: (training?.slides?.length === 0 || training?.questions?.length === 0) },
                                      { v: 'prezentacija', label: '🎬 Samo prezentacija', disabled: training?.slides?.length === 0 },
                                      { v: 'test', label: '📝 Samo test', disabled: training?.questions?.length === 0 }]
                                        .map(opt => (
                                        <button key={opt.v} onClick={() => !opt.disabled && setSendWhat(opt.v)}
                                            disabled={opt.disabled}
                                            style={{ padding: '7px 14px', borderRadius: 8, border: `2px solid ${sendWhat === opt.v ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                                                background: sendWhat === opt.v ? 'rgba(99,102,241,0.15)' : 'transparent',
                                                color: opt.disabled ? 'rgba(148,163,184,0.3)' : sendWhat === opt.v ? '#a5b4fc' : 'var(--text,#e2e8f0)',
                                                cursor: opt.disabled ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s' }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text,#e2e8f0)', marginBottom: 8 }}>📅 Rok (opcionalno)</div>
                                    <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputSt} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text,#e2e8f0)', marginBottom: 8 }}>↩️ Vaš email (Reply-To)</div>
                                    <input type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="officer@firma.ba" style={inputSt} />
                                </div>
                            </div>
                        </>
                    )}
                    {step === 'sending' && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{ width: 56, height: 56, border: '4px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text,#e2e8f0)' }}>Slanje u tijeku...</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted,#94a3b8)' }}>{progress.current}/{progress.total} — {progress.email}</p>
                        </div>
                    )}
                    {step === 'done' && result && (
                        <div style={{ textAlign: 'center', padding: '30px 0' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 16 }}>{result.failed === 0 ? '✅' : '⚠️'}</div>
                            <h3 style={{ color: 'var(--text,#e2e8f0)', margin: '0 0 12px' }}>Slanje završeno</h3>
                            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
                                <div style={{ padding: '12px 24px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.sent}</div>
                                    <div style={{ fontSize: '0.75rem' }}>Poslano</div>
                                </div>
                                {result.failed > 0 && (
                                    <div style={{ padding: '12px 24px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.failed}</div>
                                        <div style={{ fontSize: '0.75rem' }}>Neuspjelo</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light,rgba(255,255,255,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {step === 'select' && (
                        <>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted,#94a3b8)' }}>{totalRecipients} primatelja</span>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={onClose} style={{ padding: '9px 20px', fontSize: '0.88rem', fontWeight: 600, borderRadius: 8, border: '1px solid var(--border,rgba(255,255,255,0.1))', background: 'transparent', color: 'var(--text,#e2e8f0)', cursor: 'pointer' }}>Odustani</button>
                                <button onClick={handleSend} disabled={totalRecipients === 0} style={{ ...sendBtnSt, opacity: totalRecipients === 0 ? 0.4 : 1, cursor: totalRecipients === 0 ? 'not-allowed' : 'pointer' }}>
                                    📤 Pošalji ({totalRecipients})
                                </button>
                            </div>
                        </>
                    )}
                    {step === 'done' && <button onClick={onClose} style={{ ...sendBtnSt, marginLeft: 'auto' }}>Zatvori</button>}
                </div>
            </div>
        </>
    );
}
