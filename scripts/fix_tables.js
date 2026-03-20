const fs = require('fs');
const path = require('path');

const pages = [
  'src/app/dashboard/form-ro1/page.js',
  'src/app/dashboard/form-ro2/page.js',
  'src/app/dashboard/night-work/page.js',
  'src/app/dashboard/requests/page.js',
  'src/app/dashboard/injury-list/page.js',
  'src/app/dashboard/injuries/page.js',
  'src/app/dashboard/medical-exams/page.js' // Wait, medical-exams might be different
];

// We will do exact replacements per file since the table structures vary slightly.

function fixPage(file, theadTarget, theadReplacement, tbodyTargetRegex, tbodyReplacementBlock) {
  const filePath = path.join('c:\\Users\\zzida\\Desktop\\znrba\\app', file);
  if (!fs.existsSync(filePath)) return;
  let text = fs.readFileSync(filePath, 'utf-8');

  // Replace Header
  if (text.includes(theadTarget)) {
    text = text.replace(theadTarget, theadReplacement);
  }

  // Find tbody <tr> and replace everything inside it up to the last </td>
  // Since it's complex, we manually parse lines.
  const lines = text.split('\n');
  const outLines = [];
  let inTbodyTr = false;
  let trContent = [];
  
  // Actually, easiest is Regex
  fs.writeFileSync(filePath, text, 'utf-8');
}
