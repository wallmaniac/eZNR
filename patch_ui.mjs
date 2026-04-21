import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// 1. Add State Variable
const statePattern = `const [wmEnabled, setWmEnabled] = useState(PDF_DEFAULTS.watermarkEnabled);`;
if (!content.includes('showCompanyInfo')) {
  content = content.replace(statePattern, statePattern + `\n  const [showCompanyInfo, setShowCompanyInfo] = useState(true);`);
}

// 2. Add to useEffect loader
const loadPattern = `setLogoSize(pdfBrand.logoSize || 100);`;
if (!content.includes('setShowCompanyInfo(pdfBrand.showCompanyInfo')) {
  content = content.replace(loadPattern, loadPattern + `\n      setShowCompanyInfo(pdfBrand.showCompanyInfo ?? true);`);
}

// 3. Add to newBranding payload
const payloadPattern = `headerColor: headerColor,`;
if (content.includes(payloadPattern) && !content.includes('showCompanyInfo: showCompanyInfo')) {
  content = content.replace(payloadPattern, payloadPattern + `\n        showCompanyInfo: showCompanyInfo,`);
}

// 4. Inject PDF Toggle UI
// We'll place it right before the "Naslov Dokumenta" section in PDF branding
const pdfToggleTarget = `<div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12 }}>{lang === 'bs' ? 'Header (Naslov Dokumenta)' : 'Document Header'}</div>`;
const pdfToggleHtml = `
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', marginBottom: 20 }} onClick={() => { setShowCompanyInfo(!showCompanyInfo); setDirty('company'); }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: '1.2rem' }}>🏢</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{lang === 'bs' ? 'Prikaži podatke firme na PDF-u' : 'Show Company Info on PDF'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Prikaz adrese, JIB-a i telefona u gornjem desnom uglu dokumenta' : 'Shows address, JIB, and phone in the header'}</div>
                        </div>
                      </div>
                      <div className={\`eznr-switch \${showCompanyInfo ? 'active' : ''}\`}><div className="eznr-switch-knob"></div></div>
                    </div>
`;
if (!content.includes('Prikaži podatke firme')) {
  content = content.replace(pdfToggleTarget, pdfToggleHtml + '\n' + pdfToggleTarget);
}

// 5. Inject Smart Themes UI
// We'll place it right under the Palette / Custom text inputs (which ends with "Aktiviraj logo firme na bočnoj traci" toggle)
// Let's find a solid injection point. 
const smartThemeTarget = `<div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12 }}>
                        {lang === 'bs' ? 'Ove boje će se primijeniti samo na vaš dashboard. Za najbolji izgled, koristite kontrastne boje.' : 'These colors apply to your dashboard. Use contrasting colors for best results.'}
                      </div>`;
const smartThemesHtml = `
                      {/* Smart Themes Block */}
                      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 12 }}>✨ {lang === 'bs' ? 'Pametne tematske palete' : 'Smart Theme Palettes'}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                          {[
                            { name: 'Ocean', primary: '#0284c7', sidebar: '#0f172a' },
                            { name: 'Smaragd', primary: '#10b981', sidebar: '#064e3b' },
                            { name: 'Ljubičasta', primary: '#a855f7', sidebar: '#3b0764' },
                            { name: 'Ugljen', primary: '#ea580c', sidebar: '#1c1917' },
                            { name: 'Minimal', primary: '#14b8a6', sidebar: '#1e293b' },
                            { name: 'Klasični eZNR', primary: '#005bea', sidebar: '#1c1c28' }
                          ].map(t => (
                            <button key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => { setUiPrimaryColor(t.primary); setUiSidebarColor(t.sidebar); if(typeof window !== 'undefined') { document.documentElement.style.setProperty('--accent', t.primary); document.documentElement.style.setProperty('--bg-sidebar', t.sidebar); } setDirty('company'); }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--accent)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border)'}>
                               <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.primary, border: '1px solid rgba(0,0,0,0.1)' }}></div>
                               <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.sidebar, border: '1px solid rgba(0,0,0,0.1)', marginLeft: -10 }}></div>
                               <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: 4 }}>{t.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
`;
if (!content.includes('Pametne tematske palete')) {
  content = content.replace(smartThemeTarget, smartThemesHtml + '\n' + smartThemeTarget);
}

writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
console.log("Successfully patched page.js with missing components.");
