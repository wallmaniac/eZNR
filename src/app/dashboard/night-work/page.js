'use client';
import DateInput from '@/components/DateInput';
import {  useState, useEffect, useCallback, useRef  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { useSavedFlash } from '@/hooks/useSavedFlash';

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
    if (await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.REFERRALS_NR1, id);
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
    const ok = await confirm(lang === 'bs' ? 'Obrisati uputnicu?' : 'Delete referral?');
    if (ok) { remove(COLLECTIONS.REFERRALS_NR1, id); loadData(); }
  };

  const handleSave = async () => {
    if (!formData.workerId) {
      await alert(lang === 'bs' ? 'Odaberite radnika!' : 'Select a worker!');
      return;
    }
    if (editingId) {
      update(COLLECTIONS.REFERRALS_NR1, editingId, formData);
    } else {
      create(COLLECTIONS.REFERRALS_NR1, formData);
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
    const allSelected = sorted.length > 0 && sorted.every(r => selectedIds.has(r.id));
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>🌙 {t('nightWorkReferral')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Nova uputnica NR-1' : 'New NR-1 referral'}
            </button>
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
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{records.length} {lang === 'bs' ? 'zapisa' : 'records'}</span>}
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
                    <th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{lang === 'bs' ? 'Radnik' : 'Worker'}{sortIcon('_workerName')}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>
                    <th>{lang === 'bs' ? 'Noćni rad' : 'Night work'}</th>
                    <th>{lang === 'bs' ? 'Tip pregleda' : 'Exam type'}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sorted.map((r) => {
                    const examType = r.pregledPrethodni ? (lang === 'bs' ? 'Prethodni' : 'Initial') : r.pregledKontrolni ? (lang === 'bs' ? 'Kontrolni' : 'Control') : '—';
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
                        <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', background: 'none', color: 'var(--text)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
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
        <h1 style={{ margin: 0 }}>🌙 {editingId ? (lang === 'bs' ? 'Uredi uputnicu NR-1' : 'Edit NR-1') : (lang === 'bs' ? 'Nova uputnica NR-1' : 'New NR-1')}</h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: Worker & General ═══ */}
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
                <select className="form-select" value={formData.workerId} onChange={e => set('workerId', e.target.value)}>
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
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>OIB:</span> <strong>{worker.oib || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Prezime, ime, ime oca:' : 'Name:'}</span> <strong>{worker.prezime} {worker.ime}{worker.imeRoditelja ? `, ${worker.imeRoditelja}` : ''}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Datum rođenja:' : 'DOB:'}</span> <strong>{formatDate(worker.datumRodenja)}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{lang === 'bs' ? 'Org. jedinica:' : 'Org unit:'}</span> <strong>{workerOu?.naziv || '—'}</strong></div>
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
              <div style={labelSt}>{lang === 'bs' ? 'Noćni rad za koji se utvrđuje zdravstvena sposobnost' : 'Night work for health fitness assessment'}</div>
              <input className="form-input" value={formData.nocniRadZaKoji} onChange={e => set('nocniRadZaKoji', e.target.value)}
                placeholder={lang === 'bs' ? 'npr. Komercijalista' : 'e.g. Sales representative'} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Zdravstveni pregled' : 'Health examination'}</div>
              <div style={checkGroup}>
                <Chk field="pregledPrethodni" label={lang === 'bs' ? 'prethodni' : 'initial'} />
                <Chk field="pregledKontrolni" label={lang === 'bs' ? 'kontrolni' : 'control'} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, marginBottom: 14, alignItems: 'end' }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Posljednji zdravstveni pregled je učinjen' : 'Last health exam was on'}</div>
                <DateInput value={formData.posljednjiPregledDatum} onChange={v => set('posljednjiPregledDatum', v)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'za noćni rad' : 'for night work'}</div>
                <input className="form-input" value={formData.posljednjiPregledZanocniRad} onChange={e => set('posljednjiPregledZanocniRad', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 's ocjenom zdravstvene sposobnosti' : 'with health fitness assessment'}</div>
              <input className="form-input" value={formData.ocjenaZdravstveneSposobnosti} onChange={e => set('ocjenaZdravstveneSposobnosti', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ═══ SECTION 3: Working conditions ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'Opis posla i uvjeti rada' : 'Job description & working conditions'}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Kratak opis posla' : 'Brief job description'}</div>
              <textarea className="form-input" rows={2} value={formData.kratakOpisPosla} onChange={e => set('kratakOpisPosla', e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Strojevi i alati' : 'Machines & tools'}</div>
              <textarea className="form-input" rows={2} value={formData.strojeviIAlati} onChange={e => set('strojeviIAlati', e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Predmet rada' : 'Subject of work'}</div>
              <textarea className="form-input" rows={2} value={formData.predmetRada} onChange={e => set('predmetRada', e.target.value)} />
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
                <Chk field="orgRadiSGrupom" label={lang === 'bs' ? 'radi s grupom' : 'in group'} />
                <Chk field="orgRadiSaStrankama" label={lang === 'bs' ? 'radi sa strankama' : 'with clients'} />
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
                <Chk field="polPodvlacenje" label={lang === 'bs' ? 'podvlačenje' : 'crawling'} />
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
            <SavedFlash />
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

