'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';

export default function EKPPEPage() {
  const { lang } = useLanguage();
  const assignments = useMemo(() => getAll(COLLECTIONS.PPE_ASSIGNMENTS), []);
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);

  const rows = useMemo(() =>
    assignments.map((a, idx) => {
      const w = workers.find(x => x.id === a.workerId);
      return {
        ...a,
        rb: idx + 1,
        imePrezime: w ? `${w.ime} ${w.prezime}` : '—',
        jmbg: w?.jmbg || '—',
        orgUnit: w?.orgJedinicaId || '—',
      };
    }), [assignments, workers]);

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🦺 EK — Osobna zaštitna oprema</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {rows.length} {lang === 'bs' ? 'evidencija zaduženja' : 'assignment records'}
        </div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th style={{ width: 50 }}>Rb.</th>
          <th>{lang === 'bs' ? 'Ime i prezime' : 'Name'}</th>
          <th>JMBG</th>
          <th>{lang === 'bs' ? 'Naziv OZO' : 'PPE Name'}</th>
          <th>{lang === 'bs' ? 'Datum zaduženja' : 'Assignment Date'}</th>
          <th>{lang === 'bs' ? 'Količina' : 'Qty'}</th>
          <th>{lang === 'bs' ? 'Datum razduženja' : 'Return Date'}</th>
        </tr></thead><tbody>
          {rows.length === 0
            ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {lang === 'bs' ? 'Nema evidentiranih zaduženja OZO.' : 'No PPE assignments recorded.'}
              </td></tr>
            : rows.map(r => (
              <tr key={r.id}>
                <td>{r.rb}</td>
                <td style={{ fontWeight: 600 }}>{r.imePrezime}</td>
                <td><code>{r.jmbg}</code></td>
                <td>🦺 {r.naziv}</td>
                <td>{formatDate(r.datumZaduzenja)}</td>
                <td>{r.kolicina ?? 1}</td>
                <td>{r.datumRazduzenja ? formatDate(r.datumRazduzenja) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}</td>
              </tr>
            ))
          }
        </tbody></table></div>
      </div></div>
    </div>
  );
}
