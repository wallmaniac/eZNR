'use client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function InjuriesPage() {
  const { t, lang } = useLanguage();
  const [formData, setFormData] = useState({ radnikIme: '', datum: '', opis: '', tip: 'laka', lokacija: '' });
  const [showForm, setShowForm] = useState(false);
  const set = (k, v) => setFormData({ ...formData, [k]: v });

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🩹 {t('injuryReport')}</h1>
      {showForm && (<div className="modal-overlay" onClick={() => setShowForm(false)}><div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>🩹 {t('injuryReport')}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button></div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group"><label className="form-label">{t('worker')} *</label><input className="form-input" value={formData.radnikIme} onChange={e => set('radnikIme', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">{t('date')} *</label><input className="form-input" type="date" value={formData.datum} onChange={e => set('datum', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Tip povrede' : 'Injury type'}</label>
              <select className="form-select" value={formData.tip} onChange={e => set('tip', e.target.value)}>
                <option value="laka">{lang === 'bs' ? 'Laka' : 'Minor'}</option><option value="teska">{lang === 'bs' ? 'Teška' : 'Severe'}</option><option value="smrtna">{lang === 'bs' ? 'Smrtna' : 'Fatal'}</option>
              </select></div>
            <div className="form-group"><label className="form-label">{t('location')}</label><input className="form-input" value={formData.lokacija} onChange={e => set('lokacija', e.target.value)} /></div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">{t('description')}</label><textarea className="form-input" rows={3} value={formData.opis} onChange={e => set('opis', e.target.value)} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={() => { alert(lang === 'bs' ? 'Prijava sačuvana!' : 'Report saved!'); setShowForm(false); }}>💾 {t('save')}</button>
        </div>
      </div></div>)}
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ {t('add')}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('worker')}</th><th>{t('date')}</th><th>{lang === 'bs' ? 'Tip' : 'Type'}</th><th>{t('description')}</th></tr></thead>
          <tbody><tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr></tbody>
        </table></div>
      </div></div>
    </div>
  );
}
