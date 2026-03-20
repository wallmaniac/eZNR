import sys
import os

files_to_patch = [
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\requests\page.js',
        'emptyObj': 'EMPTY_ZAHTJEVNICA',
        'emptyEnd': "  stavke: [], // array of items\n};"
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro1\page.js',
        'emptyObj': 'EMPTY_RO1',
        'emptyEnd': "  datumUpucivanja: todayISO(),\n};"
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro2\page.js',
        'emptyObj': 'EMPTY_RO2',
        'emptyEnd': "  radniStazNaRadnomMjestu: '',\n};"
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\night-work\page.js',
        'emptyObj': 'EMPTY_NR1',
        'emptyEnd': "  odgovornaOsoba: '',\n};"
    }
]

helpers = """
  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      await alert(lang === 'bs' ? 'Dokument mora biti manji od 2MB!' : 'Document must be under 2MB!');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData(prev => ({
        ...prev,
        docName: file.name,
        docData: ev.target.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const downloadDoc = (log) => {
    if (!log.docData) return;
    const a = document.createElement('a');
    a.href = log.docData;
    a.download = log.docName || 'prilog_dokumenta';
    a.click();
  };
"""

upload_ui = """        {/* Document Upload Block */}
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{lang === 'bs' ? 'Prilog' : 'Attachment'}</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📎 {lang === 'bs' ? 'Dokument (PDF, Word, maks. 2MB)' : 'Document (PDF, Word, max 2MB)'}</label>
              {formData.docName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>📎 {formData.docName}</span>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>✕ {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>
                  </div>
              ) : (
                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      📂 {lang === 'bs' ? 'Kliknite za upload dokumenta (Word, PDF)' : 'Click to upload document (Word, PDF)'}
                  </div>
              )}
              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
            </div>
          </div>
        </div>

"""

dl_btn = """                            {r.docData && (
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); downloadDoc(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📎</span> {lang === 'bs' ? 'Preuzmi prilog' : 'Download file'}</button>
                            )}"""

for f_info in files_to_patch:
    filepath = f_info['path']
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. EMPTY OBJ
    if "docName: ''," not in content:
        content = content.replace(f_info['emptyEnd'], f_info['emptyEnd'].replace('};', "  docName: '',\n  docData: '',\n};"))

    # 2. useRef Import
    if "useRef" not in content:
        content = content.replace("import {  useState, useEffect, useCallback  } from 'react';", "import {  useState, useEffect, useCallback, useRef  } from 'react';")

    # 3. docInputRef hook
    if "docInputRef = useRef" not in content:
        src_hook = f"const [formData, setFormData] = useState({{ ...{f_info['emptyObj']} }});"
        content = content.replace(src_hook, src_hook + "\n  const docInputRef = useRef(null);")

    # 4. Helpers
    if "handleDocUpload" not in content:
        target_return = """  // ── Form view ──
  return (
    <div className="animate-fadeIn">"""
        if target_return in content:
            content = content.replace(target_return, "  // ── Form view ──\n" + helpers + """  return (
    <div className="animate-fadeIn">""")
        else:
            # Fallback if "── Form view ──" is missing
            target_return2 = """  return (
    <div className="animate-fadeIn">"""
            content = content.replace(target_return2, helpers + "\n" + target_return2)

    # 5. UI Block
    if "{/* Document Upload Block */}" not in content:
        content = content.replace('        {/* ═══ Action buttons ═══ */}', upload_ui + '        {/* ═══ Action buttons ═══ */}')

    # 6. Dropdown Download
    if "Preuzmi prilog" not in content:
        otvori_btn = """<button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📝</span> {lang === 'bs' ? 'Otvori' : 'Open'}
                            </button>"""
        if otvori_btn in content:
            content = content.replace(otvori_btn, otvori_btn + "\n" + dl_btn)
        else:
            print(f"Warning: Could not find Otvori button in {filepath}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Patched {filepath}")
