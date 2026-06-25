import { NextResponse } from 'next/server';

// ── Server cache: 2h, keyed by country ────────────────────────────────────────
const cacheMap = {}; // { BA: { data, ts }, HR: { data, ts } }
const CACHE_TTL = 2 * 60 * 60 * 1000;

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

const STATIC_FALLBACK_BA = [
    {
        naslov: 'Zakon o zaštiti na radu FBiH — važeći propis',
        opis: 'Zakon o zaštiti na radu Federacije BiH (Sl. novine FBiH br. 79/20) obavezuje sve poslodavce na osiguranje sigurnih radnih uslova, procjenu rizika, zdravstvene preglede i vođenje propisanih evidencija.',
        tip: 'zakon', datum: '01.01.2025.', izvor: 'Sl. novine FBiH br. 79/20',
        url: 'https://www.paragraf.ba/propisi/fbih/zakon-o-zastiti-na-radu.html',
    },
    {
        naslov: 'Zakon o zaštiti na radu RS — važeći propis',
        opis: 'Zakon o zaštiti na radu RS (Sl. glasnik RS br. 1/08, 13/10, 37/12 i 70/20) propisuje obaveze poslodavaca u RS.',
        tip: 'zakon', datum: '01.01.2025.', izvor: 'Sl. glasnik RS br. 1/08',
        url: 'https://www.paragraf.ba/propisi/republika-srpska/zakon-o-zastiti-na-radu.html',
    },
    {
        naslov: 'Rok: Godišnji izvještaj o povredama na radu — 31. mart',
        opis: 'Svaki poslodavac obavezan je predati godišnji izvještaj o povredama i profesionalnim oboljenjima nadležnoj inspekciji.',
        tip: 'rok', datum: '31.03.2026.', izvor: 'Pravilnik 9/23',
        url: 'https://www.fbihvlada.gov.ba',
    },
    {
        naslov: 'Novi Pravilnik o upotrebi OZO',
        opis: 'Poslodavci su obavezni osigurati upotrebu sredstava i opreme lične zaštite na radu u skladu sa propisima.',
        tip: 'pravilnik', datum: '01.03.2026.', izvor: 'Sl. novine FBiH br. 42/25',
        url: 'https://www.sllist.ba',
    },
];

const STATIC_FALLBACK_HR = [
    {
        naslov: 'Zakon o zaštiti na radu — NN 71/14',
        opis: 'Temeljni zakon koji uređuje sustav zaštite na radu u Republici Hrvatskoj. Propisuje obveze poslodavaca i prava radnika.',
        tip: 'zakon', datum: '01.01.2025.', izvor: 'Narodne novine br. 71/14',
        url: 'https://www.zakon.hr/z/167/Zakon-o-za%C5%A1titi-na-radu',
    },
    {
        naslov: 'Pravilnik o izradi procjene rizika',
        opis: 'Svaki poslodavac u RH obavezan je izraditi i redovno ažurirati procjenu rizika za sva radna mjesta.',
        tip: 'pravilnik', datum: '01.03.2026.', izvor: 'Narodne novine br. 112/14',
        url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2014_09_112_2154.html',
    },
    {
        naslov: 'Pravilnik o osposobljavanju iz zaštite na radu',
        opis: 'Uređuje način i program osposobljavanja radnika za rad na siguran način te polaganje stručnog ispita iz zaštite na radu.',
        tip: 'pravilnik', datum: '01.02.2026.', izvor: 'Narodne novine br. 142/21',
        url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2021_12_142_2422.html',
    },
    {
        naslov: 'Pravilnik o uporabi osobne zaštitne opreme',
        opis: 'Propisuje obveze poslodavca u pogledu nabave i uporabe osobne zaštitne opreme za radnike.',
        tip: 'pravilnik', datum: '15.01.2026.', izvor: 'Narodne novine br. 5/21',
        url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2021_01_5_70.html',
    },
];

function extractText(data) {
    const allParts = data.candidates?.[0]?.content?.parts ?? [];
    const part = allParts.find(p => !p.thought && p.text != null && p.text !== '') ?? allParts.find(p => p.text) ?? allParts[0];
    return part?.text ?? '';
}

function parseNews(text) {
    const clean = text.replace(/^```json\s*/im, '').replace(/```\s*$/im, '').trim();
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`No JSON array in: ${clean.substring(0, 80)}`);
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty array');
    return arr.filter(x => x.naslov && x.opis);
}

function buildPrompt(country) {
    if (country === 'HR') {
        return `Ti si pravni asistent za zaštitu na radu u Republici Hrvatskoj. Generiraj 5 informativnih vijesti o zaštiti na radu u RH. Koristi stvarne zakone (Zakon o zaštiti na radu NN 71/14, Pravilnici iz Narodnih novina). Vrati SAMO valjani JSON niz: [{"naslov":"...","opis":"...","tip":"zakon","datum":"07.03.2026.","izvor":"Narodne novine br. 71/14","url":""}] Tipovi: zakon|pravilnik|rok|obavijest. Za 'url' OBAVEZNO ostavi prazan string "". Samo JSON.`;
    }
    return `Ti si pravni asistent za zaštitu na radu u Bosni i Hercegovini. Generiraj 5 informativnih vijesti o zaštiti na radu u BiH. Koristi stvarne zakone (Zakon o zaštiti na radu FBiH 79/20, RS 1/08). Vrati SAMO valjani JSON niz: [{"naslov":"...","opis":"...","tip":"zakon","datum":"07.03.2026.","izvor":"Sl. novine FBiH br. 79/20","url":""}] Tipovi: zakon|pravilnik|rok|obavijest. Za 'url' OBAVEZNO ostavi prazan string "". Samo JSON.`;
}

async function fetchGeminiNews(apiKey, country) {
    const prompt = buildPrompt(country);
    let lastErr = null;

    for (const model of MODELS) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2 },
                }),
            });

            if (!res.ok) {
                lastErr = new Error(`HTTP ${res.status}`);
                continue;
            }

            const data = await res.json();
            const text = extractText(data);
            const news = parseNews(text);
            return { news, model };
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr ?? new Error('all_models_failed');
}

export async function POST(request) {
    try {
        const body = await request.json();
        const force = body.force === true;
        const country = (body.country || 'BA').toUpperCase();
        const cacheKey = country === 'HR' ? 'HR' : 'BA';

        const cached = cacheMap[cacheKey];
        if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
            return NextResponse.json({
                ...cached.data, cached: true, country: cacheKey,
                cacheAge: Math.floor((Date.now() - cached.ts) / 60000),
                nextRefresh: Math.ceil((CACHE_TTL - (Date.now() - cached.ts)) / 60000),
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey) {
            try {
                const { news, model } = await fetchGeminiNews(apiKey, cacheKey);
                const payload = { news, source: 'gemini', model, cached: false, country: cacheKey };
                cacheMap[cacheKey] = { data: payload, ts: Date.now() };
                return NextResponse.json(payload);
            } catch (err) {
                console.error('Gemini fetch failed:', err);
            }
        }

        const fallback = cacheKey === 'HR' ? STATIC_FALLBACK_HR : STATIC_FALLBACK_BA;
        const payload = { news: fallback, source: 'static', cached: false, country: cacheKey };
        cacheMap[cacheKey] = { data: payload, ts: Date.now() };
        return NextResponse.json(payload);

    } catch (error) {
        console.error('News API Route Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
