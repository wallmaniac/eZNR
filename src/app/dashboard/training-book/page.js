'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
export default function TrainingBookPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false), []);
  const certs = useMemo(() => getAll(COLLECTIONS.CERTIFICATES), []);

  const rows = useMemo(() => workers.map(w => {
    const wCerts = certs.filter(c => c.workerId === w.id);
    const latestCert = wCerts.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))[0];
    return { ...w, certCount: wCerts.length, latestCert, _latestDate: latestCert?.datum || '' };
  }), [workers, certs]);

  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(rows, 'ime');

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📚 {t('trainingMasterBook')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{rows.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th>
          <th onClick={() => toggleSort('ime')} style={thStyle('ime')}>{t('workerName')}{sortIcon('ime')}</th>
          <th onClick={() => toggleSort('prezime')} style={thStyle('prezime')}>{t('workerSurname')}{sortIcon('prezime')}</th>
          <th onClick={() => toggleSort('jmbg')} style={thStyle('jmbg')}>JMBG{sortIcon('jmbg')}</th>
          <th onClick={() => toggleSort('certCount')} style={thStyle('certCount')}>{lang === 'bs' ? 'Br. uvjerenja' : 'Cert. count'}{sortIcon('certCount')}</th>
          <th onClick={() => toggleSort('_latestDate')} style={thStyle('_latestDate')}>{lang === 'bs' ? 'Posljednje uvjerenje' : 'Latest cert'}{sortIcon('_latestDate')}</th>
          <th onClick={() => toggleSort('certCount')} style={thStyle('certCount')}>{t('status')}{sortIcon('certCount')}</th>
        </tr></thead><tbody>
            {sorted.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{lang === 'bs' ? '✅ Nema radnika' : '✅ No workers'}</td></tr> : sorted.map((r, idx) => (
              <tr key={r.id} onClick={() => router.push(`/dashboard/workers?openWorker=${r.id}&section=uvjerenja`)} style={{ cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                <td>{idx + 1}</td>
                <td style={{ fontWeight: 600 }}>{r.ime}</td>
                <td style={{ fontWeight: 600 }}>{r.prezime}</td>
                <td><code>{r.jmbg}</code></td>
                <td><span className="badge badge-info">{r.certCount}</span></td>
                <td>{r.latestCert ? formatDate(r.latestCert.datum) : '-'}</td>
                <td><span className={`badge ${r.certCount > 0 ? 'badge-success' : 'badge-danger'}`}>{r.certCount > 0 ? '✓' : '✗'}</span></td>
              </tr>
            ))}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
