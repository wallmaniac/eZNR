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
import Icon3D from '@/components/Icon3D';


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
    if (await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
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
    if (openId && referrals.length > 0 && !showForm) {
      const rec = referrals.find(r => r.id === openId);
      if (rec) handleEdit(rec);
    }
    
    // Auto-fill worker if opening new form via Zia/Query
    if (searchParams?.get('openNew') === '1' && searchParams?.get('workerId') && workers.length > 0 && orgUnits.length > 0 && workplaces.length > 0) {
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
    const ok = await confirm(lang === 'bs' ? 'Obrisati uputnicu?' : 'Delete referral?');
    if (ok) { remove(COLLECTIONS.REFERRALS_RA1, id); loadData(); }
  };

  const handleSave = async () => {
    if (!formData.workerId) {
      await alert(lang === 'bs' ? 'Odaberite radnika!' : 'Select a worker!');
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
    if (file.size > 15 * 1024 * 1024) {
      await alert(lang === 'bs' ? 'Dokument mora biti manji od 15MB!' : 'Document must be under 15MB!');
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
    const allSelected = displayRecords.length > 0 && displayRecords.every(r => selectedIds.has(r.id));
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <Icon3D name="Ljekarska uputnica.png" size={64} />
          <h1 style={{ margin: 0 }}>{t('medicalReferralRA1')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Nova uputnica' : 'New referral'}
            </button>
            {filterEstab && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', background: 'rgba(0,191,166,0.1)', border: '1px solid var(--primary)', borderRadius: 20, padding: '2px 10px', color: 'var(--primary)' }}>
                🏥 {filterEstab}
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setFilterEstab('')}>✕</button>
              </span>
            )}
            {filterDoctor && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', background: 'rgba(99,102,241,0.1)', border: '1px solid var(--secondary)', borderRadius: 20, padding: '2px 10px', color: 'var(--secondary)' }}>
                👨‍⚕️ {filterDoctor}
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary)', fontWeight: 700, padding: 0, lineHeight: 1 }} onClick={() => setFilterDoctor('')}>✕</button>
              </span>
            )}
            <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
              <input placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
              {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>✕</button>}
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
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{displayRecords.length} {lang === 'bs' ? 'zapisa' : 'records'}</span>}
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
                    <th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{lang === 'bs' ? 'Radnik' : 'Worker'}{sortIcon('_workerName')}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>
                    <th>{lang === 'bs' ? 'Tip pregleda' : 'Exam type'}</th>
                    <th>{lang === 'bs' ? 'Ustanova' : 'Institution'}</th>
                    <th>{lang === 'bs' ? 'Doktor' : 'Doctor'}</th>
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
                      <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
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
                        <td>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }} title={lang === 'bs' ? 'Otvori profil radnika' : 'Open worker profile'}>
                            {wName}
                          </button>
                        </td>
                        <td>{formatDate(r.datum)}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>{examType}</span></td>
                        <td>
                          {r.ustanovaNaziv
                            ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                                title={lang === 'bs' ? 'Filtriraj po ustanovi' : 'Filter by institution'}
                                onClick={e => { e.stopPropagation(); setFilterEstab(f => f === r.ustanovaNaziv ? '' : r.ustanovaNaziv); }}>
                                {r.ustanovaNaziv}
                              </button>
                            : '—'}
                        </td>
                        <td>
                          {r.doktorIme
                            ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                                title={lang === 'bs' ? 'Filtriraj po doktoru' : 'Filter by doctor'}
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
        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>←</button>
        <Icon3D name="Ljekarska uputnica.png" size={64} />
        <h1 style={{ margin: 0 }}>{editingId ? (lang === 'bs' ? 'Uredi uputnicu RA-1' : 'Edit RA-1 referral') : (lang === 'bs' ? 'Nova uputnica RA-1' : 'New RA-1 referral')}</h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: General & Worker ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>
              {lang === 'bs' ? 'Uputnica za utvrđivanje zdravstvene sposobnosti radnika' : 'Referral for determining worker health fitness'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 200px 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Broj' : 'Number'}</div>
                <input className="form-input" value={formData.broj} onChange={e => set('broj', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Datum' : 'Date'}</div>
                <DateInput value={formData.datum} onChange={v => set('datum', v)} />
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

            {/* Worker auto-filled details */}
            {worker && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 16px', fontSize: '0.84rem' }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>OIB:</span> <strong>{worker.oib || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Prezime, ime, ime oca:' : 'Name, father:'}</span> <strong>{worker.prezime} {worker.ime}{worker.imeRoditelja ? `, ${worker.imeRoditelja}` : ''}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Datum rođenja:' : 'DOB:'}</span> <strong>{formatDate(worker.datumRodenja)}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Org. jedinica:' : 'Org unit:'}</span> <strong>{workerOu?.naziv || '—'}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECTION 2: Institution & Doctor ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>
              {lang === 'bs' ? 'Ustanova i datum pregleda' : 'Institution & exam date'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Odaberite ustanovu' : 'Select institution'}</div>
                <input className="form-input" placeholder={lang === 'bs' ? 'Naziv ustanove' : 'Institution name'} value={formData.ustanovaNaziv} onChange={e => set('ustanovaNaziv', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Doktor medicine rada' : 'Occupational medicine doctor'}</div>
                <select className="form-select" value={formData.doktorId} onChange={e => {
                  const doc = doctors.find(d => d.id === e.target.value);
                  setFormData(prev => ({ ...prev, doktorId: e.target.value, doktorIme: doc?.ime || '', doktorEmail: doc?.email || '' }));
                }}>
                  <option value="">{lang === 'bs' ? '— Odaberite doktora —' : '— Select doctor —'}</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.ime}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Adresa' : 'Address'}</div>
                <input className="form-input" value={formData.ustanovaAdresa} onChange={e => set('ustanovaAdresa', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Pošta' : 'Postal'}</div>
                <input className="form-input" value={formData.ustanovaPosta} onChange={e => set('ustanovaPosta', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Mjesto' : 'City'}</div>
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
                <div style={labelSt}>{lang === 'bs' ? 'Na dan (datum pregleda)' : 'Exam date'}</div>
                <DateInput value={formData.datumPregleda} onChange={v => set('datumPregleda', v)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Sati' : 'Time'}</div>
                <input className="form-input" type="time" pattern="[0-2][0-9]:[0-5][0-9]" step="60" value={formData.vrijemePregleda} onChange={e => set('vrijemePregleda', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION 3: RA-1 Job Details ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>RA-1</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Poslovi za koje se utvrđuje zdravstvena sposobnost' : 'Jobs for health fitness assessment'}</div>
              <input className="form-input" value={formData.posloviZaKoje} onChange={e => set('posloviZaKoje', e.target.value)}
                placeholder={lang === 'bs' ? 'npr. Komercijalista' : 'e.g. Sales representative'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '4px 8px', alignItems: 'center', marginBottom: 14, fontSize: '0.84rem' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>1) {lang === 'bs' ? 'Poslovi su prema članku' : 'Jobs per article'}</span>
                <input className="form-input" value={formData.posloviClanak} onChange={e => set('posloviClanak', e.target.value)} style={{ marginTop: 4 }} />
              </div>
              <span style={{ color: 'var(--text-muted)' }}>{lang === 'bs' ? 'točka' : 'point'}</span>
              <div>
                <input className="form-input" value={formData.posloviTocka} onChange={e => set('posloviTocka', e.target.value)} />
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Pravilnika o poslovima s posebnim uvjetima rada.' : 'of the Regulation.'}</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>2) {lang === 'bs' ? 'Poslovi prema drugim zakonima, propisima ili kolektivnom ugovoru:' : 'Jobs per other laws/regulations:'}</div>
              <textarea className="form-input" rows={2} value={formData.posloviDrugiZakoni} onChange={e => set('posloviDrugiZakoni', e.target.value)}
                placeholder={lang === 'bs' ? 'navesti zakon, propis ili kolektivni ugovor' : 'specify law, regulation or collective agreement'} />
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              3) {lang === 'bs' ? 'Poslovi su prema propisima o mirovinskom osiguranju utvrđeni kao poslovi na kojima se staž osiguranja računa s povećanim trajanjem.' : 'Jobs per pension insurance regulations.'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Ukupni radni staž' : 'Total work experience'}</div>
                <input className="form-input" value={formData.ukupniRadniStaz} onChange={e => set('ukupniRadniStaz', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Radni staž na poslovima za koje se utvrđuje zdr. sposobnost' : 'Experience in assessed position'}</div>
                <input className="form-input" value={formData.radniStazNaPoslovima} onChange={e => set('radniStazNaPoslovima', e.target.value)} />
              </div>
            </div>

            {/* Zdravstveni pregled type */}
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Zdravstveni pregled' : 'Health examination'}</div>
              <div style={checkGroup}>
                <Chk field="pregledPrethodni" label={lang === 'bs' ? 'prethodni' : 'initial'} />
                <Chk field="pregledPeriodicki" label={lang === 'bs' ? 'periodički' : 'periodic'} />
                <Chk field="pregledIzvanredni" label={lang === 'bs' ? 'izvanredni' : 'extraordinary'} />
                <Chk field="pregledKontrolni" label={lang === 'bs' ? 'kontrolni' : 'control'} />
              </div>
            </div>

            {/* Last exam */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr', gap: 12, marginBottom: 14, alignItems: 'end' }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Posljednji pregled' : 'Last exam date'}</div>
                <DateInput value={formData.posljednjiPregledDatum} onChange={v => set('posljednjiPregledDatum', v)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'prema članku' : 'per article'}</div>
                <input className="form-input" value={formData.posljednjiPregledClanak} onChange={e => set('posljednjiPregledClanak', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'točki' : 'point'}</div>
                <input className="form-input" value={formData.posljednjiPregledTocka} onChange={e => set('posljednjiPregledTocka', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <textarea className="form-input" rows={2} value={formData.posljednjiPregledZakoni} onChange={e => set('posljednjiPregledZakoni', e.target.value)}
                placeholder={lang === 'bs' ? 'navesti zakon, propis ili kolektivni ugovor' : 'specify law, regulation or agreement'} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 's ocjenom zdravstvene sposobnosti' : 'with health fitness assessment'}</div>
              <input className="form-input" value={formData.ocjenaZdravstveneSposobnosti} onChange={e => set('ocjenaZdravstveneSposobnosti', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ═══ SECTION 4: Job Description ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'Opis posla i uvjeti rada' : 'Job description & working conditions'}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Kratak opis posla' : 'Brief job description'}</div>
              <textarea className="form-input" rows={2} value={formData.kratakOpisPosla} onChange={e => set('kratakOpisPosla', e.target.value)} placeholder={lang === 'bs' ? 'kratak opis posla' : 'brief job description'} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Strojevi i alati' : 'Machines & tools'}</div>
              <textarea className="form-input" rows={2} value={formData.strojeviIAlati} onChange={e => set('strojeviIAlati', e.target.value)} placeholder={lang === 'bs' ? 'strojevi i alati' : 'machines and tools'} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Predmet rada' : 'Subject of work'}</div>
              <textarea className="form-input" rows={2} value={formData.predmetRada} onChange={e => set('predmetRada', e.target.value)} placeholder={lang === 'bs' ? 'predmet rada' : 'subject of work'} />
            </div>

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
                <Chk field="orgRadiSam" label={lang === 'bs' ? 'radi sam' : 'works alone'} />
                <Chk field="orgRadiSGrupom" label={lang === 'bs' ? 'radi s grupom' : 'works in group'} />
                <Chk field="orgRadiSaStrankama" label={lang === 'bs' ? 'radi sa strankama' : 'works with clients'} />
                <Chk field="orgRadiNaTraci" label={lang === 'bs' ? 'radi na traci' : 'assembly line'} />
                <Chk field="orgBrziTempo" label={lang === 'bs' ? 'brzi tempo rada' : 'fast pace'} />
                <Chk field="orgRitamOdreden" label={lang === 'bs' ? 'ritam određen' : 'fixed rhythm'} />
                <Chk field="orgMonotonija" label={lang === 'bs' ? 'monotonija' : 'monotony'} />
              </div>
            </div>

            {/* Položaj tijela */}
            <div style={sectionStyle}>
              <div style={labelSt}>{lang === 'bs' ? 'Položaj tijela i aktivnosti' : 'Body position & activities'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 16px', marginBottom: 10 }}>
                <Chk field="polRadStojeci" label={lang === 'bs' ? 'rad stojeći' : 'standing'} />
                <Chk field="polUcestaloSagibanje" label={lang === 'bs' ? 'učestalo sagibanje' : 'frequent bending'} />
                <Chk field="polPodvlacenje" label={lang === 'bs' ? 'podvlačenje' : 'crawling under'} />
                <Chk field="polRadSjedeci" label={lang === 'bs' ? 'rad sjedeći' : 'sitting'} />
                <Chk field="polZakretanjeTrupa" label={lang === 'bs' ? 'zakretanje trupa' : 'torso rotation'} />
                <Chk field="polBalansiranje" label={lang === 'bs' ? 'balansiranje' : 'balancing'} />
                <Chk field="polUPokretu" label={lang === 'bs' ? 'u pokretu' : 'in motion'} />
                <Chk field="polKlecanje" label={lang === 'bs' ? 'klečanje' : 'kneeling'} />
                <Chk field="polUspinjanjeLjestvama" label={lang === 'bs' ? 'uspinjanje ljestvama' : 'climbing ladders'} />
                <Chk field="polKombinirano" label={lang === 'bs' ? 'kombinirano' : 'combined'} />
                <Chk field="polCucanje" label={lang === 'bs' ? 'čučanje' : 'squatting'} />
                <Chk field="polUspinjanjeStepen" label={lang === 'bs' ? 'uspinjanje stepenicama' : 'climbing stairs'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'diz. tereta:' : 'lift:'}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.dizTereta} onChange={e => set('dizTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'prenoš. tereta:' : 'carry:'}</span>
                  <input className="form-input" type="number" min="0" style={{ width: 80 }} value={formData.prenosTereta} onChange={e => set('prenosTereta', Number(e.target.value))} />
                  <span style={{ fontSize: '0.82rem' }}>kg</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'guranje tereta:' : 'push:'}</span>
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
                <Chk field="uvjetiVibracijeStroj" label={lang === 'bs' ? 'vibracije stroja ili alata' : 'machine vibrations'} />
                <Chk field="uvjetiVibracijePoda" label={lang === 'bs' ? 'vibracije poda' : 'floor vibrations'} />
                <Chk field="uvjetiPoviseniTlak" label={lang === 'bs' ? 'povišeni atmosferski tlak' : 'increased pressure'} />
                <Chk field="uvjetiPovecanaOzljeda" label={lang === 'bs' ? 'povećana izloženost ozljedama' : 'increased injury risk'} />
                <Chk field="uvjetiIonizacija" label={lang === 'bs' ? 'ionizacijska zračenja' : 'ionizing radiation'} />
                <Chk field="uvjetiNeionizacija" label={lang === 'bs' ? 'neionizacijska zračenja' : 'non-ionizing radiation'} />
                <Chk field="uvjetiPrasina" label={lang === 'bs' ? 'prašina' : 'dust'} />
              </div>
            </div>

            {/* Chemical & Biological */}
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Kemijske tvari' : 'Chemical agents'}</div>
              <textarea className="form-input" rows={2} value={formData.kemijskeTvari} onChange={e => set('kemijskeTvari', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Biološke štetnosti' : 'Biological hazards'}</div>
              <textarea className="form-input" rows={2} value={formData.bioloskeStetnosti} onChange={e => set('bioloskeStetnosti', e.target.value)} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Odgovorna osoba' : 'Responsible person'}</div>
              <input className="form-input" value={formData.odgovornaOsoba} onChange={e => set('odgovornaOsoba', e.target.value)} />
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
                      <button type="button" onClick={() => openDoc(formData.docData, formData.docName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--info)', fontSize: '0.85rem', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid' }}>📎 {formData.docName}</button>
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
              💾 {lang === 'bs' ? 'Snimi' : 'Save'}
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

