'use client';
import { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';

// ── Legal basis ────────────────────────────────────────────────────────────────
// Zakon o zaštiti na radu FBiH (Sl. novine FBiH br. 79/20)
// Pravilnik o postupku raspoređivanja radnika na poslove sa povećanim rizikom
//   i o postupku prethodnih i periodičnih ljekarskih pregleda (Sl. novine FBiH br. 9/23)
// ──────────────────────────────────────────────────────────────────────────────

const EXAM_TYPES = [
    { value: 'prethodni',    labelBs: 'Prethodni pregled',         labelEn: 'Pre-employment Exam',       info: 'Prije raspoređivanja na radno mjesto (čl. 44. ZZNA-a)' },
    { value: 'periodični',   labelBs: 'Periodični pregled',        labelEn: 'Periodic Exam',              info: 'Za radnike na poslovima s povećanim rizikom (Prilog III Pravilnika 9/23)' },
    { value: 'vanredni',     labelBs: 'Vanredni pregled',          labelEn: 'Extraordinary Exam',         info: 'Nakon promjene zdravstvenog stanja, nesreće ili dugog bolovanja' },
    { value: 'nočni_rad',   labelBs: 'Pregled - noćni rad',       labelEn: 'Night-work Exam',            info: 'Za radnike na noćnom radu — min. svake 2 godine (čl. 44. st. 3)' },
    { value: 'ostalo',       labelBs: 'Ostalo',                    labelEn: 'Other',                      info: '' },
];

const RESULTS = [
    { value: 'Sposoban',          labelBs: 'Sposoban',           labelEn: 'Fit',                  color: 'var(--success)' },
    { value: 'Uvjetno Sposoban',  labelBs: 'Uvjetno Sposoban',   labelEn: 'Conditionally Fit',   color: 'var(--warning)' },
    { value: 'Nesposoban',        labelBs: 'Nesposoban',         labelEn: 'Unfit',                color: 'var(--danger)' },
];

const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
};

const getStatusBadge = (exam, lang) => {
    const days = getDaysUntil(exam.vrijediDo);
    if (days === null) return { label: lang === 'bs' ? 'Bez roka' : 'No deadline', color: 'var(--text-muted)', bg: 'var(--border-light)' };
    if (days < 0)    return { label: lang === 'bs' ? 'Isteklo' : 'Expired',           color: 'white', bg: 'var(--danger)' };
    if (days <= 30)  return { label: lang === 'bs' ? `Ističe za ${days}d` : `Expires in ${days}d`, color: 'white', bg: '#E65100' };
    if (days <= 90)  return { label: lang === 'bs' ? `Ističe za ${days}d` : `Expires in ${days}d`, color: 'white', bg: 'var(--warning)' };
    return { label: lang === 'bs' ? 'Vrijedi' : 'Valid', color: 'white', bg: 'var(--success)' };
};

const emptyForm = {
    workerId: '', tipPregleda: 'prethodni', datumPregleda: '', vrijediDo: '',
    rezultat: 'Sposoban', zdravstvenaUstanova: '', doktorIme: '',
    ogranicenja: '', napomena: '', uputnicaBroj: '',
};

export default function MedicalExamsPage() {
    const { lang } = useLanguage();
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const bs = lang === 'bs';

    const [exams, setExams] = useState(() => getAll(COLLECTIONS.MEDICAL_EXAMS));
    const [workers] = useState(() => getAll(COLLECTIONS.WORKERS));
    const [doctors] = useState(() => getAll(COLLECTIONS.DOCTORS));

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [filterTab, setFilterTab] = useState('all'); // all | expired | soon | valid
    const [searchQ, setSearchQ] = useState('');

    const reload = useCallback(() => setExams(getAll(COLLECTIONS.MEDICAL_EXAMS)), []);

    const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

    // ── Stats ──────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const today = new Date();
        let expired = 0, soon = 0, valid = 0, noDeadline = 0;
        exams.forEach(e => {
            const days = getDaysUntil(e.vrijediDo);
            if (days === null) noDeadline++;
            else if (days < 0) expired++;
            else if (days <= 90) soon++;
            else valid++;
        });
        return { expired, soon, valid, noDeadline, total: exams.length };
    }, [exams]);

    // ── Filter & search ────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = exams.map(e => {
            const w = workers.find(wk => wk.id === e.workerId);
            return { ...e, _workerName: w ? `${w.ime} ${w.prezime}` : '—' };
        });
        if (searchQ) {
            const q = searchQ.toLowerCase();
            list = list.filter(e =>
                e._workerName.toLowerCase().includes(q) ||
                (e.zdravstvenaUstanova || '').toLowerCase().includes(q) ||
                (e.doktorIme || '').toLowerCase().includes(q)
            );
        }
        if (filterTab === 'expired') list = list.filter(e => getDaysUntil(e.vrijediDo) !== null && getDaysUntil(e.vrijediDo) < 0);
        if (filterTab === 'soon')    list = list.filter(e => { const d = getDaysUntil(e.vrijediDo); return d !== null && d >= 0 && d <= 90; });
        if (filterTab === 'valid')   list = list.filter(e => { const d = getDaysUntil(e.vrijediDo); return d !== null && d > 90; });
        // Sort: expired first, then by vrijediDo asc
        return list.sort((a, b) => {
            const da = getDaysUntil(a.vrijediDo) ?? 999999;
            const db = getDaysUntil(b.vrijediDo) ?? 999999;
            return da - db;
        });
    }, [exams, workers, filterTab, searchQ]);

    // ── CRUD ───────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.workerId) { await alert(bs ? 'Odaberite radnika!' : 'Select a worker!'); return; }
        if (!form.datumPregleda) { await alert(bs ? 'Unesite datum pregleda!' : 'Enter exam date!'); return; }
        if (!form.rezultat) { await alert(bs ? 'Unesite rezultat pregleda!' : 'Enter exam result!'); return; }

        const w = workers.find(wk => wk.id === form.workerId);
        const payload = { ...form, radnikIme: w ? `${w.ime} ${w.prezime}` : '' };

        if (editingId) {
            update(COLLECTIONS.MEDICAL_EXAMS, editingId, payload);
        } else {
            create(COLLECTIONS.MEDICAL_EXAMS, payload);
        }
        reload();
        setShowForm(false);
        setEditingId(null);
        setForm({ ...emptyForm });
    };

    const handleEdit = (exam) => {
        setEditingId(exam.id);
        setForm({
            workerId: exam.workerId || '',
            tipPregleda: exam.tipPregleda || 'prethodni',
            datumPregleda: exam.datumPregleda || '',
            vrijediDo: exam.vrijediDo || '',
            rezultat: exam.rezultat || 'Sposoban',
            zdravstvenaUstanova: exam.zdravstvenaUstanova || '',
            doktorIme: exam.doktorIme || '',
            ogranicenja: exam.ogranicenja || '',
            napomena: exam.napomena || '',
            uputnicaBroj: exam.uputnicaBroj || '',
        });
        setShowForm(true);
    };

    const handleDelete = async (exam) => {
        const ok = await confirm(bs
            ? `Obrisati pregled za ${exam._workerName}?`
            : `Delete exam for ${exam._workerName}?`
        );
        if (ok) { remove(COLLECTIONS.MEDICAL_EXAMS, exam.id); reload(); }
    };

    const handleNew = () => {
        setEditingId(null);
        setForm({ ...emptyForm });
        setShowForm(true);
    };

    const examTypeLabel = (v) => EXAM_TYPES.find(t => t.value === v)?.[bs ? 'labelBs' : 'labelEn'] || v;
    const resultLabel = (v) => RESULTS.find(r => r.value === v)?.[bs ? 'labelBs' : 'labelEn'] || v;
    const resultColor = (v) => RESULTS.find(r => r.value === v)?.color || 'var(--text)';

    // ── Filter tab items ───────────────────────────────────────────────────────
    const tabs = [
        { key: 'all',     label: bs ? `Svi (${stats.total})` : `All (${stats.total})` },
        { key: 'expired', label: bs ? `Isteklo (${stats.expired})` : `Expired (${stats.expired})`,  color: 'var(--danger)' },
        { key: 'soon',    label: bs ? `Uskoro (${stats.soon})` : `Soon (${stats.soon})`,            color: 'var(--warning)' },
        { key: 'valid',   label: bs ? `Vrijedi (${stats.valid})` : `Valid (${stats.valid})`,        color: 'var(--success)' },
    ];

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />

            {/* ── Page header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: '1.6rem' }}>👨‍⚕️</span>
                <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0 }}>{bs ? 'Ljekarski pregledi' : 'Medical Examinations'}</h1>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {bs
                            ? 'Evidencija prethodnih i periodičnih ljekarskih pregleda — Zakon o ZNR FBiH (Sl. novine 79/20) + Pravilnik (9/23)'
                            : 'Pre-employment & periodic medical exams — as per BiH OSH Law (79/20) & Rulebook (9/23)'}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={handleNew}>
                    + {bs ? 'Novi pregled' : 'New Exam'}
                </button>
            </div>

            {/* ── Law info banner ── */}
            <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16,
                background: 'rgba(33,150,243,0.06)', border: '1px solid rgba(33,150,243,0.2)',
                fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6,
            }}>
                <strong style={{ color: 'var(--text)' }}>⚖️ Pravna osnova:</strong>{' '}
                Čl. 44. Zakona o zaštiti na radu FBiH (Sl. novine 79/20) i Pravilnik o postupku
                raspoređivanja radnika na poslove sa povećanim rizikom i o postupku prethodnih
                i periodičnih ljekarskih pregleda (Sl. novine FBiH 9/23). Preglede obavlja{' '}
                <strong>doktor medicine — specijalist medicine rada</strong>.
                Radnik koji ne obavi periodični pregled <strong>ne može nastaviti s radom</strong>.
            </div>

            {/* ── Stat chips ── */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {[
                    { count: stats.total,     label: bs ? 'Ukupno' : 'Total',             color: 'var(--primary)' },
                    { count: stats.expired,   label: bs ? 'Isteklo' : 'Expired',          color: 'var(--danger)',  alert: true },
                    { count: stats.soon,      label: bs ? 'Uskoro (90d)' : 'Due (90d)',   color: 'var(--warning)' },
                    { count: stats.valid,     label: bs ? 'Vrijedi' : 'Valid',            color: 'var(--success)' },
                ].map(s => (
                    <div key={s.label} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)', border: `1.5px solid ${s.color}`,
                        cursor: 'default',
                    }}>
                        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.count}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
                        {s.alert && s.count > 0 && <span style={{ fontSize: '0.8rem' }}>⚠️</span>}
                    </div>
                ))}
            </div>

            {/* ── Search + filter tabs ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
                    <input
                        className="form-input"
                        placeholder={bs ? 'Pretraži radnika, doktora, ustanovu...' : 'Search worker, doctor, institution...'}
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            className={filterTab === tab.key ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                            style={tab.color && filterTab !== tab.key ? { borderColor: tab.color, color: tab.color } : {}}
                            onClick={() => setFilterTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Table ── */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{bs ? 'Radnik' : 'Worker'}</th>
                                    <th>{bs ? 'Vrsta pregleda' : 'Exam Type'}</th>
                                    <th>{bs ? 'Datum pregleda' : 'Exam Date'}</th>
                                    <th>{bs ? 'Naredni pregled do' : 'Next Exam By'}</th>
                                    <th>{bs ? 'Status' : 'Status'}</th>
                                    <th>{bs ? 'Rezultat' : 'Result'}</th>
                                    <th>{bs ? 'Ustanova / Doktor' : 'Institution / Doctor'}</th>
                                    <th>{bs ? 'Akcije' : 'Actions'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                                            {bs ? 'Nema unesenih ljekarskih pregleda' : 'No medical exams recorded'}
                                        </td>
                                    </tr>
                                )}
                                {filtered.map(exam => {
                                    const badge = getStatusBadge(exam, lang);
                                    const rColor = resultColor(exam.rezultat);
                                    const days = getDaysUntil(exam.vrijediDo);
                                    const rowBg = days !== null && days < 0
                                        ? 'rgba(239,68,68,0.04)'
                                        : days !== null && days <= 30
                                            ? 'rgba(245,158,11,0.04)'
                                            : '';
                                    return (
                                        <tr key={exam.id} style={{ background: rowBg }}>
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ fontWeight: 600, padding: '2px 4px' }}
                                                    onClick={() => router.push(`/dashboard/workers?openWorker=${exam.workerId}`)}
                                                >
                                                    👷 {exam._workerName}
                                                </button>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.8rem' }}>
                                                    {examTypeLabel(exam.tipPregleda)}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.85rem' }}>
                                                {formatDate(exam.datumPregleda)}
                                            </td>
                                            <td style={{ fontSize: '0.85rem', fontWeight: days !== null && days < 0 ? 700 : 400, color: days !== null && days < 0 ? 'var(--danger)' : days !== null && days <= 90 ? 'var(--warning)' : 'inherit' }}>
                                                {exam.vrijediDo ? formatDate(exam.vrijediDo) : '—'}
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4,
                                                    background: badge.bg, color: badge.color, fontWeight: 600,
                                                }}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 600, color: rColor, fontSize: '0.85rem' }}>
                                                {resultLabel(exam.rezultat)}
                                            </td>
                                            <td style={{ fontSize: '0.8rem', maxWidth: 200 }}>
                                                <div style={{ fontWeight: 600 }}>{exam.zdravstvenaUstanova || '—'}</div>
                                                {exam.doktorIme && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Dr. {exam.doktorIme}</div>}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-sm btn-icon" title={bs ? 'Uredi' : 'Edit'} onClick={() => handleEdit(exam)}>✏️</button>
                                                    <button className="btn btn-danger btn-sm btn-icon" title={bs ? 'Obriši' : 'Delete'} onClick={() => handleDelete(exam)}>🗑️</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Bottom info ── */}
            <div style={{
                marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)',
                fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.7,
            }}>
                <strong style={{ color: 'var(--text)' }}>📋 Napomena o periodičnosti:</strong>{' '}
                Rokovi periodičnih pregleda za radna mjesta sa povećanim rizikom utvrđeni su u{' '}
                <strong>Prilogu III Pravilnika (Sl. novine FBiH 9/23)</strong> i razlikuju se po vrsti
                opasnosti. Noćni radnici — pregled min. svake 2 godine. Za ostale radnike — prethodni
                pregled pri zaposlenju. Poslodavac snosi troškove svih periodičnih i vanrednih pregleda.
            </div>

            {/* ── Form modal ── */}
            {showForm && (
                <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null); }}>
                    <div className="modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #00695C, #00897B)' }}>
                            <h2 style={{ color: 'white', margin: 0 }}>
                                👨‍⚕️ {editingId
                                    ? (bs ? 'Uredi ljekarski pregled' : 'Edit Medical Exam')
                                    : (bs ? 'Novi ljekarski pregled' : 'New Medical Exam')}
                            </h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => { setShowForm(false); setEditingId(null); }}>✕</button>
                        </div>

                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                            {/* Legal tip */}
                            <div style={{
                                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                background: 'rgba(33,150,243,0.06)', border: '1px solid rgba(33,150,243,0.18)',
                                fontSize: '0.75rem', color: 'var(--text-muted)',
                            }}>
                                ⚖️ {bs
                                    ? 'Preglede obavlja specijalist medicine rada. Troškove snosi poslodavac (čl. 44. ZZNA 79/20).'
                                    : 'Exams performed by occupational medicine specialist. Costs paid by employer (Art. 44 OSH Law 79/20).'}
                            </div>

                            {/* Worker */}
                            <div className="form-group">
                                <label className="form-label">👷 {bs ? 'Radnik *' : 'Worker *'}</label>
                                <select className="form-select" value={form.workerId} onChange={e => setField('workerId', e.target.value)}>
                                    <option value="">{bs ? '— Odaberite radnika —' : '— Select worker —'}</option>
                                    {[...workers].filter(w => w.aktivan !== false).sort((a, b) => a.prezime.localeCompare(b.prezime)).map(w => (
                                        <option key={w.id} value={w.id}>{w.prezime} {w.ime}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Exam type + Referral */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Vrsta pregleda *' : 'Exam Type *'}</label>
                                    <select className="form-select" value={form.tipPregleda} onChange={e => setField('tipPregleda', e.target.value)}>
                                        {EXAM_TYPES.map(t => (
                                            <option key={t.value} value={t.value}>{bs ? t.labelBs : t.labelEn}</option>
                                        ))}
                                    </select>
                                    {EXAM_TYPES.find(t => t.value === form.tipPregleda)?.info && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            ℹ️ {EXAM_TYPES.find(t => t.value === form.tipPregleda).info}
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Broj uputnice (RA-1)' : 'Referral No. (RA-1)'}</label>
                                    <input className="form-input" placeholder="RA1-2026-001" value={form.uputnicaBroj}
                                        onChange={e => setField('uputnicaBroj', e.target.value)} />
                                </div>
                            </div>

                            {/* Dates */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Datum pregleda *' : 'Exam Date *'}</label>
                                    <input type="date" className="form-input" value={form.datumPregleda}
                                        onChange={e => setField('datumPregleda', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {form.tipPregleda === 'nočni_rad'
                                            ? (bs ? 'Naredni pregled do (max 2 godine)' : 'Next exam by (max 2 years)')
                                            : (bs ? 'Naredni pregled do' : 'Next Exam Due By')}
                                    </label>
                                    <input type="date" className="form-input" value={form.vrijediDo}
                                        onChange={e => setField('vrijediDo', e.target.value)} />
                                </div>
                            </div>

                            {/* Result */}
                            <div className="form-group">
                                <label className="form-label">{bs ? 'Rezultat pregleda *' : 'Exam Result *'}</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {RESULTS.map(r => (
                                        <button key={r.value}
                                            type="button"
                                            onClick={() => setField('rezultat', r.value)}
                                            style={{
                                                flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-md)',
                                                border: `2px solid ${form.rezultat === r.value ? r.color : 'var(--border)'}`,
                                                background: form.rezultat === r.value ? r.color + '18' : 'var(--bg-input)',
                                                color: form.rezultat === r.value ? r.color : 'var(--text)',
                                                fontWeight: form.rezultat === r.value ? 700 : 400,
                                                cursor: 'pointer', fontSize: '0.82rem', transition: 'all 0.15s',
                                            }}>
                                            {form.rezultat === r.value ? '✓ ' : ''}{bs ? r.labelBs : r.labelEn}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* If Nesposoban or Uvjetno — show restrictions */}
                            {(form.rezultat === 'Nesposoban' || form.rezultat === 'Uvjetno Sposoban') && (
                                <div className="form-group">
                                    <label className="form-label" style={{ color: 'var(--warning)' }}>
                                        ⚠️ {bs ? 'Ograničenja / razlog nesposobnosti' : 'Restrictions / unfitness reason'}
                                    </label>
                                    <textarea className="form-input" rows={2} value={form.ogranicenja}
                                        placeholder={bs ? 'Npr. Zabranjeno dizanje tereta iznad 20kg...' : 'E.g. No lifting over 20kg...'}
                                        onChange={e => setField('ogranicenja', e.target.value)} />
                                </div>
                            )}

                            {/* Institution + Doctor */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">🏥 {bs ? 'Zdravstvena ustanova' : 'Health Institution'}</label>
                                    <input className="form-input" placeholder={bs ? 'Dom zdravlja / Klinika...' : 'Health center / Clinic...'}
                                        value={form.zdravstvenaUstanova} onChange={e => setField('zdravstvenaUstanova', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">👨‍⚕️ {bs ? 'Doktor medicine rada' : 'Occupational Medicine Doctor'}</label>
                                    <input className="form-input" list="doc-list" placeholder="Dr. Ime Prezime"
                                        value={form.doktorIme} onChange={e => setField('doktorIme', e.target.value)} />
                                    <datalist id="doc-list">
                                        {doctors.map(d => <option key={d.id} value={d.ime}>{d.specijalizacija}</option>)}
                                    </datalist>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="form-group">
                                <label className="form-label">{bs ? 'Napomena' : 'Note'}</label>
                                <textarea className="form-input" rows={2} value={form.napomena}
                                    placeholder={bs ? 'Dodatne napomene...' : 'Additional notes...'}
                                    onChange={e => setField('napomena', e.target.value)} />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>
                                {bs ? 'Odustani' : 'Cancel'}
                            </button>
                            <button className="btn btn-outline btn-sm" style={{ marginRight: 'auto' }}
                                onClick={() => router.push('/dashboard/referral-ra1')}>
                                📋 {bs ? 'Nova uputnica RA-1' : 'New RA-1 Referral'}
                            </button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                💾 {bs ? 'Sačuvaj' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
