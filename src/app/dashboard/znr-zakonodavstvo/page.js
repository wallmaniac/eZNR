'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────────────────────────────────────
// ALL URLs below are manually verified working (March 2026).
// For BiH law texts: paragraf.ba blocks bots (403) but works in browser.
// Google search links act as reliable deep-links to the specific law text.
// slglasnik.org = correct RS gazette (slglasnikrs.ba domain doesn't exist).
// inspektorat.vladars.rs = correct (not .net).
// fmrsp.gov.ba = correct (not www.fmrsp.gov.ba — SSL mismatch).
// EUR-Lex links confirmed 200 OK.
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
    {
        id: 'fbih-zakoni',
        icon: '🛡️',
        title: 'Zakoni — Federacija BiH',
        subtitle: 'Federacija Bosne i Hercegovine',
        color: '#3b82f6',
        items: [
            {
                name: 'Zakon o zaštiti na radu FBiH',
                gazette: 'Sl. novine FBiH br. 79/20',
                year: 2020,
                status: 'važeći',
                desc: 'Temeljni zakon koji uređuje prava, obaveze i odgovornosti poslodavaca i radnika u FBiH. Transponira EU Direktivu 89/391/EEZ. Stupio na snagu 7. novembra 2020. (zamjenjuje stari zakon iz 1990.)',
                url: 'https://www.paragraf.ba/propisi/fbih/zakon-o-zastiti-na-radu.html',
                urlLabel: 'Pročitaj zakon (paragraf.ba)',
                searchUrl: 'https://www.google.com/search?q=Zakon+o+za%C5%A1titi+na+radu+FBiH+79+20+tekst+paragraf.ba',
            },
            {
                name: 'Zakon o radu FBiH',
                gazette: 'Sl. novine FBiH br. 26/16, 89/18, 44/22',
                year: 2022,
                status: 'važeći',
                desc: 'Reguliše ugovor o radu, radno vrijeme, plaće, odmor, zaštitu na radu i ostale uvjete rada u Federaciji BiH.',
                url: 'https://www.paragraf.ba/propisi/fbih/zakon-o-radu.html',
                urlLabel: 'Pročitaj zakon (paragraf.ba)',
                searchUrl: 'https://www.google.com/search?q=Zakon+o+radu+FBiH+26%2F16+tekst+paragraf.ba',
            },
            {
                name: 'Zakon o zaštiti od požara i vatrogastvu FBiH',
                gazette: 'Sl. novine FBiH br. 64/09, 45/22',
                year: 2022,
                status: 'važeći',
                desc: 'Uređuje organizaciju i provedbu mjera zaštite od požara, obveze poslodavaca i inspektorat u FBiH.',
                url: 'https://www.msb.gov.ba/dokumenti/10ZAKON_O_VATROGASTVU_FBIH.pdf',
                urlLabel: 'Preuzmi PDF (msb.gov.ba) ✓',
                searchUrl: '',
            },
        ],
    },
    {
        id: 'fbih-pravilnici',
        icon: '📜',
        title: 'Pravilnici — Federacija BiH',
        subtitle: 'Podzakonski akti Federacije BiH',
        color: '#a855f7',
        items: [
            {
                name: 'Pravilnik o upotrebi sredstava i opreme lične zaštite na radu',
                gazette: 'Sl. novine FBiH br. 42/25',
                year: 2025,
                status: 'važeći',
                desc: 'Najnoviji pravilnik (jun 2025.) koji detaljno uređuje upotrebu OZO. Djelomično transponira EU Direktivu 89/656/EEZ o minimalnim zahtjevima za OZO.',
                url: 'https://www.paragraf.ba/propisi/fbih/pravilnik-o-upotrebi-sredstava-i-opreme-licne-zastite-na-radu.html',
                urlLabel: 'Pročitaj pravilnik (paragraf.ba) ✓',
                badge: 'NOVO 2025',
            },
            {
                name: 'Pravila o procjeni rizika',
                gazette: 'Sl. novine FBiH br. 23/21',
                year: 2021,
                status: 'važeći',
                desc: 'Propisuje metodologiju i sadržaj akta o procjeni rizika za svako radno mjesto u FBiH.',
                url: 'https://www.basic.com.ba/asset/pravila_o_procjeni_rizika_sluzbene_novine_fbih_broj_23_21.pdf',
                urlLabel: 'Preuzmi PDF (basic.com.ba)',
            },
            {
                name: 'Pravilnik o načinu i uvjetima obavljanja poslova zaštite na radu',
                gazette: 'Sl. novine FBiH br. 34/21',
                year: 2021,
                status: 'važeći',
                desc: 'Uređuje uvjete za stručnjake zaštite na radu kod poslodavca (kvalifikacije, ovlaštenja, obaveze).',
                url: 'https://www.akta.ba/legislativa/134526/pravilnik-o-nacinu-i-uvjetima-obavljanja-poslova-zastite-na-radu-kod-poslodavca',
                urlLabel: 'Pročitaj pravilnik (akta.ba) ✓',
            },
        ],
    },
    {
        id: 'rs-zakoni',
        icon: '🛡️',
        title: 'Zakoni — Republika Srpska',
        subtitle: 'Republika Srpska',
        color: '#f05252',
        items: [
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
        ],
    },
    {
        id: 'eu',
        icon: '🇪🇺',
        title: 'EU Direktive (relevantne za BiH)',
        subtitle: 'Harmonizacija s pravom EU — poglavlje 19 · Linkovi potvrđeno rade ✓',
        color: '#5b9cf8',
        items: [
            {
                name: 'Direktiva 89/391/EEZ — Okvirna direktiva',
                gazette: 'EUR-Lex CELEX 31989L0391',
                year: 1989,
                status: 'na snazi',
                desc: 'Okvirna direktiva o uvođenju mjera za poboljšanje zaštite zdravlja i sigurnosti radnika. Transponirana u Zakon o ZNR FBiH br. 79/20.',
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
                desc: 'Minimalni zahtjevi za korištenje OZO na radnom mjestu. Transponirana u Pravilnik FBiH br. 42/25.',
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
        ],
    },
    {
        id: 'links',
        icon: '🔗',
        title: 'Korisni linkovi i institucije',
        subtitle: 'Zvanični portali · svi provjereni i aktivni ✓',
        color: '#2dd4bf',
        items: [
            {
                name: 'Sl. glasnik Republike Srpske — slglasnik.org',
                desc: 'Zvanični portal Službenog glasnika RS. Sadrži elektronski registar propisa RS (e-RP) i arhivu svih glasnika.',
                url: 'https://slglasnik.org',
                urlLabel: 'Otvori slglasnik.org ✓',
            },
            {
                name: 'Federalna uprava za inspekcijske poslove (FUZIP)',
                desc: 'Federalni inspektorat rada FBiH — nadzor nad primjenom zakona o zaštiti na radu. Sadrži kontrolne liste i izvještaje.',
                url: 'https://fuzip.gov.ba',
                urlLabel: 'Otvori fuzip.gov.ba ✓',
            },
            {
                name: 'Federalni inspektorat rada — FUZIP',
                desc: 'Direktna stranica Federalnog inspektorata rada unutar FUZIP-a.',
                url: 'https://fuzip.gov.ba/inspektorati/federalni-inspektorat-rada/',
                urlLabel: 'Inspektorat rada ✓',
            },
            {
                name: 'Inspektorat Republike Srpske — inspekcija rada',
                desc: 'Republički inspektorat RS koji obuhvata inspekciju rada, bezbjednost i zdravlje na radu u RS.',
                url: 'https://inspektorat.vladars.rs',
                urlLabel: 'Otvori inspektorat.vladars.rs ✓',
            },
            {
                name: 'Federalno ministarstvo rada i socijalne politike (FBiH)',
                desc: 'Nadležno ministarstvo za donošenje pravilnika i propisa o zaštiti na radu u FBiH. Objavljuje nacrte zakona i pravilnike.',
                url: 'https://fmrsp.gov.ba',
                urlLabel: 'Otvori fmrsp.gov.ba ✓',
            },
            {
                name: 'Narodna skupština Republike Srpske',
                desc: 'Zvanična stranica Narodne skupštine RS — pretraživač usvojenih zakona i skupštinskih akata.',
                url: 'https://www.narodnaskupstinars.net',
                urlLabel: 'Otvori narodnaskupstinars.net ✓',
            },
            {
                name: 'ILO — Međunarodna organizacija rada (BiH stranica)',
                desc: 'Aktivnosti i dokumenti ILO za Bosnu i Hercegovinu, uključujući standarde zaštite na radu i ratificirane konvencije.',
                url: 'https://ilostat.ilo.org/data/country-profiles/bih/',
                urlLabel: 'Otvori ILOSTAT—BiH ✓',
            },
            {
                name: 'EUR-Lex — Pretraživač EU direktiva o ZNR',
                desc: 'Kompletan pretraživač EU direktiva u oblasti zaštite na radu relevantnih za poglavlje 19 pristupnog procesa BiH-EU.',
                url: 'https://eur-lex.europa.eu/search.html?text=safety+health+workers&scope=EURLEX&type=quick&lang=hr',
                urlLabel: 'Pretraži EUR-Lex ✓',
            },
            {
                name: 'Paragraf.ba — Pravna baza BiH',
                desc: 'Pravni portal s tekstovima zakona FBiH i RS. Napomena: određene stranice mogu zahtijevati direktan pristup iz BiH.',
                url: 'https://www.paragraf.ba',
                urlLabel: 'Otvori paragraf.ba',
            },
        ],
    },
];

const STATUS_COLOR = { 'važeći': '#22c55e', 'na snazi': '#5b9cf8', 'stavljen van snage': '#f87171' };

export default function ZNRZakonodavstvoPage() {
    const { lang } = useLanguage();
    const router = useRouter();

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <button onClick={() => router.back()} className="btn btn-ghost btn-sm" style={{ marginRight: 4, fontSize: '1rem' }}>←</button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem' }}>⚖️ Zakonodavstvo zaštite na radu u BiH</h1>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Prečišćeni pregled svih važećih zakona, pravilnika i EU direktiva — FBiH, RS i EU · Ažurirano 2025.
                    </p>
                </div>
            </div>

            {/* Notice */}
            <div style={{ marginBottom: 24, padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(21,101,192,0.08)', border: '1px solid rgba(21,101,192,0.2)', fontSize: '0.82rem', color: 'var(--text)' }}>
                📌 <strong>Napomena:</strong> Linkovi vode na zvanične tekstove zakona i pravne baze (paragraf.ba, EUR-Lex).
                Uvijek provjerite Sl. novine FBiH ili Sl. glasnik RS za eventualne izmjene i dopune.
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
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 8 }}>{item.desc}</div>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 700, color: cat.color, textDecoration: 'none', padding: '4px 12px', border: `1px solid ${cat.color}40`, borderRadius: 'var(--radius-full)', transition: 'all 0.15s' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = cat.color; e.currentTarget.style.color = 'white'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = cat.color; }}>
                                            {item.urlLabel} ↗
                                        </a>
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
                Pregled zakona i pravilnika o zaštiti na radu u Bosni i Hercegovini · eZNR · Devizija: 08.03.2025. ·
                Za zvanični tekst uvijek koristite Sl. novine FBiH ili Sl. glasnik RS
            </div>
        </div>
    );
}
