'use client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DiseasesPage() {
  const { t, lang } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🏥 {t('diseaseReport')}</h1>
      {showForm && (<div className="modal-overlay" onClick={() => setShowForm(false)}><div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>🏥 {t('diseaseReport')}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button></div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label className="form-label">{t('worker')} *</label><input className="form-input" /></div>
            <div className="form-group"><label className="form-label">{t('date')} *</label><input className="form-input" type="date" /></div>
            <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Dijagnoza' : 'Diagnosis'}</label><input className="form-input" /></div>
            <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Uzrok' : 'Cause'}</label><input className="form-input" /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">{t('description')}</label><textarea className="form-input" rows={3} /></div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button><button className="btn btn-primary">💾 {t('save')}</button></div>
      </div></div>)}
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ {t('add')}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('worker')}</th><th>{t('date')}</th><th>{lang === 'bs' ? 'Dijagnoza' : 'Diagnosis'}</th><th>{t('status')}</th></tr></thead>
          <tbody><tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr></tbody>
        </table></div>
      </div></div>
    </div>
  );
}
