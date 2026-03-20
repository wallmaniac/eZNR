const fs = require('fs');
const files = [
  'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/form-ro2/page.js',
  'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/night-work/page.js',
  'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/medical-exams/page.js',
  'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/injuries/page.js',
  'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/injury-list/page.js'
];
files.forEach(f => {
  const text = fs.readFileSync(f, 'utf8');
  const match = text.match(/<table className=\"data-table\"[\s\S]*?<\/table>/);
  if(match) {
    fs.writeFileSync('c:/Users/zzida/Desktop/znrba/app/scripts/table_' + f.split('/').pop().replace('.js', '.txt'), match[0]);
  }
});
