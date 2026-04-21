import fs from 'fs';

// ─── 1. PATCH settings/page.js ───────────────────────────────────────────────
let settings = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// 1a) Add showCompanyName state
settings = settings.replace(
  `const [showCompanyInfo, setShowCompanyInfo] = useState(true);`,
  `const [showCompanyInfo, setShowCompanyInfo] = useState(true);\r\n  const [showCompanyName, setShowCompanyName] = useState(true);`
);

// 1b) Add showCompanyName to load from branding
settings = settings.replace(
  `setShowCompanyInfo(pdfBrand.showCompanyInfo ?? true);`,
  `setShowCompanyInfo(pdfBrand.showCompanyInfo ?? true);\r\n      setShowCompanyName(pdfBrand.showCompanyName ?? true);`
);

// 1c) Add showCompanyName to save payload
settings = settings.replace(
  `showCompanyInfo: showCompanyInfo,`,
  `showCompanyInfo: showCompanyInfo,\r\n        showCompanyName: showCompanyName,`
);

// 1d) Fix SVG icon for "Izgled Aplikacije" — proper centered monitor icon
settings = settings.replace(
  /<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var\(--primary\)" strokeWidth="2\.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 18h8"\/><path d="M2 18h4"\/><path d="M16 2v6"\/><path d="M8 2v6"\/><rect width="20" height="12" x="2" y="4" rx="2"\/><\/svg>/,
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`
);

// 1e) Fix SVG icon for "PDF Branding" — proper centered document icon
settings = settings.replace(
  /<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var\(--primary\)" strokeWidth="2\.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"\/><path d="M14 2v6h6"\/><path d="M10 18H8"\/><path d="M16 18h-2"\/><\/svg>/,
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
);

// 1f) Add showCompanyName toggle + Vrati zadane postavke to PDF section
// Find the "Podaci Firme" toggle row and add showCompanyName toggle after it
const podaciFirmeToggle = `{lang==='bs'?'Podaci Firme':'Company Info'}</div>
                                <div onClick={()=>{setShowCompanyInfo(e=>!e);setDirty('company');}}`;
const showCompanyNameToggle = `{lang==='bs'?'Podaci Firme':'Company Info'}</div>
                                <div onClick={()=>{setShowCompanyInfo(e=>!e);setDirty('company');}}`;

// 1g) Add "Vrati zadane postavke" button inside PDF branding card header
const pdfHeaderEnd = `{lang === 'bs' ? 'PDF Branding' : 'PDF Report Branding'}</div>
                        </div>
                      </div>`;
settings = settings.replace(
  pdfHeaderEnd,
  `{lang === 'bs' ? 'PDF Branding' : 'PDF Report Branding'}</div>
                        </div>
                        <button type="button" onClick={() => { if(confirm(lang==='bs'?'Poništi PDF postavke na početne EZNR vrijednosti?':'Reset PDF settings to EZNR defaults?')){setPdfAccentColor(EZNR_DEFAULTS.accentColor);setWmEnabled(true);setHeaderEnabled(true);setShowCompanyInfo(true);setShowCompanyName(true);setWmPosition('center');setWmOpacity(5);setWmSize(280);setWmContent('both');setLogoPosition('left');setLogoSize(40);setHeaderText('');setHeaderFontSize(12);setHeaderBold(false);setHeaderItalic(false);setHeaderUnderline(false);setHeaderColor('#1a1a2e');setDirty('company');} }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>↺ {lang === 'bs' ? 'Vrati zadane' : 'Reset'}</button>
                      </div>`
);

// 1h) Add showCompanyName toggle next to showCompanyInfo in the PDF settings grid
const companyInfoRow = `{lang==='bs'?'Podaci Firme':'Company Info'}</div>`;
settings = settings.replace(
  companyInfoRow,
  `{lang==='bs'?'Podaci Firme':'Company Info'}</div>`
);

// Find the grid that has accent color and company info toggles and add a third item
const gridAfterCompanyInfo = `</div>
                          </div>

                          {/* Header / Zaglavlje */}`;
settings = settings.replace(
  gridAfterCompanyInfo,
  `</div>

                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{lang==='bs'?'Naziv Firme':'Company Name'}</div>
                                <div onClick={()=>{setShowCompanyName(e=>!e);setDirty('company');}} style={{ width: 42, height: 24, background: showCompanyName !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                  <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: showCompanyName !== false ? 20 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                </div>
                            </div>
                          </div>

                          {/* Header / Zaglavlje */}`
);

// 1i) Fix the PDF preview — center company name under logo and make optional
const oldPreviewCompanyName = `\${company.logo && companyName ? \`<div style="font-size:9pt;font-weight:800;color:#222;margin-top:3px;text-align:\${logoPos === 'center' ? 'center' : 'left'}">\${companyName}</div>\` : ''}`;
// This is in pdfReportGenerator — we'll fix that separately

// 1j) Update the live preview in settings page to respect showCompanyName
const oldLivePreviewName = `{companyData.logo && companyName ? \`<div`;

// Fix the live preview company name rendering to be optional & centered
settings = settings.replace(
  /\{companyData\.logo\s*\n?\s*\?<img src=\{companyData\.logo\} alt="" style=\{\{height:Math\.max\(logoSize\*0\.45, 30\),maxWidth:120,objectFit:'contain'\}\}\/>\s*\n?\s*:<div style=\{\{fontSize:'8pt',fontWeight:800,color:pdfAccentColor\}\}>\{companyData\.naziv\|\|'Company'\}<\/div>\}/,
  `{companyData.logo
                                      ?<img src={companyData.logo} alt="" style={{height:Math.max(logoSize*0.45, 30),maxWidth:120,objectFit:'contain',display:'block'}}/>
                                      :<div style={{fontSize:'8pt',fontWeight:800,color:pdfAccentColor}}>{companyData.naziv||'Company'}</div>}
                                    {showCompanyName !== false && companyData.logo && <div style={{fontSize:'5pt',fontWeight:800,color:'#333',textAlign:'center',width:Math.max(logoSize*0.45*4, 120),maxWidth:120,marginTop:2}}>{companyData.naziv}</div>}`
);

// 1k) Also add showCompanyName to the reset button
settings = settings.replace(
  `setShowCompanyInfo(true);setWmOpacity(5)`,
  `setShowCompanyInfo(true);setShowCompanyName(true);setWmOpacity(5)`
);

fs.writeFileSync('src/app/dashboard/settings/page.js', settings);
console.log('✅ settings/page.js patched');


// ─── 2. PATCH pdfReportGenerator.js ──────────────────────────────────────────
let pdf = fs.readFileSync('src/lib/pdfReportGenerator.js', 'utf8');

// 2a) Add showCompanyName to getCompanyInfo
pdf = pdf.replace(
  `showCompanyInfo: branding.showCompanyInfo ?? PDF_DEFAULTS.showCompanyInfo,`,
  `showCompanyInfo: branding.showCompanyInfo ?? PDF_DEFAULTS.showCompanyInfo,\n    showCompanyName: branding.showCompanyName ?? true,`
);

// 2b) Fix the company name in header to be optional and centered under logo
pdf = pdf.replace(
  /\$\{company\.logo && companyName \? `<div style="font-size:9pt;font-weight:800;color:#222;margin-top:3px;text-align:\$\{logoPos === 'center' \? 'center' : 'left'\}">\$\{companyName\}<\/div>` : ''\}/,
  `\${(company.showCompanyName !== false && company.logo && companyName) ? \`<div style="font-size:9pt;font-weight:800;color:#222;margin-top:3px;text-align:center;max-width:\${logoSize * 4}px">\${companyName}</div>\` : ''}`
);

// 2c) Add showCompanyName to PDF_DEFAULTS
pdf = pdf.replace(
  `showCompanyInfo: true,            // Show textual details block`,
  `showCompanyInfo: true,            // Show textual details block\n  showCompanyName: true,             // Show company name under logo`
);

fs.writeFileSync('src/lib/pdfReportGenerator.js', pdf);
console.log('✅ pdfReportGenerator.js patched');


// ─── 3. PATCH brandingService.js ─────────────────────────────────────────────
let branding = fs.readFileSync('src/lib/brandingService.js', 'utf8');

if (!branding.includes('showCompanyName')) {
  branding = branding.replace(
    `showCompanyInfo: true,            // Show textual details block`,
    `showCompanyInfo: true,            // Show textual details block\n  showCompanyName: true,             // Show company name under logo`
  );
  fs.writeFileSync('src/lib/brandingService.js', branding);
  console.log('✅ brandingService.js patched');
} else {
  console.log('⏭️  brandingService.js already has showCompanyName');
}

console.log('\n🎉 All patches applied successfully!');
