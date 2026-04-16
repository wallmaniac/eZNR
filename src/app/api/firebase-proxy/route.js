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

/**
 * Call Gemini with model fallback. Never uses responseMimeType — 
 * we parse JSON manually which is more robust across all models.
 */
async function callGemini(apiKey, body) {
    // Always strip responseMimeType — it causes 500s on some models
    if (body.generationConfig) {
        delete body.generationConfig.responseMimeType;
    }

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
            // Skip thought parts, get actual text
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

/**
 * Robust JSON parser — tries multiple strategies to extract JSON from LLM output.
 */
function tryParseJson(text) {
    if (!text) return null;
    // 1. Direct parse
    try { return JSON.parse(text); } catch {}
    // 2. Strip markdown code blocks
    try { return JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); } catch {}
    // 3. Extract first { ... } block
    try {
        const f = text.indexOf('{'), l = text.lastIndexOf('}');
        if (f >= 0 && l > f) return JSON.parse(text.substring(f, l + 1));
    } catch {}
    // 4. Extract first [ ... ] block
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
    { naslov: 'Rok: Godišnji izvještaj o ZNR — 31. mart', opis: 'Svaki poslodavac u FBiH obavezan je do 31. marta predati godišnji izvještaj o zaštiti na radu za prethodnu godinu.', tip: 'rok', datum: '31.03.2026.', izvor: 'Zakon o ZNR FBiH, čl. 46', url: 'https://www.fbihvlada.gov.ba' },
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
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
        });
        const parsed = tryParseJson(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
            const news = parsed.filter(x => x.naslov && x.opis);
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

    const djelatnostStr = djelatnost || 'Nije navedeno';
    const workplacesStr = Array.isArray(workplacesList) ? workplacesList.join(', ') : (workplacesList || 'Nema');
    const firmaStr = nazivTvrtke || 'Nepoznato';

    // Use custom delimiters — no JSON, avoids double-encoding entirely
    const prompt = `Ti si stručnjak za zaštitu na radu u Bosni i Hercegovini.

Napiši dva teksta za akt o procjeni rizika za firmu "${firmaStr}" koja se bavi "${djelatnostStr}".
Radna mjesta: ${workplacesStr || 'nisu navedena'}
${hazardList ? `Potencijalne opasnosti: ${hazardList}` : ''}

Odgovor formatiraj TAČNO ovako — koristi ove headere:

##OPIS_PROCESA##
Napiši 3-4 paragrafa opisa tehničko-tehnološkog procesa. Opisuj konkretne radne procese, mašine, alate, materijale i tok rada u firmi. Pisati profesionalno i formalno.

##ANALIZA_ORGANIZACIJE##
Napiši 3-4 paragrafa analize organizacije rada. Opisuj radno vrijeme, broj radnika, organizacionu strukturu, smjene, rukovođenje i uvjete rada. Pisati profesionalno i formalno.

Piši SAMO tekst, bez JSON-a, bez markdown-a, bez zaglavlja osim navedenih.`;

    let text = '';
    let model = MODELS[0];

    try {
        const result = await callGemini(apiKey, {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 3000 },
        });
        text = result.text;
        model = result.model;
    } catch (err) {
        console.error('[generateOpisProcesa] Gemini failed:', err.message);
        throw new Error('AI servis je trenutno nedostupan. Pokušajte ponovo.');
    }

    // Parse sections using delimiters
    const opisMatch = text.match(/##OPIS_PROCESA##\s*([\s\S]*?)(?=##ANALIZA_ORGANIZACIJE##|$)/i);
    const analizaMatch = text.match(/##ANALIZA_ORGANIZACIJE##\s*([\s\S]*?)$/i);

    const opisProcesa = opisMatch?.[1]?.trim() || '';
    const analizaOrganizacije = analizaMatch?.[1]?.trim() || '';

    if (opisProcesa || analizaOrganizacije) {
        return { success: true, result: { opisProcesa, analizaOrganizacije }, model };
    }

    // Fallback: try JSON parse (in case model still responded in JSON)
    const parsed = tryParseJson(text);
    if (parsed) {
        const op = typeof parsed.opisProcesa === 'string' ? parsed.opisProcesa : JSON.stringify(parsed.opisProcesa);
        const ao = typeof parsed.analizaOrganizacije === 'string' ? parsed.analizaOrganizacije : JSON.stringify(parsed.analizaOrganizacije);
        const finalOp = tryParseJson(op)?.opisProcesa || op;
        const finalAo = tryParseJson(ao)?.analizaOrganizacije || ao;
        return { success: true, result: { opisProcesa: finalOp || '', analizaOrganizacije: finalAo || '' }, model };
    }

    // Last resort: use full raw text
    return { success: true, result: { opisProcesa: text.trim() || `Opis procesa za ${djelatnostStr}.`, analizaOrganizacije: '' }, model };
}

async function handleRiskMeasures(data) {
    const apiKey = getApiKey();
    const { hazardName, hazardCode, workplaceName, opisOpasnosti, vjerovatnoca, posljedica, postojeceMjere, documentData, documentMimeType } = data;

    const systemPrompt = `Ti si stručnjak za zaštitu na radu u BiH. Na osnovu opasnosti predloži mjere.
Vrati SAMO JSON bez markdown:
{"postojeceMjere":"...","predlozeneMjere":"...","vjerovatnocaNakon":2,"posljedlicaNakon":3,"obrazlozenje":"..."}`;

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
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });
    const parsed = tryParseJson(text);
    if (parsed) return { success: true, measures: parsed, model };
    // Fallback: use raw text
    return { success: true, measures: { postojeceMjere: text, predlozeneMjere: '', vjerovatnocaNakon: Math.max(1, vjerovatnoca - 1), posljedlicaNakon: Math.max(1, posljedica - 1), obrazlozenje: '' }, model };
}

async function handleAnalyzeRiskDocs(data) {
    const apiKey = getApiKey();
    const { documents, companyName } = data;
    if (!documents?.length) throw new Error('Nema dokumenata za analizu');

    const docsText = documents.map((d, i) => `Dokument ${i + 1} (${d.name || 'PDF'}):\n${d.content || d.text || ''}`).join('\n\n---\n\n');

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za ZNR u BiH. Analiziraj dokumente. Vrati SAMO JSON bez markdown: {"nalazi":["..."],"preporuke":["..."],"rizici":["..."],"zakljucak":"..."}' }] },
        contents: [{ role: 'user', parts: [{ text: `Kompanija: ${companyName || 'Nepoznato'}\n\nDokumenti:\n${docsText}\n\nVrati SAMO JSON.` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    });
    const parsed = tryParseJson(text);
    if (!parsed) throw new Error('AI nije vratio validnu analizu');
    return { success: true, analysis: parsed, model };
}

async function handleGenerateRiskQuestionnaire(data) {
    const apiKey = getApiKey();
    const { workplaceName, workplaceDescription, hazards, existingPPE, existingEquipment, vrstaAnkete, jezik } = data;

    const systemPrompt = `Ti si stručnjak za ZNR u BiH. Generišeš SurveyJS upitnike.
Vrati SAMO JSON bez markdown i bez teksta:
{"pages":[{"name":"page1","title":"Naziv","elements":[{"type":"radiogroup","name":"q1","title":"Pitanje?","choices":["Da","Ne"],"isRequired":true}]}]}`;

    const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}
OPIS: ${workplaceDescription || 'Nema'}
VRSTA ANKETE: ${vrstaAnkete || 'Procjena rizika'}
JEZIK: ${jezik || 'Bosanski'}
${hazards?.length ? `OPASNOSTI: ${hazards.join(', ')}` : ''}
${existingPPE?.length ? `OZO: ${existingPPE.join(', ')}` : ''}
${existingEquipment?.length ? `OPREMA: ${existingEquipment.join(', ')}` : ''}

Generiši upitnik sa 7 sekcija, 5-8 pitanja po sekciji na ${jezik || 'Bosanskom'}.
Vrati SAMO JSON, bez markdown.`;

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
    });
    const parsed = tryParseJson(text);
    if (!parsed?.pages) throw new Error('AI model je vratio neispravan format upitnika');
    return { success: true, surveyJson: parsed, model };
}

async function handleAnalyzeQuestionnaire(data) {
    const apiKey = getApiKey();
    const { workplaceName, surveyJson, responses } = data;

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
        responseSummary = `Radno mjesto: ${workplaceName}. Nema odgovora — generiši generičke stavke procjene rizika.`;
    }

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za ZNR u BiH. Analiziraj odgovore i generiši stavke procjene rizika. Vrati SAMO JSON bez markdown:\n{"items":[{"opisOpasnosti":"...","kategorija":"fizička","vjerovatnoca":3,"posljedica":4,"postojeceMjere":"...","predlozeneMjere":"...","vjerovatnocaNakon":2,"posljedlicaNakon":3,"rokProvedbe":"30","obrazlozenje":"..."}],"ukupniKomentar":"..."}' }] },
        contents: [{ role: 'user', parts: [{ text: `RADNO MJESTO: ${workplaceName || 'Nepoznato'}\n\nODGOVORI:\n${responseSummary}\n\nGeneriši 5-8 stavki. Vrati SAMO JSON.` }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    });
    const parsed = tryParseJson(text);
    if (!parsed) {
        console.error('[analyzeQuestionnaire] Parse failed. Raw:', text?.substring(0, 200));
        return { success: false, analysis: null, error: 'AI nije mogao analizirati upitnik. Pokušajte ponovo.' };
    }
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
        system_instruction: { parts: [{ text: 'Ti si stručnjak za HR i ZNR u BiH. Generiši sistematizaciju radnog mjesta. Vrati SAMO JSON bez markdown:\n{"nazivPosla":"...","kategorijaRM":"Izvršno","slozenostPoslova":"Srednje složeni","opisPoslova":"...","odgovornosti":"...","strucnaSprema":"SSS","radnoIskustvo":"...","probniRad":"3 mjeseca","posebniUvjeti":[],"brojIzvrsilaca":1,"uvjetiRada":{"fizicki":[],"kemijski":[],"bioloski":[],"ergonomski":[],"psihosocijalni":[]},"potrebnaOZO":[],"radnaOprema":[],"zdravstveniZahtjevi":[],"certifikati":[],"potrebneObuke":[],"pravniOsnov":"Čl. 118. Zakona o radu FBiH","napomena":""}' }] },
        contents: [{ role: 'user', parts: [{ text: `RADNO MJESTO: ${workplaceName}\nOZNAKA: ${oznaka || ''}\nSTRUČNA SPREMA: ${strucnaSprema || 'Nije navedeno'}\nDJELATNOST: ${industry || 'Nije navedeno'}\nBROJ IZVRŠILACA: ${numberOfWorkers || 1}\nORG. JEDINICA: ${orgUnit || ''}\nRADNO VRIJEME: ${radnoVrijemeOd || ''} do ${radnoVrijemeDo || ''}\n${nightShift}\n${additionalInfo ? `NAPOMENA: ${additionalInfo}` : ''}\n\nVrati SAMO JSON.` }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    });
    const parsed = tryParseJson(text);
    if (!parsed?.opisPoslova) {
        // Fallback: if we got SOMETHING use it, otherwise return nice error
        if (parsed) return { success: true, sistematizacija: { ...parsed, opisPoslova: parsed.opisPoslova || parsed.opis || '' }, model };
        console.error('[generateSistematizacija] Parse failed. Raw:', text?.substring(0, 200));
        return { success: false, sistematizacija: null, error: 'AI nije mogao generirati sistematizaciju. Pokušajte ponovo.' };
    }
    return { success: true, sistematizacija: parsed, model };
}

async function handleParseSistematizacija(data) {
    const apiKey = getApiKey();
    const { documentText, workplaceName } = data;

    const { text, model } = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: 'Ti si stručnjak za HR i ZNR. Ekstrahi sistematizaciju iz teksta. Vrati SAMO JSON bez markdown:\n{"nazivPosla":"...","opisPoslova":"...","odgovornosti":"...","strucnaSprema":"SSS","radnoIskustvo":"...","posebniUvjeti":[],"uvjetiRada":{"fizicki":[],"kemijski":[],"ergonomski":[],"psihosocijalni":[]},"potrebnaOZO":[],"zdravstveniZahtjevi":[],"certifikati":[]}' }] },
        contents: [{ role: 'user', parts: [{ text: `Radno mjesto: ${workplaceName || 'Nepoznato'}\n\nTekst dokumenta:\n${documentText}\n\nVrati SAMO JSON.` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
    });
    const parsed = tryParseJson(text);
    if (!parsed) {
        console.error('[parseSistematizacija] Parse failed. Raw:', text?.substring(0, 200));
        return { success: false, sistematizacija: null, error: 'Nije moguće parsirati dokument. Pokušajte sa tekstualnim formatom.' };
    }
    return { success: true, sistematizacija: parsed, model };
}

async function handleGenerateQuiz(data) {
    const apiKey = getApiKey();
    const { slides } = data;
    if (!slides?.length) throw new Error('Nema slajdova za generisanje kviza');

    // Truncate slide content to avoid hitting token limits
    const slideContent = slides
        .map((s, i) => `Slajd ${i + 1}: ${s.naslov || ''}\n${(s.sadrzaj || '').substring(0, 800)}`)
        .join('\n\n---\n\n')
        .substring(0, 8000);

    const prompt = `Ti si instruktor zaštite na radu. Na osnovu ove prezentacije generiši 10 pitanja za test znanja.

PREZENTACIJA:
${slideContent}

Vrati SAMO JSON niz (bez ikakvog teksta prije ili poslije, bez markdown, bez objasnjenja):
[{"pitanje":"Tekst pitanja?","opcije":["Odgovor A","Odgovor B","Odgovor C","Odgovor D"],"tacno":0,"objasnjenje":"Kratko objasnjenje"},{...}]

tacno = indeks tacnog odgovora (0=prvi, 1=drugi, 2=treci, 3=cetvrti)
Vrati SAMO JSON niz.`;

    const { text, model } = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    });

    const parsed = tryParseJson(text);
    let questions = Array.isArray(parsed) ? parsed
        : parsed?.questions ? parsed.questions
        : parsed?.result ? parsed.result
        : [];

    if (!questions.length) {
        console.error('[generateQuiz] Parse failed. Raw text (first 300):', text?.substring(0, 300));
        return { success: false, questions: [], error: 'AI nije mogao generirati pitanja iz ovog sadržaja. Provjerite da li slajdovi imaju textualnog sadržaja i pokušajte ponovo.', model };
    }
    return { success: true, questions, model };
}

async function handleGenerateFromDocument(data) {
    const apiKey = getApiKey();
    const { documentText, documentBase64, mimeType } = data;

    const parts = [];
    if (documentBase64 && mimeType) parts.push({ inlineData: { data: documentBase64, mimeType } });
    parts.push({ text: `Ekstrahi pitanja za test iz ovog dokumenta. Vrati SAMO JSON bez markdown:\n{"result":[{"pitanje":"...","opcije":["A","B","C","D"],"tacno":0,"objasnjenje":"..."}]}\n\n${documentText || ''}` });

    const { text, model } = await callGemini(apiKey, {
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
    });
    const parsed = tryParseJson(text);
    const result = parsed?.result || (Array.isArray(parsed) ? parsed : null);
    if (!result) {
        console.error('[generateFromDocument] Parse failed. Raw:', text?.substring(0, 200));
        return { success: false, result: [], error: 'AI nije mogao ekstrahirati pitanja iz dokumenta.' };
    }
    return { success: true, result, model };
}

async function handleParsePresentation(data) {
    const apiKey = getApiKey();
    const { base64Data, filename } = data;
    if (!base64Data) throw new Error('Nema podataka o prezentaciji');

    const mimeType = filename?.endsWith('.pptx')
        ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'application/pdf';

    const { text, model } = await callGemini(apiKey, {
        contents: [{ role: 'user', parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: 'Ekstrahi sve slajdove u JSON niz. Vrati SAMO JSON bez markdown:\n[{"naslov":"...","sadrzaj":"..."}]' }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16384 },
    });
    const slides = tryParseJson(text);
    if (!Array.isArray(slides)) throw new Error('Nije moguće parsirati prezentaciju');
    return { slides, count: slides.length, source: filename || 'document', model };
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
    saveNotifSettings: async () => ({ success: true }),
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
            console.error(`[firebase-proxy] Unknown function: ${functionName}`);
            return new Response(JSON.stringify({ error: `Unknown function: ${functionName}` }), { status: 400 });
        }

        const result = await handler(data || {});
        return new Response(JSON.stringify({ result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[firebase-proxy] Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
