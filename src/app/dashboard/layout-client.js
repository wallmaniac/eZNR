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
import MobileLayout from '@/components/mobile/MobileLayout';

export default function DashboardLayout({ children }) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [undoKey, setUndoKey] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false); // mobile sidebar open/closed

    // Detect mobile
    useEffect(() => {
        const check = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                setSidebarCollapsed(true); // always start collapsed on mobile
                setMobileOpen(false);
            }
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Tablet auto-collapse
    useEffect(() => {
        const checkTablet = () => {
            if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
                setSidebarCollapsed(true);
            } else if (window.innerWidth > 1024) {
                setSidebarCollapsed(false);
            }
        };
        checkTablet();
        window.addEventListener('resize', checkTablet);
        return () => window.removeEventListener('resize', checkTablet);
    }, []);

    useEffect(() => {
        const handleUndo = () => setUndoKey(k => k + 1);
        window.addEventListener('eznr:undo', handleUndo);
        return () => window.removeEventListener('eznr:undo', handleUndo);
    }, []);

    useEffect(() => {
        setMounted(true);
        if (!loading) {
            initializeData();
            if (!isAuthenticated) {
                router.push('/');
            }
        }
    }, [loading, isAuthenticated, router]);

    const handleMobileToggle = useCallback(() => {
        setMobileOpen(prev => !prev);
    }, []);

    const handleDesktopToggle = useCallback(() => {
        setSidebarCollapsed(prev => !prev);
    }, []);

    if (!mounted || loading) {
        return (
            <div style={{
                height: '100vh',
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

    if (isMobile) {
        return (
            <MobileLayout>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <NavigationGuardProvider key={undoKey}>
                    {children}
                </NavigationGuardProvider>
                <UndoBar />
                <AIAssistant />
            </MobileLayout>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={handleDesktopToggle}
                isMobile={false}
                mobileOpen={false}
                onMobileClose={() => {}}
            />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                isMobile={false}
                onMobileMenuToggle={handleDesktopToggle}
            />
            <main style={{
                marginLeft: mainMarginLeft,
                marginTop: 'var(--header-height)',
                padding: 24,
                paddingBottom: 96,
                transition: 'margin-left var(--transition-normal)',
                minHeight: 'calc(100vh - var(--header-height))',
            }}>
                <NavigationGuardProvider key={undoKey}>
                    {children}
                </NavigationGuardProvider>
            </main>
            <UndoBar />
            <AIAssistant />
        </div>
    );
}
