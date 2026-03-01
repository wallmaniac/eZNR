'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';

export default function TrainingBookPage() {
  const { t, lang } = useLanguage();
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan), []);
  const certs = useMemo(() => getAll(COLLECTIONS.CERTIFICATES), []);

  const rows = useMemo(() => workers.map(w => {
    const wCerts = certs.filter(c => c.workerId === w.id);
    return { ...w, certCount: wCerts.length, latestCert: wCerts.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))[0] };
  }), [workers, certs]);

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📚 {t('trainingMasterBook')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{rows.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th><th>{t('workerName')}</th><th>{t('workerSurname')}</th><th>JMBG</th><th>{lang === 'bs' ? 'Br. uvjerenja' : 'Cert. count'}</th><th>{lang === 'bs' ? 'Posljednje uvjerenje' : 'Latest cert'}</th><th>{t('status')}</th>
        </tr></thead><tbody>
            {rows.map((r, idx) => (
              <tr key={r.id}>
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
