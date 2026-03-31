'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import HelpTip from '@/components/HelpTip';

const EMPTY_FORM = {
  radnikId: '', radnikIme: '',
  datum: '', vrijemePovrede: '',
  tip: 'laka',
  lokacija: '', opisPovrede: '', uzrokPovrede: '',
  povredjeniDio: '', prvaPomoć: false, bolovanje: false,
  kolektivna: false, brojStradalih: '',
  prijavaOrgan: '', napomena: '',
  status: 'prijavljena',
};

export default function InjuriesPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { showFlash, SavedFlash } = useSavedFlash();
  const { markDirty, markClean } = useUnsavedChanges();
  const searchParams = useSearchParams();

  // ── Data state ──
  const [injuries, setInjuries] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewWorkerId, setViewWorkerId] = useState(null);

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  // ── Worker picker state ──
  const [workerSearch, setWorkerSearch] = useState('');
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
  const workerRef = useRef(null);

  const loadData = useCallback(() => {
    setInjuries(getAll(COLLECTIONS.INJURIES));
    setWorkers(getAll(COLLECTIONS.WORKERS));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(filtered.map(x => x.id)));
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
      for (let id of selectedIds) await remove(COLLECTIONS.INJURIES, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  // ── Zia agent: auto-open injury form with pre-filled worker ──────────────
  useEffect(() => {
    if (searchParams?.get('zia_new') !== '1') return;
    const radnikIme = searchParams.get('radnikIme') || '';
    const radnikId = searchParams.get('radnikId') || '';
    const datum = searchParams.get('datum') || new Date().toISOString().split('T')[0];
    const tip = searchParams.get('tip') || 'laka';
    setFormData({ ...EMPTY_FORM, radnikId, radnikIme, datum, tip });
    setWorkerSearch(radnikIme);
    setEditingId(null);
    setShowForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Open edit form from query param (injury-list click-through) ──
  useEffect(() => {
    const editId = searchParams?.get('editId');
    if (!editId) return;
    const inj = getAll(COLLECTIONS.INJURIES).find(i => i.id === editId);
    if (inj) {
      openEdit(inj);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Close worker dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (workerRef.current && !workerRef.current.contains(e.target)) {
        setShowWorkerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = (k, v) => { setFormData(f => ({ ...f, [k]: v })); markDirty(); };

  const filteredWorkers = workers.filter(w => {
    if (!workerSearch) return true;
    const q = workerSearch.toLowerCase();
    return `${w.ime} ${w.prezime}`.toLowerCase().includes(q) ||
      (w.evidencijskiBroj || '').toLowerCase().includes(q);
  });

  const handleWorkerSelect = (w) => {
    set('radnikId', w.id);
    set('radnikIme', `${w.ime} ${w.prezime}`);
    setWorkerSearch(`${w.ime} ${w.prezime}`);
    setShowWorkerDropdown(false);
  };

  const openNew = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setWorkerSearch('');
    setShowForm(true);
  };

  const openEdit = (inj) => {
    setEditingId(inj.id);
    setFormData({ ...inj });
    setWorkerSearch(inj.radnikIme || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.radnikId && !formData.radnikIme) {
      await alert(lang === 'bs' ? 'Odaberite radnika!' : 'Please select a worker!');
      return;
    }
    if (!formData.datum) {
      await alert(lang === 'bs' ? 'Datum je obavezan!' : 'Date is required!');
      return;
    }
    if (editingId) {
      update(COLLECTIONS.INJURIES, editingId, formData);
    } else {
      create(COLLECTIONS.INJURIES, formData);
    }
    loadData();
    markClean();
    setShowForm(false);
    showFlash();
  };

  const handleDelete = async (id) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati ovu prijavu?' : 'Delete this report?');
    if (!ok) return;
    remove(COLLECTIONS.INJURIES, id);
    loadData();
  };

  const filtered = injuries.filter(inj => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (inj.radnikIme || '').toLowerCase().includes(q) ||
      (inj.opisPovrede || '').toLowerCase().includes(q) ||
      (inj.lokacija || '').toLowerCase().includes(q);
  });

  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datum', 'desc');

  const tipBadge = (tip) => {
    const map = {
      laka: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: lang === 'bs' ? 'Laka' : 'Minor' },
      teska: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: lang === 'bs' ? 'Teška' : 'Severe' },
      smrtna: { color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', label: lang === 'bs' ? 'Smrtna' : 'Fatal' },
    };
    const s = map[tip] || map.laka;
    return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const statusBadge = (status) => {
    const map = {
      prijavljena: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', label: lang === 'bs' ? 'Prijavljena' : 'Reported' },
      u_obradi: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: lang === 'bs' ? 'U obradi' : 'Processing' },
      zatvorena: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: lang === 'bs' ? 'Zatvorena' : 'Closed' },
    };
    const s = map[status] || map.prijavljena;
    return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <>
      <DialogRenderer />
      <div className="animate-fadeIn">
        <h1 style={{ marginBottom: 24 }}>🩹 {t('injuryReport')}</h1>

        {/* Modal */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🩹 {editingId ? (lang === 'bs' ? 'Uredi prijavu' : 'Edit report') : t('injuryReport')}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Worker picker */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }} ref={workerRef}>
                    <label className="form-label">{t('worker')} *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        placeholder={lang === 'bs' ? '🔍 Pretraži radnika...' : '🔍 Search worker...'}
                        value={workerSearch}
                        onChange={e => { setWorkerSearch(e.target.value); setShowWorkerDropdown(true); set('radnikId', ''); set('radnikIme', ''); }}
                        onFocus={() => setShowWorkerDropdown(true)}
                        autoComplete="off"
                      />
                      {showWorkerDropdown && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 100, maxHeight: 220, overflowY: 'auto' }}>
                          {filteredWorkers.length === 0 ? (
                            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{lang === 'bs' ? 'Nema radnika' : 'No workers found'}</div>
                          ) : filteredWorkers.map(w => (
                            <button key={w.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              onClick={() => handleWorkerSelect(w)}
                            >
                              <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>{w.ime?.[0]}{w.prezime?.[0]}</span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>{w.ime} {w.prezime}</div>
                                {w.evidencijskiBroj && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ev. br: {w.evidencijskiBroj}</div>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {formData.radnikId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {lang === 'bs' ? 'Odabrano' : 'Selected'}: {formData.radnikIme}</div>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('date')} *</label>
                    <input className="form-input" type="date" value={formData.datum} onChange={e => set('datum', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'bs' ? 'Vrijeme povrede' : 'Time of injury'}</label>
                    <input className="form-input" type="time" value={formData.vrijemePovrede} onChange={e => set('vrijemePovrede', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{lang === 'bs' ? 'Tip povrede' : 'Injury type'} <HelpTip text="Odaberite klasifikaciju obavezno u apsolutnom slaganju sa zvaničnim ljekarskim nalazom hitne pomoći/doma zdravlja." /></label>
                    <select className="form-select" value={formData.tip} onChange={e => set('tip', e.target.value)}>
                      <option value="laka">{lang === 'bs' ? 'Laka' : 'Minor'}</option>
                      <option value="teska">{lang === 'bs' ? 'Teška' : 'Severe'}</option>
                      <option value="smrtna">{lang === 'bs' ? 'Smrtna' : 'Fatal'}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'bs' ? 'Status' : 'Status'}</label>
                    <select className="form-select" value={formData.status} onChange={e => set('status', e.target.value)}>
                      <option value="prijavljena">{lang === 'bs' ? 'Prijavljena' : 'Reported'}</option>
                      <option value="u_obradi">{lang === 'bs' ? 'U obradi' : 'Processing'}</option>
                      <option value="zatvorena">{lang === 'bs' ? 'Zatvorena' : 'Closed'}</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">{t('location')}</label>
                    <input className="form-input" value={formData.lokacija} onChange={e => set('lokacija', e.target.value)} placeholder={lang === 'bs' ? 'Npr. Hala 2, Skladište...' : 'E.g. Hall 2, Warehouse...'} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'bs' ? 'Povrijeđeni dio tijela' : 'Injured body part'}</label>
                    <input className="form-input" value={formData.povredjeniDio} onChange={e => set('povredjeniDio', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{lang === 'bs' ? 'Uzrok povrede' : 'Cause of injury'} <HelpTip text="Zbog čega je došlo do incidenta? Npr. 'Nepažnja radnika', 'Nekorištenje zaštitnog šljema', 'Kvar mašine'." /></label>
                    <input className="form-input" value={formData.uzrokPovrede} onChange={e => set('uzrokPovrede', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">{t('description')}</label>
                    <textarea className="form-input" rows={3} value={formData.opisPovrede} onChange={e => set('opisPovrede', e.target.value)} placeholder={lang === 'bs' ? 'Opis okolnosti povrede...' : 'Describe the circumstances of the injury...'} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" id="prvaPomoc" checked={formData.prvaPomoć} onChange={e => set('prvaPomoć', e.target.checked)} style={{ width: 16, height: 16 }} />
                    <label htmlFor="prvaPomoc" style={{ cursor: 'pointer', fontWeight: 500 }}>{lang === 'bs' ? 'Pružena prva pomoć' : 'First aid provided'}</label>
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" id="bolovanje" checked={formData.bolovanje} onChange={e => set('bolovanje', e.target.checked)} style={{ width: 16, height: 16 }} />
                    <label htmlFor="bolovanje" style={{ cursor: 'pointer', fontWeight: 500 }}>{lang === 'bs' ? 'Bolovanje' : 'Sick leave'}</label>
                  </div>

                  {/* ── Godišnji izvještaj fields ── */}
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-light)', marginTop: 4, paddingTop: 12 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 10 }}>
                      {lang === 'bs' ? 'Podaci za godišnji izvještaj' : 'Annual report data'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" id="kolektivna" checked={formData.kolektivna} onChange={e => set('kolektivna', e.target.checked)} style={{ width: 16, height: 16 }} />
                        <label htmlFor="kolektivna" style={{ cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>{lang === 'bs' ? 'Kolektivna povreda' : 'Collective injury'} <HelpTip text="Označiti isključivo ukoliko su u istom događaju povrijeđena minimalno 2 radnika." /></label>
                      </div>
                      {formData.kolektivna && (
                        <div className="form-group">
                          <label className="form-label">{lang === 'bs' ? 'Broj stradalih' : 'Number of victims'}</label>
                          <input className="form-input" type="number" min="2" value={formData.brojStradalih} onChange={e => set('brojStradalih', e.target.value)} placeholder="2" />
                        </div>
                      )}
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">{lang === 'bs' ? 'Prijava MUP stanici / Kantonalnoj inspekciji (broj i datum)' : 'Report to police / inspection (number & date)'}</label>
                        <input className="form-input" value={formData.prijavaOrgan} onChange={e => set('prijavaOrgan', e.target.value)} placeholder={lang === 'bs' ? 'Npr. Br. 12345/2026 od 15.03.2026.' : 'E.g. No. 12345/2026 dated 15.03.2026'} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">{lang === 'bs' ? 'Napomena (za godišnji izvještaj)' : 'Notes (for annual report)'}</label>
                        <input className="form-input" value={formData.napomena} onChange={e => set('napomena', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                {formData.radnikId && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginRight: 'auto' }}
                    onClick={() => { setShowForm(false); router.push(`/dashboard/medical-exams?openNew=1&workerId=${formData.radnikId}`); }}
                    title={lang === 'bs' ? 'Otvori formu za novi ljekarski pregled za ovog radnika' : 'Open new medical exam form for this worker'}
                  >
                    👨‍⚕️ {lang === 'bs' ? 'Pregled za radnika' : 'Exam for worker'}
                  </button>
                )}
                <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={openNew}>+ {t('add')}</button>
              <SavedFlash />
              <div className="search-bar" style={{ flex: 1, maxWidth: 350, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                <input
                  placeholder={lang === 'bs' ? 'Pretraži prijave...' : 'Search reports...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
                />
                {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
              </div>
            {/* ── Grupne akcije bar ── */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'} &mdash; Grupne akcije:
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ {lang === 'bs' ? 'Isprintaj' : 'Print'}</button>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
              </div>
            )}
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} {lang === 'bs' ? 'prijava' : 'reports'}</span>}
            </div>
            <div className="data-table-wrapper">
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={e => { if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id))); else setSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                    <th style={{ width: 90 }}>{t('actions')}</th>
                    <th onClick={() => toggleSort('radnikIme')} style={thStyle('radnikIme')}>{t('worker')}{sortIcon('radnikIme')}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{t('date')}{sortIcon('datum')}</th>
                    <th onClick={() => toggleSort('tip')} style={thStyle('tip')}>{lang === 'bs' ? 'Tip' : 'Type'}{sortIcon('tip')}</th>
                    <th onClick={() => toggleSort('lokacija')} style={thStyle('lokacija')}>{t('location')}{sortIcon('lokacija')}</th>
                    <th>{t('description')}</th>
                    <th onClick={() => toggleSort('status')} style={thStyle('status')}>{t('status')}{sortIcon('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sorted.map(inj => {
                    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
                    return (
                    <tr key={inj.id} onClick={() => openEdit(inj)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.has(inj.id)} onChange={() => toggleOne(inj.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ position: 'relative' }}>
                          <button className="btn btn-primary btn-sm" data-menu-trigger onClick={(e) => {
                            e.stopPropagation();
                            if (actionMenuId === inj.id) { setActionMenuId(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom - 8;
                            const spaceAbove = rect.top - 8;
                            const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
                            setMenuPos(flipUp
                              ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                              : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                            );
                            setActionMenuId(inj.id);
                          }}>Akcije ▼</button>
                          {actionMenuId === inj.id && (
                            <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div data-menu style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                              <button onClick={() => { setActionMenuId(null); openEdit(inj); }} style={menuItemSt}>✏️ Otvori</button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => { setActionMenuId(null); handleDelete(inj.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Izbriši</button>
                            </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <button onClick={e => { e.stopPropagation(); if (inj.radnikId) router.push('/dashboard/workers?openWorker=' + inj.radnikId); }} style={{ background: 'none', border: 'none', cursor: inj.radnikId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: inj.radnikId ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }} title={inj.radnikId ? (lang === 'bs' ? 'Otvori stranicu radnika' : 'Open worker page') : ''}>{inj.radnikIme || '—'}</button>
                      </td>
                      <td>{inj.datum ? new Date(inj.datum).toLocaleDateString(lang === 'bs' ? 'bs-BA' : 'en-GB') : '—'}</td>
                      <td>{tipBadge(inj.tip)}</td>
                      <td>{inj.lokacija || '—'}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inj.opisPovrede || '—'}</td>
                      <td>{statusBadge(inj.status)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {viewWorkerId && (
        <WorkerProfileModal
          workerId={viewWorkerId}
          onClose={() => setViewWorkerId(null)}
          onSaved={() => setViewWorkerId(null)}
        />
      )}
    </>
  );
}
