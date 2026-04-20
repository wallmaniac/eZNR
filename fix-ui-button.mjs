import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/app/dashboard/settings/page.js', 'utf8');

const oldUiBottom = `                    {(uiPrimaryColor||uiSidebarColor||sidebarLogoEnabled)&&(
                      <button onClick={()=>{setUiPrimaryColor('');setUiSidebarColor('');setSidebarLogoEnabled(false);setSidebarText(UI_DEFAULTS.sidebarText);setDirty('company');}}
                        style={{padding:'7px 16px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:'0.8rem',fontWeight:600,display:'flex',alignItems:'center',gap:6,width:'fit-content',marginTop:14}}>
                        ⟲ {lang==='bs'?'Vrati zadane vrijednosti':'Reset to defaults'}
                      </button>
                    )}

                  </div>{/* end ui card body */}`;

const newUiBottom = `                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 14 }}>
                      <button className="btn btn-primary" onClick={handleSaveCompany}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                      {(uiPrimaryColor || uiSidebarColor || sidebarLogoEnabled) && (
                        <button onClick={()=>{
                          setUiPrimaryColor(''); setUiSidebarColor(''); setSidebarLogoEnabled(false); setSidebarText(UI_DEFAULTS.sidebarText); setDirty('company');
                        }} style={{padding:'7px 16px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:'0.8rem',fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                          ⟲ {lang==='bs'?'Vrati zadane vrijednosti':'Reset to defaults'}
                        </button>
                      )}
                    </div>

                  </div>{/* end ui card body */}`;

content = content.replace(oldUiBottom.replace(/\r/g, ''), newUiBottom);
writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
console.log('Done UI card footer inject');
