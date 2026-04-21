import fs from 'fs';

// ─── 1. FIX: Vrati zadane postavke buttons — make both match with ↺ symbol ───
let settings = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// Fix the top "Vrati zadane postavke" button to match the PDF one (add ↺ symbol)
settings = settings.replace(
  `>{lang === 'bs' ? 'Vrati zadane postavke' : 'Reset to Defaults'}</button>`,
  `>↺ {lang === 'bs' ? 'Vrati zadane postavke' : 'Reset to Defaults'}</button>`
);

// Fix the PDF "Vrati zadane" button style to match the top one
settings = settings.replace(
  `style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>↺ {lang === 'bs' ? 'Vrati zadane' : 'Reset'}</button>`,
  `style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>↺ {lang === 'bs' ? 'Vrati zadane postavke' : 'Reset to Defaults'}</button>`
);

// ─── 2. FIX SVG icons — use proper viewBox scaling to center inside frame ───
// The icons render at 18x18 inside a 34x34 padded container. The issue is the SVG
// coordinate space needs to match. Let me use proper centered icons.

// App Branding icon (monitor)
settings = settings.replace(
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`
);

// PDF Branding icon (document) 
settings = settings.replace(
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
);

// Also fix the icon container padding to center better
settings = settings.replaceAll(
  `padding: 8, background: 'var(--bg-input)', borderRadius: 10, border: '1px solid var(--border)'`,
  `padding: 10, background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center'`
);

fs.writeFileSync('src/app/dashboard/settings/page.js', settings);
console.log('✅ settings/page.js — buttons + SVGs fixed');


// ─── 3. FIX: Worker name click in referral-ra1 navigates to /workers incorrectly ───
// The issue: router.push('/dashboard/workers?openWorker=...') replaces history.
// When user clicks Back, they go to the page BEFORE referral-ra1.
// Fix: The real issue is the Workers page. When it receives ?openWorker=X, it opens
// a modal/panel. When the user closes that and clicks Back, they should go to referral.
// But the Workers page doesn't handle this correctly — it probably resets the URL.
// The actual cleanest fix is: don't navigate to /dashboard/workers. Instead, open
// in a new tab or use a different approach. But the simplest UX fix is to NOT
// push to workers — use window.open in a new tab for cross-module worker links.
// Actually, the real fix is simpler: the Back button goes to the previous page in history.
// router.push creates a new history entry. So Back SHOULD go to referral-ra1.
// The problem might be that the Workers page itself does a router.replace or
// manipulates history when it processes the ?openWorker query param.

// Let me check the Workers page for history manipulation:
let workers = fs.readFileSync('src/app/dashboard/workers/page.js', 'utf8');
const replaceMatch = workers.match(/router\.replace/g);
console.log('Workers page router.replace count:', replaceMatch?.length || 0);

// Check for history manipulation in workers
const histMatch = workers.match(/window\.history/g);
console.log('Workers page window.history count:', histMatch?.length || 0);

// Now let's find the openWorker handling
const openWorkerLines = workers.split('\n').filter((l, i) => l.includes('openWorker')).map(l => l.trim().substring(0, 120));
console.log('openWorker related lines:', openWorkerLines);

console.log('\n🎉 Patches applied!');
