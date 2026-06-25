/**
 * /api/generate-risk-table/route.js
 *
 * Server-side Gemini proxy for risk table generation.
 * - Keeps API key server-side (not exposed to browser)
 * - Handles multi-model fallback with exponential backoff
 * - Avoids browser CORS/timeout limitations
 * - Country-aware: adapts legal references for BA (BiH) or HR (Croatia)
 */

export const maxDuration = 60;

const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
];

const SYSTEM_PROMPTS = {
    BA: `Ti si certificirani stručnjak za zaštitu na radu (ZNR) u Federaciji Bosne i Hercegovine, specijalizovan za izradu procjena rizika prema:
- Zakon o zaštiti na radu FBiH (Službene novine FBiH 79/20)
- Pravilnik o procjeni rizika
- Pravilnik o sredstvima i opremi za ličnu zaštitu na radu

TVOJ ZADATAK: Za dato radno mjesto generiši REALNU tabelu procjene rizika sa 8-15 stavki (opasnosti).

KRITIČNA PRAVILA:
1. Generiši SAMO opasnosti koje su STVARNO relevantne za dato radno mjesto.
2. Ako je dostavljena SISTEMATIZACIJA RADNOG MJESTA, koristi ISKLJUČIVO te podatke kao osnovu.
3. Ocjene V (vjerovatnoća) i P (posljedica) moraju biti KONZISTENTNE.
4. Odgovori ISKLJUČIVO u JSON formatu, bez markdown blokova ili dodatnog teksta.
5. Mjere moraju biti konkretne i u skladu sa FBiH zakonodavstvom.
6. Ocjene NAKON primjene mjera moraju biti NIŽE od početnih.

SKALA VJEROVATNOĆE (V): 1=Vrlo malo vjerovatno, 2=Malo vjerovatno, 3=Moguće, 4=Vjerovatno, 5=Vrlo vjerovatno
SKALA POSLJEDICE (P): 1=Zanemariva, 2=Mala, 3=Umjerena, 4=Ozbiljna, 5=Katastrofalna

OČEKIVANI JSON FORMAT:
{
  "items": [
    {
      "opisOpasnosti": "Konkretan opis opasnosti",
      "vjerovatnoca": 3,
      "posljedica": 4,
      "postojeceMjere": "Konkretne postojeće mjere",
      "predlozeneMjere": "Konkretne dodatne mjere",
      "vjerovatnocaNakon": 2,
      "posljedlicaNakon": 3,
      "rokProvedbe": "90"
    }
  ]
}`,

    HR: `Ti si certificirani stručnjak zaštite na radu (ZNR) u Republici Hrvatskoj, specijaliziran za izradu procjena rizika prema:
- Zakon o zaštiti na radu (Narodne novine 71/14, 118/14, 154/14, 94/18, 96/18)
- Pravilnik o izradi procjene rizika (NN 112/14, 129/19)
- Pravilnik o uporabi osobne zaštitne opreme (NN 5/21)

TVOJ ZADATAK: Za zadano radno mjesto generiraj REALNU tablicu procjene rizika sa 8-15 stavki (opasnosti).

KRITIČNA PRAVILA:
1. Generiraj SAMO opasnosti koje su STVARNO relevantne za zadano radno mjesto.
2. Ako je dostavljena SISTEMATIZACIJA RADNOG MJESTA, koristi ISKLJUČIVO te podatke kao osnovu.
3. Ocjene V (vjerojatnost) i P (posljedica) moraju biti KONZISTENTNE.
4. Odgovori ISKLJUČIVO u JSON formatu, bez markdown blokova ili dodatnog teksta.
5. Mjere moraju biti konkretne i u skladu s hrvatskim zakonodavstvom.
6. Ocjene NAKON primjene mjera moraju biti NIŽE od početnih.

SKALA VJEROJATNOSTI (V): 1=Vrlo malo vjerojatno, 2=Malo vjerojatno, 3=Moguće, 4=Vjerojatno, 5=Vrlo vjerojatno
SKALA POSLJEDICE (P): 1=Zanemariva, 2=Mala, 3=Umjerena, 4=Ozbiljna, 5=Katastrofalna

OČEKIVANI JSON FORMAT:
{
  "items": [
    {
      "opisOpasnosti": "Konkretan opis opasnosti",
      "vjerovatnoca": 3,
      "posljedica": 4,
      "postojeceMjere": "Konkretne postojeće mjere",
      "predlozeneMjere": "Konkretne dodatne mjere",
      "vjerovatnocaNakon": 2,
      "posljedlicaNakon": 3,
      "rokProvedbe": "90"
    }
  ]
}`,
};

async function callGemini(model, userMsg, apiKey, country = 'BA') {
    const systemPrompt = SYSTEM_PROMPTS[country] || SYSTEM_PROMPTS.BA;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const isRetryable = res.status === 503 || res.status === 429 || res.status >= 500 || res.status === 404;
        const err = new Error(`Model ${model} vratio ${res.status}`);
        err.retryable = isRetryable;
        throw err;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error(`Model ${model} nije vratio sadržaj.`);

    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
    if (!items.length) throw new Error(`Model ${model} vratio prazan niz.`);

    return items;
}

export async function POST(req) {
    try {
        const { jobTitle, industry, sistematizacijaKontekst, country } = await req.json();

        if (!jobTitle) {
            return Response.json({ success: false, error: 'jobTitle je obavezan.' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json({ success: false, error: 'Gemini API kljuc nije konfigurisan.' }, { status: 500 });
        }

        const resolvedCountry = country === 'HR' ? 'HR' : 'BA';

        let userMsg = `RADNO MJESTO: ${jobTitle}\nDJELATNOST: ${industry || 'Nije navedeno'}`;
        if (sistematizacijaKontekst) {
            userMsg += `\n\nSISTEMATIZACIJA RADNOG MJESTA:\n${sistematizacijaKontekst}`;
        }
        userMsg += `\n\nVAZNO: Generisi 8-15 stavki ISKLJUCIVO za poslove koje ovo radno mjesto STVARNO obavlja.`;

        let lastError = null;

        for (const model of MODELS) {
            let retries = 2;
            let delay = 1000;

            while (retries > 0) {
                try {
                    const items = await callGemini(model, userMsg, apiKey, resolvedCountry);
                    return Response.json({ success: true, items, model });
                } catch (err) {
                    lastError = err;
                    if (err.retryable && retries > 1) {
                        await new Promise(r => setTimeout(r, delay));
                        delay *= 2;
                        retries--;
                    } else {
                        break; // Move to next model
                    }
                }
            }
        }

        return Response.json({
            success: false,
            error: lastError?.message || 'Svi AI modeli su trenutno nedostupni. Pokusajte ponovo za par minuta.',
        }, { status: 503 });

    } catch (err) {
        console.error('[generate-risk-table] Error:', err.message);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
