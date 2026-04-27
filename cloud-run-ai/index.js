import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger payloads for ZIA if needed

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];

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
    // Cleanup simple
    if (rateMap.size > 500) {
        for (const [k, v] of rateMap) if (now > v.resetAt) rateMap.delete(k);
    }
    return { allowed: r.count <= RATE_LIMIT, waitSec: Math.ceil((r.resetAt - now) / 1000) };
}

// ── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'eZNR Cloud Run AI Service' });
});

// ── RISK AI ENDPOINT ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT_RISK = `Ti si stručnjak za zaštitu na radu u Bosni i Hercegovini (FBiH). Tvoj zadatak je da na osnovu naziva radnog mjesta i opisa poslova (ukoliko je dostupan) izradiš nacrt tabele Opasnosti i štetnosti (Procjena rizika) u skladu s metodologijom 5x5.
Za svaku prepoznatu opasnost ili štetnost definiši tipičnu Vjerovatnoću (1-5), Posljedicu (1-5) i predložene mjere zaštite na radu.
Fokusiraj se na realne, specifične opasnosti za to radno mjesto. Generiši između 8 i 15 najvažnijih opasnosti.`;

const hazardSchema = {
    type: "OBJECT",
    properties: {
        items: {
            type: "ARRAY",
            description: "Lista opasnosti i štetnosti za radno mjesto",
            items: {
                type: "OBJECT",
                properties: {
                    opisOpasnosti: { type: "STRING", description: "Konkretan opis opasnosti ili štetnosti" },
                    vjerovatnoca: { type: "INTEGER", description: "Vjerovatnoća 1-5" },
                    posljedica: { type: "INTEGER", description: "Posljedica 1-5" },
                    postojeceMjere: { type: "STRING", description: "Standardne postojeće mjere (ako ih obično ima na ovom poslu)" },
                    predlozeneMjere: { type: "STRING", description: "Predložene dodatne mjere prevencije" },
                    vjerovatnocaNakon: { type: "INTEGER", description: "Očekivana vjerovatnoća nakon primjene mjera (1-5)" },
                    posljedlicaNakon: { type: "INTEGER", description: "Očekivana posljedica nakon primjene mjera (1-5)" }
                },
                required: ["opisOpasnosti", "vjerovatnoca", "posljedica", "postojeceMjere", "predlozeneMjere", "vjerovatnocaNakon", "posljedlicaNakon"]
            }
        }
    },
    required: ["items"]
};

app.post('/api/risk-ai', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
    const { allowed, waitSec } = checkRate(ip);
    if (!allowed) {
        return res.status(429).set('Retry-After', String(waitSec)).json({ error: 'rate_limit', retryAfter: waitSec });
    }

    try {
        const { jobTitle, companyName, industry } = req.body;
        let prompt = `Kreiraj procjenu rizika za radno mjesto: "${jobTitle}".\n`;
        if (companyName) prompt += `Kompanija: ${companyName}\n`;
        if (industry) prompt += `Djelatnost: ${industry}\n`;

        let lastErrStr = null;

        for (const model of MODELS) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const geminiBody = {
                    system_instruction: { parts: [{ text: SYSTEM_PROMPT_RISK }] },
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: hazardSchema,
                    }
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geminiBody),
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    let msg = errData.error?.message ?? `API error ${response.status}`;
                    
                    if (response.status === 503 || response.status === 429 || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overloaded')) {
                        msg = 'AI serveri su trenutno preopterećeni zbog velike potražnje. Molimo pokušajte ponovo za par minuta.';
                    }

                    if (model !== MODELS[MODELS.length - 1]) {
                        lastErrStr = msg;
                        continue;
                    }
                    throw new Error(msg);
                }

                const data = await response.json();
                const allParts = data.candidates?.[0]?.content?.parts ?? [];
                const outputText = allParts.find(p => !p.thought && p.text)?.text ?? allParts.find(p => p.text)?.text;

                if (!outputText) throw new Error("No output text from Gemini");

                const jsonResponse = JSON.parse(outputText);
                return res.status(200).json(jsonResponse);

            } catch (err) {
                if (model === MODELS[MODELS.length - 1]) throw err;
                lastErrStr = err.message;
            }
        }
    } catch (error) {
        console.error('API /api/risk-ai error:', error);
        return res.status(500).json({ error: error.message });
    }
});


// ── ZIA AI ASSISTANT ENDPOINT ────────────────────────────────────────────────

app.post('/api/zia', async (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
    const { allowed, waitSec } = checkRate(ip);
    
    if (!allowed) {
        return res.status(429).json({ error: 'rate_limit', isRateLimit: true, retryAfter: waitSec });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    try {
        const { messages, systemPrompt, tools } = req.body;
        if (!messages || !systemPrompt) {
            return res.status(400).json({ error: 'Missing messages or systemPrompt' });
        }

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

        for (const model of MODELS) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(geminiBody),
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    const errMsg = errData.error?.message ?? `API error ${response.status}`;
                    const isRateLimit = response.status === 429 || response.status === 503 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('high demand');
                    const isModelUnavailable = response.status === 404 || errMsg.toLowerCase().includes('not found');
                    const tryNext = (isRateLimit || isModelUnavailable) && model !== MODELS[MODELS.length - 1];
                    
                    if (tryNext) continue;

                    if (isRateLimit) {
                        const match = errMsg.match(/retry in ([\d.]+)s/i);
                        const retryAfter = match ? Math.ceil(parseFloat(match[1])) + 2 : 30;
                        return res.status(429).json({ 
                            error: 'AI serveri su trenutno preopterećeni zbog velike potražnje. Molimo pokušajte ponovo za par minuta.', 
                            isRateLimit: true, 
                            retryAfter 
                        });
                    }
                    return res.status(500).json({ error: errMsg });
                }

                const data = await response.json();
                const allParts = data.candidates?.[0]?.content?.parts ?? [];

                const functionCallPart = allParts.find(p => p.functionCall || p.function_call);
                const textPart = allParts.find(p => !p.thought && !p.functionCall && !p.function_call && p.text != null && p.text.trim() !== '');

                const fc = functionCallPart?.functionCall ?? functionCallPart?.function_call;
                if (fc) {
                    return res.status(200).json({ result: { function_call: fc, model } });
                }

                const text = textPart?.text ?? '';
                return res.status(200).json({ result: { text, model } });

            } catch (err) {
                if (model === MODELS[MODELS.length - 1]) {
                    return res.status(500).json({ error: err.message });
                }
            }
        }

        return res.status(503).json({ error: 'all_models_failed', isRateLimit: true, retryAfter: 30 });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 eZNR Cloud Run AI Service mapped to port ${port}`);
});

// Trigger deploy
