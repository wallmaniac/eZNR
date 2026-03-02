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
  const [year, setYear] = useState(String(currentYear));
  const [injuries, setInjuries] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [viewWorkerId, setViewWorkerId] = useState(null);

  const load = useCallback(() => {
    setInjuries(getAll(COLLECTIONS.INJURIES));
  }, []);

  useEffect(() => { load(); }, [load]);

  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  // Filter by selected year
  const yearInjuries = injuries.filter(inj => {
    if (!inj.datum) return false;
    return new Date(inj.datum).getFullYear() === Number(year);
  });

  // Group by month
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const monthInjuries = yearInjuries.filter(inj => new Date(inj.datum).getMonth() === i);
    return {
      month: i,
      laka: monthInjuries.filter(x => x.tip === 'laka' || !x.tip).length,
      teska: monthInjuries.filter(x => x.tip === 'teska').length,
      smrtna: monthInjuries.filter(x => x.tip === 'smrtna').length,
      bolovanje: monthInjuries.filter(x => x.bolovanje).length,
      items: monthInjuries,
    };
  });

  const totals = {
    laka: byMonth.reduce((s, m) => s + m.laka, 0),
    teska: byMonth.reduce((s, m) => s + m.teska, 0),
    smrtna: byMonth.reduce((s, m) => s + m.smrtna, 0),
    bolovanje: byMonth.reduce((s, m) => s + m.bolovanje, 0),
  };

  const MONTHS = lang === 'bs' ? MONTHS_BS : MONTHS_EN;

  const tipBadge = (tip) => {
    const map = {
      laka: { color: '#F59E0B', label: lang === 'bs' ? 'Laka' : 'Minor' },
      teska: { color: '#EF4444', label: lang === 'bs' ? 'Teška' : 'Severe' },
      smrtna: { color: '#7C3AED', label: lang === 'bs' ? 'Smrtna' : 'Fatal' },
    };
    const s = map[tip] || map.laka;
    return <span style={{ color: s.color, fontWeight: 700, fontSize: '0.78rem' }}>{s.label}</span>;
  };

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📈 {t('annualInjuryReport')}</h1>

      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: 4, display: 'block' }}>{lang === 'bs' ? 'Godina' : 'Year'}</label>
              <select className="form-select" style={{ minWidth: 120 }} value={year} onChange={e => { setYear(e.target.value); setGenerated(false); }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setGenerated(true)}>
              {lang === 'bs' ? 'Generiši' : 'Generate'}
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>🖨️ {t('print')}</button>
            </div>
          </div>

          {!generated ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              {lang === 'bs' ? 'Odaberite godinu i kliknite Generiši za prikaz izvještaja.' : 'Select a year and click Generate to view the report.'}
            </div>
          ) : (
            <>
              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: lang === 'bs' ? 'Ukupno' : 'Total', value: yearInjuries.length, color: 'var(--primary)' },
                  { label: lang === 'bs' ? 'Lake' : 'Minor', value: totals.laka, color: '#F59E0B' },
                  { label: lang === 'bs' ? 'Teške' : 'Severe', value: totals.teska, color: '#EF4444' },
                  { label: lang === 'bs' ? 'Smrtne' : 'Fatal', value: totals.smrtna, color: '#7C3AED' },
                  { label: lang === 'bs' ? 'S bolovanjem' : 'With sick leave', value: totals.bolovanje, color: '#10B981' },
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
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{lang === 'bs' ? 'Mjesec' : 'Month'}</th>
                      <th>{lang === 'bs' ? 'Lake' : 'Minor'}</th>
                      <th>{lang === 'bs' ? 'Teške' : 'Severe'}</th>
                      <th>{lang === 'bs' ? 'Smrtne' : 'Fatal'}</th>
                      <th>{lang === 'bs' ? 'Bolovanje' : 'Sick leave'}</th>
                      <th>{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMonth.map(m => (
                      <tr key={m.month}>
                        <td style={{ fontWeight: 600 }}>{MONTHS[m.month]}</td>
                        <td>{m.laka > 0 ? <span style={{ color: '#F59E0B', fontWeight: 700 }}>{m.laka}</span> : '0'}</td>
                        <td>{m.teska > 0 ? <span style={{ color: '#EF4444', fontWeight: 700 }}>{m.teska}</span> : '0'}</td>
                        <td>{m.smrtna > 0 ? <span style={{ color: '#7C3AED', fontWeight: 700 }}>{m.smrtna}</span> : '0'}</td>
                        <td>{m.bolovanje > 0 ? <span style={{ color: '#10B981', fontWeight: 700 }}>{m.bolovanje}</span> : '0'}</td>
                        <td><strong>{m.laka + m.teska + m.smrtna}</strong></td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--bg-table-header)', fontWeight: 700 }}>
                      <td>{t('total')}</td>
                      <td style={{ color: '#F59E0B' }}>{totals.laka}</td>
                      <td style={{ color: '#EF4444' }}>{totals.teska}</td>
                      <td style={{ color: '#7C3AED' }}>{totals.smrtna}</td>
                      <td style={{ color: '#10B981' }}>{totals.bolovanje}</td>
                      <td style={{ color: 'var(--primary)' }}>{totals.laka + totals.teska + totals.smrtna}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Detail list of all injuries */}
              {yearInjuries.length > 0 && (
                <div style={{ marginTop: 28 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
                    {lang === 'bs' ? 'Pregled svih povreda' : 'All injuries detail'} ({yearInjuries.length})
                  </div>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rb.</th>
                          <th>{t('worker')}</th>
                          <th>{t('date')}</th>
                          <th>{lang === 'bs' ? 'Tip' : 'Type'}</th>
                          <th>{t('location')}</th>
                          <th>{lang === 'bs' ? 'Opis' : 'Description'}</th>
                          <th>{lang === 'bs' ? 'Bolovanje' : 'Sick leave'}</th>
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
                            <td>{inj.datum ? new Date(inj.datum).toLocaleDateString(lang === 'bs' ? 'bs-BA' : 'en-GB') : '—'}</td>
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
              )}

              {yearInjuries.length === 0 && (
                <div style={{ marginTop: 24, textAlign: 'center', padding: 32, color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                  ✅ {lang === 'bs' ? `Nema prijavljenih povreda za ${year}. godinu.` : `No reported injuries for ${year}.`}
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
