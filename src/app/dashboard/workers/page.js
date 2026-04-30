'use client';
import DateInput from '@/components/DateInput';
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
import { uploadSecureFile } from '@/lib/storageService';
import { printZosPdf } from '@/lib/zosPdfGenerator';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import PDFExportButton from '@/components/PDFExportButton';
import Icon3D from '@/components/Icon3D';
import { generateWorkersReport, generateCertificatesReport } from '@/lib/pdfReportGenerator';
import { useSortedList } from '@/hooks/useSortedList';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useDialog } from '@/hooks/useDialog';
import * as XLSX from 'xlsx';
import { fmtDate, matchesSearch } from '@/lib/dateUtils';
import { isoToDisplay, displayToISO, DateField, Field, SelectField, InfoTip, StazPicker, Accordion, TimePicker } from '@/components/forms/WorkerFormFields';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';

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
    const { markDirty, markClean, isDirty: contextIsDirty } = useUnsavedChanges(async () => await handleSave());
    const { alert, confirm, prompt, DialogRenderer } = useDialog();
    const isDirtyRef = useRef(false);
    const [workers, setWorkers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrgUnit, setFilterOrgUnit] = useState('');
    const [allCerts, setAllCerts] = useState(() => getAll(COLLECTIONS.CERTIFICATES));
    const [allMedExamsList, setAllMedExamsList] = useState(() => getAll(COLLECTIONS.MEDICAL_EXAMS));
    const [showFormer, setShowFormer] = useState(false);
    const [editingWorker, setEditingWorker] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [returnPath, setReturnPath] = useState(null);
    const [formData, setFormData] = useState({ ...emptyWorker });
    const [openSections, setOpenSections] = useState({ kontakt: false, osobni: false, posebni: false, uvjerenja: true, ozo: false, medExams: false, mjestoRada: false, dodatniPoslovi: false, dokumenti: false });
    const [orgUnits, setOrgUnits] = useState([]);
    const [workplaces, setWorkplaces] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [ppeAssign, setPpeAssign] = useState([]);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, maxH: 300 });
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [viewWorkerId, setViewWorkerId] = useState(null);
    const [viewWorkerInitialTab, setViewWorkerInitialTab] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [fullFormTab, setFullFormTab] = useState('osnovno');
    const actionRef = useRef(null);
    const photoInputRef = useRef(null);
    const editingWorkerRef = useRef(null); // tracks current worker id even across saves
    const openWorkerHandledRef = useRef(null); // stores last handled openWorker ID (not boolean)
    const openedViaUrlRef = useRef(false); // true when form was opened via ?openWorker= param
    const uvjerenjaRef = useRef(null); // ref for scroll-to on cert section
    const ozoRef = useRef(null);       // ref for scroll-to on OZO section
    const dokumentiRef = useRef(null); // ref for scroll-to on Dokumenti section
    // Certificate form state
    const [showCertForm, setShowCertForm] = useState(false);
    const [certFormData, setCertFormData] = useState({ oznaka: '', datum: '', vrijediDo: '', ime: '', tipUvjerenja: 'ZNR', upisao: 'Admin', sposobnost: 'Sposoban' });
    const [certEditId, setCertEditId] = useState(null);
    const [certSearch, setCertSearch] = useState('');
    const [certMenuId, setCertMenuId] = useState(null); // active cert action dropdown
    const [certMenuPos, setCertMenuPos] = useState({ top: 0, left: 0 }); // fixed position
    const certMenuRef = useRef(null);
    const certOpenBtnRef = useRef(null); // ref to the button element that opened the menu
    const certMenuIdRef = useRef(null);  // ref mirror of certMenuId — never stale in closures
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
    // Medical exams state
    const [workerMedExams, setWorkerMedExams] = useState([]);
    const [showMedExamForm, setShowMedExamForm] = useState(false);
    const [medExamEditId, setMedExamEditId] = useState(null);
    const [medExamForm, setMedExamForm] = useState({ tipPregleda: 'prethodni', datumPregleda: '', vrijediDo: '', rezultat: 'Sposoban', zdravstvenaUstanova: '', doktorIme: '', ogranicenja: '', uputnicaBroj: '' });
    const medExamsRef = useRef(null);

    // EXCEL EXPORT
    const [excelExportMode, setExcelExportMode] = useState(null);
    const [exportColumns, setExportColumns] = useState({
        ime: true, prezime: true, imeRoditelja: false, jmbg: true, oib: true, datumRodenja: true, spol: false,
        miestoRodenja: false, zivotnaDob: false, orgJedinicaId: true, radnoMjestoId: true, datumZaposlenja: true,
        datumOdlaska: false, stazDoDolaska: false, ukupniStaz: false, koef: false, lokacija: false, ulica: false, kucniBroj: false,
        mjestoId: false, opcina: false, telefonTvrtki: false, mobitel: false, email: false, napomena: false, aktivan: true, vanjskiSuradnik: false, evidencijskiBroj: false,
        uvjerenja: false, ljekarski: false, ozo: false
    });

    // Group actions menu state
    const [groupMenuOpen, setGroupMenuOpen] = useState(false);
    const groupMenuRef = useRef(null);

    const zosUploadRef = useRef(null);
    const zopUploadRef = useRef(null);
    const [uploadingDocForWorker, setUploadingDocForWorker] = useState(null);

    const processZosZopUpload = async (e, type) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingDocForWorker) return;

        try {
            const w = workers.find(wk => wk.id === uploadingDocForWorker);
            // 1. Upload file to Storage
            const uploadResult = await uploadSecureFile(activeCompanyId, 'workers', file);

            // 2. Save document directly on the worker record (NOT as a certificate)
            const workerData = getById(COLLECTIONS.WORKERS, uploadingDocForWorker);
            const existingDocs = workerData?.dokumenti || [];
            update(COLLECTIONS.WORKERS, uploadingDocForWorker, {
                dokumenti: [...existingDocs, {
                    id: Date.now().toString(36),
                    name: file.name,
                    url: uploadResult.url,
                    storagePath: uploadResult.storagePath,
                    size: uploadResult.size,
                    type: uploadResult.type,
                    source: type === 'ZOS' ? 'Zapisnik ZOS' : 'Zapisnik ZOP',
                    date: new Date().toISOString().split('T')[0],
                }]
            });
            loadData();
            alert(lang === 'bs' ? `Zapisnik uspješno dodan za radnika ${w?.ime} ${w?.prezime}!` : `Document successfully added for ${w?.ime} ${w?.prezime}!`);
        } catch (err) {
            console.error(err);
            alert(lang === 'bs' ? 'Greška pri učitavanju datoteke.' : 'Error reading file.');
        } finally {
            setUploadingDocForWorker(null);
            if (zosUploadRef.current) zosUploadRef.current.value = '';
            if (zopUploadRef.current) zopUploadRef.current.value = '';
            setActionMenuId(null);
        }
    };

    const loadData = useCallback(() => {
        // reload list-level collections
        if (typeof window !== 'undefined') { setAllCerts(getAll(COLLECTIONS.CERTIFICATES)); setAllMedExamsList(getAll(COLLECTIONS.MEDICAL_EXAMS)); }
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
        setPpeTypes([...getAll(COLLECTIONS.PPE_TYPES)]);

        setPlaces(getAll(COLLECTIONS.PLACES));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

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
            // Cert menu: skip if clicking the button that opened it (its onClick will toggle)
            if (certOpenBtnRef.current && certOpenBtnRef.current.contains(e.target)) return;
            if (certMenuRef.current && !certMenuRef.current.contains(e.target)) {
                setCertMenuId(null);
                certMenuIdRef.current = null;
                certOpenBtnRef.current = null;
            }
            if (groupMenuRef.current && !groupMenuRef.current.contains(e.target)) {
                setGroupMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    // Auto-open full form via ?openWorker=ID (from "Otvori potpuno" or deep links)
    useEffect(() => {
        if (workers.length === 0) return;
        const openId = searchParams?.get('openWorker');
        if (!openId) return;
        if (openWorkerHandledRef.current === openId) return;
        const found = workers.find(x => x.id === openId);
        if (found) {
            openWorkerHandledRef.current = openId;
            openedViaUrlRef.current = true;
            handleEdit(found);
            markClean();
            isDirtyRef.current = false;
            const section = searchParams?.get('section');
            const tabMap = { ozo: 'ozo', uvjerenja: 'uvjerenja', dokumenti: 'dokumenti', medExams: 'pregledi', zdravstvo: 'pregledi' };
            setFullFormTab(tabMap[section] || 'osnovno');
            window.history.replaceState(null, '', '/dashboard/workers');
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
        const matchSearch = !searchTerm || matchesSearch(
            `${w.ime} ${w.prezime} ${w.jmbg} ${w.oib} ${w.identBroj || ''} ${w.datumRodenja || ''} ${w.datumZaposlenja || ''} ${w.datumOdlaska || ''}`,
            searchTerm
        );
        const matchStatus = showFormer ? !w.aktivan : w.aktivan;
        const matchOrgUnit = !filterOrgUnit || w.orgJedinicaId === filterOrgUnit || w.orgJedinica === filterOrgUnit;
        return matchSearch && matchStatus && matchOrgUnit;
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
        if (typeof window !== 'undefined') {
            window.history.pushState({ workerForm: true }, '');
        }
    };

    const handleEdit = (worker) => {
        setFormData({ ...worker });
        setEditingWorker(worker.id);
        editingWorkerRef.current = worker.id;
        setCertificates(getWorkerCertificates(worker.id));
        setPpeAssign(getWorkerPPE(worker.id));
        setWorkerMedExams(getAll(COLLECTIONS.MEDICAL_EXAMS).filter(e => e.workerId === worker.id));
        // Restore inline med exam form draft if user had navigated to RA-1 mid-form
        if (typeof window !== 'undefined') {
            const draft = sessionStorage.getItem('eznr_draft_workers_medexam');
            if (draft) {
                try {
                    const d = JSON.parse(draft);
                    if (d.workerId === worker.id) {
                        setMedExamForm(d.form || {});
                        setMedExamEditId(d.editId || null);
                        setShowMedExamForm(true);
                        setOpenSections(prev => ({ ...prev, medExams: true }));
                    }
                    sessionStorage.removeItem('eznr_draft_workers_medexam');
                } catch { sessionStorage.removeItem('eznr_draft_workers_medexam'); }
            }
        }
        setActionMenuId(null);
        setShowForm(true);
        // Push browser history entry so mobile back button closes form
        if (typeof window !== 'undefined') {
            window.history.pushState({ workerForm: true }, '');
        }
    };

    const handleDelete = async (id) => {
        const ok = await confirm(lang === 'bs' ? 'Jeste li sigurni da želite obrisati ovog radnika?' : 'Are you sure you want to delete this worker?');
        if (ok) {
            removeWorkerCascade(id);
            setActionMenuId(null);
            loadData();
            if (typeof window !== 'undefined' && window.eznrToast) {
                window.eznrToast(lang === 'bs' ? 'Radnik obrisan' : 'Worker deleted', 'info');
            }
        }
    };

    const handleSave = async (addNew = false) => {
        if (!formData.ime || !formData.prezime) {
            await alert(lang === 'bs' ? 'Ime i prezime su obavezna polja!' : 'First name and last name are required!');
            return null;
        }

        let finalFormData = { ...formData };

        let savedId = editingWorker;
        if (editingWorker) {
            update(COLLECTIONS.WORKERS, editingWorker, finalFormData);
        } else {
            const newWorker = create(COLLECTIONS.WORKERS, finalFormData);
            savedId = newWorker.id;
            setEditingWorker(savedId);
            editingWorkerRef.current = savedId;
        }

        // Keep formData in sync with the new cloud URL
        setFormData(finalFormData);

        loadData();
        markClean();
        isDirtyRef.current = false;
        // Toast feedback
        if (typeof window !== 'undefined' && window.eznrToast) {
            window.eznrToast(lang === 'bs' ? `Radnik ${finalFormData.ime} ${finalFormData.prezime} spremljen ✅` : `Worker ${finalFormData.ime} ${finalFormData.prezime} saved ✅`, 'success');
        }
        // Clear refs BEFORE state changes so the openWorker watcher never re-fires
        openWorkerHandledRef.current = null;
        openedViaUrlRef.current = false;
        if (addNew) {
            setFormData({ ...emptyWorker });
            setEditingWorker(null);
            editingWorkerRef.current = null;
            setCertificates([]);
            setPpeAssign([]);
        } else {
            setShowForm(false);
        }
        setSelectedIds(new Set());
        return savedId;
    };

    const handleCancel = (skipHistoryBack = false) => {
        markClean();
        isDirtyRef.current = false;
        openWorkerHandledRef.current = null;
        openedViaUrlRef.current = false;
        setEditingWorker(null);
        setShowForm(false);
        // If closing via in-app button, pop the history entry we pushed
        if (!skipHistoryBack && typeof window !== 'undefined') {
            window.history.back();
        }
    };

    const handleBack = () => {
        window.history.back(); // Trigger popstate, allowing NavigationGuardContext to intercept if dirty
    };

    // Listen for browser back button to close the worker form
    useEffect(() => {
        const onPopState = () => {
            if (showForm && !contextIsDirty) {
                handleCancel(true); // skipHistoryBack — browser already went back
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [showForm, contextIsDirty]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        markDirty();
        isDirtyRef.current = true;
    };

    // ── Render ──

    const _miSt = { display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text)', fontFamily: 'var(--font-body)', transition: 'background 0.12s' };

    if (showForm) {
        return (
            <div className="animate-fadeIn">
                <PageHeader 
                    icon={<Icon3D name="Radnici.png" size={64} />} 
                    title={editingWorker ? (lang === 'bs' ? 'Uredi radnika' : 'Edit Worker') : (lang === 'bs' ? 'Novi radnik' : 'New Worker')} 
                    backBtn={{ onClick: handleBack, label: lang === 'bs' ? 'Radnici' : 'Workers' }} 
                />
                <DialogRenderer />

                {/* ── Tab Bar ── */}
                <div style={{ marginBottom: 20 }}>
                    <TabBar active={fullFormTab} onChange={setFullFormTab} 
                        tabs={[
                            { key: 'osnovno', icon: '👤', label: lang === 'bs' ? 'Osnovno' : 'Basic' },
                            { key: 'uvjerenja', icon: '📜', label: `${lang === 'bs' ? 'Uvjerenja' : 'Certs'} (${certificates.length})` },
                            { key: 'ozo', icon: '🦺', label: `OZO (${ppeAssign.length})` },
                            { key: 'pregledi', icon: '👨‍⚕️', label: `${lang === 'bs' ? 'Pregledi' : 'Exams'} (${workerMedExams.length})` },
                            { key: 'dokumenti', icon: '📁', label: `${lang === 'bs' ? 'Dokumenti' : 'Docs'} (${(formData.dokumenti || []).length})` },
                        ]} 
                    />
                </div>

                {fullFormTab === 'osnovno' && (<>
                {/* ── MAIN FORM CARD ── */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <Field label={t('workerName')} value={formData.ime} onChange={v => updateField('ime', v)} required />
                            <Field label={t('workerSurname')} value={formData.prezime} onChange={v => updateField('prezime', v)} required />
                            <Field label={t('dateOfBirth')} value={formData.datumRodenja} onChange={v => updateField('datumRodenja', v)} type="date" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                            <Field label={t('parentName')} value={formData.imeRoditelja} onChange={v => updateField('imeRoditelja', v)} />
                            <Field label="JMBG" value={formData.jmbg} onChange={v => updateField('jmbg', v)} placeholder="13 cifara" tooltip="Jedinstveni matični broj. Ako je radnik stranac i uplaćuje porez preko OIB-a, ostavite JMBG praznim." />
                            <Field label={t('oib')} value={formData.oib} onChange={v => updateField('oib', v)} tooltip="Osobni identifikacijski broj (npr. HR). Koristi se kao alternativa za strane radnike." />
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <TimePicker label={lang === 'bs' ? 'Radno vrijeme od' : 'Work from'} value={formData.radnoVrijemeOd} onChange={v => updateField('radnoVrijemeOd', v)} />
                            <TimePicker label={lang === 'bs' ? 'Radno vrijeme do' : 'Work to'} value={formData.radnoVrijemeDo} onChange={v => updateField('radnoVrijemeDo', v)} />
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

                        {/* Radno vrijeme (from workplace) */}
                        {(() => { const _wp = workplaces.find(w => w.id === formData.radnoMjestoId); return _wp && (_wp.radnoVrijemeOd || _wp.radnoVrijemeDo) ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 16, marginBottom: 20, alignItems: 'end' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">{lang === 'bs' ? 'Radno vrijeme od' : 'Work from'}</label>
                                    <div className="form-input" style={{ cursor: 'not-allowed', background: 'var(--bg-input)', color: 'var(--text)' }}>{_wp.radnoVrijemeOd || '—'}</div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">{lang === 'bs' ? 'Radno vrijeme do' : 'Work to'}</label>
                                    <div className="form-input" style={{ cursor: 'not-allowed', background: 'var(--bg-input)', color: 'var(--text)' }}>{_wp.radnoVrijemeDo || '—'}</div>
                                </div>
                            </div>
                        ) : null; })()}

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">{lang === 'bs' ? 'Dodatni poslovi' : 'Additional jobs'}</label>
                            <textarea className="form-textarea" value={formData.dodatniPoslovi || ''} onChange={e => updateField('dodatniPoslovi', e.target.value)}
                                placeholder={lang === 'bs' ? 'Opišite dodatne poslove i obaveze koje radnik obavlja...' : 'Describe additional jobs...'} rows={2} />
                        </div>
                    </div>
                </div>


                {/* WORKER HEALTH SUMMARY */}
                {editingWorker && (() => {
                    const wp = workplaces.find(w => w.id === formData.radnoMjestoId);
                    const isNightShift = (odStr, doStr) => {
                        if (!odStr || !doStr) return false;
                        const start = parseInt((odStr || '').replace(':', ''));
                        const end = parseInt((doStr || '').replace(':', ''));
                        if (isNaN(start) || isNaN(end)) return false;
                        if (start > end) return true;
                        if (start < 600 || end >= 2200) return true;
                        return false;
                    };
                    const hasNightShift = wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo);
                    const _t = new Date();
                    const _expC = certificates.filter(cx => cx.vrijediDo && new Date(cx.vrijediDo) < _t).length;
                    const _valC = certificates.filter(cx => !cx.vrijediDo || new Date(cx.vrijediDo) >= _t).length;
                    const _lm = [...workerMedExams].sort((a, b) => (b.datumPregleda || '').localeCompare(a.datumPregleda || ''))[0];
                    const _lmd = _lm?.vrijediDo ? Math.ceil((new Date(_lm.vrijediDo) - _t) / 86400000) : null;
                    const _mc = _lmd === null ? 'none' : _lmd < 0 ? 'expired' : _lmd <= 60 ? 'soon' : 'valid';
                    const _mColor = { expired: 'var(--danger)', soon: 'var(--warning)', valid: 'var(--success)', none: 'var(--text-muted)' }[_mc];
                    return (
                        <>
                            {hasNightShift && (
                                <div style={{ background: 'rgba(239,83,80,0.15)', borderBottom: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    🌙 Obavezan ljekarski pregled najmanje 1x u 2 godine (Noćni rad radnog mjesta - čl. 40 FBiH)
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                                <div onClick={() => { setOpenSections(p => ({ ...p, uvjerenja: true })); uvjerenjaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                    style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: _expC > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.06)', border: `1px solid ${_expC > 0 ? 'var(--danger)' : 'var(--success)'}`, display: 'flex', alignItems: 'center', gap: 10, transition: 'filter 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'} onMouseLeave={e => e.currentTarget.style.filter = ''}>
                                    <span style={{ fontSize: '1.4rem' }}>📋</span>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{lang === 'bs' ? 'Uvjerenja' : 'Certs'}</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: _expC > 0 ? 'var(--danger)' : 'var(--success)' }}>{_valC} ✓{_expC > 0 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}> {_expC} ⚠</span>}</div>
                                    </div>
                                </div>
                                <div onClick={() => { setOpenSections(p => ({ ...p, medExams: true })); medExamsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                    style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: _mc === 'expired' ? 'rgba(239,68,68,0.07)' : _mc === 'soon' ? 'rgba(245,158,11,0.07)' : 'rgba(34,197,94,0.05)', border: `1px solid ${_mColor}`, display: 'flex', alignItems: 'center', gap: 10, transition: 'filter 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'} onMouseLeave={e => e.currentTarget.style.filter = ''}>
                                    <span style={{ fontSize: '1.4rem' }}>👨‍⚕️</span>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{lang === 'bs' ? 'Pregled' : 'Med. Exam'}</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: _mColor }}>{_lm ? (_mc === 'expired' ? 'Istekao!' : _mc === 'soon' ? `${_lmd}d` : 'Vrijedi') : 'Nema'}</div>
                                        {_lm && <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>{formatDate(_lm.vrijediDo)}</div>}
                                    </div>
                                </div>
                                <div onClick={() => { setOpenSections(p => ({ ...p, ozo: true })); ozoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                    style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.2)', display: 'flex', alignItems: 'center', gap: 10, transition: 'filter 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'} onMouseLeave={e => e.currentTarget.style.filter = ''}>
                                    <span style={{ fontSize: '1.4rem' }}>🦺</span>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>OZO</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: ppeAssign.length > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{ppeAssign.length} {lang === 'bs' ? 'zaduženja' : 'assigned'}</div>
                                    </div>
                                </div>
                            </div>
                        </>
                    );
                })()}
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
                    <div className="form-grid-4">
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

                {/* ── NAPOMENA (in Osnovno tab) ── */}
                <div className="card" style={{ marginBottom: 24, marginTop: 24 }}>
                    <div className="card-body">
                        <div className="form-group">
                            <label className="form-label">{t('note')}</label>
                            <textarea className="form-textarea" value={formData.napomena} onChange={e => updateField('napomena', e.target.value)}
                                placeholder={lang === 'bs' ? 'Napomena...' : 'Note...'} rows={3} />
                        </div>
                    </div>
                </div>
                </>)}

                {fullFormTab === 'uvjerenja' && (<>
                {/* ── Uvjerenja radnika ── */}
                <div ref={uvjerenjaRef}>
                    <Accordion title={t('workerCerts')} open={true} onToggle={() => {}}>
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
                                        const cName = (c.ime || '').toLowerCase();
                                        const isZOS = cName.includes('zapisnik o ocjeni osposobljenosti');
                                        const isZNR = isZOS || cName.includes('zaštita na radu') || cName.includes('zastita na radu');
                                        const isZOP = cName.includes('požar') || cName.includes('pozar');
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
                                                            if (certMenuIdRef.current === c.id) {
                                                                certMenuIdRef.current = null;
                                                                certOpenBtnRef.current = null;
                                                                setCertMenuId(null);
                                                                return;
                                                            }
                                                            certMenuIdRef.current = c.id;
                                                            certOpenBtnRef.current = e.currentTarget;
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const menuW = 230;
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
                                                                onClick={() => { setCertMenuId(null); markClean(); router.push(`/dashboard/worker-certificates/create?copyFrom=${c.id}&returnTo=${returnToParam}`); }}>
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
                                                                            const wps = getAll(COLLECTIONS.ORG_UNITS);
                                                                            const wpN = wps.find(wp => wp.id === wk.radnoMjestoId)?.naziv || c.izdanoZaRadnoMjesto || '';
                                                                            const companyFull = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                                                                            printZosPdf({ company: companyFull, worker: wk, workplaceName: wpN, training: { naziv: c.izdanoIzObuke || c.ime }, officer: c.strucnjakZNR || c.upisao || '', date: c.datum || new Date().toISOString(), certOznaka: c.oznaka, testResult: c.rezultatTesta || '' });
                                                                        }}>
                                                                        🖨️ <span>{lang === 'bs' ? 'Ispiši ZOS dokument' : 'Print ZOS document'}</span>
                                                                    </button>
                                                                </>
                                                            )}
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
                                                            {!c.potpisanScan && (isZNR || isZOP) && (
                                                                <div style={{ padding: '6px 14px', fontSize: '0.72rem', color: 'var(--warning)', background: 'rgba(245,158,11,0.05)', lineHeight: 1.4, borderBottom: '1px solid var(--border-light)' }}>
                                                                    ⚠️ {lang === 'bs'
                                                                        ? `Priložiti ispunjen i potpisan ${isZOP ? 'Test ZOP' : 'Test ZNR'}.`
                                                                        : `Upload signed ${isZOP ? 'ZOP Test' : 'ZNR Test'}.`}
                                                                </div>
                                                            )}
                                                            <label className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                                                                📎 <span>{c.potpisanScan ? (lang === 'bs' ? 'Zamijeni scan ✅' : 'Replace scan ✅') : (isZNR ? (lang === 'bs' ? 'Upload potpisan Test ZNR' : 'Upload signed ZNR Test') : isZOP ? (lang === 'bs' ? 'Upload potpisan Test ZOP' : 'Upload signed ZOP Test') : (lang === 'bs' ? 'Upload potpisan scan' : 'Upload signed scan'))}</span>
                                                                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={async (e) => {
                                                                    const file = e.target.files?.[0]; if (!file) return;
                                                                    if (file.size > 15000000) { alert(lang === 'bs' ? 'Max 15MB' : 'Max 15MB'); return; }
                                                                    try {
                                                                        const uploadResult = await uploadSecureFile(activeCompanyId, 'certificates', file);
                                                                        update(COLLECTIONS.CERTIFICATES, c.id, { potpisanScan: uploadResult.url, potpisanScanName: file.name, potpisanScanDate: new Date().toISOString() });
                                                                        setCertificates(getWorkerCertificates(editingWorker));
                                                                        setCertMenuId(null);
                                                                        showFlash();
                                                                    } catch (err) {
                                                                        alert('Upload failed: ' + err.message);
                                                                    }
                                                                    e.target.value = '';
                                                                }} />
                                                            </label>
                                                            {c.potpisanScan && (
                                                                <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                                    onClick={() => {
                                                                        setCertMenuId(null);
                                                                        if (c.potpisanScan.startsWith('http')) {
                                                                            window.open(c.potpisanScan, '_blank');
                                                                            return;
                                                                        }
                                                                        const w = window.open('', '_blank');
                                                                        if (c.potpisanScan.startsWith('data:application/pdf')) { w.document.write(`<embed src="${c.potpisanScan}" width="100%" height="100%" type="application/pdf" />`); }
                                                                        else { w.document.write(`<img src="${c.potpisanScan}" style="max-width:100%; margin:20px auto; display:block;" />`); }
                                                                        w.document.close();
                                                                    }}>
                                                                    👁️ <span>{lang === 'bs' ? 'Prikaži potpisan dokument' : 'View signed document'}</span>
                                                                </button>
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
                </>)}

                {fullFormTab === 'ozo' && (<>
                {/* ── OZO radnika ── */}
                <div ref={ozoRef}>
                    <Accordion title={t('workerPPESection')} open={true} onToggle={() => {}}>
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
                </>)}

                {fullFormTab === 'pregledi' && (<>
                {/* Ljekarski pregledi */}
                <div ref={medExamsRef}>
                    <Accordion title={"👨‍⚕️ " + (lang === 'bs' ? 'Ljekarski pregledi' : 'Medical Exams')} open={true} onToggle={() => {}}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => { markClean(); router.push('/dashboard/medical-exams?openNew=1&workerId=' + encodeURIComponent(editingWorker) + '&returnTo=worker'); }}>
                                + {lang === 'bs' ? 'Novi pregled' : 'New Exam'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { if (showMedExamForm) { sessionStorage.setItem('eznr_draft_workers_medexam', JSON.stringify({ workerId: editingWorker, form: medExamForm, editId: medExamEditId })); } markClean(); router.push('/dashboard/referral-ra1?openNew=1'); }}>
                                📋 {lang === 'bs' ? 'Nova uputnica RA-1' : 'New RA-1 Referral'}
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--primary)' }} onClick={() => { markClean(); router.push('/dashboard/medical-exams'); }}>
                                {lang === 'bs' ? 'Svi pregledi →' : 'All exams →'}
                            </button>
                        </div>
                        {workerMedExams.length === 0 ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                {lang === 'bs' ? 'Nema evidentiranih ljekarskih pregleda za ovog radnika.' : 'No medical exams recorded for this worker.'}
                            </div>
                        ) : (
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead><tr>
                                        <th>{lang === 'bs' ? 'Akcije' : 'Actions'}</th>
                                        <th>{lang === 'bs' ? 'Vrsta pregleda' : 'Type'}</th>
                                        <th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                                        <th>{lang === 'bs' ? 'Naredni pregled' : 'Next exam'}</th>
                                        <th>{lang === 'bs' ? 'Rezultat' : 'Result'}</th>
                                        <th>{lang === 'bs' ? 'Ustanova' : 'Institution'}</th>
                                    </tr></thead>
                                    <tbody>
                                        {workerMedExams.sort((a, b) => (b.datumPregleda || '').localeCompare(a.datumPregleda || '')).map(me => {
                                            const days = me.vrijediDo ? Math.ceil((new Date(me.vrijediDo) - new Date()) / 86400000) : null;
                                            const badgeCls = days === null ? '' : days < 0 ? 'badge-danger' : days <= 90 ? 'badge-warning' : 'badge-success';
                                            const badgeLabel = days === null ? (lang === 'bs' ? 'Bez roka' : 'No deadline') : days < 0 ? (lang === 'bs' ? 'Isteklo' : 'Expired') : formatDate(me.vrijediDo);
                                            const TMAP = { prethodni: 'Prethodni', 'periodicni': 'Periodički', vanredni: 'Vanredni', nocniRad: 'Noćni rad', ostalo: 'Ostalo' };
                                            const RCOL = { 'Sposoban': 'var(--success)', 'Uvjetno Sposoban': 'var(--warning)', 'Nesposoban': 'var(--danger)' };
                                            const openExamEdit = () => { setMedExamEditId(me.id); setMedExamForm({ tipPregleda: me.tipPregleda || 'prethodni', datumPregleda: me.datumPregleda || '', vrijediDo: me.vrijediDo || '', rezultat: me.rezultat || 'Sposoban', zdravstvenaUstanova: me.zdravstvenaUstanova || '', doktorIme: me.doktorIme || '', ogranicenja: me.ogranicenja || '', uputnicaBroj: me.uputnicaBroj || '' }); setShowMedExamForm(true); };
                                            return (
                                                <tr key={me.id}
                                                    style={{ background: days !== null && days < 0 ? 'rgba(239,68,68,0.04)' : '', cursor: 'pointer' }}
                                                    onClick={openExamEdit}
                                                    onMouseEnter={e => { if (!(days !== null && days < 0)) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = days !== null && days < 0 ? 'rgba(239,68,68,0.04)' : ''; }}
                                                >
                                                    <td onClick={e => e.stopPropagation()}>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Uredi' : 'Edit'} onClick={openExamEdit}>✏️</button>
                                                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={lang === 'bs' ? 'Obriši' : 'Delete'} onClick={async () => { const ok = await confirm(lang === 'bs' ? 'Obrisati pregled?' : 'Delete exam?'); if (ok) { remove(COLLECTIONS.MEDICAL_EXAMS, me.id); setWorkerMedExams(getAll(COLLECTIONS.MEDICAL_EXAMS).filter(e => e.workerId === editingWorker)); } }}>🗑️</button>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.82rem' }}>{TMAP[me.tipPregleda] || me.tipPregleda}</td>
                                                    <td style={{ fontSize: '0.85rem' }}>{formatDate(me.datumPregleda)}</td>
                                                    <td><span className={`badge ${badgeCls}`} style={{ fontSize: '0.7rem' }}>{badgeLabel}</span></td>
                                                    <td style={{ fontWeight: 600, color: RCOL[me.rezultat] || 'inherit', fontSize: '0.85rem' }}>{me.rezultat}</td>
                                                    <td style={{ fontSize: '0.8rem' }}>{me.zdravstvenaUstanova || ''}{me.doktorIme ? ` / Dr. ${me.doktorIme}` : ''}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Accordion>
                </div>
                </>)}

                {fullFormTab === 'dokumenti' && (<>
                {/* ── Dokumenti ── */}
                <div ref={dokumentiRef}>
                    <Accordion title={`📁 ${lang === 'bs' ? 'Dokumenti' : 'Documents'}`} open={true} onToggle={() => {}}>
                        {(() => {
                            // Collect all documents from this worker's certificates
                            const workerDocs = [];
                            const wCerts = getAll(COLLECTIONS.CERTIFICATES).filter(c => c.workerId === editingWorker);
                            wCerts.forEach(c => {
                                // New Storage-URL style
                                if (c.fileUrl) {
                                    workerDocs.push({ id: c.id + '_file', certId: c.id, name: c.fileName || c.ime || 'Dokument', url: c.fileUrl, type: c.fileType || '', size: c.fileSize || 0, source: c.tipUvjerenjaIme || c.ime || 'Uvjerenje', date: c.datum || '' });
                                }
                                if (c.attachedFileUrl) {
                                    workerDocs.push({ id: c.id + '_attached', certId: c.id, name: c.attachedFileName || c.ime || 'Dokument', url: c.attachedFileUrl, type: c.attachedFileType || '', size: c.attachedFileSize || 0, source: c.tipUvjerenjaIme || c.ime || 'Uvjerenje', date: c.datum || '' });
                                }
                                // Legacy base64 fallback
                                if (!c.fileUrl && c.fileData) {
                                    workerDocs.push({ id: c.id + '_file', certId: c.id, name: c.fileName || c.ime || 'Dokument', data: c.fileData, type: '', size: 0, source: c.tipUvjerenjaIme || c.ime || 'Uvjerenje', date: c.datum || '' });
                                }
                                if (!c.attachedFileUrl && c.attachedFileData) {
                                    workerDocs.push({ id: c.id + '_attached', certId: c.id, name: c.attachedFileName || c.ime || 'Dokument', data: c.attachedFileData, type: c.attachedFileType || '', size: c.attachedFileSize || 0, source: c.tipUvjerenjaIme || c.ime || 'Uvjerenje', date: c.datum || '' });
                                }
                                if (c.potpisanScan) {
                                    if (c.potpisanScan.startsWith('http')) {
                                        workerDocs.push({ id: c.id + '_scan', certId: c.id, name: c.potpisanScanName || `Potpisan ${c.ime || 'Dokument'}`, url: c.potpisanScan, type: '', size: 0, source: c.tipUvjerenjaIme || c.ime || 'Potpisan scan', date: c.potpisanScanDate || c.datum || '' });
                                    } else {
                                        workerDocs.push({ id: c.id + '_scan', certId: c.id, name: c.potpisanScanName || `Potpisan ${c.ime || 'Dokument'}`, data: c.potpisanScan, type: '', size: 0, source: c.tipUvjerenjaIme || c.ime || 'Potpisan scan', date: c.potpisanScanDate || c.datum || '' });
                                    }
                                }
                            });
                            // Also check for worker-level documents stored directly on the worker
                            const w = editingWorker ? getById(COLLECTIONS.WORKERS, editingWorker) : null;
                            if (w?.dokumenti && Array.isArray(w.dokumenti)) {
                                w.dokumenti.forEach((d, i) => {
                                    workerDocs.push({ id: `wdoc_${i}`, name: d.name || 'Dokument', url: d.url, data: d.data, type: d.type || '', size: d.size || 0, source: lang === 'bs' ? 'Direktno učitano' : 'Direct upload', date: d.date || '' });
                                });
                            }

                            // Open a document — supports both Storage URLs and legacy base64
                            const openDoc = (doc) => {
                                if (doc.url) {
                                    window.open(doc.url, '_blank');
                                    return;
                                }
                                const isPdf = doc.data?.startsWith('data:application/pdf');
                                const isImg = doc.data?.startsWith('data:image/');
                                if (isPdf || isImg) {
                                    const win = window.open('');
                                    if (win) {
                                        win.document.write(`<html><head><title>${doc.name}</title></head><body style="margin:0">${isPdf ? `<iframe src="${doc.data}" style="width:100%;height:100vh;border:none"></iframe>` : `<img src="${doc.data}" style="max-width:100%;margin:20px auto;display:block;" />`}</body></html>`);
                                        win.document.close();
                                    }
                                }
                            };
                            const downloadDoc = (doc) => {
                                if (doc.url) {
                                    const a = document.createElement('a');
                                    a.href = doc.url;
                                    a.download = doc.name;
                                    a.target = '_blank';
                                    a.click();
                                    return;
                                }
                                if (doc.data) {
                                    const a = document.createElement('a');
                                    a.href = doc.data;
                                    a.download = doc.name;
                                    a.click();
                                }
                            };
                            const printDoc = (doc) => {
                                if (doc.url) {
                                    const win = window.open(doc.url, '_blank');
                                    if (win) setTimeout(() => win.print(), 1000);
                                    return;
                                }
                                const isPdf = doc.data?.startsWith('data:application/pdf');
                                const isImg = doc.data?.startsWith('data:image/');
                                if (isPdf || isImg) {
                                    const win = window.open('');
                                    if (win) {
                                        win.document.write(`<html><head><title>${doc.name}</title></head><body style="margin:0">${isPdf ? `<iframe src="${doc.data}" style="width:100%;height:100vh;border:none"></iframe>` : `<img src="${doc.data}" style="max-width:100%;margin:20px auto;display:block;" />`}</body></html>`);
                                        win.document.close();
                                        setTimeout(() => win.print(), 500);
                                    }
                                }
                            };

                            return (
                                <div>
                                    {/* Upload new document directly */}
                                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            📎 {lang === 'bs' ? 'Učitaj novi dokument' : 'Upload new document'}
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file || !editingWorker) return;
                                                if (file.size > 20 * 1024 * 1024) { alert('Max 20MB!'); return; }
                                                try {
                                                    const uploadResult = await uploadSecureFile(activeCompanyId, 'workers', file);
                                                    // Save document directly on the worker record (NOT as a certificate)
                                                    const workerData2 = getById(COLLECTIONS.WORKERS, editingWorker);
                                                    const existingDocs2 = workerData2?.dokumenti || [];
                                                    update(COLLECTIONS.WORKERS, editingWorker, {
                                                        dokumenti: [...existingDocs2, {
                                                            id: Date.now().toString(36),
                                                            name: file.name,
                                                            url: uploadResult.url,
                                                            storagePath: uploadResult.storagePath,
                                                            size: uploadResult.size,
                                                            type: uploadResult.type,
                                                            source: lang === 'bs' ? 'Direktno učitano' : 'Direct upload',
                                                            date: new Date().toISOString().split('T')[0],
                                                        }]
                                                    });
                                                    loadData();
                                                    if (typeof window !== 'undefined' && window.eznrToast) {
                                                        window.eznrToast(lang === 'bs' ? 'Dokument učitan!' : 'Document uploaded!', 'success');
                                                    }
                                                } catch (err) {
                                                    console.error('[Upload] Dokument error:', err);
                                                    alert(lang === 'bs' ? 'Greška pri učitavanju.' : 'Upload error.');
                                                } finally {
                                                    e.target.value = '';
                                                }
                                            }} />
                                        </label>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            {workerDocs.length} {lang === 'bs' ? 'dokument(a)' : 'document(s)'}
                                        </span>
                                    </div>

                                    {workerDocs.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            {lang === 'bs' ? 'Nema učitanih dokumenata za ovog radnika.' : 'No documents uploaded for this worker.'}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            {workerDocs.map(doc => {
                                                const isUrl = !!doc.url;
                                                const isPdf = isUrl ? doc.type?.includes('pdf') : doc.data?.startsWith('data:application/pdf');
                                                const isImg = isUrl ? doc.type?.startsWith('image/') : doc.data?.startsWith('data:image/');
                                                const icon = isPdf ? '📕' : isImg ? '🖼️' : '📄';
                                                return (
                                                    <div key={doc.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 12,
                                                        padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                                                        background: 'var(--bg-input)', border: '1px solid var(--border-light)',
                                                        transition: 'border-color 0.15s',
                                                    }}
                                                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                                                    >
                                                        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{icon}</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {doc.name}
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                                <span>{doc.source}</span>
                                                                {doc.date && <span>{formatDate(doc.date)}</span>}
                                                                {doc.size > 0 && <span>{(doc.size / 1024).toFixed(1)} KB</span>}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                            {(isUrl || isPdf || isImg) && (
                                                                <button className="btn btn-ghost btn-sm" title={lang === 'bs' ? 'Prikaži' : 'View'}
                                                                    onClick={() => openDoc(doc)} style={{ padding: '4px 6px', fontSize: '0.9rem' }}>
                                                                    👁️
                                                                </button>
                                                            )}
                                                            <button className="btn btn-ghost btn-sm" title={lang === 'bs' ? 'Preuzmi' : 'Download'}
                                                                onClick={() => downloadDoc(doc)} style={{ padding: '4px 6px', fontSize: '0.9rem' }}>
                                                                ⬇️
                                                            </button>
                                                            {(isUrl || isPdf || isImg) && (
                                                                <button className="btn btn-ghost btn-sm" title={lang === 'bs' ? 'Isprintaj' : 'Print'}
                                                                    onClick={() => printDoc(doc)} style={{ padding: '4px 6px', fontSize: '0.9rem' }}>
                                                                    🖨️
                                                                </button>
                                                            )}
                                                        
                                                            <button className="btn btn-ghost btn-sm" title={lang === 'bs' ? 'Obriši' : 'Delete'}
                                                                onClick={async () => {
                                                                    if (doc.id?.startsWith('wdoc_')) {
                                                                        const ok = await confirm(lang === 'bs' ? 'Obrisati dokument?' : 'Delete document?');
                                                                        if (ok) {
                                                                            const wData = getById(COLLECTIONS.WORKERS, editingWorker);
                                                                            const idx = parseInt(doc.id.replace('wdoc_', ''), 10);
                                                                            const updDocs = (wData?.dokumenti || []).filter((_, i) => i !== idx);
                                                                            update(COLLECTIONS.WORKERS, editingWorker, { dokumenti: updDocs });
                                                                            setFormData(f => ({ ...f, dokumenti: updDocs }));
                                                                            loadData();
                                                                        }
                                                                    } else {
                                                                        await alert(lang === 'bs' ? 'Ovaj dokument je vezan uz uvjerenje. Obriši ga iz uvjerenja.' : 'This document is linked to a certificate. Delete it from the certificate.');
                                                                    }
                                                                }} style={{ padding: '4px 6px', fontSize: '0.9rem', color: 'var(--danger)' }}>
                                                                🗑️
                                                            </button></div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </Accordion>
                </div>
                </>)}

                {/* ── CERTIFICATE FORM MODAL ── */}
                {showCertForm && (
                    <div className="modal-overlay" onClick={() => { setShowCertForm(false); setCertEditId(null); }}>
                        <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>📜 {certEditId ? (lang === 'bs' ? 'Uredi uvjerenje' : 'Edit Certificate') : (lang === 'bs' ? 'Novo uvjerenje' : 'New Certificate')}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => { setShowCertForm(false); setCertEditId(null); }}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{lang === 'bs' ? 'Oznaka' : 'Code'} * <InfoTip text="Interni broj ili evidencijski kod certifikata u registru poslodavca (npr. ZNR-001)" /></label>
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
                                        <DateInput value={certFormData.datum} onChange={v => setCertFormData({ ...certFormData, datum: v })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{lang === 'bs' ? 'Vrijedi do' : 'Valid until'} <InfoTip text="Aplikacija će promijeniti status u crveno kada ovaj datum istekne ili postane blizu isteka." /></label>
                                        <DateInput value={certFormData.vrijediDo} onChange={v => setCertFormData({ ...certFormData, vrijediDo: v })} />
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


                {/* MEDICAL EXAM FORM MODAL */}
                {showMedExamForm && (
                    <div className="modal-overlay" onClick={() => { setShowMedExamForm(false); setMedExamEditId(null); }}>
                        <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #00695C, #00897B)' }}>
                                <h2 style={{ color: 'white', margin: 0 }}>👨‍⚕️ {medExamEditId ? (lang === 'bs' ? 'Uredi pregled' : 'Edit Exam') : (lang === 'bs' ? 'Novi ljekarski pregled' : 'New Medical Exam')}</h2>
                                <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => { setShowMedExamForm(false); setMedExamEditId(null); }}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{lang === 'bs' ? 'Vrsta pregleda' : 'Exam Type'} <InfoTip text="Dali se radnik prvi put u firmi zapošljava (Prethodni) ili obnavlja sposobnost jer je prošla godina (Periodični)" /></label>
                                        <select className="form-select" value={medExamForm.tipPregleda} onChange={e => setMedExamForm(p => ({ ...p, tipPregleda: e.target.value }))}>
                                            <option value="prethodni">{lang === 'bs' ? 'Prethodni pregled' : 'Pre-employment'}</option>
                                            <option value="periodicni">{lang === 'bs' ? 'Periodicni pregled' : 'Periodic Exam'}</option>
                                            <option value="vanredni">{lang === 'bs' ? 'Vanredni pregled' : 'Extraordinary'}</option>
                                            <option value="nocniRad">{lang === 'bs' ? 'Pregled - nocni rad' : 'Night-work Exam'}</option>
                                            <option value="ostalo">{lang === 'bs' ? 'Ostalo' : 'Other'}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Broj uputnice (RA-1)' : 'Referral No.'}</label>
                                        <input className="form-input" placeholder="RA1-2026-001" value={medExamForm.uputnicaBroj} onChange={e => setMedExamForm(p => ({ ...p, uputnicaBroj: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Datum pregleda *' : 'Exam Date *'}</label>
                                        <DateInput value={medExamForm.datumPregleda} onChange={v => setMedExamForm(p => ({ ...p, datumPregleda: v }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Naredni pregled do' : 'Next Exam By'}</label>
                                        <DateInput value={medExamForm.vrijediDo} onChange={v => setMedExamForm(p => ({ ...p, vrijediDo: v }))} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{lang === 'bs' ? 'Rezultat' : 'Result'} <InfoTip text="Mora se tačno poklapati sa nalazom i mišljenjem doktora medicine rada." /></label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {[{ v: 'Sposoban', c: 'var(--success)' }, { v: 'Uvjetno Sposoban', c: 'var(--warning)' }, { v: 'Nesposoban', c: 'var(--danger)' }].map(r => (
                                            <button key={r.v} type="button" onClick={() => setMedExamForm(p => ({ ...p, rezultat: r.v }))}
                                                style={{ flex: 1, padding: '8px', borderRadius: 8, border: `2px solid ${medExamForm.rezultat === r.v ? r.c : 'var(--border)'}`, background: medExamForm.rezultat === r.v ? r.c + '18' : 'var(--bg-input)', color: medExamForm.rezultat === r.v ? r.c : 'var(--text)', fontWeight: medExamForm.rezultat === r.v ? 700 : 400, cursor: 'pointer', fontSize: '0.8rem' }}>
                                                {medExamForm.rezultat === r.v ? '✓ ' : ''}{r.v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {(medExamForm.rezultat === 'Nesposoban' || medExamForm.rezultat === 'Uvjetno Sposoban') && (
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--warning)' }}>⚠️ {lang === 'bs' ? 'Ograničenja' : 'Restrictions'}</label>
                                        <textarea className="form-input" rows={2} value={medExamForm.ogranicenja} onChange={e => setMedExamForm(p => ({ ...p, ogranicenja: e.target.value }))} />
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">🏥 {lang === 'bs' ? 'Zdravstvena ustanova' : 'Health Institution'}</label>
                                        <input className="form-input" placeholder={lang === 'bs' ? 'Dom zdravlja...' : 'Health center...'} value={medExamForm.zdravstvenaUstanova} onChange={e => setMedExamForm(p => ({ ...p, zdravstvenaUstanova: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">👨‍⚕️ {lang === 'bs' ? 'Doktor medicine rada' : 'Doctor'}</label>
                                        <input className="form-input" placeholder="Dr. Ime Prezime" value={medExamForm.doktorIme} onChange={e => setMedExamForm(p => ({ ...p, doktorIme: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => { setShowMedExamForm(false); setMedExamEditId(null); }}>{t('cancel')}</button>
                                <button className="btn btn-primary" onClick={async () => {
                                    if (!medExamForm.datumPregleda) { await alert(lang === 'bs' ? 'Unesite datum pregleda!' : 'Enter exam date!'); return; }
                                    const w = workers.find(wk => wk.id === editingWorker);
                                    const payload = { ...medExamForm, workerId: editingWorker, radnikIme: w ? `${w.ime} ${w.prezime}` : '' };
                                    if (medExamEditId) { update(COLLECTIONS.MEDICAL_EXAMS, medExamEditId, payload); } else { create(COLLECTIONS.MEDICAL_EXAMS, payload); }
                                    setWorkerMedExams(getAll(COLLECTIONS.MEDICAL_EXAMS).filter(e => e.workerId === editingWorker));
                                    setShowMedExamForm(false); setMedExamEditId(null);
                                }}>💾 {t('save')}</button>
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
                                                setPpeTypes([...getAll(COLLECTIONS.PPE_TYPES)]);
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
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Datum zaduženja' : 'Assignment date'}</label>
                                        <DateInput value={ppeFormData.datumZaduzenja} onChange={v => setPpeFormData({ ...ppeFormData, datumZaduzenja: v })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{lang === 'bs' ? 'Datum razduženja' : 'Return date'}</label>
                                        <DateInput value={ppeFormData.datumRazduzenja} onChange={v => setPpeFormData({ ...ppeFormData, datumRazduzenja: v })} />
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
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 12, zIndex: 50,
                }}>
                    <button className="btn btn-primary" onClick={() => handleSave(false)}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                    <button className="btn btn-outline" onClick={() => handleSave(true)}>💾 {t('saveAndAddNew')}</button>
                    <button className="btn btn-ghost" onClick={handleBack}>↩ {lang === 'bs' ? 'Odustani' : 'Cancel'}</button>
                </div>
            </div>
        );
    }

    // ── LIST VIEW ──

    return (
        <>
            <div className="animate-fadeIn">
                <input ref={zosUploadRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => processZosZopUpload(e, 'ZOS')} />
                <input ref={zopUploadRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={(e) => processZosZopUpload(e, 'ZOP')} />

                <PageHeader icon={<Icon3D name="Radnici.png" size={64} />} title={t('workers')} />
                <DialogRenderer />

                {/* ── EXCEL EXPORT MODAL ── */}
                {excelExportMode && (
                    <div className="modal-overlay" onClick={() => setExcelExportMode(null)} style={{ zIndex: 9999 }}>
                        <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #107c41, #185c37)' }}>
                                <h2 style={{ color: 'white', margin: 0 }}>📊 {lang === 'bs' ? 'Izvoz liste radnika (Excel)' : 'Export Worker List (Excel)'}</h2>
                                <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setExcelExportMode(null)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-light)' }}>
                                    {lang === 'bs'
                                        ? `Odaberite koje podatke želite uključiti u Excel tablicu (${excelExportMode === 'selected' ? 'odabrano ' + selectedIds.size : 'SVIH ' + filteredWorkers.length} radnika):`
                                        : `Select which data to include in the Excel table (${excelExportMode === 'selected' ? selectedIds.size + ' workers selected' : 'ALL ' + filteredWorkers.length + ' workers'}):`}
                                </p>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                    <button className="btn btn-outline btn-sm" onClick={() => {
                                        const all = {};
                                        Object.keys(exportColumns).forEach(k => all[k] = true);
                                        setExportColumns(all);
                                    }}>{lang === 'bs' ? 'Odaberi sve' : 'Select all'}</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => {
                                        const none = {};
                                        Object.keys(exportColumns).forEach(k => none[k] = false);
                                        setExportColumns(none);
                                    }}>{lang === 'bs' ? 'Odznači sve' : 'Deselect all'}</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 16px', background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    {[
                                        { key: 'ime', label: 'Ime' }, { key: 'prezime', label: 'Prezime' }, { key: 'imeRoditelja', label: 'Ime roditelja' },
                                        { key: 'jmbg', label: 'JMBG' }, { key: 'oib', label: 'OIB' },
                                        { key: 'evidencijskiBroj', label: 'Evid. br.' },
                                        { key: 'datumRodenja', label: 'Datum rođenja' }, { key: 'miestoRodenja', label: 'Mjesto rođenja' },
                                        { key: 'spol', label: 'Spol' }, { key: 'zivotnaDob', label: 'Životna dob' },
                                        { key: 'orgJedinicaId', label: 'Organizacijska jed.' }, { key: 'radnoMjestoId', label: 'Radno mjesto' },
                                        { key: 'lokacija', label: 'Lokacija' },
                                        { key: 'datumZaposlenja', label: 'Datum zapošlj.' }, { key: 'stazDoDolaska', label: 'Staž do dolaska' },
                                        { key: 'datumOdlaska', label: 'Datum odlaska' }, { key: 'ukupniStaz', label: 'Ukupni staž' },
                                        { key: 'koef', label: 'Koeficijent' },
                                        { key: 'ulica', label: 'Ulica' }, { key: 'kucniBroj', label: 'Kućni broj' },
                                        { key: 'mjestoId', label: 'Mjesto' }, { key: 'opcina', label: 'Općina' },
                                        { key: 'telefonTvrtki', label: 'Tel (Firma)' }, { key: 'mobitel', label: 'Mobitel' },
                                        { key: 'email', label: 'Email' }, { key: 'napomena', label: 'Napomena' },
                                        { key: 'vanjskiSuradnik', label: 'Vanjski saradnik' }, { key: 'aktivan', label: 'Status (Aktivan)' },
                                        { key: 'uvjerenja', label: 'Uvjerenja ZNR..' }, { key: 'ljekarski', label: 'Ljekarski pregledi' },
                                        { key: 'ozo', label: 'Zadužena OZO' }
                                    ].map(col => (
                                        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <input type="checkbox" checked={exportColumns[col.key]} onChange={e => setExportColumns(p => ({ ...p, [col.key]: e.target.checked }))} />
                                            {col.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setExcelExportMode(null)}>{t('cancel')}</button>
                                <button className="btn btn-primary" style={{ background: '#107c41', color: 'white', borderColor: '#107c41' }} onClick={() => {
                                    const selectedWorkers = excelExportMode === 'selected' ? workers.filter(w => selectedIds.has(w.id)) : filteredWorkers;
                                    const allPpeList = getAll(COLLECTIONS.PPE_ASSIGNMENTS);
                                    const dataRows = selectedWorkers.map(w => {
                                        const row = {};
                                        if (exportColumns.ime) row['Ime'] = w.ime;
                                        if (exportColumns.prezime) row['Prezime'] = w.prezime;
                                        if (exportColumns.imeRoditelja) row['Ime roditelja'] = w.imeRoditelja;
                                        if (exportColumns.jmbg) row['JMBG'] = w.jmbg;
                                        if (exportColumns.oib) row['OIB/Osobni br.'] = w.oib;
                                        if (exportColumns.evidencijskiBroj) row['Evidencijski broj'] = w.evidencijskiBroj;
                                        if (exportColumns.datumRodenja) row['Datum rođenja'] = w.datumRodenja ? formatDate(w.datumRodenja) : '';
                                        if (exportColumns.miestoRodenja) row['Mjesto rođenja'] = w.miestoRodenja || w.miestoRodenja_;
                                        if (exportColumns.spol) row['Spol'] = w.spol;
                                        if (exportColumns.zivotnaDob) row['Životna dob'] = w.zivotnaDob;
                                        if (exportColumns.orgJedinicaId) row['Organizacijska jedinica'] = getOrgUnitName(w.orgJedinicaId);
                                        if (exportColumns.radnoMjestoId) row['Radno mjesto'] = getWorkplaceName(w.radnoMjestoId);
                                        if (exportColumns.lokacija) row['Lokacija'] = w.lokacija;
                                        if (exportColumns.datumZaposlenja) row['Datum zaposlenja'] = w.datumZaposlenja ? formatDate(w.datumZaposlenja) : '';
                                        if (exportColumns.datumOdlaska) row['Datum odlaska'] = w.datumOdlaska ? formatDate(w.datumOdlaska) : '';
                                        if (exportColumns.stazDoDolaska) row['Staž do dolaska'] = w.stazDoDolaska;
                                        if (exportColumns.ukupniStaz) row['Ukupni radni staž'] = w.ukupniStaz;
                                        if (exportColumns.koef) row['Koeficijent'] = w.koef;
                                        if (exportColumns.ulica) row['Ulica'] = w.ulica;
                                        if (exportColumns.kucniBroj) row['Kućni broj'] = w.kucniBroj;
                                        if (exportColumns.mjestoId) row['Mjesto'] = places.find(p => p.id === w.mjestoId)?.naziv || '';
                                        if (exportColumns.opcina) row['Općina'] = w.opcina;
                                        if (exportColumns.telefonTvrtki) row['Telefon (Firma)'] = w.telefonTvrtki;
                                        if (exportColumns.mobitel) row['Mobitel'] = w.mobitel;
                                        if (exportColumns.email) row['Email'] = w.email;
                                        if (exportColumns.napomena) row['Napomena'] = w.napomena;
                                        if (exportColumns.vanjskiSuradnik) row['Vanjski saradnik'] = w.vanjskiSuradnik ? 'DA' : 'NE';
                                        if (exportColumns.aktivan) row['Status'] = w.aktivan ? 'Aktivan' : 'Bivši radnik';

                                        if (exportColumns.uvjerenja) {
                                            const wCerts = allCerts.filter(cx => cx.workerId === w.id);
                                            row['Uvjerenja ZNR'] = wCerts.length > 0 ? wCerts.map(cx => cx.oznaka || cx.ime).join(', ') : '';
                                        }
                                        if (exportColumns.ljekarski) {
                                            const wMed = allMedExamsList.filter(mx => mx.workerId === w.id);
                                            row['Ljekarski pregledi'] = wMed.length > 0 ? wMed.map(mx => mx.tipPregleda || 'Pregled').join(', ') : '';
                                        }
                                        if (exportColumns.ozo) {
                                            const wPpe = allPpeList.filter(px => px.workerId === w.id);
                                            row['Zadužena Oprema/OZO'] = wPpe.length > 0 ? wPpe.map(px => px.naziv + (px.kolicina > 1 ? ` (x${px.kolicina})` : '')).join(', ') : '';
                                        }

                                        return row;
                                    });
                                    const ws = XLSX.utils.json_to_sheet(dataRows);

                                    const colWidths = Object.keys(dataRows[0] || {}).map(key => ({
                                        wch: Math.max(key.length, ...dataRows.map(row => (row[key] || '').toString().length)) + 2
                                    }));
                                    ws['!cols'] = colWidths;

                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, "Lista radnika");
                                    XLSX.writeFile(wb, `Lista_radnika_${formatDate(new Date())}.xlsx`);
                                    setShowExportModal(false);
                                }}>⬇️ {lang === 'bs' ? 'Preuzmi Excel' : 'Download Excel'}</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {/* Toolbar */}
                        <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                            <button className="btn btn-primary btn-sm" style={{ height: 38, padding: '0 16px', flexShrink: 0 }} onClick={handleNew}>
                                + {lang === 'bs' ? 'Novi radnik' : 'New worker'}
                            </button>

                            <div className="search-bar" style={{ height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                                <input
                                    placeholder={lang === 'bs' ? 'Pretraži radnike...' : 'Search workers...'}
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%', minWidth: 0 }}
                                />
                                {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>}
                            </div>

                            <select
                                className="form-select"
                                style={{ height: 38, padding: '0 12px', width: 112, flexShrink: 0, fontSize: '0.85rem' }}
                                value={filterOrgUnit}
                                onChange={(e) => { setFilterOrgUnit(e.target.value); setPage(1); }}
                            >
                                <option value="">{lang === 'bs' ? 'Svi odjeli' : 'All Departments'}</option>
                                {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                            </select>

                            <PDFExportButton
                                label={lang === 'bs' ? '📄 PDF Izvještaj' : '📄 PDF Report'}
                                buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }}
                                options={[
                                    { label: lang === 'bs' ? 'Svi radnici' : 'All workers', icon: '👷', onClick: () => generateWorkersReport(sortedWorkers.map(w => w.id), lang) },
                                    ...(selectedIds.size > 0 ? [{ label: lang === 'bs' ? `Odabrani (${selectedIds.size})` : `Selected (${selectedIds.size})`, icon: '✓', onClick: () => generateWorkersReport(sortedWorkers.filter(w => selectedIds.has(w.id)).map(w => w.id), lang) }] : [])
                                ]}
                            />
                            <PDFExportButton
                                label={lang === 'bs' ? '📊 Excel' : '📊 Excel'}
                                buttonStyle={{ background: '#107c41', color: 'white', borderColor: '#107c41', height: 38 }}
                                options={[
                                    { label: lang === 'bs' ? 'Svi radnici' : 'All workers', icon: '👷', onClick: () => setExcelExportMode('all') },
                                    ...(selectedIds.size > 0 ? [{ label: lang === 'bs' ? `Odabrani (${selectedIds.size})` : `Selected (${selectedIds.size})`, icon: '✓', onClick: () => setExcelExportMode('selected') }] : [])
                                ]}
                            />

                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-light)', cursor: 'pointer', flexShrink: 0 }}>
                                <input type="checkbox" checked={showFormer} onChange={(e) => setShowFormer(e.target.checked)} />
                                {t('formerWorkers')}
                            </label>

                            {selectedIds.size > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'rgba(0,191,166,0.06)', borderRadius: 20, border: '1px solid rgba(0,191,166,0.3)', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                                        {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'}
                                    </span>
                                    <button className="btn btn-sm" style={{ background: 'var(--primary)', color: 'white', border: 'none', height: 26, padding: '0 8px', fontSize: '0.75rem' }} onClick={() => {
                                        const selectedWorkers = selectedIds.size > 0 ? workers.filter(w => selectedIds.has(w.id)) : filteredWorkers;
                                        const emails = selectedWorkers.map(w => w.email).filter(Boolean);
                                        if (emails.length === 0) {
                                            alert(lang === 'bs' ? 'Odabrani radnici nemaju e-mail adrese!' : 'Selected workers have no email addresses!');
                                            return;
                                        }
                                        const subject = encodeURIComponent(lang === 'bs' ? 'Obavijest' : 'Notification');
                                        window.open(`mailto:${emails.join(';')}?subject=${subject}`, '_blank');
                                    }}>
                                        ✉️ Email
                                    </button>
                                    <button className="btn btn-sm" style={{ background: '#D32F2F', color: 'white', border: 'none', height: 26, padding: '0 8px', fontSize: '0.75rem' }} onClick={async () => {
                                        const ok = await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} radnika? Ova radnja je nepovratna!` : `Delete ${selectedIds.size} workers? This cannot be undone!`);
                                        if (ok) {
                                            removeManyWorkersCascade([...selectedIds]);
                                            setSelectedIds(new Set());
                                            loadData();
                                        }
                                    }}>
                                        🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}
                                    </button>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }} onClick={() => setSelectedIds(new Set())} title={lang === 'bs' ? 'Poništi odabir' : 'Clear selection'}>
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Table */}
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center' }} title={allPageSelected ? (lang === 'bs' ? 'Odznači sve' : 'Deselect all') : (lang === 'bs' ? 'Odaberi sve na stranici' : 'Select all on page')}>
                                            <input
                                                type="checkbox"
                                                checked={allPageSelected}
                                                ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                                                onChange={toggleSelectAll}
                                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                                            />
                                        </th>
                                        <th style={{ width: 100 }}>{t('actions')}</th>
                                        <th style={tsW('ime')} onClick={() => tW('ime')}>{t('workerName')}{siW('ime')}</th>
                                        <th style={tsW('prezime')} onClick={() => tW('prezime')}>{t('workerSurname')}{siW('prezime')}</th>
                                        <th>{t('oib')}</th>
                                        <th style={tsW('orgJedinicaId')} onClick={() => tW('orgJedinicaId')}>{t('orgUnit')}{siW('orgJedinicaId')}</th>
                                        <th style={tsW('radnoMjestoId')} onClick={() => tW('radnoMjestoId')}>{t('workplace')}{siW('radnoMjestoId')}</th>
                                        <th style={{ width: 140, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Status ZNR/MBR' : 'Status'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedWorkers.length === 0 ? (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    ) : (
                                        pagedWorkers.map((w) => (
                                            <tr key={w.id} style={{ background: selectedIds.has(w.id) ? 'rgba(0,191,166,0.06)' : undefined }}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(w.id)}
                                                        onChange={() => toggleOne(w.id)}
                                                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                                                    />
                                                </td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                            onClick={() => handleEdit(w)}>▶</button>
                                                        <button className="btn btn-primary btn-sm" onClick={e => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const spaceBelow = window.innerHeight - rect.bottom;
                                                            const spaceAbove = rect.top;
                                                            const flipUp = spaceBelow < 340 && spaceAbove > spaceBelow;
                                                            setMenuPos(flipUp
                                                                ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                                                                : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                                                            );
                                                            setActionMenuId(actionMenuId === w.id ? null : w.id);
                                                        }}>
                                                            {t('actions')} ▼
                                                        </button>
                                                    </div>
                                                    {actionMenuId === w.id && createPortal(
                                                        <>
                                                            <div onClick={() => setActionMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                                                            <div style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 240, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                                        {w.ime} {w.prezime}
                                                                    </span>
                                                                    <button onClick={() => setActionMenuId(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                                                                </div>
                                                                <button style={_miSt} onClick={() => handleEdit(w)}>📂 {t('open')}</button>
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                <button style={_miSt} onClick={() => router.push(`/dashboard/worker-certificates/create?workerId=${w.id}&returnTo=${encodeURIComponent('/dashboard/workers')}`)}>📄 {lang === 'bs' ? 'Novo uvjerenje' : 'New cert'}</button>
                                                                <button style={_miSt} onClick={() => router.push(`/dashboard/medical-exams?openNew=1&workerId=${w.id}&returnTo=${encodeURIComponent('/dashboard/workers')}`)}>👨‍⚕️ {lang === 'bs' ? 'Novi pregled' : 'New exam'}</button>
                                                                <button style={_miSt} onClick={() => router.push(`/dashboard/injuries?openNew=1&workerId=${w.id}&returnTo=${encodeURIComponent('/dashboard/workers')}`)}>🚑 {lang === 'bs' ? 'Nova povreda' : 'New injury'}</button>
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                <button style={_miSt} onClick={() => router.push('/dashboard/form-ro1')}>📄 RO-1</button>
                                                                <button style={_miSt} onClick={() => router.push('/dashboard/form-ro2')}>📄 RO-2</button>
                                                                <button style={_miSt} onClick={() => router.push('/dashboard/referral-ra1')}>📄 RA-1</button>
                                                                <button style={_miSt} onClick={() => { setUploadingDocForWorker(w.id); zosUploadRef.current?.click(); }}>📥 Zapisnik ZOS (Upload)</button>
                                                                <button style={_miSt} onClick={() => { setUploadingDocForWorker(w.id); zopUploadRef.current?.click(); }}>📥 Zapisnik ZOP (Upload)</button>
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                {/* Isprintaj — only shows actual uploaded/created documents */}
                                                                {(() => {
                                                                    const wCerts = getAll(COLLECTIONS.CERTIFICATES).filter(c => c.workerId === w.id);
                                                                    const docsWithFiles = wCerts.filter(c => c.docData || c.fileData || c.attachedFileData);
                                                                    if (docsWithFiles.length === 0) return null;
                                                                    return docsWithFiles.map(doc => (
                                                                        <button key={doc.id} style={_miSt} onClick={() => {
                                                                            setActionMenuId(null);
                                                                            const data = doc.docData || doc.fileData || doc.attachedFileData;
                                                                            const name = doc.docName || doc.fileName || doc.attachedFileName || doc.ime || 'Dokument';
                                                                            if (data) {
                                                                                const isPdf = data.startsWith('data:application/pdf');
                                                                                const isImg = data.startsWith('data:image/');
                                                                                if (isPdf || isImg) {
                                                                                    const win = window.open('');
                                                                                    if (win) {
                                                                                        win.document.write(`<html><head><title>${name}</title></head><body style="margin:0"><iframe src="${data}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
                                                                                        win.document.close();
                                                                                        setTimeout(() => win.print(), 500);
                                                                                    }
                                                                                } else {
                                                                                    const a = document.createElement('a');
                                                                                    a.href = data;
                                                                                    a.download = name;
                                                                                    a.click();
                                                                                }
                                                                            }
                                                                        }}>
                                                                            🖨️ {lang === 'bs' ? 'Isprintaj' : 'Print'}: {doc.docName || doc.fileName || doc.attachedFileName || doc.ime || 'Dokument'}
                                                                        </button>
                                                                    ));
                                                                })()}
                                                                {/* Generate & print ZOS PDF */}
                                                                {(() => {
                                                                    const wCerts = getAll(COLLECTIONS.CERTIFICATES).filter(c => c.workerId === w.id);
                                                                    const zosCerts = wCerts.filter(c => (c.ime || '').toLowerCase().includes('zapisnik o ocjeni'));
                                                                    if (zosCerts.length === 0) return null;
                                                                    return (
                                                                        <button style={_miSt} onClick={() => {
                                                                            setActionMenuId(null);
                                                                            printZosPdf(w, zosCerts[0], { orgUnits, workplaces });
                                                                        }}>
                                                                            🖨️ {lang === 'bs' ? 'Isprintaj ZOS' : 'Print ZOS'}
                                                                        </button>
                                                                    );
                                                                })()}
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                <button style={_miSt} onClick={() => { setActionMenuId(null); handleEdit(w); setTimeout(() => { setFullFormTab('dokumenti'); }, 100); }}>\ud83d\udcc1 {lang === 'bs' ? 'Dokumenti' : 'Documents'}</button>
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                <button style={{ ..._miSt, color: 'var(--danger)' }} onClick={() => handleDelete(w.id)}>🗑️ {t('delete')}</button>
                                                            </div>
                                                        </>,
                                                        document.body
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>
                                                    <button
                                                        onClick={() => setViewWorkerId(w.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                                                        title={lang === 'bs' ? 'Klikni za pregled profila' : 'Click to view profile'}
                                                    >{w.ime}</button>
                                                </td>
                                                <td style={{ fontWeight: 600 }}>
                                                    <button
                                                        onClick={() => setViewWorkerId(w.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}
                                                        title={lang === 'bs' ? 'Klikni za pregled profila' : 'Click to view profile'}
                                                    >{w.prezime}</button>
                                                </td>
                                                <td><code style={{ fontSize: '0.85rem' }}>{w.oib || w.jmbg}</code></td>
                                                <td>
                                                    {w.orgJedinicaId ? (
                                                        <button onClick={() => router.push('/dashboard/org-units')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.82rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid' }} title={lang === 'bs' ? 'Otvori organizacijsku jedinicu' : 'Open org unit'}>
                                                            {getOrgUnitName(w.orgJedinicaId)}
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {w.radnoMjestoId ? (
                                                        <button onClick={() => router.push('/dashboard/workplaces')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.82rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid' }} title={lang === 'bs' ? 'Otvori radno mjesto' : 'Open workplace'}>
                                                            {getWorkplaceName(w.radnoMjestoId)}
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                    {(() => {
                                                        const _today = new Date();
                                                        const _wC = allCerts.filter(cx => cx.workerId === w.id);
                                                        const _wM = allMedExamsList.filter(mx => mx.workerId === w.id);
                                                        const _expC = _wC.some(cx => cx.vrijediDo && new Date(cx.vrijediDo) < _today);
                                                        const _soonC = _wC.some(cx => { if (!cx.vrijediDo) return false; const d = (new Date(cx.vrijediDo) - _today) / 86400000; return d >= 0 && d <= 30; });
                                                        const _expM = _wM.some(mx => mx.vrijediDo && new Date(mx.vrijediDo) < _today);
                                                        const _soonM = _wM.some(mx => { if (!mx.vrijediDo) return false; const d = (new Date(mx.vrijediDo) - _today) / 86400000; return d >= 0 && d <= 60; });

                                                        let badgeCls = 'badge-success';
                                                        let badgeTxt = lang === 'bs' ? 'U redu' : 'Ok';

                                                        if (_expC || _expM) {
                                                            badgeCls = 'badge-danger';
                                                            badgeTxt = lang === 'bs' ? 'Isteklo!' : 'Expired!';
                                                        } else if (_soonC || _soonM) {
                                                            badgeCls = 'badge-warning';
                                                            badgeTxt = lang === 'bs' ? 'Uskoro ističe' : 'Expiring soon';
                                                        } else if (_wC.length === 0) {
                                                            badgeCls = '';
                                                            badgeTxt = lang === 'bs' ? 'Nema podataka' : 'No data';
                                                        }

                                                        return <span className={`badge ${badgeCls}`} style={{ width: '100px', display: 'inline-flex', justifyContent: 'center' }}>{badgeTxt}</span>;
                                                    })()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="pagination" style={{ padding: '16px' }}>
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
                        initialTab={viewWorkerInitialTab}
                        onClose={() => { setViewWorkerId(null); setViewWorkerInitialTab(null); openWorkerHandledRef.current = null; }}
                        onSaved={() => { loadData(); setViewWorkerId(null); setViewWorkerInitialTab(null); openWorkerHandledRef.current = null; }}
                        onOpenFull={() => {
                            const found = workers.find(x => x.id === viewWorkerId);
                            setViewWorkerId(null);
                            setViewWorkerInitialTab(null);
                            if (found) {
                                openWorkerHandledRef.current = viewWorkerId;
                                openedViaUrlRef.current = true;
                                handleEdit(found);
                                const url = new URL(window.location);
                                url.searchParams.set('openWorker', viewWorkerId);
                                window.history.pushState(null, '', url.toString());
                            }
                        }}
                    />
                )
            }
        </>
    );
}



export default function WorkersPage() {
    return (
        <Suspense fallback={null}>
            <WorkersPageInner />
        </Suspense>
    );
}

