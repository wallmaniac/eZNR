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
    reauthenticateUser,
    updateUserPassword,
    updateUserEmail,
    updateUserName,
    getUserProfile,
    getCompany,
    getUserCompanies,
    onAuthChange,
    isSuperAdmin as checkSuperAdmin,
    isCompanyAdmin as checkCompanyAdmin,
    ROLES,
} from '@/lib/authService';
import { loadCompanyData, switchCompanyData, resetDataStore } from '@/lib/dataStore';
import { logLogin, updatePresence } from '@/lib/activityLog';
import { applyUIBranding, resetUIBranding } from '@/lib/brandingService';

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

                        // Check if URL forces a company switch (deep link / QR code)
                        const qs = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
                        const urlTarget = qs ? (qs.get('_qrc') || qs.get('c')) : null;

                        // Restore active company from URL, then localStorage, or use first company
                        const savedCompany = urlTarget || localStorage.getItem('eznr_activeCompany');
                        let companyId = null;

                        if (profile.role === ROLES.SUPER_ADMIN) {
                            // Super admin: restore from localStorage but NEVER use 'all'
                            // — Superadmin always works in single-company mode
                            companyId = (savedCompany && savedCompany !== 'all')
                                ? savedCompany
                                : profile.companyIds?.[0] || null;
                        } else {
                            // Officer/Admin: restore 'all' or explicit company from localStorage
                            companyId = savedCompany && (savedCompany === 'all' || profile.companyIds?.includes(savedCompany))
                                ? savedCompany
                                : (profile.companyIds?.[0] || null);
                        }

                        setActiveCompanyId(companyId);
                        if (companyId && companyId !== 'all') {
                            localStorage.setItem('eznr_activeCompany', companyId);
                        }

                        // Load company data from Firestore into dataStore cache (NON-BLOCKING)
                        if (companyId) {
                            loadCompanyData(companyId).catch(console.error);
                        }

                        let resolvedCompanyIds = profile.companyIds || [];
                        // Load user's companies list
                        if (profile.role === ROLES.SUPER_ADMIN) {
                            // Super admin: load ALL companies from Firestore eagerly
                            try {
                                const { getAllCompaniesFromFirestore } = await import('@/lib/authService');
                                const allComps = await getAllCompaniesFromFirestore();
                                setUserCompanies(allComps);
                                resolvedCompanyIds = allComps.map(c => c.id);
                                // Super admin always picks a SPECIFIC company — never 'all'
                                // Use the first company if the saved one was 'all' or invalid
                                if (!companyId || companyId === 'all') {
                                    const firstId = allComps[0]?.id || null;
                                    if (firstId) {
                                        setActiveCompanyId(firstId);
                                        localStorage.setItem('eznr_activeCompany', firstId);
                                        loadCompanyData(firstId).catch(console.error);
                                        setActiveCompany(allComps[0]);
                                    }
                                } else {
                                    const ac = allComps.find(c => c.id === companyId);
                                    setActiveCompany(ac || null);
                                }
                            } catch (e) {
                                console.error('[AuthContext] Failed to load all companies for superadmin:', e);
                            }
                        } else if (profile.companyIds?.length) {
                            const companies = await getUserCompanies(profile.companyIds);
                            setUserCompanies(companies);
                            resolvedCompanyIds = companies.map(c => c.id);
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
                            companyIds: resolvedCompanyIds,
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
        // Detach all Firestore onSnapshot listeners immediately to prevent
        // "Missing or insufficient permissions" errors after logout
        resetDataStore();
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
        setLoading(true);
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
                if (comp) {
                    setUserCompanies(prev => {
                        if (prev.some(c => c.id === comp.id)) return prev;
                        return [...prev, comp];
                    });
                    setUser(prev => {
                        if (!prev) return null;
                        const updatedIds = [...new Set([...(prev.companyIds || []), comp.id])];
                        return { ...prev, companyIds: updatedIds };
                    });
                }
            }
        } else {
            setActiveCompany(null);
        }
        if (companyId) {
            // Do NOT await to immediately unblock the UI. DataStore handles async population.
            switchCompanyData(companyId).catch(console.error);
        }
        setLoading(false);
    }, [userCompanies]);

    // ── Password Reset & Change ───────────────────────────────────────────────
    const forgotPassword = useCallback(async (email) => {
        await resetPassword(email);
    }, []);

    const changePassword = useCallback(async (newPass) => {
        await updateUserPassword(newPass);
    }, []);

    const reauthenticate = useCallback(async (currentPassword) => {
        await reauthenticateUser(currentPassword);
    }, []);

    const changeEmail = useCallback(async (newEmail) => {
        await updateUserEmail(newEmail);
    }, []);

    const changeName = useCallback(async (first, last) => {
        await updateUserName(first, last);
    }, []);

    const updateUserContext = useCallback((newData) => {
        setUser(prev => ({ ...prev, ...newData }));
        if (typeof window !== 'undefined') {
            const ls = localStorage.getItem('eznr_user');
            if (ls) {
                try {
                    const parsed = JSON.parse(ls);
                    localStorage.setItem('eznr_user', JSON.stringify({ ...parsed, ...newData }));
                } catch {}
            }
        }
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

    // ── Apply UI branding on company switch & sync ─────────────────────────────
    useEffect(() => {
        const applyBranding = () => {
            if (activeCompanyId && activeCompanyId !== 'all') {
                applyUIBranding(activeCompanyId);
            } else {
                resetUIBranding();
            }
        };

        applyBranding();

        if (typeof window !== 'undefined') {
            window.addEventListener('eznr:data-synced', applyBranding);
            return () => {
                window.removeEventListener('eznr:data-synced', applyBranding);
            };
        }
    }, [activeCompanyId]);

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
            changePassword,
            reauthenticate,
            changeEmail,
            changeName,
            updateUserContext,
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
