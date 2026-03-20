import os, re

files = {
    'requests': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\requests\page.js',
        'empty_obj': 'EMPTY_ZAHTJEVNICA',
        'inject_before': r'  const labelSt = \{',
    },
    'form-ro1': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro1\page.js',
        'empty_obj': 'EMPTY_RO1',
        'inject_before': r'  const labelSt = \{',
    },
    'form-ro2': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro2\page.js',
        'empty_obj': 'EMPTY_RO2',
        'inject_before': r'  const labelSt = \{',
    },
    'night-work': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\night-work\page.js',
        'empty_obj': 'EMPTY_NR1',
        'inject_before': r'  const labelSt = \{',
    },
    'form-oir1': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-oir1\page.js',
        'empty_obj': 'EMPTY_OIR1',
        'inject_before': None,  # already done
    },
    'referral-ra1': {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\referral-ra1\page.js',
        'empty_obj': 'EMPTY_RA1',
        'inject_before': None,  # already done
    },
}

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

"""

for name, info in files.items():
    filepath = info['path']
    # Read with universal newlines - Python converts \r\n to \n
    with open(filepath, 'r', encoding='utf-8', newline='') as f:
        raw = f.read()
    
    # Normalize line endings
    content = raw.replace('\r\n', '\n')
    changed = False

    # 3. Add helper functions if missing
    inject_before_re = info.get('inject_before')
    if 'handleDocUpload' not in content and inject_before_re:
        m = re.search(inject_before_re, content)
        if m:
            insert_pos = m.start()
            content = content[:insert_pos] + DOC_HELPERS + content[insert_pos:]
            changed = True
            print(f"  [{name}] Added handleDocUpload/downloadDoc helpers")
        else:
            print(f"  [{name}] WARNING: Could not find inject_before regex: {inject_before_re}")
    elif 'handleDocUpload' in content:
        print(f"  [{name}] handleDocUpload already present")

    # 4. Make rows clickable - look for <tr key={r.id}> pattern (without style) and add onClick
    if "onClick={() => handleEdit(r)}" not in content:
        # Match tr with key and no style yet
        patterns_to_try = [
            ('<tr key={r.id}>', '<tr key={r.id} style={{ cursor: \'pointer\' }} onClick={() => handleEdit(r)}>'),
            ('<tr key={r.id} onMouseEnter', '<tr key={r.id} style={{ cursor: \'pointer\' }} onClick={() => handleEdit(r)} onMouseEnter'),
        ]
        for old, new in patterns_to_try:
            if old in content:
                content = content.replace(old, new, 1)
                changed = True
                print(f"  [{name}] Made rows clickable")
                break
        else:
            print(f"  [{name}] WARNING: No clickable row pattern found")

    # Write back preserving original CRLF if it was present
    if changed:
        # Write back with original line endings
        out = content.replace('\n', '\r\n') if '\r\n' in raw else content
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(out)
        print(f"[{name}] Patched!")
    else:
        print(f"[{name}] No changes needed")
