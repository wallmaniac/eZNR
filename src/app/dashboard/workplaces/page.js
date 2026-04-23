'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS,
    getWorkersInWorkplace,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useSortedList } from '@/hooks/useSortedList';

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
    if (start > end) return true; // Spans midnight
    if (start < 600 || end >= 2200) return true; // Touches 00:00-06:00 or >= 22:00
    return false;
}

export default function WorkplacesPage() {
    const { t, lang } = useLanguage();
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
        const ok = await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} radnih mjesta?` : `Delete ${selectedIds.size} workplaces?`);
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
        if (wpWorkers.length > 0) {
            await alert(lang === 'bs' ? 'Ne možete obrisati radno mjesto koje ima zaposlenike.' : 'Cannot delete workplace with assigned workers.');
            return;
        }
        const delOk = await confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?');
        if (delOk) { remove(COLLECTIONS.WORKPLACES, id); setActionMenuId(null); loadData(); }
    };
    const handleSave = async () => {
        if (!formData.naziv) { await alert(lang === 'bs' ? 'Naziv je obavezno polje!' : 'Name is required!'); return; }
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
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700;width:200px">Oznaka:</td><td>${wp.oznaka || '-'}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">Stru\u010dna sprema:</td><td>${wp.strucnaSprema || '-'}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">Grupa RM:</td><td>${wp.grupaRM || '-'}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">Org. jedinica:</td><td>${ouName}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">Rad na ra\u010dunalu:</td><td>${wp.radNaRacunalu ? 'Da' : 'Ne'}</td></tr>
                    <tr><td style="padding:4px 12px 4px 0;font-weight:700">Posebni uvjeti rada:</td><td>${wp.posebniUvjetiRada ? 'Da' : 'Ne'}</td></tr>
                </table>
                <h3>Zaposlenici (${wpWorkers.length})</h3>
                ${wpWorkers.length === 0 ? '<p style="color:#888">Nema zaposlenika na ovom radnom mjestu.</p>' : 
                    `<table style="width:100%;border-collapse:collapse;font-size:13px">
                        <tr style="background:#f0f0f0"><th style="text-align:left;padding:6px;border:1px solid #ddd">R.br.</th><th style="text-align:left;padding:6px;border:1px solid #ddd">Ime i prezime</th><th style="text-align:left;padding:6px;border:1px solid #ddd">Ev. broj</th><th style="text-align:left;padding:6px;border:1px solid #ddd">Org. jedinica</th></tr>
                        ${wpWorkers.map((wk, i) => {
                            const wkOu = allOrgUnits.find(o => o.id === wk.orgJedinicaId)?.naziv || '-';
                            return `<tr><td style="padding:4px 6px;border:1px solid #ddd">${i+1}</td><td style="padding:4px 6px;border:1px solid #ddd">${wk.ime} ${wk.prezime}</td><td style="padding:4px 6px;border:1px solid #ddd">${wk.evidencijskiBroj || '-'}</td><td style="padding:4px 6px;border:1px solid #ddd">${wkOu}</td></tr>`;
                        }).join('')}
                    </table>`}
                ${ppeForWP.length > 0 ? `<h3 style="margin-top:20px">Za\u0161titna oprema</h3>
                    <ul>${ppeForWP.map(p => `<li>${p.naziv || p.name || '-'}</li>`).join('')}</ul>` : ''}
            </div>`;
        }).join('');
        win.document.write(`<html><head><title>Radna mjesta - dokumenti</title></head><body>${html}</body></html>`);
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
                                <h2>👥 {lang === 'bs' ? 'Radnici' : 'Workers'} — {workersPanel.naziv}</h2>
                                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                                    {panelWorkers.length} {lang === 'bs' ? 'zaposlenih na ovom radnom mjestu' : 'employees at this workplace'}
                                    {workersPanel.strucnaSprema ? ` · ${lang === 'bs' ? 'Zahtj. SSS' : 'Req. edu'}: ${workersPanel.strucnaSprema}` : ''}
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setWorkersPanel(null)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ padding: 0, maxHeight: 480, overflowY: 'auto' }}>
                            {panelWorkers.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {lang === 'bs' ? 'Nema radnika na ovom radnom mjestu.' : 'No workers at this workplace.'}
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
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        onClick={() => { setViewWorkerId(w.id); }}
                                    >
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
                                            {lang === 'bs' ? 'Otvori →' : 'Open →'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setWorkersPanel(null)}>{lang === 'bs' ? 'Zatvori' : 'Close'}</button>
                            <button className="btn btn-primary" onClick={() => { setWorkersPanel(null); router.push('/dashboard/workers'); }}>
                                👥 {lang === 'bs' ? 'Svi radnici' : 'All workers'}
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
                            <h2>{editingId ? '✏️' : '+'} {lang === 'bs' ? 'Radno mjesto' : 'Workplace'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => { setShowForm(false); if(returnPath) { router.push(returnPath); setReturnPath(null); } }}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.naziv} onChange={e => updateField('naziv', e.target.value)} placeholder={t('mandatory')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>{lang === 'bs' ? 'Oznaka' : 'Code'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" value={formData.oznaka} onChange={e => updateField('oznaka', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Zahtjevana stručna sprema' : 'Required education'}</label>
                                    <select className="form-select" value={formData.strucnaSprema} onChange={e => updateField('strucnaSprema', e.target.value)}>
                                        <option value="">-</option>
                                        <option value="NKV">NKV</option><option value="PKV">PKV</option>
                                        <option value="KV">KV</option><option value="SSS">SSS</option>
                                        <option value="VŠS">VŠS</option><option value="VSS">VSS</option>
                                        <option value="MR">MR</option><option value="DR">DR</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Grupa RM' : 'Workplace Group'}</label>
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
                                        <label className="form-label">{lang === 'bs' ? 'Radno vrijeme od' : 'Work from'}</label>
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
                                        <label className="form-label">{lang === 'bs' ? 'Radno vrijeme do' : 'Work to'}</label>
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
                                                🌙 Nocni rad (čl. 40 FBiH)
                                                <div style={{ fontSize: '0.7rem', fontWeight: 400, marginTop: 2 }}>Zakon FBiH čl. 40: Obvezni ljekarski najmanje 1x u 2 godine.</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.radNaRacunalu} onChange={e => updateField('radNaRacunalu', e.target.checked)} />
                                        {lang === 'bs' ? 'Rad na računalu' : 'Computer work'}
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.posebniUvjetiRada} onChange={e => updateField('posebniUvjetiRada', e.target.checked)} />
                                        {lang === 'bs' ? 'Posebni uvjeti rada' : 'Special working conditions'}
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
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {lang === 'bs' ? 'Novo radno mjesto' : 'New Workplace'}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                            <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={showActive} onChange={e => setShowActive(e.target.checked)} />
                            {lang === 'bs' ? 'Prikaži aktivne' : 'Show active'}
                        </label>
                        {selectedIds.size > 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'} &mdash; Grupne akcije:
                                </span>
                                <button className="btn btn-primary btn-sm" onClick={handleGenerateDocuments}>📄 {lang === 'bs' ? 'Generiši dokumente' : 'Generate documents'}</button>
                                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ {lang === 'bs' ? 'Isprintaj' : 'Print'}</button>
                                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                            </div>
                        )}
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sortedWP.length && sortedWP.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th style={tsWP('naziv')} onClick={() => tWP('naziv')}>{t('name')}{siWP('naziv')}</th>
                                    <th style={tsWP('strucnaSprema')} onClick={() => tWP('strucnaSprema')}>{lang === 'bs' ? 'Stručna sprema' : 'Education'}{siWP('strucnaSprema')}</th>
                                    <th>{lang === 'bs' ? 'Radno vrijeme' : 'Shift'}</th>
                                    <th style={tsWP('grupaRM')} onClick={() => tWP('grupaRM')}>{lang === 'bs' ? 'Grupa RM' : 'WP Group'}{siWP('grupaRM')}</th>
                                    <th>{lang === 'bs' ? 'Radnici' : 'Workers'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedWP.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sortedWP.map((w) => {
                                    const count = getWorkersInWorkplace(w.id).length;
                                    return (
                                        <tr key={w.id} onClick={() => handleEdit(w)} style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(w.id)} onChange={() => toggleOne(w.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} /></td>
                                            <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onClick={e => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const spaceBelow = window.innerHeight - rect.bottom;
                                                    const spaceAbove = rect.top;
                                                    const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
                                                    setMenuPos(flipUp
                                                        ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                                                        : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                                                    );
                                                    setActionMenuId(actionMenuId === w.id ? null : w.id);
                                                }}>
                                                    {t('actions')} ▼
                                                </button>
                                                {actionMenuId === w.id && (
                                                    <>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setActionMenuId(null)} />
                                                    <div data-menu style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                        <button onClick={() => handleEdit(w)} style={menuItemSt}>📂 {t('open')}</button>
                                                        <button onClick={() => openWorkersPanel(w)} style={menuItemSt}>👥 {lang === 'bs' ? 'Pregled radnika' : 'View workers'}</button>
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => { setActionMenuId(null); handleDelete(w.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ {t('delete')}</button>
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
                                                <button onClick={() => openWorkersPanel(w)} style={{ background: 'none', border: 'none', cursor: count > 0 ? 'pointer' : 'default', padding: 0 }}>
                                                    <span className={`badge ${count > 0 ? 'badge-primary' : 'badge-info'}`}
                                                        style={{ cursor: count > 0 ? 'pointer' : 'default', transition: 'transform 0.15s' }}
                                                        onMouseEnter={e => count > 0 && (e.target.style.transform = 'scale(1.1)')}
                                                        onMouseLeave={e => (e.target.style.transform = 'scale(1)')}
                                                    >
                                                        {count} {count > 0 ? '👁' : ''}
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
                        <button onClick={() => router.push('/dashboard/ppe')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', textDecoration: 'underline' }}>{lang === 'bs' ? '→ Zaštitna oprema (OZO)' : '→ PPE / Protective equipment'}</button>
                        <button onClick={() => router.push('/dashboard/worker-ppe')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0, fontFamily: 'var(--font-body)', fontSize: '0.85rem', textDecoration: 'underline' }}>{lang === 'bs' ? '→ OZO dodijeljena radnicima' : '→ PPE per worker'}</button>
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
