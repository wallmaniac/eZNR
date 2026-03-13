'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

// No localStorage cache — server caches for 2h, so every page load is fresh within 2h

const TIP_CONFIG = {
    zakon: { color: 'var(--info)', bg: '#1565C015', label: 'ZAKON', icon: '⚖️' },
    pravilnik: { color: '#6A1B9A', bg: '#6A1B9A15', label: 'PRAVILNIK', icon: '📜' },
    edukacija: { color: '#00897B', bg: '#00897B15', label: 'EDUKACIJA', icon: '🎓' },
    rok: { color: 'var(--danger)', bg: '#C6282815', label: 'ROK', icon: '⏰' },
    obavijest: { color: 'var(--warning)', bg: '#E6510015', label: 'OBAVIJEST', icon: '📢' },
    inspekcija: { color: '#37474F', bg: '#37474F15', label: 'INSPEKCIJA', icon: '🔍' },
    smjernice: { color: '#558B2F', bg: '#558B2F15', label: 'SMJERNICE', icon: '📋' },
};

const LAW_LINKS = [
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
];

const FORMS_LIST = [
    { name: 'Obrazac OR — Prijava povrede na radu', route: '/dashboard/injuries' },
    { name: 'Obrazac PB — Prijava profesionalne bolesti', route: '/dashboard/diseases' },
    { name: 'Obrazac OIR-1 — Obavijest o prijavi povrede', route: '/dashboard/form-oir1' },
    { name: 'Obrazac RA1 — Ljekarska uputnica za pregled', route: '/dashboard/referral-ra1' },
    { name: 'Obrazac RO1 — Liječnički nalaz (ocjena radne sposobnosti)', route: '/dashboard/form-ro1' },
    { name: 'Obrazac RO2 — Potvrda o privremenoj nesposobnosti', route: '/dashboard/form-ro2' },
    { name: 'Obrazac NR1 — Evidencija noćnog rada', route: '/dashboard/night-work' },
];

// Parse "DD.MM.YYYY." → Date for sorting
function parseBSDate(str) {
    const m = (str || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return new Date(0);
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

// Guess a useful URL from izvor text when Gemini doesn't provide one
function guessSourceUrl(izvor, naslov) {
    const src = (izvor || '').toLowerCase();
    if (src.includes('sl. novine fbih') || src.includes('sllist') || src.includes('federaln')) return 'https://www.sllist.ba';
    if (src.includes('sl. glasnik rs') || src.includes('slglasnik') || src.includes('republicka') || src.includes('republika srpska')) return 'https://www.slglasnikrs.ba';
    if (src.includes('ilo')) return 'https://www.ilo.org/budapest';
    if (src.includes('eu') || src.includes('direktiv') || src.includes('eur-lex')) return 'https://eur-lex.europa.eu';
    if (src.includes('inspektorat') || src.includes('vladars')) return 'https://inspektorat.vladars.net';
    if (src.includes('ministarstvo') || src.includes('fbihvlada') || src.includes('fbih')) return 'https://www.fbihvlada.gov.ba';
    // Fallback: Google search for the headline
    return `https://www.google.com/search?q=${encodeURIComponent((naslov || '') + ' Bosna Hercegovina')}`;
}

function NewsCard({ item }) {
    const cfg = TIP_CONFIG[item.tip] || TIP_CONFIG.obavijest;
    const titleUrl = item.url || guessSourceUrl(item.izvor, item.naslov);
    const sourceUrl = guessSourceUrl(item.izvor, item.naslov);

    return (
        <div className="card" style={{ borderLeft: `4px solid ${cfg.color}`, transition: 'transform 0.15s, box-shadow 0.15s' }}
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
                            <a href={`https://www.google.com/search?q=${encodeURIComponent((item.naslov || '') + ' site:sllist.ba OR site:slglasnikrs.ba OR site:fbihvlada.gov.ba')}`}
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
    const [activeTab, setActiveTab] = useState('news');
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [fromCache, setFromCache] = useState(false);
    const [source, setSource] = useState(null); // 'gemini' | 'static' | null
    const [nextRefresh, setNextRefresh] = useState(null);

    // On mount: load from localStorage ONLY — never auto-call the API
    useEffect(() => {
        try {
            const raw = localStorage.getItem('eznr_news_cache');
            if (raw) {
                const cached = JSON.parse(raw);
                setNews(cached.news || []);
                setLastUpdated(cached.ts ? new Date(cached.ts) : null);
                setFromCache(true);
                setSource(cached.source || 'cache');
            }
            // If no cache exists at all, show empty state — user must click Osvježi
        } catch { /* ignore */ }
    }, []);

    // Override fetchNews to also persist to localStorage
    const fetchAndCache = useCallback(async (force = false) => {
        setLoading(true);
        try {
            const url = `/api/news${force ? '?force=1' : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            const freshNews = data.news || [];
            setNews(freshNews);
            setLastUpdated(new Date());
            setFromCache(false);
            setSource(data.source || null);
            setNextRefresh(data.nextRefresh ?? null);
            // Persist to localStorage so next visit shows cached news immediately
            localStorage.setItem('eznr_news_cache', JSON.stringify({
                news: freshNews,
                ts: new Date().toISOString(),
                source: data.source || null,
            }));
        } catch (err) {
            console.error('News fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);


    const tabs = [
        { key: 'news', label: 'Vijesti', icon: '📰' },
        { key: 'laws', label: 'Zakoni & propisi', icon: '⚖️' },
        { key: 'forms', label: 'Obrasci', icon: '📄' },
    ];

    const formatTime = (d) => d ? d.toLocaleString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>🏠 Početna</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {tabs.map(tb => (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)} style={{
                        padding: '10px 22px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.88rem',
                        background: activeTab === tb.key ? 'var(--dark)' : 'var(--bg-input)',
                        color: activeTab === tb.key ? 'white' : 'var(--text)',
                        boxShadow: activeTab === tb.key ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                        transition: 'all 0.2s',
                    }}>
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
                                Zaštita na radu · Bosna i Hercegovina
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
                    {!loading && news.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[...news].sort((a, b) => parseBSDate(b.datum) - parseBSDate(a.datum)).map((item, i) => <NewsCard key={i} item={item} />)}
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
                            ? '🤖 Vijesti generira Google Gemini AI na osnovu javno dostupnih zakona BiH. Uvijek provjerite Sl. novine FBiH i Sl. glasnik RS za zvanične informacije.'
                            : '📚 Prikazane informacije temelje se na važećim propisima ZNR u BiH. Uvijek provjerite originalne izvore za aktualne izmjene.'}
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
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'white', marginBottom: 4 }}>⚖️ Zakonodavstvo ZNR u BiH — kompletan pregled</div>
                                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.82)' }}>
                                    Svi zakoni, pravilnici (uključujući novi OZO pravilnik 42/25), EU direktive i institucioni linkovi — na jednom mjestu.
                                </div>
                            </div>
                            <a href="/dashboard/znr-zakonodavstvo"
                                style={{ flexShrink: 0, padding: '8px 20px', borderRadius: 'var(--radius-full)', background: 'var(--bg-card)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                                Otvori dokument →
                            </a>
                        </div>
                    </div>

                    {LAW_LINKS.map((cat, idx) => (
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
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
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
                <div className="card">
                    <div className="card-body">
                        <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                            📄 Službeni obrasci ZNR — Bosna i Hercegovina
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                            {FORMS_LIST.map((form, idx) => (
                                <a key={idx} href={form.route}
                                    style={{
                                        padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                                        display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textDecoration: 'none',
                                        color: 'var(--text)', transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; }}>
                                    <span style={{ fontSize: '1.6rem' }}>📋</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 3 }}>{form.name}</div>
                                        <div style={{ fontSize: '0.73rem', color: 'var(--primary)', fontWeight: 600 }}>Otvori obrazac →</div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
            `}</style>
        </div>
    );
}
