'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

const EMPTY_OIR1 = {
  // Section 1: General
  nadleznoTijelo: '',
  adresaTijela: '',
  dogadjajNastaoU: '',
  datumDogadjaja: todayISO(),
  vrijemeDogadjaja: '',
  // Section 2: Injured workers (up to 5)
  ozlijedjeni: [
    { workerId: '', mjesto: '' },
    { workerId: '', mjesto: '' },
    { workerId: '', mjesto: '' },
    { workerId: '', mjesto: '' },
    { workerId: '', mjesto: '' },
  ],
  // Section 3: Deceased workers (up to 4)
  poginuli: [
    { workerId: '' },
    { workerId: '' },
    { workerId: '' },
    { workerId: '' },
  ],
  // Section 4: Event details
  opisDogadjaja: '',
  rukovoditelj: '',
  primjenjeneMjere: '',
  prisutniZaposlenici: '',
  // Section 5: Filing
  podnositelj: '',
  mjestoPrijave: '',
  datumPrijave: todayISO(),
};

export default function FormOIR1Page() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();

  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_OIR1 });

  const loadData = useCallback(() => {
    setRecords(getAll(COLLECTIONS.FORMS_OIR1));
    setWorkers(getAll(COLLECTIONS.WORKERS));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const setInjured = (idx, field, value) => {
    setFormData(prev => {
      const arr = [...prev.ozlijedjeni];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, ozlijedjeni: arr };
    });
  };

  const setDeceased = (idx, field, value) => {
    setFormData(prev => {
      const arr = [...prev.poginuli];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, poginuli: arr };
    });
  };

  const handleNew = () => {
    setFormData({ ...EMPTY_OIR1, datumDogadjaja: todayISO(), datumPrijave: todayISO() });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({
      ...EMPTY_OIR1,
      ...item,
      ozlijedjeni: item.ozlijedjeni || EMPTY_OIR1.ozlijedjeni,
      poginuli: item.poginuli || EMPTY_OIR1.poginuli,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati obrazac?' : 'Delete form?');
    if (ok) { remove(COLLECTIONS.FORMS_OIR1, id); loadData(); }
  };

  const handleSave = async () => {
    if (editingId) {
      update(COLLECTIONS.FORMS_OIR1, editingId, formData);
    } else {
      create(COLLECTIONS.FORMS_OIR1, formData);
    }
    setShowForm(false);
    loadData();
  };

  const getWorkerName = (id) => {
    const w = workers.find(wk => wk.id === id);
    return w ? `${w.prezime} ${w.ime}` : '—';
  };

  // Gather display names for injured workers
  const getInjuredSummary = (rec) => {
    const names = (rec.ozlijedjeni || [])
      .filter(o => o.workerId)
      .map(o => getWorkerName(o.workerId));
    return names.length > 0 ? names.join(', ') : '—';
  };

  const labelSt = {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
  };
  const sectionTitle = {
    fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
  };

  // ── List view ──
  if (!showForm) {
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>📄 {t('formOIR1')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Novi obrazac' : 'New form'}
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
                    <th>#</th>
                    <th>{lang === 'bs' ? 'Događaj nastao u' : 'Event location'}</th>
                    <th>{lang === 'bs' ? 'Datum događaja' : 'Event date'}</th>
                    <th>{lang === 'bs' ? 'Ozlijeđeni' : 'Injured'}</th>
                    <th>{lang === 'bs' ? 'Podnositelj' : 'Submitter'}</th>
                    <th>{lang === 'bs' ? 'Datum prijave' : 'Filing date'}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : records.map((r, idx) => (
                    <tr key={r.id}>
                      <td>{idx + 1}</td>
                      <td>{r.dogadjajNastaoU || '—'}</td>
                      <td>{formatDate(r.datumDogadjaja)}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getInjuredSummary(r)}</td>
                      <td>{r.podnositelj || '—'}</td>
                      <td>{formatDate(r.datumPrijave)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>✏️</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(r.id)}>🗑️</button>
                        </div>
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
  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>←</button>
        <h1 style={{ margin: 0 }}>📄 {editingId ? (lang === 'bs' ? 'Uredi obrazac OIR-1' : 'Edit OIR-1 form') : (lang === 'bs' ? 'Novi obrazac OIR-1' : 'New OIR-1 form')}</h1>
      </div>
      <DialogRenderer />

      {/* Page title */}
      <div style={{ marginBottom: 20, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {lang === 'bs'
          ? 'OBAVIJEST O DOGAĐAJU NA RADU KOJI JE IZAZVAO SMRT, TEŽU OZLJEDU KAO I OZLJEDU DVAJU ILI VIŠE ZAPOSLENIKA, NEOVISNO O TEŽINI OZLJEDE'
          : 'NOTICE OF WORKPLACE EVENT THAT CAUSED DEATH, SERIOUS INJURY OR INJURY OF TWO OR MORE WORKERS'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: General info ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'Obrazac OIR-1' : 'Form OIR-1'}</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Naziv nadležnog tijela inspekcije rada' : 'Labor inspection authority name'}</div>
              <input className="form-input" value={formData.nadleznoTijelo} onChange={e => set('nadleznoTijelo', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Adresa' : 'Address'}</div>
              <input className="form-input" value={formData.adresaTijela} onChange={e => set('adresaTijela', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Događaj na radu nastao je u' : 'The workplace event occurred in'}</div>
              <input className="form-input" value={formData.dogadjajNastaoU} onChange={e => set('dogadjajNastaoU', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 140px', gap: 12 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Dana (datum)' : 'Date'}</div>
                <input className="form-input" type="date" value={formData.datumDogadjaja} onChange={e => set('datumDogadjaja', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Vrijeme' : 'Time'}</div>
                <input className="form-input" type="time" value={formData.vrijemeDogadjaja} onChange={e => set('vrijemeDogadjaja', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION 2: Injured workers ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'PODACI O OZLIJEĐENIM ZAPOSLENICIMA' : 'INJURED EMPLOYEES DATA'}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              {lang === 'bs'
                ? 'Mjesto i adresa gdje se ozlijeđeni nalaze poslije događaja na radu'
                : 'Location and address where injured workers are after the event'}
            </div>

            {formData.ozlijedjeni.map((o, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>OR{idx + 1}:</div>
                <select className="form-select" value={o.workerId} onChange={e => setInjured(idx, 'workerId', e.target.value)}>
                  <option value="">{lang === 'bs' ? 'Odaberite OR obrazac' : 'Select OR form'}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime} {w.oib ? `(${w.oib})` : ''}</option>
                  ))}
                </select>
                <input className="form-input" placeholder={lang === 'bs' ? 'Mjesto/adresa nakon događaja' : 'Location after event'}
                  value={o.mjesto} onChange={e => setInjured(idx, 'mjesto', e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* ═══ SECTION 3: Deceased workers ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'PODACI O POGINULIM ZAPOSLENICIMA' : 'DECEASED EMPLOYEES DATA'}</div>

            {formData.poginuli.map((p, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>OR{idx + 1}:</div>
                <select className="form-select" value={p.workerId} onChange={e => setDeceased(idx, 'workerId', e.target.value)}>
                  <option value="">{lang === 'bs' ? 'Odaberite OR obrazac' : 'Select OR form'}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime} {w.oib ? `(${w.oib})` : ''}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ SECTION 4: Event description ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'Detalji događaja' : 'Event details'}</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Opis događaja' : 'Event description'}</div>
              <textarea className="form-input" rows={5} value={formData.opisDogadjaja} onChange={e => set('opisDogadjaja', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Rukovoditelj' : 'Manager'}</div>
              <textarea className="form-input" rows={3} value={formData.rukovoditelj} onChange={e => set('rukovoditelj', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Primjenjene mjere' : 'Applied measures'}</div>
              <textarea className="form-input" rows={3} value={formData.primjenjeneMjere} onChange={e => set('primjenjeneMjere', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Prisutni zaposlenici' : 'Present employees (witnesses)'}</div>
              <textarea className="form-input" rows={3} value={formData.prisutniZaposlenici} onChange={e => set('prisutniZaposlenici', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ═══ SECTION 5: Filing ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'Podnositelj prijave' : 'Filing information'}</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{lang === 'bs' ? 'Podnositelj' : 'Submitter'}</div>
              <input className="form-input" value={formData.podnositelj} onChange={e => set('podnositelj', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Mjesto prijave' : 'Filing location'}</div>
                <input className="form-input" value={formData.mjestoPrijave} onChange={e => set('mjestoPrijave', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Datum prijave' : 'Filing date'}</div>
                <input className="form-input" type="date" value={formData.datumPrijave} onChange={e => set('datumPrijave', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Action buttons ═══ */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              💾 {lang === 'bs' ? 'Snimi obrazac' : 'Save form'}
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
