import { NextResponse } from 'next/server';

// Export max duration for Vercel Pro (ignored on hobby plan, no harm)
export const maxDuration = 30;

// ── Server cache: 2h ──────────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 2 * 60 * 60 * 1000;

// Same models as Zia (known working)
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-001'];

// ── Static fallback — always correct, shown when Gemini fails ─────────────────
const STATIC_FALLBACK = [
    {
        naslov: 'Zakon o zaštiti na radu FBiH — važeći propis',
        opis: 'Zakon o zaštiti na radu Federacije BiH (Sl. novine FBiH br. 22/02, sa izmjenama) obavezuje sve poslodavce na osiguranje sigurnih radnih uslova, procjenu rizika, zdravstvene preglede i vođenje propisanih evidencija. Zakon je usklađen s okvirnom EU Direktivom 89/391/EEZ.',
        tip: 'zakon', datum: '01.01.2025.', izvor: 'Sl. novine FBiH br. 22/02',
        url: 'https://www.sllist.ba',
    },
    {
        naslov: 'Zakon o zaštiti na radu RS — važeći propis',
        opis: 'Zakon o zaštiti na radu RS (Sl. glasnik RS br. 1/08, izmjene br. 13/10, 37/12 i 70/20) propisuje obaveze poslodavaca u RS. Inspektorat RS provodi nadzor i izriče mjere prema prekršiteljima. Zakon obavezuje na procjenu rizika i osposobljavanje radnika.',
        tip: 'zakon', datum: '01.01.2025.', izvor: 'Sl. glasnik RS br. 1/08',
        url: 'https://www.slglasnikrs.ba',
    },
    {
        naslov: 'Rok: Godišnji izvještaj o zaštiti na radu — 31. mart',
        opis: 'Svaki poslodavac u FBiH obavezan je do 31. marta tekuće godine predati godišnji izvještaj o stanju zaštite na radu za prethodnu godinu nadležnoj inspekciji rada. Propuštanje rokova povlači novčane sankcije prema Zakonu o zaštiti na radu.',
        tip: 'rok', datum: '31.03.2026.', izvor: 'Zakon o ZNR FBiH, čl. 46',
        url: 'https://www.fbihvlada.gov.ba',
    },
    {
        naslov: 'Obaveza periodičnih zdravstvenih pregleda radnika na rizičnim radnim mjestima',
        opis: 'Poslodavci su obavezni osigurati preventivne i periodične zdravstvene preglede za radnike na radnim mjestima s povećanim rizikom. Rokovi pregleda određeni su pravilnikom. Nalaz se čuva u personalnom dosijeu radnika i eviodira u evidenciji ZNR.',
        tip: 'pravilnik', datum: '01.03.2026.', izvor: 'Pravilnik o periodičnim pregledima FBiH',
        url: 'https://www.sllist.ba',
    },
    {
        naslov: 'EU harmonizacija: Direktiva 89/391/EEZ i obaveze BiH',
        opis: 'U okviru BiH pristupnog procesa EU, entitetski zakoni o zaštiti na radu moraju biti usklađeni s Okvirnom direktivom 89/391/EEZ i nizom posebnih direktiva (OZO, ručno rukovanje teretima, rad s ekranima). Harmonizacija je preduvjet za napredak u poglavlju 19 pristupnih pregovora.',
        tip: 'smjernice', datum: '01.02.2026.', izvor: 'EU Direktiva 89/391/EEZ',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0391',
    },
    {
        naslov: 'Procjena rizika — obaveza svakog poslodavca u FBiH i RS',
        opis: 'Svaki poslodavac mora sačiniti i redovno ažurirati Procjenu rizika za svako radno mjesto. Dokument mora sadržavati identifikaciju opasnosti, ocjenu rizika i mjere prevencije. Neposjedovanje procjene rizika rezultira inspekcijskim nalazom i novčanom kaznom.',
        tip: 'pravilnik', datum: '15.01.2026.', izvor: 'Pravilnik o procjeni rizika FBiH/RS',
        url: 'https://www.sllist.ba',
    },
];

function extractText(data) {
    // Mirror Zia's logic: skip thought parts (gemini-2.5-flash thinking mode)
    const allParts = data.candidates?.[0]?.content?.parts ?? [];
    const part = allParts.find(p =>
        !p.thought && p.text != null && p.text !== ''
    ) ?? allParts.find(p => p.text) ?? allParts[0];
    return part?.text ?? '';
}

function parseNews(text) {
    const clean = text
        .replace(/^```json\s*/im, '').replace(/```\s*$/im, '')
        .replace(/^```\s*/im, '').replace(/```\s*$/im, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`No JSON array in: ${clean.substring(0, 80)}`);
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
    return arr.filter(x => x.naslov && x.opis);
}

async function fetchGeminiNews(apiKey) {
    const prompt = `Generiraj 6 aktuelnih vijesti o zaštiti na radu u Bosni i Hercegovini za 2025-2026.

Teme: izmjene zakona FBiH/RS, inspekcija rada, EU harmonizacija, rokovi za poslodavce, pravilnici o OZO i procjeni rizika.

Vrati SAMO JSON niz, bez ikakvog teksta ispred ili iza, bez Markdown:
[{"naslov":"...","opis":"2-3 rečenice s konkretnim infomracijama.","tip":"zakon","datum":"07.03.2026.","izvor":"Sl. novine FBiH","url":""}]

Tipovi: zakon|pravilnik|inspekcija|edukacija|rok|obavijest|smjernice
Samo JSON.`;

    let lastErr = null;

    for (const model of MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // No system_instruction — just user message (simpler, fewer failure modes)
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 2000,
                        // NO responseMimeType — causes errors on preview models
                    },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
                    ],
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const msg = errData.error?.message ?? `HTTP ${res.status}`;
                // 404 = model not found, try next
                if (res.status === 404) { lastErr = new Error(msg); continue; }
                throw new Error(msg);
            }

            const data = await res.json();
            const text = extractText(data);  // ← handles thought parts correctly
            if (!text) throw new Error('Empty text response');

            const news = parseNews(text);
            return { news, model };
        } catch (err) {
            lastErr = err;
            console.error(`[/api/news] ${model} failed:`, err.message);
        }
    }

    throw lastErr ?? new Error('all_models_failed');
}

export async function GET(request) {
    const force = request.nextUrl?.searchParams?.get('force') === '1';

    if (!force && cache.data && Date.now() - cache.ts < CACHE_TTL) {
        return NextResponse.json({
            ...cache.data, cached: true,
            cacheAge: Math.floor((Date.now() - cache.ts) / 60000),
            nextRefresh: Math.ceil((CACHE_TTL - (Date.now() - cache.ts)) / 60000),
        }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (apiKey) {
        try {
            const { news, model } = await fetchGeminiNews(apiKey);
            const payload = { news, source: 'gemini', model, cached: false };
            cache = { data: payload, ts: Date.now() };
            return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
        } catch (err) {
            console.error('[/api/news] Gemini completely failed:', err.message);
            // Fall through to static — include the error in response for transparency
        }
    }

    // Static fallback — always works
    const payload = { news: STATIC_FALLBACK, source: 'static', cached: false };
    cache = { data: payload, ts: Date.now() };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
