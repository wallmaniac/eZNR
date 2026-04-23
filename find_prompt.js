const fs = require('fs');
const content = fs.readFileSync('C:/Users/zzida/.gemini/antigravity/brain/bd013d55-7693-4e55-a943-6bcab486126d/.system_generated/logs/overview.txt', 'utf8');
const lines = content.split('\n');

for (let i = 7050; i >= 0; i--) {
    if (lines[i] && lines[i].includes('USER_INPUT')) {
        try {
            const obj = JSON.parse(lines[i]);
            if (obj.content && obj.content.includes('![')) {
                console.log('--- FOUND SCREENSHOT PROMPT AT LINE ' + i + ' ---');
                console.log(obj.content);
                break;
            }
        } catch(e) {}
    }
}
