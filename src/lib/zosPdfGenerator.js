'use client';

import { LAWS, getArticleWord } from '@/lib/lawConfig';

/**
 * ZOS PDF Generator
 * Generates a formal "Zapisnik o ocjeni osposobljenosti radnika za rad na siguran način"
 * document compliant with the active company's jurisdiction (BA or HR)
 * 
 * BA: Član 48 + 49 Zakona o ZNR FBiH (Sl. novine FBiH 79/20)
 * HR: Članak 27-30 Zakona o ZNR (NN 71/14)
 */

export function generateZosPdf({
    company,       // { naziv, adresa, mjesto, postanskiBroj, oib, direktor, strucnoLice, logo }
    worker,        // { ime, prezime, jmbg, oib, radnoMjestoId }
    workplaceName, // string
    training,      // { naziv }
    officer,       // string (stručnjak ZNR name)
    date,          // string ISO
    certOznaka,    // string e.g. ZOS-XYZ
    testResult,    // string e.g. "85%"
}) {
    const formattedDate = date ? new Date(date).toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '__.__.____.';
    const country = company.country || 'BA';
    const osh = LAWS[country]?.osh || LAWS.BA.osh;
    const artWord = getArticleWord(country);
    const logoHtml = company.logo
        ? `<img src="${company.logo}" style="max-height:60px; max-width:180px; object-fit:contain;" />`
        : '';

    const html = `<!DOCTYPE html>
<html lang="bs">
<head>
<meta charset="UTF-8">
<title>ZOS - ${worker.ime} ${worker.prezime}</title>
<style>
    @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Segoe UI', 'Arial', sans-serif;
        font-size: 11pt;
        color: #1a1a1a;
        line-height: 1.5;
        background: #fff;
    }
    .page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 0; }
    
    /* Header */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 3px solid #1a365d;
        padding-bottom: 12px;
        margin-bottom: 8px;
    }
    .company-info { flex: 1; }
    .company-name { font-size: 14pt; font-weight: 800; color: #1a365d; }
    .company-details { font-size: 8.5pt; color: #555; margin-top: 3px; line-height: 1.4; }
    .logo-area { text-align: right; }
    
    /* Title */
    .doc-title {
        text-align: center;
        margin: 18px 0 6px;
        font-size: 13pt;
        font-weight: 800;
        text-transform: uppercase;
        color: #1a365d;
        letter-spacing: 0.5px;
    }
    .doc-subtitle {
        text-align: center;
        font-size: 9pt;
        color: #666;
        margin-bottom: 16px;
    }
    .doc-ref {
        text-align: center;
        font-size: 8.5pt;
        color: #888;
        margin-bottom: 20px;
    }
    
    /* Sections */
    .section { margin-bottom: 14px; }
    .section-title {
        font-size: 10pt;
        font-weight: 700;
        color: #1a365d;
        border-bottom: 1.5px solid #ddd;
        padding-bottom: 3px;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    
    /* Data table */
    .data-row {
        display: flex;
        border-bottom: 1px solid #eee;
        padding: 4px 0;
        font-size: 10pt;
    }
    .data-label {
        width: 220px;
        font-weight: 600;
        color: #444;
        flex-shrink: 0;
    }
    .data-value {
        flex: 1;
        font-weight: 400;
    }
    
    /* Checklist */
    .checklist { margin: 8px 0; }
    .check-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 3px 0;
        font-size: 9.5pt;
        line-height: 1.4;
    }
    .check-box {
        width: 14px; height: 14px;
        border: 1.5px solid #1a365d;
        border-radius: 2px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #1a365d;
        flex-shrink: 0;
        margin-top: 2px;
    }
    
    /* Assessment */
    .assessment-box {
        border: 2px solid #1a365d;
        border-radius: 6px;
        padding: 12px 16px;
        margin: 14px 0;
        background: #f7fafc;
    }
    .assessment-text {
        font-size: 10.5pt;
        font-weight: 600;
        text-align: center;
        color: #1a365d;
    }
    
    /* Signatures */
    .signatures {
        display: flex;
        justify-content: space-between;
        margin-top: 30px;
        gap: 20px;
    }
    .sig-block {
        flex: 1;
        text-align: center;
    }
    .sig-role {
        font-size: 8.5pt;
        color: #666;
        margin-bottom: 4px;
        font-weight: 600;
    }
    .sig-line {
        border-top: 1.5px solid #333;
        margin-top: 40px;
        padding-top: 4px;
        font-size: 9.5pt;
        font-weight: 600;
    }
    .sig-note {
        font-size: 7.5pt;
        color: #999;
        margin-top: 2px;
    }
    
    /* Footer */
    .footer {
        border-top: 2px solid #1a365d;
        margin-top: 20px;
        padding-top: 8px;
        font-size: 7.5pt;
        color: #999;
        text-align: center;
    }
    
    .legal-ref {
        font-size: 8pt;
        color: #888;
        font-style: italic;
        text-align: center;
        margin: 6px 0;
    }
    
    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { page-break-after: always; }
        .no-print { display: none !important; }
    }
</style>
</head>
<body>
<div class="page">
    <!-- HEADER -->
    <div class="header">
        <div class="company-info">
            <div class="company-name">${company.naziv || '________________________________'}</div>
            <div class="company-details">
                ${company.adresa ? company.adresa + ', ' : ''}${company.mjesto || ''} ${company.postanskiBroj || ''}<br>
                ${company.oib ? 'ID broj: ' + company.oib : ''}
                ${company.telefon ? ' | Tel: ' + company.telefon : ''}
                ${company.email ? ' | ' + company.email : ''}
            </div>
        </div>
        <div class="logo-area">${logoHtml}</div>
    </div>
    
    <!-- TITLE -->
    <div class="doc-title">Zapisnik o ocjeni osposobljenosti<br>radnika za rad na siguran način</div>
    <div class="doc-subtitle">Obrazac ZOS — u skladu sa ${osh.name} ("${osh.gazette}")</div>
    <div class="doc-ref">Broj: ${certOznaka || '________'} &nbsp;&nbsp;|&nbsp;&nbsp; Datum: ${formattedDate}</div>
    
    <!-- SECTION 1: WORKER DATA -->
    <div class="section">
        <div class="section-title">I. Podaci o radniku</div>
        <div class="data-row"><span class="data-label">Ime i prezime:</span><span class="data-value">${worker.ime || ''} ${worker.prezime || ''}</span></div>
        <div class="data-row"><span class="data-label">JMBG:</span><span class="data-value">${worker.jmbg || '________________________'}</span></div>
        <div class="data-row"><span class="data-label">OIB / ID broj radnika:</span><span class="data-value">${worker.oib || '________________________'}</span></div>
        <div class="data-row"><span class="data-label">Radno mjesto:</span><span class="data-value">${workplaceName || '________________________'}</span></div>
    </div>
    
    <!-- SECTION 2: TRAINING DATA -->
    <div class="section">
        <div class="section-title">II. Podaci o osposobljavanju</div>
        <div class="data-row"><span class="data-label">Teoretski dio osposobljavanja:</span><span class="data-value">${training?.naziv || '________________________'}</span></div>
        <div class="data-row"><span class="data-label">Mjesto provođenja:</span><span class="data-value">${company.adresa || ''}, ${company.mjesto || ''}</span></div>
        <div class="data-row"><span class="data-label">Datum osposobljavanja:</span><span class="data-value">${formattedDate}</span></div>
        <div class="data-row"><span class="data-label">Rezultat provjere znanja:</span><span class="data-value">${testResult || '________'}</span></div>
        <div class="data-row"><span class="data-label">Stručnjak zaštite na radu:</span><span class="data-value">${officer || '________________________'}</span></div>
    </div>
    
    <!-- SECTION 3: THEORETICAL ASSESSMENT -->
    <div class="section">
        <div class="section-title">III. Ocjena teoretskog dijela osposobljavanja</div>
        <p style="font-size:9.5pt; margin-bottom:6px; color:#333;">
            Stručnjak zaštite na radu ocjenjuje da je radnik <strong>${worker.ime} ${worker.prezime}</strong> 
            u teoretskom dijelu <strong>osposobljen</strong> za rad na siguran način za poslove 
            radnog mjesta <strong>${workplaceName || '(radno mjesto)'}</strong>, na koje je raspoređen/a.
        </p>
        <p style="font-size:9pt; color:#666;">
            Tijekom osposobljavanja radnik je upoznat sa: tehničko-tehnološkim procesom rada, 
            opasnostima koje ugrožavaju sigurnost na radu, pravilnim korištenjem sredstava rada 
            i zaštitne opreme, mjerama zaštite na radu, te pravima i dužnostima u provođenju 
            propisa zaštite na radu (${artWord} ${osh.articles.trainingAssessment}. ${osh.shortName}).
        </p>
    </div>
    
    <!-- SECTION 4: PRACTICAL ASSESSMENT CHECKLIST -->
    <div class="section">
        <div class="section-title">IV. Provjera praktične osposobljenosti</div>
        <p style="font-size:9pt; color:#666; margin-bottom:8px;">
            Neposredni ovlaštenik poslodavca i stručnjak ZNR potvrđuju da radnik:
        </p>
        <div class="checklist">
            <div class="check-item"><span class="check-box">✓</span> Prije početka rada pregleda radno mjesto te o uočenim nedostacima izvještava poslodavca ili ovlaštenika</div>
            <div class="check-item"><span class="check-box">✓</span> Pravilno koristi sredstva rada (radnu opremu) u skladu sa uputama proizvođača</div>
            <div class="check-item"><span class="check-box">✓</span> Pravilno koristi propisanu osobnu zaštitnu opremu (OZO) i vraća na za to određeno mjesto</div>
            <div class="check-item"><span class="check-box">✓</span> Ne isključuje, ne vrši preinake i ne uklanja zaštite na sredstvima rada</div>
            <div class="check-item"><span class="check-box">✓</span> Odmah obavještava poslodavca/ovlaštenika o situacijama s rizikom za sigurnost i zdravlje</div>
            <div class="check-item"><span class="check-box">✓</span> Posao obavlja u skladu s pravilima zaštite na radu, struke te uputama poslodavca</div>
            <div class="check-item"><span class="check-box">✓</span> Prije odlaska ostavlja sredstva rada u stanju koje ne ugrožava ostale radnike</div>
            <div class="check-item"><span class="check-box">✓</span> Surađuje sa stručnjakom ZNR, specijalistom medicine rada i povjerenikom za ZNR</div>
        </div>
    </div>
    
    <!-- SECTION 5: FINAL ASSESSMENT -->
    <div class="section">
        <div class="section-title">V. Zaključna ocjena</div>
        <div class="assessment-box">
            <div class="assessment-text">
                Na osnovu provedenog teoretskog i praktičnog osposobljavanja, ocjenjuje se da je radnik/ca<br>
                <strong style="font-size:12pt;">${worker.ime} ${worker.prezime}</strong><br>
                <strong>OSPOSOBLJEN/A</strong> za rad na siguran način<br>
                na poslovima radnog mjesta: <strong>${workplaceName || '________________'}</strong>
            </div>
        </div>
    </div>
    
    <div class="legal-ref">
        ${artWord} ${osh.articles.training}. ${osh.name} ("${osh.gazette}")
    </div>
    
    <!-- SIGNATURES -->
    <div class="signatures">
        <div class="sig-block">
            <div class="sig-role">Osposobljeni radnik</div>
            <div class="sig-line">${worker.ime} ${worker.prezime}</div>
            <div class="sig-note">(potpis radnika)</div>
        </div>
        <div class="sig-block">
            <div class="sig-role">Neposredni ovlaštenik poslodavca</div>
            <div class="sig-line">${company.direktor || '________________________'}</div>
            <div class="sig-note">(potpis ovlaštenika)</div>
        </div>
        <div class="sig-block">
            <div class="sig-role">Stručnjak zaštite na radu</div>
            <div class="sig-line">${officer || '________________________'}</div>
            <div class="sig-note">(potpis stručnjaka ZNR)</div>
        </div>
    </div>
    
    <!-- FOOTER -->
    <div class="footer">
        ${company.naziv} &nbsp;|&nbsp; ${company.adresa || ''}, ${company.mjesto || ''} &nbsp;|&nbsp; ${certOznaka || ''} &nbsp;|&nbsp; ${formattedDate}
        <br>Ovaj zapisnik se čuva trajno u evidencijama poslodavca i predočava inspektoru rada na zahtjev.
    </div>
</div>
</body>
</html>`;

    return html;
}

/**
 * Opens a new window with the ZOS document and triggers print
 */
export function printZosPdf(params) {
    const html = generateZosPdf(params);
    const printWindow = window.open('', '_blank', 'width=800,height=1100');
    if (!printWindow) {
        alert('Molimo omogućite popup prozore za ispis ZOS dokumenta.');
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for images (logo) to load before printing
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}
