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

        fs.writeFileSync(filePath, code, 'utf8');
        console.log('Patched', filePath);
    }
}

processFile('src/app/dashboard/equipment/page.js');
