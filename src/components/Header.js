'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getAll, create, COLLECTIONS, getOrgUnitName, formatDate, getRawAll, seedCompanyData } from '@/lib/dataStore';
import { updateUserProfile } from '@/lib/authService';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getHeaderNotifications, dismissNotification, APP_VERSION } from '@/lib/systemMonitor';
import { useTheme } from '@/contexts/ThemeContext';
import { matchesSearch } from '@/lib/dateUtils';

export default function Header({ sidebarCollapsed, isMobile = false, onMobileMenuToggle }) {
    const { t, lang, setLang } = useLanguage();
    const { user, logout, isAdmin, isSuperAdmin, activeCompanyId, userCompanies, switchCompany } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const router = useRouter();
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const [showNotifs, setShowNotifs] = useState(false);
    const [showCompanyMenu, setShowCompanyMenu] = useState(false);
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);
    const [switchingCompany, setSwitchingCompany] = useState(false);
    const [mobileExpanded, setMobileExpanded] = useState(true);
    const [companySearchTerm, setCompanySearchTerm] = useState('');
    const [newCompanyData, setNewCompanyData] = useState({ naziv: '', adresa: '', mjesto: '', telefon: '', email: '', assignedOfficerId: '' });
    const profileRef = useRef(null);
    const notifRef = useRef(null);
    const searchRef = useRef(null);
    const companyRef = useRef(null);
    const langRef = useRef(null);

    // Companies list — source of truth depending on role
    // AuthContext safely loads ALL companies for Superadmin and ASSIGNED companies for Officer natively from Firestore.
    // We safely rely on userCompanies from AuthContext for all roles now.
    const companies = useMemo(() => {
        if (!user?.id) return [];
        return userCompanies || [];
    }, [user?.id, userCompanies]);

    const filteredCompaniesForMenu = useMemo(() => {
        if (!companySearchTerm.trim()) return companies;
        const q = companySearchTerm.toLowerCase();
        return companies.filter(c => (c.naziv || c.skraceniNaziv || '').toLowerCase().includes(q) || (c.mjesto || '').toLowerCase().includes(q));
    }, [companies, companySearchTerm]);

    const activeCompany = useMemo(() =>
        companies.find(c => c.id === activeCompanyId) || null,
        [companies, activeCompanyId]);

    const officers = useMemo(() => {
        if (!isAdmin) return [];
        return getRawAll(COLLECTIONS.USERS).filter(u => u.role === 'officer' && u.aktivan !== false);
    }, [isAdmin]);

    useEffect(() => {
        const handleClick = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
            if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
            if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false);
            if (companyRef.current && !companyRef.current.contains(e.target)) {
                setShowCompanyMenu(false);
                setCompanySearchTerm(''); // Reset search on close
            }
            if (langRef.current && !langRef.current.contains(e.target)) setShowLangMenu(false);
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
            const haystack = `${w.ime} ${w.prezime} ${w.jmbg || ''} ${w.oib || ''} ${w.identBroj || ''} ${w.datumRodenja || ''} ${w.datumZaposlenja || ''} ${w.datumOdlaska || ''}`;
            if (matchesSearch(haystack, term))
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
        getAll(COLLECTIONS.VEHICLES || 'vehicles').forEach(v => {
            if (`${v.registracija || ''} ${v.marka || ''} ${v.model || ''}`.toLowerCase().includes(term))
                results.push({ type: 'vehicle', icon: '🚗', label: v.registracija || 'Vozilo', sub: `${v.marka || ''} ${v.model || ''}`, path: '/dashboard/fleet', id: v.id });
        });
        getAll(COLLECTIONS.MEDICAL_EXAMS || 'medicalExams').forEach(m => {
            if (`${m.radnikIme || ''} ${m.ustanova || ''} ${m.doktor || ''}`.toLowerCase().includes(term))
                results.push({ type: 'medical_exam', icon: '🩺', label: m.radnikIme || 'Pregled', sub: m.ustanova || '', path: '/dashboard/medical-exams', id: m.id });
        });
        getAll(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations').forEach(o => {
            if (`${o.opis || ''} ${o.lokacija || ''}`.toLowerCase().includes(term))
                results.push({ type: 'observation', icon: '🚨', label: o.lokacija || 'Prijava opasnosti', sub: o.opis || '', path: '/dashboard/observations', id: o.id });
        });
        getAll(COLLECTIONS.CERTIFICATES).forEach(c => {
            if (`${c.naziv || ''} ${c.radnikIme || ''} ${c.oznaka || ''}`.toLowerCase().includes(term))
                results.push({ type: 'certificate', icon: '📜', label: c.naziv || 'Uvjerenje', sub: c.radnikIme || '', path: '/dashboard/certificates', id: c.id });
        });
        return results.slice(0, 10);
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
    const handleLogout = () => { setShowProfile(false); logout(); router.push('/login'); };

    const handleCreateCompany = async () => {
        if (!newCompanyData.naziv.trim()) return;
        setSwitchingCompany(true);
        try {
            // Natively create the company in Firestore and AWAIT completion
            // This prevents the browser from killing the network socket during reload
            const newCompanyId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const newComp = { ...newCompanyData, skraceniNaziv: newCompanyData.naziv, aktivan: true, id: newCompanyId, createdAt: new Date().toISOString() };

            await setDoc(doc(db, 'companies', newCompanyId), newComp);

            // Push to local offline cache to maintain temporary compatibility
            try {
                const { _cache } = require('@/lib/dataStore');
                if (!_cache['companies']) _cache['companies'] = [];
                _cache['companies'].push(newComp);
            } catch (e) { }

            if (user?.id) {
                // Update Firestore native profile synchronously
                const updatedIds = [...new Set([...(user.companyIds || []), newComp.id])];
                await updateUserProfile(user.uid || user.id, { companyIds: updatedIds });

                // Keep local storage session cache in sync purely for legacy reasons
                try { const p = JSON.parse(localStorage.getItem('eznr_user')); p.companyIds = updatedIds; localStorage.setItem('eznr_user', JSON.stringify(p)); } catch (e) { }
            }

            // Assign to officer if selected
            if (isAdmin && newCompanyData.assignedOfficerId) {
                const { update } = require('@/lib/dataStore');
                const officerUser = getRawAll(COLLECTIONS.USERS).find(u => u.id === newCompanyData.assignedOfficerId);
                if (officerUser) {
                    const updatedOfficerIds = [...(officerUser.companyIds || []), newComp.id];
                    update(COLLECTIONS.USERS, officerUser.id, { companyIds: updatedOfficerIds });
                }
            }

            const sourceId = (user?.companyIds || [])[0];
            if (sourceId) seedCompanyData(newComp.id, sourceId);
            switchCompany(newComp.id);
            setShowNewCompanyModal(false);
            setNewCompanyData({ naziv: '', adresa: '', mjesto: '', telefon: '', email: '', assignedOfficerId: '' });
            window.location.reload();
        } catch (err) {
            console.error('[Header] Failed to create company natively:', err);
            setSwitchingCompany(false);
        }
    };

    const roleBadge = isAdmin
        ? { label: 'Admin', bg: 'linear-gradient(135deg, #7B1FA2, #E040FB)', color: 'white' }
        : { label: lang === 'en' ? 'Safety Officer' : 'Stručnjak ZNR', bg: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white' };

    const LANGUAGES = [
        { code: 'bs', label: 'BA', flag: 'https://flagcdn.com/w40/ba.png', title: 'Bosanski' },
        { code: 'hr', label: 'HR', flag: 'https://flagcdn.com/w40/hr.png', title: 'Hrvatski' },
        { code: 'en', label: 'EN', flag: 'https://flagcdn.com/w40/gb.png', title: 'English' }
    ];
    const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

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

    // Navigate back — browser history handles this correctly since cert pages use router.push()
    const handleBack = () => router.back();


    return (
        <>
            {/* ══ MOBILE: Compact 48px top bar ══ */}
            {isMobile && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 300,
                    display: 'flex', alignItems: 'center', gap: 3, padding: '0 5px',
                    background: 'var(--bg-header, var(--bg-page))',
                    backdropFilter: 'blur(20px)',
                    borderBottom: '1px solid var(--border-light)',
                }}>
                    {/* Back / Forward */}
                    <button onClick={handleBack} title={lang !== 'en' ? 'Nazad' : 'Back'}
                        style={{ ...iBtn({ width: 32, height: 32, fontSize: '0.85rem' }), border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-input)' }}>←</button>
                    <button onClick={() => router.forward?.() || window.history.forward()} title={lang !== 'en' ? 'Naprijed' : 'Forward'}
                        style={{ ...iBtn({ width: 32, height: 32, fontSize: '0.85rem' }), border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-input)' }}>→</button>

                    {/* Company chip */}
                    <div ref={companyRef} style={{ position: 'relative', flex: '1 1 auto', minWidth: 0, display: 'flex' }}>
                        <button onClick={() => { setShowCompanyMenu(v => !v); setShowNotifs(false); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '0 8px', borderRadius: 8, border: 'none',
                                background: activeCompanyId === 'all'
                                    ? 'linear-gradient(135deg, #455A64, #263238)'
                                    : 'linear-gradient(135deg, var(--primary), #009985)',
                                cursor: 'pointer', flex: 1, height: 32,
                            }}>
                            <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>🏢</span>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0, textAlign: 'left' }}>
                                {activeCompanyId === 'all' ? (lang !== 'en' ? 'Sve firme' : 'All') : (activeCompany?.skraceniNaziv || activeCompany?.naziv || '—')}
                            </div>
                            <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)' }}>▼</span>
                        </button>
                        {showCompanyMenu && typeof document !== 'undefined' && createPortal(
                            <div onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', top: 58, left: '5%', width: '90%', zIndex: 99999, maxHeight: '75vh', overflowY: 'auto', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>
                                <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.85rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>🏢 {isSuperAdmin ? (lang !== 'en' ? 'Sve firme klijenata' : 'All client companies') : (lang !== 'en' ? 'Moje firme' : 'My companies')}</span>
                                    <button onClick={() => { setShowCompanyMenu(false); setCompanySearchTerm(''); }} style={{ background: 'none', border: 'none', fontSize: '1.2rem', lineHeight: 1, color: 'inherit', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                                </div>
                                {/* Fast company search bar */}
                                {companies.length > 1 && (
                                    <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', opacity: 0.5 }}>🔍</span>
                                            <input
                                                value={companySearchTerm} onChange={e => setCompanySearchTerm(e.target.value)}
                                                placeholder={lang !== 'en' ? 'Pretraži firme...' : 'Search companies...'}
                                                style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.85rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', outline: 'none' }}
                                                autoFocus
                                            />
                                        </div>
                                    </div>
                                )}
                                {/* Officer: aggregate mode */}
                                {!isSuperAdmin && !companySearchTerm && (
                                    <>
                                        <button className="dropdown-item" onClick={() => { switchCompany('all'); setShowCompanyMenu(false); router.push('/dashboard'); }}
                                            style={{ fontWeight: activeCompanyId === 'all' ? 700 : 400, padding: '12px 16px', fontSize: '0.9rem' }}>
                                            {activeCompanyId === 'all' ? '✅' : '🌐'} {lang !== 'en' ? 'Sve firme' : 'All companies'}
                                        </button>
                                        <div className="dropdown-divider" />
                                    </>
                                )}
                                {filteredCompaniesForMenu.length === 0 && (
                                    <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                        {companySearchTerm ? (lang !== 'en' ? 'Nema rezultata.' : 'No results found.') : (isSuperAdmin ? (lang !== 'en' ? 'Nema registrovanih firmi.' : 'No registered companies.') : (lang !== 'en' ? 'Nema dodijeljenih firmi.' : 'No companies assigned.'))}
                                    </div>
                                )}
                                {filteredCompaniesForMenu.map(c => (
                                    <button key={c.id} className="dropdown-item" onClick={() => { switchCompany(c.id); setShowCompanyMenu(false); router.push('/dashboard'); }}
                                        style={{ fontWeight: c.id === activeCompanyId ? 700 : 400, padding: '12px 16px', fontSize: '0.9rem' }}>
                                        {c.id === activeCompanyId ? '✅' : '🏛️'} {c.naziv || c.skraceniNaziv}
                                    </button>
                                ))}
                                {/* Add new company - Available for all roles */}
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" onClick={() => { setShowCompanyMenu(false); setShowNewCompanyModal(true); }} style={{ color: 'var(--primary)', fontWeight: 700, padding: '12px 16px', fontSize: '0.9rem', justifyContent: 'center' }}>
                                    ➕ {lang !== 'en' ? 'Dodaj firmu' : 'Add company'}
                                </button>
                            </div>,
                            document.body
                        )}
                    </div>

                    <div ref={langRef} style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                        <button onClick={() => { setShowLangMenu(v => !v); setShowCompanyMenu(false); setShowNotifs(false); }}
                            style={{ ...iBtn({ padding: '0 6px', fontSize: '0.75rem', fontWeight: 700, width: 'auto', minWidth: 46, height: 32, gap: 6 }), color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-input)' }}>
                            <img src={currentLang.flag} width={16} height={16} alt={currentLang.label} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                            <span>{currentLang.label}</span>
                        </button>
                        {showLangMenu && typeof document !== 'undefined' && createPortal(
                            <div onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', top: 58, right: 10, zIndex: 99999, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', padding: '6px', minWidth: 130 }}>
                                {LANGUAGES.map(l => (
                                    <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', width: '100%', border: 'none', background: lang === l.code ? 'var(--bg-badge)' : 'transparent', color: lang === l.code ? 'var(--primary-dark)' : 'var(--text)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontWeight: lang === l.code ? 700 : 500, transition: 'background 0.15s' }}>
                                        <img src={l.flag} width={18} height={18} alt={l.label} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                                        <span>{l.title}</span>
                                    </button>
                                ))}
                            </div>,
                            document.body
                        )}
                    </div>

                    <button onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}
                        style={{ ...iBtn({ fontSize: '0.95rem', width: 34, height: 32, padding: 0 }), border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-input)', flexShrink: 0 }}>
                        {isDark ? '☀️' : '🌙'}
                    </button>

                    {/* Notifications bell — onMouseDown stops the document mousedown listener from closing it before click fires */}
                    <div ref={notifRef} onMouseDown={e => e.stopPropagation()} style={{ position: 'relative', flexShrink: 0 }}>
                        <button onClick={() => { setShowNotifs(v => !v); setShowCompanyMenu(false); }}
                            style={{ ...iBtn({ position: 'relative', width: 38, height: 32 }), border: showNotifs ? '1.5px solid var(--primary)' : '1px solid var(--border)', borderRadius: 8, background: showNotifs ? 'rgba(0,191,166,0.1)' : 'var(--bg-input)', transition: 'all 0.15s ease' }}>
                            🔔
                            {notifications.length > 0 && (
                                <span style={{ position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16, borderRadius: 8, background: notifications.some(n => n.severity === 'critical' || n.severity === 'urgent') ? '#EF4444' : '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', color: 'white', fontWeight: 800, border: '1.5px solid var(--bg-card)', padding: '0 3px' }}>
                                    {notifications.length}
                                </span>
                            )}
                        </button>
                        {showNotifs && typeof document !== 'undefined' && createPortal(
                            <div onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', top: 58, right: 8, left: 8, zIndex: 99999, maxHeight: '80vh', overflowY: 'auto', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>
                                <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: '0.9rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>🔔 {lang !== 'en' ? 'Obavijesti' : 'Notifications'} ({notifications.length})</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {isAdmin && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>v{APP_VERSION}</span>}
                                        <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                                    </div>
                                </div>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>✅ {lang !== 'en' ? 'Sve je u redu!' : 'All good!'}</div>
                                ) : notifications.map((n, idx) => {
                                    const sc = { critical: { bg: 'rgba(239,68,68,0.10)', border: '#EF4444', titleColor: 'var(--danger)' }, urgent: { bg: 'rgba(249,115,22,0.10)', border: '#F97316', titleColor: 'var(--warning)' }, warning: { bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', titleColor: 'var(--warning)' }, info: { bg: 'rgba(34,197,94,0.10)', border: '#22C55E', titleColor: 'var(--success)' } };
                                    const c = sc[n.severity] || sc.info;
                                    return (
                                        <div key={n.id || idx} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)', background: c.bg, borderLeft: `4px solid ${c.border}` }}>
                                            <div style={{ display: 'flex', gap: 10 }}>
                                                <span style={{ fontSize: '1.2rem' }}>{n.icon}</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: c.titleColor }}>{n.text}</div>
                                                    {n.detail && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{n.detail}</div>}
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                                        {n.actionLabel && <button onClick={() => handleNotifNav(n.path)} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6, border: `1px solid ${c.border}`, background: c.border, color: 'white', fontWeight: 700, cursor: 'pointer' }}>{n.actionLabel}</button>}
                                                        {n.id && <button onClick={e => { e.stopPropagation(); dismissNotification(n.id); setShowNotifs(false); setTimeout(() => setShowNotifs(true), 50); }} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>✕ {lang !== 'en' ? 'Odbaci' : 'Dismiss'}</button>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>,
                            document.body
                        )}
                    </div>
                    {/* Settings (Mobile only) — use router.push for SPA navigation, no full reload */}
                    <button onClick={() => router.push('/dashboard/settings?tab=app')} style={{ ...iBtn({ fontSize: '1.05rem', width: 36, height: 32, padding: 0 }), border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-input)', flexShrink: 0 }}>
                        ⚙️
                    </button>
                </div>
            )}

            {/* ══ DESKTOP: Full three-island floating header (unchanged) ══ */}
            {!isMobile && (
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
                        <button title={lang !== 'en' ? 'Nazad' : 'Back'} onClick={handleBack} style={iBtn()}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>←</button>
                        <button title={lang !== 'en' ? 'Naprijed' : 'Forward'} onClick={() => router.forward?.() || window.history.forward()} style={iBtn()}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>→</button>
                        {sep}
                        <div ref={companyRef} style={{ position: 'relative' }}>
                            <button onClick={() => { setShowCompanyMenu(v => !v); setShowProfile(false); setShowNotifs(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 7px', borderRadius: 100, border: 'none', background: activeCompanyId === 'all' ? 'linear-gradient(135deg, #455A64, #263238)' : 'linear-gradient(135deg, var(--primary), #009985)', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeCompanyId === 'all' ? '0 2px 10px rgba(70,90,100,0.3)' : '0 2px 10px rgba(0,191,166,0.3)' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>🏢</span>
                                <div>
                                    <div style={{ fontSize: '0.58rem', fontWeight: 600, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.3px', lineHeight: 1, marginBottom: 1 }}>{lang !== 'en' ? 'Aktivna firma' : 'Active company'}</div>
                                    <div style={{ fontSize: '0.79rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                                        {activeCompanyId === 'all' ? (lang !== 'en' ? 'Sve firme' : 'All companies') : (activeCompany?.skraceniNaziv || activeCompany?.naziv || (lang !== 'en' ? 'Odaberi' : 'Select'))}
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.75)', flexShrink: 0 }}>▼</span>
                            </button>
                            {showCompanyMenu && (
                                <div className="dropdown-menu" style={{ top: 'calc(100% + 8px)', left: 0, minWidth: 300, zIndex: 200 }}>
                                    <div style={{ padding: '10px 16px', fontWeight: 700, fontSize: '0.8rem', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>🏢 {isSuperAdmin ? (lang !== 'en' ? 'Sve firme klijenata' : 'All client companies') : (lang !== 'en' ? 'Moje firme' : 'My companies')}</span>
                                        <button onClick={() => { setShowCompanyMenu(false); setCompanySearchTerm(''); }} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'inherit', cursor: 'pointer' }}>✕</button>
                                    </div>

                                    {/* Fast company search bar */}
                                    {companies.length > 1 && (
                                        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', opacity: 0.5 }}>🔍</span>
                                                <input
                                                    value={companySearchTerm} onChange={e => setCompanySearchTerm(e.target.value)}
                                                    placeholder={lang !== 'en' ? 'Pretraži firme...' : 'Search companies...'}
                                                    style={{ width: '100%', padding: '6px 10px 6px 30px', fontSize: '0.85rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', outline: 'none' }}
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {/* Officer: "Sve firme" aggregate mode */}
                                    {!isSuperAdmin && !companySearchTerm && (
                                        <>
                                            <button className="dropdown-item" onClick={() => { switchCompany('all'); setShowCompanyMenu(false); router.push('/dashboard'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontWeight: activeCompanyId === 'all' ? 700 : 400 }}>
                                                <span>{activeCompanyId === 'all' ? '✅' : '🌐'}</span><div style={{ flex: 1 }}><div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lang !== 'en' ? 'Sve firme' : 'All companies'}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{lang !== 'en' ? 'Kombinirani prikaz' : 'Combined view'}</div></div>
                                            </button>
                                            <div className="dropdown-divider" />
                                        </>
                                    )}

                                    {/* Company list */}
                                    {filteredCompaniesForMenu.length === 0 && (
                                        <div style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.83rem', textAlign: 'center' }}>
                                            {companySearchTerm ? (lang !== 'en' ? 'Nema rezultata.' : 'No results found.') : (isSuperAdmin ? (lang !== 'en' ? 'Nema registrovanih firmi.' : 'No registered companies.') : (lang !== 'en' ? 'Nema dodijeljenih firmi.' : 'No companies assigned.'))}
                                        </div>
                                    )}
                                    <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                                        {filteredCompaniesForMenu.map(c => {
                                            const parent = c.parentId ? companies.find(p => p.id === c.parentId) : null;
                                            const isHolding = companies.some(sub => sub.parentId === c.id);
                                            return (
                                                <button key={c.id} className="dropdown-item" onClick={async () => { setShowCompanyMenu(false); switchCompany(c.id); router.push('/dashboard'); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', fontWeight: c.id === activeCompanyId ? 700 : 400 }}>
                                                    <span>{c.id === activeCompanyId ? '✅' : (isHolding ? '🏢' : (parent ? '🔗' : '🏛️'))}</span>
                                                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {c.naziv || c.skraceniNaziv}
                                                            {isHolding && <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: 4, background: 'rgba(0,191,166,0.1)', color: 'var(--primary)', fontWeight: 800 }}>HOLDING</span>}
                                                        </div>
                                                        {parent ? (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>↳ {lang !== 'en' ? 'Dio od' : 'Sub of'}: {parent.naziv || parent.skraceniNaziv}</div>
                                                        ) : (
                                                            c.mjesto && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.mjesto}</div>
                                                        )}
                                                    </div>
                                                    {isSuperAdmin && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0 }}>👁️</span>}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Add new company - Available for all roles */}
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item" onClick={() => { setShowCompanyMenu(false); setShowNewCompanyModal(true); }} style={{ color: 'var(--primary)', fontWeight: 600 }}>➕ {lang !== 'en' ? 'Dodaj novu firmu' : 'Add new company'}</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ══ CENTER ISLAND: Search ══ */}
                    <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: `1.5px solid ${searchFocused ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 100, padding: '0 16px', height: 42, boxShadow: searchFocused ? '0 0 0 4px var(--primary-glow), 0 2px 12px rgba(0,0,0,0.07)' : '0 2px 12px rgba(0,0,0,0.06)', transition: 'border-color 0.2s, box-shadow 0.2s' }}>
                            <span style={{ fontSize: '0.88rem', flexShrink: 0, opacity: 0.45 }}>🔍</span>
                            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.88rem', color: 'var(--text)', fontFamily: 'var(--font-body)', flex: 1, minWidth: 0 }} placeholder={t('searchPlaceholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onFocus={() => setSearchFocused(true)} />
                            {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1, flexShrink: 0 }}>✕</button>}
                            {!searchFocused && !searchTerm && <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0, opacity: 0.7 }}>Ctrl K</span>}
                        </div>
                        {searchFocused && searchTerm.length >= 2 && (
                            <div className="search-dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 30px rgba(11,42,60,0.15)', border: '1px solid var(--border)', zIndex: 200, overflow: 'hidden' }}>
                                {searchResults.length === 0 ? (
                                    <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>{lang !== 'en' ? 'Nema rezultata' : 'No results'}</div>
                                ) : (<>
                                    <div style={{ padding: '8px 16px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang !== 'en' ? 'Rezultati pretrage' : 'Search results'} ({searchResults.length})</div>
                                    {searchResults.map((r, idx) => (
                                        <button key={idx} onClick={() => handleSearchNav(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{r.label}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                                            </div>
                                            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 10, background: 'var(--bg-badge)', color: 'var(--primary-dark)', fontWeight: 600 }}>
                                                {r.type === 'worker' ? (lang !== 'en' ? 'Radnik' : 'Worker') : r.type === 'equipment' ? (lang !== 'en' ? 'Oprema' : 'Equipment') : r.type === 'workplace' ? (lang !== 'en' ? 'Radno mj.' : 'Workplace') : r.type === 'orgUnit' ? (lang !== 'en' ? 'Org. jed.' : 'Org. unit') : r.type === 'vehicle' ? (lang !== 'en' ? 'Vozilo' : 'Vehicle') : r.type === 'medical_exam' ? (lang !== 'en' ? 'Lj. Pregled' : 'Medical') : r.type === 'observation' ? (lang !== 'en' ? 'Prijava op..' : 'Observation') : r.type === 'certificate' ? (lang !== 'en' ? 'Uvjerenje' : 'Certificate') : ''}
                                            </span>
                                        </button>
                                    ))}
                                </>)}
                            </div>
                        )}
                    </div>

                    {/* ══ RIGHT ISLAND: Lang + Theme | Notifs + Profile ══ */}
                    <div style={island}>
                        <div ref={langRef} style={{ position: 'relative' }}>
                            <button onClick={() => { setShowLangMenu(v => !v); setShowProfile(false); setShowNotifs(false); setShowCompanyMenu(false); }}
                                style={iBtn({ padding: '0 10px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.4px', width: 'auto', gap: 8, minWidth: 60, justifyContent: 'flex-start' })}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.color = 'white'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                <img src={currentLang.flag} width={18} height={18} alt={currentLang.label} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                                <span>{currentLang.label}</span>
                            </button>
                            {showLangMenu && (
                                <div className="dropdown-menu" style={{ top: 'calc(100% + 8px)', left: 0, right: 'auto', minWidth: 130, padding: '6px' }}>
                                    {LANGUAGES.map(l => (
                                        <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', width: '100%', border: 'none', background: lang === l.code ? 'var(--bg-badge)' : 'transparent', color: lang === l.code ? 'var(--primary-dark)' : 'var(--text)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontWeight: lang === l.code ? 700 : 500, transition: 'background 0.15s' }}
                                            onMouseEnter={e => { if(lang !== l.code) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                            onMouseLeave={e => { if(lang !== l.code) e.currentTarget.style.background = 'transparent'; }}>
                                            <img src={l.flag} width={18} height={18} alt={l.label} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                                            <span>{l.title}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}
                            style={{ position: 'relative', width: 50, height: 26, borderRadius: 13, border: isDark ? '1.5px solid rgba(100,160,220,0.3)' : '1.5px solid rgba(255,180,0,0.3)', cursor: 'pointer', padding: 0, flexShrink: 0, margin: '0 3px', background: isDark ? 'linear-gradient(135deg,#1b3d5e,#0c1d30)' : 'linear-gradient(135deg,#a8d8ea,#FFC947)', transition: 'background 0.4s, border-color 0.4s' }}>
                            <span style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: isDark ? 4 : 'auto', right: isDark ? 'auto' : 4, fontSize: '0.48rem', opacity: 0.55, pointerEvents: 'none' }}>{isDark ? '✨' : '☀️'}</span>
                            <span style={{ position: 'absolute', top: 2, left: isDark ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: isDark ? 'radial-gradient(circle at 35% 35%,#d0e8ff,#a8c8f0)' : 'radial-gradient(circle at 35% 35%,#fff,#ffe780)', boxShadow: isDark ? '0 2px 4px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem' }}>
                                {isDark ? '🌙' : '☀️'}
                            </span>
                        </button>
                        {sep}
                        <div ref={notifRef} style={{ position: 'relative' }}>
                            <button onClick={() => { setShowNotifs(v => !v); setShowProfile(false); }} style={iBtn({ position: 'relative' })}
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
                                        <span>🔔 {lang !== 'en' ? 'Obavijesti' : 'Notifications'} ({notifications.length})</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {isAdmin && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>v{APP_VERSION}</span>}
                                            <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                                        </div>
                                    </div>
                                    {notifications.length === 0 ? (
                                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>✅ {lang !== 'en' ? 'Sve je u redu!' : 'All good!'}</div>
                                    ) : notifications.map((n, idx) => {
                                        const sc = { critical: { bg: 'rgba(239,68,68,0.10)', border: '#EF4444', titleColor: 'var(--danger)' }, urgent: { bg: 'rgba(249,115,22,0.10)', border: '#F97316', titleColor: 'var(--warning)' }, warning: { bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', titleColor: 'var(--warning)' }, info: { bg: 'rgba(34,197,94,0.10)', border: '#22C55E', titleColor: 'var(--success)' } };
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
                                                            {n.id && isAdmin && <button onClick={e => { e.stopPropagation(); dismissNotification(n.id); setShowNotifs(false); setTimeout(() => setShowNotifs(true), 50); }} style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>✕ {lang !== 'en' ? 'Odbaci' : 'Dismiss'}</button>}
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
                        <div ref={profileRef} style={{ position: 'relative' }}>
                            <button onClick={() => { setShowProfile(v => !v); setShowNotifs(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 8px 3px 3px', borderRadius: 100, border: 'none', background: 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{user?.firstName} {user?.lastName}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeCompany?.naziv || ''}</div>
                                            </div>
                                            <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                                        </div>
                                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: roleBadge.bg, color: roleBadge.color }}>{roleBadge.label}</span>
                                    </div>
                                    <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=profile')}>👤 {t('profile')}</button>
                                    <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=company')}>🏢 {t('company')}</button>
                                    <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/settings?tab=app')}>⚙️ {t('settings')}</button>
                                    {isAdmin && (<>
                                        <div className="dropdown-divider" />
                                        <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/admin/users')} style={{ color: '#7B1FA2', fontWeight: 600 }}>👑 {lang !== 'en' ? 'Upravljanje korisnicima' : 'User Management'}</button>
                                        <button className="dropdown-item" onClick={() => handleProfileNav('/dashboard/admin/companies')} style={{ color: '#0288D1', fontWeight: 600 }}>🏢 {lang !== 'en' ? 'Upravljanje firmama' : 'Company Management'}</button>
                                    </>)}
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={handleLogout}>🚪 {t('logout')}</button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
            )}


            {/* ── New Company Modal ── */}
            {showNewCompanyModal && (
                <div className="modal-overlay" onClick={() => setShowNewCompanyModal(false)} style={{ zIndex: 300 }}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                            <h2 style={{ color: 'white' }}>🏢 {lang !== 'en' ? 'Nova firma' : 'New Company'}</h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowNewCompanyModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">{lang !== 'en' ? 'Naziv firme' : 'Company name'} *</label>
                                <input className="form-input" value={newCompanyData.naziv} onChange={e => setNewCompanyData(p => ({ ...p, naziv: e.target.value }))} placeholder="ABC d.o.o." required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group"><label className="form-label">{lang !== 'en' ? 'Adresa' : 'Address'}</label><input className="form-input" value={newCompanyData.adresa} onChange={e => setNewCompanyData(p => ({ ...p, adresa: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">{lang !== 'en' ? 'Mjesto' : 'City'}</label><input className="form-input" value={newCompanyData.mjesto} onChange={e => setNewCompanyData(p => ({ ...p, mjesto: e.target.value }))} /></div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group"><label className="form-label">{lang !== 'en' ? 'Telefon' : 'Phone'}</label><input className="form-input" value={newCompanyData.telefon} onChange={e => setNewCompanyData(p => ({ ...p, telefon: e.target.value }))} /></div>
                                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={newCompanyData.email} onChange={e => setNewCompanyData(p => ({ ...p, email: e.target.value }))} /></div>
                            </div>
                            {isAdmin && officers.length > 0 && (
                                <div className="form-group" style={{ marginTop: 12 }}>
                                    <label className="form-label">{lang !== 'en' ? 'Dodijeli stručnjaku ZNR' : 'Assign to Officer'}</label>
                                    <select className="form-input" value={newCompanyData.assignedOfficerId} onChange={e => setNewCompanyData(p => ({ ...p, assignedOfficerId: e.target.value }))}>
                                        <option value="">-- {lang !== 'en' ? 'Samo za mene' : 'Do not assign yet'} --</option>
                                        {officers.map(o => <option key={o.id} value={o.id}>{o.firstName} {o.lastName} ({o.email})</option>)}
                                    </select>
                                </div>
                            )}
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
