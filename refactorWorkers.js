const fs = require('fs');
const path = 'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/workers/page.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add SwipeRow import
if (!content.includes('SwipeRow')) {
    content = content.replace("import WorkerProfileModal from '@/components/WorkerProfileModal';", "import WorkerProfileModal from '@/components/WorkerProfileModal';\nimport SwipeRow from '@/components/mobile/SwipeRow';");
}


// 2. Add isMobile
if (!content.includes('const [isMobile')) {
    const hookStart = "const [openSections";
    content = content.replace(hookStart, `const [isMobile, setIsMobile] = useState(false);\n    useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);\n    const [openSections`);
}

// 3. Replace the table wrapper logic
const tableStart = '<div className="data-table-wrapper">\n                            <table className="data-table">';
const tableEnd = '                                </tbody>\n                            </table>\n                        </div>';

const mobileRender = `
                        {/* Mobile & Desktop Table logic */}
                        {isMobile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {pagedWorkers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</div>
                                ) : pagedWorkers.map((w) => {
                                    const _today = new Date();
                                    const _wC = allCerts.filter(cx => cx.workerId === w.id);
                                    const _wM = allMedExamsList.filter(mx => mx.workerId === w.id);
                                    const _expC = _wC.some(cx => cx.vrijediDo && new Date(cx.vrijediDo) < _today);
                                    const _soonC = _wC.some(cx => { if (!cx.vrijediDo) return false; const d = (new Date(cx.vrijediDo) - _today) / 86400000; return d >= 0 && d <= 30; });
                                    const _expM = _wM.some(mx => mx.vrijediDo && new Date(mx.vrijediDo) < _today);
                                    const _soonM = _wM.some(mx => { if (!mx.vrijediDo) return false; const d = (new Date(mx.vrijediDo) - _today) / 86400000; return d >= 0 && d <= 60; });

                                    let badgeCls = 'badge-success', badgeTxt = lang === 'bs' ? 'U redu' : 'Ok';
                                    if (_expC || _expM) { badgeCls = 'badge-danger'; badgeTxt = lang === 'bs' ? 'Isteklo!' : 'Expired!'; }
                                    else if (_soonC || _soonM) { badgeCls = 'badge-warning'; badgeTxt = lang === 'bs' ? 'Uskoro ističe' : 'Expiring soon'; }
                                    else if (_wC.length === 0) { badgeCls = ''; badgeTxt = lang === 'bs' ? 'Nema podataka' : 'No data'; }

                                    const initial = w.ime.charAt(0) + w.prezime.charAt(0);

                                    return (
                                        <SwipeRow
                                            key={w.id}
                                            isMobile={true}
                                            actions={[
                                                { label: bs ? 'Uredi' : 'Edit', icon: '✏️', color: 'var(--primary)', onClick: () => handleEdit(w) },
                                                { label: bs ? 'Obriši' : 'Delete', icon: '🗑️', color: 'var(--danger)', onClick: () => handleDelete(w.id) },
                                            ]}
                                        >
                                            <div onClick={() => setViewWorkerId(w.id)} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', position: 'relative', display: 'flex', gap: 14 }}>
                                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', flexShrink: 0 }}>
                                                    {initial}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
                                                            {w.ime} {w.prezime}
                                                        </div>
                                                        <span className={\`badge \${badgeCls}\`} style={{ fontSize: '0.65rem' }}>{badgeTxt}</span>
                                                    </div>
                                                    
                                                    {w.radnoMjestoId && (
                                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            💼 {getWorkplaceName(w.radnoMjestoId)}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                        🪪 OIB: {w.oib || w.jmbg}
                                                    </div>
                                                </div>
                                            </div>
                                        </SwipeRow>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="data-table-wrapper">
                                <table className="data-table">
`;

let s = content.indexOf(tableStart);
if (s > -1) {
    let e = content.indexOf(tableEnd, s) + tableEnd.length;
    let block = content.substring(s + tableStart.length, e - tableEnd.length);
    content = content.substring(0, s) + mobileRender + block + "                                </tbody>\n                            </table>\n                        </div>\n                        )}" + content.substring(e);
}

// Add FAB for mobile worker creation
const fabWorker = `
            {isMobile && !showForm && (
                <button
                    onClick={handleNew}
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
`;

content = content.replace("            {/* Worker Profile Modal */}\n            {\n                viewWorkerId", fabWorker + "            {/* Worker Profile Modal */}\n            {\n                viewWorkerId");

fs.writeFileSync(path, content);
console.log('Workers refactored');
