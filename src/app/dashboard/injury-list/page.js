'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, remove, COLLECTIONS } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';

export default function InjuryListPage() {
  const { t, lang } = useLanguage();
  const [injuries, setInjuries] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTip, setFilterTip] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewWorkerId, setViewWorkerId] = useState(null);

  const loadData = useCallback(() => {
    setInjuries(getAll(COLLECTIONS.INJURIES));
    setWorkers(getAll(COLLECTIONS.WORKERS));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = (id) => {
    if (!confirm(lang === 'bs' ? 'Obrisati ovu prijavu?' : 'Delete this report?')) return;
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
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {filtered.length} / {total} {lang === 'bs' ? 'prijava' : 'reports'}
              </span>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rb.</th>
                    <th>{t('worker')}</th>
                    <th>{t('date')}</th>
                    <th>{lang === 'bs' ? 'Tip' : 'Type'}</th>
                    <th>{t('location')}</th>
                    <th>{lang === 'bs' ? 'Opis' : 'Description'}</th>
                    <th>{lang === 'bs' ? 'Prva pomoć' : 'First aid'}</th>
                    <th>{lang === 'bs' ? 'Bolovanje' : 'Sick leave'}</th>
                    <th>{t('status')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        {injuries.length === 0
                          ? (lang === 'bs' ? '✅ Nema prijavljenih povreda' : '✅ No reported injuries')
                          : t('noRecords')}
                      </td>
                    </tr>
                  ) : filtered.map((inj, idx) => (
                    <tr key={inj.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>
                        <button
                          onClick={() => { const w = workers.find(w => w.id === inj.radnikId); if (w) setViewWorkerId(w.id); }}
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
                      <td>
                        <button className="btn btn-ghost btn-sm btn-icon" title={t('delete')} onClick={() => handleDelete(inj.id)}>🗑️</button>
                      </td>
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
    </>
  );
}
