'use client';
import { createPortal } from 'react-dom';
import {  useState, useEffect, useCallback  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

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
};

export default function NightWorkPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();

  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [orgUnits, setOrgUnits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_NR1 });

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
    if (window.confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.REFERRALS_NR1, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => setActionMenuId(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  // ── List view ──
  if (!showForm) {
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>🌙 {t('nightWorkReferral')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Nova uputnica NR-1' : 'New NR-1 referral'}
            </button>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {records.length} {lang === 'bs' ? 'zapisa' : 'records'}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Noćni rad' : 'Night work'}</th>
                    <th>{lang === 'bs' ? 'Tip pregleda' : 'Exam type'}</th>
                    
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : records.map((r, idx) => {
                    const examType = r.pregledPrethodni ? (lang === 'bs' ? 'Prethodni' : 'Initial') : r.pregledKontrolni ? (lang === 'bs' ? 'Kontrolni' : 'Control') : '—';
                    return (
                      <tr key={r.id}>
                      <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                      <td style={{ position: 'relative' }}>
        <button 
          className="btn btn-primary btn-sm" 
          onClick={e => { 
            e.stopPropagation(); 
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, left: rect.left < 200 ? 50 : rect.left });
            setActionMenuId(prev => prev === r.id ? null : r.id); 
          }}
        >
          {lang === 'bs' ? 'Akcije' : 'Actions'} ▼
        </button>
        {actionMenuId === r.id && typeof window !== 'undefined' && createPortal(
          <div className="dropdown-menu" 
               style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999, minWidth: 160, display: 'block', margin: 0 }} 
               onMouseLeave={() => setActionMenuId(null)}>
            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}>
              <span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>✏️</span> {lang === 'bs' ? 'Otvori' : 'Open'}
            </button>
            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(r); }}>
              <span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📋</span> {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}
            </button>
            <div className="dropdown-divider" />
            <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(r.id || r.id); }}>
              <span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🗑️</span> {lang === 'bs' ? 'Obriši' : 'Delete'}
            </button>
          </div>,
          document.body
        )}
      </td>
                        
                        <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' , background: 'none', color: 'var(--text)'}} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
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
                <input className="form-input" type="date" value={formData.posljednjiPregledDatum} onChange={e => set('posljednjiPregledDatum', e.target.value)} />
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
