// src/lib/newsAPI.js

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

/**
 * Fetch latest occupational safety news from the API, optionally forcing a fresh fetch.
 * Returns { news, source, nextRefresh }
 */
export const apiFetchNews = async (force = false) => {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callableNews = httpsCallable(functions, 'news');
        const res = await callableNews({ force });
        return res.data;
    } catch (error) {
        throw new Error(`News API error: ${error.message}`);
    }
};
