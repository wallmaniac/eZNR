// ============================================================================
// TRAINING CERTIFICATE — generates a professional printable certificate
// Opens in a new window, auto-triggers print dialog for PDF save.
// ============================================================================

const CERT_T = {
    bs: {
        docTitle: 'Certifikat',
        label: 'Potvrda o završenoj obuci',
        awarded: 'Ovim se potvrđuje da je',
        desc: 'uspješno završio/la obuku<br><strong>„{0}“</strong><br>dana <strong>{1}</strong>',
        passed: '✅ Rezultat: {0}% — POLOŽIO/LA',
        authPerson: 'Ovlaštena osoba za ZNR',
        employer: 'Poslodavac / Direktor',
        certNo: 'Br. certifikata:',
        issueDate: 'Datum izdavanja:',
        printBtn: '📄 Preuzmi PDF (Print)'
    },
    hr: {
        docTitle: 'Certifikat',
        label: 'Potvrda o završenom osposobljavanju',
        awarded: 'Ovim se potvrđuje da je',
        desc: 'uspješno završio/la osposobljavanje<br><strong>„{0}“</strong><br>dana <strong>{1}</strong>',
        passed: '✅ Rezultat: {0}% — POLOŽIO/LA',
        authPerson: 'Ovlaštena osoba za ZNR',
        employer: 'Poslodavac / Direktor',
        certNo: 'Br. certifikata:',
        issueDate: 'Datum izdavanja:',
        printBtn: '📄 Preuzmi PDF (Tisak)'
    },
    sr: {
        docTitle: 'Sertifikat',
        label: 'Potvrda o završenoj obuci',
        awarded: 'Ovim se potvrđuje da je',
        desc: 'uspešno završio/la obuku<br><strong>„{0}“</strong><br>dana <strong>{1}</strong>',
        passed: '✅ Rezultat: {0}% — POLOŽIO/LA',
        authPerson: 'Ovlašćeno lice za BZN',
        employer: 'Poslodavac / Direktor',
        certNo: 'Br. sertifikata:',
        issueDate: 'Datum izdavanja:',
        printBtn: '📄 Preuzmi PDF (Print)'
    },
    en: {
        docTitle: 'Certificate',
        label: 'Confirmation of Completed Training',
        awarded: 'This is to certify that',
        desc: 'has successfully completed the training<br><strong>"{0}"</strong><br>on <strong>{1}</strong>',
        passed: '✅ Score: {0}% — PASSED',
        authPerson: 'Authorized Safety Officer',
        employer: 'Employer / Director',
        certNo: 'Cert No:',
        issueDate: 'Issue Date:',
        printBtn: '📄 Download PDF (Print)'
    },
    de: {
        docTitle: 'Zertifikat',
        label: 'Bestätigung über die abgeschlossene Schulung',
        awarded: 'Hiermit wird bestätigt, dass',
        desc: 'die Schulung<br><strong>"{0}"</strong><br>am <strong>{1}</strong><br>erfolgreich abgeschlossen hat',
        passed: '✅ Ergebnis: {0}% — BESTANDEN',
        authPerson: 'Sicherheitsfachkraft',
        employer: 'Arbeitgeber / Geschäftsführer',
        certNo: 'Zertifikatsnr.:',
        issueDate: 'Ausstellungsdatum:',
        printBtn: '📄 PDF herunterladen (Drucken)'
    },
    sl: {
        docTitle: 'Certifikat',
        label: 'Potrdilo o opravljenem usposabljanju',
        awarded: 'S tem se potrjuje, da je delavec/ka',
        desc: 'uspešno opravil/a usposabljanje<br><strong>"{0}"</strong><br>dne <strong>{1}</strong>',
        passed: '✅ Rezultat: {0}% — OPRAVIL/A',
        authPerson: 'Strokovni delavec za varnost',
        employer: 'Delodajalec / Direktor',
        certNo: 'Št. certifikata:',
        issueDate: 'Datum izdaje:',
        printBtn: '📄 Prenesi PDF (Natisni)'
    }
};

/**
 * Generate and display a training completion certificate in a new print window.
 *
 * @param {Object} opts
 * @param {string} opts.workerName     — Full name of the worker
 * @param {string} opts.trainingName   — Name of the training/course
 * @param {string} opts.date           — Date of completion (ISO or display string)
 * @param {number} opts.score          — Score percentage (e.g. 85)
 * @param {string} opts.companyName    — Company name
 * @param {string} opts.companyLogo    — Company logo URL (optional)
 * @param {string} opts.officerName    — Name of the officer/instructor
 * @param {string} opts.lang           — Language code (bs, hr, sr, en, de, sl)
 */
export function generateTrainingCertificate({
    workerName = '',
    trainingName = '',
    date = '',
    score = 0,
    companyName = '',
    companyLogo = '',
    officerName = '',
    lang = 'bs',
}) {
    const activeLang = CERT_T[lang] ? lang : 'bs';
    const tDict = CERT_T[activeLang];

    // Select date formatter based on language
    const localeMap = { bs: 'hr-HR', hr: 'hr-HR', sr: 'sr-Latn-RS', en: 'en-US', de: 'de-DE', sl: 'sl-SI' };
    const localeCode = localeMap[activeLang] || 'hr-HR';
    const dateFormatOpts = activeLang === 'en' || activeLang === 'de'
        ? { day: '2-digit', month: '2-digit', year: 'numeric' }
        : { day: '2-digit', month: 'long', year: 'numeric' };

    const displayDate = date
        ? new Date(date).toLocaleDateString(localeCode, dateFormatOpts)
        : new Date().toLocaleDateString(localeCode, dateFormatOpts);

    const certNumber = `eZNR-CERT-${Date.now().toString(36).toUpperCase()}`;

    // Interpolations
    const descText = tDict.desc.replace('{0}', trainingName).replace('{1}', displayDate);
    const passedText = tDict.passed.replace('{0}', score);

    const html = `<!DOCTYPE html>
<html lang="${activeLang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tDict.docTitle} \u2014 ${workerName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @page {
            size: A4 landscape;
            margin: 0;
        }

        body {
            width: 297mm;
            height: 210mm;
            overflow: hidden;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            color: #1e293b;
            background: #fff;
        }

        .cert-wrapper {
            width: 297mm;
            height: 210mm;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            background:
                radial-gradient(ellipse at top left, rgba(99,102,241,0.06) 0%, transparent 50%),
                radial-gradient(ellipse at bottom right, rgba(139,92,246,0.06) 0%, transparent 50%),
                linear-gradient(135deg, #fefefe 0%, #f8fafc 100%);
        }

        /* Decorative border */
        .cert-border {
            position: absolute;
            inset: 12mm;
            border: 3px solid #6366f1;
            border-radius: 8px;
            pointer-events: none;
        }
        .cert-border::before {
            content: '';
            position: absolute;
            inset: 4px;
            border: 1px solid rgba(99,102,241,0.25);
            border-radius: 6px;
        }

        /* Corner ornaments */
        .corner { position: absolute; width: 40px; height: 40px; }
        .corner svg { width: 100%; height: 100%; fill: #6366f1; opacity: 0.5; }
        .corner-tl { top: 14mm; left: 14mm; }
        .corner-tr { top: 14mm; right: 14mm; transform: scaleX(-1); }
        .corner-bl { bottom: 14mm; left: 14mm; transform: scaleY(-1); }
        .corner-br { bottom: 14mm; right: 14mm; transform: scale(-1); }

        .cert-content {
            text-align: center;
            max-width: 700px;
            padding: 0 20mm;
            z-index: 1;
        }

        .company-header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 8px;
        }
        .company-header img { height: 48px; max-width: 180px; object-fit: contain; }
        .company-header span { font-size: 13px; font-weight: 600; color: #475569; letter-spacing: 0.5px; }

        .cert-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 4px;
            color: #6366f1;
            margin-bottom: 6px;
        }

        .cert-title {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 48px;
            font-weight: 900;
            color: #1e293b;
            margin-bottom: 16px;
            line-height: 1.1;
        }

        .awarded-to {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .worker-name {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 34px;
            font-weight: 700;
            color: #4f46e5;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid rgba(99,102,241,0.2);
            display: inline-block;
        }

        .training-desc {
            font-size: 15px;
            color: #475569;
            line-height: 1.7;
            margin-bottom: 24px;
        }
        .training-desc strong { color: #1e293b; }

        .score-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 20px;
            border-radius: 24px;
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: #fff;
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 28px;
        }

        .signatures {
            display: flex;
            justify-content: space-between;
            gap: 40px;
            margin-top: 20px;
            width: 100%;
        }
        .sig-block {
            flex: 1;
            text-align: center;
        }
        .sig-line {
            border-top: 1px solid #333;
            padding-top: 6px;
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
        }

        .cert-footer {
            position: absolute;
            bottom: 16mm;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 24px;
            align-items: center;
            font-size: 10px;
            color: #94a3b8;
        }
        .cert-footer img { height: 18px; opacity: 0.5; }

        .print-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 14px 28px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: #fff;
            border: none;
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(99,102,241,0.4);
            z-index: 999;
        }

        @media print {
            .print-btn { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="cert-wrapper">
        <!-- Border -->
        <div class="cert-border"></div>

        <!-- Corner ornaments -->
        <div class="corner corner-tl"><svg viewBox="0 0 40 40"><path d="M0,0 L40,0 L40,8 L8,8 L8,40 L0,40 Z"/></svg></div>
        <div class="corner corner-tr"><svg viewBox="0 0 40 40"><path d="M0,0 L40,0 L40,8 L8,8 L8,40 L0,40 Z"/></svg></div>
        <div class="corner corner-bl"><svg viewBox="0 0 40 40"><path d="M0,0 L40,0 L40,8 L8,8 L8,40 L0,40 Z"/></svg></div>
        <div class="corner corner-br"><svg viewBox="0 0 40 40"><path d="M0,0 L40,0 L40,8 L8,8 L8,40 L0,40 Z"/></svg></div>

        <div class="cert-content">
            ${companyLogo || companyName ? `
                <div class="company-header">
                    ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" />` : ''}
                    ${companyName ? `<span>${companyName}</span>` : ''}
                </div>
            ` : ''}

            <div class="cert-label">${tDict.label}</div>
            <h1 class="cert-title">${tDict.docTitle.toUpperCase()}</h1>

            <div class="awarded-to">${tDict.awarded}</div>
            <div class="worker-name">${workerName}</div>

            <div class="training-desc">
                ${descText}
            </div>

            ${score > 0 ? `
                <div class="score-badge">
                    ${passedText}
                </div>
            ` : ''}

            <div class="signatures">
                <div class="sig-block">
                    <div style="height:40px"></div>
                    <div class="sig-line">${officerName || tDict.authPerson}</div>
                </div>
                <div class="sig-block">
                    <div style="height:40px"></div>
                    <div class="sig-line">${tDict.employer}</div>
                </div>
            </div>
        </div>

        <div class="cert-footer">
            <span>${tDict.certNo} ${certNumber}</span>
            <span>\u2022</span>
            <span>${tDict.issueDate} ${displayDate}</span>
            <span>\u2022</span>
            <span>eZNR Platform \u2014 zastitanaradu.ba</span>
        </div>
    </div>

    <button class="print-btn" onclick="window.print()">${tDict.printBtn}</button>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
}
