import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// 1. Remove Primary Color middle step
const oldPrimaryPicker = `<div style={{ position: 'relative' }}>
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
                        </div>`;

const newPrimaryPicker = `<label style={{ display: 'inline-block', width: 34, height: 34, borderRadius: 8, border: '2px solid var(--border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                          <input type="color" 
                            value={uiPrimaryColor || EZNR_DEFAULTS.primaryColor}
                            onChange={e=>{setUiPrimaryColor(e.target.value);setDirty('company');}}
                            style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, cursor: 'pointer', opacity: 0 }} 
                          />
                          <div style={{ width: '100%', height: '100%', background: uiPrimaryColor || EZNR_DEFAULTS.primaryColor, pointerEvents: 'none' }} />
                        </label>`;
content = content.replace(oldPrimaryPicker.replace(/\r/g, ''), newPrimaryPicker);

// 2. Remove Sidebar Color middle step
const oldSidebarPicker = `<div style={{ position: 'relative' }}>
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
                        </div>`;

const newSidebarPicker = `<label style={{ display: 'inline-block', width: 34, height: 34, borderRadius: 8, border: '2px solid var(--border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                          <input type="color" 
                            value={uiSidebarColor || EZNR_DEFAULTS.sidebarColor}
                            onChange={e=>{setUiSidebarColor(e.target.value);setDirty('company');}}
                            style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, cursor: 'pointer', opacity: 0 }} 
                          />
                          <div style={{ width: '100%', height: '100%', background: uiSidebarColor || EZNR_DEFAULTS.sidebarColor, pointerEvents: 'none' }} />
                        </label>`;
content = content.replace(oldSidebarPicker.replace(/\r/g, ''), newSidebarPicker);

// 3. Fix Pozicija 3x3 to an indestructible <table>
const oldGrid = `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 38px)', gap: '4px', width: '130px', minWidth: '130px', flexShrink: 0 }}>
                              {WATERMARK_POSITIONS.map(pos => (
                                <button key={pos.id} title={pos.id}
                                  onClick={()=>{setWmPosition(pos.id);setDirty('company');}}
                                  style={{ width:36,height:36,borderRadius:8,fontSize:'0.85rem',cursor:'pointer', border:wmPosition===pos.id?'2px solid var(--primary)':'1px solid var(--border)', background:wmPosition===pos.id?'var(--primary)':'var(--bg-card)', color:wmPosition===pos.id?'#fff':'var(--text-muted)' }}>
                                  {pos.label}
                                </button>
                              ))}
                            </div>`;

const newGrid = `<table style={{ borderCollapse: 'separate', borderSpacing: '4px', width: 'max-content' }}>
                              <tbody>
                                {[0,1,2].map(r => (
                                  <tr key={r}>
                                    {[0,1,2].map(c => {
                                      const pos = WATERMARK_POSITIONS.find(p => p.row === r && p.col === c);
                                      if(!pos) return <td key={c}></td>;
                                      return (
                                        <td key={c} style={{ padding: 0 }}>
                                          <button type="button" title={pos.id}
                                            onClick={()=>{setWmPosition(pos.id);setDirty('company');}}
                                            style={{ width:36, height:36, borderRadius:8, fontSize:'0.85rem', cursor:'pointer', border:wmPosition===pos.id?'2px solid var(--primary)':'1px solid var(--border)', background:wmPosition===pos.id?'var(--primary)':'var(--bg-card)', color:wmPosition===pos.id?'#fff':'var(--text-muted)' }}>
                                            {pos.label}
                                          </button>
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>`;

// Use regex because formatting might differ slightly
if (content.includes('gridTemplateColumns')) {
  // Find index of ` WATERMARK_POSITIONS.map(pos => (`
  const idx = content.indexOf(`{WATERMARK_POSITIONS.map(pos => (`);
  if(idx !== -1) {
    const parentOpen = content.lastIndexOf('<div', idx);
    const gridEnd = content.indexOf('</div>', idx) + 6;
    content = content.substring(0, parentOpen) + newGrid + content.substring(gridEnd);
  }
}

writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
console.log('Fixed page!');
