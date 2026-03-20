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
    text = pre + '<thead>\n' + theadNewInner + '\n                </thead>' + post;
  }
  
  const tbodyStart = text.indexOf("<tbody style={{ overflow: 'visible' }}>");
  const tbodyEnd = text.indexOf('</tbody>', tbodyStart) + 8;
  if(tbodyStart > -1 && tbodyEnd > -1) {
    const pre = text.substring(0, tbodyStart);
    const post = text.substring(tbodyEnd);
    text = pre + "<tbody style={{ overflow: 'visible' }}>\n" + tbodyNewInner + "\n                </tbody>" + post;
  }

  fs.writeFileSync(p, text, 'utf8');
  console.log('Fixed', relativePath);
};

const ro2TheadNew = `                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Čl.3 točke' : 'Art.3 point'}</th>
                    <th>{lang === 'bs' ? 'Radni staž' : 'Experience'}</th>
                    <th>{lang === 'bs' ? 'Promjena RM' : 'Changed pos.'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;

const ro2TbodyNew = `                  {records.length === 0 ? (
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
                      <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' , background: 'none', color: 'var(--text)'}} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
                      <td>{formatDate(r.datum)}</td>
                      <td>{r.clanak3Tocke || '—'}</td>
                      <td>{r.radniStazNaRadnomMjestu || '—'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                          background: r.nijeMijenjaoRadnoMjesto ? 'rgba(76,175,80,0.12)' : '#FBE9E7',
                          color: r.nijeMijenjaoRadnoMjesto ? 'var(--success)' : 'var(--danger)',
                        }}>{r.nijeMijenjaoRadnoMjesto ? 'Ne' : 'Da'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>
                  ))}`;

fixPage('form-ro2/page.js', ro2TheadNew, ro2TbodyNew);

const nrNewThead = `                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Noćni rad' : 'Night work'}</th>
                    <th>{lang === 'bs' ? 'Tip pregleda' : 'Exam type'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;

const nrNewTbody = `                  {records.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : records.map((r) => {
                    const examType = r.pregledPrethodni ? (lang === 'bs' ? 'Prethodni' : 'Initial') : r.pregledKontrolni ? (lang === 'bs' ? 'Kontrolni' : 'Control') : '—';
                    return (
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
                        <td><button style={{ padding: 0, fontWeight: 600, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' , background: 'none', color: 'var(--text)'}} onClick={e => { e.stopPropagation(); router.push('/dashboard/workers?openWorker=' + r.workerId); }}>{getWorkerName(r.workerId)}</button></td>
                        <td>{formatDate(r.datum)}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nocniRadZaKoji || '—'}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: '#EDE7F6', color: '#4527A0', fontWeight: 600 }}>{examType}</span></td>
                        <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                      </tr>
                    );
                  })}`;

fixPage('night-work/page.js', nrNewThead, nrNewTbody);
