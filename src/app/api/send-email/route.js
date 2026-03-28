import nodemailer from 'nodemailer';
import { buildHtmlEmail } from '@/lib/emailTemplate';

// ============================================================================
// API ROUTE: POST /api/send-email
// Accepts SMTP config + recipient info, sends styled HTML email via Nodemailer
// ============================================================================

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
            replyTo,
            isTraining,
            smtpConfig,
        } = body;

        // Validate required fields
        if (!toEmail || !fillLink || !smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
            return Response.json({
                success: false,
                error: 'Nedostaju obavezna polja: email primatelja, link ili SMTP konfiguracija.',
            }, { status: 400 });
        }

        // Build HTML
        const html = buildHtmlEmail({
            toName: toName || toEmail,
            questionnaireName,
            fillLink,
            deadline,
            senderName: senderName || 'eZNR Admin',
            companyName: companyName || '',
            isTraining: !!isTraining,
        });

        // Build plain text fallback
        const text = [
            `${isTraining ? 'Obuka' : 'Upitnik'}: ${questionnaireName}`,
            ``,
            `Poštovani/a ${toName || toEmail},`,
            ``,
            `pozivamo Vas da popunite ${isTraining ? 'obuku' : 'upitnik'} koji Vam je dodijelio ${senderName || 'eZNR Admin'}${companyName ? ` (${companyName})` : ''}.`,
            ``,
            `Link: ${fillLink}`,
            ``,
            `---`,
            `Ovaj email je generiran putem platforme eZNR.`,
        ].join('\n');

        // Create transporter
        const port = Number(smtpConfig.port) || 587;
        const secure = smtpConfig.secure === true || port === 465;

        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port,
            secure,
            auth: {
                user: smtpConfig.user,
                pass: smtpConfig.pass,
            },
            tls: {
                // Allow self-signed certs for corporate mail servers
                rejectUnauthorized: false,
            },
        });

        // Compose message
        const mailOptions = {
            from: `"${senderName || 'eZNR'}" <${smtpConfig.user}>`,
            to: toEmail,
            subject: `${isTraining ? '🎬 Obuka' : '📝 Upitnik'}: ${questionnaireName}`,
            html,
            text,
            ...(replyTo ? { replyTo } : {}),
        };

        await transporter.sendMail(mailOptions);

        return Response.json({ success: true });

    } catch (err) {
        console.error('[send-email] Error:', err);
        return Response.json({
            success: false,
            error: err?.message || 'Nepoznata greška pri slanju emaila.',
        }, { status: 500 });
    }
}
