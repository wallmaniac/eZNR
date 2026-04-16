import { callFirebaseFunction } from '@/lib/firebaseCallable';

export async function apiGenerateSistematizacija(data) {
    try {
        const result = await callFirebaseFunction('generateSistematizacija', data);
        if (!result.success || !result.sistematizacija) throw new Error(result.error || 'Nepoznata greška pri generiranju.');
        return { data: result.sistematizacija };
    } catch (err) {
        console.error('Failed to generate systematization:', err);
        return { error: err.message || 'Nepoznata greška.' };
    }
}

export async function apiParseSistematizacija(documentText, workplaceName) {
    try {
        const result = await callFirebaseFunction('parseSistematizacija', { documentText, workplaceName });
        if (!result.success || !result.sistematizacija) throw new Error(result.error || 'Neuspjelo parsiranje dokumenta.');
        return { data: result.sistematizacija };
    } catch (err) {
        console.error('Failed to parse systematization:', err);
        return { error: err.message };
    }
}
