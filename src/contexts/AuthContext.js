'use client';

// ============================================================================
// AUTH CONTEXT — Firebase Auth state management
// Uses onAuthStateChanged for persistent sessions + Firestore user profiles
// ============================================================================

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    loginWithEmail,
    registerCompanyAdmin,
    logoutUser,
    resetPassword,
    getUserProfile,
    getCompany,
    getUserCompanies,
    onAuthChange,
    isSuperAdmin as checkSuperAdmin,
    isCompanyAdmin as checkCompanyAdmin,
    ROLES,
} from '@/lib/authService';
import { logLogin, updatePresence } from '@/lib/activityLog';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);            // Full user profile (from Firestore)
    const [firebaseUser, setFirebaseUser] = useState(null); // Raw Firebase Auth user
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeCompanyId, setActiveCompanyId] = useState(null);
    const [activeCompany, setActiveCompany] = useState(null); // Company document
    const [userCompanies, setUserCompanies] = useState([]);   // All companies user has access to
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const presenceInterval = useRef(null);

    // ── Firebase Auth state listener (fires on login, logout, page refresh) ──
    useEffect(() => {
        const unsubscribe = onAuthChange(async (fbUser) => {
            if (fbUser) {
                // User is signed in — fetch their Firestore profile
                try {
                    const profile = await getUserProfile(fbUser.uid);
                    if (profile && profile.aktivan !== false) {
                        setFirebaseUser(fbUser);
                        setUser(profile);
                        setIsAuthenticated(true);

                        // Restore active company from localStorage or use first company
                        const savedCompany = localStorage.getItem('eznr_activeCompany');
                        let companyId = null;

                        if (profile.role === ROLES.SUPER_ADMIN) {
                            // Super admin can see all or pick one
                            companyId = savedCompany || (profile.companyIds?.[0] || 'all');
                        } else {
                            companyId = savedCompany && profile.companyIds?.includes(savedCompany)
                                ? savedCompany
                                : (profile.companyIds?.[0] || null);
                        }

                        setActiveCompanyId(companyId);
                        if (companyId && companyId !== 'all') {
                            localStorage.setItem('eznr_activeCompany', companyId);
                        }

                        // Load user's companies list
                        if (profile.role === ROLES.SUPER_ADMIN) {
                            // Super admin gets all companies — but load lazily in useEffect below
                        }
                        if (profile.companyIds?.length) {
                            const companies = await getUserCompanies(profile.companyIds);
                            setUserCompanies(companies);
                            if (companyId && companyId !== 'all') {
                                const ac = companies.find(c => c.id === companyId);
                                setActiveCompany(ac || null);
                            }
                        }

                        // Also keep localStorage copy for legacy compatibility (dataStore.js reads it)
                        localStorage.setItem('eznr_user', JSON.stringify({
                            id: profile.id,
                            uid: fbUser.uid,
                            email: profile.email,
                            firstName: profile.firstName,
                            lastName: profile.lastName,
                            role: profile.role,
                            companyIds: profile.companyIds || [],
                        }));
                    } else {
                        // Profile missing or deactivated
                        _clearState();
                    }
                } catch (err) {
                    console.error('[AuthContext] Error loading user profile:', err);
                    _clearState();
                }
            } else {
                // User is signed out
                _clearState();
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    function _clearState() {
        setFirebaseUser(null);
        setUser(null);
        setIsAuthenticated(false);
        setActiveCompanyId(null);
        setActiveCompany(null);
        setUserCompanies([]);
        if (typeof window !== 'undefined') {
            localStorage.removeItem('eznr_user');
            localStorage.removeItem('eznr_activeCompany');
        }
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    const login = useCallback(async (email, password) => {
        const result = await loginWithEmail(email, password);
        // onAuthStateChanged will handle the rest
        try { logLogin(result); } catch { /* non-critical */ }
        return result;
    }, []);

    // ── Register ──────────────────────────────────────────────────────────────
    const register = useCallback(async (formData) => {
        const result = await registerCompanyAdmin(formData);
        // onAuthStateChanged will handle setting state
        return result;
    }, []);

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = useCallback(async () => {
        try {
            await logoutUser();
        } catch (err) {
            console.error('[AuthContext] Logout error:', err);
        }
        _clearState();
    }, []);

    // ── Switch Company ────────────────────────────────────────────────────────
    const switchCompany = useCallback(async (companyId) => {
        setActiveCompanyId(companyId);
        if (typeof window !== 'undefined') {
            localStorage.setItem('eznr_activeCompany', companyId);
        }
        if (companyId && companyId !== 'all') {
            const ac = userCompanies.find(c => c.id === companyId);
            if (ac) {
                setActiveCompany(ac);
            } else {
                const comp = await getCompany(companyId);
                setActiveCompany(comp);
            }
        } else {
            setActiveCompany(null);
        }
    }, [userCompanies]);

    // ── Password Reset ────────────────────────────────────────────────────────
    const forgotPassword = useCallback(async (email) => {
        await resetPassword(email);
    }, []);

    // ── Presence heartbeat ────────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;
        const tick = () => {
            try {
                updatePresence(user.id, `${user.firstName} ${user.lastName}`, activeCompanyId, null);
            } catch { /* non-critical */ }
        };
        tick();
        presenceInterval.current = setInterval(tick, 60000);
        return () => {
            if (presenceInterval.current) clearInterval(presenceInterval.current);
        };
    }, [user?.id, activeCompanyId]);

    // ── Computed properties ───────────────────────────────────────────────────
    const isAdmin = user?.role === 'admin' || user?.role === ROLES.SUPER_ADMIN;
    const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
    const isOfficer = user?.role === 'officer' || user?.role === ROLES.COMPANY_ADMIN;

    return (
        <AuthContext.Provider value={{
            user,
            firebaseUser,
            isAuthenticated,
            loading,
            activeCompanyId,
            activeCompany,
            userCompanies,
            isAdmin,
            isSuperAdmin,
            isOfficer,
            login,
            logout,
            register,
            switchCompany,
            forgotPassword,
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
