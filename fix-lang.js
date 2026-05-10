const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('c:/Users/zzida/Desktop/znrba/app/src');
let replaceCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/lang === 'bs'/g, "lang !== 'en'").replace(/lang === "bs"/g, 'lang !== "en"');
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    replaceCount++;
  }
});

console.log('Replaced in ' + replaceCount + ' files.');
