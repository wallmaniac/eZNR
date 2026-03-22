const fs = require('fs');
const path = 'src/app/dashboard/requests/page.js';
let c = fs.readFileSync(path, 'utf8');
const old1 = `<th>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}</th>`;
const new1 = `<th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{lang === 'bs' ? 'Zatražio / Radnik' : 'Requested by'}{sortIcon('_workerName')}</th>`;
if (c.includes(old1)) {
  c = c.replace(old1, new1);
  fs.writeFileSync(path, c);
  console.log('Done: Requests Radnik th now sortable');
} else {
  // Try with Windows line endings
  console.log('Pattern not found, checking...');
  const idx = c.indexOf('Zatr');
  if (idx > -1) console.log('Found "Zatr" at position', idx, ':', JSON.stringify(c.slice(idx-5, idx+100)));
  else console.log('NOT FOUND at all');
}
