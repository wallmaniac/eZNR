'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function FormRO2Page() {
  const { t, lang } = useLanguage();
  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📄 {t('formRO2')}</h1>
      <div className="card"><div className="card-body">
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          ℹ️ {lang === 'bs' ? 'Obrazac RO2 - Evidencija pregleda radne opreme i objekta.' : 'Form RO2 - Equipment and facility inspection records.'}
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm">+ {t('add')}</button><button className="btn btn-ghost btn-sm">🖨️ {t('print')}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('name')}</th><th>{t('date')}</th><th>{t('status')}</th></tr></thead>
          <tbody><tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr></tbody></table></div>
      </div></div>
    </div>
  );
}
