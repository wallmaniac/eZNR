// branding-replace3.mjs
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'src/app/dashboard/settings/page.js';
const content = readFileSync(FILE, 'utf8');

const startMarker = "{/* ── BRANDING SECTION ── */}";
const endMarker = "{lang === 'bs' ? 'Spremi branding i firmu' : 'Save branding & company'}</button>";

const parts = content.split(startMarker);
if (parts.length !== 2) throw new Error("Could not find start marker");

const subParts = parts[1].split(endMarker);
if (subParts.length !== 2) throw new Error("Could not find end marker");

const newSection = `
                {/* ── BRANDING SECTION ── */}
                <hr style={{ margin: '28px 0', border: 'none', borderTop: '2px solid var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r="1" fill="#FF5252" stroke="none"/>
                    <circle cx="17.5" cy="10.5" r="1" fill="#FFAB40" stroke="none"/>
                    <circle cx="8.5" cy="7.5" r="1" fill="#69F0AE" stroke="none"/>
                    <circle cx="6.5" cy="12" r="1" fill="#448AFF" stroke="none"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/>
                  </svg>
                  <h3 style={{ margin: 0 }}>{lang === 'bs' ? 'Branding kompanije' : 'Company Branding'}</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 24 }}>
                  {lang === 'bs'
                    ? 'Prilagodite izgled PDF izvještaja i korisničkog sučelja prema vizualnom identitetu vaše firme.'
                    : 'Customize PDF report appearance and dashboard UI to match your corporate identity.'}
                </p>

                {/* PDF BRANDING CARD */}
                <div style={{ borderRadius: 16, background: 'var(--bg-input)', border: '1px solid var(--border)', marginBottom: 16, overflow: 'hidden' }}>
                  {/* Card header */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lang === 'bs' ? 'PDF Branding' : 'PDF Report Branding'}</span>
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* === ACCENT COLOR === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text)' }}>{lang === 'bs' ? 'Boja naglaska' : 'Accent Color'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>{lang === 'bs' ? 'Koristi se za zaglavlje, linije i naglašene elemente.' : 'Used for header lines, badges and accents.'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {ACCENT_PRESETS.map(p => (
                          <button key={p.color} title={p.name}
                            onClick={() => { setPdfAccentColor(p.color); setDirty('company'); }}
                            style={{ width: 34, height: 34, borderRadius: 8, border: pdfAccentColor === p.color ? '3px solid var(--text)' : '2px solid transparent', background: p.color, cursor: 'pointer', transition: 'transform 0.15s', boxShadow: pdfAccentColor === p.color ? '0 0 0 2px var(--bg-card)' : 'none', transform: pdfAccentColor === p.color ? 'scale(1.18)' : 'scale(1)' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Paleta boja:' : 'Color picker:'}</span>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setPdfPickerOpen(v => !v)}
                            style={{ width: 34, height: 34, borderRadius: 8, border: '2px solid var(--border)', background: pdfAccentColor, cursor: 'pointer', padding: 0, display: 'block' }}
                          />
                          {pdfPickerOpen && (
                            <>
                              <div onClick={() => setPdfPickerOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199 }} />
                              <div style={{ position: 'absolute', top: 42, left: 0, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                                  <button onClick={() => setPdfPickerOpen(false)} style={{ border: 'none', background: 'var(--bg-input)', color: 'var(--text-muted)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                                </div>
                                <input type="color" value={pdfAccentColor}
                                  onChange={e => { setPdfAccentColor(e.target.value); setDirty('company'); }}
                                  style={{ width: 200, height: 180, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                              </div>
                            </>
                          )}
                        </div>
                        <code style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '3px 8px', borderRadius: 6 }}>{pdfAccentColor}</code>
                      </div>
                    </div>

                    {/* === LOGO POSITION & SIZE === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 10, color: 'var(--text)' }}>{lang === 'bs' ? 'Logo – pozicija i veličina' : 'Logo Position & Size'}</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        {LOGO_POSITIONS.map(p => (
                          <button key={p.id} onClick={() => { setLogoPosition(p.id); setDirty('company'); }}
                            style={{ padding: '6px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: logoPosition === p.id ? '2px solid var(--primary)' : '1px solid var(--border)', background: logoPosition === p.id ? 'var(--primary-glow)' : 'var(--bg-card)', color: logoPosition === p.id ? 'var(--primary)' : 'var(--text-muted)' }}
                          >{p.label}</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 60 }}>{lang === 'bs' ? 'Veličina:' : 'Size:'}</span>
                        <input type="range" min={20} max={80} value={logoSize}
                          onChange={e => { setLogoSize(+e.target.value); setDirty('company'); }}
                          style={{ flex: 1, maxWidth: 260, accentColor: 'var(--primary)' }} />
                        <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{logoSize}px</code>
                      </div>
                    </div>

                    {/* === HEADER TEXT === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text)' }}>{lang === 'bs' ? 'Tekst zaglavlja' : 'Header Text'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>{lang === 'bs' ? 'Opcionalni tekst ispod zaglavlja na svim PDF izvještajima.' : 'Optional text below the header on all PDF reports.'}</div>
                      <input type="text" value={headerText}
                        onChange={e => { setHeaderText(e.target.value); setDirty('company'); }}
                        placeholder={lang === 'bs' ? 'Npr. "Zaštita na radu i požaru"' : 'e.g. "Safety & Health Division"'}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.85rem', marginBottom: 10, boxSizing: 'border-box' }} />
                      {/* Formatting toolbar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button title={lang === 'bs' ? 'Podebljano' : 'Bold'}
                          onClick={() => { setHeaderBold(b => !b); setDirty('company'); }}
                          style={{ width: 34, height: 34, borderRadius: 6, border: headerBold ? '2px solid var(--primary)' : '1px solid var(--border)', background: headerBold ? 'var(--primary-glow)' : 'var(--bg-card)', cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem', color: 'var(--text)' }}>B</button>
                        <button title={lang === 'bs' ? 'Kurziv' : 'Italic'}
                          onClick={() => { setHeaderItalic(i => !i); setDirty('company'); }}
                          style={{ width: 34, height: 34, borderRadius: 6, border: headerItalic ? '2px solid var(--primary)' : '1px solid var(--border)', background: headerItalic ? 'var(--primary-glow)' : 'var(--bg-card)', cursor: 'pointer', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text)' }}>I</button>
                        <button title={lang === 'bs' ? 'Podcrtano' : 'Underline'}
                          onClick={() => { setHeaderUnderline(u => !u); setDirty('company'); }}
                          style={{ width: 34, height: 34, borderRadius: 6, border: headerUnderline ? '2px solid var(--primary)' : '1px solid var(--border)', background: headerUnderline ? 'var(--primary-glow)' : 'var(--bg-card)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem', color: 'var(--text)' }}>U</button>
                        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Aa</span>
                          <select value={headerFontSize} onChange={e => { setHeaderFontSize(+e.target.value); setDirty('company'); }}
                            style={{ height: 34, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.8rem' }}>
                            {[8,9,10,11,12,14,16,18,20,24].map(s => <option key={s} value={s}>{s}pt</option>)}
                          </select>
                        </div>
                        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>A</span>
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setHeaderColorPickerOpen(v => !v)}
                              style={{ width: 34, height: 34, borderRadius: 6, border: '2px solid var(--border)', background: headerColor, cursor: 'pointer', padding: 0 }}
                            />
                            {headerColorPickerOpen && (
                              <>
                                <div onClick={() => setHeaderColorPickerOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199 }} />
                                <div style={{ position: 'absolute', top: 42, left: 0, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                                    <button onClick={() => setHeaderColorPickerOpen(false)} style={{ border: 'none', background: 'var(--bg-input)', color: 'var(--text-muted)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                                  </div>
                                  <input type="color" value={headerColor}
                                    onChange={e => { setHeaderColor(e.target.value); setDirty('company'); }}
                                    style={{ width: 180, height: 160, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* === WATERMARK === */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{lang === 'bs' ? 'Vodeni Žig' : 'Watermark'}</div>
                        <button
                          onClick={() => { setWmEnabled(e => !e); setDirty('company'); }}
                          title={wmEnabled ? 'Isključi' : 'Uključi'}
                          style={{ display: 'flex', alignItems: 'center', height: 26, padding: '0 12px', borderRadius: 13, fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: wmEnabled ? 'var(--primary)' : 'var(--border)', color: wmEnabled ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                        >{wmEnabled ? (lang === 'bs' ? 'Uključen' : 'ON') : (lang === 'bs' ? 'Isključen' : 'OFF')}</button>
                      </div>

                      {wmEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* Content type */}
                          <div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{lang === 'bs' ? 'Sadržaj:' : 'Content:'}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {[{id:'logo',lbl:'Logo'},{id:'name',lbl:lang==='bs'?'Naziv':'Name'},{id:'both',lbl:lang==='bs'?'Oboje':'Both'}].map(o => (
                                <button key={o.id} onClick={()=>{setWmContent(o.id);setDirty('company');}}
                                  style={{padding:'5px 14px',borderRadius:8,fontSize:'0.78rem',fontWeight:600,cursor:'pointer',border:wmContent===o.id?'2px solid var(--primary)':'1px solid var(--border)',background:wmContent===o.id?'var(--primary-glow)':'var(--bg-card)',color:wmContent===o.id?'var(--primary)':'var(--text-muted)'}}>
                                  {o.lbl}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Position grid */}
                          <div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{lang === 'bs' ? 'Pozicija:' : 'Position:'}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,36px)', gap: 4 }}>
                              {WATERMARK_POSITIONS.map(pos => (
                                <button key={pos.id} title={pos.id}
                                  onClick={()=>{setWmPosition(pos.id);setDirty('company');}}
                                  style={{ width:36,height:36,borderRadius:8,fontSize:'0.85rem',cursor:'pointer', border:wmPosition===pos.id?'2px solid var(--primary)':'1px solid var(--border)', background:wmPosition===pos.id?'var(--primary)':'var(--bg-card)', color:wmPosition===pos.id?'#fff':'var(--text-muted)', display:'flex',alignItems:'center',justifyContent:'center' }}>
                                  {pos.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Opacity */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', minWidth: 100, whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'Transparentnost:' : 'Opacity:'}</span>
                            <input type="range" min={1} max={30} value={wmOpacity}
                              onChange={e=>{setWmOpacity(+e.target.value);setDirty('company');}}
                              style={{flex:1,maxWidth:220,accentColor:'var(--primary)'}} />
                            <code style={{fontSize:'0.73rem',color:'var(--text-muted)',minWidth:36,textAlign:'right'}}>{wmOpacity}%</code>
                          </div>

                          {/* Size */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', minWidth: 100, whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'Veličina:' : 'Size:'}</span>
                            <input type="range" min={80} max={500} value={wmSize}
                              onChange={e=>{setWmSize(+e.target.value);setDirty('company');}}
                              style={{flex:1,maxWidth:220,accentColor:'var(--primary)'}} />
                            <code style={{fontSize:'0.73rem',color:'var(--text-muted)',minWidth:46,textAlign:'right'}}>{wmSize}px</code>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* === LIVE PDF PREVIEW === */}
                    <div>
                      <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>{lang === 'bs' ? 'PDF pregled uživo' : 'Live PDF Preview'}</div>
                      <div style={{ background: '#fff', border: '1px solid #d0d0d0', borderRadius: 10, padding: '16px 16px 40px', position: 'relative', overflow: 'hidden', maxWidth: 340, minHeight: 180, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
                        {/* Watermark */}
                        {wmEnabled && (
                          <div style={{
                            position:'absolute', pointerEvents:'none', zIndex:0, textAlign:'center',
                            top:wmPosition.includes('top')?'14%':wmPosition.includes('bottom')?'82%':'50%',
                            left:wmPosition.includes('left')?'18%':wmPosition.includes('right')?'82%':'50%',
                            transform:'translate(-50%,-50%)', opacity:wmOpacity/100,
                          }}>
                            {(wmContent==='logo'||wmContent==='both')&&companyData.logo&&
                              <img src={companyData.logo} alt="" style={{maxWidth:wmSize*0.45,maxHeight:wmSize*0.28,objectFit:'contain',display:'block',margin:'0 auto 3px'}} />}
                            {(wmContent==='name'||wmContent==='both')&&
                              <div style={{fontSize:Math.max(5,Math.round(wmSize/22))+'pt',fontWeight:900,letterSpacing:1,textTransform:'uppercase',color:'#000'}}>
                                {companyData.naziv||(lang==='bs'?'Naziv firme':'Company')}
                              </div>}
                          </div>
                        )}
                        {/* Header */}
                        <div style={{display:'flex',justifyContent:logoPosition==='center'?'center':'space-between',alignItems:'flex-start',borderBottom:'2px solid '+pdfAccentColor,paddingBottom:5,marginBottom:5,position:'relative',zIndex:1}}>
                          <div style={{textAlign:logoPosition==='center'?'center':'left'}}>
                            {companyData.logo
                              ?<img src={companyData.logo} alt="" style={{height:logoSize*0.45,maxWidth:90,objectFit:'contain'}}/>
                              :<span style={{fontSize:'7pt',fontWeight:800,color:pdfAccentColor}}>{companyData.naziv||(lang==='bs'?'Naziv firme':'Company')}</span>}
                            {companyData.logo&&companyData.naziv&&<div style={{fontSize:'3.5pt',color:'#555',fontWeight:600,marginTop:1}}>{companyData.naziv}</div>}
                          </div>
                          {logoPosition!=='center'&&<div style={{textAlign:'right',fontSize:'3.5pt',color:'#555'}}>{companyData.adresa}</div>}
                        </div>
                        {headerText&&<div style={{fontSize:Math.max(4,headerFontSize*0.45)+'pt',fontWeight:headerBold?800:400,fontStyle:headerItalic?'italic':'normal',textDecoration:headerUnderline?'underline':'none',color:headerColor,marginBottom:3,position:'relative',zIndex:1}}>{headerText}</div>}
                        <div style={{fontSize:'5pt',fontWeight:800,textTransform:'uppercase',letterSpacing:0.4,color:'#1a1a2e',position:'relative',zIndex:1}}>{lang==='bs'?'EVIDENCIJA RADNIKA':'WORKER REGISTRY'}</div>
                        <div style={{fontSize:'3pt',color:'#aaa',marginBottom:5,position:'relative',zIndex:1}}>Preview</div>
                        <div style={{position:'relative',zIndex:1}}>{[1,2,3,4].map(i=>(
                          <div key={i} style={{display:'flex',gap:4,marginBottom:3}}>
                            <div style={{width:'25%',height:3,background:i===1?pdfAccentColor+'22':'#f5f5f5',borderRadius:1}}/>
                            <div style={{width:'45%',height:3,background:i===1?pdfAccentColor+'22':'#f5f5f5',borderRadius:1}}/>
                            <div style={{width:'30%',height:3,background:i===1?pdfAccentColor+'22':'#f5f5f5',borderRadius:1}}/>
                          </div>
                        ))}</div>
                        <div style={{position:'absolute',bottom:8,left:16,right:16,borderTop:'1px solid #eee',paddingTop:3,display:'flex',justifyContent:'space-between',fontSize:'3pt',color:'#bbb',zIndex:1}}>
                          <span>{companyData.naziv}</span>
                          <span>{new Date().toLocaleDateString('bs-BA')}</span>
                        </div>
                      </div>
                    </div>

                  </div>{/* end pdf card body */}
                </div>{/* end pdf card */}

                {/* UI BRANDING CARD */}
                <div style={{ borderRadius: 16, background: 'var(--bg-input)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
                  {/* Card header */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lang === 'bs' ? 'Branding aplikacije' : 'App Branding'}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'linear-gradient(135deg,#7B1FA2,#E040FB)', color: '#fff', marginLeft: 'auto' }}>ENTERPRISE</span>
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* === PRIMARY COLOR === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text)' }}>{lang === 'bs' ? 'Primarna boja (gumbi, akcenti)' : 'Primary color (buttons, accents)'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <button title={lang==='bs'?'Zadano':'Default'} onClick={()=>{setUiPrimaryColor('');setDirty('company');}}
                          style={{width:34,height:34,borderRadius:8,border:!uiPrimaryColor?'3px solid var(--text)':'2px solid var(--border)',background:'linear-gradient(135deg,#ccc,#eee)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'#888',transform:!uiPrimaryColor?'scale(1.15)':'scale(1)'}}>⟲</button>
                        {ACCENT_PRESETS.map(p=>(
                          <button key={'ui-'+p.color} title={p.name} onClick={()=>{setUiPrimaryColor(p.color);setDirty('company');}}
                            style={{width:34,height:34,borderRadius:8,border:uiPrimaryColor===p.color?'3px solid var(--text)':'2px solid transparent',background:p.color,cursor:'pointer',transition:'transform 0.15s',boxShadow:uiPrimaryColor===p.color?'0 0 0 2px var(--bg-card)':' none',transform:uiPrimaryColor===p.color?'scale(1.18)':'scale(1)'}} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Paleta boja:' : 'Color picker:'}</span>
                        <div style={{ position: 'relative' }}>
                          <button onClick={()=>setUiPrimaryPickerOpen(v=>!v)}
                            style={{width:34,height:34,borderRadius:8,border:'2px solid var(--border)',background:uiPrimaryColor||EZNR_DEFAULTS.primaryColor,cursor:'pointer',padding:0}} />
                          {uiPrimaryPickerOpen && (
                            <>
                              <div onClick={() => setUiPrimaryPickerOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199 }} />
                              <div style={{position:'absolute',top:42,left:0,zIndex:200,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:12,boxShadow:'0 8px 32px rgba(0,0,0,0.35)'}}>
                                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}>
                                  <button onClick={()=>setUiPrimaryPickerOpen(false)} style={{border:'none',background:'var(--bg-input)',color:'var(--text-muted)',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:'0.8rem',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
                                </div>
                                <input type="color" value={uiPrimaryColor||EZNR_DEFAULTS.primaryColor}
                                  onChange={e=>{setUiPrimaryColor(e.target.value);setDirty('company');}}
                                  style={{width:200,height:180,border:'none',background:'transparent',cursor:'pointer',padding:0}} />
                              </div>
                            </>
                          )}
                        </div>
                        <code style={{fontSize:'0.78rem',color:'var(--text-muted)',background:'var(--bg-card)',padding:'3px 8px',borderRadius:6}}>{uiPrimaryColor||EZNR_DEFAULTS.primaryColor}</code>
                      </div>
                    </div>

                    {/* === SIDEBAR COLOR === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text)' }}>{lang === 'bs' ? 'Boja bočne trake' : 'Sidebar color'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <button title={lang==='bs'?'Zadano':'Default'} onClick={()=>{setUiSidebarColor('');setDirty('company');}}
                          style={{width:34,height:34,borderRadius:8,border:!uiSidebarColor?'3px solid var(--text)':'2px solid var(--border)',background:'linear-gradient(135deg,#ccc,#eee)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'#888',transform:!uiSidebarColor?'scale(1.15)':'scale(1)'}}>⟲</button>
                        {SIDEBAR_PRESETS.map(p=>(
                          <button key={'sb-'+p.color} title={p.name} onClick={()=>{setUiSidebarColor(p.color);setDirty('company');}}
                            style={{width:34,height:34,borderRadius:8,border:uiSidebarColor===p.color?'3px solid var(--text)':'2px solid transparent',background:p.color,cursor:'pointer',transition:'transform 0.15s',boxShadow:uiSidebarColor===p.color?'0 0 0 2px var(--bg-card)':'none',transform:uiSidebarColor===p.color?'scale(1.18)':'scale(1)'}} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Paleta boja:' : 'Color picker:'}</span>
                        <div style={{ position: 'relative' }}>
                          <button onClick={()=>setUiSidebarPickerOpen(v=>!v)}
                            style={{width:34,height:34,borderRadius:8,border:'2px solid var(--border)',background:uiSidebarColor||EZNR_DEFAULTS.sidebarColor,cursor:'pointer',padding:0}} />
                          {uiSidebarPickerOpen && (
                            <>
                              <div onClick={() => setUiSidebarPickerOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199 }} />
                              <div style={{position:'absolute',top:42,left:0,zIndex:200,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:12,boxShadow:'0 8px 32px rgba(0,0,0,0.35)'}}>
                                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}>
                                  <button onClick={()=>setUiSidebarPickerOpen(false)} style={{border:'none',background:'var(--bg-input)',color:'var(--text-muted)',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:'0.8rem',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
                                </div>
                                <input type="color" value={uiSidebarColor||EZNR_DEFAULTS.sidebarColor}
                                  onChange={e=>{setUiSidebarColor(e.target.value);setDirty('company');}}
                                  style={{width:200,height:180,border:'none',background:'transparent',cursor:'pointer',padding:0}} />
                              </div>
                            </>
                          )}
                        </div>
                        <code style={{fontSize:'0.78rem',color:'var(--text-muted)',background:'var(--bg-card)',padding:'3px 8px',borderRadius:6}}>{uiSidebarColor||EZNR_DEFAULTS.sidebarColor}</code>
                      </div>
                    </div>

                    {/* === SIDEBAR LOGO & TEXT === */}
                    <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 12, color: 'var(--text)' }}>{lang === 'bs' ? 'Logo i tekst u bočnoj traci' : 'Sidebar Logo & Text'}</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
                        <div onClick={()=>{setSidebarLogoEnabled(e=>!e);setDirty('company');}}
                          style={{width:44,height:24,borderRadius:12,background:sidebarLogoEnabled?'var(--primary)':'var(--border)',position:'relative',flexShrink:0,cursor:'pointer',transition:'background 0.2s'}}>
                          <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:sidebarLogoEnabled?23:3,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.25)'}} />
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{lang === 'bs' ? 'Koristi logo firme u bočnoj traci' : 'Use company logo in sidebar'}</span>
                      </label>
                      {!companyData.logo && sidebarLogoEnabled && (
                        <div style={{fontSize:'0.75rem',color:'var(--danger)',fontWeight:600,marginBottom:10,padding:'8px 12px',borderRadius:8,background:'rgba(220,53,69,0.08)',border:'1px solid rgba(220,53,69,0.18)'}}>
                          {lang==='bs'?'Potrebno je prvo postaviti logo firme iznad.':'Upload a company logo first (in the Logo field above).'}
                        </div>
                      )}
                      <div>
                        <div style={{fontSize:'0.73rem',color:'var(--text-muted)',marginBottom:5,fontWeight:600}}>{lang==='bs'?'Tekst ispod loga (prazno = sakriveno):':'Text below logo (empty = hidden):'}</div>
                        <input type="text" value={sidebarText}
                          onChange={e=>{setSidebarText(e.target.value);setDirty('company');}}
                          placeholder={lang==='bs'?'Npr. zastitanaradu.ba':'e.g. yourdomain.com'}
                          style={{width:'100%',maxWidth:300,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text)',fontSize:'0.82rem',boxSizing:'border-box'}} />
                      </div>
                    </div>

                    {/* === LIVE UI PREVIEW === */}
                    <div>
                      <div style={{fontSize:'0.73rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>{lang==='bs'?'Pregled uživo':'Live Preview'}</div>
                      <div style={{display:'flex',borderRadius:10,overflow:'hidden',height:90,border:'1px solid var(--border)',maxWidth:340}}>
                        <div style={{width:60,background:uiSidebarColor||EZNR_DEFAULTS.sidebarColor,display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 0',gap:4,flexShrink:0}}>
                          {sidebarLogoEnabled&&companyData.logo
                            ?<img src={companyData.logo} alt="" style={{width:26,height:26,borderRadius:6,objectFit:'contain',background:'#fff',padding:2}}/>
                            :<div style={{width:26,height:26,borderRadius:8,background:(uiPrimaryColor||EZNR_DEFAULTS.primaryColor)+'30',border:'1px solid '+(uiPrimaryColor||EZNR_DEFAULTS.primaryColor)+'50',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',color:'#fff'}}>eZ</div>}
                          {sidebarText&&<div style={{fontSize:'2.5pt',color:'rgba(255,255,255,0.5)',textAlign:'center',maxWidth:50,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sidebarText}</div>}
                          <div style={{width:26,height:3,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/>
                          <div style={{width:26,height:3,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/>
                          <div style={{width:26,height:3,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/>
                        </div>
                        <div style={{flex:1,background:'var(--bg-page)',padding:10,display:'flex',flexDirection:'column',gap:6}}>
                          <div style={{display:'flex',gap:5}}>
                            <div style={{padding:'3px 10px',borderRadius:5,background:uiPrimaryColor||EZNR_DEFAULTS.primaryColor,color:'#fff',fontSize:'0.6rem',fontWeight:700}}>+ {lang==='bs'?'Dodaj':'Add'}</div>
                            <div style={{padding:'3px 10px',borderRadius:5,background:(uiPrimaryColor||EZNR_DEFAULTS.primaryColor)+'18',color:uiPrimaryColor||EZNR_DEFAULTS.primaryColor,fontSize:'0.6rem',fontWeight:600,border:'1px solid '+(uiPrimaryColor||EZNR_DEFAULTS.primaryColor)+'30'}}>PDF</div>
                          </div>
                          <div style={{height:3,borderRadius:2,background:'var(--border)',width:'80%'}}/>
                          <div style={{height:3,borderRadius:2,background:'var(--border)',width:'60%'}}/>
                        </div>
                      </div>
                    </div>

                    {(uiPrimaryColor||uiSidebarColor||sidebarLogoEnabled)&&(
                      <button onClick={()=>{setUiPrimaryColor('');setUiSidebarColor('');setSidebarLogoEnabled(false);setSidebarText(UI_DEFAULTS.sidebarText);setDirty('company');}}
                        style={{padding:'7px 16px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:'0.8rem',fontWeight:600,display:'flex',alignItems:'center',gap:6,width:'fit-content',marginTop:14}}>
                        ⟲ {lang==='bs'?'Vrati zadane vrijednosti':'Reset to defaults'}
                      </button>
                    )}

                  </div>{/* end ui card body */}
                </div>{/* end ui card */}

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button className="btn btn-primary" onClick={handleSaveCompany}>💾 {lang === 'bs' ? 'Spremi branding i firmu' : 'Save branding & company'}</button>
`;

const result = parts[0] + newSection + subParts[1];
writeFileSync(FILE, result, 'utf8');

console.log("Successfully replaced branding section. Total lines:", result.split('\\n').length);
