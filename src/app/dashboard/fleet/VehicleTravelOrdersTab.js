import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { create, update, remove, COLLECTIONS, formatDate, genId } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

export default function VehicleTravelOrdersTab({ vehicleId, vehicles, workers, reloadData }) {
    const { t, lang } = useLanguage();
    const bs = lang === 'bs';
    const { confirm } = useDialog();

    const vehicle = vehicles.find(v => v.id === vehicleId) || {};
    // Let's assume travel orders are saved directly to vehicle for now, or use entirely separate
    // In our plan we created TRAVEL_ORDERS. Since we didn't pass travelOrders down from fleet/page.js,
    // let's grab them directly here to avoid wiring it all the way up.
    // Wait, let's just use localStorage directly to fetch them for this vehicle to keep it fast.
    const getOrders = () => {
        try {
            return JSON.parse(localStorage.getItem('eznr_travelOrders') || '[]').filter(o => o.vehicleId === vehicleId);
        } catch { return []; }
    };
    const orders = getOrders().sort((a,b) => new Date(b.datumIzdavanja) - new Date(a.datumIzdavanja));

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ 
        brojNaloga: `PN-${new Date().getFullYear()}-`, 
        tipObrasca: vehicle.tip === 'teretno' ? 'PN-3' : 'PN-4',
        workerId: vehicle.vozacId || '', 
        workerIme: vehicle.vozacIme || '', 
        relacija: '', 
        mjestoIzdavanja: '', 
        datumIzdavanja: new Date().toISOString().split('T')[0] 
    });

    // action menu
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    // bulk actions
    const [selectedIds, setSelectedIds] = useState(new Set());
    const toggleAll = (e) => setSelectedIds(e.target.checked ? new Set(orders.map(x => x.id)) : new Set());
    const toggleOne = (id) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(bs ? `Obrisati ${selectedIds.size} naloga?` : `Delete ${selectedIds.size} orders?`)) {
            for (let id of selectedIds) remove(COLLECTIONS.TRAVEL_ORDERS, id);
            setSelectedIds(new Set());
            reloadData();
        }
    };

    const [search, setSearch] = useState('');
    const [showW, setShowW] = useState(false);

    const handleSave = () => {
        if (editingId) {
            update(COLLECTIONS.TRAVEL_ORDERS, editingId, { ...form, vozacId: form.workerId, vozacIme: form.workerIme });
        } else {
            create(COLLECTIONS.TRAVEL_ORDERS, {
                ...form,
                vozacId: form.workerId,
                vozacIme: form.workerIme,
                vehicleId,
                status: 'otvoren',
                generisanoDatum: new Date().toISOString()
            });
        }
        setShowForm(false);
        setEditingId(null);
        reloadData();
    };

    const handleEdit = (order) => {
        setEditingId(order.id);
        setForm({
            brojNaloga: order.brojNaloga || '',
            tipObrasca: order.tipObrasca || 'PN-4',
            workerId: order.vozacId || order.workerId || '',
            workerIme: order.vozacIme || order.workerIme || '',
            relacija: order.relacija || '',
            mjestoIzdavanja: order.mjestoIzdavanja || '',
            datumIzdavanja: order.datumIzdavanja || new Date().toISOString().split('T')[0]
        });
        setShowForm(true);
    };

    const handleCopy = (order) => {
        setEditingId(null);
        setForm({
            brojNaloga: `PN-${new Date().getFullYear()}-`, // fresh number
            tipObrasca: order.tipObrasca || 'PN-4',
            workerId: order.vozacId || order.workerId || '',
            workerIme: order.vozacIme || order.workerIme || '',
            relacija: order.relacija || '',
            mjestoIzdavanja: order.mjestoIzdavanja || '',
            datumIzdavanja: new Date().toISOString().split('T')[0] // today
        });
        setShowForm(true);
    };

    const handleDelete = async (orderId) => {
        if (await confirm(bs ? 'Brisati ovaj putni nalog?' : 'Delete this travel order?')) {
            remove(COLLECTIONS.TRAVEL_ORDERS, orderId);
            reloadData();
        }
    };

    const handlePrint = (order) => {
        // In a real app we'd open a PDF generator or a print layout route. 
        // For now, we pop up a simple print window view.
        const win = window.open('', '_blank');
        win.document.write(`
            <html><head><title>Putni Nalog ${order.brojNaloga}</title>
            <style>
                body { font-family: sans-serif; padding: 40px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #333; padding: 8px; text-align: left; }
                .header { text-align: center; margin-bottom: 30px; }
            </style>
            </head><body>
                <div class="header">
                    <h2>PUTNI NALOG ZA VOZILO ZAKON FBiH (${order.tipObrasca})</h2>
                    <h3>Broj: ${order.brojNaloga}</h3>
                </div>
                <p><strong>Vozilo:</strong> ${vehicle.marka} ${vehicle.model} (${vehicle.registracija})</p>
                <p><strong>Vozač:</strong> ${order.workerIme}</p>
                <p><strong>Relacija:</strong> ${order.relacija}</p>
                <p><strong>Datum izdavanja:</strong> ${formatDate(order.datumIzdavanja)} u ${order.mjestoIzdavanja}</p>
                
                <h4 style="margin-top:40px;">EVIDENCIJA O KRETANJU VOZILA (popunjava vozač)</h4>
                <table>
                    <tr><th>Datum</th><th>Polazak iz</th><th>Stigao u</th><th>Vrijeme polaska</th><th>Vrijeme dolaska</th><th>Početno stanje KM</th><th>Završno stanje KM</th><th>Potpis</th></tr>
                    <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                    <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                    <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
                </table>

                <h4 style="margin-top:40px;">EVIDENCIJA UTROŠKA GORIVA</h4>
                <table>
                    <tr><th>Datum</th><th>Mjesto točenja</th><th>Količina (L)</th><th>Iznos (KM)</th><th>Potpis točioca</th></tr>
                    <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
                    <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
                </table>

                <p style="margin-top:50px;">Potpis ovlaštenog lica: ___________________________</p>
            </body></html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    };

    const fw = workers.filter(w => (search ? `${w.ime} ${w.prezime}`.toLowerCase().includes(search.toLowerCase()) : true));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                    <h3 style={{ margin: '0 0 4px 0' }}>{bs ? 'Putni nalozi (FBiH Zakon)' : 'Travel Orders'}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {bs ? 'Predefinisani obrasci PN-3 (teretno) i PN-4 (putničko) spremni za print.' : 'Legal print templates for FBiH travel orders.'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {selectedIds.size > 0 && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {bs ? 'odabrano' : 'selected'}</span>
                            <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {bs ? 'Obriši' : 'Delete'}</button>
                        </div>
                    )}
                    {!showForm && (
                        <button className="btn btn-primary btn-sm" onClick={() => { 
                            setEditingId(null); 
                            setSearch('');
                            setShowForm(true); 
                            setForm({ 
                                brojNaloga: `PN-${new Date().getFullYear()}-`, 
                                tipObrasca: vehicle.tip === 'teretno' ? 'PN-3' : 'PN-4',
                                workerId: vehicle.vozacId || '', 
                                workerIme: vehicle.vozacIme || '', 
                                relacija: '', 
                                mjestoIzdavanja: '', 
                                datumIzdavanja: new Date().toISOString().split('T')[0] 
                            }); 
                        }}>
                            + {bs ? 'Novi putni nalog' : 'New Order'}
                        </button>
                    )}
                </div>
            </div>
                {showForm && (
                <div className="modal-overlay" style={{ zIndex: 12000 }} onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? (bs ? 'Uredi nalog' : 'Edit Order') : (bs ? 'Novi putni nalog' : 'New Travel Order')}</h2>
                            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Broj naloga' : 'Order Number'}</label>
                                        <input className="form-input" value={form.brojNaloga} onChange={e => setForm(f => ({...f, brojNaloga: e.target.value}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Tip obrasca' : 'Form Type'}</label>
                                        <select className="form-select" value={form.tipObrasca} onChange={e => setForm(f => ({...f, tipObrasca: e.target.value}))}>
                                            <option value="PN-4">PN-4 (Putničko)</option>
                                            <option value="PN-3">PN-3 (Teretno)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group" ref={workerRef} style={{ position: 'relative' }}>
                                    <label className="form-label">{bs ? 'Vozač' : 'Driver'} <span style={{color:'var(--danger)'}}>*</span></label>
                                    <input className="form-input" placeholder={bs ? '🔍 Pretraži zaposlene...' : '🔍 Search workers...'} value={search} onChange={e => { setSearch(e.target.value); setShowW(true); setForm(f => ({...f, workerId: '', workerIme: ''})); }} onFocus={() => setShowW(true)} />
                                    {showW && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius-sm)' }}>
                                            {filteredWorkers.length === 0 ? <div style={{ padding: 8 }}>Nema rezultata</div> : filteredWorkers.slice(0, 10).map(w => (
                                                <div key={w.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} onClick={() => { setForm(f => ({...f, workerId: w.id, workerIme: `${w.ime} ${w.prezime}`})); setSearch(`${w.ime} ${w.prezime}`); setShowW(false); }}>
                                                    {w.ime} {w.prezime}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {form.workerId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {form.workerIme}</div>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{bs ? 'Relacija' : 'Route'}</label>
                                    <input className="form-input" value={form.relacija} onChange={e => setForm(f => ({...f, relacija: e.target.value}))} placeholder="npr. Sarajevo - Zenica" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Mjesto izdavanja' : 'Issued At'}</label>
                                        <input className="form-input" value={form.mjestoIzdavanja} onChange={e => setForm(f => ({...f, mjestoIzdavanja: e.target.value}))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{bs ? 'Datum izdavanja' : 'Issue Date'}</label>
                                        <input className="form-input" type="date" value={form.datumIzdavanja} onChange={e => setForm(f => ({...f, datumIzdavanja: e.target.value}))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-card)' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                            <button type="button" className="btn btn-primary" onClick={handleSave}>💾 {bs ? 'Spremi nalog' : 'Save Order'}</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="data-table-wrapper" style={{ marginTop: 8 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === orders.length && orders.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                            <th>{bs ? 'Broj Naloga' : 'Order Num'}</th>
                            <th>{bs ? 'Tip' : 'Type'}</th>
                            <th>{bs ? 'Datum' : 'Date'}</th>
                            <th>{bs ? 'Vozač' : 'Driver'}</th>
                            <th>{bs ? 'Relacija' : 'Route'}</th>
                            <th style={{ width: 100 }}>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>{bs ? 'Nema kreiranih naloga' : 'No travel orders yet'}</td></tr>
                        ) : orders.map(o => (
                            <tr key={o.id}>
                                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleOne(o.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                </td>
                                <td style={{ fontWeight: 700 }}>{o.brojNaloga}</td>
                                <td><span className="badge badge-info">{o.tipObrasca}</span></td>
                                <td>{formatDate(o.datumIzdavanja)}</td>
                                <td>{o.vozacIme || o.workerIme}</td>
                                <td>{o.relacija}</td>
                                <td onClick={e => e.stopPropagation()}>
                                    <div style={{ position: 'relative' }}>
                                        <button className="btn btn-primary btn-sm" onClick={(e) => {
                                            if (actionMenuId === o.id) { setActionMenuId(null); return; }
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const spaceBelow = window.innerHeight - rect.bottom - 8;
                                            const flipUp = spaceBelow < 150;
                                            setMenuPos(flipUp
                                                ? { bottom: window.innerHeight - rect.top + 4, left: rect.left - 80, maxH: Math.max(120, rect.top - 8) }
                                                : { top: rect.bottom + 4, left: rect.left - 80, maxH: Math.max(120, spaceBelow) });
                                            setActionMenuId(o.id);
                                        }}>{bs ? 'Akcije' : 'Actions'} ▼</button>

                                        {actionMenuId === o.id && (
                                            <>
                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setActionMenuId(null)} />
                                                <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 160, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                    <button onClick={() => { setActionMenuId(null); handleEdit(o); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>✏️ {bs ? 'Uredi' : 'Edit'}</button>
                                                    <button onClick={() => { setActionMenuId(null); handlePrint(o); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🖨️ {bs ? 'Printaj' : 'Print'}</button>
                                                    <button onClick={() => { setActionMenuId(null); handleCopy(o); }} style={menuItemSt} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>📋 {bs ? 'Kopiraj' : 'Copy'}</button>
                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                    <button onClick={() => { setActionMenuId(null); handleDelete(o.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>🗑️ {bs ? 'Izbriši' : 'Delete'}</button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
