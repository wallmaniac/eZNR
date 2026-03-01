'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function QuestionnairesPage() {
  const { t, lang } = useLanguage();
  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>❓ {t('questionnaires')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm">+ {t('add')}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('name')}</th><th>{t('date')}</th><th>{t('status')}</th></tr></thead>
          <tbody><tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr></tbody></table></div>
      </div></div>
    </div>
  );
}
