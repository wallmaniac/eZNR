// ============================================================================
// TRAINING CERTIFICATE — generates a professional printable certificate
// Opens in a new window, auto-triggers print dialog for PDF save.
// ============================================================================

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
 */
export function generateTrainingCertificate({
    workerName = '',
    trainingName = '',
    date = '',
    score = 0,
    companyName = '',
    companyLogo = '',
    officerName = '',
}) {
    const displayDate = date
        ? new Date(date).toLocaleDateString('hr-HR', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('hr-HR', { day: '2-digit', month: 'long', year: 'numeric' });

    const certNumber = `eZNR-CERT-${Date.now().toString(36).toUpperCase()}`;

    const html = `<!DOCTYPE html>
<html lang="bs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certifikat \u2014 ${workerName}</title>
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

            <div class="cert-label">Potvrda o zavr\u0161enoj obuci</div>
            <h1 class="cert-title">CERTIFIKAT</h1>

            <div class="awarded-to">Ovim se potvr\u0111uje da je</div>
            <div class="worker-name">${workerName}</div>

            <div class="training-desc">
                uspje\u0161no zavr\u0161io/la obuku<br>
                <strong>\u201E${trainingName}\u201C</strong><br>
                dana <strong>${displayDate}</strong>
            </div>

            ${score > 0 ? `
                <div class="score-badge">
                    \u2705 Rezultat: ${score}% \u2014 POLO\u017DIO/LA
                </div>
            ` : ''}

            <div class="signatures">
                <div class="sig-block">
                    <div style="height:40px"></div>
                    <div class="sig-line">${officerName || 'Ovla\u0161tena osoba za ZNR'}</div>
                </div>
                <div class="sig-block">
                    <div style="height:40px"></div>
                    <div class="sig-line">Poslodavac / Director</div>
                </div>
            </div>
        </div>

        <div class="cert-footer">
            <span>Br. certifikata: ${certNumber}</span>
            <span>\u2022</span>
            <span>Datum izdavanja: ${displayDate}</span>
            <span>\u2022</span>
            <span>eZNR Platform \u2014 zastitanaradu.ba</span>
        </div>
    </div>

    <button class="print-btn" onclick="window.print()">\uD83D\uDCC4 Preuzmi PDF (Print)</button>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
}
