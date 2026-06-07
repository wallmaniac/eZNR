'use client';

// ============================================================================
// SYSTEM MONITOR — Admin & User notification system
// Admin: system health, usage growth, security
// User: certificate/equipment/document expiry, missing data
// ============================================================================

import { getAll, COLLECTIONS, formatDate } from './dataStore';
import { callFirebaseFunction } from '@/lib/firebaseCallable';
import { getCitation } from '@/lib/lawConfig';

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
    fireExpiryEnabled: true,
    fireExpiryDays: 30,
    evacExpiryEnabled: true,
    evacExpiryDays: 30,

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

export async function apiSaveNotifSettings(cId, notifSettings) {
    if (!cId) return false;
    try {
        await callFirebaseFunction('saveNotifSettings', { companyId: cId, settings: notifSettings });
        return true;
    } catch (err) {
        console.error('[eZNR] Failed to sync notif_settings to Firestore:', err);
        return false;
    }
}

export function saveAppSettings(settings) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('eznr_app_settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('appSettingsUpdated'));
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
                titleKey: 'notif_db_critical_title',
                titleArgs: [totalRecords.toLocaleString()],
                messageKey: 'notif_db_critical_msg',
            });
        } else if (totalRecords >= settings.adminDbWarnThreshold) {
            notifications.push({
                id: 'admin_db_warn',
                severity: 'warning',
                category: 'system',
                icon: '⚠️',
                title: `Baza podataka: ${totalRecords.toLocaleString()} zapisa`,
                message: `Baza raste. Optimizacija potrebna na ${settings.adminDbCriticalThreshold.toLocaleString()} zapisa.`,
                titleKey: 'notif_db_warn_title',
                titleArgs: [totalRecords.toLocaleString()],
                messageKey: 'notif_db_warn_msg',
                messageArgs: [settings.adminDbCriticalThreshold.toLocaleString()],
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
                    titleKey: 'notif_companies_milestone_title',
                    titleArgs: [allCompanies.length],
                    messageKey: 'notif_companies_milestone_msg',
                    messageArgs: [allCompanies.length],
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
                    titleKey: 'notif_users_milestone_title',
                    titleArgs: [allUsers.length],
                    messageKey: 'notif_users_milestone_msg',
                    messageArgs: [allUsers.length],
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
                titleKey: 'notif_workers_critical_title',
                titleArgs: [allWorkers.length.toLocaleString()],
                messageKey: 'notif_workers_critical_msg',
            });
        } else if (allWorkers.length >= 5000) {
            notifications.push({
                id: 'admin_workers_warn',
                severity: 'warning',
                category: 'system',
                icon: '📊',
                title: `${allWorkers.length.toLocaleString()} radnika u sustavu`,
                message: 'Planirajte optimizaciju kada dosegne 20.000.',
                titleKey: 'notif_workers_warn_title',
                titleArgs: [allWorkers.length.toLocaleString()],
                messageKey: 'notif_workers_warn_msg',
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
        titleKey: 'notif_app_version_title',
        titleArgs: [APP_VERSION],
        messageKey: 'notif_app_version_msg',
        messageArgs: [APP_BUILD_DATE, CHANGELOG[0]?.changes?.length || 0],
        actionLabel: 'Pogledaj changelog',
        actionLabelKey: 'notif_view_changelog',
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
    const activeCompany = companyId && companyId !== 'all' ? allCompanies.find(c => c.id === companyId) : null;
    const country = activeCompany?.country || 'BA';

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
                id: 'user_cert_expired_' + companyId,
                severity: 'urgent',
                category: 'certificates',
                icon: '🚨',
                title: `${expired} uvjerenja su istekla!`,
                message: `Ukupno ${expired} radničkih uvjerenja su istekla i trebaju hitnu obnovu.`,
                titleKey: 'notif_cert_expired_title',
                titleArgs: [expired],
                messageKey: 'notif_cert_expired_msg',
                messageArgs: [expired],
                actionLabel: 'Pogledaj uvjerenja',
                actionLabelKey: 'notif_view_certs',
                actionUrl: '/dashboard/worker-certificates',
            }, allCerts.find(c => new Date(c.vrijediDo) < today) || {}));
        }
        if (urgentCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_cert_urgent_' + companyId,
                severity: 'urgent',
                category: 'certificates',
                icon: '⏰',
                title: `${urgentCount} uvjerenja ističu za manje od 7 dana`,
                message: `Hitno obnovite ${urgentCount} uvjerenja.`,
                titleKey: 'notif_cert_urgent_title',
                titleArgs: [urgentCount],
                messageKey: 'notif_cert_urgent_msg',
                messageArgs: [urgentCount],
                actionLabel: 'Pogledaj uvjerenja',
                actionLabelKey: 'notif_view_certs',
                actionUrl: '/dashboard/worker-certificates',
            }, allCerts.find(c => { const d = Math.floor((new Date(c.vrijediDo) - today) / 86400000); return d >= 0 && d <= 7; }) || {}));
        }
        if (warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_cert_warning_' + companyId,
                severity: 'warning',
                category: 'certificates',
                icon: '📋',
                title: `${warningCount} uvjerenja ističu u narednih ${settings.certExpiryDays} dana`,
                message: `Planirajte obnovu za ${warningCount} uvjerenja.`,
                titleKey: 'notif_cert_warning_title',
                titleArgs: [warningCount, settings.certExpiryDays],
                messageKey: 'notif_cert_warning_msg',
                messageArgs: [warningCount],
                actionLabel: 'Pogledaj uvjerenja',
                actionLabelKey: 'notif_view_certs',
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
                id: 'user_equip_expired_' + companyId,
                severity: 'urgent',
                category: 'equipment',
                icon: '🔧',
                title: `${expired} oprema sa isteklim pregledom!`,
                message: `${expired} komada radne opreme ima istekli rok pregleda.`,
                titleKey: 'notif_equip_expired_title',
                titleArgs: [expired],
                messageKey: 'notif_equip_expired_msg',
                messageArgs: [expired],
                actionLabel: 'Pogledaj opremu',
                actionLabelKey: 'notif_view_equip',
                actionUrl: '/dashboard/equipment',
            }, allEquipment.find(e => new Date(e.iduci) < today) || {}));
        }
        if (urgentCount + warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_equip_warning_' + companyId,
                severity: 'warning',
                category: 'equipment',
                icon: '⚙️',
                title: `${urgentCount + warningCount} pregledi opreme ističu uskoro`,
                message: `${urgentCount} hitno (7 dana), ${warningCount} uskoro (${settings.equipExpiryDays} dana).`,
                titleKey: 'notif_equip_warning_title',
                titleArgs: [urgentCount + warningCount],
                messageKey: 'notif_equip_warning_msg',
                messageArgs: [urgentCount, warningCount, settings.equipExpiryDays],
                actionLabel: 'Pogledaj opremu',
                actionLabelKey: 'notif_view_equip',
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
                id: 'user_docs_expired_' + companyId,
                severity: 'urgent',
                category: 'documents',
                icon: '📄',
                title: `${expired} dokumenta su istekla!`,
                message: `${expired} dokumenta poslodavca su istekla i trebaju obnovu.`,
                titleKey: 'notif_docs_expired_title',
                titleArgs: [expired],
                messageKey: 'notif_docs_expired_msg',
                messageArgs: [expired],
                actionLabel: 'Pogledaj dokumenta',
                actionLabelKey: 'notif_view_docs',
                actionUrl: '/dashboard/employer-docs',
            }, allDocs.find(d => new Date(d.datumIsteka) < today) || {}));
        }
        if (warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_docs_warning_' + companyId,
                severity: 'warning',
                category: 'documents',
                icon: '📑',
                title: `${warningCount} dokumenta ističu uskoro`,
                message: `${warningCount} dokumenta ističu u narednih ${settings.docExpiryDays} dana.`,
                titleKey: 'notif_docs_warning_title',
                titleArgs: [warningCount],
                messageKey: 'notif_docs_warning_msg',
                messageArgs: [warningCount, settings.docExpiryDays],
                actionLabel: 'Pogledaj dokumenta',
                actionLabelKey: 'notif_view_docs',
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
                id: 'user_med_expired_' + companyId, severity: 'urgent', category: 'medical', icon: '🩺',
                title: medExpired + ' ljekarskih pregleda isteklo!',
                message: `Zakonska obaveza poslodavca - zakaz. preglede hitno (${getCitation(country, 'medical')}).`,
                titleKey: 'notif_med_expired_title',
                titleArgs: [medExpired],
                messageKey: 'notif_med_expired_msg',
                messageArgs: [getCitation(country, 'medical')],
                actionLabel: 'Pregledi', actionLabelKey: 'notif_view_med', actionUrl: '/dashboard/medical-exams', path: '/dashboard/medical-exams',
            }, medExpItem || {}));
        }
        if (medUrgent > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_med_urgent_' + companyId, severity: 'urgent', category: 'medical', icon: '🩺',
                title: medUrgent + ' ljekarskih pregleda ističe za 7 dana',
                message: 'Hitno zakazati preglede.',
                titleKey: 'notif_med_urgent_title',
                titleArgs: [medUrgent],
                messageKey: 'notif_med_urgent_msg',
                actionLabel: 'Pregledi', actionLabelKey: 'notif_view_med', actionUrl: '/dashboard/medical-exams', path: '/dashboard/medical-exams',
            }, medUrgItem || {}));
        }
        if (medWarn > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_med_warning_' + companyId, severity: 'warning', category: 'medical', icon: '🩺',
                title: medWarn + ' ljekarskih pregleda uskoro ističe',
                message: 'Planirajte preglede za ' + medWarn + ' radnika.',
                titleKey: 'notif_med_warning_title',
                titleArgs: [medWarn],
                messageKey: 'notif_med_warning_msg',
                messageArgs: [medWarn],
                actionLabel: 'Pregledi', actionLabelKey: 'notif_view_med', actionUrl: '/dashboard/medical-exams', path: '/dashboard/medical-exams',
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
                id: 'user_fleet_expired_' + companyId, severity: 'urgent', category: 'fleet', icon: '🚨',
                title: `${expired} vozila zahtijeva hitnu akciju!`,
                message: `Registracija, tehnički pregled ili osiguranje je isteklo za ${expired} vozila.`,
                titleKey: 'notif_fleet_expired_title',
                titleArgs: [expired],
                messageKey: 'notif_fleet_expired_msg',
                messageArgs: [expired],
                actionLabel: 'Vozni park', actionLabelKey: 'notif_view_fleet', actionUrl: '/dashboard/fleet',
            }, allVehicles[0]));
        }
        if (urgentCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_fleet_urgent_' + companyId, severity: 'urgent', category: 'fleet', icon: '🚙',
                title: `${urgentCount} vozila ističe za 7 dana!`,
                message: `Registracija, pregled ili osiguranje ističe uskoro.`,
                titleKey: 'notif_fleet_urgent_title',
                titleArgs: [urgentCount],
                messageKey: 'notif_fleet_urgent_msg',
                actionLabel: 'Vozni park', actionLabelKey: 'notif_view_fleet', actionUrl: '/dashboard/fleet',
            }, allVehicles[0]));
        }
        if (warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_fleet_warning_' + companyId, severity: 'warning', category: 'fleet', icon: '🚗',
                title: `${warningCount} vozila ističe u narednih ${settings.fleetExpiryDays} dana`,
                message: `Planirajte registraciju i tehnički za ${warningCount} vozila.`,
                titleKey: 'notif_fleet_warning_title',
                titleArgs: [warningCount, settings.fleetExpiryDays],
                messageKey: 'notif_fleet_warning_msg',
                messageArgs: [warningCount],
                actionLabel: 'Vozni park', actionLabelKey: 'notif_view_fleet', actionUrl: '/dashboard/fleet',
            }, allVehicles[0]));
        }
    }

    // ── Fire Protection (Extinguishers & Hydrants) ──
    if (settings.fireExpiryEnabled ?? true) {
        const extinguishers = filterByCompany(getAll(COLLECTIONS.FIRE_EXTINGUISHERS));
        const hydrants = filterByCompany(getAll(COLLECTIONS.HYDRANTS));
        
        let expired = 0;
        let warningCount = 0;
        
        const checkExpiry = (dateStr) => {
            if (!dateStr) return null;
            const days = Math.floor((new Date(dateStr) - today) / 86400000);
            if (days < 0) return 'expired';
            if (days <= (settings.fireExpiryDays || 30)) return 'warning';
            return null;
        };

        extinguishers.forEach(ext => {
            const status = checkExpiry(ext.sljedeciServis);
            if (status === 'expired' || ext.status === 'neispravan') expired++;
            else if (status === 'warning') warningCount++;
        });

        hydrants.forEach(hyd => {
            const status = checkExpiry(hyd.sljedeciPregled);
            if (status === 'expired' || hyd.status === 'neispravan') expired++;
            else if (status === 'warning') warningCount++;
        });

        if (expired > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_fire_expired_' + companyId,
                severity: 'urgent',
                category: 'equipment',
                icon: '🧯',
                title: `${expired} stavki protupožarne opreme je isteklo ili je neispravno!`,
                message: `Ukupno ${expired} vatrogasnih aparata/hidranata zahtijeva hitan servis ili pregled.`,
                titleKey: 'notif_fire_expired_title',
                titleArgs: [expired],
                messageKey: 'notif_fire_expired_msg',
                messageArgs: [expired],
                actionLabel: 'Pogledaj ZOP',
                actionLabelKey: 'notif_view_fire',
                actionUrl: '/dashboard/fire-protection',
            }, extinguishers[0] || hydrants[0] || {}));
        }

        if (warningCount > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_fire_warning_' + companyId,
                severity: 'warning',
                category: 'equipment',
                icon: '🧯',
                title: `${warningCount} pregleda protupožarne opreme ističe uskoro`,
                message: `Planirajte servis za ${warningCount} vatrogasnih aparata/hidranata u narednih ${settings.fireExpiryDays || 30} dana.`,
                titleKey: 'notif_fire_warning_title',
                titleArgs: [warningCount],
                messageKey: 'notif_fire_warning_msg',
                messageArgs: [warningCount, settings.fireExpiryDays || 30],
                actionLabel: 'Pogledaj ZOP',
                actionLabelKey: 'notif_view_fire',
                actionUrl: '/dashboard/fire-protection',
            }, extinguishers.find(e => checkExpiry(e.sljedeciServis) === 'warning') || hydrants.find(h => checkExpiry(h.sljedeciPregled) === 'warning') || {}));
        }
    }

    // ── Evacuation (Plans & Drills) ──
    if (settings.evacExpiryEnabled ?? true) {
        const plans = filterByCompany(getAll(COLLECTIONS.EVACUATION_PLANS));
        const drills = filterByCompany(getAll(COLLECTIONS.EVACUATION_DRILLS));
        
        let expiredPlans = 0;
        let warningPlans = 0;
        
        const checkExpiry = (dateStr) => {
            if (!dateStr) return null;
            const days = Math.floor((new Date(dateStr) - today) / 86400000);
            if (days < 0) return 'expired';
            if (days <= (settings.evacExpiryDays || 30)) return 'warning';
            return null;
        };

        plans.forEach(plan => {
            const status = checkExpiry(plan.datumRevizije);
            if (status === 'expired' || plan.status === 'revizija') expiredPlans++;
            else if (status === 'warning') warningPlans++;
        });

        if (expiredPlans > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_evac_plan_expired_' + companyId,
                severity: 'urgent',
                category: 'documents',
                icon: '🚨',
                title: `${expiredPlans} planova evakuacije zahtijeva reviziju!`,
                message: `${expiredPlans} planova evakuacije je prošlo rok revizije.`,
                titleKey: 'notif_evac_plan_expired_title',
                titleArgs: [expiredPlans],
                messageKey: 'notif_evac_plan_expired_msg',
                messageArgs: [expiredPlans],
                actionLabel: 'Pogledaj evakuaciju',
                actionLabelKey: 'notif_view_evac',
                actionUrl: '/dashboard/evacuation',
            }, plans.find(p => checkExpiry(p.datumRevizije) === 'expired' || p.status === 'revizija') || {}));
        }

        if (warningPlans > 0) {
            notifications.push(addCompanyBadge({
                id: 'user_evac_plan_warning_' + companyId,
                severity: 'warning',
                category: 'documents',
                icon: '🚨',
                title: `${warningPlans} planova evakuacije pred revizijom`,
                message: `Planirajte reviziju za ${warningPlans} planova evakuacije u narednih ${settings.evacExpiryDays || 30} dana.`,
                titleKey: 'notif_evac_plan_warning_title',
                titleArgs: [warningPlans],
                messageKey: 'notif_evac_plan_warning_msg',
                messageArgs: [warningPlans, settings.evacExpiryDays || 30],
                actionLabel: 'Pogledaj evakuaciju',
                actionLabelKey: 'notif_view_evac',
                actionUrl: '/dashboard/evacuation',
            }, plans.find(p => checkExpiry(p.datumRevizije) === 'warning') || {}));
        }

        // ── Evacuation Drills ──
        const lastDrill = drills.length > 0 
            ? drills.sort((a, b) => (b.datumVjezbe || '').localeCompare(a.datumVjezbe || ''))[0] 
            : null;
        
        if (!lastDrill) {
            notifications.push(addCompanyBadge({
                id: 'user_evac_drill_missing_' + companyId,
                severity: 'urgent',
                category: 'documents',
                icon: '🏃',
                title: 'Nije zabilježena nijedna vježba evakuacije!',
                message: 'Zakonska je obaveza provođenje vježbe evakuacije svake 2 godine.',
                titleKey: 'notif_evac_drill_missing_title',
                messageKey: 'notif_evac_drill_missing_msg',
                actionLabel: 'Vježbe evakuacije',
                actionLabelKey: 'notif_view_evac',
                actionUrl: '/dashboard/evacuation-drills',
            }, {}));
        } else {
            const daysSinceDrill = Math.floor((today - new Date(lastDrill.datumVjezbe)) / 86400000);
            if (daysSinceDrill > 730) {
                notifications.push(addCompanyBadge({
                    id: 'user_evac_drill_expired_' + companyId,
                    severity: 'urgent',
                    category: 'documents',
                    icon: '🏃',
                    title: 'Vježba evakuacije je istekla!',
                    message: `Zadnja vježba evakuacije je održana prije ${daysSinceDrill} dana (zakonski rok je 2 godine).`,
                    titleKey: 'notif_evac_drill_expired_title',
                    messageKey: 'notif_evac_drill_expired_msg',
                    messageArgs: [daysSinceDrill],
                    actionLabel: 'Vježbe evakuacije',
                    actionLabelKey: 'notif_view_evac',
                    actionUrl: '/dashboard/evacuation-drills',
                }, lastDrill));
            } else if (daysSinceDrill > 670) {
                const daysRemaining = 730 - daysSinceDrill;
                notifications.push(addCompanyBadge({
                    id: 'user_evac_drill_warning_' + companyId,
                    severity: 'warning',
                    category: 'documents',
                    icon: '🏃',
                    title: 'Vježba evakuacije ističe uskoro',
                    message: `Vježba evakuacije ističe za ${daysRemaining} dana (rok od 2 godine ističe uskoro).`,
                    titleKey: 'notif_evac_drill_warning_title',
                    messageKey: 'notif_evac_drill_warning_msg',
                    messageArgs: [daysRemaining],
                    actionLabel: 'Vježbe evakuacije',
                    actionLabelKey: 'notif_view_evac',
                    actionUrl: '/dashboard/evacuation-drills',
                }, lastDrill));
            }
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
                id: 'user_no_certs_' + companyId,
                severity: 'info',
                category: 'certificates',
                icon: '📝',
                title: `${missing.length} radnika bez uvjerenja`,
                message: `${missing.length} aktivnih radnika nema uneseno niti jedno uvjerenje.`,
                titleKey: 'notif_no_certs_title',
                titleArgs: [missing.length],
                messageKey: 'notif_no_certs_msg',
                messageArgs: [missing.length],
                actionLabel: 'Pogledaj radnike',
                actionLabelKey: 'notif_view_workers',
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
                id: 'user_no_ppe_' + companyId,
                severity: 'info',
                category: 'ppe',
                icon: '🦺',
                title: `${missing.length} radnika bez zaštitne opreme`,
                message: `${missing.length} aktivnih radnika nema dodijeljenu zaštitnu opremu.`,
                titleKey: 'notif_no_ppe_title',
                titleArgs: [missing.length],
                messageKey: 'notif_no_ppe_msg',
                messageArgs: [missing.length],
                actionLabel: 'Pogledaj radnike',
                actionLabelKey: 'notif_view_workers',
                actionUrl: '/dashboard/workers',
            }, missing[0]));
        }
    }

    // ── Pending Questionnaires ──
    const allQuestionnaires = filterByCompany(getAll(COLLECTIONS.QUESTIONNAIRES));
    let expiredQ = 0, urgentQ = 0, warningQ = 0;
    let sampleQ = null;
    allQuestionnaires.forEach(q => {
        if (q.predlozak || !q.rokIsteka) return;
        const days = Math.floor((new Date(q.rokIsteka) - today) / (1000 * 60 * 60 * 24));
        if (days < 0) { expiredQ++; if (!sampleQ) sampleQ = q; }
        else if (days <= 7) { urgentQ++; if (!sampleQ) sampleQ = q; }
        else if (days <= 30) { warningQ++; if (!sampleQ) sampleQ = q; }
    });

    if (expiredQ > 0) {
        notifications.push(addCompanyBadge({
            id: 'user_quest_expired_' + companyId,
            severity: 'urgent',
            category: 'documents',
            icon: '❓',
            title: `${expiredQ} upitnika je isteklo!`,
            message: `Rok za ispunjavanje ${expiredQ} upitnika je prošao.`,
            titleKey: 'notif_quest_expired_title',
            titleArgs: [expiredQ],
            messageKey: 'notif_quest_expired_msg',
            messageArgs: [expiredQ],
            actionLabel: 'Pogledaj upitnike',
            actionLabelKey: 'notif_view_quests',
            actionUrl: '/dashboard/questionnaires',
        }, sampleQ || {}));
    }
    if (urgentQ > 0) {
        notifications.push(addCompanyBadge({
            id: 'user_quest_urgent_' + companyId,
            severity: 'urgent',
            category: 'documents',
            icon: '❓',
            title: `${urgentQ} upitnika ističe za manje od 7 dana`,
            message: `Planirajte ispunjavanje ili produženje za ${urgentQ} upitnika.`,
            titleKey: 'notif_quest_urgent_title',
            titleArgs: [urgentQ],
            messageKey: 'notif_quest_urgent_msg',
            messageArgs: [urgentQ],
            actionLabel: 'Pogledaj upitnike',
            actionLabelKey: 'notif_view_quests',
            actionUrl: '/dashboard/questionnaires',
        }, sampleQ || {}));
    }
    if (warningQ > 0) {
        notifications.push(addCompanyBadge({
            id: 'user_quest_warning_' + companyId,
            severity: 'warning',
            category: 'documents',
            icon: '❓',
            title: `${warningQ} upitnika ističe uskoro`,
            message: `${warningQ} upitnika ističe u narednih 30 dana.`,
            titleKey: 'notif_quest_warning_title',
            titleArgs: [warningQ],
            messageKey: 'notif_quest_warning_msg',
            messageArgs: [warningQ],
            actionLabel: 'Pogledaj upitnike',
            actionLabelKey: 'notif_view_quests',
            actionUrl: '/dashboard/questionnaires',
        }, sampleQ || {}));
    }

    // ── ZNR Compliance Alerts (BiH/FBiH & Croatia legal rules) ──
    const activeWorkers = filterByCompany(getAll(COLLECTIONS.WORKERS)).filter(w => w.aktivan !== false);
    const workplaces = filterByCompany(getAll(COLLECTIONS.WORKPLACES));
    const allMedExams = filterByCompany(getAll(COLLECTIONS.MEDICAL_EXAMS));
    const nightLogs = filterByCompany(getAll('nightWork') || []);

    activeWorkers.forEach(worker => {
        // Find latest medical exam for this worker
        const workerExams = allMedExams
            .filter(me => me.workerId === worker.id && me.datumPregleda)
            .sort((a, b) => b.datumPregleda.localeCompare(a.datumPregleda));
        
        const latestExam = workerExams[0] || null;
        
        // Expiry calculation helpers
        const hasValidExamInMonths = (months) => {
            if (!latestExam) return false;
            // Check if latest exam date is within N months
            const examDate = new Date(latestExam.datumPregleda);
            const limitDate = new Date();
            limitDate.setMonth(limitDate.getMonth() - months);
            if (examDate < limitDate) return false;
            
            // Check if it has a vrijediDo date that is already passed
            if (latestExam.vrijediDo && new Date(latestExam.vrijediDo) < today) {
                return false;
            }
            return true;
        };

        // Workplace lookup
        const wp = workplaces.find(x => x.id === worker.radnoMjestoId || x.naziv === worker.radnoMjesto);

        // Rule 1: Special Conditions Medical Exam (12-month limit)
        // If worker.posebniUvjeti === true or workplace has posebniUvjetiRada === true
        const isSpecialConditions = worker.posebniUvjeti === true || wp?.posebniUvjetiRada === true;
        if (isSpecialConditions) {
            const hasValid12m = hasValidExamInMonths(12);
            if (!hasValid12m) {
                notifications.push(addCompanyBadge({
                    id: `user_znr_rule1_${worker.id}_${companyId}`,
                    severity: 'urgent',
                    category: 'medical',
                    icon: '🚨',
                    title: `${worker.ime} ${worker.prezime} — Nedostaje ljekarski pregled (posebni uvjeti)`,
                    message: `Radnik radi u posebnim uvjetima rada, a nema važeći ljekarski pregled u posljednjih 12 mjeseci. Pravni osnov: ${getCitation(country, 'medical')}.`,
                    actionLabel: 'Unesi pregled',
                    actionUrl: `/dashboard/medical-exams?openNew=1&workerId=${worker.id}`,
                }, worker));
            }
        }

        // Rule 2: Computer Work Exam (24-month limit)
        // If workplace has radNaRacunalu === true
        const isComputerWork = wp?.radNaRacunalu === true;
        if (isComputerWork && !isSpecialConditions) { // Rule 1 takes precedence
            const hasValid24m = hasValidExamInMonths(24);
            if (!hasValid24m) {
                notifications.push(addCompanyBadge({
                    id: `user_znr_rule2_${worker.id}_${companyId}`,
                    severity: 'warning',
                    category: 'medical',
                    icon: '💻',
                    title: `${worker.ime} ${worker.prezime} — Potreban pregled vida (rad na računaru)`,
                    message: `Radnik obavlja rad na računaru, a nema pregled u posljednja 24 mjeseca.`,
                    actionLabel: 'Unesi pregled',
                    actionUrl: `/dashboard/medical-exams?openNew=1&workerId=${worker.id}`,
                }, worker));
            }
        }

        // Rule 3: Night Shift periodic medical exam (12-month limit)
        // If worker has logged entries in nightWork collection
        const hasNightWorkLogs = nightLogs.some(log => log.workerId === worker.id);
        if (hasNightWorkLogs) {
            const hasValid12m = hasValidExamInMonths(12);
            if (!hasValid12m) {
                notifications.push(addCompanyBadge({
                    id: `user_znr_rule3_${worker.id}_${companyId}`,
                    severity: 'urgent',
                    category: 'medical',
                    icon: '🌙',
                    title: `${worker.ime} ${worker.prezime} — Istekao pregled za noćni rad`,
                    message: `Radnik ima evidentiran noćni rad, a nema važeći ljekarski pregled u posljednjih 12 mjeseci. Pravni osnov: ${getCitation(country, 'medicalNight')}.`,
                    actionLabel: 'Unesi pregled',
                    actionUrl: `/dashboard/medical-exams?openNew=1&workerId=${worker.id}`,
                }, worker));
            }
        }
    });

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
