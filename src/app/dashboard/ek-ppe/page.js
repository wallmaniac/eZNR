'use client';
import DateInput from '@/components/DateInput';
import { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS, todayISO } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import Icon3D from '@/components/Icon3D';
import PageHeader from '@/components/PageHeader';

export default function EKPPEPage() {
  const { lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();

  // ── State ──
  const [ppeTypes, setPpeTypes] = useState(() => getAll(COLLECTIONS.PPE_TYPES));
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false), []);
  const [search, setSearch] = useState('');

  // ── Add/Edit OZO type modal ──
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ naziv: '' });

  // ── Assign modal ──
  const [assignFor, setAssignFor] = useState(null); // the PPE type object
  const [assignForm, setAssignForm] = useState({ workerId: '', datumZaduzenja: todayISO(), kolicina: 1 });

  const reload = useCallback(() => setPpeTypes(getAll(COLLECTIONS.PPE_TYPES)), []);
  const [selected, setSelected] = useState(new Set()); // selected ids for bulk delete

  const toggleSelect = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));
  const handleDeleteSelected = async () => {
    const ok = await confirm(lang === 'bs' ? `Obrisati ${selected.size} označenih OZO?` : `Delete ${selected.size} selected PPE types?`);
    if (!ok) return;
    selected.forEach(id => remove(COLLECTIONS.PPE_TYPES, id));
    setSelected(new Set());
    reload();
  };

  // filtered list
  const filtered = useMemo(() =>
    ppeTypes.filter(p => !search || p.naziv?.toLowerCase().includes(search.toLowerCase())),
    [ppeTypes, search]);

  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'naziv');

  // ── CRUD handlers ──
  const handleOpenNew = () => { setForm({ naziv: '' }); setEditingId(null); setShowForm(true); };
  const handleEdit = (item) => { setForm({ naziv: item.naziv }); setEditingId(item.id); setShowForm(true); };
  const handleSave = () => {
    if (!form.naziv.trim()) return;
    if (editingId) update(COLLECTIONS.PPE_TYPES, editingId, { naziv: form.naziv.trim() });
    else create(COLLECTIONS.PPE_TYPES, { naziv: form.naziv.trim() });
    setShowForm(false);
    reload();
  };
  const handleDelete = async (item) => {
    const ok = await confirm(lang === 'bs' ? `Obrisati "${item.naziv}"?` : `Delete "${item.naziv}"?`);
    if (ok) { remove(COLLECTIONS.PPE_TYPES, item.id); reload(); }
  };

  // ── Assign handler ──
  const handleOpenAssign = (ppe) => {
    setAssignFor(ppe);
    setAssignForm({ workerId: '', datumZaduzenja: todayISO(), kolicina: 1 });
  };
  const handleAssign = async () => {
    if (!assignForm.workerId) return;
    const ppeName = assignFor.naziv;
    create(COLLECTIONS.PPE_ASSIGNMENTS, {
      workerId: assignForm.workerId,
      naziv: ppeName,
      datumZaduzenja: assignForm.datumZaduzenja || todayISO(),
      kolicina: assignForm.kolicina || 1,
      datumRazduzenja: '',
    });
    setAssignFor(null); // close modal first
    await alert(lang === 'bs' ? `OZO "${ppeName}" uspješno zaduženo radniku!` : `PPE "${ppeName}" successfully assigned!`);
  };

  return (
    <>
      <DialogRenderer />
      <div className="animate-fadeIn">
        <PageHeader icon="🔍" title={"EK — Osobna zaštitna oprema"} />

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={handleOpenNew}>
            + {lang === 'bs' ? 'Dodaj novu OZO' : 'Add new PPE'}
          </button>
          <div className="search-bar" style={{ flex: 1, maxWidth: 380, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'bs' ? 'Pretraži OZO...' : 'Search PPE...'}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
          </div>
          {selected.size > 0 && (
            <button
              className="btn btn-sm"
              style={{ background: 'var(--danger)', color: '#fff', fontWeight: 700 }}
              onClick={handleDeleteSelected}
            >
              🗑️ {lang === 'bs' ? `Obriši označene (${selected.size})` : `Delete selected (${selected.size})`}
            </button>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto' }}>
            {filtered.length} {lang === 'bs' ? 'vrsta OZO' : 'PPE types'}
          </span>
        </div>

        {/* Table */}
        <div className="card"><div className="card-body" style={{ padding: 0 }}>
          <div className="data-table-wrapper"><table className="data-table">
            <thead><tr>
              <th style={{ width: 40, textAlign: 'center' }}>
                <input type="checkbox" checked={sorted.length > 0 && selected.size === sorted.length} onChange={toggleAll} title={lang === 'bs' ? 'Označi sve' : 'Select all'} />
              </th>
              <th style={{ width: 44 }}>Rb.</th>
              <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{lang === 'bs' ? 'Naziv OZO' : 'PPE Name'}{sortIcon('naziv')}</th>
              <th style={{ width: 200, textAlign: 'center' }}>{lang === 'bs' ? 'Akcije' : 'Actions'}</th>
            </tr></thead>
            <tbody>
              {sorted.length === 0
                ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    {lang === 'bs' ? 'Nema OZO u katalogu.' : 'No PPE in catalogue.'}
                  </td></tr>
                : sorted.map((p, idx) => (
                  <tr key={p.id} style={{ background: selected.has(p.id) ? 'rgba(var(--primary-rgb,99,102,241),0.07)' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>🦺 {p.naziv}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          title={lang === 'bs' ? 'Zaduži radniku' : 'Assign to worker'}
                          onClick={() => handleOpenAssign(p)}
                          style={{ fontSize: '0.78rem' }}
                        >
                          👤 {lang === 'bs' ? 'Zaduži' : 'Assign'}
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Uredi naziv' : 'Edit name'} onClick={() => handleEdit(p)}>✏️</button>
                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={lang === 'bs' ? 'Obriši' : 'Delete'} onClick={() => handleDelete(p)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table></div>
        </div></div>
      </div>

      {/* ── Add/Edit OZO type modal ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? '✏️' : '+'} {lang === 'bs' ? (editingId ? 'Uredi OZO' : 'Nova OZO') : (editingId ? 'Edit PPE' : 'New PPE')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Naziv OZO *' : 'PPE Name *'}</label>
                <input
                  className="form-input"
                  value={form.naziv}
                  onChange={e => setForm({ naziv: e.target.value })}
                  placeholder={lang === 'bs' ? 'npr. Zaštitna kaciga, Vizir...' : 'e.g. Hard hat, Face shield...'}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{lang === 'bs' ? 'Odustani' : 'Cancel'}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.naziv.trim()}>
                💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign to worker modal ── */}
      {assignFor && (
        <div className="modal-overlay" onClick={() => setAssignFor(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <h2 style={{ color: 'white' }}>👤 {lang === 'bs' ? 'Zaduži OZO radniku' : 'Assign PPE to worker'}</h2>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setAssignFor(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: '10px 14px', background: 'rgba(var(--primary-rgb, 99,102,241),0.08)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
                🦺 {assignFor.naziv}
              </div>
              <div className="form-group">
                <label className="form-label">👤 {lang === 'bs' ? 'Radnik *' : 'Worker *'}</label>
                <select className="form-select" value={assignForm.workerId} onChange={e => setAssignForm(f => ({ ...f, workerId: e.target.value }))}>
                  <option value="">{lang === 'bs' ? '— Odaberi radnika —' : '— Select worker —'}</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.ime} {w.prezime}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">📅 {lang === 'bs' ? 'Datum zaduženja' : 'Assignment date'}</label>
                  <DateInput value={assignForm.datumZaduzenja} onChange={v => setAssignForm(f => ({ ...f, datumZaduzenja: v }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'bs' ? 'Količina' : 'Quantity'}</label>
                  <input className="form-input" type="number" min="1" value={assignForm.kolicina} onChange={e => setAssignForm(f => ({ ...f, kolicina: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAssignFor(null)}>{lang === 'bs' ? 'Odustani' : 'Cancel'}</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={!assignForm.workerId}>
                ✅ {lang === 'bs' ? 'Zaduži' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
