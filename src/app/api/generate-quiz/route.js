import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════
   POST /api/generate-quiz
   Body: { slides: [{ naslov, sadrzaj }] }
   Returns: { questions: [{ pitanje, opcije, tacno, objasnjenje }] }
   ═══════════════════════════════════════════════ */

export async function POST(request) {
    try {
        const { slides } = await request.json();

        if (!slides || slides.length === 0) {
            return NextResponse.json({ error: 'No slides provided' }, { status: 400 });
        }

        const slideContent = slides
            .map((s, i) => `Slajd ${i + 1}: ${s.naslov || ''}\n${s.sadrzaj || ''}`)
            .join('\n\n---\n\n');

        const numQuestions = Math.min(10, Math.max(3, slides.length * 2));

        const prompt = `Si expert za zaštitu na radu u Bosni i Hercegovini. Na osnovu sljedeće prezentacije, generiraj ${numQuestions} pitanja za provjeru znanja radnika.

Prezentacija:
${slideContent}

Generiraj pitanja u TOČNO ovom JSON formatu (bez ikakvog drugog teksta):
{
  "questions": [
    {
      "pitanje": "Tekst pitanja?",
      "opcije": ["Opcija A", "Opcija B", "Opcija C", "Opcija D"],
      "tacno": 0,
      "objasnjenje": "Kratko objašnjenje zašto je ovaj odgovor tačan."
    }
  ]
}

Pravila:
- Piši na bosanskom/srpskom/hrvatskom jeziku
- Svako pitanje mora imati TOČNO 4 opcije
- "tacno" je indeks (0, 1, 2 ili 3) tačnog odgovora
- Pitanja trebaju direktno testirati znanje iz prezentacije
- Tačan odgovor ne treba uvijek biti na istoj poziciji — miješaj pozicije
- Neka pitanja budu direktna, neka zahtijevaju razumijevanje
- Vrati SAMO JSON, bez komentara ili backtick oznaka`;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.6,
                        maxOutputTokens: 3000,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('Gemini error:', err);
            return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        // Clean and parse JSON
        const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
        let parsed;
        try {
            parsed = JSON.parse(cleanJson);
        } catch {
            // Try to extract JSON from response
            const match = cleanJson.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { questions: [] };
        }

        return NextResponse.json({
            questions: parsed.questions || [],
            count: (parsed.questions || []).length,
        });
    } catch (err) {
        console.error('Generate quiz error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
