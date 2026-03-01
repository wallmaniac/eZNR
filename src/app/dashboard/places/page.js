'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';

export default function PlacesPage() {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ naziv: '', postBroj: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.PLACES)); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const filtered = items.filter(i => !searchTerm || i.naziv.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleNew = () => { setFormData({ naziv: '', postBroj: '' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); };
  const handleSave = () => {
    if (!formData.naziv) return;
    if (editingId) update(COLLECTIONS.PLACES, editingId, formData); else create(COLLECTIONS.PLACES, formData);
    setShowForm(false); loadData();
  };
  const handleDelete = (id) => { if (confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?')) { remove(COLLECTIONS.PLACES, id); loadData(); } };

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📍 {t('places')}</h1>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingId ? '✏️' : '+'} {t('places')}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">{t('name')} *</label>
                <input className="form-input" value={formData.naziv} onChange={e => setFormData({ ...formData, naziv: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Poštanski broj' : 'Postal code'}</label>
                <input className="form-input" value={formData.postBroj} onChange={e => setFormData({ ...formData, postBroj: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
            </div>
          </div>
        </div>
      )}
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {t('add')}</button>
          <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
          </div>
        </div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('name')}</th><th>{lang === 'bs' ? 'Poštanski broj' : 'Postal code'}</th></tr></thead>
          <tbody>{filtered.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr> : filtered.map(i => (
            <tr key={i.id}><td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-primary btn-sm" onClick={() => handleEdit(i)}>✏️</button><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(i.id)} style={{ color: 'var(--danger)' }}>🗑️</button></div></td><td style={{ fontWeight: 600 }}>{i.naziv}</td><td>{i.postBroj}</td></tr>
          ))}</tbody></table></div>
      </div></div>
    </div>
  );
}
