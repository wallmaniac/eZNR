import { NextResponse } from 'next/server';

// ── Server-side cache: 2h (news is fresh, not stale AI guesses) ──────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

// Models that support Google Search grounding
// https://ai.google.dev/gemini-api/docs/grounding
const GROUNDED_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-001'];
const FALLBACK_MODELS = ['gemini-1.5-flash']; // no grounding, but still works

const SEARCH_QUERY = 'zaštita na radu Bosna Hercegovina zakoni propisi 2025 2026';

const SYSTEM_PROMPT = `Ti si asistent za aplikaciju eZNR (elektronska Zaštita Na Radu) koja se koristi u Bosni i Hercegovini.`;

const USER_PROMPT = `Pronađi i sumiraj 6 aktuelnih vijesti/informacija o zaštiti na radu u Bosni i Hercegovini za 2025-2026. 
Pretraži web za: "${SEARCH_QUERY}"

Fokusiraj se na:
- Izmjene Zakona o zaštiti na radu u FBiH i RS
- Nove pravilnike objavljene u Sl. novinama FBiH ili Sl. glasniku RS
- Aktivnosti Federalne inspekcije rada ili Inspektorata RS
- EU harmonizacija propisa o zaštiti na radu u okviru pristupnog procesa
- Važni rokovi i obaveze za poslodavce u 2025/2026

Vrati ISKLJUČIVO validan JSON niz, bez ikakvih Markdown oznaka, komentara ili teksta izvan JSON-a:
[
  {
    "naslov": "Naslov na bosanskom jeziku",
    "opis": "Detaljan opis od 2-3 rečenice sa konkretnim podacima, brojevima glasnika, datumima primjene.",
    "tip": "zakon",
    "datum": "07.03.2026.",
    "izvor": "Naziv web izvora (npr. sllist.ba, vladars.net, ...)",
    "url": "https://..."
  }
]

Tipovi: zakon | pravilnik | inspekcija | edukacija | rok | obavijest | smjernice
Ako pronađeš URL javnog dokumenta ili vijesti, uključi ga. Ne izmišljaj vijesti — koristi samo ono što si pronašao na webu.`;

async function callGeminiGrounded(apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: USER_PROMPT }] }],
        tools: [{ google_search: {} }],           // ← real-time Google Search grounding
        generationConfig: {
            temperature: 0.1,                       // low temp = more factual
            maxOutputTokens: 3000,
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${err.substring(0, 120)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract grounding sources if present
    const groundingChunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
        .map(c => c.web?.uri || c.web?.title)
        .filter(Boolean)
        .slice(0, 5);

    return { text, sources };
}

async function callGeminiFallback(apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: USER_PROMPT }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
        }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || '', sources: [] };
}

function parseJSON(text) {
    // Strip markdown code fences if any
    const clean = text
        .replace(/^```json\s*/im, '')
        .replace(/^```\s*/im, '')
        .replace(/```\s*$/im, '')
        .trim();
    // Find the JSON array even if wrapped in extra text
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array found in response');
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
    return arr.filter(item => item.naslov && item.opis);
}

export async function GET(request) {
    const force = request.nextUrl?.searchParams?.get('force') === '1';

    // Serve from server cache if fresh and not forced
    if (!force && cache.data && Date.now() - cache.ts < CACHE_TTL) {
        return NextResponse.json({
            news: cache.data.news,
            sources: cache.data.sources,
            grounded: cache.data.grounded,
            cached: true,
            cacheAge: Math.floor((Date.now() - cache.ts) / 60000),
            nextRefresh: Math.ceil((CACHE_TTL - (Date.now() - cache.ts)) / 60000),
        }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let lastErr = null;
    let grounded = false;

    // Try grounded models first (real-time Google Search)
    for (const model of GROUNDED_MODELS) {
        try {
            const { text, sources } = await callGeminiGrounded(apiKey, model);
            const news = parseJSON(text);
            cache = { data: { news, sources, grounded: true }, ts: Date.now() };
            return NextResponse.json({ news, sources, grounded: true, cached: false, model });
        } catch (err) {
            lastErr = err;
        }
    }

    // Fallback to non-grounded models (still smart, but no live search)
    for (const model of FALLBACK_MODELS) {
        try {
            const { text, sources } = await callGeminiFallback(apiKey, model);
            const news = parseJSON(text);
            cache = { data: { news, sources, grounded: false }, ts: Date.now() };
            return NextResponse.json({ news, sources, grounded: false, cached: false, model, warning: 'grounding_unavailable' });
        } catch (err) {
            lastErr = err;
        }
    }

    return NextResponse.json({ error: lastErr?.message || 'fetch_failed' }, { status: 502 });
}
