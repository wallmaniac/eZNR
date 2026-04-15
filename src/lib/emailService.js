'use client';

// ============================================================================
// EMAIL SERVICE — Resend dispatcher
// Calls /api/send-email which uses Resend to send styled HTML emails.
// No client configuration required — zero setup for end users.
// ============================================================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/lib/firebase';

/**
 * Email is always configured — Resend API key is set server-side.
 */
export function isEmailConfigured() {
    return true;
}

/**
 * Send a single email via /api/send-email (Resend)
 */
export async function sendEmail({
    toEmail,
    toName,
    questionnaireName,
    link,
    deadline,
    senderName,
    companyName,
    isTraining = false,
}) {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callable = httpsCallable(functions, 'sendEmail');
        
        const res = await callable({
            toEmail,
            toName,
            questionnaireName,
            fillLink: link,
            deadline,
            senderName,
            companyName,
            isTraining,
        });

        return res.data.success ? { success: true } : { success: false, error: 'Greška pri slanju.' };
    } catch (err) {
        return { success: false, error: err?.message || 'Mrežna greška pri slanju emaila.' };
    }
}

/**
 * Send emails to multiple recipients (batch).
 * Each recipient gets their own unique personalized link.
 *
 * @param {Array<{toEmail, toName}>} recipients
 * @param {Object} info - { questionnaireName, tokens, deadline, senderName, companyName, isTraining }
 * @param {Function} onProgress - callback(sent, total, currentEmail)
 * @returns {Promise<{sent, failed, errors}>}
 */
export async function sendBatchEmails(recipients, info, onProgress) {
    const { questionnaireName, tokens, deadline, senderName, companyName, isTraining } = info;

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
            isTraining: !!isTraining,
        });

        if (result.success) {
            sent++;
        } else {
            failed++;
            errors.push({ email: r.toEmail, error: result.error });
        }

        // Small delay between sends to respect rate limits
        if (i < recipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    onProgress?.(recipients.length, recipients.length, 'Završeno');
    return { sent, failed, errors };
}

/**
 * Send a reminder email via /api/send-email with isReminder=true
 */
export async function sendReminderEmail({
    toEmail,
    toName,
    questionnaireName,
    link,
    deadline,
    senderName,
    companyName,
    isTraining = false,
}) {
    try {
        const functions = getFunctions(app, 'europe-west1');
        const callable = httpsCallable(functions, 'sendEmail');
        
        const res = await callable({
            toEmail,
            toName,
            questionnaireName,
            fillLink: link,
            deadline,
            senderName,
            companyName,
            isTraining,
            isReminder: true,
        });

        return res.data.success ? { success: true } : { success: false, error: 'Greška pri slanju.' };
    } catch (err) {
        return { success: false, error: err?.message || 'Mrežna greška pri slanju emaila.' };
    }
}
