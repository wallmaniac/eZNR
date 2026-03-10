'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, getById, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import WorkerProfileModal from '@/components/WorkerProfileModal';

const MONTHS_BS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EMPTY_COMPANY = { naziv: '', adresa: '', jib: '', odgovornaOsoba: '', telefon: '', email: '' };

export default function AnnualInjuriesPage() {
  const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { markDirty, markClean } = useUnsavedChanges();
  const currentYear = new Date().getFullYear();

  // ── Core state ──
  const [year, setYear] = useState(String(currentYear));
  const [injuries, setInjuries] = useState([]);
  const [tab, setTab] = useState('dopis');
  const [viewWorkerId, setViewWorkerId] = useState(null);

  // ── Report persistence ──
  const [savedReports, setSavedReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null); // currently open saved report
  const [generated, setGenerated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'editor'

  // ── Company info (editable) ──
  const [companyInfo, setCompanyInfo] = useState({ ...EMPTY_COMPANY });

  // ── Load data ──
  const loadData = useCallback(() => {
    setInjuries(getAll(COLLECTIONS.INJURIES));
    setSavedReports(getAll(COLLECTIONS.ANNUAL_REPORTS));
    try {
      const stored = localStorage.getItem('eznr_company');
      if (stored) {
        const c = JSON.parse(stored);
        setCompanyInfo(prev => ({
          naziv: c.naziv || c.name || prev.naziv,
          adresa: c.adresa || c.address || prev.adresa,
          jib: c.jib || c.id || prev.jib,
          odgovornaOsoba: c.odgovornaOsoba || c.contactPerson || prev.odgovornaOsoba,
          telefon: c.telefon || c.phone || prev.telefon,
          email: c.email || prev.email,
        }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Years dropdown: include current year ──
  const years = useMemo(() => {
    const yrs = [];
    for (let y = currentYear; y >= currentYear - 4; y--) yrs.push(y);
    return yrs;
  }, [currentYear]);

  // ── Computed injury data ──
  const yearInjuries = useMemo(() =>
    injuries.filter(inj => inj.datum && new Date(inj.datum).getFullYear() === Number(year)),
    [injuries, year]);

  const byMonth = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const mi = yearInjuries.filter(inj => new Date(inj.datum).getMonth() === i);
      return {
        month: i,
        laka: mi.filter(x => x.tip === 'laka' || !x.tip).length,
        teska: mi.filter(x => x.tip === 'teska').length,
        smrtna: mi.filter(x => x.tip === 'smrtna').length,
        kolektivna: mi.filter(x => x.kolektivna).length,
        bolovanje: mi.filter(x => x.bolovanje).length,
        items: mi,
      };
    }), [yearInjuries]);

  const totals = useMemo(() => ({
    laka: byMonth.reduce((s, m) => s + m.laka, 0),
    teska: byMonth.reduce((s, m) => s + m.teska, 0),
    smrtna: byMonth.reduce((s, m) => s + m.smrtna, 0),
    kolektivna: byMonth.reduce((s, m) => s + m.kolektivna, 0),
    bolovanje: byMonth.reduce((s, m) => s + m.bolovanje, 0),
  }), [byMonth]);

  const smrtnePovreda = useMemo(() => yearInjuries.filter(x => x.tip === 'smrtna'), [yearInjuries]);
  const teskePovreda = useMemo(() => yearInjuries.filter(x => x.tip === 'teska'), [yearInjuries]);
  const kolektivnePovreda = useMemo(() => yearInjuries.filter(x => x.kolektivna), [yearInjuries]);

  const MONTHS = lang === 'bs' ? MONTHS_BS : MONTHS_EN;
  const deadline = `15. januar ${Number(year) + 1}. godine`;

  // ── Saved reports for the selected year ──
  const reportsForYear = useMemo(() =>
    savedReports.filter(r => r.year === year).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [savedReports, year]);

  // ── Dirty tracking ──
  const handleCompanyChange = (key, val) => {
    setCompanyInfo(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
    markDirty();
  };

  // ── Generate new report ──
  const handleGenerate = async () => {
    if (isDirty) {
      const ok = await confirm(lang === 'bs'
        ? 'Imate nesačuvane promjene. Generisanje novog izvještaja će resetovati podatke. Nastaviti?'
        : 'You have unsaved changes. Generating a new report will reset the data. Continue?');
      if (!ok) return;
    }
    setActiveReportId(null);
    setGenerated(true);
    setIsDirty(false);
    markClean();
    setView('editor');
    setTab('dopis');
  };

  // ── Save report ──
  const handleSaveReport = async () => {
    const reportData = {
      year,
      companyInfo,
      tab,
      // Snapshot of injury stats at save time
      totalInjuries: yearInjuries.length,
      totals: { ...totals },
      savedAt: new Date().toISOString(),
    };

    if (activeReportId) {
      update(COLLECTIONS.ANNUAL_REPORTS, activeReportId, reportData);
    } else {
      const created = create(COLLECTIONS.ANNUAL_REPORTS, reportData);
      setActiveReportId(created.id);
    }
    setIsDirty(false);
    markClean();
    setSavedReports(getAll(COLLECTIONS.ANNUAL_REPORTS));
    await alert(lang === 'bs' ? '✅ Izvještaj uspješno sačuvan!' : '✅ Report saved successfully!');
  };

  // ── Load saved report ──
  const handleLoadReport = (report) => {
    setYear(report.year);
    if (report.companyInfo) setCompanyInfo({ ...EMPTY_COMPANY, ...report.companyInfo });
    setActiveReportId(report.id);
    setGenerated(true);
    setIsDirty(false);
    markClean();
    setView('editor');
    setTab('dopis');
  };

  // ── Delete saved report ──
  const handleDeleteReport = async (id) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati sačuvan izvještaj?' : 'Delete this saved report?');
    if (!ok) return;
    remove(COLLECTIONS.ANNUAL_REPORTS, id);
    setSavedReports(getAll(COLLECTIONS.ANNUAL_REPORTS));
    if (activeReportId === id) {
      setActiveReportId(null);
      setGenerated(false);
      setView('list');
    }
  };

  // ── Back to list with unsaved check ──
  const handleBackToList = async () => {
    if (isDirty) {
      const ok = await confirm(lang === 'bs'
        ? 'Imate nesačuvane promjene. Želite li sačuvati izvještaj prije napuštanja?'
        : 'You have unsaved changes. Would you like to save the report before leaving?');
      if (ok) {
        await handleSaveReport();
      }
    }
    setView('list');
    setGenerated(false);
    setIsDirty(false);
    markClean();
  };

  const tipBadge = (tip) => {
    const map = {
      laka: { color: '#F59E0B', label: 'Laka' },
      teska: { color: '#EF4444', label: 'Teška' },
      smrtna: { color: '#7C3AED', label: 'Smrtna' },
    };
    const s = map[tip] || map.laka;
    return <span style={{ color: s.color, fontWeight: 700, fontSize: '0.78rem' }}>{s.label}</span>;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // LIST VIEW — shows saved reports + generate button
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'list') {
    return (
      <>
        <DialogRenderer />
        <div className="animate-fadeIn">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>📈 {t('annualInjuryReport')}</h1>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="form-select" style={{ minWidth: 120 }} value={year} onChange={e => setYear(e.target.value)}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleGenerate}>
                + {lang === 'bs' ? 'Generiši novi izvještaj' : 'Generate new report'}
              </button>
            </div>
          </div>

          {/* Deadline reminder */}
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>⏰</span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
              <strong>Rok za dostavu:</strong> Godišnji izvještaj o povredama na radu dostavlja se <strong>Kantonalnoj inspekciji ZNR</strong> do <strong>{deadline}</strong>.
            </span>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Ukupno', value: yearInjuries.length, color: 'var(--primary)' },
              { label: 'Lake', value: totals.laka, color: '#F59E0B' },
              { label: 'Teške', value: totals.teska, color: '#EF4444' },
              { label: 'Smrtne', value: totals.smrtna, color: '#7C3AED' },
              { label: 'Kolektivne', value: totals.kolektivna, color: '#10B981' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ textAlign: 'center' }}>
                <div className="card-body" style={{ padding: '12px 8px' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label} ({year})</div>
                </div>
              </div>
            ))}
          </div>

          {/* Saved reports list */}
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
                {lang === 'bs' ? 'Sačuvani izvještaji' : 'Saved reports'} ({savedReports.length})
              </div>

              {savedReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
                  <p>{lang === 'bs' ? 'Nema sačuvanih izvještaja.' : 'No saved reports.'}</p>
                  <p style={{ fontSize: '0.82rem', marginTop: 8 }}>{lang === 'bs' ? 'Odaberite godinu i kliknite "Generiši novi izvještaj" za kreiranje.' : 'Select a year and click "Generate new report" to create one.'}</p>
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{lang === 'bs' ? 'Akcije' : 'Actions'}</th>
                        <th>{lang === 'bs' ? 'Godina' : 'Year'}</th>
                        <th>{lang === 'bs' ? 'Firma' : 'Company'}</th>
                        <th>{lang === 'bs' ? 'Povreda' : 'Injuries'}</th>
                        <th>{lang === 'bs' ? 'Sačuvano' : 'Saved'}</th>
                        <th>{lang === 'bs' ? 'Zadnja izmjena' : 'Last modified'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedReports.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(r => (
                        <tr key={r.id}>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Otvori' : 'Open'} onClick={() => handleLoadReport(r)}>📄</button>
                              <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Isprintaj' : 'Print'} onClick={() => { handleLoadReport(r); setTimeout(() => window.print(), 500); }}>🖨️</button>
                              <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={lang === 'bs' ? 'Obriši' : 'Delete'} onClick={() => handleDeleteReport(r.id)}>🗑️</button>
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, fontSize: '1rem' }}>{r.year}</td>
                          <td>{r.companyInfo?.naziv || '—'}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.totalInjuries || 0}</span>
                            {r.totals && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>({r.totals.laka || 0}L / {r.totals.teska || 0}T / {r.totals.smrtna || 0}S)</span>}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{r.savedAt ? new Date(r.savedAt).toLocaleDateString('bs-BA') : '—'}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString('bs-BA', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EDITOR VIEW — the generated report
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <DialogRenderer />
      <div className="animate-fadeIn">
        {/* Print styles */}
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            body { background: white !important; color: black !important; }
            .card { box-shadow: none !important; border: 1px solid #ccc !important; }
            .dopis-letter { border: 2px solid #000 !important; padding: 32px !important; }
          }
          .print-only { display: none; }
        `}</style>

        {/* Header bar */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleBackToList} style={{ fontSize: '0.85rem' }}>
            ← {lang === 'bs' ? 'Nazad na listu' : 'Back to list'}
          </button>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>📈 {t('annualInjuryReport')} — {year}.</h1>
          {activeReportId && <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>💾 {lang === 'bs' ? 'Sačuvano' : 'Saved'}</span>}
          {isDirty && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>● {lang === 'bs' ? 'Nesačuvano' : 'Unsaved'}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSaveReport}>
              💾 {lang === 'bs' ? 'Sačuvaj izvještaj' : 'Save report'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
              🖨️ {lang === 'bs' ? 'Isprintaj / PDF' : 'Print / PDF'}
            </button>
          </div>
        </div>

        {/* Deadline */}
        <div className="no-print" style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>⏰</span>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
            <strong>Rok za dostavu:</strong> Godišnji izvještaj dostavlja se <strong>Kantonalnoj inspekciji ZNR</strong> do <strong>{deadline}</strong>.
          </span>
        </div>

        {/* Tabs */}
        <div className="no-print" style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
          {[
            { key: 'dopis', label: '📄 Dopis / Zvanični izvještaj' },
            { key: 'stats', label: '📊 Statistika po mjesecima' },
          ].map(tab_ => (
            <button key={tab_.key} onClick={() => setTab(tab_.key)}
              style={{ padding: '8px 20px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: tab === tab_.key ? 700 : 400,
                background: tab === tab_.key ? 'var(--primary)' : 'var(--bg-card)',
                color: tab === tab_.key ? '#fff' : 'var(--text)' }}>
              {tab_.label}
            </button>
          ))}
        </div>

        {tab === 'dopis' ? (
          <>
            {/* Company info form */}
            <div className="card no-print" style={{ marginBottom: 20 }}>
              <div className="card-body">
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 12 }}>
                  Podaci poslodavca (za zaglavlje dopisa)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { key: 'naziv', label: 'Naziv firme / poslodavca' },
                    { key: 'adresa', label: 'Adresa sjedišta' },
                    { key: 'jib', label: 'JIB / ID broj' },
                    { key: 'odgovornaOsoba', label: 'Odgovorna osoba (ime i prezime)' },
                    { key: 'telefon', label: 'Telefon' },
                    { key: 'email', label: 'Email' },
                  ].map(f => (
                    <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>{f.label}</label>
                      <input className="form-input" value={companyInfo[f.key]} onChange={e => handleCompanyChange(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── THE OFFICIAL LETTER / DOPIS ─── */}
            <div className="card dopis-letter" style={{ marginBottom: 20 }}>
              <div className="card-body" style={{ fontFamily: 'Georgia, serif', color: '#111', lineHeight: 1.7, maxWidth: 900, margin: '0 auto' }}>
                {/* Sender */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{companyInfo.naziv || '[Naziv firme]'}</div>
                  <div>{companyInfo.adresa || '[Adresa]'}</div>
                  {companyInfo.jib && <div>JIB: {companyInfo.jib}</div>}
                  {companyInfo.telefon && <div>Tel: {companyInfo.telefon}</div>}
                  {companyInfo.email && <div>Email: {companyInfo.email}</div>}
                </div>

                {/* Date + number */}
                <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>Broj: _____ / {Number(year) + 1}</div>
                  <div>Datum: _________________________</div>
                </div>

                {/* Recipient */}
                <div style={{ marginBottom: 24, paddingLeft: 40 }}>
                  <div style={{ fontWeight: 700 }}>KANTONALNA INSPEKCIJA ZNR</div>
                  <div>(Nadležna kantonalna inspekcija zaštite na radu)</div>
                </div>

                {/* Subject */}
                <div style={{ marginBottom: 20 }}>
                  <strong>Predmet: Godišnji izvještaj o povredama na radu za {year}. godinu</strong>
                </div>

                {/* Body */}
                <div style={{ marginBottom: 20 }}>
                  <p>Poštovani,</p>
                  <p>
                    U skladu sa odredbama Zakona o zaštiti na radu, dostavljamo Vam godišnji izvještaj o
                    povredama na radu za <strong>{year}. godinu</strong>, za privredni subjekt{' '}
                    <strong>{companyInfo.naziv || '[Naziv firme]'}</strong>.
                  </p>
                  <p>
                    U navedenom periodu evidentirano je ukupno <strong>{yearInjuries.length}</strong> povreda na radu,
                    od čega: <strong>{totals.laka}</strong> lakih,{' '}
                    <strong>{totals.teska}</strong> teških,{' '}
                    <strong>{totals.smrtna}</strong> smrtnih i{' '}
                    <strong>{totals.kolektivna}</strong> kolektivnih.
                  </p>
                  <p>
                    Detaljan pregled povreda na radu sa smrtnom, teškom i kolektivnom posljedicom dat je u
                    tabeli u prilogu ovog dopisa.
                  </p>
                  <p>Ostajemo na Vašem raspolaganju za sva dodatna pojašnjenja.</p>
                </div>

                {/* Signature */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, flexWrap: 'wrap', gap: 24 }}>
                  <div>
                    <div>S poštovanjem,</div>
                    <div style={{ marginTop: 40, borderTop: '1px solid #000', minWidth: 200, paddingTop: 4, textAlign: 'center', fontSize: '0.85rem' }}>
                      {companyInfo.odgovornaOsoba || 'Odgovorna osoba / Stručnjak ZNR'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ marginTop: 40, borderTop: '1px solid #000', minWidth: 200, paddingTop: 4, textAlign: 'center', fontSize: '0.85rem' }}>
                      Pečat i potpis
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── OFFICIAL TABLE ─── */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-body">
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4, textAlign: 'center', fontFamily: 'Georgia, serif' }}>
                  PRILOG: Pregled povreda na radu sa smrtnom, teškom ili kolektivnom posljedicom — {year}. godina
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>
                  Naziv poslodavca: <strong>{companyInfo.naziv || '___________________'}</strong>
                </div>

                <div className="data-table-wrapper">
                  <table className="data-table" style={{ fontSize: '0.8rem', fontFamily: 'Georgia, serif' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', minWidth: 40 }}>Rb.</th>
                        <th colSpan={3} style={{ textAlign: 'center', background: 'rgba(239,68,68,0.08)' }}>
                          Povreda na radu sa smrtnom posljedicom
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', minWidth: 160 }}>
                          Lični podaci stradalih<br/><span style={{ fontWeight: 400, fontSize: '0.72rem' }}>(ime i prezime, datum rod., spol)</span>
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', minWidth: 160 }}>
                          Datum i mjesto nesreće / povrede
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', minWidth: 160 }}>
                          Uzroci pojave, sadišta teške ili kolektivne povrede rada
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', minWidth: 160 }}>
                          Prijava MUP stanici i Kantonalnoj inspekciji (broj i datum)
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', minWidth: 120 }}>
                          Napomena
                        </th>
                      </tr>
                      <tr>
                        <th style={{ textAlign: 'center', background: 'rgba(239,68,68,0.05)', fontSize: '0.72rem' }}>Pojedinačna</th>
                        <th style={{ textAlign: 'center', background: 'rgba(239,68,68,0.05)', fontSize: '0.72rem' }}>Kolektivna</th>
                        <th style={{ textAlign: 'center', background: 'rgba(239,68,68,0.05)', fontSize: '0.72rem' }}>Broj stradalih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {smrtnePovreda.length === 0 && teskePovreda.length === 0 && kolektivnePovreda.length === 0 ? (
                        <>
                          {[1, 2, 3].map(i => (
                            <tr key={i} style={{ height: 48 }}>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i}</td>
                              <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px', fontStyle: 'italic', fontSize: '0.82rem' }}>
                              ✅ Nije evidentirano povreda sa smrtnom, teškom ili kolektivnom posljedicom za {year}. godinu.
                            </td>
                          </tr>
                        </>
                      ) : [...smrtnePovreda, ...teskePovreda, ...kolektivnePovreda]
                          .filter((inj, idx, arr) => arr.findIndex(x => x.id === inj.id) === idx) // deduplicate
                          .map((inj, idx) => {
                        const isSmrtna = inj.tip === 'smrtna';
                        const isKolektivna = inj.kolektivna;
                        // Try to get worker details for richer data
                        const worker = inj.radnikId ? (() => { try { return getById(COLLECTIONS.WORKERS, inj.radnikId); } catch { return null; } })() : null;
                        const workerInfo = worker
                          ? `${worker.ime} ${worker.prezime}${worker.datumRodenja ? `, ${new Date(worker.datumRodenja).toLocaleDateString('bs-BA')}` : ''}${worker.spol ? `, ${worker.spol}` : ''}`
                          : (inj.radnikIme || '—');
                        return (
                          <tr key={inj.id}>
                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ textAlign: 'center' }}>{isSmrtna && !isKolektivna ? '✓' : ''}</td>
                            <td style={{ textAlign: 'center' }}>{isKolektivna ? '✓' : ''}</td>
                            <td style={{ textAlign: 'center' }}>{isKolektivna ? (inj.brojStradalih || '—') : (isSmrtna ? '1' : '')}</td>
                            <td>{workerInfo}</td>
                            <td>
                              {inj.datum ? new Date(inj.datum).toLocaleDateString('bs-BA') : '—'}
                              {inj.lokacija ? `, ${inj.lokacija}` : ''}
                            </td>
                            <td style={{ maxWidth: 180, fontSize: '0.75rem' }}>{inj.uzrokPovrede || inj.opisPovrede || '—'}</td>
                            <td style={{ fontSize: '0.75rem' }}>{inj.prijavaOrgan || '—'}</td>
                            <td style={{ fontSize: '0.75rem' }}>{inj.napomena || '—'}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: 'var(--bg-table-header)', fontWeight: 700 }}>
                        <td colSpan={2} style={{ textAlign: 'right', fontStyle: 'italic' }}>Ukupno:</td>
                        <td style={{ textAlign: 'center' }}>{totals.kolektivna}</td>
                        <td style={{ textAlign: 'center' }}>{totals.smrtna + totals.kolektivna}</td>
                        <td colSpan={5}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ─── STATS TAB ─── */
          <>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Ukupno', value: yearInjuries.length, color: 'var(--primary)' },
                { label: 'Lake', value: totals.laka, color: '#F59E0B' },
                { label: 'Teške', value: totals.teska, color: '#EF4444' },
                { label: 'Smrtne', value: totals.smrtna, color: '#7C3AED' },
                { label: 'Kolektivne', value: totals.kolektivna, color: '#10B981' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ textAlign: 'center' }}>
                  <div className="card-body" style={{ padding: '12px 8px' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly table */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-body">
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mjesec</th>
                        <th>Lake</th>
                        <th>Teške</th>
                        <th>Smrtne</th>
                        <th>Kolektivne</th>
                        <th>Ukupno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byMonth.map(m => (
                        <tr key={m.month}>
                          <td style={{ fontWeight: 600 }}>{MONTHS[m.month]}</td>
                          <td>{m.laka > 0 ? <span style={{ color: '#F59E0B', fontWeight: 700 }}>{m.laka}</span> : '0'}</td>
                          <td>{m.teska > 0 ? <span style={{ color: '#EF4444', fontWeight: 700 }}>{m.teska}</span> : '0'}</td>
                          <td>{m.smrtna > 0 ? <span style={{ color: '#7C3AED', fontWeight: 700 }}>{m.smrtna}</span> : '0'}</td>
                          <td>{m.kolektivna > 0 ? <span style={{ color: '#10B981', fontWeight: 700 }}>{m.kolektivna}</span> : '0'}</td>
                          <td><strong>{m.laka + m.teska + m.smrtna}</strong></td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--bg-table-header)', fontWeight: 700 }}>
                        <td>Ukupno</td>
                        <td style={{ color: '#F59E0B' }}>{totals.laka}</td>
                        <td style={{ color: '#EF4444' }}>{totals.teska}</td>
                        <td style={{ color: '#7C3AED' }}>{totals.smrtna}</td>
                        <td style={{ color: '#10B981' }}>{totals.kolektivna}</td>
                        <td style={{ color: 'var(--primary)' }}>{totals.laka + totals.teska + totals.smrtna}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Detail injury list */}
            {yearInjuries.length > 0 && (
              <div className="card">
                <div className="card-body">
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
                    Pregled svih povreda ({yearInjuries.length})
                  </div>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rb.</th>
                          <th>Radnik</th>
                          <th>Datum</th>
                          <th>Tip</th>
                          <th>Lokacija</th>
                          <th>Uzrok</th>
                          <th>Bolovanje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearInjuries.map((inj, idx) => (
                          <tr key={inj.id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>
                              <button
                                onClick={() => { if (inj.radnikId) setViewWorkerId(inj.radnikId); }}
                                style={{ background: 'none', border: 'none', cursor: inj.radnikId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: inj.radnikId ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                              >{inj.radnikIme || '—'}</button>
                            </td>
                            <td>{inj.datum ? new Date(inj.datum).toLocaleDateString('bs-BA') : '—'}</td>
                            <td>{tipBadge(inj.tip)}</td>
                            <td>{inj.lokacija || '—'}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inj.uzrokPovrede || inj.opisPovrede || '—'}</td>
                            <td style={{ textAlign: 'center' }}>{inj.bolovanje ? '✅' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {yearInjuries.length === 0 && (
              <div style={{ marginTop: 24, textAlign: 'center', padding: 32, color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                ✅ Nema prijavljenih povreda za {year}. godinu.
              </div>
            )}
          </>
        )}

        {viewWorkerId && (
          <WorkerProfileModal
            workerId={viewWorkerId}
            onClose={() => setViewWorkerId(null)}
            onSaved={() => setViewWorkerId(null)}
          />
        )}
      </div>
    </>
  );
}
