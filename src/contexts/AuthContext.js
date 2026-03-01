'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { findUserByUsername } from '@/lib/dataStore';
import { initializeFirestore, isFirestoreReady } from '@/lib/firestoreService';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeCompanyId, setActiveCompanyId] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const login = useCallback((userData) => {
        const enriched = {
            ...userData,
            role: userData.role || 'officer',
            companyIds: userData.companyIds || [],
        };
        setUser(enriched);
        setIsAuthenticated(true);
        // Set active company to first company or saved preference
        const savedCompany = typeof window !== 'undefined' ? localStorage.getItem('eznr_activeCompany') : null;
        const companyId = savedCompany && enriched.companyIds.includes(savedCompany)
            ? savedCompany
            : (enriched.companyIds[0] || null);
        setActiveCompanyId(companyId);
        if (typeof window !== 'undefined') {
            localStorage.setItem('eznr_user', JSON.stringify(enriched));
            if (companyId) localStorage.setItem('eznr_activeCompany', companyId);
        }
    }, []);

    const logout = useCallback(async () => {
        setIsAuthenticated(false);
        setUser(null);
        setActiveCompanyId(null);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('eznr_user');
            localStorage.removeItem('eznr_activeCompany');
        }
        try {
            const { getAuth, signOut } = await import('firebase/auth');
            const { app } = await import('@/lib/firebase');
            await signOut(getAuth(app));
        } catch (e) { console.error("Firebase logout error:", e); }
    }, []);

    const switchCompany = useCallback((companyId) => {
        setActiveCompanyId(companyId);
        if (typeof window !== 'undefined') {
            localStorage.setItem('eznr_activeCompany', companyId);
        }
    }, []);

    // Load on mount
    useEffect(() => {
        const init = async () => {
            if (!isFirestoreReady()) {
                await initializeFirestore();
            }

            if (typeof window !== 'undefined') {
                const storedUser = localStorage.getItem('eznr_user');
                if (storedUser) {
                    try {
                        const parsed = JSON.parse(storedUser);
                        setUser(parsed);
                        setIsAuthenticated(true);
                        const savedCompany = localStorage.getItem('eznr_activeCompany');
                        setActiveCompanyId(savedCompany || (parsed.companyIds?.[0] || null));
                    } catch (e) {
                        console.error("Auth init error:", e);
                    }
                }
            }
            setLoading(false);
        };
        init();
    }, []);

    const register = useCallback((userData) => {
        login(userData);
    }, [login]);

    const isAdmin = user?.role === 'admin';
    const isOfficer = user?.role === 'officer';

    return (
        <AuthContext.Provider value={{
            user, isAuthenticated, loading, activeCompanyId,
            isAdmin, isOfficer,
            login, logout, register, switchCompany,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
