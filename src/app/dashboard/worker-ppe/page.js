'use client';
import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, COLLECTIONS, formatDate, todayISO } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { logPPEAssigned } from '@/lib/activityLog';
import { useSortedList } from '@/hooks/useSortedList';

export default function WorkerPPEPage() {
  const { t, lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewWorkerId, setViewWorkerId] = useState(null);

  // ── "Dodaj novu opremu" modal state ──
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
  const [saving, setSaving] = useState(false);

  const [assignments, setAssignments] = useState(() => getAll(COLLECTIONS.PPE_ASSIGNMENTS));
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);

  const rows = useMemo(() => {
    return assignments.map(a => {
      const w = workers.find(x => x.id === a.workerId);
      return { ...a, workerName: w ? `${w.ime} ${w.prezime}` : '-', workerId: a.workerId };
    }).filter(r => !searchTerm || r.workerName.toLowerCase().includes(searchTerm.toLowerCase()) || (r.naziv || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [assignments, workers, searchTerm]);
  const { sorted: sortedRows, toggleSort: tPPE, sortIcon: siPPE, thStyle: tsPPE } = useSortedList(rows, 'workerName');

  const handleSave = () => {
    if (!addForm.workerId || !addForm.naziv.trim()) return;
    setSaving(true);
    const saved = create(COLLECTIONS.PPE_ASSIGNMENTS, {
      workerId: addForm.workerId,
      naziv: addForm.naziv.trim(),
      datumZaduzenja: addForm.datumZaduzenja || todayISO(),
      kolicina: addForm.kolicina || 1,
      datumRazduzenja: '',
    });
    // Log to activity log
    const w = workers.find(x => x.id === addForm.workerId);
    const workerName = w ? `${w.ime} ${w.prezime}` : '';
    try { logPPEAssigned(saved, workerName, null); } catch { }
    setAssignments(getAll(COLLECTIONS.PPE_ASSIGNMENTS));
    setShowAddModal(false);
    setAddForm({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
    setSaving(false);
  };

  const openModal = () => {
    setAddForm({ workerId: '', naziv: '', datumZaduzenja: todayISO(), kolicina: 1 });
    setShowAddModal(true);
  };

  const clickableName = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' };
  const clickableNaziv = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 500, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--primary)' };

  return (
    <>
      <div className="animate-fadeIn">
        <h1 style={{ marginBottom: 24 }}>🦺 {t('workerPPE')}</h1>
        <div className="card"><div className="card-body">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: 400 }}>
              <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{rows.length} {t('records')}</span>
            <button className="btn btn-primary btn-sm" onClick={openModal} style={{ marginLeft: 'auto' }}>
              + {lang === 'bs' ? 'Dodaj novu opremu' : 'Add new equipment'}
            </button>
          </div>
          <div className="data-table-wrapper"><table className="data-table"><thead><tr>
            <th style={tsPPE('workerName')} onClick={() => tPPE('workerName')}>{t('worker')}{siPPE('workerName')}</th>
            <th style={tsPPE('naziv')} onClick={() => tPPE('naziv')}>{t('name')}{siPPE('naziv')}</th>
            <th style={tsPPE('datumZaduzenja')} onClick={() => tPPE('datumZaduzenja')}>{t('assignmentDate')}{siPPE('datumZaduzenja')}</th>
            <th style={tsPPE('kolicina')} onClick={() => tPPE('kolicina')}>{lang === 'bs' ? 'Količina' : 'Quantity'}{siPPE('kolicina')}</th>
          </tr></thead><tbody>
              {sortedRows.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr> : sortedRows.map((r, idx) => (
                <tr key={r.id || idx}>
                  <td>
                    <button style={clickableName} onClick={() => { if (r.workerId) setViewWorkerId(r.workerId); }} title={lang === 'bs' ? 'Klikni za pregled profila radnika' : 'Click to view worker profile'}>
                      {r.workerName}
                    </button>
                  </td>
                  <td>
                    <button style={clickableNaziv} onClick={() => { if (r.workerId) setViewWorkerId(r.workerId); }} title={lang === 'bs' ? 'Klikni za pregled OZO zaduženja radnika' : 'Click to view worker PPE assignments'}>
                      🦺 {r.naziv}
                    </button>
                  </td>
                  <td>{formatDate(r.datumZaduzenja)}</td>
                  <td>{r.kolicina ?? 1}</td>
                </tr>
              ))}
            </tbody></table></div>
        </div></div>
      </div>

      {/* ── Add New PPE Modal ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)} style={{ zIndex: 200 }}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <h2 style={{ color: 'white' }}>🦺 {lang === 'bs' ? 'Dodaj osobnu zaštitnu opremu' : 'Add personal protective equipment'}</h2>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">👤 {lang === 'bs' ? 'Radnik *' : 'Worker *'}</label>
                <select className="form-select" value={addForm.workerId} onChange={e => setAddForm(f => ({ ...f, workerId: e.target.value }))}>
                  <option value="">{lang === 'bs' ? '— Odaberi radnika —' : '— Select worker —'}</option>
                  {workers.filter(w => w.aktivan).map(w => (
                    <option key={w.id} value={w.id}>{w.ime} {w.prezime}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">🦺 {lang === 'bs' ? 'Naziv opreme *' : 'Equipment name *'}</label>
                <input className="form-input" value={addForm.naziv} onChange={e => setAddForm(f => ({ ...f, naziv: e.target.value }))} placeholder={lang === 'bs' ? 'npr. Zaštitne rukavice, Kaska...' : 'e.g. Safety gloves, Hard hat...'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">📅 {lang === 'bs' ? 'Datum zaduženja' : 'Assignment date'}</label>
                  <input className="form-input" type="date" value={addForm.datumZaduzenja} onChange={e => setAddForm(f => ({ ...f, datumZaduzenja: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{lang === 'bs' ? 'Količina' : 'Quantity'}</label>
                  <input className="form-input" type="number" min="1" value={addForm.kolicina} onChange={e => setAddForm(f => ({ ...f, kolicina: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!addForm.workerId || !addForm.naziv.trim() || saving}>
                {saving ? '⏳' : '💾'} {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewWorkerId && (
        <WorkerProfileModal
          workerId={viewWorkerId}
          onClose={() => setViewWorkerId(null)}
          onSaved={() => setViewWorkerId(null)}
        />
      )}
    </>
  );
}
