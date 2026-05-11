// src/lib/newsAPI.js

/**
 * Fetch latest occupational safety news from the API, optionally forcing a fresh fetch.
 * @param {boolean} force  — bypass 2h server cache
 * @param {string}  country — jurisdiction code: 'BA' | 'HR' (default 'BA')
 * Returns { news, source, nextRefresh }
 */
export const apiFetchNews = async (force = false, country = 'BA') => {
    try {
        const response = await fetch('/api/news', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ force, country }),
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        throw new Error(`News API error: ${error.message}`);
    }
};
