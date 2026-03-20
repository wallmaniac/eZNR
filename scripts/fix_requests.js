const fs = require('fs');
const path = require('path');

const reqPath = path.join(__dirname, '../src/app/dashboard/requests/page.js');
let text = fs.readFileSync(reqPath, 'utf8');

const theadOld = `                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</th>
                    <th>{lang === 'bs' ? 'Org. jedinica' : 'Org. unit'}</th>
                    <th>{lang === 'bs' ? 'Stavke' : 'Items'}</th>
                  </tr>
                </thead>`;

const theadNew = `                <thead>
                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</th>
                    <th>{lang === 'bs' ? 'Org. jedinica' : 'Org. unit'}</th>
                    <th>{lang === 'bs' ? 'Stavke' : 'Items'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>
                </thead>`;

text = text.replace(theadOld, theadNew);

const tbodyOld = `                  {records.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : records.map((r) => (
                    <tr key={r.id}>
                                                                  <td style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === r.id ? null : r.id); }}>{lang === 'bs' ? 'Akcije' : 'Actions'} ▼</button>
                        {actionMenuId === r.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, zIndex: 999, display: 'block' }}>
                            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}>✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(r); }}>📋 {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}</button>
                            <div className="dropdown-divider" />
                            <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(r.id); }}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                          </div>
                          </>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.zahtjevnicaBroj || '—'}</td>
                      <td>{formatDate(r.datum)}</td>
                      <td><button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
                      <td>{getOrgName(r.orgJedinicaId)}</td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>
                          {(r.stavke || []).length}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>`;

const tbodyNew = `                  {records.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : records.map((r) => (
                    <tr key={r.id} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === r.id ? null : r.id); }}>{lang === 'bs' ? 'Akcije' : 'Actions'} ▼</button>
                        {actionMenuId === r.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, zIndex: 9999, display: 'block' }}>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}>✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(r); }}>📋 {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}</button>
                              <div className="dropdown-divider" />
                              <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(r.id); }}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                            </div>
                          </>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.zahtjevnicaBroj || '—'}</td>
                      <td>{formatDate(r.datum)}</td>
                      <td><button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
                      <td>{getOrgName(r.orgJedinicaId)}</td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>
                          {(r.stavke || []).length}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>
                  ))}
                </tbody>`;

text = text.replace(tbodyOld, tbodyNew);
fs.writeFileSync(reqPath, text, 'utf8');
console.log('Fixed requests/page.js');
