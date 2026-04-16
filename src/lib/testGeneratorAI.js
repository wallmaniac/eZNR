// src/lib/testGeneratorAI.js
import { callFirebaseFunction } from '@/lib/firebaseCallable';

export const apiExtractQuestionsFromDocument = async (payload) => {
    try {
        const data = await callFirebaseFunction('generateFromDocument', payload);
        if (!data.success || !Array.isArray(data.result)) {
            throw new Error(data.error || 'Nepoznata greška pri ekstrakciji pitanja');
        }
        return data.result;
    } catch (firebaseError) {
        throw new Error(firebaseError.message || 'Nepoznata greška pri ekstrakciji pitanja');
    }
};
