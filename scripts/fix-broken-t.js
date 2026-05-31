// Fix broken t() calls that have trailing text from partial regex matches
const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/dashboard/**/*.js').concat(glob.sync('src/components/**/*.js'));
let totalFixes = 0;

for (const f of files) {
  let content = fs.readFileSync(f, 'utf-8');
  let modified = false;
  
  // Pattern: t('someKey')trailing text that should be inside the string'
  // This happens when the EN text had an apostrophe that broke the regex
  const broken = /t\('([^']+)'\)([a-zA-Z][^{}<]*?')/g;
  
  content = content.replace(broken, (match, key, trailing) => {
    // Only fix if trailing starts with a lowercase letter (indicates broken text)
    if (/^[a-z]/.test(trailing)) {
      console.log(`  ${f}: t('${key}')${trailing.substring(0, 40)}...`);
      totalFixes++;
      modified = true;
      return `t('${key}')`;
    }
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(f, content, 'utf-8');
  }
}

console.log(`\nFixed ${totalFixes} broken t() calls`);
