const fs = require('fs');
const path = require('path');

// 1. Fix globals.css
const cssPath = path.join('c:\\Users\\zzida\\Desktop\\znrba\\app\\src\\app', 'globals.css');
if (fs.existsSync(cssPath)) {
  let cssText = fs.readFileSync(cssPath, 'utf-8');
  // Replace overflow: hidden in .card
  cssText = cssText.replace(
    /\.card\s*\{\s*background:\s*var\(--bg-card\);\s*border-radius:\s*var\(--radius-lg\);\s*box-shadow:\s*var\(--shadow-sm\);\s*border:\s*1px\s*solid\s*var\(--border-light\);\s*overflow:\s*hidden;\s*transition:\s*all\s*var\(--transition-normal\);\s*\}/,
    `.card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  overflow: visible; /* FIXED: WAS HIDDEN AND CLIPPED DROPDOWNS */
  transition: all var(--transition-normal);
}`
  );
  fs.writeFileSync(cssPath, cssText, 'utf-8');
  console.log('Fixed globals.css');
}

// 2. Fix the 8 pages
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

pages.forEach(p => {
  const filePath = path.join('c:\\Users\\zzida\\Desktop\\znrba\\app', p);
  if (!fs.existsSync(filePath)) return;
  
  let text = fs.readFileSync(filePath, 'utf-8');
  let origText = text;

  // If showGroupMenu is completely missing, inject it right after actionMenuId
  if (!text.includes('showGroupMenu, setShowGroupMenu')) {
    text = text.replace(
      /const \[actionMenuId, setActionMenuId\] = useState\(null\);/,
      `const [actionMenuId, setActionMenuId] = useState(null);\n  const [showGroupMenu, setShowGroupMenu] = useState(false);`
    );
  }

  // Also verify that selectedIds exists (it does everywhere, but just in case)
  
  if (text !== origText) {
    fs.writeFileSync(filePath, text, 'utf-8');
    console.log(`Injected showGroupMenu into ${p}`);
  }
});

console.log('Done script 3.');
