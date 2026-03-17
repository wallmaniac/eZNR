'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

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

  const loadData = useCallback(() => {
    setReferrals(getAll(COLLECTIONS.REFERRALS_RA1));
    setWorkers(getAll(COLLECTIONS.WORKERS));
    setDoctors(getAll(COLLECTIONS.DOCTORS));
    setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
    setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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
    if (editingId) {
      update(COLLECTIONS.REFERRALS_RA1, editingId, formData);
    } else {
      create(COLLECTIONS.REFERRALS_RA1, formData);
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
          <h1 style={{ margin: 0 }}>🩺 {t('medicalReferralRA1')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Nova uputnica' : 'New referral'}
            </button>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {referrals.length} {lang === 'bs' ? 'zapisa' : 'records'}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Tip pregleda' : 'Exam type'}</th>
                    <th>{lang === 'bs' ? 'Ustanova' : 'Institution'}</th>
                    <th>{lang === 'bs' ? 'Doktor' : 'Doctor'}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : referrals.map((r, idx) => {
                    const examType = r.pregledPeriodicki ? 'Periodički' : r.pregledPrethodni ? 'Prethodni' : r.pregledIzvanredni ? 'Izvanredni' : r.pregledKontrolni ? 'Kontrolni' : '—';
                    return (
                      <tr key={r.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{getWorkerName(r.workerId)}</td>
                        <td>{formatDate(r.datum)}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>{examType}</span></td>
                        <td>{r.ustanovaNaziv || '—'}</td>
                        <td>{r.doktorIme || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>✏️</button>
                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(r.id)}>🗑️</button>
                          </div>
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
        <h1 style={{ margin: 0 }}>🩺 {editingId ? (lang === 'bs' ? 'Uredi uputnicu RA-1' : 'Edit RA-1 referral') : (lang === 'bs' ? 'Nova uputnica RA-1' : 'New RA-1 referral')}</h1>
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
                <input className="form-input" type="date" value={formData.datumPregleda} onChange={e => set('datumPregleda', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Sati' : 'Time'}</div>
                <input className="form-input" type="time" value={formData.vrijemePregleda} onChange={e => set('vrijemePregleda', e.target.value)} />
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
                <input className="form-input" type="date" value={formData.posljednjiPregledDatum} onChange={e => set('posljednjiPregledDatum', e.target.value)} />
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
