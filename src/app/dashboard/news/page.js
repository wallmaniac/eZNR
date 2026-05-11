'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCountry } from '@/contexts/CountryContext';
import { fmtDateTime } from '@/lib/dateUtils';
import { apiFetchNews } from '@/lib/newsAPI';
import { getAll, COLLECTIONS, getById, getUserCompanies } from '@/lib/dataStore';
import { LAWS } from '@/lib/lawConfig';
import { useAuth } from '@/contexts/AuthContext';
import { generateZosPdf } from '@/lib/zosPdfGenerator';
import { generateObrazac1, generateObrazac2, generateUputnica, openFormPrintWindow } from '@/lib/obrasciPdfGenerator';
import PageHeader from '@/components/PageHeader';

const TIP_CONFIG = {
    zakon: { color: 'var(--info)', bg: '#1565C015', label: 'ZAKON', icon: '⚖️' },
    pravilnik: { color: '#6A1B9A', bg: '#6A1B9A15', label: 'PRAVILNIK', icon: '📜' },
    edukacija: { color: '#00897B', bg: '#00897B15', label: 'EDUKACIJA', icon: '🎓' },
    rok: { color: 'var(--danger)', bg: '#C6282815', label: 'ROK', icon: '⏰' },
    obavijest: { color: 'var(--warning)', bg: '#E6510015', label: 'OBAVIJEST', icon: '📢' },
    inspekcija: { color: '#37474F', bg: '#37474F15', label: 'INSPEKCIJA', icon: '🔍' },
    smjernice: { color: '#558B2F', bg: '#558B2F15', label: 'SMJERNICE', icon: '📋' },
};

// ============================================================================
// JURISDICTION-SPECIFIC LAW LINKS
// ============================================================================
const LAW_LINKS_MAP = {
    BA: [
        {
            category: 'Zakoni — FBiH', icon: '🛡️',
            items: [
                { name: 'Zakon o zaštiti na radu FBiH — Sl. novine FBiH br. 79/20 ✓ VAŽEĆI', url: 'https://www.paragraf.ba/propisi/fbih/zakon-o-zastiti-na-radu.html' },
                { name: 'Zakon o radu FBiH — Sl. novine FBiH br. 26/16, 89/18, 44/22', url: 'https://www.paragraf.ba/propisi/fbih/zakon-o-radu.html' },
                { name: 'Zakon o zaštiti od požara i vatrogastvu FBiH — Sl. novine FBiH br. 64/09, 45/22', url: 'https://www.msb.gov.ba/dokumenti/10ZAKON_O_VATROGASTVU_FBIH.pdf' },
            ]
        },
        {
            category: 'Zakoni — Republika Srpska', icon: '🛡️',
            items: [
                { name: 'Zakon o zaštiti na radu RS — Sl. glasnik RS br. 1/08, 13/10, 37/12, 70/20 ✓ VAŽEĆI', url: 'https://www.paragraf.ba/propisi/republika-srpska/zakon-o-zastiti-na-radu.html' },
                { name: 'Zakon o radu RS — Sl. glasnik RS br. 1/16, 66/18, 91/21, 119/21, 112/23, 39/24', url: 'https://www.paragraf.ba/propisi/republika-srpska/zakon-o-radu.html' },
                { name: 'Sl. glasnik RS — zvanični portal (slglasnik.org)', url: 'https://slglasnik.org' },
            ]
        },
        {
            category: 'Pravilnici i podzakonski akti — FBiH', icon: '📜',
            items: [
                { name: '🆕 Pravilnik o upotrebi OZO — Sl. novine FBiH br. 42/25 (jun 2025.)', url: 'https://www.paragraf.ba/propisi/fbih/pravilnik-o-upotrebi-sredstava-i-opreme-licne-zastite-na-radu.html' },
                { name: 'Pravila o procjeni rizika — Sl. novine FBiH br. 23/21', url: 'https://www.basic.com.ba/asset/pravila_o_procjeni_rizika_sluzbene_novine_fbih_broj_23_21.pdf' },
                { name: 'Pravilnik o uvjetima i načinu obavljanja poslova ZNR — Sl. novine FBiH br. 34/21', url: 'https://www.akta.ba/legislativa/134526/pravilnik-o-nacinu-i-uvjetima-obavljanja-poslova-zastite-na-radu-kod-poslodavca' },
            ]
        },
        {
            category: 'EU Direktive (harmonizacija s BiH) ✓', icon: '🇪🇺',
            items: [
                { name: 'Direktiva 89/391/EEZ — Okvirna direktiva (transponirana u Zakon FBiH 79/20)', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0391' },
                { name: 'Direktiva 89/654/EEZ — Minimalni zahtjevi za radna mjesta', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0654' },
                { name: 'Direktiva 2009/104/EZ — Radna oprema (zamjenjuje 89/655)', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A32009L0104' },
                { name: 'Direktiva 89/656/EEZ — Osobna zaštitna oprema (transponirana u Pravilnik 42/25)', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0656' },
                { name: 'Direktiva 92/85/EEZ — Zaštita trudnica na radu', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31992L0085' },
                { name: 'Direktiva 2003/10/EZ — Buka na radu', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A32003L0010' },
                { name: 'Direktiva 2002/44/EZ — Vibracije', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A32002L0044' },
                { name: 'Direktiva 98/24/EZ — Kemijski agensi na radu', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31998L0024' },
            ]
        },
        {
            category: 'Korisni linkovi — Institucije i portali ✓', icon: '🔗',
            items: [
                { name: 'Sl. glasnik RS — slglasnik.org (e-RP registar propisa)', url: 'https://slglasnik.org' },
                { name: 'Federalna inspekcija rada (FUZIP FBiH) — fuzip.gov.ba', url: 'https://fuzip.gov.ba/inspektorati/federalni-inspektorat-rada/' },
                { name: 'Inspektorat RS — inspekcija rada — inspektorat.vladars.rs', url: 'https://inspektorat.vladars.rs' },
                { name: 'Federalno ministarstvo rada i socijalne politike FBiH', url: 'https://fmrsp.gov.ba' },
                { name: 'Narodna skupština RS — zakoni i propisi', url: 'https://www.narodnaskupstinars.net' },
                { name: 'Paragraf.ba — Pravna baza BiH (FBiH + RS zakoni)', url: 'https://www.paragraf.ba' },
                { name: 'ILO — Međunarodna organizacija rada (BiH — ILOSTAT statistike)', url: 'https://ilostat.ilo.org/data/country-profiles/bih/' },
                { name: 'EUR-Lex — EU direktive o zaštiti na radu (pretraživač)', url: 'https://eur-lex.europa.eu/search.html?text=safety+health+workers&scope=EURLEX&type=quick&lang=hr' },
            ]
        },
    ],
    HR: [
        {
            category: 'Zakoni — Republika Hrvatska', icon: '🛡️',
            items: [
                { name: 'Zakon o zaštiti na radu — NN 71/14, 118/14, 94/18, 96/18 ✓ VAŽEĆI', url: 'https://www.zakon.hr/z/167/Zakon-o-za%C5%A1titi-na-radu' },
                { name: 'Zakon o radu — NN 93/14, 127/17, 98/19, 151/22, 64/23', url: 'https://www.zakon.hr/z/307/Zakon-o-radu' },
                { name: 'Zakon o zaštiti od požara — NN 92/10, 114/22', url: 'https://www.zakon.hr/z/349/Zakon-o-za%C5%A1titi-od-po%C5%BEara' },
                { name: 'Zakon o državnom inspektoratu — NN 115/18, 117/21, 66/23', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2018_12_115_2243.html' },
            ]
        },
        {
            category: 'Pravilnici — Zaštita na radu', icon: '📜',
            items: [
                { name: 'Pravilnik o izradi procjene rizika — NN 112/14, 129/19', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2014_09_112_2154.html' },
                { name: 'Pravilnik o osposobljavanju iz zaštite na radu — NN 142/21', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2021_12_142_2422.html' },
                { name: 'Pravilnik o uporabi osobne zaštitne opreme — NN 5/21', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2021_01_5_70.html' },
                { name: 'Pravilnik o poslovima s posebnim uvjetima rada — NN 5/84', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/1984_02_5_88.html' },
                { name: 'Pravilnik o pregledu i ispitivanju radne opreme — NN 16/16, 120/22', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2016_02_16_452.html' },
                { name: 'Pravilnik o sigurnosti i zdravlju pri radu s računalom — NN 73/21', url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2021_06_73_1370.html' },
            ]
        },
        {
            category: 'EU Direktive (transponirane u zakonodavstvo RH) ✓', icon: '🇪🇺',
            items: [
                { name: 'Direktiva 89/391/EEZ — Okvirna direktiva (transponirana u ZoZNR NN 71/14)', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0391' },
                { name: 'Direktiva 89/654/EEZ — Minimalni zahtjevi za radna mjesta', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0654' },
                { name: 'Direktiva 2009/104/EZ — Radna oprema', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A32009L0104' },
                { name: 'Direktiva 89/656/EEZ — Osobna zaštitna oprema', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0656' },
                { name: 'Direktiva 2003/10/EZ — Buka na radu', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A32003L0010' },
                { name: 'Direktiva 98/24/EZ — Kemijski agensi na radu', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31998L0024' },
            ]
        },
        {
            category: 'Korisni linkovi — Institucije i portali ✓', icon: '🔗',
            items: [
                { name: 'HZZZSR — Hrvatski zavod za zaštitu zdravlja i sigurnost na radu', url: 'https://hzzzsr.hr' },
                { name: 'Ministarstvo rada, mirovinskog sustava, obitelji i socijalne politike', url: 'https://mrosp.gov.hr' },
                { name: 'Državni inspektorat — Inspektorat rada', url: 'https://dirh.gov.hr' },
                { name: 'Zakon.hr — Pravna baza RH (pročišćeni tekstovi)', url: 'https://www.zakon.hr' },
                { name: 'Narodne novine — Službeni list RH', url: 'https://narodne-novine.nn.hr' },
                { name: 'zastita.info — Stručni portal za zaštitu na radu', url: 'https://zastita.info' },
                { name: 'EUR-Lex — EU direktive o zaštiti na radu (pretraživač)', url: 'https://eur-lex.europa.eu/search.html?text=safety+health+workers&scope=EURLEX&type=quick&lang=hr' },
            ]
        },
    ],
};

// ============================================================================
// JURISDICTION-SPECIFIC FORM CATEGORIES
// ============================================================================
const FORM_CATEGORIES_MAP = {
    BA: [
        {
            title_bs: 'Prijave povreda i oboljenja',
            title_hr: 'Prijave ozljeda i oboljenja',
            title_en: 'Injury & Disease Reporting',
            icon: '🚑',
            legal: 'Pravilnik o sadržaju i načinu podnošenja izvještaja — Sl. novine FBiH br. 9/23',
            items: [
                { name: 'Obrazac br. 1 — Izvještaj o povredi na radu', shortName: 'Prijava povrede (OR)', icon: '🩹', route: '/dashboard/injuries', type: 'page', desc: 'Pravilnik 9/23, Čl. 2', printBlank: 'obrazac1' },
                { name: 'Obrazac br. 2 — Izvještaj o profesionalnom oboljenju', shortName: 'Profesionalna bolest (PB)', icon: '🫁', route: '/dashboard/diseases', type: 'page', desc: 'Pravilnik 9/23, Čl. 3', printBlank: 'obrazac2' },
                { name: 'Obrazac OIR-1 — Obavijest o događaju na radu', shortName: 'Obavijest (OIR-1)', icon: '📑', route: '/dashboard/form-oir1', type: 'page', desc: 'Čl. 63. Zakona 79/20' },
            ]
        },
        {
            title_bs: 'Ljekarske uputnice i nalazi',
            title_hr: 'Liječničke uputnice i nalazi',
            title_en: 'Medical Referrals & Reports',
            icon: '🩺',
            legal: 'Pravilnik o raspoređivanju radnika na poslove s povećanim rizikom — Sl. novine FBiH',
            items: [
                { name: 'Uputnica za prethodni ljekarski pregled', shortName: 'Uputnica (prethodni)', icon: '📋', route: '/dashboard/referral-ra1', type: 'page', desc: 'Obrazac br. 1 Pravilnika', printBlank: 'uputnica-prethodni' },
                { name: 'Uputnica za periodični ljekarski pregled', shortName: 'Uputnica (periodični)', icon: '📋', route: '/dashboard/referral-ra1', type: 'page', desc: 'Obrazac br. 3 Pravilnika', printBlank: 'uputnica-periodicni' },
                { name: 'Obrazac RO1 — Liječnički nalaz (ocjena radne sposobnosti)', shortName: 'Liječnički nalaz (RO1)', icon: '🏥', route: '/dashboard/form-ro1', type: 'page', desc: 'Obrazac br. 2 Pravilnika' },
                { name: 'Obrazac RO2 — Potvrda o privremenoj nesposobnosti', shortName: 'Privremena nesposobnost (RO2)', icon: '📄', route: '/dashboard/form-ro2', type: 'page', desc: 'Obrazac br. 4 Pravilnika' },
            ]
        },
        {
            title_bs: 'Zapisnici o osposobljavanju',
            title_hr: 'Zapisnici o osposobljavanju',
            title_en: 'Training Records',
            icon: '📝',
            legal: 'Čl. 34., 48., 49. Zakona o zaštiti na radu FBiH (Sl. novine FBiH br. 79/20)',
            items: [
                { name: 'Zapisnik ZOS — Ocjena osposobljenosti za rad na siguran način', shortName: 'Zapisnik ZOS', icon: '📝', route: '/dashboard/trainings', type: 'page', desc: 'Čl. 48-49 Zakona 79/20', printBlank: 'zos' },
                { name: 'Zapisnik ZOP — Ocjena osposobljenosti za zaštitu od požara', shortName: 'Zapisnik ZOP', icon: '🔥', route: '/dashboard/trainings', type: 'page', desc: 'Zakon o zaštiti od požara FBiH 64/09', printBlank: 'zop' },
            ]
        },
        {
            title_bs: 'Evidencije i ostali obrasci',
            title_hr: 'Evidencije i ostali obrasci',
            title_en: 'Records & Other Forms',
            icon: '📊',
            legal: 'Zakon o radu FBiH (Sl. novine FBiH br. 26/16) + Pravilnik 92/16',
            items: [
                { name: 'Evidencija noćnog rada (NR1)', shortName: 'Noćni rad (NR1)', icon: '🌙', route: '/dashboard/night-work', type: 'page', desc: 'Pravilnik 92/16, Čl. 36-38 ZoR' },
            ]
        },
    ],
    HR: [
        {
            title_bs: 'Prijave povreda i oboljenja',
            title_hr: 'Prijave ozljeda i oboljenja',
            title_en: 'Injury & Disease Reporting',
            icon: '🚑',
            legal: 'Pravilnik o evidenciji, ispravama, izvještajima i knjizi nadz. iz ZNR — NN 52/84',
            items: [
                { name: 'Obrazac br. 1 — Prijava ozljede na radu', shortName: 'Prijava ozljede (OR)', icon: '🩹', route: '/dashboard/injuries', type: 'page', desc: 'Čl. 65. ZoZNR (NN 71/14)', printBlank: 'obrazac1' },
                { name: 'Obrazac br. 2 — Prijava profesionalne bolesti', shortName: 'Profesionalna bolest (PB)', icon: '🫁', route: '/dashboard/diseases', type: 'page', desc: 'Čl. 65. ZoZNR (NN 71/14)', printBlank: 'obrazac2' },
                { name: 'Obrazac OIR-1 — Obavijest o događaju na radu', shortName: 'Obavijest (OIR-1)', icon: '📑', route: '/dashboard/form-oir1', type: 'page', desc: 'Čl. 65. ZoZNR (NN 71/14)' },
            ]
        },
        {
            title_bs: 'Ljekarske uputnice i nalazi',
            title_hr: 'Liječničke uputnice i nalazi',
            title_en: 'Medical Referrals & Reports',
            icon: '🩺',
            legal: 'Pravilnik o poslovima s posebnim uvjetima rada — NN 5/84',
            items: [
                { name: 'Uputnica za prethodni liječnički pregled', shortName: 'Uputnica (prethodni)', icon: '📋', route: '/dashboard/referral-ra1', type: 'page', desc: 'Čl. 36. ZoZNR (NN 71/14)', printBlank: 'uputnica-prethodni' },
                { name: 'Uputnica za periodični liječnički pregled', shortName: 'Uputnica (periodični)', icon: '📋', route: '/dashboard/referral-ra1', type: 'page', desc: 'Čl. 36. ZoZNR (NN 71/14)', printBlank: 'uputnica-periodicni' },
                { name: 'Obrazac RO1 — Liječnički nalaz (ocjena radne sposobnosti)', shortName: 'Liječnički nalaz (RO1)', icon: '🏥', route: '/dashboard/form-ro1', type: 'page', desc: 'Pravilnik NN 5/84' },
                { name: 'Obrazac RO2 — Potvrda o privremenoj nesposobnosti', shortName: 'Privremena nesposobnost (RO2)', icon: '📄', route: '/dashboard/form-ro2', type: 'page', desc: 'Pravilnik NN 5/84' },
            ]
        },
        {
            title_bs: 'Zapisnici o osposobljavanju',
            title_hr: 'Zapisnici o osposobljavanju',
            title_en: 'Training Records',
            icon: '📝',
            legal: 'Pravilnik o osposobljavanju iz zaštite na radu — NN 142/21',
            items: [
                { name: 'Zapisnik ZOS — Ocjena osposobljenosti za rad na siguran način', shortName: 'Zapisnik ZOS', icon: '📝', route: '/dashboard/trainings', type: 'page', desc: 'Čl. 27-30 ZoZNR (NN 71/14)', printBlank: 'zos' },
                { name: 'Zapisnik ZOP — Ocjena osposobljenosti za zaštitu od požara', shortName: 'Zapisnik ZOP', icon: '🔥', route: '/dashboard/trainings', type: 'page', desc: 'Zakon o zaštiti od požara (NN 92/10)', printBlank: 'zop' },
            ]
        },
        {
            title_bs: 'Evidencije i ostali obrasci',
            title_hr: 'Evidencije i ostali obrasci',
            title_en: 'Records & Other Forms',
            icon: '📊',
            legal: 'Zakon o radu (NN 93/14, 151/22, 64/23)',
            items: [
                { name: 'Evidencija noćnog rada (NR1)', shortName: 'Noćni rad (NR1)', icon: '🌙', route: '/dashboard/night-work', type: 'page', desc: 'Čl. 69-72 ZoR (NN 93/14)' },
            ]
        },
    ],
};

// Parse "DD.MM.YYYY." → Date for sorting
function parseBSDate(str) {
    const m = (str || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return new Date(0);
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

// Guess a reliable root URL or search query for the source
function guessSourceUrl(izvor, naslov, country = 'BA') {
    const src = (izvor || '').toLowerCase();
    
    // HR reliable sources
    if (src.includes('narodne novine') || src.includes('nn ') || src.includes('nn.hr')) return 'https://narodne-novine.nn.hr';
    if (src.includes('zakon.hr')) return 'https://www.zakon.hr';
    if (src.includes('hzzzsr')) return 'https://hzzzsr.hr';
    if (src.includes('mrosp')) return 'https://mrosp.gov.hr';
    if (src.includes('inspektorat') && country === 'HR') return 'https://dirh.gov.hr';

    // BA reliable sources
    if (src.includes('sl. novine') || src.includes('sluzbene novine') || src.includes('sllist')) return 'https://www.sllist.ba';
    if (src.includes('sl. glasnik') || src.includes('sluzbeni glasnik') || src.includes('slglasnik')) return 'https://slglasnik.org';
    if (src.includes('inspektorat') && country === 'BA') return 'https://fuzip.gov.ba';
    
    // Shared / Generic
    if (src.includes('eu') || src.includes('direktiv') || src.includes('eur-lex')) return 'https://eur-lex.europa.eu';

    // Ultimate fallback: Google search with exact query
    const suffix = country === 'HR' ? 'Hrvatska zaštita na radu' : 'Bosna i Hercegovina zaštita na radu';
    return `https://www.google.com/search?q=${encodeURIComponent((naslov || izvor || '') + ' ' + suffix)}`;
}

function NewsCard({ item, country }) {
    const cfg = TIP_CONFIG[item.tip] || TIP_CONFIG.obavijest;
    // ALWAYS use our guessed URL because Gemini hallucinates fake specific paths that 404
    const titleUrl = guessSourceUrl(item.izvor, item.naslov, country);
    const sourceUrl = titleUrl;

    const handleCardClick = (e) => {
        // Don't navigate if clicking on an internal link (source, verify, etc.)
        if (e.target.closest('a')) return;
        window.open(titleUrl, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="card" style={{ borderLeft: `4px solid ${cfg.color}`, transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer' }}
            onClick={handleCardClick}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
            <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <span style={{ fontSize: '1.6rem', flexShrink: 0, marginTop: 2 }}>{cfg.icon}</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.datum}</span>
                            <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em', background: cfg.bg, color: cfg.color }}>
                                {item.tip?.toUpperCase()}
                            </span>
                            {item.izvor && (
                                <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: '0.72rem', color: 'var(--primary)', fontStyle: 'italic', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                    title={`Otvori: ${item.izvor}`}>
                                    📌 {item.izvor} ↗
                                </a>
                            )}
                            <span style={{ marginLeft: 'auto', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(255,193,7,0.12)', color: '#f59e0b', fontWeight: 700 }}
                                title="Sadržaj generira AI — može biti netačan. Uvijek provjerite originalni izvor.">AI</span>
                        </div>
                        {/* Clickable title */}
                        <a href={titleUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <h3 style={{ marginBottom: 8, fontSize: '1rem', lineHeight: 1.4, cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.color = cfg.color}
                                onMouseLeave={e => e.currentTarget.style.color = ''}>
                                {item.naslov}
                            </h3>
                        </a>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.65, margin: 0 }}>{item.opis}</p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                            <a href={titleUrl} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: cfg.color, textDecoration: 'none', fontWeight: 600 }}>
                                {item.url ? 'Više informacija →' : '🔍 Pretraži temu →'}
                            </a>
                            <a href={`https://www.google.com/search?q=${encodeURIComponent((item.naslov || '') + (country === 'HR' ? ' site:zakon.hr OR site:nn.hr OR site:hzzzsr.hr' : ' site:sllist.ba OR site:slglasnikrs.ba OR site:fbihvlada.gov.ba'))}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>
                                ✔ Provjeri tačnost
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function NewsPage() {
    const { t, lang } = useLanguage();
    const country = useCountry(); // 'BA' or 'HR'
    const [activeTab, setActiveTab] = useState('news');
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [fromCache, setFromCache] = useState(false);
    const [source, setSource] = useState(null); // 'gemini' | 'static' | null
    const [nextRefresh, setNextRefresh] = useState(null);

    const cacheKey = `eznr_news_cache_${country}`;

    // On mount: load from localStorage ONLY — never auto-call the API
    useEffect(() => {
        try {
            const raw = localStorage.getItem(cacheKey);
            if (raw) {
                const cached = JSON.parse(raw);
                setNews(cached.news || []);
                setLastUpdated(cached.ts ? new Date(cached.ts) : null);
                setFromCache(true);
                setSource(cached.source || 'cache');
            } else {
                setNews([]);
                setLastUpdated(null);
                setFromCache(false);
                setSource(null);
            }
        } catch { /* ignore */ }
    }, [cacheKey]);

    // Fetch news with jurisdiction context
    const fetchAndCache = useCallback(async (force = false) => {
        setLoading(true);
        try {
            const data = await apiFetchNews(force, country);
            const freshNews = data.news || [];
            setNews(freshNews);
            setLastUpdated(new Date());
            setFromCache(false);
            setSource(data.source || null);
            setNextRefresh(data.nextRefresh ?? null);
            localStorage.setItem(cacheKey, JSON.stringify({
                news: freshNews,
                ts: new Date().toISOString(),
                source: data.source || null,
            }));
        } catch (err) {
            console.error('News fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [country, cacheKey]);


    const tabs = [
        { key: 'news', label: 'Vijesti', icon: '📰' },
        { key: 'laws', label: 'Zakoni & propisi', icon: '⚖️' },
        { key: 'forms', label: 'Obrasci', icon: '📄' },
    ];

    const formatTime = (d) => fmtDateTime(d) || '';

    return (
        <div className="animate-fadeIn">
            <PageHeader icon="📰" title={lang !== 'en' ? 'Početna' : 'Home'} />

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
                {tabs.map(tb => (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                        className={`tab-btn ${activeTab === tb.key ? 'active' : ''}`}>
                        {tb.icon} {tb.label}
                    </button>
                ))}
            </div>

            {/* ── NEWS TAB ── */}
            {activeTab === 'news' && (
                <div>
                    {/* Header bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {source === 'gemini' ? (
                                <span style={{ fontSize: '0.8rem', padding: '3px 12px', borderRadius: 'var(--radius-full)', background: 'linear-gradient(135deg,#00897B,#00695C)', color: 'white', fontWeight: 700, letterSpacing: '0.04em' }}>
                                    🤖 AI Pregled
                                </span>
                            ) : source === 'static' ? (
                                <span style={{ fontSize: '0.8rem', padding: '3px 12px', borderRadius: 'var(--radius-full)', background: 'linear-gradient(135deg,#37474F,#546E7A)', color: 'white', fontWeight: 700, letterSpacing: '0.04em' }}>
                                    📚 Info ZNR
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.8rem', padding: '3px 12px', borderRadius: 'var(--radius-full)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    📰 Vijesti
                                </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Zaštita na radu · {country === 'HR' ? 'Republika Hrvatska' : 'Bosna i Hercegovina'}
                            </span>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                            {lastUpdated && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    {fromCache ? '💾 Sačuvano' : '🔄 Osvježeno'}: {formatTime(lastUpdated)}
                                    {nextRefresh != null && ` · sljedeće za ${nextRefresh}min`}
                                </span>
                            )}
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={() => fetchAndCache(true)}
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                {loading
                                    ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Učitavam...</>
                                    : <>🔄 Osvježi vijesti</>
                                }
                            </button>
                        </div>
                    </div>

                    {/* Loading skeleton */}
                    {loading && news.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="card" style={{ borderLeft: '4px solid var(--border)' }}>
                                    <div className="card-body">
                                        <div style={{ display: 'flex', gap: 14 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-input)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ height: 12, width: 120, background: 'var(--bg-input)', borderRadius: 4, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
                                                <div style={{ height: 18, width: '70%', background: 'var(--bg-input)', borderRadius: 4, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
                                                <div style={{ height: 12, width: '100%', background: 'var(--bg-input)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* News cards — sorted newest → oldest */}
                    {!loading && news.length> 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[...news].sort((a, b) => parseBSDate(b.datum) - parseBSDate(a.datum)).map((item, i) => <NewsCard key={i} item={item} country={country} />)}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && news.length === 0 && (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>📰</div>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Nema sačuvanih vijesti</div>
                                <div style={{ fontSize: '0.85rem', marginBottom: 14, opacity: 0.75 }}>Klikni "Osvježi vijesti" da učitaš najnovije vijesti iz oblasti ZNR.</div>
                                <button className="btn btn-primary btn-sm" onClick={() => fetchAndCache(true)}>🔄 Učitaj vijesti</button>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 20, padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {source === 'gemini'
                            ? (country === 'HR'
                                ? '🤖 Vijesti generira Google Gemini AI na osnovu javno dostupnih zakona RH. Uvijek provjerite Narodne novine i zakon.hr za službene informacije.'
                                : '🤖 Vijesti generira Google Gemini AI na osnovu javno dostupnih zakona BiH. Uvijek provjerite Sl. novine FBiH i Sl. glasnik RS za zvanične informacije.')
                            : (country === 'HR'
                                ? '📚 Prikazane informacije temelje se na važećim propisima ZNR u RH. Uvijek provjerite originalne izvore za aktualne izmjene.'
                                : '📚 Prikazane informacije temelje se na važećim propisima ZNR u BiH. Uvijek provjerite originalne izvore za aktualne izmjene.')}
                    </div>
                </div>
            )}

            {/* ── LAWS TAB ── */}
            {activeTab === 'laws' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Hero: Open full reference document */}
                    <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', border: 'none' }}>
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'white', marginBottom: 4 }}>
                                    ⚖️ {country === 'HR' ? 'Zakonodavstvo ZNR u RH — kompletan pregled' : 'Zakonodavstvo ZNR u BiH — kompletan pregled'}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.82)' }}>
                                    {country === 'HR'
                                        ? 'Svi zakoni, pravilnici, EU direktive i institucioni linkovi — na jednom mjestu.'
                                        : 'Svi zakoni, pravilnici (uključujući novi OZO pravilnik 42/25), EU direktive i institucioni linkovi — na jednom mjestu.'}
                                </div>
                            </div>
                            <a href="/dashboard/znr-zakonodavstvo"
                                style={{ flexShrink: 0, padding: '8px 20px', borderRadius: 'var(--radius-full)', background: 'var(--bg-card)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                                Otvori dokument →
                            </a>
                        </div>
                    </div>

                    {(LAW_LINKS_MAP[country] || LAW_LINKS_MAP.BA).map((cat, idx) => (
                        <div key={idx} className="card">
                            <div className="card-body">
                                <h3 style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: '1rem' }}>
                                    {cat.icon} {cat.category}
                                </h3>
                                {cat.items.map((item, i) => (
                                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--text)',
                                            padding: '11px 14px', borderRadius: 'var(--radius-sm)',
                                            borderBottom: i < cat.items.length - 1 ? '1px solid var(--border-light)' : 'none',
                                            transition: 'background 0.15s',
                                        }}>
                                        <span style={{ color: 'var(--primary)', fontSize: '1rem' }}>📄</span>
                                        <span style={{ fontSize: '0.88rem', flex: 1 }}>{item.name}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, flexShrink: 0 }}>
                                            Otvori ↗
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── FORMS TAB ── */}
            {activeTab === 'forms' && (
                <FormsTab lang={lang} country={country} />
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
            `}</style>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FormsTab — Categorized official forms with blank template downloads
   ═══════════════════════════════════════════════════════════════════════════════ */
function FormsTab({ lang, country }) {
    const { activeCompanyId, user } = useAuth();

    /** Generate a blank ZOS template and open in a print window */
    const printBlankZos = () => {
        const companies = getUserCompanies(user?.id);
        const company = companies.find(c => c.id === activeCompanyId) || {};
        const html = generateZosPdf({
            company: { naziv: company.naziv || '', adresa: company.adresa || '', mjesto: company.mjesto || '', postanskiBroj: company.postanskiBroj || '', oib: company.oib || '', direktor: company.direktor || '', logo: company.logo || '' },
            worker: { ime: '', prezime: '', jmbg: '', oib: '' },
            workplaceName: '',
            training: { naziv: '' },
            officer: company.strucnoLice || '',
            date: '',
            certOznaka: '',
            testResult: '',
        });
        const w = window.open('', '_blank', 'width=800,height=1100');
        if (w) { w.document.write(html); w.document.close(); }
    };

    /** Generate a blank ZOP template — same structure, fire safety focus */
    const printBlankZop = () => {
        const companies = getUserCompanies(user?.id);
        const company = companies.find(c => c.id === activeCompanyId) || {};
        const country = company.country || 'BA';
        const fireLaw = LAWS[country]?.fire || LAWS.BA.fire;
        // Build a ZOP-specific HTML (fire safety variant of ZOS)
        const formattedDate = '__.__.____.';
        const logoHtml = company.logo ? `<img src="${company.logo}" style="max-height:60px; max-width:180px; object-fit:contain;" />` : '';
        const html = `<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8"><title>ZOP - Prazan obrazac</title>
<style>
    @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; background: #fff; }
    .page { width: 100%; max-width: 210mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #b71c1c; padding-bottom: 12px; margin-bottom: 8px; }
    .company-info { flex: 1; }
    .company-name { font-size: 14pt; font-weight: 800; color: #b71c1c; }
    .company-details { font-size: 8.5pt; color: #555; margin-top: 3px; line-height: 1.4; }
    .logo-area { text-align: right; }
    .doc-title { text-align: center; margin: 18px 0 6px; font-size: 13pt; font-weight: 800; text-transform: uppercase; color: #b71c1c; letter-spacing: 0.5px; }
    .doc-subtitle { text-align: center; font-size: 9pt; color: #666; margin-bottom: 16px; }
    .doc-ref { text-align: center; font-size: 8.5pt; color: #888; margin-bottom: 20px; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 10pt; font-weight: 700; color: #b71c1c; border-bottom: 1.5px solid #ddd; padding-bottom: 3px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
    .data-row { display: flex; border-bottom: 1px solid #eee; padding: 4px 0; font-size: 10pt; }
    .data-label { width: 220px; font-weight: 600; color: #444; flex-shrink: 0; }
    .data-value { flex: 1; font-weight: 400; }
    .checklist { margin: 8px 0; }
    .check-item { display: flex; align-items: flex-start; gap: 8px; padding: 3px 0; font-size: 9.5pt; line-height: 1.4; }
    .check-box { width: 14px; height: 14px; border: 1.5px solid #b71c1c; border-radius: 2px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; color: #b71c1c; flex-shrink: 0; margin-top: 2px; }
    .assessment-box { border: 2px solid #b71c1c; border-radius: 6px; padding: 12px 16px; margin: 14px 0; background: #fff5f5; }
    .assessment-text { font-size: 10.5pt; font-weight: 600; text-align: center; color: #b71c1c; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; gap: 20px; }
    .sig-block { flex: 1; text-align: center; }
    .sig-role { font-size: 8.5pt; color: #666; margin-bottom: 4px; font-weight: 600; }
    .sig-line { border-top: 1.5px solid #333; margin-top: 40px; padding-top: 4px; font-size: 9.5pt; font-weight: 600; }
    .sig-note { font-size: 7.5pt; color: #999; margin-top: 2px; }
    .footer { border-top: 2px solid #b71c1c; margin-top: 20px; padding-top: 8px; font-size: 7.5pt; color: #999; text-align: center; }
    .legal-ref { font-size: 8pt; color: #888; font-style: italic; text-align: center; margin: 6px 0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
</style></head><body>
<div class="page">
    <div class="header">
        <div class="company-info">
            <div class="company-name">${company.naziv || '________________________________'}</div>
            <div class="company-details">${company.adresa ? company.adresa + ', ' : ''}${company.mjesto || ''} ${company.postanskiBroj || ''}<br>${company.oib ? 'ID broj: ' + company.oib : ''}</div>
        </div>
        <div class="logo-area">${logoHtml}</div>
    </div>
    <div class="doc-title">Zapisnik o ocjeni osposobljenosti<br>radnika za zaštitu od požara</div>
    <div class="doc-subtitle">Obrazac ZOP — u skladu sa ${fireLaw.name} ("${fireLaw.gazette}")</div>
    <div class="doc-ref">Broj: ________ &nbsp;&nbsp;|&nbsp;&nbsp; Datum: ${formattedDate}</div>
    <div class="section">
        <div class="section-title">I. Podaci o radniku</div>
        <div class="data-row"><span class="data-label">Ime i prezime:</span><span class="data-value">________________________</span></div>
        <div class="data-row"><span class="data-label">JMBG:</span><span class="data-value">________________________</span></div>
        <div class="data-row"><span class="data-label">OIB / ID broj radnika:</span><span class="data-value">________________________</span></div>
        <div class="data-row"><span class="data-label">Radno mjesto:</span><span class="data-value">________________________</span></div>
    </div>
    <div class="section">
        <div class="section-title">II. Podaci o osposobljavanju za zaštitu od požara</div>
        <div class="data-row"><span class="data-label">Program osposobljavanja:</span><span class="data-value">________________________</span></div>
        <div class="data-row"><span class="data-label">Mjesto provođenja:</span><span class="data-value">${company.adresa || ''}, ${company.mjesto || ''}</span></div>
        <div class="data-row"><span class="data-label">Datum osposobljavanja:</span><span class="data-value">${formattedDate}</span></div>
        <div class="data-row"><span class="data-label">Rezultat provjere znanja:</span><span class="data-value">________</span></div>
        <div class="data-row"><span class="data-label">Stručnjak zaštite od požara:</span><span class="data-value">${company.strucnoLice || '________________________'}</span></div>
    </div>
    <div class="section">
        <div class="section-title">III. Teoretski dio — zaštita od požara</div>
        <p style="font-size:9.5pt; margin-bottom:6px; color:#333;">
            Stručnjak zaštite od požara ocjenjuje da je radnik <strong>________________________</strong>
            u teoretskom dijelu <strong>osposobljen/a</strong> za zaštitu od požara za poslove radnog mjesta
            <strong>________________________</strong>.
        </p>
        <p style="font-size:9pt; color:#666;">
            Tijekom osposobljavanja radnik je upoznat sa: uzrocima nastanka požara na radnom mjestu,
            mjerama za sprečavanje požara, postupcima u slučaju požara, upotrebom PP aparata i hidranata,
            planom evakuacije i spašavanja, te pravima i dužnostima u provođenju propisa zaštite od požara.
        </p>
    </div>
    <div class="section">
        <div class="section-title">IV. Provjera praktične osposobljenosti</div>
        <p style="font-size:9pt; color:#666; margin-bottom:8px;">Neposredni ovlaštenik i stručnjak potvrđuju da radnik:</p>
        <div class="checklist">
            <div class="check-item"><span class="check-box">☐</span> Poznaje i primjenjuje mjere zaštite od požara na svom radnom mjestu</div>
            <div class="check-item"><span class="check-box">☐</span> Pravilno koristi PP aparat (S-9, CO2) i zna lokacije PP opreme</div>
            <div class="check-item"><span class="check-box">☐</span> Poznaje plan evakuacije i zna evakuacijske puteve</div>
            <div class="check-item"><span class="check-box">☐</span> Zna postupak dojave požara (telefon 123, vatrodojavni sistem)</div>
            <div class="check-item"><span class="check-box">☐</span> Odmah obavještava neposrednog rukovodioca o uočenim opasnostima od požara</div>
            <div class="check-item"><span class="check-box">☐</span> Poznaje zabranu pušenja i korištenja otvorenog plamena na mjestima s povećanim rizikom od požara</div>
            <div class="check-item"><span class="check-box">☐</span> Zna postupke pružanja prve pomoći u slučaju opeklina</div>
        </div>
    </div>
    <div class="section">
        <div class="section-title">V. Zaključna ocjena</div>
        <div class="assessment-box">
            <div class="assessment-text">
                Na osnovu provedenog teoretskog i praktičnog osposobljavanja, ocjenjuje se da je radnik/ca<br>
                <strong style="font-size:12pt;">________________________</strong><br>
                <strong>OSPOSOBLJEN/A</strong> za zaštitu od požara<br>
                na poslovima radnog mjesta: <strong>________________________</strong>
            </div>
        </div>
    </div>
    <div class="legal-ref">${fireLaw.name} ("${fireLaw.gazette}")</div>
    <div class="signatures">
        <div class="sig-block"><div class="sig-role">Osposobljeni radnik</div><div class="sig-line">________________________</div><div class="sig-note">(potpis radnika)</div></div>
        <div class="sig-block"><div class="sig-role">Neposredni ovlaštenik poslodavca</div><div class="sig-line">${company.direktor || '________________________'}</div><div class="sig-note">(potpis ovlaštenika)</div></div>
        <div class="sig-block"><div class="sig-role">Stručnjak zaštite od požara</div><div class="sig-line">${company.strucnoLice || '________________________'}</div><div class="sig-note">(potpis stručnjaka)</div></div>
    </div>
    <div class="footer">${company.naziv || ''} &nbsp;|&nbsp; ${company.adresa || ''}, ${company.mjesto || ''} &nbsp;|&nbsp; ${formattedDate}<br>Ovaj zapisnik se čuva trajno u evidencijama poslodavca i predočava inspektoru rada na zahtjev.</div>
</div></body></html>`;
        const w = window.open('', '_blank', 'width=800,height=1100');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const handlePrintBlank = (type) => {
        const companies = getUserCompanies(user?.id);
        const company = companies.find(c => c.id === activeCompanyId) || {};
        if (type === 'zos') { printBlankZos(); return; }
        if (type === 'zop') { printBlankZop(); return; }
        if (type === 'obrazac1') { openFormPrintWindow(generateObrazac1({ company })); return; }
        if (type === 'obrazac2') { openFormPrintWindow(generateObrazac2({ company })); return; }
        if (type === 'uputnica-prethodni') { openFormPrintWindow(generateUputnica({ company, tipPregleda: 'prethodni' })); return; }
        if (type === 'uputnica-periodicni') { openFormPrintWindow(generateUputnica({ company, tipPregleda: 'periodicni' })); return; }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Hero banner */}
            <div className="card" style={{ background: 'linear-gradient(135deg, #0B2A3C, #1a4a5e)', border: 'none' }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '2.2rem' }}>📋</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'white', marginBottom: 4 }}>
                            Službeni obrasci ZNR — {country === 'HR' ? 'Republika Hrvatska' : 'Bosna i Hercegovina'}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                            {country === 'HR'
                                ? 'Svi obrasci su usklađeni sa Zakonom o zaštiti na radu (NN 71/14, 118/14, 94/18, 96/18), Pravilnikom o osposobljavanju (NN 142/21) i Zakonom o radu (NN 93/14). Popunite i isprintajte ili preuzmite prazne obrasce za ručno popunjavanje.'
                                : 'Svi obrasci su usklađeni sa Zakonom o zaštiti na radu FBiH (Sl. novine FBiH br. 79/20), Pravilnikom 9/23, Zakonom o zaštiti od požara (64/09) i Zakonom o radu (26/16). Popunite i isprintajte ili preuzmite prazne obrasce za ručno popunjavanje.'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories */}
            {(FORM_CATEGORIES_MAP[country] || FORM_CATEGORIES_MAP.BA).map((cat, catIdx) => (
                <div key={catIdx} className="card">
                    <div className="card-body">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>{lang === 'en' ? cat.title_en : (lang === 'hr' ? cat.title_hr : cat.title_bs)}</h3>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 16, paddingLeft: 36, fontStyle: 'italic' }}>
                            📌 {cat.legal}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                            {cat.items.map((form, idx) => (
                                <div key={idx} style={{
                                    padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                                    display: 'flex', alignItems: 'flex-start', gap: 14, transition: 'all 0.2s',
                                    background: 'var(--bg-card)',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                                    <span style={{ fontSize: '1.5rem', flexShrink: 0, marginTop: 2 }}>{form.icon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 3, color: 'var(--text)' }}>{form.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8 }}>{form.desc}</div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <a href={form.route} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                                                background: 'var(--primary)', color: 'white', textDecoration: 'none',
                                                transition: 'opacity 0.15s', cursor: 'pointer',
                                            }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                                📂 {lang !== 'en' ? 'Popuni obrazac' : 'Fill form'}
                                            </a>
                                            {form.printBlank && (
                                                <button onClick={() => handlePrintBlank(form.printBlank)} style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                    padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                                                    background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)',
                                                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-body)',
                                                }}>
                                                    🖨️ {lang !== 'en' ? 'Preuzmi prazan' : 'Download blank'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}

            {/* Footer note */}
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flexShrink: 0 }}>⚖️</span>
                <span>
                    {country === 'HR'
                        ? <>
                            Svi obrasci temelje se na važećim propisima RH. Zapisnici ZOS i ZOP su usklađeni sa Zakonom o zaštiti na radu (NN 71/14) i Zakonom o zaštiti od požara (NN 92/10).
                            Za službene tekstove propisa pogledajte <a href="https://www.zakon.hr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>zakon.hr</a> ili
                            Narodne novine na <a href="https://narodne-novine.nn.hr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>nn.hr</a>.
                          </>
                        : <>
                            Svi obrasci temelje se na važećim propisima FBiH. Pravilnik 9/23 zamjenjuje ranije obrasce za prijavu povreda.
                            Zapisnici ZOS i ZOP su usklađeni sa Zakonom o zaštiti na radu (79/20) i Zakonom o zaštiti od požara (64/09).
                            Za zvanične tekstove propisa pogledajte <a href="https://www.paragraf.ba" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>paragraf.ba</a> ili
                            Službene novine FBiH na <a href="https://www.sllist.ba" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>sllist.ba</a>.
                          </>
                    }
                </span>
            </div>
        </div>
    );
}
