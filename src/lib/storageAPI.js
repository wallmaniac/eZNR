import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadDocument(file, companyId, folder = 'documents', onProgress) {
    if (!file || !companyId) throw new Error('File and companyId are required');
    if (typeof window === 'undefined') throw new Error('Storage can only run on the client');
    
    // Create a safe, unique filename
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniquePath = `companies/${companyId}/${folder}/${Date.now()}_${safeName}`;
    
    const storageRef = ref(storage, uniquePath);
    
    // Convert base64 string back to blob if necessary
    let fileBlob = file;
    if (typeof file === 'string' && file.startsWith('data:')) {
        const response = await fetch(file);
        fileBlob = await response.blob();
    }
    
    // Upload the blob/file
    onProgress?.('Uploading to Firebase Storage...');
    const snapshot = await uploadBytes(storageRef, fileBlob);
    
    // Get the generic public download URL
    onProgress?.('Generating public link...');
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return {
        url: downloadURL,
        path: uniquePath,
        name: file.name || safeName,
        size: fileBlob.size,
        type: fileBlob.type
    };
}

export async function deleteDocument(storagePath) {
    if (!storagePath) return;
    try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
    } catch (e) {
        console.warn('Failed to delete storage file (may not exist):', e.message);
    }
}
