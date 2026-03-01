'use client';
import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';

export default function WorkerPPEPage() {
  const { t, lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);
  const assignments = useMemo(() => getAll(COLLECTIONS.PPE_ASSIGNMENTS), []);

  const rows = useMemo(() => {
    return assignments.map(a => {
      const w = workers.find(x => x.id === a.workerId);
      return { ...a, workerName: w ? `${w.ime} ${w.prezime}` : '-' };
    }).filter(r => !searchTerm || r.workerName.toLowerCase().includes(searchTerm.toLowerCase()) || r.naziv.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [assignments, workers, searchTerm]);

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🦺 {t('workerPPE')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>{rows.length} {t('records')}</span>
        </div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>{t('worker')}</th><th>{t('name')}</th><th>{t('assignmentDate')}</th><th>{t('quantity')}</th>
        </tr></thead><tbody>
            {rows.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr> : rows.map((r, idx) => (
              <tr key={r.id || idx}>
                <td style={{ fontWeight: 600 }}>{r.workerName}</td>
                <td>🦺 {r.naziv}</td>
                <td>{formatDate(r.datumZaduzenja)}</td>
                <td>{r.kolicina}</td>
              </tr>
            ))}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
