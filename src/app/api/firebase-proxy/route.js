/**
 * /api/firebase-proxy/route.js
 *
 * Runs ALL Firebase functions directly on Vercel (Gemini AI + Resend email + Firestore Admin).
 * Eliminates Firebase Cloud Run entirely — no IAM/CORS issues possible.
 *
 * POST /api/firebase-proxy
 * Body: { functionName: string, data: object }
 */

import { Resend } from 'resend';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';


export const maxDuration = 300;

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
const rateMap = new Map();
const RATE_LIMIT = 30;   // requests per window
const RATE_WINDOW = 60_000; // 1 minute

function checkRate(ip) {
    const now = Date.now();
    let r = rateMap.get(ip);
    if (!r || now > r.resetAt) r = { count: 0, resetAt: now + RATE_WINDOW };
    r.count++;
    rateMap.set(ip, r);
    // Prune old entries every 500 requests to prevent memory leak
    if (rateMap.size > 500) {
        for (const [k, v] of rateMap) if (now > v.resetAt) rateMap.delete(k);
    }
    return { allowed: r.count <= RATE_LIMIT, waitSec: Math.ceil((r.resetAt - now) / 1000) };
}

// ─── Firebase Admin (for Firestore server-side access) ────────────────────────
function setupAdmin() {
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        });
    }
}
function getAdminDb() {
    setupAdmin();
    return getFirestore();
}
function getAdminStorage() {
    setupAdmin();
    return getStorage().bucket();
}

// ─── Resend email client ──────────────────────────────────────────────────────
let resendInstance = null;
function getResend() {
    if (!resendInstance) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error('RESEND_API_KEY not configured');
        resendInstance = new Resend(apiKey);
    }
    return resendInstance;
}

// ─── Email HTML templates (ported from functions/endpoints/emailTemplate.js) ──
const EMAIL_BASE = 'https://zastitanaradu.ba';


function buildHazardEmail({ companyName, location, description, reporterName, imageLink, dashboardLink }) {
    return `<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8"><title>Prijava Opasnosti</title></head><body style="margin:0;padding:40px 0;background:#f0f4f8;font-family:sans-serif;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);"><div style="background:#ef4444;color:#fff;padding:24px;text-align:center;"><h1 style="margin:0;font-size:24px;">🚨 Nova Prijava Opasnosti</h1><p style="margin:8px 0 0;">${companyName}</p></div><div style="padding:32px;"><p style="font-size:16px;color:#333;">Imate novu prijavu s terena iz sistema sigurnosnih opažanja:</p><table style="width:100%;text-align:left;margin-top:20px;border-collapse:collapse;"><tr><th style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">📍 Lokacija:</th><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${location}</td></tr><tr><th style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">⚠️ Opis:</th><td style="padding:8px;border-bottom:1px solid #eee;">${description}</td></tr><tr><th style="padding:8px 0;color:#666;">👤 Prijavio/la:</th><td style="padding:8px;">${reporterName || 'Anonimno'}</td></tr></table><div style="margin-top:32px;text-align:center;"><a href="${dashboardLink}" style="display:inline-block;padding:14px 28px;background:#ef4444;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Otvori prijavu sa slikom</a></div></div><div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;">Generisano via eZNR Sistem Sigurnosnih Opažanja</div></div></body></html>`;
}
function buildHtmlEmail({ toName, questionnaireName, fillLink, deadline, senderName = 'eZNR Admin', companyName = '', isTraining = false }) {
    const itemLabel = isTraining ? 'obuku / prezentaciju' : 'upitnik';
    const itemLabelCap = isTraining ? 'Obuka / Prezentacija' : 'Upitnik';
    const titleIcon = isTraining ? '🎬' : '📝';
    const deadlineStr = deadline ? new Date(deadline).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Nema roka';
    const senderDisplay = companyName ? `${senderName} (${companyName})` : senderName;
    return `<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${isTraining ? 'Obuka' : 'Upitnik'} — ${questionnaireName}</title></head><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="border-radius:16px 16px 0 0;overflow:hidden;padding:0;font-size:0;line-height:0;"><img src="${EMAIL_BASE}/email-header.png" alt="eZNR" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:16px 16px 0 0;" /></td></tr><tr><td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;"><p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Pozvani ste na ispunjavanje</p><h1 style="margin:0 0 24px;font-size:22px;font-weight:800;color:#1e293b;line-height:1.35;">${titleIcon} ${questionnaireName}</h1><p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.75;">Poštovani/a <strong style="color:#1e293b;">${toName}</strong>,<br><br>pozivamo Vas da popunite ${itemLabel} koji Vam je dodijelio <strong style="color:#4f46e5;">${senderDisplay}</strong>. Kliknite na dugme ispod kako biste pristupili ${itemLabel}u.</p><div style="text-align:center;margin:36px 0;"><p style="margin:0 0 16px;font-size:14px;color:#64748b;font-weight:600;">👇 Pritisnite dugme ispod za pristup:</p><a href="${fillLink}" style="display:block;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#6366f1 100%);color:#ffffff;font-size:20px;font-weight:800;text-decoration:none;padding:22px 20px;border-radius:16px;max-width:480px;margin:0 auto;">${isTraining ? '🎬 Započni obuku →' : '📝 Ispuni upitnik →'}</a><p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">Dugme vas vodi direktno na ${itemLabel} — nema prijave</p></div><table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;width:48%;vertical-align:top;"><p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">${itemLabelCap}</p><p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${questionnaireName}</p></td><td style="width:4%;"></td><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;width:48%;vertical-align:top;"><p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">Rok za ispunjavanje</p><p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${deadlineStr}</p></td></tr></table><div style="background:#f0f4f8;border-radius:8px;padding:14px 18px;margin-top:20px;"><p style="margin:0 0 5px;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;">Ili kopirajte link:</p><a href="${fillLink}" style="font-size:12px;color:#4f46e5;word-break:break-all;text-decoration:none;">${fillLink}</a></div></td></tr><tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:22px 40px;text-align:center;"><p style="margin:0 0 6px;font-size:13px;color:#64748b;">Poslao: <strong style="color:#4f46e5;">${senderDisplay}</strong></p><p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">Ovaj email je automatski generiran putem platforme eZNR.<br>Za pitanja kontaktirajte osobu koja Vam je poslala ${itemLabel}.</p></td></tr></table></td></tr></table></body></html>`;
}

function buildReminderEmail({ toName, questionnaireName, fillLink, deadline, senderName = 'eZNR Admin', companyName = '', isTraining = false }) {
    const itemLabel = isTraining ? 'obuku / prezentaciju' : 'upitnik';
    const titleIcon = isTraining ? '🎬' : '📝';
    const deadlineStr = deadline ? new Date(deadline).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Nema roka';
    const senderDisplay = companyName ? `${senderName} (${companyName})` : senderName;
    return `<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Podsjetnik — ${questionnaireName}</title></head><body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;"><tr><td style="border-radius:16px 16px 0 0;overflow:hidden;padding:0;font-size:0;line-height:0;"><img src="${EMAIL_BASE}/email-header.png" alt="eZNR" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:16px 16px 0 0;" /></td></tr><tr><td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:14px 40px;text-align:center;"><p style="margin:0;font-size:14px;font-weight:800;color:#ffffff;text-transform:uppercase;letter-spacing:2px;">⏰ PODSJETNIK — Još niste ispunili ${itemLabel}</p></td></tr><tr><td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;"><h1 style="margin:0 0 24px;font-size:22px;font-weight:800;color:#1e293b;line-height:1.35;">${titleIcon} ${questionnaireName}</h1><p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.75;">Poštovani/a <strong style="color:#1e293b;">${toName}</strong>,<br><br>podsjećamo Vas da još uvijek niste popunili ${itemLabel} koji Vam je dodijelio/la <strong style="color:#4f46e5;">${senderDisplay}</strong>.${deadline ? `<br><br><strong style="color:#d97706;">⚠️ Rok ističe: ${deadlineStr}</strong>` : ''}</p><div style="text-align:center;margin:36px 0;"><p style="margin:0 0 16px;font-size:14px;color:#64748b;font-weight:600;">👇 Pritisnite dugme ispod za pristup:</p><a href="${fillLink}" style="display:block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#f59e0b 100%);color:#ffffff;font-size:20px;font-weight:800;text-decoration:none;padding:22px 20px;border-radius:16px;max-width:480px;margin:0 auto;">${isTraining ? '🎬 Započni obuku →' : '📝 Ispuni upitnik →'}</a><p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">Dugme vas vodi direktno na ${itemLabel} — nema prijave</p></div><div style="background:#f0f4f8;border-radius:8px;padding:14px 18px;margin-top:20px;"><p style="margin:0 0 5px;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;">Ili kopirajte link:</p><a href="${fillLink}" style="font-size:12px;color:#4f46e5;word-break:break-all;text-decoration:none;">${fillLink}</a></div></td></tr><tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:22px 40px;text-align:center;"><p style="margin:0 0 6px;font-size:13px;color:#64748b;">Podsjetnik poslao: <strong style="color:#4f46e5;">${senderDisplay}</strong></p><p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">Ovaj email je automatski generiran putem platforme eZNR.</p></td></tr></table></td></tr></table></body></html>`;
}

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey() {
    const key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not configured');
    return key;
}

/**
 * Call Gemini with model fallback. Never uses responseMimeType — 
 * we parse JSON manually which is more robust across all models.
 */
async function callGemini(apiKey, body) {
    // Always strip responseMimeType — it causes 500s on some models
    if (body.generationConfig) {
        delete body.generationConfig.responseMimeType;
    }

    let lastErr = null;
    for (const model of MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                lastErr = new Error(errData.error?.message || `HTTP ${res.status}`);
                if (model !== MODELS[MODELS.length - 1]) continue;
                throw lastErr;
            }
            const data = await res.json();
            // Skip thought parts, get actual text
            const text = data.candidates?.[0]?.content?.parts?.find(p => !p.thought && p.text)?.text
                ?? data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
            return { text, model };
        } catch (err) {
            lastErr = err;
            if (model !== MODELS[MODELS.length - 1]) continue;
            throw err;
        }
    }
    throw lastErr || new Error('All models failed');
}

/**
 * Robust JSON parser — tries multiple strategies to extract JSON from LLM output.
 */
function tryParseJson(text) {
    if (!text) return null;
    // 1. Direct parse
    try { return JSON.parse(text); } catch {}
    // 2. Strip markdown code blocks
    try { return JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); } catch {}
    // 3. Extract first { ... } block
    try {
        const f = text.indexOf('{'), l = text.lastIndexOf('}');
        if (f >= 0 && l > f) return JSON.parse(text.substring(f, l + 1));
    } catch {}
    // 4. Extract first [ ... ] block
    try {
        const f = text.indexOf('['), l = text.lastIndexOf(']');
        if (f >= 0 && l > f) return JSON.parse(text.substring(f, l + 1));
    } catch {}
    return null;
}

// ─── Function Implementations ─────────────────────────────────────────────────

// Server-side news cache (per Vercel instance)
let newsCache = { data: null, ts: 0 };
const NEWS_TTL = 2 * 60 * 60 * 1000;

const STATIC_NEWS = [
    { naslov: 'Zakon o zaštiti na radu FBiH — važeći propis', opis: 'Zakon o zaštiti na radu FBiH (Sl. novine FBiH br. 22/02) obavezuje sve poslodavce na osiguranje sigurnih radnih uslova, procjenu rizika i zdravstvene preglede.', tip: 'zakon', datum: '01.01.2025.', izvor: 'Sl. novine FBiH br. 22/02', url: 'https://www.sllist.ba' },
    { naslov: 'Rok: Godišnji izvještaj o ZNR — 31. mart', opis: 'Svaki poslodavac u FBiH obavezan je do 31. marta predati godišnji izvještaj o zaštiti na radu za prethodnu godinu.', tip: 'rok', datum: '31.03.2026.', izvor: 'Zakon o ZNR FBiH, čl. 46', url: 'https://www.fbihvlada.gov.ba' },
    { naslov: 'Procjena rizika — obaveza svakog poslodavca', opis: 'Svaki poslodavac mora sačiniti i redovno ažurirati Procjenu rizika za svako radno mjesto. Neposjedovanje procjene rizika rezultira inspekcijskim nalazom.', tip: 'pravilnik', datum: '15.01.2026.', izvor: 'Pravilnik o procjeni rizika FBiH/RS', url: 'https://www.sllist.ba' },
];

async function handleNews({ force }) {
    if (!force && newsCache.data && Date.now() - newsCache.ts < NEWS_TTL) {
        return { ...newsCache.data, cached: true };
    }
    const apiKey = getApiKey();
    const prompt = `Ti si pravni asistent za zaštitu na radu u Bosni i Hercegovini.

Generiraj 6 informativnih stavki o zaštiti na radu u BiH. Bitno:
- Koristi SAMO informacije koje su provjereno tačne
- Napiši konkretne zakone sa brojevima glasnika (npr. "Sl. novine FBiH br. 22/02")
- Za rokove koji su godišnji navedi rok u 2026. godini
- Datum neka bude datum relevantnosti propisa ili 07.03.2026.
- Za "url" stavi pravi link ako postoji (sllist.ba, slglasnikrs.ba), inače ostavi ""

Vrati SAMO JSON niz, bez teksta ispred ili iza, bez Markdown:
[{"naslov":"...","opis":"2-3 rečenice.","tip":"zakon","datum":"07.03.2026.","izvor":"Sl. novine FBiH br. 22/02","url":"https://www.sllist.ba"}]

Tipovi: zakon|pravilnik|inspekcija|edukacija|rok|obavijest|smjernice
Samo JSON.`;

    try {
        const { text, model } = await callGemini(apiKey, {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
        });
        const parsed = tryParseJson(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
            const news = parsed.filter(x => x.naslov && x.opis);
            if (news.length > 0) {
                const payload = { news, source: 'gemini', model, cached: false };
                newsCache = { data: payload, ts: Date.now() };
                return payload;
            }
        }
    } catch (err) {
        console.error('[firebase-proxy/news] Gemini failed:', err.message);
    }
    const payload = { news: STATIC_NEWS, source: 'static', cached: false };
    newsCache = { data: payload, ts: Date.now() };
    return payload;
}

async function handleGenerateOpisProcesa(data) {
    const apiKey = getApiKey();
    const { nazivTvrtke, djelatnost, radnaMjesta, opasnosti } = data;
    const workplacesList = data.workplaces || radnaMjesta || '';
    const hazardList = opasnosti || '';

    const djelatnostStr = djelatnost || 'Nije navedeno';
    const workplacesStr = Array.isArray(workplacesList) ? workplacesList.join(', ') : (workplacesList || 'Nema');
    const firmaStr = nazivTvrtke || 'Nepoznato';

    // Use custom delimiters — no JSON, avoids double-encoding entirely
    const prompt = `Ti si stručnjak za zaštitu na radu u Bosni i Hercegovini.

Napiši dva teksta za akt o procjeni rizika za firmu "${firmaStr}" koja se bavi "${djelatnostStr}".
Radna mjesta: ${workplacesStr || 'nisu navedena'}
${hazardList ? `Potencijalne opasnosti: ${hazardList}` : ''}

Odgovor formatiraj TAČNO ovako — koristi ove headere:

##OPIS_PROCESA##
Napiši 3-4 paragrafa opisa tehničko-tehnološkog procesa. Opisuj konkretne radne procese, mašine, alate, materijale i tok rada u firmi. Pisati profesionalno i formalno.

##ANALIZA_ORGANIZACIJE##
Napiši 3-4 paragrafa analize organizacije rada. Opisuj radno vrijeme, broj radnika, organizacionu strukturu, smjene, rukovođenje i uvjete rada. Pisati profesionalno i formalno.

Piši SAMO tekst, bez JSON-a, bez markdown-a, bez zaglavlja osim navedenih.`;

    let text = '';
    let model = MODELS[0];

    try {
        const result = await callGemini(apiKey, {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 3000 },
        });
        text = result.text;
        model = result.model;
    } catch (err) {
        console.error('[generateOpisProcesa] Gemini failed:', err.message);
        throw new Error('AI servis je trenutno nedostupan. Pokušajte ponovo.');
    }

    // Parse sections using delimiters
    const opisMatch = text.match(/##OPIS_PROCESA##\s*([\s\S]*?)(?=##ANALIZA_ORGANIZACIJE##|$)/i);
    const analizaMatch = text.match(/##ANALIZA_ORGANIZACIJE##\s*([\s\S]*?)$/i);

    const opisProcesa = opisMatch?.[1]?.trim() || '';
    const analizaOrganizacije = analizaMatch?.[1]?.trim() || '';

    if (opisProcesa || analizaOrganizacije) {
        return { success: true, result: { opisProcesa, analizaOrganizacije }, model };
    }

    // Fallback: try JSON parse (in case model still responded in JSON)
    const parsed = tryParseJson(text);
    if (parsed) {
        const op = typeof parsed.opisProcesa === 'string' ? parsed.opisProcesa : JSON.stringify(parsed.opisProcesa);
        const ao = typeof parsed.analizaOrganizacije === 'string' ? parsed.analizaOrganizacije : JSON.stringify(parsed.analizaOrganizacije);
        const finalOp = tryParseJson(op)?.opisProcesa || op;
        const finalAo = tryParseJson(ao)?.analizaOrganizacije || ao;
        return { success: true, result: { opisProcesa: finalOp || '', analizaOrganizacije: finalAo || '' }, model };
    }

    // Last resort: use full raw text
    return { success: true, result: { opisProcesa: text.trim() || `Opis procesa za ${djelatnostStr}.`, analizaOrganizacije: '' }, model };
}

async function handleRiskMeasures(data) {
    const apiKey = getApiKey();
    const { hazardName, hazardCode, workplaceName, opisOpasnosti, vjerovatnoca, posljedica, postojeceMjere, documentData, documentMimeType } = data;

    const systemPrompt = `Ti si stručnjak za zaštitu na radu u BiH. Na osnovu opasnosti predloži mjere.
Vrati SAMO JSON bez markdown:
{"postojeceMjere":"...","predlozeneMjere":"...","vjerovatnocaNakon":2,"posljedlicaNakon":3,"obrazlozenje":"..."}`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPASNOST: ${hazardCode ? `${hazardCode} — ` : ''}${hazardName || 'Nepoznata'}
OPIS: ${opisOpasnosti || 'Nema'}
V: ${vjerovatnoca}/5, P: ${posljedica}/5, R: ${vjerovatnoca * posljedica}/25
${postojeceMjere ? `POSTOJEĆE MJERE: ${postojeceMjere}` : ''}`;

    const parts = [];
    if (documentData && documentMimeType) parts.push({ inlineData: { data: documentData, mimeType: documentMimeType } });
    parts.push({ text: userMsg });

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });
    const parsed = tryParseJson(text);
    if (parsed) return { success: true, measures: parsed, model };
    // Fallback: use raw text
    return { success: true, measures: { postojeceMjere: text, predlozeneMjere: '', vjerovatnocaNakon: Math.max(1, vjerovatnoca - 1), posljedlicaNakon: Math.max(1, posljedica - 1), obrazlozenje: '' }, model };
}

async function handleAnalyzeRiskDocs(data) {
    const apiKey = getApiKey();
    const { documents, companyName } = data;
    if (!documents?.length) throw new Error('Nema dokumenata za analizu');

    const docsText = documents.map((d, i) => `Dokument ${i + 1} (${d.name || 'PDF'}):\n${d.content || d.text || ''}`).join('\n\n---\n\n');

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za ZNR u BiH. Analiziraj dokumente. Vrati SAMO JSON bez markdown: {"nalazi":["..."],"preporuke":["..."],"rizici":["..."],"zakljucak":"..."}' }] },
        contents: [{ role: 'user', parts: [{ text: `Kompanija: ${companyName || 'Nepoznato'}\n\nDokumenti:\n${docsText}\n\nVrati SAMO JSON.` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    });
    const parsed = tryParseJson(text);
    if (!parsed) throw new Error('AI nije vratio validnu analizu');
    return { success: true, analysis: parsed, model };
}

async function handleGenerateRiskQuestionnaire(data) {
    const apiKey = getApiKey();
    const { workplaceName, workplaceDescription, hazards, existingPPE, existingEquipment, vrstaAnkete, jezik } = data;

    const systemPrompt = `Ti si stručnjak za ZNR u BiH. Generišeš SurveyJS upitnike.
Vrati SAMO JSON bez markdown i bez teksta:
{"pages":[{"name":"page1","title":"Naziv","elements":[{"type":"radiogroup","name":"q1","title":"Pitanje?","choices":["Da","Ne"],"isRequired":true}]}]}`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPIS: ${workplaceDescription || 'Nema'}
VRSTA ANKETE: ${vrstaAnkete || 'Procjena rizika'}
JEZIK: ${jezik || 'Bosanski'}
${hazards?.length ? `OPASNOSTI: ${hazards.join(', ')}` : ''}
${existingPPE?.length ? `OZO: ${existingPPE.join(', ')}` : ''}
${existingEquipment?.length ? `OPREMA: ${existingEquipment.join(', ')}` : ''}

Generiši upitnik sa 7 sekcija, 5-8 pitanja po sekciji na ${jezik || 'Bosanskom'}.
Vrati SAMO JSON, bez markdown.`;

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    });
    const parsed = tryParseJson(text);
    if (!parsed?.pages) throw new Error('AI model je vratio neispravan format upitnika');
    return { success: true, surveyJson: parsed, model };
}

async function handleAnalyzeQuestionnaire(data) {
    const apiKey = getApiKey();
    const { workplaceName, surveyJson, responses } = data;

    let allQuestions = [];
    try {
        const sj = typeof surveyJson === 'string' ? JSON.parse(surveyJson || '{}') : (surveyJson || {});
        if (sj.pages) allQuestions = sj.pages.flatMap(p => p.elements || []);
        else if (sj.questions) allQuestions = sj.questions.filter(q => q.type !== 'heading');
    } catch {}

    let responseSummary = '';
    if (Array.isArray(responses) && responses.length > 0) {
        const latest = responses[responses.length - 1];
        const answers = latest?.answers || latest?.data || latest || {};
        responseSummary = allQuestions.map(q => {
            const ans = answers[q.id || q.name];
            return `Q: ${q.title || q.name}\nA: ${ans !== undefined ? (Array.isArray(ans) ? ans.join(', ') : ans) : 'Bez odgovora'}`;
        }).join('\n\n');
    } else {
        responseSummary = `Radno mjesto: ${workplaceName}. Nema odgovora — generiši generičke stavke procjene rizika.`;
    }

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za ZNR u BiH. Analiziraj odgovore i generiši stavke procjene rizika. Vrati SAMO JSON bez markdown:\n{"items":[{"opisOpasnosti":"...","kategorija":"fizička","vjerovatnoca":3,"posljedica":4,"postojeceMjere":"...","predlozeneMjere":"...","vjerovatnocaNakon":2,"posljedlicaNakon":3,"rokProvedbe":"30","obrazlozenje":"..."}],"ukupniKomentar":"..."}' }] },
        contents: [{ role: 'user', parts: [{ text: `RADNO MJESTO: ${workplaceName || 'Nepoznato'}\n\nODGOVORI:\n${responseSummary}\n\nGeneriši 5-8 stavki. Vrati SAMO JSON.` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    });
    const parsed = tryParseJson(text);
    if (!parsed) {
        console.error('[analyzeQuestionnaire] Parse failed. Raw:', text?.substring(0, 200));
        return { success: false, analysis: null, error: 'AI nije mogao analizirati upitnik. Pokušajte ponovo.' };
    }
    return { success: true, analysis: parsed, model };
}

async function handleGenerateSistematizacija(data) {
    const apiKey = getApiKey();
    const { workplaceName, oznaka, strucnaSprema, industry, numberOfWorkers, orgUnit, additionalInfo, radnoVrijemeOd, radnoVrijemeDo } = data;

    const start = parseInt((radnoVrijemeOd || '').replace(':', ''));
    const end = parseInt((radnoVrijemeDo || '').replace(':', ''));
    const nightShift = (!isNaN(start) && !isNaN(end) && (start > end || start < 600 || end >= 2200))
        ? 'OVO JE NOĆNI RAD. Uključi obavezni ljekarski pregled jednom u 2 godine.' : '';

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za HR i ZNR u BiH. Generiši sistematizaciju radnog mjesta. Vrati SAMO JSON bez markdown:\n{"nazivPosla":"...","kategorijaRM":"Izvršno","slozenostPoslova":"Srednje složeni","opisPoslova":"...","odgovornosti":"...","strucnaSprema":"SSS","radnoIskustvo":"...","probniRad":"3 mjeseca","posebniUvjeti":[],"brojIzvrsilaca":1,"uvjetiRada":{"fizicki":[],"kemijski":[],"bioloski":[],"ergonomski":[],"psihosocijalni":[]},"potrebnaOZO":[],"radnaOprema":[],"zdravstveniZahtjevi":[],"certifikati":[],"potrebneObuke":[],"pravniOsnov":"Čl. 118. Zakona o radu FBiH","napomena":""}' }] },
        contents: [{ role: 'user', parts: [{ text: `RADNO MJESTO: ${workplaceName}\nOZNAKA: ${oznaka || ''}\nSTRUČNA SPREMA: ${strucnaSprema || 'Nije navedeno'}\nDJELATNOST: ${industry || 'Nije navedeno'}\nBROJ IZVRŠILACA: ${numberOfWorkers || 1}\nORG. JEDINICA: ${orgUnit || ''}\nRADNO VRIJEME: ${radnoVrijemeOd || ''} do ${radnoVrijemeDo || ''}\n${nightShift}\n${additionalInfo ? `NAPOMENA: ${additionalInfo}` : ''}\n\nVrati SAMO JSON.` }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    });
    const parsed = tryParseJson(text);
    if (!parsed?.opisPoslova) {
        // Fallback: if we got SOMETHING use it, otherwise return nice error
        if (parsed) return { success: true, sistematizacija: { ...parsed, opisPoslova: parsed.opisPoslova || parsed.opis || '' }, model };
        console.error('[generateSistematizacija] Parse failed. Raw:', text?.substring(0, 200));
        return { success: false, sistematizacija: null, error: 'AI nije mogao generirati sistematizaciju. Pokušajte ponovo.' };
    }
    return { success: true, sistematizacija: parsed, model };
}

async function handleParseSistematizacija(data) {
    const apiKey = getApiKey();
    const { documentText, workplaceName } = data;

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za HR i ZNR. Ekstrahi sistematizaciju iz teksta. Vrati SAMO JSON bez markdown:\n{"nazivPosla":"...","opisPoslova":"...","odgovornosti":"...","strucnaSprema":"SSS","radnoIskustvo":"...","posebniUvjeti":[],"uvjetiRada":{"fizicki":[],"kemijski":[],"ergonomski":[],"psihosocijalni":[]},"potrebnaOZO":[],"zdravstveniZahtjevi":[],"certifikati":[]}' }] },
        contents: [{ role: 'user', parts: [{ text: `Radno mjesto: ${workplaceName || 'Nepoznato'}\n\nTekst dokumenta:\n${documentText}\n\nVrati SAMO JSON.` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    });
    const parsed = tryParseJson(text);
    if (!parsed) {
        console.error('[parseSistematizacija] Parse failed. Raw:', text?.substring(0, 200));
        return { success: false, sistematizacija: null, error: 'Nije moguće parsirati dokument. Pokušajte sa tekstualnim formatom.' };
    }
    return { success: true, sistematizacija: parsed, model };
}

async function handleGenerateQuiz(data) {
    const apiKey = getApiKey();
    const { slides } = data;
    if (!slides?.length) throw new Error('Nema slajdova za generisanje kviza');

    // Truncate slide content to avoid hitting token limits
    const slideContent = slides
        .map((s, i) => `Slajd ${i + 1}: ${s.naslov || ''}\n${(s.sadrzaj || '').substring(0, 800)}`)
        .join('\n\n---\n\n')
        .substring(0, 8000);

    const prompt = `Ti si instruktor zaštite na radu. Na osnovu ove prezentacije generiši 10 pitanja za test znanja.

PREZENTACIJA:
${slideContent}

Vrati SAMO JSON niz (bez ikakvog teksta prije ili poslije, bez markdown, bez objasnjenja):
[{"pitanje":"Tekst pitanja?","opcije":["Odgovor A","Odgovor B","Odgovor C","Odgovor D"],"tacno":0,"objasnjenje":"Kratko objasnjenje"},{...}]

tacno = indeks tacnog odgovora (0=prvi, 1=drugi, 2=treci, 3=cetvrti)
Vrati SAMO JSON niz.`;

    const { text, model } = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    });

    const parsed = tryParseJson(text);
    let questions = Array.isArray(parsed) ? parsed
        : parsed?.questions ? parsed.questions
        : parsed?.result ? parsed.result
        : [];

    if (!questions.length) {
        console.error('[generateQuiz] Parse failed. Raw text (first 300):', text?.substring(0, 300));
        return { success: false, questions: [], error: 'AI nije mogao generirati pitanja iz ovog sadržaja. Provjerite da li slajdovi imaju textualnog sadržaja i pokušajte ponovo.', model };
    }
    return { success: true, questions, model };
}

async function handleGenerateFromDocument(data) {
    const apiKey = getApiKey();
    const { documentText, documentBase64, mimeType } = data;

    const parts = [];
    if (documentBase64 && mimeType) parts.push({ inlineData: { data: documentBase64, mimeType } });
    parts.push({ text: `Ekstrahi pitanja za test iz ovog dokumenta. Vrati SAMO JSON bez markdown:\n{"result":[{"pitanje":"...","opcije":["A","B","C","D"],"tacno":0,"objasnjenje":"..."}]}\n\n${documentText || ''}` });

    const { text, model } = await callGemini(apiKey, {
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    });
    const parsed = tryParseJson(text);
    const result = parsed?.result || (Array.isArray(parsed) ? parsed : null);
    if (!result) {
        console.error('[generateFromDocument] Parse failed. Raw:', text?.substring(0, 200));
        return { success: false, result: [], error: 'AI nije mogao ekstrahirati pitanja iz dokumenta.' };
    }
    return { success: true, result, model };
}

async function handleParsePresentation(data) {
    const apiKey = getApiKey();
    const { base64Data, filename } = data;
    if (!base64Data) throw new Error('Nema podataka o prezentaciji');

    const mimeType = filename?.endsWith('.pptx')
        ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/pdf';

    const { text, model } = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: 'Ekstrahi sve slajdove u JSON niz. Vrati SAMO JSON bez markdown:\n[{"naslov":"...","sadrzaj":"..."}]' }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
    });
    const slides = tryParseJson(text);
    if (!Array.isArray(slides)) throw new Error('Nije moguće parsirati prezentaciju');
    return { slides, count: slides.length, source: filename || 'document', model };
}

// ─── sendEmail handler ───────────────────────────────────────────────────────
async function handleSendEmail(data) {
    const { toEmail, toName, questionnaireName, fillLink, deadline, senderName, companyId, companyName, isTraining, isReminder, isHazard, location, description, reporterName, imageLink, dashboardLink } = data;
    if (!toEmail || (!fillLink && !isHazard)) throw new Error('Missing required fields: toEmail or fillLink');

    let finalCompanyName = companyName;
    if (companyId && (!companyName || companyName === 'Kompanija')) {
        try {
            const db = getAdminDb();
            const compDoc = await db.collection('companies').doc(String(companyId)).get();
            if (compDoc.exists) finalCompanyName = compDoc.data().naziv || finalCompanyName;
        } catch(e) {}
    }

    const resend = getResend();
    const FROM = process.env.RESEND_FROM_EMAIL || 'noreply@mail.zastitanaradu.ba';
    const senderDisplay = finalCompanyName ? `${senderName || 'eZNR'} (${finalCompanyName}) via eZNR` : `${senderName || 'eZNR'} via eZNR`;
    
    let html;
    let subjectPrefix;
    if (isHazard) {
        html = buildHazardEmail({ companyName: finalCompanyName, location, description, reporterName, imageLink, dashboardLink });
        subjectPrefix = '🚨 Alarm';
    } else if (isReminder) {
        html = buildReminderEmail({ toName: toName || toEmail, questionnaireName, fillLink, deadline, senderName, companyName: finalCompanyName, isTraining });
        subjectPrefix = '⏰ Podsjetnik';
    } else {
        html = buildHtmlEmail({ toName: toName || toEmail, questionnaireName, fillLink, deadline, senderName, companyName: finalCompanyName, isTraining });
        subjectPrefix = isTraining ? '🎬 Obuka' : '📝 Upitnik';
    }

    // Support multiple comma-separated emails
    const toArray = toEmail.split(',').map(e => e.trim()).filter(Boolean);

    const { error } = await resend.emails.send({
        from: `${senderDisplay} <${FROM}>`,
        to: toArray,
        subject: isHazard ? `🚨 Prijava Opasnosti: ${location || finalCompanyName}` : `${subjectPrefix}: ${questionnaireName}`,
        html,
    });
    if (error) throw new Error(error.message || 'Resend API error');
    return { success: true };
}

// ─── pdfParse handler (Gemini vision — replaces MuPDF which can't run on Vercel) ─
async function handlePdfParse(data) {
    const { base64Data, filename = 'document.pdf' } = data;
    if (!base64Data) throw new Error('No base64Data provided');
    const apiKey = getApiKey();
    try {
        const { text } = await callGemini(apiKey, {
            contents: [{ role: 'user', parts: [
                { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
                { text: 'Extract all text from this PDF document page by page. Return ONLY valid JSON without markdown:\n{"pages":[{"pageNum":1,"text":"..."}],"numPages":1}' },
            ]}],
            generationConfig: { temperature: 0, maxOutputTokens: 16384 },
        });
        const parsed = tryParseJson(text);
        if (parsed?.pages && Array.isArray(parsed.pages)) return parsed;
        // Fallback: return raw text as single page
        return { pages: [{ pageNum: 1, text: text || '' }], numPages: 1 };
    } catch (err) {
        console.error('[pdfParse] Gemini error:', err.message);
        throw new Error('PDF parsing failed: ' + err.message);
    }
}

// ─── PDF → DOCX via Gemini Vision ────────────────────────────────────────────
async function handlePdfToWord(requestData) {
    const { base64Data, filename = 'document.pdf' } = requestData || {};
    if (!base64Data) throw new Error('No base64Data provided in the request');

    const apiKey = getApiKey();

    // 1. Ask Gemini to extract the full structure of the PDF
    const prompt = `You are a precise document extraction engine.
Analyze this PDF and extract its full content as structured JSON.

Return ONLY valid JSON — no markdown, no explanation:
{
  "pages": [
    {
      "pageNum": 1,
      "blocks": [
        {
          "type": "paragraph",
          "text": "Full paragraph text here",
          "bold": false,
          "italic": false,
          "fontSize": 11,
          "alignment": "left"
        },
        {
          "type": "heading",
          "text": "Heading text",
          "bold": true,
          "italic": false,
          "fontSize": 14,
          "alignment": "center"
        },
        {
          "type": "checkbox",
          "label": "Checkbox label text",
          "checked": true
        },
        {
          "type": "signature_line",
          "label": "(Potpis / Signature)"
        },
        {
          "type": "table",
          "rows": [
            ["Cell 1", "Cell 2", "Cell 3"],
            ["Cell 4", "Cell 5", "Cell 6"]
          ]
        }
      ]
    }
  ]
}

Rules:
- Preserve ALL text exactly as it appears
- Detect checkboxes (☐ ☑ □ ✓ or form fields) and set checked: true/false
- Detect signature lines (lines with "Potpis", "Signature", underscores, or blank lines under names)
- Detect tables and preserve their structure in rows/columns
- Detect headings (larger/bolder text at section starts)
- Use alignment: left | center | right | justify
- One page break between pages — preserve page order
- Return ONLY raw JSON.`;

    const { text } = await callGemini(apiKey, {
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
                { text: prompt },
            ]
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536 },
    });

    const parsed = tryParseJson(text);
    if (!parsed?.pages) throw new Error('Gemini did not return valid page structure');

    // 2. Build DOCX from Gemini output
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, Packer,
            AlignmentType, BorderStyle, WidthType, HeadingLevel } = await import('docx');

    const ALIGN = {
        left: AlignmentType.LEFT,
        center: AlignmentType.CENTER,
        right: AlignmentType.RIGHT,
        justify: AlignmentType.JUSTIFIED,
    };

    const docChildren = [];

    for (let pi = 0; pi < parsed.pages.length; pi++) {
        const page = parsed.pages[pi];
        if (pi > 0) {
            // page break between pages
            docChildren.push(new Paragraph({ pageBreakBefore: true, children: [new TextRun('')] }));
        }

        for (const block of (page.blocks || [])) {
            if (block.type === 'table') {
                // Build a proper Word table
                const rows = (block.rows || []).map(rowCells =>
                    new TableRow({
                        children: rowCells.map(cellText =>
                            new TableCell({
                                children: [new Paragraph({
                                    children: [new TextRun({ text: String(cellText ?? ''), size: 20 })]
                                })],
                                borders: {
                                    top:    { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                                    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                                    left:   { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                                    right:  { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                                },
                            })
                        )
                    })
                );
                if (rows.length > 0) {
                    docChildren.push(new Table({
                        rows,
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }));
                }

            } else if (block.type === 'checkbox') {
                const icon = block.checked ? '☑' : '☐';
                docChildren.push(new Paragraph({
                    children: [
                        new TextRun({ text: icon + '  ', font: 'Segoe UI Symbol', size: 22 }),
                        new TextRun({ text: block.label || '', size: 22 }),
                    ],
                    spacing: { after: 60 },
                }));

            } else if (block.type === 'signature_line') {
                // Signature: label above a horizontal line
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: block.label || '', size: 20, italics: true })],
                    spacing: { before: 400, after: 0 },
                }));
                docChildren.push(new Paragraph({
                    children: [new TextRun({ text: '' })],
                    border: {
                        top: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 },
                    },
                    spacing: { after: 200 },
                }));

            } else {
                // paragraph or heading
                const isHeading = block.type === 'heading';
                const fontSize = block.fontSize ? Math.round(block.fontSize * 2) : (isHeading ? 28 : 22);
                docChildren.push(new Paragraph({
                    children: [new TextRun({
                        text: block.text || '',
                        bold: block.bold || isHeading,
                        italics: block.italic || false,
                        size: fontSize,
                    })],
                    alignment: ALIGN[block.alignment] || AlignmentType.LEFT,
                    heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
                    spacing: { after: 120 },
                }));
            }
        }
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: docChildren,
        }]
    });

    const docxBase64 = await Packer.toBase64String(doc);
    return { success: true, base64Data: docxBase64, filename: filename.replace(/\.pdf$/i, '.docx') };
}

// ─── notifSettings handlers (real Firestore via Admin SDK) ───────────────────
async function handleSaveNotifSettings(data) {
    const { companyId, settings } = data;
    if (!companyId || !settings) return { success: false, error: 'Missing companyId or settings' };
    try {
        const db = getAdminDb();
        await db.collection('notif_settings').doc(companyId).set(settings, { merge: true });
        return { success: true };
    } catch (err) {
        console.error('[saveNotifSettings] Error:', err.message);
        return { success: false, error: err.message };
    }
}

async function handleGetNotifSettings(data) {
    const { companyId } = data;
    if (!companyId) return { success: true, settings: null };
    try {
        const db = getAdminDb();
        const docSnap = await db.collection('notif_settings').doc(companyId).get();
        return { success: true, settings: docSnap.exists ? docSnap.data() : null };
    } catch (err) {
        console.error('[getNotifSettings] Error:', err.message);
        return { success: true, settings: null };
    }
}

// ─── saveHazard handler (real Firestore via Admin SDK) ─────────────────────

async function handleGetOrgUnits(data) {
    const { companyId } = data;
    if (!companyId) return { success: false, error: 'Missing companyId' };
    try {
        const db = getAdminDb();
        const snap = await db.collection('companies').doc(String(companyId)).collection('orgUnits').get();
        const orgUnits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return { success: true, orgUnits };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function handleSaveHazard(data) {
    const { companyId, payload, base64Image, mimeType } = data;
    if (!companyId || !payload) return { success: false, error: 'Missing companyId or payload' };
    try {
        if (base64Image) {
            const bucket = getAdminStorage();
            const timestamp = Date.now();
            const ext = (mimeType || '').includes('jpeg') ? 'jpg' : (mimeType || '').includes('png') ? 'png' : 'webp';
            const fileName = `companies/${companyId}/safety_observations/${timestamp}_hazard.${ext}`;
            const fileObj = bucket.file(fileName);
            // remove "data:image/webp;base64," if present
            const base64Data = base64Image.split(',')[1] || base64Image;
            
            const uuid = require('crypto').randomUUID();
            await fileObj.save(Buffer.from(base64Data, 'base64'), {
                metadata: { 
                    contentType: mimeType || 'image/webp',
                    metadata: { firebaseStorageDownloadTokens: uuid }
                }
            });
            // Construct public URL with token
            const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media&token=${uuid}`;
            payload.slika = { url: imageUrl, storagePath: fileName, type: mimeType || 'image/webp', size: base64Data.length };
        }

        const db = getAdminDb();
        const docRef = await db.collection('companies').doc(String(companyId)).collection('safety_observations').add(payload);
        return { success: true, id: docRef.id, payload };
    } catch (err) {
        console.error('[saveHazard] Error:', err.message);
        return { success: false, error: err.message };
    }
}

// ─── Main Router ──────────────────────────────────────────────────────────────

const HANDLERS = {
    news: handleNews,
    generateOpisProcesa: handleGenerateOpisProcesa,
    riskMeasures: handleRiskMeasures,
    analyzeRiskDocs: handleAnalyzeRiskDocs,
    generateRiskQuestionnaire: handleGenerateRiskQuestionnaire,
    analyzeQuestionnaire: handleAnalyzeQuestionnaire,
    generateSistematizacija: handleGenerateSistematizacija,
    parseSistematizacija: handleParseSistematizacija,
    generateQuiz: handleGenerateQuiz,
    generateFromDocument: handleGenerateFromDocument,
    parsePresentation: handleParsePresentation,
    sendEmail: handleSendEmail,
    pdfParse: handlePdfParse,
    pdfToWord: handlePdfToWord,
    saveNotifSettings: handleSaveNotifSettings,
    getNotifSettings: handleGetNotifSettings,
    saveHazard: handleSaveHazard,
    getOrgUnits: handleGetOrgUnits,
};

export async function POST(req) {
    try {
        // Rate limiting
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
        const { allowed, waitSec } = checkRate(ip);
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'rate_limit', retryAfter: waitSec }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', 'Retry-After': String(waitSec) },
            });
        }

        const body = await req.json();
        const { functionName, data } = body;

        if (!functionName) {
            return new Response(JSON.stringify({ error: 'functionName is required' }), { status: 400 });
        }

        const handler = HANDLERS[functionName];
        if (!handler) {
            console.error(`[firebase-proxy] Unknown function: ${functionName}`);
            return new Response(JSON.stringify({ error: `Unknown function: ${functionName}` }), { status: 400 });
        }

        const result = await handler(data || {});
        return new Response(JSON.stringify({ result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[firebase-proxy] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
