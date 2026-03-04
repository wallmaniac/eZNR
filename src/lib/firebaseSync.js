'use client';

// ============================================================================
// FIREBASE SYNC SERVICE
// Syncs all localStorage collections to Firestore under:
//   /companies/{companyId}/{collection}/{docId}
// For global (non-company) collections:
//   /global/{collection}/{docId}
// ============================================================================

import { db } from './firebase';
import {
    collection as fsCollection,
    doc,
    writeBatch,
    getDocs,
    deleteDoc,
    setDoc,
} from 'firebase/firestore';
import { COLLECTIONS } from './dataStore';

// Company-scoped collections (stored under /companies/{companyId}/...)
const COMPANY_SCOPED = [
    'orgUnits', 'workplaces', 'workers', 'equipment', 'injuries', 'diseases',
    'certificates', 'ppeAssignments', 'calendarEvents', 'employerDocs',
    'referralsRa1', 'formsOir1', 'formsRo1', 'formsRo2', 'referralsNr1',
    'digitalArchive', 'requests', 'riskAssessments', 'isznrDocuments', 'isznrParties',
    'authorizedCompanies', 'examiners', 'personTypes', 'hazards', 'questionnaires',
];

// Global collections (shared/reference data)
const GLOBAL_COLLECTIONS = [
    'countries', 'counties', 'places', 'doctors',
    'examTypes', 'certTypes', 'equipmentTypes', 'ppeTypes', 'fileTypes',
    'isznrDocTypes', 'users', 'companies',
];

const STORE_PREFIX = 'eznr_';

function getLocalData(key) {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORE_PREFIX + key);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
}

// ─── Sync a single collection to Firestore ───────────────────────────────────
async function syncCollection(collectionName, firestorePath, onProgress) {
    const items = getLocalData(collectionName);
    if (items.length === 0) return { synced: 0, collection: collectionName };

    // Firestore batches allow max 500 writes per batch
    const BATCH_SIZE = 400;
    let totalSynced = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = items.slice(i, i + BATCH_SIZE);

        for (const item of chunk) {
            if (!item.id) continue;
            const ref = doc(db, firestorePath, item.id);
            // Clean up undefined values (Firestore doesn't accept them)
            const clean = JSON.parse(JSON.stringify(item));
            batch.set(ref, clean, { merge: true });
        }

        await batch.commit();
        totalSynced += chunk.length;
        onProgress?.(`${collectionName}: ${totalSynced}/${items.length}`);
    }

    return { synced: totalSynced, collection: collectionName };
}

// ─── Main sync function ───────────────────────────────────────────────────────
export async function syncAllToFirebase(companyId = 'default', onProgress) {
    const results = [];
    const errors = [];
    const allCollections = Object.values(COLLECTIONS);

    for (const col of allCollections) {
        try {
            onProgress?.(`Syncing ${col}...`);
            let path;

            if (COMPANY_SCOPED.includes(col)) {
                // Company-scoped: companies/{companyId}/{collection}/{docId}  → 4 segments ✅
                path = `companies/${companyId}/${col}`;
            } else {
                // Global/reference data: {collection}/{docId}  → 2 segments ✅
                // (NOT nested under 'global/' which would give 3 segments ❌)
                path = col;
            }

            const result = await syncCollection(col, path, onProgress);
            results.push(result);
        } catch (err) {
            console.error(`Failed to sync ${col}:`, err);
            errors.push({ collection: col, error: err.message });
        }
    }

    return { results, errors };
}

// ─── Sync just the questionnaire-related collections ─────────────────────────
export async function syncQuestionnairesToFirebase(companyId = 'default', onProgress) {
    const questCols = ['questionnaires'];
    const results = [];
    const errors = [];

    for (const col of questCols) {
        try {
            onProgress?.(`Syncing ${col}...`);
            const path = `companies/${companyId}/${col}`;
            const result = await syncCollection(col, path, onProgress);
            results.push(result);
        } catch (err) {
            errors.push({ collection: col, error: err.message });
        }
    }

    return { results, errors };
}

// ─── Get sync stats (how many items per collection in localStorage) ───────────
export function getSyncStats() {
    const stats = {};
    const allCollections = Object.values(COLLECTIONS);

    for (const col of allCollections) {
        const items = getLocalData(col);
        stats[col] = items.length;
    }

    return stats;
}

// ─── Questionnaire session helpers (for email dispatch feature) ───────────────
export async function createQuestionnaireSession(session) {
    const ref = doc(fsCollection(db, 'questionnaire_sessions'));
    const data = {
        ...session,
        id: ref.id,
        createdAt: new Date().toISOString(),
        status: 'sent', // sent | opened | completed | expired
    };
    await setDoc(ref, data);
    return data;
}

export async function getQuestionnaireSession(token) {
    const { getDocs, query, where } = await import('firebase/firestore');
    const q = query(
        fsCollection(db, 'questionnaire_sessions'),
        where('token', '==', token)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data();
}

export async function saveQuestionnaireResponse(sessionId, answers) {
    const ref = doc(db, 'questionnaire_responses', sessionId);
    await setDoc(ref, {
        sessionId,
        answers,
        submittedAt: new Date().toISOString(),
    });
    // Also update session status
    const sessionRef = doc(db, 'questionnaire_sessions', sessionId);
    await setDoc(sessionRef, { status: 'completed', completedAt: new Date().toISOString() }, { merge: true });
}

// ─── Get all sessions for a specific questionnaire ───────────────────────────
export async function getSessionsForQuestionnaire(questionnaireId) {
    const { getDocs, query, where, orderBy } = await import('firebase/firestore');
    try {
        const q = query(
            fsCollection(db, 'questionnaire_sessions'),
            where('questionnaireId', '==', questionnaireId),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    } catch (err) {
        // If index not ready, fallback without orderBy
        console.warn('Falling back to unordered query:', err.message);
        const q = query(
            fsCollection(db, 'questionnaire_sessions'),
            where('questionnaireId', '==', questionnaireId)
        );
        const snap = await getDocs(q);
        const results = snap.docs.map(d => d.data());
        results.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return results;
    }
}

// ─── Mark a session as opened (when worker opens the link) ───────────────────
export async function markSessionOpened(sessionId) {
    const sessionRef = doc(db, 'questionnaire_sessions', sessionId);
    await setDoc(sessionRef, {
        status: 'opened',
        openedAt: new Date().toISOString(),
    }, { merge: true });
}

// ─── Get a specific questionnaire response ───────────────────────────────────
export async function getQuestionnaireResponse(sessionId) {
    const { getDoc } = await import('firebase/firestore');
    const ref = doc(db, 'questionnaire_responses', sessionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
}

// ─── Generate a unique token for questionnaire sessions ──────────────────────
export function generateToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const array = new Uint8Array(24);
    if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(array);
        for (let i = 0; i < 24; i++) {
            token += chars[array[i] % chars.length];
        }
    } else {
        for (let i = 0; i < 24; i++) {
            token += chars[Math.floor(Math.random() * chars.length)];
        }
    }
    return token;
}
