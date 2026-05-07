'use client';
import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import MobileSearchOverlay from './MobileSearchOverlay';

/**
 * MobileBottomNav — 5-tab bottom navigation for mobile.
 * Tabs: Dashboard, Workers, Certificates, Search, Menu (drawer)
 */
export default function MobileBottomNav({ onMenuOpen }) {
    const router = useRouter();
    const pathname = usePathname();
    const { lang } = useLanguage();
    const [searchOpen, setSearchOpen] = useState(false);

    const tabs = [
        { key: 'dashboard', icon: '📊', label: lang !== 'en' ? 'Početna' : 'Home', path: '/dashboard' },
        { key: 'workers', icon: '👷', label: lang !== 'en' ? 'Radnici' : 'Workers', path: '/dashboard/workers' },
        { key: 'certs', icon: '📜', label: lang !== 'en' ? 'Uvjerenja' : 'Certs', path: '/dashboard/worker-certificates' },
        { key: 'search', icon: '🔍', label: lang !== 'en' ? 'Pretraži' : 'Search', action: 'search' },
        { key: 'menu', icon: '☰', label: lang !== 'en' ? 'Meni' : 'Menu', action: 'menu' },
    ];

    const isActive = useCallback((path) => {
        if (!path) return false;
        if (path === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(path);
    }, [pathname]);

    const handleTap = (tab) => {
        if (tab.action === 'search') {
            setSearchOpen(prev => !prev); // toggle search
        } else if (tab.action === 'menu') {
            setSearchOpen(false); // close search when opening menu
            onMenuOpen?.();
        } else {
            setSearchOpen(false); // close search on navigation
            router.push(tab.path);
        }
    };

    return (
        <>
            <nav style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                minHeight: 56,
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
                zIndex: 400,
                display: 'flex',
                alignItems: 'stretch',
                background: 'var(--bg-card)',
                borderTop: '1px solid var(--border-light)',
                boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
                backdropFilter: 'blur(20px)',
            }}>
                {tabs.map(tab => {
                    const active = tab.action === 'search' ? searchOpen : isActive(tab.path);
                    return (
                        <button
                            key={tab.key}
                            aria-label={tab.label}
                            onClick={() => handleTap(tab)}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 2,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '4px 0',
                                position: 'relative',
                                color: active ? 'var(--primary)' : 'var(--text-muted)',
                                transition: 'color 0.15s',
                            }}
                        >
                            {/* Active indicator dot */}
                            {active && (
                                <div style={{
                                    position: 'absolute', top: 2,
                                    width: 4, height: 4, borderRadius: 2,
                                    background: 'var(--primary)',
                                }} />
                            )}
                            <span style={{
                                fontSize: tab.key === 'menu' ? '1.2rem' : '1.1rem',
                                lineHeight: 1,
                                filter: active ? 'none' : 'grayscale(0.5)',
                                transition: 'filter 0.15s',
                            }}>{tab.icon}</span>
                            <span style={{
                                fontSize: '0.6rem',
                                fontWeight: active ? 700 : 500,
                                fontFamily: 'var(--font-heading)',
                                letterSpacing: '0.02em',
                            }}>{tab.label}</span>
                        </button>
                    );
                })}
            </nav>

            <MobileSearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
