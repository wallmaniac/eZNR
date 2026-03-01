'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ArchivePage() {
  const { t, lang } = useLanguage();
  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🗄️ {t('digitalArchive')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button className="btn btn-primary btn-sm">📤 {t('upload')}</button>
          <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}><input placeholder={t('searchBtn') + '...'} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} /></div>
        </div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('name')}</th><th>{lang === 'bs' ? 'Tip' : 'Type'}</th><th>{t('date')}</th><th>{lang === 'bs' ? 'Veličina' : 'Size'}</th><th>{t('actions')}</th></tr></thead>
          <tbody><tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📁</div>
            {lang === 'bs' ? 'Digitalna arhiva je prazna. Kliknite "Učitaj" da dodate datoteke.' : 'Digital archive is empty. Click "Upload" to add files.'}
          </td></tr></tbody></table></div>
      </div></div>
    </div>
  );
}
