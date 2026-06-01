import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { create, update, remove, COLLECTIONS, formatDate } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import DateInput from '@/components/DateInput';
import TimeInput from '@/components/TimeInput';

export default function VehicleAssignmentsTab({ vehicleId, vehicles, assignments, workers, reloadData }) {
    const { t, lang } = useLanguage();
    
    const { confirm, prompt, DialogRenderer } = useDialog();

    const vehicle = vehicles.find(v => v.id === vehicleId) || {};
    const history = assignments.filter(a => a.vehicleId === vehicleId).sort((a,b) => new Date(b.datumZaduzenja) - new Date(a.datumZaduzenja));
    const activeAssig = history.find(a => !a.datumRazduzenja);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ workerId: '', workerIme: '', datumZaduzenja: new Date().toISOString().split('T')[0], vrijemeZaduzenja: new Date().toTimeString().slice(0, 5), pocetnaKilometraza: '', datumRazduzenja: '', vrijemeRazduzenja: '', zavrsnaKilometraza: '' });
    
    // action menu
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

    // bulk actions
    const [selectedIds, setSelectedIds] = useState(new Set());
    const toggleAll = (e) => setSelectedIds(e.target.checked ? new Set(history.map(x => x.id)) : new Set());
    const toggleOne = (id) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(t('deleteRecords').replace('{0}', selectedIds.size))) {
            for (let id of selectedIds) remove(COLLECTIONS.VEHICLE_ASSIGNMENTS, id);
            setSelectedIds(new Set());
            reloadData();
        }
    };

    // worker dropdown
    const [search, setSearch] = useState('');
    const [showW, setShowW] = useState(false);
    const workerRef = useRef(null);

    const filteredWorkers = workers.filter(w => (search ? `${w.ime} ${w.prezime}`.toLowerCase().includes(search.toLowerCase()) : true));

    const handleAssign = async () => {
        if (!form.workerId) {
            alert("Odaberite vozača!");
            return;
        }

        if (editingId) {
            update(COLLECTIONS.VEHICLE_ASSIGNMENTS, editingId, {
                workerId: form.workerId,
                workerIme: form.workerIme,
                datumZaduzenja: form.datumZaduzenja,
                vrijemeZaduzenja: form.vrijemeZaduzenja || '',
                pocetnaKilometraza: form.pocetnaKilometraza,
                datumRazduzenja: form.datumRazduzenja || '',
                vrijemeRazduzenja: form.vrijemeRazduzenja || '',
                zavrsnaKilometraza: form.zavrsnaKilometraza || ''
            });

            if (!form.datumRazduzenja) {
                update(COLLECTIONS.VEHICLES, vehicleId, { vozacId: form.workerId, vozacIme: form.workerIme });
            }
        } else {
            create(COLLECTIONS.VEHICLE_ASSIGNMENTS, {
                vehicleId,
                workerId: form.workerId,
                workerIme: form.workerIme,
                datumZaduzenja: form.datumZaduzenja,
                vrijemeZaduzenja: form.vrijemeZaduzenja || '',
                pocetnaKilometraza: form.pocetnaKilometraza,
                datumRazduzenja: '',
                vrijemeRazduzenja: '',
                zavrsnaKilometraza: ''
            });
            update(COLLECTIONS.VEHICLES, vehicleId, { vozacId: form.workerId, vozacIme: form.workerIme });
        }
        
        setShowForm(false);
        setEditingId(null);
        reloadData();
    };

    const handleUnassign = (assig) => {
        setEditingId(assig.id);
        setForm({
            ...form,
            workerId: assig.workerId,
            workerIme: assig.workerIme,
            datumZaduzenja: assig.datumZaduzenja || '',
            vrijemeZaduzenja: assig.vrijemeZaduzenja || '',
            pocetnaKilometraza: assig.pocetnaKilometraza || '',
            datumRazduzenja: new Date().toISOString().split('T')[0],
            vrijemeRazduzenja: new Date().toTimeString().slice(0, 5),
            zavrsnaKilometraza: ''
        });
        setSearch(assig.workerIme);
        setShowForm(true);
    };

    const handleDelete = async (assigId) => {
        if (await confirm(t('deleteHistoryRecord'))) {
            remove(COLLECTIONS.VEHICLE_ASSIGNMENTS, assigId);
            reloadData();
        }
    };

    const handleEdit = (assig) => {
        setEditingId(assig.id);
        setForm({
            workerId: assig.workerId,
            workerIme: assig.workerIme,
            datumZaduzenja: assig.datumZaduzenja || '',
            vrijemeZaduzenja: assig.vrijemeZaduzenja || '',
            pocetnaKilometraza: assig.pocetnaKilometraza || '',
            datumRazduzenja: assig.datumRazduzenja || '',
            vrijemeRazduzenja: assig.vrijemeRazduzenja || '',
            zavrsnaKilometraza: assig.zavrsnaKilometraza || ''
        });
        setSearch(assig.workerIme);
        setShowForm(true);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DialogRenderer />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px 0' }}>{t('assignmentHistory')}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {t('spaceForAssigningDriversAnd')}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {selectedIds.size> 0 && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {t('odabrano1')}</span>
                            <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {t('obrisi')}</button>
                        </div>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => { setEditingId(null); setShowForm(true); setForm({ workerId: '', workerIme: '', datumZaduzenja: new Date().toISOString().split('T')[0], vrijemeZaduzenja: new Date().toTimeString().slice(0, 5), pocetnaKilometraza: '', datumRazduzenja: '', vrijemeRazduzenja: '', zavrsnaKilometraza: '' }); setSearch(''); }}>
                        + {t('novoZaduzenje')}
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay" style={{ zIndex: 12000 }} onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? (t('urediZaduzenje')) : (t('novoZaduzenje'))}</h2>
                            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                                <div className="form-group" ref={workerRef} style={{ position: 'relative' }}>
                                    <label className="form-label">{t('assignTo')} <span style={{color:'var(--danger)'}}>*</span></label>
                                    <input className="form-input" placeholder={t('searchWorkers')} value={search} onChange={e => { setSearch(e.target.value); setShowW(true); setForm(f => ({...f, workerId: '', workerIme: ''})); }} onFocus={() => setShowW(true)} />
                                    {showW && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)', borderRadius: 'var(--radius-sm)' }}>
                                            {filteredWorkers.length === 0 ? <div style={{ padding: 8 }}>{t('nemaRezultata')}</div> : filteredWorkers.slice(0, 10).map(w => (
                                                <div key={w.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }} onClick={() => { setForm(f => ({...f, workerId: w.id, workerIme: `${w.ime} ${w.prezime}`})); setSearch(`${w.ime} ${w.prezime}`); setShowW(false); }}>
                                                    {w.ime} {w.prezime}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {form.workerId && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>✓ {form.workerIme}</div>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('assignedDateTime')} <span style={{color:'var(--danger)'}}>*</span></label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                                        <DateInput value={form.datumZaduzenja} onChange={v => setForm(f => ({...f, datumZaduzenja: v}))} />
                                        <TimeInput value={form.vrijemeZaduzenja} onChange={v => setForm(f => ({...f, vrijemeZaduzenja: v}))} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('startingMileage')}</label>
                                    <input className="form-input" type="number" value={form.pocetnaKilometraza} onChange={e => setForm(f => ({...f, pocetnaKilometraza: e.target.value}))} />
                                </div>
                                {editingId && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">{t('returnDateTime')}</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                                                <DateInput value={form.datumRazduzenja} onChange={v => setForm(f => ({...f, datumRazduzenja: v}))} />
                                                <TimeInput value={form.vrijemeRazduzenja} onChange={v => setForm(f => ({...f, vrijemeRazduzenja: v}))} />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">{t('endingMileage')}</label>
                                            <input className="form-input" type="number" value={form.zavrsnaKilometraza} onChange={e => setForm(f => ({...f, zavrsnaKilometraza: e.target.value}))} />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '16px 24px', background: 'var(--bg-card)' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                            <button type="button" className="btn btn-primary" onClick={handleAssign}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="data-table-wrapper" style={{ marginTop: 8 }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === history.length && history.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                            <th>{t('driver2')}</th>
                            <th>{t('assignedOn')}</th>
                            <th>{t('startKm')}</th>
                            <th>{t('returnedOn')}</th>
                            <th>{t('endKm')}</th>
                            <th style={{ width: 100 }}>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>{t('noHistoryFound')}</td></tr>
                        ) : history.map((h, i) => (
                            <tr key={h.id} style={{ opacity: (!h.datumRazduzenja || i===0) ? 1 : 0.75, cursor: 'pointer' }}
                                onClick={() => handleEdit(h)}>
                                <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                    <input type="checkbox" checked={selectedIds.has(h.id)} onChange={() => toggleOne(h.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                </td>
                                <td style={{ fontWeight: 700 }}>
                                    {h.workerIme} 
                                    {!h.datumRazduzenja && <span className="badge badge-success" style={{ marginLeft: 6 }}>Aktivno</span>}
                                </td>
                                <td><div style={{fontWeight:600}}>{formatDate(h.datumZaduzenja)}</div>{h.vrijemeZaduzenja && <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{h.vrijemeZaduzenja} h</div>}</td>
                                <td>{h.pocetnaKilometraza ? `${h.pocetnaKilometraza} km` : '—'}</td>
                                <td><div style={{fontWeight:600}}>{h.datumRazduzenja ? formatDate(h.datumRazduzenja) : '—'}</div>{h.vrijemeRazduzenja && <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{h.vrijemeRazduzenja} h</div>}</td>
                                <td>{h.zavrsnaKilometraza ? `${h.zavrsnaKilometraza} km` : '—'}</td>
                                <td onClick={e => e.stopPropagation()}>
                                    <div style={{ position: 'relative' }}>
                                        <button className="btn btn-primary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={(e) => {
                                            if (actionMenuId === h.id) { setActionMenuId(null); return; }
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const spaceBelow = window.innerHeight - rect.bottom - 8;
                                            const flipUp = spaceBelow < 150;
                                            setMenuPos(flipUp
                                                ? { bottom: window.innerHeight - rect.top + 4, left: rect.left - 60, maxH: Math.max(120, rect.top - 8) }
                                                : { top: rect.bottom + 4, left: rect.left - 60, maxH: Math.max(120, spaceBelow - 15) });
                                            setActionMenuId(h.id);
                                        }}>{t('akcije')} ▼</button>

                                        {actionMenuId === h.id && (
                                            <>
                                                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setActionMenuId(null)} />
                                                <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 160, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                    <button onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleEdit(h); }} className="dropdown-item">✏️ {t('uredi')}</button>
                                                    <button onClick={(e) => { e.stopPropagation(); setActionMenuId(null); setEditingId(null); setForm({ workerId: h.workerId, workerIme: h.workerIme, datumZaduzenja: new Date().toISOString().split('T')[0], vrijemeZaduzenja: new Date().toTimeString().slice(0, 5), pocetnaKilometraza: h.zavrsnaKilometraza || '', datumRazduzenja: '', vrijemeRazduzenja: '', zavrsnaKilometraza: '' }); setSearch(h.workerIme); setShowForm(true); }} className="dropdown-item">📋 {t('kopiraj')}</button>
                                                    {!h.datumRazduzenja && <button onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleUnassign(h); }} className="dropdown-item">↩️ {t('unassign')}</button>}
                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                    <button onClick={(e) => { e.stopPropagation(); setActionMenuId(null); handleDelete(h.id); }} className="dropdown-item text-danger">🗑️ {t('izbrisi')}</button>
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
