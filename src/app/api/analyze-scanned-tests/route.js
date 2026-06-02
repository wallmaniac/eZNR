/**
 * /api/analyze-scanned-tests/route.js
 *
 * Server-side Gemini proxy for scanned test processing.
 * - Extracts workers' names, test dates, and types from scanned PDFs or images.
 * - Keeps Gemini API key server-side.
 * - Multi-model fallback mechanism.
 */

export const maxDuration = 60; // 60-second timeout

const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
];

async function callGemini(model, systemPrompt, base64Data, mimeType, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [
            {
                role: 'user',
                parts: [
                    { text: 'Extract all workers from the uploaded scanned test document.' },
                    {
                        inline_data: {
                            mime_type: mimeType || 'application/pdf',
                            data: base64Data
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const isRetryable = res.status === 503 || res.status === 429 || res.status >= 500 || res.status === 404;
        const err = new Error(`Model ${model} vratio ${res.status}`);
        err.retryable = isRetryable;
        throw err;
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error(`Model ${model} nije vratio sadrzaj.`);

    const parsed = JSON.parse(text);
    if (!parsed || !parsed.workers) throw new Error(`Model ${model} vratio neispravan JSON.`);

    return parsed;
}

export async function POST(req) {
    try {
        const { base64Data, mimeType } = await req.json();

        if (!base64Data) {
            return Response.json({ success: false, error: 'Nedostaju podaci datoteke.' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json({ success: false, error: 'Gemini API ključ nije konfigurisan.' }, { status: 500 });
        }

        const systemPrompt = `You are an expert AI document parser specializing in scanned occupational safety and fire protection tests from Bosnia and Herzegovina and Croatia.
Your task is to analyze the uploaded scanned test document and extract the list of ALL workers who took the test.

RULES:
1. Return ONLY the JSON object, absolutely no markdown formatting (no \`\`\`json) or other text.
2. Sadržaj mora početi sa { i završiti sa }.
3. Extract each worker's name (extractedName), the date of the test (date, in YYYY-MM-DD format or null), the type of test (type: "ZNR", "ZOP", or null), and whether they passed (passed: boolean, default true).
4. Be very thorough. Read handwritten text carefully. A document may contain multiple test sheets for different workers. Extract EVERY worker.

JSON FORMAT:
{
  "workers": [
    {
      "extractedName": "Ime i Prezime",
      "date": "YYYY-MM-DD",
      "type": "ZNR",
      "passed": true
    }
  ]
}`;

        let lastError = null;

        for (const model of MODELS) {
            let retries = 2;
            let delay = 1000;

            while (retries > 0) {
                try {
                    const parsed = await callGemini(model, systemPrompt, base64Data, mimeType, apiKey);
                    return Response.json({ success: true, workers: parsed.workers, model });
                } catch (err) {
                    lastError = err;
                    if (err.retryable && retries > 1) {
                        await new Promise(r => setTimeout(r, delay));
                        delay *= 2;
                        retries--;
                    } else {
                        break;
                    }
                }
            }
        }

        return Response.json({
            success: false,
            error: lastError?.message || 'Svi AI modeli su trenutno nedostupni.',
        }, { status: 503 });

    } catch (err) {
        console.error('[analyze-scanned-tests] Error:', err.message);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
