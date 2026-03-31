'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS,
    getOrgUnitName, formatDate,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useSortedList } from '@/hooks/useSortedList';

const emptyEQ = {
    naziv: '', vrsta: '', tip: '', tvBroj: '', invBroj: '',
    orgJedinicaId: '', zaduzenOsoba: '', datumUpisa: '', uPrimjeniOd: '',
    izvanUpotrebeOd: '', evidencijskiBroj: '', brojMjernihMjesta: 0,
    proizvodjac: '', godinaProizvodnje: '', posljednji: '', iduci: '', status: 'active',
};

const emptyServiceEntry = {
    datum: '', tip: 'pregled', servisirao: '', napomena: '', iduciServis: '', docName: '', docData: '',
};

function EquipmentPageInner() {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const [items, setItems] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyEQ });
    const [activeTab, setActiveTab] = useState('podaci'); // 'podaci' | 'servis'
    const [serviceLogs, setServiceLogs] = useState([]);
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [serviceFormData, setServiceFormData] = useState({ ...emptyServiceEntry });
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showOutOfUse, setShowOutOfUse] = useState(false);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, maxH: 300 });
    const [selectedIds, setSelectedIds] = useState(new Set());
    const openItemHandledRef = useRef(false);
    const serviceDocRef = useRef(null);

    const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.EQUIPMENT)); }, []);
    useEffect(() => { loadData(); }, [loadData]);

    const toggleAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(filtered.map(x => x.id)));
        else setSelectedIds(new Set());
    };
    const toggleOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} stavki?` : `Delete ${selectedIds.size} items?`)) {
            for (let id of selectedIds) await remove(COLLECTIONS.EQUIPMENT, id);
            setSelectedIds(new Set());
            loadData();
        }
    };

    // Load service logs when editing an item
    const loadServiceLogs = useCallback((equipmentId) => {
        const all = getAll(COLLECTIONS.SERVICE_LOG);
        setServiceLogs(all.filter(l => l.equipmentId === equipmentId).sort((a, b) => new Date(b.datum) - new Date(a.datum)));
    }, []);

    // Auto-open item from URL param (calendar event click)
    useEffect(() => {
        if (openItemHandledRef.current) return;
        if (items.length === 0) return;
        const openId = searchParams?.get('openItem');
        const openTab = searchParams?.get('tab'); // e.g. ?tab=servis
        if (openId) {
            const found = items.find(x => x.id === openId);
            if (found) {
                openItemHandledRef.current = true;
                handleEdit(found, openTab || 'servis'); // default to servis tab when from calendar
                router.replace('/dashboard/equipment', { scroll: false });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, searchParams]);

    const filtered = items.filter(eq => {
        const matchSearch = !searchTerm || eq.naziv.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = showOutOfUse ? !!eq.izvanUpotrebeOd : !eq.izvanUpotrebeOd;
        return matchSearch && matchStatus;
    });

    const equipmentTypes = getAll(COLLECTIONS.EQUIPMENT_TYPES);
    const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
    const workers = getAll(COLLECTIONS.WORKERS);

    const enrichedItems = filtered.map(eq => ({ ...eq, orgName: getOrgUnitName(eq.orgJedinicaId) }));
    const { sorted: sortedEquipment, toggleSort, sortIcon, thStyle } = useSortedList(enrichedItems, 'naziv');

    const handleNew = () => { setFormData({ ...emptyEQ }); setEditingId(null); setActiveTab('podaci'); setServiceLogs([]); setShowForm(true); };
    const handleEdit = (item, tab = 'podaci') => {
        setFormData({ ...item });
        setEditingId(item.id);
        setActiveTab(tab);
        loadServiceLogs(item.id);
        setShowForm(true);
        setActionMenuId(null);
    };
    const handleDelete = async (id) => {
        const delOk = await confirm(lang === 'bs' ? 'Jeste li sigurni?' : 'Are you sure?');
        if (delOk) { remove(COLLECTIONS.EQUIPMENT, id); setActionMenuId(null); loadData(); }
    };
    const handleSave = async () => {
        if (!formData.naziv) { await alert(lang === 'bs' ? 'Naziv je obavezno polje!' : 'Name is required!'); return; }
        if (editingId) { update(COLLECTIONS.EQUIPMENT, editingId, formData); } else { create(COLLECTIONS.EQUIPMENT, formData); }
        setShowForm(false); loadData(); showFlash();
    };
    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    // ── Service log handlers ──────────────────────────────────────
    const handleNewService = () => {
        const today = new Date().toISOString().slice(0, 10);
        setServiceFormData({ ...emptyServiceEntry, datum: today });
        setEditingServiceId(null);
        setShowServiceForm(true);
    };

    const handleEditService = (log) => {
        setServiceFormData({ ...log });
        setEditingServiceId(log.id);
        setShowServiceForm(true);
    };

    const handleSaveService = async () => {
        if (!serviceFormData.datum) {
            await alert(lang === 'bs' ? 'Datum servisa je obavezan!' : 'Service date is required!');
            return;
        }
        if (!editingId) {
            await alert(lang === 'bs' ? 'Najprije sačuvajte opremu.' : 'Save equipment first.');
            return;
        }
        const data = { ...serviceFormData, equipmentId: editingId };
        if (editingServiceId) {
            update(COLLECTIONS.SERVICE_LOG, editingServiceId, data);
        } else {
            create(COLLECTIONS.SERVICE_LOG, data);
        }
        // Auto-update posljednji/iduci dates on equipment
        if (serviceFormData.datum) {
            const updates = { posljednji: serviceFormData.datum };
            if (serviceFormData.iduciServis) updates.iduci = serviceFormData.iduciServis;
            update(COLLECTIONS.EQUIPMENT, editingId, { ...formData, ...updates });
            setFormData(prev => ({ ...prev, ...updates }));
        }
        setShowServiceForm(false);
        loadServiceLogs(editingId);
        loadData();
    };

    const handleDeleteService = async (id) => {
        const ok = await confirm(lang === 'bs' ? 'Obrisati servisni zapis?' : 'Delete service record?');
        if (ok) { remove(COLLECTIONS.SERVICE_LOG, id); loadServiceLogs(editingId); }
    };

    const handleDocUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            await alert(lang === 'bs' ? 'Dokument mora biti manji od 2MB!' : 'Document must be under 2MB!');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            setServiceFormData(prev => ({
                ...prev,
                docName: file.name,
                docData: ev.target.result, // base64
            }));
        };
        reader.readAsDataURL(file);
    };

    const downloadDoc = (log) => {
        if (!log.docData) return;
        const a = document.createElement('a');
        a.href = log.docData;
        a.download = log.docName || 'servisni_dokument';
        a.click();
    };

    const tipLabel = (tip) => ({
        pregled: lang === 'bs' ? '🔍 Pregled' : '🔍 Inspection',
        servis: lang === 'bs' ? '🔧 Servis' : '🔧 Service',
        popravak: lang === 'bs' ? '🛠️ Popravak' : '🛠️ Repair',
        kalibracija: lang === 'bs' ? '📏 Kalibracija' : '📏 Calibration',
        zamjena: lang === 'bs' ? '🔄 Zamjena dijela' : '🔄 Part replacement',
    }[tip] || tip);

    const menuItemSt = {
        display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
        color: 'var(--text)', fontFamily: 'var(--font-body)', transition: 'background 0.12s',
    };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>⚙️ {t('equipment')}</h1>

            {/* ── Equipment Edit Modal ── */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? '✏️' : '+'} {lang === 'bs' ? 'Radna oprema / objekt' : 'Equipment / Object'} {formData.naziv && `— ${formData.naziv}`}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
                        </div>

                        {/* Tab bar */}
                        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
                            {[
                                { key: 'podaci', icon: '📋', label: lang === 'bs' ? 'Podaci' : 'Details' },
                                { key: 'servis', icon: '🔧', label: lang === 'bs' ? 'Servisni zapisnici' : 'Service Log' },
                            ].map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                                    padding: '10px 20px', border: 'none', cursor: 'pointer',
                                    fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: activeTab === tab.key ? 700 : 400,
                                    background: activeTab === tab.key ? 'var(--primary)' : 'var(--bg-card)',
                                    color: activeTab === tab.key ? '#fff' : 'var(--text)',
                                    borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                                    transition: 'all 0.15s',
                                }}>
                                    {tab.icon} {tab.label}
                                    {tab.key === 'servis' && serviceLogs.length > 0 && (
                                        <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 6px', fontSize: '0.75rem' }}>
                                            {serviceLogs.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="modal-body">
                            {/* ── TAB: Podaci ── */}
                            {activeTab === 'podaci' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                        <input className="form-input" value={formData.naziv} onChange={e => updateField('naziv', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Proizvođač' : 'Manufacturer'}</label>
                                        <input className="form-input" value={formData.proizvodjac} onChange={e => updateField('proizvodjac', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Vrsta' : 'Type'}</label>
                                        <select className="form-select" value={formData.vrsta} onChange={e => updateField('vrsta', e.target.value)}>
                                            <option value="">-</option>
                                            {equipmentTypes.map(et => <option key={et.id} value={et.naziv}>{et.naziv}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Tip/Model' : 'Model'}</label>
                                        <input className="form-input" value={formData.tip} onChange={e => updateField('tip', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Tv. broj' : 'Serial no.'}</label>
                                        <input className="form-input" value={formData.tvBroj} onChange={e => updateField('tvBroj', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Inv. broj' : 'Inventory no.'}</label>
                                        <input className="form-input" value={formData.invBroj} onChange={e => updateField('invBroj', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Godina proizvodnje' : 'Year of production'}</label>
                                        <input className="form-input" value={formData.godinaProizvodnje} onChange={e => updateField('godinaProizvodnje', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('orgUnit')}</label>
                                        <select className="form-select" value={formData.orgJedinicaId} onChange={e => updateField('orgJedinicaId', e.target.value)}>
                                            <option value="">-</option>
                                            {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Zadužena osoba' : 'Responsible person'}</label>
                                        <input className="form-input" list="workerNames" value={formData.zaduzenOsoba || ''} onChange={e => updateField('zaduzenOsoba', e.target.value)} placeholder={lang === 'bs' ? 'Ime i prezime...' : 'Name...'} />
                                        <datalist id="workerNames">
                                            {workers.filter(w => w.aktivan !== false).map(w => (
                                                <option key={w.id} value={`${w.ime} ${w.prezime}`} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Datum upisa' : 'Entry date'}</label>
                                        <input className="form-input" type="date" value={formData.datumUpisa} onChange={e => updateField('datumUpisa', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'U primjeni od' : 'In use from'}</label>
                                        <input className="form-input" type="date" value={formData.uPrimjeniOd} onChange={e => updateField('uPrimjeniOd', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Izvan upotrebe od' : 'Out of use from'}</label>
                                        <input className="form-input" type="date" value={formData.izvanUpotrebeOd} onChange={e => updateField('izvanUpotrebeOd', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('evidenceNumber')}</label>
                                        <input className="form-input" value={formData.evidencijskiBroj} onChange={e => updateField('evidencijskiBroj', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Broj mjernih mjesta' : 'No. of measuring points'}</label>
                                        <input className="form-input" type="number" value={formData.brojMjernihMjesta} onChange={e => updateField('brojMjernihMjesta', Number(e.target.value))} />
                                    </div>
                                    <div className="form-group" style={{ background: 'rgba(0,191,166,0.04)', borderRadius: 8, padding: 12, border: '1px solid rgba(0,191,166,0.15)' }}>
                                        <label className="form-label" style={{ color: 'var(--primary)' }}>🕐 {lang === 'bs' ? 'Posljednji pregled' : 'Last examination'}</label>
                                        <input className="form-input" type="date" value={formData.posljednji} onChange={e => updateField('posljednji', e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ background: 'rgba(0,191,166,0.04)', borderRadius: 8, padding: 12, border: '1px solid rgba(0,191,166,0.15)' }}>
                                        <label className="form-label" style={{ color: 'var(--primary)' }}>📅 {lang === 'bs' ? 'Idući pregled' : 'Next examination'}</label>
                                        <input className="form-input" type="date" value={formData.iduci} onChange={e => updateField('iduci', e.target.value)} />
                                    </div>
                                </div>
                            )}

                            {/* ── TAB: Servisni zapisnici ── */}
                            {activeTab === 'servis' && (
                                <div>
                                    {!editingId && (
                                        <div style={{ padding: '20px', background: 'rgba(255,152,0,0.06)', borderRadius: 8, border: '1px solid rgba(255,152,0,0.2)', marginBottom: 16, fontSize: '0.85rem', color: 'var(--warning)' }}>
                                            ⚠️ {lang === 'bs' ? 'Najprije sačuvajte opremu da biste mogli dodavati servisne zapise.' : 'Save the equipment first before adding service records.'}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                                        <button className="btn btn-primary btn-sm" onClick={handleNewService} disabled={!editingId}>
                                            + {lang === 'bs' ? 'Novi servisni zapis' : 'New service record'}
                                        </button>
                                        {serviceLogs.length > 0 && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {serviceLogs.length} {lang === 'bs' ? 'zapis(a)' : 'record(s)'}
                                            </span>
                                        )}
                                    </div>

                                    {serviceLogs.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔧</div>
                                            <div>{lang === 'bs' ? 'Nema servisnih zapisa.' : 'No service records yet.'}</div>
                                            <div style={{ fontSize: '0.8rem', marginTop: 6 }}>
                                                {lang === 'bs' ? 'Dodajte servisni zapis s datumom, tipom i napomenom.' : 'Add service records with date, type and notes.'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {serviceLogs.map(log => (
                                                <div key={log.id} style={{
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 10,
                                                    padding: '14px 16px',
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 1fr auto',
                                                    gap: 12,
                                                    alignItems: 'start',
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                                                            {tipLabel(log.tip)}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                            📅 {formatDate(log.datum)}
                                                            {log.servisirao && <span style={{ marginLeft: 10 }}>👤 {log.servisirao}</span>}
                                                        </div>
                                                        {log.iduciServis && (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 4 }}>
                                                                ⏭ {lang === 'bs' ? 'Idući' : 'Next'}: {formatDate(log.iduciServis)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        {log.napomena && (
                                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                                                                "{log.napomena}"
                                                            </div>
                                                        )}
                                                        {log.docName && (
                                                            <button onClick={() => downloadDoc(log)} style={{
                                                                marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.2)',
                                                                borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--info)',
                                                            }}>
                                                                📎 {log.docName}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleEditService(log)}>✏️</button>
                                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteService(log.id)}>🗑️</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Service Entry Form Modal ── */}
            {showServiceForm && (
                <div className="modal-overlay" onClick={() => setShowServiceForm(false)}>
                    <div className="modal" style={{ maxWidth: 560, zIndex: 1100 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🔧 {editingServiceId ? (lang === 'bs' ? 'Uredi servisni zapis' : 'Edit service record') : (lang === 'bs' ? 'Novi servisni zapis' : 'New service record')}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowServiceForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>📅 {lang === 'bs' ? 'Datum servisa' : 'Service date'} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <input className="form-input" type="date" value={serviceFormData.datum} onChange={e => setServiceFormData(p => ({ ...p, datum: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Tip servisa' : 'Service type'}</label>
                                    <select className="form-select" value={serviceFormData.tip} onChange={e => setServiceFormData(p => ({ ...p, tip: e.target.value }))}>
                                        <option value="pregled">{lang === 'bs' ? '🔍 Pregled' : '🔍 Inspection'}</option>
                                        <option value="servis">{lang === 'bs' ? '🔧 Servis' : '🔧 Service'}</option>
                                        <option value="popravak">{lang === 'bs' ? '🛠️ Popravak' : '🛠️ Repair'}</option>
                                        <option value="kalibracija">{lang === 'bs' ? '📏 Kalibracija' : '📏 Calibration'}</option>
                                        <option value="zamjena">{lang === 'bs' ? '🔄 Zamjena dijela' : '🔄 Part replacement'}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">👤 {lang === 'bs' ? 'Servisirao / Ovlaštena firma' : 'Serviced by'}</label>
                                    <input className="form-input" value={serviceFormData.servisirao} onChange={e => setServiceFormData(p => ({ ...p, servisirao: e.target.value }))} placeholder={lang === 'bs' ? 'Ime ili naziv firme...' : 'Name or company...'} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">📅 {lang === 'bs' ? 'Idući servis' : 'Next service date'}</label>
                                    <input className="form-input" type="date" value={serviceFormData.iduciServis} onChange={e => setServiceFormData(p => ({ ...p, iduciServis: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">📝 {lang === 'bs' ? 'Napomena / Opis radova' : 'Notes / Description'}</label>
                                    <textarea className="form-textarea" rows={3} value={serviceFormData.napomena} onChange={e => setServiceFormData(p => ({ ...p, napomena: e.target.value }))} placeholder={lang === 'bs' ? 'Opis obavljenih radova, zamijenjeni dijelovi...' : 'Describe work done, replaced parts...'} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">📎 {lang === 'bs' ? 'Prilog (dokaz servisa, maks. 2MB)' : 'Attachment (proof of service, max 2MB)'}</label>
                                    {serviceFormData.docName ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>📎 {serviceFormData.docName}</span>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setServiceFormData(p => ({ ...p, docName: '', docData: '' }))} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>✕ {lang === 'bs' ? 'Ukloni' : 'Remove'}</button>
                                        </div>
                                    ) : (
                                        <div onClick={() => serviceDocRef.current?.click()} style={{
                                            border: '2px dashed var(--border)', borderRadius: 8, padding: '16px',
                                            textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)',
                                            transition: 'all 0.15s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                        >
                                            📂 {lang === 'bs' ? 'Kliknite za upload dokumenta (PDF, slike)' : 'Click to upload document (PDF, images)'}
                                        </div>
                                    )}
                                    <input ref={serviceDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
                                </div>
                            </div>
                            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,191,166,0.04)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                💡 {lang === 'bs' ? 'Datum posljednjeg i idućeg pregleda na opremi biće automatski ažurirani.' : 'Equipment\'s last/next examination dates will be updated automatically.'}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowServiceForm(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSaveService}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Equipment List ── */}
            <div className="card">
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {t('add')}</button>
                        <SavedFlash />
                        <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                            <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={showOutOfUse} onChange={e => setShowOutOfUse(e.target.checked)} />
                            {lang === 'bs' ? 'Radna oprema izvan upotrebe' : 'Out of use equipment'}
                        </label>
                        {selectedIds.size > 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'} &mdash; Grupne akcije:
                                </span>
                                <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ {lang === 'bs' ? 'Isprintaj' : 'Print'}</button>
                                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                            </div>
                        )}
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th onClick={() => toggleSort('vrsta')} style={thStyle('vrsta')}>{lang === 'bs' ? 'Vrsta' : 'Type'}{sortIcon('vrsta')}</th>
                                    <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{t('name')}{sortIcon('naziv')}</th>
                                    <th onClick={() => toggleSort('tvBroj')} style={thStyle('tvBroj')}>{lang === 'bs' ? 'Tv. broj' : 'Serial'}{sortIcon('tvBroj')}</th>
                                    <th onClick={() => toggleSort('invBroj')} style={thStyle('invBroj')}>{lang === 'bs' ? 'Inv. broj' : 'Inv.'}{sortIcon('invBroj')}</th>
                                    <th onClick={() => toggleSort('orgName')} style={thStyle('orgName')}>{lang === 'bs' ? 'Organizacija' : 'Organization'}{sortIcon('orgName')}</th>
                                    <th onClick={() => toggleSort('posljednji')} style={thStyle('posljednji')}>{lang === 'bs' ? 'Posljednji' : 'Last'}{sortIcon('posljednji')}</th>
                                    <th onClick={() => toggleSort('iduci')} style={thStyle('iduci')}>{lang === 'bs' ? 'Idući' : 'Next'}{sortIcon('iduci')}</th>
                                    <th style={{ width: 60 }}>{lang === 'bs' ? 'Zapisi' : 'Logs'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEquipment.length === 0 ? (
                                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : sortedEquipment.map((eq) => {
                                    const isExpired = eq.iduci && new Date(eq.iduci) < new Date();
                                    const logCount = getAll(COLLECTIONS.SERVICE_LOG).filter(l => l.equipmentId === eq.id).length;
                                    return (
                                        <tr key={eq.id} onClick={() => handleEdit(eq, 'podaci')} style={{ cursor: 'pointer' }}>
                                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(eq.id)} onChange={() => toggleOne(eq.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} /></td>
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
                                                    setActionMenuId(actionMenuId === eq.id ? null : eq.id);
                                                }}>
                                                    {t('actions')} ▼
                                                </button>
                                                {actionMenuId === eq.id && (
                                                    <>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setActionMenuId(null)} />
                                                    <div data-menu style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                        <button onClick={() => handleEdit(eq, 'podaci')} style={menuItemSt}>📂 {t('open')}</button>
                                                        <button onClick={() => handleEdit(eq, 'servis')} style={menuItemSt}>🔧 {lang === 'bs' ? 'Servisni zapisnici' : 'Service log'}</button>
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => { setActionMenuId(null); handleDelete(eq.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ {t('delete')}</button>
                                                    </div>
                                                    </>
                                                )}
                                            </td>
                                            <td>{eq.vrsta}</td>
                                            <td style={{ fontWeight: 600 }}>{eq.naziv}</td>
                                            <td><code>{eq.tvBroj}</code></td>
                                            <td>{eq.invBroj}</td>
                                            <td>{eq.orgName}</td>
                                            <td>{formatDate(eq.posljednji)}</td>
                                            <td style={{ color: isExpired ? 'var(--danger)' : undefined, fontWeight: isExpired ? 700 : undefined }}>
                                                {formatDate(eq.iduci)} {isExpired && '⚠️'}
                                            </td>
                                            <td onClick={e => e.stopPropagation()}>
                                                {logCount > 0 ? (
                                                    <button
                                                        onClick={() => handleEdit(eq, 'servis')}
                                                        style={{ background: 'rgba(0,191,166,0.12)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,191,166,0.28)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,191,166,0.12)'}
                                                        title={lang === 'bs' ? 'Otvori servisne zapisnike' : 'Open service log'}
                                                    >
                                                        🔧 {logCount}
                                                    </button>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="pagination" style={{ marginTop: 12 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            1 - {sortedEquipment.length} {t('of')} {sortedEquipment.length} {t('records')}
                        </div>
                    </div>
                </div>
            </div>
            <DialogRenderer />
        </div>
    );
}

export default function EquipmentPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
            <EquipmentPageInner />
        </Suspense>
    );
}
