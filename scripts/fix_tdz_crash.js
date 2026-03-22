const fs = require('fs');

const FILES = [
  'src/app/dashboard/requests/page.js',
  'src/app/dashboard/form-ro1/page.js',
  'src/app/dashboard/form-ro2/page.js',
  'src/app/dashboard/night-work/page.js',
  'src/app/dashboard/referral-ra1/page.js',
];

// CRLF version (what the files actually contain)
const OLD_BLOCK = "  const enrichedRecords = filteredRecords.map(r => ({\r\n    ...r,\r\n    _workerName: getWorkerName(r.workerId),\r\n  }));";

// Inline the lookup — no dependency on getWorkerName being defined yet
const NEW_BLOCK = "  const enrichedRecords = filteredRecords.map(r => {\r\n    const _w = workers.find(wk => wk.id === r.workerId);\r\n    return { ...r, _workerName: _w ? `${_w.prezime} ${_w.ime}` : '\u2014' };\r\n  });";

FILES.forEach(p => {
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes(OLD_BLOCK)) {
    c = c.replace(OLD_BLOCK, NEW_BLOCK);
    fs.writeFileSync(p, c);
    console.log('Fixed: ' + p);
  } else {
    console.log('Block not found in: ' + p);
    // Show context
    const idx = c.indexOf('enrichedRecords');
    if (idx > -1) console.log('  context:', JSON.stringify(c.slice(idx, idx+80)));
  }
});
