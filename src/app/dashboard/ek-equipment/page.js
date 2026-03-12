'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';

export default function EKEquipmentPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const equipment = useMemo(() => getAll(COLLECTIONS.EQUIPMENT), []);

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📇 {t('ekEquipment')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{equipment.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th><th>{t('name')}</th><th>{t('manufacturer')}</th><th>{t('serialNumber')}</th><th>{t('nextExam')}</th><th>{t('status')}</th>
        </tr></thead><tbody>
            {equipment.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {lang === 'bs' ? '✅ Nema radne opreme u evidenciji' : '✅ No equipment in records'}
              </td></tr>
            ) : equipment.map((e, idx) => {
              const isOverdue = e.sljedeciPregled && new Date(e.sljedeciPregled) < new Date();
              return (
                <tr key={e.id}
                  onClick={() => router.push(`/dashboard/equipment?openItem=${e.id}`)}
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
