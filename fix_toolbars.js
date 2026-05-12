const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/dashboard/**/*.js');
let count = 0;

files.forEach(f => {
    let text = fs.readFileSync(f, 'utf8');
    let original = text;

    // Replace: flexWrap: 'wrap' -> flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none'
    // But only for the main toolbars. We can identify them by matching:
    // style={{ ... display: 'flex', ... alignItems: 'center' ... flexWrap: 'wrap' ... }}
    
    // Actually, replacing `flexWrap: 'wrap'` with `flexWrap: 'wrap'` doesn't fix it if we want it to scroll.
    // The most elegant fix for toolbars that wrap poorly is to use className="scrollable-toolbar"
    // Let's replace the inline style of known toolbar patterns.
    
    // Pattern: `style={{ display: 'flex', gap: \d+, alignItems: 'center', flexWrap: 'wrap' }}`
    // Or similar variations.
    
    text = text.replace(/style=\{\{\s*display:\s*'flex',\s*gap:\s*(\d+),\s*alignItems:\s*'center',\s*flexWrap:\s*'wrap'\s*\}\}/g, 
        "className=\"scrollable-toolbar\" style={{ padding: 0, gap: $1 }}");

    text = text.replace(/style=\{\{\s*display:\s*'flex',\s*alignItems:\s*'center',\s*gap:\s*(\d+),\s*marginBottom:\s*(\d+),\s*flexWrap:\s*'wrap'\s*\}\}/g, 
        "className=\"scrollable-toolbar\" style={{ padding: 0, gap: $1, marginBottom: $2 }}");
        
    text = text.replace(/style=\{\{\s*display:\s*'flex',\s*gap:\s*(\d+),\s*marginBottom:\s*(\d+),\s*flexWrap:\s*'wrap',\s*alignItems:\s*'center'\s*\}\}/g, 
        "className=\"scrollable-toolbar\" style={{ padding: 0, gap: $1, marginBottom: $2 }}");

    if (text !== original) {
        fs.writeFileSync(f, text, 'utf8');
        console.log("Fixed:", f);
        count++;
    }
});

console.log(`Fixed ${count} files.`);
