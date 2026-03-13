---
description: Standard pattern for Akcije (Actions) dropdown menus in eZNR — portal-based, viewport-aware, toggle-on-click
---

# eZNR Akcije Dropdown Standard

## Why This Matters

Any action button group in eZNR **must** use this pattern. Do NOT use:
- Vertical columns of icon-only buttons (❌ no labels, inaccessible)
- `position: absolute` dropdowns (❌ clipped by table overflow or CSS transforms)
- Inline `position: fixed` without portal (❌ broken by accordion/animation CSS transforms)

## The Standard Pattern

### 1 — Imports (once per file)
```jsx
import { createPortal } from 'react-dom';
```

### 2 — State (once per component)
```jsx
const [menuId, setMenuId] = useState(null);      // which row has open menu
const [menuPos, setMenuPos] = useState({ top: 0, left: 0 }); // fixed coords
const menuRef = useRef(null);
```

### 3 — Outside-click handler (in useEffect)
```jsx
useEffect(() => {
    const handleClick = (e) => {
        // IMPORTANT: use mousedown, not click
        if (menuRef.current && !menuRef.current.contains(e.target)) {
            setMenuId(null);
        }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
}, []);
```

### 4 — Button trigger (per row)
```jsx
<button
    className="btn btn-outline btn-sm"
    style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
    onClick={(e) => {
        e.stopPropagation(); // prevent row-click from firing
        if (menuId === item.id) { setMenuId(null); return; } // TOGGLE CLOSE
        const rect = e.currentTarget.getBoundingClientRect();
        const menuW = 230;
        // Always open BELOW, clamp so it doesn't exit right edge
        const left = Math.min(rect.left, window.innerWidth - menuW - 8);
        const top = rect.bottom + 4;
        setMenuPos({ top, left });
        setMenuId(item.id);
    }}
>
    ⚙️ {lang === 'bs' ? 'Akcije' : 'Actions'} ▾
</button>
```

### 5 — Portal dropdown (per row, renders to document.body)
```jsx
{menuId === item.id && typeof document !== 'undefined' && createPortal(
    <div ref={menuRef} style={{
        position: 'fixed',
        top: menuPos.top,
        left: menuPos.left,
        zIndex: 99999,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        minWidth: 230,
        padding: '4px 0',
    }}>
        {/* Each item: icon + text, full width */}
        <button className="btn btn-ghost" style={{
            width: '100%', textAlign: 'left', padding: '8px 14px',
            fontSize: '0.84rem', borderRadius: 0,
            display: 'flex', alignItems: 'center', gap: 8,
        }} onClick={() => { setMenuId(null); /* action */ }}>
            ✏️ <span>{lang === 'bs' ? 'Uredi' : 'Edit'}</span>
        </button>

        {/* Separator before destructive actions */}
        <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />

        {/* Destructive action — red text */}
        <button className="btn btn-ghost" style={{
            width: '100%', textAlign: 'left', padding: '8px 14px',
            fontSize: '0.84rem', borderRadius: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'var(--danger)',
        }} onClick={async () => { setMenuId(null); /* confirm + delete */ }}>
            🗑️ <span>{lang === 'bs' ? 'Obriši' : 'Delete'}</span>
        </button>
    </div>,
    document.body
)}
```

## TOGGLE Bug — CRITICAL
The toggle close (`if (menuId === item.id) { setMenuId(null); return; }`) works ONLY if
the outside-click `mousedown` handler does NOT run first and clear `menuId` before the `click` fires.

To prevent this: use `menuRef.contains(e.target)` check. The Akcije button is NOT inside `menuRef`
(which wraps only the popup div), so the mousedown handler WILL clear `menuId` when clicking the
button a second time. Fix: store a "closing" flag, or use `onMouseDown` on the button to mark
the close intent BEFORE the mousedown handler runs:

```jsx
// Better toggle pattern that survives mousedown-before-click ordering:
const closingRef = useRef(false);

// In outside-click handler:
if (menuRef.current && !menuRef.current.contains(e.target)) {
    closingRef.current = (menuId !== null); // was open = closing
    setMenuId(null);
}

// Button onClick:
onClick={(e) => {
    e.stopPropagation();
    if (closingRef.current) { closingRef.current = false; return; } // was just closed by mousedown
    if (menuId === item.id) { setMenuId(null); return; }
    // ... open
}}
```

## Back Navigation Standard

Any page that can be opened from another page MUST support `returnTo` URL parameter:

### Reading returnTo:
```jsx
const searchParams = useSearchParams();
const returnTo = searchParams?.get('returnTo');
```

### Back/Cancel buttons:
```jsx
const handleBack = () => {
    if (returnTo) router.push(returnTo);
    else router.back();
};
```

### The header ← Nazad button
The header `router.back()` is a GLOBAL back arrow and cannot know about `returnTo`.
Pages that need controlled back navigation should show their own ← back button
at the top of their content area, used INSTEAD of the header button, and make the
header's Nazad less prominent or hidden for those pages.

Alternatively, pass the returnTo URL so that going back works via router history,
not the returnTo param — i.e., after `router.push(page?returnTo=...)` the
browser history has the correct previous entry so `router.back()` goes right.

## App-Wide Akcije Audit (places that need this pattern)

| Page | Current state | Action needed |
|------|--------------|---------------|
| workers/page.js — certs table | ✅ Done (portal) | — |
| workers/page.js — PPE table | ❌ icon buttons | Convert to Akcije dropdown |
| workers/page.js — workers list | Has action menu (actionMenuId) | Check if portal-based |
| equipment/page.js | Likely icon buttons | Audit and convert |
| incidents/page.js | Likely icon buttons | Audit and convert |
| training results | Likely icon buttons | Audit and convert |
