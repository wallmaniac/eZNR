// src/lib/trainingsAI.js
import { callFirebaseFunction } from '@/lib/firebaseCallable';

/**
 * trainingsAI.js — Library bridge for AI & parser endpoints within the Trainings module.
 * Uses server-side proxy to avoid Firebase CORS/IAM issues.
 */

/**
 * Sends slide content to securely generate an automated quiz via Gemini.
 * @param {Array<{naslov: string, sadrzaj: string}>} slides 
 * @returns {Promise<{questions: Array, error?: string}>}
 */
export async function apiGenerateQuiz(slides) {
    try {
        const payload = slides.map(s => ({ naslov: s.naslov || '', sadrzaj: s.sadrzaj || '' }));
        const res = await callFirebaseFunction('generateQuiz', { slides: payload });
        return res;
    } catch (err) {
        console.error('[trainingsAI] apiGenerateQuiz error:', err);
        return { error: err.message };
    }
}

/**
 * Uploads a Presentation (PDF or PPTX) to be parsed into eZNR slide format.
 * @param {File} file 
 * @returns {Promise<{slides: Array, count: number, source: string, error?: string}>}
 */
export async function apiParsePresentation(file) {
    try {
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const data = await callFirebaseFunction('parsePresentation', { base64Data, filename: file.name });
        if (data.error) throw new Error(data.error);
        return data;
    } catch (err) {
        console.error('[trainingsAI] apiParsePresentation error:', err);
        return { error: err.message };
    }
}
