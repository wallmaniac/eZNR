'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Icon3D from '@/components/Icon3D';
import { getUIBranding, UI_DEFAULTS } from '@/lib/brandingService';

const menuItems = [
    // ── Top-level standalone ───────────────────────────────────────────────────
    { key: 'dashboard', icon: '📊', path: '/dashboard' },
    { key: 'home',      icon: '🏠', path: '/dashboard/news' },

    // ── 👷 RADNICI — everything about people ──────────────────────────────────
    {
        key: 'grpWorkers', icon: 'Radnici.png',
        children: [
            { key: 'workers',            icon: 'Radnici.png', path: '/dashboard/workers' },
            { key: 'workerCertificates', icon: 'Uvjerenja.png', path: '/dashboard/worker-certificates' },
            { key: 'workerPPE',          icon: 'OZO.png', path: '/dashboard/worker-ppe' },
            { key: 'medicalExams',       icon: 'Ljekarski pregledi.png', path: '/dashboard/medical-exams' },
            { key: 'ekWorkers',          icon: '📇', path: '/dashboard/ek-workers' },
            { key: 'ekPPE',             icon: 'OZO.png', path: '/dashboard/ek-ppe' },
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
        key: 'grpEquipment', icon: 'Oprema.png',
        children: [
            { key: 'equipment',          icon: 'Oprema.png', path: '/dashboard/equipment', label_bs: 'Popis radne opreme i objekata', label_en: 'Equipment & Facilities List' },
            { key: 'ekEquipment',        icon: 'Oprema.png', path: '/dashboard/ek-equipment' },
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
                    { key: 'medicalReferralRA1', icon: 'Ljekarska uputnica.png', path: '/dashboard/referral-ra1' },
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
            { key: 'zapisniciAlat', icon: '📋', path: '/dashboard/zapisnici', label_bs: 'Zapisnici', label_en: 'Zapisnici' },
        ],
    },

    // ── 🚗 VOZNI PARK — fleet management ─────────────────────────────────────
    {
        key: 'grpFleet', icon: 'Vozni park.png',
        children: [
            { key: 'fleetVehicles', icon: 'Vozni park.png', path: '/dashboard/fleet', label_bs: 'Popis vozila', label_en: 'Vehicle List' },
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
            { key: 'doctors',            icon: 'Doktori.png', path: '/dashboard/doctors' },
            { key: 'examTypes',          icon: '📋', path: '/dashboard/exam-types' },
            { key: 'certTypes',          icon: 'Uvjerenja.png', path: '/dashboard/cert-types' },
            { key: 'equipmentTypes',     icon: '🔩', path: '/dashboard/equipment-types' },
            { key: 'ppe',               icon: 'OZO.png', path: '/dashboard/ppe' },
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

// ── Tooltip explanations for sidebar items ──────────────────────────────────
// Shows on hover to help non-technical users understand abbreviations & features.
const SIDEBAR_TOOLTIPS = {
    bs: {
        dashboard: 'Kontrolna ploča — pregled svih ključnih podataka na jednom mjestu',
        home: 'Početna stranica s novostima iz zaštite na radu',
        workers: 'Evidencija svih radnika u firmi',
        workerCertificates: 'Pregled svih uvjerenja (ZOS, ZOP, obuke) za radnike',
        workerPPE: 'Osobna zaštitna oprema — pregled zaduživanja OZO za radnike',
        medicalExams: 'Ljekarski pregledi — evidencija periodičnih i prethodnih pregleda',
        ekWorkers: 'Evidencijski karton (EK) — detaljna kartica svakog radnika za ispis',
        ekPPE: 'Evidencijski karton OZO — kartica osobne zaštitne opreme za ispis',
        trainingMasterBook: 'Matična knjiga osposobljavanja — centralna evidencija obuka',
        orgUnits: 'Organizacijske jedinice — odjeli, sektori, poslovnice',
        workplaces: 'Radna mjesta — definicija radnih mjesta i uvjeta rada',
        workplaceList: 'Popis i pregled svih radnih mjesta',
        sistematizacija: 'Sistematizacija radnih mjesta — raspored radnika po pozicijama',
        addressBook: 'Adresar — kontakti firmi, inspektora, ovlaštenih institucija',
        equipment: 'Ispitivanje radne opreme i objekata — evidencija atestiranja i ispitivanja',
        equipmentExamList: 'Popis radne opreme i objekata s datumima ispitivanja',
        ekEquipment: 'Evidencijski karton (EK) — kartica opreme ili objekta za ispis',
        injuryReport: 'Prijava povrede na radu — obrazac za evidentiranje nesreća',
        annualInjuryReport: 'Godišnji izvještaj o povredama na radu koji se predaje inspekciji',
        diseaseReport: 'Prijava profesionalne bolesti — obrazac za evidentiranje',
        trainings: 'Obuke i prezentacije — kreiranje i prikaz prezentacija za radnike',
        testoviZopZnr: 'Testovi ZOP (zaštita od požara) i ZNR (zaštita na radu) — provjera znanja radnika',
        questionnaires: 'Upitnici i ankete — kreiranje i slanje obrazaca radnicima putem emaila',
        riskAssessment: 'Procjena rizika — analiza opasnosti na radnim mjestima',
        employerDocs: 'Dokumentacija za poslodavca — obavezni dokumenti, pregledi i certifikati',
        requests: 'Zahtjevnice — interni zahtjevi za opremu, obuke i sl.',
        formOIR1: 'Obrazac OIR-1 — prijava povrede na radu (službeni obrazac)',
        medicalReferralRA1: 'Ljekarska uputnica RA-1 — upućivanje radnika na ljekarski pregled',
        formRO1: 'Obrazac RO-1 — prijava profesionalne bolesti',
        formRO2: 'Obrazac RO-2 — evidencija o profesionalnim oboljenjima',
        nightWorkReferral: 'Ljekarska uputnica za noćni rad NR-1 — obavezan pregled za noćne smjene',
        documents: 'Interni akti ZNR — dokumenti iz zaštite na radu',
        parties: 'Stranke — partneri, institucije i ovlaštene firme',
        documentTypes: 'Tipovi dokumenata u ISZNR sistemu',
        digitalSigning: 'Digitalno potpisivanje dokumenata — elektronski potpis',
        examiners: 'Ispitivači — ovlaštena lica za ispitivanje opreme',
        measureEquipment: 'Mjerna i ispitna oprema — instrumenti korišteni pri ispitivanjima',
        grpISZNR: 'ISZNR — Informacioni sistem zaštite na radu (interni akti i dokumenti)',
        obrasciIUputnice: 'Obrasci i uputnice — službeni obrasci (OIR-1, RA-1, RO-1, RO-2, NR-1)',
        fleetVehicles: 'Popis svih vozila u voznom parku',
        fleetAssignments: 'Zaduženja — koji radnik koristi koje vozilo',
        fleetDocuments: 'Dokumentacija vozila — registracije, osiguranja, atesti',
        fleetOrders: 'Putni nalozi — evidencija službenih putovanja',
        excelImport: 'Uvoz/izvoz podataka iz/u Excel tablice',
        converter: 'Konverzija i spajanje dokumenata — PDF, Word, pretvaranje formata',
        digitalArchive: 'Digitalna arhiva — pohranjivanje skeniranih dokumenata',
        zapisniciAlat: 'Zapisnici — kreiranje i upravljanje zapisnicima (npr. o pregledu, o ispitivanju)',
        settings: 'Postavke aplikacije — jezik, tema, korisnički profil',
        adminUsers: 'Upravljanje korisnicima — dodavanje i uređivanje korisničkih računa',
        adminCompanies: 'Upravljanje firmama — dodavanje i uređivanje podataka o firmama',
        // Codebooks
        countries: 'Šifarnik država',
        counties: 'Šifarnik kantona/županija',
        places: 'Šifarnik mjesta i općina',
        certTypes: 'Šifarnik tipova uvjerenja (ZOS, ZOP, obuke)',
        examTypes: 'Šifarnik tipova ljekarskih pregleda',
        equipmentTypes: 'Šifarnik vrsta radne opreme i objekata',
        ppeTypes: 'Šifarnik vrsta osobne zaštitne opreme (OZO)',
        fileTypes: 'Šifarnik vrsta datoteka za digitalni arhiv',
        authorizedCompanies: 'Ovlaštene firme za ispitivanje opreme i provedbu pregleda',
        examiners: 'Ispitivači — ovlaštena fizička lica',
        doctors: 'Doktori medicine rada',
        // Fleet
        grpFleet: 'Vozni park — upravljanje vozilima, putnim nalozima i dokumentacijom',
        // Fire
        grpFireProtection: 'Zaštita od požara — elaborati, planovi, protupožarna oprema',
        grpEvacuation: 'Evakuacija — planovi evakuacije, vježbe, evakuacijske mape',
    },
    en: {
        dashboard: 'Dashboard — overview of all key data in one place',
        home: 'Home page with occupational safety news',
        workers: 'Staff registry for all employees',
        workerCertificates: 'All worker certificates (training, fire safety, etc.)',
        workerPPE: 'Personal Protective Equipment — PPE assignment tracking',
        medicalExams: 'Medical examinations — periodic and pre-employment records',
        ekWorkers: 'Evidence Card (EK) — detailed worker card for printing',
        ekPPE: 'Evidence Card PPE — protective equipment card for printing',
        trainingMasterBook: 'Training Master Book — central training registry',
        ekEquipment: 'Evidence Card (EK) — equipment/facility card for printing',
        testoviZopZnr: 'Fire Protection (ZOP) & Occupational Safety (ZNR) tests — worker knowledge assessment',
        questionnaires: 'Questionnaires & surveys — create and email forms to workers',
        riskAssessment: 'Risk Assessment — workplace hazard analysis',
        formOIR1: 'Form OIR-1 — official work injury report',
        medicalReferralRA1: 'Medical Referral RA-1 — refer workers for medical examination',
        nightWorkReferral: 'Night Work Referral NR-1 — mandatory exam for night shifts',
        grpISZNR: 'ISZNR — Occupational Safety Information System (internal acts)',
        obrasciIUputnice: 'Forms & Referrals — official forms (OIR-1, RA-1, RO-1, RO-2, NR-1)',
        zapisniciAlat: 'Minutes — create and manage inspection/examination records',
        grpFleet: 'Fleet — vehicle management, travel orders, and documentation',
    },
};


export default function Sidebar({ collapsed, onToggle, isMobile = false, mobileOpen = false, onMobileClose }) {
    const { t, lang } = useLanguage();
    const { user, logout, isAdmin, activeCompanyId } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [openMenus, setOpenMenus] = useState({});
    const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
    const [mobileProfileTab, setMobileProfileTab] = useState('profile');

    // ── Mobile Drawer Hooks (moved out of conditional to prevent React #310 crashes) ──
    const mobileScrollRef = useRef(null);
    const mobileSwipeRef = useRef({ startY: 0, active: false });

    // Lock background scroll when drawer is open
    useEffect(() => {
        if (isMobile && mobileOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [isMobile, mobileOpen]);

    // UI Branding — read sidebar logo/text settings from company
    const uiBranding = useMemo(() => {
        try { return getUIBranding(activeCompanyId); } catch { return { sidebarLogoEnabled: false, sidebarText: UI_DEFAULTS.sidebarText, logo: '' }; }
    }, [activeCompanyId]);

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

    // Tooltip helper — returns explanatory text for non-obvious menu items
    const tip = (key) => SIDEBAR_TOOLTIPS[lang]?.[key] || SIDEBAR_TOOLTIPS.bs?.[key] || undefined;

    const toggleMenu = (key) => {
        setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const isActive = (path) => pathname === path;

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    // Auto-close mobile drawer on navigation
    const handleNavClick = () => {
        if (isMobile && onMobileClose) onMobileClose();
    };

    // ── Shared menu rendering (used by both sidebar and drawer) ──
    const renderMenu = (isDrawerMode = false) => {
        // On mobile, filter out the admin menu group — it's accessed via profile modal instead
        const itemsToRender = isDrawerMode ? allMenuItems.filter(i => i.key !== 'admin') : allMenuItems;
        return (
        <nav style={{ ...sidebarStyles.nav, ...(isDrawerMode ? { padding: '8px 12px' } : {}) }}>
            {itemsToRender.map((item) => {
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
                                title={(!isDrawerMode && collapsed) ? t(item.key) : tip(item.key)}
                            >
                                <span style={sidebarStyles.menuIcon}>
                                    <Icon3D name={item.icon} size={(!isDrawerMode && collapsed) ? 24 : 20} />
                                </span>
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
                                title={(!isDrawerMode && collapsed) ? t(item.key) : tip(item.key)}
                            >
                                <span style={sidebarStyles.menuIcon}>
                                    <Icon3D name={item.icon} size={(!isDrawerMode && collapsed) ? 24 : 20} />
                                </span>
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
                                                    title={tip(child.key)}
                                                    style={{
                                                        ...sidebarStyles.submenuItem,
                                                        width: '100%',
                                                        justifyContent: 'space-between',
                                                        ...(childGroupActive ? sidebarStyles.submenuItemActive : {}),
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <Icon3D name={child.icon} size={18} />
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
                                                                title={tip(gc.key)}
                                                                style={{
                                                                    ...sidebarStyles.submenuItem,
                                                                    ...(isActive(gc.path) ? sidebarStyles.submenuItemActive : {}),
                                                                    textDecoration: 'none',
                                                                }}
                                                            >
                                                                <Icon3D name={gc.icon} size={18} />
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
                                            title={tip(child.key)}
                                            style={{
                                                ...sidebarStyles.submenuItem,
                                                ...(isActive(child.path) ? sidebarStyles.submenuItemActive : {}),
                                                textDecoration: 'none',
                                            }}
                                        >
                                            <Icon3D name={child.icon} size={18} />
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
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MOBILE: Bottom-sheet drawer (slides up from bottom, sits above bottom nav)
    // ═══════════════════════════════════════════════════════════════════════════
    if (isMobile) {
        const handleDrawerTouchStart = (e) => {
            const scrollEl = mobileScrollRef.current;
            // Only allow swipe-to-close if scroll is at top (or touch is above the scroll area)
            const atTop = !scrollEl || scrollEl.scrollTop <= 0;
            const touchInScroll = scrollEl && scrollEl.contains(e.target);
            if (atTop || !touchInScroll) {
                mobileSwipeRef.current = { startY: e.touches[0].clientY, active: true };
            } else {
                mobileSwipeRef.current.active = false;
            }
        };

        const handleDrawerTouchMove = (e) => {
            const el = mobileScrollRef.current;
            // Prevent background page scroll
            if (el && el.contains(e.target)) {
                e.stopPropagation();
            }
        };

        const handleDrawerTouchEnd = (e) => {
            if (!mobileSwipeRef.current.active) return;
            const endY = e.changedTouches[0].clientY;
            const dist = endY - mobileSwipeRef.current.startY;
            // If swiped down more than 80px → close
            if (dist > 80) {
                onMobileClose();
            }
            mobileSwipeRef.current.active = false;
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
                            {uiBranding.sidebarLogoEnabled && uiBranding.logo
                              ? <img src={uiBranding.logo} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain', background: '#fff', padding: 2 }} />
                              : <Image src="/logo-icon.png" alt="eZNR" width={36} height={36} style={{ borderRadius: 8 }} />}
                            <div>
                                <div style={sidebarStyles.logoTitle}>eZNR</div>
                                {(uiBranding.sidebarText ?? UI_DEFAULTS.sidebarText) && <div style={sidebarStyles.logoSub}>{uiBranding.sidebarText ?? UI_DEFAULTS.sidebarText}</div>}
                            </div>
                        </Link>
                    </div>

                    {/* Scrollable menu body — overscrollBehavior: contain prevents scroll chaining */}
                    <div
                        ref={mobileScrollRef}
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

                    {/* User footer — user info (opens profile modal) + Odjava button */}
                    <div style={{
                        flexShrink: 0,
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center',
                    }}>
                        {/* Clickable user info → profile modal */}
                        <div
                            onClick={() => setMobileProfileOpen(true)}
                            style={{
                                flex: 1, minWidth: 0,
                                padding: '10px 12px',
                                display: 'flex', alignItems: 'center', gap: 10,
                                cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                        >
                            <div style={{ ...sidebarStyles.userAvatar, boxShadow: isAdmin ? '0 0 0 2px var(--primary)' : 'none' }}>
                                {user?.firstName?.[0] || 'K'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={sidebarStyles.userName}>{user?.firstName} {user?.lastName}</div>
                                <div style={sidebarStyles.userCompany}>
                                    {user?.companyName}
                                    {isAdmin && <span style={{ marginLeft: 6, fontSize: '0.6rem', color: 'var(--primary)', fontWeight: 700 }}>ADMIN</span>}
                                </div>
                            </div>
                        </div>
                        {/* Odjava button — always visible, framed so it's clearly clickable */}
                        <button
                            onClick={() => { onMobileClose?.(); logout(); router.push('/login'); }}
                            style={{
                                flexShrink: 0,
                                margin: '8px 12px',
                                padding: '7px 14px',
                                borderRadius: 10,
                                border: '1px solid rgba(239,68,68,0.45)',
                                background: 'rgba(239,68,68,0.18)',
                                color: '#f87171',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 5,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            🚪 Odjava
                        </button>
                    </div>
                </div>

                {/* ═══ Mobile Profile / Admin Modal ═══ */}
                {mobileProfileOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 600,
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    }}>
                        {/* Backdrop */}
                        <div onClick={() => setMobileProfileOpen(false)} style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                        }} />
                        {/* Modal panel */}
                        <div style={{
                            position: 'relative', width: '100%', maxHeight: '85vh',
                            background: 'var(--bg-card)', borderRadius: '20px 20px 0 0',
                            display: 'flex', flexDirection: 'column',
                            animation: 'slideUpIn 0.25s ease',
                            boxShadow: '0 -8px 48px rgba(0,0,0,0.4)',
                        }}>
                            {/* Header with tabs */}
                            <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ ...sidebarStyles.userAvatar, width: 42, height: 42, fontSize: '1rem' }}>
                                            {user?.firstName?.[0] || 'K'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{user?.firstName} {user?.lastName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email || user?.username}</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setMobileProfileOpen(false)} style={{
                                        width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)',
                                        background: 'var(--bg-input)', color: 'var(--text-muted)', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                                    }}>✕</button>
                                </div>
                                {/* Tabs */}
                                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                                    <button onClick={() => setMobileProfileTab('profile')} style={{
                                        padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                                        fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem',
                                        color: mobileProfileTab === 'profile' ? 'var(--primary)' : 'var(--text-muted)',
                                        borderBottom: mobileProfileTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent',
                                        marginBottom: -1,
                                    }}>👤 {lang === 'bs' ? 'Profil' : 'Profile'}</button>
                                    {isAdmin && (
                                        <button onClick={() => setMobileProfileTab('admin')} style={{
                                            padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                                            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem',
                                            color: mobileProfileTab === 'admin' ? 'var(--primary)' : 'var(--text-muted)',
                                            borderBottom: mobileProfileTab === 'admin' ? '2px solid var(--primary)' : '2px solid transparent',
                                            marginBottom: -1,
                                        }}>👑 {lang === 'bs' ? 'Administracija' : 'Administration'}</button>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px', WebkitOverflowScrolling: 'touch' }}>
                                {mobileProfileTab === 'profile' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{lang === 'bs' ? 'Ime i prezime' : 'Full Name'}</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.firstName} {user?.lastName}</div>
                                        </div>
                                        <div style={{ padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{lang === 'bs' ? 'Email / Korisničko ime' : 'Email / Username'}</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.email || user?.username || '—'}</div>
                                        </div>
                                        <div style={{ padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{lang === 'bs' ? 'Uloga' : 'Role'}</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                {user?.role === 'admin' || user?.role === 'superadmin' ? '👑 Administrator' : '👷 ' + (lang === 'bs' ? 'Stručnjak ZNR' : 'OSH Officer')}
                                            </div>
                                        </div>
                                        <div style={{ padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{lang === 'bs' ? 'Aktivna kompanija' : 'Active Company'}</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.companyName || '—'}</div>
                                        </div>
                                        <button onClick={() => { setMobileProfileOpen(false); onMobileClose?.(); router.push('/dashboard/settings'); }} style={{
                                            width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--border)',
                                            background: 'var(--bg-input)', color: 'var(--text)', cursor: 'pointer',
                                            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center',
                                        }}>⚙️ {lang === 'bs' ? 'Sve postavke' : 'All Settings'}</button>
                                        <button onClick={handleLogout} style={{
                                            width: '100%', padding: '12px', borderRadius: 10,
                                            background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.2)',
                                            color: '#ef5350', cursor: 'pointer',
                                            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center',
                                        }}>🚪 {lang === 'bs' ? 'Odjavi se' : 'Log Out'}</button>
                                    </div>
                                )}
                                {mobileProfileTab === 'admin' && isAdmin && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <button onClick={() => { setMobileProfileOpen(false); onMobileClose?.(); router.push('/dashboard/admin/users'); }} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                                            padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)',
                                            background: 'var(--bg-page)', color: 'var(--text)', cursor: 'pointer',
                                            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem', textAlign: 'left',
                                        }}>
                                            <span style={{ fontSize: '1.3rem' }}>👥</span>
                                            <div>
                                                <div>{lang === 'bs' ? 'Upravljanje korisnicima' : 'User Management'}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{lang === 'bs' ? 'Dodaj, uredi ili obriši korisničke račune' : 'Add, edit or delete user accounts'}</div>
                                            </div>
                                        </button>
                                        <button onClick={() => { setMobileProfileOpen(false); onMobileClose?.(); router.push('/dashboard/admin/companies'); }} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                                            padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)',
                                            background: 'var(--bg-page)', color: 'var(--text)', cursor: 'pointer',
                                            fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem', textAlign: 'left',
                                        }}>
                                            <span style={{ fontSize: '1.3rem' }}>🏢</span>
                                            <div>
                                                <div>{lang === 'bs' ? 'Upravljanje firmama' : 'Company Management'}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{lang === 'bs' ? 'Dodaj, uredi ili obriši podatke o firmama' : 'Add, edit or delete company data'}</div>
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <style>{`
                            @keyframes slideUpIn {
                                from { opacity: 0; transform: translateY(32px); }
                                to   { opacity: 1; transform: translateY(0); }
                            }
                        `}</style>
                    </div>
                )}
            </>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DESKTOP / TABLET: Traditional left sidebar
    // ═══════════════════════════════════════════════════════════════════════════
    // Button lives INSIDE logoArea. When collapsed: only the ☰ button is shown
    // (centered) — 40px button in 40px content area = zero overflow.
    // When expanded: logo on left + ◀ button on right.
    return (
        <aside style={{
            ...sidebarStyles.sidebar,
            width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
        }}>
            {/* Logo + collapse toggle */}
            <div style={{
                ...sidebarStyles.logoArea,
                justifyContent: collapsed ? 'center' : 'space-between',
            }}>
                {!collapsed && (
                    <Link href="/dashboard" style={{ ...sidebarStyles.logoContent, textDecoration: 'none' }}>
                        {uiBranding.sidebarLogoEnabled && uiBranding.logo
                          ? <img src={uiBranding.logo} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 3, marginLeft: -10, marginTop: 4 }} />
                          : <Image src="/logo-icon.png" alt="eZNR" width={66} height={66} style={{ borderRadius: 10, marginLeft: -15, marginTop: 4 }} />}
                        <div style={{ marginLeft: -8 }}>
                            <div style={sidebarStyles.logoTitle}>eZNR</div>
                            {(uiBranding.sidebarText ?? UI_DEFAULTS.sidebarText) && <div style={sidebarStyles.logoSub}>{uiBranding.sidebarText ?? UI_DEFAULTS.sidebarText}</div>}
                        </div>
                    </Link>
                )}
                {/* Collapse toggle — ☰ to expand, ◀ to collapse */}
                <button
                    onClick={onToggle}
                    title={collapsed ? 'Proširi meni' : 'Smanji meni'}
                    style={{
                        ...sidebarStyles.collapseBtn,
                        ...(collapsed ? { width: 40, height: 40, fontSize: '1rem', borderRadius: 10 } : {}),
                    }}
                >
                    {collapsed ? '☰' : '◀'}
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
