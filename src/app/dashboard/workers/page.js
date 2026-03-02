'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
    getAll, getById, create, update, remove, search,
    COLLECTIONS, getOrgUnitName, getWorkplaceName,
    getWorkerCertificates, getWorkerPPE, formatDate, todayISO,
} from '@/lib/dataStore';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

const emptyWorker = {
    prefix: '', ime: '', prezime: '', sufiks: '',
    imeRoditelja: '', jmbg: '', oib: '', zivotnaDob: 0,
    stazDoDolaska: '', datumZaposlenja: '', datumOdlaska: '',
    ukupniStaz: '', koef: '', radnoMjestoId: '', orgJedinicaId: '',
    lokacija: '', evidencijskiBroj: '', vanjskiSuradnik: false,
    ulica: '', kucniBroj: '', mjestoId: '', opcina: '',
    telefonTvrtki: '', telefonKuce: '', mobitel: '', email: '',
    spol: '', datumRodenja: '', mjestoRodenja: '', opcinaRodenja: '',
    aktivan: true, posebniUvjeti: false, napomena: '', slika: '',
};

export default function WorkersPage() {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const { markDirty, markClean } = useUnsavedChanges(() => handleSave());
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFormer, setShowFormer] = useState(false);
    const [editingWorker, setEditingWorker] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ ...emptyWorker });
    const [openSections, setOpenSections] = useState({ kontakt: false, osobni: false, posebni: false, uvjerenja: true, ozo: false, mjestoRada: false, dodatniPoslovi: false });
    const [orgUnits, setOrgUnits] = useState([]);
    const [workplaces, setWorkplaces] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [ppeAssign, setPpeAssign] = useState([]);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [viewWorkerId, setViewWorkerId] = useState(null);
    const actionRef = useRef(null);
    const photoInputRef = useRef(null);
    // Certificate form state
    const [showCertForm, setShowCertForm] = useState(false);
    const [certFormData, setCertFormData] = useState({ oznaka: '', datum: '', vrijediDo: '', ime: '', tipUvjerenja: 'ZNR', upisao: 'Admin', sposobnost: 'Sposoban' });
    const [certEditId, setCertEditId] = useState(null);
    const [certSearch, setCertSearch] = useState('');
    const [showOnlyValidCerts, setShowOnlyValidCerts] = useState(false);
    // PPE form state
    const [showPpeForm, setShowPpeForm] = useState(false);
    const [ppeFormData, setPpeFormData] = useState({ naziv: '', datumZaduzenja: '', datumRazduzenja: '' });
    const [ppeEditId, setPpeEditId] = useState(null);
    const [certTypes, setCertTypes] = useState([]);
    const [ppeTypes, setPpeTypes] = useState([]);

    const loadData = useCallback(() => {
        setWorkers(getAll(COLLECTIONS.WORKERS));
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        setCertTypes(getAll(COLLECTIONS.CERT_TYPES));
        setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        const handleClick = (e) => { if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null); };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Auto-open from WorkerProfileModal "Otvori potpuno"
    useEffect(() => {
        if (workers.length === 0) return;
        const storedId = sessionStorage.getItem('openWorkerId');
        if (storedId) {
            sessionStorage.removeItem('openWorkerId');
            const found = workers.find(x => x.id === storedId);
            if (found) handleEdit(found);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workers]);

    const filteredWorkers = workers.filter(w => {
        const matchSearch = !searchTerm || `${w.ime} ${w.prezime} ${w.jmbg} ${w.oib}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = showFormer ? !w.aktivan : w.aktivan;
        return matchSearch && matchStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filteredWorkers.length / perPage));
    const pagedWorkers = filteredWorkers.slice((page - 1) * perPage, page * perPage);

    const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

    // Filtered certificates for display
    const filteredCerts = certificates.filter(c => {
        if (showOnlyValidCerts && c.vrijediDo && new Date(c.vrijediDo) < new Date()) return false;
        if (!certSearch) return true;
        const q = certSearch.toLowerCase();
        return (c.oznaka || '').toLowerCase().includes(q) || (c.ime || '').toLowerCase().includes(q) || (c.tipUvjerenja || '').toLowerCase().includes(q);
    });

    // Save certificate
    const handleSaveCert = () => {
        if (!certFormData.oznaka || !certFormData.ime) { alert(lang === 'bs' ? 'Oznaka i naziv su obavezni!' : 'Code and name are required!'); return; }
        if (certEditId) {
            update(COLLECTIONS.CERTIFICATES, certEditId, { ...certFormData, workerId: editingWorker });
        } else {
            create(COLLECTIONS.CERTIFICATES, { ...certFormData, workerId: editingWorker });
        }
        setCertificates(getWorkerCertificates(editingWorker));
        setShowCertForm(false);
        setCertEditId(null);
    };

    // Save PPE
    const handleSavePpe = () => {
        if (!ppeFormData.naziv) { alert(lang === 'bs' ? 'Naziv je obavezan!' : 'Name is required!'); return; }
        if (ppeEditId) {
            update(COLLECTIONS.PPE_ASSIGNMENTS, ppeEditId, { ...ppeFormData, workerId: editingWorker });
        } else {
            create(COLLECTIONS.PPE_ASSIGNMENTS, { ...ppeFormData, workerId: editingWorker });
        }
        setPpeAssign(getWorkerPPE(editingWorker));
        setShowPpeForm(false);
        setPpeEditId(null);
    };

    const handleNew = () => {
        setFormData({ ...emptyWorker });
        setEditingWorker(null);
        setCertificates([]);
        setPpeAssign([]);
        setShowForm(true);
    };

    const handleEdit = (worker) => {
        setFormData({ ...worker });
        setEditingWorker(worker.id);
        setCertificates(getWorkerCertificates(worker.id));
        setPpeAssign(getWorkerPPE(worker.id));
        setActionMenuId(null);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (confirm(lang === 'bs' ? 'Jeste li sigurni da želite obrisati ovog radnika?' : 'Are you sure you want to delete this worker?')) {
            remove(COLLECTIONS.WORKERS, id);
            setActionMenuId(null);
            loadData();
        }
    };

    const handleSave = (addNew = false) => {
        if (!formData.ime || !formData.prezime) {
            alert(lang === 'bs' ? 'Ime i prezime su obavezna polja!' : 'First name and last name are required!');
            return;
        }
        if (editingWorker) {
            update(COLLECTIONS.WORKERS, editingWorker, formData);
        } else {
            create(COLLECTIONS.WORKERS, formData);
        }
        loadData();
        markClean();
        if (addNew) {
            setFormData({ ...emptyWorker });
            setEditingWorker(null);
            setCertificates([]);
            setPpeAssign([]);
        } else {
            setShowForm(false);
        }
    };

    const handleCancel = () => {
        markClean();
        setShowForm(false);
        setEditingWorker(null);
    };

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (showForm) markDirty();
    };

    // ── Photo upload with auto-crop to face (center-top crop, 3:4 ratio) ──
    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert(lang === 'bs' ? 'Molimo odaberite sliku.' : 'Please select an image file.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                // Target: 3:4 portrait ratio (standard employee photo)
                const TARGET_W = 300;
                const TARGET_H = 400;
                const targetRatio = TARGET_W / TARGET_H; // 0.75
                const imgRatio = img.width / img.height;

                let sx, sy, sw, sh;
                if (imgRatio > targetRatio) {
                    // Image is wider — crop sides, keep full height
                    sh = img.height;
                    sw = sh * targetRatio;
                    sx = (img.width - sw) / 2; // center horizontally
                    sy = 0; // top-aligned (face is usually in upper portion)
                } else {
                    // Image is taller — crop bottom, keep full width
                    sw = img.width;
                    sh = sw / targetRatio;
                    sx = 0;
                    sy = 0; // top-aligned to capture face
                }

                const canvas = document.createElement('canvas');
                canvas.width = TARGET_W;
                canvas.height = TARGET_H;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                updateField('slika', dataUrl);
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const handleRemovePhoto = (e) => {
        e.stopPropagation();
        updateField('slika', '');
    };

    // ── Render ──

    if (showForm) {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn btn-ghost" onClick={handleCancel}>← {t('discard')}</button>
                    <h1 style={{ margin: 0 }}>
                        👷 {editingWorker ? (lang === 'bs' ? 'Uredi radnika' : 'Edit Worker') : (lang === 'bs' ? 'Novi radnik' : 'New Worker')}
                    </h1>
                </div>

                {/* ── MAIN FORM CARD ── */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-body">
                        {/* Hidden file input for photo */}
                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handlePhotoUpload}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr 80px', gap: 16, marginBottom: 20 }}>
                            {/* Photo upload area */}
                            <div style={{ gridRow: '1 / 3' }}>
                                <div
                                    onClick={() => photoInputRef.current?.click()}
                                    style={{
                                        width: 120, height: 160,
                                        border: formData.slika ? 'none' : '2px dashed var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexDirection: 'column', gap: 4,
                                        fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center',
                                        cursor: 'pointer', overflow: 'hidden', position: 'relative',
                                        background: formData.slika ? 'none' : 'var(--bg-input)',
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                        boxShadow: formData.slika ? 'var(--shadow-md)' : 'none',
                                    }}
                                    onMouseOver={e => { if (!formData.slika) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                                    onMouseOut={e => { if (!formData.slika) e.currentTarget.style.borderColor = 'var(--border)'; }}
                                >
                                    {formData.slika ? (
                                        <>
                                            <img
                                                src={formData.slika}
                                                alt="Worker"
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                                            />
                                            {/* Remove button overlay */}
                                            <div
                                                onClick={handleRemovePhoto}
                                                style={{
                                                    position: 'absolute', top: 4, right: 4,
                                                    width: 22, height: 22, borderRadius: '50%',
                                                    background: 'rgba(0,0,0,0.6)', color: 'white',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.7rem', cursor: 'pointer',
                                                    opacity: 0, transition: 'opacity 0.2s',
                                                }}
                                                onMouseOver={e => e.currentTarget.style.opacity = 1}
                                                onMouseOut={e => e.currentTarget.style.opacity = 0}
                                            >
                                                ✕
                                            </div>
                                            {/* Change photo hint */}
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                padding: '4px 0', textAlign: 'center',
                                                background: 'rgba(0,0,0,0.5)', color: 'white',
                                                fontSize: '0.6rem', fontWeight: 600,
                                                opacity: 0, transition: 'opacity 0.2s',
                                            }}
                                                onMouseOver={e => e.currentTarget.style.opacity = 1}
                                                onMouseOut={e => e.currentTarget.style.opacity = 0}
                                            >
                                                {lang === 'bs' ? 'Promijeni' : 'Change'}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span style={{ fontSize: '1.8rem', opacity: 0.5 }}>📷</span>
                                            <span style={{ fontWeight: 600 }}>{lang === 'bs' ? 'Izaberi sliku' : 'Choose photo'}</span>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>3:4, JPG/PNG</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <Field label={t('prefix')} value={formData.prefix} onChange={v => updateField('prefix', v)} />
                            <Field label={t('workerName')} value={formData.ime} onChange={v => updateField('ime', v)} required />
                            <Field label={t('workerSurname')} value={formData.prezime} onChange={v => updateField('prezime', v)} required />
                            <Field label={t('suffix')} value={formData.sufiks} onChange={v => updateField('sufiks', v)} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                            <Field label={t('parentName')} value={formData.imeRoditelja} onChange={v => updateField('imeRoditelja', v)} />
                            <Field label="JMBG" value={formData.jmbg} onChange={v => updateField('jmbg', v)} placeholder="13 cifara" />
                            <Field label={t('oib')} value={formData.oib} onChange={v => updateField('oib', v)} />
                            <Field label={t('age')} value={formData.zivotnaDob} onChange={v => updateField('zivotnaDob', v)} type="number" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
                            <Field label={t('priorExperience')} value={formData.stazDoDolaska} onChange={v => updateField('stazDoDolaska', v)} placeholder="GGMMDD" />
                            <Field label={t('employmentDate')} value={formData.datumZaposlenja} onChange={v => updateField('datumZaposlenja', v)} type="date" />
                            <Field label={t('departureDate')} value={formData.datumOdlaska} onChange={v => updateField('datumOdlaska', v)} type="date" />
                            <Field label={t('totalExperience')} value={formData.ukupniStaz} onChange={v => updateField('ukupniStaz', v)} placeholder="GG MM DD" />
                            <Field label={t('coefficient')} value={formData.koef} onChange={v => updateField('koef', v)} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <SelectField label={t('workplace')} value={formData.radnoMjestoId} onChange={v => updateField('radnoMjestoId', v)}
                                options={workplaces.map(wp => ({ value: wp.id, label: wp.naziv }))} />
                            <SelectField label={t('orgUnit')} value={formData.orgJedinicaId} onChange={v => updateField('orgJedinicaId', v)}
                                options={orgUnits.map(ou => ({ value: ou.id, label: ou.naziv }))} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 16 }}>
                            <Field label={t('location')} value={formData.lokacija} onChange={v => updateField('lokacija', v)} />
                            <Field label={t('evidenceNumber')} value={formData.evidencijskiBroj} onChange={v => updateField('evidencijskiBroj', v)} />
                            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={formData.vanjskiSuradnik} onChange={e => updateField('vanjskiSuradnik', e.target.checked)} />
                                    {t('externalAssociate')}
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── ACCORDION: Posebni uvjeti rada ── */}
                <Accordion title={t('specialConditions')} open={openSections.posebni} onToggle={() => toggleSection('posebni')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={formData.posebniUvjeti} onChange={e => updateField('posebniUvjeti', e.target.checked)} />
                            {lang === 'bs' ? 'Radnik radi pod posebnim uvjetima' : 'Worker works under special conditions'}
                        </label>
                    </div>
                    {formData.posebniUvjeti && (
                        <div className="alert alert-warning">
                            ⚠️ {lang === 'bs'
                                ? 'Za pozicije sa posebnim uvjetima rada potrebno je provesti periodične ljekarske preglede.'
                                : 'Positions with special working conditions require periodic medical examinations.'}
                        </div>
                    )}
                </Accordion>

                {/* ── ACCORDION: Kontakt podaci ── */}
                <Accordion title={t('contactInfo')} open={openSections.kontakt} onToggle={() => toggleSection('kontakt')}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 16, marginBottom: 16 }}>
                        <Field label={t('street')} value={formData.ulica} onChange={v => updateField('ulica', v)} />
                        <Field label={t('houseNumber')} value={formData.kucniBroj} onChange={v => updateField('kucniBroj', v)} />
                        <SelectField label={t('place')} value={formData.mjestoId} onChange={v => updateField('mjestoId', v)}
                            options={getAll(COLLECTIONS.PLACES).map(p => ({ value: p.id, label: `${p.naziv} (${p.postBroj})` }))} placeholder={lang === 'bs' ? 'Odaberite mjesto' : 'Select place'} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
                        <Field label={t('municipality')} value={formData.opcina} onChange={v => updateField('opcina', v)} />
                        <Field label={t('companyPhone')} value={formData.telefonTvrtki} onChange={v => updateField('telefonTvrtki', v)} />
                        <Field label={t('homePhone')} value={formData.telefonKuce} onChange={v => updateField('telefonKuce', v)} />
                        <Field label={t('mobilePhone')} value={formData.mobitel} onChange={v => updateField('mobitel', v)} />
                    </div>
                    <Field label="Email" value={formData.email} onChange={v => updateField('email', v)} type="email" />
                </Accordion>

                {/* ── ACCORDION: Osobni podaci ── */}
                <Accordion title={t('personalData')} open={openSections.osobni} onToggle={() => toggleSection('osobni')}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">{t('gender')}</label>
                            <div style={{ display: 'flex', gap: 24, padding: '10px 0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="radio" name="spol" value="M" checked={formData.spol === 'M'} onChange={() => updateField('spol', 'M')} />
                                    {t('male')}
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                    <input type="radio" name="spol" value="Z" checked={formData.spol === 'Z'} onChange={() => updateField('spol', 'Z')} />
                                    {t('female')}
                                </label>
                            </div>
                        </div>
                        <Field label={t('dateOfBirth')} value={formData.datumRodenja} onChange={v => updateField('datumRodenja', v)} type="date" />
                        <Field label={t('birthPlace')} value={formData.mjestoRodenja} onChange={v => updateField('mjestoRodenja', v)} />
                        <Field label={t('birthMunicipality')} value={formData.opcinaRodenja} onChange={v => updateField('opcinaRodenja', v)} />
                    </div>
                </Accordion>

                {/* ── ACCORDION: Uvjerenja radnika ── */}
                <Accordion title={t('workerCerts')} open={openSections.uvjerenja} onToggle={() => toggleSection('uvjerenja')}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.85rem', flex: 1 }}
                                placeholder={t('searchBtn') + '...'}
                                value={certSearch} onChange={e => setCertSearch(e.target.value)} />
                            {certSearch && <button className="btn btn-ghost btn-sm" onClick={() => setCertSearch('')}>✕</button>}
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => { setCertFormData({ oznaka: '', datum: todayISO(), vrijediDo: '', ime: '', tipUvjerenja: 'ZNR', upisao: 'Admin', sposobnost: 'Sposoban' }); setShowCertForm(true); }}>+ {t('newCertificate')}</button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', marginLeft: 'auto', cursor: 'pointer' }}>
                            <input type="checkbox" checked={showOnlyValidCerts} onChange={e => setShowOnlyValidCerts(e.target.checked)} /> {t('showOnlyValid')}
                        </label>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('actions')}</th>
                                    <th>{lang === 'bs' ? 'Oznaka' : 'Code'}</th>
                                    <th>{t('date')}</th>
                                    <th>{lang === 'bs' ? 'Vrijedi do' : 'Valid until'}</th>
                                    <th>{t('name')}</th>
                                    <th>{lang === 'bs' ? 'Tip uvjerenja' : 'Cert. type'}</th>
                                    <th>{lang === 'bs' ? 'Upisao' : 'Entered by'}</th>
                                    <th>{lang === 'bs' ? 'Sposobnost' : 'Capability'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCerts.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : filteredCerts.map(c => {
                                    const isExpired = c.vrijediDo && new Date(c.vrijediDo) < new Date();
                                    return (
                                        <tr key={c.id}>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => { setCertFormData({ ...c }); setCertEditId(c.id); setShowCertForm(true); }}>✏️</button>
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { if (confirm(lang === 'bs' ? 'Obrisati uvjerenje?' : 'Delete certificate?')) { remove(COLLECTIONS.CERTIFICATES, c.id); setCertificates(getWorkerCertificates(editingWorker)); } }}>🗑️</button>
                                                </div>
                                            </td>
                                            <td>{c.oznaka}</td>
                                            <td>{formatDate(c.datum)}</td>
                                            <td style={{ color: isExpired ? 'var(--danger)' : undefined, fontWeight: isExpired ? 700 : undefined }}>
                                                {formatDate(c.vrijediDo)} {isExpired && '⚠️'}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{c.ime}</td>
                                            <td><span className="badge badge-info">{c.tipUvjerenja}</span></td>
                                            <td>{c.upisao}</td>
                                            <td><span className={`badge ${c.sposobnost === 'Sposoban' ? 'badge-success' : 'badge-danger'}`}>{c.sposobnost}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Accordion>

                {/* ── ACCORDION: OZO radnika ── */}
                <Accordion title={t('workerPPESection')} open={openSections.ozo} onToggle={() => toggleSection('ozo')}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => { setPpeFormData({ naziv: '', datumZaduzenja: todayISO(), datumRazduzenja: '' }); setShowPpeForm(true); }}>+ {lang === 'bs' ? 'Novo zaduženje' : 'New assignment'}</button>
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('actions')}</th>
                                    <th>{t('name')}</th>
                                    <th>{lang === 'bs' ? 'Datum zaduženja' : 'Assignment date'}</th>
                                    <th>{lang === 'bs' ? 'Datum razduženja' : 'Return date'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ppeAssign.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : ppeAssign.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => { setPpeFormData({ ...p }); setPpeEditId(p.id); setShowPpeForm(true); }}>✏️</button>
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { if (confirm(lang === 'bs' ? 'Obrisati zaduženje?' : 'Delete assignment?')) { remove(COLLECTIONS.PPE_ASSIGNMENTS, p.id); setPpeAssign(getWorkerPPE(editingWorker)); } }}>🗑️</button>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{p.naziv}</td>
                                        <td>{formatDate(p.datumZaduzenja)}</td>
                                        <td>{p.datumRazduzenja ? formatDate(p.datumRazduzenja) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Accordion>

                {/* ── ACCORDION: Mjesto rada ── */}
                <Accordion title={t('workLocation')} open={openSections.mjestoRada} onToggle={() => toggleSection('mjestoRada')}>
                    <div className="form-group">
                        <textarea className="form-textarea" placeholder={lang === 'bs' ? 'Opis mjesta rada...' : 'Work location description...'} rows={3} />
                    </div>
                </Accordion>

                {/* ── ACCORDION: Dodatni poslovi ── */}
                <Accordion title={t('additionalJobs')} open={openSections.dodatniPoslovi} onToggle={() => toggleSection('dodatniPoslovi')}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {lang === 'bs' ? 'Ovdje se mogu dodati dodatni poslovi za radnika.' : 'Additional jobs can be added here.'}
                    </p>
                </Accordion>

                {/* ── NAPOMENA ── */}
                <div className="card" style={{ marginBottom: 24, marginTop: 24 }}>
                    <div className="card-body">
                        <div className="form-group">
                            <label className="form-label">{t('note')}</label>
                            <textarea className="form-textarea" value={formData.napomena} onChange={e => updateField('napomena', e.target.value)}
                                placeholder={lang === 'bs' ? 'Napomena...' : 'Note...'} rows={3} />
                        </div>
                    </div>
                </div>

                {/* ── CERTIFICATE FORM MODAL ── */}
                {showCertForm && (
                    <div className="modal-overlay" onClick={() => { setShowCertForm(false); setCertEditId(null); }}>
                        <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>📜 {certEditId ? (lang === 'bs' ? 'Uredi uvjerenje' : 'Edit Certificate') : (lang === 'bs' ? 'Novo uvjerenje' : 'New Certificate')}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => { setShowCertForm(false); setCertEditId(null); }}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Oznaka' : 'Code'} *</label>
                                        <input className="form-input" value={certFormData.oznaka} onChange={e => setCertFormData({ ...certFormData, oznaka: e.target.value })} placeholder="ZNR-001" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Tip uvjerenja' : 'Cert. type'}</label>
                                        <select className="form-select" value={certFormData.tipUvjerenja} onChange={e => setCertFormData({ ...certFormData, tipUvjerenja: e.target.value })}>
                                            {certTypes.map(ct => <option key={ct.id} value={ct.oznaka}>{ct.naziv}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">{t('name')} *</label>
                                        <input className="form-input" value={certFormData.ime} onChange={e => setCertFormData({ ...certFormData, ime: e.target.value })} placeholder={lang === 'bs' ? 'Naziv osposobljavanja' : 'Certificate name'} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('date')}</label>
                                        <input className="form-input" type="date" value={certFormData.datum} onChange={e => setCertFormData({ ...certFormData, datum: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Vrijedi do' : 'Valid until'}</label>
                                        <input className="form-input" type="date" value={certFormData.vrijediDo} onChange={e => setCertFormData({ ...certFormData, vrijediDo: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Sposobnost' : 'Capability'}</label>
                                        <select className="form-select" value={certFormData.sposobnost} onChange={e => setCertFormData({ ...certFormData, sposobnost: e.target.value })}>
                                            <option value="Sposoban">{lang === 'bs' ? 'Sposoban' : 'Capable'}</option>
                                            <option value="Nesposoban">{lang === 'bs' ? 'Nesposoban' : 'Not capable'}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Upisao' : 'Entered by'}</label>
                                        <input className="form-input" value={certFormData.upisao} onChange={e => setCertFormData({ ...certFormData, upisao: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => { setShowCertForm(false); setCertEditId(null); }}>{t('cancel')}</button>
                                <button className="btn btn-primary" onClick={handleSaveCert}>💾 {t('save')}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PPE FORM MODAL ── */}
                {showPpeForm && (
                    <div className="modal-overlay" onClick={() => { setShowPpeForm(false); setPpeEditId(null); }}>
                        <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>🦺 {ppeEditId ? (lang === 'bs' ? 'Uredi zaduženje' : 'Edit Assignment') : (lang === 'bs' ? 'Novo zaduženje OZO' : 'New PPE Assignment')}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => { setShowPpeForm(false); setPpeEditId(null); }}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label className="form-label">{t('name')} *</label>
                                    <select className="form-select" value={ppeFormData.naziv} onChange={e => setPpeFormData({ ...ppeFormData, naziv: e.target.value })}>
                                        <option value="">-- {lang === 'bs' ? 'Odaberite OZO' : 'Select PPE'} --</option>
                                        {ppeTypes.map(pt => <option key={pt.id} value={pt.naziv}>{pt.naziv}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Datum zaduženja' : 'Assignment date'}</label>
                                        <input className="form-input" type="date" value={ppeFormData.datumZaduzenja} onChange={e => setPpeFormData({ ...ppeFormData, datumZaduzenja: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Datum razduženja' : 'Return date'}</label>
                                        <input className="form-input" type="date" value={ppeFormData.datumRazduzenja} onChange={e => setPpeFormData({ ...ppeFormData, datumRazduzenja: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => { setShowPpeForm(false); setPpeEditId(null); }}>{t('cancel')}</button>
                                <button className="btn btn-primary" onClick={handleSavePpe}>💾 {t('save')}</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── FOOTER ACTIONS (sticky) ── */}
                <div className="sticky-footer" style={{
                    position: 'sticky', bottom: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '12px 0',
                    display: 'flex', alignItems: 'center', gap: 12, zIndex: 50,
                }}>
                    <button className="btn btn-ghost" onClick={handleCancel}>← </button>
                    <button className="btn btn-primary" onClick={() => handleSave(false)}>💾 {t('save')}</button>
                    <button className="btn btn-outline" onClick={() => handleSave(true)}>💾 {t('saveAndAddNew')}</button>
                    <button className="btn btn-ghost" onClick={handleCancel}>↩ {t('discard')}</button>
                </div>
            </div>
        );
    }

    // ── LIST VIEW ──

    return (
        <>
            <div className="animate-fadeIn">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    👷 {t('workers')}
                </h1>

                <div className="card">
                    <div className="card-body">
                        {/* Toolbar */}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                            <button className="btn btn-primary btn-sm" onClick={handleNew}>
                                + {t('add')}
                            </button>
                            <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                                <input
                                    placeholder={t('searchBtn') + '...'}
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
                                />
                                <button className="btn btn-ghost btn-sm" onClick={() => setPage(1)}>{t('searchBtn')}</button>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-light)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={showFormer} onChange={(e) => setShowFormer(e.target.checked)} />
                                {t('formerWorkers')}
                            </label>
                            <div style={{ marginLeft: 'auto', position: 'relative' }}>
                                <button className="btn btn-dark btn-sm" onClick={() => {
                                    const el = document.getElementById('group-action-menu');
                                    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                                }}>{t('selectGroupAction')} ▼</button>
                                <div id="group-action-menu" className="dropdown-menu" style={{ display: 'none', right: 0, top: 'calc(100% + 4px)', minWidth: 200 }}>
                                    <button className="dropdown-item" onClick={() => { alert(lang === 'bs' ? 'Grupna akcija: Generisanje dokumenata' : 'Group action: Generate documents'); }}>📄 {lang === 'bs' ? 'Generiši dokumente' : 'Generate documents'}</button>
                                    <button className="dropdown-item" onClick={() => { alert(lang === 'bs' ? 'Grupna akcija: Slanje obavijesti' : 'Group action: Send notifications'); }}>✉️ {lang === 'bs' ? 'Pošalji obavijesti' : 'Send notifications'}</button>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => { if (confirm(t('confirmDelete'))) alert(lang === 'bs' ? 'Grupno brisanje' : 'Group delete'); }}>🗑️ {t('delete')}</button>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 100 }}>{t('actions')}</th>
                                        <th>{t('workerName')} ↑</th>
                                        <th>{t('workerSurname')} ↑</th>
                                        <th>{t('oib')}</th>
                                        <th>{t('orgUnit')}</th>
                                        <th>{t('workplace')}</th>
                                        <th><input type="checkbox" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedWorkers.length === 0 ? (
                                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    ) : (
                                        pagedWorkers.map((w) => (
                                            <tr key={w.id}>
                                                <td style={{ position: 'relative' }} ref={actionMenuId === w.id ? actionRef : null}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                            onClick={() => handleEdit(w)}>▶</button>
                                                        <button className="btn btn-primary btn-sm"
                                                            onClick={() => setActionMenuId(actionMenuId === w.id ? null : w.id)}>
                                                            {t('actions')} ▼
                                                        </button>
                                                    </div>
                                                    {actionMenuId === w.id && (
                                                        <div className="dropdown-menu" style={{ top: 'calc(100% + 4px)', left: 0, minWidth: 200 }}>
                                                            <button className="dropdown-item" onClick={() => handleEdit(w)}>📂 {t('open')}</button>
                                                            <div className="dropdown-submenu">
                                                                <button className="dropdown-item" onClick={e => { e.stopPropagation(); }}>📄 {t('enterForm')} ▶</button>
                                                                <div className="dropdown-menu">
                                                                    <button className="dropdown-item" onClick={() => router.push('/dashboard/form-ro1')}>RO-1</button>
                                                                    <button className="dropdown-item" onClick={() => router.push('/dashboard/form-ro2')}>RO-2</button>
                                                                    <button className="dropdown-item" onClick={() => router.push('/dashboard/referral-ra1')}>RA-1</button>
                                                                    <button className="dropdown-item" onClick={() => router.push('/dashboard/night-work')}>NR-1</button>
                                                                    <button className="dropdown-item" onClick={() => router.push('/dashboard/diseases')}>PB</button>
                                                                    <button className="dropdown-item" onClick={() => router.push('/dashboard/injuries')}>{lang === 'bs' ? 'Ozljeda na radu' : 'Work injury'}</button>
                                                                </div>
                                                            </div>
                                                            <div className="dropdown-submenu">
                                                                <button className="dropdown-item" onClick={e => { e.stopPropagation(); }}>🖨️ {t('print')} ▶</button>
                                                                <div className="dropdown-menu">
                                                                    <button className="dropdown-item" onClick={() => window.print()}>EK-1</button>
                                                                    <button className="dropdown-item" onClick={() => window.print()}>EK-2</button>
                                                                    <button className="dropdown-item" onClick={() => window.print()}>EK-ZS</button>
                                                                    <button className="dropdown-item" onClick={() => window.print()}>EK-PP</button>
                                                                    <button className="dropdown-item" onClick={() => window.print()}>OZO - {lang === 'bs' ? 'Potpis' : 'Signature'}</button>
                                                                </div>
                                                            </div>
                                                            <button className="dropdown-item" onClick={() => { setActionMenuId(null); router.push('/dashboard/archive'); }}>📁 {t('files')}</button>
                                                            <button className="dropdown-item" onClick={() => { setActionMenuId(null); alert(lang === 'bs' ? 'Funkcija preuzimanja dolazi uskoro.' : 'Download coming soon.'); }}>⬇️ {t('downloadFiles')}</button>
                                                            <div className="dropdown-divider" />
                                                            <button className="dropdown-item" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(w.id)}>🗑️ {t('delete')}</button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>
                                                    <button
                                                        onClick={() => setViewWorkerId(w.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                                                        title={lang === 'bs' ? 'Klikni za pregled profila' : 'Click to view profile'}
                                                    >{w.ime}</button>
                                                </td>
                                                <td style={{ fontWeight: 600 }}>
                                                    <button
                                                        onClick={() => setViewWorkerId(w.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--text-muted)' }}
                                                        title={lang === 'bs' ? 'Klikni za pregled profila' : 'Click to view profile'}
                                                    >{w.prezime}</button>
                                                </td>
                                                <td><code style={{ fontSize: '0.85rem' }}>{w.oib || w.jmbg}</code></td>
                                                <td>
                                                    {w.orgJedinicaId ? (
                                                        <button onClick={() => router.push('/dashboard/org-units')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.82rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }} title={lang === 'bs' ? 'Otvori organizacijsku jedinicu' : 'Open org unit'}>
                                                            {getOrgUnitName(w.orgJedinicaId)}
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {w.radnoMjestoId ? (
                                                        <button onClick={() => router.push('/dashboard/workplaces')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.82rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'dotted' }} title={lang === 'bs' ? 'Otvori radno mjesto' : 'Open workplace'}>
                                                            {getWorkplaceName(w.radnoMjestoId)}
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                                <td><input type="checkbox" /></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="pagination">
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                {filteredWorkers.length > 0 ? `${(page - 1) * perPage + 1} - ${Math.min(page * perPage, filteredWorkers.length)}` : '0'} {t('of')} {filteredWorkers.length} {t('records')}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button className="pagination-btn" onClick={() => setPage(1)} disabled={page === 1}>⏮</button>
                                <button className="pagination-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>◀</button>
                                <button className="pagination-btn active">{page}</button>
                                <button className="pagination-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>▶</button>
                                <button className="pagination-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages}>⏭</button>
                                <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                                    style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                                    <option value={10}>10 {t('perPage')}</option>
                                    <option value={25}>25 {t('perPage')}</option>
                                    <option value={50}>50 {t('perPage')}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Worker Profile Modal */}
            {
                viewWorkerId && (
                    <WorkerProfileModal
                        workerId={viewWorkerId}
                        onClose={() => setViewWorkerId(null)}
                        onSaved={() => { loadData(); setViewWorkerId(null); }}
                    />
                )
            }
        </>
    );
}

// ── REUSABLE COMPONENTS ──

function Field({ label, value, onChange, type = 'text', required, placeholder, ...props }) {
    return (
        <div className="form-group">
            <label className="form-label" style={required ? { fontWeight: 700 } : {}}>
                {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
            </label>
            <input
                className="form-input"
                type={type}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={required ? (placeholder || 'Obavezno polje') : placeholder}
                style={required && !value ? { borderColor: '#FF9800' } : {}}
                {...props}
            />
        </div>
    );
}

function SelectField({ label, value, onChange, options, placeholder, required }) {
    return (
        <div className="form-group">
            <label className="form-label" style={required ? { fontWeight: 700 } : {}}>
                {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
            </label>
            <select className="form-select" value={value || ''} onChange={(e) => onChange(e.target.value)}
                style={required && !value ? { borderColor: '#FF9800' } : {}}>
                <option value="">{placeholder || '-- Odaberi --'}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

function Accordion({ title, open, onToggle, children }) {
    return (
        <div className="card" style={{ marginBottom: 12 }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: open ? 'var(--bg-sidebar)' : 'linear-gradient(135deg, #455a64, #37474f)', color: 'white',
                    border: 'none', borderRadius: open ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
                    cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.95rem',
                    transition: 'all 0.2s',
                }}
            >
                {title}
                <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(0deg)' }}>
                    {open ? '−' : '+'}
                </span>
            </button>
            {open && (
                <div className="card-body" style={{ borderTop: '1px solid var(--border-light)' }}>
                    {children}
                </div>
            )}
        </div>
    );
}
