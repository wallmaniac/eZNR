// src/lib/trainingsAI.js
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';
 * trainingsAI.js — Library bridge for AI & parser endpoints within the Trainings module.
 * 
 * Extracts API logic from the UI (trainings/page.js) to improve maintainability.
 */

/**
 * Sends slide content to securely generate an automated quiz via Gemini.
 * @param {Array<{naslov: string, sadrzaj: string}>} slides 
 * @returns {Promise<{questions: Array, error?: string}>}
 */
export async function apiGenerateQuiz(slides) {
    try {
        const payload = slides.map(s => ({ naslov: s.naslov || '', sadrzaj: s.sadrzaj || '' }));
        const functions = getFunctions(app, 'europe-west1');
        const callableGenerateQuiz = httpsCallable(functions, 'generateQuiz');
        const res = await callableGenerateQuiz({ slides: payload });
        return res.data; 
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

        const functions = getFunctions(app, 'europe-west1');
        const callable = httpsCallable(functions, 'parsePresentation');
        const res = await callable({ base64Data, filename: file.name });
        
        const data = res.data;
        if (data.error) throw new Error(data.error);

        return data;
    } catch (err) {
        console.error('[trainingsAI] apiParsePresentation error:', err);
        return { error: err.message };
    }
}
