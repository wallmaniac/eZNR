const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/AIAssistant.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace fabStyles.fab
content = content.replace(
    /fab: \{\s*position: 'fixed',\s*zIndex: 1001,\s*width: '64px',\s*height: '64px',\s*background: 'linear-gradient\(135deg, rgba\(0, 191, 166, 0\.85\), rgba\(0, 153, 133, 0\.95\)\)',\s*backdropFilter: 'blur\(4px\)',\s*WebkitBackdropFilter: 'blur\(4px\)',\s*clipPath: 'polygon\(100% 0, 0 100%, 100% 100%\)',\s*cursor: 'pointer',\s*transition: 'transform 0\.2s, filter 0\.2s',\s*display: 'flex',\s*alignItems: 'flex-end',\s*justifyContent: 'flex-end',\s*padding: '0 10px 10px 0',\s*color: 'white',\s*border: 'none',\s*outline: 'none',\s*\}/,
    `fab: {
        position: 'fixed',
        zIndex: 1001,
        background: 'linear-gradient(180deg, #00BFA6, #009985)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        cursor: 'pointer',
        transition: 'transform 0.2s, filter 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 8px',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRight: 'none',
        borderRadius: '16px 0 0 16px',
        boxShadow: '-2px 0 12px rgba(0,191,166,0.3)',
        outline: 'none',
    }`
);

// 2. Replace the inline style of the fab button
content = content.replace(
    /style=\{\{\s*\.\.\.fabStyles\.fab,\s*right: 0,\s*bottom: isMobileScreen \? 70 : 0,\s*animation: pulseAnimation \? 'aiPulse 2s ease-in-out infinite' : 'none',\s*\}\}/,
    `style={{
        ...fabStyles.fab,
        right: 0,
        top: isMobileScreen ? 'auto' : '50%',
        bottom: isMobileScreen ? '120px' : 'auto',
        transform: isMobileScreen ? 'none' : 'translateY(-50%)',
        animation: pulseAnimation ? 'aiPulse 2s ease-in-out infinite' : 'none',
    }}`
);

// 3. Update the content inside the button
content = content.replace(
    /<span style=\{\{ fontSize: '1\.4rem', filter: 'drop-shadow\(0 2px 4px rgba\(0,0,0,0\.3\)\)' \}\}>✨<\/span>/,
    `<span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))', marginBottom: 6 }}>✨</span>
    <span style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: '0.75rem', fontWeight: 800, letterSpacing: 4 }}>ZIA</span>`
);

// 4. Update the urgent badge position
content = content.replace(
    /position: 'absolute', top: 12, right: 6,/,
    `position: 'absolute', top: -6, left: -6,`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Vertical Tab Script executed correctly.');
