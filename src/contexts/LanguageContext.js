'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { translations } from '@/i18n/translations';

const LanguageContext = createContext();

const LANG_CYCLE = ['bs', 'hr', 'en'];

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState('bs');
    const [isInitialized, setIsInitialized] = useState(false);

    // Load persisted language on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedLang = localStorage.getItem('eznr_ui_lang');
            if (savedLang && LANG_CYCLE.includes(savedLang)) {
                setLang(savedLang);
            }
            setIsInitialized(true);
        }
    }, []);

    const handleSetLang = useCallback((newLang) => {
        setLang(newLang);
        if (typeof window !== 'undefined') {
            localStorage.setItem('eznr_ui_lang', newLang);
            // When user manually sets language, record that they did a manual override for the current jurisdiction
            localStorage.setItem('eznr_lang_manual_override', 'true');
        }
    }, []);

    const toggleLang = useCallback(() => {
        setLang((prev) => {
            const idx = LANG_CYCLE.indexOf(prev);
            const nextLang = LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
            if (typeof window !== 'undefined') {
                localStorage.setItem('eznr_ui_lang', nextLang);
                localStorage.setItem('eznr_lang_manual_override', 'true');
            }
            return nextLang;
        });
    }, []);

    const t = useCallback(
        (key) => {
            return translations[lang]?.[key] || translations.bs[key] || key;
        },
        [lang]
    );

    return (
        <LanguageContext.Provider value={{ lang, setLang: handleSetLang, toggleLang, t, isInitialized }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within LanguageProvider');
    return context;
}

export function CountryAutoSwitch() {
    const { setLang, isInitialized } = useLanguage();
    const lastCountryRef = useRef(null);

    let country = 'BA';
    try {
        const { useCountry } = require('@/contexts/CountryContext');
        country = useCountry();
    } catch (_) { }

    useEffect(() => {
        if (!isInitialized || !country) return;

        const currentCountry = country.toUpperCase();
        
        // On first run in this session, check what country we last auto-switched for
        if (lastCountryRef.current === null) {
            const savedAutoCountry = localStorage.getItem('eznr_last_auto_country');
            const hasManualOverride = localStorage.getItem('eznr_lang_manual_override') === 'true';
            
            // If the country hasn't changed since our last auto-switch, AND the user has a manual override,
            // we respect their override and don't auto-switch.
            if (savedAutoCountry === currentCountry && hasManualOverride) {
                lastCountryRef.current = currentCountry;
                return;
            }
        }

        // Only auto-switch if the country actually changed (or it's the first time visiting this country)
        if (lastCountryRef.current !== currentCountry) {
            lastCountryRef.current = currentCountry;
            
            if (currentCountry === 'HR') {
                setLang('hr');
            } else if (currentCountry === 'BA') {
                setLang('bs');
            }
            
            // Record this auto-switch and clear any previous manual override flag
            if (typeof window !== 'undefined') {
                localStorage.setItem('eznr_last_auto_country', currentCountry);
                localStorage.removeItem('eznr_lang_manual_override');
            }
        }
    }, [country, isInitialized, setLang]);

    return null;
}
