// ============================================================================
// /api/notify-expiry — Automated Daily Expiry Notification
//
// Called by GCP Cloud Scheduler every day at 07:00.
// Protected by NOTIFY_SECRET query param — rejects all other callers.
//
// Flow:
//   1. Verify secret
//   2. Read all companies from Firestore
//   3. For each company, read expiry data & officer settings
//   4. Build a bilingual HTML email digest
//   5. Send via Resend to company email + officer emails
//
// TODO (Future): Add Croatian, Slovenian, Serbian language support
//   when those app versions are launched. Update buildEmailBody() lang switch.
// ============================================================================

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Firebase Admin (server-side only) ────────────────────────────────────────
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

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@mail.zastitanaradu.ba';
const APP_URL = 'https://zastitanaradu.ba';

// ── Date helpers ──────────────────────────────────────────────────────────────
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

// ── Localization ──────────────────────────────────────────────────────────────
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
        catMed: 'Ljekarski pregledi', examType: 'Vrsta pregleda', validUntil: 'Važi do'
    },
    hr: {
        expired: 'Isteklo', days: 'd', status: 'Status',
        titleDig: 'DNEVNI PREGLED ISTICANJA', company: 'Tvrtka', generated: 'Generirano',
        intro: 'U nastavku je pregled svih stavki koje su istekle ili istječu u narednom periodu. Molimo poduzmite odgovarajuće mjere.',
        openApp: 'Otvori aplikaciju →', autoEmail: 'Automatski e-mail — eZNR Platforma za zaštitu na radu',
        disableOpt: 'Za isključivanje ovih e-mailova idite na: Postavke → Obavijesti → Automatski Email',
        catCerts: 'Uvjerenja radnika', worker: 'Radnik', type: 'Vrsta', expires: 'Istječe',
        catPPE: 'Zaštitna oprema', item: 'Artikl', assigned: 'Dodijeljeno',
        catEquip: 'Radna oprema', equipName: 'Oprema', invCode: 'Inv. br.', nextIns: 'Sljedeći pregled',
        catDocs: 'Dokumenti poslodavca', document: 'Dokument', category: 'Kategorija',
        catFleet: 'Vozni park', vehicle: 'Vozilo',
        catMed: 'Liječnički pregledi', examType: 'Vrsta pregleda', validUntil: 'Vrijedi do'
    },
    sr: {
        expired: 'Isteklo', days: 'd', status: 'Status',
        titleDig: 'DNEVNI PREGLED ISTICANJA', company: 'Preduzeće', generated: 'Generisano',
        intro: 'U nastavku se nalazi pregled svih stavki koje su istekle ili ističu u narednom periodu. Molimo preduzmite odgovarajuće mere.',
        openApp: 'Otvori aplikaciju →', autoEmail: 'Automatski email — eZNR Platforma za zaštitu na radu',
        disableOpt: 'Za isključivanje ovih emailova idite na: Postavke → Obaveštenja → Automatski Email',
        catCerts: 'Uverenja radnika', worker: 'Radnik', type: 'Vrsta', expires: 'Ističe',
        catPPE: 'Zaštitna oprema', item: 'Artikal', assigned: 'Dodeljeno',
        catEquip: 'Radna oprema', equipName: 'Oprema', invCode: 'Inv. br.', nextIns: 'Sledeći pregled',
        catDocs: 'Dokumenti poslodavca', document: 'Dokument', category: 'Kategorija',
        catFleet: 'Vozni park', vehicle: 'Vozilo',
        catMed: 'Lekarski pregledi', examType: 'Vrsta pregleda', validUntil: 'Važi do'
    },
    sl: {
        expired: 'Poteklo', days: 'd', status: 'Status',
        titleDig: 'DNEVNI PREGLED POTEKA', company: 'Podjetje', generated: 'Generirano',
        intro: 'Spodaj je pregled vseh postavk, ki so potekle ali bodo kmalu potekle. Prosimo, ustrezno ukrepajte.',
        openApp: 'Odpri aplikacijo →', autoEmail: 'Samodejna e-pošta — eZNR Platforma za varnost pri delu',
        disableOpt: 'Za izklop teh e-poštnih sporočil pojdite na: Nastavitve → Obvestila → Samodejna e-pošta',
        catCerts: 'Potrdila delavcev', worker: 'Delavec', type: 'Vrsta', expires: 'Poteka',
        catPPE: 'Zaščitna oprema', item: 'Artikel', assigned: 'Dodeljeno',
        catEquip: 'Delovna oprema', equipName: 'Oprema', invCode: 'Inv. št.', nextIns: 'Naslednji pregled',
        catDocs: 'Dokumenti delodajalca', document: 'Dokument', category: 'Kategorija',
        catFleet: 'Vozni park', vehicle: 'Vozilo',
        catMed: 'Zdravniški pregledi', examType: 'Vrsta pregleda', validUntil: 'Velja do'
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
        catMed: 'Medical Exams', examType: 'Exam Type', validUntil: 'Valid Until'
    }
};

function t(lang, key) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.bs;
    return dict[key] || TRANSLATIONS.en[key] || key;
}

// ── Row color by expiry ───────────────────────────────────────────────────────
function rowStyle(days) {
    if (days === null) return '';
    if (days < 0) return 'background:#fff1f2;';   // expired — red
    if (days <= 7) return 'background:#fff7ed;';   // ≤7 — orange
    if (days <= 30) return 'background:#fefce8;';  // ≤30 — yellow
    return '';
}

function statusBadge(days, lang) {
    if (days === null) return '';
    if (days < 0) return `<span style="color:#ef4444;font-weight:700">⛔ ${t(lang, 'expired')}</span>`;
    if (days <= 7) return `<span style="color:#f97316;font-weight:700">🔴 ${days}${t(lang, 'days')}</span>`;
    if (days <= 30) return `<span style="color:#eab308;font-weight:700">⚠️ ${days}${t(lang, 'days')}</span>`;
    return `<span style="color:#22c55e;font-weight:600">✅ ${days}${t(lang, 'days')}</span>`;
}

// ── Section block builder ─────────────────────────────────────────────────────
function buildSection(title, rows, cols, lang) {
    if (!rows || rows.length === 0) return '';

    const rowsHtml = rows.map(row => `
        <tr style="${rowStyle(row._days)}">
            ${cols.map(col => `<td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${row[col.key] ?? '—'}</td>`).join('')}
            <td style="padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:center">${statusBadge(row._days, lang)}</td>
        </tr>`).join('');

    return `
        <div style="margin-bottom:28px">
            <h3 style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1e293b">${title}</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
                <thead>
                    <tr style="background:#f8fafc">
                        ${cols.map(col => `<th style="padding:9px 10px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${col.label}</th>`).join('')}
                        <th style="padding:9px 10px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${t(lang, 'status')}</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>`;
}

// ── Main email builder ────────────────────────────────────────────────────────
function buildEmailBody({ companyName, sections, lang, today }) {
    const todayStr = fmtDate(today.toISOString().split('T')[0]);

    const sectionsHtml = sections.join('');

    if (!sectionsHtml.trim()) return null; // Nothing to report

    return `<!DOCTYPE html>
<html lang="${lang || 'bs'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>eZNR — ${t(lang, 'titleDig')}</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

      <!-- Header image -->
      <tr><td style="border-radius:16px 16px 0 0;overflow:hidden;padding:0;font-size:0;line-height:0">
        <img src="${APP_URL}/email-header.png" alt="eZNR" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:16px 16px 0 0" />
      </td></tr>

      <!-- Urgency banner -->
      <tr><td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:14px 40px;text-align:center">
        <p style="margin:0;font-size:14px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:2px">
          ⏰ ${t(lang, 'titleDig')}
        </p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#fff;padding:36px 40px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
        <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700">
          ${t(lang, 'company')}
        </p>
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#1e293b">${companyName}</h1>
        <p style="margin:0 0 28px;font-size:13px;color:#64748b">${t(lang, 'generated')}: ${todayStr}</p>

        <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7">
          ${t(lang, 'intro')}
        </p>

        ${sectionsHtml}

        <!-- CTA -->
        <div style="text-align:center;margin:28px 0">
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px">
            ${t(lang, 'openApp')}
          </a>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center">
        <p style="margin:0 0 4px;font-size:12px;color:#64748b">
          ${t(lang, 'autoEmail')}
        </p>
        <p style="margin:0;font-size:11px;color:#94a3b8">
          ${t(lang, 'disableOpt')}
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── GET handler (called by Cloud Scheduler, or manually with ?test=true) ─────
//
// Normal mode:  /api/notify-expiry?secret=YOUR_SECRET
// Test mode:    /api/notify-expiry?secret=YOUR_SECRET&test=true&email=you@example.com&limit=3&company=COMPANY_ID
//
//   test=true   → redirect ALL emails to &email=, add TEST MODE banner, skip emailNotifEnabled check
//   email=      → override recipient (required in test mode)
//   limit=N     → max N rows per category (default 3 in test, unlimited in prod)
//   company=ID  → only process one specific company (optional, useful for targeting)
//
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Security check
    if (!secret || secret !== process.env.NOTIFY_SECRET) {
        return NextResponse.json(
            { error: 'Unauthorized — invalid or missing secret.' },
            { status: 401 }
        );
    }

    // ── Test mode params ──────────────────────────────────────────────────────
    const isTest = searchParams.get('test') === 'true';
    const testEmail = searchParams.get('email') || null;
    const rowLimit = isTest ? parseInt(searchParams.get('limit') || '3', 10) : Infinity;
    const targetCompany = searchParams.get('company') || null;

    if (isTest && !testEmail) {
        return NextResponse.json(
            { error: 'Test mode requires &email=your@email.com param.' },
            { status: 400 }
        );
    }

    const today = new Date();
    const results = { sent: [], skipped: [], errors: [], testMode: isTest };

    try {
        const db = getAdminDb();

        // ── Load companies ────────────────────────────────────────────────────
        let companiesSnap;
        if (targetCompany) {
            const doc = await db.collection('companies').doc(targetCompany).get();
            companiesSnap = { docs: doc.exists ? [doc] : [], empty: !doc.exists };
        } else {
            companiesSnap = await db.collection('companies').get();
        }

        if (companiesSnap.empty) {
            return NextResponse.json({ message: 'No companies found.', results });
        }

        for (const companyDoc of companiesSnap.docs) {
            const company = { id: companyDoc.id, ...companyDoc.data() };
            const cId = company.id;

            try {
                // ── Load notification settings ────────────────────────────────
                let companyNotifSettings = null;
                try {
                    const nsDoc = await db.collection('notif_settings').doc(cId).get();
                    if (nsDoc.exists) companyNotifSettings = nsDoc.data();
                } catch { /* no settings doc yet */ }

                // In test mode: bypass the emailNotifEnabled gate
                if (!isTest) {
                    const usersSnap = await db.collection('users')
                        .where('companyIds', 'array-contains', cId)
                        .get();
                    const activeOfficers = [];
                    usersSnap.forEach(doc => {
                        const u = doc.data();
                        if (u.role === 'officer' && u.notifSettings?.emailNotifEnabled === true) {
                            activeOfficers.push(u);
                        }
                    });

                    const settings = companyNotifSettings;
                    if (!settings?.emailNotifEnabled && activeOfficers.length === 0) {
                        results.skipped.push({ company: company.naziv, reason: 'emailNotifEnabled=false' });
                        continue;
                    }
                }

                const settings = companyNotifSettings;
                const threshold = settings?.emailNotifDays ?? 30;
                const emailLang = settings?.emailNotifLang ?? 'bs';

                // ── Recipients ────────────────────────────────────────────────
                // In test mode: always send to testEmail only
                const recipients = isTest ? [testEmail] : await (async () => {
                    const recipientSet = new Set();
                    if (settings?.emailNotifToCompany && company.email) {
                        recipientSet.add(company.email.trim());
                    }
                    const usersSnap2 = await db.collection('users')
                        .where('companyIds', 'array-contains', cId)
                        .get();
                    usersSnap2.forEach(doc => {
                        const u = doc.data();
                        if (settings?.emailNotifToOfficer && u.role === 'officer' && u.email) {
                            recipientSet.add(u.email.trim());
                        }
                    });
                    return [...recipientSet].filter(Boolean);
                })();

                if (!recipients.length) {
                    results.skipped.push({ company: company.naziv, reason: 'No recipient emails' });
                    continue;
                }

                // ── Load data ─────────────────────────────────────────────────
                const compPath = `companies/${cId}`;
                const [certsSnap, equipSnap, docsSnap, vehiclesSnap, medSnap] = await Promise.all([
                    settings?.emailNotifCerts !== false
                        ? db.collection(`${compPath}/certificates`).get()
                        : Promise.resolve({ docs: [] }),
                    settings?.emailNotifEquip !== false
                        ? db.collection(`${compPath}/equipment`).get()
                        : Promise.resolve({ docs: [] }),
                    settings?.emailNotifDocs !== false
                        ? db.collection(`${compPath}/employerDocs`).get()
                        : Promise.resolve({ docs: [] }),
                    settings?.emailNotifFleet !== false
                        ? db.collection(`${compPath}/vehicles`).get()
                        : Promise.resolve({ docs: [] }),
                    settings?.emailNotifMedical !== false
                        ? db.collection(`${compPath}/medicalExams`).get()
                        : Promise.resolve({ docs: [] }),
                ]);

                // ── Build sections ────────────────────────────────────────────
                const langs = emailLang === 'bilingual' ? ['bs', 'en'] : [emailLang || 'bs'];
                const allSections = [];

                for (const lang of langs) {
                    // Helper: sort and cap rows
                    const cap = (rows) => rows.sort((a, b) => a._days - b._days).slice(0, rowLimit);

                    // Certificates
                    if (settings?.emailNotifCerts !== false) {
                        const certRows = cap(certsSnap.docs.reduce((acc, doc) => {
                            const c = doc.data();
                            const days = daysUntil(c.vrijediDo);
                            if (days !== null && days <= threshold) {
                                acc.push({
                                    _days: days,
                                    [t(lang, 'worker')]: c.workerName || c.workerId || '—',
                                    [t(lang, 'type')]: c.vrstaUvjerenja || c.tip || '—',
                                    [t(lang, 'expires')]: fmtDate(c.vrijediDo),
                                });
                            }
                            return acc;
                        }, []));
                        if (certRows.length) allSections.push(buildSection(
                            `📜 ${t(lang, 'catCerts')} (${certRows.length}${isTest ? ' — TEST' : ''})`,
                            certRows,
                            [
                                { key: t(lang, 'worker'), label: t(lang, 'worker') },
                                { key: t(lang, 'type'), label: t(lang, 'type') },
                                { key: t(lang, 'expires'), label: t(lang, 'expires') },
                            ],
                            lang
                        ));
                    }

                    // Equipment
                    if (settings?.emailNotifEquip !== false) {
                        const equipRows = cap(equipSnap.docs.reduce((acc, doc) => {
                            const e = doc.data();
                            const days = daysUntil(e.iduci);
                            if (days !== null && days <= threshold) {
                                acc.push({
                                    _days: days,
                                    [t(lang, 'equipName')]: e.naziv || e.vrsta || '—',
                                    [t(lang, 'invCode')]: e.inventarniBroj || '—',
                                    [t(lang, 'nextIns')]: fmtDate(e.iduci),
                                });
                            }
                            return acc;
                        }, []));
                        if (equipRows.length) allSections.push(buildSection(
                            `⚙️ ${t(lang, 'catEquip')} (${equipRows.length}${isTest ? ' — TEST' : ''})`,
                            equipRows,
                            [
                                { key: t(lang, 'equipName'), label: t(lang, 'equipName') },
                                { key: t(lang, 'invCode'), label: t(lang, 'invCode') },
                                { key: t(lang, 'nextIns'), label: t(lang, 'nextIns') },
                            ],
                            lang
                        ));
                    }

                    // Employer docs
                    if (settings?.emailNotifDocs !== false) {
                        const docRows = cap(docsSnap.docs.reduce((acc, doc) => {
                            const d = doc.data();
                            const days = daysUntil(d.datumIsteka);
                            if (days !== null && days <= threshold) {
                                acc.push({
                                    _days: days,
                                    [t(lang, 'document')]: d.naziv || '—',
                                    [t(lang, 'category')]: d.kategorija || '—',
                                    [t(lang, 'expires')]: fmtDate(d.datumIsteka),
                                });
                            }
                            return acc;
                        }, []));
                        if (docRows.length) allSections.push(buildSection(
                            `📄 ${t(lang, 'catDocs')} (${docRows.length}${isTest ? ' — TEST' : ''})`,
                            docRows,
                            [
                                { key: t(lang, 'document'), label: t(lang, 'document') },
                                { key: t(lang, 'category'), label: t(lang, 'category') },
                                { key: t(lang, 'expires'), label: t(lang, 'expires') },
                            ],
                            lang
                        ));
                    }

                    // Fleet / Vehicles
                    if (settings?.emailNotifFleet !== false) {
                        const fleetRows = cap(vehiclesSnap.docs.flatMap(doc => {
                            const v = doc.data();
                            return [
                                { label: t(lang, 'assigned'), date: v.registracijaIstice },
                                { label: t(lang, 'type'), date: v.tehnickiIstice },
                                { label: t(lang, 'category'), date: v.osiguranjeIstice },
                            ].reduce((acc, chk) => {
                                const days = daysUntil(chk.date);
                                if (days !== null && days <= threshold) {
                                    acc.push({
                                        _days: days,
                                        [t(lang, 'vehicle')]: `${v.registracija || ''} ${v.marka || ''}`.trim(),
                                        [t(lang, 'type')]: chk.label,
                                        [t(lang, 'expires')]: fmtDate(chk.date),
                                    });
                                }
                                return acc;
                            }, []);
                        }));
                        if (fleetRows.length) allSections.push(buildSection(
                            `🚗 ${t(lang, 'catFleet')} (${fleetRows.length}${isTest ? ' — TEST' : ''})`,
                            fleetRows,
                            [
                                { key: t(lang, 'vehicle'), label: t(lang, 'vehicle') },
                                { key: t(lang, 'type'), label: t(lang, 'type') },
                                { key: t(lang, 'expires'), label: t(lang, 'expires') },
                            ],
                            lang
                        ));
                    }

                    // Medical exams
                    if (settings?.emailNotifMedical !== false) {
                        const medRows = cap(medSnap.docs.reduce((acc, doc) => {
                            const m = doc.data();
                            const days = daysUntil(m.vrijediDo || m.datumIsteka);
                            if (days !== null && days <= threshold) {
                                acc.push({
                                    _days: days,
                                    [t(lang, 'worker')]: m.workerName || m.workerId || '—',
                                    [t(lang, 'examType')]: m.vrstaPregleda || m.tip || '—',
                                    [t(lang, 'validUntil')]: fmtDate(m.vrijediDo || m.datumIsteka),
                                });
                            }
                            return acc;
                        }, []));
                        if (medRows.length) allSections.push(buildSection(
                            bs ? `🩺 Ljekarski pregledi (${medRows.length}${isTest ? ' — TEST' : ''})` : `🩺 Medical Exams (${medRows.length}${isTest ? ' — TEST' : ''})`,
                            medRows,
                            [
                                { key: bs ? 'Radnik' : 'Worker', label: bs ? 'Radnik' : 'Worker' },
                                { key: bs ? 'Vrsta pregleda' : 'Exam type', label: bs ? 'Vrsta' : 'Type' },
                                { key: bs ? 'Važi do' : 'Valid until', label: bs ? 'Važi do' : 'Valid Until' },
                            ],
                            lang
                        ));
                    }
                }

                // ── Build email ───────────────────────────────────────────────
                const primaryLang = langs[0];

                // Prepend TEST MODE banner
                const testBanner = isTest ? `
                    <div style="background:#fef3c7;border:2px dashed #f59e0b;border-radius:10px;padding:14px 18px;margin-bottom:20px;text-align:center">
                        <p style="margin:0;font-weight:800;font-size:14px;color:#92400e">
                            🧪 TEST MODE — Ovo je testni email. Isticanja su ograničena na ${rowLimit} po kategoriji.<br/>
                            <span style="font-weight:400;font-size:12px">Primatelj: ${testEmail}</span>
                        </p>
                    </div>` : '';

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

                const subjectBs = isTest
                    ? `🧪 [TEST] eZNR — Isticanja za ${company.skraceniNaziv || company.naziv}`
                    : `⏰ eZNR — Isticanja za ${company.skraceniNaziv || company.naziv} (${fmtDate(today.toISOString().split('T')[0])})`;
                const subjectEn = isTest
                    ? `🧪 [TEST] eZNR — Expiry Digest for ${company.skraceniNaziv || company.naziv}`
                    : `⏰ eZNR — Expiry Digest for ${company.skraceniNaziv || company.naziv}`;
                const subject = emailLang === 'en' ? subjectEn : emailLang === 'bilingual' ? `${subjectBs} / ${subjectEn}` : subjectBs;

                await resend.emails.send({ from: FROM, to: recipients, subject, html: emailHtml });

                results.sent.push({ company: company.naziv, recipients, itemCount: allSections.length });

            } catch (companyErr) {
                console.error(`[notify-expiry] Error processing company ${cId}:`, companyErr);
                results.errors.push({ company: company.naziv || cId, error: companyErr.message });
            }
        }

        return NextResponse.json({
            ok: true,
            testMode: isTest,
            date: today.toISOString(),
            sent: results.sent.length,
            skipped: results.skipped.length,
            errors: results.errors.length,
            details: results,
        });

    } catch (err) {
        console.error('[notify-expiry] Fatal error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
