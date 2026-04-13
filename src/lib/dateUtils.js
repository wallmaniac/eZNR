/**
 * dateUtils.js — Locale-independent date formatting for eZNR
 * Always outputs DD.MM.YYYY. format regardless of browser or OS locale.
 * Data is always stored as ISO YYYY-MM-DD internally.
 */

/**
 * Format an ISO date string (or Date object) to DD.MM.YYYY. (European format).
 * Works identically on Chrome/Firefox/Safari regardless of OS locale.
 * @param {string|Date|null} d - ISO date string like "2024-06-27" or Date object
 * @returns {string} e.g. "27.06.1971." or "" if empty
 */
export function fmtDate(d) {
    if (!d) return '';
    // Parse carefully: "2024-06-27" → avoid timezone mismatch by splitting manually
    let date;
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split('-').map(Number);
        date = new Date(y, m - 1, day); // local time, no TZ offset
    } else {
        date = new Date(d);
    }
    if (isNaN(date)) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}.`;
}

/**
 * Format an ISO date string to DD.MM.YYYY (without trailing dot) — for compact display.
 */
export function fmtDateShort(d) {
    if (!d) return '';
    const formatted = fmtDate(d);
    return formatted.endsWith('.') ? formatted.slice(0, -1) : formatted;
}

/**
 * Convert a search string that may contain dd.mm.yyyy or dd/mm/yyyy
 * to include also the ISO yyyy-mm-dd equivalent, enabling date search.
 *
 * Returns an array of strings that should all be tested against the target.
 * @param {string} query
 * @returns {string[]} array of normalized search tokens including ISO if a date was detected
 */
export function normalizeDateSearch(query) {
    if (!query) return [];
    const q = query.trim();
    // Try dd.mm.yyyy or dd/mm/yyyy
    const m = q.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        return [q, `${yyyy}-${mm}-${dd}`];
    }
    // Try dd.mm (partial — just day and month)
    const m2 = q.match(/^(\d{1,2})[./](\d{1,2})$/);
    if (m2) {
        const dd = m2[1].padStart(2, '0');
        const mm = m2[2].padStart(2, '0');
        return [q, `${mm}-${dd}`, `-${mm}-${dd}`];
    }
    return [q];
}

/**
 * Check if a string value matches a search query, handling date format conversion.
 * @param {string} fieldsStr - concatenated searchable fields
 * @param {string} query
 * @returns {boolean}
 */
export function matchesSearch(fieldsStr, query) {
    if (!query) return true;
    const haystack = fieldsStr.toLowerCase();
    const tokens = normalizeDateSearch(query.toLowerCase());
    return tokens.some(t => haystack.includes(t));
}
