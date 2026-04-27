import sys

filePath = r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\medical-exams\page.js'
with open(filePath, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """            {/* ── Toolbar: New button LEFT, search RIGHT ── */}
            <div className="card"><div className="card-body" style={{ padding: 0 }}>
            <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                <button className="btn btn-primary" id="btn-new-exam" style={{ flexShrink: 0, height: 38 }} onClick={handleNew}>
                    + {bs ? 'Novi pregled' : 'New Exam'}
                </button>

                <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 260, display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                    <input
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }}
                        placeholder={bs ? 'Pretraži radnika, doktora...' : 'Search worker, doctor...'}
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                    {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                </div>
                {/* Stat chips */}
                {stats.expired > 0 && (
                    <span style={{ flexShrink: 0, fontSize: '0.75rem', padding: '4px 10px', borderRadius: 20, background: 'var(--danger)', color: 'white', fontWeight: 700 }}>
                        ⚠️ {stats.expired} {bs ? 'isteklo' : 'expired'}
                    </span>
                )}
                {stats.soon > 0 && (
                    <span style={{ flexShrink: 0, fontSize: '0.75rem', padding: '4px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', fontWeight: 700, border: '1px solid var(--warning)' }}>
                        🕐 {stats.soon} {bs ? 'uskoro' : 'due soon'}
                    </span>
                )}

                {/* ── Grupne akcije bar ── */}
                {selectedIds.size > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {selectedIds.size} {bs ? 'odabrano' : 'selected'}:
                        </span>
                        <button className="btn btn-primary" style={{ height: 38 }} onClick={() => window.print()}>🖨️ {bs ? 'Isprintaj' : 'Print'}</button>
                        <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                    </div>
                )}
                {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{exams.length} {bs ? 'zapisa' : 'records'}</span>}
            </div>
            
            {/* ── Filter tabs ── */}
            <div style={{ display: 'flex', gap: 4, padding: '0 16px 16px', flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={filterTab === tab.key ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                        style={tab.col && filterTab !== tab.key ? { borderColor: tab.col, color: tab.col } : {}}
                        onClick={() => setFilterTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>"""

replacement1 = """            {/* ── Toolbar: New button LEFT, search RIGHT ── */}
            <div className="card"><div className="card-body" style={{ padding: 0 }}>
            <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                <button className="btn btn-primary" id="btn-new-exam" style={{ flexShrink: 0, height: 38 }} onClick={handleNew}>
                    + {bs ? 'Novi pregled' : 'New Exam'}
                </button>

                <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 260, display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                    <input
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }}
                        placeholder={bs ? 'Pretraži radnika, doktora...' : 'Search worker, doctor...'}
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                    {searchQ && <button onClick={() => setSearchQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                </div>

                <select
                    className="form-select"
                    style={{ height: 38, padding: '0 12px', flexShrink: 0, fontSize: '0.85rem', width: 140, cursor: 'pointer' }}
                    value={filterTab}
                    onChange={(e) => setFilterTab(e.target.value)}
                >
                    {tabs.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>

                {/* ── Grupne akcije bar ── */}
                {selectedIds.size > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {selectedIds.size} {bs ? 'odabrano' : 'selected'}:
                        </span>
                        <button className="btn btn-primary" style={{ height: 38 }} onClick={() => window.print()}>🖨️ {bs ? 'Isprintaj' : 'Print'}</button>
                        <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                    </div>
                )}
                {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{exams.length} {bs ? 'zapisa' : 'records'}</span>}
            </div>

            <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>"""

content = content.replace(target1, replacement1)
content = content.replace(target1.replace('\n', '\r\n'), replacement1.replace('\n', '\r\n'))

with open(filePath, 'w', encoding='utf-8') as f:
    f.write(content)
