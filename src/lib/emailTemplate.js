// ============================================================================
// EMAIL TEMPLATE — builds the full styled HTML email
// Uses email-header.png hosted at https://eznr.vercel.app/email-header.png
// ============================================================================

const BASE_URL = 'https://zastitanaradu.ba';

/**
 * Build the full HTML email body for questionnaire/training dispatch.
 */
export function buildHtmlEmail({
    toName,
    questionnaireName,
    fillLink,
    deadline,
    senderName = 'eZNR Admin',
    companyName = '',
    isTraining = false,
}) {
    const itemLabel = isTraining ? 'obuku / prezentaciju' : 'upitnik';
    const itemLabelCap = isTraining ? 'Obuka / Prezentacija' : 'Upitnik';
    const ctaLabel = isTraining ? 'Pristupi obuci &rarr;' : 'Ispuni upitnik &rarr;';
    const titleIcon = isTraining ? '🎬' : '📝';
    const deadlineStr = deadline
        ? new Date(deadline).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Nema roka';
    const senderDisplay = companyName ? `${senderName} (${companyName})` : senderName;

    return `<!DOCTYPE html>
<html lang="bs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isTraining ? 'Obuka' : 'Upitnik'} — ${questionnaireName}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header banner — HTML/CSS (no image dependency) -->
          <tr>
            <td style="border-radius:16px 16px 0 0;background:linear-gradient(135deg,#071525 0%,#0d2540 55%,#0a1e35 100%);padding:26px 36px;">
              <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;font-size:46px;line-height:1;">🦺</td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0 0 3px;font-size:38px;font-weight:900;color:#22d3ee;letter-spacing:-1px;line-height:1;font-family:'Segoe UI',Arial,sans-serif;">eZNR</p>
                    <p style="margin:0;font-size:9px;font-weight:700;color:#4ade80;letter-spacing:2.5px;text-transform:uppercase;line-height:1.4;font-family:'Segoe UI',Arial,sans-serif;">DIGITALNA PLATFORMA ZA ZA&#x160;TITU NA RADU</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
                Pozvani ste na ispunjavanje
              </p>
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:800;color:#1e293b;line-height:1.35;">
                ${titleIcon} ${questionnaireName}
              </h1>

              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.75;">
                Poštovani/a <strong style="color:#1e293b;">${toName}</strong>,<br><br>
                pozivamo Vas da popunite ${itemLabel} koji Vam je dodijelio
                <strong style="color:#4f46e5;">${senderDisplay}</strong>.
                Kliknite na dugme ispod kako biste pristupili ${itemLabel}u.
              </p>

              <!-- CTA -->
              <div style="text-align:center;margin:32px 0;">
                <a href="${fillLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                          color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;
                          padding:16px 44px;border-radius:12px;letter-spacing:0.2px;">
                  ${ctaLabel}
                </a>
              </div>

              <!-- Info boxes -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
                <tr>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;width:48%;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">
                      ${itemLabelCap}
                    </p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${questionnaireName}</p>
                  </td>
                  <td style="width:4%;"></td>
                  <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;width:48%;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.8px;">
                      Rok za ispunjavanje
                    </p>
                    <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${deadlineStr}</p>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <div style="background:#f0f4f8;border-radius:8px;padding:14px 18px;margin-top:20px;">
                <p style="margin:0 0 5px;font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;">
                  Ili kopirajte link:
                </p>
                <a href="${fillLink}"
                   style="font-size:12px;color:#4f46e5;word-break:break-all;text-decoration:none;">${fillLink}</a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0 0 16px 16px;padding:22px 40px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;">
                Poslao: <strong style="color:#4f46e5;">${senderDisplay}</strong>
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                Ovaj email je automatski generiran putem platforme eZNR.<br>
                Za pitanja kontaktirajte osobu koja Vam je poslala ${itemLabel}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
