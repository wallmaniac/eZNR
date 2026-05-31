'use client';
import DateInput from '@/components/DateInput';
import TimeInput from '@/components/TimeInput';
import {  useState, useEffect, useCallback, useRef  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO, getActiveCompanyId
} from '@/lib/dataStore';
import { uploadDocument } from '@/lib/storageService';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import Icon3D from '@/components/Icon3D';
import PageHeader from '@/components/PageHeader';


const EMPTY_RA1 = {
  // Worker info (auto-filled from worker selection)
  workerId: '',
  // General
  broj: '',
  datum: todayISO(),
  // Institution
  ustanovaId: '',
  ustanovaNaziv: '',
  ustanovaAdresa: '',
  ustanovaPosta: '',
  ustanovaMjesto: '',
  ustanovaTelFax: '',
  doktorId: '',
  doktorIme: '',
  doktorEmail: '',
  // Exam details
  pregledTip: 'periodicki', // prethodni, periodicki, izvanredni, kontrolni
  opisPregleda: '',
  cijena: '',
  datumPregleda: '',
  vrijemePregleda: '',
  // RA-1 job section
  posloviZaKoje: '',
  posloviClanak: '',
  posloviTocka: '',
  posloviDrugiZakoni: '',
  posloviMirovinski: false,
  ukupniRadniStaz: '',
  radniStazNaPoslovima: '',
  // Zdravstveni pregled type (checkboxes)
  pregledPrethodni: false,
  pregledPeriodicki: true,
  pregledIzvanredni: false,
  pregledKontrolni: false,
  // Last exam
  posljednjiPregledDatum: '',
  posljednjiPregledClanak: '',
  posljednjiPregledTocka: '',
  posljednjiPregledZakoni: '',
  // Health assessment
  ocjenaZdravstveneSposobnosti: '',
  // Job description
  kratakOpisPosla: '',
  strojeviIAlati: '',
  predmetRada: '',
  // Mjesto rada (checkboxes)
  mjestoZatvoreno: false,
  mjestoOtvoreno: false,
  mjestoNaVisini: false,
  mjestoUJami: false,
  mjestoUVodi: false,
  mjestoPodVodom: false,
  mjestoUMokrom: false,
  // Organizacija rada (checkboxes)
  orgSmjene: false,
  orgNocniRad: false,
  orgTerenskiRad: false,
  orgRadiSam: false,
  orgRadiSGrupom: false,
  orgRadiSaStrankama: false,
  orgRadiNaTraci: false,
  orgBrziTempo: false,
  orgRitamOdreden: false,
  orgMonotonija: false,
  // Položaj tijela (checkboxes)
  polRadStojeci: false,
  polRadSjedeci: false,
  polUPokretu: false,
  polKombinirano: false,
  polUcestaloSagibanje: false,
  polZakretanjeTrupa: false,
  polKlecanje: false,
  polCucanje: false,
  polPodvlacenje: false,
  polBalansiranje: false,
  polUspinjanjeLjestvama: false,
  polUspinjanjeStepen: false,
  // Weight loads
  dizTereta: 0,
  prenosTereta: 0,
  guranjeTereta: 0,
  // Sensory requirements (checkboxes)
  vidNaDaljinu: false,
  vidNaBlizinu: false,
  raspoznavanjeBoja: false,
  dobarSluh: false,
  jasanGovor: false,
  // Uvjeti rada (checkboxes)
  uvjetiVisokaTemp: false,
  uvjetiVisokaVlaznost: false,
  uvjetiNiskaTemp: false,
  uvjetiBuka: false,
  uvjetiVibracijeStroj: false,
  uvjetiVibracijePoda: false,
  uvjetiPoviseniTlak: false,
  uvjetiPovecanaOzljeda: false,
  uvjetiIonizacija: false,
  uvjetiNeionizacija: false,
  uvjetiPrasina: false,
  // Text fields
  kemijskeTvari: '',
  bioloskeStetnosti: '',
  odgovornaOsoba: '',
  docName: '',
  docData: '',
  fileObj: null,
};

export default function ReferralRA1Page() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();

  const [referrals, setReferrals] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [workplaces, setWorkplaces] = useState([]);
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(() => searchParams.get('openNew') === '1');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_RA1 });
  const [search, setSearch] = useState('');
  const docInputRef = useRef(null);
  const [filterEstab, setFilterEstab] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loadData = useCallback(() => {
    setReferrals(getAll(COLLECTIONS.REFERRALS_RA1));
    setWorkers(getAll(COLLECTIONS.WORKERS));
    setDoctors(getAll(COLLECTIONS.DOCTORS));
    setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
    setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
  }, []);


  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(referrals.map(x => x.id)));
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
    await create(COLLECTIONS.REFERRALS_RA1, copy);
    loadData();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(lang !== 'en' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.REFERRALS_RA1, id);
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
    if (openId && referrals.length> 0 && !showForm) {
      const rec = referrals.find(r => r.id === openId);
      if (rec) handleEdit(rec);
    }
    
    // Auto-fill worker if opening new form via Zia/Query
    if (searchParams?.get('openNew') === '1' && searchParams?.get('workerId') && workers.length> 0 && orgUnits.length> 0 && workplaces.length> 0) {
        const wId = searchParams.get('workerId');
        if (formData.workerId !== wId) {
            const w = workers.find(wk => wk.id === wId);
            if (w) {
                const wp = workplaces.find(p => p.id === w.radnoMjestoId);
                setFormData(prev => ({
                    ...prev,
                    workerId: w.id,
                    posloviZaKoje: wp?.naziv || '',
                    ukupniRadniStaz: w.ukupniStaz || w.stazDoDolaska || '',
                }));
            }
        }
    }
  }, [searchParams, referrals, workers, orgUnits, workplaces]);
  const filteredRecords = search
    ? referrals.filter(r => r.broj?.toLowerCase().includes(search.toLowerCase()))
    : referrals;
    const enrichedRecords = filteredRecords.map(r => {
    const _w = workers.find(wk => wk.id === r.workerId);
    return { ...r, _workerName: _w ? `${_w.prezime} ${_w.ime}` : '—' };
  });
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(enrichedRecords, 'datum');


  

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleNew = () => {
    setFormData({ ...EMPTY_RA1, datum: todayISO() });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({ ...EMPTY_RA1, ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(t('obrisatiUputnicu'));
    if (ok) { remove(COLLECTIONS.REFERRALS_RA1, id); loadData(); }
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
        const res = await uploadDocument(formData.fileObj, cid, 'referral-ra1');
        uploadedUrl = res.url;
      } catch (e) {
        await alert('Upload failed: ' + e.message); return;
      }
    }
    
    const payload = { ...formData, docData: uploadedUrl };
    delete payload.fileObj;

    if (editingId) {
      update(COLLECTIONS.REFERRALS_RA1, editingId, payload);
    } else {
      create(COLLECTIONS.REFERRALS_RA1, payload);
    }
    setShowForm(false);
    loadData();
    // If user came here mid-creation of a medical exam, go back to resume it
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem("eznr_draft_medexam")) {
        router.push("/dashboard/medical-exams");
      } else if (sessionStorage.getItem("eznr_draft_workers_medexam")) {
        const d = JSON.parse(sessionStorage.getItem("eznr_draft_workers_medexam"));
        router.push("/dashboard/workers?openWorker=" + (d.workerId || ""));
      }
    }
  };

  const handleWorkerChange = (workerId) => {
    const w = workers.find(wk => wk.id === workerId);
    if (!w) { set('workerId', ''); return; }
    const wp = workplaces.find(p => p.id === w.radnoMjestoId);
    const ou = orgUnits.find(o => o.id === w.orgJedinicaId);
    setFormData(prev => ({
      ...prev,
      workerId: w.id,
      posloviZaKoje: wp?.naziv || '',
      ukupniRadniStaz: w.ukupniStaz || w.stazDoDolaska || '',
    }));
  };

  const getWorkerName = (id) => {
    const w = workers.find(wk => wk.id === id);
    return w ? `${w.prezime} ${w.ime}` : '—';
  };

  const getWorkerInfo = (id) => workers.find(wk => wk.id === id);

  // ── Styles ──
  const sectionStyle = {
    marginBottom: 24, paddingBottom: 12,
    borderBottom: '1px solid var(--border-light)',
  };
  const sectionTitle = {
    fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
  };
  const labelSt = {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
  };
  const checkGroup = {
    display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 8,
  };
  const checkLabel = {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.84rem',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };


  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size> 15 * 1024 * 1024) {
      await alert(t('dokumentMoraBitiManjiOd'));
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

  const Chk = ({ field, label }) => (
    <label style={checkLabel}>
      <input type="checkbox" checked={!!formData[field]} onChange={e => set(field, e.target.checked)} />
      {label}
    </label>
  );

  const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
  // ── List view ──
  if (!showForm) {
    const displayRecords = referrals.filter(r => (!filterEstab || r.ustanovaNaziv === filterEstab) && (!filterDoctor || r.doktorIme === filterDoctor));
    const allSelected = displayRecords.length> 0 && displayRecords.every(r => selectedIds.has(r.id));
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Icon3D name="Ljekarska uputnica.png" size={64} />
          <h1 style={{ margin: 0 }}>{t('medicalReferralRA1')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body scrollable-toolbar" style={{ padding: 0, gap: 10 }}>
            <button className="btn btn-primary" onClick={handleNew} title={t('dodajNovuRa1Uputnicu')}>
              + {t('novaUputnicaRa1')}
            </button>
            {filterEstab && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', background: 'rgba(0,191,166,0.1)', border: '1px solid var(--primary)', borderRadius: 20, padding: '2px 10px', color: 'var(--primary)' }}>
                🏥 {filterEstab}
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setFilterEstab('')} title={t('ponistiFilterUstanove')}>✕</button>
              </span>
            )}
            {filterDoctor && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', background: 'rgba(99,102,241,0.1)', border: '1px solid var(--secondary)', borderRadius: 20, padding: '2px 10px', color: 'var(--secondary)' }}>
                👨‍⚕️ {filterDoctor}
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary)', fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setFilterDoctor('')} title={t('ponistiFilterDoktora')}>✕</button>
              </span>
            )}
            <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
              <input placeholder={t('pretrazi1')} value={search} onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
              {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')} title={t('ponistiPretragu')}>✕</button>}
            </div>
            {/* ── Grupne akcije bar ── */}
            {selectedIds.size> 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {t('odabrano')}:</span>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()} title={t('isprintajOdabraneObrasce')}>🖨️ {t('isprintaj')}</button>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} title={t('obrisiOdabraneObrasce')}>🗑️ {t('obrisi')}</button>
              </div>
            )}
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{displayRecords.length} {t('zapisa')}</span>}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={allSelected} onChange={e => { if (e.target.checked) setSelectedIds(new Set(displayRecords.map(r => r.id))); else setSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                    <th style={{ width: 90 }}>{t('actions')}</th>
                    <th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{t('radnik1')}{sortIcon('_workerName')}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{t('datum')}{sortIcon('datum')}</th>
                    <th>{t('tipPregleda')}</th>
                    <th>{t('ustanova')}</th>
                    <th>{t('doktor')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRecords.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : displayRecords.map((r) => {
                    const examType = r.pregledPeriodicki ? 'Periodički' : r.pregledPrethodni ? 'Prethodni' : r.pregledIzvanredni ? 'Izvanredni' : r.pregledKontrolni ? 'Kontrolni' : '—';
                    const wName = getWorkerName(r.workerId);
                    const isChecked = selectedIds.has(r.id);
                    return (
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)}>
                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ position: 'relative' }}>
                            <button className="btn btn-primary btn-sm" data-menu-trigger onMouseDown={(e) => e.preventDefault()} onClick={(e) => {
                              e.stopPropagation();
                              if (actionMenuId === r.id) { setActionMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom - 8;
                              const spaceAbove = rect.top - 8;
                              const flipUp = spaceBelow < 280 && spaceAbove> spaceBelow;
                              setMenuPos(flipUp
                                ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                                : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                              );
                              setActionMenuId(r.id);
                            }} title={t('prikaziAkcijeZaObrazac')}>Akcije ▼</button>
                            {actionMenuId === r.id && typeof document !== 'undefined' && createPortal(
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                              <div data-menu onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                <button onClick={() => { setActionMenuId(null); handleEdit(r); }} className="dropdown-item">✏️ Otvori</button>
                                {r.docData && <button onClick={() => { setActionMenuId(null); downloadDoc(r); }} className="dropdown-item">📎 Preuzmi prilog</button>}
                                <button onClick={() => { setActionMenuId(null); handleDuplicate(r); }} className="dropdown-item">📋 Kopiraj</button>
                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                <button onClick={() => { setActionMenuId(null); handleDelete(r.id); }} className="dropdown-item text-danger">🗑️ Izbriši</button>
                              </div>
                            </>, document.body
                          )}
                          </div>
                        </td>
                        <td>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }} title={t('otvoriProfilRadnika')}>
                            {wName}
                          </button>
                        </td>
                        <td>{formatDate(r.datum)}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>{examType}</span></td>
                        <td>
                          {r.ustanovaNaziv
                            ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                                title={t('filtrirajPoUstanovi')}
                                onClick={e => { e.stopPropagation(); setFilterEstab(f => f === r.ustanovaNaziv ? '' : r.ustanovaNaziv); }}>
                                {r.ustanovaNaziv}
                              </button>
                            : '—'}
                        </td>
                        <td>
                          {r.doktorIme
                            ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                                title={t('filtrirajPoDoktoru')}
                                onClick={e => { e.stopPropagation(); setFilterDoctor(f => f === r.doktorIme ? '' : r.doktorIme); }}>
                                {r.doktorIme}
                              </button>
                            : '—'}
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

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => setShowForm(false)} title={t('nazad')}>←</button>
        <Icon3D name="Ljekarska uputnica.png" size={64} />
        <h1 style={{ margin: 0 }}>{editingId ? (t('urediUputnicuRa1')) : (t('novaUputnicaRa1'))}</h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: General & Worker ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>
              {t('uputnicaZaUtvrivanjeZdravstveneSposobnosti1')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 200px 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={labelSt}>{t('broj')}</div>
                <input className="form-input" value={formData.broj} onChange={e => set('broj', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{t('datum')}</div>
                <DateInput value={formData.datum} onChange={v => set('datum', v)} />
              </div>
              <div>
                <div style={labelSt}>{t('radnik1')} *</div>
                <select className="form-select" value={formData.workerId} onChange={e => handleWorkerChange(e.target.value)}>
                  <option value="">{t('odaberiteRadnika1')}</option>
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
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>OIB:</span> <strong>{worker.oib || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang !== 'en' ? 'Prezime, ime, ime oca:' : 'Name, father:'}</span> <strong>{worker.prezime} {worker.ime}{worker.imeRoditelja ? `, ${worker.imeRoditelja}` : ''}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t('datumRoenja')}</span> <strong>{formatDate(worker.datumRodenja)}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t('orgJedinica')}</span> <strong>{workerOu?.naziv || '—'}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECTION 2: Institution & Doctor ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>
              {t('ustanovaIDatumPregleda')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={labelSt}>{t('odaberiteUstanovu')}</div>
                <input className="form-input" placeholder={t('nazivUstanove')} value={formData.ustanovaNaziv} onChange={e => set('ustanovaNaziv', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{t('doktorMedicineRada')}</div>
                <select className="form-select" value={formData.doktorId} onChange={e => {
                  const doc = doctors.find(d => d.id === e.target.value);
                  setFormData(prev => ({ ...prev, doktorId: e.target.value, doktorIme: doc?.ime || '', doktorEmail: doc?.email || '' }));
                }}>
                  <option value="">{t('odaberiteDoktora')}</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.ime}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={labelSt}>{t('adresa')}</div>
                <input className="form-input" value={formData.ustanovaAdresa} onChange={e => set('ustanovaAdresa', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{t('posta')}</div>
                <input className="form-input" value={formData.ustanovaPosta} onChange={e => set('ustanovaPosta', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{t('mjesto')}</div>
                <input className="form-input" value={formData.ustanovaMjesto} onChange={e => set('ustanovaMjesto', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>Tel/Fax</div>
                <input className="form-input" value={formData.ustanovaTelFax} onChange={e => set('ustanovaTelFax', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>Email doktora</div>
                <input className="form-input" type="email" value={formData.doktorEmail} onChange={e => set('doktorEmail', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '200px 200px', gap: 12 }}>
              <div>
                <div style={labelSt}>{t('naDanDatumPregleda')}</div>
                <DateInput value={formData.datumPregleda} onChange={v => set('datumPregleda', v)} />
              </div>
              <div>
                <div style={labelSt}>{t('sati')}</div>
                <TimeInput value={formData.vrijemePregleda} onChange={v => set('vrijemePregleda', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION 3: RA-1 Job Details ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>RA-1</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('posloviZaKojeSeUtvruje')}</div>
              <input className="form-input" value={formData.posloviZaKoje} onChange={e => set('posloviZaKoje', e.target.value)}
                placeholder={t('nprKomercijalista')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '4px 8px', alignItems: 'center', marginBottom: 14, fontSize: '0.84rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>1) {t('posloviSuPremaClanku')}</span>
                <input className="form-input" value={formData.posloviClanak} onChange={e => set('posloviClanak', e.target.value)} style={{ marginTop: 4 }} />
              </div>
              <span style={{ color: 'var(--text-muted)' }}>{t('tocka')}</span>
              <div>
                <input className="form-input" value={formData.posloviTocka} onChange={e => set('posloviTocka', e.target.value)} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('pravilnikaOPoslovimaSPosebnim')}</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>2) {t('posloviPremaDrugimZakonimaPropisima')}</div>
              <textarea className="form-input" rows={2} value={formData.posloviDrugiZakoni} onChange={e => set('posloviDrugiZakoni', e.target.value)}
                placeholder={t('navestiZakonPropisIliKolektivni')} />
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              3) {t('posloviSuPremaPropisimaO')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{t('ukupniRadniStaz')}</div>
                <input className="form-input" value={formData.ukupniRadniStaz} onChange={e => set('ukupniRadniStaz', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{t('radniStazNaPoslovimaZa')}</div>
                <input className="form-input" value={formData.radniStazNaPoslovima} onChange={e => set('radniStazNaPoslovima', e.target.value)} />
              </div>
            </div>

            {/* Zdravstveni pregled type */}
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('zdravstveniPregled')}</div>
              <div style={checkGroup}>
                <Chk field="pregledPrethodni" label={t('prethodni1')} />
                <Chk field="pregledPeriodicki" label={t('periodicki')} />
                <Chk field="pregledIzvanredni" label={t('izvanredni')} />
                <Chk field="pregledKontrolni" label={t('kontrolni1')} />
              </div>
            </div>

            {/* Last exam */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 12, marginBottom: 14, alignItems: 'end' }}>
              <div>
                <div style={labelSt}>{lang !== 'en' ? 'Posljednji pregled' : 'Last exam date'}</div>
                <DateInput value={formData.posljednjiPregledDatum} onChange={v => set('posljednjiPregledDatum', v)} />
              </div>
              <div>
                <div style={labelSt}>{t('premaClanku')}</div>
                <input className="form-input" value={formData.posljednjiPregledClanak} onChange={e => set('posljednjiPregledClanak', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{t('tocki')}</div>
                <input className="form-input" value={formData.posljednjiPregledTocka} onChange={e => set('posljednjiPregledTocka', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <textarea className="form-input" rows={2} value={formData.posljednjiPregledZakoni} onChange={e => set('posljednjiPregledZakoni', e.target.value)}
                placeholder={lang !== 'en' ? 'navesti zakon, propis ili kolektivni ugovor' : 'specify law, regulation or agreement'} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('sOcjenomZdravstveneSposobnosti')}</div>
              <input className="form-input" value={formData.ocjenaZdravstveneSposobnosti} onChange={e => set('ocjenaZdravstveneSposobnosti', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ═══ SECTION 4: Job Description ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{t('opisPoslaIUvjetiRada')}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{t('kratakOpisPosla')}</div>
              <textarea className="form-input" rows={2} value={formData.kratakOpisPosla} onChange={e => set('kratakOpisPosla', e.target.value)} placeholder={t('kratakOpisPosla1')} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{t('strojeviIAlati')}</div>
              <textarea className="form-input" rows={2} value={formData.strojeviIAlati} onChange={e => set('strojeviIAlati', e.target.value)} placeholder={t('strojeviIAlati2')} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelSt}>{t('predmetRada')}</div>
              <textarea className="form-input" rows={2} value={formData.predmetRada} onChange={e => set('predmetRada', e.target.value)} placeholder={t('predmetRada1')} />
            </div>

            {/* Mjesto rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{t('mjestoRada')}</div>
              <div style={checkGroup}>
                <Chk field="mjestoZatvoreno" label={t('uZatvorenom')} />
                <Chk field="mjestoOtvoreno" label={t('naOtvorenom')} />
                <Chk field="mjestoNaVisini" label={t('naVisini')} />
                <Chk field="mjestoUJami" label={t('uJami')} />
                <Chk field="mjestoUVodi" label={t('uVodi')} />
                <Chk field="mjestoPodVodom" label={t('podVodom')} />
                <Chk field="mjestoUMokrom" label={t('uMokrom')} />
              </div>
            </div>

            {/* Organizacija rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{t('organizacijaRada')}</div>
              <div style={checkGroup}>
                <Chk field="orgSmjene" label={t('uSmjenama')} />
                <Chk field="orgNocniRad" label={t('nocniRad')} />
                <Chk field="orgTerenskiRad" label={t('terenskiRad')} />
                <Chk field="orgRadiSam" label={t('radiSam')} />
                <Chk field="orgRadiSGrupom" label={t('radiSGrupom')} />
                <Chk field="orgRadiSaStrankama" label={lang !== 'en' ? 'radi sa strankama' : 'works with clients'} />
                <Chk field="orgRadiNaTraci" label={t('radiNaTraci')} />
                <Chk field="orgBrziTempo" label={t('brziTempoRada')} />
                <Chk field="orgRitamOdreden" label={t('ritamOdreen')} />
                <Chk field="orgMonotonija" label={t('monotonija')} />
              </div>
            </div>

            {/* Položaj tijela */}
            <div style={sectionStyle}>
              <div style={labelSt}>{t('polozajTijelaIAktivnosti')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 16px', marginBottom: 10 }}>
                <Chk field="polRadStojeci" label={t('radStojeci')} />
                <Chk field="polUcestaloSagibanje" label={t('ucestaloSagibanje1')} />
                <Chk field="polPodvlacenje" label={lang !== 'en' ? 'podvlačenje' : 'crawling under'} />
                <Chk field="polRadSjedeci" label={t('radSjedeci')} />
                <Chk field="polZakretanjeTrupa" label={t('zakretanjeTrupa')} />
                <Chk field="polBalansiranje" label={t('balansiranje')} />
                <Chk field="polUPokretu" label={t('uPokretu')} />
                <Chk field="polKlecanje" label={t('klecanje')} />
                <Chk field="polUspinjanjeLjestvama" label={t('uspinjanjeLjestvama')} />
                <Chk field="polKombinirano" label={t('kombinirano')} />
                <Chk field="polCucanje" label={t('cucanje')} />
                <Chk field="polUspinjanjeStepen" label={t('uspinjanjeStepenicama')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{t('dizTereta')}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.dizTereta} onChange={e => set('dizTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{t('prenosTereta')}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.prenosTereta} onChange={e => set('prenosTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{t('guranjeTereta1')}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.guranjeTereta} onChange={e => set('guranjeTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
              </div>
            </div>

            {/* Sensory */}
            <div style={sectionStyle}>
              <div style={labelSt}>{t('uPosluJeVazan')}</div>
              <div style={checkGroup}>
                <Chk field="vidNaDaljinu" label={t('vidNaDaljinu')} />
                <Chk field="vidNaBlizinu" label={t('vidNaBlizinu')} />
                <Chk field="raspoznavanjeBoja" label={t('raspoznavanjeBoja')} />
                <Chk field="dobarSluh" label={t('dobarSluh')} />
                <Chk field="jasanGovor" label={t('jasanGovor')} />
              </div>
            </div>

            {/* Uvjeti rada */}
            <div style={sectionStyle}>
              <div style={labelSt}>{t('uvjetiRada')}</div>
              <div style={checkGroup}>
                <Chk field="uvjetiVisokaTemp" label={t('visokaTemperatura')} />
                <Chk field="uvjetiVisokaVlaznost" label={t('visokaVlaznost')} />
                <Chk field="uvjetiNiskaTemp" label={t('niskaTemperatura')} />
                <Chk field="uvjetiBuka" label={t('buka')} />
                <Chk field="uvjetiVibracijeStroj" label={t('vibracijeStrojaIliAlata')} />
                <Chk field="uvjetiVibracijePoda" label={t('vibracijePoda')} />
                <Chk field="uvjetiPoviseniTlak" label={t('poviseniAtmosferskiTlak')} />
                <Chk field="uvjetiPovecanaOzljeda" label={t('povecanaIzlozenostOzljedama')} />
                <Chk field="uvjetiIonizacija" label={t('ionizacijskaZracenja')} />
                <Chk field="uvjetiNeionizacija" label={t('neionizacijskaZracenja')} />
                <Chk field="uvjetiPrasina" label={t('prasina1')} />
              </div>
            </div>

            {/* Chemical & Biological */}
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('kemijskeTvari')}</div>
              <textarea className="form-input" rows={2} value={formData.kemijskeTvari} onChange={e => set('kemijskeTvari', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('bioloskeStetnosti')}</div>
              <textarea className="form-input" rows={2} value={formData.bioloskeStetnosti} onChange={e => set('bioloskeStetnosti', e.target.value)} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('odgovornaOsoba')}</div>
              <input className="form-input" value={formData.odgovornaOsoba} onChange={e => set('odgovornaOsoba', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ═══ Document Upload ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{t('prilog')}</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📎 {t('dokumentPdfWordMaks2mb')}</label>
              {formData.docName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>
                      <button type="button" onClick={() => openDoc(formData.docData, formData.docName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--info)', fontSize: '0.85rem', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid' }}>📎 {formData.docName}</button>
                      <div className="scrollable-toolbar" style={{ padding: 0, gap: 8 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDoc(formData.docData, formData.docName)} style={{ color: 'var(--info)' }} title={t('pregledPriloga')}>👁 {t('otvori')}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadDoc({ docData: formData.docData, docName: formData.docName })} style={{ color: 'var(--primary)' }} title={t('preuzmiPrilog')}>↓ {t('preuzmi')}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ color: 'var(--danger)' }} title={t('ukloniPrilog')}>✕ {t('ukloni')}</button>
                      </div>
                  </div>
              ) : (
                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      📂 {t('klikniteZaUploadDokumentaWord')}
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
              💾 {t('save')}
            </button>
            <button className="btn btn-outline" onClick={async () => { await handleSave(); handleNew(); }}>
              💾 {t('sacuvajINova')}
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

