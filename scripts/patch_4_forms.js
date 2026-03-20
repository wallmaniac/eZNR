const fs = require('fs');
const path = require('path');

const filesToPatch = [
  {
    path: '../src/app/dashboard/requests/page.js',
    emptyObj: 'EMPTY_ZAHTJEVNICA',
    emptyEnd: "  stavke: [], // array of items\\n};"
  },
  {
    path: '../src/app/dashboard/form-ro1/page.js',
    emptyObj: 'EMPTY_RO1',
    emptyEnd: "  datumUpucivanja: todayISO(),\\n};"
  },
  {
    path: '../src/app/dashboard/form-ro2/page.js',
    emptyObj: 'EMPTY_RO2',
    emptyEnd: "  radniStazNaRadnomMjestu: '',\\n};"
  },
  {
    path: '../src/app/dashboard/night-work/page.js',
    emptyObj: 'EMPTY_NR1',
    emptyEnd: "  odgovornaOsoba: '',\\n};"
  }
];

const helpers = [
  "  const handleDocUpload = async (e) => {",
  "    const file = e.target.files?.[0];",
  "    if (!file) return;",
  "    if (file.size > 2 * 1024 * 1024) {",
  "      await alert(lang === 'bs' ? 'Dokument mora biti manji od 2MB!' : 'Document must be under 2MB!');",
  "      return;",
  "    }",
  "    const reader = new FileReader();",
  "    reader.onload = (ev) => {",
  "      setFormData(prev => ({",
  "        ...prev,",
  "        docName: file.name,",
  "        docData: ev.target.result,",
  "      }));",
  "    };",
  "    reader.readAsDataURL(file);",
  "  };",
  "",
  "  const downloadDoc = (log) => {",
  "    if (!log.docData) return;",
  "    const a = document.createElement('a');",
  "    a.href = log.docData;",
  "    a.download = log.docName || 'prilog_dokumenta';",
  "    a.click();",
  "  };"
].join('\\n');

const uploadUICard = [
  "        {/* Document Upload Block */}",
  '        <div className="card">',
  '          <div className="card-body">',
  "            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{lang === 'bs' ? 'Prilog' : 'Attachment'}</div>",
  '            <div className="form-group" style={{ marginBottom: 0 }}>',
  '              <label className="form-label">📎 {lang === \'bs\' ? \'Dokument (PDF, Word, maks. 2MB)\' : \'Document (PDF, Word, max 2MB)\'}</label>',
  '              {formData.docName ? (',
  "                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>",
  "                      <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>📎 {formData.docName}</span>",
  "                      <button className=\"btn btn-ghost btn-sm\" onClick={() => setFormData(p => ({ ...p, docName: '', docData: '' }))} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>✕ {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>",
  '                  </div>',
  '              ) : (',
  "                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>",
  "                      📂 {lang === 'bs' ? 'Kliknite za upload dokumenta (Word, PDF)' : 'Click to upload document (Word, PDF)'}",
  '                  </div>',
  '              )}',
  '              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: \'none\' }} onChange={handleDocUpload} />',
  '            </div>',
  '          </div>',
  '        </div>',
  ''
].join('\\n');

for (const f of filesToPatch) {
  const filepath = path.join(__dirname, f.path);
  let content = fs.readFileSync(filepath, 'utf8');

  // 1. Hook doc fields to EMPTY obj
  if (!content.includes("docName: ''")) {
    const replEnd = f.emptyEnd.replace('};', "  docName: '',\\n  docData: '',\\n};");
    content = content.replace(f.emptyEnd, replEnd);
    if (content === fs.readFileSync(filepath, 'utf8')) {
      console.log('Failed to patch EMPTY object on ' + f.path);
    }
  }

  // 2. Add useRef import
  if (!content.includes(', useRef')) {
    content = content.replace(
      "import {  useState, useEffect, useCallback  } from 'react';",
      "import {  useState, useEffect, useCallback, useRef  } from 'react';"
    );
  }

  // 3. Add docInputRef
  if (!content.includes('const docInputRef = useRef(null)')) {
    content = content.replace(
      "const [formData, setFormData] = useState({ ..." + f.emptyObj + " });",
      "const [formData, setFormData] = useState({ ..." + f.emptyObj + " });\\n  const docInputRef = useRef(null);"
      "const [formData, setFormData] = useState({ ..." + f.emptyObj + " });\n  const docInputRef = useRef(null);"
    );
  }

  // 4. Add helpers
  if (!content.includes('const handleDocUpload = async (e)')) {
    content = content.replace(
      '\n  return (\n    <div className="animate-fadeIn">',
      '\n' + helpers + '\n  return (\n    <div className="animate-fadeIn">'
    );
  }

  // 5. Add upload block before {/* ═══ Action buttons ═══ */}
  if (!content.includes('Kliknite za upload dokumenta')) {
    content = content.replace(
      '{/* ═══ Action buttons ═══ */}',
      uploadUICard + '\\n        {/* ═══ Action buttons ═══ */}'
    );
  }

  // 6. Add "Preuzmi prilog" to Action dropdown
  if (!content.includes('Preuzmi prilog')) {
    let lines = content.split('\\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("{lang === 'bs' ? 'Otvori' : 'Open'}")) {
        if (lines[i+1].includes('</button>')) {
          const dlBtn = [
            '                                  {r.docData && (',
            "                                    <button className=\\"dropdown-item\\" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); downloadDoc(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📎</span> {lang === 'bs' ? 'Preuzmi prilog' : 'Download file'}</button>",
            '                                  )}'
          ].join('\\n');
          lines.splice(i+2, 0, dlBtn);
        }
      }
    }
    content = lines.join('\\n');
  }

  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Patched ' + f.path);
}
