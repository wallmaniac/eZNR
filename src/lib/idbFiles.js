'use client';

// ============================================================================
// IndexedDB File Storage — for large binary files (PDFs, DOCX, images)
// Replaces base64-in-localStorage for any module needing file attachments.
// localStorage stores only metadata + idbKey reference.
// ============================================================================

const DB_NAME    = 'eznr_files';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB not available')); return; }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            e.target.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess  = (e) => resolve(e.target.result);
        req.onerror    = (e) => reject(e.target.error);
    });
}

/** Save a Blob/File to IndexedDB under the given key. */
export async function idbSaveFile(key, blob) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).put(blob, key);
        tx.oncomplete = () => resolve(key);
        tx.onerror    = (e) => reject(e.target.error);
    });
}

/** Retrieve a Blob from IndexedDB by key. Returns null if not found. */
export async function idbGetFile(key) {
    if (!key) return null;
    try {
        const db = await openDB();
        return await new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = (e) => resolve(e.target.result || null);
            req.onerror   = (e) => reject(e.target.error);
        });
    } catch { return null; }
}

/** Delete a file from IndexedDB by key. */
export async function idbDeleteFile(key) {
    if (!key) return;
    try {
        const db = await openDB();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = resolve;
            tx.onerror    = (e) => reject(e.target.error);
        });
    } catch { /* ignore */ }
}

/** Trigger a browser download of a stored file. */
export async function idbDownloadFile(key, filename) {
    const blob = await idbGetFile(key);
    if (!blob) throw new Error('File not found in storage');
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename || key; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Open/preview a stored file in a new browser tab. */
export async function idbOpenFile(key) {
    const blob = await idbGetFile(key);
    if (!blob) throw new Error('File not found in storage');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Generate a unique IDB file key for a module + record. */
export function idbKey(module, recordId) {
    return `${module}_${recordId}_${Date.now()}`;
}
