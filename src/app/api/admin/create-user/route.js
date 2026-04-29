import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminAuth() {
    if (!getApps().length) {
        initializeApp({
            credential: cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
        });
    }
    return getAuth();
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { email, password, displayName } = body;

        if (!email || !password) {
            return NextResponse.json({ error: 'Email i lozinka su obavezni.' }, { status: 400 });
        }

        const auth = getAdminAuth();

        // Check if user already exists
        try {
            const existingUser = await auth.getUserByEmail(email);
            if (existingUser) {
                return NextResponse.json({ error: 'Korisnik sa ovom email adresom već postoji.' }, { status: 400 });
            }
        } catch (err) {
            // Error means user does not exist, which is what we want
            if (err.code !== 'auth/user-not-found') {
                throw err;
            }
        }

        const userRecord = await auth.createUser({
            email,
            password,
            displayName,
        });

        return NextResponse.json({ uid: userRecord.uid });
    } catch (error) {
        console.error('[API] Error creating user:', error);
        return NextResponse.json({ error: error.message || 'Greška prilikom kreiranja korisnika.' }, { status: 500 });
    }
}
