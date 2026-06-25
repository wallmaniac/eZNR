// Shared text-matching utilities for eZNR
// Used by: Digitalna Arhiva (scan matching) and Zapisnici (name correction)

// ── Levenshtein distance ──────────────────────────────────────────────────────
export function levenshtein(a, b) {
    a = (a || '').toLowerCase();
    b = (b || '').toLowerCase();
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

// 0 (no match) → 1 (identical)
export function similarity(a, b) {
    const maxLen = Math.max((a || '').length, (b || '').length);
    if (!maxLen) return 1;
    return 1 - levenshtein(a, b) / maxLen;
}

// Normalise Bosnian/Croatian diacritics for matching
export function normalizeName(s) {
    return (s || '')
        .toLowerCase()
        .replace(/[čć]/g, 'c')
        .replace(/[šs]/g, 's')
        .replace(/[žz]/g, 'z')
        .replace(/đ/g, 'd')
        .trim();
}

// ── Worker matching ────────────────────────────────────────────────────────────
/**
 * matchWorkers — fuzzy-match a query name (+optional dob) against a list of workers.
 * @param {string} queryName  - name as typed/read from document
 * @param {string} queryDob   - date of birth string (any format, optional)
 * @param {Array}  workers    - array of worker objects from dataStore
 * @returns Array sorted by score DESC, each item: { worker, score, nameScore, dobMatch }
 */
export function matchWorkers(queryName, queryDob, workers) {
    const normQ = normalizeName(queryName);
    // Cheap date digits extraction for rough dob match
    const dobDigits = (queryDob || '').replace(/\D/g, '');

    return workers
        .map(w => {
            const fullName = `${w.ime || ''} ${w.prezime || ''}`.trim();
            const fullNameRev = `${w.prezime || ''} ${w.ime || ''}`.trim(); // some docs have surname first
            const normFull = normalizeName(fullName);
            const normRev = normalizeName(fullNameRev);

            const nameScore = Math.max(
                similarity(normQ, normFull),
                similarity(normQ, normRev),
                // Also try partial first-name / surname match
                similarity(normQ, normalizeName(w.ime || '')),
                similarity(normQ, normalizeName(w.prezime || '')),
            );

            // DOB bonus
            let dobMatch = false;
            const wDob = w.datumRodenja || w.datumRodjenja || '';
            if (dobDigits && wDob) {
                const wDobDigits = wDob.replace(/\D/g, '');
                // JMBG starts with dob digits too
                const jmbgDob = (w.jmbg || '').substring(0, 7);
                dobMatch = wDobDigits.includes(dobDigits) || dobDigits.includes(wDobDigits) ||
                    jmbgDob.startsWith(dobDigits.substring(0, 6)) ||
                    wDob.replace(/-/g, '').includes(dobDigits);
            }

            const score = nameScore + (dobMatch ? 0.25 : 0);
            return { worker: w, score: Math.min(score, 1.0), nameScore, dobMatch };
        })
        .filter(x => x.score > 0.3)               // discard very poor matches
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);                               // top 5
}

// Confidence label from score
export function confidenceLabel(score) {
    if (score >= 0.85) return { emoji: '🟢', label: `${Math.round(score * 100)}%`, color: 'var(--success)' };
    if (score >= 0.55) return { emoji: '🟡', label: `${Math.round(score * 100)}%`, color: 'var(--warning)' };
    return { emoji: '🔴', label: `${Math.round(score * 100)}%`, color: 'var(--danger)' };
}

// ── Name token extraction from document text ──────────────────────────────────
// Finds sequences of 2-3 capitalized words (handles Bosnian/Croatian diacritics)
const STOP_WORDS = new Set([
    'republika', 'federacija', 'bosna', 'hercegovina', 'bosne', 'a', 'i', 'ili', 'je',
    'su', 'se', 'za', 'na', 'od', 'do', 'sa', 'u', 'o', 'iz', 'po', 'pri', 'te',
    'da', 'ne', 'ali', 'to', 'koji', 'koja', 'koje', 'što', 'ako', 'kao', 'broj',
    'datum', 'zaštita', 'radu', 'uvjerenje', 'zapisnik', 'radnik', 'radnici',
    'ime', 'prezime', 'jmbg', 'oib', 'potpis', 'mjesto', 'grad', 'ulica',
    'certifikat', 'osposobljenost', 'znanje', 'provjera', 'obuka', 'osoba',
    'komisija', 'predsednik', 'predsjedavajuci', 'clan', 'clanovi',
    'direktor', 'director', 'manager', 'lista', 'redni', 'prezimena',
]);

export function extractNameTokens(text) {
    if (!text) return [];
    // Split into lines for context
    const lines = text.split(/\n|\r/);
    const found = [];
    const seen = new Set();

    // Pattern: 2-3 consecutive words starting with uppercase (including Bosnian chars)
    const CAP_WORD = '[A-ZČĆĐŠŽA-ЯLjNjĆĐDžJIEa-z][a-zčćđšža-яA-Z]*';
    const pattern = new RegExp(`(${CAP_WORD}(?:\\s+${CAP_WORD}){1,2})`, 'g');

    for (const line of lines) {
        let m;
        while ((m = pattern.exec(line)) !== null) {
            const token = m[1].trim();
            const words = token.split(/\s+/);
            // All words must start uppercase
            if (!words.every(w => /^[A-ZČĆĐŠŽLjnjćđ]/.test(w))) continue;
            // No stop words
            if (words.some(w => STOP_WORDS.has(w.toLowerCase()))) continue;
            // Min 2 chars per word
            if (words.some(w => w.length < 2)) continue;
            const key = token.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                found.push({ original: token, line: line.trim() });
            }
        }
    }
    return found;
}
