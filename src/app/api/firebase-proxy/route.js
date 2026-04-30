/**
 * /api/firebase-proxy/route.js
 *
 * Proxy for specific Firestore Admin operations that bypass client-side limitations
 * (e.g. saving public hazard observations without Auth, reading notif settings).
 *
 * NOTE: ALL AI / Gemini connections have been removed from Vercel as requested.
 * AI is fully executed on Google Cloud Run.
 *
 * POST /api/firebase-proxy
 * Body: { functionName: string, data: object }
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export const maxDuration = 60; // Standard duration

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
            const base64Data = base64Image.split(',')[1] || base64Image;
            
            const uuid = require('crypto').randomUUID();
            await fileObj.save(Buffer.from(base64Data, 'base64'), {
                metadata: { 
                    contentType: mimeType || 'image/webp',
                    metadata: { firebaseStorageDownloadTokens: uuid }
                }
            });
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
