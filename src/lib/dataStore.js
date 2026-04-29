'use client';

// ============================================================================
// DATA STORE — Firestore-backed data management for eZNR
// Provides CRUD operations for all modules with company-scoped data
//
// Architecture:
//   - In-memory cache for instant synchronous reads (getAll, getById)
//   - Background Firestore writes for persistence
//   - Company-scoped: /companies/{companyId}/{collection}/{docId}
//   - Global: /{collection}/{docId} (certTypes, ppeTypes, etc.)
//   - onSnapshot listeners for real-time sync between users
// ============================================================================

import { db } from './firebase';
import { logUserAction } from './activityLog';
import {
    collection as fsCollection, doc, getDocs, setDoc, updateDoc,
    deleteDoc, writeBatch, onSnapshot, query, orderBy,
} from 'firebase/firestore';

// ============================================================================
// IN-MEMORY CACHE — The core of instant reads
// ============================================================================
const _cache = {};
let _activeCompanyId = null;
let _isLoaded = false;
let _isLoading = false;
let _loadPromise = null;
const _listeners = new Set();       // data change listeners
const _snapshotUnsubs = [];         // active onSnapshot unsubscribers

// ── Helpers ──────────────────────────────────────────────────────────────────
export function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date)) return d;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}.`;
}

export function todayISO() {
    return new Date().toISOString().split('T')[0];
}

// ============================================================================
// ACTIVITY AUTO-LOG — writes activity entries to Firestore
// ============================================================================
const _AL_MAX = 200;
const _AL_COLS = {
    workers: { cat: 'worker', icon: '\uD83D\uDC77', label: d => (`${d.ime || ''} ${d.prezime || ''}`).trim() || 'Radnik', relatedId: d => d.id },
    certificates: { cat: 'certificate', icon: '\uD83D\uDCCB', label: d => d.ime || d.oznaka || 'Uvjerenje', relatedId: d => d.id },
    ppeAssignments: { cat: 'worker', icon: '\uD83E\uDDBA', label: d => d.naziv || 'OZO', relatedId: d => d.workerId },
    equipment: { cat: 'equipment', icon: '\u2699\uFE0F', label: d => d.naziv || 'Oprema', relatedId: d => d.id },
    employerDocs: { cat: 'document', icon: '\uD83D\uDCC4', label: d => d.naziv || d.tip || 'Dokument', relatedId: d => d.id },
    injuries: { cat: 'worker', icon: '\uD83E\uDE79', label: d => `Povreda: ${d.radnikIme || ''}`, relatedId: d => d.workerId },
    diseases: { cat: 'worker', icon: '\uD83C\uDFE5', label: d => `Bolest: ${d.radnikIme || ''}`, relatedId: d => d.workerId },
    workplaces: { cat: 'company', icon: '\uD83D\uDD27', label: d => `Radno mjesto: ${d.naziv || ''}`, relatedId: d => d.id },
    orgUnits: { cat: 'company', icon: '\uD83C\uDFE2', label: d => `Org. jedinica: ${d.naziv || ''}`, relatedId: d => d.id },
    medicalExams: { cat: 'worker', icon: '\uD83E\uDE7A', label: d => `Med. pregled: ${d.radnikIme || d.naziv || ''}`, relatedId: d => d.workerId },
    trainings: { cat: 'document', icon: '\uD83C\uDFAC', label: d => `Obuka: ${d.naziv || ''}`, relatedId: d => d.id },
    questionnaires: { cat: 'document', icon: '\uD83D\uDCDD', label: d => `Upitnik: ${d.naziv || ''}`, relatedId: d => d.id },
    sistematizacije: { cat: 'company', icon: '\uD83D\uDCD1', label: d => `Sistematizacija: ${d.nazivPosla || d.opisPoslova?.substring(0, 30) || ''}`, relatedId: d => d.id },
    calendarEvents: { cat: 'certificate', icon: '\uD83D\uDCC5', label: d => `Događaj: ${d.opis || d.tip || ''}`, relatedId: d => d.id },
    riskAssessments: { cat: 'document', icon: '\u26A0\uFE0F', label: d => `Procjena rizika: ${d.naziv || ''}`, relatedId: d => d.id },
    requests: { cat: 'document', icon: '\uD83D\uDCE9', label: d => `Zahtjev: ${d.naziv || d.tip || ''}`, relatedId: d => d.id },
    zapisnici: { cat: 'document', icon: '\uD83D\uDCCB', label: d => `Zapisnik: ${d.naziv || d.broj || ''}`, relatedId: d => d.id },
    vehicles: { cat: 'equipment', icon: '🚗', label: d => (`Vozilo: ${d.registracija || d.marka || ''}`).trim(), relatedId: d => d.id },
    vehicleAssignments: { cat: 'equipment', icon: '🔑', label: d => `Zaduženje vozila: ${d.workerIme || ''}`, relatedId: d => d.vehicleId },
    travelOrders: { cat: 'document', icon: '📝', label: d => `Putni nalog: ${d.brojNaloga || ''}`, relatedId: d => d.id },
    fireExtinguishers: { cat: 'equipment', icon: '🧯', label: d => `Vatrogasni aparat: ${d.lokacija || d.serijskiBroj || ''}`, relatedId: d => d.id },
    hydrants: { cat: 'equipment', icon: '🚰', label: d => `Hidrantska mreža: ${d.mjernaTacka || ''}`, relatedId: d => d.id },
    evacuationPlans: { cat: 'document', icon: '🗺️', label: d => `Plan evakuacije: ${d.nazivObjekta || ''}`, relatedId: d => d.id },
    evacuationDrills: { cat: 'document', icon: '🏃', label: d => `Vježba evakuacije: ${d.nazivVjezbe || ''}`, relatedId: d => d.id },
    serviceLog: { cat: 'equipment', icon: '🛠️', label: d => `Servis: ${d.opis || ''}`, relatedId: d => d.itemId },
    nightWork: { cat: 'worker', icon: '🌙', label: d => `Noćni rad: ${d.radnikIme || ''}`, relatedId: d => d.workerId },
    referralsRa1: { cat: 'document', icon: '🩺', label: d => `Uputnica RA-1: ${d.radnikIme || ''}`, relatedId: d => d.id },
    formsOir1: { cat: 'document', icon: '📋', label: d => `OIR-1: ${d.radnikIme || ''}`, relatedId: d => d.id },
    formsRo1: { cat: 'document', icon: '📋', label: d => `RO-1: ${d.radnikIme || ''}`, relatedId: d => d.id },
    formsRo2: { cat: 'document', icon: '📋', label: d => `RO-2: ${d.radnikIme || ''}`, relatedId: d => d.id },
    referralsNr1: { cat: 'document', icon: '🌙', label: d => `Uputnica Noćni Rad: ${d.radnikIme || ''}`, relatedId: d => d.id },
};
const _AL_VERBS = { create: 'Dodan(a)', update: 'Ažuriran(a)', delete: 'Obrisan(a)' };

function _autoLog(action, collection, item) {
    if (typeof window === 'undefined' || !item) return;
    const cfg = _AL_COLS[collection];
    if (!cfg) return;
    try {
        const user = _getActiveUser();
        let ac = _getActiveCompanyId();
        const companyId = (ac && ac !== 'all') ? ac : item.companyId;
        if (!companyId || companyId === 'all') return;

        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            action, category: cfg.cat, icon: cfg.icon,
            title: `${_AL_VERBS[action] || action} ${cfg.label(item)}`,
            detail: '', severity: action === 'delete' ? 'warning' : 'info',
            relatedId: (cfg.relatedId && cfg.relatedId(item)) || item.id || 'system',
            companyId,
            userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username : 'Sistem',
            userId: user?.id || user?.uid || '',
        };

        // Write to Firestore activity log (background, non-blocking)
        const logRef = doc(db, `companies/${companyId}/activityLog`, entry.id);
        setDoc(logRef, entry).catch(err => console.warn('[ActivityLog] Write failed:', err));

        // Write to localStorage via activityLog to populate Dnevnik aktivnosti
        if (typeof logUserAction === 'function') {
            logUserAction({
                action, category: cfg.cat, title: entry.title,
                detail: entry.detail || '',
                userId: entry.userId, userName: entry.userName,
                companyId: entry.companyId, severity: entry.severity,
                relatedId: entry.relatedId
            });
        }

        // Also update local cache for immediate display
        if (!_cache['activityLog']) _cache['activityLog'] = [];
        _cache['activityLog'] = [entry, ..._cache['activityLog']].slice(0, _AL_MAX);
    } catch (e) { console.warn('[ActivityLog] Exception:', e); }
}

// ============================================================================
// COMPANY SCOPING
// ============================================================================

// Collections that are company-scoped (stored under /companies/{companyId}/...)
export const COMPANY_SCOPED = [
    'orgUnits', 'workplaces', 'workers', 'equipment', 'injuries', 'diseases',
    'certificates', 'ppeAssignments', 'calendarEvents', 'employerDocs', 'referralsRa1', 'formsOir1', 'formsRo1', 'formsRo2', 'referralsNr1',
    'digitalArchive', 'requests', 'riskAssessments', 'riskItems', 'isznrDocuments', 'isznrParties',
    'authorizedCompanies', 'examiners', 'personTypes', 'hazards', 'questionnaires',
    'trainings', 'annualReports', 'medicalExams', 'sistematizacije',
    'vehicles', 'vehicleAssignments', 'travelOrders', 'fireExtinguishers', 'hydrants', 'evacuationPlans', 'evacuationDrills',
    'zapisnici', 'serviceLog', 'activityLog', 'nightWork', 'safety_observations',
];

// Global collections (shared reference data, at root level)
const GLOBAL_COLLECTIONS = [
    'countries', 'counties', 'places', 'doctors',
    'examTypes', 'certTypes', 'equipmentTypes', 'ppeTypes', 'fileTypes',
    'isznrDocTypes',
];

export function getActiveCompanyId() {
    if (typeof window === 'undefined') return null;
    return _activeCompanyId || localStorage.getItem('eznr_activeCompany') || null;
}

// Keep the old internal name aliased just in case
function _getActiveCompanyId() { return getActiveCompanyId(); }

function _getActiveUser() {
    if (typeof window === 'undefined') return null;
    try {
        const u = localStorage.getItem('eznr_user');
        return u ? JSON.parse(u) : null;
    } catch { return null; }
}

function _getUserCompanyIds() {
    const u = _getActiveUser();
    return u ? (u.companyIds || []) : [];
}

// ============================================================================
// DATA LOADING — Fetch from Firestore into cache
// ============================================================================

/**
 * Load all data for a company from Firestore.
 * Called once on login / company switch.
 * Returns a promise that resolves when all data is cached.
 */
export async function loadCompanyData(companyId) {
    if (!companyId || companyId === _activeCompanyId && _isLoaded) return;

    // Prevent duplicate loads
    if (_isLoading && _activeCompanyId === companyId) return _loadPromise;

    _isLoading = true;
    _activeCompanyId = companyId;

    // Detach any previous onSnapshot listeners
    _detachListeners();

    _loadPromise = (async () => {
        try {
            console.log(`[dataStore] 📦 Loading data for company ${companyId}...`);
            const start = performance.now();

            // Load company-scoped collections using onSnapshot for real-time background sync
            const companyLoads = COMPANY_SCOPED.map((colName) => {
                return new Promise((resolve) => {
                    try {
                        const targets = companyId === 'all' ? _getUserCompanyIds() : [companyId];

                        if (targets.length === 0) {
                            _cache[colName] = [];
                            return resolve();
                        }

                        let completed = 0;
                        if (!_cache[colName] || companyId === _activeCompanyId) _cache[colName] = []; // initialize empty

                        targets.forEach(targetId => {
                            const colRef = fsCollection(db, `companies/${targetId}/${colName}`);
                            const unsub = onSnapshot(colRef, (snap) => {
                                const newDocs = snap.docs.map(d => ({ id: d.id, companyId: targetId, ...d.data() }));

                                // Merge data: remove old entries for THIS target company, then push new ones natively
                                _cache[colName] = [
                                    ...(_cache[colName] || []).filter(item => item.companyId !== targetId),
                                    ...newDocs
                                ];

                                _notifyListeners();
                                if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('eznr:data-synced'));
                                }

                                completed++;
                                // Only resolve after all initial snapshots return to unblock the main screen
                                if (completed === targets.length) resolve();
                            }, (err) => {
                                console.warn(`[dataStore] ⚠️ Snapshot error ${colName} [${targetId}]:`, err.message);
                                completed++;
                                if (completed === targets.length) resolve();
                            });
                            _snapshotUnsubs.push(unsub);
                        });
                    } catch (err) {
                        console.warn(`[dataStore] ⚠️ Failed sync setup for ${colName}:`, err.message);
                        if (!_cache[colName]) _cache[colName] = [];
                        resolve();
                    }
                });
            });

            // Load global collections in parallel (non-blocking)
            const globalLoads = GLOBAL_COLLECTIONS.map(async (colName) => {
                try {
                    const colRef = fsCollection(db, colName);
                    const snap = await getDocs(colRef);
                    _cache[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Dispatch sync event individually so dependent UI (dropdowns) populate lazily
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('eznr:data-synced'));
                    }
                } catch (err) {
                    console.debug(`[dataStore] global ${colName} load skipped:`, err.code || err.message);
                    _cache[colName] = [];
                }
            });

            // Load companies and users (top-level) in the background (NON-BLOCKING)
            const metaLoads = ['companies', 'users'].map(async (colName) => {
                try {
                    const snap = await getDocs(fsCollection(db, colName));
                    _cache[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                } catch (err) {
                    console.debug(`[dataStore] ${colName} load skipped (insufficient permissions).`);
                    _cache[colName] = [];
                }
            });

            // CRITICAL: Wait for company-scoped data before declaring loaded (with 3s timeout for slow mobile)
            const companyTimeout = new Promise(r => setTimeout(r, 3000));
            // Start meta loads in parallel immediately (don't wait for company data)
            const metaPromise = Promise.all([...globalLoads, ...metaLoads]).then(() => {
                console.log('[dataStore] 📡 All real-time modules & global references established.');
                // Fire sync event so UI pages (admin/users) refresh when users data is ready
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('eznr:data-synced'));
                }
            });
            await Promise.race([Promise.all(companyLoads), companyTimeout]);

            // Allow global + meta to initialize gracefully in the background
            metaPromise.catch(() => {});

            const elapsed = ((performance.now() - start) / 1000).toFixed(2);
            const totalDocs = Object.values(_cache).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
            console.log(`[dataStore] ✅ Fast boot finished in ${elapsed}s (${totalDocs} docs), background tasks running.`);

            _isLoaded = true;
            _isLoading = false;
            _notifyListeners();
        } catch (err) {
            console.error('[dataStore] ❌ Fatal load error:', err);
            _isLoading = false;
        }
    })();

    return _loadPromise;
}

/**
 * Switch to a different company — clears cache and reloads.
 */
export async function switchCompanyData(companyId) {
    _isLoaded = false;
    _activeCompanyId = null;
    // Don't clear global collections — they're shared
    COMPANY_SCOPED.forEach(col => { _cache[col] = []; });
    _cache['activityLog'] = [];
    await loadCompanyData(companyId);
}

/**
 * Check if data is loaded and ready.
 */
export function isDataReady() {
    return _isLoaded;
}

/**
 * Subscribe to data changes.
 */
export function onDataChange(callback) {
    _listeners.add(callback);
    return () => _listeners.delete(callback);
}

function _notifyListeners() {
    _listeners.forEach(cb => { try { cb(); } catch { } });
}

function _detachListeners() {
    _snapshotUnsubs.forEach(unsub => { try { unsub(); } catch { } });
    _snapshotUnsubs.length = 0;
}

/**
 * Call this on logout to stop all real-time Firestore listeners.
 * Without this, onSnapshot callbacks keep firing and produce
 * "Missing or insufficient permissions" errors for the signed-out user.
 */
export function resetDataStore() {
    _detachListeners();
    _activeCompanyId = null;
    _isLoaded = false;
    _isLoading = false;
    _loadPromise = null;
    // Clear company-scoped data from cache — global reference data can stay
    COMPANY_SCOPED.forEach(col => { _cache[col] = []; });
    console.log('[dataStore] 🔒 Listeners detached and cache cleared (logout).');
}

// ============================================================================
// FIRESTORE PATH HELPERS
// ============================================================================

function _getCollectionPath(colName) {
    const companyId = _getActiveCompanyId();
    if (COMPANY_SCOPED.includes(colName)) {
        if (!companyId || companyId === 'all') return null; // Can't write without a company
        return `companies/${companyId}/${colName}`;
    }
    if (GLOBAL_COLLECTIONS.includes(colName)) {
        return colName; // Root-level
    }
    // Fallback for meta collections (companies, users)
    return colName;
}

function _getDocRef(colName, docId) {
    const path = _getCollectionPath(colName);
    if (!path) return null;
    return doc(db, path, docId);
}

// ============================================================================
// GENERIC CRUD — Synchronous reads from cache, async writes to Firestore
// ============================================================================

export function getById(collection, id) {
    return (_cache[collection] || []).find(item => item.id === id) || null;
}

export function create(collection, data) {
    const now = new Date().toISOString();
    const companyId = _getActiveCompanyId();

    let enrichedData = { ...data };
    if (COMPANY_SCOPED.includes(collection) && !enrichedData.companyId && companyId && companyId !== 'all') {
        enrichedData.companyId = companyId;
    }

    const newItem = {
        ...enrichedData,
        id: data.id || genId(),
        createdAt: now,
        updatedAt: now,
    };

    // Update cache immediately (synchronous)
    if (!_cache[collection]) _cache[collection] = [];
    _cache[collection].push(newItem);

    // Write to Firestore in background
    _firestoreWrite(collection, newItem);
    _autoLog('create', collection, newItem);

    return newItem;
}

export async function createMass(collection, dataArray) {
    if (!dataArray || dataArray.length === 0) return [];
    if (typeof window === 'undefined') return dataArray;

    const now = new Date().toISOString();
    const companyId = _getActiveCompanyId();
    const path = _getCollectionPath(collection);

    // Fallback if no path (e.g. no active company)
    if (!path) return [];

    const newItems = dataArray.map(data => {
        let enrichedData = { ...data };
        if (COMPANY_SCOPED.includes(collection) && !enrichedData.companyId && companyId && companyId !== 'all') {
            enrichedData.companyId = companyId;
        }
        return {
            ...enrichedData,
            id: genId(),
            createdAt: now,
            updatedAt: now,
        };
    });

    // Update cache immediately so subsequent operations in the same import cycle can read them
    if (!_cache[collection]) _cache[collection] = [];
    _cache[collection].push(...newItems);

    // Write to Firestore in batches of 500
    const CHUNK_SIZE = 500;
    for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
        const chunk = newItems.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(item => {
            const docRef = doc(db, path, item.id);
            batch.set(docRef, item);
        });
        try {
            await batch.commit();
        } catch (err) {
            console.error('[createMass] Batch commit failed for', collection, err);
        }
    }

    // Generic auto log to avoid activity log spam
    if (newItems.length > 0) {
        _autoLog('create', collection, { ...newItems[0], id: newItems[0].id, naziv: `Masovni uvoz: ${newItems.length} stavki`, ime: `Masovni uvoz (${newItems.length})`, opisPoslova: 'Masovni uvoz' });
    }

    return newItems;
}

export function update(collection, id, data) {
    const items = _cache[collection] || [];
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    items[idx] = { ...items[idx], ...data, updatedAt: now };

    // Write to Firestore in background
    _firestoreWrite(collection, items[idx]);
    _autoLog('update', collection, items[idx]);

    return items[idx];
}

// ============================================================================
// UNDO STACK — in-memory (no longer in localStorage)
// ============================================================================
let _undoStack = [];
const UNDO_MAX = 30;

export function getUndoStack() { return _undoStack; }

function pushUndoEntry(entry) {
    _undoStack.unshift({ ...entry, timestamp: new Date().toISOString() });
    _undoStack = _undoStack.slice(0, UNDO_MAX);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('eznr:undo-stack-changed'));
    }
}

export function undoLastDelete() {
    if (_undoStack.length === 0) return null;
    const entry = _undoStack[0];
    entry.items.forEach(({ collection, data }) => {
        if (!_cache[collection]) _cache[collection] = [];
        if (!_cache[collection].find(i => i.id === data.id)) {
            _cache[collection].push(data);
            _firestoreWrite(collection, data); // Re-create in Firestore
        }
    });
    _undoStack = _undoStack.slice(1);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('eznr:undo-stack-changed'));
        window.dispatchEvent(new CustomEvent('eznr:undo'));
    }
    return entry;
}

export function clearUndoStack() {
    _undoStack = [];
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('eznr:undo-stack-changed'));
    }
}

export function remove(collection, id) {
    const items = _cache[collection] || [];
    const removed = items.find(item => item.id === id);
    _cache[collection] = items.filter(item => item.id !== id);

    if (removed) {
        _autoLog('delete', collection, removed);
        _firestoreDelete(collection, id);
        const label = removed.ime ? (removed.ime + ' ' + (removed.prezime || '')).trim()
            : (removed.naziv || removed.tip || 'Zapis');
        pushUndoEntry({ label, collection, items: [{ collection, data: removed }] });
    }
    return _cache[collection];
}

export function removeMany(collection, ids) {
    const items = _cache[collection] || [];
    const removed = items.filter(item => ids.includes(item.id));
    _cache[collection] = items.filter(item => !ids.includes(item.id));

    if (removed.length) {
        ids.forEach(id => _firestoreDelete(collection, id));
        const first = removed[0];
        const label = removed.length === 1
            ? (first.ime ? (first.ime + ' ' + (first.prezime || '')).trim() : (first.naziv || 'Zapis'))
            : (removed.length + ' zapisa');
        pushUndoEntry({ label, collection, items: removed.map(data => ({ collection, data })) });
    }
    return _cache[collection];
}

export function removeWorkerCascade(workerId) {
    if (!workerId) return;
    const undoItems = [];
    const cascadeCols = ['certificates', 'ppeAssignments', 'calendarEvents', 'formsRo1', 'formsRo2', 'referralsRa1', 'referralsNr1', 'medicalExams'];

    const worker = (_cache['workers'] || []).find(w => w.id === workerId);
    if (worker) undoItems.push({ collection: 'workers', data: worker });
    cascadeCols.forEach(col => {
        (_cache[col] || []).filter(r => r.workerId === workerId).forEach(data => {
            undoItems.push({ collection: col, data });
            _firestoreDelete(col, data.id);
        });
    });

    const workerLabel = worker ? (worker.ime + ' ' + (worker.prezime || '')).trim() : 'Radnik';

    _cache['workers'] = (_cache['workers'] || []).filter(w => w.id !== workerId);
    if (worker) _firestoreDelete('workers', workerId);
    cascadeCols.forEach(col => {
        _cache[col] = (_cache[col] || []).filter(r => r.workerId !== workerId);
    });

    if (worker) _autoLog('delete', 'workers', worker);
    pushUndoEntry({
        label: workerLabel,
        collection: 'workers',
        cascade: true,
        cascadeCount: undoItems.length - 1,
        items: undoItems,
    });
}

export function removeManyWorkersCascade(workerIds) {
    if (!workerIds || !workerIds.length) return;
    const undoItems = [];
    const cascadeCols = ['certificates', 'ppeAssignments', 'calendarEvents', 'formsRo1', 'formsRo2', 'referralsRa1', 'referralsNr1', 'medicalExams'];

    workerIds.forEach(wid => {
        const worker = (_cache['workers'] || []).find(w => w.id === wid);
        if (worker) {
            undoItems.push({ collection: 'workers', data: worker });
            _firestoreDelete('workers', wid);
        }
        cascadeCols.forEach(col => {
            (_cache[col] || []).filter(r => r.workerId === wid).forEach(data => {
                undoItems.push({ collection: col, data });
                _firestoreDelete(col, data.id);
            });
        });
    });

    _cache['workers'] = (_cache['workers'] || []).filter(w => !workerIds.includes(w.id));
    cascadeCols.forEach(col => {
        _cache[col] = (_cache[col] || []).filter(r => !workerIds.includes(r.workerId));
    });

    const relatedCount = undoItems.filter(i => i.collection !== 'workers').length;
    pushUndoEntry({
        label: workerIds.length + ' radnika',
        collection: 'workers',
        cascade: true,
        cascadeCount: relatedCount,
        items: undoItems,
    });
}

export function search(collection, queryStr, fields) {
    const items = _cache[collection] || [];
    if (!queryStr) return items;
    const q = queryStr.toLowerCase();
    return items.filter(item =>
        fields.some(f => String(item[f] || '').toLowerCase().includes(q))
    );
}

// ============================================================================
// COLLECTION NAMES
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
    REFERRALS_RA1: 'referralsRa1',
    FORMS_OIR1: 'formsOir1',
    FORMS_RO1: 'formsRo1',
    FORMS_RO2: 'formsRo2',
    REFERRALS_NR1: 'referralsNr1',
    PERSON_TYPES: 'personTypes',
    HAZARDS: 'hazards',
    RISK_ITEMS: 'riskItems',
    QUESTIONNAIRES: 'questionnaires',
    TRAININGS: 'trainings',
    ANNUAL_REPORTS: 'annualReports',
    SERVICE_LOG: 'serviceLog',
    MEDICAL_EXAMS: 'medicalExams',
    // ── Multi-company & User Management ──
    USERS: 'users',
    COMPANIES: 'companies',
    SISTEMATIZACIJE: 'sistematizacije',
    // ── Enterprise modules ──
    VEHICLES: 'vehicles',
    VEHICLE_ASSIGNMENTS: 'vehicleAssignments',
    TRAVEL_ORDERS: 'travelOrders',
    FIRE_EXTINGUISHERS: 'fireExtinguishers',
    HYDRANTS: 'hydrants',
    EVACUATION_PLANS: 'evacuationPlans',
    EVACUATION_DRILLS: 'evacuationDrills',
    ZAPISNICI: 'zapisnici',
    SAFETY_OBSERVATIONS: 'safety_observations',
};

// ── getAll — returns cached data (synchronous, instant) ──
export function getAll(collection) {
    return [...(_cache[collection] || [])];
}

// ── getRawAll — same as getAll now (cache is already company-scoped) ──
export function getRawAll(collection) {
    return [...(_cache[collection] || [])];
}

// Deduplicate a collection in cache (and persist)
export function deduplicateCollection(collection, field = 'naziv') {
    const items = _cache[collection] || [];
    const seen = new Set();
    const deduped = items.filter(item => {
        const key = (item[field] || '').toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    if (deduped.length !== items.length) {
        // Delete duplicates from Firestore
        const removedIds = items.filter(i => !deduped.includes(i)).map(i => i.id);
        removedIds.forEach(id => _firestoreDelete(collection, id));
        _cache[collection] = deduped;
        console.log(`[dataStore] Deduped ${collection}: removed ${items.length - deduped.length} duplicates`);
    }
    return deduped;
}

// Get all records filtered by companyId (explicit version)
export function getAllForCompany(collection, companyId, userCompanyIds = []) {
    // In the new architecture, cache is already company-scoped
    // This function exists for backward compatibility
    return getAll(collection);
}

// Create with explicit company
export function createForCompany(collection, data, companyId) {
    return create(collection, { ...data, companyId: companyId || _getActiveCompanyId() });
}

// ── Migration helpers (kept for backward compat, no-ops now) ──
export function migrateDataToCompany(targetCompanyId) { return 0; }
export function seedCompanyData(newCompanyId, sourceCompanyId) { return 0; }

// ── User helpers ──
export function findUserByUsername(username) {
    return (_cache['users'] || []).find(u => u.username === username || u.email === username) || null;
}

export function getUserCompanies(userId) {
    const user = getById(COLLECTIONS.USERS, userId);
    if (!user) return [];
    if (user.role === 'admin' || user.role === 'superadmin') return _cache['companies'] || [];
    return (_cache['companies'] || []).filter(c => (user.companyIds || []).includes(c.id));
}

export function getAllUsers() { return _cache['users'] || []; }
export function getAllCompanies() { return _cache['companies'] || []; }

// ============================================================================
// SEED DATA — No longer auto-seeded on module load
// Kept as export for reference and initial setup
// ============================================================================

export const SEED_DATA = {};

let isInitialized = false;

export function initializeData() {
    // No-op in Firestore mode — data is loaded via loadCompanyData()
    if (isInitialized) return;
    isInitialized = true;
}

// ============================================================================
// HELPER — resolve relations (all read from cache)
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

// ============================================================================
// SEED FUNCTIONS — No-ops in Firestore mode (data is in Firestore already)
// ============================================================================

export function seedDefaultData() { }
export function seedFleetData() { }

// ============================================================================
// FIRESTORE WRITE OPERATIONS (background, non-blocking)
// ============================================================================

async function _firestoreWrite(colName, item) {
    const ref = _getDocRef(colName, item.id);
    if (!ref) {
        console.warn(`[dataStore] ⚠️ No doc ref for ${colName}/${item.id} — is a company selected?`);
        if (typeof window !== 'undefined') alert(`Neuspjelo spremanje (${colName}). Niste odabrali kompaniju!`);
        return;
    }
    try {
        const { id, ...dataWithoutId } = item;
        // Sanitize: remove undefined values (Firestore rejects them)
        const clean = JSON.parse(JSON.stringify(dataWithoutId));
        await setDoc(ref, clean, { merge: true });
    } catch (err) {
        console.error(`[dataStore] ❌ Write failed ${colName}/${item.id}:`, err.message);
        if (typeof window !== 'undefined') {
            alert(`Sistemska greška: Promjene nisu spremljene na server! (${err.message})`);
        }
    }
}

async function _firestoreDelete(colName, docId) {
    const ref = _getDocRef(colName, docId);
    if (!ref) return;
    try {
        await deleteDoc(ref);
    } catch (err) {
        console.error(`[dataStore] ❌ Delete failed ${colName}/${docId}:`, err.message);
    }
}
