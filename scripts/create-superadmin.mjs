// ============================================================================
// CREATE SUPER ADMIN — Add a new superadmin user to eZNR
// Usage: node scripts/create-superadmin.mjs
// ============================================================================

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
    }
    env[key] = val;
});

const app = initializeApp({
    credential: cert({
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const authAdmin = getAuth(app);
const db = getFirestore(app);

// ── New admin config ──────────────────────────────────────────────────────────
const EMAIL = 'nadjman@gmail.com';
const PASSWORD = '775511Hh!';
const FIRST_NAME = 'Nad';
const LAST_NAME = 'Jman';

async function main() {
    console.log('🚀 Creating new Super Admin...');
    console.log('━'.repeat(50));

    // 1. Create Firebase Auth user
    let uid;
    try {
        const existing = await authAdmin.getUserByEmail(EMAIL);
        uid = existing.uid;
        console.log(`✅ Auth user already exists: ${uid}`);
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            const newUser = await authAdmin.createUser({
                email: EMAIL,
                password: PASSWORD,
                displayName: `${FIRST_NAME} ${LAST_NAME}`,
                emailVerified: true,
            });
            uid = newUser.uid;
            console.log(`✅ Created Firebase Auth user: ${uid}`);
        } else {
            throw err;
        }
    }

    // 2. Get all existing company IDs (superadmin gets access to all)
    const companiesSnap = await db.collection('companies').get();
    const allCompanyIds = companiesSnap.docs.map(d => d.id);
    console.log(`📦 Found ${allCompanyIds.length} companies — granting access to all`);

    // 3. Create / update Firestore user profile
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
        await userRef.update({
            role: 'superadmin',
            companyIds: allCompanyIds,
            updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Updated existing profile to superadmin`);
    } else {
        await userRef.set({
            email: EMAIL,
            firstName: FIRST_NAME,
            lastName: LAST_NAME,
            role: 'superadmin',
            companyIds: allCompanyIds,
            aktivan: true,
            createdAt: new Date().toISOString(),
        });
        console.log(`✅ Created Firestore user profile`);
    }

    // 4. Set custom claims
    await authAdmin.setCustomUserClaims(uid, {
        role: 'superadmin',
        companyIds: allCompanyIds,
    });
    console.log(`✅ Custom claims set (role: superadmin)`);

    console.log('');
    console.log('━'.repeat(50));
    console.log('🎉 Done!');
    console.log(`  Email: ${EMAIL}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log(`  UID: ${uid}`);
    console.log(`  Role: superadmin`);
    console.log('━'.repeat(50));

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
});
