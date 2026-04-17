const fs = require('fs');

const path = 'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/fire-protection/page.js';
let content = fs.readFileSync(path, 'utf8');

// ==== 1. Extinguisher Table ====
const extTableStart = '<div className="data-table-wrapper">\n                                <table className="data-table">';
const extTableEnd = '                                </table>\n                            </div>';

const mobileRenderExt = `
                            {isMobile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {sortedExt.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</div>
                                    ) : sortedExt.map(e => {
                                        const statusObj = STATUS_MAP[e.status] || STATUS_MAP.ispravan;
                                        return (
                                            <SwipeRow
                                                key={e.id}
                                                isMobile={true}
                                                actions={[
                                                    { label: bs ? 'Uredi' : 'Edit', icon: '✏️', color: 'var(--primary)', onClick: () => openEditExt(e) },
                                                    { label: bs ? 'Kopiraj' : 'Copy', icon: '📋', color: 'var(--secondary)', onClick: () => { const copy = { ...e, serijskiBroj: e.serijskiBroj + '-COPY', napomena: '(Kopija)' }; delete copy.id; create(COLLECTIONS.FIRE_EXTINGUISHERS, copy); loadData(); showFlash(); } },
                                                    { label: bs ? 'Obriši' : 'Delete', icon: '🗑️', color: 'var(--danger)', onClick: () => handleDeleteExt(e.id) },
                                                ]}
                                            >
                                                <div onClick={() => openEditExt(e)} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: 0.5, fontFamily: 'var(--font-heading)' }}>{e.serijskiBroj}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{bs ? EXT_TYPES[e.tip]?.bs : EXT_TYPES[e.tip]?.en || e.tip} {e.tezina ? \`- \${e.tezina}kg\` : ''}</div>
                                                        </div>
                                                        <div style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: statusObj.bg, color: statusObj.color }}>
                                                            {bs ? statusObj.bs : statusObj.en}
                                                        </div>
                                                    </div>
                                                    
                                                    {e.lokacija && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            📌 <span style={{ fontWeight: 600 }}>{e.lokacija}</span>
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gap: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)', alignItems: 'center' }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{bs ? 'Sljedeći' : 'Next Srv.'}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatDate(e.sljedeciServis)}</span> {getExpiryBadge(e.sljedeciServis)}</div>
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

// Ext Replace
let s1 = content.indexOf(extTableStart);
if (s1 > -1) {
    let e1 = content.indexOf(extTableEnd, s1);
    if(e1 > -1) {
        let block = content.substring(s1 + extTableStart.length, e1);
        content = content.substring(0, s1) + mobileRenderExt + block + "                                </table>\n                            </div>\n                            )}";
        content += content.substring(e1 + extTableEnd.length); // wait, this was wrong logic
    }
}

// ==== Proper approach for Fire Protection Ext ====
s1 = content.indexOf(extTableStart);
let e1 = content.indexOf(extTableEnd, s1) + extTableEnd.length;
if(s1 > -1 && e1 > -1) {
    let block = content.substring(s1 + extTableStart.length, e1 - extTableEnd.length);
    content = content.substring(0, s1) + mobileRenderExt + block + "                                </table>\n                            </div>\n                            )}" + content.substring(e1);
}


// ==== 2. Hydrants Table ====
const hydTableStart = '<div className="data-table-wrapper">\n                                <table className="data-table">';
const hydTableEnd = '                                </table>\n                            </div>';

const mobileRenderHyd = `
                            {isMobile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {sortedHyd.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</div>
                                    ) : sortedHyd.map(h => {
                                        const statusObj = STATUS_MAP[h.status] || STATUS_MAP.ispravan;
                                        return (
                                            <SwipeRow
                                                key={h.id}
                                                isMobile={true}
                                                actions={[
                                                    { label: bs ? 'Uredi' : 'Edit', icon: '✏️', color: 'var(--primary)', onClick: () => openEditHyd(h) },
                                                    { label: bs ? 'Kopiraj' : 'Copy', icon: '📋', color: 'var(--secondary)', onClick: () => { const copy = { ...h, oznaka: h.oznaka + '-COPY', napomena: '(Kopija)' }; delete copy.id; create(COLLECTIONS.HYDRANTS, copy); loadData(); showFlash(); } },
                                                    { label: bs ? 'Obriši' : 'Delete', icon: '🗑️', color: 'var(--danger)', onClick: () => handleDeleteHyd(h.id) },
                                                ]}
                                            >
                                                <div onClick={() => openEditHyd(h)} style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                        <div>
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: 0.5, fontFamily: 'var(--font-heading)' }}>{h.oznaka}</div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{h.tip === 'unutarnji' ? (bs ? 'Unutarnji hidrant' : 'Indoor Hydrant') : (bs ? 'Vanjski hidrant' : 'Outdoor Hydrant')}</div>
                                                        </div>
                                                        <div style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: statusObj.bg, color: statusObj.color }}>
                                                            {bs ? statusObj.bs : statusObj.en}
                                                        </div>
                                                    </div>
                                                    
                                                    {h.lokacija && (
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            📌 <span style={{ fontWeight: 600 }}>{h.lokacija}</span>
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'min-content auto', gap: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)', alignItems: 'center' }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{bs ? 'Sljedeći' : 'Next Insp.'}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatDate(h.sljedeciPregled)}</span> {getExpiryBadge(h.sljedeciPregled)}</div>
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

// Ext was replaced, we have to find Hyd after that:
let s2 = content.indexOf(hydTableStart, s1 + 100);
let e2 = content.indexOf(hydTableEnd, s2) + hydTableEnd.length;
if(s2 > -1 && e2 > -1) {
    let block = content.substring(s2 + hydTableStart.length, e2 - hydTableEnd.length);
    content = content.substring(0, s2) + mobileRenderHyd + block + "                                </table>\n                            </div>\n                            )}" + content.substring(e2);
}

// ==== Append FABs ====
const fabExt = `
            {isMobile && !showExtForm && tab === 'extinguishers' && (
                <button
                    onClick={openNewExt}
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
const fabHyd = `
            {isMobile && !showHydForm && tab === 'hydrants' && (
                <button
                    onClick={openNewHyd}
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

content = content.replace("        </div>\n    );\n}", fabExt + fabHyd + "        </div>\n    );\n}");


fs.writeFileSync(path, content);
console.log('Fire protection patched.');
