import { NextResponse } from 'next/server';

// ─── Parse uploaded Sistematizacija document → structured data ───
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

export async function POST(request) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { documentText, workplaceName } = body;
    if (!documentText) return NextResponse.json({ error: 'no_text' }, { status: 400 });

    const systemPrompt = `Ti si stručnjak za HR i zaštitu na radu. Iz teksta dokumenta Sistematizacije radnih mjesta izvuci strukturirane podatke.

Odgovori ISKLJUČIVO u JSON formatu:
{
  "opisPoslova": "opis poslova",
  "strucnaSprema": "SSS|VŠS|VSS",
  "radnoIskustvo": "2 godine",
  "posebniUvjeti": ["uvjet"],
  "brojIzvrsilaca": 1,
  "uvjetiRada": {
    "fizicki": [], "kemijski": [], "bioloski": [], "ergonomski": [], "psihosocijalni": []
  },
  "potrebnaOZO": ["oprema"],
  "radnaOprema": ["oprema"],
  "zdravstveniZahtjevi": ["zahtjev"],
  "certifikati": ["certifikat"],
  "napomena": ""
}

Ako radno mjesto nije eksplicitno navedeno, izvuci podatke za poziciju "${workplaceName || 'nepoznato'}".`;

    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `TEKST DOKUMENTA:\n${documentText.substring(0, 8000)}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    };

    const tryParse = (str) => {
        try { return JSON.parse(str); } catch {}
        try { return JSON.parse(str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); } catch {}
        try { const f = str.indexOf('{'), l = str.lastIndexOf('}'); if (f !== -1 && l > f) return JSON.parse(str.substring(f, l + 1)); } catch {}
        return null;
    };

    for (const model of MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) });
            if (!res.ok) { if (model !== MODELS[MODELS.length - 1]) continue; return NextResponse.json({ error: `API ${res.status}` }, { status: 500 }); }
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
            const parsed = tryParse(text);
            if (parsed) return NextResponse.json({ success: true, sistematizacija: parsed, model });
            if (model === MODELS[MODELS.length - 1]) return NextResponse.json({ error: 'Parse failed', raw: text.substring(0, 300) }, { status: 500 });
        } catch (err) { if (model === MODELS[MODELS.length - 1]) return NextResponse.json({ error: err.message }, { status: 500 }); }
    }
    return NextResponse.json({ error: 'all_models_failed' }, { status: 500 });
}
