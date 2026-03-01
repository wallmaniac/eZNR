'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, getOrgUnitName, formatDate } from '@/lib/dataStore';

export default function EKWorkersPage() {
  const { t, lang } = useLanguage();
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📇 {t('ekWorkers')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{workers.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th><th>{t('workerName')}</th><th>{t('workerSurname')}</th><th>JMBG</th><th>{t('employmentDate')}</th><th>{t('orgUnit')}</th><th>{t('status')}</th>
        </tr></thead><tbody>
            {workers.map((w, idx) => (
              <tr key={w.id}>
                <td>{idx + 1}</td><td style={{ fontWeight: 600 }}>{w.ime}</td><td style={{ fontWeight: 600 }}>{w.prezime}</td>
                <td><code>{w.jmbg}</code></td><td>{formatDate(w.datumZaposlenja)}</td><td>{getOrgUnitName(w.orgJedinicaId)}</td>
                <td><span className={`badge ${w.aktivan ? 'badge-success' : 'badge-danger'}`}>{w.aktivan ? (lang === 'bs' ? 'Aktivan' : 'Active') : (lang === 'bs' ? 'Neaktivan' : 'Inactive')}</span></td>
              </tr>
            ))}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
