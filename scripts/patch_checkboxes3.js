const fs = require('fs');
const path = require('path');

const reqPath = path.join(__dirname, '../src/app/dashboard/requests/page.js');
let req = fs.readFileSync(reqPath, 'utf8');

const reqTarget = `                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>
                          {(r.stavke || []).length}
                        </span>
                      </td>
                    </tr>`;

const reqRep = `                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>
                          {(r.stavke || []).length}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>`;

req = req.split(reqTarget).join(reqRep);
fs.writeFileSync(reqPath, req, 'utf8');
console.log('Requests patched.');

const ro1Path = path.join(__dirname, '../src/app/dashboard/form-ro1/page.js');
let ro1 = fs.readFileSync(ro1Path, 'utf8');

const ro1Target = `                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem',
                          background: r.posloviPravilnik ? 'rgba(76,175,80,0.12)' : 'var(--bg-input)',
                          color: r.posloviPravilnik ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600,
                        }}>{r.posloviPravilnik ? 'Da' : 'Ne'}</span>
                      </td>
                      
                    </tr>`;

const ro1Rep = `                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem',
                          background: r.posloviPravilnik ? 'rgba(76,175,80,0.12)' : 'var(--bg-input)',
                          color: r.posloviPravilnik ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600,
                        }}>{r.posloviPravilnik ? 'Da' : 'Ne'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>`;

ro1 = ro1.split(ro1Target).join(ro1Rep);
fs.writeFileSync(ro1Path, ro1, 'utf8');
console.log('Form RO1 patched.');
