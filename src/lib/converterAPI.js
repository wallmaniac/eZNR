// src/lib/converterAPI.js
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

/**
 * Sends a PDF file to the server for parsing with MuPDF
 * @param {FormData} formData - The form data containing the file
 * @returns {Promise<Object>} The parsed PDF pages data
 */
export const apiParsePdf = async (base64Data, filename) => {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callable = httpsCallable(functions, 'pdfParse');
        const res = await callable({ base64Data, filename });
        return res.data;
    } catch (firebaseError) {
        throw new Error(firebaseError.message || `Parse failed`);
    }
};
