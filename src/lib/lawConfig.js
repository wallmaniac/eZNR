/**
 * lawConfig.js — Centralized law references for BiH and Croatia
 * 
 * All legal citations, gazette references, article numbers, and institutional
 * links are stored here so that every module in the app can dynamically
 * adapt to the company's jurisdiction (BA or HR).
 */

// ─────────────────────────────────────────────────────────────────────────────
// LAWS — Primary legislation
// ─────────────────────────────────────────────────────────────────────────────

export const LAWS = {
  BA: {
    osh: {
      name: 'Zakon o zaštiti na radu FBiH',
      shortName: 'ZNR FBiH',
      gazette: 'Sl. novine FBiH br. 79/20',
      gazetteShort: '79/20',
      year: 2020,
      url: 'https://www.paragraf.ba/propisi/fbih/zakon-o-zastiti-na-radu.html',
      articles: {
        training: '26, 34, 48, 49',
        trainingObligation: '26',
        trainingAssessment: '48, 49',
        workerTraining: '34',
        medical: '44',
        medicalNight: '44. st. 3',
        incident: '63',
        zosInvalidation: '34',
      },
      articleWord: 'Član',
    },
    labor: {
      name: 'Zakon o radu FBiH',
      gazette: 'Sl. novine FBiH br. 26/16, 89/18, 44/22',
      gazetteShort: '26/16',
      year: 2022,
      url: 'https://www.paragraf.ba/propisi/fbih/zakon-o-radu.html',
    },
    fire: {
      name: 'Zakon o zaštiti od požara i vatrogastvu FBiH',
      gazette: 'Sl. novine FBiH br. 64/09, 45/22',
      gazetteShort: '64/09',
      year: 2022,
      url: 'https://www.msb.gov.ba/dokumenti/10ZAKON_O_VATROGASTVU_FBIH.pdf',
    },
  },
  HR: {
    osh: {
      name: 'Zakon o zaštiti na radu',
      shortName: 'ZNR',
      gazette: 'NN 71/14, 118/14, 154/14, 94/18, 96/18',
      gazetteShort: 'NN 71/14',
      year: 2018,
      url: 'https://www.zakon.hr/z/167/Zakon-o-za%C5%A1titi-na-radu',
      articles: {
        training: '27, 28, 29, 30',
        trainingObligation: '27',
        trainingAssessment: '27',
        workerTraining: '27-30',
        medical: '36',
        medicalNight: '36',
        incident: '65',
        zosInvalidation: '27',
      },
      articleWord: 'Članak',
    },
    labor: {
      name: 'Zakon o radu',
      gazette: 'NN 93/14, 127/17, 98/19, 151/22, 64/23',
      gazetteShort: 'NN 93/14',
      year: 2023,
      url: 'https://www.zakon.hr/z/307/Zakon-o-radu',
    },
    fire: {
      name: 'Zakon o zaštiti od požara',
      gazette: 'NN 92/10, 114/22',
      gazetteShort: 'NN 92/10',
      year: 2022,
      url: 'https://www.zakon.hr/z/349/Zakon-o-za%C5%A1titi-od-po%C5%BEara',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PRAVILNICI — Secondary regulations
// ─────────────────────────────────────────────────────────────────────────────

export const PRAVILNICI = {
  BA: [
    {
      id: 'ozo',
      name: 'Pravilnik o upotrebi sredstava i opreme lične zaštite na radu',
      gazette: 'Sl. novine FBiH br. 42/25',
      year: 2025,
      url: 'https://www.paragraf.ba/propisi/fbih/pravilnik-o-upotrebi-sredstava-i-opreme-licne-zastite-na-radu.html',
      badge: 'NOVO 2025',
    },
    {
      id: 'risk',
      name: 'Pravila o procjeni rizika',
      gazette: 'Sl. novine FBiH br. 23/21',
      year: 2021,
      url: 'https://www.basic.com.ba/asset/pravila_o_procjeni_rizika_sluzbene_novine_fbih_broj_23_21.pdf',
    },
    {
      id: 'znr-specialist',
      name: 'Pravilnik o načinu i uvjetima obavljanja poslova zaštite na radu',
      gazette: 'Sl. novine FBiH br. 34/21',
      year: 2021,
      url: 'https://www.akta.ba/legislativa/134526/pravilnik-o-nacinu-i-uvjetima-obavljanja-poslova-zastite-na-radu-kod-poslodavca',
    },
    {
      id: 'medical',
      name: 'Pravilnik o raspoređivanju radnika na poslove sa povećanim rizikom',
      gazette: 'Sl. novine FBiH br. 9/23',
      gazetteShort: '9/23',
      year: 2023,
      url: '',
    },
    {
      id: 'injury-report',
      name: 'Pravilnik o sadržaju i načinu podnošenja izvještaja',
      gazette: 'Sl. novine FBiH br. 9/23',
      year: 2023,
      url: '',
    },
  ],
  HR: [
    {
      id: 'ozo',
      name: 'Pravilnik o uporabi osobne zaštitne opreme',
      gazette: 'NN 5/21',
      year: 2021,
      url: 'https://www.zakon.hr/z/2795/Pravilnik-o-uporabi-osobnih-za%C5%A1titnih-sredstava',
    },
    {
      id: 'risk',
      name: 'Pravilnik o izradi procjene rizika',
      gazette: 'NN 112/14, 129/19',
      year: 2019,
      url: 'https://www.zakon.hr/z/730/Pravilnik-o-izradi-procjene-rizika',
    },
    {
      id: 'znr-specialist',
      name: 'Pravilnik o ovlaštenjima za poslove zaštite na radu',
      gazette: 'NN 58/22, 9/24',
      year: 2024,
      url: 'https://www.zakon.hr/z/2861/Pravilnik-o-ovla%C5%A1tenjima-za-poslove-za%C5%A1tite-na-radu',
    },
    {
      id: 'training',
      name: 'Pravilnik o osposobljavanju i usavršavanju iz zaštite na radu',
      gazette: 'NN 142/21',
      year: 2021,
      url: 'https://narodne-novine.nn.hr/clanci/sluzbeni/2021_12_142_2422.html',
    },
    {
      id: 'medical',
      name: 'Pravilnik o poslovima s posebnim uvjetima rada',
      gazette: 'NN 5/84',
      gazetteShort: 'NN 5/84',
      year: 1984,
      url: 'https://www.zakon.hr/z/545/Pravilnik-o-poslovima-s-posebnim-uvjetima-rada',
    },
    {
      id: 'medical-periodic',
      name: 'Pravilnik o prethodnom i periodičnom utvrđivanju zdravstvene sposobnosti',
      gazette: 'NN 70/10',
      year: 2010,
      url: '',
    },
    {
      id: 'injury-report',
      name: 'Pravilnik o evidenciji, ispravama, izvještajima i knjizi nadzora iz ZNR',
      gazette: 'NN 52/84',
      year: 1984,
      url: '',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTITUTIONS — Official portals and links
// ─────────────────────────────────────────────────────────────────────────────

export const INSTITUTIONS = {
  BA: [
    { name: 'Federalna inspekcija rada (FUZIP)', url: 'https://fuzip.gov.ba/inspektorati/federalni-inspektorat-rada/' },
    { name: 'Inspektorat RS — inspekcija rada', url: 'https://inspektorat.vladars.rs' },
    { name: 'Ministarstvo rada i socijalne politike FBiH', url: 'https://fmrsp.gov.ba' },
    { name: 'Sl. novine FBiH', url: 'https://www.sllist.ba' },
    { name: 'Sl. glasnik RS', url: 'https://slglasnik.org' },
    { name: 'Paragraf.ba — Pravna baza BiH', url: 'https://www.paragraf.ba' },
    { name: 'ILO — BiH', url: 'https://ilostat.ilo.org/data/country-profiles/bih/' },
  ],
  HR: [
    { name: 'Državni inspektorat RH (DIRH)', url: 'https://dirh.gov.hr' },
    { name: 'Ministarstvo rada i socijalne politike (MROSP)', url: 'https://mrosp.gov.hr' },
    { name: 'Narodne novine', url: 'https://narodne-novine.nn.hr' },
    { name: 'Zakon.hr — Pravna baza HR', url: 'https://www.zakon.hr' },
    { name: 'HZZZSR — Zavod za zaštitu zdravlja i sigurnost na radu', url: 'https://hzzzsr.hr' },
    { name: 'ILO — Hrvatska', url: 'https://www.ilo.org/budapest/countries-covered/croatia/lang--en/' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — Convenience functions used across modules
// ─────────────────────────────────────────────────────────────────────────────

/** Get the article word for a country ("Član" for BA, "Članak" for HR) */
export const getArticleWord = (country = 'BA') =>
  LAWS[country]?.osh?.articleWord || 'Član';

/** Get a formatted citation like "čl. 44. ZNR FBiH (79/20)" or "čl. 36. ZNR (NN 71/14)" */
export function getCitation(country = 'BA', articleKey) {
  const osh = LAWS[country]?.osh;
  if (!osh) return '';
  const art = osh.articles?.[articleKey];
  if (!art) return '';
  return `čl. ${art}. ${osh.shortName} (${osh.gazetteShort})`;
}

/** Get full law name + gazette for display */
export function getFullCitation(country = 'BA') {
  const osh = LAWS[country]?.osh;
  if (!osh) return '';
  return `${osh.name} (${osh.gazette})`;
}

/** Get medical exam pravilnik for the country */
export function getMedicalPravilnik(country = 'BA') {
  return PRAVILNICI[country]?.find(p => p.id === 'medical');
}

/** Get the gazette name (Sl. novine FBiH / Narodne novine) */
export function getGazetteName(country = 'BA') {
  return country === 'HR' ? 'Narodne novine' : 'Službene novine FBiH';
}

/** Get country label for UI */
export function getCountryLabel(country = 'BA') {
  return country === 'HR' ? 'Republika Hrvatska' : 'Bosna i Hercegovina';
}

/** Get country flag emoji */
export function getCountryFlag(country = 'BA') {
  return country === 'HR' ? '🇭🇷' : '🇧🇦';
}

/** Get default legal basis for sistematizacija (job descriptions) */
export function getDefaultPravniOsnov(country = 'BA') {
  if (country === 'HR') return 'Čl. 17. Zakona o radu (NN 93/14)';
  return 'Čl. 118. Zakona o radu FBiH';
}

/** Get risk assessment AI label for the country */
export function getRiskAssessmentLabel(country = 'BA') {
  if (country === 'HR') return 'Procjena rizika (HR ZNR)';
  return 'Procjena rizika (FBiH ZNR)';
}
