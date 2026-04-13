/**
 * dateUtils.js — Locale-independent date & time formatting for eZNR
 *
 * All outputs are deterministic — they produce identical results regardless of:
 * - Browser locale (US, HR, BS, EN...)
 * - OS language settings
 * - Windows locale (no more MM/DD/YYYY or AM/PM surprises)
 *
 * DATE storage format: ISO "YYYY-MM-DD" (strings in localStorage/Firestore)
 * DATETIME storage format: ISO "YYYY-MM-DDTHH:mm:ssZ" (Firestore Timestamps or ISO strings)
 * DISPLAY formats: DD.MM.YYYY. | DD.MM.YYYY. HH:MM | HH:MM
 */

/**
 * Format a date value to DD.MM.YYYY. (European format, deterministic).
 * Handles:
 *   - ISO date string: "2024-06-27"
 *   - ISO datetime string: "2024-06-27T10:30:00Z" (extracts date only, local time)
 *   - Firestore Timestamp object: { toDate() } (auto-called)
 *   - JS Date object
 *   - null/undefined → ""
 *
 * @param {string|Date|Object|null} d
 * @returns {string} e.g. "27.06.2024." or ""
 */
export function fmtDate(d) {
    if (!d) return '';
    // Handle Firestore Timestamp objects (have .toDate() method)
    if (d && typeof d === 'object' && typeof d.toDate === 'function') {
        d = d.toDate();
    }
    let date;
    if (typeof d === 'string') {
        // Pure date: "2024-06-27"  →  parse as LOCAL date (no TZ shift)
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
            const [y, m, day] = d.split('-').map(Number);
            date = new Date(y, m - 1, day);
        } else if (/^\d{4}-\d{2}-\d{2}T/.test(d)) {
            // ISO datetime: "2024-06-27T10:30:00Z" → use as-is (UTC→local auto)
            date = new Date(d);
        } else {
            return '';
        }
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
 * Format a datetime value to "DD.MM.YYYY. HH:MM" (24-hour, deterministic).
 * Works for Firestore Timestamps, ISO datetime strings, and JS Dates.
 *
 * @param {string|Date|Object|null} d
 * @returns {string} e.g. "27.06.2024. 14:35" or ""
 */
export function fmtDateTime(d) {
    if (!d) return '';
    if (d && typeof d === 'object' && typeof d.toDate === 'function') {
        d = d.toDate();
    }
    const date = new Date(d);
    if (isNaN(date)) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const HH = String(date.getHours()).padStart(2, '0');
    const MM = String(date.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy}. ${HH}:${MM}`;
}

/**
 * Format just the time from a datetime value to "HH:MM" (24-hour, deterministic).
 *
 * @param {string|Date|Object|null} d
 * @returns {string} e.g. "14:35" or ""
 */
export function fmtTime(d) {
    if (!d) return '';
    if (d && typeof d === 'object' && typeof d.toDate === 'function') {
        d = d.toDate();
    }
    const date = new Date(d);
    if (isNaN(date)) return '';
    const HH = String(date.getHours()).padStart(2, '0');
    const MM = String(date.getMinutes()).padStart(2, '0');
    return `${HH}:${MM}`;
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
 * @param {string} query
 * @returns {string[]} array of normalized search tokens
 */
export function normalizeDateSearch(query) {
    if (!query) return [];
    const q = query.trim();
    // Full date: dd.mm.yyyy or dd/mm/yyyy
    const m = q.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        return [q, `${yyyy}-${mm}-${dd}`];
    }
    // Partial: dd.mm or dd/mm (day and month only)
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
