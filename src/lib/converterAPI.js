// src/lib/converterAPI.js

/**
 * Sends a PDF file to the server for parsing with MuPDF
 * @param {FormData} formData - The form data containing the file
 * @returns {Promise<Object>} The parsed PDF pages data
 */
export const apiParsePdf = async (formData) => {
    const resp = await fetch('/api/pdf-parse', { method: 'POST', body: formData });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Parse failed: ${resp.status}`);
    }
    return await resp.json();
};
