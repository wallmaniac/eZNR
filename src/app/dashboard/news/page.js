'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

// No localStorage cache — server caches for 2h, so every page load is fresh within 2h

const TIP_CONFIG = {
    zakon: { color: '#1565C0', bg: '#1565C015', label: 'ZAKON', icon: '⚖️' },
    pravilnik: { color: '#6A1B9A', bg: '#6A1B9A15', label: 'PRAVILNIK', icon: '📜' },
    edukacija: { color: '#00897B', bg: '#00897B15', label: 'EDUKACIJA', icon: '🎓' },
    rok: { color: '#C62828', bg: '#C6282815', label: 'ROK', icon: '⏰' },
    obavijest: { color: '#E65100', bg: '#E6510015', label: 'OBAVIJEST', icon: '📢' },
    inspekcija: { color: '#37474F', bg: '#37474F15', label: 'INSPEKCIJA', icon: '🔍' },
    smjernice: { color: '#558B2F', bg: '#558B2F15', label: 'SMJERNICE', icon: '📋' },
};

const LAW_LINKS = [
    {
        category: 'Zakon o zaštiti na radu', icon: '🛡️',
        items: [
            { name: 'Zakon o zaštiti na radu FBiH (Sl. novine FBiH br. 22/02)', url: 'https://www.sllist.ba' },
            { name: 'Zakon o zaštiti na radu RS (Sl. glasnik RS br. 1/08)', url: 'https://www.slglasnikrs.ba' },
            { name: 'Zakon o radu FBiH (Sl. novine FBiH br. 26/16)', url: 'https://www.sllist.ba' },
        ]
    },
    {
        category: 'Pravilnici o zaštiti na radu', icon: '📜',
        items: [
            { name: 'Pravilnik o sadržaju i načinu vođenja evidencija o zaštiti na radu', url: 'https://www.sllist.ba' },
            { name: 'Pravilnik o procjeni rizika / Opšta načela prevencije', url: 'https://www.slglasnikrs.ba' },
            { name: 'Pravilnik o osobnoj zaštitnoj opremi', url: 'https://www.sllist.ba' },
            { name: 'Pravilnik o načinu i rokovima vršenja periodičnih pregleda', url: 'https://www.sllist.ba' },
        ]
    },
    {
        category: 'Zaštita od požara', icon: '🔥',
        items: [
            { name: 'Zakon o zaštiti od požara i vatrogastvu FBiH (Sl. novine FBiH br. 64/09)', url: 'https://www.sllist.ba' },
            { name: 'Pravilnik o tehničkim normativima za zaštitu od požara', url: 'https://www.sllist.ba' },
        ]
    },
    {
        category: 'EU Direktive (harmonizacija)', icon: '🇪🇺',
        items: [
            { name: 'Direktiva 89/391/EEZ — Okvirna direktiva o bezbjednosti i zdravlju', url: 'https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX%3A31989L0391' },
            { name: 'Direktiva 89/656/EEZ — Upotreba osobne zaštitne opreme', url: 'https://eur-lex.europa.eu' },
            { name: 'Direktiva 92/85/EEZ — Zaštita trudnica na radu', url: 'https://eur-lex.europa.eu' },
        ]
    },
    {
        category: 'Korisni linkovi', icon: '🔗',
        items: [
            { name: 'Federalna inspekcija rada — fbihvlada.gov.ba', url: 'https://www.fbihvlada.gov.ba' },
            { name: 'Inspektorat RS — inspektorat.vladars.net', url: 'https://inspektorat.vladars.net' },
            { name: 'Sl. novine FBiH — pretraživač zakona', url: 'https://www.sllist.ba' },
            { name: 'Sl. glasnik RS — pretraživač zakona', url: 'https://www.slglasnikrs.ba' },
            { name: 'ILO — Međunarodna organizacija rada (BiH)', url: 'https://www.ilo.org/budapest' },
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

function NewsCard({ item }) {
    const cfg = TIP_CONFIG[item.tip] || TIP_CONFIG.obavijest;
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
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    📌 {item.izvor}
                                </span>
                            )}
                        </div>
                        <h3 style={{ marginBottom: 8, fontSize: '1rem', lineHeight: 1.4 }}>{item.naslov}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.65, margin: 0 }}>{item.opis}</p>
                        {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: '0.8rem', color: cfg.color, textDecoration: 'none', fontWeight: 600 }}>
                                Više informacija →
                            </a>
                        )}
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
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [fromCache, setFromCache] = useState(false);
    const [grounded, setGrounded] = useState(null); // true=Google Search, false=AI only, null=unknown
    const [nextRefresh, setNextRefresh] = useState(null); // minutes until server cache expires

    const fetchNews = useCallback(async (force = false) => {
        setLoading(true);
        setError(null);
        try {
            const url = `/api/news${force ? '?force=1' : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const items = data.news || [];
            setNews(items);
            setLastUpdated(new Date());
            setFromCache(data.cached || false);
            setGrounded(data.grounded ?? null);
            setNextRefresh(data.nextRefresh ?? null);
        } catch (err) {
            setError(err.message || 'Greška pri dohvatu vijesti');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchNews(false); }, [fetchNews]);

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
                            {grounded === true ? (
                                <span style={{ fontSize: '0.8rem', padding: '3px 12px', borderRadius: 'var(--radius-full)', background: 'linear-gradient(135deg,#1565C0,#1976D2)', color: 'white', fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    🌐 Vijesti uživo
                                </span>
                            ) : grounded === false ? (
                                <span style={{ fontSize: '0.8rem', padding: '3px 12px', borderRadius: 'var(--radius-full)', background: 'linear-gradient(135deg,#00897B,#00695C)', color: 'white', fontWeight: 700, letterSpacing: '0.04em' }}>
                                    🤖 AI Pregled
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
                                    {fromCache ? '📦 Server cache' : '🔄 Osvježeno'}: {formatTime(lastUpdated)}
                                    {nextRefresh != null && ` · sljedeće za ${nextRefresh}min`}
                                </span>
                            )}
                            <button
                                className="btn btn-outline btn-sm"
                                onClick={() => fetchNews(true)}
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                                {loading
                                    ? <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Učitavam...</>
                                    : <>🔄 Osvježi vijesti</>
                                }
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="card" style={{ borderLeft: '4px solid var(--danger)', marginBottom: 16 }}>
                            <div className="card-body" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                ⚠️ Greška pri dohvatu vijesti: {error}
                                <button className="btn btn-ghost btn-sm" onClick={() => fetchNews(true)} style={{ marginLeft: 8 }}>Pokušaj ponovo</button>
                            </div>
                        </div>
                    )}

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

                    {/* News cards */}
                    {!loading && news.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {news.map((item, i) => <NewsCard key={i} item={item} />)}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loading && news.length === 0 && !error && (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>📰</div>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Nema dostupnih vijesti</div>
                                <button className="btn btn-primary btn-sm" onClick={() => fetchNews(true)}>🔄 Učitaj vijesti</button>
                            </div>
                        </div>
                    )}

                    {/* AI disclaimer */}
                    <div style={{ marginTop: 20, padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {grounded === true
                            ? '🌐 Vijesti su dohvaćene pretraživanjem Google-a u realnom vremenu putem Gemini AI modela. Uvijek provjerite originalne izvore za zvanične informacije.'
                            : '🤖 Vijesti generira Google Gemini AI na osnovu javno dostupnih zakona i propisa BiH. Uvijek provjerite originalne izvore (Sl. novine FBiH, Sl. glasnik RS) za zvanične informacije.'}
                    </div>
                </div>
            )}

            {/* ── LAWS TAB ── */}
            {activeTab === 'laws' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
