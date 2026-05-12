const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/app/dashboard/**/*.js');
files.forEach(f => {
    let text = fs.readFileSync(f, 'utf8');
    if (text.includes('className="card-body" className="scrollable-toolbar"')) {
        text = text.replace(/className=\"card-body\"\s*className=\"scrollable-toolbar\"/g, 'className="card-body scrollable-toolbar"');
        fs.writeFileSync(f, text, 'utf8');
        console.log('Fixed', f);
    }
});
