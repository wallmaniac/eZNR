'use client';
import {  useState, useEffect, useCallback  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_RO1 });

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

  useEffect(() => {
    const handler = () => setActionMenuId(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
            <div style={{ position: 'relative' }}>
              <button className="btn btn-dark btn-sm" onClick={() => {
                const el = document.getElementById('group-menu-ro1');
                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
              }}>{lang === 'bs' ? 'Grupne akcije' : 'Group actions'} ▼</button>
              <div id="group-menu-ro1" className="dropdown-menu" style={{ display: 'none', right: 0, top: 'calc(100% + 4px)', minWidth: 230, zIndex: 999 }}>
                <div style={{ padding: '6px 14px 4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {selectedIds.size > 0 ? `${selectedIds.size} ${lang === 'bs' ? 'odabrano' : 'selected'}` : (lang === 'bs' ? 'Odaberite stavke' : 'Select items first')}
                </div>
                <div className="dropdown-divider" />
                <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={() => { document.getElementById('group-menu-ro1').style.display = 'none'; window.print(); }}>🖨️ {lang === 'bs' ? 'Ispiši odabrane' : 'Print selected'}</button>
                <div className="dropdown-divider" />
                <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ color: selectedIds.size > 0 ? 'var(--danger)' : 'var(--text-muted)', opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={() => { document.getElementById('group-menu-ro1').style.display = 'none'; handleDeleteSelected(); }}>🗑️ {lang === 'bs' ? `Obriši odabrane (${selectedIds.size})` : `Delete selected (${selectedIds.size})`}</button>
              </div>
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {records.length} {lang === 'bs' ? 'zapisa' : 'records'}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper" style={{ overflow: 'visible', position: 'relative' }}>
              <table className="data-table" style={{ overflow: 'visible' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Pravilnik' : 'Regulation'}</th>
                    
                  </tr>
                </thead>
                <tbody style={{ overflow: 'visible' }}>
                  {records.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : records.map((r, idx) => (
                    <tr key={r.id}>
                      <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                      <td style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === r.id ? null : r.id); }}>{lang === 'bs' ? 'Akcije' : 'Actions'} ▼</button>
                        {actionMenuId === r.id && (
                          <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, zIndex: 999, display: 'block' }}>
                            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}>✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(r); }}>📋 {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}</button>
                            <div className="dropdown-divider" />
                            <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(r.id); }}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                          </div>
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
