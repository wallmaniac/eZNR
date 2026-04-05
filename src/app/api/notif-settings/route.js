// ============================================================================
// /api/notif-settings — Read & write notification settings to Firestore
//
// The client app uses its own auth (localStorage), not Firebase Auth.
// This means client-side Firestore writes are blocked by security rules.
// This route uses the Admin SDK (bypasses rules) to read/write notif_settings.
//
// GET  /api/notif-settings?companyId=xxx  → returns saved settings
// POST /api/notif-settings                → body: { companyId, settings }
// ============================================================================

import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

// GET — return the current settings for a company
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
        return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    try {
        const db = getAdminDb();
        const snap = await db.collection('notif_settings').doc(companyId).get();
        return NextResponse.json({ ok: true, settings: snap.exists ? snap.data() : null });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST — save settings for a company
export async function POST(request) {
    try {
        const { companyId, settings } = await request.json();
        if (!companyId || !settings) {
            return NextResponse.json({ error: 'companyId and settings are required' }, { status: 400 });
        }
        const db = getAdminDb();
        await db.collection('notif_settings').doc(companyId).set(settings, { merge: true });
        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
