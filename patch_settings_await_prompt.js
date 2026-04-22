const fs = require('fs');

let content = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

content = content.replace(
    "const pwd = prompt('Type \"WIPE\" to confirm deleting ALL DATA for ' + activeCompanyId);",
    "const pwd = await prompt('Type \"WIPE\" to confirm deleting ALL DATA for ' + activeCompanyId);"
);

fs.writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
console.log('Fixed missing await for prompt in settings/page.js');
