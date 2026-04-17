const fs = require('fs');

async function refactorEqPpe() {
    // 1. Equipment
    const eqPath = 'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/equipment/page.js';
    let eqC = fs.readFileSync(eqPath, 'utf8');
    if (!eqC.includes('SwipeRow')) {
        eqC = eqC.replace("import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';", "import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';\nimport SwipeRow from '@/components/mobile/SwipeRow';");
        eqC = eqC.replace("const { markDirty, markClean } = useUnsavedChanges();", "const { markDirty, markClean } = useUnsavedChanges();\n    const [isMobile, setIsMobile] = useState(false);\n    useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);");
        
        const eqTableStart = '<div className="data-table-wrapper">\n                            <table className="data-table">';
        const eqTableEnd = '                                </tbody>\n                            </table>\n                        </div>';
        
        const mobileEq = `                        {isMobile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {sorted.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</div>
                                ) : sorted.map(e => {
                                    const assignedWorker = workers.find(w => w.id === e.zaduzenoNaRadnika);
                                    let wkName = ''; if(assignedWorker) wkName = assignedWorker.ime + ' ' + assignedWorker.prezime;
                                    return (
                                        <SwipeRow
                                            key={e.id}
                                            isMobile={true}
                                            actions={[
                                                { label: bs ? 'Uredi' : 'Edit', icon: '✏️', color: 'var(--primary)', onClick: () => handleRowClick(e) },
                                                { label: bs ? 'Kopiraj' : 'Copy', icon: '📋', color: 'var(--secondary)', onClick: () => { const copy = { ...e, oznaka: e.oznaka + '-COPY', napomena: '(Kopija)' }; delete copy.id; create(COLLECTIONS.EQUIPMENT, copy); loadData(); showFlash(); } },
                                                { label: bs ? 'Obriši' : 'Delete', icon: '🗑️', color: 'var(--danger)', onClick: () => handleDelete(e.id) },
                                            ]}
                                        >
                                            <div onClick={() => handleRowClick(e)} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', position: 'relative' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                    <div>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: 0.5, fontFamily: 'var(--font-heading)' }}>{e.oznaka || '—'}</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{e.proizvodac} {e.tipUredaja}</div>
                                                    </div>
                                                </div>
                                                
                                                {wkName && (
                                                    <div style={{ marginTop: 10, padding: '4px 10px', background: 'rgba(0,191,166,0.1)', color: 'var(--primary)', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                                                        <span style={{ fontSize: '0.9rem' }}>👤</span> {wkName}
                                                    </div>
                                                )}

                                                <div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gap: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)', alignItems: 'center' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{bs ? 'Sljedeći pregl.' : 'Next Insp.'}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatDate(e.sljedeciPregled)}</span> {getExpiryBadge(e.sljedeciPregled)}</div>
                                                </div>
                                            </div>
                                        </SwipeRow>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="data-table-wrapper">
                                <table className="data-table">`;
                                
        let s = eqC.indexOf(eqTableStart);
        let eObj = eqC.indexOf(eqTableEnd, s);
        if (s > -1 && eObj > -1) {
            eObj += eqTableEnd.length;
            let block = eqC.substring(s + eqTableStart.length, eObj - eqTableEnd.length);
            eqC = eqC.substring(0, s) + mobileEq + block + "                                </tbody>\n                            </table>\n                        </div>\n                        )}" + eqC.substring(eObj);
        }
        
        const fab = `
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
`;
        eqC = eqC.replace("{viewWorkerId &&", fab + "{viewWorkerId &&");
        fs.writeFileSync(eqPath, eqC);
    }

    // 2. PPE
    const ppePath = 'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/ppe/page.js';
    let ppeC = fs.readFileSync(ppePath, 'utf8');
    if (!ppeC.includes('SwipeRow')) {
        ppeC = ppeC.replace("import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';", "import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';\nimport SwipeRow from '@/components/mobile/SwipeRow';");
        ppeC = ppeC.replace("const { markDirty, markClean } = useUnsavedChanges();", "const { markDirty, markClean } = useUnsavedChanges();\n    const [isMobile, setIsMobile] = useState(false);\n    useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);");
        
        const ppeTableStart = '<div className="data-table-wrapper">\n                            <table className="data-table">';
        const ppeTableEnd = '                                </tbody>\n                            </table>\n                        </div>';
        
        const mobilePpe = `                        {isMobile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {sorted.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</div>
                                ) : sorted.map(e => {
                                    const statusObj = STATUS_MAP[e.status] || STATUS_MAP.ispravan;
                                    const assignedWorker = workers.find(w => w.id === e.zaduženoNaRadnika);
                                    let wkName = ''; if(assignedWorker) wkName = assignedWorker.ime + ' ' + assignedWorker.prezime;
                                    return (
                                        <SwipeRow
                                            key={e.id}
                                            isMobile={true}
                                            actions={[
                                                { label: bs ? 'Uredi' : 'Edit', icon: '✏️', color: 'var(--primary)', onClick: () => handleRowClick(e) },
                                                { label: bs ? 'Kopiraj' : 'Copy', icon: '📋', color: 'var(--secondary)', onClick: () => { const copy = { ...e, oznaka: e.oznaka + '-COPY', napomena: '(Kopija)' }; delete copy.id; create(COLLECTIONS.PPE_EQUIPMENT, copy); loadData(); showFlash(); } },
                                                { label: bs ? 'Obriši' : 'Delete', icon: '🗑️', color: 'var(--danger)', onClick: () => handleDelete(e.id) },
                                            ]}
                                        >
                                            <div onClick={() => handleRowClick(e)} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', position: 'relative' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                    <div>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: 0.5, fontFamily: 'var(--font-heading)' }}>{e.oznaka || '—'}</div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{e.proizvođač} {e.kategorijaId ? '-' : ''} {e.kategorijaId}</div>
                                                    </div>
                                                    <div style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: statusObj.bg, color: statusObj.color }}>
                                                        {bs ? statusObj.bs : statusObj.en}
                                                    </div>
                                                </div>
                                                
                                                {wkName && (
                                                    <div style={{ marginTop: 10, padding: '4px 10px', background: 'rgba(0,191,166,0.1)', color: 'var(--primary)', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                                                        <span style={{ fontSize: '0.9rem' }}>👤</span> {wkName}
                                                        {e.datumZaduženja && <span style={{ color: 'var(--text-light)', marginLeft: 4, fontWeight: 400 }}>({formatDate(e.datumZaduženja)})</span>}
                                                    </div>
                                                )}

                                            </div>
                                        </SwipeRow>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="data-table-wrapper">
                                <table className="data-table">`;

        let s = ppeC.indexOf(ppeTableStart);
        let eObj = ppeC.indexOf(ppeTableEnd, s);
        if (s > -1 && eObj > -1) {
            eObj += ppeTableEnd.length;
            let block = ppeC.substring(s + ppeTableStart.length, eObj - ppeTableEnd.length);
            ppeC = ppeC.substring(0, s) + mobilePpe + block + "                                </tbody>\n                            </table>\n                        </div>\n                        )}" + ppeC.substring(eObj);
        }
        
        const fab = `
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
`;
        ppeC = ppeC.replace("{viewWorkerId &&", fab + "{viewWorkerId &&");
        fs.writeFileSync(ppePath, ppeC);
    }
}
refactorEqPpe();
