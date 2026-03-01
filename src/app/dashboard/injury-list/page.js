'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function InjuryListPage() {
  const { t, lang } = useLanguage();
  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🩹 {t('injuryList')}</h1>
      <div className="card"><div className="card-body">
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>Red. br.</th><th>{t('worker')}</th><th>{t('date')}</th><th>{lang === 'bs' ? 'Tip' : 'Type'}</th><th>{t('description')}</th><th>{t('status')}</th>
        </tr></thead><tbody><tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr></tbody></table></div>
      </div></div>
    </div>
  );
}
