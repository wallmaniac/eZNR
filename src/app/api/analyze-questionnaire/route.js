import { NextResponse } from 'next/server';

// ─── Analyze Questionnaire Responses → Risk Items ───
// Takes questionnaire responses + workplace → returns structured risk items with V/P scores

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

export async function POST(request) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { workplaceName, surveyJson, responses } = body;

    // Parse surveyJson — could be a string or object, in SurveyJS or native format
    let allQuestions = [];
    try {
        const sj = typeof surveyJson === 'string' ? JSON.parse(surveyJson || '{}') : (surveyJson || {});
        if (sj.questions && Array.isArray(sj.questions)) {
            // Native builder format { questions: [] }
            allQuestions = sj.questions.filter(q => q.type !== 'heading' && q.type !== 'html');
        } else if (sj.pages && Array.isArray(sj.pages)) {
            // SurveyJS format { pages: [{ elements: [] }] }
            allQuestions = sj.pages.flatMap(p => p.elements || []);
        }
    } catch { /* ignore parse errors */ }
    
    let responseSummary = '';
    if (Array.isArray(responses) && responses.length > 0) {
        // Aggregate all responses
        const latest = responses[responses.length - 1]; // most recent
        const answers = latest?.answers || latest?.data || latest || {};
        responseSummary = allQuestions.map(q => {
            const qId = q.id || q.name;
            const ans = answers[qId];
            return `Q: ${q.title || q.name || qId}\nA: ${ans !== undefined ? (Array.isArray(ans) ? ans.join(', ') : ans) : 'Bez odgovora'}`;
        }).join('\n\n');
    } else {
        // No responses yet — just list the questions
        responseSummary = allQuestions.map(q => `Q: ${q.title || q.name || q.id}\nA: (nema odgovora)`).join('\n\n');
    }
    
    if (allQuestions.length === 0) {
        responseSummary = `Radno mjesto: ${workplaceName || 'Nepoznato'}\nNapomena: Nema pitanja iz upitnika. Generiši generičke stavke procjene rizika za ovo radno mjesto.`;
    }

    const systemPrompt = `Ti si stručnjak za zaštitu na radu (ZNR) u Bosni i Hercegovini.
Analiziraš odgovore iz upitnika radnika i generišeš stavke procjene rizika.

ZADATAK: Na osnovu odgovora iz upitnika, identifikuj sve opasnosti i štetnosti na radnom mjestu i za svaku procijeni vjerovatnoću (V) i posljedicu (P) na skali 1-5.

PRAVILA:
- Odgovori ISKLJUČIVO u JSON formatu
- Za svaku identifikovanu opasnost kreiraj zasebnu stavku
- Procijeni V (1-5) i P (1-5) na osnovu odgovora radnika
- Ako radnik navede da nema obuku ili opremu → veći V
- Ako radnik navede opasne situacije → veći P
- Predloži i postojeće mjere (iz odgovora) i dodatne predložene mjere
- Generiši 3-10 stavki, ovisno o kompleksnosti radnog mjesta

JSON FORMAT:
{
  "items": [
    {
      "opisOpasnosti": "Opis opasnosti",
      "kategorija": "fizička|kemijska|biološka|ergonomska|psihosocijalna|mehanička|električna",
      "vjerovatnoca": 3,
      "posljedica": 4,
      "postojeceMjere": "Mjere koje su već na snazi prema odgovorima",
      "predlozeneMjere": "Dodatne preporučene mjere",
      "vjerovatnocaNakon": 2,
      "posljedlicaNakon": 3,
      "rokProvedbe": "30|60|90|180",
      "obrazlozenje": "Kratko obrazloženje"
    }
  ],
  "ukupniKomentar": "Kratki sažetak analize upitnika"
}`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}

ODGOVORI IZ UPITNIKA:
${responseSummary}

Analiziraj odgovore i generiši stavke procjene rizika.`;

    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096, topP: 0.9, responseMimeType: 'application/json' },
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
                return NextResponse.json({ success: true, analysis: parsed, model });
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
