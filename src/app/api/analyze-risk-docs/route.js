import { NextResponse } from 'next/server';

// ─── Document AI Analyzer ───
// Analyzes one or multiple uploaded files to extract Risk Assessment fields

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro-latest'];

export async function POST(request) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { documents, companyName } = body;
    // documents = [{ data: 'base64', mimeType: '...', name: '...' }]

    if (!documents || documents.length === 0) {
        return NextResponse.json({ error: 'no_documents' }, { status: 400 });
    }

    const systemPrompt = `Ti si stručnjak za zaštitu na radu (ZNR) u Bosni i Hercegovini i EU.
Zadatak ti je da detaljno analiziraš priložene dokumente (npr. mjerne protokole, tehničke listove, zapisnike) i iz njih izvučeš ključne podatke za izradu "Akta o procjeni rizika".

PRAVILA:
- Odgovori ISKLJUČIVO u JSON formatu, bez dodatnog markdowna ili teksta.
- Pravopis i izražavanje trebaju biti na bosanskom/hrvatskom službenom jeziku.
- Popuni sljedeća polja na osnovu onoga što zaključiš iz dokumenata:

JSON FORMAT:
{
  "opisProcesa": "Napiši koherentan tekst koji opisuje radne procese na osnovu opisanih mjerenja ili priložene dokumentacije. (npr. 'Na lokaciji se obavlja... Uređaji koji se koriste...')",
  "analizaOrganizacije": "Napiši zapažanja o organizaciji rada, smjenama, ili uslovima (osvjetljenje, buka, mikroklima) na osnovu parametara iz protokola.",
  "oprema": [
    "Mašina 1 (ako se spominje)",
    "Uređaj 2"
  ],
  "opasnosti": [
    "Opasnost od udara električne struje (ako su rađena elektro-mjerenja)",
    "Opasnost od buke (ako postoji zapisnik o buci)",
    "Specifična opasnost 3"
  ]
}`;

    const userMsg = `Firma/Objekat: ${companyName || 'Nepoznato'}
Molim te analiziraj dostavljene dokumente i vrati traženi JSON.`;

    const parts = documents.map(doc => ({
        inlineData: { data: doc.data, mimeType: doc.mimeType }
    }));
    parts.push({ text: userMsg });

    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    };

    let lastError = null;
    for (const model of MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiBody),
            });

            if (!res.ok) {
                const isLast = model === MODELS[MODELS.length - 1];
                if (!isLast) continue;
                lastError = `API error ${res.status}`;
                return NextResponse.json({ error: lastError }, { status: 500 });
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';

            try {
                const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return NextResponse.json({ success: true, analysis: parsed, model });
            } catch (parseErr) {
                lastError = 'JSON parsing failed';
                console.error("AI returned malformed JSON:", text);
                if (model === MODELS[MODELS.length - 1]) {
                    return NextResponse.json({ error: 'invalid_json_from_ai', raw: text }, { status: 500 });
                }
            }
        } catch (err) {
            lastError = err.message;
            if (model === MODELS[MODELS.length - 1]) {
                return NextResponse.json({ error: err.message }, { status: 500 });
            }
        }
    }
    return NextResponse.json({ error: lastError || 'all_models_failed' }, { status: 500 });
}
