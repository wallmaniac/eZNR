const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/AIAssistant.js');
let content = fs.readFileSync(filePath, 'utf8');

// Update the close bubble style
content = content.replace(
    /\.\.\.\(isMobileScreen[\s\S]*?\? \{ bottom: 20, left: 390 \}[\s\S]*?: \{ bottom: 20, right: 20 \}\),/,
    `bottom: isMobileScreen ? 75 : 10, right: 10,`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Close button updated!');
