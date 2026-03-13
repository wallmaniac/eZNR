'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAll, create, COLLECTIONS, getOrgUnitName, formatDate, getUserCompanies, getRawAll, seedCompanyData } from '@/lib/dataStore';
import { getHeaderNotifications, dismissNotification, APP_VERSION } from '@/lib/systemMonitor';
import { useTheme } from '@/contexts/ThemeContext';

export default function Header({ sidebarCollapsed }) {
    const { t, lang, toggleLang } = useLanguage();
    const { user, logout, isAdmin, activeCompanyId, switchCompany } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [showCompanyMenu, setShowCompanyMenu] = useState(false);
    const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
    const [switchingCompany, setSwitchingCompany] = useState(false);
    const [newCompanyData, setNewCompanyData] = useState({ naziv: '', adresa: '', mjesto: '', telefon: '', email: '' });
    const profileRef = useRef(null);
    const notifRef = useRef(null);
    const searchRef = useRef(null);
    const companyRef = useRef(null);

    const companies = useMemo(() => {
        if (!user?.id) return [];
        if (isAdmin) {
            const { getAllCompanies } = require('@/lib/dataStore');
            return getAllCompanies();
        }
        return getUserCompanies(user.id);
    }, [user?.id, activeCompanyId, isAdmin]);

    const activeCompany = companies.find(c => c.id === activeCompanyId);

    useEffect(() => {
        const handleClick = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
            if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
            if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false);
            if (companyRef.current && !companyRef.current.contains(e.target)) setShowCompanyMenu(false);
        };
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const input = searchRef.current?.querySelector('input');
                if (input) { input.focus(); setSearchFocused(true); }
            }
            if (e.key === 'Escape' && searchFocused) {
                setSearchFocused(false); setSearchTerm('');
                searchRef.current?.querySelector('input')?.blur();
            }
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKeyDown); };
    }, [searchFocused]);

    const searchResults = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const term = searchTerm.toLowerCase();
        const results = [];
        getAll(COLLECTIONS.WORKERS).forEach(w => {
            if (`${w.ime} ${w.prezime} ${w.jmbg || ''}`.toLowerCase().includes(term))
                results.push({ type: 'worker', icon: '👷', label: `${w.ime} ${w.prezime}`, sub: getOrgUnitName(w.orgJedinicaId), path: '/dashboard/workers', id: w.id });
        });
        getAll(COLLECTIONS.EQUIPMENT).forEach(e => {
            if (`${e.naziv} ${e.tvBroj || ''} ${e.invBroj || ''}`.toLowerCase().includes(term))
                results.push({ type: 'equipment', icon: '⚙️', label: e.naziv, sub: e.tvBroj || '', path: '/dashboard/equipment', id: e.id });
        });
        getAll(COLLECTIONS.WORKPLACES).forEach(wp => {
            if (wp.naziv.toLowerCase().includes(term))
                results.push({ type: 'workplace', icon: '🔧', label: wp.naziv, sub: wp.oznaka || '', path: '/dashboard/workplaces', id: wp.id });
        });
        getAll(COLLECTIONS.ORG_UNITS).forEach(ou => {
            if (ou.naziv.toLowerCase().includes(term))
                results.push({ type: 'orgUnit', icon: '🏢', label: ou.naziv, sub: ou.skraceniNaziv || '', path: '/dashboard/org-units', id: ou.id });
        });
        return results.slice(0, 8);
    }, [searchTerm]);

    const notifications = useMemo(() => {
        const { notifications: notifs } = getHeaderNotifications(isAdmin, activeCompanyId, user?.companyIds || []);
        return notifs.map(n => ({ ...n, icon: n.icon, text: n.text || n.title, detail: n.detail || n.message, date: '', path: n.path || n.actionUrl || '/dashboard', severity: n.severity, id: n.id, actionLabel: n.actionLabel, companyName: n.companyName }));
    }, [isAdmin, activeCompanyId, user?.companyIds]);

    const handleSearchNav = (result) => {
        setSearchTerm(''); setSearchFocused(false);
        if (result.type === 'worker') router.push(`/dashboard/workers?openWorker=${result.id}`);
        else if (result.type === 'equipment') router.push(`/dashboard/equipment?openItem=${result.id}`);
        else router.push(result.path);
    };
    const handleProfileNav = (path) => { setShowProfile(false); router.push(path); };
    const handleNotifNav = (path) => { setShowNotifs(false); router.push(path); };
    const handleLogout = () => { setShowProfile(false); logout(); router.push('/'); };

    const handleCreateCompany = () => {
        if (!newCompanyData.naziv.trim()) return;
        const newComp = create(COLLECTIONS.COMPANIES, { ...newCompanyData, skraceniNaziv: newCompanyData.naziv, aktivan: true });
        const { update } = require('@/lib/dataStore');
        if (user?.id) {
            const currentUser = getRawAll(COLLECTIONS.USERS).find(u => u.id === user.id);
            if (currentUser) {
                const updatedIds = [...(currentUser.companyIds || []), newComp.id];
                update(COLLECTIONS.USERS, user.id, { companyIds: updatedIds });
                try { const p = JSON.parse(localStorage.getItem('eznr_user')); p.companyIds = updatedIds; localStorage.setItem('eznr_user', JSON.stringify(p)); } catch(e) {}
            }
        }
        const sourceId = (user?.companyIds || [])[0];
        if (sourceId) seedCompanyData(newComp.id, sourceId);
        switchCompany(newComp.id);
        setShowNewCompanyModal(false);
        setNewCompanyData({ naziv: '', adresa: '', mjesto: '', telefon: '', email: '' });
        window.location.reload();
    };

    const roleBadge = isAdmin
        ? { label: 'Admin', bg: 'linear-gradient(135deg, #7B1FA2, #E040FB)', color: 'white' }
        : { label: lang === 'bs' ? 'Stručnjak ZNR' : 'Safety Officer', bg: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white' };

    /* ─── Shared micro-styles ─── */
    const island = {
        display: 'flex', alignItems: 'center', gap: 2,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 100,
        padding: '4px 6px',
        flexShrink: 0,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)',
    };
    const iBtn = (extra = {}) => ({
        width: 34, height: 34, borderRadius: 34, border: 'none',
        background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1rem', color: 'var(--text-muted)',
        transition: 'background 0.15s, color 0.15s',
        flexShrink: 0, padding: 0, ...extra,
    });
    const sep = <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />;

    // Navigate back — useSearchParams is reactive and always reflects current URL in Next.js App Router
    const handleBack = () => {
        const rt = searchParams?.get('returnTo');
        if (rt) { router.push(rt); return; }
        router.back();
    };

    return (
        <>
            {/* ════════════════════════════════════════
                THREE-ISLAND FLOATING HEADER
            ════════════════════════════════════════ */}
            <header style={{
                position: 'fixed', top: 0, right: 0, zIndex: 90,
                height: 'var(--header-height)',
                left: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
                transition: 'left var(--transition-normal)',
                display: 'flex', alignItems: 'center',
                gap: 10, padding: '0 16px',
                background: 'var(--bg-header, var(--bg-page))',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid var(--border-light)',
            }}>

                {/* ══ LEFT ISLAND: Navigation + Company ══ */}
                <div style={{ ...island, boxShadow: '0 2px 14px rgba(0,191,166,0.12), 0 1px 3px rgba(0,0,0,0.07)' }}>
                    {/* Back — respects returnTo param if present */}
                    <button title={lang === 'bs' ? 'Nazad' : 'Back'} onClick={handleBack}
                        style={iBtn()}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        ←
                    </button>
                    {/* Forward */}
                    <button title={lang === 'bs' ? 'Naprijed' : 'Forward'} onClick={() => router.forward()}
                        style={iBtn()}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        →
                    </button>

                    {sep}

                    {/* Company chip */}
                    <div ref={companyRef} style={{ position: 'relative' }}>
                        <button onClick={() => { setShowCompanyMenu(v => !v); setShowProfile(false); setShowNotifs(false); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '5px 12px 5px 7px', borderRadius: 100, border: 'none',
                                background: activeCompanyId === 'all'
                                    ? 'linear-gradient(135deg, #455A64 0%, #263238 100%)'
                                    : 'linear-gradient(135deg, var(--primary) 0%, #009985 100%)',
                                cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: activeCompanyId === 'all' ? '0 2px 10px rgba(70,90,100,0.3)' : '0 2px 10px rgba(0,191,166,0.3)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = activeCompanyId === 'all' ? '0 5px 18px rgba(70,90,100,0.45)' : '0 5px 18px rgba(0,191,166,0.45)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = activeCompanyId === 'all' ? '0 2px 10px rgba(70,90,100,0.3)' : '0 2px 10px rgba(0,191,166,0.3)'; }}>
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>🏢</span>
                            <div>
                                <div style={{ fontSize: '0.58rem', fontWeight: 600, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.3px', lineHeight: 1, marginBottom: 1 }}>
                                    {lang === 'bs' ? 'Aktivna firma' : 'Active company'}
                                </div>
                                <div style={{ fontSize: '0.79rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                                    {activeCompanyId === 'all' ? (lang === 'bs' ? 'Sve firme' : 'All companies') : (activeCompany?.skraceniNaziv || activeCompany?.naziv || (lang === 'bs' ? 'Odaberi' : 'Select'))}
                                </div>
                            </div>
                            <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.75)', flexShrink: 0 }}>▼</span>
                        </button>

                        {showCompanyMenu && (
                            <div className="dropdown-menu" style={{ top: 'calc(100% + 8px)', left: 0, minWidth: 280, zIndex: 200 }}>
                                <div style={{ padding: '10px 16px', fontWeight: 700, fontSize: '0.8rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    🏢 {lang === 'bs' ? 'Moje firme' : 'My companies'}
                                </div>
                                <button className="dropdown-item" onClick={() => { switchCompany('all'); setShowCompanyMenu(false); window.location.reload(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: activeCompanyId === 'all' ? 'rgba(0,191,166,0.08)' : undefined, fontWeight: activeCompanyId === 'all' ? 700 : 400 }}>
                                    <span>{activeCompanyId === 'all' ? '✅' : '🌐'}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lang === 'bs' ? 'Sve firme' : 'All companies'}</div>
                                    </div>
                                </button>
                                <div className="dropdown-divider" />
                                {companies.map(c => (
                                    <button key={c.id} className="dropdown-item" onClick={() => { switchCompany(c.id); setShowCompanyMenu(false); window.location.reload(); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: c.id === activeCompanyId ? 'rgba(0,191,166,0.08)' : undefined, fontWeight: c.id === activeCompanyId ? 700 : 400 }}>
                                        <span>{c.id === activeCompanyId ? '✅' : '🏛️'}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.naziv}</div>
                                            {c.mjesto && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.mjesto}</div>}
                                        </div>
                                    </button>
                                ))}
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" onClick={() => { setShowCompanyMenu(false); setShowNewCompanyModal(true); }} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                    ➕ {lang === 'bs' ? 'Dodaj novu firmu' : 'Add new company'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ══ CENTER ISLAND: Search ══ */}
                <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--bg-card)',
                        border: `1.5px solid ${searchFocused ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 100, padding: '0 16px', height: 42,
                        boxShadow: searchFocused ? '0 0 0 4px var(--primary-glow), 0 2px 12px rgba(0,0,0,0.07)' : '0 2px 12px rgba(0,0,0,0.06)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}>
                        <span style={{ fontSize: '0.88rem', flexShrink: 0, opacity: 0.45 }}>🔍</span>
                        <input
                            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.88rem', color: 'var(--text)', fontFamily: 'var(--font-body)', flex: 1, minWidth: 0 }}
                            placeholder={t('searchPlaceholder')}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                        />
                        {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 }}>✕</button>}
                        {!searchFocused && !searchTerm && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0, whiteSpace: 'nowrap', opacity: 0.7 }}>Ctrl K</span>
                        )}
                    </div>

                    {searchFocused && searchTerm.length >= 2 && (
                        <div className="search-dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 30px rgba(11,42,60,0.15)', border: '1px solid var(--border)', zIndex: 200, overflow: 'hidden' }}>
                            {searchResults.length === 0 ? (
                                <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>{lang === 'bs' ? 'Nema rezultata' : 'No results'}</div>
                            ) : (
                                <>
                                    <div style={{ padding: '8px 16px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {lang === 'bs' ? 'Rezultati pretrage' : 'Search results'} ({searchResults.length})
                                    </div>
                                    {searchResults.map((r, idx) => (
                                        <button key={idx} onClick={() => handleSearchNav(r)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{r.label}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 10, background: 'var(--bg-badge)', color: 'var(--primary-dark)', fontWeight: 600 }}>
                                                {r.type === 'worker' ? (lang === 'bs' ? 'Radnik' : 'Worker') : r.type === 'equipment' ? (lang === 'bs' ? 'Oprema' : 'Equipment') : r.type === 'workplace' ? (lang === 'bs' ? 'Radno mj.' : 'Workplace') : lang === 'bs' ? 'Org. jed.' : 'Org. unit'}
                                            </span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ══ RIGHT ISLAND: Lang + Theme | Notifs + Profile ══ */}
                <div style={island}>
                    {/* Language */}
                    <button onClick={toggleLang} title={lang === 'bs' ? 'Switch to English' : 'Prebaci na Bosanski'}
                        style={iBtn({ padding: '0 10px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.4px', width: 'auto', gap: 5, minWidth: 50 })}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                        🌐 {lang === 'bs' ? 'EN' : 'BS'}
                    </button>

                    {/* Light/Dark pill toggle */}
                    <button onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}
                        style={{
                            position: 'relative', width: 50, height: 26, borderRadius: 13,
                            border: isDark ? '1.5px solid rgba(100,160,220,0.3)' : '1.5px solid rgba(255,180,0,0.3)',
                            cursor: 'pointer', padding: 0, flexShrink: 0, margin: '0 3px',
                            background: isDark ? 'linear-gradient(135deg,#1b3d5e,#0c1d30)' : 'linear-gradient(135deg,#a8d8ea,#FFC947)',
                            transition: 'background 0.4s, border-color 0.4s',
                        }}>
                        <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: isDark ? 4 : 'auto', right: isDark ? 'auto' : 4, fontSize: '0.48rem', opacity: 0.55, pointerEvents: 'none' }}>{isDark ? '✨' : '☀️'}</span>
                        <span style={{ position: 'absolute', top: 2, left: isDark ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: isDark ? 'radial-gradient(circle at 35% 35%,#d0e8ff,#a8c8f0)' : 'radial-gradient(circle at 35% 35%,#fff,#ffe780)', boxShadow: isDark ? '0 2px 4px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                            {isDark ? '🌙' : '☀️'}
                        </span>
                    </button>

                    {sep}

                    {/* Notifications */}
                    <div ref={notifRef} style={{ position: 'relative' }}>
                        <button onClick={() => { setShowNotifs(v => !v); setShowProfile(false); }}
                            style={iBtn({ position: 'relative' })}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.07)'; e.currentTarget.style.color = '#ef4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                            🔔
                            {notifications.length > 0 && (
                                <span style={{ position: 'absolute', top: 3, right: 3, width: 15, height: 15, borderRadius: '50%', background: notifications.some(n => n.severity === 'critical' || n.severity === 'urgent') ? '#EF4444' : '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.5rem', color: 'white', fontWeight: 700, border: '1.5px solid var(--bg-card)' }}>
                                    {notifications.length}
                                </span>
                            )}
                        </button>

                        {showNotifs && (
                            <div className="dropdown-menu" style={{ top: 'calc(100% + 8px)', right: 0, left: 'auto', minWidth: 380, maxHeight: 500, overflowY: 'auto' }}>
                                <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.85rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>🔔 {lang === 'bs' ? 'Obavijesti' : 'Notifications'} ({notifications.length})</span>
                                    {isAdmin && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>v{APP_VERSION}</span>}
                                </div>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>✅ {lang === 'bs' ? 'Sve je u redu!' : 'All good!'}</div>
                                ) : notifications.map((n, idx) => {
                                    const sc = {
                                        critical: { bg: 'rgba(239,68,68,0.10)', border: '#EF4444', titleColor: 'var(--danger)' },
                                        urgent: { bg: 'rgba(249,115,22,0.10)', border: '#F97316', titleColor: 'var(--warning)' },
                                        warning: { bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', titleColor: 'var(--warning)' },
                                        info: { bg: 'rgba(34,197,94,0.10)', border: '#22C55E', titleColor: 'var(--success)' },
                                    };
                                    const c = sc[n.severity] || sc.info;
                                    return (
                                        <div key={n.id || idx} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', background: c.bg, borderLeft: `3px solid ${c.border}` }}>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                                <span style={{ fontSize: '1.1rem' }}>{n.icon}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: c.titleColor }}>{n.text}</div>
                                                        {n.companyName && <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>🏢 {n.companyName}</span>}
                                                    </div>
                                                    {n.detail && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: 3 }}>{n.detail}</div>}
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                                        {n.actionLabel && <button onClick={() => handleNotifNav(n.path)} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, border: `1px solid ${c.border}`, background: c.border, color: 'white', fontWeight: 700, cursor: 'pointer' }}>{n.actionLabel}</button>}
                                                        {n.id && isAdmin && <button onClick={e => { e.stopPropagation(); dismissNotification(n.id); setShowNotifs(false); setTimeout(() => setShowNotifs(true), 50); }} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>✕ {lang === 'bs' ? 'Odbaci' : 'Dismiss'}</button>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {sep}

                    {/* Profile */}
                    <div ref={profileRef} style={{ position: 'relative' }}>
                        <button onClick={() => { setShowProfile(v => !v); setShowNotifs(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 8px 3px 3px', borderRadius: 100, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            {/* Avatar */}
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                                {user?.firstName?.[0] || 'K'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.25 }}>{user?.firstName} {user?.lastName}</span>
                                <span style={{ fontSize: '0.56rem', fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: roleBadge.bg, color: roleBadge.color, lineHeight: 1.5 }}>{roleBadge.label}</span>
                            </div>
                            <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>▼</span>
                        </button>

                        {showProfile && (
                            <div className="dropdown-menu" style={{ top: 'calc(100% + 8px)', right: 0 }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{user?.firstName} {user?.lastName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeCompany?.naziv || ''}</div>
                                    <span style={{ display: 'inline-block', marginTop: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: roleBadge.bg, color: roleBadge.color }}>{roleBadge.label}</span>
                                </div>
                                <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=profile')}>👤 {t('profile')}</button>
                                <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=company')}>🏢 {t('company')}</button>
                                <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=app')}>⚙️ {t('settings')}</button>
                                {isAdmin && (<><div className="dropdown-divider" /><button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/admin/users')} style={{ color: '#7B1FA2', fontWeight: 600 }}>👑 {lang === 'bs' ? 'Administracija' : 'Admin Panel'}</button></>)}
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>🚪 {t('logout')}</button>
                            </div>
                        )}
                    </div>
                </div>

            </header>

            {/* ── New Company Modal ── */}
            {showNewCompanyModal && (
                <div className="modal-overlay" onClick={() => setShowNewCompanyModal(false)} style={{ zIndex: 300 }}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                            <h2 style={{ color: 'white' }}>🏢 {lang === 'bs' ? 'Nova firma' : 'New Company'}</h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowNewCompanyModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">{lang === 'bs' ? 'Naziv firme' : 'Company name'} *</label>
                                <input className="form-input" value={newCompanyData.naziv} onChange={e => setNewCompanyData(p => ({ ...p, naziv: e.target.value }))} placeholder="ABC d.o.o." required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Adresa' : 'Address'}</label><input className="form-input" value={newCompanyData.adresa} onChange={e => setNewCompanyData(p => ({ ...p, adresa: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Mjesto' : 'City'}</label><input className="form-input" value={newCompanyData.mjesto} onChange={e => setNewCompanyData(p => ({ ...p, mjesto: e.target.value }))} /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Telefon' : 'Phone'}</label><input className="form-input" value={newCompanyData.telefon} onChange={e => setNewCompanyData(p => ({ ...p, telefon: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={newCompanyData.email} onChange={e => setNewCompanyData(p => ({ ...p, email: e.target.value }))} /></div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowNewCompanyModal(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleCreateCompany} disabled={!newCompanyData.naziv.trim()}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
