const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

const OLD_BLOCK = `                            {/* HAZARD REPORTS NOTIF */}
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

content = content.replace(OLD_BLOCK, '');

const TARGET = `                <SectionHeader icon="🔔" title={lang === 'bs' ? 'Notifikacije i podsjetnici u aplikaciji' : 'In-App Reminders'} />`;

const NEW_BLOCK = `                {/* ── ALARMI SA TERENA (Real-time) ── */}
                <SectionHeader icon="🚨" title={lang === 'bs' ? 'Hitni Alarmi / Terenske Prijave' : 'Instant Alerts / Hazard Reports'} />
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-body">
                        <div style={{ display: 'flex', gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                                    {lang === 'bs' ? 'Email za obavijesti sa terena' : 'Field Alert Email'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                    {lang === 'bs' 
                                        ? 'Ovo je email adresa na koju se šalju trenutačni alarmi čim neko skenira javni QR kod i prijavi opasnu situaciju.' 
                                        : 'Immediate alerts will be sent here as soon as someone scans the public QR code and reports a hazard.'}
                                </div>
                                <input 
                                    className="form-input" 
                                    style={{ maxWidth: 300, background: 'var(--bg-page)', borderColor: 'rgba(239,68,68,0.4)', borderWidth: 2 }}
                                    placeholder={lang === 'bs' ? 'Npr. sigurnost@firma.ba' : 'E.g. safety@company.com'}
                                    value={notifSettings.obsNotifEmail || ''} 
                                    onChange={e => updateNotif('obsNotifEmail', e.target.value)} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <SectionHeader icon="🔔" title={lang === 'bs' ? 'Notifikacije i podsjetnici u aplikaciji' : 'In-App Reminders'} />`;

content = content.replace(TARGET, NEW_BLOCK);

fs.writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
console.log('patched settings UI!');
