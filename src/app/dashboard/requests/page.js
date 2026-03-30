'use client';
import {  useState, useEffect, useCallback, useRef  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';

const EMPTY_ZAHTJEVNICA = {
  zahtjevnicaBroj: '',
  datum: todayISO(),
  workerId: '',
  mjestoTroska: '',
  orgJedinicaId: '',
  odobrioId: '',
  skladistarId: '',
  napomena: '',
  stavke: [], // array of items
  docName: '',
  docData: '',
};

const EMPTY_STAVKA = {
  opisno: '',
  zastitnoSredstvoId: '',
  zastitnoSredstvoNaziv: '',
  redBr: 1,
  velicina: '',
  jedMjera: '',
  komada: 1,
};

export default function RequestsPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { showFlash, SavedFlash } = useSavedFlash();

  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [ppeTypes, setPpeTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_ZAHTJEVNICA });
  const [search, setSearch] = useState('');
  const docInputRef = useRef(null);
  // Item sub-form
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [itemData, setItemData] = useState({ ...EMPTY_STAVKA });

  const loadData = useCallback(() => {
    setRecords(getAll(COLLECTIONS.REQUESTS));
    setWorkers(getAll(COLLECTIONS.WORKERS));
    setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
    setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));
  }, []);


  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(records.map(x => x.id)));
    else setSelectedIds(new Set());
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const handleDuplicate = async (it) => {
    const copy = { ...it };
    delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    copy.datum = new Date().toISOString().split('T')[0];
    await create(COLLECTIONS.REQUESTS, copy);
    loadData();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.REQUESTS, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  useEffect(() => { loadData(); }, [loadData]);
  
  useEffect(() => {
    const openId = searchParams?.get('openId');
    if (openId && records.length > 0 && !showForm) {
      const rec = records.find(r => r.id === openId);
      if (rec) handleEdit(rec);
    }
  }, [searchParams, records]);
  const filteredRecords = search
    ? records.filter(r => r.zahtjevnicaBroj?.toLowerCase().includes(search.toLowerCase()) || r.napomena?.toLowerCase().includes(search.toLowerCase()))
    : records;
    const enrichedRecords = filteredRecords.map(r => {
    const _w = workers.find(wk => wk.id === r.workerId);
    return { ...r, _workerName: _w ? `${_w.prezime} ${_w.ime}` : '—' };
  });
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(enrichedRecords, 'datum');


  

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
  const setItem = (field, value) => setItemData(prev => ({ ...prev, [field]: value }));

  const handleNew = () => {
    setFormData({ ...EMPTY_ZAHTJEVNICA, datum: todayISO(), stavke: [] });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({ ...EMPTY_ZAHTJEVNICA, ...item, stavke: item.stavke || [] });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati zahtjevnicu?' : 'Delete request?');
    if (ok) { remove(COLLECTIONS.REQUESTS, id); loadData(); }
  };

  const handleSave = async () => {
    if (editingId) {
      update(COLLECTIONS.REQUESTS, editingId, formData);
    } else {
      create(COLLECTIONS.REQUESTS, formData);
    }
    setShowForm(false);
    loadData();
    showFlash();
  };

  // ── Item sub-form handlers ──
  const handleNewItem = () => {
    const nextRedBr = formData.stavke.length + 1;
    setItemData({ ...EMPTY_STAVKA, redBr: nextRedBr });
    setEditingItemIdx(null);
    setShowItemForm(true);
  };

  const handleEditItem = (idx) => {
    setItemData({ ...formData.stavke[idx] });
    setEditingItemIdx(idx);
    setShowItemForm(true);
  };

  const handleDeleteItem = async (idx) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati stavku?' : 'Delete item?');
    if (ok) {
      setFormData(prev => ({
        ...prev,
        stavke: prev.stavke.filter((_, i) => i !== idx),
      }));
    }
  };

  const handleSaveItem = () => {
    // Auto-fill PPE name if selected
    const enriched = { ...itemData };
    if (enriched.zastitnoSredstvoId) {
      const ppe = ppeTypes.find(p => p.id === enriched.zastitnoSredstvoId);
      if (ppe) enriched.zastitnoSredstvoNaziv = ppe.naziv || ppe.name || '';
    }

    setFormData(prev => {
      const newStavke = [...prev.stavke];
      if (editingItemIdx !== null) {
        newStavke[editingItemIdx] = enriched;
      } else {
        newStavke.push(enriched);
      }
      return { ...prev, stavke: newStavke };
    });
    setShowItemForm(false);
  };

  const getWorkerName = (id) => {
    const w = workers.find(wk => wk.id === id);
    return w ? `${w.prezime} ${w.ime}` : '—';
  };
  const getOrgName = (id) => {
    const o = orgUnits.find(ou => ou.id === id);
    return o ? o.naziv : '—';
  };

  const labelSt = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };
  const sectionTitle = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 };

  // ── Item sub-form modal ──
  const renderItemForm = () => {
    if (!showItemForm) return null;
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="card" style={{ width: 600, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto' }}>
          <div className="card-body">
            <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                {editingItemIdx !== null
                  ? (lang === 'bs' ? 'Uredi stavku zahtjevnice' : 'Edit request item')
                  : (lang === 'bs' ? 'Nova stavka zahtjevnice' : 'New request item')}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowItemForm(false)} style={{ marginLeft: 8 }}>✕</button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Opisno' : 'Description'}</div>
              <input className="form-input" value={itemData.opisno} onChange={e => setItem('opisno', e.target.value)} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Zaštitno sredstvo' : 'Protective equipment'}</div>
              <select className="form-select" value={itemData.zastitnoSredstvoId} onChange={e => setItem('zastitnoSredstvoId', e.target.value)}>
                <option value="">{lang === 'bs' ? '— Odaberite —' : '— Select —'}</option>
                {ppeTypes.map(p => (
                  <option key={p.id} value={p.id}>{p.naziv || p.name || p.id}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 100px', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={labelSt}>RedBr</div>
                <input className="form-input" type="number" min="1" value={itemData.redBr} onChange={e => setItem('redBr', Number(e.target.value))} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Veličina' : 'Size'}</div>
                <input className="form-input" value={itemData.velicina} onChange={e => setItem('velicina', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Jed. mjera' : 'Unit'}</div>
                <input className="form-input" value={itemData.jedMjera} onChange={e => setItem('jedMjera', e.target.value)} placeholder={lang === 'bs' ? 'npr. kom, par' : 'e.g. pcs, pair'} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Komada' : 'Qty'}</div>
                <input className="form-input" type="number" min="1" value={itemData.komada} onChange={e => setItem('komada', Number(e.target.value))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveItem}>
                💾 {lang === 'bs' ? 'Snimi' : 'Save'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowItemForm(false)}>
                ↩ {lang === 'bs' ? 'Odustani' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── List view ──
  if (!showForm) {
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>📝 {t('requests')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Nova zahtjevnica' : 'New request'}
            </button>
            
            {/* Grupne akcije bar */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'} &mdash; Grupne akcije:
                </span>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ {lang === 'bs' ? 'Isprintaj' : 'Print'}</button>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
              </div>
            )}
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{records.length} {lang === 'bs' ? 'zapisa' : 'records'}</span>}
          </div>
            <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
              <input
                placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
              />
              {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>✕</button>}
            </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={e => { if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id))); else setSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                    <th style={{ width: 90 }}>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>
                    <th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}{sortIcon('_workerName')}</th>
                    <th>{lang === 'bs' ? 'Org. jedinica' : 'Org. unit'}</th>
                    <th>{lang === 'bs' ? 'Stavke' : 'Items'}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sorted.map((r, idx) => {
                    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
                    return (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                      </td>
                      <td onClick={e => e.stopPropagation()}>
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
                              <button onClick={() => { setActionMenuId(null); handleEdit(r); }} style={menuItemSt}>✏️ Otvori</button>
                              {r.docData && <button onClick={() => { setActionMenuId(null); downloadDoc(r); }} style={menuItemSt}>📎 Preuzmi prilog</button>}
                              <button onClick={() => { setActionMenuId(null); handleDuplicate(r); }} style={menuItemSt}>📋 Kopiraj</button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => { setActionMenuId(null); handleDelete(r.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Izbriši</button>
                            </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.zahtjevnicaBroj || '—'}</td>
                      <td>{formatDate(r.datum)}</td>
                      <td><button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
                      <td>{getOrgName(r.orgJedinicaId)}</td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>
                          {(r.stavke || []).length}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ──

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      await alert(lang === 'bs' ? 'Dokument mora biti manji od 2MB!' : 'Document must be under 2MB!');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({
        ...prev,
        docName: file.name,
        docData: ev.target.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const downloadDoc = (log) => {
    if (!log.docData) return;
    const a = document.createElement('a');
    a.href = log.docData;
    a.download = log.docName || 'prilog_dokumenta';
    a.click();
  };

  const openDoc = (docData, docName) => {
    if (!docData) return;
    const w = window.open();
    if (w) {
      w.document.write('<html><head><title>' + (docName || 'Dokument') + '</title></head><body style="margin:0"><iframe src="' + docData + '" style="width:100%;height:100vh;border:none"></iframe></body></html>');
      w.document.close();
    }
  };
  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>←</button>
        <h1 style={{ margin: 0 }}>📝 {editingId ? (lang === 'bs' ? 'Uredi zahtjevnicu' : 'Edit request') : (lang === 'bs' ? 'Nova zahtjevnica' : 'New request')}</h1>
      </div>
      <DialogRenderer />
      {renderItemForm()}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ Main form fields ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'Zahtjevnica' : 'Request'}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 200px 1fr 160px 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Zahtjevnica broj' : 'Request No.'}</div>
                <input className="form-input" value={formData.zahtjevnicaBroj} onChange={e => set('zahtjevnicaBroj', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Datum' : 'Date'}</div>
                <input className="form-input" type="date" value={formData.datum} onChange={e => set('datum', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</div>
                <select className="form-select" value={formData.workerId} onChange={e => set('workerId', e.target.value)}>
                  <option value="">{lang === 'bs' ? '— Odaberite —' : '— Select —'}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Mjesto troška' : 'Cost center'}</div>
                <input className="form-input" value={formData.mjestoTroska} onChange={e => set('mjestoTroska', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Organizacijska jedinica' : 'Org. unit'}</div>
                <select className="form-select" value={formData.orgJedinicaId} onChange={e => set('orgJedinicaId', e.target.value)}>
                  <option value="">{lang === 'bs' ? '— Odaberite —' : '— Select —'}</option>
                  {orgUnits.map(o => (
                    <option key={o.id} value={o.id}>{o.naziv}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Odobrio' : 'Approved by'}</div>
                <select className="form-select" value={formData.odobrioId} onChange={e => set('odobrioId', e.target.value)}>
                  <option value="">{lang === 'bs' ? 'Izaberite ili unesite' : 'Select or enter'}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Skladištar' : 'Storekeeper'}</div>
                <select className="form-select" value={formData.skladistarId} onChange={e => set('skladistarId', e.target.value)}>
                  <option value="">{lang === 'bs' ? 'Izaberite ili unesite' : 'Select or enter'}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Napomena' : 'Note'}</div>
                <textarea className="form-input" rows={2} value={formData.napomena} onChange={e => set('napomena', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Tražena zaštitna sredstva ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ ...sectionTitle, marginBottom: 0, background: 'var(--bg-dark, #333)', color: '#fff', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem' }}>
                {lang === 'bs' ? 'Tražena zaštitna sredstva' : 'Requested protective equipment'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <button className="btn btn-primary btn-sm" onClick={handleNewItem}>
                + {lang === 'bs' ? 'Nova stavka zahtjevnice' : 'New request item'}
              </button>
            </div>

            <div className="data-table-wrapper" style={{ overflow: 'visible', position: 'relative' }}>
              <table className="data-table" style={{ overflow: 'visible' }}>
                <thead>
                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Osobna zaštitna oprema / Opisno' : 'PPE / Description'}</th>
                    <th>{lang === 'bs' ? 'Šifra' : 'Code'}</th>
                    <th>RedBr</th>
                    <th>{lang === 'bs' ? 'Veličina' : 'Size'}</th>
                    <th>{lang === 'bs' ? 'Jed. mjera' : 'Unit'}</th>
                    <th>{lang === 'bs' ? 'Komada' : 'Qty'}</th>
                  </tr>
                </thead>
                <tbody style={{ overflow: 'visible' }}>
                  {formData.stavke.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      {lang === 'bs' ? 'Nema stavki. Dodajte novu stavku zahtjevnice.' : 'No items. Add a new request item.'}
                    </td></tr>
                  ) : formData.stavke.map((s, idx) => (
                    <tr key={idx}>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEditItem(idx)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteItem(idx)}>🗑️</button>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{s.zastitnoSredstvoNaziv || s.opisno || '—'}</td>
                      <td>{s.zastitnoSredstvoId ? s.zastitnoSredstvoId.slice(0, 8) : '—'}</td>
                      <td>{s.redBr}</td>
                      <td>{s.velicina || '—'}</td>
                      <td>{s.jedMjera || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{s.komada}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ═══ Document Upload ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{lang === 'bs' ? 'Prilog' : 'Attachment'}</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📎 {lang === 'bs' ? 'Dokument (PDF, Word, maks. 2MB)' : 'Document (PDF, Word, max 2MB)'}</label>
              {formData.docName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>
                      <button type="button" onClick={() => openDoc(formData.docData, formData.docName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--info)', fontSize: '0.85rem', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>📎 {formData.docName}</button>
                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDoc(formData.docData, formData.docName)} style={{ color: 'var(--info)' }}>👁 {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadDoc({ docData: formData.docData, docName: formData.docName })} style={{ color: 'var(--primary)' }}>↓ {lang === 'bs' ? 'Preuzmi' : 'Download'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ color: 'var(--danger)' }}>✕ {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>
                      </div>
                  </div>
              ) : (
                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      📂 {lang === 'bs' ? 'Kliknite za upload dokumenta (Word, PDF)' : 'Click to upload document (Word, PDF)'}
                  </div>
              )}
              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
            </div>
          </div>
        </div>

        {/* ═══ Action buttons ═══ */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              💾 {lang === 'bs' ? 'Snimi zahtjevnicu' : 'Save request'}
            </button>
            <SavedFlash />
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
              ↩ {lang === 'bs' ? 'Odustani' : 'Cancel'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
