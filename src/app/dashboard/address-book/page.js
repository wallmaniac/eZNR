'use client';
import { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, getOrgUnitName, getWorkplaceName } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useSortedList } from '@/hooks/useSortedList';
import PageHeader from '@/components/PageHeader';

export default function AddressBookPage() {
  const [copyToast, setCopyToast] = useState(false);
  const { t, lang } = useLanguage();
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false), []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [viewWorkerId, setViewWorkerId] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(null);
  const [actionMenu, setActionMenu] = useState(false);

  const filtered = useMemo(() => {
    if (!searchTerm) return workers;
    const q = searchTerm.toLowerCase();
    return workers.filter(w =>
      `${w.ime} ${w.prezime}`.toLowerCase().includes(q) ||
      (w.email || '').toLowerCase().includes(q) ||
      (w.mobitel || '').toLowerCase().includes(q) ||
      getOrgUnitName(w.orgJedinicaId).toLowerCase().includes(q)
    );
  }, [workers, searchTerm]);

  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filtered, 'prezime');

  // Selection helpers
  const allSelected = sorted.length > 0 && sorted.every(w => selected.has(w.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map(w => w.id)));
  };
  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Copy email to clipboard
  const copyEmail = useCallback((email, id) => {
    if (!email) return;
    navigator.clipboard.writeText(email).then(() => {
      setCopiedEmail(id);
      setTimeout(() => setCopiedEmail(null), 2000);
    });
  }, []);

  // Build mailto: with selected or all emails
  const openOutlook = (all = false) => {
    const targets = all
      ? sorted.filter(w => w.email)
      : sorted.filter(w => selected.has(w.id) && w.email);
    if (targets.length === 0) return;
    const emails = targets.map(w => w.email).join(';');
    window.open(`mailto:${emails}`, '_blank');
  };

  const copyAllEmails = () => {
    const emails = sorted.filter(w => w.email).map(w => w.email).join(', ');
    navigator.clipboard.writeText(emails).then(() => { setCopyToast(true); setTimeout(() => setCopyToast(false), 2500); });
  };

  const exportCSV = () => {
    const header = 'Ime,Prezime,Email,Mobitel,Org. jedinica,Radno mjesto\n';
    const rows = sorted.map(w =>
      `"${w.ime}","${w.prezime}","${w.email || ''}","${w.mobitel || ''}","${getOrgUnitName(w.orgJedinicaId)}","${getWorkplaceName ? getWorkplaceName(w.radnoMjestoId) || '' : ''}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'adresar.csv'; a.click();
  };

  const selectedCount = selected.size;

  return (
    <>
      <div className="animate-fadeIn">
        {copyToast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: 'var(--primary)', color: 'white', padding: '12px 20px', borderRadius: 10, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', animation: 'fadeIn 0.2s' }}>
          ✅ {lang === 'bs' ? 'Sve email adrese kopirane!' : 'All emails copied!'}
        </div>
      )}
      <PageHeader icon="📒" title={t('addressBook')} subtitle={`${sorted.length} ${lang === 'bs' ? 'zapisa' : 'records'}`} />
        <div className="card"><div className="card-body">

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Akcije dropdown */}
            <div style={{ position: 'relative' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setActionMenu(m => !m)}>
                ⚡ {lang === 'bs' ? 'Akcije' : 'Actions'} ▼
              </button>
              {actionMenu && (
                <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 260, zIndex: 100 }}
                  onMouseLeave={() => setActionMenu(false)}>
                  <button className="dropdown-item" onClick={() => { openOutlook(false); setActionMenu(false); }}
                    disabled={selectedCount === 0} style={{ opacity: selectedCount === 0 ? 0.45 : 1 }}>
                    ✉️ {lang === 'bs' ? `Email odabranima (${selectedCount})` : `Email selected (${selectedCount})`}
                  </button>
                  <button className="dropdown-item" onClick={() => { openOutlook(true); setActionMenu(false); }}>
                    📨 {lang === 'bs' ? 'Email svim radnicima' : 'Email all workers'}
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => { copyAllEmails(); setActionMenu(false); }}>
                    📋 {lang === 'bs' ? 'Kopiraj sve email adrese' : 'Copy all emails'}
                  </button>
                  <button className="dropdown-item" onClick={() => { exportCSV(); setActionMenu(false); }}>
                    📥 {lang === 'bs' ? 'Izvezi u CSV' : 'Export to CSV'}
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => { setSelected(new Set(sorted.map(w => w.id))); setActionMenu(false); }}>
                    ☑️ {lang === 'bs' ? 'Odaberi sve' : 'Select all'}
                  </button>
                  <button className="dropdown-item" onClick={() => { setSelected(new Set()); setActionMenu(false); }}>
                    ⬜ {lang === 'bs' ? 'Poništi odabir' : 'Deselect all'}
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="search-bar" style={{ flex: 1, maxWidth: 400, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
              <input
                placeholder={lang === 'bs' ? 'Pretraži po imenu, emailu, org. jed...' : 'Search by name, email, org unit...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
            </div>

            {/* Selected badge */}
            {selectedCount > 0 && (
              <span className="badge badge-primary" style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                {selectedCount} {lang === 'bs' ? 'odabrano' : 'selected'}
              </span>
            )}

            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto' }}>
              {sorted.length} {t('records')}
            </span>
          </div>

          <div className="data-table-wrapper"><table className="data-table"><thead><tr>
            <th style={{ width: 36 }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} title={lang === 'bs' ? 'Odaberi sve' : 'Select all'} />
            </th>
            <th style={thStyle('ime')} onClick={() => toggleSort('ime')}>{t('workerName')}{sortIcon('ime')}</th>
            <th style={thStyle('prezime')} onClick={() => toggleSort('prezime')}>{t('workerSurname')}{sortIcon('prezime')}</th>
            <th style={thStyle('orgJedinicaId')} onClick={() => toggleSort('orgJedinicaId')}>{t('orgUnit')}{sortIcon('orgJedinicaId')}</th>
            <th style={thStyle('mobitel')} onClick={() => toggleSort('mobitel')}>{t('mobilePhone')}{sortIcon('mobitel')}</th>
            <th>{t('email')}</th>
            <th style={thStyle('ulica')} onClick={() => toggleSort('ulica')}>{t('address')}{sortIcon('ulica')}</th>
          </tr></thead><tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
              ) : sorted.map(w => (
                <tr key={w.id}
                  onClick={() => setViewWorkerId(w.id)}
                  style={{ cursor: 'pointer', background: selected.has(w.id) ? 'var(--bg-table-row-hover)' : undefined, transition: 'background 0.12s' }}
                  onMouseEnter={e => { if (!selected.has(w.id)) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                  onMouseLeave={e => { if (!selected.has(w.id)) e.currentTarget.style.background = ''; }}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleOne(w.id)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{w.ime}</td>
                  <td style={{ fontWeight: 600 }}>{w.prezime}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{getOrgUnitName(w.orgJedinicaId) || '-'}</td>
                  <td>{w.mobitel || '-'}</td>
                  {/* Copyable email */}
                  <td onClick={e => e.stopPropagation()}>
                    {w.email ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text)', fontSize: 'inherit' }}>{w.email}</span>
                        <button
                          onClick={() => copyEmail(w.email, w.id)}
                          title={copiedEmail === w.id ? (lang === 'bs' ? 'Kopirano!' : 'Copied!') : (lang === 'bs' ? 'Kopiraj email' : 'Copy email')}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                            color: copiedEmail === w.id ? '#22c55e' : 'var(--text-muted)',
                            display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                            borderRadius: 4, transition: 'color 0.2s, background 0.2s',
                            lineHeight: 1,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          {copiedEmail === w.id ? (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8l3.5 3.5L13 4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <rect x="5" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                              <rect x="2" y="4" width="9" height="11" rx="1.5" fill="var(--bg-card,#1e2030)" stroke="currentColor" strokeWidth="1.4" />
                            </svg>
                          )}
                        </button>
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {w.ulica ? `${w.ulica} ${w.kucniBroj || ''}`.trim() : '-'}
                  </td>
                </tr>
              ))}
            </tbody></table></div>

          {/* Quick mailto bar when something is selected */}
          {selectedCount > 0 && (
            <div style={{
              marginTop: 12, padding: '10px 16px',
              background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
              display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
              border: '1px solid var(--primary)', borderStyle: 'dashed',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.85rem' }}>
                ✉️ {selectedCount} {lang === 'bs' ? 'odabrano' : 'selected'}
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => openOutlook(false)}>
                {lang === 'bs' ? 'Otvori email u Outlooku' : 'Open in Outlook'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const emails = sorted.filter(w => selected.has(w.id) && w.email).map(w => w.email).join(', ');
                navigator.clipboard.writeText(emails);
              }}>
                📋 {lang === 'bs' ? 'Kopiraj emailove' : 'Copy emails'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto' }}>
                ✕ {lang === 'bs' ? 'Poništi odabir' : 'Clear'}
              </button>
            </div>
          )}
        </div></div>
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
