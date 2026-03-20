import os

# All 6 forms to patch
files = {
    'requests': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\requests\page.js',
        'empty_obj': 'EMPTY_ZAHTJEVNICA',
        'collection': 'COLLECTIONS.REQUESTS',
        'inject_before': '  const labelSt =',
        'action_dropdown_anchor': "onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📝</span> {lang === 'bs' ? 'Otvori' : 'Open'}\n                            </button>",
        'tr_anchor': "<tr key={r.id}>",
    },
    'form-ro1': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro1\page.js',
        'empty_obj': 'EMPTY_RO1',
        'collection': 'COLLECTIONS.FORMS_RO1',
        'inject_before': '  const labelSt =',
        'action_dropdown_anchor': None,  # Will search dynamically
        'tr_anchor': "<tr key={r.id}",
    },
    'form-ro2': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro2\page.js',
        'empty_obj': 'EMPTY_RO2',
        'collection': 'COLLECTIONS.FORMS_RO2',
        'inject_before': '  const labelSt =',
        'action_dropdown_anchor': None,
        'tr_anchor': "<tr key={r.id}",
    },
    'night-work': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\night-work\page.js',
        'empty_obj': 'EMPTY_NR1',
        'collection': 'COLLECTIONS.NIGHT_WORK',
        'inject_before': '  const labelSt =',
        'action_dropdown_anchor': None,
        'tr_anchor': "<tr key={r.id}",
    },
    'form-oir1': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-oir1\page.js',
        'empty_obj': 'EMPTY_OIR1',
        'collection': 'COLLECTIONS.FORMS_OIR1',
        'inject_before': None,  # already done
        'action_dropdown_anchor': None,
        'tr_anchor': "<tr key={r.id}",
    },
    'referral-ra1': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\referral-ra1\page.js',
        'empty_obj': 'EMPTY_RA1',
        'collection': 'COLLECTIONS.REFERRALS_RA1',
        'inject_before': '  const Chk =',
        'action_dropdown_anchor': "onClick={e => { e.stopPropagation(); setActionMenuId(null); handleEdit(r); }}>✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>",
        'tr_anchor': "<tr key={r.id}",
    },
}

DOC_HELPERS = """
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

UPLOAD_UI = """        {/* ═══ Document Upload ═══ */}
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

for name, info in files.items():
    filepath = info['path']
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # 1. Add docName/docData to EMPTY_ object if missing
    if "docName: ''," not in content:
        # Find the closing brace of the empty object
        empty_obj = info['empty_obj']
        # Find a trailing field before }; to inject after
        # We can just look for };\n\nexport default to find the end of the constant block
        # and insert before the first export default
        export_idx = content.find(f'\nexport default function')
        # Find the last }; before export
        const_end = content.rfind('\n};', 0, export_idx)
        if const_end != -1:
            content = content[:const_end] + "\n  docName: '',\n  docData: ''," + content[const_end:]
            changed = True
            print(f"  [{name}] Added docName/docData to empty object")

    # 2. Add useRef import if missing
    if 'useRef' not in content:
        content = content.replace(
            "import {  useState, useEffect, useCallback  } from 'react';",
            "import {  useState, useEffect, useCallback, useRef  } from 'react';"
        )
        changed = True
        print(f"  [{name}] Added useRef import")

    # 3. Add docInputRef if missing
    if 'docInputRef = useRef' not in content:
        empty_obj = info['empty_obj']
        ref_src = f"const [formData, setFormData] = useState({{ ...{empty_obj} }});"
        if ref_src in content:
            content = content.replace(ref_src, ref_src + "\n  const docInputRef = useRef(null);")
            changed = True
            print(f"  [{name}] Added docInputRef")

    # 4. Add helper functions if missing
    if 'handleDocUpload' not in content:
        inject_before = info.get('inject_before')
        if inject_before and inject_before in content:
            content = content.replace(inject_before, DOC_HELPERS + inject_before)
            changed = True
            print(f"  [{name}] Added handleDocUpload/downloadDoc helpers")
        else:
            print(f"  [{name}] WARNING: Could not find inject_before anchor: {inject_before}")

    # 5. Add upload UI block if missing
    if '{/* ═══ Document Upload ═══ */}' not in content:
        action_anchor = '        {/* ═══ Action buttons ═══ */}'
        if action_anchor in content:
            content = content.replace(action_anchor, UPLOAD_UI + action_anchor)
            changed = True
            print(f"  [{name}] Added upload UI block")
        else:
            print(f"  [{name}] WARNING: Could not find action buttons anchor")

    # 6. Add Preuzmi prilog to action dropdown if missing
    if 'Preuzmi prilog' not in content:
        # Find the "Otvori" button in the action dropdown and add download after it
        # Different pages have different patterns for the Otvori button
        otvori_markers = [
            "? 'Otvori' : 'Open'}\n                            </button>",
            "? 'Otvori' : 'Open'}</button>",
        ]
        DL_BTN = "\n                            {r.docData && (\n                              <button className=\"dropdown-item\" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); downloadDoc(r); }}><span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📎</span> {lang === 'bs' ? 'Preuzmi prilog' : 'Download file'}</button>\n                            )}"
        
        for marker in otvori_markers:
            if marker in content:
                content = content.replace(marker, marker + DL_BTN, 1)
                changed = True
                print(f"  [{name}] Added download button to dropdown")
                break
        else:
            print(f"  [{name}] WARNING: Could not find Otvori button for download injection")

    # 7. Make rows clickable (add onClick to <tr key={r.id}>)
    tr_anchor = info.get('tr_anchor', "<tr key={r.id}>")
    if 'onClick={() => handleEdit(r)}' not in content and tr_anchor in content:
        # Find <tr key={r.id}> or <tr key={r.id} and add onClick
        old_tr = "<tr key={r.id}>"
        new_tr = "<tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)}>"
        if old_tr in content:
            content = content.replace(old_tr, new_tr, 1)
            changed = True
            print(f"  [{name}] Made rows clickable")
        else:
            # Try other formats - look for the first occurrence in tbody
            print(f"  [{name}] WARNING: Could not find standard <tr key={{r.id}}> for click handler")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    if changed:
        print(f"[{name}] Patched!")
    else:
        print(f"[{name}] No changes needed")
