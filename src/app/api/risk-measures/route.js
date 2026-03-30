import { NextResponse } from 'next/server';

// ─── Risk Measures AI Suggestion Endpoint ───
// Uses Gemini to suggest control measures for workplace hazards

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

export async function POST(request) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { hazardName, hazardCode, workplaceName, opisOpasnosti, vjerovatnoca, posljedica, postojeceMjere, documentData, documentMimeType } = body;

    const systemPrompt = `Ti si stručnjak za zaštitu na radu (ZNR) u Bosni i Hercegovini i EU.
Na osnovu dostavljenih podataka o opasnosti na radnom mjestu, predloži konkretne mjere zaštite.

PRAVILA:
- Odgovori ISKLJUČIVO u JSON formatu, bez dodatnog teksta
- Mjere moraju biti konkretne, primjenjive i u skladu sa FBiH Zakonom o ZNR (79/20)
- Predloži i postojeće (standardne) i dodatne mjere
- Procijeni novu vjerovatnoću (V) i posljedicu (P) NAKON primjene svih mjera (1-5 skala)
- Nova V i P moraju biti realno niže od početnih, ali ne smiješ ih staviti na 1 ako opasnost nije potpuno eliminisana

JSON FORMAT:
{
  "postojeceMjere": "Opis standardnih mjera koje bi trebale biti na snazi",
  "predlozeneMjere": "Opis dodatnih mjera koje treba provesti za smanjenje rizika",
  "vjerovatnocaNakon": <broj 1-5>,
  "posljedlicaNakon": <broj 1-5>,
  "obrazlozenje": "Kratko obrazloženje zašto su predložene ove mjere i nova ocjena"
}`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPASNOST: ${hazardCode ? `${hazardCode} — ` : ''}${hazardName || 'Nepoznata'}
OPIS: ${opisOpasnosti || 'Nema dodatnog opisa'}
TRENUTNA VJEROVATNOĆA (V): ${vjerovatnoca}/5
TRENUTNA POSLJEDICA (P): ${posljedica}/5
TRENUTNI RIZIK (R): ${vjerovatnoca * posljedica}/25
${postojeceMjere ? `POSTOJEĆE MJERE: ${postojeceMjere}` : ''}

Predloži mjere i novu ocjenu V i P nakon primjene mjera.
${documentData ? 'OPASKO: Priložen je i dokument (npr. izvještaj o ispitivanju). Strogo uzmi u obzir opaske iz dokumenta prilikom predlaganja mjera (ako su relevantne).' : ''}`;

    const parts = [];
    if (documentData && documentMimeType) {
        parts.push({
            inlineData: { data: documentData, mimeType: documentMimeType }
        });
    }
    parts.push({ text: userMsg });

    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024, topP: 0.9, responseMimeType: 'application/json' },
    };

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
                return NextResponse.json({ error: `API error ${res.status}` }, { status: 500 });
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';

            try {
                const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return NextResponse.json({ success: true, measures: parsed, model });
            } catch {
                return NextResponse.json({ success: true, measures: { postojeceMjere: text, predlozeneMjere: '', vjerovatnocaNakon: Math.max(1, vjerovatnoca - 1), posljedlicaNakon: Math.max(1, posljedica - 1), obrazlozenje: '' }, model });
            }
        } catch (err) {
            if (model === MODELS[MODELS.length - 1]) {
                return NextResponse.json({ error: err.message }, { status: 500 });
            }
        }
    }
    return NextResponse.json({ error: 'all_models_failed' }, { status: 500 });
}
