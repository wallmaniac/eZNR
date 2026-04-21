import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/app/dashboard/settings/page.js', 'utf8');
const newUI = readFileSync('new_ui.jsx', 'utf8');

const lines = content.split('\n');
let sLine = -1;
let eLine = -1;

for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('{/* ── SUPER PREMIUM BRANDING SECTION ── */}')) sLine = i;
  if (sLine !== -1 && lines[i].includes('</div>{/* end super premium wrapper */}')) eLine = i;
  if(eLine !== -1) break;
}

if(sLine === -1 || eLine === -1) {
  console.error('Boundaries not found!', {sLine, eLine});
  process.exit(1);
}

const newCode = lines.slice(0, sLine).join('\n') + '\n' + newUI + '\n' + lines.slice(eLine+1).join('\n');

writeFileSync('src/app/dashboard/settings/page.js', newCode);
console.log('Premium UI injected properly.');
