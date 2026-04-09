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

    const { workplaceName, workplaceDescription, hazards, existingPPE, existingEquipment, sistematizacija, vrstaAnkete, jezik } = body;

    const systemPrompt = `Ti si stručnjak za zaštitu na radu (ZNR) u Bosni i Hercegovini.
Generišeš profesionalne upitnike za temu: "${vrstaAnkete || 'Procjena rizika na radnom mjestu'}".

ZADATAK: Na osnovu podataka, kreiraj upitnik fokusiran na: ${vrstaAnkete || 'sve aspekte procjene rizika'}.

PRAVILA:
- Odgovori ISKLJUČIVO u JSON formatu (SurveyJS format)
- Pitanja, opcije i naslovi MORAJU biti na ovom jeziku: ${jezik || 'Bosanski'}
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

    // Build sistematizacija context block if available
    const sistBlock = sistematizacija ? `
SISTEMATIZACIJA RADNOG MJESTA:
- Opis poslova: ${sistematizacija.opisPoslova || 'N/A'}
- Stručna sprema: ${sistematizacija.strucnaSprema || 'N/A'}
- Fizički uvjeti: ${(sistematizacija.uvjetiRada?.fizicki || []).join(', ') || 'N/A'}
- Kemijski uvjeti: ${(sistematizacija.uvjetiRada?.kemijski || []).join(', ') || 'N/A'}
- Ergonomski uvjeti: ${(sistematizacija.uvjetiRada?.ergonomski || []).join(', ') || 'N/A'}
- Psihosocijalni: ${(sistematizacija.uvjetiRada?.psihosocijalni || []).join(', ') || 'N/A'}
- Potrebna OZO: ${(sistematizacija.potrebnaOZO || []).join(', ') || 'N/A'}
- Radna oprema: ${(sistematizacija.radnaOprema || []).join(', ') || 'N/A'}
- Zdravstveni zahtjevi: ${(sistematizacija.zdravstveniZahtjevi || []).join(', ') || 'N/A'}
- Certifikati: ${(sistematizacija.certifikati || []).join(', ') || 'N/A'}

KORISTI OVE PODATKE za generisanje preciznijih pitanja! Pitanja o OZO moraju uključiti specifičnu opremu iz sistematizacije. Pitanja o opasnostima moraju se odnositi na konkretne uvjete rada.` : '';

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPIS: ${workplaceDescription || 'Nema opisa'}
VRSTA ANKETE: ${vrstaAnkete || 'Procjena rizika'}
JEZIK ANKETE: ${jezik || 'Bosanski'}
${hazards?.length ? `POZNATE OPASNOSTI: ${hazards.join(', ')}` : ''}
${existingPPE?.length ? `POSTOJEĆA OZO: ${existingPPE.join(', ')}` : ''}
${existingEquipment?.length ? `RADNA OPREMA: ${existingEquipment.join(', ')}` : ''}
${sistBlock}

Generiši upitnik fokusiran na '${vrstaAnkete || 'Procjena rizika'}' za ovo radno mjesto, preveden na '${jezik || 'Bosanski'}'.`;

    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192, topP: 0.9, responseMimeType: 'application/json' },
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
                const errText = await res.text();
                return NextResponse.json({ error: `API error ${res.status}: ${errText.substring(0, 200)}` }, { status: 500 });
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';

            // Robust JSON extraction — try multiple strategies
            const tryParse = (str) => {
                // Strategy 1: direct parse
                try { return JSON.parse(str); } catch {}
                // Strategy 2: strip markdown fences
                try {
                    const stripped = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
                    return JSON.parse(stripped);
                } catch {}
                // Strategy 3: extract first { ... } block
                try {
                    const first = str.indexOf('{');
                    const last = str.lastIndexOf('}');
                    if (first !== -1 && last > first) {
                        return JSON.parse(str.substring(first, last + 1));
                    }
                } catch {}
                return null;
            };

            const parsed = tryParse(text);
            if (parsed && parsed.pages) {
                return NextResponse.json({ success: true, surveyJson: parsed, model });
            }

            // If no responseMimeType support, retry without it
            if (!parsed) {
                const geminiBody2 = { ...geminiBody, generationConfig: { ...geminiBody.generationConfig } };
                delete geminiBody2.generationConfig.responseMimeType;
                const res2 = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geminiBody2),
                });
                if (res2.ok) {
                    const data2 = await res2.json();
                    const text2 = data2.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
                    const parsed2 = tryParse(text2);
                    if (parsed2 && parsed2.pages) {
                        return NextResponse.json({ success: true, surveyJson: parsed2, model });
                    }
                }
            }

            if (model === MODELS[MODELS.length - 1]) {
                return NextResponse.json({ error: 'Failed to parse AI response', raw: text.substring(0, 300) }, { status: 500 });
            }
        } catch (err) {
            if (model === MODELS[MODELS.length - 1]) {
                return NextResponse.json({ error: err.message }, { status: 500 });
            }
        }
    }
    return NextResponse.json({ error: 'all_models_failed' }, { status: 500 });
}

