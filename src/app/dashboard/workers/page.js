'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    getAll, getById, create, update, remove, removeWorkerCascade, removeManyWorkersCascade, search,
    COLLECTIONS, getOrgUnitName, getWorkplaceName,
    getWorkerCertificates, getWorkerPPE, formatDate, todayISO,
} from '@/lib/dataStore';
import { printZosPdf } from '@/lib/zosPdfGenerator';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { useSortedList } from '@/hooks/useSortedList';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useDialog } from '@/hooks/useDialog';

const emptyWorker = {
    prefix: '', ime: '', prezime: '', sufiks: '',
    imeRoditelja: '', jmbg: '', oib: '', zivotnaDob: 0,
    stazDoDolaska: '', datumZaposlenja: '', datumOdlaska: '',
    ukupniStaz: '', koef: '', radnoMjestoId: '', orgJedinicaId: '',
    lokacija: '', evidencijskiBroj: '', vanjskiSuradnik: false,
    ulica: '', kucniBroj: '', mjestoId: '', opcina: '',
    telefonTvrtki: '', telefonKuce: '', mobitel: '', email: '',
    spol: '', datumRodenja: '', mjestoRodenja: '', opcinaRodenja: '',
    aktivan: true, posebniUvjeti: false, napomena: '', slika: '', dodatniPoslovi: '',
};

function WorkersPageInner() {
    const { t, lang } = useLanguage();
    const { activeCompanyId } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { markDirty, markClean } = useUnsavedChanges(async () => await handleSave());
    const { alert, confirm, prompt, DialogRenderer } = useDialog();
    const isDirtyRef = useRef(false);
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
    const [selectedIds, setSelectedIds] = useState(new Set());
    const actionRef = useRef(null);
    const photoInputRef = useRef(null);
    const editingWorkerRef = useRef(null); // tracks current worker id even across saves
    const openWorkerHandledRef = useRef(null); // stores last handled openWorker ID (not boolean)
    const uvjerenjaRef = useRef(null); // ref for scroll-to on cert section
    const ozoRef = useRef(null);       // ref for scroll-to on OZO section
    // Certificate form state
    const [showCertForm, setShowCertForm] = useState(false);
    const [certFormData, setCertFormData] = useState({ oznaka: '', datum: '', vrijediDo: '', ime: '', tipUvjerenja: 'ZNR', upisao: 'Admin', sposobnost: 'Sposoban' });
    const [certEditId, setCertEditId] = useState(null);
    const [certSearch, setCertSearch] = useState('');
    const [certMenuId, setCertMenuId] = useState(null); // active cert action dropdown
    const [certMenuPos, setCertMenuPos] = useState({ top: 0, left: 0 }); // fixed position
    const certMenuRef = useRef(null);
    const certMenuClosingRef = useRef(false); // tracks mousedown-closes-menu so click doesn't reopen
    const [showOnlyValidCerts, setShowOnlyValidCerts] = useState(false);
    const [showExpiringSoon, setShowExpiringSoon] = useState(false);
    const [expiringSoonDays, setExpiringSoonDays] = useState(60);
    // PPE form state
    const [showPpeForm, setShowPpeForm] = useState(false);
    const [ppeFormData, setPpeFormData] = useState({ naziv: '', datumZaduzenja: '', datumRazduzenja: '' });
    const [ppeEditId, setPpeEditId] = useState(null);
    const [certTypes, setCertTypes] = useState([]);
    const [ppeTypes, setPpeTypes] = useState([]);
    const [places, setPlaces] = useState([]);

    const loadData = useCallback(() => {
        setWorkers(getAll(COLLECTIONS.WORKERS));
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        const stored = getAll(COLLECTIONS.CERT_TYPES);
        const storedNames = stored.map(x => (x.naziv || '').toLowerCase());
        const DEFAULT_CT = [
            'Koordinatora ZNR tijekom građenja', 'Koordinatora ZNR tijekom izrade projekta',
            'Povremena provjera znanja radnika iz zaštite na radu',
            'Stručnjak ZNR - opći dio', 'Stručnjak ZNR - opći i posebni dio', 'Stručnjak ZNR - posebni dio',
            'Usavršavanje stručnjaka ZNR', 'Uvjerenje o osposobljenosti za pružanje prve pomoći',
            'Uvjerenje o zdravstvenoj sposobnosti radnika',
            'Zapisnik o ocjeni osposobljenosti radnika za rad na siguran način',
            'PP - Osposobljenost za gašenje požara', 'Licenca / Certifikat',
        ];
        setCertTypes([
            ...stored,
            ...DEFAULT_CT.filter(n => !storedNames.includes(n.toLowerCase())).map(n => ({ id: `default_${n}`, naziv: n, oznaka: n })),
        ]);
        setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));
        setPlaces(getAll(COLLECTIONS.PLACES));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Auto-calculate Ukupni staž ──────────────────────────────────────────
    useEffect(() => {
        const { stazDoDolaska, datumZaposlenja, datumOdlaska } = formData;
        if (!datumZaposlenja) return;

        // Parse stazDoDolaska (formats: '5g2mj4d', '050204', '5 2 4')
        let pg = 0, pm = 0, pd = 0;
        if (stazDoDolaska) {
            const m1 = stazDoDolaska.match(/(\d+)g(\d+)mj(\d+)d/i);
            if (m1) { pg = +m1[1]; pm = +m1[2]; pd = +m1[3]; }
            else {
                const m2 = stazDoDolaska.match(/^(\d{2})(\d{2})(\d{2})$/);
                if (m2) { pg = +m2[1]; pm = +m2[2]; pd = +m2[3]; }
            }
        }

        const start = new Date(datumZaposlenja);
        const end = datumOdlaska ? new Date(datumOdlaska) : new Date();
        if (isNaN(start) || isNaN(end) || end < start) return;

        let yy = end.getFullYear() - start.getFullYear();
        let mm = end.getMonth() - start.getMonth();
        let dd = end.getDate() - start.getDate();
        if (dd < 0) { mm--; dd += 30; }
        if (mm < 0) { yy--; mm += 12; }

        // Add prior experience
        dd += pd; if (dd >= 30) { mm++; dd -= 30; }
        mm += pm; if (mm >= 12) { yy++; mm -= 12; }
        yy += pg;

        const result = `${yy}g${mm}mj${dd}d`;
        setFormData(prev => ({ ...prev, ukupniStaz: result }));
    }, [formData.stazDoDolaska, formData.datumZaposlenja, formData.datumOdlaska]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-calculate Zivotna dob from Datum rodenja
    useEffect(() => {
        if (!formData.datumRodenja) return;
        const birth = new Date(formData.datumRodenja);
        if (isNaN(birth)) return;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const mth = today.getMonth() - birth.getMonth();
        if (mth < 0 || (mth === 0 && today.getDate() < birth.getDate())) age--;
        setFormData(prev => ({ ...prev, zivotnaDob: age }));
    }, [formData.datumRodenja]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const handleClick = (e) => {
            if (actionRef.current && !actionRef.current.contains(e.target)) setActionMenuId(null);
            if (certMenuRef.current && !certMenuRef.current.contains(e.target)) {
                if (certMenuId !== null) certMenuClosingRef.current = true; // was open — flag closing
                setCertMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [certMenuId]);

    // Auto-open from WorkerProfileModal "Otvori potpuno" or cert-return via ?openWorker=ID
    useEffect(() => {
        if (workers.length === 0) return;
        const openId = searchParams?.get('openWorker');
        if (!openId) return;
        // Only skip if we already handled THIS exact ID (prevents refiring on loadData rerenders)
        if (openWorkerHandledRef.current === openId) return;
        const found = workers.find(x => x.id === openId);
        if (found) {
            openWorkerHandledRef.current = openId; // mark as handled for THIS id
            handleEdit(found);
            // Check for section param — open and scroll to the right accordion
            const section = searchParams?.get('section');
            if (section === 'ozo') {
                setTimeout(() => {
                    setOpenSections(prev => ({ ...prev, ozo: true, uvjerenja: false }));
                    ozoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 350);
            } else if (section === 'uvjerenja') {
                setTimeout(() => {
                    setOpenSections(prev => ({ ...prev, uvjerenja: true }));
                    uvjerenjaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 350);
            }
            // Clean URL so param doesn't persist on next loadData()
            router.replace('/dashboard/workers', { scroll: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workers, searchParams]);

    // ── Zia agent: auto-open new worker form with pre-filled name ─────────────
    useEffect(() => {
        if (searchParams?.get('zia_new') !== '1') return;
        const ime = searchParams.get('ime') || '';
        const prezime = searchParams.get('prezime') || '';
        setFormData({ ...emptyWorker, ime, prezime });
        setEditingWorker(null);
        setCertificates([]);
        setPpeAssign([]);
        setShowForm(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const filteredWorkers = workers.filter(w => {
        const matchSearch = !searchTerm || `${w.ime} ${w.prezime} ${w.jmbg} ${w.oib}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = showFormer ? !w.aktivan : w.aktivan;
        return matchSearch && matchStatus;
    });

    const { sorted: sortedWorkers, toggleSort: tW, sortIcon: siW, thStyle: tsW } = useSortedList(filteredWorkers, 'prezime');
    const totalPages = Math.max(1, Math.ceil(sortedWorkers.length / perPage));
    const pagedWorkers = sortedWorkers.slice((page - 1) * perPage, page * perPage);

    // ── Selection helpers ──
    const pagedIds = pagedWorkers.map(w => w.id);
    const allPageSelected = pagedIds.length > 0 && pagedIds.every(id => selectedIds.has(id));
    const somePageSelected = pagedIds.some(id => selectedIds.has(id));
    const toggleSelectAll = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allPageSelected) { pagedIds.forEach(id => next.delete(id)); }
            else { pagedIds.forEach(id => next.add(id)); }
            return next;
        });
    };
    const toggleOne = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

    // Filtered certificates for display
    const filteredCerts = certificates.filter(c => {
        const expDate = c.vrijediDo ? new Date(c.vrijediDo) : null;
        const now = new Date();
        const isExpired = expDate && expDate < now;
        if (showOnlyValidCerts && isExpired) return false;
        if (showExpiringSoon) {
            if (!expDate) return false;
            const diffDays = (expDate - now) / (1000 * 60 * 60 * 24);
            if (diffDays > expiringSoonDays || diffDays < 0) return false;
        }
        if (!certSearch) return true;
        const q = certSearch.toLowerCase();
        return (c.oznaka || '').toLowerCase().includes(q) || (c.ime || '').toLowerCase().includes(q) || (c.tipUvjerenja || '').toLowerCase().includes(q);
    });

    // Save certificate
    const handleSaveCert = async () => {
        if (!certFormData.oznaka || !certFormData.ime) { await alert(lang === 'bs' ? 'Oznaka i naziv su obavezni!' : 'Code and name are required!'); return; }
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
    const handleSavePpe = async () => {
        if (!ppeFormData.naziv) { await alert(lang === 'bs' ? 'Naziv je obavezan!' : 'Name is required!'); return; }
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
        editingWorkerRef.current = null;
        setCertificates([]);
        setPpeAssign([]);
        setShowForm(true);
    };

    const handleEdit = (worker) => {
        setFormData({ ...worker });
        setEditingWorker(worker.id);
        editingWorkerRef.current = worker.id;
        setCertificates(getWorkerCertificates(worker.id));
        setPpeAssign(getWorkerPPE(worker.id));
        setActionMenuId(null);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        const ok = await confirm(lang === 'bs' ? 'Jeste li sigurni da želite obrisati ovog radnika?' : 'Are you sure you want to delete this worker?');
        if (ok) {
            removeWorkerCascade(id);
            setActionMenuId(null);
            loadData();
        }
    };

    const handleSave = async (addNew = false) => {
        if (!formData.ime || !formData.prezime) {
            await alert(lang === 'bs' ? 'Ime i prezime su obavezna polja!' : 'First name and last name are required!');
            return null;
        }
        let savedId = editingWorker;
        if (editingWorker) {
            update(COLLECTIONS.WORKERS, editingWorker, formData);
        } else {
            const newWorker = create(COLLECTIONS.WORKERS, formData);
            savedId = newWorker.id;
            setEditingWorker(savedId);
            editingWorkerRef.current = savedId;
        }
        loadData();
        markClean();
        isDirtyRef.current = false;
        if (addNew) {
            setFormData({ ...emptyWorker });
            setEditingWorker(null);
            editingWorkerRef.current = null;
            openWorkerHandledRef.current = null;
            setCertificates([]);
            setPpeAssign([]);
        } else {
            setShowForm(false);
            openWorkerHandledRef.current = null;
        }
        setSelectedIds(new Set()); // clear selection after save
        return savedId;
    };

    const handleCancel = () => {
        markClean();
        isDirtyRef.current = false;
        setShowForm(false);
        setEditingWorker(null);
    };

    const handleBack = async () => {
        if (isDirtyRef.current) {
            const choice = await confirm(
                lang === 'bs'
                    ? 'Imate nesačuvane promjene. Odbaciti promjene?'
                    : 'You have unsaved changes. Discard changes?'
            );
            if (!choice) return; // stay
        }
        handleCancel();
    };

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        markDirty();
        isDirtyRef.current = true;
    };

    // ── Photo upload with auto-crop to face (center-top crop, 3:4 ratio) ──
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            await alert(lang === 'bs' ? 'Molimo odaberite sliku.' : 'Please select an image file.');
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
                    <button className="btn btn-ghost" onClick={handleBack}>← {t('discard')}</button>
                    <h1 style={{ margin: 0 }}>
                        👷 {editingWorker ? (lang === 'bs' ? 'Uredi radnika' : 'Edit Worker') : (lang === 'bs' ? 'Novi radnik' : 'New Worker')}
                    </h1>
                </div>
                <DialogRenderer />

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
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
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
                            
                            <Field label={t('workerName')} value={formData.ime} onChange={v => updateField('ime', v)} required />
                            <Field label={t('workerSurname')} value={formData.prezime} onChange={v => updateField('prezime', v)} required />
                            <Field label={t('dateOfBirth')} value={formData.datumRodenja} onChange={v => updateField('datumRodenja', v)} type="date" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                            <Field label={t('parentName')} value={formData.imeRoditelja} onChange={v => updateField('imeRoditelja', v)} />
                            <Field label="JMBG" value={formData.jmbg} onChange={v => updateField('jmbg', v)} placeholder="13 cifara" />
                            <Field label={t('oib')} value={formData.oib} onChange={v => updateField('oib', v)} />
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    {t('age')}
                                    <InfoTip text={lang === 'bs' ? 'Automatski se računa na osnovu datuma rođenja.' : 'Auto-calculated based on date of birth.'} />
                                </label>
                                <div className="form-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', color: formData.zivotnaDob ? 'var(--text)' : 'var(--text-muted)', cursor: 'not-allowed' }}>{formData.zivotnaDob || '—'}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20, alignItems: 'end' }}>
                            <StazPicker label={t('priorExperience')} value={formData.stazDoDolaska} onChange={v => updateField('stazDoDolaska', v)} />
                            <Field label={t('employmentDate')} value={formData.datumZaposlenja} onChange={v => updateField('datumZaposlenja', v)} type="date" />
                            <Field label={t('departureDate')} value={formData.datumOdlaska} onChange={v => updateField('datumOdlaska', v)} type="date" />
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    {t('totalExperience')}
                                    <InfoTip text={lang === 'bs' ? 'Automatski se računa: Staž do dolaska + radni staž u firmi (od Datum zaposlenja do Datum odlaska ili danas).' : 'Auto-calculated from: prior experience + work tenure since employment date.'} />
                                </label>
                                <div className="form-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', color: formData.ukupniStaz ? 'var(--text)' : 'var(--text-muted)', cursor: 'not-allowed' }}>{formData.ukupniStaz || '—'}</div>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    {t('coefficient')}
                                    <InfoTip text="Koeficijent radnog staža (Minuli rad)" />
                                </label>
                                <input className="form-input" value={formData.koef} onChange={e => updateField('koef', e.target.value)} title="Koeficijent radnog staža (Minuli rad)" />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <SelectField label={t('workplace')} value={formData.radnoMjestoId} onChange={async (v) => {
                                const oldId = formData.radnoMjestoId;
                                updateField('radnoMjestoId', v);
                                // Auto-invalidate ZOS when Radno mjesto changes (Član 34. Zakona o ZNR FBiH)
                                if (editingWorker && oldId && v && oldId !== v) {
                                    const allCerts = getWorkerCertificates(editingWorker);
                                    const zosCerts = allCerts.filter(c =>
                                        (c.ime || '').toLowerCase().includes('zapisnik o ocjeni osposobljenosti') &&
                                        c.sposobnost !== 'Nevažeće'
                                    );
                                    if (zosCerts.length > 0) {
                                        const oldWpName = getWorkplaceName(oldId);
                                        const newWpName = getWorkplaceName(v);
                                        const ok = await confirm(lang === 'bs'
                                            ? `Promjena radnog mjesta (${oldWpName} → ${newWpName}) zahtijeva novo osposobljavanje.\n\n${zosCerts.length} ZOS uvjerenje(a) će biti označeno kao "Nevažeće".\n\nNastaviti?`
                                            : `Workplace change (${oldWpName} → ${newWpName}) requires new training.\n\n${zosCerts.length} ZOS certificate(s) will be marked as "Invalid".\n\nContinue?`);
                                        if (ok) {
                                            for (const cert of zosCerts) {
                                                update(COLLECTIONS.CERTIFICATES, cert.id, {
                                                    sposobnost: 'Nevažeće',
                                                    sposoban: false,
                                                    ogranicenja: `${cert.ogranicenja ? cert.ogranicenja + ' | ' : ''}Nevažeće — promjena radnog mjesta sa "${oldWpName}" na "${newWpName}" (${new Date().toLocaleDateString('hr-HR')})`,
                                                });
                                            }
                                            setCertificates(getWorkerCertificates(editingWorker));
                                            await alert(lang === 'bs'
                                                ? `⚠️ ${zosCerts.length} ZOS uvjerenje(a) označeno kao "Nevažeće". Radnik mora proći novo osposobljavanje za novo radno mjesto.`
                                                : `⚠️ ${zosCerts.length} ZOS certificate(s) marked as "Invalid". Worker must undergo new training.`);
                                        } else {
                                            updateField('radnoMjestoId', oldId); // revert
                                        }
                                    }
                                }
                            }}
                                options={workplaces.map(wp => ({ value: wp.id, label: wp.naziv }))} />
                            <SelectField label={t('orgUnit')} value={formData.orgJedinicaId} onChange={v => updateField('orgJedinicaId', v)}
                                options={orgUnits.map(ou => ({ value: ou.id, label: ou.naziv }))} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'end', marginBottom: 20 }}>
                            <Field label={t('location')} value={formData.lokacija} onChange={v => updateField('lokacija', v)} />
                            <Field label={t('evidenceNumber')} value={formData.evidencijskiBroj} onChange={v => updateField('evidencijskiBroj', v)} />
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingBottom: 0, marginBottom: 0 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={formData.vanjskiSuradnik} onChange={e => updateField('vanjskiSuradnik', e.target.checked)} />
                                    {t('externalAssociate')}
                                </label>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">{lang === 'bs' ? 'Dodatni poslovi' : 'Additional jobs'}</label>
                            <textarea className="form-textarea" value={formData.dodatniPoslovi || ''} onChange={e => updateField('dodatniPoslovi', e.target.value)}
                                placeholder={lang === 'bs' ? 'Opišite dodatne poslove i obaveze koje radnik obavlja...' : 'Describe additional jobs...'} rows={2} />
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
                            options={places.map(p => ({ value: p.id, label: `${p.naziv} (${p.postBroj})` }))} placeholder={lang === 'bs' ? 'Odaberite mjesto' : 'Select place'} />
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
                <div ref={uvjerenjaRef}>
                <Accordion title={t('workerCerts')} open={openSections.uvjerenja} onToggle={() => toggleSection('uvjerenja')}>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.85rem', flex: 1 }}
                                placeholder={t('searchBtn') + '...'}
                                value={certSearch} onChange={e => setCertSearch(e.target.value)} />
                            {certSearch && <button className="btn btn-ghost btn-sm" onClick={() => setCertSearch('')}>✕</button>}
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={async () => {
                            // If worker not yet saved, save it first to get a real ID
                            let wId = editingWorkerRef.current;
                            if (!wId) {
                                if (!formData.ime || !formData.prezime) {
                                    await alert(lang === 'bs' ? 'Molimo unesite ime i prezime radnika prije dodavanja uvjerenja.' : 'Please enter worker name before adding a certificate.');
                                    return;
                                }
                                wId = await handleSave(false);
                                if (!wId) return;
                            }
                            markClean();
                            router.push(`/dashboard/worker-certificates/create?workerId=${wId}&returnTo=${encodeURIComponent(`/dashboard/workers?openWorker=${wId}&section=uvjerenja`)}`);
                        }}>+ {t('newCertificate')}</button>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={showOnlyValidCerts} onChange={e => setShowOnlyValidCerts(e.target.checked)} /> {t('showOnlyValid')}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={showExpiringSoon} onChange={e => { setShowExpiringSoon(e.target.checked); if (e.target.checked) setShowOnlyValidCerts(false); }} />
                            {lang === 'bs' ? 'Ističe u' : 'Expiring in'}
                            <select
                                value={expiringSoonDays}
                                onChange={e => setExpiringSoonDays(Number(e.target.value))}
                                disabled={!showExpiringSoon}
                                style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: '0.78rem', background: 'var(--bg-card)', color: 'var(--text)', cursor: showExpiringSoon ? 'pointer' : 'not-allowed', opacity: showExpiringSoon ? 1 : 0.5 }}
                            >
                                <option value={30}>30 {lang === 'bs' ? 'dana' : 'days'}</option>
                                <option value={60}>60 {lang === 'bs' ? 'dana' : 'days'}</option>
                                <option value={90}>90 {lang === 'bs' ? 'dana' : 'days'}</option>
                                <option value={180}>180 {lang === 'bs' ? 'dana' : 'days'}</option>
                            </select>
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
                                    const returnToParam = encodeURIComponent(`/dashboard/workers?openWorker=${editingWorker}&section=uvjerenja`);
                                    const isZOS = (c.ime || '').toLowerCase().includes('zapisnik o ocjeni osposobljenosti');
                                    return (
                                        <tr key={c.id}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => { markClean(); router.push(`/dashboard/worker-certificates/edit/${c.id}?returnTo=${returnToParam}`); }}
                                        >
                                            <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', paddingLeft: 10, paddingRight: 10 }}
                                                    onClick={(e) => {
                                                         e.stopPropagation();
                                                         // If mousedown already closed this menu, don't reopen
                                                         if (certMenuClosingRef.current) { certMenuClosingRef.current = false; return; }
                                                         if (certMenuId === c.id) { setCertMenuId(null); return; }
                                                         const rect = e.currentTarget.getBoundingClientRect();
                                                         const menuW = 230;
                                                         // Always open BELOW the button, clamp to right edge only
                                                         const left = Math.min(rect.left, window.innerWidth - menuW - 8);
                                                         const top = rect.bottom + 4;
                                                         setCertMenuPos({ top, left });
                                                         setCertMenuId(c.id);
                                                     }}
                                                >
                                                    ⚙️ {lang === 'bs' ? 'Akcije' : 'Actions'} ▾
                                                </button>
                                                {/* Portal: mount dropdown directly on document.body to escape all CSS transforms */}
                                                {certMenuId === c.id && typeof document !== 'undefined' && createPortal(
                                                    <div ref={certMenuRef} style={{
                                                        position: 'fixed',
                                                        top: certMenuPos.top,
                                                        left: certMenuPos.left,
                                                        zIndex: 99999,
                                                        background: 'var(--bg-card)',
                                                        border: '1px solid var(--border)',
                                                        borderRadius: 'var(--radius-md)',
                                                        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                                                        minWidth: 230,
                                                        padding: '4px 0',
                                                    }}>
                                                        <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                            onClick={() => { setCertMenuId(null); setCertFormData({ ...c }); setCertEditId(c.id); setShowCertForm(true); }}>
                                                            ✏️ <span>{lang === 'bs' ? 'Brza izmjena' : 'Quick edit'}</span>
                                                        </button>
                                                        <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                            onClick={() => { setCertMenuId(null); markClean(); router.push(`/dashboard/worker-certificates/edit/${c.id}?returnTo=${returnToParam}`); }}>
                                                            📄 <span>{lang === 'bs' ? 'Uredi potpuno' : 'Edit full form'}</span>
                                                        </button>
                                                        <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                            onClick={() => { setCertMenuId(null); markClean(); router.push(`/dashboard/worker-certificates/create?workerId=${editingWorker}&copyFrom=${c.id}&returnTo=${returnToParam}`); }}>
                                                            📋 <span>{lang === 'bs' ? 'Kopiraj uvjerenje' : 'Copy certificate'}</span>
                                                        </button>
                                                        {isZOS && (
                                                            <>
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
                                                                <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                                    onClick={() => {
                                                                        setCertMenuId(null);
                                                                        const wk = getAll(COLLECTIONS.WORKERS).find(x => x.id === editingWorker);
                                                                        if (!wk) return;
                                                                        const wps = getAll(COLLECTIONS.WORKPLACES);
                                                                        const wpN = wps.find(wp => wp.id === wk.radnoMjestoId)?.naziv || c.izdanoZaRadnoMjesto || '';
                                                                        const companyFull = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                                                                        printZosPdf({ company: companyFull, worker: wk, workplaceName: wpN, training: { naziv: c.izdanoIzObuke || c.ime }, officer: c.strucnjakZNR || c.upisao || '', date: c.datum || new Date().toISOString(), certOznaka: c.oznaka, testResult: c.rezultatTesta || '' });
                                                                    }}>
                                                                    🖨️ <span>{lang === 'bs' ? 'Ispiši ZOS dokument' : 'Print ZOS document'}</span>
                                                                </button>
                                                                <label className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                                                                    📎 <span>{c.potpisanScan ? (lang === 'bs' ? 'Zamijeni scan ✅' : 'Replace scan ✅') : (lang === 'bs' ? 'Upload potpisan scan' : 'Upload signed scan')}</span>
                                                                    <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={(e) => {
                                                                        const file = e.target.files?.[0]; if (!file) return;
                                                                        if (file.size > 5000000) { alert(lang === 'bs' ? 'Max 5MB' : 'Max 5MB'); return; }
                                                                        const reader = new FileReader();
                                                                        reader.onload = (ev) => { update(COLLECTIONS.CERTIFICATES, c.id, { potpisanScan: ev.target.result, potpisanScanName: file.name, potpisanScanDate: new Date().toISOString() }); setCertificates(getWorkerCertificates(editingWorker)); setCertMenuId(null); };
                                                                        reader.readAsDataURL(file); e.target.value = '';
                                                                    }} />
                                                                </label>
                                                                {c.potpisanScan && (
                                                                    <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                                        onClick={() => {
                                                                            setCertMenuId(null);
                                                                            const w = window.open('', '_blank');
                                                                            if (c.potpisanScan.startsWith('data:application/pdf')) { w.document.write(`<embed src="${c.potpisanScan}" width="100%" height="100%" type="application/pdf" />`); }
                                                                            else { w.document.write(`<img src="${c.potpisanScan}" style="max-width:100%; margin:20px auto; display:block;" />`); }
                                                                            w.document.close();
                                                                        }}>
                                                                        👁️ <span>{lang === 'bs' ? 'Prikaži potpisan dokument' : 'View signed document'}</span>
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
                                                        <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}
                                                            onClick={async () => { setCertMenuId(null); const ok = await confirm(lang === 'bs' ? 'Obrisati uvjerenje? Ova radnja je trajna.' : 'Delete certificate? This is permanent.'); if (ok) { remove(COLLECTIONS.CERTIFICATES, c.id); setCertificates(getWorkerCertificates(editingWorker)); } }}>
                                                            🗑️ <span>{lang === 'bs' ? 'Obriši uvjerenje' : 'Delete certificate'}</span>
                                                        </button>
                                                    </div>,
                                                    document.body
                                                )}
                                            </td>
                                            <td>{c.oznaka}</td>
                                            <td>{formatDate(c.datum)}</td>
                                            <td style={{ color: isExpired ? 'var(--danger)' : !c.vrijediDo ? 'var(--success)' : undefined, fontWeight: (isExpired || !c.vrijediDo) ? 700 : undefined }}>
                                                {c.vrijediDo ? (
                                                    <>{formatDate(c.vrijediDo)} {isExpired && '⚠️'}</>
                                                ) : (
                                                    <span title="Vrijedi dok se ne promijeni radno mjesto">Bez isteka ∞</span>
                                                )}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{c.ime}</td>
                                            <td><span className="badge badge-info">{c.tipUvjerenja}</span></td>
                                            <td>{c.upisao}</td>
                                            <td><span className={`badge ${c.sposobnost === 'Sposoban' ? 'badge-success' : c.sposobnost === 'Nevažeće' ? 'badge-warning' : 'badge-danger'}`}>{c.sposobnost}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Accordion>
                </div>

                {/* ── ACCORDION: OZO radnika ── */}
                <div ref={ozoRef}>
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
                                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={async () => { const ok = await confirm(lang === 'bs' ? 'Obrisati zaduženje?' : 'Delete assignment?'); if (ok) { remove(COLLECTIONS.PPE_ASSIGNMENTS, p.id); setPpeAssign(getWorkerPPE(editingWorker)); } }}>🗑️</button>
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
                </div>

                {/* ── ACCORDION: Mjesto rada ── */}
                <Accordion title={t('workLocation')} open={openSections.mjestoRada} onToggle={() => toggleSection('mjestoRada')}>
                    <div className="form-group">
                        <textarea className="form-textarea" placeholder={lang === 'bs' ? 'Opis mjesta rada...' : 'Work location description...'} rows={3} />
                    </div>
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
                                            {certTypes.filter((ct, i, a) => a.findIndex(x => x.naziv === ct.naziv) === i).map(ct => <option key={ct.id} value={ct.oznaka}>{ct.naziv}</option>)}
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
                                    <select className="form-select" value={ppeFormData.naziv} onChange={async (e) => {
                                        const val = e.target.value;
                                        if (val === 'NEW_OZO') {
                                            const newName = await prompt(lang === 'bs' ? 'Unesite naziv nove OZO:' : 'Enter name of new PPE:');
                                            if (newName && newName.trim()) {
                                                const finalName = newName.trim();
                                                create(COLLECTIONS.PPE_TYPES, { naziv: finalName });
                                                setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));
                                                setPpeFormData({ ...ppeFormData, naziv: finalName });
                                            } else {
                                                setPpeFormData({ ...ppeFormData, naziv: '' });
                                            }
                                        } else {
                                            setPpeFormData({ ...ppeFormData, naziv: val });
                                        }
                                    }}>
                                        <option value="">-- {lang === 'bs' ? 'Odaberite OZO' : 'Select PPE'} --</option>
                                        <option value="NEW_OZO" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ {lang === 'bs' ? 'Dodaj novu OZO...' : 'Add new PPE...'}</option>
                                        {ppeTypes.filter((pt, i, a) => a.findIndex(x => x.naziv === pt.naziv) === i).map(pt => <option key={pt.id} value={pt.naziv}>{pt.naziv}</option>)}
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
                <DialogRenderer />

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
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {selectedIds.size > 0 && (
                                    <span style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'}
                                    </span>
                                )}
                                <div style={{ position: 'relative' }}>
                                <button className="btn btn-dark btn-sm" onClick={() => {
                                    const el = document.getElementById('group-action-menu');
                                    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
                                }}>{t('selectGroupAction')} ▼</button>
                                <div id="group-action-menu" className="dropdown-menu" style={{ display: 'none', right: 0, top: 'calc(100% + 4px)', minWidth: 220 }}>
                                    <div style={{ padding: '6px 14px 4px', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {selectedIds.size > 0 ? `${selectedIds.size} ${lang === 'bs' ? 'radnika odabrano' : 'workers selected'}` : (lang === 'bs' ? 'Odaberite radnike' : 'Select workers first')}
                                    </div>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item" disabled={selectedIds.size === 0} onClick={async () => {
                                        document.getElementById('group-action-menu').style.display = 'none';
                                        if (selectedIds.size === 0) { await alert(lang === 'bs' ? 'Odaberite radnike kvačicom.' : 'Select workers using checkboxes.'); return; }
                                        await alert(lang === 'bs' ? `Generisanje dokumenata za ${selectedIds.size} radnika (uskoro)` : `Generate documents for ${selectedIds.size} workers (coming soon)`);
                                    }} style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}>📄 {lang === 'bs' ? 'Generiši dokumente' : 'Generate documents'}</button>
                                    <button className="dropdown-item" disabled={selectedIds.size === 0} onClick={async () => {
                                        document.getElementById('group-action-menu').style.display = 'none';
                                        if (selectedIds.size === 0) { await alert(lang === 'bs' ? 'Odaberite radnike kvačicom.' : 'Select workers using checkboxes.'); return; }
                                        await alert(lang === 'bs' ? `Slanje obavijesti za ${selectedIds.size} radnika (uskoro)` : `Send notifications to ${selectedIds.size} workers (coming soon)`);
                                    }} style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}>✉️ {lang === 'bs' ? 'Pošalji obavijesti' : 'Send notifications'}</button>
                                    <div className="dropdown-divider" />
                                    <button className="dropdown-item" disabled={selectedIds.size === 0} style={{ color: selectedIds.size > 0 ? 'var(--danger)' : 'var(--text-muted)', opacity: selectedIds.size === 0 ? 0.5 : 1 }} onClick={async () => {
                                        document.getElementById('group-action-menu').style.display = 'none';
                                        if (selectedIds.size === 0) return;
                                        const ok = await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} radnika? Ova radnja je nepovratna!` : `Delete ${selectedIds.size} workers? This cannot be undone!`);
                                        if (ok) {
                                            removeManyWorkersCascade([...selectedIds]);
                                            setSelectedIds(new Set());
                                            loadData();
                                        }
                                    }}>🗑️ {lang === 'bs' ? `Obriši odabrane (${selectedIds.size})` : `Delete selected (${selectedIds.size})`}</button>
                                </div>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 100 }}>{t('actions')}</th>
                                        <th style={tsW('ime')} onClick={() => tW('ime')}>{t('workerName')}{siW('ime')}</th>
                                        <th style={tsW('prezime')} onClick={() => tW('prezime')}>{t('workerSurname')}{siW('prezime')}</th>
                                        <th>{t('oib')}</th>
                                        <th style={tsW('orgJedinicaId')} onClick={() => tW('orgJedinicaId')}>{t('orgUnit')}{siW('orgJedinicaId')}</th>
                                        <th style={tsW('radnoMjestoId')} onClick={() => tW('radnoMjestoId')}>{t('workplace')}{siW('radnoMjestoId')}</th>
                                        <th style={{ width: 40, textAlign: 'center' }} title={allPageSelected ? (lang === 'bs' ? 'Odznači sve' : 'Deselect all') : (lang === 'bs' ? 'Odaberi sve na stranici' : 'Select all on page')}>
                                            <input
                                                type="checkbox"
                                                checked={allPageSelected}
                                                ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                                                onChange={toggleSelectAll}
                                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                                            />
                                        </th>
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
                                                            <button className="dropdown-item" onClick={() => { setActionMenuId(null); }}>⬇️ {t('downloadFiles')}</button>
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
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(w.id)}
                                                        onChange={() => toggleOne(w.id)}
                                                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                                                    />
                                                </td>
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
                                <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); setSelectedIds(new Set()); }}
                                    style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                                    <option value={10}>10 {t('perPage')}</option>
                                    <option value={25}>25 {t('perPage')}</option>
                                    <option value={50}>50 {t('perPage')}</option>
                                    <option value={100}>100 {t('perPage')}</option>
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


// -- InfoTip: instant hover tooltip icon -------------------------------------
function InfoTip({ text }) {
    const [show, setShow] = useState(false);
    return (
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <span
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                style={{ cursor: 'help', fontSize: '0.7rem', width: 15, height: 15, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}
            >i</span>
            {show && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: '0.78rem', color: 'var(--text-light)', zIndex: 9999, whiteSpace: 'normal', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', pointerEvents: 'none', minWidth: 200, maxWidth: 300, lineHeight: 1.5, fontWeight: 400 }}>
                    {text}
                </div>
            )}
        </span>
    );
}
// -- StazPicker: 3-dropdown prior experience picker --------------------------
function StazPicker({ label, value, onChange }) {
    const { lang } = useLanguage();
    const parse = (v) => {
        if (!v) return { g: '', m: '', d: '' };
        const m1 = v.match(/(\d+)g(\d+)mj(\d+)d/i);
        if (m1) return { g: String(+m1[1]), m: String(+m1[2]), d: String(+m1[3]) };
        const m2 = v.match(/^(\d{2})(\d{2})(\d{2})$/);
        if (m2) return { g: String(+m2[1]), m: String(+m2[2]), d: String(+m2[3]) };
        return { g: '', m: '', d: '' };
    };
    const parts = parse(value);
    const update = (field, val) => {
        const next = { ...parts, [field]: val };
        const g = next.g || '0', m = next.m || '0', d = next.d || '0';
        const formatted = `${g}g${m}mj${d}d`;
        onChange(formatted === '0g0mj0d' ? '' : formatted);
    };
    const g_opts = Array.from({ length: 61 }, (_, i) => i);
    const m_opts = Array.from({ length: 12 }, (_, i) => i);
    const d_opts = Array.from({ length: 31 }, (_, i) => i);
    return (
        <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <InfoTip text={lang === 'bs' ? "Staž prije dolaska u firmu: Godina / Mjeseci / Dana" : "Prior experience: Years / Months / Days"} />
                {value && <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>{value.toUpperCase()}</span>}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, textAlign: 'center' }}>Godina</div>
                    <select className="form-select" style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.82rem' }} value={parts.g} onChange={e => update('g', e.target.value)}>
                        {g_opts.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, textAlign: 'center' }}>Mjeseci</div>
                    <select className="form-select" style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.82rem' }} value={parts.m} onChange={e => update('m', e.target.value)}>
                        {m_opts.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, textAlign: 'center' }}>Dana</div>
                    <select className="form-select" style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.82rem' }} value={parts.d} onChange={e => update('d', e.target.value)}>
                        {d_opts.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
            </div>
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

export default function WorkersPage() {
    return (
        <Suspense fallback={null}>
            <WorkersPageInner />
        </Suspense>
    );
}
