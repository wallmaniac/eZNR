"""
Adds a × close button to modal windows across the eZNR app.
Targets the specific pattern: a modal content div with a title (h2/h3/div with font weight)
but no close button. Inserts the × button just after the opening modal content div.

Strategy: Find the modal inner div (the white card, not the backdrop) and insert
a positioned × button right after it opens.
"""
import re, os

# ── Shared close button HTML to inject ──────────────────────────────────────────
CLOSE_BTN = """<button
                            onClick={() => %CLOSE_CALL%}
                            style={{
                                position: 'absolute', top: 14, right: 14,
                                background: 'none', border: 'none', fontSize: '1.1rem',
                                cursor: 'pointer', color: 'var(--text-muted)',
                                lineHeight: 1, padding: '4px 6px', borderRadius: 6,
                            }}
                            title="Zatvori"
                        >✕</button>"""

# ── Per-file patches ─────────────────────────────────────────────────────────────
# Each patch: (file_path, search_string, replacement_string)
BASE = r"src\app\dashboard"

patches = [
    # ────────────────────────────────────────────────────────────────────────────
    # sistematizacija/page.js — modal header div missing ×
    # ────────────────────────────────────────────────────────────────────────────
    (
        BASE + r"\sistematizacija\page.js",
        """            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, width: '90%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
                            📑 Sistematizacija — {workplaces.find(w => w.id === editData.radnoMjestoId)?.naziv || ''}
                        </div>""",
        """            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, width: '90%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)', position: 'relative' }}>
                        <button onClick={() => setEditData(null)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: '4px 6px', borderRadius: 6 }} title="Zatvori">✕</button>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
                            📑 Sistematizacija — {workplaces.find(w => w.id === editData.radnoMjestoId)?.naziv || ''}
                        </div>""",
    ),
]

for fpath, search, replace in patches:
    if not os.path.exists(fpath):
        print(f"FILE NOT FOUND: {fpath}")
        continue
    with open(fpath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    if search in content:
        content = content.replace(search, replace, 1)
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"PATCHED: {fpath}")
    elif replace in content:
        print(f"ALREADY DONE: {fpath}")
    else:
        print(f"PATTERN NOT FOUND: {fpath}")
        print(f"  Looking for: {repr(search[:80])}")

print("Done.")
