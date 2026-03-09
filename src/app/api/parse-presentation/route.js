import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════
   POST /api/parse-presentation
   Body: FormData with field "file" (PDF or PPTX)

   PDF  → sent directly to Gemini 2.0 Flash as base64
           Gemini reads the PDF natively and generates slides
   PPTX → extract slides directly from XML (no AI needed)

   Returns: { slides: [{ id, naslov, sadrzaj }], source, count }
   ═══════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

// Max PDF size to send to Gemini (15MB encoded is safe)
const MAX_PDF_MB = 15;

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
            slides = await parsePPTX(buffer);
            source = 'pptx';

        } else if (fileName.endsWith('.pdf')) {
            const sizeMB = buffer.length / (1024 * 1024);
            if (sizeMB > MAX_PDF_MB) {
                return NextResponse.json({
                    error: `PDF je prevelik (${sizeMB.toFixed(1)} MB). Maksimalno ${MAX_PDF_MB} MB.`,
                }, { status: 400 });
            }
            slides = await generateSlidesFromPDF(buffer, file.name);
            source = 'pdf-ai';

        } else if (fileName.endsWith('.ppt')) {
            return NextResponse.json({
                error: 'Stari .ppt format nije podržan. Otvorite u PowerPointu i sačuvajte kao .pptx',
            }, { status: 400 });

        } else {
            return NextResponse.json({
                error: 'Nepodržan format. Prihvatamo .pdf i .pptx fajlove.',
            }, { status: 400 });
        }

        if (!slides || slides.length === 0) {
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

// ─── PDF → Gemini (reads PDF natively as inline base64) ──────────────────────
async function generateSlidesFromPDF(buffer, filename) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key nije konfiguriran');

    const base64Data = buffer.toString('base64');

    const prompt = `Ti si ekspert za zaštitu na radu u Bosni i Hercegovini. Pročitaj ovaj PDF dokument i kreiraj edukativan materijal za radnike u obliku slajdova prezentacije.

Kreiraj između 5 i 15 slajdova koji pokrivaju najvažnije informacije iz dokumenta.
Svaki slajd treba imati:
- naslov: kratki, jasni naslov (1 rečenica, max 10 riječi)
- sadrzaj: ključne informacije kao bullet tačke (3-7 tačaka), svaka počinje sa • 

Pravila:
- Piši na bosanskom/srpskom/hrvatskom jeziku
- Fokusiraj se na informacije BITNE za radnika
- Grupiši srodne informacije zajedno
- Kratke, jasne rečenice
- Preskoci naslovne strane, sadržaj, bibliografiju - fokus na sadržaj

Vrati SAMO ovaj JSON format, bez ikakvog drugog teksta:
{
  "slides": [
    {
      "naslov": "Naziv slajda",
      "sadrzaj": "• Prva tačka\\n• Druga tačka\\n• Treća tačka"
    }
  ]
}`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            // Send the PDF directly — Gemini 2.0 Flash reads it natively
                            inline_data: {
                                mime_type: 'application/pdf',
                                data: base64Data,
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
            }),
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini API error:', errText);
        throw new Error('Gemini API greška: ' + response.status);
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

    if (!parsed?.slides?.length) {
        throw new Error('Gemini nije vratio validne slajdove');
    }

    return parsed.slides.map(s => ({
        id: genId(),
        naslov: (s.naslov || '').trim(),
        sadrzaj: (s.sadrzaj || '').trim(),
    }));
}

// ─── PPTX → direct XML extraction ────────────────────────────────────────────
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

// ─── Extract text from a single PPTX slide XML ───────────────────────────────
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

    // If no title placeholder found, first text block becomes title
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
