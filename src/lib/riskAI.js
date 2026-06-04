// src/lib/riskAI.js
import { apiCallZia } from '@/lib/ziaAPI';
import { callFirebaseFunction } from '@/lib/firebaseCallable';

export const riskLevel = (score) => {
    if (score <= 5) return { label: 'Neznatan', color: '#4caf50', bg: 'rgba(76,175,80,0.15)' };
    if (score <= 10) return { label: 'Dopustiv', color: '#ffc107', bg: 'rgba(255,193,7,0.15)' };
    if (score <= 15) return { label: 'Umjeren', color: '#ff9800', bg: 'rgba(255,152,0,0.15)' };
    if (score <= 20) return { label: 'Znatan', color: '#f44336', bg: 'rgba(244,67,54,0.15)' };
    return { label: 'Nedopustiv', color: '#b71c1c', bg: 'rgba(183,28,28,0.2)' };
};

export const fetchAiOpisProcesa = async (companyData, workplaces, hazards) => {
    try {
        const wNames = workplaces.map(w => w.naziv);
        const hNames = hazards.map(h => h.naziv).join(', ');
        
        // PII Sanitization: We omit sensitive identifiers like company name and exact address 
        // to protect client data before sending it to third-party AI models.
        const sanitizedCompanyName = '[Zaštićen Naziv Kompanije]';
        
        const payload = {
            nazivTvrtke: sanitizedCompanyName,
            djelatnost: companyData.djelatnost || 'Opća djelatnost',
            radnaMjesta: wNames,
            opasnosti: hNames,
            // Additional context for better generation
            ukupnoZaposlenih: companyData.ukupnoZaposlenih || '',
            userOpisProcesa: companyData.userOpisProcesa || '',
            userAnalizaOrganizacije: companyData.userAnalizaOrganizacije || '',
            // Sistematizacija data for accurate role-specific descriptions
            sistematizacijaKontekst: companyData.sistematizacijaKontekst || '',
        };

        const response = await callFirebaseFunction('generateOpisProcesa', payload);
        
        if (!response.success || !response.result) {
            throw new Error(response.error || 'AI nije uspio generisati opis.');
        }

        // The backend returns a valid JSON object thanks to responseMimeType: 'application/json'
        let parsed = response.result;
        
        // Re-inject the real company name back into the text locally
        if (parsed.opisProcesa && companyData.nazivTvrtke) {
            parsed.opisProcesa = parsed.opisProcesa.replace(/\[Zaštićen Naziv Kompanije\]/g, companyData.nazivTvrtke);
        }
        if (parsed.analizaOrganizacije && companyData.nazivTvrtke) {
            parsed.analizaOrganizacije = parsed.analizaOrganizacije.replace(/\[Zaštićen Naziv Kompanije\]/g, companyData.nazivTvrtke);
        }

        return parsed;
    } catch (err) {
        throw new Error(err.message || 'Nepoznata greška pri komunikaciji s AI serverom.');
    }
};


export const fetchAiMeasures = async (payload) => {
    try {
        const data = await callFirebaseFunction('riskMeasures', payload);
        if (!data.success || !data.measures) {
            throw new Error(data.error || 'Nepoznata greška');
        }
        return data.measures;
    } catch (firebaseError) {
        throw new Error(firebaseError.message || 'Nepoznata greška');
    }
};

export const fetchAiDocAnalyze = async (documents, companyName) => {
    try {
        const data = await callFirebaseFunction('analyzeRiskDocs', { documents, companyName });
        if (!data.success || !data.analysis) {
            throw new Error(data.error || 'Nepoznata greška');
        }
        return data.analysis;
    } catch (firebaseError) {
        throw new Error(firebaseError.message || 'Nepoznata greška');
    }
};

export const fetchAiAutoConclusion = async (riskItems, formData, country = 'BA') => {
    const itemsWithScores = riskItems.filter(ri => ri.rizik > 0);
    const avgBefore = itemsWithScores.length > 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
    const itemsWithAfter = riskItems.filter(ri => ri.rizikNakon > 0);
    const avgAfter = itemsWithAfter.length > 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;

    // PII Sanitization
    const sanitizedCompanyName = '[Zaštićen Naziv Kompanije]';

    const sysPrompt = country === 'HR'
        ? 'Ti si stručnjak za zaštitu na radu u Republici Hrvatskoj. Tvoj zadatak je napisati zaključak akta o procjeni rizika. Piši formalno, profesionalno, na hrvatskom jeziku. Pozivaj se na Zakon o zaštiti na radu (NN 71/14, 118/14, 94/18, 96/18) i Pravilnik o izradi procjene rizika (NN 112/14). VAŽNO: Odmah napiši tekst zaključka. NE PIŠI nikakav uvod poput "U redu" ili "Slijedi zaključak". Započni direktno s tekstom zaključka.'
        : 'Ti si stručnjak za zaštitu na radu u FBiH. Tvoj zadatak je napisati zaključak akta o procjeni rizika. Piši formalno, profesionalno, na bosanskom jeziku. VAŽNO: Odmah napiši tekst zaključka. NE PIŠI nikakav uvod poput "U redu" ili "Slijedi zaključak". Započni direktno s tekstom zaključka.';

    const data = await apiCallZia({
        systemPrompt: sysPrompt,
        messages: [{
            role: 'user', parts: [{
                text: `Napiši zaključak za akt o procjeni rizika. STROGO: maksimalno 3 kratka paragrafa, ukupno do 200 riječi. Podaci:
- Stavki: ${riskItems.length}
- Ocjena PRIJE mjera: ${avgBefore.toFixed(1)} (${avgBefore > 0 ? riskLevel(Math.round(avgBefore)).label : 'N/A'})
- Ocjena NAKON mjera: ${avgAfter > 0 ? avgAfter.toFixed(1) : 'N/A'} ${avgAfter > 0 ? '(' + riskLevel(Math.round(avgAfter)).label + ')' : ''}
- Smanjenje: ${avgAfter > 0 && avgBefore > 0 ? ((1 - avgAfter / avgBefore) * 100).toFixed(0) + '%' : 'N/A'}
- Visok rizik (R≥6): ${riskItems.filter(r => r.rizik >= 6).length}
- Nedopustiv rizik (R>20): ${riskItems.filter(r => r.rizik > 20).length}
- Tvrtka: ${sanitizedCompanyName}
- Djelatnost: ${formData.djelatnost || 'N/A'}

Sadržaj: stanje rizika, obaveze poslodavca, rok revizije. Treće lice. Bez uvoda, samo tekst.`
            }]
        }],
    });
    if (!data) {
        throw new Error('Generisanje zaključka nije uspjelo');
    }
    
    // Sometimes the backend might return the text directly as a string instead of { text: '...' }
    let finalText = typeof data === 'string' ? data : data.text;
    
    if (!finalText) {
        throw new Error(data.error || 'Generisanje zaključka nije uspjelo');
    }

    // Strip any AI preamble like "U redu, slijedi..." or "**ZAKLJUČAK...**"
    finalText = finalText
        .replace(/^(U redu[,.]?\s*(s|S)lijedi[^\n]*\n+)/i, '')
        .replace(/^\*\*ZAKLJUČAK[^\n]*\*\*\s*\n*/i, '')
        .trim();

    // Restore PII
    if (formData.nazivTvrtke) {
        finalText = finalText.replace(/\[Zaštićen Naziv Kompanije\]/g, formData.nazivTvrtke);
    }
    
    return finalText;
};


export const apiGenerateRiskQuestionnaire = async (payload) => {
    try {
        const res = await callFirebaseFunction('generateRiskQuestionnaire', payload);
        return res?.surveyJson;
    } catch (firebaseError) {
        throw new Error(firebaseError.message || 'Nepoznata greška');
    }
};

export const apiAnalyzeQuestionnaire = async (payload) => {
    try {
        const { workplaceName, surveyJson, responses, sistematizacija } = payload;
        
        let allQuestions = [];
        try {
            const sj = typeof surveyJson === 'string' ? JSON.parse(surveyJson || '{}') : (surveyJson || {});
            if (sj.questions && Array.isArray(sj.questions)) {
                allQuestions = sj.questions.filter(q => q.type !== 'heading' && q.type !== 'html');
            } else if (sj.pages && Array.isArray(sj.pages)) {
                allQuestions = sj.pages.flatMap(p => p.elements || []);
            }
        } catch { /* ignore parse errors */ }

        let responseSummary = '';
        if (Array.isArray(responses) && responses.length > 0) {
            responseSummary = allQuestions.map(q => {
                const qId = q.id || q.name;
                const allAns = responses.map(r => {
                     const answers = r?.answers || r?.data || r || {};
                     const ans = answers[qId];
                     return ans !== undefined ? (Array.isArray(ans) ? ans.join(', ') : ans) : null;
                }).filter(Boolean);
                
                const uniqueAns = [...new Set(allAns)];
                return `Pitanje: ${q.title || q.name || qId}\nOdgovori radnika (sumirano): ${uniqueAns.length ? uniqueAns.join(' | ') : 'Bez odgovora'}`;
            }).join('\n\n');
        } else {
            responseSummary = allQuestions.map(q => `Pitanje: ${q.title || q.name || q.id}\nOdgovori: (nema odgovora)`).join('\n\n');
        }

        if (allQuestions.length === 0) {
            responseSummary = `Radno mjesto: ${workplaceName || 'Nepoznato'}\nNapomena: Nema pitanja iz upitnika. Generisi genericke stavke procjene rizika za ovo radno mjesto.`;
        }

        let sistContext = '';
        if (sistematizacija) {
            sistContext = `\n\nSISTEMATIZACIJA RADNOG MJESTA:`;
            if (sistematizacija.opisPoslova) sistContext += `\nOpis poslova: ${sistematizacija.opisPoslova}`;
            if (sistematizacija.posebniUvjeti?.length) sistContext += `\nPosebni uvjeti: ${sistematizacija.posebniUvjeti.join(', ')}`;
            if (sistematizacija.uvjetiRada) {
                const uv = sistematizacija.uvjetiRada;
                const parts = Object.entries(uv).filter(([, v]) => v?.length > 0).map(([k, v]) => `${k}: ${v.join(', ')}`);
                if (parts.length) sistContext += `\nUvjeti rada: ${parts.join('; ')}`;
            }
            if (sistematizacija.potrebnaOZO?.length) sistContext += `\nPotrebna OZO: ${sistematizacija.potrebnaOZO.join(', ')}`;
            if (sistematizacija.radnaOprema?.length) sistContext += `\nRadna oprema: ${sistematizacija.radnaOprema.join(', ')}`;
            if (sistematizacija.zdravstveniZahtjevi?.length) sistContext += `\nZdravstveni zahtjevi: ${sistematizacija.zdravstveniZahtjevi.join(', ')}`;
        }

        // Route through Firebase Cloud Functions (5-minute timeout, full fallback chain)
        const result = await callFirebaseFunction('analyzeQuestionnaire', {
            workplaceName,
            responseSummary,
            sistContext,
            sistematizacija
        });

        if (!result.success || !result.analysis) {
            throw new Error(result.error || `Greška pri analizi upitnika`);
        }

        return { data: result.analysis, raw: JSON.stringify(result.analysis) };
    } catch (err) {
        throw new Error(err.message || 'Nepoznata greska pri analizi upitnika');
    }
};

export const apiGenerateRiskTable = async (jobTitle, companyName, industry, sistContext) => {
    // Route through Firebase Cloud Functions
    // This avoids Vercel's 10-second timeout limit and uses Firebase's 5-minute timeout.
    try {
        const data = await callFirebaseFunction('generateRiskTable', {
            jobTitle,
            companyName: companyName || '',
            industry: industry || 'Opća djelatnost',
            sistematizacijaKontekst: sistContext || '',
        });

        if (!data.success || !data.items) {
            throw new Error(data.error || `Greška pri generisanju tabele rizika`);
        }

        return data.items;
    } catch (err) {
        throw new Error(err.message || 'Nepoznata greška pri generisanju rizika');
    }
};

const LANG_MAP = {
    bs: 'Bosnian (bosanski)',
    hr: 'Croatian (hrvatski)',
    sr: 'Serbian Latin (srpski latinica)',
    en: 'English (engleski)',
    de: 'German (njemački)',
    sl: 'Slovenian (slovenski)'
};

function tryParseJson(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch {}
    try { return JSON.parse(str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()); } catch {}
    try {
        const f = str.indexOf('{'), l = str.lastIndexOf('}');
        if (f !== -1 && l > f) return JSON.parse(str.substring(f, l + 1));
    } catch {}
    try {
        const f = str.indexOf('['), l = str.lastIndexOf(']');
        if (f !== -1 && l > f) return JSON.parse(str.substring(f, l + 1));
    } catch {}
    return null;
}

export const apiTranslateRiskAssessment = async (metadata, items, targetLangCode) => {
    const targetLanguage = LANG_MAP[targetLangCode] || LANG_MAP.bs;
    
    // 1. Translate metadata
    const metaToTranslate = {
        nazivProcjene: metadata.nazivProcjene || '',
        opisProcesa: metadata.opisProcesa || '',
        analizaOrganizacije: metadata.analizaOrganizacije || '',
        zakljucak: metadata.zakljucak || ''
    };
    
    let translatedMeta = { ...metaToTranslate };
    if (metaToTranslate.nazivProcjene || metaToTranslate.opisProcesa || metaToTranslate.analizaOrganizacije || metaToTranslate.zakljucak) {
        const sysPromptMeta = `You are a professional safety at work (ZNR) translator.
Translate all text values in the following JSON object to the language: ${targetLanguage}.
Return ONLY the translated JSON object. Do not include markdown code block syntax (like \`\`\`json) or any other text. Keep JSON keys exactly as they are.`;
        
        try {
            const response = await apiCallZia({
                systemPrompt: sysPromptMeta,
                messages: [{ role: 'user', parts: [{ text: JSON.stringify(metaToTranslate) }] }]
            });
            const text = response?.text || '';
            const parsed = tryParseJson(text);
            if (parsed) {
                translatedMeta = parsed;
            }
        } catch (e) {
            console.error('Error translating metadata:', e);
        }
    }
    
    // 2. Translate risk items in batches of 15
    const translatedItems = [];
    const BATCH_SIZE = 15;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE).map(item => ({
            id: item.id,
            opisOpasnosti: item.opisOpasnosti || '',
            postojeceMjere: item.postojeceMjere || '',
            predlozeneMjere: item.predlozeneMjere || ''
        }));
        
        const sysPromptItems = `You are a professional safety at work (ZNR) translator.
Translate the text values (opisOpasnosti, postojeceMjere, predlozeneMjere) in the following array of JSON objects to the language: ${targetLanguage}.
Keep 'id' values exactly as they are.
Return ONLY the translated array of JSON objects. Do not include markdown code block syntax (like \`\`\`json) or any other text. Keep JSON keys exactly as they are.`;
        
        try {
            const response = await apiCallZia({
                systemPrompt: sysPromptItems,
                messages: [{ role: 'user', parts: [{ text: JSON.stringify(batch) }] }]
            });
            const text = response?.text || '';
            const parsed = tryParseJson(text);
            if (Array.isArray(parsed)) {
                parsed.forEach(translatedItem => {
                    const original = items.find(it => it.id === translatedItem.id);
                    if (original) {
                        translatedItems.push({
                            ...original,
                            opisOpasnosti: translatedItem.opisOpasnosti || '',
                            postojeceMjere: translatedItem.postojeceMjere || '',
                            predlozeneMjere: translatedItem.predlozeneMjere || ''
                        });
                    }
                });
            } else {
                // fallback to original if parsing fails
                batch.forEach(item => {
                    const original = items.find(it => it.id === item.id);
                    if (original) translatedItems.push(original);
                });
            }
        } catch (e) {
            console.error(`Error translating items batch starting at ${i}:`, e);
            batch.forEach(item => {
                const original = items.find(it => it.id === item.id);
                if (original) translatedItems.push(original);
            });
        }
    }
    
    return {
        metadata: {
            ...metadata,
            nazivProcjene: translatedMeta.nazivProcjene || '',
            opisProcesa: translatedMeta.opisProcesa || '',
            analizaOrganizacije: translatedMeta.analizaOrganizacije || '',
            zakljucak: translatedMeta.zakljucak || '',
            jezik: targetLangCode
        },
        items: translatedItems
    };
};


