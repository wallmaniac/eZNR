// Handle remaining complex lang !== 'en' patterns
// Specifically: template literals, multi-line, backtick strings
const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/dashboard/**/*.js').concat(glob.sync('src/components/**/*.js'));
let totalFixes = 0;

for (const f of files) {
  let content = fs.readFileSync(f, 'utf-8');
  let modified = false;
  
  // Pattern 1: lang !== 'en' ? `template ${var}` : `template ${var}`
  // These can't be easily auto-extracted — convert to use lang check inside t()
  // Instead, convert: lang !== 'en' ? `text ${var}` : `text ${var}`
  // To: lang === 'en' ? `text ${var}` : `text ${var}`  (keep as is but will work because fallback)
  
  // Pattern 2: lang !== 'en' ? 'text' : 'text' with multi-line
  // Try to handle multi-line by joining
  
  // Pattern 3: Single-quote strings with apostrophes in EN text
  // Example: lang !== 'en' ? 'BS text' : 'EN text with apostrophe\'s continuation'
  
  // For now, let's convert the simple ones that have escaped apostrophes
  // lang !== 'en' ? 'BS' : 'EN\\'s text'
  const escapedApostrophe = /lang\s*!==\s*'en'\s*\?\s*'([^']+)'\s*:\s*'([^']*)\\'([^']+)'/g;
  content = content.replace(escapedApostrophe, (match, bs, enPart1, enPart2) => {
    const en = enPart1 + "'" + enPart2;
    const key = slugify(bs);
    if (!key) return match;
    console.log(`  ${f}: Fixed escaped apostrophe: ${key}`);
    totalFixes++;
    modified = true;
    addTranslation(key, bs, en);
    return `t('${key}')`;
  });
  
  if (modified) {
    fs.writeFileSync(f, content, 'utf-8');
  }
}

function slugify(text) {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

const newBsKeys = [];
const newEnKeys = [];
function addTranslation(key, bs, en) {
  newBsKeys.push(`    ${key}: '${bs.replace(/'/g, "\\'")}',`);
  newEnKeys.push(`    ${key}: '${en.replace(/'/g, "\\'")}',`);
}

// After processing all files, add keys to translations
if (newBsKeys.length > 0) {
  let trans = fs.readFileSync('src/i18n/translations.js', 'utf-8');
  // Add to end of bs auto-extracted section
  const bsMarker = '    // ── Auto-extracted strings ──\n';
  const bsIdx = trans.indexOf(bsMarker);
  if (bsIdx !== -1) {
    const insertAfter = bsIdx + bsMarker.length;
    trans = trans.substring(0, insertAfter) + newBsKeys.join('\n') + '\n' + trans.substring(insertAfter);
  }
  
  // Find en auto-extracted section
  const enSection = trans.indexOf('    // ── Auto-extracted strings ──\n', bsIdx + 100);
  if (enSection !== -1) {
    const insertAfterEn = enSection + bsMarker.length;
    trans = trans.substring(0, insertAfterEn) + newEnKeys.join('\n') + '\n' + trans.substring(insertAfterEn);
  }
  
  fs.writeFileSync('src/i18n/translations.js', trans, 'utf-8');
}

console.log(`\nFixed ${totalFixes} additional patterns`);
