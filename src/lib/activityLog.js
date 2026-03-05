'use client';

// ============================================================================
// ACTIVITY LOG — Smart logging for eZNR
//
// Design decisions:
// - User logs: stored in localStorage, capped at 200 entries (keeps app fast)
// - Admin logs: separate namespace, capped at 100 entries (higher-value events only)
// - What gets logged: meaningful business events only — NOT every click/view
// - User events: create/update/delete workers, certs, equipment, documents
// - Admin events: new companies, new users, system alerts, logins
// - Expiry events: auto-logged when systemMonitor detects expired items
// - Performance: reads are O(1) from localStorage, no Firestore needed yet
// - Future: at 500+ users, sync daily summaries to Firestore for cross-device logs
// ============================================================================

const USER_LOG_KEY = 'eznr_activity_log';
const ADMIN_LOG_KEY = 'eznr_admin_log';
const MAX_USER_LOG = 200;
const MAX_ADMIN_LOG = 100;

// ── Event categories ──
export const LOG_CATEGORY = {
    WORKER: 'worker',
    CERTIFICATE: 'certificate',
    EQUIPMENT: 'equipment',
    DOCUMENT: 'document',
    PPE: 'ppe',
    COMPANY: 'company',
    USER: 'user',
    SYSTEM: 'system',
    AUTH: 'auth',
    EXPIRY: 'expiry',
};

// ── Event types ──
export const LOG_ACTION = {
    CREATED: 'created',
    UPDATED: 'updated',
    DELETED: 'deleted',
    LOGGED_IN: 'logged_in',
    LOGGED_OUT: 'logged_out',
    EXPIRED: 'expired',
    EXPIRING_SOON: 'expiring_soon',
    RENEWED: 'renewed',
    SYSTEM_ALERT: 'system_alert',
    COMPANY_SIGNED_UP: 'company_signed_up',
    USER_REGISTERED: 'user_registered',
};

// ── Icons per category ──
const CATEGORY_ICONS = {
    worker: '👷',
    certificate: '📋',
    equipment: '⚙️',
    document: '📄',
    ppe: '🦺',
    company: '🏢',
    user: '👤',
    system: '🛡️',
    auth: '🔐',
    expiry: '⏰',
};

// ── Severity colors (rgba for dark-mode compatibility) ──
const SEVERITY_COLORS = {
    info: { bg: 'rgba(34,197,94,0.08)', border: '#22C55E', dot: '#22C55E' },
    warning: { bg: 'rgba(245,158,11,0.10)', border: '#F59E0B', dot: '#F59E0B' },
    urgent: { bg: 'rgba(249,115,22,0.10)', border: '#F97316', dot: '#F97316' },
    critical: { bg: 'rgba(239,68,68,0.10)', border: '#EF4444', dot: '#EF4444' },
};

export function getSeverityColors(severity) {
    return SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
}

// ============================================================================
// CORE LOGGING FUNCTIONS
// ============================================================================

function readLog(key) {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch { return []; }
}

function writeLog(key, entries) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(entries));
}

function addEntry(key, maxSize, entry) {
    const logs = readLog(key);
    const newEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        ...entry,
    };
    // Prepend (newest first), trim to max size
    const updated = [newEntry, ...logs].slice(0, maxSize);
    writeLog(key, updated);
    return newEntry;
}

// ── Log a user action ──
export function logUserAction({ action, category, title, detail, userId, userName, companyId, severity = 'info', relatedId = null }) {
    return addEntry(USER_LOG_KEY, MAX_USER_LOG, {
        action,
        category,
        title,
        detail: detail || '',
        userId: userId || '',
        userName: userName || '',
        companyId: companyId || '',
        severity,
        relatedId,
        icon: CATEGORY_ICONS[category] || '📝',
    });
}

// ── Log an admin action ──
export function logAdminAction({ action, category, title, detail, severity = 'info', relatedId = null }) {
    return addEntry(ADMIN_LOG_KEY, MAX_ADMIN_LOG, {
        action,
        category,
        title,
        detail: detail || '',
        severity,
        relatedId,
        icon: CATEGORY_ICONS[category] || '🛡️',
    });
}

// ============================================================================
// CONVENIENCE HELPERS — One-liner logging for common events
// ============================================================================

export function logWorkerCreated(worker, user) {
    logUserAction({
        action: LOG_ACTION.CREATED,
        category: LOG_CATEGORY.WORKER,
        title: `Dodan radnik: ${worker.ime} ${worker.prezime}`,
        detail: `Evidencijski br. ${worker.evidencijskiBroj || '—'} | ${worker.email || ''}`,
        userId: user?.id,
        userName: `${user?.firstName} ${user?.lastName}`,
        companyId: user?.activeCompanyId,
        relatedId: worker.id,
    });
}

export function logWorkerUpdated(worker, user) {
    logUserAction({
        action: LOG_ACTION.UPDATED,
        category: LOG_CATEGORY.WORKER,
        title: `Ažuriran radnik: ${worker.ime} ${worker.prezime}`,
        detail: ``,
        userId: user?.id,
        userName: `${user?.firstName} ${user?.lastName}`,
        companyId: user?.activeCompanyId,
        relatedId: worker.id,
    });
}

export function logWorkerDeleted(worker, user) {
    logUserAction({
        action: LOG_ACTION.DELETED,
        category: LOG_CATEGORY.WORKER,
        title: `Obrisan radnik: ${worker.ime} ${worker.prezime}`,
        detail: ``,
        userId: user?.id,
        userName: `${user?.firstName} ${user?.lastName}`,
        companyId: user?.activeCompanyId,
        severity: 'warning',
        relatedId: worker.id,
    });
}

export function logCertCreated(cert, workerName, user) {
    logUserAction({
        action: LOG_ACTION.CREATED,
        category: LOG_CATEGORY.CERTIFICATE,
        title: `Dodano uvjerenje: ${cert.naziv || cert.tip || 'Uvjerenje'}`,
        detail: `Radnik: ${workerName} | Vrijedi do: ${cert.vrijediDo || '—'}`,
        userId: user?.id,
        userName: `${user?.firstName} ${user?.lastName}`,
        companyId: user?.activeCompanyId,
        relatedId: cert.id,
    });
}

export function logCertExpired(cert, workerName) {
    logUserAction({
        action: LOG_ACTION.EXPIRED,
        category: LOG_CATEGORY.EXPIRY,
        title: `Isteklo uvjerenje: ${cert.naziv || cert.tip || 'Uvjerenje'}`,
        detail: `Radnik: ${workerName} | Isteklo: ${cert.vrijediDo}`,
        severity: 'urgent',
        relatedId: cert.id,
    });
}

export function logEquipmentCreated(eq, user) {
    logUserAction({
        action: LOG_ACTION.CREATED,
        category: LOG_CATEGORY.EQUIPMENT,
        title: `Dodana oprema: ${eq.naziv}`,
        detail: `TV br: ${eq.tvBroj || '—'} | Sljedeći pregled: ${eq.iduci || '—'}`,
        userId: user?.id,
        userName: `${user?.firstName} ${user?.lastName}`,
        companyId: user?.activeCompanyId,
        relatedId: eq.id,
    });
}

export function logEquipmentExpired(eq) {
    logUserAction({
        action: LOG_ACTION.EXPIRED,
        category: LOG_CATEGORY.EXPIRY,
        title: `Istekao pregled opreme: ${eq.naziv}`,
        detail: `TV br: ${eq.tvBroj || '—'} | Trebalo: ${eq.iduci || '—'}`,
        severity: 'urgent',
        relatedId: eq.id,
    });
}

export function logDocumentCreated(doc, user) {
    logUserAction({
        action: LOG_ACTION.CREATED,
        category: LOG_CATEGORY.DOCUMENT,
        title: `Dodan dokument: ${doc.naziv || doc.tip || 'Dokument'}`,
        detail: `Ističe: ${doc.datumIsteka || '—'}`,
        userId: user?.id,
        userName: `${user?.firstName} ${user?.lastName}`,
        companyId: user?.activeCompanyId,
        relatedId: doc.id,
    });
}


export function logPPEAssigned(ppe, workerName, user) {
    logUserAction({
        action: LOG_ACTION.CREATED,
        category: LOG_CATEGORY.PPE,
        title: `Zadužena OZO: ${ppe.naziv}`,
        detail: `Radnik: ${workerName} | Kol: ${ppe.kolicina || 1} | Datum: ${ppe.datumZaduzenja || ''}`,
        userId: user?.id,
        userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Zia',
        companyId: user?.activeCompanyId,
        relatedId: ppe.id,
    });
}
export function logCompanyCreated(company, createdBy) {
    logAdminAction({
        action: LOG_ACTION.COMPANY_SIGNED_UP,
        category: LOG_CATEGORY.COMPANY,
        title: `Nova kompanija: ${company.naziv}`,
        detail: `OIB: ${company.oib || '—'} | Kreirao: ${createdBy || 'Admin'}`,
        severity: 'info',
        relatedId: company.id,
    });
    // Also log to user log so the officer who created sees it
    logUserAction({
        action: LOG_ACTION.COMPANY_SIGNED_UP,
        category: LOG_CATEGORY.COMPANY,
        title: `Kreirana firma: ${company.naziv}`,
        detail: ``,
        severity: 'info',
        relatedId: company.id,
    });
}

export function logUserRegistered(newUser) {
    logAdminAction({
        action: LOG_ACTION.USER_REGISTERED,
        category: LOG_CATEGORY.USER,
        title: `Novi korisnik: ${newUser.firstName} ${newUser.lastName}`,
        detail: `Email: ${newUser.email || '—'} | Uloga: ${newUser.role || 'officer'}`,
        severity: 'info',
        relatedId: newUser.id,
    });
}

export function logLogin(user) {
    logUserAction({
        action: LOG_ACTION.LOGGED_IN,
        category: LOG_CATEGORY.AUTH,
        title: `Prijavili ste se`,
        detail: ``,
        userId: user?.id,
        userName: `${user?.firstName} ${user?.lastName}`,
        severity: 'info',
    });
}

export function logSystemAlert(title, detail, severity = 'warning') {
    logAdminAction({
        action: LOG_ACTION.SYSTEM_ALERT,
        category: LOG_CATEGORY.SYSTEM,
        title,
        detail,
        severity,
    });
}

// ============================================================================
// READ FUNCTIONS
// ============================================================================

export function getUserLog(limit = 50, filterCategory = null) {
    const logs = readLog(USER_LOG_KEY);
    if (filterCategory) return logs.filter(l => l.category === filterCategory).slice(0, limit);
    return logs.slice(0, limit);
}

export function getAdminLog(limit = 50, filterCategory = null) {
    const logs = readLog(ADMIN_LOG_KEY);
    if (filterCategory) return logs.filter(l => l.category === filterCategory).slice(0, limit);
    return logs.slice(0, limit);
}

export function clearUserLog() {
    if (typeof window !== 'undefined') localStorage.removeItem(USER_LOG_KEY);
}

export function clearAdminLog() {
    if (typeof window !== 'undefined') localStorage.removeItem(ADMIN_LOG_KEY);
}

export function getUserLogCount() {
    return readLog(USER_LOG_KEY).length;
}

export function getAdminLogCount() {
    return readLog(ADMIN_LOG_KEY).length;
}

// ============================================================================
// ONLINE USERS TRACKING — Simple presence system
// ============================================================================

const ONLINE_KEY = 'eznr_online_users';
const ONLINE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function updatePresence(userId, userName, companyId, companyName) {
    if (typeof window === 'undefined') return;
    try {
        const all = JSON.parse(localStorage.getItem(ONLINE_KEY) || '{}');
        all[userId] = {
            userId,
            userName,
            companyId,
            companyName,
            lastSeen: Date.now(),
            page: typeof window !== 'undefined' ? window.location.pathname : '/',
        };
        // Clean up stale entries
        Object.keys(all).forEach(uid => {
            if (Date.now() - all[uid].lastSeen > ONLINE_TTL_MS) delete all[uid];
        });
        localStorage.setItem(ONLINE_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
}

export function getOnlineUsers() {
    if (typeof window === 'undefined') return [];
    try {
        const all = JSON.parse(localStorage.getItem(ONLINE_KEY) || '{}');
        const now = Date.now();
        return Object.values(all)
            .filter(u => now - u.lastSeen < ONLINE_TTL_MS)
            .sort((a, b) => b.lastSeen - a.lastSeen);
    } catch { return []; }
}

export function isUserOnline(userId) {
    const online = getOnlineUsers();
    return online.some(u => u.userId === userId);
}

// ── Format timestamp for display ──
export function formatLogTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Upravo';
    if (diffMins < 60) return `Prije ${diffMins} min`;
    if (diffHours < 24) return `Prije ${diffHours} h`;
    if (diffDays < 7) return `Prije ${diffDays} d`;
    return date.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Page name humanizer ──
export function humanizePage(path) {
    const map = {
        '/dashboard': 'Kontrolna ploča',
        '/dashboard/workers': 'Radnici',
        '/dashboard/worker-certificates': 'Uvjerenja',
        '/dashboard/equipment': 'Oprema',
        '/dashboard/employer-docs': 'Dokumenti poslodavca',
        '/dashboard/settings': 'Postavke',
        '/dashboard/ppe': 'Zaštitna oprema',
    };
    return map[path] || path?.split('/').pop() || 'Aplikacija';
}
