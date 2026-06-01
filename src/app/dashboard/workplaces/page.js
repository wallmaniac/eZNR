'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCountry } from '@/contexts/CountryContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS,
    getWorkersInWorkplace,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useSortedList } from '@/hooks/useSortedList';
import PageHeader from '@/components/PageHeader';

const emptyWP = {
    naziv: '', oznaka: '', strucnaSprema: '', grupaRM: '',
    radNaRacunalu: false, posebniUvjetiRada: false, orgUnitId: '',
    radnoVrijemeOd: '08:00', radnoVrijemeDo: '16:00',
    opis: '',
};

function isNightShift(odStr, doStr) {
    if (!odStr || !doStr) return false;
    const start = parseInt((odStr || '').replace(':', ''));
    const end = parseInt((doStr || '').replace(':', ''));
    if (isNaN(start) || isNaN(end)) return false;
    if (start> end) return true; // Spans midnight
    if (start < 600 || end>= 2200) return true; // Touches 00:00-06:00 or>= 22:00
    return false;
}

export default function WorkplacesPage() {
    const { t, lang } = useLanguage();
    const country = useCountry();
    const { alert, confirm, DialogRenderer } = useDialog();
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [returnPath, setReturnPath] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyWP });
    const [searchTerm, setSearchTerm] = useState('');
    const [showActive, setShowActive] = useState(false);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, maxH: 300 });
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Workers panel state
    const [workersPanel, setWorkersPanel] = useState(null); // workplace object
    const [viewWorkerId, setViewWorkerId] = useState(null);

    const loadData = useCallback(() => {
        setItems(getAll(COLLECTIONS.WORKPLACES));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    const toggleAll = () => {
        const allIds = new Set(sortedWP.map(w => w.id));
        setSelectedIds(prev => prev.size === sortedWP.length ? new Set() : allIds);
    };
    const toggleOne = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        const ok = await confirm(t('deleteWorkplaces').replace('{0}', selectedIds.size));
        if (ok) {
            for (const id of selectedIds) remove(COLLECTIONS.WORKPLACES, id);
            setSelectedIds(new Set());
            loadData();
        }
    };

    const filtered = items.filter(w =>
        !searchTerm || w.naziv.toLowerCase().includes(searchTerm.toLowerCase()) || (w.oznaka || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const { sorted: sortedWP, toggleSort: tWP, sortIcon: siWP, thStyle: tsWP } = useSortedList(filtered, 'naziv');

    const getWorkersForWP = (wp) =>
        workers.filter(w =>
            w.aktivan !== false &&
            (w.radnoMjestoId === wp.id || w.radnoMjesto === wp.naziv)
        );

    const handleNew = () => { setFormData({ ...emptyWP }); setEditingId(null); setShowForm(true); };
    const handleEdit = (item) => { setFormData({ ...item }); setEditingId(item.id); setShowForm(true); setActionMenuId(null); };
    const handleDelete = async (id) => {
        const wpWorkers = getWorkersInWorkplace(id);
        if (wpWorkers.length> 0) {
            await alert(t('neMozeteObrisatiRadnoMjesto'));
            return;
        }
        const delOk = await confirm(t('jesteLiSigurni'));
        if (delOk) { remove(COLLECTIONS.WORKPLACES, id); setActionMenuId(null); loadData(); }
    };
    const handleSave = async () => {
        if (!formData.naziv) { await alert(t('nazivJeObaveznoPolje')); return; }
        if (editingId) { update(COLLECTIONS.WORKPLACES, editingId, formData); } else { create(COLLECTIONS.WORKPLACES, formData); }
        setShowForm(false); loadData();
    };
    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    const openWorkersPanel = (wp) => { setWorkersPanel(wp); setActionMenuId(null); };

    const panelWorkers = workersPanel ? getWorkersForWP(workersPanel) : [];

    const menuItemSt = {
        display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
        color: 'var(--text)', fontFamily: 'var(--font-body)', transition: 'background 0.12s',
    };

    // Generiši dokumente — generates a print-friendly summary for selected workplaces
    const handleGenerateDocuments = () => {
        const selected = sortedWP.filter(w => selectedIds.has(w.id));
        if (selected.length === 0) return;
        const allPPE = getAll(COLLECTIONS.PPE_ITEMS) || [];
        const allOrgUnits = getAll(COLLECTIONS.ORG_UNITS);
        const win = window.open('', '_blank');
        const html = selected.map(wp => {
            const wpWorkers = getWorkersForWP(wp);
            const ouName = allOrgUnits.find(o => o.id === wp.orgUnitId)?.naziv || '-';
            const ppeForWP = allPPE.filter(p => p.workplaceId === wp.id || p.radnoMjestoId === wp.id);
            return `<div style="page-break-after:always;font-family:Arial,sans-serif;padding:30px">
                <h1 style="border-bottom:2px solid #333;padding-bottom:8px">${wp.naziv}</h1>
                <table style="width:100%;margin-bottom:20px;font-size:14px">
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700;width:200px">${t('oznaka')}:</td><td>${wp.oznaka || '-'}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">${t('strucnaSprema')}:</td><td>${wp.strucnaSprema || '-'}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">${t('grupaRm')}:</td><td>${wp.grupaRM || '-'}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">${t('orgUnit')}:</td><td>${ouName}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">${t('radNaRacunalu')}:</td><td>${wp.radNaRacunalu ? t('yes') : t('no')}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">${t('posebniUvjetiRada')}:</td><td>${wp.posebniUvjetiRada ? t('yes') : t('no')}</td></tr>
                </table>
                <h3>${t('radnici')} (${wpWorkers.length})</h3>
                ${wpWorkers.length === 0 ? `<p style="color:#888">${t('nemaRadnikaNaOvomRadnom')}</p>` : 
                    `<table style="width:100%;border-collapse:collapse;font-size:13px">
                        <tr style="background:#f0f0f0"><th style="text-align:left;padding:6px;border:1px solid #ddd">${t('br')}</th><th style="text-align:left;padding:6px;border:1px solid #ddd">${t('worker')}</th><th style="text-align:left;padding:6px;border:1px solid #ddd">${t('evBroj')}</th><th style="text-align:left;padding:6px;border:1px solid #ddd">${t('orgUnit')}</th></tr>
                        ${wpWorkers.map((wk, i) => {
                            const wkOu = allOrgUnits.find(o => o.id === wk.orgJedinicaId)?.naziv || '-';
                            return `<tr><td style="padding:4px 6px;border:1px solid #ddd">${i+1}</td><td style="padding:4px 6px;border:1px solid #ddd">${wk.ime} ${wk.prezime}</td><td style="padding:4px 6px;border:1px solid #ddd">${wk.evidencijskiBroj || '-'}</td><td style="padding:4px 6px;border:1px solid #ddd">${wkOu}</td></tr>`;
                        }).join('')}
                    </table>`}
                ${ppeForWP.length> 0 ? `<h3 style="margin-top:20px">${t('zastitnaOpremaOzo1')}</h3>
                    <ul>${ppeForWP.map(p => `<li>${t(p.naziv?.trim()) || p.naziv || p.name || '-'}</li>`).join('')}</ul>` : ''}
            </div>`;
        }).join('');
        win.document.write(`<html><head><title>${t('workplaces')} - ${t('digitalArchive')}</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
    };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>🔧 {t('workplaces')}</h1>

            {/* Workers Panel Modal */}
            {workersPanel && (
                <div className="modal-overlay" onClick={() => setWorkersPanel(null)}>
                    <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2>👥 {t('radnici')} — {workersPanel.naziv}</h2>
                                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                                    {panelWorkers.length} {t('zaposlenihNaOvomRadnomMjestu')}
                                    {workersPanel.strucnaSprema ? ` · ${t('zahtjSss')}: ${workersPanel.strucnaSprema}` : ''}
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setWorkersPanel(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: 0, maxHeight: 480, overflowY: 'auto' }}>
                            {panelWorkers.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {t('nemaRadnikaNaOvomRadnom')}
                                </div>
                            ) : panelWorkers.map((w, idx) => {
                                const ou = getAll(COLLECTIONS.ORG_UNITS).find(o => o.id === w.orgJedinicaId);
                                return (
                                    <div key={w.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: '12px 20px',
                                            borderBottom: idx < panelWorkers.length - 1 ? '1px solid var(--border-light)' : 'none',
                                            cursor: 'pointer', transition: 'background 0.15s',
                                        }}
                                        
                                        
                                        onClick={() => { setViewWorkerId(w.id); }}>
                                        <div style={{
                                            width: 42, height: 42, borderRadius: '50%',
                                            background: 'linear-gradient(135deg, var(--primary), #4CAF50)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                                        }}>
                                            {w.ime?.[0]}{w.prezime?.[0]}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text)' }}>
                                                {w.ime} {w.prezime}
                                            </div>
                                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                {ou ? ou.naziv : ''}
                                                {w.evidencijskiBroj ? `${ou ? ' · ' : ''}Ev.br: ${w.evidencijskiBroj}` : ''}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600 }}>
                                            {t('otvori1')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setWorkersPanel(null)}>{t('zatvori')}</button>
                            <button className="btn btn-primary" onClick={() => { setWorkersPanel(null); router.push('/dashboard/workers'); }}>
                                👥 {t('sviRadnici')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Worker Profile Modal */}
            {viewWorkerId && (
                <WorkerProfileModal
                    workerId={viewWorkerId}
                    onClose={() => setViewWorkerId(null)}
                    onSaved={() => { loadData(); setViewWorkerId(null); }}
                />
            )}

            {/* Form Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => { setShowForm(false); if(returnPath) { router.push(returnPath); setReturnPath(null); } }}>
                    <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '✏️' : '+'} {t('radnoMjesto')}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowForm(false); if(returnPath) { router.push(returnPath); setReturnPath(null); } }}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid-2">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={e => updateField('naziv', e.target.value)} placeholder={t('mandatory')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('oznaka')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.oznaka} onChange={e => updateField('oznaka', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('zahtjevanaStrucnaSprema')}</label>
                                    <select className="form-select" value={formData.strucnaSprema} onChange={e => updateField('strucnaSprema', e.target.value)}>
                                        <option value="">-</option>
                                        <option value="NKV">NKV</option><option value="PKV">PKV</option>
                                        <option value="KV">KV</option><option value="SSS">SSS</option>
                                        <option value="VŠS">VŠS</option><option value="VSS">VSS</option>
                                        <option value="MR">MR</option><option value="DR">DR</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('grupaRm')}</label>
                                    <input className="form-input" value={formData.grupaRM} onChange={e => updateField('grupaRM', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('orgUnit')}</label>
                                    <select className="form-select" value={formData.orgUnitId} onChange={e => updateField('orgUnitId', e.target.value)}>
                                        <option value="">-</option>
                                        {getAll(COLLECTIONS.ORG_UNITS).map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(120px, 1fr) 2fr', gap: 16 }}>
                                    <div>
                                        <label className="form-label">{t('radnoVrijemeOd')}</label>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <select className="form-select" style={{ padding: '8px', minWidth: 60 }} value={(formData.radnoVrijemeOd || ':').split(':')[0] || '08'} onChange={e => updateField('radnoVrijemeOd', `${e.target.value}:${(formData.radnoVrijemeOd || ':').split(':')[1] || '00'}`)}>
                                                {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>)}
                                            </select>
                                            <span style={{ fontWeight: 700 }}>:</span>
                                            <select className="form-select" style={{ padding: '8px', minWidth: 60 }} value={(formData.radnoVrijemeOd || ':').split(':')[1] || '00'} onChange={e => updateField('radnoVrijemeOd', `${(formData.radnoVrijemeOd || ':').split(':')[0] || '08'}:${e.target.value}`)}>
                                                {['00','15','30','45'].map(min => <option key={min} value={min}>{min}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">{t('radnoVrijemeDo')}</label>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            <select className="form-select" style={{ padding: '8px', minWidth: 60 }} value={(formData.radnoVrijemeDo || ':').split(':')[0] || '16'} onChange={e => updateField('radnoVrijemeDo', `${e.target.value}:${(formData.radnoVrijemeDo || ':').split(':')[1] || '00'}`)}>
                                                {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>)}
                                            </select>
                                            <span style={{ fontWeight: 700 }}>:</span>
                                            <select className="form-select" style={{ padding: '8px', minWidth: 60 }} value={(formData.radnoVrijemeDo || ':').split(':')[1] || '00'} onChange={e => updateField('radnoVrijemeDo', `${(formData.radnoVrijemeDo || ':').split(':')[0] || '16'}:${e.target.value}`)}>
                                                {['00','15','30','45'].map(min => <option key={min} value={min}>{min}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ alignSelf: 'flex-end', paddingBottom: 6, minWidth: 160 }}>
                                        {isNightShift(formData.radnoVrijemeOd, formData.radnoVrijemeDo) && (
                                            <div style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', fontWeight: 600 }}>
                                                🌙 {t('nocniRad1')}
                                                <div style={{ fontSize: '0.7rem', fontWeight: 400, marginTop: 2 }}>{t('obvezniLjekarskiNajmanje1xU')}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.radNaRacunalu} onChange={e => updateField('radNaRacunalu', e.target.checked)} />
                                        {t('radNaRacunalu')}
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.posebniUvjetiRada} onChange={e => updateField('posebniUvjetiRada', e.target.checked)} />
                                        {t('posebniUvjetiRada')}
                                    </label>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">{t('description')}</label>
                                    <textarea className="form-textarea" value={formData.opis || ''} onChange={e => updateField('opis', e.target.value)} rows={3} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => { setShowForm(false); if(returnPath) { router.push(returnPath); setReturnPath(null); } }}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={handleNew} title={t('dodajNovoRadnoMjesto')}>+ {t('novoRadnoMjesto')}</button>
                        <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                            {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title={t('ponistiPretragu')}>✕</button>}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0 }}>
                            <input type="checkbox" checked={showActive} onChange={e => setShowActive(e.target.checked)} />
                            {t('prikaziAktivne')}
                        </label>
                        {selectedIds.size> 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selectedIds.size} {t('odabrano')}:
                                </span>
                                <button className="btn btn-primary" style={{ height: 38 }} onClick={handleGenerateDocuments} title={t('generirajDokumente')}>📄 {t('dokumenti1')}</button>
                                <button className="btn btn-primary" style={{ height: 38 }} onClick={() => window.print()} title={t('isprintajOdabrano')}>🖨️ {t('isprintaj')}</button>
                                <button className="btn btn-danger" style={{ height: 38 }} onClick={handleDeleteSelected} title={t('obrisiOdabranaRadnaMjesta')}>🗑️ {t('obrisi')}</button>
                            </div>
                        )}
                        {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}></span>}
                    </div>

                    <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sortedWP.length && sortedWP.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th style={tsWP('naziv')} onClick={() => tWP('naziv')}>{t('name')}{siWP('naziv')}</th>
                                    <th style={tsWP('strucnaSprema')} onClick={() => tWP('strucnaSprema')}>{t('strucnaSprema')}{siWP('strucnaSprema')}</th>
                                    <th>{t('radnoVrijeme')}</th>
                                    <th style={tsWP('grupaRM')} onClick={() => tWP('grupaRM')}>{t('grupaRm')}{siWP('grupaRM')}</th>
                                    <th>{t('radnici')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedWP.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sortedWP.map((w) => {
                                    const count = getWorkersInWorkplace(w.id).length;
                                    return (
                                        <tr key={w.id} onClick={() => handleEdit(w)} style={{ cursor: 'pointer', transition: 'background 0.12s' }}>
                                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(w.id)} onChange={() => toggleOne(w.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} /></td>
                                            <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={e => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const spaceBelow = window.innerHeight - rect.bottom;
                                                    const spaceAbove = rect.top;
                                                    const flipUp = spaceBelow < 280 && spaceAbove> spaceBelow;
                                                    setMenuPos(flipUp
                                                        ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                                                        : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                                                    );
                                                    setActionMenuId(actionMenuId === w.id ? null : w.id);
                                                }} title={t('prikaziAkcijeZaRadnoMjesto')}>
                                                    {t('actions')} ▼
                                                </button>
                                                {actionMenuId === w.id && (
                                                    <>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setActionMenuId(null)} />
                                                    <div data-menu onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                        <button onClick={() => handleEdit(w)} className="dropdown-item">📂 {t('open')}</button>
                                                        <button onClick={() => openWorkersPanel(w)} className="dropdown-item">👥 {t('pregledRadnika')}</button>
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => { setActionMenuId(null); handleDelete(w.id); }} className="dropdown-item text-danger">🗑️ {t('delete')}</button>
                                                    </div>
                                                    </>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{w.naziv}</td>
                                            <td>{w.strucnaSprema || '-'}</td>
                                            <td>
                                                <div style={{ fontSize: '0.85rem' }}>{w.radnoVrijemeOd || '08:00'} - {w.radnoVrijemeDo || '16:00'}</div>
                                                {isNightShift(w.radnoVrijemeOd, w.radnoVrijemeDo) && <span style={{ fontSize: '0.65rem', background: 'rgba(239,83,80,0.15)', color: 'var(--danger)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>🌙 LJEKARSKI (NOĆNI RAD)</span>}
                                            </td>
                                            <td>{w.grupaRM || '-'}</td>
                                            {/* Clickable badge */}
                                            <td onClick={e => e.stopPropagation()}>
                                                <button onClick={() => openWorkersPanel(w)} style={{ background: 'none', border: 'none', cursor: count> 0 ? 'pointer' : 'default', padding: 0 }}>
                                                    <span className={`badge ${count> 0 ? 'badge-primary' : 'badge-info'}`}
                                                        style={{ cursor: count> 0 ? 'pointer' : 'default', transition: 'transform 0.15s' }}
                                                        onMouseEnter={e => count> 0 && (e.target.style.transform = 'scale(1.1)')}
                                                        onMouseLeave={e => (e.target.style.transform = 'scale(1)')}>
                                                        {count} {count> 0 ? '👁' : ''}
                                                    </span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: '0.85rem' }}>
                        <button onClick={() => router.push('/dashboard/ppe')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', textDecoration: 'underline' }}>{t('zastitnaOpremaOzo1')}</button>
                        <button onClick={() => router.push('/dashboard/worker-ppe')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', textDecoration: 'underline' }}>{t('ozoDodijeljenaRadnicima')}</button>
                    </div>

                    <div className="pagination" style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            1 - {filtered.length} {t('of')} {filtered.length} {t('records')}
                        </div>
                    </div>
                </div>
            </div>
            <DialogRenderer />
        </div>
    );
}
