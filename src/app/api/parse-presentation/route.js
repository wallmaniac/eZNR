import { NextResponse } from 'next/server';

/* ─── Node.js polyfills for pdfjs-dist browser APIs ─────────────────────────
   pdfjs-dist uses DOMMatrix/Path2D/ImageData even in text-only extraction.
   These stubs satisfy the dependency without actual rendering. */
if (typeof globalThis.DOMMatrix === 'undefined') {
    globalThis.DOMMatrix = class DOMMatrix {
        constructor() {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
            this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
            this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
            this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
            this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
            this.is2D = true; this.isIdentity = true;
        }
        transformPoint(p) { return { x: p?.x || 0, y: p?.y || 0, z: 0, w: 1 }; }
        multiply() { return new globalThis.DOMMatrix(); }
        inverse() { return new globalThis.DOMMatrix(); }
        translate() { return new globalThis.DOMMatrix(); }
        scale() { return new globalThis.DOMMatrix(); }
        rotate() { return new globalThis.DOMMatrix(); }
        toString() { return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`; }
        static fromFloat64Array() { return new globalThis.DOMMatrix(); }
        static fromMatrix() { return new globalThis.DOMMatrix(); }
    };
}
if (typeof globalThis.Path2D === 'undefined') {
    globalThis.Path2D = class Path2D {
        constructor() {}
        moveTo() {} lineTo() {} bezierCurveTo() {} rect() {}
        arc() {} closePath() {} addPath() {}
    };
}
if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class ImageData {
        constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
    };
}

/* ═══════════════════════════════════════════════════════════
   POST /api/parse-presentation
   Body: FormData with field "file" (PDF or PPTX)
   
   PPTX → extract slides directly from XML (structure preserved)
   PDF  → extract text → Gemini generates structured slides
   
   Returns: { slides: [{ naslov, sadrzaj }], source: 'pptx'|'pdf-ai'|'pdf-raw' }
   ═══════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileName = (file.name || '').toLowerCase();
        const buffer = Buffer.from(await file.arrayBuffer());
        let slides = [];
        let source = '';

        if (fileName.endsWith('.pptx')) {
            // PPTX — extract structure directly from XML
            slides = await parsePPTX(buffer);
            source = 'pptx';
        } else if (fileName.endsWith('.pdf')) {
            // PDF — extract text, then use Gemini to create slides
            const rawText = await extractPDFText(buffer);
            if (!rawText || rawText.trim().length < 50) {
                return NextResponse.json({
                    error: 'PDF ne sadrži tekst (možda je skeniran dokument bez OCR-a).',
                }, { status: 400 });
            }
            const geminiResult = await generateSlidesFromText(rawText, file.name);
            if (geminiResult && geminiResult.length > 0) {
                slides = geminiResult;
                source = 'pdf-ai';
            } else {
                // Fallback: basic page split without AI
                slides = rawTextToSlides(rawText);
                source = 'pdf-raw';
            }
        } else if (fileName.endsWith('.ppt')) {
            return NextResponse.json({
                error: 'Stari .ppt format nije podržan. Otvorite u PowerPointu i sačuvajte kao .pptx',
            }, { status: 400 });
        } else {
            return NextResponse.json({
                error: 'Nepodržan format. Prihvatamo .pdf i .pptx fajlove.',
            }, { status: 400 });
        }

        if (slides.length === 0) {
            return NextResponse.json({
                error: 'Nije moguće izvući sadržaj iz fajla.',
            }, { status: 400 });
        }

        return NextResponse.json({ slides, count: slides.length, source });
    } catch (err) {
        console.error('Parse presentation error:', err);
        return NextResponse.json({
            error: 'Greška pri obradi fajla: ' + (err.message || 'Nepoznata greška'),
        }, { status: 500 });
    }
}

// ─── PDF: Extract raw text ────────────────────────────────────────────────────
async function extractPDFText(buffer) {
    let pdfParse;
    try {
        pdfParse = require('pdf-parse');
    } catch {
        pdfParse = (await import('pdf-parse')).default;
    }
    const result = await pdfParse(buffer);
    return result.text || '';
}

// ─── PDF: Gemini generates structured slides from text ───────────────────────
async function generateSlidesFromText(text, filename) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key not configured');

    // Trim to avoid token limits — 12000 chars is plenty for Gemini to work with
    const trimmedText = text.trim().slice(0, 12000);
    const wordCount = trimmedText.split(/\s+/).length;
    const targetSlides = Math.min(15, Math.max(4, Math.round(wordCount / 120)));

    const prompt = `Ti si ekspert za zaštitu na radu u Bosni i Hercegovini. Dobio si tekst dokumenta koji treba pretvoriti u edukativan materijal za radnike.

Tekst dokumenta:
---
${trimmedText}
---

Na osnovu ovog teksta, kreiraj ${targetSlides} edukativnih slajdova za prezentaciju. 
Svaki slajd treba sadržavati:
- naslov: kratki, jasni naslov slajda (1 rečenica)
- sadrzaj: ključne informacije u obliku bullet tačaka (3-7 tačaka po slajdu), napisane jasno za radnike

Pravila:
- Piši na bosanskom/srpskom/hrvatskom jeziku
- Fokusiraj se na informacije koje su VAŽNE za radnika
- Grupiši srodne informacije na isti slajd
- Koristiti kratke, jasne rečenice
- Svaka bullet tačka neka počne sa • ili - ili brojem
- Vrati SAMO JSON, bez komentara

Format (samo ovo, bez ikakvog drugog teksta):
{
  "slides": [
    {
      "naslov": "Naziv prvog slajda",
      "sadrzaj": "• Prva ključna informacija\\n• Druga ključna informacija\\n• Treća ključna informacija"
    }
  ]
}`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 4000,
                    responseMimeType: 'application/json',
                },
            }),
        }
    );

    if (!response.ok) {
        console.error('Gemini API error:', await response.text());
        return null;
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    let parsed;
    try {
        const clean = rawText.replace(/```json\n?|\n?```/g, '').trim();
        parsed = JSON.parse(clean);
    } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed?.slides?.length) return null;

    return parsed.slides.map(s => ({
        id: genId(),
        naslov: (s.naslov || '').trim(),
        sadrzaj: (s.sadrzaj || '').trim(),
    }));
}

// ─── PDF fallback: basic page-break split ────────────────────────────────────
function rawTextToSlides(text) {
    let pages = text.split(/\f/).map(p => p.trim()).filter(Boolean);

    if (pages.length <= 1) {
        const chunks = text.split(/\n{3,}/).map(p => p.trim()).filter(Boolean);
        if (chunks.length > 1) pages = chunks;
    }

    if (pages.length === 0) pages = [text];

    return pages
        .filter(p => p.length > 0)
        .map((page, i) => {
            const lines = page.split('\n').map(l => l.trim()).filter(Boolean);
            const naslov = lines[0] || `Slajd ${i + 1}`;
            const sadrzaj = lines.slice(1).join('\n').trim();
            return { id: genId(), naslov, sadrzaj };
        });
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
    for (const slideFile of slideFiles) {
        const xml = await zip.files[slideFile].async('string');
        const slide = extractSlideText(xml);
        if (slide.naslov || slide.sadrzaj) {
            slides.push({ id: genId(), ...slide });
        }
    }
    return slides;
}

// ─── PPTX: extract text from one slide's XML ─────────────────────────────────
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
                    .map(s => s
                        .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'").replace(/&#xA;/g, '\n'))
                    .join('');
            })
            .filter(Boolean).join('\n').trim();

        if (!shapeText) continue;

        if (isTitle) titleText = shapeText;
        else if (isSubtitle) bodyTexts.unshift(shapeText);
        else bodyTexts.push(shapeText);
    }

    if (!titleText && bodyTexts.length > 0) {
        titleText = bodyTexts.shift() || '';
    }

    return {
        naslov: titleText.replace(/\n+/g, ' ').trim(),
        sadrzaj: bodyTexts.join('\n\n').trim(),
    };
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
