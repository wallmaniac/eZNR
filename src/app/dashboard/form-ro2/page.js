'use client';
import { createPortal } from 'react-dom';
import {  useState, useEffect, useCallback  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

const EMPTY_RO2 = {
  workerId: '',
  broj: '',
  datum: todayISO(),
  // RO-2 specifics
  clanak3Tocke: '',
  datumOcjene: '',
  nijeMijenjaoRadnoMjesto: true, // Da/Ne — default Ne (true = hasn't changed)
  radniStazNaRadnomMjestu: '',
};

export default function FormRO2Page() {
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
  const [formData, setFormData] = useState({ ...EMPTY_RO2 });

  const loadData = useCallback(() => {
    setRecords(getAll(COLLECTIONS.FORMS_RO2));
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
    await create(COLLECTIONS.FORMS_RO2, copy);
    loadData();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.FORMS_RO2, id);
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
    setFormData({ ...EMPTY_RO2, datum: todayISO() });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({ ...EMPTY_RO2, ...item });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati uputnicu?' : 'Delete referral?');
    if (ok) { remove(COLLECTIONS.FORMS_RO2, id); loadData(); }
  };

  const handleSave = async () => {
    if (!formData.workerId) {
      await alert(lang === 'bs' ? 'Odaberite radnika!' : 'Select a worker!');
      return;
    }
    if (editingId) {
      update(COLLECTIONS.FORMS_RO2, editingId, formData);
    } else {
      create(COLLECTIONS.FORMS_RO2, formData);
    }
    setShowForm(false);
    loadData();
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
  const checkLabel = {
    display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.84rem',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  // ── List view ──
  if (!showForm) {
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>📄 {t('formRO2')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleNew}>
              + {lang === 'bs' ? 'Nova uputnica RO-2' : 'New RO-2 referral'}
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
                    <th>{lang === 'bs' ? 'Čl.3 točke' : 'Art.3 point'}</th>
                    <th>{lang === 'bs' ? 'Radni staž' : 'Experience'}</th>
                    <th>{lang === 'bs' ? 'Promjena RM' : 'Changed pos.'}</th>
                    
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : records.map((r, idx) => (
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
                      <td>{r.clanak3Tocke || '—'}</td>
                      <td>{r.radniStazNaRadnomMjestu || '—'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                          background: r.nijeMijenjaoRadnoMjesto ? 'rgba(76,175,80,0.12)' : '#FBE9E7',
                          color: r.nijeMijenjaoRadnoMjesto ? 'var(--success)' : 'var(--danger)',
                        }}>{r.nijeMijenjaoRadnoMjesto ? 'Ne' : 'Da'}</span>
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

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => setShowForm(false)}>←</button>
        <h1 style={{ margin: 0 }}>📄 {editingId ? (lang === 'bs' ? 'Uredi uputnicu RO-2' : 'Edit RO-2') : (lang === 'bs' ? 'Nova uputnica RO-2' : 'New RO-2')}</h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: Worker & General ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>
              {lang === 'bs'
                ? 'Uputnice za provjeru radne sposobnosti radnika na radnom mjestu s posebnim uvjetima rada (Obrazac RO-2)'
                : 'Referral for verifying worker fitness at workplace with special conditions (Form RO-2)'}
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

            {/* Worker auto-filled details */}
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

        {/* ═══ SECTION 2: RO-2 Specifics ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>RO-2</div>

            {/* Čl.3 točke */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.84rem' }}>
                <span style={{ fontWeight: 600 }}>
                  {lang === 'bs' ? 'Radno mjesto s posebnim uvjetima prema čl3, točke' : 'Workplace with special conditions per art.3, points'}
                </span>
                <input className="form-input" style={{ width: 100 }} value={formData.clanak3Tocke} onChange={e => set('clanak3Tocke', e.target.value)} />
                <span style={{ color: 'var(--text-muted)' }}>
                  {lang === 'bs' ? 'Pravilnika o poslovima s posebnim uvjetima rada.' : 'of the Regulation on special working conditions.'}
                </span>
              </div>
            </div>

            {/* Last assessment */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.84rem' }}>
                <span style={{ fontWeight: 600 }}>
                  {lang === 'bs' ? 'Od posljednje ocjene radne sposobnosti dne:' : 'Since last fitness assessment on:'}
                </span>
                <input className="form-input" type="date" style={{ width: 180 }} value={formData.datumOcjene} onChange={e => set('datumOcjene', e.target.value)} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {lang === 'bs'
                    ? 'radnik nije mijenjao radno mjesto odnosno nisu promijenjeni uvjeti rada na tim poslovima'
                    : 'worker has not changed workplace nor have the working conditions changed'}
                </span>
                <label style={checkLabel}>
                  <input type="radio" name="nijeMijenjao" checked={formData.nijeMijenjaoRadnoMjesto === false} onChange={() => set('nijeMijenjaoRadnoMjesto', false)} /> Da
                </label>
                <label style={checkLabel}>
                  <input type="radio" name="nijeMijenjao" checked={formData.nijeMijenjaoRadnoMjesto === true} onChange={() => set('nijeMijenjaoRadnoMjesto', true)} /> Ne
                </label>
              </div>
            </div>

            {/* Radni staž */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}>
                <span style={{ fontWeight: 600 }}>
                  {lang === 'bs' ? 'Radni staž na radnom mjestu koji obavlja:' : 'Work experience in current position:'}
                </span>
                <input className="form-input" style={{ width: 140 }} value={formData.radniStazNaRadnomMjestu} onChange={e => set('radniStazNaRadnomMjestu', e.target.value)} />
              </div>
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
