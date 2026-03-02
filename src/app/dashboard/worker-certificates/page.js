'use client';
import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, formatDate } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useRouter } from 'next/navigation';

export default function WorkerCertificatesPage() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyValid, setShowOnlyValid] = useState(false);
  const [viewWorkerId, setViewWorkerId] = useState(null);

  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);
  const certs = useMemo(() => getAll(COLLECTIONS.CERTIFICATES), []);

  const rows = useMemo(() => {
    return certs.map(c => {
      const w = workers.find(x => x.id === c.workerId);
      const isExpired = c.vrijediDo && new Date(c.vrijediDo) < new Date();
      return { ...c, workerName: w ? `${w.ime} ${w.prezime}` : '-', isExpired, naziv: c.ime || c.naziv || '' };
    }).filter(r => {
      if (showOnlyValid && r.isExpired) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return r.workerName.toLowerCase().includes(term) ||
        r.naziv.toLowerCase().includes(term) ||
        (r.oznaka || '').toLowerCase().includes(term) ||
        (r.tipUvjerenja || '').toLowerCase().includes(term);
    });
  }, [certs, workers, searchTerm, showOnlyValid]);

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
            <th>{t('worker')}</th><th>{t('name')}</th><th>{t('certCode')}</th><th>{lang === 'bs' ? 'Tip' : 'Type'}</th><th>{t('certDate')}</th><th>{t('certValidUntil')}</th><th>{t('status')}</th>
          </tr></thead><tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  {searchTerm ? (lang === 'bs' ? `Nema rezultata za "${searchTerm}"` : `No results for "${searchTerm}"`) : t('noRecords')}
                </td></tr>
              ) : rows.map((r, idx) => {
                const diff = r.vrijediDo ? (new Date(r.vrijediDo) - new Date()) / (1000 * 60 * 60 * 24) : 999;
                return (
                  <tr key={r.id || idx}>
                    <td style={{ fontWeight: 600 }}>
                      <button
                        onClick={() => { const w = workers.find(x => x.id === r.workerId); if (w) setViewWorkerId(w.id); }}
                        style={{ background: 'none', border: 'none', cursor: r.workerId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: r.workerId ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                        title={r.workerId ? (lang === 'bs' ? 'Klikni za pregled profila' : 'Click to view profile') : ''}
                      >{r.workerName}</button>
                    </td>
                    <td>{r.naziv}</td>
                    <td><span className="badge badge-info">{r.oznaka}</span></td>
                    <td><span className="badge" style={{ background: '#E8EAF6', color: '#283593' }}>{r.tipUvjerenja}</span></td>
                    <td>{formatDate(r.datum)}</td>
                    <td style={{ color: r.isExpired ? 'var(--danger)' : diff <= 60 ? '#FF9800' : undefined, fontWeight: r.isExpired || diff <= 60 ? 700 : undefined }}>
                      {formatDate(r.vrijediDo)} {r.isExpired ? '⚠️' : diff <= 60 ? '⏰' : ''}
                    </td>
                    <td><span className={`badge ${r.isExpired ? 'badge-danger' : 'badge-success'}`}>{r.isExpired ? (lang === 'bs' ? 'Isteklo' : 'Expired') : (lang === 'bs' ? 'Važeće' : 'Valid')}</span></td>
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
    </>
  );
}
