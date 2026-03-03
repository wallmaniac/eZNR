'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

/* ═══════════════════════════════════════════════
   Procjene  – Risk Assessments
   Views: list | form | vrstaOsobe | opasnosti
   ═══════════════════════════════════════════════ */

const EMPTY_PROCJENA = {
    nazivTvrtke: '',
    revizija: '',
    datumIzrade: todayISO(),
};

export default function RiskAssessmentPage() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();

    const [view, setView] = useState('list');          // list | form | vrstaOsobe | opasnosti
    const [records, setRecords] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_PROCJENA });
    const [search, setSearch] = useState('');

    // Person types
    const [personTypes, setPersonTypes] = useState([]);
    const [ptEdit, setPtEdit] = useState(null);
    const [ptNaziv, setPtNaziv] = useState('');
    const [ptVrsta, setPtVrsta] = useState('');

    // Hazards
    const [hazards, setHazards] = useState([]);
    const [hazEdit, setHazEdit] = useState(null);
    const [hazNaziv, setHazNaziv] = useState('');
    const [hazOznaka, setHazOznaka] = useState('');

    const loadData = useCallback(() => {
        setRecords(getAll(COLLECTIONS.RISK_ASSESSMENTS));
        setPersonTypes(getAll(COLLECTIONS.PERSON_TYPES));
        setHazards(getAll(COLLECTIONS.HAZARDS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    // ─── Procjene CRUD ───
    const handleNew = () => {
        setFormData({ ...EMPTY_PROCJENA, datumIzrade: todayISO() });
        setEditingId(null);
        setView('form');
    };
    const handleEdit = (item) => {
        setFormData({ ...EMPTY_PROCJENA, ...item });
        setEditingId(item.id);
        setView('form');
    };
    const handleDelete = async (id) => {
        if (await confirm(lang === 'bs' ? 'Obrisati procjenu?' : 'Delete assessment?')) { remove(COLLECTIONS.RISK_ASSESSMENTS, id); loadData(); }
    };
    const handleSave = () => {
        if (editingId) update(COLLECTIONS.RISK_ASSESSMENTS, editingId, formData);
        else create(COLLECTIONS.RISK_ASSESSMENTS, formData);
        setView('list'); loadData();
    };

    // ─── Vrsta osobe CRUD ───
    const startNewPt = () => { setPtEdit('__new__'); setPtNaziv(''); setPtVrsta(''); };
    const startEditPt = (p) => { setPtEdit(p.id); setPtNaziv(p.naziv || ''); setPtVrsta(p.vrsta || ''); };
    const cancelPt = () => setPtEdit(null);
    const savePt = () => {
        if (!ptNaziv.trim()) return;
        if (ptEdit === '__new__') create(COLLECTIONS.PERSON_TYPES, { naziv: ptNaziv, vrsta: ptVrsta });
        else update(COLLECTIONS.PERSON_TYPES, ptEdit, { naziv: ptNaziv, vrsta: ptVrsta });
        setPtEdit(null); loadData();
    };
    const deletePt = async (id) => {
        if (await confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?')) { remove(COLLECTIONS.PERSON_TYPES, id); loadData(); }
    };

    // ─── Opasnosti CRUD ───
    const startNewHaz = () => { setHazEdit('__new__'); setHazNaziv(''); setHazOznaka(''); };
    const startEditHaz = (h) => { setHazEdit(h.id); setHazNaziv(h.naziv || ''); setHazOznaka(h.oznaka || ''); };
    const cancelHaz = () => setHazEdit(null);
    const saveHaz = () => {
        if (!hazNaziv.trim()) return;
        if (hazEdit === '__new__') create(COLLECTIONS.HAZARDS, { naziv: hazNaziv, oznaka: hazOznaka });
        else update(COLLECTIONS.HAZARDS, hazEdit, { naziv: hazNaziv, oznaka: hazOznaka });
        setHazEdit(null); loadData();
    };
    const deleteHaz = async (id) => {
        if (await confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?')) { remove(COLLECTIONS.HAZARDS, id); loadData(); }
    };

    const labelSt = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };
    const sectionTitle = { fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 };
    const tabBtn = (key, label, icon) => (
        <button key={key} onClick={() => setView(key)} style={{
            padding: '8px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem',
            background: view === key ? 'var(--primary)' : 'var(--bg-card)',
            color: view === key ? '#fff' : 'var(--text)',
        }}>{icon} {label}</button>
    );

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       VIEW: LIST (main Procjene view)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    if (view === 'list') {
        const filtered = search
            ? records.filter(r => (r.nazivTvrtke || '').toLowerCase().includes(search.toLowerCase()))
            : records;
        return (
            <div className="animate-fadeIn">
                <h1 style={{ marginBottom: 24 }}>📊 {lang === 'bs' ? 'Procjene' : 'Assessments'}</h1>
                <DialogRenderer />

                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>
                            + {lang === 'bs' ? 'Novi' : 'New'}
                        </button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                            <button className="btn btn-ghost btn-sm">{lang === 'bs' ? 'Traži' : 'Search'}</button>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => setView('vrstaOsobe')}>
                            👤 {lang === 'bs' ? 'Vrsta osobe' : 'Person types'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setView('opasnosti')}>
                            ⚠️ {lang === 'bs' ? 'Opasnosti' : 'Hazards'}
                        </button>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                            {filtered.length} {lang === 'bs' ? 'zapisa' : 'records'}
                        </span>
                    </div>
                </div>

                <div className="card">
                    <div className="card-body">
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('actions')}</th>
                                        <th>{lang === 'bs' ? 'Naziv Tvrtke' : 'Company Name'}</th>
                                        <th>{lang === 'bs' ? 'Revizija' : 'Revision'}</th>
                                        <th>{lang === 'bs' ? 'Datum izrade' : 'Date of creation'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    ) : filtered.map(r => (
                                        <tr key={r.id}>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>✏️</button>
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(r.id)}>🗑️</button>
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{r.nazivTvrtke || '—'}</td>
                                            <td>{r.revizija || '—'}</td>
                                            <td>{formatDate(r.datumIzrade)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       VIEW: FORM (Nova procjena / Edit)
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    if (view === 'form') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn btn-ghost" onClick={() => setView('list')}>←</button>
                    <h1 style={{ margin: 0 }}>📊 {editingId ? (lang === 'bs' ? 'Uredi procjenu' : 'Edit assessment') : (lang === 'bs' ? 'Unesi novu procjenu' : 'New assessment')}</h1>
                </div>
                <DialogRenderer />

                <div className="card">
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: 16, marginBottom: 20 }}>
                            <div>
                                <div style={labelSt}>{lang === 'bs' ? 'Naziv Tvrtke' : 'Company Name'}</div>
                                <input className="form-input" value={formData.nazivTvrtke} onChange={e => set('nazivTvrtke', e.target.value)} />
                            </div>
                            <div>
                                <div style={labelSt}>{lang === 'bs' ? 'Revizija' : 'Revision'}</div>
                                <input className="form-input" value={formData.revizija} onChange={e => set('revizija', e.target.value)} />
                            </div>
                            <div>
                                <div style={labelSt}>{lang === 'bs' ? 'Datum izrade' : 'Date of creation'}</div>
                                <input className="form-input" type="date" value={formData.datumIzrade} onChange={e => set('datumIzrade', e.target.value)} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-primary" onClick={handleSave}>
                                💾 {lang === 'bs' ? 'Snimi' : 'Save'}
                            </button>
                            <button className="btn btn-ghost" onClick={() => setView('list')}>
                                ↩ {lang === 'bs' ? 'Odustani' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       VIEW: VRSTA OSOBE
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    if (view === 'vrstaOsobe') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn btn-ghost" onClick={() => { setView('list'); cancelPt(); }}>←</button>
                    <h1 style={{ margin: 0 }}>👤 {lang === 'bs' ? 'Vrste osoba' : 'Person Types'}</h1>
                </div>
                <DialogRenderer />

                <div className="card">
                    <div className="card-body">
                        <button className="btn btn-outline btn-sm" onClick={startNewPt} style={{ marginBottom: 14 }}>
                            + {lang === 'bs' ? 'Dodaj novi red' : 'Add new row'}
                        </button>

                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 90 }}></th>
                                        <th>{lang === 'bs' ? 'Naziv' : 'Name'}</th>
                                        <th>{lang === 'bs' ? 'Vrsta' : 'Type'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Inline add row */}
                                    {ptEdit === '__new__' && (
                                        <tr style={{ background: 'var(--bg-input)' }}>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-primary btn-sm" onClick={savePt}>✔</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={cancelPt}>✖</button>
                                                </div>
                                            </td>
                                            <td><input className="form-input" value={ptNaziv} onChange={e => setPtNaziv(e.target.value)} autoFocus /></td>
                                            <td><input className="form-input" value={ptVrsta} onChange={e => setPtVrsta(e.target.value)} /></td>
                                        </tr>
                                    )}
                                    {personTypes.length === 0 && ptEdit !== '__new__' && (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    )}
                                    {personTypes.map(p => (
                                        ptEdit === p.id ? (
                                            <tr key={p.id} style={{ background: 'var(--bg-input)' }}>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-primary btn-sm" onClick={savePt}>✔</button>
                                                        <button className="btn btn-ghost btn-sm" onClick={cancelPt}>✖</button>
                                                    </div>
                                                </td>
                                                <td><input className="form-input" value={ptNaziv} onChange={e => setPtNaziv(e.target.value)} autoFocus /></td>
                                                <td><input className="form-input" value={ptVrsta} onChange={e => setPtVrsta(e.target.value)} /></td>
                                            </tr>
                                        ) : (
                                            <tr key={p.id}>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost btn-sm" style={{ background: '#2196F3', color: '#fff', borderRadius: 4, padding: '4px 8px' }} onClick={() => startEditPt(p)}>✏️</button>
                                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePt(p.id)}>✖</button>
                                                    </div>
                                                </td>
                                                <td>{p.naziv}</td>
                                                <td>{p.vrsta || '—'}</td>
                                            </tr>
                                        )
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            1 - {personTypes.length} {lang === 'bs' ? `od ${personTypes.length} zapisa` : `of ${personTypes.length} records`}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       VIEW: OPASNOSTI
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    if (view === 'opasnosti') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn btn-ghost" onClick={() => { setView('list'); cancelHaz(); }}>←</button>
                    <h1 style={{ margin: 0 }}>⚠️ {lang === 'bs' ? 'Opasnosti' : 'Hazards'}</h1>
                </div>
                <DialogRenderer />

                <div className="card">
                    <div className="card-body">
                        <button className="btn btn-outline btn-sm" onClick={startNewHaz} style={{ marginBottom: 14 }}>
                            + {lang === 'bs' ? 'Dodaj novi red' : 'Add new row'}
                        </button>

                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 90 }}></th>
                                        <th>{lang === 'bs' ? 'Naziv' : 'Name'}</th>
                                        <th>{lang === 'bs' ? 'Oznaka' : 'Code'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Inline add row */}
                                    {hazEdit === '__new__' && (
                                        <tr style={{ background: 'var(--bg-input)' }}>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-primary btn-sm" onClick={saveHaz}>✔</button>
                                                    <button className="btn btn-ghost btn-sm" onClick={cancelHaz}>✖</button>
                                                </div>
                                            </td>
                                            <td><input className="form-input" value={hazNaziv} onChange={e => setHazNaziv(e.target.value)} autoFocus
                                                placeholder={lang === 'bs' ? 'npr. O.1. MEHANIČKE OPASNOSTI' : 'e.g. O.1. MECHANICAL HAZARDS'} /></td>
                                            <td><input className="form-input" value={hazOznaka} onChange={e => setHazOznaka(e.target.value)}
                                                placeholder={lang === 'bs' ? 'npr. O.1' : 'e.g. O.1'} /></td>
                                        </tr>
                                    )}
                                    {hazards.length === 0 && hazEdit !== '__new__' && (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    )}
                                    {hazards.map(h => (
                                        hazEdit === h.id ? (
                                            <tr key={h.id} style={{ background: 'var(--bg-input)' }}>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-primary btn-sm" onClick={saveHaz}>✔</button>
                                                        <button className="btn btn-ghost btn-sm" onClick={cancelHaz}>✖</button>
                                                    </div>
                                                </td>
                                                <td><input className="form-input" value={hazNaziv} onChange={e => setHazNaziv(e.target.value)} autoFocus /></td>
                                                <td><input className="form-input" value={hazOznaka} onChange={e => setHazOznaka(e.target.value)} /></td>
                                            </tr>
                                        ) : (
                                            <tr key={h.id}>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost btn-sm" style={{ background: '#2196F3', color: '#fff', borderRadius: 4, padding: '4px 8px' }} onClick={() => startEditHaz(h)}>✏️</button>
                                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteHaz(h.id)}>✖</button>
                                                    </div>
                                                </td>
                                                <td>{h.naziv}</td>
                                                <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{h.oznaka || '—'}</span></td>
                                            </tr>
                                        )
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            1 - {hazards.length} {lang === 'bs' ? `od ${hazards.length} zapisa` : `of ${hazards.length} records`}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
