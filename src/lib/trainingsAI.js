/**
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
        const res = await fetch('/api/generate-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slides: payload }),
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Network response was not ok');
        }

        return data; 
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
        const fd = new FormData();
        fd.append('file', file);

        const res = await fetch('/api/parse-presentation', { 
            method: 'POST', 
            body: fd 
        });

        const data = await res.json();
        
        if (!res.ok || data.error) {
            throw new Error(data.error || 'Error parsing document');
        }

        return data;
    } catch (err) {
        console.error('[trainingsAI] apiParsePresentation error:', err);
        return { error: err.message };
    }
}
