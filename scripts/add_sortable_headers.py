import os, re

# Make table headers in the LIST VIEW clickable for sorting
# Each file has different columns - we'll update the known sortable ones

configs = [
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\requests\page.js',
        'name': 'requests',
        'replacements': [
            # Datum header
            ("<th>{lang === 'bs' ? 'Datum' : 'Date'}</th>",
             "<th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>"),
            # Zahtjevnica broj
            ("<th>{lang === 'bs' ? 'Zahtjevnica' : 'Request No.'}</th>",
             "<th onClick={() => toggleSort('zahtjevnicaBroj')} style={thStyle('zahtjevnicaBroj')}>{lang === 'bs' ? 'Zahtjevnica' : 'Request No.'}{sortIcon('zahtjevnicaBroj')}</th>"),
        ]
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-oir1\page.js',
        'name': 'form-oir1',
        'replacements': [
            ("<th>{lang === 'bs' ? 'Datum događaja' : 'Event date'}</th>",
             "<th onClick={() => toggleSort('datumDogadjaja')} style={thStyle('datumDogadjaja')}>{lang === 'bs' ? 'Datum događaja' : 'Event date'}{sortIcon('datumDogadjaja')}</th>"),
            ("<th>{lang === 'bs' ? 'Datum prijave' : 'Submit date'}</th>",
             "<th onClick={() => toggleSort('datumPrijave')} style={thStyle('datumPrijave')}>{lang === 'bs' ? 'Datum prijave' : 'Submit date'}{sortIcon('datumPrijave')}</th>"),
            ("<th>{lang === 'bs' ? 'Događaj nastao u' : 'Event location'}</th>",
             "<th onClick={() => toggleSort('dogadjajNastaoU')} style={thStyle('dogadjajNastaoU')}>{lang === 'bs' ? 'Događaj nastao u' : 'Event location'}{sortIcon('dogadjajNastaoU')}</th>"),
        ]
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro1\page.js',
        'name': 'form-ro1',
        'replacements': [
            ("<th>{lang === 'bs' ? 'Datum' : 'Date'}</th>",
             "<th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>"),
            ("<th>{lang === 'bs' ? 'Br.' : 'No.'}</th>",
             "<th onClick={() => toggleSort('broj')} style={thStyle('broj')}>{lang === 'bs' ? 'Br.' : 'No.'}{sortIcon('broj')}</th>"),
        ]
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro2\page.js',
        'name': 'form-ro2',
        'replacements': [
            ("<th>{lang === 'bs' ? 'Datum' : 'Date'}</th>",
             "<th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>"),
        ]
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\night-work\page.js',
        'name': 'night-work',
        'replacements': [
            ("<th>{lang === 'bs' ? 'Datum' : 'Date'}</th>",
             "<th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>"),
        ]
    },
    {
        'path': r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\referral-ra1\page.js',
        'name': 'referral-ra1',
        'replacements': [
            ("<th>{lang === 'bs' ? 'Datum' : 'Date'}</th>",
             "<th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('datum')}</th>"),
        ]
    },
]

for cfg in configs:
    filepath = cfg['path']
    name = cfg['name']

    with open(filepath, 'r', encoding='utf-8', errors='surrogateescape', newline='') as f:
        raw = f.read()

    content = raw.replace('\r\n', '\n')
    changed = False

    for old, new in cfg['replacements']:
        if old in content and new not in content:
            content = content.replace(old, new, 1)
            changed = True
            print(f'  [{name}] Made th sortable: {old[:50]}...')
        elif new in content:
            print(f'  [{name}] Already sortable: {old[:40]}')
        else:
            print(f'  [{name}] WARNING: header not found: {old[:60]}')

    if changed:
        out = content.replace('\n', '\r\n') if '\r\n' in raw else content
        with open(filepath, 'w', encoding='utf-8', errors='surrogateescape', newline='') as f:
            f.write(out)
        print(f'[{name}] Done!')
    else:
        print(f'[{name}] No changes needed')
