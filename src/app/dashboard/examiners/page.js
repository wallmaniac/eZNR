'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

import PageHeader from '@/components/PageHeader';
export default function ExaminersPage() {
  const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ime: '', zvanje: '', ovlaštenaTvrtkaId: '', telefon: '' });

  const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.EXAMINERS)); setCompanies(getAll(COLLECTIONS.AUTHORIZED_COMPANIES)); }, []);
  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);

  const getCompanyName = (id) => { const c = companies.find(x => x.id === id); return c ? c.naziv : '-'; };
  const handleNew = () => { setFormData({ ime: '', zvanje: '', ovlaštenaTvrtkaId: '', telefon: '' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); };
  const handleSave = async () => {
    if (!formData.ime) return;
    if (editingId) update(COLLECTIONS.EXAMINERS, editingId, formData); else create(COLLECTIONS.EXAMINERS, formData);
    setShowForm(false); loadData();
  };
  const handleDelete = async (id) => { const ok = await confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?'); if (ok) { remove(COLLECTIONS.EXAMINERS, id); loadData(); } };

  return (
    <><DialogRenderer /><div className="animate-fadeIn">
      <PageHeader icon="🔬" title={t('examiners')} />
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 550 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingId ? '✏️' : '+'} {t('examiners')}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label">{t('name')} *</label><input className="form-input" value={formData.ime} onChange={e => setFormData({ ...formData, ime: e.target.value })} /></div>
              <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label">{lang === 'bs' ? 'Zvanje' : 'Title'}</label><input className="form-input" value={formData.zvanje} onChange={e => setFormData({ ...formData, zvanje: e.target.value })} /></div>
              <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label">{t('authorizedCompanies')}</label>
                <select className="form-select" value={formData.ovlaštenaTvrtkaId} onChange={e => setFormData({ ...formData, ovlaštenaTvrtkaId: e.target.value })}>
                  <option value="">-</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.naziv}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">{t('phone')}</label><input className="form-input" value={formData.telefon} onChange={e => setFormData({ ...formData, telefon: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button></div>
          </div>
        </div>
      )}
      <div className="card"><div className="card-body">
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}><button className="btn btn-primary btn-sm" onClick={handleNew}>+ {lang === 'bs' ? 'Novi ispitivač' : 'New Examiner'}</button></div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr><th>{t('actions')}</th><th>{t('name')}</th><th>{lang === 'bs' ? 'Zvanje' : 'Title'}</th><th>{t('authorizedCompanies')}</th><th>{t('phone')}</th></tr></thead>
          <tbody>{items.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr> : items.map(i => (
            <tr key={i.id} onClick={() => handleEdit(i)} style={{ cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}><td onClick={e => e.stopPropagation()}><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-primary btn-sm" onClick={() => handleEdit(i)}>✏️</button><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(i.id)} style={{ color: 'var(--danger)' }}>🗑️</button></div></td><td style={{ fontWeight: 600 }}>{i.ime}</td><td>{i.zvanje}</td><td>{getCompanyName(i.ovlaštenaTvrtkaId)}</td><td>{i.telefon}</td></tr>
          ))}</tbody></table></div>
      </div></div>
    </div></>
  );
}
