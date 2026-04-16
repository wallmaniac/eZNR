// src/lib/converterAPI.js
import { callFirebaseFunction } from '@/lib/firebaseCallable';

/**
 * Sends a PDF file to the server for parsing with MuPDF
 * @param {string} base64Data - base64 encoded file content
 * @param {string} filename - original filename
 * @returns {Promise<Object>} The parsed PDF pages data
 */
export const apiParsePdf = async (base64Data, filename) => {
    try {
        const res = await callFirebaseFunction('pdfParse', { base64Data, filename });
        return res;
    } catch (firebaseError) {
        throw new Error(firebaseError.message || `Parse failed`);
    }
};
