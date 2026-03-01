'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';

export default function AuthorizedCompaniesPage() {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ naziv: '', rješenjeBroj: '', datumRješenja: '', adresa: '', tel: '' });

  const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.AUTHORIZED_COMPANIES)); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const handleNew = () => { setFormData({ naziv: '', rješenjeBroj: '', datumRješenja: '', adresa: '', tel: '' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); };
  const handleSave = () => {
    if (!formData.naziv) return;
    if (editingId) update(COLLECTIONS.AUTHORIZED_COMPANIES, editingId, formData); else create(COLLECTIONS.AUTHORIZED_COMPANIES, formData);
    setShowForm(false); loadData();
  };
  const handleDelete = (id) => { if (confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?')) { remove(COLLECTIONS.AUTHORIZED_COMPANIES, id); loadData(); } };

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>🏗️ {t('authorizedCompanies')}</h1>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingId ? '✏️' : '+'} {t('authorizedCompanies')}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label">{t('name')} *</label><input className="form-input" value={formData.naziv} onChange={e => setFormData({ ...formData, naziv: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Broj rješenja' : 'Decision number'}</label><input className="form-input" value={formData.rješenjeBroj} onChange={e => setFormData({ ...formData, rješenjeBroj: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Datum rješenja' : 'Decision date'}</label><input className="form-input" type="date" value={formData.datumRješenja} onChange={e => setFormData({ ...formData, datumRješenja: e.target.value })} /></div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label">{t('address')}</label><input className="form-input" value={formData.adresa} onChange={e => setFormData({ ...formData, adresa: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">{t('phone')}</label><input className="form-input" value={formData.tel} onChange={e => setFormData({ ...formData, tel: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button></div>
          </div>
        </div>
      )}
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm" onClick={handleNew}>+ {t('add')}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('name')}</th><th>{lang === 'bs' ? 'Broj rješenja' : 'Decision no.'}</th><th>{t('address')}</th><th>{t('phone')}</th></tr></thead>
          <tbody>{items.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr> : items.map(i => (
            <tr key={i.id}><td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-primary btn-sm" onClick={() => handleEdit(i)}>✏️</button><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(i.id)} style={{ color: 'var(--danger)' }}>🗑️</button></div></td><td style={{ fontWeight: 600 }}>{i.naziv}</td><td><code>{i.rješenjeBroj}</code></td><td>{i.adresa}</td><td>{i.tel}</td></tr>
          ))}</tbody></table></div>
      </div></div>
    </div>
  );
}
