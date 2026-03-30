'use client';
import {  useState, useCallback, useMemo, useEffect  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAll, create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';

// ── Legal basis ────────────────────────────────────────────────────────────────
// Zakon o zaštiti na radu FBiH (Sl. novine FBiH br. 79/20)
// Pravilnik o postupku raspoređivanja radnika na poslove sa povećanim rizikom
//   i o postupku prethodnih i periodičnih ljekarskih pregleda (Sl. novine FBiH br. 9/23)
// ──────────────────────────────────────────────────────────────────────────────

const EXAM_TYPES = [
    { value: 'prethodni',   labelBs: 'Prethodni pregled',     labelEn: 'Pre-employment Exam',   info: 'Čl. 44. Zakona o ZNR FBiH — prije raspoređivanja na radno mjesto' },
    { value: 'periodični',  labelBs: 'Periodični pregled',    labelEn: 'Periodic Exam',          info: 'Prilog III Pravilnika (Sl. novine FBiH 9/23) — rokovi po vrsti opasnosti' },
    { value: 'vanredni',    labelBs: 'Vanredni pregled',      labelEn: 'Extraordinary Exam',     info: 'Nakon promjene zdravstvenog stanja, nesreće ili dugog bolovanja' },
    { value: 'nocniRad',    labelBs: 'Pregled - noćni rad',  labelEn: 'Night-work Exam',        info: 'Čl. 44. st. 3 — min. svake 2 godine za noćne radnike' },
    { value: 'ostalo',      labelBs: 'Ostalo',               labelEn: 'Other',                  info: '' },
];

const RESULTS = [
    { value: 'Sposoban',         labelBs: 'Sposoban',          labelEn: 'Fit',                color: 'var(--success)' },
    { value: 'Uvjetno Sposoban', labelBs: 'Uvjetno Sposoban',  labelEn: 'Conditionally Fit',  color: 'var(--warning)' },
    { value: 'Nesposoban',       labelBs: 'Nesposoban',        labelEn: 'Unfit',              color: 'var(--danger)' },
];

const getDays = (dateStr) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
};

const getStatusBadge = (exam) => {
    const d = getDays(exam.vrijediDo);
    if (d === null) return { label: 'Bez roka', color: 'var(--text-muted)', bg: 'var(--border-light)' };
    if (d < 0)    return { label: 'Isteklo',        color: 'white', bg: 'var(--danger)' };
    if (d <= 30)  return { label: `${d}d`,          color: 'white', bg: '#E65100' };
    if (d <= 90)  return { label: `${d}d`,          color: 'white', bg: 'var(--warning)' };
    return { label: 'Vrijedi',                       color: 'white', bg: 'var(--success)' };
};

const emptyForm = {
    workerId: '', tipPregleda: 'prethodni', datumPregleda: '', vrijediDo: '',
    rezultat: 'Sposoban', zdravstvenaUstanova: '', doktorIme: '',
    ogranicenja: '', napomena: '', uputnicaBroj: '',
};

export default function MedicalExamsPage() {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const bs = lang === 'bs';

    const [exams, setExams] = useState(() => getAll(COLLECTIONS.MEDICAL_EXAMS));
    const [workers] = useState(() => getAll(COLLECTIONS.WORKERS));
    const [doctors] = useState(() => getAll(COLLECTIONS.DOCTORS));

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [filterTab, setFilterTab] = useState('all');
    const [searchQ, setSearchQ] = useState('');
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const [selectedIds, setSelectedIds] = useState(new Set());

    const [isDirty, setIsDirty] = useState(false);
    const searchParams = useSearchParams();

    // Auto-open form from URL params (openNew=1) or session draft

  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(exams.map(x => x.id)));
    else setSelectedIds(new Set());
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const handleDuplicate = async (it) => {
    const copy = { ...it };
    delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    copy.datum = new Date().toISOString().split('T')[0];
    await create(COLLECTIONS.MEDICAL_EXAMS, copy);
    reload();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.MEDICAL_EXAMS, id);
      setSelectedIds(new Set());
      reload();
    }
  };

    useEffect(() => {
        if (typeof window === 'undefined') return;
        // 1. Restore sessionStorage draft (from RA-1 navigation)
        const draft = sessionStorage.getItem('eznr_draft_medexam');
        if (draft) {
            try {
                const d = JSON.parse(draft);
                setForm(d);
                setShowForm(true);
                setIsDirty(true);
                sessionStorage.removeItem('eznr_draft_medexam');
                return;
            } catch { sessionStorage.removeItem('eznr_draft_medexam'); }
        }
        // 2. Open new form from URL params (e.g. from Workers page)
        const openNew = searchParams.get('openNew');
        const workerIdParam = searchParams.get('workerId');
        if (openNew === '1') {
            setEditingId(null);
            setForm(prev => ({
                ...emptyForm,
                workerId: workerIdParam || '',
            }));
            setShowForm(true);
        }
        // 3. Open existing form
        const openId = searchParams.get('openId');
        if (openId && exams.length > 0 && !showForm) {
            const rec = exams.find(r => r.id === openId);
            if (rec) handleEdit(rec);
        }
    }, [searchParams, exams]);

    const reload = useCallback(() => setExams(getAll(COLLECTIONS.MEDICAL_EXAMS)), []);

    
    const setField = (k, v) => { setForm(p => ({ ...p, [k]: v })); setIsDirty(true); };

    // ── Stats ──────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        let expired = 0, soon = 0, valid = 0, noDeadline = 0;
        exams.forEach(e => {
            const d = getDays(e.vrijediDo);
            if (d === null) noDeadline++;
            else if (d < 0) expired++;
            else if (d <= 90) soon++;
            else valid++;
        });
        return { expired, soon, valid, noDeadline, total: exams.length };
    }, [exams]);

    // ── Filter & search ────────────────────────────────────────────────────────
    const enriched = useMemo(() => exams.map(e => {
        const w = workers.find(wk => wk.id === e.workerId);
        return { ...e, _workerName: w ? `${w.ime} ${w.prezime}` : '—' };
    }), [exams, workers]);

    const filtered = useMemo(() => {
        let list = enriched;
        if (searchQ) {
            const q = searchQ.toLowerCase();
            list = list.filter(e =>
                e._workerName.toLowerCase().includes(q) ||
                (e.zdravstvenaUstanova || '').toLowerCase().includes(q) ||
                (e.doktorIme || '').toLowerCase().includes(q)
            );
        }
        if (filterTab === 'expired') list = list.filter(e => { const d = getDays(e.vrijediDo); return d !== null && d < 0; });
        if (filterTab === 'soon')    list = list.filter(e => { const d = getDays(e.vrijediDo); return d !== null && d >= 0 && d <= 90; });
        if (filterTab === 'valid')   list = list.filter(e => { const d = getDays(e.vrijediDo); return d !== null && d > 90; });
        return list.sort((a, b) => {
            const da = getDays(a.vrijediDo) ?? 999999;
            const db = getDays(b.vrijediDo) ?? 999999;
            return da - db;
        });
    }, [enriched, filterTab, searchQ]);

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, '_workerName');

    // ── CRUD ───────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.workerId) { await alert(bs ? 'Odaberite radnika!' : 'Select a worker!'); return; }
        if (!form.datumPregleda) { await alert(bs ? 'Unesite datum pregleda!' : 'Enter exam date!'); return; }
        const w = workers.find(wk => wk.id === form.workerId);
        const payload = { ...form, radnikIme: w ? `${w.ime} ${w.prezime}` : '' };
        if (editingId) { update(COLLECTIONS.MEDICAL_EXAMS, editingId, payload); }
        else { create(COLLECTIONS.MEDICAL_EXAMS, payload); }
        reload();
        setShowForm(false);
        setEditingId(null);
        setForm({ ...emptyForm });
        setIsDirty(false);
        showFlash();
        sessionStorage.removeItem('eznr_draft_medexam');
        // Return to worker page if we came from there
        const returnTo = searchParams.get('returnTo');
        const wId = searchParams.get('workerId');
        if (returnTo === 'worker' && wId) {
            router.push('/dashboard/workers?openWorker=' + encodeURIComponent(wId));
        }
    };

    const handleEdit = (exam) => {
        setEditingId(exam.id);
        setForm({ workerId: exam.workerId || '', tipPregleda: exam.tipPregleda || 'prethodni', datumPregleda: exam.datumPregleda || '', vrijediDo: exam.vrijediDo || '', rezultat: exam.rezultat || 'Sposoban', zdravstvenaUstanova: exam.zdravstvenaUstanova || '', doktorIme: exam.doktorIme || '', ogranicenja: exam.ogranicenja || '', napomena: exam.napomena || '', uputnicaBroj: exam.uputnicaBroj || '' });
        setShowForm(true);
    };

    const handleDelete = async (exam) => {
        if (await confirm(bs ? `Obrisati pregled za ${exam._workerName}?` : `Delete exam for ${exam._workerName}?`))
        { remove(COLLECTIONS.MEDICAL_EXAMS, exam.id); reload(); }
    };

    const handleNew = () => { setEditingId(null); setForm({ ...emptyForm }); setShowForm(true); };

    const examTypeLabel = (v) => EXAM_TYPES.find(t => t.value === v)?.[bs ? 'labelBs' : 'labelEn'] || v;
    const resultColor = (v) => RESULTS.find(r => r.value === v)?.color || 'var(--text)';
    const resultLabel = (v) => RESULTS.find(r => r.value === v)?.[bs ? 'labelBs' : 'labelEn'] || v;

    const tabs = [
        { key: 'all',     label: bs ? `Svi (${stats.total})` : `All (${stats.total})` },
        { key: 'expired', label: bs ? `Isteklo (${stats.expired})` : `Expired (${stats.expired})`,  col: 'var(--danger)' },
        { key: 'soon',    label: bs ? `Uskoro (${stats.soon})` : `Soon (${stats.soon})`,            col: 'var(--warning)' },
        { key: 'valid',   label: bs ? `Vrijedi (${stats.valid})` : `Valid (${stats.valid})`,        col: 'var(--success)' },
    ];

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />

            {/* ── Page header — emoji + title only, NO button here ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: '1.6rem' }}>👨‍⚕️</span>
                <div>
                    <h1 style={{ margin: 0 }}>{bs ? 'Ljekarski pregledi' : 'Medical Examinations'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {stats.total} {bs ? 'zapisa' : 'records'} · {bs ? 'Zakon o ZNR FBiH (79/20) + Pravilnik (9/23)' : 'BiH OSH Law (79/20) + Rulebook (9/23)'}
                    </p>
                </div>
            </div>

            {/* ── Toolbar: New button LEFT, search RIGHT ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" id="btn-new-exam" onClick={handleNew}>
                    + {bs ? 'Novi pregled' : 'New Exam'}
                </button>
                <div className="search-bar" style={{ flex: 1, maxWidth: 380, display: 'flex', alignItems: 'center' }}>
                    <input
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.85rem', flex: 1, width: '100%' }}
                        placeholder={bs ? 'Pretraži radnika, doktora, ustanovu...' : 'Search worker, doctor, institution...'}
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                    {searchQ && <button className="btn btn-ghost btn-sm" onClick={() => setSearchQ('')}>✕</button>}
                </div>
                {/* Stat chips */}
                {stats.expired > 0 && (
                    <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 20, background: 'var(--danger)', color: 'white', fontWeight: 700 }}>
                        ⚠️ {stats.expired} {bs ? 'isteklo' : 'expired'}
                    </span>
                )}
                {stats.soon > 0 && (
                    <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', fontWeight: 700, border: '1px solid var(--warning)' }}>
                        🕐 {stats.soon} {bs ? 'uskoro' : 'due soon'}
                    </span>
                )}
                
            {/* ── Grupne akcije bar ── */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {selectedIds.size} {bs ? 'odabrano' : 'selected'} &mdash; Grupne akcije:
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ {bs ? 'Isprintaj' : 'Print'}</button>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
              </div>
            )}
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{exams.length} {bs ? 'zapisa' : 'records'}</span>}
            </div>

            {/* ── Filter tabs ── */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={filterTab === tab.key ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                        style={tab.col && filterTab !== tab.key ? { borderColor: tab.col, color: tab.col } : {}}
                        onClick={() => setFilterTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Legal tip ── */}
            <div style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 12, background: 'rgba(33,150,243,0.05)', border: '1px solid rgba(33,150,243,0.18)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text)' }}>⚖️</strong>{' '}
                {bs
                    ? 'Preglede obavlja specijalist medicine rada. Radnik koji ne obavi periodični pregled ne može nastaviti s radom. Troškove snosi poslodavac (čl. 44. ZZNA 79/20).'
                    : 'Exams performed by occupational medicine specialist. Workers who skip periodic exams cannot continue working. Costs paid by employer (Art. 44 OSH Law 79/20).'}
            </div>

            {/* ── Table ── */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="data-table-wrapper">
                        <table className="data-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={e => { if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id))); else setSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                                    <th style={{ width: 90 }}>{bs ? 'Akcije' : 'Actions'}</th>
                                    <th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{bs ? 'Radnik' : 'Worker'}{sortIcon('_workerName')}</th>
                                    <th onClick={() => toggleSort('tipPregleda')} style={thStyle('tipPregleda')}>{bs ? 'Vrsta pregleda' : 'Exam Type'}{sortIcon('tipPregleda')}</th>
                                    <th onClick={() => toggleSort('datumPregleda')} style={thStyle('datumPregleda')}>{bs ? 'Datum' : 'Date'}{sortIcon('datumPregleda')}</th>
                                    <th onClick={() => toggleSort('vrijediDo')} style={thStyle('vrijediDo')}>{bs ? 'Naredni pregled' : 'Next Exam'}{sortIcon('vrijediDo')}</th>
                                    <th>{bs ? 'Status' : 'Status'}</th>
                                    <th onClick={() => toggleSort('rezultat')} style={thStyle('rezultat')}>{bs ? 'Rezultat' : 'Result'}{sortIcon('rezultat')}</th>
                                    <th onClick={() => toggleSort('zdravstvenaUstanova')} style={thStyle('zdravstvenaUstanova')}>{bs ? 'Ustanova' : 'Institution'}{sortIcon('zdravstvenaUstanova')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.length === 0 && (
                                    <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>{bs ? 'Nema unesenih ljekarskih pregleda' : 'No medical exams recorded'}</td></tr>
                                )}
                                {sorted.map(exam => {
                                    const badge = getStatusBadge(exam);
                                    const days = getDays(exam.vrijediDo);
                                    const rowBg = days !== null && days < 0 ? 'rgba(239,68,68,0.04)' : days !== null && days <= 30 ? 'rgba(245,158,11,0.04)' : '';
                                    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
                                    return (
                                        <tr key={exam.id} style={{ background: rowBg, cursor: 'pointer' }} onClick={() => handleEdit(exam)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                                            <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                <input type="checkbox" checked={selectedIds.has(exam.id)} onChange={() => toggleOne(exam.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                            </td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div style={{ position: 'relative' }}>
                                                    <button className="btn btn-primary btn-sm" data-menu-trigger onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (actionMenuId === exam.id) { setActionMenuId(null); return; }
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                        const spaceAbove = rect.top - 8;
                                                        const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
                                                        setMenuPos(flipUp
                                                            ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                                                            : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                                                        );
                                                        setActionMenuId(exam.id);
                                                    }}>Akcije ▼</button>
                                                    {actionMenuId === exam.id && (
                                                      <>
                                                        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                                                        <div data-menu style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                            <button onClick={() => { setActionMenuId(null); handleEdit(exam); }} style={menuItemSt}>✏️ Otvori</button>
                                                            <button onClick={() => { setActionMenuId(null); handleDuplicate(exam); }} style={menuItemSt}>📋 Kopiraj</button>
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                            <button onClick={() => { setActionMenuId(null); handleDelete(exam); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Izbriši</button>
                                                        </div>
                                                      </>
                                                    )}
                                                </div>
                                            </td>
                                            <td><button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + exam.workerId); }}>{exam._workerName}</button></td>
                                            <td style={{ fontSize: '0.82rem' }}>{examTypeLabel(exam.tipPregleda)}</td>
                                            <td style={{ fontSize: '0.85rem' }}>{formatDate(exam.datumPregleda)}</td>
                                            <td style={{ fontSize: '0.85rem', fontWeight: days !== null && days < 0 ? 700 : 400, color: days !== null && days < 0 ? 'var(--danger)' : days !== null && days <= 90 ? 'var(--warning)' : 'inherit' }}>{exam.vrijediDo ? formatDate(exam.vrijediDo) : '—'}</td>
                                            <td><span className={`badge${badge.bg === 'var(--danger)' ? ' badge-danger' : badge.bg === 'var(--success)' ? ' badge-success' : badge.col === 'var(--warning)' ? ' badge-warning' : ''}`} style={{ background: badge.bg, color: badge.color, fontSize: '0.7rem' }}>{badge.label}</span></td>
                                            <td style={{ fontWeight: 600, color: resultColor(exam.rezultat), fontSize: '0.85rem' }}>{resultLabel(exam.rezultat)}</td>
                                            <td style={{ fontSize: '0.8rem', maxWidth: 180 }}>
                                                <div style={{ fontWeight: 600 }}>{exam.zdravstvenaUstanova || '—'}</div>
                                                {exam.doktorIme && <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>Dr. {exam.doktorIme}</div>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Periodicity note ── */}
            <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                📋 {bs
                    ? 'Rokovi periodičnih pregleda (Prilog III Pravilnika 9/23) razlikuju se po vrsti ojasnosti. Noćni radnici — min. svake 2 godine.'
                    : 'Periodic exam intervals (Annex III, Rulebook 9/23) vary by hazard type. Night workers — min. every 2 years.'}
            </div>

            {/* ── Form modal ── */}
            {showForm && (
                <div className="modal-overlay" onClick={() => { setShowForm(false); setEditingId(null); }}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #00695C, #00897B)' }}>
                            <h2 style={{ color: 'white', margin: 0 }}>
                                👨‍⚕️ {editingId ? (bs ? 'Uredi ljekarski pregled' : 'Edit Medical Exam') : (bs ? 'Novi ljekarski pregled' : 'New Medical Exam')}
                            </h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => { setShowForm(false); setEditingId(null); }}>✕</button>
                        </div>

                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(33,150,243,0.06)', border: '1px solid rgba(33,150,243,0.18)', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                                ⚖️ {bs ? 'Preglede obavlja specijalist medicine rada. Troškove snosi poslodavac (čl. 44. ZZNA 79/20).' : 'Exams performed by occupational medicine specialist. Employer bears costs (Art. 44 OSH Law 79/20).'}
                            </div>

                            <div className="form-group">
                                <label className="form-label">👷 {bs ? 'Radnik *' : 'Worker *'}</label>
                                <select className="form-select" value={form.workerId} onChange={e => setField('workerId', e.target.value)}>
                                    <option value="">{bs ? '— Odaberite radnika —' : '— Select worker —'}</option>
                                    {[...workers].filter(w => w.aktivan !== false).sort((a, b) => a.prezime.localeCompare(b.prezime)).map(w => (
                                        <option key={w.id} value={w.id}>{w.prezime} {w.ime}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Vrsta pregleda *' : 'Exam Type *'}</label>
                                    <select className="form-select" value={form.tipPregleda} onChange={e => setField('tipPregleda', e.target.value)}>
                                        {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{bs ? t.labelBs : t.labelEn}</option>)}
                                    </select>
                                    {EXAM_TYPES.find(t => t.value === form.tipPregleda)?.info && (
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>ℹ️ {EXAM_TYPES.find(t => t.value === form.tipPregleda).info}</div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Broj uputnice (RA-1)' : 'Referral No. (RA-1)'}</label>
                                    <input className="form-input" placeholder="RA1-2026-001" value={form.uputnicaBroj} onChange={e => setField('uputnicaBroj', e.target.value)} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Datum pregleda *' : 'Exam Date *'}</label>
                                    <input type="date" className="form-input" value={form.datumPregleda} onChange={e => setField('datumPregleda', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Naredni pregled do' : 'Next Exam Due By'}</label>
                                    <input type="date" className="form-input" value={form.vrijediDo} onChange={e => setField('vrijediDo', e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{bs ? 'Rezultat pregleda *' : 'Exam Result *'}</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {RESULTS.map(r => (
                                        <button key={r.value} type="button" onClick={() => setField('rezultat', r.value)}
                                            style={{ flex: 1, padding: '9px 8px', borderRadius: 'var(--radius-md)', border: `2px solid ${form.rezultat === r.value ? r.color : 'var(--border)'}`, background: form.rezultat === r.value ? r.color + '18' : 'var(--bg-input)', color: form.rezultat === r.value ? r.color : 'var(--text)', fontWeight: form.rezultat === r.value ? 700 : 400, cursor: 'pointer', fontSize: '0.82rem', transition: 'all 0.15s' }}>
                                            {form.rezultat === r.value ? '✓ ' : ''}{bs ? r.labelBs : r.labelEn}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(form.rezultat === 'Nesposoban' || form.rezultat === 'Uvjetno Sposoban') && (
                                <div className="form-group">
                                    <label className="form-label" style={{ color: 'var(--warning)' }}>⚠️ {bs ? 'Ograničenja / razlog nesposobnosti' : 'Restrictions / unfitness reason'}</label>
                                    <textarea className="form-input" rows={2} value={form.ogranicenja} placeholder={bs ? 'Npr. Zabranjeno dizanje tereta iznad 20kg...' : 'E.g. No lifting over 20kg...'} onChange={e => setField('ogranicenja', e.target.value)} />
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">🏥 {bs ? 'Zdravstvena ustanova' : 'Health Institution'}</label>
                                    <input className="form-input" placeholder={bs ? 'Dom zdravlja / Klinika...' : 'Health center...'} value={form.zdravstvenaUstanova} onChange={e => setField('zdravstvenaUstanova', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">👨‍⚕️ {bs ? 'Doktor medicine rada' : 'Occupational Doctor'}</label>
                                    <input className="form-input" list="doc-list-page" placeholder="Dr. Ime Prezime" value={form.doktorIme} onChange={e => setField('doktorIme', e.target.value)} />
                                    <datalist id="doc-list-page">{doctors.map(d => <option key={d.id} value={d.ime} />)}</datalist>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{bs ? 'Napomena' : 'Note'}</label>
                                <textarea className="form-input" rows={2} value={form.napomena} placeholder={bs ? 'Dodatne napomene...' : 'Additional notes...'} onChange={e => setField('napomena', e.target.value)} />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={async () => { if (isDirty) { const ok = await confirm(bs ? 'Imate nesačuvane podatke. Želite li odustati?' : 'You have unsaved data. Discard?'); if (!ok) return; } setShowForm(false); setEditingId(null); setIsDirty(false); }}>{bs ? 'Odustani' : 'Cancel'}</button>
                            <button className="btn btn-outline btn-sm" style={{ marginRight: 'auto' }} onClick={() => { sessionStorage.setItem('eznr_draft_medexam', JSON.stringify(form)); router.push('/dashboard/referral-ra1?openNew=1'); }}>
                                📋 {bs ? 'Nova uputnica RA-1' : 'New RA-1 Referral'}
                            </button>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {bs ? 'Sačuvaj' : 'Save'}</button>
                            <SavedFlash />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

