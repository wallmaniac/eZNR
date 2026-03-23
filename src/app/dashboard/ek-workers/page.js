'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, getOrgUnitName, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';

export default function EKWorkersPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(workers, 'ime');

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📇 {t('ekWorkers')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{workers.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th>
          <th onClick={() => toggleSort('ime')} style={thStyle('ime')}>{t('workerName')}{sortIcon('ime')}</th>
          <th onClick={() => toggleSort('prezime')} style={thStyle('prezime')}>{t('workerSurname')}{sortIcon('prezime')}</th>
          <th onClick={() => toggleSort('jmbg')} style={thStyle('jmbg')}>JMBG{sortIcon('jmbg')}</th>
          <th onClick={() => toggleSort('datumZaposlenja')} style={thStyle('datumZaposlenja')}>{t('employmentDate')}{sortIcon('datumZaposlenja')}</th>
          <th onClick={() => toggleSort('orgJedinicaId')} style={thStyle('orgJedinicaId')}>{t('orgUnit')}{sortIcon('orgJedinicaId')}</th>
          <th onClick={() => toggleSort('aktivan')} style={thStyle('aktivan')}>{t('status')}{sortIcon('aktivan')}</th>
        </tr></thead><tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {lang === 'bs' ? '✅ Nema radnika u evidenciji' : '✅ No workers in records'}
              </td></tr>
            ) : sorted.map((w, idx) => (
              <tr key={w.id}
                onClick={() => router.push(`/dashboard/workers?openWorker=${w.id}`)}
                style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <td>{idx + 1}</td><td style={{ fontWeight: 600 }}>{w.ime}</td><td style={{ fontWeight: 600 }}>{w.prezime}</td>
                <td><code>{w.jmbg}</code></td><td>{formatDate(w.datumZaposlenja)}</td><td>{getOrgUnitName(w.orgJedinicaId)}</td>
                <td><span className={`badge ${w.aktivan !== false ? 'badge-success' : 'badge-danger'}`}>{w.aktivan !== false ? (lang === 'bs' ? 'Aktivan' : 'Active') : (lang === 'bs' ? 'Neaktivan' : 'Inactive')}</span></td>
              </tr>
            ))}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
