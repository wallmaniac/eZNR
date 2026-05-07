'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';
import Icon3D from '@/components/Icon3D';
import PageHeader from '@/components/PageHeader';

export default function EKEquipmentPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const equipment = useMemo(() => getAll(COLLECTIONS.EQUIPMENT), []);
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(equipment, 'naziv');

  return (
    <div className="animate-fadeIn">
      <PageHeader icon="" title={t('ekEquipment')} />
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{equipment.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th>
          <th style={thStyle('naziv')} onClick={() => toggleSort('naziv')}>{t('name')}{sortIcon('naziv')}</th>
          <th style={thStyle('proizvodjac')} onClick={() => toggleSort('proizvodjac')}>{t('manufacturer')}{sortIcon('proizvodjac')}</th>
          <th style={thStyle('tvBroj')} onClick={() => toggleSort('tvBroj')}>{t('serialNumber')}{sortIcon('tvBroj')}</th>
          <th style={thStyle('sljedeciPregled')} onClick={() => toggleSort('sljedeciPregled')}>{t('nextExam')}{sortIcon('sljedeciPregled')}</th>
          <th>{t('status')}</th>
        </tr></thead><tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {lang !== 'en' ? '✅ Nema radne opreme u evidenciji' : '✅ No equipment in records'}
              </td></tr>
            ) : sorted.map((e, idx) => {
              const isOverdue = e.sljedeciPregled && new Date(e.sljedeciPregled) < new Date();
              return (
                <tr key={e.id}
                  onClick={() => router.push(`/dashboard/equipment?openItem=${e.id}&returnTo=/dashboard/ek-equipment`)}
                  style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = ''}
                >
                  <td>{idx + 1}</td><td style={{ fontWeight: 600 }}>{e.naziv}</td><td>{e.proizvodjac || '-'}</td><td><code>{e.tvBroj || '-'}</code></td>
                  <td style={{ color: isOverdue ? 'var(--danger)' : undefined, fontWeight: isOverdue ? 700 : undefined }}>{formatDate(e.sljedeciPregled)} {isOverdue && '⚠️'}</td>
                  <td><span className={`badge ${e.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{e.status === 'active' ? '✓' : '✗'}</span></td>
                </tr>
              );
            })}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
