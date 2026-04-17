const fs = require('fs');

const path = 'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/fleet/page.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Import SwipeRow
if (!content.includes('SwipeRow')) {
    content = content.replace("import WorkerProfileModal from '@/components/WorkerProfileModal';", "import WorkerProfileModal from '@/components/WorkerProfileModal';\nimport SwipeRow from '@/components/mobile/SwipeRow';");
}

// 2. Add isMobile state
if (!content.includes('const [isMobile')) {
    const hookStart = "const { markDirty, markClean } = useUnsavedChanges();";
    const hookEnd = `const { markDirty, markClean } = useUnsavedChanges();\n\n    const [isMobile, setIsMobile] = useState(false);\n    useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);`;
    content = content.replace(hookStart, hookEnd);
}

// 3. Extract table HTML string boundary
const tableStart = '<div className="data-table-wrapper">';
const tableEnd = '</div>\n                    </div>\n                </div>\n            </div>';

const mobileRender = `
                        {isMobile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {sorted.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</div>
                                ) : sorted.map(v => {
                                    const st = STATUS_MAP[v.status] || STATUS_MAP.aktivan;
                                    return (
                                        <SwipeRow
                                            key={v.id}
                                            isMobile={true}
                                            actions={[
                                                { label: bs ? 'Uredi' : 'Edit', icon: '✏️', color: 'var(--primary)', onClick: () => openEdit(v) },
                                                { label: bs ? 'Kopiraj' : 'Copy', icon: '📋', color: 'var(--secondary)', onClick: () => { const copy = { ...v, registracija: '', napomena: '(Kopija)' }; delete copy.id; create(COLLECTIONS.VEHICLES, copy); loadData(); showFlash(); } },
                                                { label: bs ? 'Obriši' : 'Delete', icon: '🗑️', color: 'var(--danger)', onClick: () => handleDelete(v.id) },
                                            ]}
                                        >
                                            <div onClick={() => openEdit(v)} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', position: 'relative' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                    <div>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: 0.5, fontFamily: 'var(--font-heading)' }}>{v.registracija || '—'}</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{v.marka} {v.model}</div>
                                                    </div>
                                                    <div style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: st.bg, color: st.color }}>
                                                        {bs ? st.bs : st.en}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gap: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)', alignItems: 'center' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{bs ? 'Istek Reg.' : 'Reg.Exp.'}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatDate(v.registracijaIstice)}</span> {getExpiryBadge(v.registracijaIstice)}</div>
                                                    
                                                    <div style={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{bs ? 'Tehnički' : 'Inspect.'}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatDate(v.tehnickiIstice)}</span> {getExpiryBadge(v.tehnickiIstice)}</div>
                                                </div>
                                                {v.vozacIme && (
                                                    <div style={{ marginTop: 12, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ color: 'var(--primary)' }}>👤</span>
                                                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{v.vozacIme}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </SwipeRow>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="data-table-wrapper">
`;

const afterTable = `
                            </div>
                        )}
`;

const fabRender = `
            {isMobile && !showForm && (
                <button
                    onClick={openNew}
                    style={{
                        position: 'fixed', bottom: 82, right: 16, zIndex: 9000,
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'var(--primary)', color: 'white', border: 'none',
                        boxShadow: '0 4px 12px rgba(0,191,166,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.8rem', cursor: 'pointer'
                    }}
                >
                    +
                </button>
            )}
            {viewWorkerId && <WorkerProfileModal workerId={viewWorkerId} onClose={() => setViewWorkerId(null)} onSaved={() => setViewWorkerId(null)} />}
`;

const sIdx = content.indexOf(tableStart);
const eIdx = content.indexOf(tableEnd, sIdx);
if(sIdx > -1 && eIdx > -1) {
    const tableBlock = content.substring(sIdx + tableStart.length, eIdx);
    
    let injected = content.substring(0, sIdx) + mobileRender + tableBlock + afterTable + content.substring(eIdx + tableEnd.length);
    
    // add FAB
    injected = injected.replace("{viewWorkerId && <WorkerProfileModal workerId={viewWorkerId} onClose={() => setViewWorkerId(null)} onSaved={() => setViewWorkerId(null)} />}", fabRender);

    fs.writeFileSync(path, injected);
    console.log('Fleet refactored successfully');
} else {
    console.log('Could not find table block in Fleet');
}
