import { NextResponse } from 'next/server';

// ── Server-side cache: 2h ─────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Models that support google_search grounding (billing required, same key as Zia)
// Use base model names (not versioned -001) for grounding support
const GROUNDED_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash'];
// Fallback without grounding — these work for sure (same as Zia)
const PLAIN_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-001'];

const SYSTEM = `Si ekspert za zaštitu na radu u Bosni i Hercegovini koji radi za aplikaciju eZNR.`;

const PROMPT = `Pretraži web i pronađi 6-8 aktuelnih vijesti ili informacija o zaštiti na radu u Bosni i Hercegovini za 2025-2026. 

Uključi samo vijesti iz 2024, 2025 ili 2026. Fokusiraj se na:
- Izmjene Zakona o zaštiti na radu u FBiH (Sl. novine FBiH) ili RS (Sl. glasnik RS)
- Aktivnosti Federalne inspekcije rada ili Inspektorata RS
- Nove pravilnike, uredbe, smjernice
- EU harmonizacija propisa o ZNR u okviru BiH pristupa EU
- Obaveze poslodavaca, rokovi, kazne

Vrati ISKLJUČIVO validan JSON niz (bez Markdown fences, bez ikakvih komentara):
[
  {
    "naslov": "Naslov na bosanskom",
    "opis": "Opis od 2-3 rečenice s konkretnim informacijama i datumima.",
    "tip": "zakon",
    "datum": "07.03.2026.",
    "izvor": "Naziv izvora",
    "url": "https://..."
  }
]
Tipovi: zakon | pravilnik | inspekcija | edukacija | rok | obavijest | smjernice
Samo JSON, ništa drugo.`;

async function callGrounded(apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
            tools: [{ google_search: {} }],   // ← Real-time Google Search
            generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
        }),
        signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errBody.substring(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const grounding = data.candidates?.[0]?.groundingMetadata;
    const sources = grounding?.groundingChunks
        ?.map(c => c.web?.uri).filter(Boolean).slice(0, 5) || [];

    return { text, sources, grounded: true };
}

async function callPlain(apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: PROMPT.replace('Pretraži web i pronađi', 'Generiraj na osnovu znanja') }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
        }),
        signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || '', sources: [], grounded: false };
}

function parseNews(text) {
    const clean = text
        .replace(/^```json\s*/im, '').replace(/```\s*$/im, '')
        .replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
    return arr.filter(x => x.naslov && x.opis);
}

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

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let lastErr = null;

    // 1. Try Google Search grounding (requires billing — should work with your key)
    for (const model of GROUNDED_MODELS) {
        try {
            const { text, sources, grounded } = await callGrounded(apiKey, model);
            const news = parseNews(text);
            const payload = { news, sources, grounded, source: 'gemini+search', cached: false, model };
            cache = { data: payload, ts: Date.now() };
            return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
        } catch (err) {
            lastErr = err;
            console.error(`[news] grounded ${model} failed:`, err.message);
        }
    }

    // 2. Fallback: Gemini without grounding (always works)
    for (const model of PLAIN_MODELS) {
        try {
            const { text, sources, grounded } = await callPlain(apiKey, model);
            const news = parseNews(text);
            const payload = { news, sources, grounded, source: 'gemini', cached: false, model, warning: 'grounding_unavailable' };
            cache = { data: payload, ts: Date.now() };
            return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
        } catch (err) {
            lastErr = err;
            console.error(`[news] plain ${model} failed:`, err.message);
        }
    }

    return NextResponse.json({ error: lastErr?.message || 'all_models_failed' }, { status: 502 });
}
