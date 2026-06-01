'use client';
import DateInput from '@/components/DateInput';
import {  useState, useEffect, useCallback, useRef  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO, getActiveCompanyId
} from '@/lib/dataStore';
import { uploadDocument } from '@/lib/storageService';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import PageHeader from '@/components/PageHeader';

const EMPTY_NR1 = {
  workerId: '',
  broj: '',
  datum: todayISO(),
  // NR-1 specifics
  nocniRadZaKoji: '',
  pregledPrethodni: false,
  pregledKontrolni: false,
  posljednjiPregledDatum: '',
  posljednjiPregledZanocniRad: '',
  ocjenaZdravstveneSposobnosti: '',
  // Job description
  kratakOpisPosla: '',
  strojeviIAlati: '',
  predmetRada: '',
  // Mjesto rada
  mjestoZatvoreno: false, mjestoOtvoreno: false, mjestoNaVisini: false,
  mjestoUJami: false, mjestoUVodi: false, mjestoPodVodom: false, mjestoUMokrom: false,
  // Organizacija rada
  orgSmjene: false, orgNocniRad: false, orgTerenskiRad: false,
  orgRadiSam: false, orgRadiSGrupom: false, orgRadiSaStrankama: false,
  orgRadiNaTraci: false, orgBrziTempo: false, orgRitamOdreden: false, orgMonotonija: false,
  // Položaj tijela
  polRadStojeci: false, polRadSjedeci: false, polUPokretu: false, polKombinirano: false,
  polUcestaloSagibanje: false, polZakretanjeTrupa: false,
  polKlecanje: false, polCucanje: false,
  polPodvlacenje: false, polBalansiranje: false,
  polUspinjanjeLjestvama: false, polUspinjanjeStepen: false,
  dizTereta: 0, prenosTereta: 0, guranjeTereta: 0,
  // Sensory
  vidNaDaljinu: false, vidNaBlizinu: false, raspoznavanjeBoja: false,
  dobarSluh: false, jasanGovor: false,
  // Uvjeti rada
  uvjetiVisokaTemp: false, uvjetiVisokaVlaznost: false, uvjetiNiskaTemp: false,
  uvjetiBuka: false, uvjetiVibracijeStroj: false, uvjetiVibracijePoda: false,
  uvjetiPoviseniTlak: false, uvjetiPovecanaOzljeda: false,
  uvjetiIonizacija: false, uvjetiNeionizacija: false, uvjetiPrasina: false,
  kemijskeTvari: '',
  bioloskeStetnosti: '',
  odgovornaOsoba: '',
  docName: '',
  docData: '',
  fileObj: null,
};

export default function NightWorkPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { showFlash, SavedFlash } = useSavedFlash();

  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_NR1 });
  const [search, setSearch] = useState('');
  const docInputRef = useRef(null);

  const loadData = useCallback(() => {
    setRecords(getAll(COLLECTIONS.REFERRALS_NR1));
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
    await create(COLLECTIONS.REFERRALS_NR1, copy);
    loadData();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(t('deleteItems21').replace('{0}', selectedIds.size))) {
      for (let id of selectedIds) await remove(COLLECTIONS.REFERRALS_NR1, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);
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
    setFormData({ ...EMPTY_NR1, datum: todayISO() });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({ ...EMPTY_NR1, ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(t('obrisatiUputnicu'));
    if (ok) { remove(COLLECTIONS.REFERRALS_NR1, id); loadData(); }
  };

  const handleSave = async () => {
    if (!formData.workerId) {
      await alert(t('odaberiteRadnika'));
      return;
    }

    let uploadedUrl = formData.docData;
    if (formData.fileObj) {
      try {
        const cid = getActiveCompanyId();
        const res = await uploadDocument(formData.fileObj, cid, 'night-work');
        uploadedUrl = res.url;
      } catch (e) {
        await alert('Upload failed: ' + e.message); return;
      }
    }
    
    const payload = { ...formData, docData: uploadedUrl };
    delete payload.fileObj;

    if (editingId) {
      update(COLLECTIONS.REFERRALS_NR1, editingId, payload);
    } else {
      create(COLLECTIONS.REFERRALS_NR1, payload);
    }
    setShowForm(false);
    loadData();
    showFlash();
  };

  const getWorkerName = (id) => {
    const w = workers.find(wk => wk.id === id);
    return w ? `${w.prezime} ${w.ime}` : '—';
  };
  const getWorkerInfo = (id) => workers.find(wk => wk.id === id);

  const labelSt = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };
  const sectionTitle = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 };
  const sectionStyle = { marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' };
  const checkGroup = { display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 8 };
  const checkLabel = { display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.84rem', cursor: 'pointer', whiteSpace: 'nowrap' };

  const Chk = ({ field, label }) => (
    <label style={checkLabel}>
      <input type="checkbox" checked={!!formData[field]} onChange={e => set(field, e.target.checked)} />
      {label}
    </label>
  );

  const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
  // ── List view ──
  if (!showForm) {
    const allSelected = sorted.length> 0 && sorted.every(r => selectedIds.has(r.id));
    return (
      <div className="animate-fadeIn">
        <PageHeader icon="🌙" title={t('nightWorkReferral')} />
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body scrollable-toolbar" style={{ padding: 0, gap: 10 }}>
            <button className="btn btn-primary" onClick={handleNew} title={t('dodajNoviObrazacZaNocni')}>
              + {t('novaEvidencija')}
            </button>
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
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{records.length} {t('zapisa')}</span>}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={allSelected} onChange={e => { if (e.target.checked) setSelectedIds(new Set(sorted.map(r => r.id))); else setSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                    <th style={{ width: 90 }}>{t('actions')}</th>
                    <th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{t('radnik1')}{sortIcon('_workerName')}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{t('datum')}{sortIcon('datum')}</th>
                    <th>{t('nocniRad1')}</th>
                    <th>{t('tipPregleda')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sorted.map((r) => {
                    const examType = r.pregledPrethodni ? (t('prethodni')) : r.pregledKontrolni ? (t('kontrolni')) : '—';
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
                            }} title={t('prikaziAkcijeZaObrazac')}>{t('actions1')}</button>
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
                        <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', background: 'none', color: 'var(--text)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
                        <td>{formatDate(r.datum)}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nocniRadZaKoji || '—'}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: '#EDE7F6', color: '#4527A0', fontWeight: 600 }}>{examType}</span></td>
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

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => setShowForm(false)} title={t('nazad')}>←</button>
        <h1 style={{ margin: 0 }}>🌙 {editingId ? (t('urediUputnicuNr1')) : (t('novaUputnicaNr1'))}</h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: Worker & General ═══ */}
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
                <select className="form-select" value={formData.workerId} onChange={e => set('workerId', e.target.value)}>
                  <option value="">{t('odaberiteRadnika1')}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime} {w.oib ? `(${w.oib})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {worker && (
              <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px 16px', fontSize: '0.84rem' }}>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>OIB:</span> <strong>{worker.oib || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t('prezimeImeImeOca')}</span> <strong>{worker.prezime} {worker.ime}{worker.imeRoditelja ? `, ${worker.imeRoditelja}` : ''}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t('datumRoenja')}</span> <strong>{formatDate(worker.datumRodenja)}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{t('orgJedinica')}</span> <strong>{workerOu?.naziv || '—'}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SECTION 2: NR-1 Specifics ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>NR-1</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('nocniRadZaKojiSe')}</div>
              <input className="form-input" value={formData.nocniRadZaKoji} onChange={e => set('nocniRadZaKoji', e.target.value)}
                placeholder={t('nprKomercijalista')} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('zdravstveniPregled')}</div>
              <div style={checkGroup}>
                <Chk field="pregledPrethodni" label={t('prethodni1')} />
                <Chk field="pregledKontrolni" label={t('kontrolni1')} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, marginBottom: 14, alignItems: 'end' }}>
              <div>
                <div style={labelSt}>{t('posljednjiZdravstveniPregledJeUcinjen')}</div>
                <DateInput value={formData.posljednjiPregledDatum} onChange={v => set('posljednjiPregledDatum', v)} />
              </div>
              <div>
                <div style={labelSt}>{t('zaNocniRad')}</div>
                <input className="form-input" value={formData.posljednjiPregledZanocniRad} onChange={e => set('posljednjiPregledZanocniRad', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('sOcjenomZdravstveneSposobnosti')}</div>
              <input className="form-input" value={formData.ocjenaZdravstveneSposobnosti} onChange={e => set('ocjenaZdravstveneSposobnosti', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ═══ SECTION 3: Working conditions ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{t('opisPoslaIUvjetiRada')}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{t('kratakOpisPosla')}</div>
              <textarea className="form-input" rows={2} value={formData.kratakOpisPosla} onChange={e => set('kratakOpisPosla', e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{t('strojeviIAlati')}</div>
              <textarea className="form-input" rows={2} value={formData.strojeviIAlati} onChange={e => set('strojeviIAlati', e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelSt}>{t('predmetRada')}</div>
              <textarea className="form-input" rows={2} value={formData.predmetRada} onChange={e => set('predmetRada', e.target.value)} />
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
                <Chk field="orgRadiSaStrankama" label={t('radiSaStrankama')} />
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
                <Chk field="polPodvlacenje" label={t('podvlacenje')} />
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
              💾 {t('sacuvajUputnicu')}
            </button>
            <SavedFlash />
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

