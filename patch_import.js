const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/import/page.js', 'utf8');

// remove handleWipeDev completely
content = content.replace(/    const handleWipeDev = async \(\) => \{[\s\S]*?setImporting\(false\);\n    };\n/g, '');

// remove handleSeedOZO completely
content = content.replace(/    const handleSeedOZO = async \(\) => \{[\s\S]*?setImporting\(false\);\n    };\n/g, '');

// remove buttons
content = content.replace(/                                <button className="btn btn-primary" onClick=\{handleWipeDev\}[\s\S]*?<\/button>\n/g, '');
content = content.replace(/                                <button className="btn btn-primary" onClick=\{handleSeedOZO\}[\s\S]*?<\/button>\n/g, '');

fs.writeFileSync('src/app/dashboard/import/page.js', content, 'utf8');
console.log('cleaned import page!');
