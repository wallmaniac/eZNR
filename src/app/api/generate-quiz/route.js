import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════
   POST /api/generate-quiz
   Body: { slides: [{ naslov, sadrzaj }] }
   Returns: { questions: [{ pitanje, opcije, tacno, objasnjenje }] }
   ═══════════════════════════════════════════════ */

const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(request) {
    try {
        const { slides } = await request.json();

        if (!slides || slides.length === 0) {
            return NextResponse.json({ error: 'No slides provided' }, { status: 400 });
        }

        const slideContent = slides
            .map((s, i) => `Slajd ${i + 1}: ${s.naslov || ''}\n${s.sadrzaj || ''}`)
            .join('\n\n---\n\n');

        const numQuestions = Math.min(15, Math.max(5, slides.length * 2));

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
- VRLO VAŽNO: Tačan odgovor MORA biti ravnomjerno raspoređen — otprilike jednako pitanja sa tacno=0, tacno=1, tacno=2 i tacno=3. NIKAKO ne stavljaj tačan odgovor uvijek na istu poziciju!
- Neka pitanja budu direktna, neka zahtijevaju razumijevanje
- Vrati SAMO JSON, bez komentara ili backtick oznaka`;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.6,
                        maxOutputTokens: 16384,
                        thinkingConfig: { thinkingBudget: 0 },
                    },
                }),
            }
        );

        if (!response.ok) {
            const err = await response.text();
            console.error('Gemini error:', response.status, err.substring(0, 300));
            return NextResponse.json({ error: `Gemini API error (${response.status})` }, { status: 500 });
        }

        const data = await response.json();

        // Collect text from all parts (gemini-2.5-flash may have multiple)
        const allParts = data.candidates?.[0]?.content?.parts || [];
        const text = allParts.filter(p => p.text).map(p => p.text).join('\n');

        // Parse JSON — robust handling
        const parsed = parseQuizJson(text);

        // Post-process: shuffle options in each question to ensure diverse correct answer positions
        const shuffled = parsed.map(q => {
            const correctAnswer = q.opcije[q.tacno];
            // Fisher-Yates shuffle on options
            const indexed = q.opcije.map((opt, i) => ({ opt, wasCorrect: i === q.tacno }));
            for (let i = indexed.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
            }
            return {
                ...q,
                opcije: indexed.map(x => x.opt),
                tacno: indexed.findIndex(x => x.wasCorrect),
            };
        });

        return NextResponse.json({
            questions: shuffled,
            count: shuffled.length,
        });
    } catch (err) {
        console.error('Generate quiz error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

function parseQuizJson(text) {
    if (!text) return [];

    // Strip markdown fences
    let clean = text
        .replace(/^[\s\S]*?```json\s*/i, '')
        .replace(/```[\s\S]*$/, '')
        .trim();

    if (!clean.startsWith('{') && !clean.startsWith('[')) {
        clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    if (!clean.startsWith('{')) {
        const idx = clean.indexOf('{"questions"');
        if (idx >= 0) clean = clean.substring(idx);
        else {
            const idx2 = clean.indexOf('{');
            if (idx2 >= 0) clean = clean.substring(idx2);
        }
    }

    // Try full parse
    try {
        const parsed = JSON.parse(clean);
        if (parsed?.questions?.length) return parsed.questions;
    } catch { /* try regex */ }

    // Regex extraction for individual question objects
    const questions = [];
    const qRegex = /"pitanje"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"opcije"\s*:\s*\[((?:[^\]]*?))\]\s*,\s*"tacno"\s*:\s*(\d+)\s*,\s*"objasnjenje"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = qRegex.exec(clean)) !== null) {
        const opcije = m[2].match(/"((?:[^"\\]|\\.)*)"/g)?.map(s => s.replace(/^"|"$/g, '').replace(/\\(.)/g, '$1')) || [];
        if (opcije.length === 4) {
            questions.push({
                pitanje: m[1].replace(/\\(.)/g, '$1'),
                opcije,
                tacno: parseInt(m[3]),
                objasnjenje: m[4].replace(/\\(.)/g, '$1'),
            });
        }
    }

    return questions;
}
