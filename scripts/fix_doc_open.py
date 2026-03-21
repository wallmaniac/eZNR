import os, re

files = [
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-oir1\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\requests\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro1\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro2\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\night-work\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\referral-ra1\page.js',
]

DOC_HELPERS = """  const handleDocUpload = async (e) => {
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

  const openDoc = (docData, docName) => {
    if (!docData) return;
    // PDFs can open in new tab; Word docs will download
    const w = window.open();
    if (w) {
      w.document.write('<html><head><title>' + (docName || 'Dokument') + '</title></head><body style="margin:0"><iframe src="' + docData + '" style="width:100%;height:100vh;border:none"></iframe></body></html>');
      w.document.close();
    }
  };

"""

# New attachment UI block with clickable filename + open + print buttons
def make_upload_ui(lang_bs_label='Prilog', lang_en_label='Attachment'):
    return '''        {/* \u2550\u2550\u2550 Document Upload \u2550\u2550\u2550 */}
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{lang === 'bs' ? 'Prilog' : 'Attachment'}</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">\ud83d\udcce {lang === 'bs' ? 'Dokument (PDF, Word, maks. 2MB)' : 'Document (PDF, Word, max 2MB)'}</label>
              {formData.docName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => openDoc(formData.docData, formData.docName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--info)', fontSize: '0.85rem', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>\ud83d\udcce {formData.docName}</button>
                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                        <button type="button" className="btn btn-ghost btn-sm" title={lang === 'bs' ? 'Otvori' : 'Open'} onClick={() => openDoc(formData.docData, formData.docName)} style={{ color: 'var(--info)' }}>\ud83d\udc41 {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" title={lang === 'bs' ? 'Preuzmi' : 'Download'} onClick={() => downloadDoc({ docData: formData.docData, docName: formData.docName })} style={{ color: 'var(--primary)' }}>\u2193 {lang === 'bs' ? 'Preuzmi' : 'Download'}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ color: 'var(--danger)' }}>\u2715 {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>
                      </div>
                  </div>
              ) : (
                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      \ud83d\udcc2 {lang === 'bs' ? 'Kliknite za upload dokumenta (Word, PDF)' : 'Click to upload document (Word, PDF)'}
                  </div>
              )}
              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
            </div>
          </div>
        </div>

'''

UPLOAD_UI_NEW = make_upload_ui()

for filepath in files:
    with open(filepath, 'r', encoding='utf-8', newline='') as f:
        raw = f.read()
    
    content = raw.replace('\r\n', '\n')
    name = os.path.basename(os.path.dirname(filepath))
    changed = False

    # 1. Fix OIR1: add missing handleDocUpload if it references it but doesn't define it
    if 'handleDocUpload' not in content or 'const handleDocUpload' not in content:
        # Inject before the list view block
        list_view_marker = '  // \u2500\u2500 List view \u2500\u2500'
        form_view_marker = '  // \u2500\u2500 Form view \u2500\u2500'
        oir1_marker = '  const labelSt = {'
        
        if list_view_marker in content:
            content = content.replace(list_view_marker, DOC_HELPERS + list_view_marker)
            changed = True
            print(f"  [{name}] Injected helpers before list view")
        elif form_view_marker in content:
            content = content.replace(form_view_marker, DOC_HELPERS + form_view_marker)
            changed = True
            print(f"  [{name}] Injected helpers before form view")
        elif oir1_marker in content:
            content = content.replace(oir1_marker, DOC_HELPERS + oir1_marker)
            changed = True
            print(f"  [{name}] Injected helpers via labelSt")
        else:
            print(f"  [{name}] WARNING: Cannot find injection point!")
    else:
        print(f"  [{name}] handleDocUpload already present")

    # 2. Add openDoc function if missing
    if 'const openDoc' not in content:
        # Inject right after downloadDoc closing brace
        dl_end = "    a.click();\n  };"
        if dl_end in content:
            open_fn = """

  const openDoc = (docData, docName) => {
    if (!docData) return;
    const w = window.open();
    if (w) {
      w.document.write('<html><head><title>' + (docName || 'Dokument') + '</title></head><body style="margin:0"><iframe src="' + docData + '" style="width:100%;height:100vh;border:none"></iframe></body></html>');
      w.document.close();
    }
  };"""
            content = content.replace(dl_end, dl_end + open_fn)
            changed = True
            print(f"  [{name}] Added openDoc function")

    # 3. Replace old upload UI block with new one that has Open/Download/Remove buttons
    old_block = '{/* \u2550\u2550\u2550 Document Upload \u2550\u2550\u2550 */}'
    if old_block in content:
        # Find the full block from the comment to the closing </div>\n\n
        start = content.find(old_block)
        # Find the end of this card block - look for two newlines after the last </div>
        # The card ends with </div>\n        </div>\n        </div>\n\n
        end_pattern = '        </div>\n\n'
        end = content.find(end_pattern, start)
        if end != -1:
            end += len(end_pattern)
            content = content[:start] + UPLOAD_UI_NEW + content[end:]
            changed = True
            print(f"  [{name}] Replaced upload UI with new interactive version")
        else:
            print(f"  [{name}] WARNING: Could not find end of upload block")
    
    if changed:
        out = content.replace('\n', '\r\n') if '\r\n' in raw else content
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(out)
        print(f"[{name}] Patched!")
    else:
        print(f"[{name}] No changes")
