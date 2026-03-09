import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════
   POST /api/parse-presentation
   PDF  → base64 inline to Gemini 2.0 Flash (native PDF support)
   PPTX → direct XML text extraction via jszip
   ═══════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        const fileName = (file.name || '').toLowerCase();
        const buffer = Buffer.from(await file.arrayBuffer());

        if (fileName.endsWith('.pptx')) {
            const slides = await parsePPTX(buffer);
            if (!slides?.length) return NextResponse.json({ error: 'Nema slajdova u PPTX fajlu.' }, { status: 400 });
            return NextResponse.json({ slides, count: slides.length, source: 'pptx' });
        }

        if (fileName.endsWith('.pdf')) {
            if (buffer.length > 15 * 1024 * 1024) {
                return NextResponse.json({ error: 'PDF prevelik (max 15 MB).' }, { status: 400 });
            }
            const slides = await pdfToSlides(buffer);
            if (!slides?.length) return NextResponse.json({ error: 'Nije moguće kreirati slajdove iz PDF-a.' }, { status: 400 });
            return NextResponse.json({ slides, count: slides.length, source: 'pdf-ai' });
        }

        if (fileName.endsWith('.ppt')) {
            return NextResponse.json({ error: 'Stari .ppt nije podržan. Sačuvajte kao .pptx.' }, { status: 400 });
        }

        return NextResponse.json({ error: 'Nepodržan format. Koristite .pdf ili .pptx' }, { status: 400 });
    } catch (err) {
        console.error('Parse error:', err);
        return NextResponse.json({ error: err.message || 'Nepoznata greška' }, { status: 500 });
    }
}

// ─── PDF → Gemini 2.0 Flash (inline base64) ──────────────────────────────────
async function pdfToSlides(buffer) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const base64 = buffer.toString('base64');

    const prompt = `Ti si ekspert za zaštitu na radu u BiH. Pročitaj ovaj PDF i kreiraj 5-15 edukativnih slajdova za radnike.

Svaki slajd: naslov (max 10 riječi) + sadrzaj (3-7 bullet tačaka sa •).
Piši na bosanskom jeziku. Fokus na informacije bitne za radnike.

Vrati SAMO JSON:
{"slides":[{"naslov":"...","sadrzaj":"• ...\\n• ..."}]}`;

    const body = {
        contents: [{
            parts: [
                {
                    inline_data: {
                        mime_type: 'application/pdf',
                        data: base64,
                    },
                },
                { text: prompt },
            ],
        }],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
        },
    };

    // Try models in priority order
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let lastError = '';

    for (const model of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const slides = parseJsonSlides(text);
            if (slides.length > 0) return slides;
            lastError = 'Gemini vratio prazan odgovor';
            continue;
        }

        const errBody = await res.text();
        console.error(`[${model}] ${res.status}:`, errBody.substring(0, 500));
        lastError = `${model}: ${res.status}`;

        // If 404 or unsupported, try next model
        if (res.status === 404 || res.status === 400) continue;
        // Other errors (500, 429, etc) — fail immediately
        throw new Error(`Gemini greška (${res.status})`);
    }

    // Both models failed — try text-only approach as last resort
    console.log('PDF inline failed, trying text extraction fallback...');
    return await pdfTextFallback(buffer, apiKey);
}

// ─── Fallback: extract raw text from PDF, then send to Gemini as text ────────
async function pdfTextFallback(buffer, apiKey) {
    // Quick and dirty PDF text extraction (no external library)
    // PDF text is stored between BT...ET blocks, in Tj and TJ operators
    const pdfStr = buffer.toString('latin1');
    const textChunks = [];

    // Extract text from decoded streams (simple approach)
    const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
    let match;
    while ((match = streamRegex.exec(pdfStr)) !== null) {
        const content = match[1];
        // Look for text operations
        const tjMatches = content.match(/\(([^)]*)\)\s*Tj/g) || [];
        for (const tj of tjMatches) {
            const text = tj.replace(/\(|\)\s*Tj/g, '').trim();
            if (text.length > 1) textChunks.push(text);
        }
    }

    // Also try simpler extraction — just find readable strings
    if (textChunks.length < 10) {
        const readable = pdfStr.match(/[\x20-\x7E\xC0-\xFF]{10,}/g) || [];
        const filtered = readable.filter(s =>
            !s.includes('/') && !s.includes('<<') && !s.includes('>>') &&
            !s.includes('obj') && !s.includes('endobj') && !s.includes('stream') &&
            !s.startsWith('%') && s.length < 500
        );
        textChunks.push(...filtered);
    }

    const extractedText = textChunks.join('\n').substring(0, 10000);

    if (extractedText.trim().length < 50) {
        throw new Error('PDF ne sadrži čitljiv tekst (možda skeniran bez OCR-a)');
    }

    // Send extracted text to Gemini 2.0 Flash (text works for sure)
    const prompt = `Kreiraj 5-15 edukativnih slajdova za radnike iz ovog teksta. Piši na bosanskom.
Svaki slajd: naslov (max 10 riječi) + sadrzaj (3-7 bullet tačaka sa •).

Tekst:
${extractedText}

Vrati SAMO JSON: {"slides":[{"naslov":"...","sadrzaj":"• ...\\n• ..."}]}`;

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4096,
                    responseMimeType: 'application/json',
                },
            }),
        }
    );

    if (!res.ok) throw new Error(`Gemini text fallback: ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseJsonSlides(text);
}

// ─── Parse JSON slides from Gemini response ──────────────────────────────────
function parseJsonSlides(text) {
    if (!text) return [];
    try {
        const clean = text.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(clean);
        if (parsed?.slides?.length) {
            return parsed.slides.map(s => ({
                id: genId(),
                naslov: (s.naslov || '').trim(),
                sadrzaj: (s.sadrzaj || '').trim(),
            }));
        }
    } catch {
        try {
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                if (parsed?.slides?.length) {
                    return parsed.slides.map(s => ({
                        id: genId(),
                        naslov: (s.naslov || '').trim(),
                        sadrzaj: (s.sadrzaj || '').trim(),
                    }));
                }
            }
        } catch { /* give up */ }
    }
    return [];
}

// ─── PPTX Parser ─────────────────────────────────────────────────────────────
async function parsePPTX(buffer) {
    const JSZipModule = await import('jszip');
    const JSZip = JSZipModule.default || JSZipModule;
    const zip = await JSZip.loadAsync(buffer);

    const slideFiles = Object.keys(zip.files)
        .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
            const nA = parseInt((a.match(/\d+/) || ['0'])[0]);
            const nB = parseInt((b.match(/\d+/) || ['0'])[0]);
            return nA - nB;
        });

    const slides = [];
    for (const sf of slideFiles) {
        const xml = await zip.files[sf].async('string');
        const slide = extractSlideText(xml);
        if (slide.naslov || slide.sadrzaj) slides.push({ id: genId(), ...slide });
    }
    return slides;
}

function extractSlideText(xml) {
    const shapes = xml.match(/<p:sp[\s\S]*?<\/p:sp>/g) || [];
    let titleText = '';
    const bodyTexts = [];

    for (const shape of shapes) {
        const isTitle = /<p:ph[^>]*\s+type="(?:title|ctrTitle)"/.test(shape);
        const isSubtitle = /<p:ph[^>]*\s+type="subTitle"/.test(shape);

        const paragraphs = shape.match(/<a:p[\s\S]*?<\/a:p>/g) || [];
        const shapeText = paragraphs
            .map(para => {
                const runs = para.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
                return runs
                    .map(r => r.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, ''))
                    .map(s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#xA;/g, '\n'))
                    .join('');
            })
            .filter(Boolean).join('\n').trim();

        if (!shapeText) continue;
        if (isTitle) titleText = shapeText;
        else if (isSubtitle) bodyTexts.unshift(shapeText);
        else bodyTexts.push(shapeText);
    }

    if (!titleText && bodyTexts.length > 0) titleText = bodyTexts.shift() || '';

    return {
        naslov: titleText.replace(/\n+/g, ' ').trim(),
        sadrzaj: bodyTexts.join('\n\n').trim(),
    };
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
