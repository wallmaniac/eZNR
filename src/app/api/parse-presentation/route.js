import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════
   POST /api/parse-presentation
   Body: FormData with field "file" (PDF or PPTX)

   PDF  → uploaded to Gemini Files API → model reads it → slides
   PPTX → text extracted directly from XML shapes → slides

   Returns: { slides: [{ id, naslov, sadrzaj }], source, count }
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
            slides = await parsePPTX(buffer);
            source = 'pptx';

        } else if (fileName.endsWith('.pdf')) {
            const sizeMB = buffer.length / (1024 * 1024);
            if (sizeMB > 15) {
                return NextResponse.json({
                    error: `PDF je prevelik (${sizeMB.toFixed(1)} MB). Maksimalno 15 MB.`,
                }, { status: 400 });
            }
            slides = await generateSlidesFromPDF(buffer);
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

// ─── PDF → Gemini Files API → generateContent ────────────────────────────────
async function generateSlidesFromPDF(buffer) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key nije konfigurisan');

    // ── Step 1: Upload file to Gemini Files API ──
    const uploadRes = await fetch(
        `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'X-Goog-Upload-Protocol': 'raw',
                'X-Goog-Upload-Header-Content-Type': 'application/pdf',
                'Content-Type': 'application/pdf',
            },
            body: buffer,
        }
    );

    if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error('Gemini upload error:', uploadRes.status, errText);
        throw new Error(`Upload fajla neuspješan (${uploadRes.status})`);
    }

    const uploadData = await uploadRes.json();
    const fileUri = uploadData.file?.uri;
    if (!fileUri) throw new Error('Gemini nije vratio URI fajla');

    // ── Step 2: Generate slides from the uploaded file ──
    const prompt = `Ti si ekspert za zaštitu na radu u Bosni i Hercegovini. Pročitaj ovaj PDF dokument i kreiraj edukativan materijal za radnike u obliku slajdova prezentacije.

Kreiraj između 5 i 15 slajdova koji pokrivaju najvažnije informacije iz dokumenta.
Svaki slajd treba imati:
- naslov: kratki, jasni naslov (max 10 riječi)
- sadrzaj: ključne informacije kao bullet tačke (3-7 tačaka), svaka počinje sa •

Pravila:
- Piši na bosanskom/srpskom/hrvatskom jeziku
- Fokusiraj se na informacije BITNE za radnika
- Grupiši srodne informacije zajedno
- Kratke, jasne rečenice
- Preskoči naslovne strane, sadržaj i bibliografiju

Vrati SAMO ovaj JSON format, bez ikakvog drugog teksta:
{
  "slides": [
    {
      "naslov": "Naziv slajda",
      "sadrzaj": "• Prva tačka\\n• Druga tačka\\n• Treća tačka"
    }
  ]
}`;

    const genRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            file_data: {
                                mime_type: 'application/pdf',
                                file_uri: fileUri,
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

    if (!genRes.ok) {
        const errText = await genRes.text();
        console.error('Gemini generate error:', genRes.status, errText);
        throw new Error(`Gemini generisanje neuspješno (${genRes.status})`);
    }

    const genData = await genRes.json();
    const rawText = genData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

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

    // ── Step 3: Clean up — delete uploaded file from Gemini ──
    // (fire and forget — don't block response)
    const fileName = fileUri.split('/').pop();
    if (fileName) {
        fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileName}?key=${apiKey}`, {
            method: 'DELETE',
        }).catch(() => {});
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
