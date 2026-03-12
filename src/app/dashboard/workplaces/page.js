'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS,
    getWorkersInWorkplace, getOrgUnitName,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useSortedList } from '@/hooks/useSortedList';

const emptyWP = {
    naziv: '', oznaka: '', strucnaSprema: '', grupaRM: '',
    radNaRacunalu: false, posebniUvjetiRada: false, orgUnitId: '',
    opis: '',
};

export default function WorkplacesPage() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyWP });
    const [searchTerm, setSearchTerm] = useState('');
    const [showActive, setShowActive] = useState(false);
    const [actionMenuId, setActionMenuId] = useState(null);
    const actionRef = useRef(null);

    // Workers panel state
    const [workersPanel, setWorkersPanel] = useState(null); // workplace object
    const [viewWorkerId, setViewWorkerId] = useState(null);

    const loadData = useCallback(() => {
        setItems(getAll(COLLECTIONS.WORKPLACES));
        setWorkers(getAll(COLLECTIONS.WORKERS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useEffect(() => {
        const handleClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

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
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '✏️' : '+'} {lang === 'bs' ? 'Radno mjesto' : 'Workplace'}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 24 }}>
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
                            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {t('add')}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                            <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={showActive} onChange={e => setShowActive(e.target.checked)} />
                            {lang === 'bs' ? 'Prikaži aktivne' : 'Show active'}
                        </label>
                        <div style={{ marginLeft: 'auto', position: 'relative' }}>
                            <button className="btn btn-dark btn-sm" onClick={() => {
                                const el = document.getElementById('group-action-menu');
                                if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                            }}>{t('selectGroupAction')} ▼</button>
                            <div id="group-action-menu" className="dropdown-menu" style={{ display: 'none', right: 0, top: 'calc(100% + 4px)', minWidth: 200 }}>
                                <button className="dropdown-item" onClick={async () => { await alert(lang === 'bs' ? 'Grupna akcija: Generisanje dokumenata' : 'Group action: Generate documents'); }}>📄 {t('generateDocuments')}</button>
                                <button className="dropdown-item" onClick={async () => { await alert(lang === 'bs' ? 'Grupna akcija: Slanje obavijesti' : 'Group action: Send notifications'); }}>✉️ {t('sendNotifications')}</button>
                                <div className="dropdown-divider" />
                                <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={async () => { const ok = await confirm(t('confirmDelete')); if (ok) await alert(lang === 'bs' ? 'Grupno brisanje' : 'Group delete'); }}>🗑️ {t('delete')}</button>
                            </div>
                        </div>
                    </div>

                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th style={tsWP('naziv')} onClick={() => tWP('naziv')}>{t('name')}{siWP('naziv')}</th>
                                    <th style={tsWP('strucnaSprema')} onClick={() => tWP('strucnaSprema')}>{lang === 'bs' ? 'Stručna sprema' : 'Education'}{siWP('strucnaSprema')}</th>
                                    <th style={tsWP('grupaRM')} onClick={() => tWP('grupaRM')}>{lang === 'bs' ? 'Grupa RM' : 'WP Group'}{siWP('grupaRM')}</th>
                                    <th>{lang === 'bs' ? 'Radnici' : 'Workers'}</th>
                                    <th><input type="checkbox" /></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedWP.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sortedWP.map((w) => {
                                    const count = getWorkersInWorkplace(w.id).length;
                                    return (
                                        <tr key={w.id}>
                                            <td style={{ position: 'relative' }} ref={actionMenuId === w.id ? actionRef : null}>
                                                <button className="btn btn-primary btn-sm" onClick={() => setActionMenuId(actionMenuId === w.id ? null : w.id)}>
                                                    {t('actions')} ▼
                                                </button>
                                                {actionMenuId === w.id && (
                                                    <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0 }}>
                                                        <button className="dropdown-item" onClick={() => handleEdit(w)}>📂 {t('open')}</button>
                                                        <button className="dropdown-item" onClick={() => openWorkersPanel(w)}>👥 {lang === 'bs' ? 'Pregled radnika' : 'View workers'}</button>
                                                        <div className="dropdown-divider" />
                                                        <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(w.id)}>🗑️ {t('delete')}</button>
                                                    </div>
                                                )}
                                            </td>
                                            {/* Clickable name */}
                                            <td style={{ fontWeight: 600 }}>
                                                <button
                                                    onClick={() => openWorkersPanel(w)}
                                                    style={{
                                                        background: 'none', border: 'none', cursor: 'pointer',
                                                        color: 'var(--text)', fontWeight: 600, fontSize: 'inherit',
                                                        textAlign: 'left', padding: 0, fontFamily: 'inherit',
                                                        textDecoration: 'underline', textDecorationStyle: 'dotted',
                                                        textDecorationColor: 'var(--text-muted)',
                                                    }}
                                                    title={lang === 'bs' ? 'Klikni za pregled radnika' : 'Click to view workers'}
                                                >
                                                    {w.naziv}
                                                </button>
                                            </td>
                                            <td>{w.strucnaSprema || '-'}</td>
                                            <td>{w.grupaRM || '-'}</td>
                                            {/* Clickable badge */}
                                            <td>
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
                                            <td><input type="checkbox" /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: '0.85rem' }}>
                        <a href="#" style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'Popis zahtjevane zaštitne opreme' : 'Required PPE list'}</a>
                        <a href="#" style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'Popis zahtjevane zaštitne opreme po radnom mjestu' : 'Required PPE by workplace'}</a>
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
