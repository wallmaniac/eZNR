const fs = require('fs');

const pagesConf = [
  { p: 'src/app/dashboard/referral-ra1/page.js', col: 'COLLECTIONS.REFERRALS_RA1', arr: 'records', item: 'r', idf: 'r.id' },
  { p: 'src/app/dashboard/form-ro1/page.js', col: 'COLLECTIONS.FORMS_RO1', arr: 'records', item: 'r', idf: 'r.id' },
  { p: 'src/app/dashboard/form-ro2/page.js', col: 'COLLECTIONS.FORMS_RO2', arr: 'records', item: 'r', idf: 'r.id' },
  { p: 'src/app/dashboard/night-work/page.js', col: 'COLLECTIONS.REFERRALS_NR1', arr: 'records', item: 'r', idf: 'r.id' },
  { p: 'src/app/dashboard/medical-exams/page.js', col: 'COLLECTIONS.MEDICAL_EXAMS', arr: 'exams', item: 'exam', idf: 'exam.id' },
  { p: 'src/app/dashboard/injuries/page.js', col: 'COLLECTIONS.INJURIES', arr: 'injuries', item: 'inj', idf: 'inj.id' },
  // injury-list lists injuries. But its open edit is via router navigation to /dashboard/injuries?editId=...
  { p: 'src/app/dashboard/injury-list/page.js', col: 'COLLECTIONS.INJURIES', arr: 'injuries', item: 'inj', idf: 'inj.id', isInjList: true },
  { p: 'src/app/dashboard/requests/page.js', col: 'COLLECTIONS.REQUESTS', arr: 'records', item: 'r', idf: 'r.id' }
];

pagesConf.forEach(({p, col, arr, item, idf, isInjList}) => {
  let text = fs.readFileSync(p, 'utf-8');

  // ----- 1. Imports -----
  if (!text.includes('createPortal')) {
    text = text.replace(/import\s+{([^}]+)}\s+from\s+['"]react['"];/, (m, p1) => {
      return `import { createPortal } from 'react-dom';\nimport { ${p1} } from 'react';`;
    });
  }
  if (isInjList && !text.includes('create,')) {
    text = text.replace(/import\s+{([^}]+)}\s+from\s+['"]@\/lib\/dataStore['"];/, (m, p1) => {
      if (!p1.includes('create')) return m.replace(p1, `create, ${p1}`);
      return m;
    });
  }

  // ----- 2. States -----
  if (!text.includes('selectedIds')) {
    text = text.replace(/const \[actionMenuId, setActionMenuId\] = useState\(null\);/, 
`const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [selectedIds, setSelectedIds] = useState(new Set());`);
  }

  // ----- 3. Bulk functions -----
  if (!text.includes('const handleDuplicate')) {
    const fnCode = `

  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(${arr}.map(x => x.id)));
    else setSelectedIds(new Set());
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const handleDuplicate = async (it) => {
    const copy = { ...it };
    delete copy.id; delete copy.createdAt; delete copy.updatedAt;
    copy.datum = new Date().toISOString().split('T')[0];
    await create(${col}, copy);
    if (typeof loadData === 'function') loadData();
    else if (typeof fetchExams === 'function') fetchExams();
    else if (typeof fetchInjuries === 'function') fetchInjuries();
  };
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(lang === 'bs' ? \`Obrisati \${selectedIds.size} stavki?\` : \`Delete \${selectedIds.size} items?\`)) {
      for (let id of selectedIds) await remove(${col}, id);
      setSelectedIds(new Set());
      if (typeof loadData === 'function') loadData();
      else if (typeof fetchExams === 'function') fetchExams();
      else if (typeof fetchInjuries === 'function') fetchInjuries();
    }
  };
`;
    // Find the first effect wrapper or load function to insert before it
    const insertIdx = text.indexOf('useEffect(() => {');
    if (insertIdx > 0) {
      const block = text.lastIndexOf('\n', insertIdx);
      text = text.slice(0, block) + fnCode + text.slice(block);
    }
  }

  // ----- 4. Header Bulk actions UI -----
  // Find standard header container `<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>`
  // But pages use 24, 8, etc. Look for `animate-fadeIn` and then the next `marginLeft: 'auto'` container.
  if (!text.includes('Izbriši odabrane') && !text.includes('handleDeleteSelected')) {
    text = text.replace(/(<div style={{ marginLeft: 'auto'.*?>)/s, `$1
          {selectedIds.size > 0 && (
            <button className="btn btn-danger" style={{ marginRight: 12 }} onClick={handleDeleteSelected}>
              🗑️ {lang === 'bs' ? \`Izbriši odabrane (\${selectedIds.size})\` : \`Delete selected (\${selectedIds.size})\`}
            </button>
          )}`);
    // For injury list which might not have marginLeft: 'auto'
    if (isInjList && !text.includes('handleDeleteSelected')) {
       // Just insert after search bar
       text = text.replace(/(<input.*?placeholder={lang === 'bs' \? 'Pretraži.*?\/>)/s, `$1
              {selectedIds.size > 0 && (
                <button className="btn btn-danger" onClick={handleDeleteSelected}>
                  🗑️ {lang === 'bs' ? \`Izbriši odabrane (\${selectedIds.size})\` : \`Delete selected (\${selectedIds.size})\`}
                </button>
              )}`);
    }
  }

  // ----- 5. Checkboxes in rows -----
  if (!text.includes('onChange={toggleAll}')) {
    // Modify actions table header: `<th>{lang === 'bs' ? 'Akcije' : 'Actions'}</th>` or `t('actions')`
    text = text.replace(/(<th>\s*(?:\{lang === 'bs' \? 'Akcije' : 'Actions'\}|\{t\('actions'\)\}|\{bs \? 'Akcije' : 'Actions'\})\s*<\/th>)/, 
      `<th style={{ width: 40 }}><input type="checkbox" checked={selectedIds.size === ${arr}.length && ${arr}.length > 0} onChange={toggleAll} /></th>\n                    $1`);
  }
  
  if (!text.includes('onChange={() => toggleOne(')) {
    // Modify actions table cell containing Akcije button wrapper
    // The `<td style={{ position: 'relative' }}>` or `<td>` that wraps `Akcije` button.
    // So find `<button className="btn btn-primary btn-sm" onClick={` and inject the checkbox TD right before its parent TD.
    text = text.replace(/(<td[^>]*>[\s\S]*?<button className="btn btn-primary btn-sm"[^>]*>\{[^}]+'Akcije'[^}]+\}\s*▼<\/button>)/, 
      `<td><input type="checkbox" checked={selectedIds.has(${idf})} onChange={() => toggleOne(${idf})} onClick={e => e.stopPropagation()} /></td>\n                      $1`);
  }

  // ----- 6. Akcije Button onClick & createPortal -----
  // Replace the btn-primary onClick and the dropdown menu structure
  // Find `<button className="btn btn-primary btn-sm" onClick={...} > ... </button>` 
  // And the subsequent `{actionMenuId === ... && ( <div className="dropdown-menu"... </div> )}`
  // To avoid regex hell, we match the button and the block.
  
  const regexDrop = /<button className="btn btn-primary btn-sm"[^>]+onClick=\{[^}]+\}\s*>.*?▼<\/button>[\s\S]*?(?:\{actionMenuId ===[^&]+&&\s*\([\s\S]*?<\/div>\s*\)\}|\{actionMenuId ===[^?]+\?[^:]+:\s*null\})/g;

  // Edit action differs: in injury-list it uses router, in requests handleEdit(r), etc.
  // I will just use the correct edit command parsed from the existing code or define per page.
  let editAction = `handleEdit(${item})`;
  if (isInjList) editAction = `router.push(\`/dashboard/injuries?editId=\$\{${idf}}\`)`;
  else if (p.includes('injuries')) editAction = `router.push(\`/dashboard/injuries?editId=\$\{${idf}}\`)`; // If any
  else if (p.includes('medical-exams')) editAction = `handleEdit(${item})`; // Actually med-exams uses `handleEdit(exam)`
  else if (p.includes('requests')) editAction = `handleEdit(${item})`; // requests uses `handleEdit(r)`
  
  text = text.replace(regexDrop, 
`<button 
    className="btn btn-primary btn-sm" 
    onClick={e => { 
      e.stopPropagation(); 
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left < 200 ? 50 : rect.left });
      setActionMenuId(prev => prev === ${idf} ? null : ${idf}); 
    }}
  >
    {lang === 'bs' ? 'Akcije' : 'Actions'} ▼
  </button>
  {actionMenuId === ${idf} && typeof window !== 'undefined' && createPortal(
    <div className="dropdown-menu" 
         style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999, minWidth: 160, display: 'block', margin: 0 }} 
         onMouseLeave={() => setActionMenuId(null)}>
      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); ${editAction}; }}>
        <span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>✏️</span> {lang === 'bs' ? 'Otvori' : 'Open'}
      </button>
      <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDuplicate(${item}); }}>
        <span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📋</span> {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}
      </button>
      <div className="dropdown-divider" />
      <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(${idf} || ${item}.id); }}>
        <span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🗑️</span> {lang === 'bs' ? 'Obriši' : 'Delete'}
      </button>
    </div>,
    document.body
  )}`
  );

  fs.writeFileSync(p, text, 'utf-8');
});

console.log("Pages updated with Portal Akcije, Otvori/Kopiraj/Obrisi, and Bulk Actions.");
