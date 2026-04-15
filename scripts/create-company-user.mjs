// Creates a Company user (officer role) for testing
// Usage: node scripts/create-company-user.mjs

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const env = {};
readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim(); if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('='); if (eq === -1) return;
    const key = t.substring(0, eq).trim();
    let val = t.substring(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[key] = val;
});

const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert({
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const authAdmin = getAuth(app);
const db = getFirestore(app);

// ── New company user config ───────────────────────────────────────────────────
const EMAIL = 'officer.test@eznr.app';
const PASSWORD = 'Officer123!';
const FIRST_NAME = 'Test';
const LAST_NAME = 'Officer';
const ROLE = 'officer'; // company user

async function main() {
    console.log('🚀 Creating company user (officer)...');
    console.log('━'.repeat(50));

    // 1. Get first available company to assign
    const companiesSnap = await db.collection('companies').limit(1).get();
    if (companiesSnap.empty) { console.error('❌ No companies found — create one first'); process.exit(1); }
    const company = { id: companiesSnap.docs[0].id, ...companiesSnap.docs[0].data() };
    console.log(`📦 Will assign to company: "${company.naziv}" (${company.id})`);

    // 2. Create or get Firebase Auth user
    let uid;
    try {
        const existing = await authAdmin.getUserByEmail(EMAIL);
        uid = existing.uid;
        console.log(`✅ Auth user already exists: ${uid}`);
    } catch (err) {
        if (err.code === 'auth/user-not-found') {
            const u = await authAdmin.createUser({ email: EMAIL, password: PASSWORD, displayName: `${FIRST_NAME} ${LAST_NAME}`, emailVerified: true });
            uid = u.uid;
            console.log(`✅ Created Firebase Auth user: ${uid}`);
        } else throw err;
    }

    // 3. Firestore user profile
    const userRef = db.doc(`users/${uid}`);
    const snap = await userRef.get();
    if (snap.exists) {
        await userRef.update({ role: ROLE, companyIds: [company.id], updatedAt: new Date().toISOString() });
        console.log(`✅ Updated existing profile`);
    } else {
        await userRef.set({ email: EMAIL, firstName: FIRST_NAME, lastName: LAST_NAME, role: ROLE, companyIds: [company.id], aktivan: true, createdAt: new Date().toISOString() });
        console.log(`✅ Created Firestore user profile`);
    }

    // 4. Custom claims
    await authAdmin.setCustomUserClaims(uid, { role: ROLE, companyIds: [company.id] });
    console.log(`✅ Custom claims set (role: ${ROLE})`);

    console.log('');
    console.log('━'.repeat(50));
    console.log('🎉 Done!');
    console.log(`  Email:    ${EMAIL}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log(`  UID:      ${uid}`);
    console.log(`  Role:     ${ROLE}`);
    console.log(`  Company:  ${company.naziv} (${company.id})`);
    console.log('━'.repeat(50));
    process.exit(0);
}

main().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
