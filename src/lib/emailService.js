'use client';

// ============================================================================
// EMAIL SERVICE — EmailJS integration for questionnaire dispatch
// Uses @emailjs/browser to send emails from the client
// ============================================================================

import emailjs from '@emailjs/browser';

// EmailJS credentials (NEXT_PUBLIC — safe to be in client code)
const EMAILJS_SERVICE_ID = 'service_40uo2ms';
const EMAILJS_TEMPLATE_ID = 'template_twqa5ke';
const EMAILJS_PUBLIC_KEY = '56HEWr_JbUhT-R4Fa';

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

        // v4 API: pass publicKey as 4th argument to send()
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams,
            { publicKey: EMAILJS_PUBLIC_KEY }
        );
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
    return !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
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
