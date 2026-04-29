'use client';
import DateInput from '@/components/DateInput';
import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, remove, COLLECTIONS, formatDate, todayISO } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { logPPEAssigned } from '@/lib/activityLog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useDialog } from '@/hooks/useDialog';
import PDFExportButton from '@/components/PDFExportButton';
import { generatePPEReport } from '@/lib/pdfReportGenerator';
import Icon3D from '@/components/Icon3D';
import PageHeader from '@/components/PageHeader';

export default function WorkerPPEPage() {
  const { t, lang } = useLanguage();
  const { confirm, DialogRenderer } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrgUnit, setFilterOrgUnit] = useState('');
  const orgUnits = useMemo(() => getAll(COLLECTIONS.ORG_UNITS), []);
  const [viewWorkerId, setViewWorkerId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
  const [saving, setSaving] = useState(false);
  const { showFlash, SavedFlash } = useSavedFlash();

  const [assignments, setAssignments] = useState(() => getAll(COLLECTIONS.PPE_ASSIGNMENTS));
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);
  const [ppeTypes, setPpeTypes] = useState(() => getAll(COLLECTIONS.PPE_TYPES));

  const rows = useMemo(() => {
    return assignments.map(a => {
      const w = workers.find(x => x.id === a.workerId);
      return { ...a, workerName: w ? `${w.ime} ${w.prezime}` : '-', workerId: a.workerId, _orgJedinicaId: w?.orgJedinicaId || '' };
    }).filter(r => {
      if (filterOrgUnit && r._orgJedinicaId !== filterOrgUnit) return false;
      if (!searchTerm) return true;
      return r.workerName.toLowerCase().includes(searchTerm.toLowerCase()) || (r.naziv || '').toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [assignments, workers, searchTerm, filterOrgUnit]);

  // Date-aware sort: datumZaduzenja is stored as ISO string "yyyy-mm-dd" — sorts correctly
  const { sorted: sortedRows, toggleSort, sortIcon, thStyle } = useSortedList(rows, 'workerName');

  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(sortedRows.map(x => x.id)));
    else setSelectedIds(new Set());
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} zaduženja?` : `Delete ${selectedIds.size} assignments?`)) {
      for (let id of selectedIds) remove(COLLECTIONS.PPE_ASSIGNMENTS, id);
      setSelectedIds(new Set());
      setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
    }
  };

  const handleDelete = async (id) => {
    if (await confirm(lang === 'bs' ? 'Obrisati zaduženje?' : 'Delete assignment?')) {
      remove(COLLECTIONS.PPE_ASSIGNMENTS, id);
      setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
    }
  };

  const handleSave = () => {
    if (!addForm.workerId || !addForm.naziv.trim()) return;
    setSaving(true);
    const saved = create(COLLECTIONS.PPE_ASSIGNMENTS, {
      workerId: addForm.workerId,
      naziv: addForm.naziv.trim(),
      datumZaduzenja: addForm.datumZaduzenja || todayISO(),
      kolicina: addForm.kolicina || 1,
      datumRazduzenja: '',
    });
    const w = workers.find(x => x.id === addForm.workerId);
    const workerName = w ? `${w.ime} ${w.prezime}` : '';
    try { logPPEAssigned(saved, workerName, null); } catch { }
    setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
    setShowAddModal(false);
    setAddForm({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
    setSaving(false);
    showFlash();
  };

  const openModal = () => {
    setAddForm({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
    setShowAddModal(true);
  };

  const clickableName = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' };
  const clickableNaziv = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 500, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--primary)' };
  const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

  return (
    <>
      <DialogRenderer />
      <div className="animate-fadeIn">
        <PageHeader icon="🔍" title={t('workerPPE')} />
        <div className="card"><div className="card-body" style={{ padding: 0 }}>
          <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={openModal}>
              + {lang === 'bs' ? 'Dodaj OZO' : 'Add PPE'}
            </button>
            <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
              <input
                placeholder={lang === 'bs' ? 'Pretraži po radniku, opremi...' : 'Search by worker, item...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }}
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
            </div>
            <PDFExportButton buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }} options={[
              { label: lang === 'bs' ? 'Sva OZO zaduženja' : 'All PPE assignments', icon: '🦺', onClick: () => generatePPEReport(sortedRows.map(r => r.id), lang) },
              ...(selectedIds.size > 0 ? [{ label: `${lang === 'bs' ? 'Odabrano' : 'Selected'} (${selectedIds.size})`, icon: '✓', onClick: () => generatePPEReport(sortedRows.filter(r => selectedIds.has(r.id)).map(r => r.id), lang) }] : []),
            ]} />
            <SavedFlash />
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'}:
                </span>
                <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
              </div>
            )}
            {selectedIds.size === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto', flexShrink: 0 }}>{sortedRows.length} {t('records')}</span>}
          </div>

          <div className="data-table-wrapper"><table className="data-table"><thead><tr>
            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sortedRows.length && sortedRows.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
            <th style={{ width: 90 }}>{t('actions')}</th>
            <th style={thStyle('workerName')} onClick={() => toggleSort('workerName')}>{t('worker')}{sortIcon('workerName')}</th>
            <th style={thStyle('naziv')} onClick={() => toggleSort('naziv')}>{t('name')}{sortIcon('naziv')}</th>
            <th style={thStyle('datumZaduzenja')} onClick={() => toggleSort('datumZaduzenja')}>{t('assignmentDate')}{sortIcon('datumZaduzenja')}</th>
            <th style={thStyle('kolicina')} onClick={() => toggleSort('kolicina')}>{lang === 'bs' ? 'Količina' : 'Quantity'}{sortIcon('kolicina')}</th>
          </tr></thead><tbody>
              {sortedRows.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                : sortedRows.map((r, idx) => (
                  <tr key={r.id || idx} style={{ transition: 'background 0.12s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                    </td>
                    <td>
                      <div style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" data-menu-trigger onClick={(e) => {
                          e.stopPropagation();
                          if (actionMenuId === r.id) { setActionMenuId(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom - 8;
                          const spaceAbove = rect.top - 8;
                          const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
                          setMenuPos(flipUp
                            ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                            : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                          );
                          setActionMenuId(r.id);
                        }}>Akcije ▼</button>
                        {actionMenuId === r.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div data-menu style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                              <button onClick={() => { setActionMenuId(null); handleDelete(r.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Izbriši</button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <button style={clickableName} onClick={() => { if (r.workerId) setViewWorkerId(r.workerId); }} title={lang === 'bs' ? 'Klikni za pregled profila radnika' : 'Click to view worker profile'}>
                        {r.workerName}
                      </button>
                    </td>
                    <td>
                      <button style={clickableNaziv} onClick={() => { if (r.workerId) setViewWorkerId(r.workerId); }}>
                        🦺 {r.naziv}
                      </button>
                    </td>
                    <td>{formatDate(r.datumZaduzenja)}</td>
                    <td>{r.kolicina ?? 1}</td>
                  </tr>
                ))}
            </tbody></table></div>
        </div></div>
      </div>

      {/* Add New PPE Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)} style={{ zIndex: 200 }}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon3D name="OZO.png" size={56} />
                <h2 style={{ color: 'white', margin: 0 }}>{lang === 'bs' ? 'Dodaj osobnu zaštitnu opremu' : 'Add personal protective equipment'}</h2>
              </div>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">👤 {lang === 'bs' ? 'Radnik *' : 'Worker *'}</label>
                <select className="form-select" value={addForm.workerId} onChange={e => setAddForm(f => ({ ...f, workerId: e.target.value }))}>
                  <option value="">{lang === 'bs' ? '— Odaberi radnika —' : '— Select worker —'}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.ime} {w.prezime}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">🦺 {lang === 'bs' ? 'Naziv opreme *' : 'Equipment name *'}</label>
                {/* Select from catalogue */}
                <select
                  className="form-select"
                  value={ppeTypes.some(p => p.naziv === addForm.naziv) ? addForm.naziv : '__custom__'}
                  onChange={e => {
                    if (e.target.value !== '__custom__') setAddForm(f => ({ ...f, naziv: e.target.value }));
                    else setAddForm(f => ({ ...f, naziv: '' }));
                  }}
                  style={{ marginBottom: 6 }}
                >
                  <option value="__custom__">{lang === 'bs' ? '— Odaberi iz kataloga ili unesi ručno —' : '— Select from catalogue or enter manually —'}</option>
                  {ppeTypes.sort((a, b) => (a.naziv || '').localeCompare(b.naziv || '')).map(p => (
                    <option key={p.id} value={p.naziv}>{p.naziv}</option>
                  ))}
                </select>
                {/* Manual entry fallback */}
                <input
                  className="form-input"
                  value={addForm.naziv}
                  onChange={e => setAddForm(f => ({ ...f, naziv: e.target.value }))}
                  placeholder={lang === 'bs' ? 'ili upiši naziv ručno...' : 'or type a custom name...'}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">📅 {lang === 'bs' ? 'Datum zaduženja' : 'Assignment date'}</label>
                  <DateInput value={addForm.datumZaduzenja} onChange={v => setAddForm(f => ({ ...f, datumZaduzenja: v }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'bs' ? 'Količina' : 'Quantity'}</label>
                  <input className="form-input" type="number" min="1" value={addForm.kolicina} onChange={e => setAddForm(f => ({ ...f, kolicina: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!addForm.workerId || !addForm.naziv.trim() || saving}>
                {saving ? '⏳' : '💾'} {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewWorkerId && (
        <WorkerProfileModal
          workerId={viewWorkerId}
          onClose={() => setViewWorkerId(null)}
          onSaved={() => { setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS)); setViewWorkerId(null); }}
        />
      )}
    </>
  );
}
