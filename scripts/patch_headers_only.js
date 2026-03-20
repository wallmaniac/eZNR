const fs = require('fs');
const path = require('path');

const reqPath = path.join(__dirname, '../src/app/dashboard/requests/page.js');
let req = fs.readFileSync(reqPath, 'utf8');

const reqTheadOld = `                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</th>
                    <th>{lang === 'bs' ? 'Org. jedinica' : 'Org. unit'}</th>
                    <th>{lang === 'bs' ? 'Stavke' : 'Items'}</th>
                  </tr>`;

const reqTheadNew = `                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</th>
                    <th>{lang === 'bs' ? 'Org. jedinica' : 'Org. unit'}</th>
                    <th>{lang === 'bs' ? 'Stavke' : 'Items'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;
                  
req = req.split(reqTheadOld).join(reqTheadNew);
fs.writeFileSync(reqPath, req, 'utf8');
console.log('Patched requests header.');


const ro1Path = path.join(__dirname, '../src/app/dashboard/form-ro1/page.js');
let ro1 = fs.readFileSync(ro1Path, 'utf8');

const ro1TheadOld = `                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} /></th>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Pravilnik' : 'Regulation'}</th>
                    
                  </tr>`;

const ro1TheadNew = `                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Pravilnik' : 'Regulation'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;
                  
ro1 = ro1.split(ro1TheadOld).join(ro1TheadNew);
fs.writeFileSync(ro1Path, ro1, 'utf8');
console.log('Patched form-ro1 header.');
