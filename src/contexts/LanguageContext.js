'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { translations } from '@/i18n/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState('bs');

    const toggleLang = useCallback(() => {
        setLang((prev) => (prev === 'bs' ? 'en' : 'bs'));
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
