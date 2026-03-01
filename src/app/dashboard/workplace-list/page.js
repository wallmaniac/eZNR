'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, getOrgUnitName, getWorkersInOrgUnit } from '@/lib/dataStore';

export default function WorkplaceListPage() {
  const { t, lang } = useLanguage();
  const workplaces = useMemo(() => getAll(COLLECTIONS.WORKPLACES), []);

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📋 {t('workplaceList')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{workplaces.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th><th>{t('name')}</th><th>{t('code')}</th><th>{t('orgUnit')}</th><th>{lang === 'bs' ? 'Stručna sprema' : 'Education'}</th><th>{lang === 'bs' ? 'Posebni uvjeti' : 'Special cond.'}</th>
        </tr></thead><tbody>
            {workplaces.map((w, idx) => (
              <tr key={w.id}>
                <td>{idx + 1}</td>
                <td style={{ fontWeight: 600 }}>{w.naziv}</td>
                <td><span className="badge badge-info">{w.oznaka}</span></td>
                <td>{getOrgUnitName(w.orgUnitId)}</td>
                <td>{w.strucnaSprema || '-'}</td>
                <td>{w.posebniUvjetiRada ? <span className="badge badge-danger">{lang === 'bs' ? 'Da' : 'Yes'}</span> : <span className="badge badge-success">{lang === 'bs' ? 'Ne' : 'No'}</span>}</td>
              </tr>
            ))}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
