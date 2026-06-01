'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/hooks/useDialog';
import {
    getAll, getById, create, createMass, update, COLLECTIONS, getRawAll
} from '@/lib/dataStore';
import { applyUIBranding } from '@/lib/brandingService';
import * as XLSX from 'xlsx';

// -- Date parser --------------------------------------------------------------
function parseXlDate(val) {
    if (!val && val !== 0) return '';
    if (val instanceof Date && !isNaN(val)) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    const s = String(val).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const dmy = s.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return s;
}

// -- Name normaliser strips diacritics for fuzzy matching ---------------------
function normName(s) {
    if (!s) return '';
    return String(s).toLowerCase().trim()
        .replace(/\u0161/g, 's').replace(/\u0111/g, 'd').replace(/\u010d/g, 'c')
        .replace(/\u0107/g, 'c').replace(/\u017e/g, 'z');
}

// -- Worker matcher: JMBG first, then exact name, then diacritic-insensitive --
function matchWorker(workers, ime, prezime, jmbg) {
    if (jmbg && String(jmbg).trim()) {
        const found = workers.find(w => w.jmbg === String(jmbg).trim());
        if (found) return found;
    }
    if (!ime) return null;
    const imeN = normName(ime);
    const prezimeN = normName(prezime);
    if (prezime) {
        const exact = workers.find(w => normName(w.ime) === imeN && normName(w.prezime) === prezimeN);
        if (exact) return exact;
        const partial = workers.find(w =>
            normName(w.ime) === imeN &&
            (normName(w.prezime).startsWith(prezimeN) || prezimeN.startsWith(normName(w.prezime)))
        );
        if (partial) return partial;
    }
    const byIme = workers.filter(w => normName(w.ime) === imeN);
    if (byIme.length === 1) return byIme[0];
    return null;
}

function parseSheet(wb, sheetName) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return data
        .filter(row => Object.values(row).some(v => v !== '' && v !== null && v !== undefined))
        .map(row => {
            const cleaned = {};
            for (const [k, v] of Object.entries(row)) {
                cleaned[k] = (v instanceof Date) ? parseXlDate(v) : v;
            }
            return cleaned;
        });
}

const BRAND_COLORS = [
    { name: 'Teal (Zadano)', value: '#00BFA6' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Plava', value: '#2196F3' },
    { name: 'Zelena', value: '#22C55E' },
    { name: 'Narančasta', value: '#F59E0B' },
    { name: 'Crvena', value: '#EF4444' }
];

export default function EmptyDashboard({ onComplete }) {
    const router = useRouter();
    const { lang , t } = useLanguage();
    const { activeCompanyId } = useAuth();
    const { alert, confirm, DialogRenderer } = useDialog();
    const bs = lang !== 'en';

    const [activeStep, setActiveStep] = useState(0);
    const [maxStep, setMaxStep] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    // Step 1: Company Profile Form
    const [companyData, setCompanyData] = useState({
        naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '',
        postanskiBroj: '', telefon: '', email: '', direktor: '', strucnoLice: '', logo: '', country: 'BA'
    });
    const [logoError, setLogoError] = useState('');
    const [accentColor, setAccentColor] = useState('#00BFA6');
    const [assignedUserIds, setAssignedUserIds] = useState([]);

    // Step 2: Combined Workers & Documents
    const [onboardTab, setOnboardTab] = useState('excel'); // excel | manual
    
    // Manual inputs
    const [manualWorker, setManualWorker] = useState({
        ime: '', prezime: '', jmbg: '', oib: '', radnoMjesto: '', datumRodenja: ''
    });
    const [manualDoc, setManualDoc] = useState({
        workerId: '', docType: 'cert', naziv: '', oznaka: '', datum: '', vrijediDo: '', sposobnost: 'Sposoban'
    });

    // Loaded Lists
    const [addedWorkers, setAddedWorkers] = useState([]);
    const [addedDocs, setAddedDocs] = useState([]);
    const [listTab, setListTab] = useState('workers'); // workers | docs

    // Excel States
    const [excelFile, setExcelFile] = useState(null);
    const [excelPreview, setExcelPreview] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [importMsg, setImportMsg] = useState('');
    
    const fileInputRef = useRef(null);
    const logoInputRef = useRef(null);

    // Detect mobile
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Get list of officers / admins to assign
    const potentialUsers = useMemo(() => {
        if (typeof window === 'undefined') return [];
        return getRawAll(COLLECTIONS.USERS).filter(
            u => (u.role === 'officer' || u.role === 'admin' || u.role === 'companyadmin') && u.aktivan !== false
        );
    }, []);

    // Load initial company details and assignments
    useEffect(() => {
        if (activeCompanyId) {
            const company = getById(COLLECTIONS.COMPANIES, activeCompanyId);
            if (company) {
                setCompanyData({
                    naziv: company.naziv || '',
                    skraceniNaziv: company.skraceniNaziv || '',
                    oib: company.oib || '',
                    adresa: company.adresa || '',
                    mjesto: company.mjesto || '',
                    postanskiBroj: company.postanskiBroj || '',
                    telefon: company.telefon || '',
                    email: company.email || '',
                    direktor: company.direktor || '',
                    strucnoLice: company.strucnoLice || '',
                    logo: company.logo || '',
                    country: company.country || 'BA'
                });
                if (company.branding?.accentColor) {
                    setAccentColor(company.branding.accentColor);
                }
            }

            // Load user assignments
            const assigned = potentialUsers.filter(u => (u.companyIds || []).includes(activeCompanyId)).map(u => u.id);
            setAssignedUserIds(assigned);

            // Load existing workers & documents
            loadDashboardLists();
        }
    }, [activeCompanyId, potentialUsers]);

    const loadDashboardLists = () => {
        const workers = getAll(COLLECTIONS.WORKERS);
        const certs = getAll(COLLECTIONS.CERTIFICATES).map(c => {
            const w = workers.find(wk => wk.id === c.workerId);
            return { ...c, workerName: w ? `${w.ime} ${w.prezime}` : '—', docType: 'cert' };
        });
        const exams = getAll(COLLECTIONS.MEDICAL_EXAMS).map(e => {
            const w = workers.find(wk => wk.id === e.workerId);
            return { ...e, naziv: e.tipPregleda, workerName: w ? `${w.ime} ${w.prezime}` : '—', docType: 'exam' };
        });
        setAddedWorkers(workers);
        setAddedDocs([...certs, ...exams]);
    };

    const handleStepClick = (step) => {
        if (step <= maxStep) {
            setActiveStep(step);
        }
    };

    const handleNext = async () => {
        if (activeStep === 0) {
            setActiveStep(1);
            setMaxStep(Math.max(maxStep, 1));
        } else if (activeStep === 1) {
            // Save company details & branding & user assignments
            if (!companyData.naziv.trim()) {
                await alert(t('nazivTvrtkeJeObavezan'));
                return;
            }

            try {
                // 1. Branding Structure
                const branding = {
                    accentColor: accentColor,
                    primaryColor: accentColor,
                    sidebarColor: '#1A1D27',
                    watermarkEnabled: true,
                    watermarkPosition: 'center',
                    watermarkOpacity: 5,
                    watermarkSize: 280,
                    logoPosition: 'left',
                    logoSize: 40,
                    headerEnabled: true,
                    showCompanyInfo: true,
                    showCompanyName: true,
                    headerColor: '#1a1a2e'
                };

                const payload = { ...companyData, branding };
                update(COLLECTIONS.COMPANIES, activeCompanyId, payload);
                applyUIBranding(activeCompanyId);

                // 2. User Assignments
                potentialUsers.forEach(u => {
                    const isAssigned = assignedUserIds.includes(u.id);
                    const currentCompanyIds = u.companyIds || [];
                    const hasCompany = currentCompanyIds.includes(activeCompanyId);

                    let newCompanyIds = [...currentCompanyIds];
                    if (isAssigned && !hasCompany) {
                        newCompanyIds.push(activeCompanyId);
                    } else if (!isAssigned && hasCompany) {
                        newCompanyIds = currentCompanyIds.filter(id => id !== activeCompanyId);
                    }

                    if (JSON.stringify(currentCompanyIds) !== JSON.stringify(newCompanyIds)) {
                        update(COLLECTIONS.USERS, u.id, { companyIds: newCompanyIds });
                    }
                });

                // Trigger sync
                window.dispatchEvent(new CustomEvent('eznr:data-synced'));
            } catch (err) {
                console.error('Failed to save step 1:', err);
            }

            setActiveStep(2);
            setMaxStep(Math.max(maxStep, 2));
        } else if (activeStep === 2) {
            setActiveStep(3);
            setMaxStep(Math.max(maxStep, 3));
        }
    };

    const handleBack = () => {
        if (activeStep > 0) {
            setActiveStep(activeStep - 1);
        }
    };

    const handleSkipStep = () => {
        if (activeStep < 3) {
            setActiveStep(activeStep + 1);
            setMaxStep(Math.max(maxStep, activeStep + 1));
        }
    };

    const handleFinish = () => {
        if (activeCompanyId) {
            localStorage.setItem(`eznr_wizard_completed_${activeCompanyId}`, 'true');
        }
        if (onComplete) onComplete();
        router.refresh();
    };

    const handleSkipAll = async () => {
        const ok = await confirm(
            t('areYouSureYouWant1')
        );
        if (ok) {
            handleFinish();
        }
    };

    // --- STEP 1: Logo Reader ---
    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            setLogoError(t('logoMoraBitiManjiOd1'));
            return;
        }
        setLogoError('');
        const reader = new FileReader();
        reader.onload = () => {
            setCompanyData(prev => ({ ...prev, logo: reader.result }));
        };
        reader.onerror = () => {
            setLogoError(t('greskaPriCitanjuFajla'));
        };
        reader.readAsDataURL(file);
    };

    // Toggle User Checkbox
    const toggleUserAssignment = (userId) => {
        setAssignedUserIds(prev => 
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    // --- STEP 2: Add Worker Manually ---
    const handleAddWorkerManual = async () => {
        if (!manualWorker.ime || !manualWorker.prezime) {
            await alert(t('imeIPrezimeSuObavezna'));
            return;
        }

        let radnoMjestoId = '';
        if (manualWorker.radnoMjesto.trim()) {
            const term = manualWorker.radnoMjesto.trim().toLowerCase();
            const existingWps = getAll(COLLECTIONS.WORKPLACES);
            const foundWp = existingWps.find(w => w.companyId === activeCompanyId && w.naziv.toLowerCase() === term);
            if (foundWp) {
                radnoMjestoId = foundWp.id;
            } else {
                const newWp = create(COLLECTIONS.WORKPLACES, {
                    naziv: manualWorker.radnoMjesto.trim(),
                    companyId: activeCompanyId
                });
                radnoMjestoId = newWp.id;
            }
        }

        const payload = {
            ime: manualWorker.ime.trim(),
            prezime: manualWorker.prezime.trim(),
            jmbg: manualWorker.jmbg.trim(),
            oib: manualWorker.oib.trim(),
            datumRodenja: manualWorker.datumRodenja,
            radnoMjestoId,
            aktivan: true,
            companyId: activeCompanyId
        };

        const newWorker = create(COLLECTIONS.WORKERS, payload);
        
        // Auto-select this worker in manual cert dropdown
        setManualDoc(prev => ({ ...prev, workerId: newWorker.id }));

        setManualWorker({
            ime: '', prezime: '', jmbg: '', oib: '', radnoMjesto: '', datumRodenja: ''
        });

        loadDashboardLists();
        window.dispatchEvent(new CustomEvent('eznr:data-synced'));
    };

    // --- STEP 2: Add Document Manually ---
    const handleAddDocManual = async () => {
        if (!manualDoc.workerId) {
            await alert(t('odaberiteRadnika'));
            return;
        }
        if (!manualDoc.naziv) {
            await alert(t('nazivJeObavezan'));
            return;
        }
        if (!manualDoc.datum) {
            await alert(t('datumJeObavezan'));
            return;
        }

        const companyId = activeCompanyId;

        if (manualDoc.docType === 'cert') {
            const payload = {
                workerId: manualDoc.workerId,
                companyId,
                naziv: manualDoc.naziv.trim(),
                ime: manualDoc.naziv.trim(),
                oznaka: manualDoc.oznaka.trim(),
                datum: manualDoc.datum,
                vrijediDo: manualDoc.vrijediDo,
                sposobnost: manualDoc.sposobnost,
                upisao: 'Onboarding Wizard'
            };
            create(COLLECTIONS.CERTIFICATES, payload);
        } else {
            const payload = {
                workerId: manualDoc.workerId,
                companyId,
                tipPregleda: manualDoc.naziv.trim(),
                datumPregleda: manualDoc.datum,
                vrijediDo: manualDoc.vrijediDo,
                rezultat: manualDoc.sposobnost,
                zdravstvenaUstanova: '',
                doktorIme: '',
                ogranicenja: ''
            };
            create(COLLECTIONS.MEDICAL_EXAMS, payload);
        }

        setManualDoc(prev => ({
            ...prev, naziv: '', oznaka: '', datum: '', vrijediDo: '', sposobnost: 'Sposoban'
        }));

        loadDashboardLists();
        window.dispatchEvent(new CustomEvent('eznr:data-synced'));
    };

    // --- STEP 2: Excel Parser ---
    const processExcelFile = (file) => {
        setExcelFile(file);
        setImportMsg('');
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
                const ouRows = parseSheet(wb, 'OrgJedinice');
                const wpRows = parseSheet(wb, 'RadnaMjesta');
                const workers = parseSheet(wb, 'Radnici');
                const certs = parseSheet(wb, 'Uvjerenja');
                const ppe = parseSheet(wb, 'OZO');
                const medExams = parseSheet(wb, 'Ljekarski');
                setExcelPreview({ ouRows, wpRows, workers, certs, ppe, medExams });
            } catch (err) {
                alert(bs ? 'Greška pri čitanju Excela: ' + err.message : 'Error reading Excel: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleImportExcel = async () => {
        if (!excelPreview) return;
        
        const { workers: wRows = [], certs: cRows = [], ppe: pRows = [], medExams: mRows = [], ouRows = [], wpRows = [] } = excelPreview;
        const companyId = activeCompanyId;

        // 1. Import Org Units
        const allOrgUnits = getAll(COLLECTIONS.ORG_UNITS);
        const newOU = [];
        ouRows.forEach(row => {
            const naziv = String(row.naziv || '').trim();
            if (!naziv) return;
            if (allOrgUnits.some(o => o.companyId === companyId && o.naziv.toLowerCase() === naziv.toLowerCase())) return;
            newOU.push({ naziv, opis: String(row.opis || '').trim(), companyId });
        });
        if (newOU.length > 0) await createMass(COLLECTIONS.ORG_UNITS, newOU);

        // 2. Import Workplaces
        const allWorkplaces = getAll(COLLECTIONS.WORKPLACES);
        const newWP = [];
        const fuzzyMatch = (list, text, field = 'naziv') => {
            if (!text) return null;
            const t = String(text).toLowerCase().trim();
            const filtered = list.filter(item => item.companyId === companyId || item.companyId === 'all');
            return filtered.find(item => (item[field] || '').toLowerCase().trim() === t)
                || filtered.find(item => (item[field] || '').toLowerCase().trim().includes(t) || t.includes((item[field] || '').toLowerCase().trim()));
        };

        wpRows.forEach(row => {
            const naziv = String(row.naziv || '').trim();
            if (!naziv) return;
            if (allWorkplaces.some(w => w.companyId === companyId && w.naziv.toLowerCase() === naziv.toLowerCase())) return;
            newWP.push({
                naziv, opis: String(row.opis || '').trim(), companyId,
                orgUnitId: (() => {
                    const oj = String(row.orgJedinica || '').trim();
                    if (!oj) return '';
                    const match = fuzzyMatch(getAll(COLLECTIONS.ORG_UNITS), oj);
                    return match ? match.id : '';
                })()
            });
        });
        if (newWP.length > 0) await createMass(COLLECTIONS.WORKPLACES, newWP);

        // 3. Import Workers
        const existingWorkers = getAll(COLLECTIONS.WORKERS);
        const newWList = [];
        const newWorkerMap = {};

        wRows.forEach(row => {
            if (!row.ime || !row.prezime) return;
            const jmbg = String(row.jmbg || '').trim();
            if (jmbg && existingWorkers.some(w => w.jmbg === jmbg)) {
                const existing = existingWorkers.find(w => w.jmbg === jmbg);
                newWorkerMap[jmbg] = existing.id;
                return;
            }
            newWList.push({
                ime: String(row.ime || '').trim(), prezime: String(row.prezime || '').trim(),
                imeRoditelja: String(row.imeRoditelja || '').trim(), jmbg, oib: String(row.oib || '').trim(),
                spol: String(row.spol || '').trim(), datumRodenja: parseXlDate(row.datumRodenja),
                miestoRodenja: String(row.miestoRodenja || '').trim(), datumZaposlenja: parseXlDate(row.datumZaposlenja),
                datumOdlaska: parseXlDate(row.datumOdlaska), stazDoDolaska: String(row.stazDoDolaska || '').trim(),
                koef: String(row.koef || '').trim(), lokacija: String(row.lokacija || '').trim(),
                evidencijskiBroj: String(row.evidencijskiBroj || '').trim(), telefonTvrtki: String(row.telefonTvrtki || '').trim(),
                mobitel: String(row.mobitel || '').trim(), email: String(row.email || '').trim(),
                ulica: String(row.ulica || '').trim(), kucniBroj: String(row.kucniBroj || '').trim(),
                napomena: String(row.napomena || '').trim(), aktivan: String(row.aktivan || 'DA').toUpperCase() !== 'NE',
                vanjskiSuradnik: String(row.vanjskiSuradnik || 'NE').toUpperCase() === 'DA', companyId,
                radnoMjestoId: (() => {
                    const rm = String(row.radnoMjesto || '').trim();
                    if (!rm) return '';
                    const match = fuzzyMatch(getAll(COLLECTIONS.WORKPLACES), rm);
                    return match ? match.id : '';
                })(),
                orgJedinicaId: (() => {
                    const oj = String(row.orgJedinica || '').trim();
                    if (!oj) return '';
                    const match = fuzzyMatch(getAll(COLLECTIONS.ORG_UNITS), oj);
                    return match ? match.id : '';
                })(),
                prefix: '', sufiks: '', zivotnaDob: 0, ukupniStaz: '',
                posebniUvjeti: false, slika: '', dodatniPoslovi: '',
                opcina: '', opcinaRodenja: '', telefonKuce: '', mjestoId: '', mjestoRodenja_: '',
            });
        });

        let savedWorkers = [];
        if (newWList.length > 0) {
            savedWorkers = await createMass(COLLECTIONS.WORKERS, newWList);
        }

        // Map JMBGs and names
        savedWorkers.forEach(sw => {
            if (sw.jmbg) newWorkerMap[sw.jmbg] = sw.id;
            newWorkerMap[`${sw.ime}__${sw.prezime}`] = sw.id;
        });

        // 4. Import Certificates
        const allWorkers = getAll(COLLECTIONS.WORKERS);
        const existingCerts = getAll(COLLECTIONS.CERTIFICATES);
        const newCerts = [];
        cRows.forEach(row => {
            if (!row.naziv) return;
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            if (!worker) return;
            const datum = parseXlDate(row.datum);
            const naziv = String(row.naziv || '').trim();
            if (existingCerts.some(c => c.workerId === worker.id && c.naziv === naziv && c.datum === datum)) return;
            newCerts.push({
                workerId: worker.id, companyId: worker.companyId || companyId,
                ime: naziv, naziv, oznaka: String(row.oznaka || '').trim(),
                tipUvjerenja: String(row.tipUvjerenja || '').trim(), datum,
                vrijediDo: parseXlDate(row.vrijediDo),
                sposobnost: String(row.sposobnost || 'Sposoban').trim(),
                ogranicenje: String(row.ogranicenje || '').trim(), upisao: 'Import',
            });
        });
        if (newCerts.length > 0) await createMass(COLLECTIONS.CERTIFICATES, newCerts);

        // 5. Import Medical Exams
        const existingMedExams = getAll(COLLECTIONS.MEDICAL_EXAMS);
        const newMedExams = [];
        mRows.forEach(row => {
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            if (!worker) return;
            const datum = parseXlDate(row.datum);
            if (existingMedExams.some(e => e.workerId === worker.id && e.datumPregleda === datum)) return;
            newMedExams.push({
                workerId: worker.id, companyId: worker.companyId || companyId,
                tipPregleda: String(row.tipPregleda || 'Periodični').trim(),
                datumPregleda: datum, vrijediDo: parseXlDate(row.vrijediDo),
                rezultat: String(row.rezultat || 'Sposoban').trim(),
                zdravstvenaUstanova: '', doktorIme: '', ogranicenja: String(row.napomena || '').trim(),
            });
        });
        if (newMedExams.length > 0) await createMass(COLLECTIONS.MEDICAL_EXAMS, newMedExams);

        setImportMsg(
            t('successfullyImportedWorkersCertificatesMedical').replace('{0}', newWList.length).replace('{1}', newCerts.length).replace('{2}', newMedExams.length)
        );

        setExcelFile(null);
        setExcelPreview(null);

        // Reload UI lists
        loadDashboardLists();
        window.dispatchEvent(new CustomEvent('eznr:data-synced'));
    };

    // Label style utility from design system
    const labelStyle = {
        display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
        color: '#fff', background: '#455a64', padding: '2px 8px',
        borderRadius: 3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px'
    };

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 840, margin: '0 auto', paddingBottom: 60 }}>
            <DialogRenderer />

            {/* Stepper Header */}
            {activeStep > 0 && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 32, position: 'relative', padding: '0 40px'
                }}>
                    {/* Stepper line */}
                    <div style={{
                        position: 'absolute', top: 20, left: 54, right: 54, height: 2,
                        background: 'var(--border-light)', zIndex: 1
                    }} />
                    {/* Active Stepper line */}
                    <div style={{
                        position: 'absolute', top: 20, left: 54,
                        width: `${((activeStep - 1) / 2) * 100}%`, height: 2,
                        background: 'var(--primary)', zIndex: 1, transition: 'width 0.3s ease'
                    }} />

                    {[
                        { num: 1, label: t('identityCompany'), icon: '🏢' },
                        { num: 2, label: t('workersCerts'), icon: '👥' },
                        { num: 3, label: t('finish'), icon: '✨' }
                    ].map((s) => {
                        const isCompleted = activeStep > s.num;
                        const isActive = activeStep === s.num;

                        return (
                            <div 
                                key={s.num} 
                                onClick={() => handleStepClick(s.num)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    zIndex: 2, cursor: s.num <= maxStep ? 'pointer' : 'not-allowed',
                                    width: 120
                                }}
                            >
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: isCompleted ? 'var(--primary)' : isActive ? 'var(--bg-card)' : 'var(--bg-input)',
                                    border: `2px solid ${isActive || isCompleted ? 'var(--primary)' : 'var(--border)'}`,
                                    color: isCompleted ? '#fff' : isActive ? 'var(--primary)' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 800, fontSize: '0.95rem',
                                    boxShadow: isActive ? '0 0 10px rgba(0,191,166,0.3)' : 'none',
                                    transition: 'all 0.2s ease',
                                    fontFamily: 'var(--font-heading)'
                                }}>
                                    {isCompleted ? '✓' : s.num}
                                </div>
                                <span style={{
                                    marginTop: 6, fontSize: '0.72rem', fontWeight: isActive || isCompleted ? 700 : 500,
                                    color: isActive || isCompleted ? 'var(--text)' : 'var(--text-muted)',
                                    whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px'
                                }}>
                                    {s.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Step Content Card */}
            <div className="card" style={{ marginBottom: 20, boxShadow: 'var(--shadow-md)' }}>
                <div className="card-body" style={{ padding: isMobile ? '20px 16px' : '32px 32px' }}>
                    
                    {/* STEP 0: Welcome Screen */}
                    {activeStep === 0 && (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: '4.5rem', marginBottom: 16 }}>🛡️</div>
                            <h1 style={{
                                margin: '0 0 12px', fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 800,
                                fontFamily: 'var(--font-heading)',
                                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                                {t('welcomeToTheEznrWizard')}
                            </h1>
                            <p style={{
                                margin: '0 auto 32px', fontSize: '0.95rem', color: 'var(--text-muted)',
                                lineHeight: 1.6, maxWidth: 580
                            }}>
                                {t('quicklyConfigureYourCompanyEstablish')}
                            </p>

                            <div style={{
                                display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '0 auto'
                            }}>
                                <button className="btn btn-primary" onClick={handleNext} style={{ width: '100%', padding: '12px 24px', fontSize: '0.95rem' }}>
                                    🚀 {t('startSetup')}
                                </button>
                                <button className="btn btn-ghost" onClick={handleSkipAll} style={{ width: '100%', padding: '10px 24px', fontSize: '0.85rem' }}>
                                    {t('skipWizard')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Company Profile, Law, Branding, and Users */}
                    {activeStep === 1 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                                <span style={{ fontSize: '1.8rem' }}>🏢</span>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {t('step1DetailsBrandingUsers')}
                                    </h2>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {t('establishCompanyIdentitySelectJurisdiction')}
                                    </p>
                                </div>
                            </div>

                            {/* Section A: Područje djelovanja (BA / HR Law flag button selector) */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={labelStyle}>{t('areaOfActivityJurisdiction')}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                                    {[
                                        { code: 'BA', flag: '🇧🇦', title: 'Bosna i Hercegovina', law: 'Zakon o ZNR FBiH (79/20)' },
                                        { code: 'HR', flag: '🇭🇷', title: 'Republika Hrvatska', law: 'Zakon o ZNR (NN 71/14)' }
                                    ].map(opt => {
                                        const isSelected = companyData.country === opt.code;
                                        return (
                                            <div
                                                key={opt.code}
                                                onClick={() => setCompanyData(prev => ({ ...prev, country: opt.code }))}
                                                style={{
                                                    padding: '16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                                    background: isSelected ? 'rgba(0,191,166,0.06)' : 'var(--bg-input)',
                                                    display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s',
                                                }}
                                            >
                                                <span style={{ fontSize: '2.2rem' }}>{opt.flag}</span>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? 'var(--primary)' : 'var(--text)' }}>
                                                        {isSelected ? '✓ ' : ''}{opt.title}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                        {opt.law}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section B: Company Basic Info */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={labelStyle}>{t('basicCompanyInfo')}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('companyName1')}</label>
                                        <input 
                                            className="form-input" 
                                            value={companyData.naziv} 
                                            onChange={e => setCompanyData(prev => ({ ...prev, naziv: e.target.value }))}
                                            placeholder="npr. Kakao d.o.o."
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('companyIdOptional')}</label>
                                        <input 
                                            className="form-input" 
                                            value={companyData.oib} 
                                            onChange={e => setCompanyData(prev => ({ ...prev, oib: e.target.value }))}
                                            placeholder={companyData.country === 'HR' ? '11 znamenki' : '13 znamenki'}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('adresa')}</label>
                                        <input className="form-input" value={companyData.adresa} onChange={e => setCompanyData(prev => ({ ...prev, adresa: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('mjesto')}</label>
                                        <input className="form-input" value={companyData.mjesto} onChange={e => setCompanyData(prev => ({ ...prev, mjesto: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('postanskiBroj')}</label>
                                        <input className="form-input" value={companyData.postanskiBroj} onChange={e => setCompanyData(prev => ({ ...prev, postanskiBroj: e.target.value }))} />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('direktor')}</label>
                                        <input className="form-input" value={companyData.direktor} onChange={e => setCompanyData(prev => ({ ...prev, direktor: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('safetyOfficer1')}</label>
                                        <input className="form-input" value={companyData.strucnoLice} onChange={e => setCompanyData(prev => ({ ...prev, strucnoLice: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label" style={{ fontSize: '0.78rem' }}>{t('telefon')}</label>
                                        <input className="form-input" value={companyData.telefon} onChange={e => setCompanyData(prev => ({ ...prev, telefon: e.target.value }))} />
                                    </div>
                                </div>
                            </div>

                            {/* Section C: Branding & Identity (Logo upload & custom theme colors) */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={labelStyle}>{t('identityBrandingOptional')}</div>
                                <div style={{ 
                                    display: 'flex', gap: 20, padding: 16, background: 'var(--bg-input)', 
                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', flexWrap: 'wrap' 
                                }}>
                                    {/* Logo picker */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 300px' }}>
                                        <div style={{
                                            width: 72, height: 72, borderRadius: 'var(--radius-sm)',
                                            background: '#fff', border: '1px solid var(--border)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            overflow: 'hidden', flexShrink: 0
                                        }}>
                                            {companyData.logo ? (
                                                <img src={companyData.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                            ) : (
                                                <span style={{ fontSize: '1.8rem' }}>🖼️</span>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>
                                                {t('logoFirme')}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button className="btn btn-outline btn-sm" onClick={() => logoInputRef.current?.click()} style={{ position: 'relative' }}>
                                                    📁 {t('selectImage')}
                                                    <input 
                                                        type="file" 
                                                        ref={logoInputRef} 
                                                        onChange={handleLogoChange} 
                                                        accept="image/*" 
                                                        style={{ display: 'none' }} 
                                                    />
                                                </button>
                                                {companyData.logo && (
                                                    <button className="btn btn-danger btn-sm" onClick={() => setCompanyData(prev => ({ ...prev, logo: '' }))}>
                                                        🗑️
                                                    </button>
                                                )}
                                            </div>
                                            {logoError && <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: 4 }}>⚠️ {logoError}</div>}
                                        </div>
                                    </div>

                                    {/* Color presets selector */}
                                    <div style={{ flex: '1 1 300px' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>
                                            {t('appThemePdfAccentColor')}
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            {BRAND_COLORS.map(c => {
                                                const isSel = accentColor === c.value;
                                                return (
                                                    <button
                                                        key={c.value}
                                                        onClick={() => setAccentColor(c.value)}
                                                        title={c.name}
                                                        style={{
                                                            width: 32, height: 32, borderRadius: '50%',
                                                            background: c.value, border: isSel ? '3px solid var(--text)' : '2px solid transparent',
                                                            boxShadow: isSel ? '0 0 8px rgba(0,0,0,0.3)' : 'none',
                                                            cursor: 'pointer', transition: 'all 0.1s ease',
                                                            position: 'relative'
                                                        }}
                                                    >
                                                        {isSel && <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 700, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>✓</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section D: User Assignments */}
                            {potentialUsers.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                    <div style={labelStyle}>{t('assignCompanyAccessToUsers')}</div>
                                    <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {t('selectUsersWhoAreAllowed')}
                                    </p>
                                    <div style={{ 
                                        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10,
                                        background: 'var(--bg-input)', padding: 16, borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)', maxHeight: 150, overflowY: 'auto'
                                    }}>
                                        {potentialUsers.map(u => {
                                            const isChecked = assignedUserIds.includes(u.id);
                                            return (
                                                <label 
                                                    key={u.id}
                                                    style={{ 
                                                        display: 'flex', alignItems: 'center', gap: 10, 
                                                        fontSize: '0.8rem', cursor: 'pointer', padding: '6px 8px',
                                                        borderRadius: 6, background: isChecked ? 'var(--bg-card)' : 'transparent',
                                                        border: `1px solid ${isChecked ? 'var(--border)' : 'transparent'}`,
                                                        transition: 'background 0.1s'
                                                    }}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked}
                                                        onChange={() => toggleUserAssignment(u.id)}
                                                    />
                                                    <div>
                                                        <span style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</span>
                                                        <span style={{ 
                                                            marginLeft: 6, fontSize: '0.68rem', padding: '1px 5px', 
                                                            borderRadius: 4, background: 'var(--border-light)', color: 'var(--text-muted)' 
                                                        }}>
                                                            {u.role}
                                                        </span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {/* STEP 2: Unified Workers & Certificates Onboarding */}
                    {activeStep === 2 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                                <span style={{ fontSize: '1.8rem' }}>👥</span>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {t('step2OnboardWorkersDocuments')}
                                    </h2>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {t('uploadWorkersAndCertificatesFrom')}
                                    </p>
                                </div>
                            </div>

                            {/* Sub-tab selection */}
                            <div style={{ 
                                display: 'flex', gap: 8, marginBottom: 20, 
                                borderBottom: '1px solid var(--border-light)', paddingBottom: 10 
                            }}>
                                <button 
                                    className={`btn btn-sm ${onboardTab === 'excel' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setOnboardTab('excel')}
                                >
                                    📥 {t('excelImport')}
                                </button>
                                <button 
                                    className={`btn btn-sm ${onboardTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setOnboardTab('manual')}
                                >
                                    ✍️ {t('manualEntry')}
                                </button>
                            </div>

                            {/* Excel Import Option */}
                            {onboardTab === 'excel' && (
                                <div style={{ marginBottom: 24 }}>
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) processExcelFile(file); }}
                                        style={{
                                            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                                            background: dragOver ? 'var(--primary-glow)' : 'var(--bg-input)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: '36px 20px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            marginBottom: 16
                                        }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            onChange={(e) => { const file = e.target.files?.[0]; if (file) processExcelFile(file); }} 
                                            accept=".xlsx, .xls"
                                            style={{ display: 'none' }}
                                        />
                                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📥</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 4 }}>
                                            {excelFile ? excelFile.name : (t('dragDropExcelFileHere'))}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {t('uploadAnExcelTemplateContaining')}
                                        </div>
                                    </div>

                                    {/* Preview parsed data */}
                                    {excelPreview && (
                                        <div style={{ 
                                            padding: 16, background: 'rgba(33,150,243,0.05)', 
                                            border: '1px solid rgba(33,150,243,0.15)', borderRadius: 'var(--radius-md)',
                                            marginBottom: 16
                                        }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text)' }}>
                                                📊 {t('dataFoundForImport')}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                <span>👥 Radnici: <strong>{excelPreview.workers?.length || 0}</strong></span>
                                                <span>🏢 Org. jedinice: <strong>{excelPreview.ouRows?.length || 0}</strong></span>
                                                <span>💼 Radna mjesta: <strong>{excelPreview.wpRows?.length || 0}</strong></span>
                                                <span>📜 Uvjerenja: <strong>{excelPreview.certs?.length || 0}</strong></span>
                                                <span>👨‍⚕️ Ljekarski: <strong>{excelPreview.medExams?.length || 0}</strong></span>
                                                <span>🦺 OZO zaduženja: <strong>{excelPreview.ppe?.length || 0}</strong></span>
                                            </div>
                                            <button 
                                                className="btn btn-primary btn-sm" 
                                                onClick={handleImportExcel} 
                                                style={{ marginTop: 14 }}
                                            >
                                                ⚡ {t('confirmImportAllData')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Manual Entry Option */}
                            {onboardTab === 'manual' && (
                                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20, marginBottom: 24 }}>
                                    
                                    {/* Manual Worker Form */}
                                    <div style={{ 
                                        background: 'var(--bg-input)', padding: 16, borderRadius: 'var(--radius-md)', 
                                        border: '1px solid var(--border)' 
                                    }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
                                            👥 {t('dodajNovogRadnika')}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <input 
                                                className="form-input" 
                                                value={manualWorker.ime} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, ime: e.target.value }))}
                                                placeholder={t('ime1')}
                                            />
                                            <input 
                                                className="form-input" 
                                                value={manualWorker.prezime} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, prezime: e.target.value }))}
                                                placeholder={t('lastName1')}
                                            />
                                            <input 
                                                className="form-input" 
                                                value={manualWorker.jmbg} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, jmbg: e.target.value }))}
                                                placeholder={companyData.country === 'HR' ? 'OIB (opcionalno)' : 'JMBG (opcionalno)'}
                                            />
                                            <input 
                                                className="form-input" 
                                                value={manualWorker.radnoMjesto} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, radnoMjesto: e.target.value }))}
                                                placeholder={t('workplaceEgDriver')}
                                            />
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.72rem' }}>{t('datumRoenja1')}</label>
                                                <input 
                                                    className="form-input" 
                                                    type="date"
                                                    value={manualWorker.datumRodenja} 
                                                    onChange={e => setManualWorker(prev => ({ ...prev, datumRodenja: e.target.value }))}
                                                />
                                            </div>
                                            <button className="btn btn-primary btn-sm" onClick={handleAddWorkerManual} style={{ marginTop: 6 }}>
                                                ➕ {t('addWorker')}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Manual Doc Form */}
                                    <div style={{ 
                                        background: 'var(--bg-input)', padding: 16, borderRadius: 'var(--radius-md)', 
                                        border: '1px solid var(--border)' 
                                    }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 6 }}>
                                            📜 {t('addCertificateExam')}
                                        </div>
                                        {addedWorkers.length === 0 ? (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '30px 10px' }}>
                                                {t('pleaseAddAtLeastOne')}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                <select 
                                                    className="form-select"
                                                    value={manualDoc.workerId}
                                                    onChange={e => setManualDoc(prev => ({ ...prev, workerId: e.target.value }))}
                                                >
                                                    <option value="">{t('selectWorker')}</option>
                                                    {addedWorkers.map(w => (
                                                        <option key={w.id} value={w.id}>{w.ime} {w.prezime}</option>
                                                    ))}
                                                </select>
                                                <select 
                                                    className="form-select"
                                                    value={manualDoc.docType}
                                                    onChange={e => setManualDoc(prev => ({ ...prev, docType: e.target.value }))}
                                                >
                                                    <option value="cert">📜 {t('safetyCert')}</option>
                                                    <option value="exam">👨‍⚕️ {t('ljekarskiPregled1')}</option>
                                                </select>
                                                <input 
                                                    className="form-input"
                                                    value={manualDoc.naziv}
                                                    onChange={e => setManualDoc(prev => ({ ...prev, naziv: e.target.value }))}
                                                    placeholder={manualDoc.docType === 'cert' ? (t('certName')) : (t('examType1'))}
                                                />
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.72rem' }}>{t('date2')}</label>
                                                        <input type="date" className="form-input" value={manualDoc.datum} onChange={e => setManualDoc(prev => ({ ...prev, datum: e.target.value }))} />
                                                    </div>
                                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.72rem' }}>{t('vrijediDo')}</label>
                                                        <input type="date" className="form-input" value={manualDoc.vrijediDo} onChange={e => setManualDoc(prev => ({ ...prev, vrijediDo: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <select 
                                                    className="form-select"
                                                    value={manualDoc.sposobnost}
                                                    onChange={e => setManualDoc(prev => ({ ...prev, sposobnost: e.target.value }))}
                                                >
                                                    <option value="Sposoban">{t('sposoban')}</option>
                                                    <option value="Uvjetno sposoban">{t('uvjetnoSposoban')}</option>
                                                    <option value="Nesposoban">{t('nesposoban')}</option>
                                                </select>
                                                <button className="btn btn-primary btn-sm" onClick={handleAddDocManual} style={{ marginTop: 6 }}>
                                                    ➕ {t('addDocument')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}

                            {/* Success Notification */}
                            {importMsg && (
                                <div style={{ 
                                    padding: '10px 14px', background: 'rgba(34,197,94,0.06)', 
                                    border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)',
                                    color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600,
                                    marginBottom: 16
                                }}>
                                    ✅ {importMsg}
                                </div>
                            )}

                            {/* Loaded Lists Display */}
                            {(addedWorkers.length > 0 || addedDocs.length > 0) && (
                                <div style={{ marginTop: 16 }}>
                                    {/* List tabs */}
                                    <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                                        <button 
                                            onClick={() => setListTab('workers')}
                                            style={{ 
                                                background: 'none', border: 'none', 
                                                color: listTab === 'workers' ? 'var(--primary)' : 'var(--text-muted)',
                                                fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', 
                                                letterSpacing: '0.5px', cursor: 'pointer',
                                                borderBottom: listTab === 'workers' ? '2px solid var(--primary)' : '2px solid transparent',
                                                paddingBottom: 4
                                            }}
                                        >
                                            👥 {t('workers1').replace('{0}', addedWorkers.length)}
                                        </button>
                                        <button 
                                            onClick={() => setListTab('docs')}
                                            style={{ 
                                                background: 'none', border: 'none', 
                                                color: listTab === 'docs' ? 'var(--primary)' : 'var(--text-muted)',
                                                fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', 
                                                letterSpacing: '0.5px', cursor: 'pointer',
                                                borderBottom: listTab === 'docs' ? '2px solid var(--primary)' : '2px solid transparent',
                                                paddingBottom: 4
                                            }}
                                        >
                                            📜 {t('documents1').replace('{0}', addedDocs.length)}
                                        </button>
                                    </div>

                                    <div style={{ 
                                        maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-light)', 
                                        borderRadius: 'var(--radius-md)', background: 'var(--bg-input)'
                                    }}>
                                        {listTab === 'workers' ? (
                                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                                        <th style={{ padding: '8px 12px' }}>{t('imeIPrezime1')}</th>
                                                        <th style={{ padding: '8px 12px' }}>{companyData.country === 'HR' ? 'OIB' : 'JMBG'}</th>
                                                        <th style={{ padding: '8px 12px' }}>{t('radnoMjesto')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {addedWorkers.map((w, idx) => (
                                                        <tr key={w.id || idx} style={{ borderBottom: idx < addedWorkers.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{w.ime} {w.prezime}</td>
                                                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{w.jmbg || w.oib || '—'}</td>
                                                            <td style={{ padding: '8px 12px' }}>{getById(COLLECTIONS.WORKPLACES, w.radnoMjestoId)?.naziv || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                                        <th style={{ padding: '8px 12px' }}>{t('radnik1')}</th>
                                                        <th style={{ padding: '8px 12px' }}>{t('documentTitle1')}</th>
                                                        <th style={{ padding: '8px 12px' }}>{t('datum')}</th>
                                                        <th style={{ padding: '8px 12px' }}>{t('vrijediDo')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {addedDocs.map((d, idx) => (
                                                        <tr key={d.id || idx} style={{ borderBottom: idx < addedDocs.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                                            <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d.workerName}</td>
                                                            <td style={{ padding: '8px 12px' }}>{d.docType === 'exam' ? '👨‍⚕️' : '📜'} {d.naziv || d.ime}</td>
                                                            <td style={{ padding: '8px 12px' }}>{d.datum || d.datumPregleda || '—'}</td>
                                                            <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{d.vrijediDo || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {/* STEP 3: Completion Screen */}
                    {activeStep === 3 && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{ fontSize: '5rem', marginBottom: 16, animation: 'fadeIn 0.5s ease' }}>🎉</div>
                            <h2 style={{
                                margin: '0 0 12px', fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 800,
                                fontFamily: 'var(--font-heading)', color: 'var(--success)'
                            }}>
                                {t('setupCompletedSuccessfully')}
                            </h2>
                            <p style={{
                                margin: '0 auto 32px', fontSize: '0.92rem', color: 'var(--text-muted)',
                                lineHeight: 1.6, maxWidth: 520
                            }}>
                                {t('yourCompanyIsReadyAll')}
                            </p>

                            <button className="btn btn-primary" onClick={handleFinish} style={{ padding: '12px 32px', fontSize: '0.95rem' }}>
                                📊 {t('goToDashboard')}
                            </button>
                        </div>
                    )}

                </div>

                {/* Footer Navigation Bar */}
                {activeStep > 0 && activeStep < 3 && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '16px 24px', borderTop: '1px solid var(--border-light)',
                        background: 'var(--bg-card)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)'
                    }}>
                        <button className="btn btn-ghost" onClick={handleBack}>
                            ← {t('prethodni2')}
                        </button>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-ghost btn-sm" onClick={handleSkipStep} style={{ color: 'var(--text-muted)' }}>
                                {t('skipStep')}
                            </button>
                            <button className="btn btn-primary" onClick={handleNext}>
                                {activeStep === 2 ? (t('finish1')) : (t('saveContinue'))} →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* General Skip/Exit option at the bottom */}
            {activeStep > 0 && activeStep < 3 && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button 
                        onClick={handleSkipAll} 
                        style={{ 
                            background: 'none', border: 'none', color: 'var(--text-muted)', 
                            fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' 
                        }}
                    >
                        {t('exitAndSkipWizard')}
                    </button>
                </div>
            )}
        </div>
    );
}
