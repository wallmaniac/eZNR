'use client';

// ============================================================================
// EMAIL SERVICE — EmailJS integration for questionnaire dispatch
// Uses @emailjs/browser to send emails from the client
// ============================================================================

import emailjs from '@emailjs/browser';

// EmailJS credentials (NEXT_PUBLIC — safe to be in client code)
function getConfig() {
    return {
        serviceId: process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_40uo2ms',
        templateId: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_twqa5ke',
        publicKey: process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '56HEWr_JbUhT-R4Fa',
    };
}

// Initialize EmailJS
let initialized = false;
function initEmailJS() {
    const { publicKey } = getConfig();
    if (initialized || !publicKey) return;
    emailjs.init(publicKey);
    initialized = true;
}

/**
 * Send a questionnaire email to a worker/recipient
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
    const { serviceId, templateId, publicKey } = getConfig();

    if (!serviceId || !templateId || !publicKey) {
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

        await emailjs.send(serviceId, templateId, templateParams);
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
    const { serviceId, templateId, publicKey } = getConfig();
    return !!(serviceId && templateId && publicKey);
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
