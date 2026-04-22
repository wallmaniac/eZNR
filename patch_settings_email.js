const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

const injectionTarget = `<Toggle checked={notifSettings.emailNotifMedical ?? true} onChange={v => updateNotif('emailNotifMedical', v)} label={lang === 'bs' ? '🩺 Ljekarski pregledi' : '🩺 Medical exams'} />`;
const injectionContent = `${injectionTarget}

                            {/* HAZARD REPORTS NOTIF */}
                            <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '2px dashed rgba(239,68,68,0.2)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}>
                                    🚨 {lang === 'bs' ? 'Prijave Opasnosti (Sistem zapažanja)' : 'Hazard Reports (Observation System)'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                    {lang === 'bs' ? 'Kome se šalju trenutni email alarmi kada radnik sa terena prijavi opasnost (QR kod)?' : 'Who receives immediate email alerts when a worker reports a hazard from the field?'}
                                </div>
                                <input 
                                    className="form-input" 
                                    placeholder={lang === 'bs' ? 'Unesite email adresu za alarme' : 'Enter alert email address'}
                                    value={notifSettings.obsNotifEmail || ''} 
                                    onChange={e => updateNotif('obsNotifEmail', e.target.value)} 
                                />
                            </div>`;

content = content.replace(injectionTarget, injectionContent);

fs.writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
console.log('patched settings email field');
