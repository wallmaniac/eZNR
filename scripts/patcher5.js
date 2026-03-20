const fs = require('fs');
const path = require('path');

const replaceInFile = (file, fromStr, toStr) => {
  const p = path.join(__dirname, '../src/app/dashboard', file);
  if (!fs.existsSync(p)) return;
  let text = fs.readFileSync(p, 'utf8');
  text = text.split(fromStr).join(toStr);
  fs.writeFileSync(p, text, 'utf8');
  console.log(`Replaced in ${file}`);
};

const replaceRegex = (file, regex, replaceWith) => {
  const p = path.join(__dirname, '../src/app/dashboard', file);
  if (!fs.existsSync(p)) return;
  let text = fs.readFileSync(p, 'utf8');
  text = text.replace(regex, replaceWith);
  fs.writeFileSync(p, text, 'utf8');
  console.log(`Regex Replaced in ${file}`);
}


// --- 1. Fix zIndex: 999 to 9999 globally ---
['form-ro1/page.js', 'form-ro2/page.js', 'night-work/page.js', 'requests/page.js'].forEach(file => {
  replaceInFile(file, `zIndex: 999, display: 'block'`, `zIndex: 9999, display: 'block'`);
});

// --- 2. Add <span> wrappers for emojis ---
const fixButtons = (file) => {
  replaceInFile(file, `✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>`, 
    `<span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📝</span> {lang === 'bs' ? 'Otvori' : 'Open'}
                            </button>`);
  
  replaceInFile(file, `📋 {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}</button>`,
    `<span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📋</span> {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}
                            </button>`);
                            
  replaceInFile(file, `🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>`,
    `<span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🗑️</span> {lang === 'bs' ? 'Obriši' : 'Delete'}
                            </button>`);
                            
  replaceInFile(file, `🖨️ {lang === 'bs' ? 'Ispiši odabrane' : 'Print selected'}</button>`,
    `<span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🖨️</span> {lang === 'bs' ? 'Ispiši odabrane' : 'Print selected'}</button>`);
};

['form-ro1/page.js', 'form-ro2/page.js', 'night-work/page.js', 'requests/page.js'].forEach(fixButtons);


// --- 3. Totally convert form-oir1/page.js to have the standard dropdown menu ---
const oir1Path = path.join(__dirname, '../src/app/dashboard/form-oir1/page.js');
let oirText = fs.readFileSync(oir1Path, 'utf8');

// Ensure state variables exist
if (!oirText.includes('const [actionMenuId, setActionMenuId]')) {
  oirText = oirText.replace('const [showForm, setShowForm] = useState(false);', 
    `const [showForm, setShowForm] = useState(false);\n  const [actionMenuId, setActionMenuId] = useState(null);\n  const [showGroupMenu, setShowGroupMenu] = useState(false);\n  const [selectedIds, setSelectedIds] = useState(new Set());`);
}

// Ensure toggle functions exist
if (!oirText.includes('const toggleAll')) {
  oirText = oirText.replace('const loadData = useCallback(() => {', 
    `const toggleAll = (e) => {\n    if (e.target.checked) setSelectedIds(new Set(records.map(x => x.id)));\n    else setSelectedIds(new Set());\n  };\n  const toggleOne = (id) => {\n    const next = new Set(selectedIds);\n    if (next.has(id)) next.delete(id); else next.add(id);\n    setSelectedIds(next);\n  };\n\n  const handleDeleteSelected = async () => {\n    if (selectedIds.size === 0) return;\n    if (window.confirm(lang === 'bs' ? \`Obrisati \${selectedIds.size} stavki?\` : \`Delete \${selectedIds.size} items?\`)) {\n      for (let id of selectedIds) await remove(COLLECTIONS.FORMS_OIR1, id);\n      setSelectedIds(new Set());\n      loadData();\n    }\n  };\n\n  const loadData = useCallback(() => {`);
}

// Replace Group Actions Header
if (!oirText.includes('Grupne akcije')) {
  const oir1GroupPattern = `<span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {records.length} {lang === 'bs' ? 'zapisa' : 'records'}
            </span>`;
  
  const oir1GroupReplacement = `<span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {records.length} {lang === 'bs' ? 'zapisa' : 'records'}
            </span>
            <div style={{ position: 'relative' }}>
                <button className="btn btn-dark" onClick={() => setShowGroupMenu(v => !v)}>{lang === 'bs' ? 'Grupne akcije' : 'Group actions'} ▼</button>
                {showGroupMenu && (
                  <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setShowGroupMenu(false); }} />
                  <div className="dropdown-menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', minWidth: 230, zIndex: 9999, display: 'block' }}>
                    <div style={{ padding: '6px 14px 4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {selectedIds.size > 0 ? \`\${selectedIds.size} \${lang === 'bs' ? 'odabrano' : 'selected'}\` : (lang === 'bs' ? 'Odaberite stavke' : 'Select items first')}
                    </div>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={() => { setShowGroupMenu(false); window.print(); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🖨️</span> {lang === 'bs' ? 'Ispiši odabrane' : 'Print selected'}</button>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ color: selectedIds.size > 0 ? 'var(--danger)' : 'var(--text-muted)', opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={() => { setShowGroupMenu(false); handleDeleteSelected(); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🗑️</span> {lang === 'bs' ? \`Obriši odabrane (\${selectedIds.size})\` : \`Delete selected (\${selectedIds.size})\`}</button>
                  </div>
                  </>
                )}
              </div>`;
              
  oirText = oirText.replace(oir1GroupPattern, oir1GroupReplacement);
}


// Replace Thead
const oir1TheadOld = `<tr>
                    <th>#</th>
                    <th>{lang === 'bs' ? 'Događaj nastao u' : 'Event location'}</th>
                    <th>{lang === 'bs' ? 'Datum događaja' : 'Event date'}</th>
                    <th>{lang === 'bs' ? 'Ozlijeđeni' : 'Injured'}</th>
                    <th>{lang === 'bs' ? 'Podnositelj' : 'Submitter'}</th>
                    <th>{lang === 'bs' ? 'Datum prijave' : 'Filing date'}</th>
                    <th>{t('actions')}</th>
                  </tr>`;
const oir1TheadNew = `<tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Događaj nastao u' : 'Event location'}</th>
                    <th>{lang === 'bs' ? 'Datum događaja' : 'Event date'}</th>
                    <th>{lang === 'bs' ? 'Ozlijeđeni' : 'Injured'}</th>
                    <th>{lang === 'bs' ? 'Podnositelj' : 'Submitter'}</th>
                    <th>{lang === 'bs' ? 'Datum prijave' : 'Filing date'}</th>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  </tr>`;
                  
oirText = oirText.replace(oir1TheadOld, oir1TheadNew);

// Replace Tbody
const oir1RowOldRegex = /<tr key={r\.id}>[\s\S]*?<\/tr>/;
const oir1RowNew = `<tr key={r.id}>
                                            <td style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setActionMenuId(prev => prev === r.id ? null : r.id); }}>{lang === 'bs' ? 'Akcije' : 'Actions'} ▼</button>
                        {actionMenuId === r.id && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, zIndex: 9999, display: 'block' }}>
                            <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}>
                              <span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📝</span> {lang === 'bs' ? 'Otvori' : 'Open'}
                            </button>
                            <div className="dropdown-divider" />
                            <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(r.id); }}>
                              <span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🗑️</span> {lang === 'bs' ? 'Obriši' : 'Delete'}
                            </button>
                          </div>
                          </>
                        )}
                      </td>
                      <td>{r.dogadjajNastaoU || '—'}</td>
                      <td>{formatDate(r.datumDogadjaja)}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getInjuredSummary(r)}</td>
                      <td>{r.podnositelj || '—'}</td>
                      <td>{formatDate(r.datumPrijave)}</td>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                    </tr>`;

oirText = oirText.replace(oir1RowOldRegex, oir1RowNew);

// Write form-oir1 back
fs.writeFileSync(oir1Path, oirText, 'utf8');
console.log('Fixed form-oir1/page.js');
