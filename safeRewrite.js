const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/AIAssistant.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace fabStyles.fab
content = content.replace(
    /fab: \{\s*position: 'fixed',\s*zIndex: 1001,\s*display: 'flex',\s*flexDirection: 'row',\s*alignItems: 'center',\s*justifyContent: 'center',\s*padding: '8px 12px',\s*background: 'rgba\(0, 191, 166, 0\.15\)',\s*backdropFilter: 'blur\(8px\)',\s*WebkitBackdropFilter: 'blur\(8px\)',\s*borderTop: '1px solid rgba\(0, 191, 166, 0\.3\)',\s*borderBottom: '1px solid rgba\(0, 191, 166, 0\.3\)',\s*color: '#009985',\s*cursor: 'grab',\s*boxShadow: '0 4px 16px rgba\(0,191,166,0\.2\)',\s*transition: 'transform 0\.2s, box-shadow 0\.2s',\s*gap: 6,\s*whiteSpace: 'nowrap',\s*\}/,
    `fab: {
        position: 'fixed',
        zIndex: 1001,
        width: '64px',
        height: '64px',
        background: 'linear-gradient(135deg, rgba(0, 191, 166, 0.85), rgba(0, 153, 133, 0.95))',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
        cursor: 'pointer',
        transition: 'transform 0.2s, filter 0.2s',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: '0 10px 10px 0',
        color: 'white',
        border: 'none',
        outline: 'none',
    }`
);

// 2. Remove dragging logic from JSX
content = content.replace(
    /onMouseDown=\{onFabMouseDown\}\s*onTouchStart=\{onFabTouchStart\}\s*onTouchMove=\{onFabTouchMove\}\s*onTouchEnd=\{onFabTouchEnd\}/,
    `onClick={handleOpen}`
);

// 3. Replace the inline style of the fab button
content = content.replace(
    /style=\{\{\s*\.\.\.fabStyles\.fab,\s*\.\.\.fabPosition,\s*borderRadius: isFabLeft \? '0 24px 24px 0' : '24px 0 0 24px',\s*borderLeft: isFabLeft \? '1px solid rgba\(0, 191, 166, 0\.3\)' : 'none',\s*borderRight: !isFabLeft \? '1px solid rgba\(0, 191, 166, 0\.3\)' : 'none',\s*animation: pulseAnimation \? 'aiPulse 2s ease-in-out infinite' : 'none',\s*transition: dragRef\.current\.dragging \? 'none' : 'all 0\.3s cubic-bezier\(0\.4, 0, 0\.2, 1\)',\s*touchAction: 'none',\s*cursor: 'grab',\s*\}\}/,
    `style={{
        ...fabStyles.fab,
        right: 0,
        bottom: isMobileScreen ? 70 : 0,
        animation: pulseAnimation ? 'aiPulse 2s ease-in-out infinite' : 'none',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(0,191,166,0.6))'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}`
);

// 4. Remove the label and modify the icon styling
content = content.replace(
    /<span style=\{\{ \.\.\.fabStyles\.fabIcon, fontSize: '1\.3rem' \}\}>✨<\/span>\s*<span style=\{fabStyles\.fabLabel\}>Zia<\/span>/,
    `<span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>✨</span>`
);

// 5. Update the urgent badge position to fit in the triangle
content = content.replace(
    /position: 'absolute', top: -5, right: -5,/,
    `position: 'absolute', top: 12, right: 6,`
);

// 6. Update the close button position VERY specifically
content = content.replace(
    /style=\{\{\s*position: 'fixed',\s*zIndex: 1002,\s*\.\.\.\(isMobileScreen\s*\?\s*\{\s*bottom:\s*12,\s*right:\s*12\s*\}\s*:\s*isFabLeft\s*\?\s*\{\s*bottom:\s*20,\s*left:\s*390\s*\}\s*:\s*\{\s*bottom:\s*20,\s*right:\s*20\s*\}\),/g,
    `style={{
        position: 'fixed',
        zIndex: 1002,
        bottom: isMobileScreen ? 75 : 10,
        right: 10,`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script executed correctly.');
