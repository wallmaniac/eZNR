'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';

const MONTHS_BS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AnnualInjuriesPage() {
  const { t, lang } = useLanguage();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear - 1));
  const [injuries, setInjuries] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [viewWorkerId, setViewWorkerId] = useState(null);
  const [tab, setTab] = useState('dopis'); // 'dopis' | 'stats'

  // Company info (editable for letter header)
  const [companyInfo, setCompanyInfo] = useState({
    naziv: '',
    adresa: '',
    jib: '',
    odgovornaOsoba: '',
    telefon: '',
    email: '',
  });

  const load = useCallback(() => {
    setInjuries(getAll(COLLECTIONS.INJURIES));
    // Try loading company info from localStorage
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

  useEffect(() => { load(); }, [load]);

  const years = [currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

  const yearInjuries = injuries.filter(inj => {
    if (!inj.datum) return false;
    return new Date(inj.datum).getFullYear() === Number(year);
  });

  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const monthInjuries = yearInjuries.filter(inj => new Date(inj.datum).getMonth() === i);
    return {
      month: i,
      laka: monthInjuries.filter(x => x.tip === 'laka' || !x.tip).length,
      teska: monthInjuries.filter(x => x.tip === 'teska').length,
      smrtna: monthInjuries.filter(x => x.tip === 'smrtna').length,
      kolektivna: monthInjuries.filter(x => x.kolektivna).length,
      bolovanje: monthInjuries.filter(x => x.bolovanje).length,
      items: monthInjuries,
    };
  });

  const totals = {
    laka: byMonth.reduce((s, m) => s + m.laka, 0),
    teska: byMonth.reduce((s, m) => s + m.teska, 0),
    smrtna: byMonth.reduce((s, m) => s + m.smrtna, 0),
    kolektivna: byMonth.reduce((s, m) => s + m.kolektivna, 0),
    bolovanje: byMonth.reduce((s, m) => s + m.bolovanje, 0),
  };

  // Fatal injuries for the official table
  const smrtnePovreda = yearInjuries.filter(x => x.tip === 'smrtna');
  const teskePovreda = yearInjuries.filter(x => x.tip === 'teska');
  const kolektivnePovreda = yearInjuries.filter(x => x.kolektivna);

  const MONTHS = lang === 'bs' ? MONTHS_BS : MONTHS_EN;
  const deadline = `15. januar ${Number(year) + 1}. godine`;

  const tipBadge = (tip) => {
    const map = {
      laka: { color: '#F59E0B', label: 'Laka' },
      teska: { color: '#EF4444', label: 'Teška' },
      smrtna: { color: '#7C3AED', label: 'Smrtna' },
    };
    const s = map[tip] || map.laka;
    return <span style={{ color: s.color, fontWeight: 700, fontSize: '0.78rem' }}>{s.label}</span>;
  };

  return (
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

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>📈 {t('annualInjuryReport')}</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-select" style={{ minWidth: 120 }} value={year} onChange={e => { setYear(e.target.value); setGenerated(false); }}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => setGenerated(true)}>
            {lang === 'bs' ? '📋 Generiši izvještaj' : 'Generate Report'}
          </button>
          {generated && (
            <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
              🖨️ Isprintaj / Pošalji
            </button>
          )}
        </div>
      </div>

      {/* Deadline reminder */}
      <div className="no-print" style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1.2rem' }}>⏰</span>
        <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
          <strong>Rok za dostavu:</strong> Godišnji izvještaj o povredama na radu dostavlja se <strong>Kantonalnoj inspekciji ZNR</strong> do <strong>{deadline}</strong>.
        </span>
      </div>

      {/* Tabs */}
      {generated && (
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
      )}

      {!generated ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
            <p>Odaberite godinu i kliknite <strong>Generiši izvještaj</strong> za pripremu dopisa i izvještaja.</p>
            <p style={{ fontSize: '0.82rem', marginTop: 8 }}>Izvještaj se automatski popunjava podacima iz prijavljenih povreda na radu.</p>
          </div>
        </div>
      ) : tab === 'dopis' ? (
        <>
          {/* Company info form (no-print) */}
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
                    <input className="form-input" value={companyInfo[f.key]} onChange={e => setCompanyInfo(prev => ({ ...prev, [f.key]: e.target.value }))} />
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

          {/* ─── OFFICIAL TABLE (matching screenshot format) ─── */}
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
                        {/* Empty rows for manual entry / print */}
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
                    ) : [...smrtnePovreda, ...teskePovreda, ...kolektivnePovreda].map((inj, idx) => {
                      const isSmrtna = inj.tip === 'smrtna';
                      const isKolektivna = inj.kolektivna;
                      return (
                        <tr key={inj.id}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ textAlign: 'center' }}>{isSmrtna && !isKolektivna ? '✓' : ''}</td>
                          <td style={{ textAlign: 'center' }}>{isKolektivna ? '✓' : ''}</td>
                          <td style={{ textAlign: 'center' }}>{isKolektivna ? (inj.brojStradalih || '—') : (isSmrtna ? '1' : '')}</td>
                          <td>{inj.radnikIme || '—'}</td>
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
                    {/* Totals row */}
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

          {/* Detail list */}
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
                        <th>Opis</th>
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
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inj.opisPovrede || '—'}</td>
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
  );
}
