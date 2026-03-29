import { Resend } from 'resend';
import { buildHtmlEmail, buildReminderEmail } from '@/lib/emailTemplate';

// ============================================================================
// API ROUTE: POST /api/send-email
// Uses Resend to send styled HTML emails. Zero client configuration needed.
// Supports: dispatch (default) and reminder (isReminder=true) modes.
// ============================================================================

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            toEmail,
            toName,
            questionnaireName,
            fillLink,
            deadline,
            senderName,
            companyName,
            isTraining,
            isReminder,
        } = body;

        if (!toEmail || !fillLink) {
            return Response.json({
                success: false,
                error: 'Nedostaju obavezna polja: email primatelja ili link.',
            }, { status: 400 });
        }

        const itemLabel = isTraining ? 'obuku' : 'upitnik';
        const displayName = companyName
            ? `${senderName || 'eZNR'} (${companyName}) via eZNR`
            : `${senderName || 'eZNR'} via eZNR`;

        const templateArgs = {
            toName: toName || toEmail,
            questionnaireName,
            fillLink,
            deadline,
            senderName: senderName || 'eZNR Admin',
            companyName: companyName || '',
            isTraining: !!isTraining,
        };

        const html = isReminder
            ? buildReminderEmail(templateArgs)
            : buildHtmlEmail(templateArgs);

        const subjectPrefix = isReminder
            ? '\u23F0 Podsjetnik'
            : (isTraining ? '\uD83C\uDFAC Obuka' : '\uD83D\uDCDD Upitnik');

        const { error } = await resend.emails.send({
            from: `${displayName} <${FROM_EMAIL}>`,
            to: [toEmail],
            subject: `${subjectPrefix}: ${questionnaireName}`,
            html,
            text: [
                `${isReminder ? 'PODSJETNIK \u2014 ' : ''}${isTraining ? 'Obuka' : 'Upitnik'}: ${questionnaireName}`,
                '',
                `Po\u0161tovani/a ${toName || toEmail},`,
                '',
                isReminder
                    ? `podsje\u0107amo Vas da jo\u0161 uvijek niste popunili ${itemLabel} koji Vam je dodijelio ${senderName || 'eZNR Admin'}${companyName ? ` (${companyName})` : ''}.`
                    : `pozivamo Vas da popunite ${itemLabel} koji Vam je dodijelio ${senderName || 'eZNR Admin'}${companyName ? ` (${companyName})` : ''}.`,
                '',
                `Link: ${fillLink}`,
                '',
                '---',
                'Ovaj email je generiran putem platforme eZNR.',
            ].join('\n'),
        });

        if (error) {
            console.error('[send-email] Resend error:', error);
            return Response.json({ success: false, error: error.message }, { status: 500 });
        }

        return Response.json({ success: true });

    } catch (err) {
        console.error('[send-email] Unexpected error:', err);
        return Response.json({
            success: false,
            error: err?.message || 'Nepoznata gre\u0161ka pri slanju emaila.',
        }, { status: 500 });
    }
}
