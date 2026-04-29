const fs = require('fs');
let modal = fs.readFileSync('src/components/WorkerProfileModal.js', 'utf8');

const startStr = '{wp && (wp.radnoVrijemeOd || wp.radnoVrijemeDo) && (';
const endStr = '{wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo) && (';

const startIndex = modal.indexOf(startStr);
const endIndex = modal.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    const before = modal.substring(0, startIndex);
    const after = modal.substring(endIndex);
    
    const replacementStr = `{editMode ? (
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
                        `;
    
    fs.writeFileSync('src/components/WorkerProfileModal.js', before + replacementStr + after, 'utf8');
    console.log('SUCCESS: replaced!');
} else {
    console.log('ERROR: indices not found', startIndex, endIndex);
}
