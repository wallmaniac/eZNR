const fs = require('fs');
const path = require('path');

const pages = [
  { p: 'src/app/dashboard/referral-ra1/page.js', col: 'COLLECTIONS.REFERRALS_RA1', arr: 'records', item: 'r' },
  { p: 'src/app/dashboard/form-ro1/page.js', col: 'COLLECTIONS.FORMS_RO1', arr: 'records', item: 'r' },
  { p: 'src/app/dashboard/form-ro2/page.js', col: 'COLLECTIONS.FORMS_RO2', arr: 'records', item: 'r' },
  { p: 'src/app/dashboard/night-work/page.js', col: 'COLLECTIONS.REFERRALS_NR1', arr: 'records', item: 'r' },
  { p: 'src/app/dashboard/medical-exams/page.js', col: 'COLLECTIONS.MEDICAL_EXAMS', arr: 'exams', item: 'exam' },
  { p: 'src/app/dashboard/injuries/page.js', col: 'COLLECTIONS.INJURIES', arr: 'injuries', item: 'inj' },
  { p: 'src/app/dashboard/injury-list/page.js', col: 'COLLECTIONS.INJURIES', arr: 'records', item: 'inj' },
  { p: 'src/app/dashboard/requests/page.js', col: 'COLLECTIONS.REQUESTS', arr: 'records', item: 'r' }
];

pages.forEach(({ p, col, arr, item }) => {
  let text = fs.readFileSync(p, 'utf-8');
  let changed = false;

  // 1. ADD createPortal
  if (!text.includes('createPortal')) {
    text = text.replace(/import\s+{([^}]+)}\s+from\s+['"]react['"];/, (m, p1) => {
      changed = true;
      return `import { createPortal } from 'react-dom';\nimport { ${p1} } from 'react';`;
    });
  }

  // 2. ADD STATES
  if (!text.includes('menuPos')) {
    text = text.replace(/const \[actionMenuId, setActionMenuId\] = useState\(null\);/,
      `const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());`);
    changed = true;
  }

  // 3. ADD BULK ACTION HANDLERS
  if (!text.includes('const handleDuplicate')) {
    const afterLoadData = text.indexOf('useEffect(() => {');
    // For medical-exams and injury-list, data is loaded via loadData or fetch
    const insertionPoint = text.lastIndexOf('}', afterLoadData) + 1; // somewhere before useEffect
    // Let's insert it carefully right before the first useEffect
    // Or just after 'const loadData = ...'
    // A safe place is right after 'setActionMenuId' line we just added. But we need access to 'remove' and 'create' assuming they exist?
    // Wait, let's use a regex to place it before `return (` of the main component.
    // However, the main component in some files has multiple return statements.
    // Let's place it before `const toggleAll` if it doesn't exist, else before `useEffect(() => { loadData...`
  }

  // To be safe, let's use multi_replace for each file, but it's 8 files. 
  // We can write strict regexes here.
});
