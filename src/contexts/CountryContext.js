'use client';
import { createContext, useContext, useMemo } from 'react';
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

    return (
        <CountryContext.Provider value={country}>
            {children}
        </CountryContext.Provider>
    );
}

export function useCountry() {
    return useContext(CountryContext);
}
