'use client';
import {  useState, useEffect, useCallback, useRef  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';

const EMPTY_RO2 = {
  workerId: '',
  broj: '',
  datum: todayISO(),
  // RO-2 specifics
  clanak3Tocke: '',
  datumOcjene: '',
  nijeMijenjaoRadnoMjesto: true, // Da/Ne — default Ne (true = hasn't changed)
  radniStazNaRadnomMjestu: '',
  docName: '',
  docData: '',
};

export default function FormRO2Page() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();

  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_RO2 });
  const [search, setSearch] = useState('');
  const docInputRef = useRef(null);

  const loadData = useCallback(() => {
    setRecords(getAll(COLLECTIONS.FORMS_RO2));
    setWorkers(getAll(COLLECTIONS.WORKERS));
    setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
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
    await create(COLLECTIONS.FORMS_RO2, copy);
    loadData();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.FORMS_RO2, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  useEffect(() => { loadData(); }, [loadData]);
  const filteredRecords = search
    ? records.filter(r => r.broj?.toLowerCase().includes(search.toLowerCase()))
    : records;
    const enrichedRecords = filteredRecords.map(r => {
    const _w = workers.find(wk => wk.id === r.workerId);
    return { ...r, _workerName: _w ? `${_w.prezime} ${_w.ime}` : '—' };
  });
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(enrichedRecords, 'datum');


  

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleNew = () => {
    setFormData({ ...EMPTY_RO2, datum: todayISO() });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({ ...EMPTY_RO2, ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati uputnicu?' : 'Delete referral?');
    if (ok) { remove(COLLECTIONS.FORMS_RO2, id); loadData(); }
  };

  const handleSave = async () => {
    if (!formData.workerId) {
      await alert(lang === 'bs' ? 'Odaberite radnika!' : 'Select a worker!');
      return;
    }
    if (editingId) {
      update(COLLECTIONS.FORMS_RO2, editingId, formData);
    } else {
      create(COLLECTIONS.FORMS_RO2, formData);
    }
    setShowForm(false);
    loadData();
  };

  const getWorkerName = (id) => {
    const w = workers.find(wk => wk.id === id);
    return w ? `${w.prezime} ${w.ime}` : '—';
  };
  const getWorkerInfo = (id) => workers.find(wk => wk.id === id);

  const labelSt = {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
  };
  const sectionTitle = {
    fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
  };
  const checkLabel = {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.84rem',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  // ── List view ──
  if (!showForm) {
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>📄 {t('formRO2')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Nova uputnica RO-2' : 'New RO-2 referral'}
            </button>
            
            {selectedIds.size > 0 && (
              <span style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedIds.size > 0 && (
                <span style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'}
                </span>
              )}
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {records.length} {lang === 'bs' ? 'zapisa' : 'records'}
              </span>
              <div style={{ position: 'relative' }}>
                <button className="btn btn-dark" onClick={() => setShowGroupMenu(v => !v)}>{lang === 'bs' ? 'Grupne akcije' : 'Group actions'} ▼</button>
                {showGroupMenu && (
                  <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setShowGroupMenu(false); }} />
                  <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', minWidth: 230, zIndex: 9999, display: 'block' }}>
                    <div style={{ padding: '6px 14px 4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {selectedIds.size > 0 ? `${selectedIds.size} ${lang === 'bs' ? 'odabrano' : 'selected'}` : (lang === 'bs' ? 'Odaberite stavke' : 'Select items first')}
                    </div>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={() => { setShowGroupMenu(false); window.print(); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🖨️</span> {lang === 'bs' ? 'Ispiši odabrane' : 'Print selected'}</button>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ color: selectedIds.size > 0 ? 'var(--danger)' : 'var(--text-muted)', opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={() => { setShowGroupMenu(false); handleDeleteSelected(); }}>🗑️ {lang === 'bs' ? `Obriši odabrane (${selectedIds.size})` : `Delete selected (${selectedIds.size})`}</button>
                  </div>
                  </>
                )}
              </div>
            </div>
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
            <div className="data-table-wrapper" style={{ overflow: 'visible', position: 'relative' }}>
              <table className="data-table" style={{ overflow: 'visible' }}>
                <thead>
                  <tr>
                    <th>{t('actions')}</th>
                    <th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{lang === 'bs' ? 'Radnik' : 'Worker'}{sortIcon('_workerName')}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>
                    <th>{lang === 'bs' ? 'Čl.3 točke' : 'Art.3 point'}</th>
                    <th>{lang === 'bs' ? 'Radni staž' : 'Experience'}</th>
                    <th>{lang === 'bs' ? 'Promjena RM' : 'Changed pos.'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>
                </thead>
                <tbody style={{ overflow: 'visible' }}>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sorted.map((r, idx) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === r.id ? null : r.id); }}>{lang === 'bs' ? 'Akcije' : 'Actions'} ▼</button>
                        {actionMenuId === r.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, zIndex: 9999, display: 'block' }}>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📝</span> {lang === 'bs' ? 'Otvori' : 'Open'}
                            </button>
                            {r.docData && (
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); downloadDoc(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📎</span> {lang === 'bs' ? 'Preuzmi prilog' : 'Download file'}</button>
                            )}
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📋</span> {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}
                            </button>
                              <div className="dropdown-divider" />
                              <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(r.id); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🗑️</span> {lang === 'bs' ? 'Obriši' : 'Delete'}
                            </button>
                            </div>
                          </>
                        )}
                      </td>
                      <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' , background: 'none', color: 'var(--text)'}} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
                      <td>{formatDate(r.datum)}</td>
                      <td>{r.clanak3Tocke || '—'}</td>
                      <td>{r.radniStazNaRadnomMjestu || '—'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                          background: r.nijeMijenjaoRadnoMjesto ? 'rgba(76,175,80,0.12)' : '#FBE9E7',
                          color: r.nijeMijenjaoRadnoMjesto ? 'var(--success)' : 'var(--danger)',
                        }}>{r.nijeMijenjaoRadnoMjesto ? 'Ne' : 'Da'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ──
  const worker = getWorkerInfo(formData.workerId);
  const workerOu = worker ? orgUnits.find(o => o.id === worker.orgJedinicaId) : null;


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
        <h1 style={{ margin: 0 }}>📄 {editingId ? (lang === 'bs' ? 'Uredi uputnicu RO-2' : 'Edit RO-2') : (lang === 'bs' ? 'Nova uputnica RO-2' : 'New RO-2')}</h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: Worker & General ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>
              {lang === 'bs'
                ? 'Uputnice za provjeru radne sposobnosti radnika na radnom mjestu s posebnim uvjetima rada (Obrazac RO-2)'
                : 'Referral for verifying worker fitness at workplace with special conditions (Form RO-2)'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 200px 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Broj' : 'Number'}</div>
                <input className="form-input" value={formData.broj} onChange={e => set('broj', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Datum' : 'Date'}</div>
                <input className="form-input" type="date" value={formData.datum} onChange={e => set('datum', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Radnik' : 'Worker'} *</div>
                <select className="form-select" value={formData.workerId} onChange={e => set('workerId', e.target.value)}>
                  <option value="">{lang === 'bs' ? '— Odaberite radnika —' : '— Select worker —'}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime} {w.oib ? `(${w.oib})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Worker auto-filled details */}
            {worker && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 16px', fontSize: '0.84rem' }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Matični broj:</span> <strong>{worker.jmbg || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Prezime, ime, ime oca:' : 'Name:'}</span> <strong>{worker.prezime} {worker.ime}{worker.imeRoditelja ? `, ${worker.imeRoditelja}` : ''}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Datum rođenja:' : 'DOB:'}</span> <strong>{formatDate(worker.datumRodenja)}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Org. jedinica:' : 'Org unit:'}</span> <strong>{workerOu?.naziv || '—'}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECTION 2: RO-2 Specifics ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>RO-2</div>

            {/* Čl.3 točke */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.84rem' }}>
                <span style={{ fontWeight: 600 }}>
                  {lang === 'bs' ? 'Radno mjesto s posebnim uvjetima prema čl3, točke' : 'Workplace with special conditions per art.3, points'}
                </span>
                <input className="form-input" style={{ width: 100 }} value={formData.clanak3Tocke} onChange={e => set('clanak3Tocke', e.target.value)} />
                <span style={{ color: 'var(--text-muted)' }}>
                  {lang === 'bs' ? 'Pravilnika o poslovima s posebnim uvjetima rada.' : 'of the Regulation on special working conditions.'}
                </span>
              </div>
            </div>

            {/* Last assessment */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.84rem' }}>
                <span style={{ fontWeight: 600 }}>
                  {lang === 'bs' ? 'Od posljednje ocjene radne sposobnosti dne:' : 'Since last fitness assessment on:'}
                </span>
                <input className="form-input" type="date" style={{ width: 180 }} value={formData.datumOcjene} onChange={e => set('datumOcjene', e.target.value)} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {lang === 'bs'
                    ? 'radnik nije mijenjao radno mjesto odnosno nisu promijenjeni uvjeti rada na tim poslovima'
                    : 'worker has not changed workplace nor have the working conditions changed'}
                </span>
                <label style={checkLabel}>
                  <input type="radio" name="nijeMijenjao" checked={formData.nijeMijenjaoRadnoMjesto === false} onChange={() => set('nijeMijenjaoRadnoMjesto', false)} /> Da
                </label>
                <label style={checkLabel}>
                  <input type="radio" name="nijeMijenjao" checked={formData.nijeMijenjaoRadnoMjesto === true} onChange={() => set('nijeMijenjaoRadnoMjesto', true)} /> Ne
                </label>
              </div>
            </div>

            {/* Radni staž */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}>
                <span style={{ fontWeight: 600 }}>
                  {lang === 'bs' ? 'Radni staž na radnom mjestu koji obavlja:' : 'Work experience in current position:'}
                </span>
                <input className="form-input" style={{ width: 140 }} value={formData.radniStazNaRadnomMjestu} onChange={e => set('radniStazNaRadnomMjestu', e.target.value)} />
              </div>
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
              💾 {lang === 'bs' ? 'Snimi uputnicu' : 'Save referral'}
            </button>
            <button className="btn btn-outline" onClick={async () => { await handleSave(); handleNew(); }}>
              💾 {lang === 'bs' ? 'Snimi i otvori novu' : 'Save & new'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
              ↩ {lang === 'bs' ? 'Odustani' : 'Cancel'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
