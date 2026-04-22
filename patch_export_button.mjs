import fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/workers/page.js', 'utf8');

// Move Excel button outside of selectedIds block (remove original)
content = content.replace(
    /<button className="btn btn-sm" style=\{\{ background: '#107c41', color: 'white', border: 'none' \}\} onClick=\{\(\) => setShowExportModal\(true\)\}>\s*📊 Excel\s*<\/button>/g,
    ''
);

// Put it next to PDFExportButton
content = content.replace(
    /<PDFExportButton options=\{\[/g,
    `<button className="btn btn-sm" style={{ background: '#107c41', color: 'white', border: 'none', height: 38 }} onClick={() => setShowExportModal(true)}>
                                📊 {lang === 'bs' ? 'Excel Export' : 'Excel Export'}
                            </button>
                            <PDFExportButton options={[`
);

// Update modal text for English and Bosnian using escaped literals
content = content.replace(
    /\(odabrano \$\{selectedIds\.size\} radnika\)/g,
    `(\${selectedIds.size > 0 ? 'odabrano ' + selectedIds.size : 'svih ' + filteredWorkers.length} radnika)`
);
content = content.replace(
    /\(\$\{selectedIds\.size\} workers selected\)/g,
    `(\${selectedIds.size > 0 ? selectedIds.size + ' workers selected' : 'all ' + filteredWorkers.length + ' workers'})`
);

// Update the export logic payload
content = content.replace(
    /const selectedWorkers = workers\.filter\(w => selectedIds\.has\(w\.id\)\);/g,
    `const selectedWorkers = selectedIds.size > 0 ? workers.filter(w => selectedIds.has(w.id)) : filteredWorkers;`
);

fs.writeFileSync('src/app/dashboard/workers/page.js', content, 'utf8');
console.log('Worker Export button logic patched.');
