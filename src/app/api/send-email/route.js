import { Resend } from 'resend';
import { buildHtmlEmail } from '@/lib/emailTemplate';

// ============================================================================
// API ROUTE: POST /api/send-email
// Uses Resend to send styled HTML emails. Zero client configuration needed.
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

        const html = buildHtmlEmail({
            toName: toName || toEmail,
            questionnaireName,
            fillLink,
            deadline,
            senderName: senderName || 'eZNR Admin',
            companyName: companyName || '',
            isTraining: !!isTraining,
        });

        const { error } = await resend.emails.send({
            from: `${displayName} <${FROM_EMAIL}>`,
            to: [toEmail],
            subject: `${isTraining ? '🎬 Obuka' : '📝 Upitnik'}: ${questionnaireName}`,
            html,
            text: [
                `${isTraining ? 'Obuka' : 'Upitnik'}: ${questionnaireName}`,
                '',
                `Poštovani/a ${toName || toEmail},`,
                '',
                `pozivamo Vas da popunite ${itemLabel} koji Vam je dodijelio ${senderName || 'eZNR Admin'}${companyName ? ` (${companyName})` : ''}.`,
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
            error: err?.message || 'Nepoznata greška pri slanju emaila.',
        }, { status: 500 });
    }
}
