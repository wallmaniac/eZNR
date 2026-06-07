'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const bannerTranslations = {
    bs: {
        title: 'Kolačići & Privatnost',
        desc: 'Kako bismo vam pružili najbolje korisničko iskustvo i osigurali stabilnost platforme, koristimo kolačiće i lokalnu pohranu.',
        customize: 'Prilagodi',
        acceptAll: 'Prihvati sve',
        declineAll: 'Odbij neobavezne',
        saveChoices: 'Sačuvaj izbor',
        essential: 'Neophodni',
        essentialDesc: 'Potrebni za rad aplikacije (sesije, jezik, postavke).',
        analytical: 'Analitički',
        analyticalDesc: 'Praćenje stabilnosti rada aplikacije i performansi.',
        marketing: 'Marketinški',
        marketingDesc: 'Za obavještenja o ažuriranjima i interaktivne alate.'
    },
    hr: {
        title: 'Kolačići & Privatnost',
        desc: 'Kako bismo vam pružili najbolje korisničko iskustvo i osigurali stabilnost platforme, koristimo kolačiće i lokalno spremište.',
        customize: 'Prilagodi',
        acceptAll: 'Prihvati sve',
        declineAll: 'Odbij neobavezne',
        saveChoices: 'Spremi izbor',
        essential: 'Neophodni',
        essentialDesc: 'Potrebni za rad aplikacije (sesije, jezik, postavke).',
        analytical: 'Analitički',
        analyticalDesc: 'Praćenje stabilnosti rada aplikacije i performansi.',
        marketing: 'Marketinški',
        marketingDesc: 'Za obavijesti o ažuriranjima i interaktivne alate.'
    },
    en: {
        title: 'Cookies & Privacy',
        desc: 'To provide the best user experience and ensure platform stability, we use cookies and local storage.',
        customize: 'Customize',
        acceptAll: 'Accept All',
        declineAll: 'Decline Optional',
        saveChoices: 'Save Choices',
        essential: 'Essential',
        essentialDesc: 'Required for basic app functionality (sessions, language, settings).',
        analytical: 'Analytical',
        analyticalDesc: 'Used for system stability, logs, and performance tracking.',
        marketing: 'Marketing',
        marketingDesc: 'For system updates, user notices, and helper widgets.'
    },
    de: {
        title: 'Cookies & Datenschutz',
        desc: 'Um Ihnen das beste Benutzererlebnis zu bieten und die Plattformstabilität zu gewährleisten, verwenden wir Cookies und lokalen Speicher.',
        customize: 'Anpassen',
        acceptAll: 'Alle akzeptieren',
        declineAll: 'Optionale ablehnen',
        saveChoices: 'Auswahl speichern',
        essential: 'Notwendig',
        essentialDesc: 'Erforderlich für grundlegende App-Funktionen (Sitzungen, Sprache, Einstellungen).',
        analytical: 'Analytisch',
        analyticalDesc: 'Wird zur Überwachung der Systemstabilität und der Leistung verwendet.',
        marketing: 'Marketing',
        marketingDesc: 'Für System-Updates, Benutzerbenachrichtigungen und Widgets.'
    },
    sl: {
        title: 'Piškotki & Zasebnost',
        desc: 'Da bi vam zagotovili najboljšo uporabniško izkušnjo in zagotovili stabilnost platforme, uporabljamo piškotke in lokalno shranjevanje.',
        customize: 'Prilagodi',
        acceptAll: 'Sprejmi vse',
        declineAll: 'Zavrni izbirne',
        saveChoices: 'Shrani izbiro',
        essential: 'Nujni',
        essentialDesc: 'Potrebni za delovanje aplikacije (seje, jezik, nastavitve).',
        analytical: 'Analitični',
        analyticalDesc: 'Spremljanje stabilnosti delovanja aplikacije in delovanja.',
        marketing: 'Trženjski',
        marketingDesc: 'Za obvestila o posodobitvah in interaktivna orodja.'
    },
    sr: {
        title: 'Колачићи & Приватност',
        desc: 'Како бисмо вам пружили најбоље корисничко искуство и осигурали стабилност платформе, користимо колачиће и локалну меморију.',
        customize: 'Прилагоди',
        acceptAll: 'Прихвати све',
        declineAll: 'Одбиј необавезне',
        saveChoices: 'Сачувај избор',
        essential: 'Неопходни',
        essentialDesc: 'Потребни за рад апликације (сесије, језик, поставке).',
        analytical: 'Аналитички',
        analyticalDesc: 'Праћење стабилности рада апликације и перформанси.',
        marketing: 'Маркетиншки',
        marketingDesc: 'За обавештења о ажурирањима и интерактивне алате.'
    }
};

export default function GDPRConsentBanner() {
    const { lang } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);
    const [showCustomize, setShowCustomize] = useState(false);
    const [consent, setConsent] = useState({
        essential: true,
        analytical: false,
        marketing: false
    });

    const t = bannerTranslations[lang] || bannerTranslations.bs;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedConsent = localStorage.getItem('eznr_gdpr_consent');
            if (!savedConsent) {
                // Delay showing to allow layout and transitions to settle
                const timer = setTimeout(() => setIsVisible(true), 1200);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const saveConsent = (updatedConsent) => {
        localStorage.setItem('eznr_gdpr_consent', JSON.stringify(updatedConsent));
        // Dispatch custom event to notify other settings pages in real-time
        window.dispatchEvent(new CustomEvent('eznr:gdpr-consent-changed', { detail: updatedConsent }));
        setIsVisible(false);
    };

    const handleAcceptAll = () => {
        const fullConsent = { essential: true, analytical: true, marketing: true };
        setConsent(fullConsent);
        saveConsent(fullConsent);
    };

    const handleDeclineAll = () => {
        const minimalConsent = { essential: true, analytical: false, marketing: false };
        setConsent(minimalConsent);
        saveConsent(minimalConsent);
    };

    const handleSaveChoices = () => {
        saveConsent(consent);
    };

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            width: '90%',
            maxWidth: 620,
            background: 'rgba(26, 29, 39, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            padding: '24px 28px',
            color: '#E2E8F0',
            animation: 'gdprSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
            <style>{`
                @keyframes gdprSlideUp {
                    from { transform: translate(-50%, 30px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
                .gdpr-toggle-input {
                    appearance: none;
                    width: 36px;
                    height: 20px;
                    background-color: #2D3148;
                    border-radius: 20px;
                    position: relative;
                    cursor: pointer;
                    outline: none;
                    transition: background-color 0.2s;
                }
                .gdpr-toggle-input:checked {
                    background-color: #00BFA6;
                }
                .gdpr-toggle-input::before {
                    content: '';
                    position: absolute;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background-color: #FFFFFF;
                    top: 2px;
                    left: 2px;
                    transition: transform 0.2s;
                }
                .gdpr-toggle-input:checked::before {
                    transform: translateX(16px);
                }
                .gdpr-toggle-input:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .gdpr-btn-link {
                    background: none;
                    border: none;
                    color: var(--primary, #00BFA6);
                    font-weight: 700;
                    font-size: 0.86rem;
                    cursor: pointer;
                    padding: 8px 12px;
                    border-radius: 8px;
                    transition: all 0.15s;
                }
                .gdpr-btn-link:hover {
                    background: rgba(0, 191, 166, 0.08);
                }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Title & Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.5rem' }}>🍪</span>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.3px', color: '#FFFFFF' }}>
                        {t.title}
                    </h3>
                </div>

                {/* Description */}
                <p style={{ margin: 0, fontSize: '0.88rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    {t.desc}
                </p>

                {/* Optional Customization Panel */}
                {showCustomize && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        padding: '16px 20px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 12,
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        marginTop: 4,
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        {/* Essential */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>{t.essential}</div>
                                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>{t.essentialDesc}</div>
                            </div>
                            <input
                                type="checkbox"
                                className="gdpr-toggle-input"
                                checked={true}
                                disabled={true}
                                readOnly={true}
                            />
                        </div>
                        
                        <hr style={{ margin: 0, border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }} />

                        {/* Analytical */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>{t.analytical}</div>
                                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>{t.analyticalDesc}</div>
                            </div>
                            <input
                                type="checkbox"
                                className="gdpr-toggle-input"
                                checked={consent.analytical}
                                onChange={(e) => setConsent(c => ({ ...c, analytical: e.target.checked }))}
                            />
                        </div>

                        <hr style={{ margin: 0, border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }} />

                        {/* Marketing */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>{t.marketing}</div>
                                <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 2 }}>{t.marketingDesc}</div>
                            </div>
                            <input
                                type="checkbox"
                                className="gdpr-toggle-input"
                                checked={consent.marketing}
                                onChange={(e) => setConsent(c => ({ ...c, marketing: e.target.checked }))}
                            />
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginTop: 4
                }}>
                    <div>
                        {!showCustomize && (
                            <button
                                onClick={() => setShowCustomize(true)}
                                className="gdpr-btn-link"
                            >
                                ⚙️ {t.customize}
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        {showCustomize ? (
                            <>
                                <button
                                    onClick={handleDeclineAll}
                                    style={{
                                        background: 'none',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#E2E8F0',
                                        cursor: 'pointer',
                                        padding: '9px 16px',
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        fontSize: '0.84rem',
                                        transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    {t.declineAll}
                                </button>
                                <button
                                    onClick={handleSaveChoices}
                                    style={{
                                        background: 'var(--primary, #00BFA6)',
                                        border: 'none',
                                        color: '#FFFFFF',
                                        cursor: 'pointer',
                                        padding: '9px 18px',
                                        borderRadius: 8,
                                        fontWeight: 700,
                                        fontSize: '0.84rem',
                                        transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                    💾 {t.saveChoices}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleDeclineAll}
                                    style={{
                                        background: 'none',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#E2E8F0',
                                        cursor: 'pointer',
                                        padding: '9px 16px',
                                        borderRadius: 8,
                                        fontWeight: 600,
                                        fontSize: '0.84rem',
                                        transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                    {t.declineAll}
                                </button>
                                <button
                                    onClick={handleAcceptAll}
                                    style={{
                                        background: 'var(--primary, #00BFA6)',
                                        border: 'none',
                                        color: '#FFFFFF',
                                        cursor: 'pointer',
                                        padding: '9px 18px',
                                        borderRadius: 8,
                                        fontWeight: 700,
                                        fontSize: '0.84rem',
                                        transition: 'all 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                    👍 {t.acceptAll}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
