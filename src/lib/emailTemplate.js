// ============================================================================
// EMAIL TEMPLATE — builds the full styled HTML email
// Logo image hosted at https://zastitanaradu.ba/email-header.png
// ============================================================================

const BASE_URL = 'https://zastitanaradu.ba';

/**
 * Build the full HTML email body for questionnaire/training dispatch.
 */
exports. buildHtmlEmail = function({
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

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:0 0 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header logo image -->
          <tr>
            <td style="border-radius:16px 16px 0 0;overflow:hidden;padding:0;font-size:0;line-height:0;">
              <img src="${BASE_URL}/email-header.png"
                   alt="eZNR — Digitalna platforma za zaštitu na radu"
                   width="600"
                   style="display:block;width:100%;max-width:600px;height:auto;border-radius:16px 16px 0 0;" />
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
              <div style="text-align:center;margin:36px 0;">
                <p style="margin:0 0 16px;font-size:14px;color:#64748b;font-weight:600;">
                  👇 Pritisnite dugme ispod za pristup:
                </p>
                <a href="${fillLink}"
                   style="display:block;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 50%,#6366f1 100%);
                          color:#ffffff;font-size:20px;font-weight:800;text-decoration:none;
                          padding:22px 20px;border-radius:16px;letter-spacing:0.3px;
                          box-shadow:0 6px 32px rgba(99,102,241,0.55),0 2px 8px rgba(79,70,229,0.4);
                          border:3px solid rgba(255,255,255,0.25);
                          max-width:480px;margin:0 auto;">
                  ${isTraining ? '🎬 Započni obuku / prezentaciju →' : '📝 Ispuni upitnik →'}
                </a>
                <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">
                  Dugme vas vodi direktno na ${itemLabel} — nema prijave
                </p>
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

/**
 * Build an HTML reminder email — "PODSJETNIK" styling with urgency banner.
 */
exports. buildReminderEmail = function({
    toName,
    questionnaireName,
    fillLink,
    deadline,
    senderName = 'eZNR Admin',
    companyName = '',
    isTraining = false,
}) {
    const itemLabel = isTraining ? 'obuku / prezentaciju' : 'upitnik';
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
  <title>Podsjetnik — ${questionnaireName}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:0 0 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header logo image -->
          <tr>
            <td style="border-radius:16px 16px 0 0;overflow:hidden;padding:0;font-size:0;line-height:0;">
              <img src="${BASE_URL}/email-header.png"
                   alt="eZNR — Digitalna platforma za zaštitu na radu"
                   width="600"
                   style="display:block;width:100%;max-width:600px;height:auto;border-radius:16px 16px 0 0;" />
            </td>
          </tr>

          <!-- Urgency banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:14px 40px;text-align:center;">
              <p style="margin:0;font-size:14px;font-weight:800;color:#ffffff;text-transform:uppercase;letter-spacing:2px;">
                ⏰ PODSJETNIK — Još niste ispunili ${itemLabel}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <h1 style="margin:0 0 24px;font-size:22px;font-weight:800;color:#1e293b;line-height:1.35;">
                ${titleIcon} ${questionnaireName}
              </h1>

              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.75;">
                Poštovani/a <strong style="color:#1e293b;">${toName}</strong>,<br><br>
                podsjećamo Vas da još uvijek niste popunili ${itemLabel} koji Vam je dodijelio/la
                <strong style="color:#4f46e5;">${senderDisplay}</strong>.
                ${deadline ? `<br><br><strong style="color:#d97706;">⚠️ Rok ističe: ${deadlineStr}</strong>` : ''}
              </p>

              <!-- CTA -->
              <div style="text-align:center;margin:36px 0;">
                <p style="margin:0 0 16px;font-size:14px;color:#64748b;font-weight:600;">
                  👇 Pritisnite dugme ispod za pristup:
                </p>
                <a href="${fillLink}"
                   style="display:block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#f59e0b 100%);
                          color:#ffffff;font-size:20px;font-weight:800;text-decoration:none;
                          padding:22px 20px;border-radius:16px;letter-spacing:0.3px;
                          box-shadow:0 6px 32px rgba(245,158,11,0.55),0 2px 8px rgba(217,119,6,0.4);
                          border:3px solid rgba(255,255,255,0.25);
                          max-width:480px;margin:0 auto;">
                  ${isTraining ? '🎬 Započni obuku / prezentaciju →' : '📝 Ispuni upitnik →'}
                </a>
                <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;">
                  Dugme vas vodi direktno na ${itemLabel} — nema prijave
                </p>
              </div>

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
                Podsjetnik poslao: <strong style="color:#4f46e5;">${senderDisplay}</strong>
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
