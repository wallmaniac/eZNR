// src/lib/testGeneratorAI.js
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

export const apiExtractQuestionsFromDocument = async (payload) => {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callable = httpsCallable(functions, 'generateFromDocument');
        const res = await callable(payload);
        const data = res.data;
        if (!data.success || !Array.isArray(data.result)) {
            throw new Error(data.error || 'Nepoznata greška pri ekstrakciji pitanja');
        }
        return data.result;
    } catch (firebaseError) {
        throw new Error(firebaseError.message || 'Nepoznata greška pri ekstrakciji pitanja');
    }
};
