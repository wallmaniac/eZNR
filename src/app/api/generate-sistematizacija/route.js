import { NextResponse } from 'next/server';

// ─── AI-Generated Sistematizacija radnog mjesta ───
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

export async function POST(request) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { workplaceName, oznaka, strucnaSprema, industry, numberOfWorkers, orgUnit, additionalInfo } = body;

    const systemPrompt = `Ti si stručnjak za ljudske resurse i zaštitu na radu u Bosni i Hercegovini.
Generišeš profesionalnu sistematizaciju radnog mjesta u skladu sa Zakonom o radu FBiH (čl. 118.)
i Pravilnikom o unutrašnjoj organizaciji i sistematizaciji radnih mjesta.

ZADATAK: Na osnovu podataka o radnom mjestu, generiši kompletnu sistematizaciju.

PRAVILA:
- Odgovori ISKLJUČIVO u JSON formatu
- Sav tekst na bosanskom jeziku
- Budi detaljan i profesionalan
- Polje "kategorijaRM" mora biti jedno od: "Rukovodeće", "Izvršno", "Pomoćno"
- Polje "slozenostPoslova" mora biti jedno od: "Jednostavni", "Srednje složeni", "Složeni", "Visoko složeni"

JSON FORMAT:
{
  "nazivPosla": "Formalni naziv radnog mjesta / pozicije",
  "kategorijaRM": "Rukovodeće|Izvršno|Pomoćno",
  "slozenostPoslova": "Jednostavni|Srednje složeni|Složeni|Visoko složeni",
  "opisPoslova": "Detaljan opis poslova i radnih zadataka (3-5 rečenica)",
  "odgovornosti": "Ključne odgovornosti na radnom mjestu (2-4 rečenice)",
  "strucnaSprema": "SSS|VŠS|VSS",
  "radnoIskustvo": "npr. 2 godine u struci",
  "probniRad": "npr. 3 mjeseca",
  "posebniUvjeti": ["uvjet 1", "uvjet 2"],
  "brojIzvrsilaca": 1,
  "uvjetiRada": {
    "fizicki": ["buka", "vibracije", "visoke temperature"],
    "kemijski": ["prašina", "kemikalije"],
    "bioloski": [],
    "ergonomski": ["prisilni položaji", "ponavljajući pokreti"],
    "psihosocijalni": ["stres", "rad u smjenama"]
  },
  "potrebnaOZO": ["Zaštitna kaciga", "Zaštitne cipele S3"],
  "radnaOprema": ["Viličar", "Ručni alat"],
  "zdravstveniZahtjevi": ["Redovni periodični pregled", "Pregled vida"],
  "certifikati": ["Osposobljavanje ZNR", "Zaštita od požara"],
  "potrebneObuke": ["Osnovno osposobljavanje iz ZNR", "Zaštita od požara"],
  "pravniOsnov": "Čl. 118. Zakona o radu FBiH",
  "napomena": "Dodatne napomene"
}`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OZNAKA: ${oznaka || ''}
STRUČNA SPREMA: ${strucnaSprema || 'Nije navedeno'}
DJELATNOST: ${industry || 'Nije navedeno'}
BROJ IZVRŠILACA: ${numberOfWorkers || 'Nije navedeno'}
ORG. JEDINICA: ${orgUnit || ''}
${additionalInfo ? `DODATNE INFORMACIJE: ${additionalInfo}` : ''}

Generiši kompletnu sistematizaciju za ovo radno mjesto.`;

    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096, topP: 0.9, responseMimeType: 'application/json' },
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
            if (parsed && parsed.opisPoslova) return NextResponse.json({ success: true, sistematizacija: parsed, model });
            // Retry without responseMimeType
            delete geminiBody.generationConfig.responseMimeType;
            const res2 = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) });
            if (res2.ok) {
                const d2 = await res2.json();
                const t2 = d2.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
                const p2 = tryParse(t2);
                if (p2 && p2.opisPoslova) return NextResponse.json({ success: true, sistematizacija: p2, model });
            }
            if (model === MODELS[MODELS.length - 1]) return NextResponse.json({ error: 'Parse failed', raw: text.substring(0, 300) }, { status: 500 });
        } catch (err) { if (model === MODELS[MODELS.length - 1]) return NextResponse.json({ error: err.message }, { status: 500 }); }
    }
    return NextResponse.json({ error: 'all_models_failed' }, { status: 500 });
}
