const fs = require('fs');
const path = require('path');

const pages = [
  'src/app/dashboard/form-ro1/page.js',
  'src/app/dashboard/form-ro2/page.js',
  'src/app/dashboard/night-work/page.js',
  'src/app/dashboard/medical-exams/page.js',
  'src/app/dashboard/injuries/page.js',
  'src/app/dashboard/injury-list/page.js',
  'src/app/dashboard/requests/page.js',
  'src/app/dashboard/referral-ra1/page.js'
];

let successCount = 0;

pages.forEach(p => {
  const filePath = path.join('c:\\Users\\zzida\\Desktop\\znrba\\app', p);
  console.log(`Processing ${p}...`);
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found!`);
    return;
  }
  let text = fs.readFileSync(filePath, 'utf-8');
  let origText = text;

  // 1. Remove global mousedown listener completely (this is what destroys the DOM before onClick can fire)
  text = text.replace(/\/\/\s*Close action menu on outside click\s*useEffect\(\(\) => \{\s*const handler = \(\) => setActionMenuId\(null\);\s*document\.addEventListener\('mousedown', handler\);\s*return \(\) => document\.removeEventListener\('mousedown', handler\);\s*\}, \[\]\);/g, '');
  text = text.replace(/useEffect\(\(\) => \{\s*const handler = \(\) => setActionMenuId\(null\);\s*document\.addEventListener\('mousedown', handler\);\s*return \(\) => document\.removeEventListener\('mousedown', handler\);\s*\}, \[\]\);/g, '');

  // 2. Fix showGroupMenu
  // Add the overlay
  text = text.replace(
    /(\{showGroupMenu && \(\s*)<div className="dropdown-menu"([^>]*)>/g,
    `$1<>\n                  <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setShowGroupMenu(false); }} />\n                  <div className="dropdown-menu"$2>`
  );
  // Remove broken onMouseLeave
  text = text.replace(/ onMouseLeave=\{\(\) => setShowGroupMenu\(false\)\}/g, '');
  
  // Close the <> fragment for showGroupMenu
  // The exact string at the end is: 
  // `Delete selected (${selectedIds.size})`}</button>
  //                  </div>
  //                )}
  text = text.replace(
    /Delete selected \(\$\{selectedIds\.size\}\)`\}<\/button>\s*<\/div>\s*\)\}/g,
    (match) => match.replace(/<\/div>\s*\)\}/, '</div>\n                  </>\n                )}')
  );

  // 3. Fix actionMenuId
  // Add the overlay
  text = text.replace(
    /(\{actionMenuId === r\.id && \(\s*)<div className="dropdown-menu"([^>]*)>/g,
    `$1<>\n                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />\n                            <div className="dropdown-menu"$2>`
  );
  
  // Close the <> fragment for actionMenuId
  text = text.replace(
    /\{lang === 'bs' \? 'Obriši' : 'Delete'\}<\/button>\s*<\/div>\s*\)\}/g,
    (match) => match.replace(/<\/div>\s*\)\}/, '</div>\n                          </>\n                        )}')
  );
  
  // Make sure btn-dark is used for Grupne akcije 
  text = text.replace(/<button className="btn btn-dark btn-sm"/g, '<button className="btn btn-dark"');

  if (text !== origText) {
    fs.writeFileSync(filePath, text, 'utf-8');
    console.log(`  [OK] Successfully rewrote dropdown overlays.`);
    successCount++;
  } else {
    console.log(`  [WARN] No changes made to this file!`);
  }
});

console.log(`\nSuccessfully applied to ${successCount} files.`);
