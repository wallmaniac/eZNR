import re

def process_file(filepath, is_drills=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add hr variable
    content = content.replace("const bs = lang !== 'en';", "const bs = lang !== 'en';\n    const hr = lang === 'hr';")

    # 2. Translations
    if is_drills:
        content = content.replace("bs ? 'Vježbe evakuacije' : 'Evacuation Drills'", "hr ? 'Vježbe evakuacije' : bs ? 'Vježbe evakuacije' : 'Evacuation Drills'")
        content = content.replace("bs ? 'Uz učešće žurnih službi' : 'With Emergency Svc.'", "hr ? 'Uz sudjelovanje hitnih službi' : bs ? 'Uz učešće hitnih službi' : 'With Emergency Svc.'")
        content = content.replace("bs ? 'Evakuisano' : 'Evacuated'", "hr ? 'Evakuirano' : bs ? 'Evakuisano' : 'Evacuated'")
        content = content.replace("bs ? 'Broj evakuisanih osoba' : 'No. of evacuated persons'", "hr ? 'Broj evakuiranih osoba' : bs ? 'Broj evakuisanih osoba' : 'No. of evacuated persons'")
        content = content.replace("bs ? 'Rukovodilac vježbe' : 'Drill Supervisor'", "hr ? 'Voditelj vježbe' : bs ? 'Rukovodilac vježbe' : 'Drill Supervisor'")
        content = content.replace("bs ? 'Rukovodilac' : 'Supervisor'", "hr ? 'Voditelj' : bs ? 'Rukovodilac' : 'Supervisor'")
        content = content.replace("bs ? 'Učešće hitnih službi' : 'Emergency Services Participation'", "hr ? 'Sudjelovanje hitnih službi' : bs ? 'Učešće hitnih službi' : 'Emergency Services Participation'")
        content = content.replace("bs ? 'Hitne službe' : 'Emergency Svc.'", "hr ? 'Žurne službe' : bs ? 'Hitne službe' : 'Emergency Svc.'")
        content = content.replace("bs ? 'Vatrogasci' : 'Fire Department'", "hr ? 'Vatrogasci' : bs ? 'Vatrogasci' : 'Fire Department'")
        content = content.replace("bs ? 'Hitna medicinska pomoć' : 'Ambulance'", "hr ? 'Hitna medicinska pomoć' : bs ? 'Hitna medicinska pomoć' : 'Ambulance'")
        content = content.replace("bs ? 'Uspješno provedene' : 'Successfully Completed'", "hr ? 'Uspješno provedene' : bs ? 'Uspješno provedene' : 'Successfully Completed'")
        content = content.replace("bs ? 'Neuspješne vježbe' : 'Failed Drills'", "hr ? 'Neuspješne vježbe' : bs ? 'Neuspješne vježbe' : 'Failed Drills'")

    # 3. Documents
    content = content.replace("attachedFile: '', attachedFileName: '',", "attachedFile: '', attachedFileName: '', documents: [],")
    
    # 4. Akcije menu design
    akcije_btn_old = 'className="btn btn-ghost btn-sm" onClick={e => openMenu'
    akcije_btn_new = 'className="btn btn-primary btn-sm" data-menu-trigger onMouseDown={(e) => e.preventDefault()} onClick={e => openMenu'
    content = content.replace(akcije_btn_old, akcije_btn_new)
    
    # 5. Documents Column Rendering
    doc_render_old = r"""<td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    {p.attachedFile ? (
                                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                            <button className="btn btn-ghost btn-sm" title={bs ? 'Preuzmi' : 'Download'} onClick={() => { const a = document.createElement('a'); a.href = p.attachedFile; a.download = p.attachedFileName || 'document'; a.click(); }} style={{ padding: '2px 6px', fontSize: '0.8rem' }}>⬇️</button>
                                                            <button className="btn btn-ghost btn-sm" title={bs ? 'Pregledaj' : 'View'} onClick={() => { const w = window.open(); w.document.write(`<iframe src="${p.attachedFile}" style="width:100%;height:100%;border:none"></iframe>`); }} style={{ padding: '2px 6px', fontSize: '0.8rem' }}>👁️</button>
                                                        </div>
                                                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>"""
                                                
    doc_render_old2 = r"""<td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                                    {d.attachedFile ? (
                                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                            <button className="btn btn-ghost btn-sm" title={bs ? 'Preuzmi' : 'Download'} onClick={() => { const a = document.createElement('a'); a.href = d.attachedFile; a.download = d.attachedFileName || 'document'; a.click(); }} style={{ padding: '2px 6px', fontSize: '0.8rem' }}>⬇️</button>
                                                            <button className="btn btn-ghost btn-sm" title={bs ? 'Pregledaj' : 'View'} onClick={() => { const w = window.open(); w.document.write(`<iframe src="${d.attachedFile}" style="width:100%;height:100%;border:none"></iframe>`); }} style={{ padding: '2px 6px', fontSize: '0.8rem' }}>👁️</button>
                                                        </div>
                                                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>"""

    doc_render_new = r"""<td onClick={e => e.stopPropagation()} style={{ padding: '8px' }}>
                                                    {((ITEM.documents && ITEM.documents.length > 0) || ITEM.attachedFile) ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            {ITEM.attachedFile && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>1.</span>
                                                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'underline', textAlign: 'left' }} onClick={() => { const w = window.open(); w.document.write(`<iframe src="${ITEM.attachedFile}" style="width:100%;height:100%;border:none"></iframe>`); }}>
                                                                        {ITEM.attachedFileName || 'Dokument'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {ITEM.documents && ITEM.documents.map((doc, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ITEM.attachedFile ? idx + 2 : idx + 1}.</span>
                                                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'underline', textAlign: 'left', wordBreak: 'break-all' }} onClick={() => { const w = window.open(); w.document.write(`<iframe src="${doc.url}" style="width:100%;height:100%;border:none"></iframe>`); }}>
                                                                        {doc.name}
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                                </td>"""
                                                
    if is_drills:
        content = content.replace(doc_render_old2, doc_render_new.replace("ITEM", "d"))
    else:
        content = content.replace(doc_render_old, doc_render_new.replace("ITEM", "p"))

    # 6. Preuzmi dokument in Akcije menu
    preuzmi_menu = r"""<button onClick={() => { setActionMenuId(null); if (ITEM.attachedFile) { const a = document.createElement('a'); a.href = ITEM.attachedFile; a.download = ITEM.attachedFileName || 'document'; a.click(); } if (ITEM.documents) { ITEM.documents.forEach(d => { const a = document.createElement('a'); a.href = d.url; a.download = d.name; a.click(); }); } }} className="dropdown-item">⬇️ {hr ? 'Preuzmi dokumente' : bs ? 'Preuzmi dokumente' : 'Download documents'}</button>"""
    
    if is_drills:
        content = content.replace('className="dropdown-item">✏️ {bs ? \'Otvori\' : \'Open\'}</button>', 'className="dropdown-item">✏️ {bs ? \'Otvori\' : \'Open\'}</button>\n                                                                    ' + preuzmi_menu.replace("ITEM", "d"))
    else:
        content = content.replace('className="dropdown-item">✏️ {bs ? \'Otvori\' : \'Open\'}</button>', 'className="dropdown-item">✏️ {bs ? \'Otvori\' : \'Open\'}</button>\n                                                                    ' + preuzmi_menu.replace("ITEM", "p"))

    # 7. Document Upload Multiple
    upload_block_old = r"""{formData.attachedFile && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                                                <span>📄</span>
                                                <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>{formData.attachedFileName}</span>
                                                <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '2px 8px' }} onClick={() => { set('attachedFile', ''); set('attachedFileName', ''); }}>✕</button>
                                            </div>
                                        )}
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            if (file.size > 10 * 1024 * 1024) { alert(bs ? 'Maksimalna veličina fajla je 10MB!' : 'Max file size is 10MB!'); return; }
                                            const reader = new FileReader();
                                            reader.onload = () => { set('attachedFile', reader.result); set('attachedFileName', file.name); };
                                            reader.readAsDataURL(file);
                                        }} style={{ fontSize: '0.85rem' }} />"""

    upload_block_new = r"""<div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                            {formData.attachedFile && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                                                    <span>📄</span>
                                                    <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>{formData.attachedFileName}</span>
                                                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '2px 8px' }} onClick={() => { set('attachedFile', ''); set('attachedFileName', ''); }}>✕</button>
                                                </div>
                                            )}
                                            {formData.documents && formData.documents.map((doc, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                                                    <span>📄</span>
                                                    <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>{doc.name}</span>
                                                    <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '2px 8px' }} onClick={() => { const newDocs = [...formData.documents]; newDocs.splice(idx, 1); set('documents', newDocs); }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length === 0) return;
                                            
                                            const newDocs = [...(formData.documents || [])];
                                            let processed = 0;
                                            
                                            files.forEach(file => {
                                                if (file.size > 10 * 1024 * 1024) { alert(hr ? 'Maksimalna veličina fajla je 10MB!' : bs ? 'Maksimalna veličina fajla je 10MB!' : 'Max file size is 10MB!'); return; }
                                                const reader = new FileReader();
                                                reader.onload = () => { 
                                                    newDocs.push({ url: reader.result, name: file.name });
                                                    processed++;
                                                    if (processed === files.length) {
                                                        set('documents', newDocs);
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            });
                                            e.target.value = ''; // reset input
                                        }} style={{ fontSize: '0.85rem' }} />"""

    content = content.replace(upload_block_old, upload_block_new)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\evacuation\page.js', False)
process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\evacuation-drills\page.js', True)
