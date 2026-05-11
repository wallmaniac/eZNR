/**
 * obrasciPdfGenerator.js
 * ─────────────────────────────────────────────────────────────────────
 * Generates official ZNR forms as print-ready HTML documents.
 * Dynamically adapts to BA or HR jurisdiction.
 * ─────────────────────────────────────────────────────────────────────
 */

import { PRAVILNICI } from '@/lib/lawConfig';

const FORM_STYLES = `
  @page { size: A4; margin: 15mm 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; color: #111; background: #fff; line-height: 1.45; }
  .page { width: 100%; max-width: 210mm; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2.5px solid #1a365d; padding-bottom: 10px; margin-bottom: 12px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .header-logo img { max-height: 50px; max-width: 150px; object-fit: contain; }
  .header-company { text-align: left; flex: 1; }
  .header-company-name { font-size: 11pt; font-weight: 800; color: #1a365d; }
  .header-company-details { font-size: 7.5pt; color: #666; line-height: 1.3; margin-top: 2px; }
  .form-title { font-size: 12pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #1a365d; margin: 6px 0 2px; }
  .form-subtitle { font-size: 8pt; color: #555; font-style: italic; }
  .form-ref { font-size: 7.5pt; color: #888; margin-top: 4px; }
  .section { margin-bottom: 10px; page-break-inside: avoid; }
  .section-title { font-size: 8.5pt; font-weight: 800; color: #fff; background: #1a365d; padding: 4px 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0; }
  .section-body { border: 1px solid #ccc; border-top: none; padding: 0; }
  .field-row { display: flex; border-bottom: 1px solid #e0e0e0; min-height: 24px; }
  .field-row:last-child { border-bottom: none; }
  .field-label { width: 42%; padding: 4px 8px; font-size: 8pt; font-weight: 600; color: #333; background: #f7f8fa; border-right: 1px solid #e0e0e0; display: flex; align-items: center; }
  .field-value { flex: 1; padding: 4px 8px; font-size: 9pt; min-height: 24px; display: flex; align-items: center; }
  .field-value.empty { color: #bbb; font-style: italic; }
  .field-row-full { padding: 4px 8px; border-bottom: 1px solid #e0e0e0; }
  .field-row-full:last-child { border-bottom: none; }
  .field-row-full .fl { font-size: 8pt; font-weight: 600; color: #333; margin-bottom: 2px; }
  .field-row-full .fv { font-size: 9pt; min-height: 20px; padding-left: 4px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 24px; gap: 16px; page-break-inside: avoid; }
  .sig-block { flex: 1; text-align: center; }
  .sig-role { font-size: 7.5pt; color: #666; font-weight: 600; margin-bottom: 4px; }
  .sig-line { border-top: 1.5px solid #333; margin-top: 36px; padding-top: 3px; font-size: 8.5pt; font-weight: 600; }
  .sig-note { font-size: 7pt; color: #999; margin-top: 1px; }
  .footer { border-top: 2px solid #1a365d; margin-top: 16px; padding-top: 6px; font-size: 7pt; color: #999; text-align: center; }
  .stamp-area { width: 80px; height: 80px; border: 1.5px dashed #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 7pt; color: #ccc; margin: 0 auto; }
  .no-print { padding: 12px; text-align: center; background: #f0f9ff; border-bottom: 1px solid #ccc; }
  .no-print button { padding: 8px 24px; font-size: 11pt; cursor: pointer; background: #1a365d; color: white; border: none; border-radius: 6px; font-weight: 700; }
  @media print { .no-print { display: none !important; } }
`;

/** Format a date string to DD.MM.YYYY. or blank line */
function fmtD(d) {
  if (!d) return '____.____._________.';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}.`;
  } catch { return d; }
}

function blank(len = 30) {
  return '_'.repeat(len);
}

function fieldRow(label, value) {
  const v = value || '';
  return `<div class="field-row"><div class="field-label">${label}</div><div class="field-value${v ? '' : ' empty'}">${v || blank()}</div></div>`;
}

function fieldRowFull(label, value) {
  const v = value || '';
  return `<div class="field-row-full"><div class="fl">${label}</div><div class="fv">${v || blank(60)}</div></div>`;
}

function headerHtml(company, formTitle, formSubtitle, legalRef) {
  const logo = company?.logo ? `<div class="header-logo"><img src="${company.logo}" /></div>` : '';
  return `
    <div class="header">
      <div class="header-top">
        <div class="header-company">
          <div class="header-company-name">${company?.naziv || blank(40)}</div>
          <div class="header-company-details">${[company?.adresa, company?.mjesto, company?.postanskiBroj].filter(Boolean).join(', ') || blank(40)}<br>${company?.oib ? 'ID: ' + company.oib : ''}</div>
        </div>
        ${logo}
      </div>
      <div class="form-title">${formTitle}</div>
      <div class="form-subtitle">${formSubtitle}</div>
      <div class="form-ref">${legalRef}</div>
    </div>`;
}

function footerHtml(company) {
  return `<div class="footer">${company?.naziv || ''} — Generirano putem eZNR platforme (zastitanaradu.ba) — ${fmtD(new Date().toISOString())}</div>`;
}

function printBar() {
  return `<div class="no-print"><button onclick="window.print()">🖨️ Isprintaj / Preuzmi PDF</button></div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  OBRAZAC BROJ 1 — Izvještaj o povredi na radu
// ═══════════════════════════════════════════════════════════════════════════
export function generateObrazac1(data = {}) {
  const c = data.company || {};
  const w = data.worker || {};
  const i = data.injury || {};
  const country = c.country || 'BA';
  const prav = PRAVILNICI[country]?.find(p => p.id === 'injury-report') || PRAVILNICI.BA.find(p => p.id === 'injury-report');
  
  return `<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8"><title>Obrazac br. 1 — ${country === 'HR' ? 'Prijava ozljede na radu' : 'Izvještaj o povredi na radu'}</title>
<style>${FORM_STYLES}</style></head><body>
${printBar()}
<div class="page">
  ${headerHtml(c,
    'Obrazac broj 1',
    country === 'HR' ? 'Prijava ozljede na radu' : 'Izvještaj o povredi na radu',
    `${prav.name} (${prav.gazette})`
  )}

  <div class="section">
    <div class="section-title">I. Opći podaci o poslodavcu</div>
    <div class="section-body">
      ${fieldRow('Naziv poslodavca', c.naziv)}
      ${fieldRow('Sjedište (adresa)', [c.adresa, c.mjesto, c.postanskiBroj].filter(Boolean).join(', '))}
      ${fieldRow('Identifikacioni broj (ID)', c.oib)}
      ${fieldRow('Djelatnost (šifra)', c.djelatnost)}
      ${fieldRow('Telefon / e-mail', c.telefon)}
      ${fieldRow('Ukupan broj zaposlenih', c.brojZaposlenih)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">II. Podaci o radniku za zaštitu na radu</div>
    <div class="section-body">
      ${fieldRow('Ime i prezime', c.strucnoLice)}
      ${fieldRow('Stručna sprema', c.strucnoLiceSprema)}
      ${fieldRow('Telefon / kontakt', c.strucnoLiceTelefon)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">III. Podaci o povrijeđenom radniku</div>
    <div class="section-body">
      ${fieldRow('Ime i prezime', [w.ime, w.prezime].filter(Boolean).join(' '))}
      ${fieldRow('JMBG', w.jmbg)}
      ${fieldRow('Datum rođenja', fmtD(w.datumRodjenja))}
      ${fieldRow('Spol', w.spol)}
      ${fieldRow('Adresa prebivališta', w.adresa)}
      ${fieldRow('Zanimanje / stručna sprema', w.zanimanje || w.strucnaSprema)}
      ${fieldRow('Radno mjesto', data.workplaceName || w.radnoMjesto)}
      ${fieldRow('Datum zasnivanja radnog odnosa', fmtD(w.datumZaposlenja))}
      ${fieldRow('Radno iskustvo (godina)', w.radnoIskustvo)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">IV. Podaci o povredi</div>
    <div class="section-body">
      ${fieldRow('Datum povrede', fmtD(i.datum))}
      ${fieldRow('Vrijeme (sat) povrede', i.vrijeme)}
      ${fieldRow('Mjesto nastanka povrede', i.mjesto)}
      ${fieldRow('Vrsta povrede', i.vrsta)}
      ${fieldRow('Povrijeđeni dio tijela', i.dijelijTijela)}
      ${fieldRow('Opis povrede', i.opis)}
      ${fieldRowFull('Okolnosti i opis događaja', i.okolnosti)}
      ${fieldRow('Da li je radnik koristio OZS', i.koristioOZS)}
      ${fieldRow('Vrsta korištene OZS', i.vrstaOZS)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">V. Podaci o neposrednom rukovodiocu</div>
    <div class="section-body">
      ${fieldRow('Ime i prezime rukovodioca', i.rukovodilac)}
      ${fieldRow('Radno mjesto rukovodioca', i.rukovodilacRM)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">VI. Podaci o očevicu povrede</div>
    <div class="section-body">
      ${fieldRow('Ime i prezime očevica', i.ocevicIme)}
      ${fieldRow('Adresa / radno mjesto', i.ocevicAdresa)}
      ${fieldRow('Izjava očevica', i.ocevicIzjava)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">VII. Mjere zaštite i zdravlja na radu na radnom mjestu</div>
    <div class="section-body">
      ${fieldRowFull('Opis primijenjenih mjera zaštite', i.mjereZastite)}
      ${fieldRowFull('Uzrok povrede (procjena poslodavca)', i.uzrokPovrede)}
      ${fieldRowFull('Preduzete korektivne mjere', i.korektivneMjere)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">VIII. Mišljenje inspektora rada</div>
    <div class="section-body">
      ${fieldRowFull('Nalaz i mišljenje inspektora', i.inspektorMisljenje)}
      ${fieldRow('Datum inspekcijskog nadzora', fmtD(i.inspektorDatum))}
    </div>
  </div>

  <div class="section">
    <div class="section-title">IX. Nalaz i mišljenje ljekara</div>
    <div class="section-body">
      ${fieldRow('Zdravstvena ustanova', i.zdravstvenaUstanova)}
      ${fieldRow('Dijagnoza (MKB šifra)', i.dijagnoza)}
      ${fieldRowFull('Nalaz i mišljenje ljekara', i.ljekarNalaz)}
      ${fieldRow('Očekivano trajanje liječenja', i.trajanjelijecenja)}
      ${fieldRow('Ime ljekara', i.ljekarIme)}
    </div>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-role">Poslodavac / ovlašteno lice</div>
      <div class="sig-line">${c.direktor || blank()}</div>
      <div class="sig-note">(potpis i pečat)</div>
      <div class="stamp-area" style="margin-top:10px">M.P.</div>
    </div>
    <div class="sig-block">
      <div class="sig-role">Radnik za zaštitu na radu</div>
      <div class="sig-line">${c.strucnoLice || blank()}</div>
      <div class="sig-note">(potpis)</div>
    </div>
    <div class="sig-block">
      <div class="sig-role">Povrijeđeni radnik</div>
      <div class="sig-line">${[w.ime, w.prezime].filter(Boolean).join(' ') || blank()}</div>
      <div class="sig-note">(potpis radnika)</div>
    </div>
  </div>

  <div style="margin-top:12px; font-size:7.5pt; color:#888; text-align:center; font-style:italic;">
    ${country === 'HR' 
      ? 'Obrazac se sačinjava u propisanom broju primjeraka za poslodavca, HZZO i inspektorat.'
      : 'Obrazac se sačinjava u 5 primjeraka: 1× poslodavac, 1× povrijeđeni radnik, 1× inspekcija rada, 1× zavod zdravstvenog osiguranja, 1× zdravstvena ustanova.'}
  </div>

  ${footerHtml(c)}
</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  OBRAZAC BROJ 2 — Izvještaj o profesionalnom oboljenju
// ═══════════════════════════════════════════════════════════════════════════
export function generateObrazac2(data = {}) {
  const c = data.company || {};
  const w = data.worker || {};
  const d = data.disease || {};
  const country = c.country || 'BA';
  const prav = PRAVILNICI[country]?.find(p => p.id === 'injury-report') || PRAVILNICI.BA.find(p => p.id === 'injury-report');

  return `<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8"><title>Obrazac br. 2 — ${country === 'HR' ? 'Prijava profesionalne bolesti' : 'Izvještaj o profesionalnom oboljenju'}</title>
<style>${FORM_STYLES}</style></head><body>
${printBar()}
<div class="page">
  ${headerHtml(c,
    'Obrazac broj 2',
    country === 'HR' ? 'Prijava profesionalne bolesti' : 'Izvještaj o profesionalnom oboljenju',
    `${prav.name} (${prav.gazette})`
  )}

  <div class="section">
    <div class="section-title">I. Opći podaci o poslodavcu</div>
    <div class="section-body">
      ${fieldRow('Naziv poslodavca', c.naziv)}
      ${fieldRow('Sjedište (adresa)', [c.adresa, c.mjesto, c.postanskiBroj].filter(Boolean).join(', '))}
      ${fieldRow('Identifikacioni broj (ID)', c.oib)}
      ${fieldRow('Djelatnost (šifra)', c.djelatnost)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">II. Podaci o oboljelom radniku</div>
    <div class="section-body">
      ${fieldRow('Ime i prezime', [w.ime, w.prezime].filter(Boolean).join(' '))}
      ${fieldRow('JMBG', w.jmbg)}
      ${fieldRow('Datum rođenja', fmtD(w.datumRodjenja))}
      ${fieldRow('Spol', w.spol)}
      ${fieldRow('Adresa prebivališta', w.adresa)}
      ${fieldRow('Zanimanje / stručna sprema', w.zanimanje || w.strucnaSprema)}
      ${fieldRow('Radno mjesto', data.workplaceName || w.radnoMjesto)}
      ${fieldRow('Ukupan radni staž (godina)', w.radniStaz)}
      ${fieldRow('Staž na sadašnjem radnom mjestu', w.stazNaSadasnjem)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">III. Podaci o profesionalnom oboljenju</div>
    <div class="section-body">
      ${fieldRow('Dijagnoza bolesti', d.dijagnoza)}
      ${fieldRow('MKB šifra', d.mkbSifra)}
      ${fieldRow('Datum utvrđivanja oboljenja', fmtD(d.datum))}
      ${fieldRow('Uzrok oboljenja', d.uzrok)}
      ${fieldRowFull('Opis uslova rada i štetnosti', d.opisUslova)}
      ${fieldRow('Trajanje izloženosti štetnosti', d.trajanjeIzlozenosti)}
      ${fieldRow('Da li radnik koristi OZS', d.koristiOZS)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">IV. Provedene mjere zaštite na radu</div>
    <div class="section-body">
      ${fieldRowFull('Opis primijenjenih mjera zaštite', d.mjereZastite)}
      ${fieldRowFull('Rezultati mjerenja štetnosti na radnom mjestu', d.rezultatiMjerenja)}
      ${fieldRow('Datum posljednjeg mjerenja', fmtD(d.datumMjerenja))}
    </div>
  </div>

  <div class="section">
    <div class="section-title">V. Nalaz i mišljenje ovlaštene zdravstvene ustanove</div>
    <div class="section-body">
      ${fieldRow('Naziv zdravstvene ustanove', d.zdravstvenaUstanova)}
      ${fieldRowFull('Nalaz i mišljenje specijaliste medicine rada', d.nalazSpecijaliste)}
      ${fieldRow('Preporučene mjere', d.preporuceneMjere)}
      ${fieldRow('Ime specijaliste', d.imeLjekara)}
      ${fieldRow('Datum nalaza', fmtD(d.datumNalaza))}
    </div>
  </div>

  <div class="section">
    <div class="section-title">VI. Mišljenje inspektora rada</div>
    <div class="section-body">
      ${fieldRowFull('Nalaz i mišljenje inspektora', d.inspektorMisljenje)}
      ${fieldRow('Datum inspekcijskog nadzora', fmtD(d.inspektorDatum))}
    </div>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-role">Poslodavac / ovlašteno lice</div>
      <div class="sig-line">${c.direktor || blank()}</div>
      <div class="sig-note">(potpis i pečat)</div>
      <div class="stamp-area" style="margin-top:10px">M.P.</div>
    </div>
    <div class="sig-block">
      <div class="sig-role">Radnik za zaštitu na radu</div>
      <div class="sig-line">${c.strucnoLice || blank()}</div>
      <div class="sig-note">(potpis)</div>
    </div>
    <div class="sig-block">
      <div class="sig-role">Oboljeli radnik</div>
      <div class="sig-line">${[w.ime, w.prezime].filter(Boolean).join(' ') || blank()}</div>
      <div class="sig-note">(potpis radnika)</div>
    </div>
  </div>

  <div style="margin-top:12px; font-size:7.5pt; color:#888; text-align:center; font-style:italic;">
    ${country === 'HR' 
      ? 'Obrazac se sačinjava u propisanom broju primjeraka za poslodavca, HZZO i inspektorat.'
      : 'Obrazac se sačinjava u 5 primjeraka. (Čl. 5 Pravilnika 9/23)'}
  </div>

  ${footerHtml(c)}
</div></body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  UPUTNICA ZA LJEKARSKI PREGLED (RA-1 / Prethodni ili Periodični)
// ═══════════════════════════════════════════════════════════════════════════
export function generateUputnica(data = {}) {
  const c = data.company || {};
  const w = data.worker || {};
  const tip = data.tipPregleda || 'prethodni'; // 'prethodni' | 'periodicni'
  const isPeriodic = tip === 'periodicni';
  const country = c.country || 'BA';
  
  // Use 'medical-periodic' if available and periodic, otherwise fallback to 'medical'
  let pravId = isPeriodic && country === 'HR' ? 'medical-periodic' : 'medical';
  const pravMedical = PRAVILNICI[country]?.find(p => p.id === pravId) || PRAVILNICI.BA.find(p => p.id === 'medical');

  return `<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8"><title>Uputnica za ${isPeriodic ? 'periodični' : 'prethodni'} ljekarski pregled</title>
<style>${FORM_STYLES}</style></head><body>
${printBar()}
<div class="page">
  ${headerHtml(c,
    isPeriodic ? 'Uputnica za periodični ljekarski pregled' : 'Uputnica za prethodni ljekarski pregled',
    country === 'HR' ? 'Obrazac RA-1' : (isPeriodic ? 'Obrazac br. 3' : 'Obrazac br. 1'),
    `${pravMedical.name} (${pravMedical.gazette})`
  )}

  <div class="section">
    <div class="section-title">I. Podaci o poslodavcu</div>
    <div class="section-body">
      ${fieldRow('Naziv poslodavca', c.naziv)}
      ${fieldRow('Adresa / sjedište', [c.adresa, c.mjesto].filter(Boolean).join(', '))}
      ${fieldRow('ID broj', c.oib)}
      ${fieldRow('Djelatnost', c.djelatnost)}
      ${fieldRow('Kontakt telefon', c.telefon)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">II. Podaci o radniku</div>
    <div class="section-body">
      ${fieldRow('Ime i prezime', [w.ime, w.prezime].filter(Boolean).join(' '))}
      ${fieldRow('JMBG', w.jmbg)}
      ${fieldRow('Datum rođenja', fmtD(w.datumRodjenja))}
      ${fieldRow('Spol', w.spol)}
      ${fieldRow('Adresa', w.adresa)}
      ${fieldRow('Zanimanje', w.zanimanje)}
      ${fieldRow('Stručna sprema', w.strucnaSprema)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">III. Podaci o radnom mjestu</div>
    <div class="section-body">
      ${fieldRow('Radno mjesto (naziv)', data.workplaceName || w.radnoMjesto)}
      ${fieldRow('Opis poslova', data.opisPoslova)}
      ${fieldRow('Poslovi s povećanim rizikom', data.povecanRizik ? 'DA' : '')}
      ${fieldRowFull('Štetnosti i opasnosti na radnom mjestu', data.stetnosti)}
      ${fieldRow('Rezultati mjerenja štetnosti', data.rezultatiMjerenja)}
      ${isPeriodic ? fieldRow('Datum prethodnog pregleda', fmtD(data.datumPrethodnogPregleda)) : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">IV. Zahtjev za pregled</div>
    <div class="section-body">
      ${fieldRow('Vrsta pregleda', isPeriodic ? 'Periodični ljekarski pregled' : 'Prethodni ljekarski pregled')}
      ${fieldRow('Upućuje se radi', data.razlogUpucivanja || (isPeriodic ? 'Periodična kontrola zdravstvene sposobnosti' : 'Utvrđivanje zdravstvene sposobnosti za radno mjesto'))}
      ${fieldRow('Datum upućivanja', fmtD(data.datumUpucivanja || new Date().toISOString()))}
    </div>
  </div>

  <div class="signatures" style="margin-top:30px">
    <div class="sig-block">
      <div class="sig-role">Poslodavac / ovlašteno lice</div>
      <div class="sig-line">${c.direktor || blank()}</div>
      <div class="sig-note">(potpis i pečat)</div>
      <div class="stamp-area" style="margin-top:10px">M.P.</div>
    </div>
    <div class="sig-block">
      <div class="sig-role">Radnik za zaštitu na radu</div>
      <div class="sig-line">${c.strucnoLice || blank()}</div>
      <div class="sig-note">(potpis)</div>
    </div>
  </div>

  ${footerHtml(c)}
</div></body></html>`;
}

/**
 * Opens any generated form HTML in a new print window.
 * @param {string} html - The full HTML document string
 */
export function openFormPrintWindow(html) {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (w) { w.document.write(html); w.document.close(); }
}
