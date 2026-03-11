'use client';
import { useState, useMemo, useTransition } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useRouter } from 'next/navigation';

export default function WorkerCertificatesPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [navigatingId, setNavigatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyValid, setShowOnlyValid] = useState(false);
  const [viewWorkerId, setViewWorkerId] = useState(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const sortByExpiry = searchParams.get('sort') === 'expiry';
  const highlightRef = useRef(null);

  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);
  const certs = useMemo(() => getAll(COLLECTIONS.CERTIFICATES), []);

  const rows = useMemo(() => {
    return certs.map(c => {
      const w = workers.find(x => x.id === c.workerId);
      const isExpired = c.vrijediDo && new Date(c.vrijediDo) < new Date();
      return { ...c, workerName: w ? `${w.ime} ${w.prezime}` : '-', isExpired, naziv: c.ime || c.naziv || '' };
    }).sort((a, b) => {
      if (!sortByExpiry) return 0;
      // Expired first, then soonest expiry first
      const aDate = a.vrijediDo ? new Date(a.vrijediDo).getTime() : 99999999999999;
      const bDate = b.vrijediDo ? new Date(b.vrijediDo).getTime() : 99999999999999;
      return aDate - bDate;
    }).filter(r => {
      if (showOnlyValid && r.isExpired) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return r.workerName.toLowerCase().includes(term) ||
        r.naziv.toLowerCase().includes(term) ||
        (r.oznaka || '').toLowerCase().includes(term) ||
        (r.tipUvjerenjaIme || r.tipUvjerenja || '').toLowerCase().includes(term);
    });
  }, [certs, workers, searchTerm, showOnlyValid, sortByExpiry]);

  // Scroll to highlighted cert after render
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId]);

  const handleEdit = (id) => {
    setNavigatingId(id);
    startTransition(() => {
      router.push(`/dashboard/worker-certificates/edit/${id}`);
    });
  };

  return (
    <>
      <div className="animate-fadeIn">
        <h1 style={{ marginBottom: 24 }}>📜 {t('workerCertificates')}</h1>
        <div className="card"><div className="card-body">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/dashboard/worker-certificates/create')}>
              + {lang === 'bs' ? 'Dodaj uvjerenje' : 'Add certificate'}
            </button>
            <div className="search-bar" style={{ flex: 1, maxWidth: 400, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
              <input
                placeholder={lang === 'bs' ? 'Pretraži po imenu, oznaci, tipu...' : 'Search by name, code, type...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={showOnlyValid} onChange={e => setShowOnlyValid(e.target.checked)} />
              {t('showOnlyValid')}
            </label>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: 'auto' }}>{rows.length} {t('records')}</span>
          </div>
          <div className="data-table-wrapper"><table className="data-table"><thead><tr>
            <th>{t('worker')}</th><th>{t('name')}</th><th>{t('certCode')}</th><th>{t('certDate')}</th><th>{t('certValidUntil')}</th><th>{t('status')}</th><th style={{ width: 48, textAlign: 'center' }}>{lang === 'bs' ? 'Uredi' : 'Edit'}</th>
          </tr></thead><tbody>
              {sortByExpiry && (
                <tr><td colSpan={7} style={{ padding: '8px 12px', background: 'rgba(0,191,166,0.06)', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)', textAlign: 'center', fontStyle: 'italic' }}>
                  📅 {lang === 'bs' ? 'Sortirano po datumu isteka — najskorije prvo' : 'Sorted by expiry date — soonest first'}
                </td></tr>
              )}
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {searchTerm ? (lang === 'bs' ? `Nema rezultata za "${searchTerm}"` : `No results for "${searchTerm}"`) : t('noRecords')}
                </td></tr>
              ) : rows.map((r, idx) => {
                const diff = r.vrijediDo ? (new Date(r.vrijediDo) - new Date()) / (1000 * 60 * 60 * 24) : 999;
                const isNavigating = navigatingId === r.id && isPending;
                return (
                  <tr key={r.id || idx}
                    ref={r.id === highlightId ? highlightRef : null}
                    style={r.id === highlightId ? {
                      background: 'rgba(0,191,166,0.12)',
                      outline: '2px solid var(--primary)',
                      outlineOffset: -2,
                      borderRadius: 4,
                      animation: 'pulse-highlight 1.5s ease-in-out 2',
                    } : undefined}>
                    <td style={{ fontWeight: 600 }}>
                      <button
                        onClick={() => { const w = workers.find(x => x.id === r.workerId); if (w) setViewWorkerId(w.id); }}
                        style={{ background: 'none', border: 'none', cursor: r.workerId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: r.workerId ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                        title={r.workerId ? (lang === 'bs' ? 'Klikni za pregled profila' : 'Click to view profile') : ''}
                      >{r.workerName}</button>
                    </td>
                    <td>
                      <button
                        onClick={() => { const w = workers.find(x => x.id === r.workerId); if (w) setViewWorkerId(w.id); }}
                        style={{ background: 'none', border: 'none', cursor: r.workerId ? 'pointer' : 'default', color: 'var(--primary)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: r.workerId ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: 'var(--primary)' }}
                        title={lang === 'bs' ? 'Klikni za pregled uvjerenja radnika' : 'Click to view worker certificates'}
                      >{r.naziv || r.ime || '—'}</button>
                    </td>
                    <td><span className="badge badge-info">{r.oznaka}</span></td>
                    <td>{formatDate(r.datum)}</td>
                    <td style={{ color: r.isExpired ? 'var(--danger)' : diff <= 60 ? '#FF9800' : undefined, fontWeight: r.isExpired || diff <= 60 ? 700 : undefined }}>
                      {formatDate(r.vrijediDo)} {r.isExpired ? '⚠️' : diff <= 60 ? '⏰' : ''}
                    </td>
                    <td><span className={`badge ${r.isExpired ? 'badge-danger' : 'badge-success'}`}>{r.isExpired ? (lang === 'bs' ? 'Isteklo' : 'Expired') : (lang === 'bs' ? 'Važeće' : 'Valid')}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleEdit(r.id)}
                        disabled={isNavigating}
                        title={lang === 'bs' ? 'Uredi uvjerenje' : 'Edit certificate'}
                        style={{
                          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                          cursor: isNavigating ? 'wait' : 'pointer', padding: '4px 8px',
                          fontSize: '1rem', color: isNavigating ? 'var(--primary)' : 'var(--text-muted)',
                          transition: 'all 0.15s', minWidth: 34,
                          borderColor: isNavigating ? 'var(--primary)' : undefined,
                        }}
                        onMouseEnter={e => { if (!isNavigating) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'rgba(var(--primary-rgb,33,150,243),0.07)'; } }}
                        onMouseLeave={e => { if (!isNavigating) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; } }}
                      >
                        {isNavigating
                          ? <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', verticalAlign: 'middle' }} />
                          : '📄'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody></table></div>
        </div></div>
      </div>
      {viewWorkerId && (
        <WorkerProfileModal
          workerId={viewWorkerId}
          onClose={() => setViewWorkerId(null)}
          onSaved={() => setViewWorkerId(null)}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse-highlight { 0%,100% { background: rgba(0,191,166,0.12); } 50% { background: rgba(0,191,166,0.28); } }`}</style>
    </>
  );
}
