const fs = require('fs');
const path = require('path');

const applyPatch = (file, oldThead, newThead, oldTbodyTail, newTbodyTail) => {
  const p = path.join(__dirname, '../src/app/dashboard', file);
  if (!fs.existsSync(p)) return;
  let text = fs.readFileSync(p, 'utf8');
  
  text = text.replace(oldThead, newThead);
  text = text.replace(oldTbodyTail, newTbodyTail);
  
  fs.writeFileSync(p, text, 'utf8');
  console.log(`Patched ${file}`);
};

// ======================= form-ro1 ==========================
const ro1TheadOld = `<tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Pravilnik' : 'Regulation'}</th>
                    
                  </tr>`;

const ro1TheadNew = `<tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Pravilnik' : 'Regulation'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;

const ro1TbodyOld = `                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem',
                          background: r.posloviPravilnik ? 'rgba(76,175,80,0.12)' : 'var(--bg-input)',
                          color: r.posloviPravilnik ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600,
                        }}>{r.posloviPravilnik ? 'Da' : 'Ne'}</span>
                      </td>
                      
                    </tr>`;

const ro1TbodyNew = `                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem',
                          background: r.posloviPravilnik ? 'rgba(76,175,80,0.12)' : 'var(--bg-input)',
                          color: r.posloviPravilnik ? 'var(--success)' : 'var(--text-muted)', fontWeight: 600,
                        }}>{r.posloviPravilnik ? 'Da' : 'Ne'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>`;

applyPatch('form-ro1/page.js', ro1TheadOld, ro1TheadNew, ro1TbodyOld, ro1TbodyNew);

// ======================= requests ==========================
const reqTheadOld = `<tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</th>
                    <th>{lang === 'bs' ? 'Org. jedinica' : 'Org. unit'}</th>
                    <th>{lang === 'bs' ? 'Stavke' : 'Items'}</th>
                  </tr>`;

const reqTheadNew = `<tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</th>
                    <th>{lang === 'bs' ? 'Org. jedinica' : 'Org. unit'}</th>
                    <th>{lang === 'bs' ? 'Stavke' : 'Items'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;

const reqTbodyOld = `                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>
                          {(r.stavke || []).length}
                        </span>
                      </td>
                    </tr>`;

const reqTbodyNew = `                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>
                          {(r.stavke || []).length}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>`;

applyPatch('requests/page.js', reqTheadOld, reqTheadNew, reqTbodyOld, reqTbodyNew);

