'use client';

// ============================================================================
// SYSTEM MONITOR — Admin & User notification system
// Admin: system health, usage growth, security
// User: certificate/equipment/document expiry, missing data
// ============================================================================

import { getAll, COLLECTIONS, formatDate } from './dataStore';

// ============================================================================
// APP VERSION & CHANGELOG
// ============================================================================

export const APP_VERSION = '1.0.0';
export const APP_BUILD_DATE = '2026-03-01';
export const CHANGELOG = [
    {
        version: '1.0.0', date: '2026-03-01', changes: [
            'Inicijalna verzija aplikacije',
            'Firebase backend integracija',
            'Prijava putem Firebase Auth',
            'Kontrolna ploča sa kalendarom',
            '51 stranica u aplikaciji',
            'Sistem obavijesti za admin i korisnike',
        ]
    },
];

// ============================================================================
// DEFAULT SETTINGS — Used when user hasn't customized anything
// ============================================================================

export const DEFAULT_NOTIFICATION_SETTINGS = {
    // User (Officer) notification settings
    certExpiryEnabled: true,
    certExpiryDays: 30,
    equipExpiryEnabled: true,
    equipExpiryDays: 30,
    docExpiryEnabled: true,
    docExpiryDays: 30,
    workersNoCerts: true,
    workersNoPPE: true,
    calendarWeek: true,
    fleetExpiryEnabled: true,
    fleetExpiryDays: 30,

    // Calendar Settings
    calShowCerts: true,
    calShowEquip: true,
    calShowDoc: true,
    calShowRisk: true,
    calShowMed: true,
    calShowService: true,
    calShowFleet: true,

    // ── Automated Email Notification Settings ──
    // Who receives the daily expiry summary email
    emailNotifEnabled: false,           // Master toggle — off by default until officer sets it up
    emailNotifToCompany: true,          // Send to company email field
    emailNotifToOfficer: true,          // Send to the logged-in officer's email
    emailNotifLang: 'bs',              // 'bs' = Bosnian (primary), 'en' = English, 'bilingual' = both
    // Per-category toggles for email
    emailNotifCerts: true,
    emailNotifEquip: true,
    emailNotifDocs: true,
    emailNotifFleet: true,
    emailNotifMedical: true,
    // Days threshold to include in email (items expiring within N days)
    emailNotifDays: 30,
    // TODO: Add 'hr' (Croatian), 'sl' (Slovenian), 'sr' (Serbian) language options
    //       when those app versions are launched. Update emailNotifLang select options
    //       in settings/page.js and the email template builder in notify-expiry/route.js.

    // Admin-only notification settings
    adminDbSize: true,
    adminDbWarnThreshold: 10000,
    adminDbCriticalThreshold: 50000,
    adminNewCompanies: true,
    adminNewUsers: true,
    adminMilestones: true,
    adminFailedLogins: true,
    adminInactiveCompanies: true,
};

// ============================================================================
// DEFAULT APP SETTINGS
// ============================================================================

export const DEFAULT_APP_SETTINGS = {
    // Display
    dateFormat: 'dd.mm.yyyy',
    recordsPerPage: 25,
    compactView: false,
    animations: true,
    notificationSound: false,
    sidebarOpen: true,
    proactiveZia: true,

    // System (admin only)
    allowRegistration: true,
    requireApproval: false,
    minPasswordLength: 8,
    autoLogoutMinutes: 60,
    googleSignIn: false,
    maxFileSizeMB: 10,
    maintenanceMode: false,
    maintenanceMessage: '',
};

// ============================================================================
// ONE-TIME MIGRATIONS (run silently on load)
// ============================================================================

/** Remove legacy SMTP config — Resend replaced Nodemailer in v1.0.1 */
if (typeof window !== 'undefined') {
    try {
        if (localStorage.getItem('smtpConfig')) {
            localStorage.removeItem('smtpConfig');
            console.log('[eZNR] Cleaned up legacy smtpConfig');
        }
    } catch { /* ignore */ }
}

// ============================================================================
// SETTINGS PERSISTENCE (localStorage)
// ============================================================================

export function getNotificationSettings() {
    if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
    try {
        const saved = JSON.parse(localStorage.getItem('eznr_notif_settings') || 'null');
        return saved ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...saved } : DEFAULT_NOTIFICATION_SETTINGS;
    } catch { return DEFAULT_NOTIFICATION_SETTINGS; }
}

export function saveNotificationSettings(settings) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('eznr_notif_settings', JSON.stringify(settings));
}

export function getAppSettings() {
    if (typeof window === 'undefined') return DEFAULT_APP_SETTINGS;
    try {
        const saved = JSON.parse(localStorage.getItem('eznr_app_settings') || 'null');
        return saved ? { ...DEFAULT_APP_SETTINGS, ...saved } : DEFAULT_APP_SETTINGS;
    } catch { return DEFAULT_APP_SETTINGS; }
}

export function saveAppSettings(settings) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('eznr_app_settings', JSON.stringify(settings));
}

// ============================================================================
// ADMIN NOTIFICATIONS — System-level alerts only
// ============================================================================

export function getAdminNotifications() {
    const notifications = [];
    const settings = getNotificationSettings();

    // Gather stats
    const collectionNames = Object.values(COLLECTIONS);
    let totalRecords = 0;
    const collectionCounts = {};
    collectionNames.forEach(col => {
        const count = getAll(col).length;
        collectionCounts[col] = count;
        totalRecords += count;
    });

    const allCompanies = getAll(COLLECTIONS.COMPANIES);
    const allUsers = getAll(COLLECTIONS.USERS);
    const allWorkers = getAll(COLLECTIONS.WORKERS);

    const stats = {
        totalRecords,
        totalWorkers: allWorkers.length,
        totalCompanies: allCompanies.length,
        totalUsers: allUsers.length,
        collectionCounts,
    };

    // ── Database size alerts ──
    if (settings.adminDbSize) {
        if (totalRecords >= settings.adminDbCriticalThreshold) {
            notifications.push({
                id: 'admin_db_critical',
                severity: 'critical',
                category: 'system',
                icon: '🔴',
                title: `Kritično: ${totalRecords.toLocaleString()} zapisa u bazi`,
                message: `Performanse mogu biti znatno smanjene. Potrebna je optimizacija upita (company-scoped queries). Kontaktirajte podršku.`,
            });
        } else if (totalRecords >= settings.adminDbWarnThreshold) {
            notifications.push({
                id: 'admin_db_warn',
                severity: 'warning',
                category: 'system',
                icon: '⚠️',
                title: `Baza podataka: ${totalRecords.toLocaleString()} zapisa`,
                message: `Baza raste. Optimizacija potrebna na ${settings.adminDbCriticalThreshold.toLocaleString()} zapisa.`,
            });
        }
    }

    // ── Usage milestones ──
    if (settings.adminMilestones) {
        const milestones = [500, 250, 100, 50];
        for (const m of milestones) {
            if (allCompanies.length >= m) {
                notifications.push({
                    id: `admin_companies_${m}`,
                    severity: 'info',
                    category: 'usage',
                    icon: '🏢',
                    title: `${allCompanies.length} kompanija u sustavu`,
                    message: `Milestone dosegnut! Sustav ima ${allCompanies.length} registriranih kompanija.`,
                });
                break;
            }
        }
        for (const m of milestones) {
            if (allUsers.length >= m) {
                notifications.push({
                    id: `admin_users_${m}`,
                    severity: 'info',
                    category: 'usage',
                    icon: '👥',
                    title: `${allUsers.length} korisnika u sustavu`,
                    message: `Milestone dosegnut! Sustav ima ${allUsers.length} korisničkih računa.`,
                });
                break;
            }
        }
    }

    // ── Workers total ──
    if (settings.adminDbSize) {
        if (allWorkers.length >= 20000) {
            notifications.push({
                id: 'admin_workers_critical',
                severity: 'critical',
                category: 'system',
                icon: '🔴',
                title: `${allWorkers.length.toLocaleString()} radnika u sustavu`,
                message: 'Potrebno prebaciti na company-scoped upite za održavanje performansi.',
            });
        } else if (allWorkers.length >= 5000) {
            notifications.push({
                id: 'admin_workers_warn',
                severity: 'warning',
                category: 'system',
                icon: '📊',
                title: `${allWorkers.length.toLocaleString()} radnika u sustavu`,
                message: 'Planirajte optimizaciju kada dosegne 20.000.',
            });
        }
    }

    // ── App version notification ──
    notifications.push({
        id: 'admin_version',
        severity: 'info',
        category: 'update',
        icon: '🚀',
        title: `Aplikacija v${APP_VERSION}`,
        message: `Zadnje ažuriranje: ${APP_BUILD_DATE}. ${CHANGELOG[0]?.changes?.length || 0} promjena.`,
        actionLabel: 'Pogledaj changelog',
        actionUrl: '/dashboard/settings?tab=system',
    });

    const severityOrder = { critical: 0, urgent: 1, warning: 2, info: 3 };
    notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return { notifications, stats };
}

// ============================================================================
// USER NOTIFICATIONS — Work-related alerts only
// ============================================================================

export function getUserNotifications(companyId, userCompanyIds = []) {
    const notifications = [];
    const settings = getNotificationSettings();
    const today = new Date();

    const allCompanies = getAll(COLLECTIONS.COMPANIES);
    const getCompName = (id) => allCompanies.find(c => c.id === id)?.skraceniNaziv || allCompanies.find(c => c.id === id)?.naziv || '';

    // Filter data by company if provided
    const filterByCompany = (items) => {
        if (!companyId || companyId === 'all') {
            if (userCompanyIds.length > 0) {
                return items.filter(i => !i.companyId || userCompanyIds.includes(i.companyId));
            }
            return items;
        }
        return items.filter(i => !i.companyId || i.companyId === companyId);
    };

    const addCompanyBadge = (n, item) => {
        if ((companyId === 'all' || !companyId) && item.companyId) {
            const cName = getCompName(item.companyId);
            if (cName) return { ...n, companyName: cName };
        }
        return n;
    };

    // ── Certificate expiry ──
    if (settings.certExpiryEnabled) {
        const allCerts = filterByCompany(getAll(COLLECTIONS.CERTIFICATES));
        let expired = 0, urgentCount = 0, warningCount = 0;

        allCerts.forEach(cert => {
            if (!cert.vrijediDo) return;
            const days = Math.floor((new Date(cert.vrijediDo) - today) / (1000 * 60 * 60 * 24));
            if (days < 0) expired++;
            else if (days <= 7) urgentCount++;
            else if (days <= settings.certExpiryDays) warningCount++;
        });

        if (expired > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_cert_expired',
                severity: 'urgent',
                category: 'certificates',
                icon: '🚨',
                title: `${expired} uvjerenja su istekla!`,
                message: `Ukupno ${expired} radničkih uvjerenja su istekla i trebaju hitnu obnovu.`,
                actionLabel: 'Pogledaj uvjerenja',
                actionUrl: '/dashboard/worker-certificates',
            }, allCerts.find(c => new Date(c.vrijediDo) < today) || {}));
        }
        if (urgentCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_cert_urgent',
                severity: 'urgent',
                category: 'certificates',
                icon: '⏰',
                title: `${urgentCount} uvjerenja ističu za manje od 7 dana`,
                message: `Hitno obnovite ${urgentCount} uvjerenja.`,
                actionLabel: 'Pogledaj uvjerenja',
                actionUrl: '/dashboard/worker-certificates',
            }, allCerts.find(c => { const d = Math.floor((new Date(c.vrijediDo) - today) / 86400000); return d >= 0 && d <= 7; }) || {}));
        }
        if (warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_cert_warning',
                severity: 'warning',
                category: 'certificates',
                icon: '📋',
                title: `${warningCount} uvjerenja ističu u narednih ${settings.certExpiryDays} dana`,
                message: `Planirajte obnovu za ${warningCount} uvjerenja.`,
                actionLabel: 'Pogledaj uvjerenja',
                actionUrl: '/dashboard/worker-certificates',
            }, allCerts.find(c => { const d = Math.floor((new Date(c.vrijediDo) - today) / 86400000); return d > 7 && d <= settings.certExpiryDays; }) || {}));
        }
    }

    // ── Equipment inspection ──
    if (settings.equipExpiryEnabled) {
        const allEquipment = filterByCompany(getAll(COLLECTIONS.EQUIPMENT));
        let expired = 0, urgentCount = 0, warningCount = 0;

        allEquipment.forEach(eq => {
            if (!eq.iduci) return;
            const days = Math.floor((new Date(eq.iduci) - today) / (1000 * 60 * 60 * 24));
            if (days < 0) expired++;
            else if (days <= 7) urgentCount++;
            else if (days <= settings.equipExpiryDays) warningCount++;
        });

        if (expired > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_equip_expired',
                severity: 'urgent',
                category: 'equipment',
                icon: '🔧',
                title: `${expired} oprema sa isteklim pregledom!`,
                message: `${expired} komada radne opreme ima istekli rok pregleda.`,
                actionLabel: 'Pogledaj opremu',
                actionUrl: '/dashboard/equipment',
            }, allEquipment.find(e => new Date(e.iduci) < today) || {}));
        }
        if (urgentCount + warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_equip_warning',
                severity: 'warning',
                category: 'equipment',
                icon: '⚙️',
                title: `${urgentCount + warningCount} pregledi opreme ističu uskoro`,
                message: `${urgentCount} hitno (7 dana), ${warningCount} uskoro (${settings.equipExpiryDays} dana).`,
                actionLabel: 'Pogledaj opremu',
                actionUrl: '/dashboard/equipment',
            }, allEquipment.find(e => { const d = Math.floor((new Date(e.iduci) - today) / 86400000); return d >= 0 && d <= settings.equipExpiryDays; }) || {}));
        }
    }

    // ── Employer document expiry ──
    if (settings.docExpiryEnabled) {
        const allDocs = filterByCompany(getAll(COLLECTIONS.EMPLOYER_DOCS));
        let expired = 0, warningCount = 0;

        allDocs.forEach(doc => {
            if (!doc.datumIsteka) return;
            const days = Math.floor((new Date(doc.datumIsteka) - today) / (1000 * 60 * 60 * 24));
            if (days < 0) expired++;
            else if (days <= settings.docExpiryDays) warningCount++;
        });

        if (expired > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_docs_expired',
                severity: 'urgent',
                category: 'documents',
                icon: '📄',
                title: `${expired} dokumenta su istekla!`,
                message: `${expired} dokumenta poslodavca su istekla i trebaju obnovu.`,
                actionLabel: 'Pogledaj dokumenta',
                actionUrl: '/dashboard/employer-docs',
            }, allDocs.find(d => new Date(d.datumIsteka) < today) || {}));
        }
        if (warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_docs_warning',
                severity: 'warning',
                category: 'documents',
                icon: '📑',
                title: `${warningCount} dokumenta ističu uskoro`,
                message: `${warningCount} dokumenta ističu u narednih ${settings.docExpiryDays} dana.`,
                actionLabel: 'Pogledaj dokumenta',
                actionUrl: '/dashboard/employer-docs',
            }, allDocs.find(d => { const diff = Math.floor((new Date(d.datumIsteka) - today) / 86400000); return diff >= 0 && diff <= settings.docExpiryDays; }) || {}));
        }
    }
    // -- Medical exam expiry --
    {
        const allMedExams = filterByCompany(getAll(COLLECTIONS.MEDICAL_EXAMS));
        let medExpired = 0, medUrgent = 0, medWarn = 0;
        let medExpItem = null, medUrgItem = null;
        allMedExams.forEach(me => {
            if (!me.vrijediDo) return;
            const days = Math.floor((new Date(me.vrijediDo) - today) / (1000 * 60 * 60 * 24));
            if (days < 0) { medExpired++; if (!medExpItem) medExpItem = me; }
            else if (days <= 7) { medUrgent++; if (!medUrgItem) medUrgItem = me; }
            else if (days <= settings.certExpiryDays) medWarn++;
        });
        if (medExpired > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_med_expired', severity: 'urgent', category: 'medical', icon: '',
                title: medExpired + ' ljekarskih pregleda isteklo!',
                message: 'Zakonska obaveza poslodavca - zakaz. preglede hitno (cl. 44. ZZNA 79/20).',
                actionLabel: 'Pregledi', actionUrl: '/dashboard/medical-exams', path: '/dashboard/medical-exams',
            }, medExpItem || {}));
        }
        if (medUrgent > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_med_urgent', severity: 'urgent', category: 'medical', icon: '',
                title: medUrgent + ' ljekarskih pregleda istice za 7 dana',
                message: 'Hitno zakazati preglede.',
                actionLabel: 'Pregledi', actionUrl: '/dashboard/medical-exams', path: '/dashboard/medical-exams',
            }, medUrgItem || {}));
        }
        if (medWarn > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_med_warning', severity: 'warning', category: 'medical', icon: '',
                title: medWarn + ' ljekarskih pregleda uskoro istice',
                message: 'Planirajte preglede za ' + medWarn + ' radnika.',
                actionLabel: 'Pregledi', actionUrl: '/dashboard/medical-exams', path: '/dashboard/medical-exams',
            }, {}));
        }
    }

    // ── Fleet expiry ──
    if (settings.fleetExpiryEnabled) {
        const allVehicles = filterByCompany(getAll(COLLECTIONS.VEHICLES));
        let expired = 0, urgentCount = 0, warningCount = 0;

        allVehicles.forEach(v => {
            const checkDates = [v.registracijaIstice, v.tehnickiIstice, v.osiguranjeIstice, v.vatrogasniAparatDatum, v.prvaPomocIstice].filter(Boolean);
            let vehicleExpired = false;
            let vehicleUrgent = false;
            let vehicleWarning = false;

            for (const d of checkDates) {
                const days = Math.floor((new Date(d) - today) / 86400000);
                if (days < 0) vehicleExpired = true;
                else if (days <= 7) vehicleUrgent = true;
                else if (days <= settings.fleetExpiryDays) vehicleWarning = true;
            }

            if (vehicleExpired) expired++;
            else if (vehicleUrgent) urgentCount++;
            else if (vehicleWarning) warningCount++;
        });

        if (expired > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_fleet_expired', severity: 'urgent', category: 'fleet', icon: '🚨',
                title: `${expired} vozila zahtijeva hitnu akciju!`,
                message: `Registracija, tehnički pregled ili osiguranje je isteklo za ${expired} vozila.`,
                actionLabel: 'Vozni park', actionUrl: '/dashboard/fleet',
            }, allVehicles[0]));
        }
        if (urgentCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_fleet_urgent', severity: 'urgent', category: 'fleet', icon: '🚙',
                title: `${urgentCount} vozila ističe za 7 dana!`,
                message: `Registracija, pregled ili osiguranje ističe uskoro.`,
                actionLabel: 'Vozni park', actionUrl: '/dashboard/fleet',
            }, allVehicles[0]));
        }
        if (warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_fleet_warning', severity: 'warning', category: 'fleet', icon: '🚗',
                title: `${warningCount} vozila ističe u narednih ${settings.fleetExpiryDays} dana`,
                message: `Planirajte registraciju i tehnički za ${warningCount} vozila.`,
                actionLabel: 'Vozni park', actionUrl: '/dashboard/fleet',
            }, allVehicles[0]));
        }
    }


    // ── Workers without certificates ──
    if (settings.workersNoCerts) {
        const workers = filterByCompany(getAll(COLLECTIONS.WORKERS)).filter(w => w.aktivan !== false);
        const certs = getAll(COLLECTIONS.CERTIFICATES);
        const certWorkerIds = new Set(certs.map(c => c.workerId));
        const missing = workers.filter(w => !certWorkerIds.has(w.id));

        if (missing.length > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_no_certs',
                severity: 'info',
                category: 'certificates',
                icon: '📝',
                title: `${missing.length} radnika bez uvjerenja`,
                message: `${missing.length} aktivnih radnika nema uneseno niti jedno uvjerenje.`,
                actionLabel: 'Pogledaj radnike',
                actionUrl: '/dashboard/workers',
            }, missing[0]));
        }
    }

    // ── Workers without PPE ──
    if (settings.workersNoPPE) {
        const workers = filterByCompany(getAll(COLLECTIONS.WORKERS)).filter(w => w.aktivan !== false);
        const ppe = getAll(COLLECTIONS.PPE_ASSIGNMENTS);
        const ppeWorkerIds = new Set(ppe.map(p => p.workerId));
        const missing = workers.filter(w => !ppeWorkerIds.has(w.id));

        if (missing.length > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_no_ppe',
                severity: 'info',
                category: 'ppe',
                icon: '🦺',
                title: `${missing.length} radnika bez zaštitne opreme`,
                message: `${missing.length} aktivnih radnika nema dodijeljenu zaštitnu opremu.`,
                actionLabel: 'Pogledaj radnike',
                actionUrl: '/dashboard/workers',
            }, missing[0]));
        }
    }

    const severityOrder = { critical: 0, urgent: 1, warning: 2, info: 3 };
    notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return notifications;
}

// ============================================================================
// DISMISSED NOTIFICATIONS
// ============================================================================

export function getDismissedNotifications() {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('eznr_dismissed_notifs') || '[]'); }
    catch { return []; }
}

export function dismissNotification(id) {
    const dismissed = getDismissedNotifications();
    if (!dismissed.includes(id)) {
        dismissed.push(id);
        localStorage.setItem('eznr_dismissed_notifs', JSON.stringify(dismissed));
    }
}

export function clearDismissedNotifications() {
    localStorage.removeItem('eznr_dismissed_notifs');
}

// ============================================================================
// FOR HEADER BELL — Returns filtered active notifications
// ============================================================================

export function getHeaderNotifications(isAdmin, companyId, userCompanyIds = []) {
    const dismissed = getDismissedNotifications();

    if (isAdmin) {
        const { notifications, stats } = getAdminNotifications();
        return {
            notifications: notifications.filter(n => !dismissed.includes(n.id)),
            stats,
        };
    } else {
        const notifications = getUserNotifications(companyId, userCompanyIds);
        return {
            notifications: notifications.filter(n => !dismissed.includes(n.id)),
            stats: null,
        };
    }
}

// ============================================================================
// STATS HELPER — For the admin statistics tab
// ============================================================================

export function getSystemStats() {
    const collectionNames = Object.values(COLLECTIONS);
    let totalRecords = 0;
    const collectionCounts = {};

    collectionNames.forEach(col => {
        const count = getAll(col).length;
        collectionCounts[col] = count;
        totalRecords += count;
    });

    const allWorkers = getAll(COLLECTIONS.WORKERS);
    const allCerts = getAll(COLLECTIONS.CERTIFICATES);
    const allEquipment = getAll(COLLECTIONS.EQUIPMENT);
    const today = new Date();

    // Certificate status
    let activeCerts = 0, expiredCerts = 0;
    allCerts.forEach(c => {
        if (!c.vrijediDo) { activeCerts++; return; }
        new Date(c.vrijediDo) >= today ? activeCerts++ : expiredCerts++;
    });

    // Top companies by worker count
    // Workers may not have companyId in seed data, so we also count via orgUnit names
    const companies = getAll(COLLECTIONS.COMPANIES);
    const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
    const companyWorkerCounts = companies.map(c => {
        // Direct match by companyId
        const directCount = allWorkers.filter(w => w.companyId === c.id).length;
        // Fallback: match by company name in orgUnit
        const companyOrgUnits = orgUnits.filter(ou =>
            ou.naziv?.toLowerCase().includes(c.naziv?.toLowerCase().split(' ')[0]) ||
            ou.naziv?.toLowerCase().includes(c.skraceniNaziv?.toLowerCase())
        ).map(ou => ou.id);
        const fallbackCount = directCount > 0 ? 0 :
            allWorkers.filter(w => companyOrgUnits.includes(w.orgJedinicaId)).length;
        return {
            name: c.skraceniNaziv || c.naziv,
            workers: directCount + fallbackCount,
        };
    }).sort((a, b) => b.workers - a.workers).slice(0, 5);

    return {
        totalRecords,
        totalWorkers: allWorkers.length,
        activeWorkers: allWorkers.filter(w => w.aktivan !== false).length,
        inactiveWorkers: allWorkers.filter(w => !w.aktivan).length,
        totalCompanies: companies.length,
        totalUsers: getAll(COLLECTIONS.USERS).length,
        totalCertificates: allCerts.length,
        activeCerts,
        expiredCerts,
        totalEquipment: allEquipment.length,
        totalDocuments: getAll(COLLECTIONS.EMPLOYER_DOCS).length,
        totalArchive: getAll(COLLECTIONS.DIGITAL_ARCHIVE).length,
        totalOrgUnits: getAll(COLLECTIONS.ORG_UNITS).length,
        totalWorkplaces: getAll(COLLECTIONS.WORKPLACES).length,
        collectionCounts,
        topCompanies: companyWorkerCounts,
    };
}
