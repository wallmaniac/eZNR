'use client';
import DateInput from '@/components/DateInput';
import { createPortal } from 'react-dom';
import { useState, useMemo, useEffect, useCallback, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSearchParams } from 'next/navigation';
import { getAll, create, update, remove, COLLECTIONS, formatDate, todayISO } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { logPPEAssigned } from '@/lib/activityLog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useDialog } from '@/hooks/useDialog';
import PDFExportButton from '@/components/PDFExportButton';
import { generatePPEReport } from '@/lib/pdfReportGenerator';
import * as XLSX from 'xlsx';
import Icon3D from '@/components/Icon3D';
import PageHeader from '@/components/PageHeader';

function WorkerPPEInner() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const openId = searchParams ? searchParams.get('openId') : null;
  const { confirm, DialogRenderer } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrgUnit, setFilterOrgUnit] = useState('');
  const orgUnits = useMemo(() => getAll(COLLECTIONS.ORG_UNITS), []);
  const [viewWorkerId, setViewWorkerId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addForm, setAddForm] = useState({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
  const [saving, setSaving] = useState(false);
  const { showFlash, SavedFlash } = useSavedFlash();

  const [assignments, setAssignments] = useState(() => getAll(COLLECTIONS.PPE_ASSIGNMENTS));
  const [workers, setWorkers] = useState(() => getAll(COLLECTIONS.WORKERS));
  const [ppeTypes, setPpeTypes] = useState(() => getAll(COLLECTIONS.PPE_TYPES));

  useEffect(() => {
      if (typeof window === 'undefined') return;
      const loadData = () => {
          setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
          setWorkers(getAll(COLLECTIONS.WORKERS));
          setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));
      };
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, []);

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
    if (await confirm(t('deleteAssignments').replace('{0}', selectedIds.size))) {
      for (let id of selectedIds) remove(COLLECTIONS.PPE_ASSIGNMENTS, id);
      setSelectedIds(new Set());
      setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
    }
  };

  const handleDelete = async (id) => {
    if (await confirm(t('obrisatiZaduzenje'))) {
      remove(COLLECTIONS.PPE_ASSIGNMENTS, id);
      setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
    }
  };

  const handleSave = () => {
    if (!addForm.workerId || !addForm.naziv.trim()) return;
    setSaving(true);
    const payload = {
      workerId: addForm.workerId,
      naziv: addForm.naziv.trim(),
      datumZaduzenja: addForm.datumZaduzenja || todayISO(),
      kolicina: addForm.kolicina || 1,
    };
    if (editingId) {
      update(COLLECTIONS.PPE_ASSIGNMENTS, editingId, payload);
    } else {
      payload.datumRazduzenja = '';
      const saved = create(COLLECTIONS.PPE_ASSIGNMENTS, payload);
      const w = workers.find(x => x.id === addForm.workerId);
      const workerName = w ? `${w.ime} ${w.prezime}` : '';
      try { logPPEAssigned(saved, workerName, null); } catch { }
    }
    setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
    setShowAddModal(false);
    setAddForm({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
    setEditingId(null);
    setSaving(false);
    showFlash();
  };

  const openModal = () => {
    setEditingId(null);
    setAddForm({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
    setShowAddModal(true);
  };

  const handleEditModal = (item) => {
    setEditingId(item.id);
    setAddForm({ workerId: item.workerId, naziv: item.naziv || '', datumZaduzenja: item.datumZaduzenja || todayISO(), kolicina: item.kolicina || 1 });
    setShowAddModal(true);
  };

  useEffect(() => {
    if (openId && assignments.length > 0) {
      const item = assignments.find(x => x.id === openId);
      if (item) {
        handleEditModal(item);
      }
    }
  }, [openId, assignments]);

  const handleExcelExport = useCallback((forceAll = false) => {
    const targetRows = (!forceAll && selectedIds.size > 0)
      ? sortedRows.filter(r => selectedIds.has(r.id))
      : sortedRows;

    const dataRows = targetRows.map(r => ({
      [t('worker')]: r.workerName,
      [t('name')]: r.naziv || '—',
      [t('assignmentDate')]: r.datumZaduzenja ? r.datumZaduzenja.split('T')[0].split('-').reverse().join('.') : '—',
      [t('kolicina')]: r.kolicina || 1
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OZO');
    XLSX.writeFile(wb, `OZO_izvoz_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [selectedIds, sortedRows, t]);

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
            <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={openModal} title={t('dodajNovuOzo')}>
              + {t('dodajOzo')}
            </button>
            <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
              <input
                placeholder={t('pretraziPoRadnikuOpremi')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%', minWidth: 0 }}
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title={t('ponistiPretragu')}>✕</button>}
            </div>
            <PDFExportButton
              label={lang !== 'en' ? 'Izvještaji' : 'Reports'}
              title={t('prikaziPdfIzvjestaje')}
              buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }}
              options={[
                { header: lang !== 'en' ? 'PDF Izvještaji' : 'PDF Reports' },
                { label: t('svaOzoZaduzenja'), icon: '🦺', onClick: () => generatePPEReport(sortedRows.map(r => r.id), lang) },
                ...(selectedIds.size > 0 ? [{ label: `${t('odabrano1')} (${selectedIds.size})`, icon: '✓', onClick: () => generatePPEReport(sortedRows.filter(r => selectedIds.has(r.id)).map(r => r.id), lang) }] : []),
                { divider: true },
                { header: lang !== 'en' ? 'Excel Izvoz' : 'Excel Export' },
                { label: lang !== 'en' ? 'Sva OZO zaduženja' : 'All PPE Assignments', icon: '📥', onClick: () => handleExcelExport(true) },
                ...(selectedIds.size > 0 ? [{ label: lang !== 'en' ? `Odabrana zaduženja (${selectedIds.size})` : `Selected Assignments (${selectedIds.size})`, icon: '📥', onClick: () => handleExcelExport(false) }] : []),
              ]}
            />
            <SavedFlash />
            {selectedIds.size === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto', flexShrink: 0 }}>{sortedRows.length} {t('records')}</span>}
          </div>

          {/* ── Bulk Action Bar ────────────────────────────────────────── */}
          {selectedIds.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid rgba(0,191,166,0.2)',
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                ✓ {selectedIds.size} {t('odabrano')} — {t('grupneAkcije') || 'Grupne akcije'}:
              </span>
              <button className="btn btn-sm btn-danger" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 }} onClick={handleDeleteSelected} title={t('obrisiOdabranuOzo')}>
                🗑️ {t('obrisi')}
              </button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center' }} onClick={() => setSelectedIds(new Set())} title={t('ponistiOdabir')}>
                ✕
              </button>
            </div>
          )}

          <div className="data-table-wrapper"><table className="data-table"><thead><tr>
            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sortedRows.length && sortedRows.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
            <th style={{ width: 90 }}>{t('actions')}</th>
            <th style={thStyle('workerName')} onClick={() => toggleSort('workerName')}>{t('worker')}{sortIcon('workerName')}</th>
            <th style={thStyle('naziv')} onClick={() => toggleSort('naziv')}>{t('name')}{sortIcon('naziv')}</th>
            <th style={thStyle('datumZaduzenja')} onClick={() => toggleSort('datumZaduzenja')}>{t('assignmentDate')}{sortIcon('datumZaduzenja')}</th>
            <th style={thStyle('kolicina')} onClick={() => toggleSort('kolicina')}>{t('kolicina')}{sortIcon('kolicina')}</th>
          </tr></thead><tbody>
              {sortedRows.length === 0
                ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                : sortedRows.map((r, idx) => (
                  <tr key={r.id || idx} style={{ transition: 'background 0.12s' }}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                    </td>
                    <td>
                      <div style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" data-menu-trigger onMouseDown={(e) => e.preventDefault()} onClick={(e) => {
                          e.stopPropagation();
                          if (actionMenuId === r.id) { setActionMenuId(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const spaceAbove = rect.top;
                          const flipUp = spaceBelow < 180 && spaceAbove> spaceBelow;
                          setMenuPos(flipUp
                              ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                              : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                          );
                          setActionMenuId(r.id);
                        }} title={t('prikaziAkcijeZaOzo')}>
                          {t('actions1')}
                        </button>
                        {actionMenuId === r.id && typeof document !== 'undefined' && createPortal(
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div data-menu onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{r.workerName}</span>
                                  <button onClick={() => setActionMenuId(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                              </div>
                              <button onClick={() => { setActionMenuId(null); handleEditModal(r); }} className="dropdown-item" className="action-menu-item">✏️ {t('urediOzo')}</button>
                              <button onClick={() => { setActionMenuId(null); if (r.workerId) setViewWorkerId(r.workerId); }} className="dropdown-item" className="action-menu-item">📂 {t('otvoriProfil')}</button>
                              <button onClick={() => { setActionMenuId(null); setAddForm({ workerId: '', naziv: r.naziv || '', datumZaduzenja: todayISO(), kolicina: r.kolicina || 1 }); setShowAddModal(true); }} className="dropdown-item" className="action-menu-item">📋 {t('kopiraj')}</button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => { setActionMenuId(null); handleDelete(r.id); }} className="dropdown-item text-danger" className="action-menu-item-danger">🗑️ {t('izbrisi')}</button>
                            </div>
                            </>, document.body
                          )}
                      </div>
                    </td>
                    <td>
                      <button style={clickableName} onClick={() => { if (r.workerId) setViewWorkerId(r.workerId); }} title={t('klikniZaPregledProfilaRadnika')}>
                        {r.workerName}
                      </button>
                    </td>
                    <td>
                      <button style={clickableNaziv} onClick={() => handleEditModal(r)}>
                        🦺 {t(r.naziv?.trim()) || r.naziv}
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
                <h2 style={{ color: 'white', margin: 0 }}>{editingId ? (t('urediOzo')) : (t('dodajOsobnuZastitnuOpremu'))}</h2>
              </div>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">👤 {t('radnik')}</label>
                <select className="form-select" value={addForm.workerId} onChange={e => setAddForm(f => ({ ...f, workerId: e.target.value }))}>
                  <option value="">{t('odaberiRadnika')}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.ime} {w.prezime}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">🦺 {t('nazivOpreme')}</label>
                {/* Select from catalogue */}
                <select
                  className="form-select"
                  value={ppeTypes.some(p => p.naziv === addForm.naziv) ? addForm.naziv : '__custom__'}
                  onChange={e => {
                    if (e.target.value !== '__custom__') setAddForm(f => ({ ...f, naziv: e.target.value }));
                    else setAddForm(f => ({ ...f, naziv: '' }));
                  }}
                  style={{ marginBottom: 6 }}>
                  <option value="__custom__">{t('odaberiIzKatalogaIliUnesi')}</option>
                  {ppeTypes.sort((a, b) => (a.naziv || '').localeCompare(b.naziv || '')).map(p => (
                    <option key={p.id} value={p.naziv}>{t(p.naziv?.trim()) || p.naziv}</option>
                  ))}
                </select>
                {/* Manual entry fallback */}
                <input
                  className="form-input"
                  value={addForm.naziv}
                  onChange={e => setAddForm(f => ({ ...f, naziv: e.target.value }))}
                  placeholder={t('iliUpisiNazivRucno')}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">📅 {t('datumZaduzenja')}</label>
                  <DateInput value={addForm.datumZaduzenja} onChange={v => setAddForm(f => ({ ...f, datumZaduzenja: v }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('kolicina')}</label>
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

export default function WorkerPPEPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>⏳</div>}>
      <WorkerPPEInner />
    </Suspense>
  );
}
