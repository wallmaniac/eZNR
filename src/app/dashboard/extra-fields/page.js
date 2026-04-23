'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

export default function ExtraFieldsPage() {
  const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ naziv: '', tip: 'text' });
  const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.EXTRA_FIELDS || 'extra_fields')); }, []);
  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);
  const handleNew = () => { setFormData({ naziv: '', tip: 'text' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); };
  const handleSave = async () => { if (!formData.naziv) return; const col = COLLECTIONS.EXTRA_FIELDS || 'extra_fields'; if (editingId) update(col, editingId, formData); else create(col, formData); setShowForm(false); loadData(); };
  const handleDelete = async (id) => { const ok = await confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?'); if (ok) { remove(COLLECTIONS.EXTRA_FIELDS || 'extra_fields', id); loadData(); } };
  return (
    <><DialogRenderer /><div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>➕ {t('extraFields')}</h1>
      {showForm && (<div className="modal-overlay" onClick={() => setShowForm(false)}><div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>{editingId ? '✏️' : '+'} {t('extraFields')}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button></div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label">{t('name')} *</label><input className="form-input" value={formData.naziv} onChange={e => setFormData({ ...formData, naziv: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Tip polja' : 'Field type'}</label>
            <select className="form-select" value={formData.tip} onChange={e => setFormData({ ...formData, tip: e.target.value })}>
              <option value="text">{lang === 'bs' ? 'Tekst' : 'Text'}</option><option value="number">{lang === 'bs' ? 'Broj' : 'Number'}</option>
              <option value="date">{t('date')}</option><option value="select">{lang === 'bs' ? 'Izbor' : 'Select'}</option>
            </select>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button></div>
      </div></div>)}
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm" onClick={handleNew}>+ {lang === 'bs' ? 'Novo polje' : 'New Field'}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th style={{ width: 120 }}>{t('actions')}</th><th>{t('name')}</th><th>{lang === 'bs' ? 'Tip' : 'Type'}</th></tr></thead>
          <tbody>{items.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr> : items.map(i => (
            <tr key={i.id} onClick={() => handleEdit(i)} style={{ cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}><td onClick={e => e.stopPropagation()}><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-primary btn-sm" onClick={() => handleEdit(i)}>✏️</button><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(i.id)} style={{ color: 'var(--danger)' }}>🗑️</button></div></td><td style={{ fontWeight: 600 }}>{i.naziv}</td><td><span className="badge badge-info">{i.tip}</span></td></tr>
          ))}</tbody></table></div>
      </div></div>
    </div></>
  );
}
