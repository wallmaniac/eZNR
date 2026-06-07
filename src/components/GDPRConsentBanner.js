'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const bannerTranslations = {
    bs: {
        desc: 'Koristimo kolačiće za optimalan rad i stabilnost platforme.',
        accept: 'Prihvati',
        decline: 'Odbij'
    },
    hr: {
        desc: 'Koristimo kolačiće za optimalan rad i stabilnost platforme.',
        accept: 'Prihvati',
        decline: 'Odbij'
    },
    en: {
        desc: 'We use cookies to ensure optimal performance and stability.',
        accept: 'Accept',
        decline: 'Decline'
    },
    de: {
        desc: 'Wir verwenden Cookies, um Leistung und Stabilität zu gewährleisten.',
        accept: 'Akzeptieren',
        decline: 'Ablehnen'
    },
    sl: {
        desc: 'Za optimalno delovanje in stabilnost uporabljamo piškotke.',
        accept: 'Sprejmi',
        decline: 'Zavrni'
    },
    sr: {
        desc: 'Користимо колачиће за оптималан рад и стабилност платформе.',
        accept: 'Прихвати',
        decline: 'Одбиј'
    }
};

export default function GDPRConsentBanner() {
    const { lang } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);

    const t = bannerTranslations[lang] || bannerTranslations.bs;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedConsent = localStorage.getItem('eznr_gdpr_consent');
            if (!savedConsent) {
                // Subtle slide-in delay
                const timer = setTimeout(() => setIsVisible(true), 1500);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    const saveConsent = (updatedConsent) => {
        localStorage.setItem('eznr_gdpr_consent', JSON.stringify(updatedConsent));
        window.dispatchEvent(new CustomEvent('eznr:gdpr-consent-changed', { detail: updatedConsent }));
        setIsVisible(false);
    };

    const handleAcceptAll = () => {
        saveConsent({ essential: true, analytical: true, marketing: true });
    };

    const handleDeclineAll = () => {
        saveConsent({ essential: true, analytical: false, marketing: false });
    };

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            zIndex: 99999,
            width: 'calc(100% - 40px)',
            maxWidth: 320,
            background: 'rgba(26, 29, 39, 0.90)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.30)',
            padding: '14px 16px',
            color: '#E2E8F0',
            animation: 'gdprSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
            <style>{`
                @keyframes gdprSlideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Text description */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🍪</span>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.45, fontWeight: 500 }}>
                        {t.desc}
                    </p>
                </div>

                {/* Compact Buttons row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                    marginTop: 2
                }}>
                    <button
                        onClick={handleDeclineAll}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#E2E8F0',
                            cursor: 'pointer',
                            padding: '5px 12px',
                            borderRadius: 6,
                            fontWeight: 600,
                            fontSize: '0.78rem',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        {t.decline}
                    </button>
                    <button
                        onClick={handleAcceptAll}
                        style={{
                            background: 'var(--primary, #00BFA6)',
                            border: 'none',
                            color: '#FFFFFF',
                            cursor: 'pointer',
                            padding: '6px 14px',
                            borderRadius: 6,
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        {t.accept}
                    </button>
                </div>
            </div>
        </div>
    );
}
