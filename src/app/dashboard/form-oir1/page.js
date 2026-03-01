'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function FormOIR1Page() {
  const { t, lang } = useLanguage();
  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📄 {t('formOIR1')}</h1>
      <div className="card"><div className="card-body">
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          ℹ️ {lang === 'bs' ? 'Obrazac OIR1 - Izvještaj o ozlijeđenom radniku. Popunite podatke o radniku i povredi.' : 'Form OIR1 - Injured worker report. Fill in worker and injury data.'}
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm">+ {t('add')}</button><button className="btn btn-ghost btn-sm">🖨️ {t('print')}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('worker')}</th><th>{t('date')}</th><th>{t('status')}</th></tr></thead>
          <tbody><tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr></tbody></table></div>
      </div></div>
    </div>
  );
}
