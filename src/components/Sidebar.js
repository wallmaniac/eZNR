'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const menuItems = [
    // ── Top-level standalone ───────────────────────────────────────────────────
    { key: 'dashboard', icon: '📊', path: '/dashboard' },
    { key: 'home',      icon: '🏠', path: '/dashboard/news' },

    // ── 👷 RADNICI — everything about people ──────────────────────────────────
    {
        key: 'grpWorkers', icon: '👷',
        children: [
            { key: 'workers',            icon: '👷', path: '/dashboard/workers' },
            { key: 'workerCertificates', icon: '📜', path: '/dashboard/worker-certificates' },
            { key: 'workerPPE',          icon: '🦺', path: '/dashboard/worker-ppe' },
            { key: 'medicalExams',       icon: '👨‍⚕️', path: '/dashboard/medical-exams' },
            { key: 'ekWorkers',          icon: '📇', path: '/dashboard/ek-workers' },
            { key: 'ekPPE',             icon: '🦺', path: '/dashboard/ek-ppe' },
            { key: 'trainingMasterBook', icon: '📚', path: '/dashboard/training-book' },
        ],
    },

    // ── 🏢 ORGANIZACIJA — company structure ───────────────────────────────────
    {
        key: 'grpOrganization', icon: '🏢',
        children: [
            { key: 'orgUnits',       icon: '🏢', path: '/dashboard/org-units' },
            { key: 'workplaces',     icon: '🔧', path: '/dashboard/workplaces' },
            { key: 'workplaceList',  icon: '📋', path: '/dashboard/workplace-list' },
            { key: 'sistematizacija', icon: '📑', path: '/dashboard/sistematizacija' },
            { key: 'addressBook',    icon: '📒', path: '/dashboard/address-book' },
        ],
    },

    // ── ⚙️ OPREMA — equipment lifecycle ──────────────────────────────────────
    {
        key: 'grpEquipment', icon: '⚙️',
        children: [
            { key: 'equipment',          icon: '⚙️', path: '/dashboard/equipment' },
            { key: 'equipmentExamList',  icon: '🔍', path: '/dashboard/equipment-exams' },
            { key: 'ekEquipment',        icon: '📇', path: '/dashboard/ek-equipment' },
        ],
    },

    // ── 🩹 SIGURNOST — incidents & diseases ───────────────────────────────────
    {
        key: 'grpSafety', icon: '🩹',
        children: [
            { key: 'injuryReport',       icon: '🩹', path: '/dashboard/injuries' },
            { key: 'annualInjuryReport', icon: '📈', path: '/dashboard/annual-injuries' },
            { key: 'diseaseReport',      icon: '🏥', path: '/dashboard/diseases' },
        ],
    },

    // ── 🎓 OSPOSOBLJAVANJE — training & assessments ───────────────────────────
    {
        key: 'grpTraining', icon: '🎓',
        children: [
            { key: 'trainings',      icon: '🎬', path: '/dashboard/trainings' },
            { key: 'testoviZopZnr',  icon: '📝', path: '/dashboard/tests-zop-znr', label_bs: 'Testovi ZOP i ZNR', label_en: 'ZOP & ZNR Tests' },
            { key: 'questionnaires', icon: '❓', path: '/dashboard/questionnaires' },
            { key: 'riskAssessment', icon: '⚠️', path: '/dashboard/risk-assessment' },
        ],
    },

    // ── 📑 DOKUMENTI — all documents & forms ─────────────────────────────────
    {
        key: 'grpDocuments', icon: '📑',
        children: [
            { key: 'employerDocs',   icon: '📑', path: '/dashboard/employer-docs' },
            { key: 'requests',       icon: '📝', path: '/dashboard/requests' },
            {
                key: 'obrasciIUputnice', icon: '📋',
                label_bs: 'Obrasci i uputnice', label_en: 'Forms & Referrals',
                children: [
                    { key: 'formOIR1',          icon: '📄', path: '/dashboard/form-oir1' },
                    { key: 'medicalReferralRA1', icon: '🩺', path: '/dashboard/referral-ra1' },
                    { key: 'formRO1',            icon: '📄', path: '/dashboard/form-ro1' },
                    { key: 'formRO2',            icon: '📄', path: '/dashboard/form-ro2' },
                    { key: 'nightWorkReferral',  icon: '🌙', path: '/dashboard/night-work' },
                ],
            },
            {
                key: 'grpISZNR', icon: '🏛️',
                label_bs: 'Interni akti ZNR', label_en: 'Internal OSH Acts',
                children: [
                    { key: 'documents',       icon: '📄', path: '/dashboard/isznr-documents' },
                    { key: 'parties',         icon: '👥', path: '/dashboard/isznr-parties' },
                    { key: 'documentTypes',   icon: '📋', path: '/dashboard/isznr-doc-types' },
                    { key: 'digitalSigning',  icon: '✍️', path: '/dashboard/isznr-signing' },
                    { key: 'examiners',       icon: '🔍', path: '/dashboard/isznr-examiners' },
                    { key: 'measureEquipment',icon: '📏', path: '/dashboard/isznr-measure-equipment' },
                ],
            },
        ],
    },

    // ── 🚗 VOZNI PARK — fleet management ─────────────────────────────────────
    {
        key: 'grpFleet', icon: '🚗',
        children: [
            { key: 'fleetVehicles', icon: '🚗', path: '/dashboard/fleet', label_bs: 'Popis vozila', label_en: 'Vehicle List' },
            { key: 'fleetAssignments', icon: '🔄', path: '/dashboard/fleet-assignments', label_bs: 'Zaduženja', label_en: 'Assignments' },
            { key: 'fleetDocuments', icon: '📁', path: '/dashboard/fleet-documents', label_bs: 'Dokumentacija', label_en: 'Documents' },
            { key: 'fleetOrders', icon: '📝', path: '/dashboard/fleet-orders', label_bs: 'Putni nalozi', label_en: 'Travel Orders' },
        ],
    },

    // ── 🧯 ZAŠTITA OD POŽARA — fire protection ──────────────────────────────
    {
        key: 'grpFireProtection', icon: '🧯',
        children: [
            { key: 'fireExtinguishers', icon: '🧯', path: '/dashboard/fire-protection', label_bs: 'Protupožarna oprema', label_en: 'Fire Equipment' },
        ],
    },

    // ── 🚨 EVAKUACIJA — evacuation planning ─────────────────────────────────
    {
        key: 'grpEvacuation', icon: '🚨',
        children: [
            { key: 'evacuationPlans',  icon: '🗺️', path: '/dashboard/evacuation', label_bs: 'Planovi evakuacije', label_en: 'Evacuation Plans' },
            { key: 'evacuationDrills', icon: '🏃', path: '/dashboard/evacuation-drills', label_bs: 'Vježbe evakuacije', label_en: 'Evacuation Drills' },
        ],
    },

    // ── 🔗 ŠIFARNICI — reference / setup data (formerly "Zajednički elementi") ─
    {
        key: 'grpCodebooks', icon: '🔗',
        children: [
            { key: 'countries',          icon: '🌍', path: '/dashboard/countries' },
            { key: 'counties',           icon: '📍', path: '/dashboard/counties' },
            { key: 'places',             icon: '🏘️', path: '/dashboard/places' },
            { key: 'orgUnitGroups',      icon: '📁', path: '/dashboard/org-groups' },
            { key: 'authorizedCompanies',icon: '✅', path: '/dashboard/authorized-companies' },
            { key: 'examiners',          icon: '🔍', path: '/dashboard/examiners' },
            { key: 'doctors',            icon: '👨‍⚕️', path: '/dashboard/doctors' },
            { key: 'examTypes',          icon: '📋', path: '/dashboard/exam-types' },
            { key: 'certTypes',          icon: '📜', path: '/dashboard/cert-types' },
            { key: 'equipmentTypes',     icon: '🔩', path: '/dashboard/equipment-types' },
            { key: 'ppe',               icon: '🦺', path: '/dashboard/ppe' },
            { key: 'fileTypes',         icon: '📂', path: '/dashboard/file-types' },
            { key: 'extraFields',       icon: '➕', path: '/dashboard/extra-fields' },
        ],
    },

    // ── 🛠️ ALATI — tools ────────────────────────────────────────────────────
    {
        key: 'alati', icon: '🛠️',
        children: [
            { key: 'excelImport',    icon: '📥', path: '/dashboard/import', label_bs: 'Excel Import/Export', label_en: 'Excel Import/Export' },
            { key: 'converter',      icon: '🔄', path: '/dashboard/converter' },
            { key: 'digitalArchive', icon: '🗄️', path: '/dashboard/archive' },
        ],
    },

    // ── Bottom standalone ──────────────────────────────────────────────────────
    { key: 'settings',    icon: '⚙️', path: '/dashboard/settings' },
];


export default function Sidebar({ collapsed, onToggle, isMobile = false, mobileOpen = false, onMobileClose }) {
    const { t, lang } = useLanguage();
    const { user, logout, isAdmin } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [openMenus, setOpenMenus] = useState({});

    // Build menu: base items + admin items (if admin)
    const allMenuItems = useMemo(() => {
        const items = [...menuItems];
        if (isAdmin) {
            items.push({
                key: 'admin',
                icon: '👑',
                children: [
                    { key: 'adminUsers', icon: '👥', path: '/dashboard/admin/users' },
                    { key: 'adminCompanies', icon: '🏢', path: '/dashboard/admin/companies' },
                ],
            });
        }
        return items;
    }, [isAdmin]);

    const toggleMenu = (key) => {
        setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const isActive = (path) => pathname === path;

    const handleLogout = () => {
        logout();
        router.push('/');
    };

    // Auto-close mobile drawer on navigation
    const handleNavClick = () => {
        if (isMobile && onMobileClose) onMobileClose();
    };

    // ── Shared menu rendering (used by both sidebar and drawer) ──
    const renderMenu = (isDrawerMode = false) => (
        <nav style={{ ...sidebarStyles.nav, ...(isDrawerMode ? { padding: '8px 12px' } : {}) }}>
            {allMenuItems.map((item) => {
                const hasChildren = item.children && item.children.length > 0;
                const isOpen = openMenus[item.key];
                const active = item.path && isActive(item.path);
                const childActive = hasChildren && item.children.some((c) => {
                    if (c.children) return c.children.some(gc => isActive(gc.path));
                    return isActive(c.path);
                });

                return (
                    <div key={item.key}>
                        {hasChildren ? (
                            <button
                                onClick={() => toggleMenu(item.key)}
                                style={{
                                    ...sidebarStyles.menuItem,
                                    ...(childActive ? sidebarStyles.menuItemActive : {}),
                                    justifyContent: (!isDrawerMode && collapsed) ? 'center' : 'flex-start',
                                    padding: (!isDrawerMode && collapsed) ? '12px' : '10px 16px',
                                }}
                                title={(!isDrawerMode && collapsed) ? t(item.key) : undefined}
                            >
                                <span style={sidebarStyles.menuIcon}>{item.icon}</span>
                                {(isDrawerMode || !collapsed) && (
                                    <>
                                        <span style={sidebarStyles.menuLabel}>{t(item.key)}</span>
                                        <span style={{
                                            ...sidebarStyles.arrow,
                                            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                        }}>
                                            ›
                                        </span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <Link
                                href={item.path}
                                prefetch={true}
                                onClick={handleNavClick}
                                style={{
                                    ...sidebarStyles.menuItem,
                                    ...(active ? sidebarStyles.menuItemActive : {}),
                                    justifyContent: (!isDrawerMode && collapsed) ? 'center' : 'flex-start',
                                    padding: (!isDrawerMode && collapsed) ? '12px' : '10px 16px',
                                    textDecoration: 'none',
                                }}
                                title={(!isDrawerMode && collapsed) ? t(item.key) : undefined}
                            >
                                <span style={sidebarStyles.menuIcon}>{item.icon}</span>
                                {(isDrawerMode || !collapsed) && (
                                    <span style={sidebarStyles.menuLabel}>{t(item.key)}</span>
                                )}
                            </Link>
                        )}

                        {/* Submenu */}
                        {hasChildren && isOpen && (isDrawerMode || !collapsed) && (
                            <div style={sidebarStyles.submenu}>
                                {item.children.map((child) => {
                                    // Nested group (e.g. Obrasci i uputnice)
                                    if (child.children) {
                                        const childGroupOpen = openMenus[child.key];
                                        const childGroupActive = child.children.some(gc => isActive(gc.path));
                                        const childLabel = lang === 'bs' ? (child.label_bs || t(child.key)) : (child.label_en || t(child.key));
                                        return (
                                            <div key={child.key}>
                                                <button
                                                    onClick={() => toggleMenu(child.key)}
                                                    style={{
                                                        ...sidebarStyles.submenuItem,
                                                        width: '100%',
                                                        justifyContent: 'space-between',
                                                        ...(childGroupActive ? sidebarStyles.submenuItemActive : {}),
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <span style={{ fontSize: '0.85rem' }}>{child.icon}</span>
                                                        <span>{childLabel}</span>
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', opacity: 0.5, transition: 'transform 0.2s', transform: childGroupOpen ? 'rotate(90deg)' : 'none' }}>›</span>
                                                </button>
                                                {childGroupOpen && (
                                                    <div style={{ ...sidebarStyles.submenu, marginLeft: 12 }}>
                                                        {child.children.map(gc => (
                                                            <Link
                                                                key={gc.key}
                                                                href={gc.path}
                                                                prefetch={true}
                                                                onClick={handleNavClick}
                                                                style={{
                                                                    ...sidebarStyles.submenuItem,
                                                                    ...(isActive(gc.path) ? sidebarStyles.submenuItemActive : {}),
                                                                    textDecoration: 'none',
                                                                }}
                                                            >
                                                                <span style={{ fontSize: '0.85rem' }}>{gc.icon}</span>
                                                                <span>{t(gc.key)}</span>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    // Normal child link
                                    return (
                                        <Link
                                            key={child.key}
                                            href={child.path}
                                            prefetch={true}
                                            onClick={handleNavClick}
                                            style={{
                                                ...sidebarStyles.submenuItem,
                                                ...(isActive(child.path) ? sidebarStyles.submenuItemActive : {}),
                                                textDecoration: 'none',
                                            }}
                                        >
                                            <span style={{ fontSize: '0.85rem' }}>{child.icon}</span>
                                            <span>{lang === 'bs' ? (child.label_bs || t(child.key)) : (child.label_en || t(child.key))}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // MOBILE: Bottom-sheet drawer (slides up from bottom, sits above bottom nav)
    // ═══════════════════════════════════════════════════════════════════════════
    if (isMobile) {
        // Lock background scroll when drawer is open
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
            if (mobileOpen) {
                const prev = document.body.style.overflow;
                document.body.style.overflow = 'hidden';
                return () => { document.body.style.overflow = prev; };
            }
        }, [mobileOpen]);

        // Ref for the scrollable menu body
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const scrollRef = useRef(null);

        // Swipe-down-to-close tracking
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const swipeRef = useRef({ startY: 0, active: false });

        const handleDrawerTouchStart = (e) => {
            const scrollEl = scrollRef.current;
            // Only allow swipe-to-close if scroll is at top (or touch is above the scroll area)
            const atTop = !scrollEl || scrollEl.scrollTop <= 0;
            const touchInScroll = scrollEl && scrollEl.contains(e.target);
            if (atTop || !touchInScroll) {
                swipeRef.current = { startY: e.touches[0].clientY, active: true };
            } else {
                swipeRef.current.active = false;
            }
        };

        const handleDrawerTouchMove = (e) => {
            const el = scrollRef.current;
            // Prevent background page scroll
            if (el && el.contains(e.target)) {
                e.stopPropagation();
            }
        };

        const handleDrawerTouchEnd = (e) => {
            if (!swipeRef.current.active) return;
            const endY = e.changedTouches[0].clientY;
            const dist = endY - swipeRef.current.startY;
            // If swiped down more than 80px → close
            if (dist > 80) {
                onMobileClose();
            }
            swipeRef.current.active = false;
        };

        return (
            <>
                {/* Backdrop overlay — only covers area above bottom nav */}
                {mobileOpen && (
                    <div
                        onClick={onMobileClose}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0,
                            bottom: 56, // stop above bottom nav
                            zIndex: 499,
                            background: 'rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(2px)',
                        }}
                    />
                )}
                {/* Drawer panel — bottom: 56px so bottom nav is always visible */}
                <div
                    onTouchStart={handleDrawerTouchStart}
                    onTouchMove={handleDrawerTouchMove}
                    onTouchEnd={handleDrawerTouchEnd}
                    style={{
                        position: 'fixed',
                        bottom: 56, left: 0, right: 0,
                        top: 48, // below the mobile header
                        zIndex: 500,
                        background: 'var(--bg-sidebar)',
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        transform: mobileOpen ? 'translateY(0)' : 'translateY(120%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: mobileOpen ? '0 -8px 48px rgba(0,0,0,0.5)' : 'none',
                        willChange: 'transform',
                    }}
                >
                    {/* Drag handle + close */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px 6px',
                        flexShrink: 0,
                    }}>
                        {/* Drag handle bar */}
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <div style={{
                                width: 40, height: 4, borderRadius: 2,
                                background: 'rgba(255,255,255,0.2)',
                            }} />
                        </div>
                        {/* Close button */}
                        <button
                            onClick={onMobileClose}
                            style={{
                                position: 'absolute', top: 8, right: 12,
                                width: 34, height: 34, borderRadius: 10,
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.95rem',
                            }}
                        >✕</button>
                    </div>

                    {/* Logo bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '4px 16px 10px',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        flexShrink: 0,
                    }}>
                        <Link href="/dashboard" onClick={handleNavClick} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                            <Image src="/logo-icon.png" alt="eZNR" width={36} height={36} style={{ borderRadius: 8 }} />
                            <div>
                                <div style={sidebarStyles.logoTitle}>eZNR</div>
                                <div style={sidebarStyles.logoSub}>zastitanaradu.ba</div>
                            </div>
                        </Link>
                    </div>

                    {/* Scrollable menu body — overscrollBehavior: contain prevents scroll chaining */}
                    <div
                        ref={scrollRef}
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            WebkitOverflowScrolling: 'touch',
                            overscrollBehavior: 'contain',
                        }}
                    >
                        {renderMenu(true)}
                    </div>

                    {/* User footer */}
                    <div style={{
                        flexShrink: 0,
                        padding: '10px 16px',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <div style={sidebarStyles.userAvatar}>
                            {user?.firstName?.[0] || 'K'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={sidebarStyles.userName}>{user?.firstName} {user?.lastName}</div>
                            <div style={sidebarStyles.userCompany}>{user?.companyName}</div>
                        </div>
                        <button onClick={handleLogout} style={{
                            padding: '8px 16px',
                            background: 'rgba(244,67,54,0.15)',
                            border: '1px solid rgba(244,67,54,0.3)',
                            borderRadius: 8,
                            color: '#ef9a9a',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-body)',
                            whiteSpace: 'nowrap',
                        }}>🚪 {t('logout')}</button>
                    </div>
                </div>
            </>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DESKTOP / TABLET: Traditional left sidebar
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <aside style={{
            ...sidebarStyles.sidebar,
            width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
        }}>
            {/* Logo */}
            <div style={{ ...sidebarStyles.logoArea, position: 'relative' }}>
                {!collapsed && (
                    <Link href="/dashboard" style={{ ...sidebarStyles.logoContent, textDecoration: 'none' }}>
                        <Image src="/logo-icon.png" alt="eZNR" width={66} height={66} style={{ borderRadius: 10, marginLeft: -15, marginTop: 4 }} />
                        <div style={{ marginLeft: -8 }}>
                            <div style={sidebarStyles.logoTitle}>eZNR</div>
                            <div style={sidebarStyles.logoSub}>zastitanaradu.ba</div>
                        </div>
                    </Link>
                )}
                {collapsed && (
                    <Link href="/dashboard">
                        <Image src="/logo-icon.png" alt="eZNR" width={58} height={58} style={{ borderRadius: 10, marginLeft: -15, marginTop: 4 }} />
                    </Link>
                )}
                <button onClick={onToggle} style={sidebarStyles.collapseBtn}>
                    {collapsed ? '▶' : '◀'}
                </button>
            </div>

            {/* Menu */}
            {renderMenu(false)}

            {/* User area */}
            {!collapsed && (
                <div style={sidebarStyles.userArea}>
                    <div style={{ ...sidebarStyles.userInfo, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                            <div style={sidebarStyles.userAvatar}>
                                {user?.firstName?.[0] || 'K'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={sidebarStyles.userName}>{user?.firstName} {user?.lastName}</div>
                                <div style={sidebarStyles.userCompany}>{user?.companyName}</div>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleLogout} style={sidebarStyles.logoutBtn}>
                        🚪 {t('logout')}
                    </button>
                </div>
            )}
        </aside>
    );
}

const sidebarStyles = {
    sidebar: {
        background: 'var(--bg-sidebar)',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        zIndex: 100,
        overflowY: 'auto',
        overflowX: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.05)',
    },
    logoArea: {
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        minHeight: 64,
    },
    logoContent: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
    },
    logoTitle: {
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        fontSize: '1.2rem',
        color: 'var(--primary)',
        letterSpacing: -0.5,
    },
    logoSub: {
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.4)',
        fontWeight: 500,
    },
    collapseBtn: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.7rem',
        flexShrink: 0,
        transition: 'all 0.2s',
    },
    nav: {
        flex: 1,
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 16px',
        border: 'none',
        background: 'transparent',
        color: 'rgba(255,255,255,0.65)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        transition: 'all 0.15s',
        textAlign: 'left',
    },
    menuItemActive: {
        background: 'var(--bg-sidebar-active)',
        color: 'var(--primary)',
        fontWeight: 600,
    },
    menuIcon: {
        fontSize: '1.1rem',
        flexShrink: 0,
    },
    menuLabel: {
        flex: 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    arrow: {
        fontSize: '1rem',
        transition: 'transform 0.2s',
        color: 'rgba(255,255,255,0.3)',
    },
    submenu: {
        marginLeft: 20,
        paddingLeft: 12,
        borderLeft: '2px solid rgba(0,191,166,0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        marginTop: 4,
        marginBottom: 4,
    },
    submenuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        border: 'none',
        background: 'transparent',
        color: 'rgba(255,255,255,0.5)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontFamily: 'var(--font-body)',
        transition: 'all 0.15s',
        textAlign: 'left',
        width: '100%',
    },
    submenuItemActive: {
        background: 'var(--bg-sidebar-active)',
        color: 'var(--primary)',
        fontWeight: 600,
    },
    userArea: {
        padding: '16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
    },
    userInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    userAvatar: {
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 700,
        fontSize: '0.9rem',
        fontFamily: 'var(--font-heading)',
        flexShrink: 0,
    },
    userName: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: '0.85rem',
        fontWeight: 600,
    },
    userCompany: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.7rem',
    },
    logoutBtn: {
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(244,67,54,0.1)',
        border: '1px solid rgba(244,67,54,0.2)',
        borderRadius: 'var(--radius-sm)',
        color: '#ef9a9a',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontFamily: 'var(--font-body)',
        transition: 'all 0.2s',
        textAlign: 'center',
    },
};
