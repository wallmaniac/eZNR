// src/lib/newsAPI.js
import { callFirebaseFunction } from '@/lib/firebaseCallable';

/**
 * Fetch latest occupational safety news from the API, optionally forcing a fresh fetch.
 * @param {boolean} force  — bypass 2h server cache
 * @param {string}  country — jurisdiction code: 'BA' | 'HR' (default 'BA')
 * Returns { news, source, nextRefresh }
 */
export const apiFetchNews = async (force = false, country = 'BA') => {
    try {
        const res = await callFirebaseFunction('news', { force, country });
        return res;
    } catch (error) {
        throw new Error(`News API error: ${error.message}`);
    }
};
