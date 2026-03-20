const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '../src/app/dashboard/form-oir1/page.js');
let content = fs.readFileSync(filepath, 'utf8');

if (!content.includes("docName: ''")) {
  content = content.replace(
    "datumPrijave: todayISO(),\n};",
    "datumPrijave: todayISO(),\n  docName: '',\n  docData: '',\n};"
  );
}

if (!content.includes('useRef')) {
  content = content.replace(
    "import { useState, useEffect, useCallback } from 'react';",
    "import { useState, useEffect, useCallback, useRef } from 'react';"
  );
}

if (!content.includes('const docInputRef')) {
  content = content.replace(
    "const [formData, setFormData] = useState({ ...EMPTY_OIR1 });",
    "const [formData, setFormData] = useState({ ...EMPTY_OIR1 });\n  const docInputRef = useRef(null);"
  );
}

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
].join('\n');

if (!content.includes('const handleDocUpload')) {
  content = content.replace("return (\n", helpers + "\n  return (\n");
}

const uploadUI = [
  "          <div className=\"form-group\" style={{ gridColumn: '1 / -1', marginTop: 16 }}>",
  "              <label className=\"form-label\">📎 {lang === 'bs' ? 'Prilog dokumenta (maks. 2MB)' : 'Attached document (max 2MB)'}</label>",
  "              {formData.docName ? (",
  "                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>",
  "                      <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>📎 {formData.docName}</span>",
  "                      <button className=\"btn btn-ghost btn-sm\" onClick={() => setFormData(p => ({ ...p, docName: '', docData: '' }))} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>✕ {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>",
  "                  </div>",
  "              ) : (",
  "                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>",
  "                      📂 {lang === 'bs' ? 'Kliknite za upload dokumenta (Word, PDF)' : 'Click to upload document (Word, PDF)'}",
  "                  </div>",
  "              )}",
  "              <input ref={docInputRef} type=\"file\" accept=\".pdf,.doc,.docx\" style={{ display: 'none' }} onChange={handleDocUpload} />",
  "          </div>"
].join('\n');

if (!content.includes("docInputRef.current?.click()")) {
  content = content.replace(
    '          <div className="modal-footer">',
    uploadUI + '\n          <div className="modal-footer">'
  );
}

if (content.includes('<th>#</th>')) {
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<thead>')) {
      let j = i + 1;
      while (!lines[j].includes('</tr>')) j++;
      
      let block = lines.slice(i+1, j+1).join('\n');
      if (block.includes('<th>#</th>')) {
        let replacement = [
          "                <tr>",
          "                  <th>{lang === 'bs' ? 'Akcije' : 'Actions'}</th>",
          "                  <th>#</th>",
          "                  <th>{lang === 'bs' ? 'Događaj nastao u' : 'Event location'}</th>",
          "                  <th>{lang === 'bs' ? 'Datum događaja' : 'Event date'}</th>",
          "                  <th>{lang === 'bs' ? 'Ozlijeđeni' : 'Injured'}</th>",
          "                  <th>{lang === 'bs' ? 'Podnositelj' : 'Submitter'}</th>",
          "                  <th>{lang === 'bs' ? 'Datum prijave' : 'Submit date'}</th>",
          "                  <th style={{ width: 40, textAlign: 'center' }}><input type=\"checkbox\" checked={selectedIds.size === records.length && records.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>",
          "                </tr>"
        ].join('\n');
        lines.splice(i+1, j - i, replacement);
      }
      break;
    }
  }
  content = lines.join('\n');
}

const oldDropdownBtn = ">{lang === 'bs' ? 'Otvori' : 'Open'}</button>";
const newDropdownBtn = [
  ">{lang === 'bs' ? 'Otvori' : 'Open'}</button>",
  "                                  {r.docData && (",
  "                                    <button className=\"dropdown-item\" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); downloadDoc(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📎</span> {lang === 'bs' ? 'Preuzmi prilog' : 'Download file'}</button>",
  "                                  )}"
].join('\n');

if (!content.includes('Preuzmi prilog')) {
  content = content.split(oldDropdownBtn).join(newDropdownBtn);
}

fs.writeFileSync(filepath, content, 'utf8');
console.log('form-oir1 patched');
