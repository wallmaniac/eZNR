/**
 * /api/notify-expiry/route.js
 *
 * Ported from functions/endpoints/notifyExpiry.js (Firebase Cloud Function)
 * to a Vercel API Route called daily by Vercel Cron.
 *
 * Called via GET /api/notify-expiry?secret=NOTIFY_SECRET
 * Test mode: GET /api/notify-expiry?secret=...&test=true&email=test@example.com
 * Single company: GET /api/notify-expiry?secret=...&company=COMPANY_ID
 */

import { Resend } from 'resend';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const maxDuration = 300; // 5 minutes — scanning all companies can take time

// ─── Firebase Admin ───────────────────────────────────────────────────────────
function getAdminDb() {
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }
    return getFirestore();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let resendInstance = null;
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@mail.zastitanaradu.ba';
const APP_URL = 'https://zastitanaradu.ba';

function getResend() {
    if (!resendInstance) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error('RESEND_API_KEY not configured');
        resendInstance = new Resend(apiKey);
    }
    return resendInstance;
}

function daysUntil(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return Math.floor((d - new Date()) / 86400000);
}

function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── i18n ─────────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
    bs: {
        expired: 'Isteklo', days: 'd', status: 'Status',
        titleDig: 'DNEVNI PREGLED ISTICANJA', company: 'Firma', generated: 'Generisano',
        intro: 'Ispod se nalazi pregled svih stavki koje su istekle ili ističu u narednom periodu. Molimo preduzmite odgovarajuće mjere.',
        openApp: 'Otvori aplikaciju →', autoEmail: 'Automatski email — eZNR Platforma za zaštitu na radu',
        disableOpt: 'Za isključivanje ovih emailova idite na: Postavke → Obavijesti → Automatski Email',
        catCerts: 'Uvjerenja radnika', worker: 'Radnik', type: 'Vrsta', expires: 'Ističe',
        catPPE: 'Zaštitna oprema', item: 'Artikal', assigned: 'Dodijeljeno',
        catEquip: 'Radna oprema', equipName: 'Oprema', invCode: 'Inv. br.', nextIns: 'Sljedeći pregled',
        catDocs: 'Dokumenti poslodavca', document: 'Dokument', category: 'Kategorija',
        catFleet: 'Vozni park', vehicle: 'Vozilo',
        catMed: 'Ljekarski pregledi', examType: 'Vrsta pregleda', validUntil: 'Važi do',
        registracija: 'Registracija',
        tehnickiPregled: 'Tehnički pregled',
        insurance: 'Osiguranje',
    },
    en: {
        expired: 'Expired', days: 'd', status: 'Status',
        titleDig: 'DAILY EXPIRY DIGEST', company: 'Company', generated: 'Generated',
        intro: 'Below is a summary of all items that have expired or are expiring soon. Please take appropriate action.',
        openApp: 'Open App →', autoEmail: 'Automated email — eZNR Occupational Safety Platform',
        disableOpt: 'To disable these emails go to: Settings → Notifications → Automated Email',
        catCerts: 'Worker Certificates', worker: 'Worker', type: 'Type', expires: 'Expires',
        catPPE: 'Protective Equipment', item: 'Item', assigned: 'Assigned',
        catEquip: 'Equipment', equipName: 'Equipment', invCode: 'Inv. Code', nextIns: 'Next Insp.',
        catDocs: 'Employer Docs', document: 'Document', category: 'Category',
        catFleet: 'Vehicle Fleet', vehicle: 'Vehicle',
        catMed: 'Medical Exams', examType: 'Exam Type', validUntil: 'Valid Until',
        registracija: 'Registration',
        tehnickiPregled: 'Technical inspection',
        insurance: 'Insurance',
    },
};

function t(lang, key) {
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

// ─── Email HTML builders ───────────────────────────────────────────────────────
function rowStyle(days) {
    if (days === null) return '';
    if (days < 0) return 'background:#fff1f2;';
    if (days <= 7) return 'background:#fff7ed;';
    if (days <= 30) return 'background:#fefce8;';
    return '';
}

function statusBadge(days, lang) {
    if (days === null) return '';
    if (days < 0) return `<span style="color:#ef4444;font-weight:700">⛔ ${t(lang, 'expired')}</span>`;
    if (days <= 7) return `<span style="color:#f97316;font-weight:700">🔴 ${days}${t(lang, 'days')}</span>`;
    if (days <= 30) return `<span style="color:#eab308;font-weight:700">⚠️ ${days}${t(lang, 'days')}</span>`;
    return `<span style="color:#22c55e;font-weight:600">✅ ${days}${t(lang, 'days')}</span>`;
}

function buildSection(title, rows, cols, lang) {
    if (!rows?.length) return '';
    const rowsHtml = rows.map(row => `
        <tr style="${rowStyle(row._days)}">
            ${cols.map(col => `<td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${row[col.key] ?? '—'}</td>`).join('')}
            <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center">${statusBadge(row._days, lang)}</td>
        </tr>`).join('');
    return `
        <div style="margin-bottom:28px">
            <h3 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1e293b">${title}</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                <thead><tr style="background:#f8fafc">
                    ${cols.map(col => `<th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${col.label}</th>`).join('')}
                    <th style="padding:9px 10px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${t(lang, 'status')}</th>
                </tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>`;
}

function buildEmailBody({ companyName, sections, lang, today }) {
    const todayStr = fmtDate(today.toISOString().split('T')[0]);
    const sectionsHtml = sections.join('');
    if (!sectionsHtml.trim()) return null;

    return `<!DOCTYPE html>
<html lang="${lang || 'bs'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>eZNR — ${t(lang, 'titleDig')}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;padding:0;margin:0;border-spacing:0;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:0;margin:0;">
        <!--[if mso]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">
          
          <!-- Header logo image -->
          <tr>
            <td align="center" style="padding:0;margin:0;font-size:0;line-height:0;text-align:center;background:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-top:1px solid #e2e8f0;border-radius:16px 16px 0 0;">
              <img src="${APP_URL}/email-header.png" 
                   alt="eZNR — Digitalna platforma za zaštitu na radu" 
                   width="600" 
                   style="display:block;width:100%;max-width:100%;height:auto;margin:0 auto;border:0;outline:none;border-radius:15px 15px 0 0;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 30px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;text-align:left;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
                ⏰ ${t(lang, 'titleDig')}
              </p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:800;color:#1e293b;line-height:1.35;">
                ${companyName}
              </h1>
              
              <p style="margin:0 0 10px;font-size:15px;color:#475569;line-height:1.75;">
                ${t(lang, 'intro')}
              </p>
              <p style="margin:0 0 28px;font-size:13px;color:#64748b;font-weight:600;">
                ${t(lang, 'generated')}: ${todayStr}
              </p>

              <!-- Sections (Tables) -->
              ${sectionsHtml}

              <!-- CTA -->
              <div style="text-align:center;margin:36px 0;">
                <p style="margin:0 0 16px;font-size:14px;color:#64748b;font-weight:600;">
                  👇 Pritisnite dugme ispod za pristup aplikaciji:
                </p>
                <a href="${APP_URL}/dashboard" 
                   style="display:block;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#6366f1 100%);
                          color:#ffffff;font-size:20px;font-weight:800;text-decoration:none;
                          padding:22px 20px;border-radius:16px;letter-spacing:0.3px;
                          box-shadow:0 6px 32px rgba(99,102,241,0.55),0 2px 8px rgba(79,70,229,0.4);
                          border:3px solid rgba(255,255,255,0.25);
                          max-width:480px;margin:0 auto;">
                  ${t(lang, 'openApp')}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:22px 30px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:600;">
                ${t(lang, 'autoEmail')}
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                ${t(lang, 'disableOpt')}
              </p>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Main GET handler (Vercel Cron calls this) ────────────────────────────────
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (!secret || secret !== process.env.NOTIFY_SECRET) {
        return Response.json({ error: 'Unauthorized — invalid or missing secret.' }, { status: 401 });
    }

    const isTest = searchParams.get('test') === 'true';
    const testEmail = searchParams.get('email') || null;
    const rowLimit = isTest ? parseInt(searchParams.get('limit') || '3', 10) : Infinity;
    const targetCompany = searchParams.get('company') || null;

    if (isTest && !testEmail) {
        return Response.json({ error: 'Test mode requires &email=your@email.com param.' }, { status: 400 });
    }

    const resend = getResend();
    const today = new Date();
    const results = { sent: [], skipped: [], errors: [], testMode: isTest };

    try {
        const db = getAdminDb();
        let companiesSnap;
        if (targetCompany) {
            const doc = await db.collection('companies').doc(targetCompany).get();
            companiesSnap = { docs: doc.exists ? [doc] : [], empty: !doc.exists };
        } else {
            companiesSnap = await db.collection('companies').get();
        }

        if (companiesSnap.empty) {
            return Response.json({ message: 'No companies found.', results });
        }

        for (const companyDoc of companiesSnap.docs) {
            const company = { id: companyDoc.id, ...companyDoc.data() };
            const cId = company.id;

            try {
                // Load notification settings for this company
                let settings = null;
                try {
                    const nsDoc = await db.collection('notif_settings').doc(cId).get();
                    if (nsDoc.exists) settings = nsDoc.data();
                } catch {}

                // In non-test mode, skip companies with email notifications disabled
                if (!isTest) {
                    const usersSnap = await db.collection('users').where('companyIds', 'array-contains', cId).get();
                    const hasOptedInOfficer = usersSnap.docs.some(d => {
                        const u = d.data();
                        return u.role === 'officer' && u.notifSettings?.emailNotifEnabled === true;
                    });
                    if (!settings?.emailNotifEnabled && !hasOptedInOfficer) {
                        results.skipped.push({ company: company.naziv, reason: 'emailNotifEnabled=false' });
                        continue;
                    }
                }

                const threshold = settings?.emailNotifDays ?? 30;
                const emailLang = settings?.emailNotifLang ?? 'bs';

                // Determine recipients
                const recipients = isTest ? [testEmail] : await (async () => {
                    const recipientSet = new Set();
                    if (settings?.emailNotifToCompany && company.email) recipientSet.add(company.email.trim());
                    const usersSnap2 = await db.collection('users').where('companyIds', 'array-contains', cId).get();
                    usersSnap2.forEach(d => {
                        const u = d.data();
                        if (settings?.emailNotifToOfficer && u.role === 'officer' && u.email) recipientSet.add(u.email.trim());
                    });
                    return [...recipientSet].filter(Boolean);
                })();

                if (!recipients.length) {
                    results.skipped.push({ company: company.naziv, reason: 'No recipient emails' });
                    continue;
                }

                const compPath = `companies/${cId}`;
                const cap = rows => rows.sort((a, b) => a._days - b._days).slice(0, rowLimit === Infinity ? rows.length : rowLimit);

                // Fetch all relevant collections in parallel
                const [certsSnap, equipSnap, docsSnap, vehiclesSnap, medSnap, workersSnap] = await Promise.all([
                    settings?.emailNotifCerts !== false ? db.collection(`${compPath}/certificates`).get() : Promise.resolve({ docs: [] }),
                    settings?.emailNotifEquip !== false ? db.collection(`${compPath}/equipment`).get() : Promise.resolve({ docs: [] }),
                    settings?.emailNotifDocs !== false ? db.collection(`${compPath}/employerDocs`).get() : Promise.resolve({ docs: [] }),
                    settings?.emailNotifFleet !== false ? db.collection(`${compPath}/vehicles`).get() : Promise.resolve({ docs: [] }),
                    settings?.emailNotifMedical !== false ? db.collection(`${compPath}/medicalExams`).get() : Promise.resolve({ docs: [] }),
                    db.collection(`${compPath}/workers`).get()
                ]);

                const workerMap = {};
                workersSnap.docs.forEach(doc => {
                    const w = doc.data();
                    workerMap[doc.id] = `${w.ime || ''} ${w.prezime || ''}`.trim() || 'Nepoznat radnik';
                });

                const langs = emailLang === 'bilingual' ? ['bs', 'en'] : [emailLang || 'bs'];
                const allSections = [];

                for (const lang of langs) {
                    // Certificates
                    if (settings?.emailNotifCerts !== false) {
                        const rows = cap(certsSnap.docs.reduce((acc, doc) => {
                            const c = doc.data();
                            const days = daysUntil(c.vrijediDo);
                            if (days !== null && days <= threshold) {
                                const wName = workerMap[c.workerId] || c.workerName || c.workerId || '—';
                                const typeName = c.tipUvjerenjaIme || c.vrstaUvjerenja || c.ime || c.tip || '—';
                                acc.push({ _days: days, [t(lang, 'worker')]: wName, [t(lang, 'type')]: typeName, [t(lang, 'expires')]: fmtDate(c.vrijediDo) });
                            }
                            return acc;
                        }, []));
                        if (rows.length) allSections.push(buildSection(`📜 ${t(lang, 'catCerts')} (${rows.length})`, rows, [{ key: t(lang, 'worker'), label: t(lang, 'worker') }, { key: t(lang, 'type'), label: t(lang, 'type') }, { key: t(lang, 'expires'), label: t(lang, 'expires') }], lang));
                    }
                    // Equipment
                    if (settings?.emailNotifEquip !== false) {
                        const rows = cap(equipSnap.docs.reduce((acc, doc) => {
                            const e = doc.data();
                            const days = daysUntil(e.iduci);
                            if (days !== null && days <= threshold) acc.push({ _days: days, [t(lang, 'equipName')]: e.naziv || e.vrsta || '—', [t(lang, 'invCode')]: e.inventarniBroj || '—', [t(lang, 'nextIns')]: fmtDate(e.iduci) });
                            return acc;
                        }, []));
                        if (rows.length) allSections.push(buildSection(`⚙️ ${t(lang, 'catEquip')} (${rows.length})`, rows, [{ key: t(lang, 'equipName'), label: t(lang, 'equipName') }, { key: t(lang, 'invCode'), label: t(lang, 'invCode') }, { key: t(lang, 'nextIns'), label: t(lang, 'nextIns') }], lang));
                    }
                    // Employer docs
                    if (settings?.emailNotifDocs !== false) {
                        const rows = cap(docsSnap.docs.reduce((acc, doc) => {
                            const d = doc.data();
                            const days = daysUntil(d.datumIsteka);
                            if (days !== null && days <= threshold) acc.push({ _days: days, [t(lang, 'document')]: d.naziv || '—', [t(lang, 'category')]: d.kategorija || '—', [t(lang, 'expires')]: fmtDate(d.datumIsteka) });
                            return acc;
                        }, []));
                        if (rows.length) allSections.push(buildSection(`📄 ${t(lang, 'catDocs')} (${rows.length})`, rows, [{ key: t(lang, 'document'), label: t(lang, 'document') }, { key: t(lang, 'category'), label: t(lang, 'category') }, { key: t(lang, 'expires'), label: t(lang, 'expires') }], lang));
                    }
                    // Fleet
                    if (settings?.emailNotifFleet !== false) {
                        const rows = cap(vehiclesSnap.docs.flatMap(doc => {
                            const v = doc.data();
                            return [{ label: t(lang, 'registracija'), date: v.registracijaIstice }, { label: t(lang, 'tehnickiPregled'), date: v.tehnickiIstice }, { label: t(lang, 'insurance'), date: v.osiguranjeIstice }]
                                .reduce((acc, chk) => {
                                    const days = daysUntil(chk.date);
                                    if (days !== null && days <= threshold) acc.push({ _days: days, [t(lang, 'vehicle')]: `${v.registracija || ''} ${v.marka || ''}`.trim(), [t(lang, 'type')]: chk.label, [t(lang, 'expires')]: fmtDate(chk.date) });
                                    return acc;
                                }, []);
                        }));
                        if (rows.length) allSections.push(buildSection(`🚗 ${t(lang, 'catFleet')} (${rows.length})`, rows, [{ key: t(lang, 'vehicle'), label: t(lang, 'vehicle') }, { key: t(lang, 'type'), label: t(lang, 'type') }, { key: t(lang, 'expires'), label: t(lang, 'expires') }], lang));
                    }
                    // Medical exams
                    if (settings?.emailNotifMedical !== false) {
                        const rows = cap(medSnap.docs.reduce((acc, doc) => {
                            const m = doc.data();
                            const days = daysUntil(m.vrijediDo || m.datumIsteka);
                            if (days !== null && days <= threshold) {
                                const wName = workerMap[m.workerId] || m.workerName || m.workerId || '—';
                                const typeName = m.tipPregleda || m.vrstaPregleda || m.tip || '—';
                                acc.push({ _days: days, [t(lang, 'worker')]: wName, [t(lang, 'examType')]: typeName, [t(lang, 'validUntil')]: fmtDate(m.vrijediDo || m.datumIsteka) });
                            }
                            return acc;
                        }, []));
                        if (rows.length) allSections.push(buildSection(`🩺 ${t(lang, 'catMed')} (${rows.length})`, rows, [{ key: t(lang, 'worker'), label: t(lang, 'worker') }, { key: t(lang, 'examType'), label: t(lang, 'examType') }, { key: t(lang, 'validUntil'), label: t(lang, 'validUntil') }], lang));
                    }
                }

                const primaryLang = langs[0];
                const testBanner = isTest ? `<div style="background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:14px 18px;margin-bottom:20px;text-align:center"><p style="margin:0;font-weight:800;font-size:14px;color:#92400e">🧪 TEST MODE — Testni email. Ograničeno na ${rowLimit} stavki.<br/><span style="font-weight:400;font-size:12px">Primatelj: ${testEmail}</span></p></div>` : '';

                const emailHtml = buildEmailBody({
                    companyName: company.naziv || company.skraceniNaziv || cId,
                    sections: [testBanner, ...allSections],
                    lang: primaryLang,
                    today,
                });

                if (!emailHtml) {
                    results.skipped.push({ company: company.naziv, reason: 'No expiring items within threshold' });
                    continue;
                }

                const subjectBase = `${company.skraceniNaziv || company.naziv}`;
                const todayFmt = fmtDate(today.toISOString().split('T')[0]);
                const subject = emailLang === 'en'
                    ? (isTest ? `🧪 [TEST] eZNR — Expiry Digest for ${subjectBase}` : `⏰ eZNR — Expiry Digest for ${subjectBase}`)
                    : (isTest ? `🧪 [TEST] eZNR — Isticanja za ${subjectBase}` : `⏰ eZNR — Isticanja za ${subjectBase} (${todayFmt})`);

                await resend.emails.send({ from: FROM, to: recipients, subject, html: emailHtml });
                results.sent.push({ company: company.naziv, recipients, sections: allSections.length });

            } catch (companyErr) {
                console.error(`[notify-expiry] Error processing company ${cId}:`, companyErr.message);
                results.errors.push({ company: company.naziv || cId, error: companyErr.message });
            }
        }

        return Response.json({
            ok: true,
            testMode: isTest,
            date: today.toISOString(),
            sent: results.sent.length,
            skipped: results.skipped.length,
            errors: results.errors.length,
            details: results,
        });
    } catch (err) {
        console.error('[notify-expiry] Fatal error:', err.message);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
