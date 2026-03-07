import { NextResponse } from 'next/server';

// ── In-memory cache (resets on redeploy, max 6 hours) ──────────────────────
let cachedNews = null;
let cacheTime = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash'];

const NEWS_PROMPT = `Si asistent za aplikaciju eZNR koja se koristi za upravljanje zaštitom na radu u Bosni i Hercegovini.

Generirajte 6 vijesti/informacija o zaštiti na radu u Bosni i Hercegovini, aktuelnih za 2025/2026. Fokusirajte se isključivo na:
- Zakon o zaštiti na radu u Federaciji BiH (Sl. novine FBiH br. 22/02, sa izmjenama)
- Zakon o zaštiti na radu u Republici Srpskoj (Sl. glasnik RS br. 1/08, izmjene)  
- Pravilnike o zaštiti na radu (osobna zaštitna oprema, procjena rizika, evidencije)
- EU Direktive o zaštiti na radu koje BiH harmonizira u okviru procesa pristupanja EU
- Obaveze poslodavaca: rokovi za izvještaje, obuke, licence
- Inspekcija rada FBiH i RS — aktuelne aktivnosti

Generiraj ISKLJUČIVO validan JSON (bez Markdown, bez komentara, samo JSON), u ovom formatu:
[
  {
    "naslov": "Naslov vijesti na bosanskom",
    "opis": "Opis od 2-3 rečenice sa konkretnim informacijama, pravnim referencama i praktičnim savjetima.",
    "tip": "zakon",
    "datum": "01.03.2026.",
    "izvor": "Naziv izvora (npr. Sl. novine FBiH, ILO, EU Direktiva)",
    "url": ""
  }
]

Tipovi su: "zakon", "pravilnik", "edukacija", "rok", "obavijest", "inspekcija"
Datumi trebaju biti razni, u rasponu od 01.01.2025. do 07.03.2026.
Generiraj samo JSON niz, ništa drugo.`;

async function fetchWithModel(apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: NEWS_PROMPT }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 2048,
            },
        }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
}

function parseNewsJSON(text) {
    // Strip any markdown code fences
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const arr = JSON.parse(clean);
    if (!Array.isArray(arr)) throw new Error('Not an array');
    return arr.filter(item => item.naslov && item.opis);
}

export async function GET(request) {
    const force = request.nextUrl?.searchParams?.get('force') === '1';

    // Serve from cache if fresh
    if (!force && cachedNews && Date.now() - cacheTime < CACHE_TTL) {
        return NextResponse.json({ news: cachedNews, cached: true, cacheAge: Math.floor((Date.now() - cacheTime) / 60000) });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'not_configured' }, { status: 500 });
    }

    let lastErr = null;
    for (const model of MODELS) {
        try {
            const text = await fetchWithModel(apiKey, model);
            const news = parseNewsJSON(text);
            cachedNews = news;
            cacheTime = Date.now();
            return NextResponse.json({ news, cached: false, model });
        } catch (err) {
            lastErr = err;
        }
    }

    return NextResponse.json({ error: lastErr?.message || 'fetch_failed' }, { status: 502 });
}
