'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/hooks/useDialog';
import {
    getAll, getById, create, createMass, update, COLLECTIONS
} from '@/lib/dataStore';
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

export default function EmptyDashboard({ onComplete }) {
    const router = useRouter();
    const { lang } = useLanguage();
    const { activeCompanyId } = useAuth();
    const { alert, confirm, DialogRenderer } = useDialog();
    const bs = lang !== 'en';

    const [activeStep, setActiveStep] = useState(0);
    const [maxStep, setMaxStep] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    // Form States
    const [companyData, setCompanyData] = useState({
        naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '',
        postanskiBroj: '', telefon: '', email: '', direktor: '', strucnoLice: '', logo: '', country: 'BA'
    });
    const [logoError, setLogoError] = useState('');

    // Workers state
    const [workerTab, setWorkerTab] = useState('manual'); // manual | excel
    const [manualWorker, setManualWorker] = useState({
        ime: '', prezime: '', jmbg: '', oib: '', radnoMjesto: '', datumRodenja: ''
    });
    const [addedWorkers, setAddedWorkers] = useState([]);
    
    // Excel Import States
    const [excelFile, setExcelFile] = useState(null);
    const [excelPreview, setExcelPreview] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [importSuccessMsg, setImportSuccessMsg] = useState('');
    const fileInputRef = useRef(null);

    // Cert state
    const [certData, setCertData] = useState({
        workerId: '', docType: 'cert', naziv: '', oznaka: '', datum: '', vrijediDo: '', sposobnost: 'Sposoban'
    });
    const [addedCerts, setAddedCerts] = useState([]);

    // Detect mobile
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Load initial company details
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
            }
            // Load already existing workers if any (for safety, though usually 0)
            const cw = getAll(COLLECTIONS.WORKERS);
            setAddedWorkers(cw);
        }
    }, [activeCompanyId]);

    // Track steps visited
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
            // Save company details
            if (!companyData.naziv) {
                await alert(bs ? 'Naziv tvrtke je obavezan!' : 'Company name is required!');
                return;
            }
            if (!companyData.oib) {
                await alert(bs ? 'OIB / ID broj je obavezan!' : 'Company ID is required!');
                return;
            }
            try {
                update(COLLECTIONS.COMPANIES, activeCompanyId, companyData);
                // Also trigger native custom event for reload
                window.dispatchEvent(new CustomEvent('eznr:data-synced'));
            } catch (err) {
                console.error(err);
            }
            setActiveStep(2);
            setMaxStep(Math.max(maxStep, 2));
        } else if (activeStep === 2) {
            setActiveStep(3);
            setMaxStep(Math.max(maxStep, 3));
        } else if (activeStep === 3) {
            setActiveStep(4);
            setMaxStep(Math.max(maxStep, 4));
        }
    };

    const handleBack = () => {
        if (activeStep > 0) {
            setActiveStep(activeStep - 1);
        }
    };

    const handleSkipStep = () => {
        if (activeStep < 4) {
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
            bs 
                ? 'Jeste li sigurni da želite preskočiti čarobnjak? Uvijek možete ručno unijeti podatke kasnije.' 
                : 'Are you sure you want to skip the wizard? You can always enter the data manually later.'
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
            setLogoError(bs ? 'Logo mora biti manji od 2MB' : 'Logo must be under 2MB');
            return;
        }
        setLogoError('');
        const reader = new FileReader();
        reader.onload = () => {
            setCompanyData(prev => ({ ...prev, logo: reader.result }));
        };
        reader.onerror = () => {
            setLogoError(bs ? 'Greška pri čitanju datoteke' : 'Error reading file');
        };
        reader.readAsDataURL(file);
    };

    // --- STEP 2: Add Worker Manually ---
    const handleAddWorkerManual = async () => {
        if (!manualWorker.ime || !manualWorker.prezime) {
            await alert(bs ? 'Ime i prezime su obavezni!' : 'First name and last name are required!');
            return;
        }

        // Find or create workplace
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

        const workerPayload = {
            ime: manualWorker.ime.trim(),
            prezime: manualWorker.prezime.trim(),
            jmbg: manualWorker.jmbg.trim(),
            oib: manualWorker.oib.trim(),
            datumRodenja: manualWorker.datumRodenja,
            radnoMjestoId,
            aktivan: true,
            companyId: activeCompanyId
        };

        const newWorker = create(COLLECTIONS.WORKERS, workerPayload);
        setAddedWorkers(prev => [...prev, newWorker]);
        
        // Auto-select this worker in the next step to save time
        setCertData(prev => ({ ...prev, workerId: newWorker.id }));

        setManualWorker({
            ime: '', prezime: '', jmbg: '', oib: '', radnoMjesto: '', datumRodenja: ''
        });

        // Trigger sync
        window.dispatchEvent(new CustomEvent('eznr:data-synced'));
    };

    // --- STEP 2: Excel Parser ---
    const processExcelFile = (file) => {
        setExcelFile(file);
        setImportSuccessMsg('');
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

        // Add saved workers to local state list
        const updatedWorkers = getAll(COLLECTIONS.WORKERS);
        setAddedWorkers(updatedWorkers);

        // Auto select first imported worker for next step
        if (updatedWorkers.length > 0) {
            setCertData(prev => ({ ...prev, workerId: updatedWorkers[0].id }));
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

        setImportSuccessMsg(
            bs 
                ? `Uspješno uvezeno: ${newWList.length} radnika, ${newCerts.length} uvjerenja, ${newMedExams.length} pregleda!` 
                : `Successfully imported: ${newWList.length} workers, ${newCerts.length} certificates, ${newMedExams.length} medical exams!`
        );

        setExcelFile(null);
        setExcelPreview(null);

        // Trigger sync
        window.dispatchEvent(new CustomEvent('eznr:data-synced'));
    };

    // --- STEP 3: Add Certificate/Exam ---
    const handleAddCert = async () => {
        if (!certData.workerId) {
            await alert(bs ? 'Molimo odaberite radnika!' : 'Please select a worker!');
            return;
        }
        if (!certData.naziv) {
            await alert(bs ? 'Naziv dokumenta / pregleda je obavezan!' : 'Document name is required!');
            return;
        }
        if (!certData.datum) {
            await alert(bs ? 'Datum je obavezan!' : 'Date is required!');
            return;
        }

        const selectedWorker = getById(COLLECTIONS.WORKERS, certData.workerId);
        const companyId = activeCompanyId;

        if (certData.docType === 'cert') {
            const payload = {
                workerId: certData.workerId,
                companyId,
                naziv: certData.naziv.trim(),
                ime: certData.naziv.trim(),
                oznaka: certData.oznaka.trim(),
                datum: certData.datum,
                vrijediDo: certData.vrijediDo,
                sposobnost: certData.sposobnost,
                upisao: 'Onboarding Wizard'
            };
            const newDoc = create(COLLECTIONS.CERTIFICATES, payload);
            setAddedCerts(prev => [...prev, { ...newDoc, workerName: `${selectedWorker.ime} ${selectedWorker.prezime}` }]);
        } else {
            const payload = {
                workerId: certData.workerId,
                companyId,
                tipPregleda: certData.naziv.trim(),
                datumPregleda: certData.datum,
                vrijediDo: certData.vrijediDo,
                rezultat: certData.sposobnost,
                zdravstvenaUstanova: '',
                doktorIme: '',
                ogranicenja: ''
            };
            const newDoc = create(COLLECTIONS.MEDICAL_EXAMS, payload);
            setAddedCerts(prev => [...prev, { ...newDoc, naziv: certData.naziv.trim(), workerName: `${selectedWorker.ime} ${selectedWorker.prezime}`, docType: 'exam' }]);
        }

        setCertData(prev => ({
            ...prev, naziv: '', oznaka: '', datum: '', vrijediDo: '', sposobnost: 'Sposoban'
        }));

        // Trigger sync
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
                    marginBottom: 32, position: 'relative', padding: '0 10px'
                }}>
                    {/* Stepper line */}
                    <div style={{
                        position: 'absolute', top: 20, left: 24, right: 24, height: 2,
                        background: 'var(--border-light)', zIndex: 1
                    }} />
                    {/* Active Stepper line */}
                    <div style={{
                        position: 'absolute', top: 20, left: 24,
                        width: `${((activeStep - 1) / 3) * 100}%`, height: 2,
                        background: 'var(--primary)', zIndex: 1, transition: 'width 0.3s ease'
                    }} />

                    {[
                        { num: 1, label: bs ? 'Firma' : 'Company', icon: '🏢' },
                        { num: 2, label: bs ? 'Radnici' : 'Workers', icon: '👥' },
                        { num: 3, label: bs ? 'Dokumenti' : 'Documents', icon: '📜' },
                        { num: 4, label: bs ? 'Završi' : 'Finish', icon: '✨' }
                    ].map((s) => {
                        const isCompleted = activeStep > s.num;
                        const isActive = activeStep === s.num;
                        const isFuture = activeStep < s.num;

                        return (
                            <div 
                                key={s.num} 
                                onClick={() => handleStepClick(s.num)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    zIndex: 2, cursor: s.num <= maxStep ? 'pointer' : 'not-allowed',
                                    width: 70
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
                                {bs ? 'Dobrodošli u eZNR čarobnjak!' : 'Welcome to the eZNR Wizard!'}
                            </h1>
                            <p style={{
                                margin: '0 auto 32px', fontSize: '0.95rem', color: 'var(--text-muted)',
                                lineHeight: 1.6, maxWidth: 580
                            }}>
                                {bs
                                    ? 'Ovaj brzi vodič pomoći će vam da postavite osnovne podatke i pustite sustav u rad u 3 jednostavna koraka. Možete unijeti sve odmah ili preskočiti bilo koji korak i završiti kasnije.'
                                    : 'This quick guide will help you set up essential data and launch the system in 3 simple steps. You can enter everything now or skip any step and complete it later.'}
                            </p>

                            <div style={{
                                display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '0 auto'
                            }}>
                                <button className="btn btn-primary" onClick={handleNext} style={{ width: '100%', padding: '12px 24px', fontSize: '0.95rem' }}>
                                    🚀 {bs ? 'Započni postavljanje' : 'Start Setup'}
                                </button>
                                <button className="btn btn-ghost" onClick={handleSkipAll} style={{ width: '100%', padding: '10px 24px', fontSize: '0.85rem' }}>
                                    {bs ? 'Preskoči čarobnjak' : 'Skip Wizard'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Company Profile Form */}
                    {activeStep === 1 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                                <span style={{ fontSize: '1.8rem' }}>🏢</span>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {bs ? 'Korak 1: Podaci o tvrtki' : 'Step 1: Company Details'}
                                    </h2>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {bs ? 'Unesite osnovne podatke o vašoj firmi koji će se koristiti u izvještajima.' : 'Enter basic company info which will be used in reports.'}
                                    </p>
                                </div>
                            </div>

                            {/* Logo Upload Section */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 20, padding: 16,
                                background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 24,
                                flexWrap: 'wrap'
                            }}>
                                <div style={{
                                    width: 80, height: 80, borderRadius: 'var(--radius-sm)',
                                    background: '#fff', border: '1px solid var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden', flexShrink: 0
                                }}>
                                    {companyData.logo ? (
                                        <img src={companyData.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    ) : (
                                        <span style={{ fontSize: '2rem', color: 'var(--text-muted)' }}>🖼️</span>
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 180 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4 }}>
                                        {bs ? 'Logo tvrtke' : 'Company Logo'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                                        {bs ? 'Prikazuje se na upitnicima i PDF dokumentima. Preporučeno: prozirni PNG ispod 2MB.' : 'Appears on questionnaires and PDFs. Recommended: transparent PNG under 2MB.'}
                                    </div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()} style={{ position: 'relative' }}>
                                            📁 {bs ? 'Učitaj sliku' : 'Upload Image'}
                                            <input 
                                                type="file" 
                                                ref={fileInputRef} 
                                                onChange={handleLogoChange} 
                                                accept="image/*" 
                                                style={{ display: 'none' }} 
                                            />
                                        </button>
                                        {companyData.logo && (
                                            <button className="btn btn-danger btn-sm" onClick={() => setCompanyData(prev => ({ ...prev, logo: '' }))}>
                                                🗑️ {bs ? 'Ukloni' : 'Remove'}
                                            </button>
                                        )}
                                    </div>
                                    {logoError && <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 6 }}>⚠️ {logoError}</div>}
                                </div>
                            </div>

                            {/* Company Fields */}
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Naziv tvrtke *' : 'Company Name *'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.naziv} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, naziv: e.target.value }))}
                                        placeholder="npr. Kakao d.o.o."
                                    />
                                </div>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'OIB / ID Broj *' : 'Company ID / OIB *'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.oib} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, oib: e.target.value }))}
                                        placeholder={companyData.country === 'HR' ? '11 znamenki' : '13 znamenki'}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 16, marginBottom: 16 }}>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Adresa sjedišta' : 'Address'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.adresa} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, adresa: e.target.value }))}
                                        placeholder="npr. Ulica kralja Tomislava 12"
                                    />
                                </div>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Država zakonodavstva' : 'Jurisdiction Country'}</div>
                                    <select 
                                        className="form-select" 
                                        value={companyData.country} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, country: e.target.value }))}
                                    >
                                        <option value="BA">🇧🇦 Bosna i Hercegovina</option>
                                        <option value="HR">🇭🇷 Hrvatska</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Grad / Mjesto' : 'City'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.mjesto} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, mjesto: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Poštanski broj' : 'Postal Code'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.postanskiBroj} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, postanskiBroj: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Telefon' : 'Phone'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.telefon} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, telefon: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 8 }}>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Email' : 'Email'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.email} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                                        type="email"
                                    />
                                </div>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Direktor / Zastupnik' : 'Director / Rep'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.direktor} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, direktor: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <div style={labelStyle}>{bs ? 'Stručno lice za ZNR' : 'Safety Officer'}</div>
                                    <input 
                                        className="form-input" 
                                        value={companyData.strucnoLice} 
                                        onChange={e => setCompanyData(prev => ({ ...prev, strucnoLice: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Workers Configuration */}
                    {activeStep === 2 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                                <span style={{ fontSize: '1.8rem' }}>👥</span>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {bs ? 'Korak 2: Dodajte radnike' : 'Step 2: Add Workers'}
                                    </h2>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {bs ? 'Unesite radnike ručno ili uvezite cijeli popis pomoću Excel predloška.' : 'Add workers manually or import a list using an Excel template.'}
                                    </p>
                                </div>
                            </div>

                            {/* Sub-tab selection */}
                            <div style={{ 
                                display: 'flex', gap: 8, marginBottom: 20, 
                                borderBottom: '1px solid var(--border-light)', paddingBottom: 10 
                            }}>
                                <button 
                                    className={`btn btn-sm ${workerTab === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setWorkerTab('manual')}
                                >
                                    👤 {bs ? 'Dodaj ručno' : 'Add Manually'}
                                </button>
                                <button 
                                    className={`btn btn-sm ${workerTab === 'excel' ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setWorkerTab('excel')}
                                >
                                    📥 {bs ? 'Uvezi iz Excela' : 'Excel Import'}
                                </button>
                            </div>

                            {/* Option A: Manual Setup */}
                            {workerTab === 'manual' && (
                                <div style={{ background: 'rgba(0,191,166,0.03)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px dashed rgba(0,191,166,0.2)', marginBottom: 20 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input 
                                                className="form-input" 
                                                value={manualWorker.ime} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, ime: e.target.value }))}
                                                placeholder={bs ? 'Ime radnika *' : 'First Name *'}
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input 
                                                className="form-input" 
                                                value={manualWorker.prezime} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, prezime: e.target.value }))}
                                                placeholder={bs ? 'Prezime radnika *' : 'Last Name *'}
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input 
                                                className="form-input" 
                                                value={manualWorker.jmbg} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, jmbg: e.target.value }))}
                                                placeholder={companyData.country === 'HR' ? 'OIB (11 znamenki)' : 'JMBG (13 znamenki)'}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr auto', gap: 12, alignItems: 'center' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input 
                                                className="form-input" 
                                                value={manualWorker.radnoMjesto} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, radnoMjesto: e.target.value }))}
                                                placeholder={bs ? 'Radno mjesto (npr. Zavarivač)' : 'Workplace (e.g. Welder)'}
                                            />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input 
                                                className="form-input" 
                                                type="date"
                                                value={manualWorker.datumRodenja} 
                                                onChange={e => setManualWorker(prev => ({ ...prev, datumRodenja: e.target.value }))}
                                                title={bs ? 'Datum rođenja' : 'Birth Date'}
                                            />
                                        </div>
                                        <button className="btn btn-primary" onClick={handleAddWorkerManual} style={{ whiteSpace: 'nowrap' }}>
                                            ➕ {bs ? 'Dodaj' : 'Add'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Option B: Excel Import Dropzone */}
                            {workerTab === 'excel' && (
                                <div style={{ marginBottom: 20 }}>
                                    <div
                                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={() => setDragOver(false)}
                                        onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) processExcelFile(file); }}
                                        style={{
                                            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                                            background: dragOver ? 'var(--primary-glow)' : 'var(--bg-input)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: '32px 20px',
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
                                            {excelFile ? excelFile.name : (bs ? 'Dovucite Excel datoteku ili kliknite za odabir' : 'Drag & Drop Excel file here or click to browse')}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {bs ? 'Datoteka mora pratiti eZNR uvozni predložak.' : 'File must match the eZNR import template.'}
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
                                                📊 {bs ? 'Pregled datoteke spreman:' : 'File preview ready:'}
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                                <span>👥 Radnici: <strong>{excelPreview.workers?.length || 0}</strong></span>
                                                <span>🏢 Org. jedinice: <strong>{excelPreview.ouRows?.length || 0}</strong></span>
                                                <span>💼 Radna mjesta: <strong>{excelPreview.wpRows?.length || 0}</strong></span>
                                                <span>📜 Uvjerenja: <strong>{excelPreview.certs?.length || 0}</strong></span>
                                                <span>👨‍⚕️ Ljekarski: <strong>{excelPreview.medExams?.length || 0}</strong></span>
                                            </div>
                                            <button 
                                                className="btn btn-primary btn-sm" 
                                                onClick={handleImportExcel} 
                                                style={{ marginTop: 12 }}
                                            >
                                                ⚡ {bs ? 'Potvrdi i uvezi sve' : 'Confirm & Import All'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Feedback messages */}
                            {importSuccessMsg && (
                                <div style={{ 
                                    padding: '10px 14px', background: 'rgba(34,197,94,0.06)', 
                                    border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)',
                                    color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600,
                                    marginBottom: 16
                                }}>
                                    ✅ {importSuccessMsg}
                                </div>
                            )}

                            {/* Added Workers list */}
                            {addedWorkers.length > 0 && (
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>
                                        👥 {bs ? `Dodani radnici (${addedWorkers.length}):` : `Added Workers (${addedWorkers.length}):`}
                                    </div>
                                    <div style={{ 
                                        maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border-light)', 
                                        borderRadius: 'var(--radius-md)', background: 'var(--bg-input)'
                                    }}>
                                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                                    <th style={{ padding: '8px 12px' }}>{bs ? 'Ime i prezime' : 'Name'}</th>
                                                    <th style={{ padding: '8px 12px' }}>{companyData.country === 'HR' ? 'OIB' : 'JMBG'}</th>
                                                    <th style={{ padding: '8px 12px' }}>{bs ? 'Radno mjesto' : 'Workplace'}</th>
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
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: First Certificate Form */}
                    {activeStep === 3 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                                <span style={{ fontSize: '1.8rem' }}>📜</span>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                        {bs ? 'Korak 3: Dodajte prvo uvjerenje ili pregled' : 'Step 3: Add First Certificate / Exam'}
                                    </h2>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {bs ? 'Evidentirajte uvjerenje o osposobljenosti ili ljekarski pregled za nekog od radnika.' : 'Record a safety training certificate or medical exam for one of the workers.'}
                                    </p>
                                </div>
                            </div>

                            {addedWorkers.length === 0 ? (
                                <div style={{ 
                                    padding: '16px 20px', background: 'rgba(245,158,11,0.06)', 
                                    border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)',
                                    textAlign: 'center', color: 'var(--warning)', fontWeight: 600, fontSize: '0.85rem'
                                }}>
                                    ⚠️ {bs 
                                        ? 'Nema dodanih radnika u sustavu. Vratite se na prethodni korak i dodajte barem jednog radnika da biste mu pridružili dokument.' 
                                        : 'No workers added. Go back to the previous step and add at least one worker to assign a document.'}
                                </div>
                            ) : (
                                <div>
                                    {/* Select worker row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                        <div className="form-group">
                                            <div style={labelStyle}>{bs ? 'Odaberite radnika *' : 'Select Worker *'}</div>
                                            <select 
                                                className="form-select"
                                                value={certData.workerId}
                                                onChange={e => setCertData(prev => ({ ...prev, workerId: e.target.value }))}
                                            >
                                                <option value="">{bs ? '-- Odaberite radnika --' : '-- Select Worker --'}</option>
                                                {addedWorkers.map(w => (
                                                    <option key={w.id} value={w.id}>{w.ime} {w.prezime}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <div style={labelStyle}>{bs ? 'Vrsta dokumenta' : 'Document Category'}</div>
                                            <select 
                                                className="form-select"
                                                value={certData.docType}
                                                onChange={e => setCertData(prev => ({ ...prev, docType: e.target.value }))}
                                            >
                                                <option value="cert">📜 {bs ? 'Uvjerenje o osposobljenosti (ZNR)' : 'Safety Training Cert'}</option>
                                                <option value="exam">👨‍⚕️ {bs ? 'Uvjerenje o zdravstvenoj sposobnosti (Ljekarski)' : 'Medical Examination'}</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Document Details form */}
                                    <div style={{ 
                                        background: 'var(--bg-input)', padding: 16, 
                                        borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                        marginBottom: 20 
                                    }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 16, marginBottom: 16 }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <div style={labelStyle}>{bs ? 'Naziv dokumenta / pregleda *' : 'Document / Exam Title *'}</div>
                                                <input 
                                                    className="form-input"
                                                    value={certData.naziv}
                                                    onChange={e => setCertData(prev => ({ ...prev, naziv: e.target.value }))}
                                                    placeholder={certData.docType === 'cert' ? (bs ? 'npr. Zaštita na radu (ZOS)' : 'e.g. Safety at work (ZOS)') : (bs ? 'npr. Periodični ljekarski pregled' : 'e.g. Periodic medical exam')}
                                                />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <div style={labelStyle}>{bs ? 'Oznaka / Broj' : 'Code / Number'}</div>
                                                <input 
                                                    className="form-input"
                                                    value={certData.oznaka}
                                                    onChange={e => setCertData(prev => ({ ...prev, oznaka: e.target.value }))}
                                                    placeholder="npr. UV-123/26"
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, alignItems: 'center' }}>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <div style={labelStyle}>{bs ? 'Datum izdavanja / pregleda *' : 'Issue / Exam Date *'}</div>
                                                <input 
                                                    type="date"
                                                    className="form-input"
                                                    value={certData.datum}
                                                    onChange={e => setCertData(prev => ({ ...prev, datum: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <div style={labelStyle}>{bs ? 'Vrijedi do (opcionalno)' : 'Expiry Date (optional)'}</div>
                                                <input 
                                                    type="date"
                                                    className="form-input"
                                                    value={certData.vrijediDo}
                                                    onChange={e => setCertData(prev => ({ ...prev, vrijediDo: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <div style={labelStyle}>{bs ? 'Sposobnost / Ocjena' : 'Fitness Grade'}</div>
                                                <select 
                                                    className="form-select"
                                                    value={certData.sposobnost}
                                                    onChange={e => setCertData(prev => ({ ...prev, sposobnost: e.target.value }))}
                                                >
                                                    <option value="Sposoban">{bs ? 'Sposoban' : 'Fit'}</option>
                                                    <option value="Uvjetno sposoban">{bs ? 'Uvjetno sposoban' : 'Conditionally Fit'}</option>
                                                    <option value="Nesposoban">{bs ? 'Nesposoban' : 'Unfit'}</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                                            <button className="btn btn-primary btn-sm" onClick={handleAddCert}>
                                                ➕ {bs ? 'Spremi dokument' : 'Save Document'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Added Documents list */}
                            {addedCerts.length > 0 && (
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>
                                        📜 {bs ? `Dodani dokumenti (${addedCerts.length}):` : `Added Documents (${addedCerts.length}):`}
                                    </div>
                                    <div style={{ 
                                        maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border-light)', 
                                        borderRadius: 'var(--radius-md)', background: 'var(--bg-input)'
                                    }}>
                                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                                    <th style={{ padding: '8px 12px' }}>{bs ? 'Radnik' : 'Worker'}</th>
                                                    <th style={{ padding: '8px 12px' }}>{bs ? 'Naziv dokumenta / pregleda' : 'Title'}</th>
                                                    <th style={{ padding: '8px 12px' }}>{bs ? 'Datum' : 'Date'}</th>
                                                    <th style={{ padding: '8px 12px' }}>{bs ? 'Vrijedi do' : 'Expiry'}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {addedCerts.map((c, idx) => (
                                                    <tr key={c.id || idx} style={{ borderBottom: idx < addedCerts.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.workerName}</td>
                                                        <td style={{ padding: '8px 12px' }}>{c.docType === 'exam' ? '👨‍⚕️' : '📜'} {c.naziv || c.ime}</td>
                                                        <td style={{ padding: '8px 12px' }}>{c.datum || c.datumPregleda || '—'}</td>
                                                        <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{c.vrijediDo || '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: Completion Screen */}
                    {activeStep === 4 && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <div style={{ fontSize: '5rem', marginBottom: 16, animation: 'fadeIn 0.5s ease' }}>🎉</div>
                            <h2 style={{
                                margin: '0 0 12px', fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 800,
                                fontFamily: 'var(--font-heading)', color: 'var(--success)'
                            }}>
                                {bs ? 'Postavljanje uspješno završeno!' : 'Setup Completed Successfully!'}
                            </h2>
                            <p style={{
                                margin: '0 auto 32px', fontSize: '0.92rem', color: 'var(--text-muted)',
                                lineHeight: 1.6, maxWidth: 520
                            }}>
                                {bs
                                    ? 'Vaša tvrtka je uspješno konfigurirana. Radnici i dokumenti koje ste unijeli sada su učitani na vašu nadzornu ploču za praćenje.'
                                    : 'Your company has been successfully configured. The workers and documents you entered are now loaded into your dashboard.'}
                            </p>

                            <button className="btn btn-primary" onClick={handleFinish} style={{ padding: '12px 32px', fontSize: '0.95rem' }}>
                                📊 {bs ? 'Idi na nadzornu ploču' : 'Go to Dashboard'}
                            </button>
                        </div>
                    )}

                </div>

                {/* Footer Navigation Bar */}
                {activeStep > 0 && activeStep < 4 && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '16px 24px', borderTop: '1px solid var(--border-light)',
                        background: 'var(--bg-card)', borderBottomLeftRadius: 'var(--radius-lg)', borderBottomRightRadius: 'var(--radius-lg)'
                    }}>
                        <button className="btn btn-ghost" onClick={handleBack}>
                            ← {bs ? 'Prethodno' : 'Previous'}
                        </button>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-ghost btn-sm" onClick={handleSkipStep} style={{ color: 'var(--text-muted)' }}>
                                {bs ? 'Preskoči korak' : 'Skip Step'}
                            </button>
                            <button className="btn btn-primary" onClick={handleNext}>
                                {activeStep === 3 ? (bs ? 'Završi' : 'Finish') : (bs ? 'Spremi i nastavi' : 'Save & Continue')} →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* General Skip/Exit option at the bottom */}
            {activeStep > 0 && activeStep < 4 && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <button 
                        onClick={handleSkipAll} 
                        style={{ 
                            background: 'none', border: 'none', color: 'var(--text-muted)', 
                            fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' 
                        }}
                    >
                        {bs ? 'Izađi i preskoči čarobnjak' : 'Exit and Skip Wizard'}
                    </button>
                </div>
            )}
        </div>
    );
}
