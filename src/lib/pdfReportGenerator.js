'use client';
import { t } from '@/i18n/translations';

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
import { getPdfBranding, EZNR_DEFAULTS, PDF_DEFAULTS, getWatermarkCSS } from './brandingService';

// ─── Shared CSS for all reports ──────────────────────────────────────────────
const SHARED_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 9pt; color: #1a1a2e; background: #fff; }

  .page { width: 100%; padding: 12mm 14mm; position: relative; }

  /* Watermark behind content */
  .watermark {
    position: fixed;
    z-index: 0;
    pointer-events: none;
    opacity: 0.045;
    padding: 10mm;
  }
  .watermark img { object-fit: contain; display: block; }
  .watermark .wm-name { font-size: 28pt; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #000; }

  /* Header bar */
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid var(--accent); padding-bottom: 12px; margin-bottom: 16px; position: relative; z-index: 1; }
  .report-header .brand { display: flex; align-items: center; gap: 10px; }
  .report-header .brand-logo { height: 40px; max-width: 160px; object-fit: contain; }
  .report-header .brand-name { font-size: 14pt; font-weight: 800; color: var(--accent); letter-spacing: -0.3px; }
  .report-header .company-info { text-align: right; font-size: 8pt; color: #555; line-height: 1.5; }
  .report-header .company-name { font-size: 10pt; font-weight: 700; color: #1a1a2e; }

  /* Report title */
  .report-title { font-size: 13pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #1a1a2e; margin-bottom: 4px; position: relative; z-index: 1; }
  .report-subtitle { font-size: 8pt; color: #888; margin-bottom: 16px; position: relative; z-index: 1; }

  /* Stat boxes */
  .stat-row { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; position: relative; z-index: 1; }
  .stat-box { flex: 1; min-width: 100px; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 10px; text-align: center; background: #fff; }
  .stat-box .stat-val { font-size: 16pt; font-weight: 800; }
  .stat-box .stat-lbl { font-size: 7pt; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin-top: 2px; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; position: relative; z-index: 1; }
  th { background: #f5f6fa; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #555; padding: 7px 8px; text-align: left; border-bottom: 2px solid #e0e0e0; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 8.5pt; vertical-align: top; background: #fff; }
  tr:last-child td { border-bottom: 1px solid #ccc; }
  tbody tr:nth-child(even) td { background: #fafbfd; }

  /* Status badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 7pt; font-weight: 700; letter-spacing: 0.3px; }
  .badge-ok { background: #e8f5e9; color: #2e7d32; }
  .badge-warn { background: #fff3e0; color: #e65100; }
  .badge-danger { background: #ffebee; color: #c62828; }
  .badge-neutral { background: #f5f5f5; color: #666; }

  /* Footer */
  .report-footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; font-size: 7pt; color: #aaa; position: relative; z-index: 1; }

  /* Print button */
  .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 12px 28px; background: var(--accent); color: #fff; border: none; border-radius: 10px; font-size: 11pt; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 999; display: flex; align-items: center; gap: 8px; }
  .print-btn:hover { filter: brightness(0.9); }

  /* Print overrides */
  @media print {
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 8mm 10mm; }
    .print-btn { display: none !important; }
    @page { size: A4; margin: 10mm; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    .watermark { position: fixed; }
  }
`;

const SHARED_CSS_LANDSCAPE = SHARED_CSS.replace(
  '@page { size: A4; margin: 10mm; }',
  '@page { size: A4 landscape; margin: 8mm; }'
);

// ─── Helper: get current company info ────────────────────────────────────────
function getCompanyInfo() {
  const branding = getPdfBranding();
  const companyId = getActiveCompanyId();
  if (!companyId || companyId === 'all') return { naziv: '', adresa: '', jib: '', logo: '', accentColor: EZNR_DEFAULTS.accentColor, ...PDF_DEFAULTS };
  const company = getById('companies', companyId);
  return {
    ...(company || { naziv: '', adresa: '', jib: '' }),
    logo: branding.logo,
    accentColor: branding.accentColor || EZNR_DEFAULTS.accentColor,
    watermarkEnabled: branding.watermarkEnabled ?? PDF_DEFAULTS.watermarkEnabled,
    watermarkPosition: branding.watermarkPosition || PDF_DEFAULTS.watermarkPosition,
    watermarkOpacity: branding.watermarkOpacity ?? PDF_DEFAULTS.watermarkOpacity,
    watermarkSize: branding.watermarkSize || PDF_DEFAULTS.watermarkSize,
    watermarkContent: branding.watermarkContent || PDF_DEFAULTS.watermarkContent,
    logoPosition: branding.logoPosition || PDF_DEFAULTS.logoPosition,
    logoSize: branding.logoSize || PDF_DEFAULTS.logoSize,
    headerEnabled: branding.headerEnabled ?? PDF_DEFAULTS.headerEnabled,
    showCompanyInfo: branding.showCompanyInfo ?? PDF_DEFAULTS.showCompanyInfo,
    showCompanyName: branding.showCompanyName ?? true,
    headerText: branding.headerText || '',
    headerFontSize: branding.headerFontSize || PDF_DEFAULTS.headerFontSize,
    headerBold: branding.headerBold ?? false,
    headerItalic: branding.headerItalic ?? false,
    headerUnderline: branding.headerUnderline ?? false,
    headerColor: branding.headerColor || PDF_DEFAULTS.headerColor,
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
  if (days === null) return `<span class="badge badge-neutral">${t('na')}</span>`;
  if (days < 0) return `<span class="badge badge-danger">${t('isteklo')}</span>`;
  if (days <= 30) return `<span class="badge badge-danger">${t('days').replace('{0}', days)}</span>`;
  if (days <= 90) return `<span class="badge badge-warn">${t('days1').replace('{0}', days)}</span>`;
  return `<span class="badge badge-ok">${t('vrijedi')}</span>`;
}

// ─── Build the branded header ────────────────────────────────────────────────
function buildHeader(title, subtitle, company) {
  if (company.headerEnabled === false) {
    return `
      <div class="report-title">${title}</div>
      <div class="report-subtitle">${subtitle}</div>
    `;
  }

  const companyName = company.naziv || company.name || '';
  const logoSize = company.logoSize || 40;
  const logoPos = company.logoPosition || 'left';

  // Build logo HTML
  let logoHtml = '';
  if (company.logo) {
    logoHtml = `<img class="brand-logo" src="${company.logo}" alt="${companyName}" style="height:${logoSize}px;max-width:${logoSize * 4}px" />`;
  } else if (companyName) {
    logoHtml = `<span class="brand-name">${companyName}</span>`;
  }

  // Header alignment based on logo position
  const headerJustify = logoPos === 'center' ? 'center' : (logoPos === 'right' ? 'flex-end' : 'flex-start');
  const headerFlex = logoPos === 'center' ? 'center' : 'space-between';

  // Custom header text formatting
  let customHeaderHtml = '';
  if (company.headerText) {
    const fs = company.headerFontSize || 12;
    const fw = company.headerBold ? 'font-weight:800;' : '';
    const fi = company.headerItalic ? 'font-style:italic;' : '';
    const fu = company.headerUnderline ? 'text-decoration:underline;' : '';
    const fc = company.headerColor || '#1a1a2e';
    customHeaderHtml = `<div style="font-size:${fs}pt;${fw}${fi}${fu}color:${fc};margin-top:8px">${company.headerText}</div>`;
  }

  return `
    <div class="report-header" style="justify-content:${headerFlex}">
      <div style="text-align:${logoPos === 'center' ? 'center' : 'left'}">
        <div class="brand" style="justify-content:${headerJustify}">
          ${logoHtml}
        </div>
        ${(company.showCompanyName !== false && company.logo && companyName) ? `<div style="font-size:9pt;font-weight:800;color:#222;margin-top:3px;text-align:center;max-width:${logoSize * 4}px">${companyName}</div>` : ''}
      </div>
      ${logoPos !== 'center' && company.showCompanyInfo !== false ? `
      <div class="company-info">
        ${company.adresa || company.address ? `<div>${company.adresa || company.address}</div>` : ''}
        ${company.mjesto ? `<div>${company.mjesto}${company.postanskiBroj ? ` ${company.postanskiBroj}` : ''}</div>` : ''}
        ${company.jib || company.oib || company.id_number ? `<div>JIB: ${company.jib || company.oib || company.id_number}</div>` : ''}
        ${company.telefon ? `<div>Tel: ${company.telefon}</div>` : ''}
      </div>` : ''}
    </div>
    ${customHeaderHtml}
    <div class="report-title">${title}</div>
    <div class="report-subtitle">${subtitle}</div>
  `;
}

// ─── Build footer ────────────────────────────────────────────────────────────
function buildFooter(bs, company) {
  const companyName = company?.naziv || company?.name || '';
  return `
    <div class="report-footer">
      <span>${companyName}</span>
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
function wrapDocument(content, title, landscape = false, bs = true, accentColor = EZNR_DEFAULTS.accentColor, company = {}) {
  const accentVar = `--accent: ${accentColor};`;
  const companyName = company.naziv || company.name || '';
  const wmEnabled = company.watermarkEnabled ?? true;
  const wmPos = getWatermarkCSS(company.watermarkPosition || 'center');
  const wmOpacity = (company.watermarkOpacity ?? 5) / 100;
  const wmSize = company.watermarkSize || 280;
  const wmContent = company.watermarkContent || 'both';

  let watermarkHtml = '';
  if (wmEnabled && (company.logo || companyName)) {
    const showLogo = wmContent === 'logo' || wmContent === 'both';
    const showName = wmContent === 'name' || wmContent === 'both';
    // Calculate margin auto overrides based on ta
    const imgMargin = wmPos.ta === 'center' ? '0 auto 12px' : wmPos.ta === 'left' ? '0 auto 12px 0' : '0 0 12px auto';
    watermarkHtml = `
      <div class="watermark" style="opacity:${wmOpacity}; text-align:${wmPos.ta}; top:${wmPos.top || 'auto'}; bottom:${wmPos.bottom || 'auto'}; left:${wmPos.left || 'auto'}; right:${wmPos.right || 'auto'}; transform:${wmPos.transform};">
        ${showLogo && company.logo ? `<img src="${company.logo}" alt="" style="width:${wmSize}px;height:auto;max-width:100%;margin:${imgMargin};object-fit:contain" />` : ''}
        ${showName && companyName ? `<div class="wm-name" style="font-size:${Math.round(wmSize / 10)}pt">${companyName}</div>` : ''}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="${t('en1')}">
<head>
  <meta charset="UTF-8"/>
  <title>${title} — ${companyName || 'Report'}</title>
  <style>
    :root { ${accentVar} }
    ${landscape ? SHARED_CSS_LANDSCAPE : SHARED_CSS}
  </style>
</head>
<body>
  ${watermarkHtml}
  <div class="page">
    ${content}
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ ${t('printSaveAsPdf')}</button>
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
  const bs = lang !== 'en';
  const company = getCompanyInfo();
  const allWorkers = getAll(COLLECTIONS.WORKERS);
  const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
  const workplaces = getAll(COLLECTIONS.WORKPLACES);
  const uniqueWorkerIds = [...new Set(workerIds || [])];
  let workers = uniqueWorkerIds.length > 0
    ? uniqueWorkerIds.map(id => allWorkers.find(w => w.id === id)).filter(Boolean)
    : allWorkers.filter(w => w.aktivan !== false);

  const allCerts = getAll(COLLECTIONS.CERTIFICATES);
  const allPPE = getAll(COLLECTIONS.PPE_ASSIGNMENTS);

  const title = t('workerRegistry');
  const subtitle = t('workersPrintDate').replace('{0}', workers.length).replace('{1}', new Date().toLocaleDateString('bs-BA')).replace('{2}', new Date().toLocaleDateString('en-GB'));

  const activeCount = workers.filter(w => w.aktivan !== false).length;
  const certsExpiring = allCerts.filter(c => {
    const d = daysUntil(c.vrijediDo);
    return d !== null && d >= 0 && d <= 30;
  }).length;

  let html = buildHeader(title, subtitle, company);

  // Stats
  html += `
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--accent)">${workers.length}</div><div class="stat-lbl">${t('totalWorkers')}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#2e7d32">${activeCount}</div><div class="stat-lbl">${t('aktivni')}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#e65100">${certsExpiring}</div><div class="stat-lbl">${t('certsExpiring')}</div></div>
    </div>
  `;

  // Table
  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${t('imeIPrezime1')}</th>
      <th>${t('jmbg')}</th>
      <th>${t('radnoMjesto')}</th>
      <th>${t('orgJedinica1')}</th>
      <th style="text-align:center">${t('certs')}</th>
      <th style="text-align:center">${t('ozoOprema')}</th>
      <th>${t('status')}</th>
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
      <td>${workplaces.find(wp => wp.id === w.radnoMjestoId)?.naziv || '—'}</td>
      <td>${orgUnits.find(ou => ou.id === w.orgJedinicaId)?.naziv || '—'}</td>
      <td style="text-align:center;font-weight:600">${wCerts.length}</td>
      <td style="text-align:center;font-weight:600">${wPPE.length}</td>
      <td><span class="badge ${aktivan ? 'badge-ok' : 'badge-neutral'}">${aktivan ? (t('aktivan')) : (t('neaktivan'))}</span></td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs, company);

  const doc = wrapDocument(html, title, false, bs, company.accentColor, company);
  openPrintWindow(doc, title);
}

/**
 * 2. CERTIFICATES REPORT — Certificate status overview
 */
export function generateCertificatesReport(certIds = [], lang = 'bs') {
  const bs = lang !== 'en';
  const company = getCompanyInfo();
  const allCerts = getAll(COLLECTIONS.CERTIFICATES);
  const workers = getAll(COLLECTIONS.WORKERS);
  const uniqueCertIds = [...new Set(certIds || [])];
  const certs = uniqueCertIds.length > 0
    ? uniqueCertIds.map(id => allCerts.find(c => c.id === id)).filter(Boolean)
    : allCerts;

  const title = t('certificateStatusReport');
  const expired = certs.filter(c => daysUntil(c.vrijediDo) !== null && daysUntil(c.vrijediDo) < 0).length;
  const expiring = certs.filter(c => {
    const d = daysUntil(c.vrijediDo);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const valid = certs.length - expired - expiring;
  const subtitle = `${certs.length} ${t('zapisa')} · ${new Date().toLocaleDateString('bs-BA')}`;

  let html = buildHeader(title, subtitle, company);

  html += `
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--accent)">${certs.length}</div><div class="stat-lbl">${t('ukupno1')}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#2e7d32">${valid}</div><div class="stat-lbl">${t('vazeca')}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#e65100">${expiring}</div><div class="stat-lbl">${t('istice30d')}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#c62828">${expired}</div><div class="stat-lbl">${t('istekla')}</div></div>
    </div>
  `;

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${t('radnik1')}</th>
      <th>${t('nazivUvjerenja1')}</th>
      <th>${t('oznaka')}</th>
      <th>${t('issued')}</th>
      <th>${t('vrijediDo')}</th>
      <th>${t('status')}</th>
    </tr></thead>
    <tbody>`;

  certs.forEach((c, i) => {
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
  html += buildFooter(bs, company);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor, company), title);
}

/**
 * 3. PPE REPORT — Personal Protective Equipment assignments
 */
export function generatePPEReport(assignmentIds = [], lang = 'bs') {
  const bs = lang !== 'en';
  const company = getCompanyInfo();
  const allPPE = getAll(COLLECTIONS.PPE_ASSIGNMENTS);
  const workers = getAll(COLLECTIONS.WORKERS);
  const assignments = assignmentIds.length > 0
    ? assignmentIds.map(id => allPPE.find(p => p.id === id)).filter(Boolean)
    : allPPE;

  const title = t('personalProtectiveEquipmentPpeReport');
  const subtitle = `${assignments.length} ${t('fleetAssignments')} · ${new Date().toLocaleDateString('bs-BA')}`;

  let html = buildHeader(title, subtitle, company);

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${t('radnik1')}</th>
      <th>${t('equipmentName')}</th>
      <th style="text-align:center">${t('kolicina')}</th>
      <th>${t('datumZaduzenja')}</th>
      <th>${t('replaceBy')}</th>
      <th>${t('status')}</th>
    </tr></thead>
    <tbody>`;

  assignments.forEach((p, i) => {
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
  html += buildFooter(bs, company);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor, company), title);
}

/**
 * 4. EQUIPMENT REPORT — Work equipment & inspection status
 */
export function generateEquipmentReport(equipmentIds = [], lang = 'bs') {
  const bs = lang !== 'en';
  const company = getCompanyInfo();
  const allEquip = getAll(COLLECTIONS.EQUIPMENT);
  let items = equipmentIds.length > 0
    ? equipmentIds.map(id => allEquip.find(e => e.id === id)).filter(Boolean)
    : allEquip;

  const title = t('workEquipmentInspectionReport');
  const subtitle = `${items.length} ${t('stavke')} · ${new Date().toLocaleDateString('bs-BA')}`;

  let html = buildHeader(title, subtitle, company);

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${t('naziv')}</th>
      <th>${t('tip')}</th>
      <th>${t('serialNumber')}</th>
      <th>${t('lokacija')}</th>
      <th>${t('lastInspected')}</th>
      <th>${t('nextExam')}</th>
      <th>${t('status')}</th>
    </tr></thead>
    <tbody>`;

  items.forEach((e, i) => {
    const days = daysUntil(e.iduci || e.sljedeciPregled || e.datumIsteka);
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${e.naziv || '—'}</td>
      <td>${e.tip || e.vrsta || '—'}</td>
      <td>${e.tvBroj || e.serijskiBroj || e.invBroj || '—'}</td>
      <td>${e.lokacija || '—'}</td>
      <td>${fmtDate(e.posljednji || e.zadnjiPregled || e.datumPregleda)}</td>
      <td style="font-weight:600">${fmtDate(e.iduci || e.sljedeciPregled || e.datumIsteka)}</td>
      <td>${statusBadge(days, bs)}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs, company);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor, company), title);
}

/**
 * 5. FLEET REPORT — Vehicle fleet status
 */
export function generateFleetReport(vehicleIds = [], lang = 'bs') {
  const bs = lang !== 'en';
  const company = getCompanyInfo();
  const allVehicles = getAll(COLLECTIONS.VEHICLES);
  let vehicles = vehicleIds.length > 0
    ? vehicleIds.map(id => allVehicles.find(v => v.id === id)).filter(Boolean)
    : allVehicles;

  const title = t('fleetRegistryReport');
  const subtitle = `${vehicles.length} ${t('vozila')} · ${new Date().toLocaleDateString('bs-BA')}`;

  let html = buildHeader(title, subtitle, company);

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${t('makeModel')}</th>
      <th>${t('plateNo')}</th>
      <th>${t('godina')}</th>
      <th>${t('driver9')}</th>
      <th>${t('regUntil')}</th>
      <th>${t('techUntil')}</th>
      <th>${t('insUntil')}</th>
    </tr></thead>
    <tbody>`;

  vehicles.forEach((v, i) => {
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${v.marka || ''} ${v.model || ''}</td>
      <td style="font-weight:700;color:var(--accent)">${v.registracija || '—'}</td>
      <td>${v.godinaProizvodnje || v.godina || '—'}</td>
      <td>${v.vozacIme || '—'}</td>
      <td style="font-weight:600">${fmtDate(v.registracijaIstice || v.registracijaDo || v.istekRegistracije)}</td>
      <td>${fmtDate(v.tehnickiIstice || v.sljedeciTehnicki || v.tehnickiPregled || v.datumTehnPregleda)}</td>
      <td>${fmtDate(v.osiguranjeIstice || v.osiguranjeDo)}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs, company);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor, company), title);
}

/**
 * 6. FIRE PROTECTION REPORT — Fire extinguishers & equipment
 */
export function generateFireProtectionReport(itemIds = [], lang = 'bs', type = 'extinguishers') {
  const bs = lang !== 'en';
  const company = getCompanyInfo();
  const allFE = getAll(type === 'hydrants' ? COLLECTIONS.HYDRANTS : COLLECTIONS.FIRE_EXTINGUISHERS);
  let items = itemIds.length > 0
    ? itemIds.map(id => allFE.find(f => f.id === id)).filter(Boolean)
    : allFE;
  const title = t('fireProtectionEquipmentReport');
  const subtitle = `${items.length} ${t('stavke')} · ${new Date().toLocaleDateString('bs-BA')}`;

  const expired = items.filter(f => {
    const d = daysUntil(f.sljedeciPregled || f.sljedeciServis || f.datumIsteka);
    return d !== null && d < 0;
  }).length;

  let html = buildHeader(title, subtitle, company);

  html += `
    <div class="stat-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--accent)">${items.length}</div><div class="stat-lbl">${t('ukupno1')}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#2e7d32">${items.length - expired}</div><div class="stat-lbl">${t('serviced')}</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#c62828">${expired}</div><div class="stat-lbl">${t('overdue')}</div></div>
    </div>
  `;

  html += `<table>
    <thead><tr>
      <th style="width:3%">#</th>
      <th>${t('lokacija')}</th>
      <th>${t('tip')}</th>
      <th>${t('serialNumber')}</th>
      <th>${t('lastActivity')}</th>
      <th>${t('nextActivity')}</th>
      <th>${t('status')}</th>
    </tr></thead>
    <tbody>`;

  items.forEach((f, i) => {
    const days = daysUntil(f.sljedeciPregled || f.sljedeciServis || f.datumIsteka);
    html += `<tr>
      <td style="color:#aaa">${i + 1}</td>
      <td style="font-weight:600">${f.lokacija || '—'}</td>
      <td>${f.tip || f.vrsta || '—'}</td>
      <td>${f.serijskiBroj || f.oznaka || '—'}</td>
      <td>${fmtDate(f.zadnjiPregled || f.zadnjiServis || f.datumZadnjegPregleda || f.datumPregleda)}</td>
      <td style="font-weight:600">${fmtDate(f.sljedeciPregled || f.sljedeciServis || f.datumIsteka)}</td>
      <td>${statusBadge(days, bs)}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  html += buildFooter(bs, company);

  openPrintWindow(wrapDocument(html, title, false, bs, company.accentColor, company), title);
}


export function generateObservationsReport(obsIds = [], lang = 'bs') {
    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF('l', 'mm', 'a4');
    
    let obsList = window.__EZNR_DATASTORE?.safety_observations || [];
    if (obsIds.length > 0) {
        obsList = obsList.filter(o => obsIds.includes(o.id));
    }
    
    // Removed sort to preserve input order

    doc.setFontSize(16);
    doc.text(t('observations'), 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${t('generatedOn')}: ${new Date().toLocaleDateString()}`, 14, 28);
    
    const tableData = obsList.map((o, i) => [
        i + 1,
        o.datum ? new Date(o.datum).toLocaleDateString() : '',
        o.lokacija || '',
        o.opis || '',
        o.ime || '',
        o.status || ''
    ]);

    doc.autoTable({
        startY: 35,
        head: [[
            '#', 
            t('datum'), 
            t('lokacija'), 
            t('opis'), 
            t('reporter'),
            'Status'
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [0, 191, 166] },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 25 },
            2: { cellWidth: 50 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 35 },
            5: { cellWidth: 25 }
        }
    });

    doc.save('prijave_opasnosti.pdf');
}
