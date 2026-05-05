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

export const fetchAiAutoConclusion = async (riskItems, formData) => {
    const itemsWithScores = riskItems.filter(ri => ri.rizik > 0);
    const avgBefore = itemsWithScores.length > 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
    const itemsWithAfter = riskItems.filter(ri => ri.rizikNakon > 0);
    const avgAfter = itemsWithAfter.length > 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;

    // PII Sanitization
    const sanitizedCompanyName = '[Zaštićen Naziv Kompanije]';

    const data = await apiCallZia({
        systemPrompt: 'Ti si stručnjak za zaštitu na radu u FBiH. Piši formalno, profesionalno, na bosanskom jeziku. Generiši zaključak za akt o procjeni rizika.',
        messages: [{
            role: 'user', parts: [{
                text: `Na osnovu procjene rizika sa ${riskItems.length} stavki:\n- Prosječna ocjena PRIJE mjera: ${avgBefore.toFixed(1)} (${avgBefore > 0 ? riskLevel(Math.round(avgBefore)).label : 'N/A'})\n- Prosječna ocjena NAKON mjera: ${avgAfter > 0 ? avgAfter.toFixed(1) : 'N/A'} ${avgAfter > 0 ? '(' + riskLevel(Math.round(avgAfter)).label + ')' : ''}\n- Smanjenje: ${avgAfter > 0 && avgBefore > 0 ? ((1 - avgAfter / avgBefore) * 100).toFixed(0) + '%' : 'N/A'}\n- Stavke sa visokim rizikom (R≥6): ${riskItems.filter(r => r.rizik >= 6).length}\n- Stavke sa nedopustivim rizikom (R>20): ${riskItems.filter(r => r.rizik > 20).length}\n- Naziv tvrtke: ${sanitizedCompanyName}\n- Djelatnost: ${formData.djelatnost || 'N/A'}\n\nNapiši profesionalni zaključak za akt o procjeni rizika (3-5 paragrafa). Uključi: opći zaključak, ključne rizike, obaveze poslodavca, rok za reviziju.`
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

        const systemPrompt = `Ti si strucnjak za zastitu na radu (ZNR) u Bosni i Hercegovini.
Analiziras zbirne odgovore iz upitnika SVIH radnika na ovom radnom mjestu i generises jedinstvene, konsolidovane stavke procjene rizika. Ne smijes duplirati opasnosti - ako se vise radnika zali na istu stvar, kreiraj samo jednu stavku rizika koja pokriva taj problem.

ZADATAK: Na osnovu grupnih odgovora iz upitnika${sistematizacija ? ' i sistematizacije radnog mjesta' : ''}, identifikuj sve jedinstvene opasnosti i stetnosti i za svaku procijeni vjerovatnocu (V) i posljedicu (P) na skali 1-5.

PRAVILA:
- Odgovori ISKLJUCIVO u JSON formatu i ne koristi Markdown blokove. Sadrzaj mora poceti sa { i zavrsiti sa }.
- Ne dupliraj stavke. Grupisi iste opasnosti koje je navelo vise radnika.
- Za svaku identifikovanu jedinstvenu opasnost kreiraj zasebnu stavku.
- Procijeni V (1-5) i P (1-5). Ako se mnogo radnika zali na nesto, povecaj V. Ako je opasno, povecaj P.
- Ako postoji sistematizacija, koristi uvjete rada za identifikaciju opasnosti.
- Predlozi postojece mjere (iz odgovora) i dodatne predlozene mjere.
- Generisi 5-10 stavki, KRATKO i SAZETO.

JSON FORMAT:
{
  "items": [
    {
      "opisOpasnosti": "Opis opasnosti",
      "kategorija": "fizicka|kemijska|bioloska|ergonomska|psihosocijalna|mehanicka|elektricna",
      "vjerovatnoca": 3,
      "posljedica": 4,
      "postojeceMjere": "Mjere koje su vec na snazi",
      "predlozeneMjere": "Dodatne preporucene mjere",
      "vjerovatnocaNakon": 2,
      "posljedlicaNakon": 3,
      "rokProvedbe": "30|60|90|180",
      "obrazlozenje": "Kratko obrazlozenje zasto je rizik tako procijenjen na osnovu odgovora radnika."
    }
  ],
  "ukupniKomentar": "Kratki sazetak analize na nivou grupe radnika"
}`;

        const userMsg = `RADNO MJESTO: ${workplaceName || 'Nepoznato'}

ZBIRNI ODGOVORI SVIH RADNIKA IZ UPITNIKA:
${responseSummary}${sistContext}

Analiziraj ove zbirne odgovore${sistematizacija ? ' i sistematizaciju radnog mjesta' : ''} i generisi konsolidovane stavke procjene rizika u trazenom JSON formatu.`;

        const res = await apiCallZia({
            systemPrompt,
            messages: [{ role: 'user', parts: [{ text: userMsg }] }]
        });
        
        let text = res.text || '';
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            text = text.substring(start, end + 1);
        }

        const parsed = JSON.parse(text);
        if (!parsed || !parsed.items) throw new Error("Neispravan JSON format.");

        return { data: parsed, raw: text };
    } catch (err) {
        throw new Error(err.message || 'Nepoznata greska pri analizi upitnika');
    }
};

export const apiGenerateRiskTable = async (jobTitle, companyName, industry, sistContext) => {
    try {
        // PII Sanitization
        const sanitizedCompanyName = '[Zaštićen Naziv Kompanije]';
        
        const response = await callFirebaseFunction('generateRiskTable', {
            jobTitle,
            companyName: sanitizedCompanyName,
            industry: industry || 'Opća djelatnost',
            sistematizacijaKontekst: sistContext || '',
        });
        
        if (!response.success || !response.items) {
            throw new Error(response.error || 'AI nije uspio generisati tabelu rizika.');
        }
        return response.items;
    } catch (err) {
        throw new Error(err.message || 'Nepoznata greška pri generisanju rizika');
    }
};
