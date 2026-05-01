'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    getAll, getById, create, update, remove, COLLECTIONS,
} from '@/lib/dataStore';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useDialog } from '@/hooks/useDialog';
import { printZosPdf } from '@/lib/zosPdfGenerator';
import { uploadSecureFile } from '@/lib/storageService';
import HelpTip from '@/components/HelpTip';
import Icon3D from '@/components/Icon3D';
import PageHeader from '@/components/PageHeader';

const EMPTY_CERT = {
    workerId: '',
    oznaka: '',
    tipUvjerenjaId: '',
    tipUvjerenjaIme: '',
    sposoban: true,
    datum: '',
    vrijediDo: '',
    ispitivacId: '',
    strucnjakZNR: '',
    upisao: '',
    cijena: '',
    vydanoZaRadnoMjesto: '',
    ogranicenja: '',
    // file attachment fields
    fileOpis: '',
    vrstaDateotekeId: '',
};

// Predefined types matching the reference app
const DEFAULT_CERT_TYPES = [
    'Koordinatora ZNR tijekom građenja',
    'Koordinatora ZNR tijekom izrade projekta',
    'Povremena provjera znanja radnika iz zaštite na radu',
    'Stručnjak ZNR - opći dio',
    'Stručnjak ZNR - opći i posebni dio',
    'Stručnjak ZNR - posebni dio',
    'Usavršavanje stručnjaka ZNR',
    'Uvjerenje o osposobljenosti za pružanje prve pomoći',
    'Uvjerenje o zdravstvenoj sposobnosti radnika',
    'Zapisnik o ocjeni osposobljenosti radnika za rad na siguran način',
    'PP - Osposobljenost za gašenje požara',
    'Licenca / Certifikat',
];

const FILE_TYPE_OPTIONS = [
    'Sken', 'Original', 'Kopija', 'Email potvrda', 'Digitalni dokument',
];

export function UvjerenjeFormPage() {
    const { t, lang } = useLanguage();
    const { activeCompanyId } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [workers, setWorkers] = useState([]);
    const [examiners, setExaminers] = useState([]);
    const [certTypes, setCertTypes] = useState([]);
    const [authorizedCompanies, setAuthorizedCompanies] = useState([]);
    const [workplaces, setWorkplaces] = useState([]);

    const [selectedWorkerIds, setSelectedWorkerIds] = useState(new Set());
    const [workerSearch, setWorkerSearch] = useState('');
    const [showOnlySelected, setShowOnlySelected] = useState(false);
    const [orgUnitFilter, setOrgUnitFilter] = useState('');
    const [orgUnits, setOrgUnits] = useState([]);

    const [formData, setFormData] = useState({ ...EMPTY_CERT });
    const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
    const [tipSearch, setTipSearch] = useState('');
    const [showTipDropdown, setShowTipDropdown] = useState(false);
    const [ispitivacSearch, setIspitivacSearch] = useState('');
    const [showIspitivacDropdown, setShowIspitivacDropdown] = useState(false);
    const [showNewTypeForm, setShowNewTypeForm] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [editingId, setEditingId] = useState(null); // null = new cert

    const workerRef = useRef(null);
    const tipRef = useRef(null);
    const ispitivacRef = useRef(null);
    const appliedZiaRef = useRef(false); // prevent double-apply
    const isSavingRef = useRef(false); // prevent duplicate submissions

    const { markDirty, markClean } = useUnsavedChanges();
    const { alert, confirm, DialogRenderer } = useDialog();

    // Inline new examiner form state
    const [showNewExaminerForm, setShowNewExaminerForm] = useState(false);
    const [newExaminerData, setNewExaminerData] = useState({ ime: '', zvanje: '', telefon: '', ovlaštenaTvrtkaId: '' });

    const set = (k, v) => { setFormData(f => ({ ...f, [k]: v })); markDirty(); };

    const load = useCallback(() => {
        setWorkers(getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false));
        setExaminers(getAll(COLLECTIONS.EXAMINERS));
        setAuthorizedCompanies(getAll(COLLECTIONS.AUTHORIZED_COMPANIES));
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
        // Load cert types - combine defaults with custom
        const stored = getAll(COLLECTIONS.CERT_TYPES);
        const storedNames = stored.map(x => x.naziv);
        const rawMerged = [
            ...stored,
            ...DEFAULT_CERT_TYPES
                .filter(n => !storedNames.includes(n))
                .map(n => ({ id: `default_${n}`, naziv: n })),
        ];
        // Deduplicate by naziv (handles repeated seed runs)
        const seenNames = new Set();
        const merged = rawMerged.filter(ct => {
            const key = (ct.naziv || '').toLowerCase().trim();
            if (seenNames.has(key)) return false;
            seenNames.add(key);
            return true;
        });
        setCertTypes(merged);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Handle ?workerId (pre-select worker) and ?copyFrom (pre-fill from cert)
    useEffect(() => {
        const workerIdParam = searchParams?.get('workerId');
        const copyFromId = searchParams?.get('copyFrom');
        if (workerIdParam) {
            setSelectedWorkerIds(new Set([workerIdParam]));
        }
        if (copyFromId) {
            const src = getById(COLLECTIONS.CERTIFICATES, copyFromId);
            if (src) {
                // Pre-select the source worker (table still visible for multi-assignment)
                if (src.workerId) setSelectedWorkerIds(new Set([src.workerId]));
                setFormData({
                    ...EMPTY_CERT,
                    tipUvjerenjaId: src.tipUvjerenjaId || '',
                    tipUvjerenjaIme: src.tipUvjerenjaIme || src.ime || '',
                    oznaka: src.oznaka || '',
                    datum: new Date().toISOString().split('T')[0],
                    sposoban: src.sposoban ?? (src.sposobnost !== 'Nesposoban'),
                    vrijediDo: src.vrijediDo || '',
                    ispitivacId: src.ispitivacId || '',
                    strucnjakZNR: src.strucnjakZNR || '',
                    upisao: src.upisao || '',
                    cijena: src.cijena || '',
                    vydanoZaRadnoMjesto: src.vydanoZaRadnoMjesto || src.izdanoZaRadnoMjesto || '',
                    ogranicenja: src.ogranicenja || '',
                    // Do NOT copy potpisanScan - new copy needs fresh signature
                });
                if (src.tipUvjerenjaIme || src.ime) setTipSearch(src.tipUvjerenjaIme || src.ime || '');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Handle Zia pre-fill params: ?tipUvjerenja, ?datum, ?vrijediDo
    // Must wait for certTypes to load so we can fuzzy-match the type name
    useEffect(() => {
        if (appliedZiaRef.current || !certTypes.length) return;
        const tipParam = searchParams?.get('tipUvjerenja');
        const datumParam = searchParams?.get('datum');
        const vrijediDoParam = searchParams?.get('vrijediDo');
        if (!tipParam && !datumParam && !vrijediDoParam) return;
        appliedZiaRef.current = true;
        if (tipParam) {
            // Try fuzzy match against existing cert types
            const match = certTypes.find(ct =>
                ct.naziv.toLowerCase().includes(tipParam.toLowerCase()) ||
                tipParam.toLowerCase().includes(ct.naziv.toLowerCase().split(' ').slice(0, 3).join(' '))
            );
            if (match) {
                setFormData(f => ({ ...f, tipUvjerenjaId: match.id, tipUvjerenjaIme: match.naziv }));
                setTipSearch(match.naziv);
            } else {
                setFormData(f => ({ ...f, tipUvjerenjaIme: tipParam }));
                setTipSearch(tipParam);
            }
        }
        if (datumParam) setFormData(f => ({ ...f, datum: datumParam }));
        if (vrijediDoParam) setFormData(f => ({ ...f, vrijediDo: vrijediDoParam }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [certTypes, searchParams]);

    // ── Restore scanned file pre-filled from Digitalna Arhiva → Skenirani testovi ──
    useEffect(() => {
        const fromScan = searchParams?.get('fromScan');
        if (!fromScan) return;
        try {
            const raw = sessionStorage.getItem('eznr_scan_prefill');
            if (!raw) return;
            const { data, name, size, type } = JSON.parse(raw);
            setFormData(f => ({
                ...f,
                attachedFileData: data,
                attachedFileName: name,
                attachedFileSize: size,
                attachedFileType: type,
                vrstaDateotekeId: 'Sken',
            }));
            sessionStorage.removeItem('eznr_scan_prefill');
        } catch { sessionStorage.removeItem('eznr_scan_prefill'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const preselectedWorkerId = searchParams?.get('workerId');
    const [isSingleWorkerMode, setIsSingleWorkerMode] = useState(!!preselectedWorkerId);

    // Close dropdowns on outside click
    useEffect(() => {
        const h = (e) => {
            if (workerRef.current && !workerRef.current.contains(e.target)) setShowWorkerDropdown(false);
            if (tipRef.current && !tipRef.current.contains(e.target)) setShowTipDropdown(false);
            if (ispitivacRef.current && !ispitivacRef.current.contains(e.target)) setShowIspitivacDropdown(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const filteredWorkers = workers.filter(w => {
        if (orgUnitFilter && w.orgJedinicaId !== orgUnitFilter) return false;
        if (showOnlySelected && !selectedWorkerIds.has(w.id)) return false;
        if (!workerSearch) return true;
        const q = workerSearch.toLowerCase();
        return `${w.ime} ${w.prezime} ${w.oib || ''} ${w.jmbg || ''}`.toLowerCase().includes(q);
    });

    const toggleWorker = (id) => {
        setSelectedWorkerIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedWorkerIds.size === filteredWorkers.length) {
            setSelectedWorkerIds(new Set());
        } else {
            setSelectedWorkerIds(new Set(filteredWorkers.map(w => w.id)));
        }
    };

    const deselectAll = () => setSelectedWorkerIds(new Set());

    const getExaminerLabel = (ex) => {
        const company = authorizedCompanies.find(c => c.id === ex.ovlaštenaTvrtkaId);
        return `${ex.ime}${company ? ` (${company.naziv})` : ''}`;
    };

    const filteredTips = certTypes
        .filter(ct => !tipSearch || ct.naziv.toLowerCase().includes(tipSearch.toLowerCase()))
        .filter((ct, i, a) => a.findIndex(x => (x.naziv || '').toLowerCase() === (ct.naziv || '').toLowerCase()) === i);
    const filteredIspitivac = examiners.filter(ex =>
        !ispitivacSearch || getExaminerLabel(ex).toLowerCase().includes(ispitivacSearch.toLowerCase())
    );

    const handleAddNewType = () => {
        if (!newTypeName.trim()) return;
        const existing = certTypes.find(ct => ct.naziv.toLowerCase() === newTypeName.trim().toLowerCase());
        if (!existing) {
            const created = create(COLLECTIONS.CERT_TYPES, { naziv: newTypeName.trim() });
            setCertTypes(prev => [...prev, created]);
            setFormData(f => ({ ...f, tipUvjerenjaId: created.id, tipUvjerenjaIme: created.naziv }));
        } else {
            setFormData(f => ({ ...f, tipUvjerenjaId: existing.id, tipUvjerenjaIme: existing.naziv }));
        }
        setTipSearch(newTypeName.trim());
        setShowNewTypeForm(false);
        setNewTypeName('');
        setShowTipDropdown(false);
    };

    const handleSave = async () => {
        // Guard against double-submission
        if (isSavingRef.current) return;

        if (!isSingleWorkerMode && selectedWorkerIds.size === 0) {
            await alert(lang === 'bs' ? 'Molimo odaberite barem jednog radnika!' : 'Please select at least one worker!');
            return;
        }
        if (!formData.tipUvjerenjaIme && !formData.tipUvjerenjaId) {
            await alert(lang === 'bs' ? 'Tip uvjerenja je obavezan!' : 'Certificate type is required!');
            return;
        }

        isSavingRef.current = true;
        try {
            // Save a certificate for each selected worker
            for (const wId of selectedWorkerIds) {
                const certData = {
                    ...formData,
                    workerId: wId,
                    ime: formData.tipUvjerenjaIme,
                    oznaka: formData.oznaka,
                    sposobnost: formData.sposoban ? 'Sposoban' : 'Nesposoban',
                };
                if (editingId && selectedWorkerIds.size === 1) {
                    update(COLLECTIONS.CERTIFICATES, editingId, certData);
                } else {
                    create(COLLECTIONS.CERTIFICATES, certData);
                }
            }
            markClean();
            const returnTo = searchParams?.get('returnTo');
            if (returnTo) {
                router.push(decodeURIComponent(returnTo));
            } else {
                router.push('/dashboard/worker-certificates');
            }
        } finally {
            isSavingRef.current = false;
        }
    };

    const handleSaveNewExaminer = () => {
        if (!newExaminerData.ime.trim()) return;
        const created = create(COLLECTIONS.EXAMINERS, newExaminerData);
        setExaminers(prev => [...prev, created]);
        set('ispitivacId', created.id);
        setShowNewExaminerForm(false);
        setNewExaminerData({ ime: '', zvanje: '', telefon: '', ovlaštenaTvrtkaId: '' });
    };

    const getWorkerName = (id) => {
        const w = workers.find(x => x.id === id);
        return w ? `${w.ime} ${w.prezime}` : '';
    };

    const getWorkplaceName = (id) => {
        const wp = workplaces.find(w => w.id === id);
        return wp ? wp.naziv : '—';
    };
    const getOrgUnitName = (id) => {
        const ou = orgUnits.find(o => o.id === id);
        return ou ? ou.naziv : '—';
    };

    const labelStyle = {
        display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
        color: 'white', background: '#455a64', padding: '2px 8px',
        borderRadius: 3, marginBottom: 4,
    };

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', alignItems: 'center', gap: 30, marginBottom: 24 }}>
                <button className="btn btn-ghost" onClick={() => router.back()}>←</button>
                <Icon3D name="Uvjerenja.png" size={50} />
                <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Uvjerenje radnicima' : 'Worker Certificates'}</h1>
            </div>
            <DialogRenderer />

            {/* Copy notice */}
            {searchParams?.get('copyFrom') && (
                <div style={{
                    padding: '12px 16px', marginBottom: 16, borderRadius: 'var(--radius-md)',
                    background: 'rgba(33, 150, 243, 0.08)', border: '1px solid rgba(33, 150, 243, 0.3)',
                    display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem',
                }}>
                    <span style={{ fontSize: '1.2rem' }}>📋</span>
                    <div>
                        <strong>{lang === 'bs' ? 'Kopiranje uvjerenja' : 'Copying certificate'}</strong>
                        {formData.tipUvjerenjaIme && <span> — {formData.tipUvjerenjaIme}</span>}
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {lang === 'bs'
                                ? 'Odaberite jednog ili više radnika kojima želite dodijeliti ovo uvjerenje.'
                                : 'Select one or more workers to assign this certificate to.'}
                        </div>
                    </div>
                </div>
            )}

            {/* Single worker locked mode info */}
            {preselectedWorkerId && (
                <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                    <div style={{ flex: '1 1 200px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}>{lang === 'bs' ? 'Odabran alat za jednog radnika' : 'Single worker mode active'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Novo uvjerenje će biti izdato samo radniku:' : 'Certificate will only be issued to:'} <b>{getWorkerName(preselectedWorkerId) || ''}</b></div>
                    </div>
                    <button 
                        onClick={() => setIsSingleWorkerMode(!isSingleWorkerMode)}
                        className="btn btn-outline btn-sm"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    >
                        {isSingleWorkerMode 
                            ? (lang === 'bs' ? '▼ Prikaži listu radnika' : '▼ Show workers list') 
                            : (lang === 'bs' ? '▲ Sakrij listu radnika' : '▲ Hide workers list')
                        }
                    </button>
                </div>
            )}

             {/* ── Certificate details form ── */}
            <div className="card">
                <div className="card-body">
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>
                        {lang === 'bs' ? 'Podaci o uvjerenju' : 'Certificate details'}
                    </div>

                    {/* Row 0: Radnik Dropdown */}
                    <div style={{ marginBottom: 16, position: 'relative' }} ref={workerRef}>
                        <div style={labelStyle}>{lang === 'bs' ? 'Djelatnik (Radnik)' : 'Worker'} *</div>
                        <div
                            style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', padding: '0 8px', minHeight: 38, cursor: 'pointer' }}
                            onClick={() => setShowWorkerDropdown(v => !v)}
                        >
                            <span style={{ flex: 1, fontSize: '0.88rem', color: selectedWorkerIds.size ? 'var(--text)' : 'var(--text-muted)' }}>
                                {selectedWorkerIds.size > 0 
                                    ? getWorkerName(Array.from(selectedWorkerIds)[0])
                                    : (lang === 'bs' ? 'Odaberite radnika...' : 'Select worker...')}
                            </span>
                            {selectedWorkerIds.size > 0 && (
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0 2px' }}
                                    onClick={e => { e.stopPropagation(); setSelectedWorkerIds(new Set()); setWorkerSearch(''); }}>×</button>
                            )}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>▾</span>
                        </div>
                        {showWorkerDropdown && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, maxHeight: 260, overflowY: 'auto' }}>
                                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                                    <input
                                        className="form-input" style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                        placeholder="🔍 Pretraži radnike..." value={workerSearch} onChange={e => setWorkerSearch(e.target.value)} autoFocus onClick={e => e.stopPropagation()}
                                    />
                                </div>
                                {filteredWorkers.map(w => (
                                    <div key={w.id} onClick={() => { setSelectedWorkerIds(new Set([w.id])); setShowWorkerDropdown(false); setWorkerSearch(''); }} style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.86rem', display: 'flex', flexDirection: 'column' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <div style={{ fontWeight: 600 }}>{w.ime} {w.prezime}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{getWorkplaceName(w.radnoMjestoId)} • {getOrgUnitName(w.orgJedinicaId)}</div>
                                    </div>
                                ))}
                                {filteredWorkers.length === 0 && <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{lang === 'bs' ? 'Nema rezultata' : 'No results'}</div>}
                            </div>
                        )}
                    </div>

                    {/* Row 1: Oznaka | Tip uvjerenja | Sposoban */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, marginBottom: 16, alignItems: 'start' }}>
                        {/* Oznaka */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>Oznaka</div>
                            <input
                                className="form-input"
                                value={formData.oznaka}
                                onChange={e => set('oznaka', e.target.value)}
                                placeholder={lang === 'bs' ? 'Šifra / referentni broj' : 'Code / reference number'}
                            />
                        </div>

                        {/* Tip uvjerenja - searchable dropdown */}
                        <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={tipRef}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <div style={{...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 4}}>{lang === 'bs' ? 'Tip uvjerenja' : 'Certificate type'} * <HelpTip text="Ukoliko radnik polaže i teoretski i praktični dio, oba moraju biti unesena unutar istog tipa uvjerenja ili odvojeno." /></div>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ width: 22, height: 22, borderRadius: '50%', padding: 0, fontSize: '1.2rem', paddingBottom: 2, lineHeight: 0, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
                                    onClick={() => setShowNewTypeForm(true)}
                                    title={lang === 'bs' ? 'Dodaj novi tip' : 'Add new type'}
                                >+</button>
                            </div>
                            <div
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-input)', padding: '0 8px', minHeight: 38,
                                    cursor: 'pointer',
                                }}
                                onClick={() => setShowTipDropdown(v => !v)}
                            >
                                <span style={{ flex: 1, fontSize: '0.88rem', color: formData.tipUvjerenjaIme ? 'var(--text)' : 'var(--text-muted)' }}>
                                    {formData.tipUvjerenjaIme || (lang === 'bs' ? 'Odaberite tip...' : 'Select type...')}
                                </span>
                                {formData.tipUvjerenjaIme && (
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0 2px' }}
                                        onClick={e => { e.stopPropagation(); set('tipUvjerenjaIme', ''); set('tipUvjerenjaId', ''); setTipSearch(''); }}>×</button>
                                )}
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>▾</span>
                            </div>
                            {showTipDropdown && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, maxHeight: 260, overflowY: 'auto' }}>
                                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                                        <input
                                            className="form-input"
                                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                            placeholder="🔍 Pretraži..."
                                            value={tipSearch}
                                            onChange={e => setTipSearch(e.target.value)}
                                            autoFocus
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </div>
                                    {filteredTips.map(ct => (
                                        <div
                                            key={ct.id}
                                            onClick={() => { set('tipUvjerenjaId', ct.id); set('tipUvjerenjaIme', ct.naziv); setShowTipDropdown(false); setTipSearch(''); }}
                                            style={{
                                                padding: '9px 12px', cursor: 'pointer', fontSize: '0.86rem',
                                                background: formData.tipUvjerenjaId === ct.id ? 'var(--primary)' : undefined,
                                                color: formData.tipUvjerenjaId === ct.id ? 'white' : undefined,
                                            }}
                                            onMouseEnter={e => { if (formData.tipUvjerenjaId !== ct.id) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                            onMouseLeave={e => { if (formData.tipUvjerenjaId !== ct.id) e.currentTarget.style.background = ''; }}
                                        >
                                            {ct.naziv}
                                        </div>
                                    ))}
                                    {filteredTips.length === 0 && (
                                        <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {lang === 'bs' ? 'Nema rezultata' : 'No results'}
                                        </div>
                                    )}
                                    <div
                                        onClick={() => { setShowTipDropdown(false); setShowNewTypeForm(true); setTipSearch(''); }}
                                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.86rem', borderTop: '1px solid var(--border-light)', fontWeight: 600, color: 'var(--primary)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = ''}
                                    >
                                        + {lang === 'bs' ? 'Ostalo...' : 'Other...'}
                                    </div>
                                </div>
                            )}
                            {/* New type quick-add */}
                            {showNewTypeForm && (
                                <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-input)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input
                                        className="form-input"
                                        style={{ flex: 1, fontSize: '0.85rem' }}
                                        placeholder={lang === 'bs' ? 'Naziv novog tipa...' : 'New type name...'}
                                        value={newTypeName}
                                        onChange={e => setNewTypeName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddNewType(); if (e.key === 'Escape') { setShowNewTypeForm(false); setNewTypeName(''); } }}
                                        autoFocus
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={handleAddNewType}>{lang === 'bs' ? 'Dodaj' : 'Add'}</button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowNewTypeForm(false); setNewTypeName(''); }}>✕</button>
                                </div>
                            )}
                        </div>

                        {/* Sposoban/Nesposoban */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{lang === 'bs' ? 'Sposoban/Nesposoban' : 'Capable/Incapable'}</div>
                            <div style={{ paddingTop: 6 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.sposoban}
                                        onChange={e => set('sposoban', e.target.checked)}
                                        style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                                    />
                                    {formData.sposoban
                                        ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ {lang === 'bs' ? 'Sposoban' : 'Capable'}</span>
                                        : <span style={{ color: 'var(--danger)', fontWeight: 600 }}>✗ {lang === 'bs' ? 'Nesposoban' : 'Incapable'}</span>
                                    }
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Datum | Vrijedi do */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={{...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 4}}>{lang === 'bs' ? 'Datum' : 'Date'} <HelpTip text="Datum donošenja zapisnika/ljekarskog nalaza" /></div>
                            <DateInput value={formData.datum} onChange={v => set('datum', v)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={{...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 4}}>{lang === 'bs' ? 'Vrijedi do' : 'Valid until'} <HelpTip text="Zakon o zaštiti na radu nalaže obnovu certifikata/pregleda svake 2 ili 3 godine, ovisno o radnom mjestu." /></div>
                            <DateInput value={formData.vrijediDo} onChange={v => set('vrijediDo', v)} />
                        </div>
                    </div>

                    {/* Row 3: Ispitivac | Stručnjak ZNR */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        {/* Ispitivac searchable dropdown */}
                        <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={ispitivacRef}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <div style={labelStyle}>{lang === 'bs' ? 'Ispitivač' : 'Examiner'}</div>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ width: 22, height: 22, borderRadius: '50%', padding: 0, fontSize: '1.2rem', paddingBottom: 2, lineHeight: 0, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
                                    onClick={e => { e.preventDefault(); setShowNewExaminerForm(true); setShowIspitivacDropdown(false); }}
                                    title={lang === 'bs' ? 'Dodaj novog ispitivača' : 'Add new examiner'}
                                >+</button>
                            </div>
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', padding: '0 8px', minHeight: 38, cursor: 'pointer' }}
                                onClick={() => setShowIspitivacDropdown(v => !v)}
                            >
                                <span style={{ flex: 1, fontSize: '0.88rem', color: formData.ispitivacId ? 'var(--text)' : 'var(--text-muted)' }}>
                                    {formData.ispitivacId
                                        ? getExaminerLabel(examiners.find(e => e.id === formData.ispitivacId) || {})
                                        : (lang === 'bs' ? 'Odaberite ispitivača' : 'Select examiner')}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>▾</span>
                            </div>
                            {showIspitivacDropdown && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, maxHeight: 220, overflowY: 'auto' }}>
                                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                                        <input
                                            className="form-input"
                                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                                            placeholder="🔍 Pretraži..."
                                            value={ispitivacSearch}
                                            onChange={e => setIspitivacSearch(e.target.value)}
                                            autoFocus
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </div>
                                    {filteredIspitivac.length === 0 ? (
                                        <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {lang === 'bs' ? 'Nema ispitivača. Dodajte ih u Ispitivači.' : 'No examiners. Add them in Examiners.'}
                                        </div>
                                    ) : filteredIspitivac.map(ex => (
                                        <div
                                            key={ex.id}
                                            onClick={() => { set('ispitivacId', ex.id); setShowIspitivacDropdown(false); setIspitivacSearch(''); }}
                                            style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.86rem' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = ''}
                                        >
                                            {getExaminerLabel(ex)}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Inline new examiner quick-add */}
                            {showNewExaminerForm && (
                                <div style={{ marginTop: 8, padding: 14, background: 'var(--bg-input)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)', marginBottom: 10 }}>
                                        + {lang === 'bs' ? 'Novi ispitivač' : 'New examiner'}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>{lang === 'bs' ? 'Ime *' : 'Name *'}</div>
                                            <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                                value={newExaminerData.ime} onChange={e => setNewExaminerData(d => ({ ...d, ime: e.target.value }))} autoFocus
                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveNewExaminer(); if (e.key === 'Escape') setShowNewExaminerForm(false); }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>{lang === 'bs' ? 'Zvanje' : 'Title'}</div>
                                            <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                                value={newExaminerData.zvanje} onChange={e => setNewExaminerData(d => ({ ...d, zvanje: e.target.value }))} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>{lang === 'bs' ? 'Telefon' : 'Phone'}</div>
                                            <input className="form-input" style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                                value={newExaminerData.telefon} onChange={e => setNewExaminerData(d => ({ ...d, telefon: e.target.value }))} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3 }}>{lang === 'bs' ? 'Ovlaštena tvrtka' : 'Auth. company'}</div>
                                            <select className="form-select" style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                                value={newExaminerData.ovlaštenaTvrtkaId} onChange={e => setNewExaminerData(d => ({ ...d, ovlaštenaTvrtkaId: e.target.value }))}>
                                                <option value="">-</option>
                                                {authorizedCompanies.map(c => <option key={c.id} value={c.id}>{c.naziv}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setShowNewExaminerForm(false)}>{t('cancel')}</button>
                                        <button className="btn btn-primary btn-sm" onClick={handleSaveNewExaminer}>+ {lang === 'bs' ? 'Dodaj ispitivača' : 'Add examiner'}</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{lang === 'bs' ? 'Stručnjak ZNR' : 'ZNR Specialist'}</div>
                            <input className="form-input" value={formData.strucnjakZNR} onChange={e => set('strucnjakZNR', e.target.value)} />
                        </div>
                    </div>

                    {/* Row 4: Upisao | Cijena */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{lang === 'bs' ? 'Upisao' : 'Entered by'}</div>
                            <input className="form-input" value={formData.upisao} onChange={e => set('upisao', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{lang === 'bs' ? 'Cijena' : 'Price'}</div>
                            <input
                                className="form-input"
                                type="number"
                                min="0"
                                step="0.01"
                                style={{ textAlign: 'right' }}
                                value={formData.cijena}
                                onChange={e => set('cijena', e.target.value)}
                                placeholder="0,00"
                            />
                        </div>
                    </div>

                    {/* Row 5: Izdano za radno mjesto | Ograničenja */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{lang === 'bs' ? 'Izdano za radno mjesto' : 'Issued for workplace'}</div>
                            <select className="form-select" value={formData.vydanoZaRadnoMjesto || ''} onChange={e => set('vydanoZaRadnoMjesto', e.target.value)}>
                                <option value="">{lang === 'bs' ? '— Odaberite radno mjesto —' : '— Select workplace —'}</option>
                                {workplaces.map(wp => <option key={wp.id} value={wp.naziv}>{wp.naziv}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{lang === 'bs' ? 'Ograničenja / Napomena' : 'Restrictions / Note'}</div>
                            <textarea className="form-input" rows={3} value={formData.ogranicenja} onChange={e => set('ogranicenja', e.target.value)} style={{ resize: 'vertical' }} />
                        </div>
                    </div>

                    {/* Attachments section */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20, marginBottom: 24 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                            {lang === 'bs' ? 'Datoteka/e' : 'Attachments'}
                        </div>
                        <div className="form-grid-2">
                            <div>
                                <div style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Priloži datoteku' : 'Upload file'}</div>
                                    <input
                                        type="file"
                                        className="form-input"
                                        style={{ paddingTop: 6 }}
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            if (file.size > 20 * 1024 * 1024) { alert('Max 20MB!'); return; }
                                            try {
                                                const result = await uploadSecureFile(activeCompanyId, 'certificates', file);
                                                set('attachedFileUrl', result.url);
                                                set('attachedFilePath', result.storagePath);
                                                set('attachedFileName', result.name);
                                                set('attachedFileSize', result.size);
                                                set('attachedFileType', result.type);
                                            } catch (err) {
                                                console.error('[Upload] Attachment error:', err);
                                                alert(lang === 'bs' ? `Greška pri učitavanju: ${err.message}` : `Upload failed: ${err.message}`);
                                            } finally {
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                    {(formData.attachedFileUrl || formData.attachedFileData) && (
                                        <div style={{
                                            marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.25)',
                                            display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem',
                                        }}>
                                            <span>{formData.attachedFileName?.endsWith('.pdf') ? '📕' : '🖼️'}</span>
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                                {formData.attachedFileName}
                                                {formData.attachedFileUrl && <span style={{ marginLeft: 6, color: 'var(--success)', fontSize: '0.75rem' }}>☁️ Cloud</span>}
                                            </span>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                                                onClick={() => { set('attachedFileUrl', null); set('attachedFileData', null); set('attachedFileName', ''); }}>✕</button>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Opis datoteke' : 'File description'}</div>
                                    <input className="form-input" value={formData.fileOpis} onChange={e => set('fileOpis', e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <div style={labelStyle}>{lang === 'bs' ? 'Vrsta datoteke' : 'File type'}</div>
                                <select className="form-select" value={formData.vrstaDateotekeId} onChange={e => set('vrstaDateotekeId', e.target.value)}>
                                    <option value="">{lang === 'bs' ? 'Odaberite vrstu datoteke' : 'Select file type'}</option>
                                    {FILE_TYPE_OPTIONS.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={handleSave}>
                            💾 {t('save')}
                        </button>
                        <button className="btn btn-ghost" onClick={() => { 
                            const returnTo = searchParams?.get('returnTo'); 
                            if (returnTo) {
                                router.back();
                            } else {
                                router.back(); 
                            }
                        }}>
                            ↩ {t('cancel')}
                        </button>
                        {(formData.tipUvjerenjaIme || '').toLowerCase().includes('zapisnik o ocjeni osposobljenosti') && selectedWorkerIds.size === 1 && (() => {
                            const wId = [...selectedWorkerIds][0];
                            const wk = workers.find(x => x.id === wId);
                            if (!wk) return null;
                            return (
                                <button className="btn btn-outline btn-sm" onClick={() => {
                                    const wps = getAll(COLLECTIONS.WORKPLACES);
                                    const wpN = wps.find(wp => wp.id === wk.radnoMjestoId)?.naziv || formData.vydanoZaRadnoMjesto || '';
                                    const companyFull = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                                    printZosPdf({
                                        company: companyFull,
                                        worker: wk,
                                        workplaceName: wpN,
                                        training: { naziv: formData.tipUvjerenjaIme },
                                        officer: formData.strucnjakZNR || formData.upisao || '',
                                        date: formData.datum || new Date().toISOString(),
                                        certOznaka: formData.oznaka || `ZOS-${Date.now().toString(36).toUpperCase()}`,
                                        testResult: formData.rezultatTesta || '',
                                    });
                                }}>
                                    🖨️ {lang === 'bs' ? 'Ispiši ZOS' : 'Print ZOS'}
                                </button>
                            );
                        })()}
                        {selectedWorkerIds.size > 0 && (
                            <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                                💡 {lang === 'bs'
                                    ? `Uvjerenje će biti dodijeljeno ${selectedWorkerIds.size} radnik(u/a)`
                                    : `Certificate will be assigned to ${selectedWorkerIds.size} worker(s)`}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function UvjerenjeCreatePage() {
    return (
        <Suspense fallback={null}>
            <UvjerenjeFormPage />
        </Suspense>
    );
}
