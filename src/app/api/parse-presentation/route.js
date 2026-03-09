import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════
   POST /api/parse-presentation
   PDF  → Upload to Gemini Files API → gemini-2.5-flash reads it
   PPTX → direct XML text extraction via jszip
   ═══════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

const GEMINI_MODEL = 'gemini-2.5-flash';

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
            if (buffer.length > 20 * 1024 * 1024) {
                return NextResponse.json({ error: 'PDF prevelik (max 20 MB).' }, { status: 400 });
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

// ═══════════════════════════════════════════════════════════════════════════════
// PDF → Gemini Files API → gemini-2.5-flash generates slides
// ═══════════════════════════════════════════════════════════════════════════════
async function pdfToSlides(buffer) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    // ── Step 1: Upload PDF to Gemini Files API ──────────────────────────────
    console.log('[parse-presentation] Uploading PDF to Gemini Files API...');

    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/pdf',
            'X-Goog-Upload-Protocol': 'raw',
            'X-Goog-Upload-Header-Content-Type': 'application/pdf',
        },
        body: buffer,
    });

    if (!uploadRes.ok) {
        const errBody = await uploadRes.text();
        console.error('[parse-presentation] Upload failed:', uploadRes.status, errBody);
        throw new Error(`PDF upload neuspješan (${uploadRes.status})`);
    }

    const uploadData = await uploadRes.json();
    const fileUri = uploadData.file?.uri;
    const fileApiName = uploadData.file?.name;
    console.log('[parse-presentation] File uploaded:', fileApiName, 'URI:', fileUri);

    if (!fileUri) throw new Error('Gemini Files API nije vratio URI');

    // ── Step 2: Wait for file to become ACTIVE ──────────────────────────────
    let state = uploadData.file?.state || 'ACTIVE';
    if (state === 'PROCESSING' && fileApiName) {
        console.log('[parse-presentation] File processing, waiting...');
        for (let i = 0; i < 15; i++) {
            await sleep(2000);
            try {
                const checkRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/${fileApiName}?key=${apiKey}`
                );
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    state = checkData.state || 'ACTIVE';
                    console.log(`[parse-presentation] File state: ${state}`);
                    if (state === 'ACTIVE') break;
                    if (state === 'FAILED') throw new Error('Obrada PDF fajla neuspješna');
                }
            } catch (e) {
                if (e.message.includes('neuspješna')) throw e;
            }
        }
    }

    // ── Step 3: Generate slides from the uploaded PDF ────────────────────────
    console.log(`[parse-presentation] Generating slides with ${GEMINI_MODEL}...`);

    const prompt = `Ti si ekspert za zaštitu na radu u Bosni i Hercegovini. Pročitaj CIJELI ovaj PDF dokument od početka do kraja i kreiraj edukativan materijal za radnike u obliku slajdova prezentacije.

VAŽNO: Napravi NAJMANJE 5, a NAJVIŠE 15 slajdova. Svaki slajd pokriva jednu temu ili poglavlje iz dokumenta.

Format svakog slajda:
- naslov: kratki naslov teme (max 10 riječi)
- sadrzaj: 3-7 bullet tačaka sa ključnim informacijama, svaka počinje sa •

Pravila:
- Piši na bosanskom jeziku
- Fokusiraj se na praktične informacije BITNE za radnika
- Grupiši srodne informacije na isti slajd
- Kratke, jasne rečenice
- Preskoči sadržaj, naslovne strane i bibliografiju
- AKO dokument sadrži pravne odredbe ili zakone, napravi slajdove koji objašnjavaju prava i obaveze radnika

Vrati SAMO JSON u ovom formatu, bez ikakvog drugog teksta ili komentara:
{
  "slides": [
    {"naslov": "Naziv prve teme", "sadrzaj": "• Prva informacija\\n• Druga informacija\\n• Treća informacija"},
    {"naslov": "Naziv druge teme", "sadrzaj": "• Prva informacija\\n• Druga informacija"}
  ]
}`;

    const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const genRes = await fetch(genUrl, {
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
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
            },
        }),
    });

    // ── Step 4: Clean up uploaded file (fire & forget) ───────────────────────
    if (fileApiName) {
        fetch(`https://generativelanguage.googleapis.com/v1beta/${fileApiName}?key=${apiKey}`, {
            method: 'DELETE',
        }).catch(() => {});
    }

    if (!genRes.ok) {
        const errBody = await genRes.text();
        console.error(`[parse-presentation] Generate failed (${genRes.status}):`, errBody.substring(0, 500));
        throw new Error(`Gemini generisanje neuspješno (${genRes.status}): ${errBody.substring(0, 200)}`);
    }

    const genData = await genRes.json();
    const rawText = genData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[parse-presentation] Response length:', rawText.length);

    const slides = parseJsonSlides(rawText);
    if (slides.length === 0) {
        console.error('[parse-presentation] Could not parse slides from:', rawText.substring(0, 300));
        throw new Error('Gemini nije vratio validne slajdove');
    }

    console.log(`[parse-presentation] Success: ${slides.length} slides generated`);
    return slides;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
        } catch { /* */ }
    }
    return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PPTX → direct XML extraction
// ═══════════════════════════════════════════════════════════════════════════════
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
