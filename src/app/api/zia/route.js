// ============================================================================
// ZIA API ROUTE — Server-side proxy to Gemini AI
// Bypasses Cloud Run CORS/IAM issues by calling Gemini directly from Vercel
// ============================================================================

export const maxDuration = 60; // Vercel function timeout

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

// Simple in-memory rate limiter
const rateMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function checkRate(ip) {
    const now = Date.now();
    let r = rateMap.get(ip);
    if (!r || now > r.resetAt) r = { count: 0, resetAt: now + RATE_WINDOW };
    r.count++;
    rateMap.set(ip, r);
    return { allowed: r.count <= RATE_LIMIT, waitSec: Math.ceil((r.resetAt - now) / 1000) };
}

export async function POST(request) {
    try {
        // Rate limit
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
        const { allowed, waitSec } = checkRate(ip);
        if (!allowed) {
            return Response.json(
                { error: 'rate_limit', isRateLimit: true, retryAfter: waitSec },
                { status: 429 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json({ error: 'API key not configured' }, { status: 500 });
        }

        const { messages, systemPrompt, tools } = await request.json();
        if (!messages || !systemPrompt) {
            return Response.json({ error: 'Missing messages or systemPrompt' }, { status: 400 });
        }

        // Build Gemini request
        const geminiBody = {
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: messages,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
                topP: 0.95,
            },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            ],
        };

        if (Array.isArray(tools) && tools.length > 0) {
            geminiBody.tools = [{ function_declarations: tools }];
            geminiBody.tool_config = { function_calling_config: { mode: 'AUTO' } };
        }

        // Try models in cascade
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
                    const isRateLimit = res.status === 429 || res.status === 503 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('high demand');
                    const isModelUnavailable = res.status === 404 || errMsg.toLowerCase().includes('not found');
                    const tryNext = (isRateLimit || isModelUnavailable) && model !== MODELS[MODELS.length - 1];
                    if (tryNext) continue;

                    if (isRateLimit) {
                        const match = errMsg.match(/retry in ([\d.]+)s/i);
                        const retryAfter = match ? Math.ceil(parseFloat(match[1])) + 2 : 30;
                        return Response.json(
                            { error: errMsg, isRateLimit: true, retryAfter },
                            { status: 429 }
                        );
                    }
                    return Response.json({ error: errMsg }, { status: 500 });
                }

                const data = await res.json();
                const allParts = data.candidates?.[0]?.content?.parts ?? [];

                const part = allParts.find(p =>
                    !p.thought && (p.functionCall || p.function_call || (p.text != null && p.text !== ''))
                ) ?? allParts.find(p => p.functionCall || p.function_call || p.text)
                    ?? allParts[0];

                const fc = part?.functionCall ?? part?.function_call;
                if (fc) {
                    return Response.json({ result: { function_call: fc, model } });
                }

                const text = part?.text ?? '';
                return Response.json({ result: { text, model } });

            } catch (err) {
                if (model === MODELS[MODELS.length - 1]) {
                    return Response.json({ error: err.message }, { status: 500 });
                }
            }
        }

        return Response.json(
            { error: 'all_models_failed', isRateLimit: true, retryAfter: 30 },
            { status: 503 }
        );
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
