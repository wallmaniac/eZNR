'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import PageHeader from '@/components/PageHeader';

export default function CountiesPage() {
  const { t, lang } = useLanguage();
  const bs = lang !== 'en';
  const { confirm, DialogRenderer } = useDialog();
  const { showFlash, SavedFlash } = useSavedFlash();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ naziv: '', kod: '' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.COUNTIES || 'counties')); }, []);
  useEffect(() => {
    loadData();
    window.addEventListener('eznr:data-synced', loadData);
    return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);

  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(items, 'naziv');

  const toggleAll = (e) => { if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id))); else setSelectedIds(new Set()); };
  const toggleOne = (id) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };

  const handleNew = () => { setFormData({ naziv: '', kod: '' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); };
  const handleSave = () => {
    if (!formData.naziv) return;
    const col = COLLECTIONS.COUNTIES || 'counties';
    if (editingId) update(col, editingId, formData); else create(col, formData);
    setShowForm(false); loadData(); showFlash();
  };
  const handleDelete = async (id) => { if (await confirm(bs ? 'Obrisati?' : 'Delete?')) { remove(COLLECTIONS.COUNTIES || 'counties', id); loadData(); } };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(bs ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (const id of selectedIds) remove(COLLECTIONS.COUNTIES || 'counties', id);
      setSelectedIds(new Set()); loadData();
    }
  };

  const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

  return (
    <><DialogRenderer /><div className="animate-fadeIn">
      <PageHeader icon="🗺️" title={t('counties')} />
      {showForm && (<div className="modal-overlay" onClick={() => setShowForm(false)}><div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>{editingId ? '✏️' : '+'} {t('counties')}</h2><button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button></div>
        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 16 }}><label className="form-label">{t('name')} *</label><input className="form-input" value={formData.naziv} onChange={e => setFormData({ ...formData, naziv: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">{t('code')}</label><input className="form-input" value={formData.kod} onChange={e => setFormData({ ...formData, kod: e.target.value })} /></div>
        </div>
        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button></div>
      </div></div>)}
      <div className="card"><div className="card-body" style={{ padding: 0 }}>
        <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
          <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={handleNew}>+ {bs ? 'Novi kanton' : 'New County'}</button>
          <SavedFlash />
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {bs ? 'odabrano' : 'selected'}:</span>
              <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
            </div>
          )}
          {selectedIds.size === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto', flexShrink: 0 }}>{sorted.length} {t('records')}</span>}
        </div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
          <th style={{ width: 90 }}>{t('actions')}</th>
          <th style={thStyle('naziv')} onClick={() => toggleSort('naziv')}>{t('name')}{sortIcon('naziv')}</th>
          <th style={thStyle('kod')} onClick={() => toggleSort('kod')}>{t('code')}{sortIcon('kod')}</th>
        </tr></thead>
          <tbody>{sorted.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr> : sorted.map(i => (
            <tr key={i.id} onClick={() => handleEdit(i)} style={{ cursor: 'pointer', transition: 'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>
              <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(i.id)} onChange={() => toggleOne(i.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></td>
              <td onClick={e => e.stopPropagation()}>
                <div style={{ position: 'relative' }}>
                  <button className="btn btn-primary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={(e) => {
                    e.stopPropagation();
                    if (actionMenuId === i.id) { setActionMenuId(null); return; }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom - 8;
                    const spaceAbove = rect.top - 8;
                    const flipUp = spaceBelow < 200 && spaceAbove > spaceBelow;
                    setMenuPos(flipUp
                      ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                      : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) });
                    setActionMenuId(i.id);
                  }}>Akcije ▼</button>
                  {actionMenuId === i.id && (<>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                    <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 200, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{i.naziv}</span>
                        <button onClick={() => setActionMenuId(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                      </div>
                      <button onClick={() => { setActionMenuId(null); handleEdit(i); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>✏️ {bs ? 'Uredi' : 'Edit'}</button>
                      <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                      <button onClick={() => { setActionMenuId(null); handleDelete(i.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.06)'} onMouseLeave={e => e.currentTarget.style.background=''}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                    </div>
                  </>)}
                </div>
              </td>
              <td style={{ fontWeight: 600 }}>{i.naziv}</td>
              <td><span className="badge badge-info">{i.kod}</span></td>
            </tr>
          ))}</tbody></table></div>
      </div></div>
    </div></>
  );
}
