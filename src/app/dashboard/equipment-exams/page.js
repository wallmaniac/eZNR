'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useSortedList } from '@/hooks/useSortedList';

export default function EquipmentExamsPage() {
  const { t, lang } = useLanguage();
  const equipment = useMemo(() => getAll(COLLECTIONS.EQUIPMENT), []);
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(equipment, 'naziv');

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🔍 {t('equipmentExamList')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{equipment.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th style={thStyle('naziv')} onClick={() => toggleSort('naziv')}>{t('name')}{sortIcon('naziv')}</th>
          <th style={thStyle('proizvodjac')} onClick={() => toggleSort('proizvodjac')}>{t('manufacturer')}{sortIcon('proizvodjac')}</th>
          <th style={thStyle('tip')} onClick={() => toggleSort('tip')}>{lang === 'bs' ? 'Tip' : 'Type'}{sortIcon('tip')}</th>
          <th style={thStyle('datumPregleda')} onClick={() => toggleSort('datumPregleda')}>{lang === 'bs' ? 'Zadnji pregled' : 'Last exam'}{sortIcon('datumPregleda')}</th>
          <th style={thStyle('sljedeciPregled')} onClick={() => toggleSort('sljedeciPregled')}>{t('nextExam')}{sortIcon('sljedeciPregled')}</th>
          <th>{t('status')}</th>
        </tr></thead><tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
            ) : sorted.map(e => {
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
