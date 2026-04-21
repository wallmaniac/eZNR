'use client';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const NavigationGuardContext = createContext(null);

export function NavigationGuardProvider({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isDirty, setIsDirty] = useState(false);
    const [pendingPath, setPendingPath] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const saveCallbackRef = useRef(null);
    const dirtyRef = useRef(false);
    const pathnameRef = useRef(pathname);

    // Keep ref in sync (for event listeners that close over stale state)
    useEffect(() => {
        if (isDirty && !dirtyRef.current) {
            // Transitioning clean -> dirty
            // Push a sentinel so the browser back button doesn't actually change the URL
            window.history.pushState({ _guardSentinel: true }, '', window.location.href);
        }
        dirtyRef.current = isDirty;
    }, [isDirty]);

    // Reset dirty when page actually changes
    useEffect(() => {
        if (pathname !== pathnameRef.current) {
            pathnameRef.current = pathname;
            setIsDirty(false);
            dirtyRef.current = false;
            setPendingPath(null);
            saveCallbackRef.current = null;
        }
    }, [pathname]);

    // Intercept browser back/forward (popstate)
    useEffect(() => {
        const handlePopState = (e) => {
            if (dirtyRef.current) {
                // The sentinel was just popped. The URL hasn't changed.
                // We MUST push the sentinel back so future back clicks are caught.
                window.history.pushState({ _guardSentinel: true }, '', window.location.href);
                setPendingPath('__back__');
                setShowPrompt(true);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Intercept page unload (browser close / refresh)
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (dirtyRef.current) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Intercept Next.js <Link> clicks globally
    useEffect(() => {
        const handleLinkClick = (e) => {
            if (!dirtyRef.current) return;
            const a = e.target.closest('a[href]');
            if (!a) return;
            
            const href = a.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
            
            try {
                const targetUrl = new URL(a.href, window.location.origin);
                const currentUrl = new URL(window.location.href);
                // Only intercept actual cross-page routes, leave query parameters or hashes alone
                if (targetUrl.pathname !== currentUrl.pathname) {
                    e.preventDefault();
                    e.stopPropagation();
                    setPendingPath(href);
                    setShowPrompt(true);
                }
            } catch (err) {
                // Ignore parsing errors
            }
        };
        document.addEventListener('click', handleLinkClick, true); // Capture phase is critical
        return () => document.removeEventListener('click', handleLinkClick, true);
    }, []);

    const markDirty = useCallback((onSave) => {
        setIsDirty(true);
        if (onSave) saveCallbackRef.current = onSave;
    }, []);

    const markClean = useCallback(() => {
        setIsDirty(false);
        saveCallbackRef.current = null;
    }, []);

    // Call this instead of router.push when navigating from a dirty page
    const navigate = useCallback((path) => {
        if (dirtyRef.current) {
            setPendingPath(path);
            setShowPrompt(true);
        } else {
            router.push(path);
        }
    }, [router]);

    const handleSave = useCallback(async () => {
        const cb = saveCallbackRef.current;
        if (cb) {
            try {
                await cb();
            } catch (e) {
                console.error('Save failed:', e);
                return; // stay on page if save failed
            }
        }
        setIsDirty(false);
        dirtyRef.current = false;
        setShowPrompt(false);
        if (pendingPath && pendingPath !== '__back__') {
            router.push(pendingPath);
        } else if (pendingPath === '__back__') {
            window.history.go(-2); // Skip the sentinel and navigate to the actual previous page
        }
        setPendingPath(null);
        saveCallbackRef.current = null;
    }, [pendingPath, router]);

    const handleDiscard = useCallback(() => {
        setIsDirty(false);
        dirtyRef.current = false;
        setShowPrompt(false);
        if (pendingPath && pendingPath !== '__back__') {
            router.push(pendingPath);
        } else if (pendingPath === '__back__') {
            window.history.go(-2); // Skip the sentinel and navigate to the actual previous page
        }
        setPendingPath(null);
        saveCallbackRef.current = null;
    }, [pendingPath, router]);

    const handleStay = useCallback(() => {
        setShowPrompt(false);
        setPendingPath(null);
        saveCallbackRef.current = null;
    }, []);

    return (
        <NavigationGuardContext.Provider value={{ isDirty, markDirty, markClean, navigate }}>
            {children}

            {showPrompt && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                        padding: 32, maxWidth: 420, width: '90%',
                        boxShadow: 'var(--shadow-xl)',
                        border: '1px solid var(--border)',
                        animation: 'fadeIn 0.15s ease-out',
                        position: 'relative',
                    }}>
                        {/* × close button — stays on page */}
                        <button
                            onClick={handleStay}
                            style={{
                                position: 'absolute', top: 14, right: 14,
                                background: 'none', border: 'none', fontSize: '1.1rem',
                                cursor: 'pointer', color: 'var(--text-muted)',
                                lineHeight: 1, padding: '4px 6px', borderRadius: 6,
                            }}
                            title="Ostani na stranici"
                        >✕</button>
                        <div style={{ fontSize: '2rem', marginBottom: 12, textAlign: 'center' }}>⚠️</div>
                        <h2 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '1.2rem' }}>
                            Nesačuvane promjene
                        </h2>
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 28px', lineHeight: 1.6, fontSize: '0.9rem' }}>
                            Imate nesačuvane promjene na ovoj stranici.<br />
                            Šta želite raditi?
                        </p>
                        <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                            {saveCallbackRef.current && (
                                <button
                                    style={{
                                        padding: '12px 20px', borderRadius: 'var(--radius-md)',
                                        background: 'var(--primary)', color: 'white',
                                        border: 'none', cursor: 'pointer', fontWeight: 700,
                                        fontSize: '0.95rem', fontFamily: 'var(--font-heading)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    }}
                                    onClick={handleSave}
                                >
                                    💾 Spremi i nastavi
                                </button>
                            )}
                            <button
                                style={{
                                    padding: '12px 20px', borderRadius: 'var(--radius-md)',
                                    background: 'var(--danger, #EF4444)', color: 'white',
                                    border: 'none', cursor: 'pointer', fontWeight: 600,
                                    fontSize: '0.95rem', fontFamily: 'var(--font-heading)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                }}
                                onClick={handleDiscard}
                            >
                                🗑️ Odbaci promjene i nastavi
                            </button>
                            <button
                                style={{
                                    padding: '12px 20px', borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-input)', color: 'var(--text)',
                                    border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600,
                                    fontSize: '0.95rem', fontFamily: 'var(--font-heading)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                }}
                                onClick={handleStay}
                            >
                                ← Ostani na stranici
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </NavigationGuardContext.Provider>
    );
}

export function useNavigationGuard() {
    const ctx = useContext(NavigationGuardContext);
    if (!ctx) throw new Error('useNavigationGuard must be used inside NavigationGuardProvider');
    return ctx;
}
