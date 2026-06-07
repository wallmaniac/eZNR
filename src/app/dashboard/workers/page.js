'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
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
import { usePagination } from '@/hooks/usePagination';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useDialog } from '@/hooks/useDialog';
import * as XLSX from 'xlsx';
import { fmtDate, matchesSearch } from '@/lib/dateUtils';
import { isoToDisplay, displayToISO, DateField, Field, SelectField, InfoTip, StazPicker, Accordion, TimePicker } from '@/components/forms/WorkerFormFields';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import TabBar from '@/components/TabBar';

const EXPORT_TRANSLATIONS = {
    bs: {
        sheetName: 'Lista radnika',
        fileName: 'Lista_radnika',
        ime: 'Ime',
        prezime: 'Prezime',
        imeRoditelja: 'Ime roditelja',
        jmbg: 'JMBG',
        oib: 'OIB/Osobni br.',
        oibLbl: 'OIB',
        evidencijskiBroj: 'Evidencijski broj',
        evidencijskiBrojLbl: 'Evid. br.',
        datumRodenja: 'Datum rođenja',
        miestoRodenja: 'Mjesto rođenja',
        spol: 'Spol',
        zivotnaDob: 'Životna dob',
        orgJedinicaId: 'Organizacijska jedinica',
        orgJedinicaIdLbl: 'Organizacijska jed.',
        radnoMjestoId: 'Radno mjesto',
        lokacija: 'Lokacija',
        datumZaposlenja: 'Datum zaposlenja',
        datumZaposlenjaLbl: 'Datum zapošlj.',
        stazDoDolaska: 'Staž do dolaska',
        datumOdlaska: 'Datum odlaska',
        ukupniStaz: 'Ukupni radni staž',
        ukupniStazLbl: 'Ukupni staž',
        koef: 'Koeficijent',
        ulica: 'Ulica',
        kucniBroj: 'Kućni broj',
        mjestoId: 'Mjesto',
        opcina: 'Općina',
        telefonTvrtki: 'Telefon (Firma)',
        telefonTvrtkiLbl: 'Tel (Firma)',
        mobitel: 'Mobitel',
        email: 'Email',
        napomena: 'Napomena',
        vanjskiSuradnik: 'Vanjski saradnik',
        aktivan: 'Status',
        aktivanLbl: 'Status (Aktivan)',
        uvjerenja: 'Uvjerenja ZNR',
        uvjerenjaLbl: 'Uvjerenja ZNR..',
        ljekarski: 'Ljekarski pregledi',
        ozo: 'Zadužena Oprema/OZO',
        ozoLbl: 'Zadužena OZO',
        yes: 'DA',
        no: 'NE',
        active: 'Aktivan',
        former: 'Bivši radnik'
    },
    hr: {
        sheetName: 'Popis radnika',
        fileName: 'Popis_radnika',
        ime: 'Ime',
        prezime: 'Prezime',
        imeRoditelja: 'Ime roditelja',
        jmbg: 'JMBG',
        oib: 'OIB/Osobni br.',
        oibLbl: 'OIB',
        evidencijskiBroj: 'Evidencijski broj',
        evidencijskiBrojLbl: 'Evid. br.',
        datumRodenja: 'Datum rođenja',
        miestoRodenja: 'Mjesto rođenja',
        spol: 'Spol',
        zivotnaDob: 'Životna dob',
        orgJedinicaId: 'Organizacijska jedinica',
        orgJedinicaIdLbl: 'Organizacijska jed.',
        radnoMjestoId: 'Radno mjesto',
        lokacija: 'Lokacija',
        datumZaposlenja: 'Datum zaposlenja',
        datumZaposlenjaLbl: 'Datum zapošlj.',
        stazDoDolaska: 'Staž do dolaska',
        datumOdlaska: 'Datum odlaska',
        ukupniStaz: 'Ukupni radni staž',
        ukupniStazLbl: 'Ukupni staž',
        koef: 'Koeficijent',
        ulica: 'Ulica',
        kucniBroj: 'Kućni broj',
        mjestoId: 'Mjesto',
        opcina: 'Općina',
        telefonTvrtki: 'Telefon (Tvrtka)',
        telefonTvrtkiLbl: 'Tel (Firma)',
        mobitel: 'Mobitel',
        email: 'Email',
        napomena: 'Napomena',
        vanjskiSuradnik: 'Vanjski suradnik',
        aktivan: 'Status',
        aktivanLbl: 'Status (Aktivan)',
        uvjerenja: 'Uvjerenja ZNR',
        uvjerenjaLbl: 'Uvjerenja ZNR..',
        ljekarski: 'Lječnički pregledi',
        ozo: 'Zadužena Oprema/OZO',
        ozoLbl: 'Zadužena OZO',
        yes: 'DA',
        no: 'NE',
        active: 'Aktivan',
        former: 'Bivši radnik'
    },
    sr: {
        sheetName: 'Lista radnika',
        fileName: 'Lista_radnika',
        ime: 'Ime',
        prezime: 'Prezime',
        imeRoditelja: 'Ime roditelja',
        jmbg: 'JMBG',
        oib: 'OIB/Lični br.',
        oibLbl: 'OIB',
        evidencijskiBroj: 'Evidencijski broj',
        evidencijskiBrojLbl: 'Evid. br.',
        datumRodenja: 'Datum rođenja',
        miestoRodenja: 'Mjesto rođenja',
        spol: 'Pol',
        zivotnaDob: 'Životna dob',
        orgJedinicaId: 'Organizacijska jedinica',
        orgJedinicaIdLbl: 'Organizacijska jed.',
        radnoMjestoId: 'Radno mjesto',
        lokacija: 'Lokacija',
        datumZaposlenja: 'Datum zaposenja',
        datumZaposlenjaLbl: 'Datum zapošlj.',
        stazDoDolaska: 'Staž do dolaska',
        datumOdlaska: 'Datum odlaska',
        ukupniStaz: 'Ukupni radni staž',
        ukupniStazLbl: 'Ukupni staž',
        koef: 'Koeficijent',
        ulica: 'Ulica',
        kucniBroj: 'Kućni broj',
        mjestoId: 'Mjesto',
        opcina: 'Opština',
        telefonTvrtki: 'Telefon (Firma)',
        telefonTvrtkiLbl: 'Tel (Firma)',
        mobitel: 'Mobitel',
        email: 'Email',
        napomena: 'Napomena',
        vanjskiSuradnik: 'Spoljni saradnik',
        aktivan: 'Status',
        aktivanLbl: 'Status (Aktivan)',
        uvjerenja: 'Uvjerenja ZNR',
        uvjerenjaLbl: 'Uvjerenja ZNR..',
        ljekarski: 'Ljekarski pregledi',
        ozo: 'Zadužena oprema/OZO',
        ozoLbl: 'Zadužena OZO',
        yes: 'DA',
        no: 'NE',
        active: 'Aktivan',
        former: 'Bivši radnik'
    },
    en: {
        sheetName: 'Worker List',
        fileName: 'Worker_List',
        ime: 'First Name',
        prezime: 'Last Name',
        imeRoditelja: 'Parent Name',
        jmbg: 'ID Number (JMBG)',
        oib: 'Personal ID (OIB)',
        oibLbl: 'OIB',
        evidencijskiBroj: 'Record Number',
        evidencijskiBrojLbl: 'Record No.',
        datumRodenja: 'Date of Birth',
        miestoRodenja: 'Place of Birth',
        spol: 'Gender',
        zivotnaDob: 'Age',
        orgJedinicaId: 'Organizational Unit',
        orgJedinicaIdLbl: 'Org. Unit',
        radnoMjestoId: 'Workplace',
        lokacija: 'Location',
        datumZaposlenja: 'Employment Date',
        datumZaposlenjaLbl: 'Employment Date',
        stazDoDolaska: 'Experience Prior to Hire',
        datumOdlaska: 'Termination Date',
        ukupniStaz: 'Total Work Experience',
        ukupniStazLbl: 'Total Experience',
        koef: 'Coefficient',
        ulica: 'Street',
        kucniBroj: 'House Number',
        mjestoId: 'City',
        opcina: 'Municipality',
        telefonTvrtki: 'Phone (Company)',
        telefonTvrtkiLbl: 'Tel (Company)',
        mobitel: 'Mobile',
        email: 'Email',
        napomena: 'Note',
        vanjskiSuradnik: 'External Associate',
        aktivan: 'Status',
        aktivanLbl: 'Status (Active)',
        uvjerenja: 'ZNR Certificates',
        uvjerenjaLbl: 'ZNR Certificates',
        ljekarski: 'Medical Exams',
        ozo: 'Assigned PPE',
        ozoLbl: 'Assigned PPE',
        yes: 'YES',
        no: 'NO',
        active: 'Active',
        former: 'Former Worker'
    },
    de: {
        sheetName: 'Mitarbeiterliste',
        fileName: 'Mitarbeiterliste',
        ime: 'Vorname',
        prezime: 'Nachname',
        imeRoditelja: 'Elternteil Name',
        jmbg: 'Identifikationsnummer (JMBG)',
        oib: 'Persönliche ID (OIB)',
        oibLbl: 'OIB',
        evidencijskiBroj: 'Registrierungsnummer',
        evidencijskiBrojLbl: 'Reg.-Nr.',
        datumRodenja: 'Geburtsdatum',
        miestoRodenja: 'Geburtsort',
        spol: 'Geschlecht',
        zivotnaDob: 'Alter',
        orgJedinicaId: 'Organisationseinheit',
        orgJedinicaIdLbl: 'Org.-Einheit',
        radnoMjestoId: 'Arbeitsplatz',
        lokacija: 'Standort',
        datumZaposlenja: 'Einstellungsdatum',
        datumZaposlenjaLbl: 'Einstellungsdatum',
        stazDoDolaska: 'Dienstzeit vor Eintritt',
        datumOdlaska: 'Austrittsdatum',
        ukupniStaz: 'Gesamte Berufserfahrung',
        ukupniStazLbl: 'Gesamte Dienstzeit',
        koef: 'Koeffizient',
        ulica: 'Straße',
        kucniBroj: 'Hausnummer',
        mjestoId: 'Ort',
        opcina: 'Gemeinde',
        telefonTvrtki: 'Telefon (Firma)',
        telefonTvrtkiLbl: 'Tel. (Firma)',
        mobitel: 'Mobiltelefon',
        email: 'E-Mail',
        napomena: 'Anmerkung',
        vanjskiSuradnik: 'Externer Mitarbeiter',
        aktivan: 'Status',
        aktivanLbl: 'Status (Aktiv)',
        uvjerenja: 'ZNR-Zertifikate',
        uvjerenjaLbl: 'ZNR-Zertifikate',
        ljekarski: 'Ärztliche Untersuchungen',
        ozo: 'Zugewiesene PSA',
        ozoLbl: 'Zugewiesene PSA',
        yes: 'JA',
        no: 'NEIN',
        active: 'Aktiv',
        former: 'Ehemaliger Mitarbeiter'
    },
    sl: {
        sheetName: 'Seznam delavcev',
        fileName: 'Seznam_delavcev',
        ime: 'Ime',
        prezime: 'Priimek',
        imeRoditelja: 'Ime starša',
        jmbg: 'EMŠO',
        oib: 'Osebna št. (OIB)',
        oibLbl: 'OIB',
        evidencijskiBroj: 'Evidenčna številka',
        evidencijskiBrojLbl: 'Evidenčna št.',
        datumRodenja: 'Datum rojstva',
        miestoRodenja: 'Kraj rojstva',
        spol: 'Spol',
        zivotnaDob: 'Starost',
        orgJedinicaId: 'Organizacijska enota',
        orgJedinicaIdLbl: 'Org. enota',
        radnoMjestoId: 'Delovno mesto',
        lokacija: 'Lokacija',
        datumZaposlenja: 'Datum zaposlitve',
        datumZaposlenjaLbl: 'Datum zaposl.',
        stazDoDolaska: 'Delovna doba pred prihodom',
        datumOdlaska: 'Datum odhoda',
        ukupniStaz: 'Skupna delovna doba',
        ukupniStazLbl: 'Skupna del. doba',
        koef: 'Koeficient',
        ulica: 'Ulica',
        kucniBroj: 'Hišna številka',
        mjestoId: 'Kraj',
        opcina: 'Občina',
        telefonTvrtki: 'Telefon (Podjetje)',
        telefonTvrtkiLbl: 'Tel. (Podjetje)',
        mobitel: 'Mobilni telefon',
        email: 'E-pošta',
        napomena: 'Opomba',
        vanjskiSuradnik: 'Zunanji sodelavec',
        aktivan: 'Status',
        aktivanLbl: 'Status (Aktiven)',
        uvjerenja: 'ZNR potrdila',
        uvjerenjaLbl: 'ZNR potrdila',
        ljekarski: 'Zdravniški pregledi',
        ozo: 'Dodeljena OZO',
        ozoLbl: 'Dodeljena OZO',
        yes: 'DA',
        no: 'NE',
        active: 'Aktiven',
        former: 'Bivši delavec'
    }
};

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
    const getExp = useCallback((k) => EXPORT_TRANSLATIONS[lang]?.[k] || EXPORT_TRANSLATIONS.bs[k] || k, [lang]);
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
    
    const [viewWorkerId, setViewWorkerId] = useState(null);
    const [viewWorkerInitialTab, setViewWorkerInitialTab] = useState(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastEditedId, setLastEditedId] = useState(null);
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
            alert(t('documentSuccessfullyAddedFor').replace('{0}', w?.ime).replace('{1}', w?.prezime));
        } catch (err) {
            console.error(err);
            alert(t('greskaPriUcitavanjuDatoteke'));
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
        dd += pd; if (dd>= 30) { mm++; dd -= 30; }
        mm += pm; if (mm>= 12) { yy++; mm -= 12; }
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
        const retPath = searchParams?.get('returnTo');
        if (retPath) setReturnPath(retPath);
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

    useEffect(() => {
        if (showForm && typeof window !== 'undefined') {
            window.scrollTo(0, 0);
        }
    }, [showForm]);

    const filteredWorkers = useMemo(() => {
        return workers.filter(w => {
            const matchSearch = !searchTerm || matchesSearch(
                `${w.ime} ${w.prezime} ${w.jmbg} ${w.oib} ${w.identBroj || ''} ${w.datumRodenja || ''} ${w.datumZaposlenja || ''} ${w.datumOdlaska || ''}`,
                searchTerm
            );
            const matchStatus = showFormer ? !w.aktivan : w.aktivan;
            const matchOrgUnit = !filterOrgUnit || w.orgJedinicaId === filterOrgUnit || w.orgJedinica === filterOrgUnit;
            return matchSearch && matchStatus && matchOrgUnit;
        });
    }, [workers, searchTerm, showFormer, filterOrgUnit]);

    const { sorted: sortedWorkers, toggleSort: tW, sortIcon: siW, thStyle: tsW } = useSortedList(filteredWorkers, 'prezime');
    const { page, perPage, setPage, setPerPage, totalPages, pagedData: pagedWorkers, totalItems, nextPage, prevPage } = usePagination(sortedWorkers, 10);

    // ── Selection helpers ──
    const pagedIds = pagedWorkers.map(w => w.id);
    const allPageSelected = pagedIds.length> 0 && pagedIds.every(id => selectedIds.has(id));
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
            if (diffDays> expiringSoonDays || diffDays < 0) return false;
        }
        if (!certSearch) return true;
        const q = certSearch.toLowerCase();
        return (c.oznaka || '').toLowerCase().includes(q) || (c.ime || '').toLowerCase().includes(q) || (c.tipUvjerenja || '').toLowerCase().includes(q);
    });

    // Save certificate
    const handleSaveCert = async () => {
        if (!certFormData.oznaka || !certFormData.ime) { await alert(t('oznakaINazivSuObavezni')); return; }
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
        if (!ppeFormData.naziv) { await alert(t('nazivJeObavezan')); return; }
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
        setLastEditedId(null);
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
        const ok = await confirm(t('jesteLiSigurniDaZelite'));
        if (ok) {
            removeWorkerCascade(id);
            setActionMenuId(null);
            loadData();
            if (typeof window !== 'undefined' && window.eznrToast) {
                window.eznrToast(t('radnikObrisan'), 'info');
            }
        }
    };

    const handleSave = async (addNew = false) => {
        if (!formData.ime || !formData.prezime) {
            await alert(t('imeIPrezimeSuObavezna'));
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
        setLastEditedId(savedId);

        // Keep formData in sync with the new cloud URL
        setFormData(finalFormData);

        loadData();
        const wasDirty = contextIsDirty;
        markClean();
        isDirtyRef.current = false;
        // Toast feedback
        if (typeof window !== 'undefined' && window.eznrToast) {
            window.eznrToast(t('workerSaved').replace('{0}', finalFormData.ime).replace('{1}', finalFormData.prezime), 'success');
        }
        // Clear refs BEFORE state changes so the openWorker watcher never re-fires
        openWorkerHandledRef.current = null;
        openedViaUrlRef.current = false;
        if (addNew) {
            if (typeof window !== 'undefined' && wasDirty) {
                window.history.go(-1);
            }
            setFormData({ ...emptyWorker });
            setEditingWorker(null);
            editingWorkerRef.current = null;
            setCertificates([]);
            setPpeAssign([]);
        } else {
            if (typeof window !== 'undefined') {
                if (wasDirty) {
                    window.history.go(-2);
                } else {
                    window.history.go(-1);
                }
            } else {
                setShowForm(false);
            }
        }
        setSelectedIds(new Set());
        return savedId;
    };

    const handleCancel = (skipHistoryBack = false) => {
        markClean();
        isDirtyRef.current = false;
        openWorkerHandledRef.current = null;
        openedViaUrlRef.current = false;
        if (editingWorker) setLastEditedId(editingWorker);
        setEditingWorker(null);
        setShowForm(false);
        if (returnPath) {
            const path = returnPath;
            setReturnPath(null);
            router.push(path);
        } else if (!skipHistoryBack && typeof window !== 'undefined') {
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
                    title={editingWorker ? (t('urediRadnika')) : (t('noviRadnik'))} 
                    backBtn={{ onClick: handleBack, label: t('radnici') }} 
                />
                <DialogRenderer />

                {/* ── Tab Bar ── */}
                <div style={{ marginBottom: 20 }}>
                    <TabBar active={fullFormTab} onChange={setFullFormTab} 
                        tabs={[
                            { key: 'osnovno', icon: '👤', label: t('osnovno') },
                            { key: 'uvjerenja', icon: '📜', label: `${t('uvjerenja')} (${certificates.length})` },
                            { key: 'ozo', icon: '🦺', label: `OZO (${ppeAssign.length})` },
                            { key: 'pregledi', icon: '👨‍⚕️', label: `${t('pregledi')} (${workerMedExams.length})` },
                            { key: 'dokumenti', icon: '📁', label: `${t('dokumenti1')} (${(formData.dokumenti || []).length})` },
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
                                    <InfoTip text={t('automatskiSeRacunaNaOsnovu')} />
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
                                    <InfoTip text={t('automatskiSeRacunaStazDo')} />
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
                            <TimePicker label={t('radnoVrijemeOd')} value={formData.radnoVrijemeOd} onChange={v => updateField('radnoVrijemeOd', v)} />
                            <TimePicker label={t('radnoVrijemeDo')} value={formData.radnoVrijemeDo} onChange={v => updateField('radnoVrijemeDo', v)} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <SelectField label={t('workplace')} value={formData.radnoMjestoId} onChange={async (v) => {
                                const oldId = formData.radnoMjestoId;
                                updateField('radnoMjestoId', v);
                                // Auto-invalidate ZOS when Radno mjesto changes (jurisdiction-aware, see lawConfig.js)
                                if (editingWorker && oldId && v && oldId !== v) {
                                    const allCerts = getWorkerCertificates(editingWorker);
                                    const zosCerts = allCerts.filter(c =>
                                        (c.ime || '').toLowerCase().includes('zapisnik o ocjeni osposobljenosti') &&
                                        c.sposobnost !== 'Nevažeće'
                                    );
                                    if (zosCerts.length> 0) {
                                        const oldWpName = getWorkplaceName(oldId);
                                        const newWpName = getWorkplaceName(v);
                                        const ok = await confirm(t('workplaceChangeRequiresNewTrainingnn').replace('{0}', oldWpName).replace('{1}', newWpName).replace('{2}', zosCerts.length));
                                        if (ok) {
                                            for (const cert of zosCerts) {
                                                update(COLLECTIONS.CERTIFICATES, cert.id, {
                                                    sposobnost: 'Nevažeće',
                                                    sposoban: false,
                                                    ogranicenja: `${cert.ogranicenja ? cert.ogranicenja + ' | ' : ''}Nevažeće — promjena radnog mjesta sa "${oldWpName}" na "${newWpName}" (${new Date().toLocaleDateString('hr-HR')})`,
                                                });
                                            }
                                            setCertificates(getWorkerCertificates(editingWorker));
                                            await alert(t('zosCertificatesMarkedAsInvalid').replace('{0}', zosCerts.length));
                                        } else {
                                            updateField('radnoMjestoId', oldId); // revert
                                        }
                                    }
                                }
                            }}
                                options={workplaces.map(wp => ({ value: wp.id, label: t(wp.naziv?.trim()) || wp.naziv }))} />
                            <SelectField label={t('orgUnit')} value={formData.orgJedinicaId} onChange={v => updateField('orgJedinicaId', v)}
                                options={orgUnits.map(ou => ({ value: ou.id, label: t(ou.naziv?.trim()) || ou.naziv }))} />
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
                                    <label className="form-label">{t('radnoVrijemeOd')}</label>
                                    <div className="form-input" style={{ cursor: 'not-allowed', background: 'var(--bg-input)', color: 'var(--text)' }}>{_wp.radnoVrijemeOd || '—'}</div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">{t('radnoVrijemeDo')}</label>
                                    <div className="form-input" style={{ cursor: 'not-allowed', background: 'var(--bg-input)', color: 'var(--text)' }}>{_wp.radnoVrijemeDo || '—'}</div>
                                </div>
                            </div>
                        ) : null; })()}

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">{t('dodatniPoslovi')}</label>
                            <textarea className="form-textarea" value={formData.dodatniPoslovi || ''} onChange={e => updateField('dodatniPoslovi', e.target.value)}
                                placeholder={t('opisiteDodatnePosloveIObaveze')} rows={2} />
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
                        if (start> end) return true;
                        if (start < 600 || end>= 2200) return true;
                        return false;
                    };
                    const hasNightShift = (formData.radnoVrijemeOd && formData.radnoVrijemeDo && isNightShift(formData.radnoVrijemeOd, formData.radnoVrijemeDo)) || (wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo));
                    const _t = new Date();
                    const _expC = certificates.filter(cx => cx.vrijediDo && new Date(cx.vrijediDo) < _t).length;
                    const _valC = certificates.filter(cx => !cx.vrijediDo || new Date(cx.vrijediDo)>= _t).length;
                    const _lm = [...workerMedExams].sort((a, b) => (b.datumPregleda || '').localeCompare(a.datumPregleda || ''))[0];
                    const _lmd = _lm?.vrijediDo ? Math.ceil((new Date(_lm.vrijediDo) - _t) / 86400000) : null;
                    const _mc = _lmd === null ? 'none' : _lmd < 0 ? 'expired' : _lmd <= 60 ? 'soon' : 'valid';
                    const _mColor = { expired: 'var(--danger)', soon: 'var(--warning)', valid: 'var(--success)', none: 'var(--text-muted)' }[_mc];
                    return (
                        <>
                            {hasNightShift && (
                                <div style={{ background: 'rgba(239,83,80,0.15)', borderBottom: '1px solid var(--danger)', color: 'var(--danger)', padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    🌙 {t('obavezanLjekarskiPregledNajmanje1x1')}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                                <div onClick={() => { setOpenSections(p => ({ ...p, uvjerenja: true })); uvjerenjaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                    style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: _expC> 0 ? 'rgba(239,68,68,0.07)' : 'rgba(34,197,94,0.06)', border: `1px solid ${_expC> 0 ? 'var(--danger)' : 'var(--success)'}`, display: 'flex', alignItems: 'center', gap: 10, transition: 'filter 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'} onMouseLeave={e => e.currentTarget.style.filter = ''}>
                                    <span style={{ fontSize: '1.4rem' }}>📋</span>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{t('uvjerenja')}</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: _expC> 0 ? 'var(--danger)' : 'var(--success)' }}>{_valC} ✓{_expC> 0 && <span style={{ color: 'var(--danger)', marginLeft: 6 }}> {_expC} ⚠</span>}</div>
                                    </div>
                                </div>
                                <div onClick={() => { setOpenSections(p => ({ ...p, medExams: true })); medExamsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                                    style={{ flex: '1 1 140px', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: _mc === 'expired' ? 'rgba(239,68,68,0.07)' : _mc === 'soon' ? 'rgba(245,158,11,0.07)' : 'rgba(34,197,94,0.05)', border: `1px solid ${_mColor}`, display: 'flex', alignItems: 'center', gap: 10, transition: 'filter 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'} onMouseLeave={e => e.currentTarget.style.filter = ''}>
                                    <span style={{ fontSize: '1.4rem' }}>👨‍⚕️</span>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{t('pregled1')}</div>
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
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: ppeAssign.length> 0 ? 'var(--primary)' : 'var(--text-muted)' }}>{ppeAssign.length} {t('zaduzenja')}</div>
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
                            {t('radnikRadiPodPosebnimUvjetima')}
                        </label>
                    </div>
                    {formData.posebniUvjeti && (
                        <div className="alert alert-warning">
                            ⚠️ {t('zaPozicijeSaPosebnimUvjetima')}
                        </div>
                    )}
                </Accordion>

                {/* ── ACCORDION: Kontakt podaci ── */}
                <Accordion title={t('contactInfo')} open={openSections.kontakt} onToggle={() => toggleSection('kontakt')}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 16, marginBottom: 16 }}>
                        <Field label={t('street')} value={formData.ulica} onChange={v => updateField('ulica', v)} />
                        <Field label={t('houseNumber')} value={formData.kucniBroj} onChange={v => updateField('kucniBroj', v)} />
                        <SelectField label={t('place')} value={formData.mjestoId} onChange={v => updateField('mjestoId', v)}
                            options={places.map(p => ({ value: p.id, label: `${t(p.naziv?.trim()) || p.naziv} (${p.postBroj})` }))} placeholder={t('odaberiteMjesto')} />
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
                                placeholder={t('napomena1')} rows={3} />
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
                                        await alert(t('molimoUnesiteImeIPrezime'));
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
                                {t('isticeU')}
                                <select
                                    value={expiringSoonDays}
                                    onChange={e => setExpiringSoonDays(Number(e.target.value))}
                                    disabled={!showExpiringSoon}
                                    style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', fontSize: '0.78rem', background: 'var(--bg-card)', color: 'var(--text)', cursor: showExpiringSoon ? 'pointer' : 'not-allowed', opacity: showExpiringSoon ? 1 : 0.5 }}>
                                    <option value={30}>30 {t('dana')}</option>
                                    <option value={60}>60 {t('dana')}</option>
                                    <option value={90}>90 {t('dana')}</option>
                                    <option value={180}>180 {t('dana')}</option>
                                </select>
                            </label>
                        </div>
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('actions')}</th>
                                        <th>{t('oznaka')}</th>
                                        <th>{t('date')}</th>
                                        <th>{t('vrijediDo')}</th>
                                        <th>{t('name')}</th>
                                        <th>{t('tipUvjerenja')}</th>
                                        <th>{t('upisao')}</th>
                                        <th>{t('sposobnost')}</th>
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
                                                onClick={() => { markClean(); router.push(`/dashboard/worker-certificates/edit/${c.id}?returnTo=${returnToParam}`); }}>
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
                                                        }}>
                                                        ⚙️ {t('akcije')} ▾
                                                    </button>
                                                    {/* Portal: mount dropdown directly on document.body to escape all CSS transforms */}
                                                    {certMenuId === c.id && typeof document !== 'undefined' && createPortal(
                                                        <div ref={certMenuRef} style={{
                                                            position: 'fixed',
                                                            top: certMenuPos.top,
                                                            left: certMenuPos.left,
                                                            zIndex: 99999, userSelect: 'none', WebkitUserSelect: 'none',
                                                            background: 'var(--bg-card)',
                                                            border: '1px solid var(--border)',
                                                            borderRadius: 'var(--radius-md)',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                                                            minWidth: 230,
                                                            padding: '4px 0 8px 0',
                                                        }}>
                                                            <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                                onClick={() => { setCertMenuId(null); setCertFormData({ ...c }); setCertEditId(c.id); setShowCertForm(true); }}>
                                                                ✏️ <span>{t('brzaIzmjena')}</span>
                                                            </button>
                                                            <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                                onClick={() => { setCertMenuId(null); markClean(); router.push(`/dashboard/worker-certificates/edit/${c.id}?returnTo=${returnToParam}`); }}>
                                                                📄 <span>{t('urediPotpuno')}</span>
                                                            </button>
                                                            <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                                                                onClick={() => { setCertMenuId(null); markClean(); router.push(`/dashboard/worker-certificates/create?copyFrom=${c.id}&returnTo=${returnToParam}`); }}>
                                                                📋 <span>{t('kopirajUvjerenje')}</span>
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
                                                                            printZosPdf({ company: companyFull, worker: wk, workplaceName: wpN, training: { naziv: c.izdanoIzObuke || c.ime }, officer: c.strucnjakZNR || c.upisao || '', date: c.datum || new Date().toISOString(), certOznaka: c.oznaka, testResult: c.rezultatTesta || '' }, lang);
                                                                        }}>
                                                                        🖨️ <span>{t('ispisiZosDokument')}</span>
                                                                    </button>
                                                                </>
                                                            )}
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
                                                            {!c.potpisanScan && (isZNR || isZOP) && (
                                                                <div style={{ padding: '6px 14px', fontSize: '0.72rem', color: 'var(--warning)', background: 'rgba(245,158,11,0.05)', lineHeight: 1.4, borderBottom: '1px solid var(--border-light)' }}>
                                                                    ⚠️ {t('uploadSigned').replace('{0}', isZOP ? 'Test ZOP' : 'Test ZNR').replace('{1}', isZOP ? 'ZOP Test' : 'ZNR Test')}
                                                                </div>
                                                            )}
                                                            <label className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
                                                                📎 <span>{c.potpisanScan ? (t('zamijeniScan')) : (isZNR ? (t('uploadPotpisanTestZnr')) : isZOP ? (t('uploadPotpisanTestZop')) : (t('uploadPotpisanScan')))}</span>
                                                                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={async (e) => {
                                                                    const file = e.target.files?.[0]; if (!file) return;
                                                                    if (file.size> 15000000) { alert(t('max15mb')); return; }
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
                                                                    👁️ <span>{t('prikaziPotpisanDokument')}</span>
                                                                </button>
                                                            )}
                                                            <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
                                                            <button className="btn btn-ghost" style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '0.84rem', borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}
                                                                onClick={async () => { setCertMenuId(null); const ok = await confirm(t('obrisatiUvjerenjeOvaRadnjaJe')); if (ok) { remove(COLLECTIONS.CERTIFICATES, c.id); setCertificates(getWorkerCertificates(editingWorker)); } }}>
                                                                🗑️ <span>{t('obrisiUvjerenje')}</span>
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
                            <button className="btn btn-outline btn-sm" onClick={() => { setPpeFormData({ naziv: '', datumZaduzenja: todayISO(), datumRazduzenja: '' }); setShowPpeForm(true); }}>+ {t('novoZaduzenje')}</button>
                        </div>
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('actions')}</th>
                                        <th>{t('name')}</th>
                                        <th>{t('datumZaduzenja')}</th>
                                        <th>{t('datumRazduzenja')}</th>
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
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={async () => { const ok = await confirm(t('obrisatiZaduzenje')); if (ok) { remove(COLLECTIONS.PPE_ASSIGNMENTS, p.id); setPpeAssign(getWorkerPPE(editingWorker)); } }}>🗑️</button>
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{t(p.naziv?.trim()) || p.naziv}</td>
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
                    <Accordion title={"👨‍⚕️ " + (t('ljekarskiPregledi1'))} open={true} onToggle={() => {}}>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-outline btn-sm" onClick={() => { markClean(); router.push('/dashboard/medical-exams?openNew=1&workerId=' + encodeURIComponent(editingWorker) + '&returnTo=worker'); }}>
                                + {t('noviPregled')}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { if (showMedExamForm) { sessionStorage.setItem('eznr_draft_workers_medexam', JSON.stringify({ workerId: editingWorker, form: medExamForm, editId: medExamEditId })); } markClean(); router.push('/dashboard/referral-ra1?openNew=1'); }}>
                                📋 {t('novaUputnicaRa1')}
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--primary)' }} onClick={() => { markClean(); router.push('/dashboard/medical-exams'); }}>
                                {t('sviPregledi')}
                            </button>
                        </div>
                        {workerMedExams.length === 0 ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                {t('nemaEvidentiranihLjekarskihPregledaZa')}
                            </div>
                        ) : (
                            <div className="data-table-wrapper">
                                <table className="data-table">
                                    <thead><tr>
                                        <th>{t('akcije')}</th>
                                        <th>{t('vrstaPregleda')}</th>
                                        <th>{t('datum')}</th>
                                        <th>{t('naredniPregled')}</th>
                                        <th>{t('rezultat')}</th>
                                        <th>{t('ustanova')}</th>
                                    </tr></thead>
                                    <tbody>
                                        {workerMedExams.sort((a, b) => (b.datumPregleda || '').localeCompare(a.datumPregleda || '')).map(me => {
                                            const days = me.vrijediDo ? Math.ceil((new Date(me.vrijediDo) - new Date()) / 86400000) : null;
                                            const badgeCls = days === null ? '' : days < 0 ? 'badge-danger' : days <= 90 ? 'badge-warning' : 'badge-success';
                                            const badgeLabel = days === null ? (t('bezRoka')) : days < 0 ? (t('isteklo')) : formatDate(me.vrijediDo);
                                            const TMAP = { prethodni: t('prethodniPregled'), 'periodicni': t('periodicniPregled'), vanredni: t('vanredniPregled'), nocniRad: t('pregledNocniRad'), ostalo: t('ostalo') };
                                            const RCOL = { 'Sposoban': 'var(--success)', 'Uvjetno Sposoban': 'var(--warning)', 'Nesposoban': 'var(--danger)' };
                                            const openExamEdit = () => { setMedExamEditId(me.id); setMedExamForm({ tipPregleda: me.tipPregleda || 'prethodni', datumPregleda: me.datumPregleda || '', vrijediDo: me.vrijediDo || '', rezultat: me.rezultat || 'Sposoban', zdravstvenaUstanova: me.zdravstvenaUstanova || '', doktorIme: me.doktorIme || '', ogranicenja: me.ogranicenja || '', uputnicaBroj: me.uputnicaBroj || '' }); setShowMedExamForm(true); };
                                            return (
                                                <tr key={me.id}
                                                    style={{ background: days !== null && days < 0 ? 'rgba(239,68,68,0.04)' : '', cursor: 'pointer' }}
                                                    onClick={openExamEdit}>
                                                    <td onClick={e => e.stopPropagation()}>
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn btn-ghost btn-sm btn-icon" title={t('uredi')} onClick={openExamEdit}>✏️</button>
                                                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={t('obrisi')} onClick={async () => { const ok = await confirm(t('obrisatiPregled')); if (ok) { remove(COLLECTIONS.MEDICAL_EXAMS, me.id); setWorkerMedExams(getAll(COLLECTIONS.MEDICAL_EXAMS).filter(e => e.workerId === editingWorker)); } }}>🗑️</button>
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
                    <Accordion title={`📁 ${t('dokumenti1')}`} open={true} onToggle={() => {}}>
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
                                    workerDocs.push({ id: `wdoc_${i}`, name: d.name || 'Dokument', url: d.url, data: d.data, type: d.type || '', size: d.size || 0, source: t('direktnoUcitano'), date: d.date || '' });
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
                            const downloadDoc = async (doc) => {
                                if (doc.url) {
                                    try {
                                        const response = await fetch(doc.url);
                                        if (!response.ok) throw new Error('Network error');
                                        const blob = await response.blob();
                                        const blobUrl = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = blobUrl;
                                        a.download = doc.name || 'document';
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        window.URL.revokeObjectURL(blobUrl);
                                    } catch (err) {
                                        console.error('Download failed:', err);
                                        window.open(doc.url, '_blank');
                                    }
                                    return;
                                }
                                if (doc.data) {
                                    const a = document.createElement('a');
                                    a.href = doc.data;
                                    a.download = doc.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                }
                            };
                            const printDoc = async (doc) => {
                                if (doc.url) {
                                    try {
                                        const res = await fetch(doc.url);
                                        const blob = await res.blob();
                                        const blobUrl = window.URL.createObjectURL(blob);
                                        const isPdf = doc.name?.toLowerCase().endsWith('.pdf') || blob.type === 'application/pdf';
                                        
                                        const win = window.open(isPdf ? blobUrl : '');
                                        if (win) {
                                            if (isPdf) {
                                                setTimeout(() => win.print(), 1000);
                                            } else {
                                                win.document.write(`<html><head><title>${doc.name}</title></head><body style="margin:0"><img src="${blobUrl}" style="max-width:100%;max-height:95vh;margin:20px auto;display:block;" onload="window.print()" /></body></html>`);
                                                win.document.close();
                                            }
                                        }
                                    } catch (e) {
                                        console.error('Print failed', e);
                                        const win = window.open(doc.url, '_blank');
                                        if (win) setTimeout(() => win.print(), 1000);
                                    }
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
                                            📎 {t('ucitajNoviDokument')}
                                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file || !editingWorker) return;
                                                if (file.size> 20 * 1024 * 1024) { alert('Max 20MB!'); return; }
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
                                                            source: t('direktnoUcitano'),
                                                            date: new Date().toISOString().split('T')[0],
                                                        }]
                                                    });
                                                    loadData();
                                                    if (typeof window !== 'undefined' && window.eznrToast) {
                                                        window.eznrToast(t('dokumentUcitan'), 'success');
                                                    }
                                                } catch (err) {
                                                    console.error('[Upload] Dokument error:', err);
                                                    alert(t('greskaPriUcitavanju'));
                                                } finally {
                                                    e.target.value = '';
                                                }
                                            }} />
                                        </label>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            {workerDocs.length} {t('dokumenta')}
                                        </span>
                                    </div>

                                    {workerDocs.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            {t('nemaUcitanihDokumenataZaOvog')}
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
                                                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}>
                                                        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{icon}</span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {doc.name}
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                                <span>{doc.source}</span>
                                                                {doc.date && <span>{formatDate(doc.date)}</span>}
                                                                {doc.size> 0 && <span>{(doc.size / 1024).toFixed(1)} KB</span>}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                            {(isUrl || isPdf || isImg) && (
                                                                <button className="btn btn-ghost btn-sm" title={t('prikazi')}
                                                                    onClick={() => openDoc(doc)} style={{ padding: '4px 6px', fontSize: '0.9rem' }}>
                                                                    👁️
                                                                </button>
                                                            )}
                                                            <button className="btn btn-ghost btn-sm" title={t('preuzmi')}
                                                                onClick={() => downloadDoc(doc)} style={{ padding: '4px 6px', fontSize: '0.9rem' }}>
                                                                ⬇️
                                                            </button>
                                                            {(isUrl || isPdf || isImg) && (
                                                                <button className="btn btn-ghost btn-sm" title={t('isprintaj')}
                                                                    onClick={() => printDoc(doc)} style={{ padding: '4px 6px', fontSize: '0.9rem' }}>
                                                                    🖨️
                                                                </button>
                                                            )}
                                                        
                                                            <button className="btn btn-ghost btn-sm" title={t('obrisi')}
                                                                onClick={async () => {
                                                                    if (doc.id?.startsWith('wdoc_')) {
                                                                        const ok = await confirm(t('obrisatiDokument'));
                                                                        if (ok) {
                                                                            const wData = getById(COLLECTIONS.WORKERS, editingWorker);
                                                                            const idx = parseInt(doc.id.replace('wdoc_', ''), 10);
                                                                            const updDocs = (wData?.dokumenti || []).filter((_, i) => i !== idx);
                                                                            update(COLLECTIONS.WORKERS, editingWorker, { dokumenti: updDocs });
                                                                            setFormData(f => ({ ...f, dokumenti: updDocs }));
                                                                            loadData();
                                                                        }
                                                                    } else {
                                                                        await alert(t('ovajDokumentJeVezanUz'));
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
                                <h2>📜 {certEditId ? (t('urediUvjerenje')) : (t('novoUvjerenje'))}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => { setShowCertForm(false); setCertEditId(null); }}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('oznaka')} * <InfoTip text="Interni broj ili evidencijski kod certifikata u registru poslodavca (npr. ZNR-001)" /></label>
                                        <input className="form-input" value={certFormData.oznaka} onChange={e => setCertFormData({ ...certFormData, oznaka: e.target.value })} placeholder="ZNR-001" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('tipUvjerenja')}</label>
                                        <select className="form-select" value={certFormData.tipUvjerenja} onChange={e => setCertFormData({ ...certFormData, tipUvjerenja: e.target.value })}>
                                            {certTypes.filter((ct, i, a) => a.findIndex(x => x.naziv === ct.naziv) === i).map(ct => <option key={ct.id} value={ct.oznaka}>{t(ct.naziv?.trim()) || ct.naziv}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">{t('name')} *</label>
                                        <input className="form-input" value={certFormData.ime} onChange={e => setCertFormData({ ...certFormData, ime: e.target.value })} placeholder={t('nazivOsposobljavanja')} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('date')}</label>
                                        <DateInput value={certFormData.datum} onChange={v => setCertFormData({ ...certFormData, datum: v })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('vrijediDo')} <InfoTip text="Aplikacija će promijeniti status u crveno kada ovaj datum istekne ili postane blizu isteka." /></label>
                                        <DateInput value={certFormData.vrijediDo} onChange={v => setCertFormData({ ...certFormData, vrijediDo: v })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('sposobnost')}</label>
                                        <select className="form-select" value={certFormData.sposobnost} onChange={e => setCertFormData({ ...certFormData, sposobnost: e.target.value })}>
                                            <option value="Sposoban">{t('sposoban')}</option>
                                            <option value="Nesposoban">{t('nesposoban')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('upisao')}</label>
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
                                <h2 style={{ color: 'white', margin: 0 }}>👨‍⚕️ {medExamEditId ? (t('urediPregled')) : (t('noviLjekarskiPregled'))}</h2>
                                <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => { setShowMedExamForm(false); setMedExamEditId(null); }}>✕</button>
                            </div>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('vrstaPregleda')} <InfoTip text="Dali se radnik prvi put u firmi zapošljava (Prethodni) ili obnavlja sposobnost jer je prošla godina (Periodični)" /></label>
                                        <select className="form-select" value={medExamForm.tipPregleda} onChange={e => setMedExamForm(p => ({ ...p, tipPregleda: e.target.value }))}>
                                            <option value="prethodni">{t('prethodniPregled')}</option>
                                            <option value="periodicni">{t('periodicniPregled')}</option>
                                            <option value="vanredni">{t('vanredniPregled')}</option>
                                            <option value="nocniRad">{t('pregledNocniRad')}</option>
                                            <option value="ostalo">{t('ostalo')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('brojUputniceRa1')}</label>
                                        <input className="form-input" placeholder="RA1-2026-001" value={medExamForm.uputnicaBroj} onChange={e => setMedExamForm(p => ({ ...p, uputnicaBroj: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('datumPregleda')}</label>
                                        <DateInput value={medExamForm.datumPregleda} onChange={v => setMedExamForm(p => ({ ...p, datumPregleda: v }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('naredniPregledDo')}</label>
                                        <DateInput value={medExamForm.vrijediDo} onChange={v => setMedExamForm(p => ({ ...p, vrijediDo: v }))} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('rezultat')} <InfoTip text="Mora se tačno poklapati sa nalazom i mišljenjem doktora medicine rada." /></label>
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
                                        <label className="form-label" style={{ color: 'var(--warning)' }}>⚠️ {t('ogranicenja')}</label>
                                        <textarea className="form-input" rows={2} value={medExamForm.ogranicenja} onChange={e => setMedExamForm(p => ({ ...p, ogranicenja: e.target.value }))} />
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">🏥 {t('zdravstvenaUstanova')}</label>
                                        <input className="form-input" placeholder={t('domZdravlja')} value={medExamForm.zdravstvenaUstanova} onChange={e => setMedExamForm(p => ({ ...p, zdravstvenaUstanova: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">👨‍⚕️ {t('doktorMedicineRada')}</label>
                                        <input className="form-input" placeholder="Dr. Ime Prezime" value={medExamForm.doktorIme} onChange={e => setMedExamForm(p => ({ ...p, doktorIme: e.target.value }))} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => { setShowMedExamForm(false); setMedExamEditId(null); }}>{t('cancel')}</button>
                                <button className="btn btn-primary" onClick={async () => {
                                    if (!medExamForm.datumPregleda) { await alert(t('unesiteDatumPregleda')); return; }
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
                                <h2>🦺 {ppeEditId ? (t('urediZaduzenje')) : (t('novoZaduzenjeOzo'))}</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => { setShowPpeForm(false); setPpeEditId(null); }}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label className="form-label">{t('name')} *</label>
                                    <select className="form-select" value={ppeFormData.naziv} onChange={async (e) => {
                                        const val = e.target.value;
                                        if (val === 'NEW_OZO') {
                                            const newName = await prompt(t('unesiteNazivNoveOzo'));
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
                                        <option value="">-- {t('odaberiteOzo')} --</option>
                                        <option value="NEW_OZO" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ {t('dodajNovuOzo1')}</option>
                                        {ppeTypes.filter((pt, i, a) => a.findIndex(x => x.naziv === pt.naziv) === i).map(pt => <option key={pt.id} value={pt.naziv}>{t(pt.naziv?.trim()) || pt.naziv}</option>)}
                                    </select>
                                </div>
                                <div className="form-grid-2">
                                    <div className="form-group">
                                        <label className="form-label">{t('datumZaduzenja')}</label>
                                        <DateInput value={ppeFormData.datumZaduzenja} onChange={v => setPpeFormData({ ...ppeFormData, datumZaduzenja: v })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('datumRazduzenja')}</label>
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
                    <button className="btn btn-primary" onClick={() => handleSave(false)}>💾 {t('save')}</button>
                    <button className="btn btn-outline" onClick={() => handleSave(true)}>💾 {t('saveAndAddNew')}</button>
                    <button className="btn btn-ghost" onClick={handleBack}>↩ {t('cancel')}</button>
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
                    <div className="modal-overlay" onClick={() => setExcelExportMode(null)} style={{ zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none' }}>
                        <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #107c41, #185c37)' }}>
                                <h2 style={{ color: 'white', margin: 0 }}>📊 {t('izvozListeRadnikaExcel')}</h2>
                                <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setExcelExportMode(null)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-light)' }}>
                                    {t('selectWhichDataToInclude').replace('{0}', excelExportMode === 'selected' ? 'odabrano ' + selectedIds.size : 'SVIH ' + filteredWorkers.length).replace('{1}', excelExportMode === 'selected' ? selectedIds.size + ' workers selected' : 'ALL ' + filteredWorkers.length + ' workers')}
                                </p>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                    <button className="btn btn-outline btn-sm" onClick={() => {
                                        const all = {};
                                        Object.keys(exportColumns).forEach(k => all[k] = true);
                                        setExportColumns(all);
                                    }}>{t('odaberiSve')}</button>
                                    <button className="btn btn-outline btn-sm" onClick={() => {
                                        const none = {};
                                        Object.keys(exportColumns).forEach(k => none[k] = false);
                                        setExportColumns(none);
                                    }}>{t('odznaciSve')}</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 16px', background: 'var(--bg-card)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    {[
                                        { key: 'ime', label: getExp('ime') }, { key: 'prezime', label: getExp('prezime') }, { key: 'imeRoditelja', label: getExp('imeRoditelja') },
                                        { key: 'jmbg', label: getExp('jmbg') }, { key: 'oib', label: getExp('oibLbl') },
                                        { key: 'evidencijskiBroj', label: getExp('evidencijskiBrojLbl') },
                                        { key: 'datumRodenja', label: getExp('datumRodenja') }, { key: 'miestoRodenja', label: getExp('miestoRodenja') },
                                        { key: 'spol', label: getExp('spol') }, { key: 'zivotnaDob', label: getExp('zivotnaDob') },
                                        { key: 'orgJedinicaId', label: getExp('orgJedinicaIdLbl') }, { key: 'radnoMjestoId', label: getExp('radnoMjestoId') },
                                        { key: 'lokacija', label: getExp('lokacija') },
                                        { key: 'datumZaposlenja', label: getExp('datumZaposlenjaLbl') }, { key: 'stazDoDolaska', label: getExp('stazDoDolaska') },
                                        { key: 'datumOdlaska', label: getExp('datumOdlaska') }, { key: 'ukupniStaz', label: getExp('ukupniStazLbl') },
                                        { key: 'koef', label: getExp('koef') },
                                        { key: 'ulica', label: getExp('ulica') }, { key: 'kucniBroj', label: getExp('kucniBroj') },
                                        { key: 'mjestoId', label: getExp('mjestoId') }, { key: 'opcina', label: getExp('opcina') },
                                        { key: 'telefonTvrtki', label: getExp('telefonTvrtkiLbl') }, { key: 'mobitel', label: getExp('mobitel') },
                                        { key: 'email', label: getExp('email') }, { key: 'napomena', label: getExp('napomena') },
                                        { key: 'vanjskiSuradnik', label: getExp('vanjskiSuradnik') }, { key: 'aktivan', label: getExp('aktivanLbl') },
                                        { key: 'uvjerenja', label: getExp('uvjerenjaLbl') }, { key: 'ljekarski', label: getExp('ljekarski') },
                                        { key: 'ozo', label: getExp('ozoLbl') }
                                    ].map(col => (
                                        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            <input type="checkbox" checked={exportColumns[col.key]} onChange={e => setExportColumns(p => ({ ...p, [col.key]: e.target.checked }))} />
                                            {col.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-overlay" style={{ display: 'none' }}></div>
                            <div className="modal-footer">
                                <button className="btn btn-ghost" onClick={() => setExcelExportMode(null)}>{t('cancel')}</button>
                                <button className="btn btn-primary" style={{ background: '#107c41', color: 'white', borderColor: '#107c41' }} onClick={() => {
                                    const selectedWorkers = excelExportMode === 'selected' ? workers.filter(w => selectedIds.has(w.id)) : filteredWorkers;
                                    const allPpeList = getAll(COLLECTIONS.PPE_ASSIGNMENTS);
                                    const dataRows = selectedWorkers.map(w => {
                                        const row = {};
                                        if (exportColumns.ime) row[getExp('ime')] = w.ime;
                                        if (exportColumns.prezime) row[getExp('prezime')] = w.prezime;
                                        if (exportColumns.imeRoditelja) row[getExp('imeRoditelja')] = w.imeRoditelja;
                                        if (exportColumns.jmbg) row[getExp('jmbg')] = w.jmbg;
                                        if (exportColumns.oib) row[getExp('oibLbl')] = w.oib;
                                        if (exportColumns.evidencijskiBroj) row[getExp('evidencijskiBrojLbl')] = w.evidencijskiBroj;
                                        if (exportColumns.datumRodenja) row[getExp('datumRodenja')] = w.datumRodenja ? formatDate(w.datumRodenja) : '';
                                        if (exportColumns.miestoRodenja) row[getExp('miestoRodenja')] = w.miestoRodenja || w.miestoRodenja_;
                                        if (exportColumns.spol) row[getExp('spol')] = w.spol;
                                        if (exportColumns.zivotnaDob) row[getExp('zivotnaDob')] = w.zivotnaDob;
                                        if (exportColumns.orgJedinicaId) {
                                            const val = getOrgUnitName(w.orgJedinicaId);
                                            row[getExp('orgJedinicaIdLbl')] = t(val?.trim()) || val;
                                        }
                                        if (exportColumns.radnoMjestoId) {
                                            const val = getWorkplaceName(w.radnoMjestoId);
                                            row[getExp('radnoMjestoId')] = t(val?.trim()) || val;
                                        }
                                        if (exportColumns.lokacija) row[getExp('lokacija')] = w.lokacija;
                                        if (exportColumns.datumZaposlenja) row[getExp('datumZaposlenjaLbl')] = w.datumZaposlenja ? formatDate(w.datumZaposlenja) : '';
                                        if (exportColumns.datumOdlaska) row[getExp('datumOdlaska')] = w.datumOdlaska ? formatDate(w.datumOdlaska) : '';
                                        if (exportColumns.stazDoDolaska) row[getExp('stazDoDolaska')] = w.stazDoDolaska;
                                        if (exportColumns.ukupniStaz) row[getExp('ukupniStazLbl')] = w.ukupniStaz;
                                        if (exportColumns.koef) row[getExp('koef')] = w.koef;
                                        if (exportColumns.ulica) row[getExp('ulica')] = w.ulica;
                                        if (exportColumns.kucniBroj) row[getExp('kucniBroj')] = w.kucniBroj;
                                        if (exportColumns.mjestoId) {
                                            const val = places.find(p => p.id === w.mjestoId)?.naziv || '';
                                            row[getExp('mjestoId')] = t(val?.trim()) || val;
                                        }
                                        if (exportColumns.opcina) row[getExp('opcina')] = w.opcina;
                                        if (exportColumns.telefonTvrtki) row[getExp('telefonTvrtkiLbl')] = w.telefonTvrtki;
                                        if (exportColumns.mobitel) row[getExp('mobitel')] = w.mobitel;
                                        if (exportColumns.email) row[getExp('email')] = w.email;
                                        if (exportColumns.napomena) row[getExp('napomena')] = w.napomena;
                                        if (exportColumns.vanjskiSuradnik) row[getExp('vanjskiSuradnik')] = w.vanjskiSuradnik ? getExp('yes') : getExp('no');
                                        if (exportColumns.aktivan) row[getExp('aktivanLbl')] = w.aktivan ? getExp('active') : getExp('former');

                                        if (exportColumns.uvjerenja) {
                                            const wCerts = allCerts.filter(cx => cx.workerId === w.id);
                                            row[getExp('uvjerenjaLbl')] = wCerts.length > 0 ? wCerts.map(cx => cx.oznaka || t(cx.ime?.trim()) || cx.ime).join(', ') : '';
                                        }
                                        if (exportColumns.ljekarski) {
                                            const wMed = allMedExamsList.filter(mx => mx.workerId === w.id);
                                            row[getExp('ljekarski')] = wMed.length > 0 ? wMed.map(mx => {
                                                const keyMap = {
                                                    prethodni: 'prethodniPregled',
                                                    periodicni: 'periodicniPregled',
                                                    vanredni: 'vanredniPregled',
                                                    nocniRad: 'pregledNocniRad',
                                                    ostalo: 'ostalo'
                                                };
                                                return t(keyMap[mx.tipPregleda] || mx.tipPregleda) || mx.tipPregleda || 'Pregled';
                                            }).join(', ') : '';
                                        }
                                        if (exportColumns.ozo) {
                                            const wPpe = allPpeList.filter(px => px.workerId === w.id);
                                            row[getExp('ozoLbl')] = wPpe.length > 0 ? wPpe.map(px => (t(px.naziv?.trim()) || px.naziv) + (px.kolicina > 1 ? ` (x${px.kolicina})` : '')).join(', ') : '';
                                        }

                                        return row;
                                    });
                                    const ws = XLSX.utils.json_to_sheet(dataRows);

                                    const colWidths = Object.keys(dataRows[0] || {}).map(key => ({
                                        wch: Math.max(key.length, ...dataRows.map(row => (row[key] || '').toString().length)) + 2
                                    }));
                                    ws['!cols'] = colWidths;

                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, getExp('sheetName'));
                                    XLSX.writeFile(wb, `${getExp('fileName')}_${formatDate(new Date())}.xlsx`);
                                    setShowExportModal(false);
                                }}>⬇️ {t('preuzmiExcel')}</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="card-body" style={{ padding: 0 }}>
                        {/* Toolbar */}
                        <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                            <button className="btn btn-primary btn-sm" style={{ height: 38, padding: '0 16px', flexShrink: 0 }} onClick={handleNew} title={t('dodajNovogRadnika')}>
                                + {t('noviRadnik')}
                            </button>

                            <div className="search-bar" style={{ height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                                <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                                <input
                                    placeholder={t('pretraziRadnike')}
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1, width: '100%', minWidth: 0 }}
                                />
                                {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title={t('ponistiPretragu')}>✕</button>}
                            </div>

                            <select
                                className="form-select"
                                style={{ height: 38, padding: '0 12px', width: 112, flexShrink: 0, fontSize: '0.85rem' }}
                                value={filterOrgUnit}
                                title={t('filtrirajPoOdjelu')}
                                onChange={(e) => { setFilterOrgUnit(e.target.value); setPage(1); }}>
                                <option value="">{t('sviOdjeli')}</option>
                                {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                            </select>

                            <PDFExportButton
                                label={lang !== 'en' ? 'Izvještaji' : 'Reports'}
                                title={t('prikaziPdfIzvjestaje')}
                                buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }}
                                options={[
                                    { header: lang !== 'en' ? 'PDF Izvještaji' : 'PDF Reports' },
                                    { label: lang !== 'en' ? 'Svi radnici' : 'All Workers', icon: '👷', onClick: () => generateWorkersReport(sortedWorkers.map(w => w.id), lang) },
                                    ...(selectedIds.size > 0 ? [
                                        { label: lang !== 'en' ? `Odabrani radnici (${selectedIds.size})` : `Selected Workers (${selectedIds.size})`, icon: '✓', onClick: () => generateWorkersReport(sortedWorkers.filter(w => selectedIds.has(w.id)).map(w => w.id), lang) }
                                    ] : []),
                                    { divider: true },
                                    { header: lang !== 'en' ? 'Excel Izvoz' : 'Excel Export' },
                                    { label: lang !== 'en' ? 'Svi radnici' : 'All Workers', icon: '📥', onClick: () => setExcelExportMode('all') },
                                    ...(selectedIds.size > 0 ? [
                                        { label: lang !== 'en' ? `Odabrani radnici (${selectedIds.size})` : `Selected Workers (${selectedIds.size})`, icon: '📥', onClick: () => setExcelExportMode('selected') }
                                    ] : [])
                                ]}
                            />

                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--text-light)', cursor: 'pointer', flexShrink: 0 }}>
                                <input type="checkbox" checked={showFormer} onChange={(e) => setShowFormer(e.target.checked)} />
                                {t('formerWorkers')}
                            </label>
                        </div>

                        {/* ── Bulk Action Bar ────────────────────────────────────────── */}
                        {selectedIds.size > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                                background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid rgba(0,191,166,0.2)',
                                flexWrap: 'wrap',
                            }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    ✓ {selectedIds.size} {t('odabrano')} — {t('grupneAkcije') || 'Grupne akcije'}:
                                </span>
                                <button className="btn btn-sm" style={{ background: 'var(--primary)', color: 'white', border: 'none', height: 32, padding: '0 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => {
                                    const selectedWorkers = selectedIds.size > 0 ? workers.filter(w => selectedIds.has(w.id)) : filteredWorkers;
                                    const emails = selectedWorkers.map(w => w.email).filter(Boolean);
                                    if (emails.length === 0) {
                                        alert(t('odabraniRadniciNemajuEmailAdrese'));
                                        return;
                                    }
                                    const subject = encodeURIComponent(t('obavijest'));
                                    window.open(`mailto:${emails.join(';')}?subject=${subject}`, '_blank');
                                }} title={t('posaljiEmail')}>
                                    ✉️ Email
                                </button>
                                <button className="btn btn-sm btn-primary" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0 }} onClick={() => generateWorkersReport(sortedWorkers.filter(w => selectedIds.has(w.id)).map(w => w.id), lang)} title={lang !== 'en' ? 'Generiši PDF za odabrane radnike' : 'Generate PDF for selected workers'}>
                                    🖨️ {lang !== 'en' ? 'Generiši PDF' : 'Generate PDF'} ({selectedIds.size})
                                </button>
                                <button className="btn btn-sm" style={{ height: 32, display: 'inline-flex', alignItems: 'center', paddingTop: 0, paddingBottom: 0, background: '#107c41', color: 'white' }} onClick={() => setExcelExportMode('selected')} title={lang !== 'en' ? 'Izvezi odabrane radnike u Excel' : 'Export selected workers to Excel'}>
                                    📥 {lang !== 'en' ? 'Izvoz u Excel' : 'Export to Excel'} ({selectedIds.size})
                                </button>
                                <button className="btn btn-sm" style={{ background: '#D32F2F', color: 'white', border: 'none', height: 32, padding: '0 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={async () => {
                                    const ok = await confirm(t('deleteWorkersThisCannotBe').replace('{0}', selectedIds.size));
                                    if (ok) {
                                        removeManyWorkersCascade([...selectedIds]);
                                        setSelectedIds(new Set());
                                        loadData();
                                    }
                                }} title={t('obrisiOdabraneRadnike')}>
                                    🗑️ {t('obrisi')}
                                </button>
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center' }} onClick={() => setSelectedIds(new Set())} title={t('ponistiOdabir')}>
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Table */}
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 40, textAlign: 'center' }} title={allPageSelected ? (t('odznaciSve')) : (t('odaberiSveNaStranici'))}>
                                            <input
                                                type="checkbox"
                                                checked={allPageSelected}
                                                ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                                                onChange={toggleSelectAll}
                                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                                            />
                                        </th>
                                        <th style={{ width: 100 }}>{t('actions')}</th>
                                        <th style={{ ...tsW('ime'), minWidth: 130, textAlign: 'left' }} onClick={() => tW('ime')}>{t('workerName')}{siW('ime')}</th>
                                        <th style={{ ...tsW('prezime'), minWidth: 140, textAlign: 'left' }} onClick={() => tW('prezime')}>{t('workerSurname')}{siW('prezime')}</th>
                                        <th>{t('oib')}</th>
                                        <th style={tsW('orgJedinicaId')} onClick={() => tW('orgJedinicaId')}>{t('orgUnit')}{siW('orgJedinicaId')}</th>
                                        <th style={tsW('radnoMjestoId')} onClick={() => tW('radnoMjestoId')}>{t('workplace')}{siW('radnoMjestoId')}</th>
                                        <th style={{ width: 140, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('statusZnrmbr')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedWorkers.length === 0 ? (
                                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                    ) : (
                                        pagedWorkers.map((w) => (
                                            <tr key={w.id} onClick={() => handleEdit(w)} style={{ background: selectedIds.has(w.id) ? 'rgba(0,191,166,0.06)' : lastEditedId === w.id ? 'rgba(102,126,234,0.15)' : undefined, transition: 'background 0.5s ease', cursor: 'pointer' }}>
                                                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
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
                                                            onClick={() => handleEdit(w)} title={t('urediRadnika')}>▶</button>
                                                        <button className="btn btn-primary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={e => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const spaceBelow = window.innerHeight - rect.bottom;
                                                            const spaceAbove = rect.top;
                                                            const flipUp = spaceBelow < 340 && spaceAbove> spaceBelow;
                                                            setMenuPos(flipUp
                                                                ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                                                                : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                                                            );
                                                            setActionMenuId(actionMenuId === w.id ? null : w.id);
                                                        }} title={t('prikaziAkcijeZaRadnika')}>
                                                            {t('actions')} ▼
                                                        </button>
                                                    </div>
                                                    {actionMenuId === w.id && createPortal(
                                                        <>
                                                            <div onClick={() => setActionMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                                                            <div onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 240, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                                        {w.ime} {w.prezime}
                                                                    </span>
                                                                    <button onClick={() => setActionMenuId(null)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                                                                </div>
                                                                <button style={_miSt} onClick={() => handleEdit(w)}>📂 {t('open')}</button>
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                <button style={_miSt} onClick={() => router.push(`/dashboard/worker-certificates/create?workerId=${w.id}&returnTo=${encodeURIComponent('/dashboard/workers')}`)}>📄 {t('novoUvjerenje')}</button>
                                                                <button style={_miSt} onClick={() => router.push(`/dashboard/medical-exams?openNew=1&workerId=${w.id}&returnTo=${encodeURIComponent('/dashboard/workers')}`)}>👨‍⚕️ {t('noviPregled')}</button>
                                                                <button style={_miSt} onClick={() => router.push(`/dashboard/injuries?openNew=1&workerId=${w.id}&returnTo=${encodeURIComponent('/dashboard/workers')}`)}>🚑 {t('novaPovreda')}</button>
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
                                                                            🖨️ {t('isprintaj')}: {doc.docName || doc.fileName || doc.attachedFileName || doc.ime || 'Dokument'}
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
                                                                            const c = zosCerts[0];
                                                                            const wpN = workplaces.find(wp => wp.id === w.radnoMjestoId)?.naziv || c.izdanoZaRadnoMjesto || '';
                                                                            const companyFull = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                                                                            printZosPdf({
                                                                                company: companyFull,
                                                                                worker: w,
                                                                                workplaceName: wpN,
                                                                                training: { naziv: c.izdanoIzObuke || c.ime },
                                                                                officer: c.strucnjakZNR || c.upisao || '',
                                                                                date: c.datum || new Date().toISOString(),
                                                                                certOznaka: c.oznaka,
                                                                                testResult: c.rezultatTesta || '',
                                                                            }, lang);
                                                                        }}>
                                                                            🖨️ {t('isprintajZos')}
                                                                        </button>
                                                                    );
                                                                })()}
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                <button style={_miSt} onClick={() => { setActionMenuId(null); handleEdit(w); setTimeout(() => { setFullFormTab('dokumenti'); }, 100); }}>📁 {t('dokumenti1')}</button>
                                                                <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                                <button style={{ ..._miSt, color: 'var(--danger)' }} onClick={() => handleDelete(w.id)}>🗑️ {t('delete')}</button>
                                                            </div>
                                                        </>,
                                                        document.body
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                                                                handleEdit(w);
                                                            } else {
                                                                setViewWorkerId(w.id);
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)', textAlign: 'left' }}
                                                        title={t('klikniZaPregledProfila')}>{w.ime}</button>
                                                </td>
                                                <td style={{ fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'left' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (typeof window !== 'undefined' && window.innerWidth <= 768) {
                                                                handleEdit(w);
                                                            } else {
                                                                setViewWorkerId(w.id);
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)', textAlign: 'left' }}
                                                        title={t('klikniZaPregledProfila')}>{w.prezime}</button>
                                                </td>
                                                <td><code style={{ fontSize: '0.85rem' }}>{w.oib || w.jmbg}</code></td>
                                                <td>
                                                    {w.orgJedinicaId ? (
                                                        <button onClick={() => router.push('/dashboard/org-units')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.82rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid' }} title={t('otvoriOrganizacijskuJedinicu')}>
                                                            {t(getOrgUnitName(w.orgJedinicaId)?.trim()) || getOrgUnitName(w.orgJedinicaId)}
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                                <td>
                                                    {w.radnoMjestoId ? (
                                                        <button onClick={() => router.push('/dashboard/workplaces')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '0.82rem', fontFamily: 'inherit', padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid' }} title={t('otvoriRadnoMjesto')}>
                                                            {t(getWorkplaceName(w.radnoMjestoId)?.trim()) || getWorkplaceName(w.radnoMjestoId)}
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                    {(() => {
                                                        const _today = new Date();
                                                        const _wC = allCerts.filter(cx => cx.workerId === w.id);
                                                        const _wM = allMedExamsList.filter(mx => mx.workerId === w.id);
                                                        const _expC = _wC.some(cx => cx.vrijediDo && new Date(cx.vrijediDo) < _today);
                                                        const _soonC = _wC.some(cx => { if (!cx.vrijediDo) return false; const d = (new Date(cx.vrijediDo) - _today) / 86400000; return d>= 0 && d <= 30; });
                                                        const _expM = _wM.some(mx => mx.vrijediDo && new Date(mx.vrijediDo) < _today);
                                                        const _soonM = _wM.some(mx => { if (!mx.vrijediDo) return false; const d = (new Date(mx.vrijediDo) - _today) / 86400000; return d>= 0 && d <= 60; });

                                                        let badgeCls = 'badge-success';
                                                        let badgeTxt = t('uRedu');

                                                        if (_expC || _expM) {
                                                            badgeCls = 'badge-danger';
                                                            badgeTxt = t('isteklo2');
                                                        } else if (_soonC || _soonM) {
                                                            badgeCls = 'badge-warning';
                                                            badgeTxt = t('uskoroIstice');
                                                        } else if (_wC.length === 0) {
                                                            badgeCls = '';
                                                            badgeTxt = t('nemaPodataka');
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
                        <Pagination 
                            page={page} 
                            perPage={perPage} 
                            totalPages={totalPages} 
                            totalItems={filteredWorkers.length} 
                            setPage={setPage} 
                            setPerPage={setPerPage} 
                            prevPage={prevPage} 
                            nextPage={nextPage} 
                            onPerPageChangeExtra={() => setSelectedIds(new Set())} 
                        />
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
                                window.history.replaceState(null, '', url.toString());
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

