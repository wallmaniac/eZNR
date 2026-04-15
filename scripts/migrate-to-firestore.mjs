// ============================================================================
// MIGRATION SCRIPT — Push localStorage data to Firestore subcollections
// One-time migration: reads all localStorage collections and writes them
// to Firestore under /companies/{companyId}/{collection}/{docId}
//
// Usage: node scripts/migrate-to-firestore.mjs [companyId]
// If no companyId provided, uses the DSC company created by setup-admin.mjs
// ============================================================================

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
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

const db = getFirestore(app);
const BATCH_SIZE = 400;

// ── Collection definitions ───────────────────────────────────────────────────

// Company-scoped: stored under /companies/{companyId}/{collection}
const COMPANY_SCOPED = [
    'orgUnits', 'workplaces', 'workers', 'equipment', 'injuries', 'diseases',
    'certificates', 'ppeAssignments', 'calendarEvents', 'employerDocs',
    'referralsRa1', 'formsOir1', 'formsRo1', 'formsRo2', 'referralsNr1',
    'digitalArchive', 'requests', 'riskAssessments', 'riskItems', 'isznrDocuments', 'isznrParties',
    'authorizedCompanies', 'examiners', 'personTypes', 'hazards', 'questionnaires',
    'trainings', 'annualReports', 'medicalExams', 'sistematizacije', 'serviceLog',
    'vehicles', 'vehicleAssignments', 'travelOrders', 'fireExtinguishers', 'hydrants',
    'evacuationPlans', 'evacuationDrills', 'zapisnici',
];

// Global: stored under /global/{collection}
const GLOBAL_COLLECTIONS = [
    'countries', 'counties', 'places', 'doctors',
    'examTypes', 'certTypes', 'equipmentTypes', 'ppeTypes', 'fileTypes',
    'isznrDocTypes',
];

// ── Load localStorage export ─────────────────────────────────────────────────
// We need to export localStorage from the browser first, then feed it here.
// This script expects a JSON file with the localStorage dump.
const dumpPath = resolve(__dirname, 'localStorage-dump.json');

async function exportBrowserInstructions() {
    console.log('');
    console.log('━'.repeat(60));
    console.log('📋 STEP 1: Export localStorage from your browser');
    console.log('━'.repeat(60));
    console.log('');
    console.log('  Open the app in your browser, open DevTools (F12),');
    console.log('  go to Console, and paste this:');
    console.log('');
    console.log('  ─────────────────────────────────────────────');
    console.log(`  const dump = {};`);
    console.log(`  for (let i = 0; i < localStorage.length; i++) {`);
    console.log(`    const key = localStorage.key(i);`);
    console.log(`    if (key.startsWith('eznr_')) {`);
    console.log(`      try { dump[key.replace('eznr_', '')] = JSON.parse(localStorage.getItem(key)); }`);
    console.log(`      catch { dump[key.replace('eznr_', '')] = localStorage.getItem(key); }`);
    console.log(`    }`);
    console.log(`  }`);
    console.log(`  const blob = new Blob([JSON.stringify(dump, null, 2)], {type: 'application/json'});`);
    console.log(`  const url = URL.createObjectURL(blob);`);
    console.log(`  const a = document.createElement('a');`);
    console.log(`  a.href = url; a.download = 'localStorage-dump.json'; a.click();`);
    console.log('  ─────────────────────────────────────────────');
    console.log('');
    console.log(`  Save the downloaded file to:`);
    console.log(`  ${dumpPath}`);
    console.log('');
    console.log('  Then re-run this script.');
    console.log('━'.repeat(60));
}

async function migrate(companyId) {
    if (!existsSync(dumpPath)) {
        await exportBrowserInstructions();
        process.exit(0);
    }

    console.log('🚀 eZNR Data Migration');
    console.log('━'.repeat(60));
    console.log(`  Target company: ${companyId}`);
    console.log('');

    const rawDump = JSON.parse(readFileSync(dumpPath, 'utf8'));
    const stats = { company: 0, global: 0, skipped: 0, errors: 0 };

    // ── Migrate company-scoped collections ───────────────────────────────────
    for (const colName of COMPANY_SCOPED) {
        const items = rawDump[colName];
        if (!items || !Array.isArray(items) || items.length === 0) continue;

        console.log(`  📦 ${colName}: ${items.length} items → companies/${companyId}/${colName}`);
        const basePath = `companies/${companyId}/${colName}`;

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = items.slice(i, i + BATCH_SIZE);

            for (const item of chunk) {
                if (!item.id) continue;

                // Clean the item: remove undefined values, handle large base64
                let clean = JSON.parse(JSON.stringify(item));
                const { id, ...dataWithoutId } = clean;

                // Check size — Firestore 1MB limit
                const size = Buffer.byteLength(JSON.stringify(dataWithoutId), 'utf8');
                if (size > 900000) {
                    // Strip large binary fields to avoid hitting the limit
                    delete dataWithoutId.docData;
                    delete dataWithoutId.slika;
                    delete dataWithoutId.fileData;
                    delete dataWithoutId.docBase64;
                    delete dataWithoutId.attachedFileData;
                    delete dataWithoutId.potpisanScan;
                    console.log(`    ⚠️  Stripped binary fields from ${colName}/${id} (${(size/1024).toFixed(0)}KB)`);
                }

                const ref = db.doc(`${basePath}/${id}`);
                batch.set(ref, dataWithoutId, { merge: true });
            }

            await batch.commit();
            stats.company += chunk.length;
        }
    }

    // ── Migrate global collections ───────────────────────────────────────────
    // Global/reference data goes to root-level collections (not nested under 'global/')
    // This keeps Firestore path segments even: {collection}/{docId}
    for (const colName of GLOBAL_COLLECTIONS) {
        const items = rawDump[colName];
        if (!items || !Array.isArray(items) || items.length === 0) continue;

        console.log(`  🌍 ${colName}: ${items.length} items → ${colName}`);

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = items.slice(i, i + BATCH_SIZE);

            for (const item of chunk) {
                if (!item.id) continue;
                const { id, ...dataWithoutId } = JSON.parse(JSON.stringify(item));
                const ref = db.doc(`${colName}/${id}`);
                batch.set(ref, dataWithoutId, { merge: true });
            }

            await batch.commit();
            stats.global += chunk.length;
        }
    }

    // ── Migrate activity log ─────────────────────────────────────────────────
    const activityLog = rawDump['activity_log'];
    if (activityLog && Array.isArray(activityLog) && activityLog.length > 0) {
        console.log(`  📝 activity_log: ${activityLog.length} entries → companies/${companyId}/activityLog`);
        for (let i = 0; i < activityLog.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = activityLog.slice(i, i + BATCH_SIZE);
            for (const entry of chunk) {
                const id = entry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const { id: _id, ...data } = entry;
                const ref = db.doc(`companies/${companyId}/activityLog/${id}`);
                batch.set(ref, data, { merge: true });
            }
            await batch.commit();
        }
    }

    console.log('');
    console.log('━'.repeat(60));
    console.log('🎉 Migration complete!');
    console.log(`  Company-scoped: ${stats.company} documents`);
    console.log(`  Global: ${stats.global} documents`);
    console.log('━'.repeat(60));

    process.exit(0);
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const companyId = process.argv[2] || 'GS2sRgLLolWjJBZCdFp6'; // Default: DSC
migrate(companyId).catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
