import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Evacuation Plans
    nav_old_btn1 = r"""<button onClick={() => { setActionMenuId(null); const cycle = { aktivan: 'revizija', revizija: 'neaktivan', neaktivan: 'aktivan' }; const statusLabels = { aktivan: { bs: 'Aktivan', en: 'Active' }, revizija: { bs: 'Revizija', en: 'Revision' }, neaktivan: { bs: 'Neaktivan', en: 'Inactive' } }; update(COLLECTIONS.EVACUATION_PLANS, p.id, { status: cycle[p.status] || 'aktivan' }); loadData(); }} className="dropdown-item">🔄 {bs ? `Status → ${{ aktivan: 'Revizija', revizija: 'Neaktivan', neaktivan: 'Aktivan' }[p.status] || 'Aktivan'}` : `Status → ${{ aktivan: 'Revision', revizija: 'Inactive', neaktivan: 'Active' }[p.status] || 'Active'}`}</button>"""
    content = content.replace(nav_old_btn1, "")

    # Fix Zakaži vježbu in Akcije menu
    nav_old_schedule = r"""<button onClick={() => { setActionMenuId(null); create(COLLECTIONS.EVACUATION_DRILLS, { planId: p.id, lokacija: p.lokacija, datumVjezbe: new Date().toISOString().split('T')[0], status: 'zavrsena', napomena: bs ? 'Vježba kreirana iz plana' : 'Drill created from plan' }); loadData(); showFlash(); }} className="dropdown-item">🏃 {bs ? 'Zakaži vježbu' : 'Schedule Drill'}</button>"""
    content = content.replace(nav_old_schedule, "")

    # Evacuation Plans inline change
    nav_old_inline1 = r"""<td><span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color }}>{bs ? st.bs : st.en}</span></td>"""
    
    nav_new_inline1 = r"""<td onClick={e => e.stopPropagation()}>
                                                    <select 
                                                        style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: st.bg, color: st.color, border: 'none', cursor: 'pointer', outline: 'none', appearance: 'none', paddingRight: '20px' }}
                                                        value={p.status || 'aktivan'}
                                                        onChange={e => { update(COLLECTIONS.EVACUATION_PLANS, p.id, { status: e.target.value }); loadData(); }}
                                                    >
                                                        <option value="aktivan" style={{ background: '#fff', color: '#1a1a1a' }}>{bs ? 'Aktivan' : 'Active'}</option>
                                                        <option value="revizija" style={{ background: '#fff', color: '#1a1a1a' }}>{bs ? 'Revizija' : 'Revision'}</option>
                                                        <option value="neaktivan" style={{ background: '#fff', color: '#1a1a1a' }}>{bs ? 'Neaktivan' : 'Inactive'}</option>
                                                    </select>
                                                </td>"""

    content = content.replace(nav_old_inline1, nav_new_inline1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\evacuation\page.js')
