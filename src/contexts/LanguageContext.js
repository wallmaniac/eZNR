'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { translations } from '@/i18n/translations';

const LanguageContext = createContext();

/**
 * Supported locales: 'bs' (Bosnian), 'hr' (Croatian), 'en' (English).
 *
 * Auto-switch behaviour:
 *   When a CountryAutoSwitch component detects the active company's
 *   country is 'HR', it sets the language to 'hr'.
 *   When it switches to 'BA', it sets the language to 'bs'.
 *   The user can always override manually via toggleLang / setLang.
 */

const LANG_CYCLE = ['bs', 'hr', 'en'];

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState('bs');

    const toggleLang = useCallback(() => {
        setLang((prev) => {
            const idx = LANG_CYCLE.indexOf(prev);
            return LANG_CYCLE[(idx + 1) % LANG_CYCLE.length];
        });
    }, []);

    const t = useCallback(
        (key) => {
            return translations[lang]?.[key] || translations.bs[key] || key;
        },
        [lang]
    );

    return (
        <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within LanguageProvider');
    return context;
}

/**
 * CountryAutoSwitch — tiny bridge component.
 * Place INSIDE both LanguageProvider AND CountryProvider.
 * Watches the active company's country and auto-sets the UI language.
 */
export function CountryAutoSwitch() {
    // Lazy-import to avoid circular deps; CountryContext lives at the same level
    const { setLang } = useLanguage();
    const hasManualOverride = useRef(false);

    // We import useCountry dynamically since the provider tree nests
    // Language > Country — this component is rendered INSIDE Country.
    let country = 'BA';
    try {
        const { useCountry } = require('@/contexts/CountryContext');
        country = useCountry();
    } catch (_) { /* fallback if CountryContext not ready */ }

    useEffect(() => {
        // Auto-switch language based on jurisdiction
        if (country === 'HR') {
            setLang('hr');
        } else {
            setLang('bs');
        }
    }, [country, setLang]);

    return null; // Render nothing — pure side-effect component
}
