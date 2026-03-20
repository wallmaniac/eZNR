const fs = require('fs');
const filepath = '../src/app/dashboard/requests/page.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace(
  "import {  useState, useEffect, useCallback  } from 'react';",
  "import {  useState, useEffect, useCallback, useRef  } from 'react';"
);

content = content.replace(
  "  stavke: [], // array of items\\n};",
  "  stavke: [], // array of items\\n  docName: '',\\n  docData: '',\\n};"
);

content = content.replace(
  "  const [formData, setFormData] = useState({ ...EMPTY_ZAHTJEVNICA });",
  "  const [formData, setFormData] = useState({ ...EMPTY_ZAHTJEVNICA });\\n  const docInputRef = useRef(null);"
);

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

content = content.replace(
  "\\n  // ── Form view ──\\n  return (\\n    <div className=\\"animate-fadeIn\\">",
  "\\n  // ── Form view ──\\n" + helpers + "\\n  return (\\n    <div className=\\"animate-fadeIn\\">"
);

const uploadUICard = [
  "        {/* Document Upload Block */}",
  '        <div className="card">',
  '          <div className="card-body">',
  "            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{lang === 'bs' ? 'Prilog' : 'Attachment'}</div>",
  '            <div className="form-group" style={{ marginBottom: 0 }}>',
  '              <label className="form-label">📎 {lang === \\\\'bs\\\\' ? \\\\'Dokument (PDF, Word, maks. 2MB)\\\\' : \\\\'Document (PDF, Word, max 2MB)\\\\'}</label>',
  '              {formData.docName ? (',
  "                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>",
  "                      <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>📎 {formData.docName}</span>",
  "                      <button className=\\"btn btn-ghost btn-sm\\" onClick={() => setFormData(p => ({ ...p, docName: '', docData: '' }))} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>✕ {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>",
  '                  </div>',
  '              ) : (',
  "                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>",
  "                      📂 {lang === 'bs' ? 'Kliknite za upload dokumenta (Word, PDF)' : 'Click to upload document (Word, PDF)'}",
  '                  </div>',
  '              )}',
  '              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: \\\\'none\\\\' }} onChange={handleDocUpload} />',
  '            </div>',
  '          </div>',
  '        </div>',
  ''
].join('\\n');

content = content.replace(
  '        {/* ═══ Action buttons ═══ */}',
  uploadUICard + '\\n        {/* ═══ Action buttons ═══ */}'
);

const dlBtn = [
  '                            {r.docData && (',
  "                              <button className=\\"dropdown-item\\" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); downloadDoc(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📎</span> {lang === 'bs' ? 'Preuzmi prilog' : 'Download file'}</button>",
  '                            )}'
].join('\\n');

const otvoriBtn = "<button className=\\"dropdown-item\\" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📝</span> {lang === 'bs' ? 'Otvori' : 'Open'}\\n                            </button>";

content = content.replace(otvoriBtn, otvoriBtn + "\\n" + dlBtn);

fs.writeFileSync(filepath, content, 'utf8');
console.log('Done bridging Requests');
