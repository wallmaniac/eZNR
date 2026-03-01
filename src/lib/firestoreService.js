'use client';

// ============================================================================
// FIRESTORE SERVICE — Drop-in replacement for dataStore.js
// Same function signatures, same return values, backed by Firebase Firestore
// ============================================================================

import { db, storage } from './firebase';
import {
    collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

// ============================================================================
// COLLECTION NAMES (identical to dataStore.js)
// ============================================================================

export const COLLECTIONS = {
    ORG_UNITS: 'orgUnits',
    WORKPLACES: 'workplaces',
    WORKERS: 'workers',
    EQUIPMENT: 'equipment',
    INJURIES: 'injuries',
    DISEASES: 'diseases',
    CERTIFICATES: 'certificates',
    PPE_ASSIGNMENTS: 'ppeAssignments',
    COUNTRIES: 'countries',
    COUNTIES: 'counties',
    PLACES: 'places',
    AUTHORIZED_COMPANIES: 'authorizedCompanies',
    EXAMINERS: 'examiners',
    DOCTORS: 'doctors',
    EXAM_TYPES: 'examTypes',
    CERT_TYPES: 'certTypes',
    EQUIPMENT_TYPES: 'equipmentTypes',
    PPE_TYPES: 'ppeTypes',
    FILE_TYPES: 'fileTypes',
    DIGITAL_ARCHIVE: 'digitalArchive',
    REQUESTS: 'requests',
    RISK_ASSESSMENTS: 'riskAssessments',
    ISZNR_DOCUMENTS: 'isznrDocuments',
    ISZNR_PARTIES: 'isznrParties',
    ISZNR_DOC_TYPES: 'isznrDocTypes',
    CALENDAR_EVENTS: 'calendarEvents',
    EMPLOYER_DOCS: 'employerDocs',
    USERS: 'users',
    COMPANIES: 'companies',
};

// Collections that are company-scoped (data belongs to a specific company)
const COMPANY_SCOPED = [
    'orgUnits', 'workplaces', 'workers', 'equipment', 'injuries', 'diseases',
    'certificates', 'ppeAssignments', 'calendarEvents', 'employerDocs',
    'digitalArchive', 'requests', 'riskAssessments', 'isznrDocuments', 'isznrParties',
    'authorizedCompanies', 'examiners',
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}.`;
}

export function todayISO() {
    return new Date().toISOString().split('T')[0];
}

export function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// LOCAL CACHE
// Firestore reads are async, but your UI expects synchronous data.
// Solution: we cache data locally and sync with Firestore in the background.
// This gives you instant UI updates + persistent cloud storage.
// ============================================================================

const cache = {};
let isInitialized = false;
const listeners = new Set(); // for notifying components of data changes

export function onDataChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

function notifyListeners() {
    listeners.forEach(cb => cb());
}

// ============================================================================
// INITIALIZATION — Load all data from Firestore into cache
// ============================================================================

export async function initializeFirestore() {
    if (isInitialized) return;

    const collectionNames = Object.values(COLLECTIONS);

    await Promise.all(collectionNames.map(async (colName) => {
        try {
            const snapshot = await getDocs(collection(db, colName));
            cache[colName] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (err) {
            console.warn(`[Firestore] Could not load ${colName}:`, err.message);
            cache[colName] = [];
        }
    }));

    isInitialized = true;
    console.log('[Firestore] ✅ All collections loaded into cache');
}

// Check if Firestore has been initialized
export function isFirestoreReady() {
    return isInitialized;
}

// ============================================================================
// GENERIC CRUD — Synchronous reads from cache, async writes to Firestore
// ============================================================================

// READ — instant from cache (synchronous, like dataStore.js)
export function getAll(colName) {
    return cache[colName] || [];
}

export function getById(colName, id) {
    return (cache[colName] || []).find(item => item.id === id) || null;
}

export function search(colName, queryStr, fields) {
    const items = getAll(colName);
    if (!queryStr) return items;
    const q = queryStr.toLowerCase();
    return items.filter(item =>
        fields.some(f => String(item[f] || '').toLowerCase().includes(q))
    );
}

// CREATE — update cache instantly, then push to Firestore
export function create(colName, data) {
    const now = new Date().toISOString();
    const tempId = genId(); // temporary ID until Firestore responds

    const newItem = {
        ...data,
        id: tempId,
        createdAt: now,
        updatedAt: now,
    };

    // Update cache immediately (synchronous)
    if (!cache[colName]) cache[colName] = [];
    cache[colName].push(newItem);

    // Push to Firestore in background (asynchronous)
    _firestoreCreate(colName, newItem, tempId);

    return newItem;
}

// UPDATE — update cache instantly, then push to Firestore
export function update(colName, id, data) {
    const items = cache[colName] || [];
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    items[idx] = { ...items[idx], ...data, updatedAt: now };

    // Push to Firestore in background
    _firestoreUpdate(colName, id, { ...data, updatedAt: now });

    return items[idx];
}

// DELETE — update cache instantly, then delete from Firestore
export function remove(colName, id) {
    const items = cache[colName] || [];
    cache[colName] = items.filter(item => item.id !== id);

    // Delete from Firestore in background
    _firestoreDelete(colName, id);

    return cache[colName];
}

// DELETE MANY
export function removeMany(colName, ids) {
    const items = cache[colName] || [];
    cache[colName] = items.filter(item => !ids.includes(item.id));

    // Delete all from Firestore in background
    ids.forEach(id => _firestoreDelete(colName, id));

    return cache[colName];
}

// ============================================================================
// COMPANY-SCOPED OPERATIONS
// ============================================================================

export function getAllForCompany(colName, companyId) {
    if (!companyId) return getAll(colName);
    if (!COMPANY_SCOPED.includes(colName)) return getAll(colName);
    return getAll(colName).filter(item => !item.companyId || item.companyId === companyId);
}

export function createForCompany(colName, data, companyId) {
    if (companyId && COMPANY_SCOPED.includes(colName)) {
        return create(colName, { ...data, companyId });
    }
    return create(colName, data);
}

// ============================================================================
// USER & COMPANY HELPERS
// ============================================================================

export function findUserByUsername(username) {
    return getAll(COLLECTIONS.USERS).find(u => u.username === username) || null;
}

export function getUserCompanies(userId) {
    const user = getById(COLLECTIONS.USERS, userId);
    if (!user) return [];
    if (user.role === 'admin') return getAll(COLLECTIONS.COMPANIES);
    return getAll(COLLECTIONS.COMPANIES).filter(c => (user.companyIds || []).includes(c.id));
}

export function getAllUsers() {
    return getAll(COLLECTIONS.USERS);
}

export function getAllCompanies() {
    return getAll(COLLECTIONS.COMPANIES);
}

// ============================================================================
// RELATION HELPERS (identical to dataStore.js)
// ============================================================================

export function getWorkerDisplayName(worker) {
    if (!worker) return '';
    return `${worker.ime} ${worker.prezime}`;
}

export function getOrgUnitName(id) {
    const unit = getById(COLLECTIONS.ORG_UNITS, id);
    return unit ? unit.naziv : '';
}

export function getWorkplaceName(id) {
    const wp = getById(COLLECTIONS.WORKPLACES, id);
    return wp ? wp.naziv : '';
}

export function getWorkerCertificates(workerId) {
    return getAll(COLLECTIONS.CERTIFICATES).filter(c => c.workerId === workerId);
}

export function getWorkerPPE(workerId) {
    return getAll(COLLECTIONS.PPE_ASSIGNMENTS).filter(p => p.workerId === workerId);
}

export function getWorkersInOrgUnit(orgUnitId) {
    return getAll(COLLECTIONS.WORKERS).filter(w => w.orgJedinicaId === orgUnitId && w.aktivan);
}

export function getWorkersInWorkplace(workplaceId) {
    return getAll(COLLECTIONS.WORKERS).filter(w => w.radnoMjestoId === workplaceId && w.aktivan);
}

export function getChildOrgUnits(parentId) {
    return getAll(COLLECTIONS.ORG_UNITS).filter(ou => ou.parentId === parentId);
}

export function getCalendarEventsForMonth(year, month) {
    const events = getAll(COLLECTIONS.CALENDAR_EVENTS);
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return events.filter(e => e.datum && e.datum.startsWith(prefix));
}

export function getCompanyById(id) {
    return getById(COLLECTIONS.COMPANIES, id);
}

// ============================================================================
// FIRESTORE ASYNC OPERATIONS (internal — called in the background)
// ============================================================================

async function _firestoreCreate(colName, item, tempId) {
    try {
        // Use the tempId as the document ID so cache and Firestore stay in sync
        const docRef = doc(db, colName, tempId);
        const { id, ...dataWithoutId } = item; // Don't store `id` as a field — it's the doc ID
        await updateDoc(docRef, dataWithoutId).catch(async () => {
            // If document doesn't exist, create it with setDoc
            const { setDoc } = await import('firebase/firestore');
            await setDoc(docRef, dataWithoutId);
        });
        console.log(`[Firestore] ✅ Created ${colName}/${tempId}`);
    } catch (err) {
        console.error(`[Firestore] ❌ Failed to create ${colName}/${tempId}:`, err);
    }
}

async function _firestoreUpdate(colName, id, data) {
    try {
        const docRef = doc(db, colName, id);
        const { id: _id, ...dataWithoutId } = data;
        await updateDoc(docRef, dataWithoutId).catch(async () => {
            // Document might not exist yet — create it
            const { setDoc } = await import('firebase/firestore');
            await setDoc(docRef, { ...dataWithoutId }, { merge: true });
        });
        console.log(`[Firestore] ✅ Updated ${colName}/${id}`);
    } catch (err) {
        console.error(`[Firestore] ❌ Failed to update ${colName}/${id}:`, err);
    }
}

async function _firestoreDelete(colName, id) {
    try {
        await deleteDoc(doc(db, colName, id));
        console.log(`[Firestore] ✅ Deleted ${colName}/${id}`);
    } catch (err) {
        console.error(`[Firestore] ❌ Failed to delete ${colName}/${id}:`, err);
    }
}

// ============================================================================
// STORAGE UPLOADS (Firebase Storage)
// ============================================================================

export async function uploadImage(path, dataUrl) {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
    try {
        const storageRef = ref(storage, path);
        await uploadString(storageRef, dataUrl, 'data_url');
        const downloadUrl = await getDownloadURL(storageRef);
        console.log(`[Storage] ✅ Uploaded ${path}`);
        return downloadUrl;
    } catch (err) {
        console.error(`[Storage] ❌ Failed to upload ${path}:`, err);
        return null;
    }
}

export async function deleteImage(path) {
    if (!path) return;
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
        console.log(`[Storage] ✅ Deleted ${path}`);
    } catch (err) {
        console.error(`[Storage] ❌ Failed to delete ${path}:`, err);
    }
}

// ============================================================================
// SEED DATA — Upload initial data to empty Firestore
// Re-uses the exact same seed data from dataStore.js
// ============================================================================

export async function seedFirestore(seedData) {
    console.log('[Firestore] 🌱 Seeding database...');
    const batch_size = 400; // Firestore batch limit is 500
    let totalDocs = 0;

    for (const [colName, items] of Object.entries(seedData)) {
        if (!items || items.length === 0) continue;

        // Check if collection already has data
        const existing = await getDocs(collection(db, colName));
        if (existing.size > 0) {
            console.log(`[Firestore] ⏭ ${colName} already has ${existing.size} docs, skipping`);
            continue;
        }

        // Seed in batches
        for (let i = 0; i < items.length; i += batch_size) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + batch_size);

            for (const item of chunk) {
                const docId = item.id || genId();
                const { id, ...data } = item;
                const docRef = doc(db, colName, docId);
                batch.set(docRef, {
                    ...data,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                totalDocs++;
            }

            await batch.commit();
        }

        console.log(`[Firestore] ✅ Seeded ${colName}: ${items.length} documents`);
    }

    console.log(`[Firestore] 🎉 Seeding complete! ${totalDocs} total documents created`);

    // Reload cache after seeding
    isInitialized = false;
    await initializeFirestore();
}

export { COMPANY_SCOPED };
