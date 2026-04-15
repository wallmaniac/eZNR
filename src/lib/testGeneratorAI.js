// src/lib/testGeneratorAI.js

export const apiExtractQuestionsFromDocument = async (payload) => {
    const res = await fetch('/api/generate-from-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.result)) {
        throw new Error(data.error || 'Nepoznata greška pri ekstrakciji pitanja');
    }
    return data.result;
};
