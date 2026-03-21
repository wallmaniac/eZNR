import os

filepath = r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-oir1\page.js'
with open(filepath, 'r', encoding='utf-8', errors='surrogateescape', newline='') as f:
    raw = f.read()

name = 'form-oir1'
content = raw.replace('\r\n', '\n')
changed = False

# 1. Already has docName/docData, useRef, docInputRef from before
# Need to add: handleDocUpload, downloadDoc, openDoc

HELPERS = """
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

  const openDoc = (docData, docName) => {
    if (!docData) return;
    const w = window.open();
    if (w) {
      w.document.write('<html><head><title>' + (docName || 'Dokument') + '</title></head><body style="margin:0"><iframe src="' + docData + '" style="width:100%;height:100vh;border:none"></iframe></body></html>');
      w.document.close();
    }
  };

"""

# Find the labelSt constant to inject before
inject_anchor = '  const labelSt = {'
if 'handleDocUpload' not in content and inject_anchor in content:
    content = content.replace(inject_anchor, HELPERS + inject_anchor, 1)
    changed = True
    print(f"  [{name}] Injected all 3 helper functions")

# 2. Upgrade old attachment display to new with Open/Download/Remove
OLD_SPAN = "                      <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>\U0001f4ce {formData.docName}</span>\n                      <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>\u2715 {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>"

NEW_BLOCK = "                      <button type=\"button\" onClick={() => openDoc(formData.docData, formData.docName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--info)', fontSize: '0.85rem', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>\U0001f4ce {formData.docName}</button>\n                      <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>\n                        <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={() => openDoc(formData.docData, formData.docName)} style={{ color: 'var(--info)' }}>\U0001f441 {lang === 'bs' ? 'Otvori' : 'Open'}</button>\n                        <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={() => downloadDoc({ docData: formData.docData, docName: formData.docName })} style={{ color: 'var(--primary)' }}>\u2193 {lang === 'bs' ? 'Preuzmi' : 'Download'}</button>\n                        <button type=\"button\" className=\"btn btn-ghost btn-sm\" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ color: 'var(--danger)' }}>\u2715 {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>\n                      </div>"

if OLD_SPAN in content:
    content = content.replace(OLD_SPAN, NEW_BLOCK, 1)
    changed = True
    print(f"  [{name}] Upgraded attachment UI")

if changed:
    out = content.replace('\n', '\r\n') if '\r\n' in raw else content
    with open(filepath, 'w', encoding='utf-8', errors='surrogateescape', newline='') as f:
        f.write(out)
    print(f"[{name}] Done!")
else:
    print(f"[{name}] No changes (already up to date or anchors missing)")
    # Show what's around handleDocUpload
    idx = content.find('handleDocUpload')
    if idx >= 0:
        print("  handleDocUpload found at:", idx)
    else:
        print("  handleDocUpload NOT FOUND")
