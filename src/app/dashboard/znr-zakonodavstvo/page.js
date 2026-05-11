'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCountry } from '@/contexts/CountryContext';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { LAWS, PRAVILNICI, INSTITUTIONS, getCountryLabel, getCountryFlag, getGazetteName } from '@/lib/lawConfig';

// ─────────────────────────────────────────────────────────────────────────────
// The law/pravilnik data is now sourced from @/lib/lawConfig.js.
// Extra display metadata (descriptions, URL labels, badges, search URLs)
// is stored below keyed by `${country}-${lawKey}` or pravilnik `id`.
// EU directives and the footer remain jurisdiction-independent.
// ─────────────────────────────────────────────────────────────────────────────

// ── Rich metadata for laws (extends lawConfig entries) ──────────────────────
const LAW_META = {
    // ── BA ──
    'BA-osh': {
        desc: 'Temeljni zakon koji uređuje prava, obaveze i odgovornosti poslodavaca i radnika u FBiH. Transponira EU Direktivu 89/391/EEZ. Stupio na snagu 7. novembra 2020. (zamjenjuje stari zakon iz 1990.)',
        urlLabel: 'Pročitaj zakon (paragraf.ba)',
        searchUrl: 'https://www.google.com/search?q=Zakon+o+za%C5%A1titi+na+radu+FBiH+79+20+tekst+paragraf.ba',
    },
    'BA-labor': {
        desc: 'Reguliše ugovor o radu, radno vrijeme, plaće, odmor, zaštitu na radu i ostale uvjete rada u Federaciji BiH.',
        urlLabel: 'Pročitaj zakon (paragraf.ba)',
        searchUrl: 'https://www.google.com/search?q=Zakon+o+radu+FBiH+26%2F16+tekst+paragraf.ba',
    },
    'BA-fire': {
        desc: 'Uređuje organizaciju i provedbu mjera zaštite od požara, obveze poslodavaca i inspektorat u FBiH.',
        urlLabel: 'Preuzmi PDF (msb.gov.ba) ✓',
        searchUrl: '',
    },
    // ── HR ──
    'HR-osh': {
        desc: 'Temeljni zakon RH koji utvrđuje sustav zaštite na radu, prava i obveze poslodavaca i radnika. Usklađen s EU Direktivom 89/391/EEZ.',
        urlLabel: 'Pročitaj zakon (zakon.hr)',
    },
    'HR-labor': {
        desc: 'Regulira radne odnose, ugovor o radu, radno vrijeme, plaće i zaštitu prava radnika u Republici Hrvatskoj.',
        urlLabel: 'Pročitaj zakon (zakon.hr)',
    },
    'HR-fire': {
        desc: 'Uređuje sustav zaštite od požara, obveze pravnih i fizičkih osoba te inspektorat u Republici Hrvatskoj.',
        urlLabel: 'Pročitaj zakon (zakon.hr)',
    },
};

// ── Rich metadata for pravilnici (extends lawConfig entries) ────────────────
const PRAVILNIK_META = {
    // ── BA ──
    'BA-ozo': {
        desc: 'Najnoviji pravilnik (jun 2025.) koji detaljno uređuje upotrebu OZO. Djelomično transponira EU Direktivu 89/656/EEZ o minimalnim zahtjevima za OZO.',
    },
    'BA-risk': {
        desc: 'Propisuje metodologiju i sadržaj akta o procjeni rizika za svako radno mjesto u FBiH.',
    },
    'BA-znr-specialist': {
        desc: 'Uređuje uvjete za stručnjake zaštite na radu kod poslodavca (kvalifikacije, ovlaštenja, obaveze).',
    },
    'BA-medical': {
        desc: 'Propisuje uvjete i postupak raspoređivanja radnika na poslove s povećanim rizikom u FBiH.',
    },
    'BA-injury-report': {
        desc: 'Uređuje sadržaj i način podnošenja izvještaja o nesrećama na radu u FBiH.',
    },
    // ── HR ──
    'HR-ozo': {
        desc: 'Pravilnik o uporabi osobnih zaštitnih sredstava na radnom mjestu u RH.',
    },
    'HR-risk': {
        desc: 'Propisuje izradu i sadržaj procjene rizika za poslodavce u Republici Hrvatskoj.',
    },
    'HR-znr-specialist': {
        desc: 'Uređuje uvjete za ovlaštenja za obavljanje poslova zaštite na radu.',
    },
    'HR-training': {
        desc: 'Propisuje osposobljavanje i usavršavanje iz područja zaštite na radu.',
    },
    'HR-medical': {
        desc: 'Propisuje poslove s posebnim uvjetima rada i zdravstvene zahtjeve za radnike.',
    },
    'HR-medical-periodic': {
        desc: 'Uređuje prethodno i periodično utvrđivanje zdravstvene sposobnosti radnika.',
    },
    'HR-injury-report': {
        desc: 'Uređuje evidencije, isprave i izvještaje iz zaštite na radu.',
    },
};

// ── RS laws (BA-only, additional to FBiH) ───────────────────────────────────
const RS_LAWS = [
    {
        name: 'Zakon o zaštiti na radu RS',
        gazette: 'Sl. glasnik RS br. 1/08, 13/10, 37/12, 70/20',
        year: 2020,
        status: 'važeći',
        desc: 'Temeljni zakon RS koji utvrđuje zaštitu na radu kao stvar javnog interesa. Izmjene iz 2020. (br. 70/20) uskladile su ga s EU okvirom.',
        url: 'https://www.paragraf.ba/propisi/republika-srpska/zakon-o-zastiti-na-radu.html',
        urlLabel: 'Pročitaj zakon (paragraf.ba) ✓',
        searchUrl: 'https://slglasnik.org',
    },
    {
        name: 'Zakon o radu RS',
        gazette: 'Sl. glasnik RS br. 1/16, 66/18, 91/21, 119/21, 112/23, 39/24',
        year: 2024,
        status: 'važeći',
        desc: 'Reguliše radno-pravne odnose, zaštitu radnika i sigurnost radnog mjesta u Republici Srpskoj.',
        url: 'https://www.paragraf.ba/propisi/republika-srpska/zakon-o-radu.html',
        urlLabel: 'Pročitaj zakon (paragraf.ba) ✓',
    },
    {
        name: 'Zakon o zaštiti od požara RS',
        gazette: 'Sl. glasnik RS br. 92/20',
        year: 2020,
        status: 'važeći',
        desc: 'Uređuje zaštitu od požara, obaveze pravnih lica, inspektorat i sankcije u Republici Srpskoj.',
        url: 'https://slglasnik.org',
        urlLabel: 'Sl. glasnik RS (slglasnik.org)',
    },
];

// ── EU Directives (jurisdiction-independent) ────────────────────────────────
const EU_DIRECTIVES = [
    {
        name: 'Direktiva 89/391/EEZ — Okvirna direktiva',
        gazette: 'EUR-Lex CELEX 31989L0391',
        year: 1989,
        status: 'na snazi',
        desc: 'Okvirna direktiva o uvođenju mjera za poboljšanje zaštite zdravlja i sigurnosti radnika. Transponirana u nacionalno zakonodavstvo.',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0391',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 89/654/EEZ — Radna mjesta',
        gazette: 'EUR-Lex CELEX 31989L0654',
        year: 1989,
        status: 'na snazi',
        desc: 'Minimalni zahtjevi za sigurnost i zdravlje na radnim mjestima (prostorije, osvijetljenost, ventilacija, izlazi).',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0654',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 2009/104/EZ — Radna oprema',
        gazette: 'EUR-Lex CELEX 32009L0104',
        year: 2009,
        status: 'na snazi',
        desc: 'Minimalni sigurnosni zahtjevi za upotrebu radne opreme (zamjenjuje 89/655/EEZ). Obuhvata preglede i održavanje.',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A32009L0104',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 89/656/EEZ — Osobna zaštitna oprema (OZO)',
        gazette: 'EUR-Lex CELEX 31989L0656',
        year: 1989,
        status: 'na snazi',
        desc: 'Minimalni zahtjevi za korištenje OZO na radnom mjestu.',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0656',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 90/269/EEZ — Ručno rukovanje teretima',
        gazette: 'EUR-Lex CELEX 31990L0269',
        year: 1990,
        status: 'na snazi',
        desc: 'Minimalni zahtjevi za zaštitu zdravlja pri ručnom rukovanju teretima koji mogu uzrokovati povrede leđa.',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31990L0269',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 90/270/EEZ — Rad s ekranima',
        gazette: 'EUR-Lex CELEX 31990L0270',
        year: 1990,
        status: 'na snazi',
        desc: 'Minimalni zahtjevi za zaštitu zdravlja pri radu s kompjuterskim ekranima (pauze, ergonomija, vid).',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31990L0270',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 92/85/EEZ — Zaštita trudnica',
        gazette: 'EUR-Lex CELEX 31992L0085',
        year: 1992,
        status: 'na snazi',
        desc: 'Posebne mjere za zaštitu zdravlja trudnica, porodilja i dojilja na radnom mjestu.',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31992L0085',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 2003/10/EZ — Buka na radu',
        gazette: 'EUR-Lex CELEX 32003L0010',
        year: 2003,
        status: 'na snazi',
        desc: 'Minimalni zahtjevi za zaštitu zdravlja i sigurnosti radnika izloženih rizicima od buke.',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A32003L0010',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 2002/44/EZ — Vibracije',
        gazette: 'EUR-Lex CELEX 32002L0044',
        year: 2002,
        status: 'na snazi',
        desc: 'Minimalni zahtjevi za zaštitu od mehaničkih vibracija (ruka-šaka i cijelo tijelo).',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A32002L0044',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
    {
        name: 'Direktiva 98/24/EZ — Kemijski agensi',
        gazette: 'EUR-Lex CELEX 31998L0024',
        year: 1998,
        status: 'na snazi',
        desc: 'Minimalni zahtjevi za zaštitu zdravlja radnika od rizika koji su u vezi s kemijskim agensima na radu.',
        url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31998L0024',
        urlLabel: 'Otvori na EUR-Lex ✓',
    },
];

const STATUS_COLOR = { 'važeći': '#22c55e', 'na snazi': '#5b9cf8', 'stavljen van snage': '#f87171' };

// ── Build CATEGORIES dynamically from lawConfig ─────────────────────────────
function buildCategories(country) {
    const laws = LAWS[country];
    const pravilnici = PRAVILNICI[country] || [];
    const institutions = INSTITUTIONS[country] || [];
    const flag = getCountryFlag(country);
    const label = getCountryLabel(country);
    const gazette = getGazetteName(country);

    const categories = [];

    // 1. Primary laws
    if (laws) {
        const lawItems = Object.entries(laws).map(([key, law]) => {
            const meta = LAW_META[`${country}-${key}`] || {};
            return {
                name: law.name,
                gazette: law.gazette,
                year: law.year,
                status: 'važeći',
                desc: meta.desc || '',
                url: law.url,
                urlLabel: meta.urlLabel || `Otvori (${law.url?.split('/')[2] || 'link'})`,
                searchUrl: meta.searchUrl || '',
            };
        });

        categories.push({
            id: `${country.toLowerCase()}-zakoni`,
            icon: '🛡️',
            title: country === 'BA' ? 'Zakoni — Federacija BiH' : 'Zakoni — Republika Hrvatska',
            subtitle: country === 'BA' ? 'Federacija Bosne i Hercegovine' : 'Republika Hrvatska',
            color: country === 'BA' ? '#3b82f6' : '#2563eb',
            items: lawItems,
        });
    }

    // 2. Pravilnici / Regulations
    if (pravilnici.length> 0) {
        const pravilnikItems = pravilnici.map(p => {
            const meta = PRAVILNIK_META[`${country}-${p.id}`] || {};
            return {
                name: p.name,
                gazette: p.gazette,
                year: p.year,
                status: 'važeći',
                desc: meta.desc || '',
                url: p.url || '',
                urlLabel: p.url ? `Pročitaj pravilnik ✓` : '',
                badge: p.badge || '',
            };
        });

        categories.push({
            id: `${country.toLowerCase()}-pravilnici`,
            icon: '📜',
            title: country === 'BA' ? 'Pravilnici — Federacija BiH' : 'Pravilnici — Republika Hrvatska',
            subtitle: country === 'BA' ? 'Podzakonski akti Federacije BiH' : 'Podzakonski akti Republike Hrvatske',
            color: '#a855f7',
            items: pravilnikItems,
        });
    }

    // 3. RS laws (BA-only)
    if (country === 'BA') {
        categories.push({
            id: 'rs-zakoni',
            icon: '🛡️',
            title: 'Zakoni — Republika Srpska',
            subtitle: 'Republika Srpska',
            color: '#f05252',
            items: RS_LAWS,
        });
    }

    // 4. EU Directives
    categories.push({
        id: 'eu',
        icon: '🇪🇺',
        title: country === 'BA' ? 'EU Direktive (relevantne za BiH)' : 'EU Direktive (transponirane u HR)',
        subtitle: country === 'BA'
            ? 'Harmonizacija s pravom EU — poglavlje 19 · Linkovi potvrđeno rade ✓'
            : 'EU acquis — poglavlje 19 · Linkovi potvrđeno rade ✓',
        color: '#5b9cf8',
        items: EU_DIRECTIVES,
    });

    // 5. Institutional links
    if (institutions.length> 0) {
        categories.push({
            id: 'links',
            icon: '🔗',
            title: 'Korisni linkovi i institucije',
            subtitle: 'Zvanični portali · svi provjereni i aktivni ✓',
            color: '#2dd4bf',
            items: institutions.map(inst => ({
                name: inst.name,
                desc: '',
                url: inst.url,
                urlLabel: `Otvori ${inst.url?.split('/')[2] || 'link'} ✓`,
            })),
        });
    }

    // 6. EUR-Lex search
    categories[categories.length - 1].items.push({
        name: 'EUR-Lex — Pretraživač EU direktiva o ZNR',
        desc: 'Kompletan pretraživač EU direktiva u oblasti zaštite na radu.',
        url: 'https://eur-lex.europa.eu/search.html?text=safety+health+workers&scope=EURLEX&type=quick&lang=hr',
        urlLabel: 'Pretraži EUR-Lex ✓',
    });

    return categories;
}

export default function ZNRZakonodavstvoPage() {
    const { lang } = useLanguage();
    const country = useCountry();
    const router = useRouter();

    const CATEGORIES = useMemo(() => buildCategories(country), [country]);
    const countryLabel = getCountryLabel(country);
    const gazetteName = getGazetteName(country);

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <PageHeader icon="" title={`⚖️ Zakonodavstvo zaštite na radu — ${countryLabel}`} subtitle={`Prečišćeni pregled svih važećih zakona, pravilnika i EU direktiva · ${country === 'BA' ? 'FBiH, RS i EU' : 'RH i EU'} · Ažurirano 2025.`} />

            {/* Notice */}
            <div style={{ marginBottom: 24, padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(21,101,192,0.08)', border: '1px solid rgba(21,101,192,0.2)', fontSize: '0.82rem', color: 'var(--text)' }}>
                📌 <strong>Napomena:</strong> Linkovi vode na zvanične tekstove zakona i pravne baze.
                Uvijek provjerite {gazetteName} za eventualne izmjene i dopune.
            </div>

            {/* Categories */}
            {CATEGORIES.map(cat => (
                <div key={cat.id} className="card" style={{ marginBottom: 20, borderTop: `3px solid ${cat.color}` }}>
                    <div className="card-body">
                        {/* Category header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
                            <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: cat.color }}>{cat.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat.subtitle}</div>
                            </div>
                            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cat.items.length} {cat.items.length === 1 ? 'dokument' : cat.items.length <= 4 ? 'dokumenta' : 'dokumenata'}</span>
                        </div>

                        {/* Items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {cat.items.map((item, i) => (
                                <div key={i} style={{
                                    padding: '12px 14px',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border-light)',
                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</span>
                                            {item.badge && (
                                                <span style={{ fontSize: '0.6rem', padding: '1px 7px', borderRadius: 'var(--radius-full)', background: '#16a34a', color: 'white', fontWeight: 800, letterSpacing: '0.04em' }}>{item.badge}</span>
                                            )}
                                            {item.status && (
                                                <span style={{ fontSize: '0.62rem', padding: '1px 7px', borderRadius: 'var(--radius-full)', background: `${STATUS_COLOR[item.status] || '#374151'}20`, color: STATUS_COLOR[item.status] || '#374151', fontWeight: 700 }}>
                                                    ✓ {item.status.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        {item.gazette && (
                                            <div style={{ fontSize: '0.73rem', color: cat.color, fontWeight: 600, marginBottom: 5, fontStyle: 'italic' }}>📄 {item.gazette}</div>
                                        )}
                                        {item.desc && (
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 8 }}>{item.desc}</div>
                                        )}
                                        {item.url && item.urlLabel && (
                                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 700, color: cat.color, textDecoration: 'none', padding: '4px 12px', border: `1px solid ${cat.color}40`, borderRadius: 'var(--radius-full)', transition: 'all 0.15s' }}
>
                                                {item.urlLabel} ↗
                                            </a>
                                        )}
                                    </div>
                                    {item.year && (
                                        <div style={{ flexShrink: 0, textAlign: 'center', minWidth: 48 }}>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: cat.color }}>{item.year}</div>
                                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>GOD.</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}

            {/* Footer */}
            <div style={{ marginTop: 8, padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Pregled zakona i pravilnika o zaštiti na radu — {countryLabel} · eZNR · Devizija: 08.03.2025. ·
                Za zvanični tekst uvijek koristite {gazetteName}
            </div>
        </div>
    );
}
