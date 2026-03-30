import { NextResponse } from 'next/server';

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'];

export async function POST(request) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { nazivTvrtke, djelatnost, workplaces } = body;

    const systemPrompt = `Ti si vrhunski stručnjak za zaštitu na radu (ZNR) u Bosni i Hercegovini.
Tvoj zadatak je da na osnovu naziva firme, djelatnosti kojom se bavi, i liste radnih mjesta napišeš dva teksta za Procjenu rizika:
1. "Opis tehničko-tehnološkog procesa"
2. "Analiza organizacije rada"

PRAVILA:
- Odgovori ISKLJUČIVO u validnom JSON formatu, bez markdown oznaka i dodatnog teksta.
- Prvi tekst (opisProcesa) treba opisati generalni radni proces, alate i opremu koji se obično koriste u toj djelatnosti, poštujući naznačena radna mjesta. Treba zvučati profesionalno i detaljno.
- Drugi tekst (analizaOrganizacije) treba opisati radno vrijeme, smjenski rad, procedure obuke radnika za siguran rad, ljekarske preglede i općenite Mjere ZNR vezane za organizaciju firme u toj djelatnosti.

OČEKIVANI JSON FORMAT:
{
  "opisProcesa": "Tekst opisa tehničko-tehnološkog procesa...",
  "analizaOrganizacije": "Tekst analize organizacije rada..."
}`;

    const userMsg = `FIRMA: ${nazivTvrtke || 'Nepoznato'}
DJELATNOST: ${djelatnost || 'Nije navedeno'}
RADNA MJESTA U PROCJENI: ${workplaces?.join(', ') || 'Nema navedenih radnih mjesta'}`;

    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 2048, topP: 0.9, responseMimeType: 'application/json' },
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
                return NextResponse.json({ success: true, result: parsed, model });
            } catch {
                return NextResponse.json({ error: 'failed_to_parse_json' }, { status: 500 });
            }
        } catch (err) {
            if (model === MODELS[MODELS.length - 1]) {
                return NextResponse.json({ error: err.message }, { status: 500 });
            }
        }
    }
    return NextResponse.json({ error: 'all_models_failed' }, { status: 500 });
}
