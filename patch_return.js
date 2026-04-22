const fs = require('fs');

function processFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let code = fs.readFileSync(filePath, 'utf8');

    if (!code.includes('const [returnPath, setReturnPath] = useState(null)')) {
        code = code.replace(
            /(const \[showForm, setShowForm\] = useState\(false\);)/,
            "$1\n    const [returnPath, setReturnPath] = useState(null);"
        );

        code = code.replace(
            /(const openId = searchParams\?\.get\('openItem'\);|const openWorkerId = searchParams\?\.get\('openWorker'\);)/g,
            "$1\n        const retParam = searchParams?.get('returnTo');\n        if (retParam) setReturnPath(retParam);"
        );

        // Replace close button
        code = code.replace(
            /onClick=\{\(\) => setShowForm\(false\)\}/g,
            "onClick={() => { setShowForm(false); if(returnPath) { router.push(returnPath); setReturnPath(null); } }}"
        );
        
        // Save button
        code = code.replace(
            /setShowForm\(false\); loadData\(\); showFlash\(\);/g,
            "setShowForm(false); loadData(); showFlash(); if(returnPath) { router.push(returnPath); setReturnPath(null); }"
        );
        
        // Service logs Save button in equipment
        code = code.replace(
            /setShowServiceForm\(false\);\s*loadServiceLogs\(editingId\);\s*loadData\(\);/g,
            "setShowServiceForm(false);\n        loadServiceLogs(editingId);\n        loadData();\n        if(returnPath) { router.push(returnPath); setReturnPath(null); }"
        );

        fs.writeFileSync(filePath, code, 'utf8');
        console.log('Patched', filePath);
    }
}

['src/app/dashboard/equipment/page.js', 'src/app/dashboard/workplaces/page.js', 'src/app/dashboard/workers/page.js'].forEach(processFile);

function updateLinks(file, searchStr, replacement) {
    if(!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    code = code.split(searchStr).join(replacement);
    fs.writeFileSync(file, code);
}

updateLinks('src/app/dashboard/service-records/page.js', 
    '`/dashboard/equipment?openItem=${eqId}&tab=servis`',
    '`/dashboard/equipment?openItem=${eqId}&tab=servis&returnTo=/dashboard/service-records`');

updateLinks('src/app/dashboard/ek-equipment/page.js', 
    '`/dashboard/equipment?openItem=${e.id}`',
    '`/dashboard/equipment?openItem=${e.id}&returnTo=/dashboard/ek-equipment`');

updateLinks('src/app/dashboard/archive/page.js',
    '`/dashboard/equipment?openItem=${sl.equipmentId}&tab=servis`',
    '`/dashboard/equipment?openItem=${sl.equipmentId}&tab=servis&returnTo=/dashboard/archive`');

updateLinks('src/app/dashboard/workplace-list/page.js',
    '`/dashboard/workplaces?openItem=${w.id}`',
    '`/dashboard/workplaces?openItem=${w.id}&returnTo=/dashboard/workplace-list`');

updateLinks('src/app/dashboard/ek-workers/page.js',
    '`/dashboard/workers?openWorker=${e.id}`',
    '`/dashboard/workers?openWorker=${e.id}&returnTo=/dashboard/ek-workers`');

console.log('Done!');
