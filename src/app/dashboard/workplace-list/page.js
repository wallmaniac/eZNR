'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { getAll, COLLECTIONS, getOrgUnitName } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';

import PageHeader from '@/components/PageHeader';
export default function WorkplaceListPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const workplaces = useMemo(() => getAll(COLLECTIONS.WORKPLACES), []);
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(workplaces, 'naziv');

  return (
    <div className="animate-fadeIn">
      <PageHeader icon="📋" title={t('workplaceList')} />
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{workplaces.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th>
          <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{t('name')}{sortIcon('naziv')}</th>
          <th onClick={() => toggleSort('oznaka')} style={thStyle('oznaka')}>{t('code')}{sortIcon('oznaka')}</th>
          <th>{t('orgUnit')}</th>
          <th>{lang !== 'en' ? 'Stručna sprema' : 'Education'}</th>
          <th>{lang !== 'en' ? 'Posebni uvjeti' : 'Special cond.'}</th>
        </tr></thead><tbody>
            {sorted.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{lang !== 'en' ? '✅ Nema radnih mjesta' : '✅ No workplaces'}</td></tr> : sorted.map((w, idx) => (
              <tr key={w.id} onClick={() => router.push(`/dashboard/workplaces?openItem=${w.id}&returnTo=/dashboard/workplace-list`)} style={{ cursor: 'pointer', transition: 'background 0.12s' }}>
                <td>{idx + 1}</td>
                <td style={{ fontWeight: 600 }}>{w.naziv}</td>
                <td><span className="badge badge-info">{w.oznaka}</span></td>
                <td>{getOrgUnitName(w.orgUnitId)}</td>
                <td>{w.strucnaSprema || '-'}</td>
                <td>{w.posebniUvjetiRada ? <span className="badge badge-danger">{lang !== 'en' ? 'Da' : 'Yes'}</span> : <span className="badge badge-success">{lang !== 'en' ? 'Ne' : 'No'}</span>}</td>
              </tr>
            ))}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
