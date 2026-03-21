'use client';
import {  useState, useEffect, useCallback, useRef  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';

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
};

export default function FormRO1Page() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();

  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [workplaces, setWorkplaces] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
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
    if (window.confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.FORMS_RO1, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  useEffect(() => { loadData(); }, [loadData]);
  const filteredRecords = search
    ? records.filter(r => r.broj?.toLowerCase().includes(search.toLowerCase()) || r.kratakOpisPoslova?.toLowerCase().includes(search.toLowerCase()))
    : records;
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filteredRecords, 'datum');


  

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
    const ok = await confirm(lang === 'bs' ? 'Obrisati uputnicu?' : 'Delete referral?');
    if (ok) { remove(COLLECTIONS.FORMS_RO1, id); loadData(); }
  };

  const handleSave = async () => {
    if (!formData.workerId) {
      await alert(lang === 'bs' ? 'Odaberite radnika!' : 'Select a worker!');
      return;
    }
    if (editingId) {
      update(COLLECTIONS.FORMS_RO1, editingId, formData);
    } else {
      create(COLLECTIONS.FORMS_RO1, formData);
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
          <h1 style={{ margin: 0 }}>📄 {t('formRO1')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Nova uputnica RO-1' : 'New RO-1 referral'}
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
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>
                    <th onClick={() => toggleSort('broj')} style={thStyle('broj')}>{lang === 'bs' ? 'Br.' : 'No.'}{sortIcon('broj')}</th>
                    <th>{lang === 'bs' ? 'Pravilnik' : 'Regulation'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>
                </thead>
                <tbody style={{ overflow: 'visible' }}>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sorted.map((r, idx) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)}>
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
                      <td>{r.broj || '—'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem',
                          background: r.posloviPravilnik ? 'rgba(76,175,80,0.12)' : 'var(--bg-input)',
                          color: r.posloviPravilnik ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600,
                        }}>{r.posloviPravilnik ? 'Da' : 'Ne'}</span>
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
  const workerWp = worker ? workplaces.find(p => p.id === worker.radnoMjestoId) : null;


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
        <h1 style={{ margin: 0 }}>📄 {editingId ? (lang === 'bs' ? 'Uredi uputnicu RO-1' : 'Edit RO-1') : (lang === 'bs' ? 'Nova uputnica RO-1' : 'New RO-1')}</h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: Worker & General ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>
              {lang === 'bs' ? 'Uputnica za utvrđivanje zdravstvene sposobnosti radnika (Obrazac RO-1)' : 'Worker health fitness referral (Form RO-1)'}
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
                <select className="form-select" value={formData.workerId} onChange={e => handleWorkerChange(e.target.value)}>
                  <option value="">{lang === 'bs' ? '— Odaberite radnika —' : '— Select worker —'}</option>
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
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Prezime, ime, ime oca:' : 'Name:'}</span> <strong>{worker.prezime} {worker.ime}{worker.imeRoditelja ? `, ${worker.imeRoditelja}` : ''}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Datum rođenja:' : 'DOB:'}</span> <strong>{formatDate(worker.datumRodenja)}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Org. jedinica:' : 'Org unit:'}</span> <strong>{workerOu?.naziv || '—'}</strong></div>
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
                {lang === 'bs'
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
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Ako DA prema članku 3. točka' : 'If YES, per article 3 point'}</span>
                    <input className="form-input" style={{ width: 120 }} value={formData.posloviTocka} onChange={e => set('posloviTocka', e.target.value)} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Pravilnika o poslovima s posebnim uvjetima rada.' : 'of the Regulation.'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Job description */}
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Kratki opis poslova i zadataka' : 'Brief job description'}</div>
              <textarea className="form-input" rows={3} value={formData.kratakOpisPoslova} onChange={e => set('kratakOpisPoslova', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Strojevi i alati (1)' : 'Machines & tools (1)'}</div>
                <input className="form-input" value={formData.strojeviIAlati} onChange={e => set('strojeviIAlati', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Predmet rada (materijali) (2)' : 'Work subject (materials) (2)'}</div>
                <input className="form-input" value={formData.predmetRada} onChange={e => set('predmetRada', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION 3: Working conditions ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'Uvjeti na radnom mjestu' : 'Workplace conditions'}</div>

            {/* Mjesto rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang === 'bs' ? 'Mjesto rada' : 'Workplace location'}</div>
              <div style={checkGroup}>
                <Chk field="mjestoZatvoreno" label={lang === 'bs' ? 'u zatvorenom' : 'indoors'} />
                <Chk field="mjestoOtvoreno" label={lang === 'bs' ? 'na otvorenom' : 'outdoors'} />
                <Chk field="mjestoNaVisini" label={lang === 'bs' ? 'na visini' : 'at height'} />
                <Chk field="mjestoUJami" label={lang === 'bs' ? 'u jami' : 'in pit'} />
                <Chk field="mjestoUVodi" label={lang === 'bs' ? 'u vodi' : 'in water'} />
                <Chk field="mjestoPodVodom" label={lang === 'bs' ? 'pod vodom' : 'underwater'} />
                <Chk field="mjestoUMokrom" label={lang === 'bs' ? 'u mokrom' : 'in wet'} />
              </div>
            </div>

            {/* Organizacija rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang === 'bs' ? 'Organizacija rada' : 'Work organization'}</div>
              <div style={checkGroup}>
                <Chk field="orgSmjene" label={lang === 'bs' ? 'u smjenama' : 'in shifts'} />
                <Chk field="orgNocniRad" label={lang === 'bs' ? 'noćni rad' : 'night work'} />
                <Chk field="orgTerenskiRad" label={lang === 'bs' ? 'terenski rad' : 'field work'} />
                <Chk field="orgRadiSaStrankama" label={lang === 'bs' ? 'radi sa strankama' : 'with clients'} />
                <Chk field="orgRadiSam" label={lang === 'bs' ? 'radi sam' : 'works alone'} />
                <Chk field="orgRadiSGrupom" label={lang === 'bs' ? 'radi s grupom' : 'works in group'} />
                <Chk field="orgBrziTempo" label={lang === 'bs' ? 'brzi tempo rada' : 'fast pace'} />
                <Chk field="orgRitamOdreden" label={lang === 'bs' ? 'ritam određen' : 'fixed rhythm'} />
                <Chk field="orgRadiNaTraci" label={lang === 'bs' ? 'radi na traci' : 'assembly line'} />
                <Chk field="orgMonotonija" label={lang === 'bs' ? 'monotonija' : 'monotony'} />
              </div>
            </div>

            {/* Položaj tijela */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang === 'bs' ? 'Položaj i akt. tijela' : 'Body position & activity'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 16px', marginBottom: 10 }}>
                <Chk field="polStojeci" label={lang === 'bs' ? 'Stojeći' : 'Standing'} />
                <Chk field="polUcestaloSagibanje" label={lang === 'bs' ? 'Učestalo sagibanje' : 'Frequent bending'} />
                <Chk field="polUspinjanjeLjestvama" label={lang === 'bs' ? 'uspinjanje ljestvama' : 'climbing ladders'} />
                <Chk field="polSjedeci" label={lang === 'bs' ? 'Sjedeći' : 'Sitting'} />
                <Chk field="polZakretanjeTrupa" label={lang === 'bs' ? 'zakretanje trupa' : 'torso rotation'} />
                <Chk field="polUspinjanjeStepen" label={lang === 'bs' ? 'uspinjanje stepenicama' : 'climbing stairs'} />
                <Chk field="polUPokretu" label={lang === 'bs' ? 'u pokretu' : 'in motion'} />
                <Chk field="polKlecanje" label={lang === 'bs' ? 'klečanje' : 'kneeling'} />
                <div />
                <Chk field="polKombinirano" label={lang === 'bs' ? 'kombinirano' : 'combined'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'Dizanje tereta:' : 'Lifting:'}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.dizanjeTereta} onChange={e => set('dizanjeTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'Prenošenje tereta:' : 'Carrying:'}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.prenosenjeTereta} onChange={e => set('prenosenjeTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'Guranje tereta:' : 'Pushing:'}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.guranjeTereta} onChange={e => set('guranjeTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
              </div>
            </div>

            {/* Sensory */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang === 'bs' ? 'U poslu je važan' : 'Important in work'}</div>
              <div style={checkGroup}>
                <Chk field="vidNaDaljinu" label={lang === 'bs' ? 'vid na daljinu' : 'distance vision'} />
                <Chk field="vidNaBlizinu" label={lang === 'bs' ? 'vid na blizinu' : 'near vision'} />
                <Chk field="raspoznavanjeBoja" label={lang === 'bs' ? 'raspoznavanje boja' : 'color recognition'} />
                <Chk field="dobarSluh" label={lang === 'bs' ? 'dobar sluh' : 'good hearing'} />
                <Chk field="jasanGovor" label={lang === 'bs' ? 'jasan govor' : 'clear speech'} />
              </div>
            </div>

            {/* Uvjeti rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang === 'bs' ? 'Uvjeti rada' : 'Working conditions'}</div>
              <div style={checkGroup}>
                <Chk field="uvjetiVisokaTemp" label={lang === 'bs' ? 'visoka temperatura' : 'high temp'} />
                <Chk field="uvjetiVisokaVlaznost" label={lang === 'bs' ? 'visoka vlažnost' : 'high humidity'} />
                <Chk field="uvjetiNiskaTemp" label={lang === 'bs' ? 'niska temperatura' : 'low temp'} />
                <Chk field="uvjetiBuka" label={lang === 'bs' ? 'buka' : 'noise'} />
                <Chk field="uvjetiVibracijeStroja" label={lang === 'bs' ? 'Vibracije stroja' : 'Machine vibrations'} />
                <Chk field="uvjetiVibracijePoda" label={lang === 'bs' ? 'vibracije poda' : 'floor vibrations'} />
                <Chk field="uvjetiPoviseniTlak" label={lang === 'bs' ? 'Povišeni tlak' : 'increased pressure'} />
                <Chk field="uvjetiIzlozenostOzljedama" label={lang === 'bs' ? 'Izloženost ozljedama' : 'injury risk'} />
                <Chk field="uvjetiZracenje" label={lang === 'bs' ? 'Zračenje' : 'Radiation'} />
                <Chk field="uvjetiIonizacija" label={lang === 'bs' ? 'Ionizirajuća' : 'Ionizing'} />
                <Chk field="uvjetiMikrovalna" label={lang === 'bs' ? 'Mikrovalna' : 'Microwave'} />
                <Chk field="uvjetiUltravioletna" label={lang === 'bs' ? 'Ultravioletna' : 'UV'} />
                <Chk field="uvjetiInfracrvena" label={lang === 'bs' ? 'Infracrvena' : 'Infrared'} />
              </div>
            </div>

            {/* Text hazard fields */}
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Prašina' : 'Dust'}</div>
              <input className="form-input" value={formData.prasina} onChange={e => set('prasina', e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Kemijski agensi' : 'Chemical agents'}</div>
              <input className="form-input" value={formData.kemijskiAgensi} onChange={e => set('kemijskiAgensi', e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Biotički agensi' : 'Biological agents'}</div>
              <input className="form-input" value={formData.biotickiAgensi} onChange={e => set('biotickiAgensi', e.target.value)} />
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
