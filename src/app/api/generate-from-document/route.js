import { NextResponse } from 'next/server';

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];

export async function POST(request) {
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'not_configured' }, { status: 500 });

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { systemPrompt, userPrompt, base64Document, mimeType } = body;

    if (!userPrompt) {
        return NextResponse.json({ error: 'userPrompt_required' }, { status: 400 });
    }

    const parts = [];
    if (base64Document && mimeType) {
        parts.push({
            inlineData: {
                data: base64Document,
                mimeType: mimeType
            }
        });
    }
    parts.push({ text: userPrompt });

    const geminiBody = {
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: [{ role: 'user', parts }],
        generationConfig: { 
            temperature: 0.2, 
            maxOutputTokens: 8192, 
            topP: 0.9, 
            responseMimeType: 'application/json' 
        },
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
