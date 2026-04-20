'use client';

/**
 * pdfReportGenerator.js — Unified PDF Report Engine for eZNR
 *
 * Opens a new browser window with a professionally formatted, print-ready
 * A4 document. The user can "Save as PDF" or print directly.
 *
 * Every report shares:
 *   • Branded header with company name + eZNR badge + date
 *   • A4-optimized CSS with proper margins and page breaks
 *   • Status colour coding (green/amber/red)
 *   • Bilingual labels (BS / EN)
 *   • Auto-print trigger on load
 */

import { getAll, getById, getActiveCompanyId, formatDate, COLLECTIONS } from './dataStore';
import { getCompanyBranding, EZNR_DEFAULTS } from './brandingService';

// ─── Shared CSS for all reports ──────────────────────────────────────────────
const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a2e; background: #fff; }

  .page { width: 100%; padding: 12mm 14mm; }

  /* Header bar */
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid var(--accent); padding-bottom: 12px; margin-bottom: 16px; }
  .report-header .brand { display: flex; align-items: center; gap: 10px; }
  .report-header .brand-logo { height: 40px; max-width: 160px; object-fit: contain; }
  .report-header .brand-name { font-size: 16pt; font-weight: 900; color: var(--accent); letter-spacing: -0.5px; }
  .report-header .brand-sub { font-size: 7pt; color: #888; margin-top: 2px; }
  .report-header .company-info { text-align: right; font-size: 8pt; color: #555; line-height: 1.5; }
  .report-header .company-name { font-size: 10pt; font-weight: 700; color: #1a1a2e; }

  /* Report title */
  .report-title { font-size: 13pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #1a1a2e; margin-bottom: 4px; }
  .report-subtitle { font-size: 8pt; color: #888; margin-bottom: 16px; }

  /* Stat boxes */
  .stat-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .stat-box { flex: 1; min-width: 100px; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 10px; text-align: center; }
  .stat-box .stat-val { font-size: 16pt; font-weight: 800; }
  .stat-box .stat-lbl { font-size: 7pt; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-top: 2px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f5f6fa; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; padding: 7px 8px; text-align: left; border-bottom: 2px solid #e0e0e0; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 8.5pt; vertical-align: top; }
  tr:last-child td { border-bottom: 1px solid #ccc; }
  tbody tr:nth-child(even) { background: #fafbfd; }

  /* Status badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 7pt; font-weight: 700; letter-spacing: 0.3px; }
  .badge-ok { background: #e8f5e9; color: #2e7d32; }
  .badge-warn { background: #fff3e0; color: #e65100; }
  .badge-danger { background: #ffebee; color: #c62828; }
  .badge-neutral { background: #f5f5f5; color: #666; }

  /* Footer */
  .report-footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; font-size: 7pt; color: #aaa; }

  /* Print button */
  .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 12px 28px; background: var(--accent); color: #fff; border: none; border-radius: 10px; font-size: 11pt; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 999; display: flex; align-items: center; gap: 8px; }
  .print-btn:hover { filter: brightness(0.9); }

  /* Print overrides */
  @media print {
    body { margin: 0; }
    .page { padding: 8mm 10mm; }
    .print-btn { display: none !important; }
    @page { size: A4; margin: 10mm; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  }
`;

const SHARED_CSS_LANDSCAPE = SHARED_CSS.replace(
  '@page { size: A4; margin: 10mm; }',
  '@page { size: A4 landscape; margin: 8mm; }'
);

// ─── Helper: get current company info ────────────────────────────────────────
function getCompanyInfo() {
  const branding = getCompanyBranding();
  const companyId = getActiveCompanyId();
  if (!companyId || companyId === 'all') return { naziv: '', adresa: '', jib: '', logo: '', accentColor: EZNR_DEFAULTS.accentColor };
  const company = getById('companies', companyId);
  return {
    ...(company || { naziv: '', adresa: '', jib: '' }),
    logo: branding.logo,
    accentColor: branding.accentColor,
  };
}

// ─── Helper: format date safely ──────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return formatDate(d);
}

// ─── Helper: days until expiry ───────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

// ─── Helper: status badge HTML ───────────────────────────────────────────────
function statusBadge(days, bs) {
  if (days === null) return `<span class="badge badge-neutral">${bs ? 'N/D' : 'N/A'}</span>`;
  if (days < 0) return `<span class="badge badge-danger">${bs ? 'ISTEKLO' : 'EXPIRED'}</span>`;
  if (days <= 30) return `<span class="badge badge-danger">${bs ? `${days} dana` : `${days} days`}</span>`;
  if (days <= 90) return `<span class="badge badge-warn">${bs ? `${days} dana` : `${days} days`}</span>`;
  return `<span class="badge badge-ok">${bs ? 'Važeće' : 'Valid'}</span>`;
}

// ─── Build the branded header ────────────────────────────────────────────────
function buildHeader(title, subtitle, company) {
  const logoHtml = company.logo
    ? `<img class="brand-logo" src="${company.logo}" alt="${company.naziv || 'Logo'}" />`
    : `<span class="brand-name">eZNR</span>`;
  return `
    <div class="report-header">
      <div>
        <div class="brand">
          ${logoHtml}
        </div>
        <div class="brand-sub">Digitalna Platforma za Zaštitu na Radu</div>
      </div>
      <div class="company-info">
        <div class="company-name">${company.naziv || company.name || ''}</div>
        ${company.adresa || company.address ? `<div>${company.adresa || company.address}</div>` : ''}
        ${company.jib || company.oib || company.id_number ? `<div>JIB: ${company.jib || company.oib || company.id_number}</div>` : ''}
      </div>
    </div>
    <div class="report-title">${title}</div>
    <div class="report-subtitle">${subtitle}</div>
  `;
}

// ─── Build footer ────────────────────────────────────────────────────────────
function buildFooter(bs) {
  return `
    <div class="report-footer">
      <span>${bs ? 'Generisano putem' : 'Generated via'} eZNR · zastitanaradu.ba</span>
      <span>${new Date().toLocaleDateString('bs-BA')} · ${new Date().toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  `;
}

// ─── Open a print window with HTML content ───────────────────────────────────
function openPrintWindow(html, title) {
  const win = window.open('', '_blank', 'width=960,height=700');
  if (!win) {
    alert('Molimo dozvolite popup prozore za funkciju ispisa.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.document.title = title || 'eZNR Report';
}

// ─── Wrap content in full HTML document ──────────────────────────────────────
function wrapDocument(content, title, landscape = false, bs = true, accentColor = EZNR_DEFAULTS.accentColor) {
  const accentVar = `--accent: ${accentColor};`;
  return `<!DOCTYPE html>
<html lang="${bs ? 'bs' : 'en'}">
<head>
  <meta charset="UTF-8"/>
  <title>${title} — eZNR</title>
  <style>
    :root { ${accentVar} }
    ${landscape ? SHARED_CSS_LANDSCAPE : SHARED_CSS}
  </style>
</head>
<body>
  <div class="page">
    ${content}
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ ${bs ? 'Isprintaj / Spremi PDF' : 'Print / Save as PDF'}</button>
</body>
</html>`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API — Report Generators
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 1. WORKERS REPORT — Summary of selected workers
 */
export function generateWorkersReport(workerIds = [], lang = 'bs') {
  const bs = lang === 'bs';
  const company = getCompanyInfo();
  const allWorkers = getAll(COLLECTIONS.WORKERS);
  const workers = workerIds.length > 0
    ? allWorkers.filter(w => workerIds.includes(w.id))
    : allWorkers.filter(w => w.aktivan !== false);

  const allCerts = getAll(COLLECTIONS.CERTIFICATES);
  const allPPE = getAll(COLLECTIONS.PPE_ASSIGNMENTS);

  const title = bs ? 'EVIDENCIJA RADNIKA' : 'WORKER REGISTRY';
  const subtitle = bs
    ? `${workers.length} radnika · Datum ispisa: ${new Date().toLocaleDateString('bs-BA')}`
    : `${workers.length} workers · Print date: ${new Date().toLocaleDateString('en-GB')}`;

  const activeCount = workers.filter(w => w.aktivan !== false).length;
  const certsExpiring = allCerts.filter(c => {
    const d = daysUntil(c.vrijediDo);
    return d !== null && d >= 0 && d <= 30;
  }).length;

  let html = buildHeader(title, subtitle, company);

  // Stats
  html += `
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--accent)">${workers.length}</div><div class="stat-lbl">${bs ? 'Ukupno radnika' : 'Total workers'}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#2e7d32">${activeCount}</div><div class="stat-lbl">${bs ? 'Aktivni' : 'Active'}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#e65100">${certsExpiring}</div><div class="stat-lbl">${bs ? 'Uvjerenja ističu' : 'Certs expiring'}</div></div>
    </div>
  `;

  // Table
  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${bs ? 'Ime i prezime' : 'Full name'}</th>
      <th>${bs ? 'JMBG' : 'ID No.'}</th>
      <th>${bs ? 'Radno mjesto' : 'Workplace'}</th>
      <th>${bs ? 'Org. jedinica' : 'Org. unit'}</th>
      <th style="text-align:center">${bs ? 'Uvj.' : 'Certs'}</th>
      <th style="text-align:center">${bs ? 'OZO' : 'PPE'}</th>
      <th>${bs ? 'Status' : 'Status'}</th>
    </tr></thead>
    <tbody>`;

  workers.forEach((w, i) => {
    const wCerts = allCerts.filter(c => c.workerId === w.id);
    const wPPE = allPPE.filter(p => p.workerId === w.id);
    const aktivan = w.aktivan !== false;
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${w.ime || ''} ${w.prezime || ''}</td>
      <td>${w.jmbg || '—'}</td>
      <td>${w.radnoMjesto || '—'}</td>
      <td>${w.orgJedinica || '—'}</td>
      <td style="text-align:center;font-weight:600">${wCerts.length}</td>
      <td style="text-align:center;font-weight:600">${wPPE.length}</td>
      <td><span class="badge ${aktivan ? 'badge-ok' : 'badge-neutral'}">${aktivan ? (bs ? 'Aktivan' : 'Active') : (bs ? 'Neaktivan' : 'Inactive')}</span></td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs);

  const doc = wrapDocument(html, title, false, bs, company.accentColor);
  openPrintWindow(doc, title);
}

/**
 * 2. CERTIFICATES REPORT — Certificate status overview
 */
export function generateCertificatesReport(certIds = [], lang = 'bs') {
  const bs = lang === 'bs';
  const company = getCompanyInfo();
  const allCerts = getAll(COLLECTIONS.CERTIFICATES);
  const workers = getAll(COLLECTIONS.WORKERS);
  const certs = certIds.length > 0
    ? allCerts.filter(c => certIds.includes(c.id))
    : allCerts;

  const title = bs ? 'PREGLED UVJERENJA I CERTIFIKATA' : 'CERTIFICATE STATUS REPORT';
  const expired = certs.filter(c => daysUntil(c.vrijediDo) !== null && daysUntil(c.vrijediDo) < 0).length;
  const expiring = certs.filter(c => {
    const d = daysUntil(c.vrijediDo);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const valid = certs.length - expired - expiring;
  const subtitle = `${certs.length} ${bs ? 'zapisa' : 'records'} · ${new Date().toLocaleDateString('bs-BA')}`;

  let html = buildHeader(title, subtitle, company);

  html += `
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--accent)">${certs.length}</div><div class="stat-lbl">${bs ? 'Ukupno' : 'Total'}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#2e7d32">${valid}</div><div class="stat-lbl">${bs ? 'Važeća' : 'Valid'}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#e65100">${expiring}</div><div class="stat-lbl">${bs ? 'Ističu ≤30d' : 'Expiring ≤30d'}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#c62828">${expired}</div><div class="stat-lbl">${bs ? 'Istekla' : 'Expired'}</div></div>
    </div>
  `;

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${bs ? 'Radnik' : 'Worker'}</th>
      <th>${bs ? 'Naziv uvjerenja' : 'Certificate name'}</th>
      <th>${bs ? 'Oznaka' : 'Code'}</th>
      <th>${bs ? 'Izdano' : 'Issued'}</th>
      <th>${bs ? 'Važi do' : 'Valid until'}</th>
      <th>${bs ? 'Status' : 'Status'}</th>
    </tr></thead>
    <tbody>`;

  certs.sort((a, b) => {
    const da = daysUntil(a.vrijediDo) ?? 9999;
    const db_ = daysUntil(b.vrijediDo) ?? 9999;
    return da - db_;
  }).forEach((c, i) => {
    const w = workers.find(x => x.id === c.workerId);
    const days = daysUntil(c.vrijediDo);
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${w ? `${w.ime} ${w.prezime}` : '—'}</td>
      <td>${c.ime || c.naziv || '—'}</td>
      <td>${c.oznaka || '—'}</td>
      <td>${fmtDate(c.datum)}</td>
      <td style="font-weight:600">${fmtDate(c.vrijediDo)}</td>
      <td>${statusBadge(days, bs)}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor), title);
}

/**
 * 3. PPE REPORT — Personal Protective Equipment assignments
 */
export function generatePPEReport(assignmentIds = [], lang = 'bs') {
  const bs = lang === 'bs';
  const company = getCompanyInfo();
  const allPPE = getAll(COLLECTIONS.PPE_ASSIGNMENTS);
  const workers = getAll(COLLECTIONS.WORKERS);
  const assignments = assignmentIds.length > 0
    ? allPPE.filter(p => assignmentIds.includes(p.id))
    : allPPE;

  const title = bs ? 'EVIDENCIJA OSOBNE ZAŠTITNE OPREME (OZO)' : 'PERSONAL PROTECTIVE EQUIPMENT (PPE) REPORT';
  const subtitle = `${assignments.length} ${bs ? 'zaduženja' : 'assignments'} · ${new Date().toLocaleDateString('bs-BA')}`;

  let html = buildHeader(title, subtitle, company);

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${bs ? 'Radnik' : 'Worker'}</th>
      <th>${bs ? 'Naziv opreme' : 'Equipment name'}</th>
      <th style="text-align:center">${bs ? 'Količina' : 'Qty'}</th>
      <th>${bs ? 'Datum zaduženja' : 'Assigned on'}</th>
      <th>${bs ? 'Rok zamjene' : 'Replace by'}</th>
      <th>${bs ? 'Status' : 'Status'}</th>
    </tr></thead>
    <tbody>`;

  assignments.sort((a, b) => {
    const da = daysUntil(a.rokZamjene || a.vrijediDo) ?? 9999;
    const db_ = daysUntil(b.rokZamjene || b.vrijediDo) ?? 9999;
    return da - db_;
  }).forEach((p, i) => {
    const w = workers.find(x => x.id === p.workerId);
    const days = daysUntil(p.rokZamjene || p.vrijediDo);
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${w ? `${w.ime} ${w.prezime}` : '—'}</td>
      <td>${p.naziv || p.oprema || '—'}</td>
      <td style="text-align:center">${p.kolicina || p.quantity || 1}</td>
      <td>${fmtDate(p.datumZaduzenja || p.datum)}</td>
      <td style="font-weight:600">${fmtDate(p.rokZamjene || p.vrijediDo)}</td>
      <td>${statusBadge(days, bs)}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor), title);
}

/**
 * 4. EQUIPMENT REPORT — Work equipment & inspection status
 */
export function generateEquipmentReport(equipmentIds = [], lang = 'bs') {
  const bs = lang === 'bs';
  const company = getCompanyInfo();
  const allEquip = getAll(COLLECTIONS.EQUIPMENT);
  const items = equipmentIds.length > 0
    ? allEquip.filter(e => equipmentIds.includes(e.id))
    : allEquip;

  const title = bs ? 'EVIDENCIJA SREDSTAVA RADA I OPREME' : 'WORK EQUIPMENT INSPECTION REPORT';
  const subtitle = `${items.length} ${bs ? 'stavki' : 'items'} · ${new Date().toLocaleDateString('bs-BA')}`;

  let html = buildHeader(title, subtitle, company);

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${bs ? 'Naziv' : 'Name'}</th>
      <th>${bs ? 'Tip' : 'Type'}</th>
      <th>${bs ? 'Serijski broj' : 'Serial No.'}</th>
      <th>${bs ? 'Lokacija' : 'Location'}</th>
      <th>${bs ? 'Zadnji pregled' : 'Last inspected'}</th>
      <th>${bs ? 'Sljedeći pregled' : 'Next inspection'}</th>
      <th>${bs ? 'Status' : 'Status'}</th>
    </tr></thead>
    <tbody>`;

  items.sort((a, b) => {
    const da = daysUntil(a.sljedeciPregled || a.datumIsteka) ?? 9999;
    const db_ = daysUntil(b.sljedeciPregled || b.datumIsteka) ?? 9999;
    return da - db_;
  }).forEach((e, i) => {
    const days = daysUntil(e.sljedeciPregled || e.datumIsteka);
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${e.naziv || '—'}</td>
      <td>${e.tip || e.vrsta || '—'}</td>
      <td>${e.serijskiBroj || '—'}</td>
      <td>${e.lokacija || '—'}</td>
      <td>${fmtDate(e.zadnjiPregled || e.datumPregleda)}</td>
      <td style="font-weight:600">${fmtDate(e.sljedeciPregled || e.datumIsteka)}</td>
      <td>${statusBadge(days, bs)}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor), title);
}

/**
 * 5. FLEET REPORT — Vehicle fleet status
 */
export function generateFleetReport(vehicleIds = [], lang = 'bs') {
  const bs = lang === 'bs';
  const company = getCompanyInfo();
  const allVehicles = getAll(COLLECTIONS.VEHICLES);
  const vehicles = vehicleIds.length > 0
    ? allVehicles.filter(v => vehicleIds.includes(v.id))
    : allVehicles;

  const title = bs ? 'EVIDENCIJA VOZNOG PARKA' : 'FLEET REGISTRY REPORT';
  const subtitle = `${vehicles.length} ${bs ? 'vozila' : 'vehicles'} · ${new Date().toLocaleDateString('bs-BA')}`;

  let html = buildHeader(title, subtitle, company);

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${bs ? 'Marka / Model' : 'Make / Model'}</th>
      <th>${bs ? 'Registracija' : 'Plate No.'}</th>
      <th>${bs ? 'God. proizv.' : 'Year'}</th>
      <th>${bs ? 'Registr. do' : 'Reg. until'}</th>
      <th>${bs ? 'Tehn. pregled' : 'Tech. insp.'}</th>
      <th>${bs ? 'Status' : 'Status'}</th>
    </tr></thead>
    <tbody>`;

  vehicles.sort((a, b) => {
    const da = daysUntil(a.registracijaDo || a.istekRegistracije) ?? 9999;
    const db_ = daysUntil(b.registracijaDo || b.istekRegistracije) ?? 9999;
    return da - db_;
  }).forEach((v, i) => {
    const days = daysUntil(v.registracijaDo || v.istekRegistracije);
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${v.marka || ''} ${v.model || ''}</td>
      <td style="font-weight:700;color:var(--accent)">${v.registracija || '—'}</td>
      <td>${v.godinaProizvodnje || v.godina || '—'}</td>
      <td style="font-weight:600">${fmtDate(v.registracijaDo || v.istekRegistracije)}</td>
      <td>${fmtDate(v.tehnickiPregled || v.datumTehnPregleda)}</td>
      <td>${statusBadge(days, bs)}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor), title);
}

/**
 * 6. FIRE PROTECTION REPORT — Fire extinguishers & equipment
 */
export function generateFireProtectionReport(itemIds = [], lang = 'bs') {
  const bs = lang === 'bs';
  const company = getCompanyInfo();
  const allFE = getAll(COLLECTIONS.FIRE_EXTINGUISHERS);
  const items = itemIds.length > 0
    ? allFE.filter(f => itemIds.includes(f.id))
    : allFE;

  const title = bs ? 'EVIDENCIJA SREDSTAVA ZAŠTITE OD POŽARA' : 'FIRE PROTECTION EQUIPMENT REPORT';
  const subtitle = `${items.length} ${bs ? 'stavki' : 'items'} · ${new Date().toLocaleDateString('bs-BA')}`;

  const expired = items.filter(f => {
    const d = daysUntil(f.sljedeciPregled || f.datumIsteka);
    return d !== null && d < 0;
  }).length;

  let html = buildHeader(title, subtitle, company);

  html += `
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--accent)">${items.length}</div><div class="stat-lbl">${bs ? 'Ukupno' : 'Total'}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#2e7d32">${items.length - expired}</div><div class="stat-lbl">${bs ? 'Ispravno' : 'Serviced'}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#c62828">${expired}</div><div class="stat-lbl">${bs ? 'Istekao servis' : 'Overdue'}</div></div>
    </div>
  `;

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${bs ? 'Lokacija' : 'Location'}</th>
      <th>${bs ? 'Tip' : 'Type'}</th>
      <th>${bs ? 'Serijski broj' : 'Serial No.'}</th>
      <th>${bs ? 'Zadnji pregled' : 'Last inspection'}</th>
      <th>${bs ? 'Sljedeći pregled' : 'Next inspection'}</th>
      <th>${bs ? 'Status' : 'Status'}</th>
    </tr></thead>
    <tbody>`;

  items.sort((a, b) => {
    const da = daysUntil(a.sljedeciPregled || a.datumIsteka) ?? 9999;
    const db_ = daysUntil(b.sljedeciPregled || b.datumIsteka) ?? 9999;
    return da - db_;
  }).forEach((f, i) => {
    const days = daysUntil(f.sljedeciPregled || f.datumIsteka);
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${f.lokacija || '—'}</td>
      <td>${f.tip || f.vrsta || '—'}</td>
      <td>${f.serijskiBroj || '—'}</td>
      <td>${fmtDate(f.zadnjiPregled || f.datumPregleda)}</td>
      <td style="font-weight:600">${fmtDate(f.sljedeciPregled || f.datumIsteka)}</td>
      <td>${statusBadge(days, bs)}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor), title);
}
