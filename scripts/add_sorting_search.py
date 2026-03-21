import os, re

# Config: each file and the fields to sort by (+ search field name in the record)
FILES = [
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\requests\page.js',
        'name': 'requests',
        'default_sort': 'datum',
        'search_fields': ['zahtjevnicaBroj', 'napomena'],  # fields to search in
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-oir1\page.js',
        'name': 'form-oir1',
        'default_sort': 'datumDogadjaja',
        'search_fields': ['dogadjajNastaoU', 'podnositelj'],
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro1\page.js',
        'name': 'form-ro1',
        'default_sort': 'datum',
        'search_fields': ['broj', 'kratakOpisPoslova'],
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro2\page.js',
        'name': 'form-ro2',
        'default_sort': 'datum',
        'search_fields': ['broj'],
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\night-work\page.js',
        'name': 'night-work',
        'default_sort': 'datum',
        'search_fields': ['broj'],
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\referral-ra1\page.js',
        'name': 'referral-ra1',
        'default_sort': 'datum',
        'search_fields': ['broj'],
    },
]

for cfg in FILES:
    filepath = cfg['path']
    name = cfg['name']
    default_sort = cfg['default_sort']
    search_fields = cfg['search_fields']

    with open(filepath, 'r', encoding='utf-8', errors='surrogateescape', newline='') as f:
        raw = f.read()

    content = raw.replace('\r\n', '\n')
    changed = False

    # 1. Add useSortedList import
    if 'useSortedList' not in content:
        # Find the useDialog import line and add after it
        old_import = "import { useDialog } from '@/hooks/useDialog';"
        new_import = "import { useDialog } from '@/hooks/useDialog';\nimport { useSortedList } from '@/hooks/useSortedList';"
        if old_import in content:
            content = content.replace(old_import, new_import, 1)
            changed = True
            print(f'  [{name}] Added useSortedList import')
        else:
            print(f'  [{name}] WARNING: could not find useDialog import')

    # 2. Add search state after existing useState declarations
    if "const [search, setSearch] = useState('');" not in content:
        # Find the [formData, setFormData] line to inject search state after
        form_data_state = "const [formData, setFormData] = useState("
        if form_data_state in content:
            insert_idx = content.find(form_data_state)
            # find end of this line
            end_of_line = content.find('\n', insert_idx)
            inject = "\n  const [search, setSearch] = useState('');"
            content = content[:end_of_line] + inject + content[end_of_line:]
            changed = True
            print(f'  [{name}] Added search state')

    # 3. Add useSortedList hook call after loadData useEffect
    if 'useSortedList' not in content or '{ sorted' not in content:
        # Build search filter expression
        search_filter_parts = ' || '.join([
            f"r.{f}?.toLowerCase().includes(search.toLowerCase())" 
            for f in search_fields
        ])
        hook_call = f"""
  const filteredRecords = search
    ? records.filter(r => {search_filter_parts})
    : records;
  const {{ sorted, toggleSort, sortIcon, thStyle }} = useSortedList(filteredRecords, '{default_sort}');
"""
        # Inject after: useEffect(() => { loadData(); }, [loadData]);
        effect_line = "useEffect(() => { loadData(); }, [loadData]);"
        if effect_line in content:
            inject_pos = content.find(effect_line) + len(effect_line)
            content = content[:inject_pos] + hook_call + content[inject_pos:]
            changed = True
            print(f'  [{name}] Added filteredRecords + useSortedList hook')

    # 4. Replace `records.length === 0` in tbody with `sorted.length === 0`
    # And `records.map(` with `sorted.map(`
    # But be careful - only inside the list view tbody, not elsewhere
    if 'sorted.map(' not in content:
        # These are in the list view tbody - replace records.map with sorted.map
        # and records.length === 0 with sorted.length === 0
        content = content.replace(
            'records.length === 0 ? (\n                    <tr><td colSpan',
            'sorted.length === 0 ? (\n                    <tr><td colSpan',
            1
        )
        # Also try the OIR1-style formatting with larger indent
        content = content.replace(
            'records.length === 0 ? (\n                  <tr><td colSpan',
            'sorted.length === 0 ? (\n                  <tr><td colSpan',
            1
        )
        # Replace the map call (first occurrence in list view)
        # The pattern is `) : records.map((r, idx) =>` or `) : records.map((r) =>`
        content = re.sub(
            r'\) : records\.map\(\(r(?:, idx)?\) => \(',
            ') : sorted.map((r, idx) => (',
            content,
            count=1
        )
        changed = True
        print(f'  [{name}] Switched to sorted.map()')

    # 5. Add search bar to the toolbar card
    if 'setSearch(' not in content:
        # Find the toolbar card body - look for the "+ Nova" button pattern in list view
        # The toolbar ends right after "zapisa" count or similar
        # We'll inject a search bar right before the closing </div> of the toolbar card-body
        search_bar = """
            <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
              <input
                placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
              />
              {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>✕</button>}
            </div>"""

        # Find the toolbar - look for "zapisa" text in the counts
        # Different pages use different structures - use a flexible approach
        # Look for the closing div of the toolbar card-body before the table card
        toolbar_patterns = [
            # Standard pattern with "zapisa" count
            "records.length} {lang === 'bs' ? 'zapisa' : 'records'}\n            </span>\n          </div>\n        </div>",
        ]
        injected = False
        for pat in toolbar_patterns:
            if pat in content:
                content = content.replace(
                    pat,
                    pat.replace(
                        "\n          </div>\n        </div>",
                        search_bar + "\n          </div>\n        </div>"
                    ),
                    1
                )
                changed = True
                injected = True
                print(f'  [{name}] Injected search bar (pattern 1)')
                break

        if not injected:
            # Try variation with different whitespace
            idx = content.find("'zapisa' : 'records'}")
            if idx != -1:
                # Find the closing divs after this
                end = content.find("</div>\n        </div>", idx)
                if end != -1:
                    end += len("</div>")
                    content = content[:end] + search_bar + content[end:]
                    changed = True
                    print(f'  [{name}] Injected search bar (flexible pattern)')
                else:
                    print(f'  [{name}] WARNING: could not find toolbar end for search bar')
            else:
                print(f'  [{name}] WARNING: no "zapisa" pattern found')

    if changed:
        out = content.replace('\n', '\r\n') if '\r\n' in raw else content
        with open(filepath, 'w', encoding='utf-8', errors='surrogateescape', newline='') as f:
            f.write(out)
        print(f'[{name}] Patched!')
    else:
        print(f'[{name}] Already up to date')
