/**
 * /api/analyze-questionnaire/route.js
 *
 * Server-side Gemini proxy for questionnaire analysis (Uvezi iz upitnika).
 * - Keeps API key server-side
 * - Handles multi-model fallback with exponential backoff
 * - 60-second Vercel serverless timeout
 */

export const maxDuration = 60;

const MODELS = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
];

async function callGemini(model, systemPrompt, userMsg, apiKey) {
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
    if (!text) throw new Error(`Model ${model} nije vratio sadrzaj.`);

    const parsed = JSON.parse(text);
    if (!parsed || !parsed.items) throw new Error(`Model ${model} vratio neispravan JSON.`);

    return parsed;
}

export async function POST(req) {
    try {
        const { workplaceName, responseSummary, sistContext, hasSistematizacija } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json({ success: false, error: 'Gemini API kljuc nije konfigurisan.' }, { status: 500 });
        }

        const systemPrompt = `Ti si strucnjak za zastitu na radu (ZNR) u Bosni i Hercegovini.
Analiziras zbirne odgovore iz upitnika SVIH radnika na ovom radnom mjestu i generises jedinstvene, konsolidovane stavke procjene rizika. Ne smijes duplirati opasnosti.

ZADATAK: Na osnovu grupnih odgovora iz upitnika${hasSistematizacija ? ' i sistematizacije radnog mjesta' : ''}, identifikuj sve jedinstvene opasnosti i za svaku procijeni vjerovatnocu (V) i posljedicu (P) na skali 1-5.

PRAVILA:
- Odgovori ISKLJUCIVO u JSON formatu. Sadrzaj mora poceti sa { i zavrsiti sa }.
- Ne dupliraj stavke. Grupisi iste opasnosti.
- Procijeni V (1-5) i P (1-5).
- Predlozi postojece mjere i dodatne predlozene mjere.
- Generisi 5-10 stavki, KRATKO i SAZETNO.

JSON FORMAT:
{
  "items": [
    {
      "opisOpasnosti": "Opis opasnosti",
      "vjerovatnoca": 3,
      "posljedica": 4,
      "postojeceMjere": "Mjere koje su vec na snazi",
      "predlozeneMjere": "Dodatne preporucene mjere",
      "vjerovatnocaNakon": 2,
      "posljedlicaNakon": 3,
      "rokProvedbe": "30|60|90|180"
    }
  ],
  "ukupniKomentar": "Kratki sazetak analize"
}`;

        const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}\n\nZBIRNI ODGOVORI:\n${responseSummary}${sistContext || ''}\n\nGenerisi konsolidovane stavke procjene rizika.`;

        let lastError = null;

        for (const model of MODELS) {
            let retries = 2;
            let delay = 1000;

            while (retries > 0) {
                try {
                    const parsed = await callGemini(model, systemPrompt, userMsg, apiKey);
                    return Response.json({ success: true, data: parsed, model });
                } catch (err) {
                    lastError = err;
                    if (err.retryable && retries > 1) {
                        await new Promise(r => setTimeout(r, delay));
                        delay *= 2;
                        retries--;
                    } else {
                        break;
                    }
                }
            }
        }

        return Response.json({
            success: false,
            error: lastError?.message || 'Svi AI modeli su trenutno nedostupni.',
        }, { status: 503 });

    } catch (err) {
        console.error('[analyze-questionnaire] Error:', err.message);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
