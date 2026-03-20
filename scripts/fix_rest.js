const fs = require('fs');
const path = require('path');

const fixPage = (relativePath, theadNewInner, tbodyNewInner) => {
  const p = path.join(__dirname, '../src/app/dashboard', relativePath);
  let text = fs.readFileSync(p, 'utf8');
  
  const theadStart = text.indexOf('<thead>');
  const theadEnd = text.indexOf('</thead>', theadStart) + 8;
  if(theadStart > -1 && theadEnd > -1) {
    const pre = text.substring(0, theadStart);
    const post = text.substring(theadEnd);
    text = pre + '<thead>\n' + theadNewInner + '\n                            </thead>' + post;
  }
  
  const tbodyStart = text.indexOf("<tbody style={{ overflow: 'visible' }}>");
  const tbodyEnd = text.indexOf('</tbody>', tbodyStart) + 8;
  if(tbodyStart > -1 && tbodyEnd > -1) {
    const pre = text.substring(0, tbodyStart);
    const post = text.substring(tbodyEnd);
    text = pre + "<tbody style={{ overflow: 'visible' }}>\n" + tbodyNewInner + "\n                            </tbody>" + post;
  }

  fs.writeFileSync(p, text, 'utf8');
  console.log('Fixed', relativePath);
};

// --- medical-exams ---
const medNewThead = `                                <tr>
                                    <th>{bs ? 'Akcije' : 'Actions'}</th>
                                    <th>{bs ? 'Radnik' : 'Worker'}</th>
                                    <th>{bs ? 'Vrsta pregleda' : 'Exam Type'}</th>
                                    <th>{bs ? 'Datum' : 'Date'}</th>
                                    <th>{bs ? 'Naredni pregled' : 'Next Exam'}</th>
                                    <th>{bs ? 'Status' : 'Status'}</th>
                                    <th>{bs ? 'Rezultat' : 'Result'}</th>
                                    <th>{bs ? 'Ustanova' : 'Institution'}</th>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === exams.length && exams.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                                </tr>`;

const medNewTbody = `                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                                            {bs ? 'Nema unesenih ljekarskih pregleda' : 'No medical exams recorded'}
                                        </td>
                                    </tr>
                                )}
                                {filtered.map(exam => {
                                    const badge = getStatusBadge(exam);
                                    const days = getDays(exam.vrijediDo);
                                    const rowBg = days !== null && days < 0
                                        ? 'rgba(239,68,68,0.04)'
                                        : days !== null && days <= 30 ? 'rgba(245,158,11,0.04)' : '';
                                    return (
                                        <tr key={exam.id} style={{ background: rowBg }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = rowBg}>
                                            <td style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === exam.id ? null : exam.id); }}>{lang === 'bs' ? 'Akcije' : 'Actions'} ▼</button>
                                                {actionMenuId === exam.id && (
                                                  <>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                                                    <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, zIndex: 9999, display: 'block' }}>
                                                      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(exam); }}>✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                                                      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(exam); }}>📋 {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}</button>
                                                      <div className="dropdown-divider" />
                                                      <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(exam); }}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                                                    </div>
                                                  </>
                                                )}
                                            </td>
                                            <td>
                                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                                                    onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + exam.workerId); }}>
                                                    {exam._workerName}
                                                </button>
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>{examTypeLabel(exam.tipPregleda)}</td>
                                            <td style={{ fontSize: '0.85rem' }}>{formatDate(exam.datumPregleda)}</td>
                                            <td style={{ fontSize: '0.85rem', fontWeight: days !== null && days < 0 ? 700 : 400, color: days !== null && days < 0 ? 'var(--danger)' : days !== null && days <= 90 ? 'var(--warning)' : 'inherit' }}>
                                                {exam.vrijediDo ? formatDate(exam.vrijediDo) : '—'}
                                            </td>
                                            <td>
                                                <span className={\`badge\${badge.bg === 'var(--danger)' ? ' badge-danger' : badge.bg === 'var(--success)' ? ' badge-success' : badge.col === 'var(--warning)' ? ' badge-warning' : ''}\`}
                                                    style={{ background: badge.bg, color: badge.color, fontSize: '0.7rem' }}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 600, color: resultColor(exam.rezultat), fontSize: '0.85rem' }}>
                                                {resultLabel(exam.rezultat)}
                                            </td>
                                            <td style={{ fontSize: '0.8rem', maxWidth: 180 }}>
                                                <div style={{ fontWeight: 600 }}>{exam.zdravstvenaUstanova || '—'}</div>
                                                {exam.doktorIme && <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>Dr. {exam.doktorIme}</div>}
                                            </td>
                                            <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(exam.id)} onChange={() => toggleOne(exam.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                                        </tr>
                                    );
                                })}`;
fixPage('medical-exams/page.js', medNewThead, medNewTbody);

// --- injuries ---
const injNewThead = `                  <tr>
                    <th>{t('actions')}</th>
                    <th>{t('worker')}</th>
                    <th>{t('date')}</th>
                    <th>{lang === 'bs' ? 'Tip' : 'Type'}</th>
                    <th>{t('location')}</th>
                    <th>{t('description')}</th>
                    <th>{t('status')}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;

const injNewTbody = `                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : filtered.map(inj => (
                    <tr key={inj.id} onClick={() => openEdit(inj)} style={{ cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}>
                      <td style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === inj.id ? null : inj.id); }}>{lang === 'bs' ? 'Akcije' : 'Actions'} ▼</button>
                        {actionMenuId === inj.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, zIndex: 9999, display: 'block' }}>
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); openEdit(inj); }}>✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                              <div className="dropdown-divider" />
                              <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(inj.id); }}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                            </div>
                          </>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <button
                          onClick={e => { e.stopPropagation(); if (inj.radnikId) router.push('/dashboard/workers?openWorker=' + inj.radnikId); }}
                          style={{ background: 'none', border: 'none', cursor: inj.radnikId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: inj.radnikId ? 'underline' : 'none', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                          title={inj.radnikId ? (lang === 'bs' ? 'Otvori stranicu radnika' : 'Open worker page') : ''}
                        >{inj.radnikIme || '—'}</button>
                      </td>
                      <td>{inj.datum ? new Date(inj.datum).toLocaleDateString(lang === 'bs' ? 'bs-BA' : 'en-GB') : '—'}</td>
                      <td>{tipBadge(inj.tip)}</td>
                      <td>{inj.lokacija || '—'}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inj.opisPovrede || '—'}</td>
                      <td>{statusBadge(inj.status)}</td>
                      <td style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}><input type="checkbox" checked={selectedIds.has(inj.id)} onChange={() => toggleOne(inj.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>
                  ))}`;
fixPage('injuries/page.js', injNewThead, injNewTbody);

// --- injury-list ---
const ilNewThead = `                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Oznaka' : 'ID'}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum dog.' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Ime roditelja' : 'Parent name'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;

const ilNewTbody = `                  {records.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
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
                      <td style={{ fontWeight: 600 }}>{r.oznaka || '—'}</td>
                      <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' , background: 'none', color: 'var(--text)'}} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.radnikId); }}>{getWorkerName(r.radnikId)}</button></td>
                      <td>{formatDate(r.datum)}</td>
                      <td>{r.imeOca || '—'}</td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>
                  ))}`;
fixPage('injury-list/page.js', ilNewThead, ilNewTbody);
