import os, re

# For each form page:
# 1. Add _workerName enrichment between filteredRecords and useSortedList
# 2. Make the Radnik <th> sortable

FILES = [
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\requests\page.js',
        'name': 'requests',
        'worker_field': 'workerId',
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro1\page.js',
        'name': 'form-ro1',
        'worker_field': 'workerId',
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro2\page.js',
        'name': 'form-ro2',
        'worker_field': 'workerId',
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\night-work\page.js',
        'name': 'night-work',
        'worker_field': 'workerId',
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\referral-ra1\page.js',
        'name': 'referral-ra1',
        'worker_field': 'workerId',
    },
]

ENRICH = """  const enrichedRecords = filteredRecords.map(r => ({
    ...r,
    _workerName: getWorkerName(r.workerId),
  }));
"""

for cfg in FILES:
    filepath = cfg['path']
    name = cfg['name']

    with open(filepath, 'r', encoding='utf-8', errors='surrogateescape', newline='') as f:
        raw = f.read()

    content = raw.replace('\r\n', '\n')
    changed = False

    # 1. Add enrichment + swap filteredRecords → enrichedRecords in useSortedList
    if '_workerName' not in content:
        # Find the useSortedList line and inject enrichment before it
        hook_pattern = "const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filteredRecords,"
        if hook_pattern in content:
            content = content.replace(
                hook_pattern,
                ENRICH + "  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(enrichedRecords,",
                1
            )
            changed = True
            print(f'  [{name}] Added _workerName enrichment')
        else:
            print(f'  [{name}] WARNING: could not find useSortedList(filteredRecords,...)')

    # 2. Make Radnik <th> sortable
    old_th = "<th>{lang === 'bs' ? 'Radnik' : 'Worker'}</th>"
    new_th = "<th onClick={() => toggleSort('_workerName')} style={thStyle('_workerName')}>{lang === 'bs' ? 'Radnik' : 'Worker'}{sortIcon('_workerName')}</th>"
    if old_th in content and new_th not in content:
        content = content.replace(old_th, new_th, 1)
        changed = True
        print(f'  [{name}] Made Radnik th sortable')
    elif new_th in content:
        print(f'  [{name}] Radnik th already sortable')
    else:
        print(f'  [{name}] WARNING: Radnik th not found')

    if changed:
        out = content.replace('\n', '\r\n') if '\r\n' in raw else content
        with open(filepath, 'w', encoding='utf-8', errors='surrogateescape', newline='') as f:
            f.write(out)
        print(f'[{name}] Done!')
    else:
        print(f'[{name}] No changes needed')
