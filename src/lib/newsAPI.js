// src/lib/newsAPI.js
import { callFirebaseFunction } from '@/lib/firebaseCallable';

/**
 * Fetch latest occupational safety news from the API, optionally forcing a fresh fetch.
 * Returns { news, source, nextRefresh }
 */
export const apiFetchNews = async (force = false) => {
    try {
        const res = await callFirebaseFunction('news', { force });
        return res;
    } catch (error) {
        throw new Error(`News API error: ${error.message}`);
    }
};
