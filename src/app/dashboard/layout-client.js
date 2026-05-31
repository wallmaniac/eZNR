'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AIAssistant from '@/components/AIAssistant';
import { initializeData } from '@/lib/dataStore';
import { NavigationGuardProvider } from '@/contexts/NavigationGuardContext';
import UndoBar from '@/components/UndoBar';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import OfflineIndicator from '@/components/mobile/OfflineIndicator';
import GlobalLongPress from '@/components/mobile/GlobalLongPress';
import GlobalSwipeNav from '@/components/mobile/GlobalSwipeNav';
import { LoadingProgressBar } from '@/components/SkeletonUI';

export default function DashboardLayout({ children }) {
    const { isAuthenticated, loading, activeCompanyId, switchCompany } = useAuth();
    const router = useRouter();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [undoKey, setUndoKey] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [isTablet, setIsTablet] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer open/closed

    // Unified Responsive Logic (Mobile + Tablet + Desktop)
    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            const mobile = w < 768;
            const tablet = w>= 768 && w <= 1024;
            const desktop = w> 1024;

            setIsMobile(mobile);
            setIsTablet(tablet);

            // Responsive auto-collapse/expand logic
            if (mobile) {
                setSidebarCollapsed(true);
                setMobileOpen(false); // Close drawer if switching from desktop to mobile
            } else if (tablet) {
                setSidebarCollapsed(true);
            } else if (desktop) {
                // On desktop, we prefer expanded but allow user to collapse
                // For zoom safety: only expand automatically if switching TO desktop
                setSidebarCollapsed(false);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleUndo = () => setUndoKey(k => k + 1);
        window.addEventListener('eznr:undo', handleUndo);
        return () => window.removeEventListener('eznr:undo', handleUndo);
    }, []);

    // ── Global auto-company switcher (for Deep links / QR codes) ──
    useEffect(() => {
        if (!isAuthenticated || loading || typeof window === 'undefined') return;
        const qs = new URLSearchParams(window.location.search);
        const target = qs.get('_qrc') || qs.get('c');
        if (target) {
            // Remove the param so we don't loop
            qs.delete('_qrc');
            qs.delete('c');
            const newUrl = window.location.pathname + (qs.toString() ? '?' + qs.toString() : '');
            window.history.replaceState({}, '', newUrl);
            
            if (target !== activeCompanyId) {
                switchCompany(target).catch(console.error);
            }
        }
    }, [isAuthenticated, loading, activeCompanyId, switchCompany]);

    useEffect(() => {
        setMounted(true);
        if (!loading) {
            initializeData();
            if (!isAuthenticated) {
                // Use window.location directly to avoid Next.js static de-optimization from useSearchParams
                const currentUrl = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : '';
                router.push(`/login${currentUrl ? `?redirect=${currentUrl}` : ''}`);
            }
        }
    }, [loading, isAuthenticated, router]);

    // ── Mobile hardware back button: close drawer on back press ──
    // The login page already redirects authenticated users to /dashboard,
    // so we only need to intercept back to close overlays (drawer).
    useEffect(() => {
        if (!isMobile || !mounted) return;

        // When the drawer opens, push a history entry so back can close it
        if (mobileOpen) {
            window.history.pushState({ eznrDrawer: true }, '');
        }
    }, [isMobile, mounted, mobileOpen]);

    useEffect(() => {
        if (!isMobile || !mounted) return;

        const handlePopState = (e) => {
            // If the drawer is open, close it instead of navigating back
            if (mobileOpen) {
                setMobileOpen(false);
                return;
            }
            // Otherwise let the browser handle back normally
            // (Next.js router manages the history stack)
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isMobile, mounted, mobileOpen]);

    const handleMobileToggle = useCallback(() => {
        setMobileOpen(prev => !prev);
    }, []);

    const handleDesktopToggle = useCallback(() => {
        setSidebarCollapsed(prev => !prev);
    }, []);

    if (!mounted || loading || !isAuthenticated) {
        return (
            <div style={{
                height: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-page)',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        border: '4px solid var(--border)',
                        borderTopColor: 'var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        margin: '0 auto 16px',
                    }} />
                    <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
                        Učitavanje...
                    </p>
                </div>
            </div>
        );
    }

    // Calculate main margin
    const mainMarginLeft = isMobile
        ? 0
        : sidebarCollapsed
            ? 'var(--sidebar-collapsed-width)'
            : 'var(--sidebar-width)';

    return (
        <div style={{ minHeight: '100dvh', background: 'var(--bg-page)' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            {/* Data loading progress bar */}
            <LoadingProgressBar />

            {/* Sidebar — on mobile it renders its own backdrop internally */}
            <Sidebar
                collapsed={isMobile ? false : sidebarCollapsed}
                onToggle={isMobile ? handleMobileToggle : handleDesktopToggle}
                isMobile={isMobile}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />

            {/* Header */}
            <Header
                sidebarCollapsed={isMobile ? false : sidebarCollapsed}
                isMobile={isMobile}
                onMobileMenuToggle={handleMobileToggle}
            />

            {/* Main content — extra bottom padding on mobile for bottom nav */}
            <main style={{
                marginLeft: mainMarginLeft,
                marginTop: 'var(--header-height)',
                padding: isMobile ? 12 : 24,
                paddingBottom: isMobile ? 120 : 96,
                transition: 'margin-left var(--transition-normal)',
                minHeight: 'calc(100dvh - var(--header-height))',
            }}>
                <NavigationGuardProvider key={undoKey}>
                    {children}
                </NavigationGuardProvider>
            </main>

            {/* Mobile bottom navigation */}
            {isMobile && (
                <MobileBottomNav onMenuOpen={handleMobileToggle} />
            )}

            {/* Offline indicator (all devices) */}
            <OfflineIndicator />

            {/* Global long-press on table rows (mobile only) */}
            {isMobile && <GlobalLongPress />}

            {/* Global swipe left/right on tables to navigate pages (mobile only) */}
            {isMobile && <GlobalSwipeNav />}

            <UndoBar />
            <AIAssistant />
        </div>
    );
}
