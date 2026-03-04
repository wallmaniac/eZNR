'use client';

// ============================================================================
// EMAIL SERVICE — EmailJS integration for questionnaire dispatch
// Uses @emailjs/browser to send emails from the client
// ============================================================================

import emailjs from '@emailjs/browser';

// EmailJS configuration from environment variables
const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '';
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '';

// Initialize EmailJS
let initialized = false;
function initEmailJS() {
    if (initialized || !PUBLIC_KEY) return;
    emailjs.init(PUBLIC_KEY);
    initialized = true;
}

/**
 * Send a questionnaire email to a worker/recipient
 * @param {Object} params
 * @param {string} params.toEmail - Recipient email address
 * @param {string} params.toName  - Recipient full name
 * @param {string} params.questionnaireName - Name of the questionnaire
 * @param {string} params.link    - Full URL to fill the questionnaire
 * @param {string} params.deadline - Deadline date (ISO string or formatted)
 * @param {string} params.senderName - Admin/sender name
 * @param {string} params.companyName - Company name
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendQuestionnaireEmail({
    toEmail,
    toName,
    questionnaireName,
    link,
    deadline,
    senderName = 'eZNR Admin',
    companyName = '',
}) {
    initEmailJS();

    if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
        return {
            success: false,
            error: 'EmailJS nije konfiguriran. Dodajte NEXT_PUBLIC_EMAILJS_SERVICE_ID, NEXT_PUBLIC_EMAILJS_TEMPLATE_ID i NEXT_PUBLIC_EMAILJS_PUBLIC_KEY u .env.local datoteku.',
        };
    }

    try {
        const templateParams = {
            to_email: toEmail,
            to_name: toName || toEmail,
            questionnaire_name: questionnaireName,
            fill_link: link,
            deadline: deadline || 'Nema roka',
            sender_name: senderName,
            company_name: companyName,
        };

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
        return { success: true };
    } catch (err) {
        console.error('EmailJS send error:', err);
        return {
            success: false,
            error: err?.text || err?.message || 'Nepoznata greška pri slanju emaila.',
        };
    }
}

/**
 * Check if EmailJS is configured
 */
export function isEmailConfigured() {
    return !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

/**
 * Send multiple questionnaire emails (batch)
 * @param {Array<{toEmail, toName}>} recipients
 * @param {Object} questionnaireInfo - { questionnaireName, baseUrl, deadline, senderName, companyName }
 * @param {Function} onProgress - callback(sent, total, currentEmail)
 * @returns {Promise<{sent: number, failed: number, errors: Array}>}
 */
export async function sendBatchEmails(recipients, questionnaireInfo, onProgress) {
    const { questionnaireName, tokens, deadline, senderName, companyName } = questionnaireInfo;
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        onProgress?.(i, recipients.length, r.toEmail);

        const result = await sendQuestionnaireEmail({
            toEmail: r.toEmail,
            toName: r.toName,
            questionnaireName,
            link: tokens[i], // each recipient has their unique link
            deadline,
            senderName,
            companyName,
        });

        if (result.success) {
            sent++;
        } else {
            failed++;
            errors.push({ email: r.toEmail, error: result.error });
        }

        // Small delay to avoid rate limiting
        if (i < recipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }

    onProgress?.(recipients.length, recipients.length, 'Završeno');
    return { sent, failed, errors };
}
