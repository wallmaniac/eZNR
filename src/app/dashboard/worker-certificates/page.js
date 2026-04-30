'use client';
import { useState, useMemo, useTransition, useEffect, useRef, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSortedList } from '@/hooks/useSortedList';
import Icon3D from '@/components/Icon3D';
import PDFExportButton from '@/components/PDFExportButton';
import PageHeader from '@/components/PageHeader';
import { useDialog } from '@/hooks/useDialog';

// ── Bulk PDF print ────────────────────────────────────────────────────────────
function buildBulkPrintHtml(selectedRows, workers, lang) {
  const bs = lang === 'bs';
  const pages = selectedRows.map((r, idx) => {
    const w = workers.find(x => x.id === r.workerId) || {};
    const isLast = idx === selectedRows.length - 1;
    return `
      <div class="cert-page" style="${isLast ? '' : 'page-break-after: always'}">
        <div class="cert-header">
          <div class="cert-logo">eZNR</div>
          <div class="cert-title">${bs ? 'UVJERENJE' : 'CERTIFICATE'}</div>
          <div class="cert-subtitle">${bs ? 'o osposobljenosti za bezbijedan rad' : 'of occupational safety training'}</div>
        </div>
        <table class="cert-table">
          <tr><td class="lbl">${bs ? 'Radnik' : 'Worker'}</td><td class="val"><strong>${w.ime || ''} ${w.prezime || ''}</strong></td></tr>
          <tr><td class="lbl">${bs ? 'JMBG' : 'ID No.'}</td><td class="val">${w.jmbg || '—'}</td></tr>
          <tr><td class="lbl">${bs ? 'Radno mjesto' : 'Workplace'}</td><td class="val">${w.radnoMjesto || '—'}</td></tr>
          <tr><td class="lbl">${bs ? 'Vrsta uvjerenja' : 'Cert. type'}</td><td class="val">${r.tipUvjerenjaIme || r.tipUvjerenja || '—'}</td></tr>
          <tr><td class="lbl">${bs ? 'Naziv uvjerenja' : 'Certificate name'}</td><td class="val">${r.naziv || r.ime || '—'}</td></tr>
          <tr><td class="lbl">${bs ? 'Oznaka' : 'Code'}</td><td class="val">${r.oznaka || '—'}</td></tr>
          <tr><td class="lbl">${bs ? 'Datum izdavanja' : 'Issue date'}</td><td class="val">${r.datum ? r.datum.split('T')[0].split('-').reverse().join('.') : '—'}</td></tr>
          <tr><td class="lbl">${bs ? 'Važi do' : 'Valid until'}</td><td class="val">${r.vrijediDo ? r.vrijediDo.split('T')[0].split('-').reverse().join('.') : (bs ? 'Trajno' : 'Permanent')}</td></tr>
          ${r.ispitivac ? `<tr><td class="lbl">${bs ? 'Ispitivač' : 'Examiner'}</td><td class="val">${r.ispitivac}</td></tr>` : ''}
          ${r.ovlastenaFirma ? `<tr><td class="lbl">${bs ? 'Ovlaštena firma' : 'Auth. company'}</td><td class="val">${r.ovlastenaFirma}</td></tr>` : ''}
        </table>
        <div class="cert-footer">
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">${bs ? 'Odgovorno lice' : 'Authorised person'}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-label">${bs ? 'Radnik (potpis)' : 'Worker (signature)'}</div>
          </div>
        </div>
        <div class="cert-meta">${bs ? 'Generisano putem' : 'Generated via'} eZNR · zastitanaradu.ba · ${new Date().toLocaleDateString('bs-BA')}</div>
      </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="${bs ? 'bs' : 'en'}">
<head>
  <meta charset="UTF-8"/>
  <title>${bs ? 'Uvjerenja' : 'Certificates'} — eZNR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; background: white; }
    .cert-page { width: 185mm; margin: 8mm auto; padding: 14mm 14mm 10mm; border: 1px solid #ccc; min-height: 240mm; display: flex; flex-direction: column; }
    .cert-header { text-align: center; border-bottom: 2px solid #00BFA6; padding-bottom: 10px; margin-bottom: 18px; }
    .cert-logo { font-size: 22pt; font-weight: 900; color: #00BFA6; letter-spacing: -1px; }
    .cert-title { font-size: 16pt; font-weight: 700; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; }
    .cert-subtitle { font-size: 9pt; color: #555; margin-top: 4px; }
    .cert-table { width: 100%; border-collapse: collapse; margin-bottom: auto; }
    .cert-table tr { border-bottom: 1px solid #e8e8e8; }
    .cert-table td { padding: 7px 8px; vertical-align: top; }
    .cert-table .lbl { width: 38%; font-size: 8.5pt; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.3px; }
    .cert-table .val { font-size: 10pt; }
    .cert-footer { display: flex; justify-content: space-between; margin-top: 24px; gap: 24px; }
    .sig-block { flex: 1; text-align: center; }
    .sig-line { border-bottom: 1px solid #333; height: 28px; margin-bottom: 6px; }
    .sig-label { font-size: 8pt; color: #555; }
    .cert-meta { text-align: center; font-size: 7.5pt; color: #aaa; margin-top: 12px; border-top: 1px solid #eee; padding-top: 8px; }
    @media print {
      body { margin: 0; }
      .cert-page { border: none; margin: 0; width: 100%; min-height: 0; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
${pages}
<script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;
}

// ── Main component ─────────────────────────────────────────────────────────────
function WorkerCertificatesInner() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [navigatingId, setNavigatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [showOnlyValid, setShowOnlyValid] = useState(false);
  const [showExpiringSoon, setShowExpiringSoon] = useState(false);
  const [expiringSoonDays, setExpiringSoonDays] = useState(60);
  const [viewWorkerId, setViewWorkerId] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, maxH: 400 });
  const longPressTimer = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const { confirm, DialogRenderer } = useDialog();
  const [certsVersion, setCertsVersion] = useState(0);

  // ── Bulk selection state ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());

  const highlightId = searchParams.get('highlight');
  const sortByExpiry = searchParams.get('sort') === 'expiry';
  const highlightRef = useRef(null);

  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS), []);
  const certs = useMemo(() => getAll(COLLECTIONS.CERTIFICATES), [certsVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const orgUnits = useMemo(() => getAll(COLLECTIONS.ORG_UNITS), []);
  const [filterOrgUnit, setFilterOrgUnit] = useState('');

  const filteredRows = useMemo(() => {
    return certs.map(c => {
      const w = workers.find(x => x.id === c.workerId);
      const isExpired = c.vrijediDo && new Date(c.vrijediDo) < new Date();
      return {
        ...c,
        workerName: w ? `${w.ime} ${w.prezime}` : '-',
        isExpired,
        naziv: c.ime || c.naziv || '',
        statusText: isExpired ? 'Isteklo' : 'Važeće',
      };
    }).filter(r => {
      const w = workers.find(x => x.id === r.workerId);
      if (filterOrgUnit && (!w || w.orgJedinicaId !== filterOrgUnit)) return false;

      const expDate = r.vrijediDo ? new Date(r.vrijediDo) : null;
      const now = new Date();
      if (showOnlyValid && expDate && expDate < now) return false;
      if (showExpiringSoon) {
        if (!expDate) return false;
        const diffDays = (expDate - now) / (1000 * 60 * 60 * 24);
        if (diffDays > expiringSoonDays || diffDays < 0) return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return r.workerName.toLowerCase().includes(term) ||
        r.naziv.toLowerCase().includes(term) ||
        (r.oznaka || '').toLowerCase().includes(term) ||
        (r.tipUvjerenjaIme || r.tipUvjerenja || '').toLowerCase().includes(term);
    });
  }, [certs, workers, searchTerm, showOnlyValid, showExpiringSoon, expiringSoonDays, filterOrgUnit]);

  const { sorted: rows, toggleSort: tS, sortIcon: siS, thStyle: tsS } = useSortedList(
    filteredRows,
    sortByExpiry ? 'vrijediDo' : 'workerName',
    'asc'
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const pagedRows = rows.slice((page - 1) * perPage, page * perPage);

  // ── Bulk helpers ──────────────────────────────────────────────────────────
  const allSelected = pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(r.id));
  const someSelected = pagedRows.some(r => selectedIds.has(r.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagedRows.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagedRows.forEach(r => next.add(r.id));
        return next;
      });
    }
  }, [allSelected, pagedRows]);

  const toggleOne = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Clear selection when filter changes
  useEffect(() => { setSelectedIds(new Set()); setPage(1); }, [searchTerm, showOnlyValid, showExpiringSoon, expiringSoonDays, filterOrgUnit]);

  // ── Bulk print ────────────────────────────────────────────────────────────
  const handleBulkPrint = useCallback(() => {
    const selectedRows = rows.filter(r => selectedIds.has(r.id));
    if (selectedRows.length === 0) return;
    const html = buildBulkPrintHtml(selectedRows, workers, lang);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Dozvolite popup prozore za print funkciju.'); return; }
    win.document.write(html);
    win.document.close();
  }, [rows, selectedIds, workers, lang]);

  // ── Scroll to highlight ───────────────────────────────────────────────────
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

  const bs = lang === 'bs';

  return (
    <>
      <DialogRenderer />
      <div className="animate-fadeIn">
        <PageHeader icon="📜" title={t('workerCertificates')} subtitle={`${rows.length} ${t('records')}${selectedIds.size > 0 ? ` · ${selectedIds.size} ${bs ? 'odabrano' : 'selected'}` : ''}`} />

        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {/* ── Toolbar ───────────────────────────────────────────────── */}
            <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" style={{ height: 38, padding: '0 8px' }} onClick={() => router.push('/dashboard/worker-certificates/create')}>
                + {bs ? 'Dodaj uvjerenje' : 'Add certificate'}
              </button>

              <div className="search-bar" style={{ height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                <input
                  placeholder={bs ? 'Pretraži uvjerenja...' : 'Search...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%', minWidth: 0 }}
                />
                {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
              </div>

              <select
                className="form-select"
                style={{ height: 38, padding: '0 8px', width: 98, flexShrink: 0, fontSize: '0.8rem' }}
                value={filterOrgUnit}
                onChange={(e) => setFilterOrgUnit(e.target.value)}
              >
                <option value="">{bs ? 'Svi odjeli' : 'All Depts'}</option>
                {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
              </select>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1 }}>
                  <input type="checkbox" checked={showOnlyValid} onChange={e => { setShowOnlyValid(e.target.checked); if (e.target.checked) setShowExpiringSoon(false); }} style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
                  {t('showOnlyValid')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1 }}>
                  <input type="checkbox" checked={showExpiringSoon} onChange={e => { setShowExpiringSoon(e.target.checked); if (e.target.checked) setShowOnlyValid(false); }} style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
                  {bs ? 'Ističe u' : 'Expiring in'}
                  <select
                    value={expiringSoonDays}
                    onChange={e => setExpiringSoonDays(Number(e.target.value))}
                    disabled={!showExpiringSoon}
                    style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '0 4px', fontSize: '0.75rem', background: 'var(--bg-card)', color: 'var(--text)', cursor: showExpiringSoon ? 'pointer' : 'not-allowed', opacity: showExpiringSoon ? 1 : 0.5, height: 20 }}
                  >
                    <option value={30}>30d</option>
                    <option value={60}>60d</option>
                    <option value={90}>90d</option>
                    <option value={180}>180d</option>
                  </select>
                </label>
              </div>

                <PDFExportButton 
                buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }}
                options={[
                { label: bs ? 'Sva uvjerenja' : 'All certs', icon: '📄', onClick: () => import('@/lib/pdfReportGenerator').then(m => m.generateCertificatesReport(rows.map(r => r.id), lang)) },
                ...(selectedIds.size > 0 ? [{ label: `${bs ? 'Odabrano' : 'Selected'} (${selectedIds.size})`, icon: '✓', onClick: () => import('@/lib/pdfReportGenerator').then(m => m.generateCertificatesReport(rows.filter(r => selectedIds.has(r.id)).map(r => r.id), lang)) }] : []),
              ]} />

              <div style={{ position: 'relative' }}>
                 <button className="btn btn-dark btn-sm" style={{ height: 38, cursor: 'pointer', padding: '0 12px' }} onClick={() => { const el = document.getElementById('zapisnici-menu'); el.style.display = el.style.display === 'block' ? 'none' : 'block'; }}>
                    🖨️ {bs ? 'Zapisnici' : 'Records'} ▾
                 </button>
                 <div id="zapisnici-menu" style={{ display: 'none', position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 99, minWidth: 150 }}>
                    <div onClick={() => { document.getElementById('zapisnici-menu').style.display='none'; window.open('/print-template?type=ZOS', '_blank'); }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>🖨️ {bs ? 'Zapisnik ZOS' : 'ZOS'}</div>
                    <div onClick={() => { document.getElementById('zapisnici-menu').style.display='none'; window.open('/print-template?type=ZOP', '_blank'); }} style={{ padding: '8px 12px', cursor: 'pointer', color: '#d32f2f', fontSize: '0.85rem' }}>🔥 {bs ? 'Zapisnik ZOP' : 'ZOP'}</div>
                 </div>
              </div>
            </div>

            {/* ── Bulk Action Bar ────────────────────────────────────────── */}
            {selectedIds.size > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid rgba(0,191,166,0.2)',
                flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                  ✓ {selectedIds.size} {bs ? 'odabrano' : 'selected'} — {bs ? 'Grupne akcije:' : 'Bulk actions:'}
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleBulkPrint}
                  title={bs ? 'Generiši i isprintaj sva odabrana uvjerenja u jednom PDF dokumentu' : 'Generate and print all selected certificates as one PDF'}
                >
                  🖨️ {bs ? `Generiši PDF (${selectedIds.size} uvjerenja)` : `Generate PDF (${selectedIds.size} certs)`}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedIds(new Set())}
                  title={bs ? 'Poništi odabir' : 'Clear selection'}
                >
                  ✕ {bs ? 'Poništi odabir' : 'Clear selection'}
                </button>
              </div>
            )}

            {/* ── Table ─────────────────────────────────────────────────── */}
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    {/* Checkbox column */}
                    <th style={{ width: 40, textAlign: 'center', padding: '14px 8px' }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                        onChange={toggleAll}
                        title={bs ? 'Odaberi sve / Poništi' : 'Select all / Clear'}
                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--primary)' }}
                      />
                    </th>
                    <th style={{ width: 110, textAlign: 'center' }}>{bs ? 'Akcije' : 'Actions'}</th>
                    <th style={tsS('workerName')} onClick={() => tS('workerName')}>{t('worker')}{siS('workerName')}</th>
                    <th style={tsS('naziv')} onClick={() => tS('naziv')}>{t('name')}{siS('naziv')}</th>
                    <th style={tsS('oznaka')} onClick={() => tS('oznaka')}>{t('certCode')}{siS('oznaka')}</th>
                    <th style={tsS('datum')} onClick={() => tS('datum')}>{t('certDate')}{siS('datum')}</th>
                    <th style={tsS('vrijediDo')} onClick={() => tS('vrijediDo')}>{t('certValidUntil')}{siS('vrijediDo')}</th>
                    <th style={tsS('statusText')} onClick={() => tS('statusText')}>{t('status')}{siS('statusText')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      {searchTerm ? (bs ? `Nema rezultata za "${searchTerm}"` : `No results for "${searchTerm}"`) : t('noRecords')}
                    </td></tr>
                  ) : pagedRows.map((r, idx) => {
                    const diff = r.vrijediDo ? (new Date(r.vrijediDo) - new Date()) / (1000 * 60 * 60 * 24) : 999;
                    const isNavigating = navigatingId === r.id && isPending;
                    const isSelected = selectedIds.has(r.id);
                    return (
                      <tr key={r.id || idx}
                        ref={r.id === highlightId ? highlightRef : null}
                        onTouchStart={(e) => {
                          touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                          longPressTimer.current = setTimeout(() => {
                            setActionMenuId(r.id);
                            if (navigator.vibrate) navigator.vibrate(50);
                          }, 600);
                        }}
                        onTouchMove={(e) => {
                          if (!longPressTimer.current) return;
                          const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
                          const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
                          if (dx > 10 || dy > 10) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
                        }}
                        onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                        style={{
                          WebkitUserSelect: 'none', userSelect: 'none', position: 'relative',
                          ...(r.id === highlightId ? {
                            background: 'rgba(0,191,166,0.12)',
                            outline: '2px solid var(--primary)',
                            outlineOffset: -2,
                            borderRadius: 4,
                            animation: 'pulse-highlight 1.5s ease-in-out 2',
                          } : {}),
                          ...(isSelected ? { background: 'rgba(0,191,166,0.05)' } : {}),
                        }}>
                        {/* Checkbox cell — label wrapper avoids double-fire */}
                        <td style={{ padding: 0 }}>
                          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '100%', height: '100%', minHeight: 50, padding: '0 8px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={e => { e.stopPropagation(); toggleOne(r.id); }}
                              style={{ cursor: 'pointer', width: 18, height: 18, accentColor: 'var(--primary)', flexShrink: 0 }}
                            />
                          </label>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '6px 12px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                            <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                onClick={() => handleEdit(r.id)}>▶</button>
                            <button className="btn btn-primary btn-sm" onClick={e => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const spaceBelow = window.innerHeight - rect.bottom;
                                const spaceAbove = rect.top;
                                const flipUp = spaceBelow < 300 && spaceAbove > spaceBelow;
                                setMenuPos(flipUp
                                    ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                                    : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                                );
                                setActionMenuId(actionMenuId === r.id ? null : r.id);
                            }}>
                                {bs ? 'Akcije' : 'Actions'} ▼
                            </button>
                          </div>
                          {actionMenuId === r.id && typeof document !== 'undefined' && createPortal(
                              <>
                                <div onClick={() => setActionMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                                <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 240, maxHeight: menuPos.maxH, overflowY: 'auto', padding: '4px 0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                            {r.workerName} — {(r.naziv || r.ime || '').substring(0, 30)}
                                        </span>
                                        <button onClick={() => setActionMenuId(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                                    </div>
                                    {(() => {
                                        const _miSt = { width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit' };
                                        return (<>
                                            <button style={_miSt} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}
                                                onClick={() => { setActionMenuId(null); handleEdit(r.id); }}>📂 {bs ? 'Otvori' : 'Open'}</button>
                                            <button style={_miSt} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}
                                                onClick={() => {
                                                    setActionMenuId(null);
                                                    const html = buildBulkPrintHtml([r], workers, lang);
                                                    const win = window.open('', '_blank', 'width=900,height=700');
                                                    if (win) { win.document.write(html); win.document.close(); }
                                                }}>🖨️ {bs ? 'Isprintaj' : 'Print'}</button>
                                            <button style={_miSt} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}
                                                onClick={() => { setActionMenuId(null); router.push(`/dashboard/worker-certificates/edit/${r.id}?tab=dokumenti`); }}>📁 {bs ? 'Dokumenti' : 'Documents'}</button>
                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                            <button style={_miSt} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}
                                                onClick={() => { setActionMenuId(null); router.push(`/dashboard/worker-certificates/create?copyFrom=${r.id}&workerId=${r.workerId}`); }}>📋 {bs ? 'Kopiraj' : 'Copy'}</button>
                                            <button style={_miSt} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}
                                                onClick={() => { setActionMenuId(null); router.push(`/dashboard/worker-certificates/create?copyFrom=${r.id}&workerId=${r.workerId}`); }}>🔄 {bs ? 'Produži' : 'Renew'}</button>
                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                            <button style={{..._miSt, color: 'var(--danger)'}} onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.06)'} onMouseLeave={e => e.currentTarget.style.background=''}
                                                onClick={async () => {
                                                    setActionMenuId(null);
                                                    const ok = await confirm(bs ? 'Obrisati uvjerenje? Ova radnja je trajna.' : 'Delete certificate? This is permanent.');
                                                    if (ok) { remove(COLLECTIONS.CERTIFICATES, r.id); setCertsVersion(v => v + 1); }
                                                }}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                        </>);
                                    })()}
                                </div>
                              </>,
                              document.body
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          <button
                            onClick={() => { const w = workers.find(x => x.id === r.workerId); if (w) setViewWorkerId(w.id); }}
                            style={{ background: 'none', border: 'none', cursor: r.workerId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: r.workerId ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                            title={r.workerId ? (bs ? 'Klikni za pregled profila' : 'Click to view profile') : ''}
                          >{r.workerName}</button>
                        </td>
                        <td>
                          <button
                            onClick={() => handleEdit(r.id)}
                            disabled={isNavigating}
                            style={{ background: 'none', border: 'none', cursor: isNavigating ? 'wait' : 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--primary)', opacity: isNavigating ? 0.6 : 1 }}
                            title={bs ? 'Uredi uvjerenje' : 'Edit certificate'}
                          >{r.naziv || r.ime || '—'}</button>
                        </td>
                        <td><span className="badge badge-info">{r.oznaka}</span></td>
                        <td>{formatDate(r.datum)}</td>
                        <td style={{ color: r.isExpired ? 'var(--danger)' : diff <= 60 ? '#FF9800' : undefined, fontWeight: r.isExpired || diff <= 60 ? 700 : undefined }}>
                          {formatDate(r.vrijediDo)} {r.isExpired ? '⚠️' : diff <= 60 ? '⏰' : ''}
                        </td>
                        <td><span className={`badge ${r.isExpired ? 'badge-danger' : 'badge-success'}`}>{r.isExpired ? (bs ? 'Isteklo' : 'Expired') : (bs ? 'Važeće' : 'Valid')}</span></td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {rows.length > 0 && (
              <div className="pagination" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {`${(page - 1) * perPage + 1} - ${Math.min(page * perPage, rows.length)} ${t('of')} ${rows.length}`} {t('records')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="pagination-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
                      <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                      <button className="pagination-btn active">{page}</button>
                      <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
                      <button className="pagination-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
                      <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); setSelectedIds(new Set()); }}
                          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                          <option value={10}>10 {t('perPage')}</option>
                          <option value={25}>25 {t('perPage')}</option>
                          <option value={50}>50 {t('perPage')}</option>
                          <option value={100}>100 {t('perPage')}</option>
                      </select>
                  </div>
              </div>
            )}

            {/* ── Bottom hint when none selected ────────────────────────── */}
            {selectedIds.size === 0 && rows.length > 0 && (
              <div style={{ padding: '10px 16px', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💡</span>
                <span>{bs ? 'Odaberite uvjerenja kvačicama da biste ih grupno ispisali u jedan PDF.' : 'Check the checkboxes to bulk-print selected certificates as one PDF.'}</span>
              </div>
            )}
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
      <style>{`
        .uvjerenja-toolbar { display: flex; gap: 8px; padding: 12px 16px; flex-wrap: wrap; align-items: center; border-bottom: 1px solid var(--border-light); }
        .search-full { flex: 1; min-width: 180px; display: flex; align-items: center; gap: 8px; }
        .filters-row { display: flex; align-items: center; gap: 16px; }
        .btn-dodaj-mobile { display: none; }
        .header-top-btn { display: block; margin-left: auto; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-highlight { 0%,100% { background: rgba(0,191,166,0.12); } 50% { background: rgba(0,191,166,0.28); } }
        
        /* Mobile overrides */
        @media (max-width: 768px) {
          .uvjerenja-toolbar { flex-direction: column; align-items: flex-start; gap: 12px; }
          .search-full { width: 100%; border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; background: var(--bg-input); }
          .filters-row { width: 100%; justify-content: space-between; }
          .btn-dodaj-mobile { display: block; width: 100%; }
          .btn-dodaj-mobile button { width: 100%; justify-content: center; padding: 15px; font-size: 1.1rem; font-weight: 700; }
          .header-top-btn { display: none; }
          .record-buttons { display: none; } /* User only asked for Dodaj, search, and filters. Hide ZOS ZOP on mobile to save space, or keep them? Keeping them visible takes too much space. */
        }
      `}</style>
    </>
  );
}

export default function WorkerCertificatesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
      <WorkerCertificatesInner />
    </Suspense>
  );
}

