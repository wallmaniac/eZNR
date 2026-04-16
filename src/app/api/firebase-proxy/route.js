/**
 * /api/firebase-proxy/route.js
 * 
 * Runs ALL Firebase AI functions directly on Vercel using the Gemini REST API.
 * Eliminates Firebase Cloud Run entirely — no IAM/CORS issues possible.
 * 
 * POST /api/firebase-proxy
 * Body: { functionName: string, data: object }
 */

export const maxDuration = 300;

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApiKey() {
    const key = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not configured');
    return key;
}

async function callGemini(apiKey, body) {
    let lastErr = null;
    for (const model of MODELS) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                lastErr = new Error(errData.error?.message || `HTTP ${res.status}`);
                if (model !== MODELS[MODELS.length - 1]) continue;
                throw lastErr;
            }
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.find(p => !p.thought && p.text)?.text
                ?? data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
            return { text, model };
        } catch (err) {
            lastErr = err;
            if (model !== MODELS[MODELS.length - 1]) continue;
            throw err;
        }
    }
    throw lastErr || new Error('All models failed');
}

function tryParseJson(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch {}
    try { return JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); } catch {}
    try {
        const f = text.indexOf('{'), l = text.lastIndexOf('}');
        if (f >= 0 && l > f) return JSON.parse(text.substring(f, l + 1));
    } catch {}
    try {
        const f = text.indexOf('['), l = text.lastIndexOf(']');
        if (f >= 0 && l > f) return JSON.parse(text.substring(f, l + 1));
    } catch {}
    return null;
}

// ─── Function Implementations ─────────────────────────────────────────────────

// Server-side news cache (per Vercel instance)
let newsCache = { data: null, ts: 0 };
const NEWS_TTL = 2 * 60 * 60 * 1000;

const STATIC_NEWS = [
    { naslov: 'Zakon o zaštiti na radu FBiH — važeći propis', opis: 'Zakon o zaštiti na radu FBiH (Sl. novine FBiH br. 22/02) obavezuje sve poslodavce na osiguranje sigurnih radnih uslova, procjenu rizika i zdravstvene preglede.', tip: 'zakon', datum: '01.01.2025.', izvor: 'Sl. novine FBiH br. 22/02', url: 'https://www.sllist.ba' },
    { naslov: 'Rok: Godišnji izvještaj o ZNR — 31. mart', opis: 'Svaki poslodavac u FBiH obavezan je do 31. marta predati godišnji izvještaj o stanju zaštite na radu za prethodnu godinu.', tip: 'rok', datum: '31.03.2026.', izvor: 'Zakon o ZNR FBiH, čl. 46', url: 'https://www.fbihvlada.gov.ba' },
    { naslov: 'Procjena rizika — obaveza svakog poslodavca', opis: 'Svaki poslodavac mora sačiniti i redovno ažurirati Procjenu rizika za svako radno mjesto. Neposjedovanje procjene rizika rezultira inspekcijskim nalazom.', tip: 'pravilnik', datum: '15.01.2026.', izvor: 'Pravilnik o procjeni rizika FBiH/RS', url: 'https://www.sllist.ba' },
];

async function handleNews({ force }) {
    if (!force && newsCache.data && Date.now() - newsCache.ts < NEWS_TTL) {
        return { ...newsCache.data, cached: true };
    }
    const apiKey = getApiKey();
    const prompt = `Ti si pravni asistent za zaštitu na radu u Bosni i Hercegovini.

Generiraj 6 informativnih stavki o zaštiti na radu u BiH. Bitno:
- Koristi SAMO informacije koje su provjereno tačne
- Napiši konkretne zakone sa brojevima glasnika (npr. "Sl. novine FBiH br. 22/02")
- Za rokove koji su godišnji navedi rok u 2026. godini
- Datum neka bude datum relevantnosti propisa ili 07.03.2026.
- Za "url" stavi pravi link ako postoji (sllist.ba, slglasnikrs.ba), inače ostavi ""

Vrati SAMO JSON niz, bez teksta ispred ili iza, bez Markdown:
[{"naslov":"...","opis":"2-3 rečenice.","tip":"zakon","datum":"07.03.2026.","izvor":"Sl. novine FBiH br. 22/02","url":"https://www.sllist.ba"}]

Tipovi: zakon|pravilnik|inspekcija|edukacija|rok|obavijest|smjernice
Samo JSON.`;

    try {
        const { text, model } = await callGemini(apiKey, {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
        });
        const raw = text.replace(/```json\s*/im, '').replace(/```\s*$/im, '').trim();
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
            const news = JSON.parse(match[0]).filter(x => x.naslov && x.opis);
            if (news.length > 0) {
                const payload = { news, source: 'gemini', model, cached: false };
                newsCache = { data: payload, ts: Date.now() };
                return payload;
            }
        }
    } catch (err) {
        console.error('[firebase-proxy/news] Gemini failed:', err.message);
    }
    const payload = { news: STATIC_NEWS, source: 'static', cached: false };
    newsCache = { data: payload, ts: Date.now() };
    return payload;
}

async function handleGenerateOpisProcesa(data) {
    const apiKey = getApiKey();
    const { nazivTvrtke, djelatnost, radnaMjesta, opasnosti } = data;
    const workplacesList = data.workplaces || radnaMjesta || '';
    const hazardList = opasnosti || '';

    const systemPrompt = `Ti si vrhunski stručnjak za zaštitu na radu (ZNR) u Bosni i Hercegovini.
Tvoj zadatak je da napišeš dva teksta za Procjenu rizika u validnom JSON formatu, bez markdown oznaka.
OČEKIVANI JSON FORMAT:
{"opisProcesa":"Tekst opisa tehničko-tehnološkog procesa...","analizaOrganizacije":"Tekst analize organizacije rada..."}`;

    const userMsg = `FIRMA: ${nazivTvrtke || 'Nepoznato'}
DJELATNOST: ${djelatnost || 'Nije navedeno'}
RADNA MJESTA: ${Array.isArray(workplacesList) ? workplacesList.join(', ') : workplacesList || 'Nema'}
${hazardList ? `OPASNOSTI: ${hazardList}` : ''}`;

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    });
    const parsed = tryParseJson(text);
    if (!parsed) throw new Error('AI model je vratio neispravan format');
    return { success: true, result: parsed, model };
}

async function handleRiskMeasures(data) {
    const apiKey = getApiKey();
    const { hazardName, hazardCode, workplaceName, opisOpasnosti, vjerovatnoca, posljedica, postojeceMjere, documentData, documentMimeType } = data;

    const systemPrompt = `Ti si stručnjak za zaštitu na radu u BiH. Na osnovu opasnosti predloži mjere.
JSON FORMAT: {"postojeceMjere":"...","predlozeneMjere":"...","vjerovatnocaNakon":3,"posljedlicaNakon":3,"obrazlozenje":"..."}`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPASNOST: ${hazardCode ? `${hazardCode} — ` : ''}${hazardName || 'Nepoznata'}
OPIS: ${opisOpasnosti || 'Nema'}
V: ${vjerovatnoca}/5, P: ${posljedica}/5, R: ${vjerovatnoca * posljedica}/25
${postojeceMjere ? `POSTOJEĆE MJERE: ${postojeceMjere}` : ''}`;

    const parts = [];
    if (documentData && documentMimeType) parts.push({ inlineData: { data: documentData, mimeType: documentMimeType } });
    parts.push({ text: userMsg });

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: 'application/json' },
    });
    const parsed = tryParseJson(text);
    if (parsed) return { success: true, measures: parsed, model };
    return { success: true, measures: { postojeceMjere: text, predlozeneMjere: '', vjerovatnocaNakon: Math.max(1, vjerovatnoca - 1), posljedlicaNakon: Math.max(1, posljedica - 1), obrazlozenje: '' }, model };
}

async function handleAnalyzeRiskDocs(data) {
    const apiKey = getApiKey();
    const { documents, companyName } = data;
    if (!documents?.length) throw new Error('Nema dokumenata za analizu');

    const docsText = documents.map((d, i) => `Dokument ${i + 1} (${d.name || 'PDF'}):\n${d.content || d.text || ''}`).join('\n\n---\n\n');

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za ZNR u BiH. Analiziraj dokumente i ekstrahi ključne nalaze o zaštiti na radu. Odgovori u JSON formatu: {"nalazi":["..."],"preporuke":["..."],"rizici":["..."],"zakljucak":"..."}' }] },
        contents: [{ role: 'user', parts: [{ text: `Kompanija: ${companyName || 'Nepoznato'}\n\nDokumenti:\n${docsText}\n\nAnaliziraj i vrati JSON.` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    });
    const parsed = tryParseJson(text);
    if (!parsed) throw new Error('AI nije vratio validnu analizu');
    return { success: true, analysis: parsed, model };
}

async function handleGenerateRiskQuestionnaire(data) {
    const apiKey = getApiKey();
    const { workplaceName, workplaceDescription, hazards, existingPPE, existingEquipment, vrstaAnkete, jezik } = data;

    const systemPrompt = `Ti si stručnjak za ZNR u BiH. Generišeš profesionalne upitnike (SurveyJS format).
JSON FORMAT: {"pages":[{"name":"page1","title":"Naziv sekcije","elements":[{"type":"radiogroup","name":"q1","title":"Pitanje?","choices":["Da","Ne"],"isRequired":true}]}]}`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPIS: ${workplaceDescription || 'Nema'}
VRSTA ANKETE: ${vrstaAnkete || 'Procjena rizika'}
JEZIK: ${jezik || 'Bosanski'}
${hazards?.length ? `OPASNOSTI: ${hazards.join(', ')}` : ''}
${existingPPE?.length ? `OZO: ${existingPPE.join(', ')}` : ''}
${existingEquipment?.length ? `OPREMA: ${existingEquipment.join(', ')}` : ''}

Generiši upitnik sa 7 sekcija, 5-8 pitanja po sekciji na ${jezik || 'Bosanskom'}.`;

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    });
    const parsed = tryParseJson(text);
    if (!parsed?.pages) throw new Error('AI model je vratio neispravan format upitnika');
    return { success: true, surveyJson: parsed, model };
}

async function handleAnalyzeQuestionnaire(data) {
    const apiKey = getApiKey();
    const { workplaceName, surveyJson, responses, sistematizacija } = data;

    let allQuestions = [];
    try {
        const sj = typeof surveyJson === 'string' ? JSON.parse(surveyJson || '{}') : (surveyJson || {});
        if (sj.pages) allQuestions = sj.pages.flatMap(p => p.elements || []);
        else if (sj.questions) allQuestions = sj.questions.filter(q => q.type !== 'heading');
    } catch {}

    let responseSummary = '';
    if (Array.isArray(responses) && responses.length > 0) {
        const latest = responses[responses.length - 1];
        const answers = latest?.answers || latest?.data || latest || {};
        responseSummary = allQuestions.map(q => {
            const ans = answers[q.id || q.name];
            return `Q: ${q.title || q.name}\nA: ${ans !== undefined ? (Array.isArray(ans) ? ans.join(', ') : ans) : 'Bez odgovora'}`;
        }).join('\n\n');
    } else {
        responseSummary = `Radno mjesto: ${workplaceName}. Nema odgovora — generiši generičke stavke.`;
    }

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za ZNR u BiH. Analiziraj odgovore i generiši stavke procjene rizika. JSON: {"items":[{"opisOpasnosti":"...","kategorija":"fizička","vjerovatnoca":3,"posljedica":4,"postojeceMjere":"...","predlozeneMjere":"...","vjerovatnocaNakon":2,"posljedlicaNakon":3,"rokProvedbe":"30","obrazlozenje":"..."}],"ukupniKomentar":"..."}' }] },
        contents: [{ role: 'user', parts: [{ text: `RADNO MJESTO: ${workplaceName || 'Nepoznato'}\n\nODGOVORI:\n${responseSummary}\n\nGeneriši 5-8 stavki procjene rizika.` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 16384, responseMimeType: 'application/json' },
    });
    const parsed = tryParseJson(text);
    if (!parsed) throw new Error('AI nije vratio validnu analizu');
    return { success: true, analysis: parsed, model };
}

async function handleGenerateSistematizacija(data) {
    const apiKey = getApiKey();
    const { workplaceName, oznaka, strucnaSprema, industry, numberOfWorkers, orgUnit, additionalInfo, radnoVrijemeOd, radnoVrijemeDo } = data;

    const start = parseInt((radnoVrijemeOd || '').replace(':', ''));
    const end = parseInt((radnoVrijemeDo || '').replace(':', ''));
    const nightShift = (!isNaN(start) && !isNaN(end) && (start > end || start < 600 || end >= 2200))
        ? 'OVO JE NOĆNI RAD. Uključi obavezni ljekarski pregled jednom u 2 godine.' : '';

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za HR i ZNR u BiH. Generiši kompletnu sistematizaciju radnog mjesta u JSON formatu: {"nazivPosla":"...","kategorijaRM":"Izvršno","slozenostPoslova":"Srednje složeni","opisPoslova":"...","odgovornosti":"...","strucnaSprema":"SSS","radnoIskustvo":"...","probniRad":"3 mjeseca","posebniUvjeti":[],"brojIzvrsilaca":1,"uvjetiRada":{"fizicki":[],"kemijski":[],"bioloski":[],"ergonomski":[],"psihosocijalni":[]},"potrebnaOZO":[],"radnaOprema":[],"zdravstveniZahtjevi":[],"certifikati":[],"potrebneObuke":[],"pravniOsnov":"Čl. 118. Zakona o radu FBiH","napomena":""}' }] },
        contents: [{ role: 'user', parts: [{ text: `RADNO MJESTO: ${workplaceName}\nOZNAKA: ${oznaka || ''}\nSTRUČNA SPREMA: ${strucnaSprema || 'Nije navedeno'}\nDJELATNOST: ${industry || 'Nije navedeno'}\nBROJ IZVRŠILACA: ${numberOfWorkers || 1}\nORG. JEDINICA: ${orgUnit || ''}\nRADNO VRIJEME: ${radnoVrijemeOd || ''} do ${radnoVrijemeDo || ''}\n${nightShift}\n${additionalInfo ? `NAPOMENA: ${additionalInfo}` : ''}` }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    });
    const parsed = tryParseJson(text);
    if (!parsed?.opisPoslova) throw new Error('AI je vratio neispravan format sistematizacije');
    return { success: true, sistematizacija: parsed, model };
}

async function handleParseSistematizacija(data) {
    const apiKey = getApiKey();
    const { documentText, workplaceName } = data;

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za HR i ZNR. Ekstrahi sistematizaciju iz teksta u JSON format: {"nazivPosla":"...","opisPoslova":"...","odgovornosti":"...","strucnaSprema":"SSS","radnoIskustvo":"...","posebniUvjeti":[],"uvjetiRada":{"fizicki":[],"kemijski":[],"ergonomski":[],"psihosocijalni":[]},"potrebnaOZO":[],"zdravstveniZahtjevi":[],"certifikati":[]}' }] },
        contents: [{ role: 'user', parts: [{ text: `Radno mjesto: ${workplaceName || 'Nepoznato'}\n\nTekst dokumenta:\n${documentText}\n\nEkstrahi sistematizaciju.` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
    });
    const parsed = tryParseJson(text);
    if (!parsed) throw new Error('Nije moguće parsirati dokument');
    return { success: true, sistematizacija: parsed, model };
}

async function handleGenerateQuiz(data) {
    const apiKey = getApiKey();
    const { slides } = data;
    if (!slides?.length) throw new Error('Nema slajdova za generisanje kviza');

    const slideContent = slides.map((s, i) => `Slajd ${i + 1}: ${s.naslov || ''}\n${s.sadrzaj || ''}`).join('\n\n---\n\n');

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si instruktor zaštite na radu. Generiši kviz iz prezentacije. JSON: {"questions":[{"pitanje":"...","opcije":["A","B","C","D"],"tacno":0,"objasnjenje":"..."}]}' }] },
        contents: [{ role: 'user', parts: [{ text: `Prezentacija:\n\n${slideContent}\n\nGeneriši 10-15 pitanja sa 4 opcije svako. Vrni SAMO JSON.` }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    });

    // Parse quiz
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = tryParseJson(clean);
    const questions = parsed?.questions || (Array.isArray(parsed) ? parsed : []);
    if (!questions.length) throw new Error('AI nije generisao pitanja');
    return { success: true, questions, model };
}

async function handleGenerateFromDocument(data) {
    const apiKey = getApiKey();
    const { documentText, documentBase64, mimeType, type } = data;

    const content = documentText || 'Dokument je priložen kao base64';
    const parts = [];
    if (documentBase64 && mimeType) parts.push({ inlineData: { data: documentBase64, mimeType } });
    parts.push({ text: `Ekstrahi pitanja za test iz ovog dokumenta. JSON: {"result":[{"pitanje":"...","opcije":["A","B","C","D"],"tacno":0,"objasnjenje":"..."}]}\n\n${content}` });

    const { text, model } = await callGemini(apiKey, {
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    });
    const parsed = tryParseJson(text);
    if (!parsed?.result) throw new Error('AI nije vratio validna pitanja');
    return { success: true, result: parsed.result, model };
}

async function handleParsePresentation(data) {
    const apiKey = getApiKey();
    const { base64Data, filename } = data;
    if (!base64Data) throw new Error('Nema podataka o prezentaciji');

    const { text, model } = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [
            { inlineData: { data: base64Data, mimeType: filename?.endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/pdf' } },
            { text: 'Ekstrahi sve slajdove iz ove prezentacije/dokumenta u JSON niz: [{"naslov":"...","sadrzaj":"..."}]. Jedan element po slajdu. Samo JSON.' }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
    });
    const slides = tryParseJson(text);
    if (!Array.isArray(slides)) throw new Error('Nije moguće parsirati prezentaciju');
    return { slides, count: slides.length, source: filename || 'document', model };
}

async function handleSaveNotifSettings(data) {
    // This doesn't need AI — just acknowledge (actual Firestore save happens client-side)
    return { success: true };
}

// ─── Main Router ──────────────────────────────────────────────────────────────

const HANDLERS = {
    news: handleNews,
    generateOpisProcesa: handleGenerateOpisProcesa,
    riskMeasures: handleRiskMeasures,
    analyzeRiskDocs: handleAnalyzeRiskDocs,
    generateRiskQuestionnaire: handleGenerateRiskQuestionnaire,
    analyzeQuestionnaire: handleAnalyzeQuestionnaire,
    generateSistematizacija: handleGenerateSistematizacija,
    parseSistematizacija: handleParseSistematizacija,
    generateQuiz: handleGenerateQuiz,
    generateFromDocument: handleGenerateFromDocument,
    parsePresentation: handleParsePresentation,
    saveNotifSettings: handleSaveNotifSettings,
    getNotifSettings: async () => ({ success: true, settings: null }),
};

export async function POST(req) {
    try {
        const body = await req.json();
        const { functionName, data } = body;

        if (!functionName) {
            return new Response(JSON.stringify({ error: 'functionName is required' }), { status: 400 });
        }

        const handler = HANDLERS[functionName];
        if (!handler) {
            return new Response(JSON.stringify({ error: `Unknown function: ${functionName}` }), { status: 400 });
        }

        const result = await handler(data || {});
        // Wrap in Firebase onCall response format: { result: ... }
        return new Response(JSON.stringify({ result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[firebase-proxy] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
