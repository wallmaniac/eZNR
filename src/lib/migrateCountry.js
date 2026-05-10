/**
 * ═══════════════════════════════════════════════════════════════════
 *  migrateCountry.js — Client-Side Firestore Migration
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Sets the `country` field on all company documents that are missing it.
 *  This runs client-side using the authenticated user's Firebase session.
 *
 *  Usage (browser console):
 *    import { runCountryMigration } from '@/lib/migrateCountry';
 *    await runCountryMigration();          // Dry run
 *    await runCountryMigration(true);      // Execute writes
 *    await runCountryMigration(true, 'HR'); // Set HR on missing docs
 *
 *  Or call from the Settings page's admin panel.
 */

import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

/**
 * Scan all company documents and set `country` where missing.
 * @param {boolean} execute - If true, write changes. If false, dry-run only.
 * @param {string} defaultCountry - Country code to set ('BA' or 'HR'). Default 'BA'.
 * @returns {object} - Migration report
 */
export async function runCountryMigration(execute = false, defaultCountry = 'BA') {
    if (!['BA', 'HR'].includes(defaultCountry)) {
        throw new Error(`Invalid country "${defaultCountry}". Must be BA or HR.`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  eZNR — Company Country Migration (Client-Side)');
    console.log(`  Mode:    ${execute ? '🚀 EXECUTE' : '🔍 DRY RUN'}`);
    console.log(`  Default: country = "${defaultCountry}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1. Fetch all companies
    const companiesSnap = await getDocs(collection(db, 'companies'));
    console.log(`📦  Total companies: ${companiesSnap.size}`);

    const alreadySet = [];
    const needsMigration = [];

    companiesSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.country) {
            alreadySet.push({ id: docSnap.id, naziv: data.naziv || '(unnamed)', country: data.country });
        } else {
            needsMigration.push({ id: docSnap.id, naziv: data.naziv || '(unnamed)' });
        }
    });

    console.log(`✅  Already have country: ${alreadySet.length}`);
    alreadySet.forEach(c => console.log(`     • ${c.id} — ${c.naziv} → ${c.country}`));

    console.log(`⚠️   Missing country: ${needsMigration.length}`);
    needsMigration.forEach(c => console.log(`     • ${c.id} — ${c.naziv} → will set "${defaultCountry}"`));

    if (needsMigration.length === 0) {
        console.log('✨  Nothing to migrate!');
        return { total: companiesSnap.size, migrated: 0, alreadySet: alreadySet.length };
    }

    if (!execute) {
        console.log(`🔍  DRY RUN: ${needsMigration.length} document(s) would be updated.`);
        return { total: companiesSnap.size, migrated: 0, alreadySet: alreadySet.length, wouldMigrate: needsMigration.length };
    }

    // 2. Batch write (Firestore limit: 500 per batch)
    const BATCH_LIMIT = 500;
    let written = 0;

    for (let i = 0; i < needsMigration.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const chunk = needsMigration.slice(i, i + BATCH_LIMIT);

        for (const company of chunk) {
            const ref = doc(db, 'companies', company.id);
            batch.update(ref, { country: defaultCountry });
        }

        await batch.commit();
        written += chunk.length;
        console.log(`   ✏️  Batch committed: ${written}/${needsMigration.length}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ✅  Migration complete! ${written} document(s) updated.`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return { total: companiesSnap.size, migrated: written, alreadySet: alreadySet.length };
}

// Expose to browser console for quick access
if (typeof window !== 'undefined') {
    window.__eznrMigrateCountry = runCountryMigration;
}
