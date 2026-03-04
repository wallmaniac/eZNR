import { NextResponse } from 'next/server';

// ─── Simple in-memory rate limiter (resets on server restart / redeploy) ────
const rateMap = new Map();
const RATE_LIMIT = 20;        // max requests per window per IP
const RATE_WINDOW = 60_000;    // 1 minute window

function checkRate(ip) {
    const now = Date.now();
    let r = rateMap.get(ip);
    if (!r || now > r.resetAt) r = { count: 0, resetAt: now + RATE_WINDOW };
    r.count++;
    rateMap.set(ip, r);
    return { allowed: r.count <= RATE_LIMIT, waitSec: Math.ceil((r.resetAt - now) / 1000) };
}

// ─── Model cascade (fastest / cheapest first as fallback) ────────────────────
const MODELS = ['gemini-2.0-flash-lite', 'gemini-1.5-flash-latest'];

export async function POST(request) {
    // 1. Rate limit by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const { allowed, waitSec } = checkRate(ip);
    if (!allowed) {
        return NextResponse.json({ error: 'rate_limit', isRateLimit: true, retryAfter: waitSec }, { status: 429 });
    }

    // 2. API key — server-only (not exposed to browsers at all)
    const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'not_configured' }, { status: 500 });
    }

    // 3. Parse body
    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

    const { messages, systemPrompt, tools } = body;

    // 4. Build Gemini request body
    const geminiBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1500, topP: 0.95 },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        ],
    };

    if (Array.isArray(tools) && tools.length > 0) {
        geminiBody.tools = [{ function_declarations: tools }];
        geminiBody.tool_config = { function_calling_config: { mode: 'AUTO' } };
    }

    // 5. Try models in cascade
    for (const model of MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiBody),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData.error?.message ?? `API error ${res.status}`;
                const isRateLimit = res.status === 429 || errMsg.toLowerCase().includes('quota');
                if (isRateLimit && model !== MODELS[MODELS.length - 1]) continue; // try next model
                const match = errMsg.match(/retry in ([\d.]+)s/i);
                const retryAfter = match ? Math.ceil(parseFloat(match[1])) + 2 : 30;
                // Always return 429 for rate limits, 500 for all other Gemini errors
                // (never pass through Gemini's raw status like 404 for deprecated models)
                return NextResponse.json(
                    { error: errMsg, isRateLimit, retryAfter },
                    { status: isRateLimit ? 429 : 500 }
                );
            }

            const data = await res.json();
            const part = data.candidates?.[0]?.content?.parts?.[0];

            // Function call response
            if (part?.function_call) {
                return NextResponse.json({ function_call: part.function_call, model });
            }

            // Normal text response
            return NextResponse.json({ text: part?.text ?? '', model });

        } catch (err) {
            if (model === MODELS[MODELS.length - 1]) {
                return NextResponse.json({ error: err.message }, { status: 500 });
            }
        }
    }

    return NextResponse.json({ error: 'all_models_failed', isRateLimit: true, retryAfter: 30 }, { status: 429 });
}
