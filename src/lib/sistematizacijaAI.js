import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

export async function apiGenerateSistematizacija(data) {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callableSist = httpsCallable(functions, 'generateSistematizacija');
        const res = await callableSist(data);
        const result = res.data;
        if (!result.success || !result.sistematizacija) throw new Error(result.error || 'Nepoznata greška pri generiranju.');
        return { data: result.sistematizacija };
    } catch (err) {
        console.error('Failed to generate systematization:', err);
        return { error: err.message || 'Nepoznata greška.' };
    }
}

export async function apiParseSistematizacija(documentText, workplaceName) {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callable = httpsCallable(functions, 'parseSistematizacija');
        const res = await callable({ documentText, workplaceName });
        const result = res.data;
        if (!result.success || !result.sistematizacija) throw new Error(result.error || 'Neuspjelo parsiranje dokumenta.');
        return { data: result.sistematizacija };
    } catch (err) {
        console.error('Failed to parse systematization:', err);
        return { error: err.message };
    }
}
