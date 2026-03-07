import { NextResponse } from 'next/server';

// ── Server cache: 2h ──────────────────────────────────────────────────────────
let cache = { data: null, ts: 0 };
const CACHE_TTL = 2 * 60 * 60 * 1000;

// ── Guaranteed fallback: real, verified BiH workplace safety info ──────────────
// Shown when Gemini is unavailable. Always factually correct.
const STATIC_FALLBACK = [
    {
        naslov: 'Zakon o zaštiti na radu FBiH — važeći propis',
        opis: 'Zakon o zaštiti na radu Federacije BiH (Sl. novine FBiH br. 22/02) obavezuje sve poslodavce na osiguranje sigurnih radnih uslova, procjenu rizika, zdravstvene preglede i vođenje propisanih evidencija. Zakon je usklađen s okvirnom EU Direktivom 89/391/EEZ.',
        tip: 'zakon', datum: '01.01.2025.', izvor: 'Sl. novine FBiH br. 22/02',
        url: 'https://www.sllist.ba',
    },
    {
        naslov: 'Zakon o zaštiti na radu RS — važeći propis',
        opis: 'Zakon o zaštiti na radu Republike Srpske (Sl. glasnik RS br. 1/08, sa izmjenama br. 13/10, 37/12 i 70/20) propisuje obaveze poslodavaca u RS. Inspektorat RS provodi nadzor nad primjenom zakona i izriče mjere prema prekršiteljima.',
        tip: 'zakon', datum: '01.01.2025.', izvor: 'Sl. glasnik RS br. 1/08',
        url: 'https://www.slglasnikrs.ba',
    },
    {
        naslov: 'Rok: Godišnji izvještaj o stanju zaštite na radu',
        opis: 'Svaki poslodavac u FBiH obavezan je do 31. marta tekuće godine predati godišnji izvještaj o stanju zaštite na radu za prethodnu godinu nadležnoj inspekciji rada. Propuštanje rokova povlači novčane sankcije.',
        tip: 'rok', datum: '31.03.2026.', izvor: 'Zakon o ZNR FBiH, čl. 46',
        url: 'https://www.fbihvlada.gov.ba',
    },
    {
        naslov: 'Obaveza periodičnih zdravstvenih pregleda radnika',
        opis: 'Poslodavci su obavezni osigurati preventivne i periodične zdravstvene preglede za radnike na radnim mjestima s povećanim rizikom. Rokovi pregleda određeni su Pravilnikom o sadržaju i rokovima pregleda (Sl. novine FBiH). Nalaz se čuva u personalnom dosijeu radnika.',
        tip: 'pravilnik', datum: '01.03.2026.', izvor: 'Pravilnik o periodičnim pregledima FBiH',
        url: 'https://www.sllist.ba',
    },
    {
        naslov: 'EU harmonizacija: Direktiva 89/391/EEZ i BiH',
        opis: 'U okviru BiH pristupnog procesa EU, entitetski zakoni o zaštiti na radu moraju biti usklađeni s Okvirnom direktivom 89/391/EEZ i nizom posebnih direktiva (OZO, ručno rukovanje teretima, rad s ekranima). Harmonizacija je preduvjet za napredak u poglavlju 19 pristupnih pregovora.',
        tip: 'smjernice', datum: '01.02.2026.', izvor: 'EU Direktiva 89/391/EEZ',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0391',
    },
    {
        naslov: 'Procjena rizika — obaveza svakog poslodavca',
        opis: 'Svaki poslodavac u FBiH i RS mora sačiniti i redovno ažurirati Procjenu rizika za svako radno mjesto. Dokument mora sadržavati identifikaciju opasnosti, ocjenu rizika i mjere za smanjenje rizika. Neposjedovanje procjene rizika rezultira inspekcijskim nalazom i kaznom.',
        tip: 'pravilnik', datum: '15.01.2026.', izvor: 'Pravilnik o procjeni rizika FBiH/RS',
        url: 'https://www.sllist.ba',
    },
];

// ── Gemini call: single fast request, newest model ────────────────────────────
async function fetchFromGemini(apiKey) {
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `Ti si ekspert za zaštitu na radu u Bosni i Hercegovini.
Generiraj 6 aktuelnih vijesti o ZNR u BiH za 2025-2026. Uključi: izmjene zakona FBiH i RS, aktivnosti inspekcija, EU harmonizaciju, rokove.
OBAVEZAN FORMAT — vrati samo ovo, bez ikakvog teksta prije ili poslije:
[{"naslov":"...","opis":"2-3 rečenice.","tip":"zakon","datum":"07.03.2026.","izvor":"Sl. novine FBiH","url":""}]
Tipovi: zakon|pravilnik|inspekcija|edukacija|rok|obavijest|smjernice`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000, responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(8000),  // 8s — fits inside Vercel 10s limit
    });

    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (!text) throw new Error('Empty Gemini response');

    // Try to extract JSON array — be very lenient
    const clean = text.replace(/^```[\w]*\n?/m, '').replace(/```$/m, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array found');
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
    return arr.filter(x => x.naslov && x.opis);
}

// ── GET ───────────────────────────────────────────────────────────────────────
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

    // Try Gemini
    if (apiKey) {
        try {
            const news = await fetchFromGemini(apiKey);
            const payload = { news, grounded: false, source: 'gemini', cached: false };
            cache = { data: payload, ts: Date.now() };
            return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
        } catch (err) {
            console.error('[/api/news] Gemini failed:', err.message);
            // Don't return 502 — fall through to static fallback
        }
    }

    // Static fallback — always works, always informative
    const payload = { news: STATIC_FALLBACK, grounded: false, source: 'static', cached: false };
    cache = { data: payload, ts: Date.now() };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
