import { NextResponse } from 'next/server';

// ─── AI-Generated Risk Assessment Questionnaire ───
// Takes workplace info + hazards → generates a SurveyJSON questionnaire

// gemini-2.5-flash was the original working model (503 was transient overload).
// gemini-2.0-flash is stable fallback.
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

KORISTI OVE PODATKE za generisanje preciznijih pitanja!` : '';

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPIS: ${workplaceDescription || 'Nema opisa'}
VRSTA ANKETE: ${vrstaAnkete || 'Procjena rizika'}
JEZIK ANKETE: ${jezik || 'Bosanski'}
${hazards?.length ? `POZNATE OPASNOSTI: ${hazards.join(', ')}` : ''}
${existingPPE?.length ? `POSTOJEĆA OZO: ${existingPPE.join(', ')}` : ''}
${existingEquipment?.length ? `RADNA OPREMA: ${existingEquipment.join(', ')}` : ''}
${sistBlock}

Generiši upitnik fokusiran na '${vrstaAnkete || 'Procjena rizika'}' za ovo radno mjesto, preveden na '${jezik || 'Bosanski'}'.`;

    // Robust JSON extraction
    const tryParse = (str) => {
        try { return JSON.parse(str); } catch {}
        try { return JSON.parse(str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); } catch {}
        try {
            const f = str.indexOf('{'), l = str.lastIndexOf('}');
            if (f !== -1 && l > f) return JSON.parse(str.substring(f, l + 1));
        } catch {}
        return null;
    };

    const callGemini = async (model, withMimeType = true) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const genCfg = { temperature: 0.4, maxOutputTokens: 8192, topP: 0.9 };
        if (withMimeType) genCfg.responseMimeType = 'application/json';
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: 'user', parts: [{ text: userMsg }] }],
                generationConfig: genCfg,
            }),
        });
    };

    for (const model of MODELS) {
        try {
            let res = await callGemini(model, true);

            // 503 = transient overload — wait 2s and retry once on the same model
            if (res.status === 503) {
                await sleep(2000);
                res = await callGemini(model, true);
            }

            // 404 = model not available on this API key — try next model
            if (res.status === 404) {
                if (model !== MODELS[MODELS.length - 1]) continue;
                return NextResponse.json({ error: `Model ${model} not available. Contact support.` }, { status: 500 });
            }

            // Other non-ok on non-last model — try next
            if (!res.ok && model !== MODELS[MODELS.length - 1]) continue;

            if (!res.ok) {
                const errText = await res.text();
                return NextResponse.json({ error: `API error ${res.status}: ${errText.substring(0, 300)}` }, { status: 500 });
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
            const parsed = tryParse(text);
            if (parsed?.pages) return NextResponse.json({ success: true, surveyJson: parsed, model });

            // Fallback: retry the same model without responseMimeType
            const res2 = await callGemini(model, false);
            if (res2.ok) {
                const text2 = ((await res2.json()).candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '');
                const parsed2 = tryParse(text2);
                if (parsed2?.pages) return NextResponse.json({ success: true, surveyJson: parsed2, model });
            }

            if (model !== MODELS[MODELS.length - 1]) continue;
            return NextResponse.json({ error: 'Failed to parse AI response', raw: text.substring(0, 300) }, { status: 500 });

        } catch (err) {
            if (model !== MODELS[MODELS.length - 1]) continue;
            return NextResponse.json({ error: err.message }, { status: 500 });
        }
    }
    return NextResponse.json({ error: 'all_models_failed' }, { status: 500 });
}
