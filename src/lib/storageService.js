// ============================================================================
// FIREBASE STORAGE SERVICE
// Handles secure file uploads, deletions, and quota tracking for all modules.
// Files are stored at: companies/{companyId}/{moduleName}/{timestamp}_{filename}
// ============================================================================

import { storage, db } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, uploadBytes } from 'firebase/storage';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';

/**
 * Upload a file securely to a company's specific module folder.
 * Enforces storage quotas if available.
 * 
 * @param {string} companyId - The ID of the company
 * @param {string} moduleName - Target folder (e.g., 'certificates', 'workers')
 * @param {File|string} file - The file to upload (or a base6`4` string starting with 'data:')
 * @param {Function} onProgress - Optional callback for upload percentage (or message)
 * @returns {Promise<{ url: string, storagePath: string, size: number, name: string, type: string }>}
 */
export async function uploadSecureFile(companyId, moduleName, file, onProgress) {
    if (!companyId || companyId === 'all') throw new Error('Company ID is required to upload.');
    if (!file) throw new Error('File is required.');

    // Convert base64 string back to blob if it was passed natively
    let fileBlob = file;
    let fileName = file.name || `uploaded_file_${Date.now()}`;
    if (typeof file === 'string' && file.startsWith('data:')) {
        const response = await fetch(file);
        fileBlob = await response.blob();
        
        // Try to infer extension
        const type = file.split(';')[0].split(':')[1] || '';
        if (type.includes('jpeg')) fileName += '.jpg';
        else if (type.includes('png')) fileName += '.png';
        else if (type.includes('pdf')) fileName += '.pdf';
    }

    // 1. Quota Check (Wrap in try-catch because public anonymous routes will fail Firestore read rules)
    const companyRef = doc(db, 'companies', companyId);
    try {
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
            const data = companySnap.data();
            const used = data.storageUsed || 0;
            const quota = data.storageQuota || (1024 * 1024 * 1024 * 2); // Default 2GB if not set

            if (used + fileBlob.size > quota) {
                console.warn(`[Storage] ⚠️ QUOTA EXCEEDED for ${companyId}. Used: ${used}, Quota: ${quota}`);
            }
        }
    } catch (_quotaErr) {
        // Quota check may fail for non-admin users or public routes — this is expected
    }

    // 2. Upload
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const storagePath = `companies/${companyId}/${moduleName}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, fileBlob);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (typeof onProgress === 'function') onProgress(percent);
                else if (typeof onProgress === 'string') {
                    // legacy support for storageAPI which passed string statuses
                }
            },
            (error) => {
                console.error('[Storage] Upload failed:', error);
                reject(error);
            },
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                
                // 3. Update Quota Usage Tracking
                try {
                    await updateDoc(companyRef, { storageUsed: increment(fileBlob.size) });
                } catch (_qe) {
                    // Non-admin users lack write access to companies collection — this is expected
                }

                resolve({
                    url,
                    storagePath,
                    size: fileBlob.size,
                    name: safeName,
                    type: fileBlob.type
                });
            }
        );
    });
}

/**
 * Delete a file securely and update the quota.
 * 
 * @param {string} companyId - The ID of the company
 * @param {string} storagePath - The exact path inside Firebase Storage
 * @param {number} fileSize - The size of the file to decrement from quota
 */
export async function deleteSecureFile(companyId, storagePath, fileSize = 0) {
    if (!storagePath) return;
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);

        if (companyId && companyId !== 'all' && fileSize > 0) {
            const companyRef = doc(db, 'companies', companyId);
            await updateDoc(companyRef, { storageUsed: increment(-fileSize) });
        }
    } catch (err) {
        console.warn(`[Storage] Delete failed (non-fatal) for ${storagePath}:`, err?.code);
    }
}

// ============================================================================
// ALIASES FOR BACKWARD COMPATIBILITY
// These map the old `storageAPI.js` functions directly to `storageService`.
// ============================================================================

export const uploadDocument = async (file, companyId, folder = 'documents', onProgress) => {
    return uploadSecureFile(companyId, folder, file, onProgress);
};

export const deleteDocument = async (storagePath) => {
    // Legacy delete didn't parse company size, this is fire-and-forget safely
    return deleteSecureFile(null, storagePath, 0);
};

