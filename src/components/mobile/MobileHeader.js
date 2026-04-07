'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { getHeaderNotifications, dismissNotification, APP_VERSION } from '@/lib/systemMonitor';

export default function MobileHeader() {
    const { t, lang } = useLanguage();
    const { user, isAdmin, activeCompanyId } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [showNotifs, setShowNotifs] = useState(false);
    const notifRef = useRef(null);

    // Close notifs clicking outside
    useEffect(() => {
        const handleClick = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const notifications = useMemo(() => {
        const { notifications: notifs } = getHeaderNotifications(isAdmin, activeCompanyId, user?.companyIds || []);
        return notifs.map(n => ({ ...n, icon: n.icon, text: n.text || n.title, detail: n.detail || n.message, path: n.path || n.actionUrl || '/dashboard', severity: n.severity, id: n.id, actionLabel: n.actionLabel, companyName: n.companyName }));
    }, [isAdmin, activeCompanyId, user?.companyIds]);

    const handleNotifNav = (path) => { setShowNotifs(false); router.push(path); };

    // Determine current page context title based on pathname
    const getPageTitle = () => {
        if (pathname === '/dashboard') return lang === 'bs' ? 'Početna' : 'Home';
        if (pathname.includes('/workers')) return lang === 'bs' ? 'Radnici' : 'Workers';
        if (pathname.includes('/equipment')) return lang === 'bs' ? 'Oprema' : 'Equipment';
        if (pathname.includes('/employer-docs')) return lang === 'bs' ? 'Dokumenti' : 'Documents';
        if (pathname.includes('/settings')) return lang === 'bs' ? 'Postavke' : 'Settings';
        
        // Simple fallback parsing for other routes
        const parts = pathname.split('/');
        if (parts.length > 2) {
            let p = parts[2].replace(/-/g, ' ');
            return p.charAt(0).toUpperCase() + p.slice(1);
        }
        return 'eZNR';
    };

    const iBtn = {
        width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border)',
        background: 'var(--bg-card)', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, cursor: 'pointer', flexShrink: 0,
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
    };

    return (
        <header style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', background: 'var(--bg-header, var(--bg-page))',
            backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-light)'
        }}>
            <button onClick={() => router.back()} style={{ ...iBtn, fontSize: '0.9rem' }}>
                ←
            </button>

            <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>
                {getPageTitle()}
            </div>

            <div ref={notifRef} style={{ position: 'static' }}>
                <button onClick={() => setShowNotifs(v => !v)} style={{ ...iBtn }}>
                    🔔
                    {notifications.length > 0 && (
                        <span style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.45rem', color: 'white', fontWeight: 700, border: '1.5px solid var(--bg-card)' }}>
                            {notifications.length > 9 ? '9+' : notifications.length}
                        </span>
                    )}
                </button>
                {showNotifs && (
                    <div className="dropdown-menu" style={{ position: 'fixed', top: 60, left: 10, right: 10, minWidth: 'auto', width: 'auto', zIndex: 400, maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.82rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>🔔 {lang === 'bs' ? 'Obavijesti' : 'Notifications'} ({notifications.length})</span>
                            {isAdmin && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>v{APP_VERSION}</span>}
                        </div>
                        {notifications.length === 0 ? (
                            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>✅ {lang === 'bs' ? 'Sve je u redu!' : 'All good!'}</div>
                        ) : notifications.map((n, idx) => {
                            const sc = { critical: { bg: 'rgba(239,68,68,0.10)', border: '#EF4444', titleColor: 'var(--danger)' }, urgent: { bg: 'rgba(249,115,22,0.10)', border: '#F97316', titleColor: 'var(--warning)' }, warning: { bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', titleColor: 'var(--warning)' }, info: { bg: 'rgba(34,197,94,0.10)', border: '#22C55E', titleColor: 'var(--success)' } };
                            const c = sc[n.severity] || sc.info;
                            return (
                                <div key={n.id || idx} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-light)', background: c.bg, borderLeft: `3px solid ${c.border}` }}>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span style={{ fontSize: '1rem' }}>{n.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: c.titleColor }}>{n.text}</div>
                                            {n.detail && <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: 2 }}>{n.detail}</div>}
                                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                                {n.actionLabel && <button onClick={() => handleNotifNav(n.path)} style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 4, border: `1px solid ${c.border}`, background: c.border, color: 'white', fontWeight: 700, cursor: 'pointer' }}>{n.actionLabel}</button>}
                                                {n.id && <button onClick={e => { e.stopPropagation(); dismissNotification(n.id); setShowNotifs(false); setTimeout(() => setShowNotifs(true), 50); }} style={{ fontSize: '0.62rem', padding: '2px 5px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </header>
    );
}
