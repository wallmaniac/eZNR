const fs = require('fs');
const path = require('path');

function replaceMod(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            replaceMod(p);
        } else if (p.endsWith('.js')) {
            let content = fs.readFileSync(p, 'utf8');
            if (content.includes("'gemini-2.0-flash'")) {
                content = content.replace(/'gemini-2\.0-flash'/g, "'gemini-flash-latest'");
                fs.writeFileSync(p, content, 'utf8');
                console.log('Fixed', p);
            }
        }
    });
}

replaceMod(path.join(__dirname, 'src', 'app', 'api'));
replaceMod(path.join(__dirname, '..', 'functions', 'endpoints'));
console.log('Model names successfully updated to gemini-flash-latest');
