const fs = require('fs');
let modal = fs.readFileSync('src/components/WorkerProfileModal.js', 'utf8');

const targetStr = `                        {/* Radno vrijeme — read-only from workplace */}
                        {wp && (wp.radnoVrijemeOd || wp.radnoVrijemeDo) && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Radno vrijeme od' : 'Work from'}</div>
                                    <div style={valueStyle}>{wp.radnoVrijemeOd || '—'}</div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Radno vrijeme do' : 'Work to'}</div>
                                    <div style={valueStyle}>{wp.radnoVrijemeDo || '—'}</div>
                                </div>
                            </div>
                        )}
                        {wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo) && (
                            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,83,80,0.12)', border: '1px solid var(--danger)', fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🌙 {lang === 'bs' ? 'Obavezan ljekarski pregled najmanje 1x u 2 godine (Noćni rad - čl. 40 FBiH)' : 'Mandatory medical exam min. 1x per 2 years (Night work)'}
                            </div>
                        )}`;

const replacementStr = `                        {/* Radno vrijeme */}
                        {editMode ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', marginTop: 12 }}>
                                <TimePicker label={lang === 'bs' ? 'Radno vrijeme od' : 'Work from'} value={formData.radnoVrijemeOd} onChange={v => set('radnoVrijemeOd', v)} />
                                <TimePicker label={lang === 'bs' ? 'Radno vrijeme do' : 'Work to'} value={formData.radnoVrijemeDo} onChange={v => set('radnoVrijemeDo', v)} />
                            </div>
                        ) : (formData.radnoVrijemeOd || formData.radnoVrijemeDo || (wp && (wp.radnoVrijemeOd || wp.radnoVrijemeDo))) ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', marginTop: 12 }}>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Radno vrijeme od' : 'Work from'}</div>
                                    <div style={valueStyle}>{formData.radnoVrijemeOd || wp?.radnoVrijemeOd || '—'}</div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Radno vrijeme do' : 'Work to'}</div>
                                    <div style={valueStyle}>{formData.radnoVrijemeDo || wp?.radnoVrijemeDo || '—'}</div>
                                </div>
                            </div>
                        ) : null}
                        {((formData.radnoVrijemeOd && formData.radnoVrijemeDo && isNightShift(formData.radnoVrijemeOd, formData.radnoVrijemeDo)) || (wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo))) && (
                            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,83,80,0.12)', border: '1px solid var(--danger)', fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🌙 {lang === 'bs' ? 'Obavezan ljekarski pregled najmanje 1x u 2 godine (Noćni rad - čl. 40 FBiH)' : 'Mandatory medical exam min. 1x per 2 years (Night work)'}
                            </div>
                        )}`;

if (modal.includes(targetStr)) {
    fs.writeFileSync('src/components/WorkerProfileModal.js', modal.replace(targetStr, replacementStr), 'utf8');
    console.log('SUCCESS: replaced!');
} else {
    console.log('ERROR: target string not found');
}
