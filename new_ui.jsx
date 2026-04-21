                {/* ── SUPER PREMIUM BRANDING SECTION ── */}
                <div style={{ marginTop: 40, borderTop: '1px solid rgba(150,150,150,0.1)', paddingTop: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #059669))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/></svg>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.3px' }}>{lang === 'bs' ? 'Branding & Identitet' : 'Brand Identity'}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, marginTop: 4 }}>{lang === 'bs' ? 'Vrhunski dizajn za vašu aplikaciju i tiskane PDF izvještaje.' : 'Premium design elements for your dashboard and reports.'}</p>
                      </div>
                    </div>
                    {/* Add back Default Settings Reset entirely */}
                    <button type="button" onClick={() => { if(confirm(lang==='bs'?'Poništi sve na početne EZNR vrijednosti?':'Reset to EZNR defaults?')){setUiPrimaryColor(EZNR_DEFAULTS.primaryColor);setUiSidebarColor(EZNR_DEFAULTS.sidebarColor);setSidebarLogoEnabled(false);setSidebarText(UI_DEFAULTS.sidebarText);setPdfAccentColor(EZNR_DEFAULTS.accentColor);setWmEnabled(true);setHeaderEnabled(true);setShowCompanyInfo(true);setWmOpacity(5);setWmSize(280);setLogoPosition('left');setLogoSize(40);setHeaderText('');setHeaderColor('#1a1a2e');setDirty('company');} }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>{lang === 'bs' ? 'Vrati zadane postavke' : 'Reset to Defaults'}</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>
                  
                    {/* === APP BRANDING CARD ( PREMIUM ) === */}
                    <div style={{ borderRadius: 20, background: 'var(--bg-card)', border: '1px solid rgba(150,150,150,0.15)', boxShadow: '0 12px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                      <div style={{ padding: '20px 24px', background: 'linear-gradient(to right, rgba(150,150,150,0.03), transparent)', borderBottom: '1px solid rgba(150,150,150,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)' }}><svg width="18" height="18" fill="none" stroke="var(--primary)" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{lang === 'bs' ? 'Izgled Aplikacije' : 'Application Appereance'}</div>
                        </div>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '4px 10px', borderRadius: 12, background: 'linear-gradient(135deg,#1f2937,#111827)', color: '#fff', marginLeft: 'auto', letterSpacing: 0.5 }}>ENTERPRISE</span>
                      </div>
                      
                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                          {/* SMART THEMES */}
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '1.1rem' }}>✨</span> {lang === 'bs' ? 'Pametne Tematske Palete' : 'Smart Theme Palettes'}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                              {[
                                { name: 'Ocean', primary: '#0ea5e9', sidebar: '#0f172a' },
                                { name: 'Smaragd', primary: '#10b981', sidebar: '#064e3b' },
                                { name: 'Amethyst', primary: '#a855f7', sidebar: '#2e1065' },
                                { name: 'Sunset', primary: '#f97316', sidebar: '#1c1917' },
                                { name: 'Minimal', primary: '#14b8a6', sidebar: '#1e293b' },
                                { name: 'Classic', primary: '#005bea', sidebar: '#1c1c28' }
                              ].map(t => (
                                <button key={t.name} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 16, cursor: 'pointer', transition: 'all 0.25s', position: 'relative', overflow: 'hidden' }} 
                                  onClick={() => { setUiPrimaryColor(t.primary); setUiSidebarColor(t.sidebar); if(typeof window !== 'undefined') { document.documentElement.style.setProperty('--accent', t.primary); document.documentElement.style.setProperty('--bg-sidebar', t.sidebar); } setDirty('company'); }} 
                                  onMouseOver={e=>{e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.08)';}} 
                                  onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>
                                  <div style={{ display: 'flex', width: '100%', height: 28, borderRadius: 8, overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <div style={{ flex: 1, background: t.sidebar }}></div>
                                    <div style={{ flex: 1, background: t.primary }}></div>
                                  </div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{t.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* MANUAL COLORS & SIDEBAR LOGO ROW */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '20px', background: 'var(--bg-input)', borderRadius: 20, border: '1px solid var(--border)' }}>
                            {/* Primary */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: '1 1 200px' }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lang === 'bs' ? 'Primarna Web Boja' : 'Primary Color'}</div>
                              </div>
                              <label style={{ display: 'inline-block', width: 42, height: 42, borderRadius: 12, border: '2px solid rgba(150,150,150,0.2)', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                                <input type="color" value={uiPrimaryColor || EZNR_DEFAULTS.primaryColor} onChange={e=>{setUiPrimaryColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 80, height: 80, cursor: 'pointer', opacity: 0 }} />
                                <div style={{ width: '100%', height: '100%', background: uiPrimaryColor || EZNR_DEFAULTS.primaryColor, pointerEvents: 'none' }} />
                              </label>
                            </div>
                            {/* Sidebar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: '1 1 200px' }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lang === 'bs' ? 'Boja Bočne Trake' : 'Sidebar Color'}</div>
                              </div>
                              <label style={{ display: 'inline-block', width: 42, height: 42, borderRadius: 12, border: '2px solid rgba(150,150,150,0.2)', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                                <input type="color" value={uiSidebarColor || EZNR_DEFAULTS.sidebarColor} onChange={e=>{setUiSidebarColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 80, height: 80, cursor: 'pointer', opacity: 0 }} />
                                <div style={{ width: '100%', height: '100%', background: uiSidebarColor || EZNR_DEFAULTS.sidebarColor, pointerEvents: 'none' }} />
                              </label>
                            </div>
                            {/* Logo Replace */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', paddingTop: 16, borderTop: '1px solid rgba(150,150,150,0.1)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: sidebarLogoEnabled ? 'var(--text)' : 'var(--text-muted)' }}>{lang === 'bs' ? 'Zamijeni logo mojim logom u bočnoj traci' : 'Replace logo with mine in sidebar'}</div>
                                  <div onClick={()=>{setSidebarLogoEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: sidebarLogoEnabled ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                    <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: sidebarLogoEnabled ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                  </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input type="text" value={sidebarText || ''} onChange={e=>{setSidebarText(e.target.value);setDirty('company');}} placeholder={lang==='bs'?'Tekst ispod loga... (opcionalno)':'Text below logo... (optional)'} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.82rem', width: '100%', maxWidth: 400 }} />
                              </div>
                            </div>
                          </div>

                      </div>
                    </div>



                    {/* === PDF BRANDING CARD ( PREMIUM ) === */}
                    <div style={{ borderRadius: 20, background: 'var(--bg-card)', border: '1px solid rgba(150,150,150,0.15)', boxShadow: '0 12px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                      <div style={{ padding: '20px 24px', background: 'linear-gradient(to right, rgba(150,150,150,0.03), transparent)', borderBottom: '1px solid rgba(150,150,150,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)' }}><svg width="18" height="18" fill="none" stroke="var(--primary)" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{lang === 'bs' ? 'PDF Branding' : 'PDF Report Branding'}</div>
                        </div>
                      </div>

                      <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                        
                        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                          
                          {/* Top Row Base settings */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{lang==='bs'?'Akcent Boja':'Accent Color'}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <label style={{ display: 'inline-block', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                                    <input type="color" value={pdfAccentColor || EZNR_DEFAULTS.accentColor} onChange={e=>{setPdfAccentColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, cursor: 'pointer', opacity: 0 }} />
                                    <div style={{ width: '100%', height: '100%', background: pdfAccentColor || EZNR_DEFAULTS.accentColor, pointerEvents: 'none' }} />
                                  </label>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{lang==='bs'?'Podaci Firme':'Company Info'}</div>
                                <div onClick={()=>{setShowCompanyInfo(e=>!e);setDirty('company');}} style={{ width: 42, height: 24, background: showCompanyInfo !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                  <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: showCompanyInfo !== false ? 20 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                </div>
                            </div>
                          </div>

                          {/* Header / Zaglavlje */}
                          <div style={{ background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)', textTransform: 'uppercase' }}>{lang === 'bs' ? 'Zaglavlje Dokumenta' : 'Document Header'}</div>
                              <div onClick={()=>{setHeaderEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: headerEnabled !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: headerEnabled !== false ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                              </div>
                            </div>
                            
                            {headerEnabled !== false && (
                              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{lang==='bs'?'Pozicija Loga:':'Logo Position:'}</span>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {LOGO_POSITIONS.map(p => (
                                        <button key={p.id} onClick={() => { setLogoPosition(p.id); setDirty('company'); }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: logoPosition === p.id ? '2px solid var(--primary)' : '1px solid var(--border)', background: logoPosition === p.id ? 'var(--primary-glow)' : 'var(--bg-card)', color: logoPosition === p.id ? 'var(--primary)' : 'var(--text-muted)' }}>{p.label}</button>
                                      ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: 100 }}>{lang==='bs'?'Veličina Loga:':'Logo Size:'}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                                      <input type="range" min={20} max={80} value={logoSize} onChange={e => { setLogoSize(+e.target.value); setDirty('company'); }} style={{ flex: 1, accentColor: 'var(--primary)' }} />
                                      <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>{logoSize}px</code>
                                    </div>
                                </div>

                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input type="text" value={headerText} onChange={e => { setHeaderText(e.target.value); setDirty('company'); }} placeholder={lang === 'bs' ? 'Dodatni tekst... (opcionalno)' : 'Header text... (optional)'} style={{ flex: '1 1 200px', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600 }} />
                                    
                                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: '3px', borderRadius: 8, border: '1px solid var(--border)' }}>
                                      <button onClick={() => { setHeaderBold(b => !b); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerBold ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', fontWeight: 900, color: headerBold ? 'var(--primary)' : 'var(--text-muted)' }}>B</button>
                                      <button onClick={() => { setHeaderItalic(i => !i); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerItalic ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', fontStyle: 'italic', fontWeight: 700, color: headerItalic ? 'var(--primary)' : 'var(--text-muted)' }}>I</button>
                                      <button onClick={() => { setHeaderUnderline(u => !u); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerUnderline ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700, color: headerUnderline ? 'var(--primary)' : 'var(--text-muted)' }}>U</button>
                                    </div>
                                    <select value={headerFontSize} onChange={e => { setHeaderFontSize(+e.target.value); setDirty('company'); }} style={{ height: 40, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: '0.8rem' }}>
                                      {[8,9,10,11,12,14,16,18,20].map(s => <option key={s} value={s}>{s}pt</option>)}
                                    </select>
                                    <label style={{ display: 'inline-block', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '1px solid var(--border)' }}>
                                      <input type="color" value={headerColor || '#000000'} onChange={e=>{setHeaderColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, cursor: 'pointer', opacity: 0 }} />
                                      <div style={{ width: '100%', height: '100%', background: headerColor || '#000000', pointerEvents: 'none' }} />
                                    </label>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* WATERMARK MODULE */}
                          <div style={{ background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(150,150,150,0.1)' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)', textTransform: 'uppercase' }}>{lang === 'bs' ? 'Vodeni Žig / Pečat' : 'Watermark'}</div>
                              <div onClick={()=>{setWmEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: wmEnabled !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: wmEnabled !== false ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                              </div>
                            </div>
                            
                            {wmEnabled !== false && (
                              <div style={{ padding: '20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minWidth: 200 }}>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{lang === 'bs' ? 'Sadržaj:' : 'Content:'}</div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      {[{id:'logo',lbl:'Logo'},{id:'name',lbl:lang==='bs'?'Naziv':'Name'},{id:'both',lbl:lang==='bs'?'Oboje':'Both'}].map(o => (
                                        <button key={o.id} onClick={()=>{setWmContent(o.id);setDirty('company');}} style={{flex: 1, padding:'8px 6px',borderRadius:8,fontSize:'0.75rem',fontWeight:700,cursor:'pointer',border:wmContent===o.id?'2px solid var(--primary)':'1px solid var(--border)',background:wmContent===o.id?'var(--primary-glow)':'var(--bg-card)',color:wmContent===o.id?'var(--primary)':'var(--text-muted)'}}>{o.lbl}</button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{lang === 'bs' ? 'Transparentnost' : 'Opacity'} ({wmOpacity}%)</div>
                                    <input type="range" min={1} max={30} value={wmOpacity} onChange={e=>{setWmOpacity(+e.target.value);setDirty('company');}} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{lang === 'bs' ? 'Veličina' : 'Size'} ({wmSize}px)</div>
                                    <input type="range" min={80} max={600} value={wmSize} onChange={e=>{setWmSize(+e.target.value);setDirty('company');}} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{lang === 'bs' ? 'Pozicija' : 'Position'}</div>
                                  <table style={{ borderCollapse: 'separate', borderSpacing: '4px' }}>
                                    <tbody>
                                      {[0,1,2].map(r => (
                                        <tr key={r}>
                                          {[0,1,2].map(c => {
                                            const pos = WATERMARK_POSITIONS.find(p => p.row === r && p.col === c);
                                            if(!pos) return <td key={c}></td>;
                                            return (
                                              <td key={c} style={{ padding: 0 }}>
                                                <button type="button" onClick={()=>{setWmPosition(pos.id);setDirty('company');}} style={{ width: 44, height: 44, borderRadius: 10, fontSize: '1rem', cursor: 'pointer', border: 'none', background: wmPosition===pos.id ? 'var(--primary)' : 'var(--bg-card)', color: wmPosition===pos.id ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s', transform: wmPosition===pos.id ? 'scale(1.05)' : 'scale(1)', boxShadow: wmPosition===pos.id ? '0 4px 12px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>{pos.label}</button>
                                              </td>
                                            )
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                
                              </div>
                            )}
                          </div>

                        </div>

                        {/* LIVE REPORT PREVIEW HERO */}
                        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
                           <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>{lang === 'bs' ? 'PDF simulacija' : 'Live Report Simulation'}</div>
                           <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, padding: '24px 24px 60px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', height: '100%', minHeight: 400 }}>
                              {/* Watermark Rendering */}
                              {wmEnabled !== false && (
                                <div style={{ position:'absolute', pointerEvents:'none', zIndex:0, textAlign:'center', top:wmPosition.includes('top')?'15%':wmPosition.includes('bottom')?'90%':'50%', left:wmPosition.includes('left')?'15%':wmPosition.includes('right')?'85%':'50%', transform:'translate(-50%,-50%)', opacity:wmOpacity/100, transition: 'all 0.4s ease' }}>
                                  {(wmContent==='logo'||wmContent==='both') && companyData.logo && <img src={companyData.logo} alt="" style={{maxWidth:wmSize*0.5,maxHeight:wmSize*0.3,objectFit:'contain',display:'block',margin:'0 auto'}} />}
                                  {(wmContent==='name'||wmContent==='both') && <div style={{fontSize:Math.max(6,Math.round(wmSize/16))+'pt',fontWeight:900,letterSpacing:1,textTransform:'uppercase',color:'#000',marginTop:4}}>{companyData.naziv||'NAZIV'}</div>}
                                </div>
                              )}

                              {/* Header Rendering */}
                              {headerEnabled !== false && (
                                <div style={{display:'flex',justifyContent:logoPosition==='center'?'center':'space-between',alignItems:'flex-start',borderBottom:'3px solid '+pdfAccentColor,paddingBottom:8,marginBottom:12,position:'relative',zIndex:1, transition: 'border-color 0.3s'}}>
                                  <div style={{textAlign:logoPosition==='center'?'center':'left'}}>
                                    {companyData.logo
                                      ?<img src={companyData.logo} alt="" style={{height:Math.max(logoSize*0.45, 30),maxWidth:120,objectFit:'contain'}}/>
                                      :<div style={{fontSize:'8pt',fontWeight:800,color:pdfAccentColor}}>{companyData.naziv||'Company'}</div>}
                                  </div>
                                  {logoPosition!=='center' && showCompanyInfo !== false && (
                                    <div style={{textAlign:'right',fontSize:'3.5pt',color:'#666', lineHeight: 1.4}}>
                                      <div style={{fontWeight: 700, color: '#333', fontSize: '4.5pt'}}>{companyData.naziv}</div>
                                      <div>{companyData.adresa}</div>
                                      {companyData.jib && <div>JIB: {companyData.jib}</div>}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Custom text */}
                              {headerEnabled !== false && (
                                <div style={{fontSize:Math.max(5,headerFontSize*0.5)+'pt',fontWeight:headerBold?800:500,fontStyle:headerItalic?'italic':'normal',textDecoration:headerUnderline?'underline':'none',color:headerColor,marginBottom:15,position:'relative',zIndex:1}}>{headerText || (lang==='bs'?'Prazno...':'Empty...')}</div>
                              )}
                              
                              {/* Mock Content */}
                              <div style={{fontSize:'6pt',fontWeight:800,textTransform:'uppercase',letterSpacing:0.5,color:'#1e293b',position:'relative',zIndex:1, marginBottom: 8}}>{lang==='bs'?'IZVJEŠTAJ O PROCJENI':'ASSESSMENT REPORT'}</div>
                              <div style={{position:'relative',zIndex:1}}>{[1,2,3,4,5].map(i=>(
                                <div key={i} style={{display:'flex',gap:6,marginBottom:6}}>
                                  <div style={{width:'30%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                  <div style={{width:'50%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                  <div style={{width:'20%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                </div>
                              ))}</div>
                           </div>
                        </div>

                      </div>
                    </div>

                  </div>
                </div>{/* end super premium wrapper */}
