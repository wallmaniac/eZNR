'use client';
import DateInput from '@/components/DateInput';
import {  useState, useEffect, useCallback, useRef  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO, getActiveCompanyId
} from '@/lib/dataStore';
import { uploadDocument } from '@/lib/storageService';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import PageHeader from '@/components/PageHeader';

const EMPTY_RO1 = {
  workerId: '',
  broj: '',
  datum: todayISO(),
  // Poslovi prema Pravilniku
  posloviPravilnik: false, // Da/Ne
  posloviTocka: '',
  // Job description
  kratakOpisPoslova: '',
  strojeviIAlati: '',
  predmetRada: '',
  // Mjesto rada
  mjestoZatvoreno: false, mjestoOtvoreno: false, mjestoNaVisini: false,
  mjestoUJami: false, mjestoUVodi: false, mjestoPodVodom: false, mjestoUMokrom: false,
  // Organizacija rada
  orgSmjene: false, orgNocniRad: false, orgTerenskiRad: false,
  orgRadiSaStrankama: false, orgRadiSam: false, orgRadiSGrupom: false,
  orgBrziTempo: false, orgRitamOdreden: false, orgRadiNaTraci: false, orgMonotonija: false,
  // Položaj tijela
  polStojeci: false, polSjedeci: false, polUPokretu: false, polKombinirano: false,
  polUcestaloSagibanje: false, polZakretanjeTrupa: false,
  polKlecanje: false, polUspinjanjeLjestvama: false, polUspinjanjeStepen: false,
  // Weights
  dizanjeTereta: 0, prenosenjeTereta: 0, guranjeTereta: 0,
  // Sensory
  vidNaDaljinu: false, vidNaBlizinu: false, raspoznavanjeBoja: false,
  dobarSluh: false, jasanGovor: false,
  // Uvjeti rada
  uvjetiVisokaTemp: false, uvjetiVisokaVlaznost: false, uvjetiNiskaTemp: false,
  uvjetiBuka: false, uvjetiVibracijeStroja: false, uvjetiVibracijePoda: false,
  uvjetiPoviseniTlak: false, uvjetiIzlozenostOzljedama: false,
  uvjetiZracenje: false, uvjetiIonizacija: false,
  uvjetiMikrovalna: false, uvjetiUltravioletna: false, uvjetiInfracrvena: false,
  // Text hazard fields
  prasina: '',
  kemijskiAgensi: '',
  biotickiAgensi: '',
  // Datum upućivanja
  datumUpucivanja: todayISO(),
  docName: '',
  docData: '',
  fileObj: null,
};

export default function FormRO1Page() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, confirm, DialogRenderer } = useDialog();

  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [workplaces, setWorkplaces] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_RO1 });
  const [search, setSearch] = useState('');
  const docInputRef = useRef(null);

  const loadData = useCallback(() => {
    setRecords(getAll(COLLECTIONS.FORMS_RO1));
    setWorkers(getAll(COLLECTIONS.WORKERS));
    setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
    setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
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
    await create(COLLECTIONS.FORMS_RO1, copy);
    loadData();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(lang !== 'en' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.FORMS_RO1, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);

  useEffect(() => {
    const openId = searchParams?.get('openId');
    if (openId && records.length > 0 && !showForm) {
      const rec = records.find(r => r.id === openId);
      if (rec) handleEdit(rec);
    }
  }, [searchParams, records]);
  const filteredRecords = search
    ? records.filter(r => r.broj?.toLowerCase().includes(search.toLowerCase()) || r.kratakOpisPoslova?.toLowerCase().includes(search.toLowerCase()))
    : records;
    const enrichedRecords = filteredRecords.map(r => {
    const _w = workers.find(wk => wk.id === r.workerId);
    return { ...r, _workerName: _w ? `${_w.prezime} ${_w.ime}` : '—' };
  });
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(enrichedRecords, 'datum');


  

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleNew = () => {
    setFormData({ ...EMPTY_RO1, datum: todayISO(), datumUpucivanja: todayISO() });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({ ...EMPTY_RO1, ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(lang !== 'en' ? 'Obrisati uputnicu?' : 'Delete referral?');
    if (ok) { remove(COLLECTIONS.FORMS_RO1, id); loadData(); }
  };

  const handleSave = async () => {
    if (!formData.workerId) {
      await alert(lang !== 'en' ? 'Odaberite radnika!' : 'Select a worker!');
      return;
    }
    
    let uploadedUrl = formData.docData;
    if (formData.fileObj) {
      try {
        const cid = getActiveCompanyId();
        const res = await uploadDocument(formData.fileObj, cid, 'form-ro1');
        uploadedUrl = res.url;
      } catch (e) {
        await alert('Upload failed: ' + e.message); return;
      }
    }
    
    const payload = { ...formData, docData: uploadedUrl };
    delete payload.fileObj;

    if (editingId) {
      update(COLLECTIONS.FORMS_RO1, editingId, payload);
    } else {
      create(COLLECTIONS.FORMS_RO1, payload);
    }
    setShowForm(false);
    loadData();
  };

  const handleWorkerChange = (workerId) => {
    const w = workers.find(wk => wk.id === workerId);
    if (!w) { set('workerId', ''); return; }
    setFormData(prev => ({ ...prev, workerId: w.id }));
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
  const sectionStyle = {
    marginBottom: 20, paddingBottom: 12,
    borderBottom: '1px solid var(--border-light)',
  };
  const checkGroup = {
    display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 8,
  };
  const checkLabel = {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.84rem',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  const Chk = ({ field, label }) => (
    <label style={checkLabel}>
      <input type="checkbox" checked={!!formData[field]} onChange={e => set(field, e.target.checked)} />
      {label}
    </label>
  );

  // ── List view ──
  if (!showForm) {
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>📃 {t('formRO1')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleNew} title={lang !== 'en' ? 'Dodaj novi RO-1 obrazac' : 'Add new RO-1 form'}>
              + {lang !== 'en' ? 'Novi RO-1' : 'New RO-1'}
            </button>
            <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
              <input
                placeholder={lang !== 'en' ? 'Pretraži...' : 'Search...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%' }}
              />
              {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')} title={lang !== 'en' ? 'Poništi pretragu' : 'Clear search'}>✕</button>}
            </div>
            
            {/* Grupne akcije bar */}
            {selectedIds.size > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {lang !== 'en' ? 'odabrano' : 'selected'}:</span>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()} title={lang !== 'en' ? 'Isprintaj odabrane obrasce' : 'Print selected forms'}>🖨️ {lang !== 'en' ? 'Isprintaj' : 'Print'}</button>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} title={lang !== 'en' ? 'Obriši odabrane obrasce' : 'Delete selected forms'}>🗑️ {lang !== 'en' ? 'Obriši' : 'Delete'}</button>
              </div>
            )}
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{records.length} {lang !== 'en' ? 'zapisa' : 'records'}</span>}
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
                    <th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{lang !== 'en' ? 'Radnik' : 'Worker'}{sortIcon('_workerName')}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang !== 'en' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>
                    <th onClick={() => toggleSort('broj')} style={thStyle('broj')}>{lang !== 'en' ? 'Br.' : 'No.'}{sortIcon('broj')}</th>
                    <th>{lang !== 'en' ? 'Pravilnik' : 'Regulation'}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sorted.map((r, idx) => {
                    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
                    return (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ position: 'relative' }}>
                          <button className="btn btn-primary btn-sm" data-menu-trigger onMouseDown={(e) => e.preventDefault()} onClick={(e) => {
                            e.stopPropagation();
                            if (actionMenuId === r.id) { setActionMenuId(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom - 8;
                            const spaceAbove = rect.top - 8;
                            const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
                            setMenuPos(flipUp
                              ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                              : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                            );
                            setActionMenuId(r.id);
                          }} title={lang !== 'en' ? 'Prikaži akcije za obrazac' : 'Show form actions'}>Akcije ▼</button>
                          {actionMenuId === r.id && typeof document !== 'undefined' && createPortal(
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div data-menu onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                              <button onClick={() => { setActionMenuId(null); handleEdit(r); }} style={menuItemSt}>✏️ Otvori</button>
                              {r.docData && <button onClick={() => { setActionMenuId(null); downloadDoc(r); }} style={menuItemSt}>📎 Preuzmi prilog</button>}
                              <button onClick={() => { setActionMenuId(null); handleDuplicate(r); }} style={menuItemSt}>📋 Kopiraj</button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => { setActionMenuId(null); handleDelete(r.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Izbriši</button>
                            </div>
                            </>, document.body
                          )}
                        </div>
                      </td>
                      <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', background: 'none', color: 'var(--text)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
                      <td>{formatDate(r.datum)}</td>
                      <td>{r.broj || '—'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem',
                          background: r.posloviPravilnik ? 'rgba(76,175,80,0.12)' : 'var(--bg-input)',
                          color: r.posloviPravilnik ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600,
                        }}>{r.posloviPravilnik ? 'Da' : 'Ne'}</span>
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
  const worker = getWorkerInfo(formData.workerId);
  const workerOu = worker ? orgUnits.find(o => o.id === worker.orgJedinicaId) : null;
  const workerWp = worker ? workplaces.find(p => p.id === worker.radnoMjestoId) : null;


  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      await alert(lang !== 'en' ? 'Dokument mora biti manji od 15MB!' : 'Document must be under 15MB!');
      return;
    }
    setFormData(prev => ({
      ...prev,
      docName: file.name,
      fileObj: file,
    }));
  };

  const downloadDoc = (log) => {
    if (!log.docData) return;
    if (log.docData.startsWith('http')) {
      window.open(log.docData, '_blank');
      return;
    }
    const a = document.createElement('a');
    a.href = log.docData;
    a.download = log.docName || 'prilog_dokumenta';
    a.click();
  };

  const openDoc = (docData, docName) => {
    if (!docData) return;
    if (docData.startsWith('http')) {
      window.open(docData, '_blank');
      return;
    }
    const w = window.open();
    if (w) {
      w.document.write('<html><head><title>' + (docName || 'Dokument') + '</title></head><body style="margin:0"><iframe src="' + docData + '" style="width:100%;height:100vh;border:none"></iframe></body></html>');
      w.document.close();
    }
  };

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => setShowForm(false)} title={lang !== 'en' ? 'Nazad' : 'Back'}>←</button>
        <h1 style={{ margin: 0 }}>📄 {editingId ? (lang !== 'en' ? 'Uredi uputnicu RO-1' : 'Edit RO-1') : (lang !== 'en' ? 'Nova uputnica RO-1' : 'New RO-1')}</h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: Worker & General ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>
              {lang !== 'en' ? 'Uputnica za utvrđivanje zdravstvene sposobnosti radnika (Obrazac RO-1)' : 'Worker health fitness referral (Form RO-1)'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 200px 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={labelSt}>{lang !== 'en' ? 'Broj' : 'Number'}</div>
                <input className="form-input" value={formData.broj} onChange={e => set('broj', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang !== 'en' ? 'Datum' : 'Date'}</div>
                <DateInput value={formData.datum} onChange={v => set('datum', v)} />
              </div>
              <div>
                <div style={labelSt}>{lang !== 'en' ? 'Radnik' : 'Worker'} *</div>
                <select className="form-select" value={formData.workerId} onChange={e => handleWorkerChange(e.target.value)}>
                  <option value="">{lang !== 'en' ? '— Odaberite radnika —' : '— Select worker —'}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime} {w.oib ? `(${w.oib})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {worker && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 16px', fontSize: '0.84rem' }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Matični broj:</span> <strong>{worker.jmbg || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang !== 'en' ? 'Prezime, ime, ime oca:' : 'Name:'}</span> <strong>{worker.prezime} {worker.ime}{worker.imeRoditelja ? `, ${worker.imeRoditelja}` : ''}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang !== 'en' ? 'Datum rođenja:' : 'DOB:'}</span> <strong>{formatDate(worker.datumRodenja)}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang !== 'en' ? 'Org. jedinica:' : 'Org unit:'}</span> <strong>{workerOu?.naziv || '—'}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECTION 2: RO-1 Specifics ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>RO-1</div>

            {/* Pravilnik Da/Ne */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text)', marginBottom: 8 }}>
                {lang !== 'en'
                  ? 'Poslovi su prema Pravilniku o poslovima s posebnim uvjetima rada, odnosno općem aktu organizacije s posebnim uvjetima rada:'
                  : 'Jobs are per Regulation on special working conditions:'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <label style={checkLabel}>
                  <input type="radio" name="pravilnik" checked={formData.posloviPravilnik === true} onChange={() => set('posloviPravilnik', true)} /> Da
                </label>
                <label style={checkLabel}>
                  <input type="radio" name="pravilnik" checked={formData.posloviPravilnik === false} onChange={() => set('posloviPravilnik', false)} /> Ne
                </label>
                {formData.posloviPravilnik && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang !== 'en' ? 'Ako DA prema članku 3. točka' : 'If YES, per article 3 point'}</span>
                    <input className="form-input" style={{ width: 120 }} value={formData.posloviTocka} onChange={e => set('posloviTocka', e.target.value)} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang !== 'en' ? 'Pravilnika o poslovima s posebnim uvjetima rada.' : 'of the Regulation.'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Job description */}
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang !== 'en' ? 'Kratki opis poslova i zadataka' : 'Brief job description'}</div>
              <textarea className="form-input" rows={3} value={formData.kratakOpisPoslova} onChange={e => set('kratakOpisPoslova', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={labelSt}>{lang !== 'en' ? 'Strojevi i alati (1)' : 'Machines & tools (1)'}</div>
                <input className="form-input" value={formData.strojeviIAlati} onChange={e => set('strojeviIAlati', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang !== 'en' ? 'Predmet rada (materijali) (2)' : 'Work subject (materials) (2)'}</div>
                <input className="form-input" value={formData.predmetRada} onChange={e => set('predmetRada', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION 3: Working conditions ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang !== 'en' ? 'Uvjeti na radnom mjestu' : 'Workplace conditions'}</div>

            {/* Mjesto rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang !== 'en' ? 'Mjesto rada' : 'Workplace location'}</div>
              <div style={checkGroup}>
                <Chk field="mjestoZatvoreno" label={lang !== 'en' ? 'u zatvorenom' : 'indoors'} />
                <Chk field="mjestoOtvoreno" label={lang !== 'en' ? 'na otvorenom' : 'outdoors'} />
                <Chk field="mjestoNaVisini" label={lang !== 'en' ? 'na visini' : 'at height'} />
                <Chk field="mjestoUJami" label={lang !== 'en' ? 'u jami' : 'in pit'} />
                <Chk field="mjestoUVodi" label={lang !== 'en' ? 'u vodi' : 'in water'} />
                <Chk field="mjestoPodVodom" label={lang !== 'en' ? 'pod vodom' : 'underwater'} />
                <Chk field="mjestoUMokrom" label={lang !== 'en' ? 'u mokrom' : 'in wet'} />
              </div>
            </div>

            {/* Organizacija rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang !== 'en' ? 'Organizacija rada' : 'Work organization'}</div>
              <div style={checkGroup}>
                <Chk field="orgSmjene" label={lang !== 'en' ? 'u smjenama' : 'in shifts'} />
                <Chk field="orgNocniRad" label={lang !== 'en' ? 'noćni rad' : 'night work'} />
                <Chk field="orgTerenskiRad" label={lang !== 'en' ? 'terenski rad' : 'field work'} />
                <Chk field="orgRadiSaStrankama" label={lang !== 'en' ? 'radi sa strankama' : 'with clients'} />
                <Chk field="orgRadiSam" label={lang !== 'en' ? 'radi sam' : 'works alone'} />
                <Chk field="orgRadiSGrupom" label={lang !== 'en' ? 'radi s grupom' : 'works in group'} />
                <Chk field="orgBrziTempo" label={lang !== 'en' ? 'brzi tempo rada' : 'fast pace'} />
                <Chk field="orgRitamOdreden" label={lang !== 'en' ? 'ritam određen' : 'fixed rhythm'} />
                <Chk field="orgRadiNaTraci" label={lang !== 'en' ? 'radi na traci' : 'assembly line'} />
                <Chk field="orgMonotonija" label={lang !== 'en' ? 'monotonija' : 'monotony'} />
              </div>
            </div>

            {/* Položaj tijela */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang !== 'en' ? 'Položaj i akt. tijela' : 'Body position & activity'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 16px', marginBottom: 10 }}>
                <Chk field="polStojeci" label={lang !== 'en' ? 'Stojeći' : 'Standing'} />
                <Chk field="polUcestaloSagibanje" label={lang !== 'en' ? 'Učestalo sagibanje' : 'Frequent bending'} />
                <Chk field="polUspinjanjeLjestvama" label={lang !== 'en' ? 'uspinjanje ljestvama' : 'climbing ladders'} />
                <Chk field="polSjedeci" label={lang !== 'en' ? 'Sjedeći' : 'Sitting'} />
                <Chk field="polZakretanjeTrupa" label={lang !== 'en' ? 'zakretanje trupa' : 'torso rotation'} />
                <Chk field="polUspinjanjeStepen" label={lang !== 'en' ? 'uspinjanje stepenicama' : 'climbing stairs'} />
                <Chk field="polUPokretu" label={lang !== 'en' ? 'u pokretu' : 'in motion'} />
                <Chk field="polKlecanje" label={lang !== 'en' ? 'klečanje' : 'kneeling'} />
                <div />
                <Chk field="polKombinirano" label={lang !== 'en' ? 'kombinirano' : 'combined'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang !== 'en' ? 'Dizanje tereta:' : 'Lifting:'}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.dizanjeTereta} onChange={e => set('dizanjeTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang !== 'en' ? 'Prenošenje tereta:' : 'Carrying:'}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.prenosenjeTereta} onChange={e => set('prenosenjeTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang !== 'en' ? 'Guranje tereta:' : 'Pushing:'}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.guranjeTereta} onChange={e => set('guranjeTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
              </div>
            </div>

            {/* Sensory */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang !== 'en' ? 'U poslu je važan' : 'Important in work'}</div>
              <div style={checkGroup}>
                <Chk field="vidNaDaljinu" label={lang !== 'en' ? 'vid na daljinu' : 'distance vision'} />
                <Chk field="vidNaBlizinu" label={lang !== 'en' ? 'vid na blizinu' : 'near vision'} />
                <Chk field="raspoznavanjeBoja" label={lang !== 'en' ? 'raspoznavanje boja' : 'color recognition'} />
                <Chk field="dobarSluh" label={lang !== 'en' ? 'dobar sluh' : 'good hearing'} />
                <Chk field="jasanGovor" label={lang !== 'en' ? 'jasan govor' : 'clear speech'} />
              </div>
            </div>

            {/* Uvjeti rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang !== 'en' ? 'Uvjeti rada' : 'Working conditions'}</div>
              <div style={checkGroup}>
                <Chk field="uvjetiVisokaTemp" label={lang !== 'en' ? 'visoka temperatura' : 'high temp'} />
                <Chk field="uvjetiVisokaVlaznost" label={lang !== 'en' ? 'visoka vlažnost' : 'high humidity'} />
                <Chk field="uvjetiNiskaTemp" label={lang !== 'en' ? 'niska temperatura' : 'low temp'} />
                <Chk field="uvjetiBuka" label={lang !== 'en' ? 'buka' : 'noise'} />
                <Chk field="uvjetiVibracijeStroja" label={lang !== 'en' ? 'Vibracije stroja' : 'Machine vibrations'} />
                <Chk field="uvjetiVibracijePoda" label={lang !== 'en' ? 'vibracije poda' : 'floor vibrations'} />
                <Chk field="uvjetiPoviseniTlak" label={lang !== 'en' ? 'Povišeni tlak' : 'increased pressure'} />
                <Chk field="uvjetiIzlozenostOzljedama" label={lang !== 'en' ? 'Izloženost ozljedama' : 'injury risk'} />
                <Chk field="uvjetiZracenje" label={lang !== 'en' ? 'Zračenje' : 'Radiation'} />
                <Chk field="uvjetiIonizacija" label={lang !== 'en' ? 'Ionizirajuća' : 'Ionizing'} />
                <Chk field="uvjetiMikrovalna" label={lang !== 'en' ? 'Mikrovalna' : 'Microwave'} />
                <Chk field="uvjetiUltravioletna" label={lang !== 'en' ? 'Ultravioletna' : 'UV'} />
                <Chk field="uvjetiInfracrvena" label={lang !== 'en' ? 'Infracrvena' : 'Infrared'} />
              </div>
            </div>

            {/* Text hazard fields */}
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang !== 'en' ? 'Prašina' : 'Dust'}</div>
              <input className="form-input" value={formData.prasina} onChange={e => set('prasina', e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang !== 'en' ? 'Kemijski agensi' : 'Chemical agents'}</div>
              <input className="form-input" value={formData.kemijskiAgensi} onChange={e => set('kemijskiAgensi', e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelSt}>{lang !== 'en' ? 'Biotički agensi' : 'Biological agents'}</div>
              <input className="form-input" value={formData.biotickiAgensi} onChange={e => set('biotickiAgensi', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ═══ Document Upload ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{lang !== 'en' ? 'Prilog' : 'Attachment'}</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📎 {lang !== 'en' ? 'Dokument (PDF, Word, maks. 2MB)' : 'Document (PDF, Word, max 2MB)'}</label>
              {formData.docName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>
                      <button type="button" onClick={() => openDoc(formData.docData, formData.docName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--info)', fontSize: '0.85rem', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid' }}>📎 {formData.docName}</button>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDoc(formData.docData, formData.docName)} style={{ color: 'var(--info)' }} title={lang !== 'en' ? 'Pregled priloga' : 'View attachment'}>👁 {lang !== 'en' ? 'Otvori' : 'Open'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadDoc({ docData: formData.docData, docName: formData.docName })} style={{ color: 'var(--primary)' }} title={lang !== 'en' ? 'Preuzmi prilog' : 'Download attachment'}>↓ {lang !== 'en' ? 'Preuzmi' : 'Download'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ color: 'var(--danger)' }} title={lang !== 'en' ? 'Ukloni prilog' : 'Remove attachment'}>✕ {lang !== 'en' ? 'Ukloni' : 'Remove'}</button>
                      </div>
                  </div>
              ) : (
                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      📂 {lang !== 'en' ? 'Kliknite za upload dokumenta (Word, PDF)' : 'Click to upload document (Word, PDF)'}
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
              💾 {lang !== 'en' ? 'Sačuvaj uputnicu' : 'Save referral'}
            </button>
            <button className="btn btn-outline" onClick={async () => { await handleSave(); handleNew(); }}>
              💾 {lang !== 'en' ? 'Sačuvaj i nova' : 'Save & new'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
              ↩ {t('cancel')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
