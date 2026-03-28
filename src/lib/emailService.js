'use client';

// ============================================================================
// EMAIL SERVICE — mailto: based dispatcher
// Opens the user's default email client (Outlook, Gmail, Thunderbird, etc.)
// with a pre-filled message. No external dependencies, no limits.
// ============================================================================

/**
 * Build a nicely formatted plain-text email body matching the old HTML template.
 */
function buildEmailBody({ toName, questionnaireName, fillLink, deadline, senderName, companyName, isTraining = false }) {
    const itemLabel = isTraining ? 'obuku / prezentaciju' : 'upitnik';
    const itemLabelCap = isTraining ? 'Obuka / Prezentacija' : 'Upitnik';
    const deadlineStr = deadline
        ? new Date(deadline).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Nema roka';

    return [
        `Pozvani ste na ispunjavanje`,
        `📝 ${questionnaireName}`,
        ``,
        `Poštovani/a ${toName},`,
        ``,
        `pozivamo Vas da popunite ${itemLabel} koji Vam je dodijelio ${senderName}${companyName ? ` (${companyName})` : ''}.`,
        ``,
        `Pristupite putem sljedećeg linka:`,
        ``,
        `▶ ${fillLink}`,
        ``,
        `────────────────────────────────`,
        `${itemLabelCap}: ${questionnaireName}`,
        `Rok za ispunjavanje: ${deadlineStr}`,
        `Poslao/la: ${senderName}${companyName ? ` | ${companyName}` : ''}`,
        `────────────────────────────────`,
        ``,
        `Ukoliko link ne radi, kopirajte ga ručno u preglednik:`,
        `${fillLink}`,
        ``,
        `---`,
        `Ovaj email je generiran putem platforme eZNR — Digitalna platforma za zaštitu na radu.`,
        `Za pitanja kontaktirajte osobu koja Vam je poslala ${itemLabel}.`,
    ].join('\n');
}

/**
 * Open a single mailto: link in the user's default email client.
 * Returns immediately (non-blocking).
 */
export function openMailtoLink({ toEmail, toName, questionnaireName, link, deadline, senderName, companyName, replyTo, isTraining = false }) {
    const subject = encodeURIComponent(`${isTraining ? '🎬 Obuka' : '📝 Upitnik'}: ${questionnaireName}`);
    const body = encodeURIComponent(buildEmailBody({
        toName: toName || toEmail,
        questionnaireName,
        fillLink: link,
        deadline,
        senderName: senderName || 'eZNR Admin',
        companyName: companyName || '',
        isTraining,
    }));

    const replyToPart = replyTo ? `&reply-to=${encodeURIComponent(replyTo)}` : '';
    const mailtoUrl = `mailto:${encodeURIComponent(toEmail)}?subject=${subject}&body=${body}${replyToPart}`;

    // Use window.open to avoid navigation blocking on some browsers
    window.location.href = mailtoUrl;
}

/**
 * Check if email sending is "configured" — always true for mailto approach
 */
export function isEmailConfigured() {
    return true;
}

/**
 * Send multiple emails via mailto: — opens email client for each recipient.
 * Since mailto: is synchronous (just opens the client), we simulate progress
 * by processing recipients one at a time with a short delay between each.
 *
 * For UX: if there are many recipients, user will get a prompt explaining
 * that their email client will open once per recipient.
 *
 * @param {Array<{toEmail, toName}>} recipients
 * @param {Object} questionnaireInfo - { questionnaireName, tokens, deadline, senderName, companyName, replyTo, isTraining }
 * @param {Function} onProgress - callback(sent, total, currentEmail)
 * @returns {Promise<{sent: number, failed: number, errors: Array, openedLinks: Array}>}
 */
export async function sendBatchEmails(recipients, questionnaireInfo, onProgress) {
    const { questionnaireName, tokens, deadline, senderName, companyName, replyTo, isTraining } = questionnaireInfo;

    let sent = 0;
    let failed = 0;
    const errors = [];
    const openedLinks = [];

    for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        onProgress?.(i, recipients.length, r.toEmail);

        try {
            const link = tokens[i];
            if (!link || link.endsWith('error')) {
                failed++;
                errors.push({ email: r.toEmail, error: 'Sesija nije kreirana' });
                continue;
            }

            const subject = encodeURIComponent(`${isTraining ? '🎬 Obuka' : '📝 Upitnik'}: ${questionnaireName}`);
            const body = encodeURIComponent(buildEmailBody({
                toName: r.toName || r.toEmail,
                questionnaireName,
                fillLink: link,
                deadline,
                senderName: senderName || 'eZNR Admin',
                companyName: companyName || '',
                isTraining: !!isTraining,
            }));

            const replyToPart = replyTo ? `&reply-to=${encodeURIComponent(replyTo)}` : '';
            const mailtoUrl = `mailto:${encodeURIComponent(r.toEmail)}?subject=${subject}&body=${body}${replyToPart}`;

            openedLinks.push({ email: r.toEmail, mailto: mailtoUrl, link });

            // Open the email client
            window.open(mailtoUrl, '_blank');

            sent++;

            // Give the OS time to open the mailto handler before the next one
            if (i < recipients.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1200));
            }
        } catch (err) {
            failed++;
            errors.push({ email: r.toEmail, error: err?.message || 'Greška pri otvaranju email klijenta' });
        }
    }

    onProgress?.(recipients.length, recipients.length, 'Završeno');
    return { sent, failed, errors, openedLinks };
}
