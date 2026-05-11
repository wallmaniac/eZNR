'use client';
import { createContext, useContext, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getById, COLLECTIONS } from '@/lib/dataStore';

/**
 * CountryContext — Provides the active company's jurisdiction (BA or HR).
 *
 * Usage:
 *   const country = useCountry(); // 'BA' or 'HR'
 *
 * The country is derived from the active company's `country` field.
 * Defaults to 'BA' if not set.
 */

const CountryContext = createContext('BA');

export function CountryProvider({ children }) {
    const { activeCompanyId, activeCompany } = useAuth();

    const country = useMemo(() => {
        if (!activeCompanyId || activeCompanyId === 'all') return 'BA';
        // Use activeCompany from AuthContext because regular users don't have access to the global companies cache
        return activeCompany?.country || 'BA';
    }, [activeCompanyId, activeCompany]);

    // Automatically invalidate news cache on country change to prevent cross-jurisdictional data leakage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const otherCountry = country === 'BA' ? 'HR' : 'BA';
            localStorage.removeItem(`eznr_news_cache_${otherCountry}`);
            // Also clear the current country cache to guarantee fresh news on company switch
            localStorage.removeItem(`eznr_news_cache_${country}`);
        }
    }, [country, activeCompanyId]);

    return (
        <CountryContext.Provider value={country}>
            {children}
        </CountryContext.Provider>
    );
}

export function useCountry() {
    return useContext(CountryContext);
}
