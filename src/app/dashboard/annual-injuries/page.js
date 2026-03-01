'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AnnualInjuriesPage() {
  const { t, lang } = useLanguage();
  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📈 {t('annualInjuryReport')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div className="form-group"><label className="form-label" style={{ marginBottom: 4, display: 'block' }}>{lang === 'bs' ? 'Godina' : 'Year'}</label>
            <select className="form-select" style={{ minWidth: 120 }}><option>2026</option><option>2025</option><option>2024</option></select></div>
          <div style={{ alignSelf: 'flex-end' }}><button className="btn btn-primary btn-sm">{lang === 'bs' ? 'Generiši' : 'Generate'}</button></div>
          <div style={{ alignSelf: 'flex-end', marginLeft: 'auto' }}><button className="btn btn-ghost btn-sm">🖨️ {t('print')}</button><button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }}>📥 {t('export')}</button></div>
        </div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{lang === 'bs' ? 'Mjesec' : 'Month'}</th><th>{lang === 'bs' ? 'Lake' : 'Minor'}</th><th>{lang === 'bs' ? 'Teške' : 'Severe'}</th><th>{lang === 'bs' ? 'Smrtne' : 'Fatal'}</th><th>{t('total')}</th></tr></thead>
          <tbody>{['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'].map(m => (
            <tr key={m}><td style={{ fontWeight: 600 }}>{m}</td><td>0</td><td>0</td><td>0</td><td><strong>0</strong></td></tr>
          ))}<tr style={{ background: 'var(--bg-table-header)', fontWeight: 700 }}><td>{t('total')}</td><td>0</td><td>0</td><td>0</td><td>0</td></tr></tbody></table></div>
      </div></div>
    </div>
  );
}
