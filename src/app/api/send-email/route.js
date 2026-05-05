import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { buildHtmlEmail, buildReminderEmail } from '@/lib/emailTemplate';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export async function POST(request) {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.error('Missing RESEND_API_KEY environment variable');
            return NextResponse.json({ error: 'Server misconfiguration: Missing Resend API Key' }, { status: 500 });
        }

        const data = await request.json();
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
        } = data;

        if (!toEmail || !fillLink) {
            return NextResponse.json({ error: 'Nedostaju obavezna polja: email primatelja ili link.' }, { status: 400 });
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
            ? '⏰ Podsjetnik'
            : (isTraining ? '🎬 Obuka' : '📝 Upitnik');

        const { data: responseData, error } = await resend.emails.send({
            from: `${displayName} <${FROM_EMAIL}>`,
            to: [toEmail],
            subject: `${subjectPrefix}: ${questionnaireName}`,
            html,
            text: [
                `${isReminder ? 'PODSJETNIK — ' : ''}${isTraining ? 'Obuka' : 'Upitnik'}: ${questionnaireName}`,
                '',
                `Poštovani/a ${toName || toEmail},`,
                '',
                isReminder
                    ? `podsjećamo Vas da još uvijek niste popunili ${itemLabel} koji Vam je dodijelio ${senderName || 'eZNR Admin'}${companyName ? ` (${companyName})` : ''}.`
                    : `pozivamo Vas da popunite ${itemLabel} koji Vam je dodijelio ${senderName || 'eZNR Admin'}${companyName ? ` (${companyName})` : ''}.`,
                '',
                `Link: ${fillLink}`,
                '',
                '---',
                'Ovaj email je generiran putem platforme eZNR.',
            ].join('\n'),
        });

        if (error) {
            console.error('[api/send-email] Resend error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: responseData }, { status: 200 });
    } catch (err) {
        console.error('[api/send-email] Unexpected error:', err);
        return NextResponse.json({ error: err.message || 'Nepoznata greška pri slanju emaila.' }, { status: 500 });
    }
}
