'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function NightWorkPage() {
  const { t, lang } = useLanguage();
  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🌙 {t('nightWorkReferral')}</h1>
      <div className="card"><div className="card-body">
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          ℹ️ {lang === 'bs' ? 'Uputnica za ljekarski pregled radnika koji rade noću (NR1).' : 'Medical referral for night shift workers (NR1).'}
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm">+ {t('add')}</button><button className="btn btn-ghost btn-sm">🖨️ {t('print')}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('worker')}</th><th>{t('date')}</th><th>{t('status')}</th></tr></thead>
          <tbody><tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr></tbody></table></div>
      </div></div>
    </div>
  );
}
