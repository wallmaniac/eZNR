import { NextResponse } from 'next/server';

// ── Server-side cache: 2h ─────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 2 * 60 * 60 * 1000;

// ── Models that work (same as Zia) ────────────────────────────────────────────
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-001'];

// ── Google News RSS queries (BiH workplace safety) ────────────────────────────
const RSS_QUERIES = [
    'zaštita na radu Bosna Hercegovina',
    'zakon o zaštiti na radu BiH',
    'inspekcija rada FBiH',
];

// ── Type colour mapping guesses from keywords ─────────────────────────────────
function guessType(title = '', desc = '') {
    const text = `${title} ${desc}`.toLowerCase();
    if (text.includes('zakon') || text.includes('zakonod') || text.includes('zakonit')) return 'zakon';
    if (text.includes('pravilnik') || text.includes('uredba') || text.includes('propis')) return 'pravilnik';
    if (text.includes('inspekcij') || text.includes('inspektorat') || text.includes('nadzor')) return 'inspekcija';
    if (text.includes('edukacij') || text.includes('seminar') || text.includes('obuka') || text.includes('trening')) return 'edukacija';
    if (text.includes('rok') || text.includes('deadline') || text.includes('do kraja')) return 'rok';
    if (text.includes('eu') || text.includes('direktiv') || text.includes('harmoniz')) return 'smjernice';
    return 'obavijest';
}

function formatRSSDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') + '.';
    } catch { return ''; }
}

function stripHTML(html = '') {
    return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

// ── Fetch real news from Google News RSS ─────────────────────────────────────
async function fetchRSSNews() {
    const results = [];
    const seen = new Set();

    for (const q of RSS_QUERIES) {
        const encoded = encodeURIComponent(q);
        const url = `https://news.google.com/rss/search?q=${encoded}&hl=bs&gl=BA&ceid=BA:bs`;

        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; eZNR/1.0)' },
                signal: AbortSignal.timeout(6000),
            });
            if (!res.ok) continue;

            const xml = await res.text();

            // Parse <item> elements
            const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
            for (const match of items.slice(0, 4)) {
                const block = match[1];
                const title = stripHTML(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
                const link = (block.match(/<link>([\s\S]*?)<\/link>/) || block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/))?.[1]?.trim() || '';
                const desc = stripHTML(block.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '');
                const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
                const source = stripHTML(block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '');

                if (!title || seen.has(title)) continue;
                seen.add(title);

                results.push({
                    naslov: title,
                    opis: desc || title,
                    tip: guessType(title, desc),
                    datum: formatRSSDate(pubDate),
                    izvor: source || 'Google News',
                    url: link,
                });
            }
        } catch { /* skip failed query */ }
    }

    return results;
}

// ── Gemini fallback (no grounding — same approach as Zia) ─────────────────────
async function fetchGeminiNews(apiKey) {
    const prompt = `Generiraj 6 kratkih vijesti o zaštiti na radu u Bosni i Hercegovini za 2025-2026. Koristi ono što znaš o:
- Zakonu o zaštiti na radu FBiH (Sl. novine FBiH br. 22/02, izmjene)
- Zakonu o zaštiti na radu RS (Sl. glasnik RS br. 1/08, izmjene)
- EU direktivama o zaštiti na radu u okviru BiH pristupnog procesa
- Obavezama poslodavaca, obukama, inspekcijama
Vrati SAMO validan JSON niz, bez Markdown, bez komentara:
[{"naslov":"...","opis":"2-3 rečenice s konkretnim podacima.","tip":"zakon","datum":"DD.MM.YYYY.","izvor":"Sl. novine FBiH","url":""}]
Tipovi: zakon|pravilnik|inspekcija|edukacija|rok|obavijest|smjernice`;

    let lastErr = null;
    for (const model of MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
                }),
                signal: AbortSignal.timeout(20000),
            });
            if (!res.ok) { lastErr = new Error(`Gemini HTTP ${res.status}`); continue; }
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            const match = clean.match(/\[[\s\S]*\]/);
            if (!match) { lastErr = new Error('No JSON array in Gemini response'); continue; }
            const arr = JSON.parse(match[0]);
            if (!Array.isArray(arr) || arr.length === 0) { lastErr = new Error('Empty array'); continue; }
            return { news: arr.filter(x => x.naslov && x.opis), source: 'gemini' };
        } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('All Gemini models failed');
}

// ── GET handler ───────────────────────────────────────────────────────────────
export async function GET(request) {
    const force = request.nextUrl?.searchParams?.get('force') === '1';

    if (!force && cache.data && Date.now() - cache.ts < CACHE_TTL) {
        return NextResponse.json({
            ...cache.data,
            cached: true,
            cacheAge: Math.floor((Date.now() - cache.ts) / 60000),
            nextRefresh: Math.ceil((CACHE_TTL - (Date.now() - cache.ts)) / 60000),
        }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // 1. Try real RSS news first
    try {
        const rssNews = await fetchRSSNews();
        if (rssNews.length >= 2) {
            const payload = { news: rssNews, source: 'rss', grounded: true, cached: false };
            cache = { data: payload, ts: Date.now() };
            return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
        }
    } catch { /* fall through */ }

    // 2. Fallback: Gemini AI (no grounding, uses training knowledge)
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
        try {
            const { news } = await fetchGeminiNews(apiKey);
            const payload = { news, source: 'gemini', grounded: false, cached: false };
            cache = { data: payload, ts: Date.now() };
            return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
        } catch (err) {
            return NextResponse.json({ error: err.message }, { status: 502 });
        }
    }

    return NextResponse.json({ error: 'no_api_key_and_rss_failed' }, { status: 500 });
}
