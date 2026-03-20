const fs = require('fs');
const path = require('path');

const reqPath = path.join(__dirname, '../src/app/dashboard/requests/page.js');
let req = fs.readFileSync(reqPath, 'utf8');

// Match <tr> followed by <th ... checkbox ...> down to </tr> inside thead
let lines = req.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<thead>')) {
    let j = i + 1;
    while (!lines[j].includes('</tr>')) j++;
    
    // lines[i+1] to lines[j] is the header tr block
    let block = lines.slice(i+1, j+1).join('\n');
    if (block.includes('<input type="checkbox"')) {
      // It has the checkbox! Let's manually reconstruct it.
      let newBlock = `                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</th>
                    <th>{lang === 'bs' ? 'Org. jedinica' : 'Org. unit'}</th>
                    <th>{lang === 'bs' ? 'Stavke' : 'Items'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;
      lines.splice(i+1, j - i, newBlock);
    }
    break;
  }
}
fs.writeFileSync(reqPath, lines.join('\n'), 'utf8');


const ro1Path = path.join(__dirname, '../src/app/dashboard/form-ro1/page.js');
let ro1 = fs.readFileSync(ro1Path, 'utf8');

lines = ro1.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<thead>')) {
    let j = i + 1;
    while (!lines[j].includes('</tr>')) j++;
    
    // lines[i+1] to lines[j] is the header tr block
    let block = lines.slice(i+1, j+1).join('\n');
    if (block.includes('<input type="checkbox"')) {
      // It has the checkbox! Let's manually reconstruct it.
      let newBlock = `                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>
                    <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                    <th>{lang === 'bs' ? 'Br.' : 'No.'}</th>
                    <th>{lang === 'bs' ? 'Pravilnik' : 'Regulation'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;
      lines.splice(i+1, j - i, newBlock);
    }
    break;
  }
}
fs.writeFileSync(ro1Path, lines.join('\n'), 'utf8');
console.log('Patched cleanly!');
