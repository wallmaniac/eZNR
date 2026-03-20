'use client';
import {  useState, useEffect, useCallback  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {create,  getAll, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import WorkerProfileModal from '@/components/WorkerProfileModal';

export default function InjuryListPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();
  const [injuries, setInjuries] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionMenuId, setActionMenuId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterTip, setFilterTip] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewWorkerId, setViewWorkerId] = useState(null);

  const loadData = useCallback(() => {
    setInjuries(getAll(COLLECTIONS.INJURIES));
    setWorkers(getAll(COLLECTIONS.WORKERS));
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
    await create(COLLECTIONS.INJURIES, copy);
    loadData();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
      for (let id of selectedIds) await remove(COLLECTIONS.INJURIES, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati ovu prijavu?' : 'Delete this report?'); if (!ok) return;
    remove(COLLECTIONS.INJURIES, id);
    loadData();
  };

  const filtered = injuries.filter(inj => {
    if (filterTip && inj.tip !== filterTip) return false;
    if (filterStatus && inj.status !== filterStatus) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!(inj.radnikIme || '').toLowerCase().includes(q) &&
        !(inj.lokacija || '').toLowerCase().includes(q) &&
        !(inj.opisPovrede || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.datum) - new Date(a.datum));

  const tipBadge = (tip) => {
    const map = {
      laka: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: lang === 'bs' ? 'Laka' : 'Minor' },
      teska: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', label: lang === 'bs' ? 'Teška' : 'Severe' },
      smrtna: { color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', label: lang === 'bs' ? 'Smrtna' : 'Fatal' },
    };
    const s = map[tip] || map.laka;
    return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const statusBadge = (status) => {
    const map = {
      prijavljena: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', label: lang === 'bs' ? 'Prijavljena' : 'Reported' },
      u_obradi: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: lang === 'bs' ? 'U obradi' : 'Processing' },
      zatvorena: { color: '#10B981', bg: 'rgba(16,185,129,0.1)', label: lang === 'bs' ? 'Zatvorena' : 'Closed' },
    };
    const s = map[status] || map.prijavljena;
    return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  // Stats
  const total = injuries.length;
  const teske = injuries.filter(i => i.tip === 'teska').length;
  const smrtne = injuries.filter(i => i.tip === 'smrtna').length;
  const otvorene = injuries.filter(i => i.status !== 'zatvorena').length;

  return (
    <>
      <div className="animate-fadeIn">
        <h1 style={{ marginBottom: 24 }}>🩹 {t('injuryList')}</h1>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: lang === 'bs' ? 'Ukupno' : 'Total', value: total, color: 'var(--primary)' },
            { label: lang === 'bs' ? 'Teške' : 'Severe', value: teske, color: '#EF4444' },
            { label: lang === 'bs' ? 'Smrtne' : 'Fatal', value: smrtne, color: '#7C3AED' },
            { label: lang === 'bs' ? 'Otvorene' : 'Open', value: otvorene, color: '#F59E0B' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center' }}>
              <div className="card-body" style={{ padding: '16px 12px' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-body">
            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ maxWidth: 260 }}
                placeholder={lang === 'bs' ? '🔍 Pretraži...' : '🔍 Search...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select className="form-select" style={{ maxWidth: 160 }} value={filterTip} onChange={e => setFilterTip(e.target.value)}>
                <option value="">{lang === 'bs' ? 'Svi tipovi' : 'All types'}</option>
                <option value="laka">{lang === 'bs' ? 'Laka' : 'Minor'}</option>
                <option value="teska">{lang === 'bs' ? 'Teška' : 'Severe'}</option>
                <option value="smrtna">{lang === 'bs' ? 'Smrtna' : 'Fatal'}</option>
              </select>
              <select className="form-select" style={{ maxWidth: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">{lang === 'bs' ? 'Svi statusi' : 'All statuses'}</option>
                <option value="prijavljena">{lang === 'bs' ? 'Prijavljena' : 'Reported'}</option>
                <option value="u_obradi">{lang === 'bs' ? 'U obradi' : 'Processing'}</option>
                <option value="zatvorena">{lang === 'bs' ? 'Zatvorena' : 'Closed'}</option>
              </select>
              
            {selectedIds.size > 0 && (
              <span style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedIds.size > 0 && (
                <span style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'}
                </span>
              )}
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {records.length} {lang === 'bs' ? 'zapisa' : 'records'}
              </span>
              <div style={{ position: 'relative' }}>
                <button className="btn btn-dark" onClick={() => setShowGroupMenu(v => !v)}>{lang === 'bs' ? 'Grupne akcije' : 'Group actions'} ▼</button>
                {showGroupMenu && (
                  <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setShowGroupMenu(false); }} />
                  <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', minWidth: 230, zIndex: 9999, display: 'block' }}>
                    <div style={{ padding: '6px 14px 4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {selectedIds.size > 0 ? `${selectedIds.size} ${lang === 'bs' ? 'odabrano' : 'selected'}` : (lang === 'bs' ? 'Odaberite stavke' : 'Select items first')}
                    </div>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={() => { setShowGroupMenu(false); window.print(); }}>🖨️ {lang === 'bs' ? 'Ispiši odabrane' : 'Print selected'}</button>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ color: selectedIds.size > 0 ? 'var(--danger)' : 'var(--text-muted)', opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={() => { setShowGroupMenu(false); handleDeleteSelected(); }}>🗑️ {lang === 'bs' ? `Obriši odabrane (${selectedIds.size})` : `Delete selected (${selectedIds.size})`}</button>
                  </div>
                  </>
                )}
              </div>
            </div>
            </div>

            <div className="data-table-wrapper" style={{ overflow: 'visible', position: 'relative' }}>
              <table className="data-table" style={{ overflow: 'visible' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                    <th>{t('actions')}</th>
                    <th>{t('worker')}</th>
                    <th>{t('date')}</th>
                    <th>{lang === 'bs' ? 'Tip' : 'Type'}</th>
                    <th>{t('location')}</th>
                    <th>{lang === 'bs' ? 'Opis' : 'Description'}</th>
                    <th>{lang === 'bs' ? 'Prva pomoć' : 'First aid'}</th>
                    <th>{lang === 'bs' ? 'Bolovanje' : 'Sick leave'}</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody style={{ overflow: 'visible' }}>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        {injuries.length === 0
                          ? (lang === 'bs' ? '✅ Nema prijavljenih povreda' : '✅ No reported injuries')
                          : t('noRecords')}
                      </td>
                    </tr>
                  ) : filtered.map((inj, idx) => (
                    <tr key={inj.id}
                      onClick={() => router.push(`/dashboard/injuries?editId=${inj.id}`)}
                      style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                                                                  <td style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === r.id ? null : r.id); }}>{lang === 'bs' ? 'Akcije' : 'Actions'} ▼</button>
                        {actionMenuId === r.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, zIndex: 999, display: 'block' }}>
                            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}>✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(r); }}>📋 {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}</button>
                            <div className="dropdown-divider" />
                            <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(r.id); }}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                          </div>
                          </>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { if (inj.radnikId) router.push('/dashboard/workers?openWorker=' + inj.radnikId); }}
                          style={{ background: 'none', border: 'none', cursor: inj.radnikId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: inj.radnikId ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                          title={inj.radnikId ? (lang === 'bs' ? 'Klikni za pregled profila' : 'Click to view profile') : ''}
                        >{inj.radnikIme || '—'}</button>
                      </td>
                      <td>{inj.datum ? new Date(inj.datum).toLocaleDateString(lang === 'bs' ? 'bs-BA' : 'en-GB') : '—'}</td>
                      <td>{tipBadge(inj.tip)}</td>
                      <td>{inj.lokacija || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inj.opisPovrede || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{inj.prvaPomoć ? '✅' : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{inj.bolovanje ? '✅' : '—'}</td>
                      <td>{statusBadge(inj.status)}</td>
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
