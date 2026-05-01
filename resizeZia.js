const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/AIAssistant.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Reduce tab size (padding & font sizes)
content = content.replace(
    /padding: '16px 8px',/,
    `padding: '10px 4px',`
);

content = content.replace(
    /<span style=\{\{ fontSize: '1\.2rem', filter: 'drop-shadow\(0 2px 4px rgba\(0,0,0,0\.3\)\)', marginBottom: 6 \}\}>✨<\/span>/,
    `<span style={{ fontSize: '0.9rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))', marginBottom: 4 }}>✨</span>`
);

content = content.replace(
    /<span style=\{\{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: '0\.75rem', fontWeight: 800, letterSpacing: 4 \}\}>ZIA<\/span>/,
    `<span style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: '0.6rem', fontWeight: 800, letterSpacing: 2 }}>ZIA</span>`
);

// 2. Bring tab down closer to bottom right corner on PC
content = content.replace(
    /top: isMobileScreen \? 'auto' : '50%',\s*bottom: isMobileScreen \? '120px' : 'auto',\s*transform: isMobileScreen \? 'none' : 'translateY\(-50%\)',/,
    `top: 'auto',
        bottom: isMobileScreen ? '120px' : '100px',
        transform: 'none',`
);

// 3. Fix the hover transform to match the new static position
content = content.replace(
    /onMouseEnter=\{e => \{ e\.currentTarget\.style\.transform = isMobileScreen \? 'scale\(1\.05\)' : 'translateY\(-50%\) scale\(1\.05\)'; e\.currentTarget\.style\.filter = 'drop-shadow\(0 0 8px rgba\(0,191,166,0\.6\)\)'; \}\}/g,
    `onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(0,191,166,0.6))'; }}`
);

content = content.replace(
    /onMouseLeave=\{e => \{ e\.currentTarget\.style\.transform = isMobileScreen \? 'none' : 'translateY\(-50%\)'; e\.currentTarget\.style\.filter = 'none'; \}\}/g,
    `onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}`
);

// 4. Move the little 'x' closing button to the bottom right corner edge of the zia window
// The Zia window is at bottom: 28, right: 28 on PC.
// On mobile, the Zia window is full screen (bottom: 60, right: 0, left: 0) or minimized (bottom: 70, right: 12).
// Let's set the X to bottom: 20, right: 20 on PC, and keep mobile as requested.
content = content.replace(
    /bottom: isMobileScreen \? 75 : 10,\s*right: 10,/,
    `bottom: isMobileScreen ? 75 : 20,
        right: isMobileScreen ? 12 : 20,`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script updated padding, size, position, and close button.');
