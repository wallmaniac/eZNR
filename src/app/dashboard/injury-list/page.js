'use client';
import {  useState, useEffect, useCallback  } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {create,  getAll, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import WorkerProfileModal from '@/components/WorkerProfileModal';

export default function InjuryListPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { alert, confirm, DialogRenderer } = useDialog();
  const [injuries, setInjuries] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterTip, setFilterTip] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewWorkerId, setViewWorkerId] = useState(null);

  const loadData = useCallback(() => {
    setInjuries(getAll(COLLECTIONS.INJURIES));
    setWorkers(getAll(COLLECTIONS.WORKERS));
  }, []);


  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(filtered.map(x => x.id)));
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
    if (await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
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

  const handleEdit = (inj) => {
    router.push('/dashboard/injuries?editId=' + inj.id);
  };

  const getWorkerName = (id) => {
    const w = workers.find(x => x.id === id);
    return w ? `${w.ime} ${w.prezime}` : '—';
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
  });

  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'datum', 'desc');

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
      <DialogRenderer />
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
              <div className="search-bar" style={{ flex: 1, maxWidth: 300, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                <input
                  placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
                />
                {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
              </div>
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
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} {lang === 'bs' ? 'zapisa' : 'records'}</span>}
            </div>

            <div className="data-table-wrapper">
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={e => { if (e.target.checked) setSelectedIds(new Set(sorted.map(x => x.id))); else setSelectedIds(new Set()); }} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                    <th style={{ width: 90 }}>{t('actions')}</th>
                    <th onClick={() => toggleSort('oznaka')} style={thStyle('oznaka')}>{lang === 'bs' ? 'Oznaka' : 'ID'}{sortIcon('oznaka')}</th>
                    <th onClick={() => toggleSort('radnikIme')} style={thStyle('radnikIme')}>{lang === 'bs' ? 'Radnik' : 'Worker'}{sortIcon('radnikIme')}</th>
                    <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum dog.' : 'Date'}{sortIcon('datum')}</th>
                    <th>{lang === 'bs' ? 'Ime roditelja' : 'Parent name'}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sorted.map((r) => {
                    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };
                    return (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
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
                              <button onClick={() => { setActionMenuId(null); handleDuplicate(r); }} style={menuItemSt}>📋 Kopiraj</button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => { setActionMenuId(null); handleDelete(r.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Izbriši</button>
                            </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.oznaka || '—'}</td>
                      <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', background: 'none', color: 'var(--text)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.radnikId); }}>{getWorkerName(r.radnikId)}</button></td>
                      <td>{formatDate(r.datum)}</td>
                      <td>{r.imeOca || '—'}</td>
                    </tr>
                    );
                  })}
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
    </>
  );
}
