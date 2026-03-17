'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AIAssistant from '@/components/AIAssistant';
import { initializeData } from '@/lib/dataStore';
import { NavigationGuardProvider } from '@/contexts/NavigationGuardContext';
import UndoBar from '@/components/UndoBar';

export default function DashboardLayout({ children }) {
    const { isAuthenticated, loading } = useAuth();
    const router = useRouter();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!loading) {
            initializeData();
            if (!isAuthenticated) {
                router.push('/');
            }
        }
    }, [loading, isAuthenticated, router]);

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

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <Header sidebarCollapsed={sidebarCollapsed} />
            <main style={{
                marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
                marginTop: 'var(--header-height)',
                padding: 24,
                paddingBottom: 96, // clearance for Zia FAB (72px bubble + 24px from bottom edge)
                transition: 'margin-left var(--transition-normal)',
                minHeight: 'calc(100vh - var(--header-height))',
            }}>
                <NavigationGuardProvider>
                    {children}
                </NavigationGuardProvider>
            </main>
            <UndoBar />
            <AIAssistant />
        </div>
    );
}
