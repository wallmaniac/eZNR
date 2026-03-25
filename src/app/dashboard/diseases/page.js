'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

const EMPTY_FORM = {
  radnikId: '', radnikIme: '',
  datum: '', dijagnoza: '', uzrok: '',
  opis: '', bolovanje: false, status: 'prijavljena',
};

export default function DiseasesPage() {
  const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { showFlash, SavedFlash } = useSavedFlash();
  const { markDirty, markClean } = useUnsavedChanges();

  const [diseases, setDiseases] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewWorkerId, setViewWorkerId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const [workerSearch, setWorkerSearch] = useState('');
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
  const workerRef = useRef(null);

  const loadData = useCallback(() => {
    setDiseases(getAll(COLLECTIONS.DISEASES));
    setWorkers(getAll(COLLECTIONS.WORKERS));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = (e) => {
      if (workerRef.current && !workerRef.current.contains(e.target)) {
        setShowWorkerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const set = (k, v) => { setFormData(f => ({ ...f, [k]: v })); markDirty(); };

  const filteredWorkers = workers.filter(w => {
    if (!workerSearch) return true;
    const q = workerSearch.toLowerCase();
    return `${w.ime} ${w.prezime}`.toLowerCase().includes(q) ||
      (w.evidencijskiBroj || '').toLowerCase().includes(q);
  });

  const handleWorkerSelect = (w) => {
    set('radnikId', w.id);
    set('radnikIme', `${w.ime} ${w.prezime}`);
    setWorkerSearch(`${w.ime} ${w.prezime}`);
    setShowWorkerDropdown(false);
  };

  const openNew = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setWorkerSearch('');
    setShowForm(true);
  };

  const openEdit = (d) => {
    setEditingId(d.id);
    setFormData({ ...d });
    setWorkerSearch(d.radnikIme || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.radnikId && !formData.radnikIme) {
      await alert(lang === 'bs' ? 'Odaberite radnika!' : 'Please select a worker!');
      return;
    }
    if (!formData.datum) {
      await alert(lang === 'bs' ? 'Datum je obavezan!' : 'Date is required!');
      return;
    }
    if (editingId) {
      update(COLLECTIONS.DISEASES, editingId, formData);
    } else {
      create(COLLECTIONS.DISEASES, formData);
    }
    loadData();
    markClean();
    setShowForm(false);
    showFlash();
  };

  const handleDelete = async (id) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati ovaj zapis?' : 'Delete this record?'); if (!ok) return;
    remove(COLLECTIONS.DISEASES, id);
    loadData();
  };

  const filtered = diseases.filter(d => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (d.radnikIme || '').toLowerCase().includes(q) ||
      (d.dijagnoza || '').toLowerCase().includes(q) ||
      (d.uzrok || '').toLowerCase().includes(q);
  });

  const statusBadge = (status) => {
    const map = {
      prijavljena: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', label: lang === 'bs' ? 'Prijavljena' : 'Reported' },
      u_obradi: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: lang === 'bs' ? 'U obradi' : 'Processing' },
      zatvorena: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: lang === 'bs' ? 'Zatvorena' : 'Closed' },
    };
    const s = map[status] || map.prijavljena;
    return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <>
      <div className="animate-fadeIn">
        <h1 style={{ marginBottom: 24 }}>🏥 {t('diseaseReport')}</h1>

        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🏥 {editingId ? (lang === 'bs' ? 'Uredi zapis' : 'Edit record') : t('diseaseReport')}</h2>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                  {/* Worker picker */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }} ref={workerRef}>
                    <label className="form-label">{t('worker')} *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        placeholder={lang === 'bs' ? '🔍 Pretraži radnika...' : '🔍 Search worker...'}
                        value={workerSearch}
                        onChange={e => { setWorkerSearch(e.target.value); setShowWorkerDropdown(true); set('radnikId', ''); set('radnikIme', ''); }}
                        onFocus={() => setShowWorkerDropdown(true)}
                        autoComplete="off"
                      />
                      {showWorkerDropdown && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                          zIndex: 100, maxHeight: 220, overflowY: 'auto',
                        }}>
                          {filteredWorkers.length === 0 ? (
                            <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                              {lang === 'bs' ? 'Nema radnika' : 'No workers found'}
                            </div>
                          ) : filteredWorkers.map(w => (
                            <button key={w.id}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-light)' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              onClick={() => handleWorkerSelect(w)}
                            >
                              <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                                {w.ime?.[0]}{w.prezime?.[0]}
                              </span>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>{w.ime} {w.prezime}</div>
                                {w.evidencijskiBroj && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ev. br: {w.evidencijskiBroj}</div>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {formData.radnikId && (
                      <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                        ✓ {lang === 'bs' ? 'Odabrano' : 'Selected'}: {formData.radnikIme}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('date')} *</label>
                    <input className="form-input" type="date" value={formData.datum} onChange={e => set('datum', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'bs' ? 'Status' : 'Status'}</label>
                    <select className="form-select" value={formData.status} onChange={e => set('status', e.target.value)}>
                      <option value="prijavljena">{lang === 'bs' ? 'Prijavljena' : 'Reported'}</option>
                      <option value="u_obradi">{lang === 'bs' ? 'U obradi' : 'Processing'}</option>
                      <option value="zatvorena">{lang === 'bs' ? 'Zatvorena' : 'Closed'}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'bs' ? 'Dijagnoza' : 'Diagnosis'}</label>
                    <input className="form-input" value={formData.dijagnoza} onChange={e => set('dijagnoza', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{lang === 'bs' ? 'Uzrok' : 'Cause'}</label>
                    <input className="form-input" value={formData.uzrok} onChange={e => set('uzrok', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">{t('description')}</label>
                    <textarea className="form-input" rows={3} value={formData.opis} onChange={e => set('opis', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="checkbox" id="bolovanjeD" checked={formData.bolovanje} onChange={e => set('bolovanje', e.target.checked)} style={{ width: 16, height: 16 }} />
                    <label htmlFor="bolovanjeD" style={{ cursor: 'pointer', fontWeight: 500 }}>{lang === 'bs' ? 'Bolovanje' : 'Sick leave'}</label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={openNew}>+ {t('add')}</button>
              <SavedFlash />
              <input
                className="form-input"
                style={{ maxWidth: 280 }}
                placeholder={lang === 'bs' ? '🔍 Pretraži...' : '🔍 Search...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {filtered.length} {lang === 'bs' ? 'zapisa' : 'records'}
              </span>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('actions')}</th>
                    <th>{t('worker')}</th>
                    <th>{t('date')}</th>
                    <th>{lang === 'bs' ? 'Dijagnoza' : 'Diagnosis'}</th>
                    <th>{lang === 'bs' ? 'Uzrok' : 'Cause'}</th>
                    <th>{lang === 'bs' ? 'Bolovanje' : 'Sick leave'}</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : filtered.map(d => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(d)}>✏️</button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(d.id)}>🗑️</button>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <button
                          onClick={() => { if (d.radnikId) setViewWorkerId(d.radnikId); }}
                          style={{ background: 'none', border: 'none', cursor: d.radnikId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: d.radnikId ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                          title={d.radnikId ? (lang === 'bs' ? 'Klikni za pregled profila' : 'Click to view profile') : ''}
                        >{d.radnikIme || '—'}</button>
                      </td>
                      <td>{d.datum ? new Date(d.datum).toLocaleDateString(lang === 'bs' ? 'bs-BA' : 'en-GB') : '—'}</td>
                      <td>{d.dijagnoza || '—'}</td>
                      <td>{d.uzrok || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{d.bolovanje ? '✅' : '—'}</td>
                      <td>{statusBadge(d.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {viewWorkerId && (
        <WorkerProfileModal
          workerId={viewWorkerId}
          onClose={() => setViewWorkerId(null)}
          onSaved={() => setViewWorkerId(null)}
        />
      )}
    <DialogRenderer />
    </>
  );
}
