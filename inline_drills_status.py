import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Drills Status Inline Replace
    nav_old_btn1 = r"""<button onClick={() => { setActionMenuId(null); const cycle = { 'uspješno': 'djelimično', 'djelimično': 'neuspješno', 'neuspješno': 'uspješno' }; update(COLLECTIONS.EVACUATION_DRILLS, d.id, { status: cycle[d.status] || 'uspješno' }); loadData(); }} className="dropdown-item">🔄 {bs ? `Status → ${STATUS_MAP[({ 'uspješno': 'djelimično', 'djelimično': 'neuspješno', 'neuspješno': 'uspješno' })[d.status]]?.bs || 'Uspješno'}` : `Status → ${STATUS_MAP[({ 'uspješno': 'djelimično', 'djelimično': 'neuspješno', 'neuspješno': 'uspješno' })[d.status]]?.en || 'Successful'}`}</button>"""
    content = content.replace(nav_old_btn1, "")

    nav_old_inline1 = r"""<td><span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color }}>{bs ? st.bs : st.en}</span></td>"""
    
    nav_new_inline1 = r"""<td onClick={e => e.stopPropagation()}>
                                                    <select 
                                                        style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color, border: 'none', cursor: 'pointer', outline: 'none', appearance: 'none', paddingRight: '20px' }}
                                                        value={d.status || 'uspješno'}
                                                        onChange={e => { update(COLLECTIONS.EVACUATION_DRILLS, d.id, { status: e.target.value }); loadData(); }}
                                                    >
                                                        {Object.entries(STATUS_MAP).map(([k, v]) => (
                                                            <option key={k} value={k} style={{ background: '#fff', color: '#1a1a1a' }}>{bs ? v.bs : v.en}</option>
                                                        ))}
                                                    </select>
                                                </td>"""

    content = content.replace(nav_old_inline1, nav_new_inline1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\evacuation-drills\page.js')
