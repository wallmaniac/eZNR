import sys

filepath = '../src/app/dashboard/requests/page.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("import {  useState, useEffect, useCallback  } from 'react';", "import {  useState, useEffect, useCallback, useRef  } from 'react';")

content = content.replace("  stavke: [], // array of items\n};", "  stavke: [], // array of items\n  docName: '',\n  docData: '',\n};")

content = content.replace("  const [formData, setFormData] = useState({ ...EMPTY_ZAHTJEVNICA });", "  const [formData, setFormData] = useState({ ...EMPTY_ZAHTJEVNICA });\n  const docInputRef = useRef(null);")

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

target_return = """  // ── Form view ──
  return (
    <div className="animate-fadeIn">"""

new_return = "  // ── Form view ──\n" + helpers + """  return (
    <div className="animate-fadeIn">"""

content = content.replace(target_return, new_return)

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

content = content.replace('        {/* ═══ Action buttons ═══ */}', upload_ui + '        {/* ═══ Action buttons ═══ */}')

dl_btn = """                            {r.docData && (
                              <button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); downloadDoc(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📎</span> {lang === 'bs' ? 'Preuzmi prilog' : 'Download file'}</button>
                            )}"""

otvori_btn = """<button className="dropdown-item" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📝</span> {lang === 'bs' ? 'Otvori' : 'Open'}
                            </button>"""

content = content.replace(otvori_btn, otvori_btn + "\n" + dl_btn)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("requests module patched")
