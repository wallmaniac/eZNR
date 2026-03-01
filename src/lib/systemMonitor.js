'use client';

// ============================================================================
// SYSTEM MONITOR — Admin notification & health monitoring system
// Generates alerts for admins about system health, expiring data, and usage
// ============================================================================

import { getAll, COLLECTIONS, formatDate } from './dataStore';

// ============================================================================
// THRESHOLDS — Adjust these as the app grows
// ============================================================================

const THRESHOLDS = {
    // Performance thresholds
    WORKERS_PER_COMPANY_WARN: 500,      // Warn when a company exceeds this
    WORKERS_PER_COMPANY_CRITICAL: 2000,  // Critical alert
    TOTAL_WORKERS_WARN: 5000,            // Total workers across all companies
    TOTAL_WORKERS_CRITICAL: 20000,       // Time to optimize queries
    TOTAL_RECORDS_WARN: 10000,           // Total records across all collections
    TOTAL_RECORDS_CRITICAL: 50000,       // Definitely time to optimize

    // Certificate/deadline thresholds (days)
    CERT_EXPIRY_WARNING_DAYS: 30,        // Warn 30 days before expiry
    CERT_EXPIRY_URGENT_DAYS: 7,          // Urgent at 7 days
    EQUIPMENT_EXPIRY_WARNING_DAYS: 30,
    EQUIPMENT_EXPIRY_URGENT_DAYS: 7,
    EMPLOYER_DOC_EXPIRY_WARNING_DAYS: 30,

    // Usage thresholds
    COMPANIES_WARN: 100,                 // Company count warnings
    COMPANIES_CRITICAL: 500,
    USERS_WARN: 100,
    USERS_CRITICAL: 300,

    // Storage (estimated, since we can't check Firebase directly)
    PHOTOS_WARN: 1000,                   // Number of workers with photos
    ARCHIVE_FILES_WARN: 5000,            // Digital archive files
};

// ============================================================================
// APP VERSION — Update this when deploying new features
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
        ]
    },
];

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    URGENT: 'urgent',
    CRITICAL: 'critical',
};

const CATEGORY = {
    SYSTEM: 'system',
    SECURITY: 'security',
    CERTIFICATES: 'certificates',
    EQUIPMENT: 'equipment',
    DOCUMENTS: 'documents',
    USAGE: 'usage',
    UPDATE: 'update',
};

// ============================================================================
// MAIN MONITORING FUNCTION
// ============================================================================

export function runSystemCheck() {
    const notifications = [];
    const stats = {};

    // ── 1. Collect statistics ──
    const allWorkers = getAll(COLLECTIONS.WORKERS);
    const allCompanies = getAll(COLLECTIONS.COMPANIES);
    const allUsers = getAll(COLLECTIONS.USERS);
    const allCerts = getAll(COLLECTIONS.CERTIFICATES);
    const allEquipment = getAll(COLLECTIONS.EQUIPMENT);
    const allEmployerDocs = getAll(COLLECTIONS.EMPLOYER_DOCS);
    const allArchive = getAll(COLLECTIONS.DIGITAL_ARCHIVE);
    const allOrgUnits = getAll(COLLECTIONS.ORG_UNITS);
    const allWorkplaces = getAll(COLLECTIONS.WORKPLACES);

    // Count total records across all collections
    const collectionNames = Object.values(COLLECTIONS);
    let totalRecords = 0;
    const collectionCounts = {};
    collectionNames.forEach(col => {
        const count = getAll(col).length;
        collectionCounts[col] = count;
        totalRecords += count;
    });

    stats.totalRecords = totalRecords;
    stats.totalWorkers = allWorkers.length;
    stats.totalCompanies = allCompanies.length;
    stats.totalUsers = allUsers.length;
    stats.totalCertificates = allCerts.length;
    stats.totalEquipment = allEquipment.length;
    stats.totalDocuments = allEmployerDocs.length;
    stats.totalArchiveFiles = allArchive.length;
    stats.totalOrgUnits = allOrgUnits.length;
    stats.totalWorkplaces = allWorkplaces.length;
    stats.collectionCounts = collectionCounts;

    // ── 2. System Health Checks ──
    if (totalRecords >= THRESHOLDS.TOTAL_RECORDS_CRITICAL) {
        notifications.push({
            id: 'sys_records_critical',
            severity: SEVERITY.CRITICAL,
            category: CATEGORY.SYSTEM,
            icon: '🔴',
            title: 'Kritično: Previše zapisa u bazi',
            message: `Baza podataka ima ${totalRecords.toLocaleString()} zapisa. Performanse mogu biti znatno smanjene. Potrebna je optimizacija upita (company-scoped queries).`,
            actionLabel: 'Kontaktiraj podršku',
            actionUrl: null,
        });
    } else if (totalRecords >= THRESHOLDS.TOTAL_RECORDS_WARN) {
        notifications.push({
            id: 'sys_records_warn',
            severity: SEVERITY.WARNING,
            category: CATEGORY.SYSTEM,
            icon: '⚠️',
            title: 'Upozorenje: Baza podataka raste',
            message: `Baza podataka ima ${totalRecords.toLocaleString()} zapisa. Razmotrite optimizaciju prije nego što dosegne ${THRESHOLDS.TOTAL_RECORDS_CRITICAL.toLocaleString()}.`,
        });
    }

    if (allWorkers.length >= THRESHOLDS.TOTAL_WORKERS_CRITICAL) {
        notifications.push({
            id: 'sys_workers_critical',
            severity: SEVERITY.CRITICAL,
            category: CATEGORY.SYSTEM,
            icon: '🔴',
            title: 'Kritično: Previše radnika u sustavu',
            message: `Sustav ima ${allWorkers.length.toLocaleString()} radnika. Potrebno je prebaciti na company-scoped upite za održavanje performansi.`,
        });
    } else if (allWorkers.length >= THRESHOLDS.TOTAL_WORKERS_WARN) {
        notifications.push({
            id: 'sys_workers_warn',
            severity: SEVERITY.WARNING,
            category: CATEGORY.SYSTEM,
            icon: '⚠️',
            title: 'Baza radnika raste',
            message: `Sustav ima ${allWorkers.length.toLocaleString()} radnika. Planirajte optimizaciju kada dosegne ${THRESHOLDS.TOTAL_WORKERS_CRITICAL.toLocaleString()}.`,
        });
    }

    // ── 3. Certificate Expiry Checks ──
    const today = new Date();
    let expiringCertsSoon = 0;
    let expiringCertsUrgent = 0;
    let expiredCerts = 0;

    allCerts.forEach(cert => {
        if (!cert.vrijediDo) return;
        const expiryDate = new Date(cert.vrijediDo);
        const daysUntilExpiry = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) {
            expiredCerts++;
        } else if (daysUntilExpiry <= THRESHOLDS.CERT_EXPIRY_URGENT_DAYS) {
            expiringCertsUrgent++;
        } else if (daysUntilExpiry <= THRESHOLDS.CERT_EXPIRY_WARNING_DAYS) {
            expiringCertsSoon++;
        }
    });

    if (expiredCerts > 0) {
        notifications.push({
            id: 'cert_expired',
            severity: SEVERITY.URGENT,
            category: CATEGORY.CERTIFICATES,
            icon: '🚨',
            title: `${expiredCerts} uvjerenja su istekla!`,
            message: `Ukupno ${expiredCerts} radničkih uvjerenja su istekla i trebaju hitnu obnovu.`,
            actionLabel: 'Pogledaj uvjerenja',
            actionUrl: '/dashboard/worker-certificates',
        });
    }

    if (expiringCertsUrgent > 0) {
        notifications.push({
            id: 'cert_urgent',
            severity: SEVERITY.URGENT,
            category: CATEGORY.CERTIFICATES,
            icon: '⏰',
            title: `${expiringCertsUrgent} uvjerenja ističu za manje od 7 dana`,
            message: `Hitno: ${expiringCertsUrgent} uvjerenja ističu u narednih 7 dana.`,
            actionLabel: 'Pogledaj uvjerenja',
            actionUrl: '/dashboard/worker-certificates',
        });
    }

    if (expiringCertsSoon > 0) {
        notifications.push({
            id: 'cert_warning',
            severity: SEVERITY.WARNING,
            category: CATEGORY.CERTIFICATES,
            icon: '📋',
            title: `${expiringCertsSoon} uvjerenja ističu u narednih 30 dana`,
            message: `Planirajte obnovu za ${expiringCertsSoon} uvjerenja koja ističu uskoro.`,
            actionLabel: 'Pogledaj uvjerenja',
            actionUrl: '/dashboard/worker-certificates',
        });
    }

    // ── 4. Equipment Inspection Checks ──
    let expiredEquipment = 0;
    let expiringEquipmentUrgent = 0;
    let expiringEquipmentSoon = 0;

    allEquipment.forEach(eq => {
        if (!eq.iduci) return;
        const nextInspection = new Date(eq.iduci);
        const daysUntil = Math.floor((nextInspection - today) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) {
            expiredEquipment++;
        } else if (daysUntil <= THRESHOLDS.EQUIPMENT_EXPIRY_URGENT_DAYS) {
            expiringEquipmentUrgent++;
        } else if (daysUntil <= THRESHOLDS.EQUIPMENT_EXPIRY_WARNING_DAYS) {
            expiringEquipmentSoon++;
        }
    });

    if (expiredEquipment > 0) {
        notifications.push({
            id: 'equip_expired',
            severity: SEVERITY.URGENT,
            category: CATEGORY.EQUIPMENT,
            icon: '🔧',
            title: `${expiredEquipment} oprema sa isteklim pregledom!`,
            message: `${expiredEquipment} komada radne opreme ima istekli rok pregleda.`,
            actionLabel: 'Pogledaj opremu',
            actionUrl: '/dashboard/equipment',
        });
    }

    if (expiringEquipmentUrgent + expiringEquipmentSoon > 0) {
        notifications.push({
            id: 'equip_warning',
            severity: SEVERITY.WARNING,
            category: CATEGORY.EQUIPMENT,
            icon: '⚙️',
            title: `${expiringEquipmentUrgent + expiringEquipmentSoon} pregledi opreme ističu uskoro`,
            message: `${expiringEquipmentUrgent} hitno (7 dana), ${expiringEquipmentSoon} uskoro (30 dana).`,
            actionLabel: 'Pogledaj opremu',
            actionUrl: '/dashboard/equipment',
        });
    }

    // ── 5. Employer Document Checks ──
    let expiredDocs = 0;
    let expiringDocsSoon = 0;

    allEmployerDocs.forEach(doc => {
        if (!doc.datumIsteka) return;
        const expiryDate = new Date(doc.datumIsteka);
        const daysUntil = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) {
            expiredDocs++;
        } else if (daysUntil <= THRESHOLDS.EMPLOYER_DOC_EXPIRY_WARNING_DAYS) {
            expiringDocsSoon++;
        }
    });

    if (expiredDocs > 0) {
        notifications.push({
            id: 'docs_expired',
            severity: SEVERITY.URGENT,
            category: CATEGORY.DOCUMENTS,
            icon: '📄',
            title: `${expiredDocs} dokumenta su istekla!`,
            message: `${expiredDocs} dokumenta poslodavca su istekla i trebaju obnovu.`,
            actionLabel: 'Pogledaj dokumenta',
            actionUrl: '/dashboard/employer-docs',
        });
    }

    if (expiringDocsSoon > 0) {
        notifications.push({
            id: 'docs_warning',
            severity: SEVERITY.WARNING,
            category: CATEGORY.DOCUMENTS,
            icon: '📑',
            title: `${expiringDocsSoon} dokumenta ističu uskoro`,
            message: `${expiringDocsSoon} dokumenta poslodavca ističu u narednih 30 dana.`,
            actionLabel: 'Pogledaj dokumenta',
            actionUrl: '/dashboard/employer-docs',
        });
    }

    // ── 6. Usage Growth Alerts ──
    if (allCompanies.length >= THRESHOLDS.COMPANIES_CRITICAL) {
        notifications.push({
            id: 'usage_companies_critical',
            severity: SEVERITY.WARNING,
            category: CATEGORY.USAGE,
            icon: '🏢',
            title: `${allCompanies.length} kompanija u sustavu`,
            message: 'Sustav ima veliki broj kompanija. Razmislite o nadogradnji Firebase plana.',
        });
    } else if (allCompanies.length >= THRESHOLDS.COMPANIES_WARN) {
        notifications.push({
            id: 'usage_companies_warn',
            severity: SEVERITY.INFO,
            category: CATEGORY.USAGE,
            icon: '📈',
            title: `${allCompanies.length} kompanija — rast sustava`,
            message: 'Broj kompanija raste. Pratite performanse.',
        });
    }

    if (allUsers.length >= THRESHOLDS.USERS_CRITICAL) {
        notifications.push({
            id: 'usage_users_critical',
            severity: SEVERITY.WARNING,
            category: CATEGORY.USAGE,
            icon: '👥',
            title: `${allUsers.length} korisnika u sustavu`,
            message: 'Veliki broj korisnika. Provjerite Firebase Auth korištenje.',
        });
    }

    // ── 7. Workers without certificates ──
    const activeWorkers = allWorkers.filter(w => w.aktivan);
    const workerIdsWithCerts = new Set(allCerts.map(c => c.workerId));
    const workersWithoutCerts = activeWorkers.filter(w => !workerIdsWithCerts.has(w.id));

    if (workersWithoutCerts.length > 0) {
        notifications.push({
            id: 'workers_no_certs',
            severity: SEVERITY.INFO,
            category: CATEGORY.CERTIFICATES,
            icon: '📝',
            title: `${workersWithoutCerts.length} radnika bez uvjerenja`,
            message: `${workersWithoutCerts.length} aktivnih radnika nema uneseno niti jedno uvjerenje u sustav.`,
            actionLabel: 'Pogledaj radnike',
            actionUrl: '/dashboard/workers',
        });
    }

    // ── 8. Sort notifications by severity ──
    const severityOrder = { critical: 0, urgent: 1, warning: 2, info: 3 };
    notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return { notifications, stats };
}

// ============================================================================
// PERFORMANCE MONITOR — Track page load times
// ============================================================================

const performanceLog = [];

export function trackPageLoad(pageName, loadTimeMs) {
    performanceLog.push({
        page: pageName,
        time: loadTimeMs,
        timestamp: new Date().toISOString(),
    });

    // Keep only last 100 entries
    if (performanceLog.length > 100) {
        performanceLog.splice(0, performanceLog.length - 100);
    }

    // Alert if page load is consistently slow
    if (loadTimeMs > 3000) {
        console.warn(`[Monitor] ⚠️ Slow page load: ${pageName} took ${loadTimeMs}ms`);
    }
}

export function getPerformanceStats() {
    if (performanceLog.length === 0) return null;
    const times = performanceLog.map(p => p.time);
    return {
        avgLoadTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        maxLoadTime: Math.max(...times),
        minLoadTime: Math.min(...times),
        totalPageLoads: performanceLog.length,
        slowPages: performanceLog.filter(p => p.time > 3000).length,
    };
}

// ============================================================================
// DISMISSED NOTIFICATIONS — Store which alerts the admin has seen
// ============================================================================

export function getDismissedNotifications() {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem('eznr_dismissed_notifications') || '[]');
    } catch { return []; }
}

export function dismissNotification(id) {
    const dismissed = getDismissedNotifications();
    if (!dismissed.includes(id)) {
        dismissed.push(id);
        localStorage.setItem('eznr_dismissed_notifications', JSON.stringify(dismissed));
    }
}

export function clearDismissedNotifications() {
    localStorage.removeItem('eznr_dismissed_notifications');
}

// ============================================================================
// FILTER HELPERS
// ============================================================================

export function getActiveNotifications() {
    const { notifications, stats } = runSystemCheck();
    const dismissed = getDismissedNotifications();
    const active = notifications.filter(n => !dismissed.includes(n.id));
    return { notifications: active, allNotifications: notifications, stats };
}

export function getNotificationCount() {
    const { notifications } = getActiveNotifications();
    return notifications.length;
}

export function getUrgentCount() {
    const { notifications } = getActiveNotifications();
    return notifications.filter(n => n.severity === 'critical' || n.severity === 'urgent').length;
}
