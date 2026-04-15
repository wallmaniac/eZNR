// src/lib/newsAPI.js

/**
 * Fetch latest occupational safety news from the API, optionally forcing a fresh fetch.
 * Returns { news, source, nextRefresh }
 */
export const apiFetchNews = async (force = false) => {
    const url = `/api/news${force ? '?force=1' : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`News API error: ${res.status}`);
    }
    return await res.json();
};
