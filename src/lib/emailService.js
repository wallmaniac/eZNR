'use client';

// ============================================================================
// EMAIL SERVICE — Server-side SMTP dispatcher
// Calls /api/send-email which uses Nodemailer to send styled HTML emails.
// SMTP credentials are loaded from localStorage (eznr_smtp_config).
// ============================================================================

const SMTP_KEY = 'eznr_smtp_config';

/**
 * Load SMTP config from localStorage.
 * Returns null if not configured.
 */
export function getSmtpConfig() {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(SMTP_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

/**
 * Save SMTP config to localStorage.
 */
export function saveSmtpConfig(config) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SMTP_KEY, JSON.stringify(config));
}

/**
 * Clear saved SMTP config.
 */
export function clearSmtpConfig() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SMTP_KEY);
}

/**
 * Check if SMTP is configured with the minimum required fields.
 */
export function isEmailConfigured() {
    const cfg = getSmtpConfig();
    return !!(cfg?.host && cfg?.user && cfg?.pass);
}

/**
 * Send a single email via /api/send-email
 */
export async function sendEmail({
    toEmail,
    toName,
    questionnaireName,
    link,
    deadline,
    senderName,
    companyName,
    replyTo,
    isTraining = false,
    smtpConfig,
}) {
    const cfg = smtpConfig || getSmtpConfig();
    if (!cfg?.host || !cfg?.user || !cfg?.pass) {
        return {
            success: false,
            error: 'SMTP nije konfiguriran. Idite na Postavke → Email / SMTP i unesite podatke.',
        };
    }

    try {
        const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toEmail,
                toName,
                questionnaireName,
                fillLink: link,
                deadline,
                senderName,
                companyName,
                replyTo,
                isTraining,
                smtpConfig: cfg,
            }),
        });

        const data = await res.json();
        return data.success ? { success: true } : { success: false, error: data.error || 'Greška pri slanju.' };
    } catch (err) {
        return { success: false, error: err?.message || 'Mreži greška pri kontaktiranju servera.' };
    }
}

/**
 * Send emails to multiple recipients (batch).
 * Each recipient gets their own unique personalized link.
 *
 * @param {Array<{toEmail, toName}>} recipients
 * @param {Object} info - { questionnaireName, tokens, deadline, senderName, companyName, replyTo, isTraining }
 * @param {Function} onProgress - callback(sent, total, currentEmail)
 * @returns {Promise<{sent, failed, errors}>}
 */
export async function sendBatchEmails(recipients, info, onProgress) {
    const { questionnaireName, tokens, deadline, senderName, companyName, replyTo, isTraining } = info;
    const smtpConfig = getSmtpConfig();

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        onProgress?.(i, recipients.length, r.toEmail);

        const link = tokens[i];
        if (!link || link.endsWith('error')) {
            failed++;
            errors.push({ email: r.toEmail, error: 'Sesija nije kreirana' });
            continue;
        }

        const result = await sendEmail({
            toEmail: r.toEmail,
            toName: r.toName,
            questionnaireName,
            link,
            deadline,
            senderName,
            companyName,
            replyTo,
            isTraining: !!isTraining,
            smtpConfig,
        });

        if (result.success) {
            sent++;
        } else {
            failed++;
            errors.push({ email: r.toEmail, error: result.error });
        }

        // Small delay between sends to avoid smtp rate limiting
        if (i < recipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    onProgress?.(recipients.length, recipients.length, 'Završeno');
    return { sent, failed, errors };
}
