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

export const fetchAiOpisProcesa = async (workplaces, hazards) => {
    try {
        const wNames = workplaces.map(w => w.naziv).join(', ');
        const hNames = hazards.map(h => h.naziv).join(', ');
        const res = await callFirebaseFunction('generateOpisProcesa', { radnaMjesta: wNames, opasnosti: hNames });
        return res?.result;
    } catch (firebaseError) {
        throw new Error(firebaseError.message || 'Nepoznata greška');
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

    const data = await apiCallZia({
        systemPrompt: 'Ti si stručnjak za zaštitu na radu u FBiH. Piši formalno, profesionalno, na bosanskom jeziku. Generiši zaključak za akt o procjeni rizika.',
        messages: [{
            role: 'user', parts: [{
                text: `Na osnovu procjene rizika sa ${riskItems.length} stavki:\n- Prosječna ocjena PRIJE mjera: ${avgBefore.toFixed(1)} (${avgBefore > 0 ? riskLevel(Math.round(avgBefore)).label : 'N/A'})\n- Prosječna ocjena NAKON mjera: ${avgAfter > 0 ? avgAfter.toFixed(1) : 'N/A'} ${avgAfter > 0 ? '(' + riskLevel(Math.round(avgAfter)).label + ')' : ''}\n- Smanjenje: ${avgAfter > 0 && avgBefore > 0 ? ((1 - avgAfter / avgBefore) * 100).toFixed(0) + '%' : 'N/A'}\n- Stavke sa visokim rizikom (R≥6): ${riskItems.filter(r => r.rizik >= 6).length}\n- Stavke sa nedopustivim rizikom (R>20): ${riskItems.filter(r => r.rizik > 20).length}\n- Naziv tvrtke: ${formData.nazivTvrtke || 'N/A'}\n- Djelatnost: ${formData.djelatnost || 'N/A'}\n\nNapiši profesionalni zaključak za akt o procjeni rizika (3-5 paragrafa). Uključi: opći zaključak, ključne rizike, obaveze poslodavca, rok za reviziju.`
            }]
        }],
    });
    if (!data.text) {
        throw new Error(data.error || 'Generisanje zaključka nije uspjelo');
    }
    return data.text;
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
        const data = await callFirebaseFunction('analyzeQuestionnaire', payload);
        if (!data.success || !data.analysis?.items) {
            throw new Error(data.error || 'Nepoznata greška');
        }
        return { data: data.analysis, raw: data.raw };
    } catch (firebaseError) {
        throw new Error(firebaseError.message || 'Nepoznata greška pri analizi');
    }
};

export const apiGenerateRiskTable = async (jobTitle, companyName, industry) => {
    try {
        const res = await fetch('https://eznr-ai-backend-757041188739.europe-west1.run.app/api/risk-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobTitle, companyName, industry })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        if (!data.items) throw new Error('Invalid JSON schema received from AI');
        return data.items;
    } catch (err) {
        throw new Error(err.message || 'Nepoznata greška pri generisanju rizika');
    }
};
