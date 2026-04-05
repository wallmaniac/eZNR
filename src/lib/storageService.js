// ============================================================================
// FIREBASE STORAGE SERVICE
// Handles file uploads/deletions for fleet documents (and future modules).
// Files are stored publicly readable at:
//   fleet-documents/{vehicleId}/{timestamp}_{filename}
// ============================================================================

import { storage } from './firebase';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
} from 'firebase/storage';

/**
 * Upload a file for a vehicle document.
 * @param {File} file - The file object from an <input type="file">
 * @param {string} vehicleId - The vehicle's ID (for path scoping)
 * @param {Function} onProgress - Optional callback(percent: number)
 * @returns {Promise<{ url: string, storagePath: string }>}
 */
export async function uploadFleetDocument(file, vehicleId, onProgress) {
    if (!file || !vehicleId) throw new Error('File and vehicleId are required.');

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `fleet-documents/${vehicleId}/${timestamp}_${safeName}`;

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const percent = Math.round(
                    (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                );
                onProgress?.(percent);
            },
            (error) => {
                console.error('[Storage] Upload failed:', error);
                reject(error);
            },
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({ url, storagePath });
            }
        );
    });
}

/**
 * Delete a file from Firebase Storage.
 * @param {string} storagePath - The path returned by uploadFleetDocument
 * @returns {Promise<void>}
 */
export async function deleteFleetDocument(storagePath) {
    if (!storagePath) return;
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
    } catch (err) {
        // File may already be deleted or path invalid — log and continue
        console.warn('[Storage] Delete failed (non-fatal):', err?.code, storagePath);
    }
}
