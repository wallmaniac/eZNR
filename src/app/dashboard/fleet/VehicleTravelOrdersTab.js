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
    const [form, setForm] = useState({ 
        brojNaloga: `PN-${new Date().getFullYear()}-`, 
        tipObrasca: vehicle.tip === 'teretno' ? 'PN-3' : 'PN-4',
        workerId: vehicle.vozacId || '', 
        workerIme: vehicle.vozacIme || '', 
        relacija: '', 
        mjestoIzdavanja: '', 
        datumIzdavanja: new Date().toISOString().split('T')[0] 
    });

    const [search, setSearch] = useState('');
    const [showW, setShowW] = useState(false);

    const handleCreate = () => {
        create(COLLECTIONS.TRAVEL_ORDERS, {
            ...form,
            vehicleId,
            status: 'otvoren',
            generisanoDatum: new Date().toISOString()
        });
        setShowForm(false);
        reloadData(); // to bubble up
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
                {!showForm && (
                    <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                        + {bs ? 'Novi putni nalog' : 'New Order'}
                    </button>
                )}
            </div>

            {showForm && (
                <div style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>{bs ? 'Kreiraj PN nalog' : 'Create PN Order'}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">{bs ? 'Broj naloga' : 'Order Number'}</label>
                            <input className="form-input" value={form.brojNaloga} onChange={e => setForm(f => ({...f, brojNaloga: e.target.value}))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{bs ? 'Tip obrasca' : 'Form Type'}</label>
                            <select className="form-select" value={form.tipObrasca} onChange={e => setForm(f => ({...f, tipObrasca: e.target.value}))}>
                                <option value="PN-4">PN-4 (Putničko vozilo)</option>
                                <option value="PN-3">PN-3 (Teretno vozilo)</option>
                                <option value="PN-2">PN-2 (Gradski prevoz)</option>
                                <option value="PN-1">PN-1 (Autobus)</option>
                            </select>
                        </div>

                        <div className="form-group" style={{ position: 'relative' }}>
                            <label className="form-label">{bs ? 'Zaduženi vozač' : 'Assigned Driver'}</label>
                            <input className="form-input" placeholder={bs ? '🔍 Pretraži...' : 'Search...'} value={search || form.workerIme} onChange={e => { setSearch(e.target.value); setShowW(true); setForm(f => ({...f, workerId:'', workerIme: e.target.value})) }} onFocus={() => setShowW(true)} />
                            {showW && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto' }}>
                                    {fw.length === 0 ? <div style={{ padding: 8 }}>Nema</div> : fw.slice(0, 10).map(w => (
                                        <div key={w.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} onClick={() => { setForm(f => ({...f, workerId: w.id, workerIme: `${w.ime} ${w.prezime}`})); setSearch(''); setShowW(false); }}>
                                            {w.ime} {w.prezime}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">{bs ? 'Relacija kretanja' : 'Route'}</label>
                            <input className="form-input" placeholder="Sarajevo - Mostar - Sarajevo" value={form.relacija} onChange={e => setForm(f => ({...f, relacija: e.target.value}))} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{bs ? 'Mjesto izdavanja' : 'Place of Issue'}</label>
                            <input className="form-input" placeholder="Sarajevo" value={form.mjestoIzdavanja} onChange={e => setForm(f => ({...f, mjestoIzdavanja: e.target.value}))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{bs ? 'Datum izdavanja' : 'Date of Issue'}</label>
                            <input className="form-input" type="date" value={form.datumIzdavanja} onChange={e => setForm(f => ({...f, datumIzdavanja: e.target.value}))} />
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button className="btn btn-primary btn-sm" onClick={handleCreate}>💾 {bs ? 'Spremi nalog' : 'Save Order'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                    </div>
                </div>
            )}

            <div className="data-table-wrapper" style={{ marginTop: 8 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{bs ? 'Broj Naloga' : 'Order Num'}</th>
                            <th>{bs ? 'Tip' : 'Type'}</th>
                            <th>{bs ? 'Datum' : 'Date'}</th>
                            <th>{bs ? 'Vozač' : 'Driver'}</th>
                            <th>{bs ? 'Relacija' : 'Route'}</th>
                            <th style={{ width: 120 }}>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>{bs ? 'Nema kreiranih naloga' : 'No travel orders yet'}</td></tr>
                        ) : orders.map(o => (
                            <tr key={o.id}>
                                <td style={{ fontWeight: 700 }}>{o.brojNaloga}</td>
                                <td><span className="badge badge-info">{o.tipObrasca}</span></td>
                                <td>{formatDate(o.datumIzdavanja)}</td>
                                <td>{o.workerIme}</td>
                                <td>{o.relacija}</td>
                                <td>
                                    <button className="btn btn-primary btn-icon btn-sm" onClick={() => handlePrint(o)} title={bs ? 'Isprintaj nalog' : 'Print'} style={{ marginRight: 6 }}>
                                        🖨️
                                    </button>
                                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(o.id)} style={{ color: 'var(--danger)' }} title={bs ? 'Obriši' : 'Delete'}>
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
