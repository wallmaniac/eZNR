'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';

export default function EquipmentExamsPage() {
  const { t, lang } = useLanguage();
  const equipment = useMemo(() => getAll(COLLECTIONS.EQUIPMENT), []);

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🔍 {t('equipmentExamList')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{equipment.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>{t('name')}</th><th>{t('manufacturer')}</th><th>{lang === 'bs' ? 'Tip' : 'Type'}</th><th>{lang === 'bs' ? 'Zadnji pregled' : 'Last exam'}</th><th>{t('nextExam')}</th><th>{t('status')}</th>
        </tr></thead><tbody>
            {equipment.map(e => {
              const isOverdue = e.sljedeciPregled && new Date(e.sljedeciPregled) < new Date();
              return (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.naziv}</td><td>{e.proizvodjac || '-'}</td><td>{e.tip || '-'}</td>
                  <td>{formatDate(e.datumPregleda)}</td>
                  <td style={{ color: isOverdue ? 'var(--danger)' : undefined, fontWeight: isOverdue ? 700 : undefined }}>{formatDate(e.sljedeciPregled)} {isOverdue && '⚠️'}</td>
                  <td><span className={`badge ${isOverdue ? 'badge-danger' : 'badge-success'}`}>{isOverdue ? (lang === 'bs' ? 'Istekao' : 'Overdue') : (lang === 'bs' ? 'Aktivan' : 'Active')}</span></td>
                </tr>
              );
            })}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
