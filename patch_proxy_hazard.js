const fs = require('fs');
let content = fs.readFileSync('src/app/api/firebase-proxy/route.js', 'utf8');

const TEMPLATE = `
function buildHazardEmail({ companyName, location, description, reporterName, imageLink, dashboardLink }) {
    return \`<!DOCTYPE html><html lang="bs"><head><meta charset="UTF-8"><title>Prijava Opasnosti</title></head><body style="margin:0;padding:40px 0;background:#f0f4f8;font-family:sans-serif;"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);"><div style="background:#ef4444;color:#fff;padding:24px;text-align:center;"><h1 style="margin:0;font-size:24px;">🚨 Nova Prijava Opasnosti</h1><p style="margin:8px 0 0;">\${companyName}</p></div><div style="padding:32px;"><p style="font-size:16px;color:#333;">Imate novu prijavu s terena iz sistema sigurnosnih opažanja:</p><table style="width:100%;text-align:left;margin-top:20px;border-collapse:collapse;"><tr><th style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">📍 Lokacija:</th><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">\${location}</td></tr><tr><th style="padding:8px 0;border-bottom:1px solid #eee;color:#666;">⚠️ Opis:</th><td style="padding:8px;border-bottom:1px solid #eee;">\${description}</td></tr><tr><th style="padding:8px 0;color:#666;">👤 Prijavio/la:</th><td style="padding:8px;">\${reporterName || 'Anonimno'}</td></tr></table><div style="margin-top:32px;text-align:center;"><a href="\${dashboardLink}" style="display:inline-block;padding:14px 28px;background:#ef4444;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;">Otvori prijavu sa slikom</a></div></div><div style="background:#f8fafc;padding:16px;text-align:center;font-size:12px;color:#94a3b8;">Generisano via eZNR Sistem Sigurnosnih Opažanja</div></div></body></html>\`;
}`;

if(!content.includes('buildHazardEmail')) {
    content = content.replace('function buildHtmlEmail', TEMPLATE + '\nfunction buildHtmlEmail');
    content = content.replace(
        'const { toEmail, toName, questionnaireName, fillLink, deadline, senderName, companyName, isTraining, isReminder } = data;',
        'const { toEmail, toName, questionnaireName, fillLink, deadline, senderName, companyName, isTraining, isReminder, isHazard, location, description, reporterName, imageLink, dashboardLink } = data;'
    );
    
    const ifStmt = `
    let html;
    let subjectPrefix;
    if (isHazard) {
        html = buildHazardEmail({ companyName, location, description, reporterName, imageLink, dashboardLink });
        subjectPrefix = '🚨 Alarm';
    } else if (isReminder) {
        html = buildReminderEmail({ toName: toName || toEmail, questionnaireName, fillLink, deadline, senderName, companyName, isTraining });
        subjectPrefix = '⏰ Podsjetnik';
    } else {
        html = buildHtmlEmail({ toName: toName || toEmail, questionnaireName, fillLink, deadline, senderName, companyName, isTraining });
        subjectPrefix = isTraining ? '🎬 Obuka' : '📝 Upitnik';
    }
`;

    content = content.replace(
        /const html = isReminder[\s\S]*?const subjectPrefix = isReminder \? '⏰ Podsjetnik' : \(isTraining \? '🎬 Obuka' : '📝 Upitnik'\);/,
        ifStmt
    );

    // Also fix the subject line
    content = content.replace(
        /subject: \`\$\{subjectPrefix\}: \$\{questionnaireName\}\`,/,
        'subject: isHazard ? `🚨 Prijava Opasnosti: ${location || companyName}` : `${subjectPrefix}: ${questionnaireName}`,'
    );

    fs.writeFileSync('src/app/api/firebase-proxy/route.js', content, 'utf8');
    console.log('firebase-proxy patched for hazards');
} else {
    console.log('already patched');
}
