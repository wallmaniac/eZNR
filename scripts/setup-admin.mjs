// ============================================================================
// SETUP SCRIPT — One-time initial setup for eZNR backend
// Creates super admin user in Firebase Auth + Firestore profile + DSC company
//
// Usage: node scripts/setup-admin.mjs
// Requires: .env.local with Firebase Admin credentials
// ============================================================================

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    // Remove surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
    }
    env[key] = val;
});

// ── Initialize Firebase Admin ────────────────────────────────────────────────
const app = initializeApp({
    credential: cert({
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const authAdmin = getAuth(app);
const db = getFirestore(app);

// ── Configuration ────────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = 'zzidar1111@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Wallman1111!';
const SUPER_ADMIN_FIRST_NAME = 'Admin';
const SUPER_ADMIN_LAST_NAME = 'eZNR';

const FIRST_COMPANY = {
    naziv: 'DSC',
    skraceniNaziv: 'DSC',
    adresa: '',
    mjesto: '',
    telefon: '',
    email: '',
    aktivan: true,
    storageTier: 'standard', // 1 GB
    storageUsedBytes: 0,
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('🚀 eZNR Backend Setup');
    console.log('━'.repeat(50));

    // Step 1: Create or get Firebase Auth user
    let uid;
    try {
        const existingUser = await authAdmin.getUserByEmail(SUPER_ADMIN_EMAIL);
        uid = existingUser.uid;
        console.log(`✅ Firebase Auth user already exists: ${uid}`);
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            const newUser = await authAdmin.createUser({
                email: SUPER_ADMIN_EMAIL,
                password: SUPER_ADMIN_PASSWORD,
                displayName: `${SUPER_ADMIN_FIRST_NAME} ${SUPER_ADMIN_LAST_NAME}`,
                emailVerified: true,
            });
            uid = newUser.uid;
            console.log(`✅ Created Firebase Auth user: ${uid}`);
        } else {
            throw err;
        }
    }

    // Step 2: Create DSC company document
    let companyId;
    const companiesSnap = await db.collection('companies')
        .where('naziv', '==', FIRST_COMPANY.naziv)
        .get();

    if (!companiesSnap.empty) {
        companyId = companiesSnap.docs[0].id;
        console.log(`✅ Company "${FIRST_COMPANY.naziv}" already exists: ${companyId}`);
    } else {
        const companyRef = await db.collection('companies').add({
            ...FIRST_COMPANY,
            createdAt: new Date().toISOString(),
            createdBy: uid,
        });
        companyId = companyRef.id;
        console.log(`✅ Created company "${FIRST_COMPANY.naziv}": ${companyId}`);
    }

    // Step 3: Create storage meta document for the company
    const storageMeta = db.doc(`companies/${companyId}/meta/storage`);
    const storageSnap = await storageMeta.get();
    if (!storageSnap.exists) {
        await storageMeta.set({
            bytesUsed: 0,
            fileCount: 0,
            lastUpdated: new Date().toISOString(),
        });
        console.log(`✅ Created storage meta for ${FIRST_COMPANY.naziv}`);
    }

    // Step 4: Create user profile in Firestore (keyed by auth UID)
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
        // Update existing profile to ensure superadmin role
        await userRef.update({
            role: 'superadmin',
            companyIds: [...new Set([...(userSnap.data().companyIds || []), companyId])],
            updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Updated user profile to superadmin`);
    } else {
        await userRef.set({
            email: SUPER_ADMIN_EMAIL,
            firstName: SUPER_ADMIN_FIRST_NAME,
            lastName: SUPER_ADMIN_LAST_NAME,
            role: 'superadmin',
            companyIds: [companyId],
            aktivan: true,
            createdAt: new Date().toISOString(),
        });
        console.log(`✅ Created user profile (superadmin)`);
    }

    // Step 5: Create notification settings document
    const notifRef = db.doc(`notif_settings/${companyId}`);
    const notifSnap = await notifRef.get();
    if (!notifSnap.exists) {
        await notifRef.set({
            emailNotifEnabled: true,
            emailNotifDays: 30,
            emailNotifLang: 'bs',
            emailNotifToCompany: true,
            emailNotifToOfficer: true,
            emailNotifCerts: true,
            emailNotifEquip: true,
            emailNotifDocs: true,
            emailNotifFleet: true,
            emailNotifMedical: true,
        });
        console.log(`✅ Created notification settings for ${FIRST_COMPANY.naziv}`);
    }

    console.log('');
    console.log('━'.repeat(50));
    console.log('🎉 Setup complete!');
    console.log('');
    console.log('  Super Admin UID:', uid);
    console.log('  Email:', SUPER_ADMIN_EMAIL);
    console.log('  Company:', FIRST_COMPANY.naziv, `(${companyId})`);
    console.log('  Role: superadmin');
    console.log('');
    console.log('  You can now log in at https://eznr.vercel.app');
    console.log('━'.repeat(50));

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Setup failed:', err);
    process.exit(1);
});
