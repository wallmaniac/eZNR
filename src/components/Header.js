'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getAll, create, COLLECTIONS, getOrgUnitName, formatDate, getUserCompanies } from '@/lib/dataStore';

export default function Header({ sidebarCollapsed }) {
    const { t, lang, toggleLang } = useLanguage();
    const { user, logout, isAdmin, activeCompanyId, switchCompany } = useAuth();
    const router = useRouter();
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [showCompanyMenu, setShowCompanyMenu] = useState(false);
    const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
    const [newCompanyData, setNewCompanyData] = useState({ naziv: '', adresa: '', mjesto: '', telefon: '', email: '' });
    const profileRef = useRef(null);
    const notifRef = useRef(null);
    const searchRef = useRef(null);
    const companyRef = useRef(null);

    // Admin sees ALL companies; officers only see assigned ones
    const companies = useMemo(() => {
        if (!user?.id) return [];
        if (isAdmin) {
            // Import getAllCompanies for admin
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
            if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchFocused(false); }
            if (companyRef.current && !companyRef.current.contains(e.target)) setShowCompanyMenu(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Global search across all collections
    const searchResults = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const term = searchTerm.toLowerCase();
        const results = [];

        const workers = getAll(COLLECTIONS.WORKERS);
        workers.forEach(w => {
            const full = `${w.ime} ${w.prezime} ${w.jmbg || ''}`.toLowerCase();
            if (full.includes(term)) {
                results.push({ type: 'worker', icon: '👷', label: `${w.ime} ${w.prezime}`, sub: getOrgUnitName(w.orgJedinicaId), path: '/dashboard/workers', id: w.id });
            }
        });
        const equipment = getAll(COLLECTIONS.EQUIPMENT);
        equipment.forEach(e => {
            const full = `${e.naziv} ${e.tvBroj || ''} ${e.invBroj || ''}`.toLowerCase();
            if (full.includes(term)) {
                results.push({ type: 'equipment', icon: '⚙️', label: e.naziv, sub: e.tvBroj || '', path: '/dashboard/equipment', id: e.id });
            }
        });
        const workplaces = getAll(COLLECTIONS.WORKPLACES);
        workplaces.forEach(wp => {
            if (wp.naziv.toLowerCase().includes(term)) {
                results.push({ type: 'workplace', icon: '🔧', label: wp.naziv, sub: wp.oznaka || '', path: '/dashboard/workplaces', id: wp.id });
            }
        });
        const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
        orgUnits.forEach(ou => {
            if (ou.naziv.toLowerCase().includes(term)) {
                results.push({ type: 'orgUnit', icon: '🏢', label: ou.naziv, sub: ou.skraceniNaziv || '', path: '/dashboard/org-units', id: ou.id });
            }
        });
        return results.slice(0, 8);
    }, [searchTerm]);

    // Notifications
    const notifications = useMemo(() => {
        const notifs = [];
        const events = getAll(COLLECTIONS.CALENDAR_EVENTS);
        events.forEach(ev => {
            notifs.push({
                icon: ev.tip === 'cert' ? '📜' : ev.tip === 'ppe' ? '🦺' : ev.tip === 'equip' ? '⚙️' : '📅',
                text: ev.tip === 'cert' ? `${lang === 'bs' ? 'Uvjerenja' : 'Certificates'} (${ev.count})` :
                    ev.tip === 'ppe' ? `${lang === 'bs' ? 'Zaštitna sredstva' : 'PPE'} (${ev.count})` :
                        ev.opis || ev.tip,
                date: formatDate(ev.datum),
                path: ev.tip === 'cert' ? '/dashboard/worker-certificates' : ev.tip === 'ppe' ? '/dashboard/worker-ppe' : '/dashboard',
            });
        });
        const certs = getAll(COLLECTIONS.CERTIFICATES);
        certs.forEach(c => {
            if (c.vrijediDo) {
                const exp = new Date(c.vrijediDo);
                const diff = (exp - new Date()) / (1000 * 60 * 60 * 24);
                if (diff >= 0 && diff <= 60) {
                    notifs.push({ icon: '⚠️', text: `${c.naziv} - ${lang === 'bs' ? 'ističe' : 'expires'} ${formatDate(c.vrijediDo)}`, date: formatDate(c.vrijediDo), path: '/dashboard/worker-certificates' });
                }
            }
        });
        return notifs.slice(0, 10);
    }, [lang]);

    const handleSearchNav = (result) => { setSearchTerm(''); setSearchFocused(false); router.push(result.path); };
    const handleProfileNav = (path) => { setShowProfile(false); router.push(path); };
    const handleNotifNav = (path) => { setShowNotifs(false); router.push(path); };
    const handleLogout = () => { setShowProfile(false); logout(); router.push('/'); };

    const handleCreateCompany = () => {
        if (!newCompanyData.naziv.trim()) return;
        const newComp = create(COLLECTIONS.COMPANIES, {
            ...newCompanyData,
            skraceniNaziv: newCompanyData.naziv,
            aktivan: true,
        });
        // Add company to user's companyIds
        const { update } = require('@/lib/dataStore');
        if (user?.id) {
            const currentUser = getAll(COLLECTIONS.USERS).find(u => u.id === user.id);
            if (currentUser) {
                update(COLLECTIONS.USERS, user.id, { companyIds: [...(currentUser.companyIds || []), newComp.id] });
            }
        }
        switchCompany(newComp.id);
        setShowNewCompanyModal(false);
        setNewCompanyData({ naziv: '', adresa: '', mjesto: '', telefon: '', email: '' });
        // Force re-render
        window.location.reload();
    };

    const roleBadge = isAdmin
        ? { label: 'Admin', bg: 'linear-gradient(135deg, #7B1FA2, #E040FB)', color: 'white' }
        : { label: lang === 'bs' ? 'Stručnjak ZNR' : 'Safety Officer', bg: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white' };

    return (
        <>
            <header style={{
                ...headerStyles.header,
                left: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
            }}>
                {/* Search */}
                <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                    <div style={{
                        ...headerStyles.searchContainer,
                        ...(searchFocused ? headerStyles.searchFocused : {}),
                    }}>
                        <span style={headerStyles.searchIcon}>🔍</span>
                        <input
                            style={headerStyles.searchInput}
                            placeholder={t('searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}>✕</button>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {searchFocused && searchTerm.length >= 2 && (
                        <div style={headerStyles.searchDropdown}>
                            {searchResults.length === 0 ? (
                                <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                    {lang === 'bs' ? 'Nema rezultata' : 'No results'}
                                </div>
                            ) : (
                                <>
                                    <div style={{ padding: '8px 16px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {lang === 'bs' ? 'Rezultati pretrage' : 'Search results'} ({searchResults.length})
                                    </div>
                                    {searchResults.map((r, idx) => (
                                        <button key={idx} onClick={() => handleSearchNav(r)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s', borderRadius: 6 }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{r.label}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 10, background: 'var(--bg-badge)', color: 'var(--primary-dark)', fontWeight: 600 }}>
                                                {r.type === 'worker' ? (lang === 'bs' ? 'Radnik' : 'Worker') :
                                                    r.type === 'equipment' ? (lang === 'bs' ? 'Oprema' : 'Equipment') :
                                                        r.type === 'workplace' ? (lang === 'bs' ? 'Radno mj.' : 'Workplace') :
                                                            lang === 'bs' ? 'Org. jed.' : 'Org. unit'}
                                            </span>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Company Switcher ── */}
                <div ref={companyRef} style={{ position: 'relative', marginLeft: 12 }}>
                    <button
                        onClick={() => { setShowCompanyMenu(!showCompanyMenu); setShowProfile(false); setShowNotifs(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 14px', borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border)', background: 'var(--bg-input)',
                            cursor: 'pointer', transition: 'all 0.2s', maxWidth: 220,
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                        <span style={{ fontSize: '1rem' }}>🏢</span>
                        <span style={{
                            fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)',
                            fontFamily: 'var(--font-heading)', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {activeCompany?.skraceniNaziv || activeCompany?.naziv || (lang === 'bs' ? 'Odaberi firmu' : 'Select company')}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>▼</span>
                    </button>

                    {showCompanyMenu && (
                        <div className="dropdown-menu" style={{ top: 'calc(100% + 8px)', left: 0, minWidth: 280, zIndex: 200 }}>
                            <div style={{ padding: '10px 16px', fontWeight: 700, fontFamily: 'var(--font-heading)', fontSize: '0.8rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                🏢 {lang === 'bs' ? 'Moje firme' : 'My companies'}
                            </div>
                            {companies.map(c => (
                                <button key={c.id} className="dropdown-item"
                                    onClick={() => { switchCompany(c.id); setShowCompanyMenu(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                                        background: c.id === activeCompanyId ? 'rgba(0,191,166,0.08)' : undefined,
                                        fontWeight: c.id === activeCompanyId ? 700 : 400,
                                    }}>
                                    <span style={{ fontSize: '1.1rem' }}>{c.id === activeCompanyId ? '✅' : '🏛️'}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.naziv}</div>
                                        {c.mjesto && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.mjesto}</div>}
                                    </div>
                                </button>
                            ))}
                            <div className="dropdown-divider" />
                            <button className="dropdown-item" onClick={() => { setShowCompanyMenu(false); setShowNewCompanyModal(true); }}
                                style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                ➕ {lang === 'bs' ? 'Dodaj novu firmu' : 'Add new company'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Right side */}
                <div style={headerStyles.rightSide}>
                    {/* Language toggle */}
                    <button onClick={toggleLang} style={headerStyles.langBtn}>
                        🌐 {lang === 'bs' ? 'EN' : 'BS'}
                    </button>

                    {/* Notifications */}
                    <div ref={notifRef} style={{ position: 'relative' }}>
                        <button onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }} style={headerStyles.iconBtn}>
                            🔔
                            {notifications.length > 0 && <span style={headerStyles.notifDot} />}
                        </button>

                        {showNotifs && (
                            <div className="dropdown-menu" style={{ top: 'calc(100% + 8px)', right: 0, left: 'auto', minWidth: 320, maxHeight: 400, overflowY: 'auto' }}>
                                <div style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'var(--font-heading)', fontSize: '0.85rem', borderBottom: '1px solid var(--border-light)' }}>
                                    🔔 {lang === 'bs' ? 'Obavijesti' : 'Notifications'} ({notifications.length})
                                </div>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        {lang === 'bs' ? 'Nema obavijesti' : 'No notifications'}
                                    </div>
                                ) : notifications.map((n, idx) => (
                                    <button key={idx} className="dropdown-item" onClick={() => handleNotifNav(n.path)}
                                        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px' }}>
                                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{n.icon}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>{n.text}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{n.date}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Profile */}
                    <div ref={profileRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
                            style={headerStyles.profileBtn}
                        >
                            <div style={headerStyles.avatar}>
                                {user?.firstName?.[0] || 'K'}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <span style={headerStyles.profileName}>
                                    {user?.firstName} {user?.lastName}
                                </span>
                                <span style={{
                                    fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                                    background: roleBadge.bg, color: roleBadge.color, lineHeight: 1.4,
                                }}>
                                    {roleBadge.label}
                                </span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
                        </button>

                        {showProfile && (
                            <div className="dropdown-menu" style={{ top: 'calc(100% + 8px)' }}>
                                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{user?.firstName} {user?.lastName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeCompany?.naziv || user?.companyName || ''}</div>
                                    <span style={{
                                        display: 'inline-block', marginTop: 4,
                                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                                        background: roleBadge.bg, color: roleBadge.color,
                                    }}>
                                        {roleBadge.label}
                                    </span>
                                </div>
                                <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=profile')}>👤 {t('profile')}</button>
                                <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=company')}>🏢 {t('company')}</button>
                                <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=app')}>⚙️ {t('settings')}</button>
                                {isAdmin && (
                                    <>
                                        <div className="dropdown-divider" />
                                        <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/admin/users')} style={{ color: '#7B1FA2', fontWeight: 600 }}>
                                            👑 {lang === 'bs' ? 'Administracija' : 'Admin Panel'}
                                        </button>
                                    </>
                                )}
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>
                                    🚪 {t('logout')}
                                </button>
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
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Adresa' : 'Address'}</label>
                                    <input className="form-input" value={newCompanyData.adresa} onChange={e => setNewCompanyData(p => ({ ...p, adresa: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Mjesto' : 'City'}</label>
                                    <input className="form-input" value={newCompanyData.mjesto} onChange={e => setNewCompanyData(p => ({ ...p, mjesto: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Telefon' : 'Phone'}</label>
                                    <input className="form-input" value={newCompanyData.telefon} onChange={e => setNewCompanyData(p => ({ ...p, telefon: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={newCompanyData.email} onChange={e => setNewCompanyData(p => ({ ...p, email: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowNewCompanyModal(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleCreateCompany} disabled={!newCompanyData.naziv.trim()}>
                                💾 {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const headerStyles = {
    header: {
        position: 'fixed',
        top: 0,
        right: 0,
        height: 'var(--header-height)',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        zIndex: 90,
        transition: 'left var(--transition-normal)',
    },
    searchContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bg-input)',
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius-full)',
        padding: '8px 20px',
        width: '100%',
        transition: 'all var(--transition-fast)',
    },
    searchFocused: {
        borderColor: 'var(--primary)',
        background: 'white',
        boxShadow: '0 0 0 4px var(--primary-glow)',
    },
    searchIcon: {
        fontSize: '0.95rem',
        flexShrink: 0,
    },
    searchInput: {
        border: 'none',
        background: 'transparent',
        outline: 'none',
        fontSize: '0.9rem',
        color: 'var(--text)',
        fontFamily: 'var(--font-body)',
        flex: 1,
        minWidth: 0,
    },
    searchDropdown: {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        right: 0,
        background: 'white',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 30px rgba(11, 42, 60, 0.15)',
        border: '1px solid var(--border)',
        zIndex: 200,
        overflow: 'hidden',
    },
    rightSide: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    langBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
        fontFamily: 'var(--font-heading)',
        color: 'var(--text)',
        transition: 'all 0.2s',
    },
    iconBtn: {
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--bg-input)',
        cursor: 'pointer',
        fontSize: '1.1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
    },
    notifDot: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--danger)',
        border: '2px solid white',
    },
    profileBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px 6px 6px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 700,
        fontSize: '0.8rem',
        fontFamily: 'var(--font-heading)',
    },
    profileName: {
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--text)',
        fontFamily: 'var(--font-heading)',
    },
};
