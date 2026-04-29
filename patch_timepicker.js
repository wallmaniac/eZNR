const fs = require('fs');

// 1. Add TimePicker to WorkerFormFields
let formFields = fs.readFileSync('src/components/forms/WorkerFormFields.js', 'utf8');
if (!formFields.includes('export function TimePicker')) {
    formFields += `
export function TimePicker({ label, value, onChange }) {
    const [h, m] = (value || ':').split(':');
    return (
        <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{label}</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select className="form-select" style={{ padding: '8px 4px', minWidth: 60, textAlign: 'center' }} 
                        value={h || ''} 
                        onChange={e => onChange(\`\${e.target.value}:\${m || '00'}\`)}>
                    <option value="">--</option>
                    {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>)}
                </select>
                <span style={{ fontWeight: 700 }}>:</span>
                <select className="form-select" style={{ padding: '8px 4px', minWidth: 60, textAlign: 'center' }} 
                        value={m || ''} 
                        onChange={e => onChange(\`\${h || '08'}:\${e.target.value}\`)}>
                    <option value="">--</option>
                    {['00','15','30','45'].map(min => <option key={min} value={min}>{min}</option>)}
                </select>
            </div>
        </div>
    );
}
`;
    fs.writeFileSync('src/components/forms/WorkerFormFields.js', formFields, 'utf8');
    console.log('TimePicker added to WorkerFormFields.js');
}

// 2. Update workers/page.js
let workersPage = fs.readFileSync('src/app/dashboard/workers/page.js', 'utf8');
if (!workersPage.includes('TimePicker')) {
    workersPage = workersPage.replace("import { isoToDisplay, displayToISO, DateField, Field, SelectField, InfoTip, StazPicker, Accordion }", "import { isoToDisplay, displayToISO, DateField, Field, SelectField, InfoTip, StazPicker, Accordion, TimePicker }");
    workersPage = workersPage.replace(/<Field type="time" label=\{lang === 'bs' \? 'Radno vrijeme od' : 'Work from'\} value=\{formData\.radnoVrijemeOd\} onChange=\{v => updateField\('radnoVrijemeOd', v\)\} \/>/g, 
        `<TimePicker label={lang === 'bs' ? 'Radno vrijeme od' : 'Work from'} value={formData.radnoVrijemeOd} onChange={v => updateField('radnoVrijemeOd', v)} />`);
    workersPage = workersPage.replace(/<Field type="time" label=\{lang === 'bs' \? 'Radno vrijeme do' : 'Work to'\} value=\{formData\.radnoVrijemeDo\} onChange=\{v => updateField\('radnoVrijemeDo', v\)\} \/>/g, 
        `<TimePicker label={lang === 'bs' ? 'Radno vrijeme do' : 'Work to'} value={formData.radnoVrijemeDo} onChange={v => updateField('radnoVrijemeDo', v)} />`);
    fs.writeFileSync('src/app/dashboard/workers/page.js', workersPage, 'utf8');
    console.log('workers/page.js updated');
}

// 3. Update WorkerProfileModal.js
let modal = fs.readFileSync('src/components/WorkerProfileModal.js', 'utf8');
if (!modal.includes('TimePicker')) {
    modal = modal.replace("import { isoToDisplay, displayToISO, Field, DateField, SelectField, InfoTip, StazPicker }", "import { isoToDisplay, displayToISO, Field, DateField, SelectField, InfoTip, StazPicker, TimePicker }");
    
    // Inject into editMode of Radno Mjesto
    const radnoMjestoRegex = /\{wp && \(wp\.radnoVrijemeOd \|\| wp\.radnoVrijemeDo\) && \(/s;
    if (modal.match(radnoMjestoRegex)) {
        const replacement = `{editMode ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', marginTop: 12 }}>
                                <TimePicker label={lang === 'bs' ? 'Radno vrijeme od' : 'Work from'} value={formData.radnoVrijemeOd} onChange={v => set('radnoVrijemeOd', v)} />
                                <TimePicker label={lang === 'bs' ? 'Radno vrijeme do' : 'Work to'} value={formData.radnoVrijemeDo} onChange={v => set('radnoVrijemeDo', v)} />
                            </div>
                        ) : (formData.radnoVrijemeOd || formData.radnoVrijemeDo || (wp && (wp.radnoVrijemeOd || wp.radnoVrijemeDo))) ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', marginTop: 12 }}>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Radno vrijeme od' : 'Work from'}</div>
                                    <div style={valueStyle}>{formData.radnoVrijemeOd || wp?.radnoVrijemeOd || '-'}</div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Radno vrijeme do' : 'Work to'}</div>
                                    <div style={valueStyle}>{formData.radnoVrijemeDo || wp?.radnoVrijemeDo || '-'}</div>
                                </div>
                            </div>
                        ) : null}
                        {((formData.radnoVrijemeOd && formData.radnoVrijemeDo && isNightShift(formData.radnoVrijemeOd, formData.radnoVrijemeDo)) || (wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo))) && (`;

        modal = modal.replace(/\{\/\* Radno vrijeme — read-only from workplace \*\/\}\s*\{wp && \(wp\.radnoVrijemeOd \|\| wp\.radnoVrijemeDo\) && \(\s*<div style=\{\{ display: 'grid', gridTemplateColumns: 'repeat\(4, 1fr\)', gap: '0 16px' \}\}>\s*<div className="form-group" style=\{\{ marginBottom: 12 \}\}>\s*<div style=\{labelStyle\}>\{lang === 'bs' \? 'Radno vrijeme od' : 'Work from'\}<\/div>\s*<div style=\{valueStyle\}>\{wp\.radnoVrijemeOd \|\| '-'\}.*?\s*<\/div>\s*<div className="form-group" style=\{\{ marginBottom: 12 \}\}>\s*<div style=\{labelStyle\}>\{lang === 'bs' \? 'Radno vrijeme do' : 'Work to'\}<\/div>\s*<div style=\{valueStyle\}>\{wp\.radnoVrijemeDo \|\| '-'\}.*?\s*<\/div>\s*<\/div>\s*\)\}\s*\{wp && isNightShift\(wp\.radnoVrijemeOd, wp\.radnoVrijemeDo\) && \(/s, replacement);
        
        fs.writeFileSync('src/components/WorkerProfileModal.js', modal, 'utf8');
        console.log('WorkerProfileModal.js updated');
    } else {
        console.log('Radno Mjesto regex missed in WorkerProfileModal.js');
    }
}
