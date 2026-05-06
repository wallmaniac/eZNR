'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';

import PageHeader from '@/components/PageHeader';
export default function EquipmentTypesPage() {
  const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { showFlash, SavedFlash } = useSavedFlash();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ naziv: '' });

  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.EQUIPMENT_TYPES)); }, []);
  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);

  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(items, 'naziv');

  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id)));
    else setSelectedIds(new Set());
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
        for (let id of selectedIds) await remove(COLLECTIONS.EQUIPMENT_TYPES, id);
        setSelectedIds(new Set());
        loadData();
    }
  };

  const handleNew = () => { setFormData({ naziv: '' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); };
  const handleSave = async () => {
    if (!formData.naziv) return;
    if (editingId) update(COLLECTIONS.EQUIPMENT_TYPES, editingId, formData); else create(COLLECTIONS.EQUIPMENT_TYPES, formData);
    setShowForm(false); loadData(); showFlash();
  };
  const handleDelete = async (id) => { const ok = await confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?'); if (ok) { remove(COLLECTIONS.EQUIPMENT_TYPES, id); loadData(); } };

  const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

  return (
    <>
      <DialogRenderer />
      <div className="animate-fadeIn">
        <PageHeader icon="🏭" title={t('equipmentTypes')} />
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h2>{editingId ? '✏️' : '+'} {t('equipmentTypes')}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button></div>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">{t('name')} *</label><input className="form-input" value={formData.naziv} onChange={e => setFormData({ ...formData, naziv: e.target.value })} /></div>
              </div>
              <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button></div>
            </div>
          </div>
        )}
        <div className="card"><div className="card-body">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {lang === 'bs' ? 'Novi tip opreme' : 'New Eq. Type'}</button>
            <SavedFlash />
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'} &mdash; Grupne akcije:
                  </span>
                  <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
              </div>
            )}
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sorted.length} {lang === 'bs' ? 'zapisa' : 'records'}</span>}
          </div>
          <div className="data-table-wrapper"><table className="data-table"><thead><tr>
            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
            <th style={{ width: 90 }}>{t('actions')}</th>
            <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{t('name')}{sortIcon('naziv')}</th>
          </tr></thead>
            <tbody>{sorted.length === 0 ? <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr> : sorted.map(i => (
              <tr key={i.id} onClick={() => handleEdit(i)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.has(i.id)} onChange={() => toggleOne(i.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div style={{ position: 'relative' }}>
                    <button className="btn btn-primary btn-sm" data-menu-trigger onClick={(e) => {
                        e.stopPropagation();
                        if (actionMenuId === i.id) { setActionMenuId(null); return; }
                        const rect = e.currentTarget.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom - 8;
                        const spaceAbove = rect.top - 8;
                        const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
                        setMenuPos(flipUp
                            ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                            : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                        );
                        setActionMenuId(i.id);
                    }}>Akcije ▼</button>
                    {actionMenuId === i.id && (
                        <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                        <div data-menu style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                            <button onClick={() => { setActionMenuId(null); handleEdit(i); }} style={menuItemSt}>✏️ Otvori</button>
                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                            <button onClick={() => { setActionMenuId(null); handleDelete(i.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Izbriši</button>
                        </div>
                        </>
                    )}
                  </div>
                </td>
                <td style={{ fontWeight: 600 }}>⚙️ {i.naziv}</td>
              </tr>
            ))}</tbody></table></div>
        </div></div>
      </div>
    </>
  );
}
