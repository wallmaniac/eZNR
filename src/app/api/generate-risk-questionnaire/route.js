import { NextResponse } from 'next/server';

// ─── AI-Generated Risk Assessment Questionnaire ───
// Takes workplace info + hazards → generates a SurveyJSON questionnaire

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

export async function POST(request) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { workplaceName, workplaceDescription, hazards, existingPPE, existingEquipment } = body;

    const systemPrompt = `Ti si stručnjak za zaštitu na radu (ZNR) u Bosni i Hercegovini.
Generišeš profesionalne upitnike za procjenu rizika na radnom mjestu.

ZADATAK: Na osnovu podataka o radnom mjestu, kreiraj upitnik koji pokriva SVE aspekte potrebne za izradu procjene rizika po FBiH Pravilniku.

PRAVILA:
- Odgovori ISKLJUČIVO u JSON formatu (SurveyJS format)
- Pitanja moraju biti na bosanskom jeziku
- Upitnik mora sadržavati sljedeće sekcije (svaka kao zasebna stranica):
  1. "Opšti podaci" - podaci o radniku i radnom mjestu
  2. "Opasnosti i štetnosti" - fizičke, kemijske, biološke, ergonomske, psihosocijalne
  3. "Zaštitna oprema (OZO)" - osobna zaštitna oprema, stanje, upotreba
  4. "Stručno osposobljavanje" - obuke, certifikati, poznavanje procedura
  5. "Radna oprema" - strojevi, alati, održavanje
  6. "Zdravstveni pregledi" - liječnički pregledi, zdravstvene poteškoće
  7. "Prijedlozi za poboljšanje" - prijedlozi radnika

TIPOVI PITANJA koji se koriste:
- "radiogroup" - za DA/NE ili single-choice (obavezno ima "choices" array)
- "checkbox" - za multi-choice selekciju
- "rating" - za ocjenu 1-5
- "comment" - za slobodan tekst
- "text" - za kratak unos

SVAKO PITANJE mora imati: "type", "name" (unique), "title", i "isRequired": true/false
Za radiogroup/checkbox/rating mora imati "choices" ili "rateValues"

JSON FORMAT:
{
  "pages": [
    {
      "name": "page1",
      "title": "Naziv sekcije",
      "elements": [
        { "type": "text", "name": "q1", "title": "Pitanje?", "isRequired": true },
        { "type": "radiogroup", "name": "q2", "title": "Pitanje?", "choices": ["Da", "Ne", "Djelomično"], "isRequired": true }
      ]
    }
  ]
}

Generiši 5-8 pitanja po sekciji. Pitanja moraju biti specifična za dato radno mjesto.`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPIS: ${workplaceDescription || 'Nema opisa'}
${hazards?.length ? `POZNATE OPASNOSTI: ${hazards.join(', ')}` : ''}
${existingPPE?.length ? `POSTOJEĆA OZO: ${existingPPE.join(', ')}` : ''}
${existingEquipment?.length ? `RADNA OPREMA: ${existingEquipment.join(', ')}` : ''}

Generiši upitnik za ovo radno mjesto.`;

    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096, topP: 0.9, responseMimeType: 'application/json' },
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
                if (model !== MODELS[MODELS.length - 1]) continue;
                return NextResponse.json({ error: `API error ${res.status}` }, { status: 500 });
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';

            try {
                const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const parsed = JSON.parse(cleaned);
                return NextResponse.json({ success: true, surveyJson: parsed, model });
            } catch {
                return NextResponse.json({ error: 'Failed to parse AI response', raw: text.substring(0, 500) }, { status: 500 });
            }
        } catch (err) {
            if (model === MODELS[MODELS.length - 1]) {
                return NextResponse.json({ error: err.message }, { status: 500 });
            }
        }
    }
    return NextResponse.json({ error: 'all_models_failed' }, { status: 500 });
}
