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
        // Uses Application Default Credentials when running on GCP/Vercel
        // For local dev: set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path
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

// ── Row color by expiry ───────────────────────────────────────────────────────
function rowStyle(days) {
    if (days === null) return '';
    if (days < 0) return 'background:#fff1f2;'; // expired — red
    if (days <= 7) return 'background:#fff7ed;'; // ≤7 — orange
    if (days <= 30) return 'background:#fefce8;'; // ≤30 — yellow
    return '';
}

function statusBadge(days, lang) {
    const bs = lang !== 'en';
    if (days === null) return '';
    if (days < 0) return `<span style="color:#ef4444;font-weight:700">⛔ ${bs ? 'Isteklo' : 'Expired'}</span>`;
    if (days <= 7) return `<span style="color:#f97316;font-weight:700">🔴 ${days}d</span>`;
    if (days <= 30) return `<span style="color:#eab308;font-weight:700">⚠️ ${days}d</span>`;
    return `<span style="color:#22c55e;font-weight:600">✅ ${days}d</span>`;
}

// ── Section block builder ─────────────────────────────────────────────────────
function buildSection(title, rows, cols, lang) {
    if (!rows || rows.length === 0) return '';
    const bs = lang !== 'en';

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
                        <th style="padding:9px 10px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e2e8f0">${bs ? 'Status' : 'Status'}</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>`;
}

// ── Main email builder ────────────────────────────────────────────────────────
function buildEmailBody({ companyName, sections, lang, today }) {
    const bs = lang !== 'en';
    const todayStr = fmtDate(today.toISOString().split('T')[0]);

    const sectionsHtml = sections.join('');

    if (!sectionsHtml.trim()) return null; // Nothing to report

    return `<!DOCTYPE html>
<html lang="${bs ? 'bs' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>eZNR — ${bs ? 'Dnevni pregled isticanja' : 'Daily Expiry Digest'}</title></head>
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
          ⏰ ${bs ? 'DNEVNI PREGLED ISTICANJA' : 'DAILY EXPIRY DIGEST'}
        </p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#fff;padding:36px 40px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
        <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700">
          ${bs ? 'Firma' : 'Company'}
        </p>
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#1e293b">${companyName}</h1>
        <p style="margin:0 0 28px;font-size:13px;color:#64748b">${bs ? 'Generisano' : 'Generated'}: ${todayStr}</p>

        <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7">
          ${bs
            ? 'Ispod se nalazi pregled svih stavki koje su istekle ili ističu u narednom periodu. Molimo preduzmite odgovarajuće mjere.'
            : 'Below is a summary of all items that have expired or are expiring soon. Please take appropriate action.'}
        </p>

        ${sectionsHtml}

        <!-- CTA -->
        <div style="text-align:center;margin:28px 0">
          <a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px">
            ${bs ? 'Otvori aplikaciju →' : 'Open App →'}
          </a>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center">
        <p style="margin:0 0 4px;font-size:12px;color:#64748b">
          ${bs ? 'Automatski email — eZNR Platforma za zaštitu na radu' : 'Automated email — eZNR Occupational Safety Platform'}
        </p>
        <p style="margin:0;font-size:11px;color:#94a3b8">
          ${bs ? 'Za isključivanje ovih emailova idite na: Postavke → Obavijesti → Automatski Email'
                : 'To disable these emails go to: Settings → Notifications → Automated Email'}
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── GET handler (called by Cloud Scheduler) ───────────────────────────────────
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

    const today = new Date();
    const results = { sent: [], skipped: [], errors: [] };

    try {
        const db = getAdminDb();

        // ── Load all companies ──────────────────────────────────────────────
        const companiesSnap = await db.collection('companies').get();
        if (companiesSnap.empty) {
            return NextResponse.json({ message: 'No companies found.', results });
        }

        for (const companyDoc of companiesSnap.docs) {
            const company = { id: companyDoc.id, ...companyDoc.data() };
            const cId = company.id;

            try {
                // ── Load notification settings for this company ─────────────
                // Settings are stored per-user; we grab from the first officer with emailNotifEnabled
                const usersSnap = await db.collection('users')
                    .where('companyIds', 'array-contains', cId)
                    .get();

                // Find officers who have emailNotifEnabled=true
                const activeOfficers = [];
                usersSnap.forEach(doc => {
                    const u = doc.data();
                    if (u.role === 'officer' && u.notifSettings?.emailNotifEnabled === true) {
                        activeOfficers.push(u);
                    }
                });

                // Also check global notifSettings storage (set per-browser in localStorage,
                // synced to Firestore under /notif_settings/{companyId})
                let companyNotifSettings = null;
                try {
                    const nsDoc = await db.collection('notif_settings').doc(cId).get();
                    if (nsDoc.exists) companyNotifSettings = nsDoc.data();
                } catch { /* no settings doc yet */ }

                // Determine if email should be sent for this company
                const settings = companyNotifSettings;
                if (!settings?.emailNotifEnabled && activeOfficers.length === 0) {
                    results.skipped.push({ company: company.naziv, reason: 'emailNotifEnabled=false' });
                    continue;
                }

                const threshold = settings?.emailNotifDays ?? 30;
                const emailLang = settings?.emailNotifLang ?? 'bs';

                // ── Collect recipient emails ────────────────────────────────
                const recipientSet = new Set();
                if (settings?.emailNotifToCompany && company.email) {
                    recipientSet.add(company.email.trim());
                }
                if (settings?.emailNotifToOfficer || activeOfficers.length > 0) {
                    for (const officer of activeOfficers) {
                        if (officer.email) recipientSet.add(officer.email.trim());
                    }
                    // Also grab all officers for this company regardless of personal settings
                    usersSnap.forEach(doc => {
                        const u = doc.data();
                        if (settings?.emailNotifToOfficer && u.role === 'officer' && u.email) {
                            recipientSet.add(u.email.trim());
                        }
                    });
                }

                const recipients = [...recipientSet].filter(Boolean);
                if (recipients.length === 0) {
                    results.skipped.push({ company: company.naziv, reason: 'No recipient emails' });
                    continue;
                }

                // ── Load company data from Firestore ────────────────────────
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

                // ── Build sections for each language ────────────────────────
                const langs = emailLang === 'bilingual' ? ['bs', 'en'] : [emailLang || 'bs'];
                const allSections = [];

                for (const lang of langs) {
                    const bs = lang !== 'en';

                    // Certificates
                    if (settings?.emailNotifCerts !== false) {
                        const certRows = [];
                        certsSnap.docs.forEach(doc => {
                            const c = doc.data();
                            const days = daysUntil(c.vrijediDo);
                            if (days !== null && days <= threshold) {
                                certRows.push({
                                    _days: days,
                                    [bs ? 'Radnik' : 'Worker']: c.workerName || c.workerId || '—',
                                    [bs ? 'Vrsta uvjerenja' : 'Certificate type']: c.vrstaUvjerenja || c.tip || '—',
                                    [bs ? 'Važi do' : 'Expires']: fmtDate(c.vrijediDo),
                                });
                            }
                        });
                        certRows.sort((a, b) => a._days - b._days);
                        if (certRows.length) {
                            allSections.push(buildSection(
                                bs ? `📜 Uvjerenja radnika (${certRows.length})` : `📜 Worker Certificates (${certRows.length})`,
                                certRows,
                                [
                                    { key: bs ? 'Radnik' : 'Worker', label: bs ? 'Radnik' : 'Worker' },
                                    { key: bs ? 'Vrsta uvjerenja' : 'Certificate type', label: bs ? 'Vrsta' : 'Type' },
                                    { key: bs ? 'Važi do' : 'Expires', label: bs ? 'Važi do' : 'Expires' },
                                ],
                                lang
                            ));
                        }
                    }

                    // Equipment
                    if (settings?.emailNotifEquip !== false) {
                        const equipRows = [];
                        equipSnap.docs.forEach(doc => {
                            const e = doc.data();
                            const days = daysUntil(e.iduci);
                            if (days !== null && days <= threshold) {
                                equipRows.push({
                                    _days: days,
                                    [bs ? 'Oprema' : 'Equipment']: e.naziv || e.vrsta || '—',
                                    [bs ? 'Inv. broj' : 'Inv. #']: e.inventarniBroj || '—',
                                    [bs ? 'Sljedeći pregled' : 'Next inspection']: fmtDate(e.iduci),
                                });
                            }
                        });
                        equipRows.sort((a, b) => a._days - b._days);
                        if (equipRows.length) {
                            allSections.push(buildSection(
                                bs ? `⚙️ Radna oprema — pregledi (${equipRows.length})` : `⚙️ Equipment Inspections (${equipRows.length})`,
                                equipRows,
                                [
                                    { key: bs ? 'Oprema' : 'Equipment', label: bs ? 'Naziv' : 'Name' },
                                    { key: bs ? 'Inv. broj' : 'Inv. #', label: bs ? 'Inv. br.' : 'Inv. #' },
                                    { key: bs ? 'Sljedeći pregled' : 'Next inspection', label: bs ? 'Sljedeći pregled' : 'Next Inspection' },
                                ],
                                lang
                            ));
                        }
                    }

                    // Employer docs
                    if (settings?.emailNotifDocs !== false) {
                        const docRows = [];
                        docsSnap.docs.forEach(doc => {
                            const d = doc.data();
                            const days = daysUntil(d.datumIsteka);
                            if (days !== null && days <= threshold) {
                                docRows.push({
                                    _days: days,
                                    [bs ? 'Dokument' : 'Document']: d.naziv || '—',
                                    [bs ? 'Kategorija' : 'Category']: d.kategorija || '—',
                                    [bs ? 'Ističe' : 'Expires']: fmtDate(d.datumIsteka),
                                });
                            }
                        });
                        docRows.sort((a, b) => a._days - b._days);
                        if (docRows.length) {
                            allSections.push(buildSection(
                                bs ? `📄 Dokumenti poslodavca (${docRows.length})` : `📄 Employer Documents (${docRows.length})`,
                                docRows,
                                [
                                    { key: bs ? 'Dokument' : 'Document', label: bs ? 'Naziv' : 'Name' },
                                    { key: bs ? 'Kategorija' : 'Category', label: bs ? 'Kategorija' : 'Category' },
                                    { key: bs ? 'Ističe' : 'Expires', label: bs ? 'Ističe' : 'Expires' },
                                ],
                                lang
                            ));
                        }
                    }

                    // Fleet / Vehicles
                    if (settings?.emailNotifFleet !== false) {
                        const fleetRows = [];
                        vehiclesSnap.docs.forEach(doc => {
                            const v = doc.data();
                            const checks = [
                                { label: bs ? 'Registracija' : 'Registration', date: v.registracijaIstice },
                                { label: bs ? 'Tehnički pregled' : 'Technical inspection', date: v.tehnickiIstice },
                                { label: bs ? 'Osiguranje' : 'Insurance', date: v.osiguranjeIstice },
                            ];
                            for (const chk of checks) {
                                const days = daysUntil(chk.date);
                                if (days !== null && days <= threshold) {
                                    fleetRows.push({
                                        _days: days,
                                        [bs ? 'Vozilo' : 'Vehicle']: `${v.registracija || ''} ${v.marka || ''}`.trim(),
                                        [bs ? 'Tip' : 'Type']: chk.label,
                                        [bs ? 'Ističe' : 'Expires']: fmtDate(chk.date),
                                    });
                                }
                            }
                        });
                        fleetRows.sort((a, b) => a._days - b._days);
                        if (fleetRows.length) {
                            allSections.push(buildSection(
                                bs ? `🚗 Vozni park (${fleetRows.length})` : `🚗 Fleet / Vehicles (${fleetRows.length})`,
                                fleetRows,
                                [
                                    { key: bs ? 'Vozilo' : 'Vehicle', label: bs ? 'Vozilo' : 'Vehicle' },
                                    { key: bs ? 'Tip' : 'Type', label: bs ? 'Tip' : 'Type' },
                                    { key: bs ? 'Ističe' : 'Expires', label: bs ? 'Ističe' : 'Expires' },
                                ],
                                lang
                            ));
                        }
                    }

                    // Medical exams
                    if (settings?.emailNotifMedical !== false) {
                        const medRows = [];
                        medSnap.docs.forEach(doc => {
                            const m = doc.data();
                            const days = daysUntil(m.vrijediDo || m.datumIsteka);
                            if (days !== null && days <= threshold) {
                                medRows.push({
                                    _days: days,
                                    [bs ? 'Radnik' : 'Worker']: m.workerName || m.workerId || '—',
                                    [bs ? 'Vrsta pregleda' : 'Exam type']: m.vrstaPregleda || m.tip || '—',
                                    [bs ? 'Važi do' : 'Valid until']: fmtDate(m.vrijediDo || m.datumIsteka),
                                });
                            }
                        });
                        medRows.sort((a, b) => a._days - b._days);
                        if (medRows.length) {
                            allSections.push(buildSection(
                                bs ? `🩺 Ljekarski pregledi (${medRows.length})` : `🩺 Medical Exams (${medRows.length})`,
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
                }

                // ── Build and send email ────────────────────────────────────
                const primaryLang = langs[0];
                const emailHtml = buildEmailBody({
                    companyName: company.naziv || company.skraceniNaziv || cId,
                    sections: allSections,
                    lang: primaryLang,
                    today,
                });

                if (!emailHtml) {
                    results.skipped.push({ company: company.naziv, reason: 'No expiring items within threshold' });
                    continue;
                }

                const subjectBs = `⏰ eZNR — Isticanja za ${company.skraceniNaziv || company.naziv} (${fmtDate(today.toISOString().split('T')[0])})`;
                const subjectEn = `⏰ eZNR — Expiry Digest for ${company.skraceniNaziv || company.naziv}`;
                const subject = emailLang === 'en' ? subjectEn : emailLang === 'bilingual' ? `${subjectBs} / ${subjectEn}` : subjectBs;

                await resend.emails.send({
                    from: FROM,
                    to: recipients,
                    subject,
                    html: emailHtml,
                });

                results.sent.push({
                    company: company.naziv,
                    recipients,
                    itemCount: allSections.length,
                });

            } catch (companyErr) {
                console.error(`[notify-expiry] Error processing company ${cId}:`, companyErr);
                results.errors.push({ company: company.naziv || cId, error: companyErr.message });
            }
        }

        return NextResponse.json({
            ok: true,
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
