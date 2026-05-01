const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/AIAssistant.js');
let content = fs.readFileSync(filePath, 'utf8');

// Update hover logic
content = content.replace(
    /onMouseEnter=\{e => \{ e\.currentTarget\.style\.transform = 'scale\(1\.1\)'; e\.currentTarget\.style\.filter = 'drop-shadow\(0 0 8px rgba\(0,191,166,0\.6\)\)'; \}\}/g,
    `onMouseEnter={e => { e.currentTarget.style.transform = isMobileScreen ? 'scale(1.05)' : 'translateY(-50%) scale(1.05)'; e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(0,191,166,0.6))'; }}`
);

content = content.replace(
    /onMouseLeave=\{e => \{ e\.currentTarget\.style\.transform = 'none'; e\.currentTarget\.style\.filter = 'none'; \}\}/g,
    `onMouseLeave={e => { e.currentTarget.style.transform = isMobileScreen ? 'none' : 'translateY(-50%)'; e.currentTarget.style.filter = 'none'; }}`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Hover logic fixed!');
