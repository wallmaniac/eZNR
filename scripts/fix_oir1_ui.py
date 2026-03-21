import os

filepath = r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-oir1\page.js'
with open(filepath, 'r', encoding='utf-8', errors='surrogateescape', newline='') as f:
    raw = f.read()

content = raw.replace('\r\n', '\n')
name = 'form-oir1'
changed = False

OPEN_FN = """

  const openDoc = (docData, docName) => {
    if (!docData) return;
    const w = window.open();
    if (w) {
      w.document.write('<html><head><title>' + (docName || 'Dokument') + '</title></head><body style="margin:0"><iframe src="' + docData + '" style="width:100%;height:100vh;border:none"></iframe></body></html>');
      w.document.close();
    }
  };"""

# 1. Add openDoc if missing
dl_end = "    a.click();\n  };"
if 'const openDoc' not in content and dl_end in content:
    content = content.replace(dl_end, dl_end + OPEN_FN, 1)
    changed = True
    print(f"  [{name}] Added openDoc")

# 2. Upgrade old attachment span to clickable button with Open/Download/Remove
OLD_SPAN = "                      <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>\U0001f4ce {formData.docName}</span>\n                      <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>\u2715 {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>"

NEW_BLOCK = "                      <button type=\"button\" onClick={() => openDoc(formData.docData, formData.docName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--info)', fontSize: '0.85rem', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>\U0001f4ce {formData.docName}</button>\n                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>\n                        <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={() => openDoc(formData.docData, formData.docName)} style={{ color: 'var(--info)' }}>\U0001f441 {lang === 'bs' ? 'Otvori' : 'Open'}</button>\n                        <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={() => downloadDoc({ docData: formData.docData, docName: formData.docName })} style={{ color: 'var(--primary)' }}>\u2193 {lang === 'bs' ? 'Preuzmi' : 'Download'}</button>\n                        <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ color: 'var(--danger)' }}>\u2715 {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>\n                      </div>"

if OLD_SPAN in content:
    content = content.replace(OLD_SPAN, NEW_BLOCK, 1)
    changed = True
    print(f"  [{name}] Upgraded attachment display UI")
else:
    print(f"  [{name}] Span not found - checking current state")
    idx = content.find('formData.docName ?')
    if idx != -1:
        print(content[idx:idx+500])

if changed:
    out = content.replace('\n', '\r\n') if '\r\n' in raw else content
    with open(filepath, 'w', encoding='utf-8', errors='surrogateescape', newline='') as f:
        f.write(out)
    print(f"[{name}] Done!")
else:
    print(f"[{name}] No changes")
