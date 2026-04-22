import fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/workers/page.js', 'utf8');

// replace Boolean state with Mode state
content = content.replace(
    /const \[showExportModal, setShowExportModal\] = useState\(false\);/,
    `const [excelExportMode, setExcelExportMode] = useState(null);`
);

// replace the button with the dropdown component
const oldButton = /<button className="btn btn-sm" style=\{\{ background: '#107c41', color: 'white', border: 'none', height: 38 \}\} onClick=\{\(\) => setShowExportModal\(true\)\}>[\s\S]*?<\/button>/m;

const newButton = `<PDFExportButton
                                label={lang === 'bs' ? '📊 Excel Export' : '📊 Excel Export'}
                                buttonStyle={{ background: '#107c41', color: 'white', borderColor: '#107c41', height: 38 }}
                                options={[
                                    { label: lang === 'bs' ? 'Svi radnici' : 'All workers', icon: '👷', onClick: () => setExcelExportMode('all') },
                                    ...(selectedIds.size > 0 ? [{ label: lang === 'bs' ? \`Odabrani (\${selectedIds.size})\` : \`Selected (\${selectedIds.size})\`, icon: '✓', onClick: () => setExcelExportMode('selected') }] : [])
                                ]}
                            />`;
content = content.replace(oldButton, newButton);


// find the modal check and replace with excelExportMode check
content = content.replace(
    /\{showExportModal && \(/,
    `{excelExportMode && (`
);

// find modal Cancel button
content = content.replace(
    /onClick=\{\(\) => setShowExportModal\(false\)\}/g,
    `onClick={() => setExcelExportMode(null)}`
);

// find the payload derivation mode
const oldPayload = /const selectedWorkers = selectedIds\.size > 0 \? workers\.filter\(w => selectedIds\.has\(w\.id\)\) : filteredWorkers;/;
const newPayload = `const selectedWorkers = excelExportMode === 'selected' ? workers.filter(w => selectedIds.has(w.id)) : filteredWorkers;`;
content = content.replace(oldPayload, newPayload);


// fix the text in the modal to respect mode
content = content.replace(
    /\(\$\{selectedIds\.size > 0 \? 'odabrano ' \+ selectedIds\.size : 'svih ' \+ filteredWorkers\.length\} radnika\)/g,
    `(\${excelExportMode === 'selected' ? 'odabrano ' + selectedIds.size : 'SVIH ' + filteredWorkers.length} radnika)`
);
content = content.replace(
    /\(\$\{selectedIds\.size > 0 \? selectedIds\.size \+ ' workers selected' : 'all ' \+ filteredWorkers\.length \+ ' workers'\}\)/g,
    `(\${excelExportMode === 'selected' ? selectedIds.size + ' workers selected' : 'ALL ' + filteredWorkers.length + ' workers'})`
);


// close modal on success
content = content.replace(
    /setShowExportModal\(false\);\s*\/\/ Then write to file/m,
    `setExcelExportMode(null);
                                        // Then write to file`
);

fs.writeFileSync('src/app/dashboard/workers/page.js', content, 'utf8');
console.log('workers Excel Dropdown patched.');
