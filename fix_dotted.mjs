import fs from 'fs';
import path from 'path';

function walk(dir, cb) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, cb);
    else cb(p);
  }
}

let count = 0;
walk('src', (f) => {
  if (!f.endsWith('.js')) return;
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes("'dotted'")) {
    const n = c.replaceAll("textDecorationStyle: 'dotted'", "textDecorationStyle: 'solid'");
    if (n !== c) {
      fs.writeFileSync(f, n);
      count++;
      console.log('Fixed:', f);
    }
  }
});
console.log('Total files fixed:', count);
