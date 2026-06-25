'use client';
import DateInput from '@/components/DateInput';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { getAll, COLLECTIONS, getActiveCompanyId, ensureCollection, create, remove, formatDate, todayISO } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { matchWorkers, confidenceLabel } from '@/lib/textMatch';
import PageHeader from '@/components/PageHeader';

const EXPORT_TRANSLATIONS = {
    bs: {
        title: 'LISTA RADNIKA SA SKENIRANOG TESTA',
        docScanned: 'Dokument skeniranog testa',
        genDate: 'Datum generisanja',
        numWorkers: 'Broj radnika',
        ime: 'Ime',
        prezime: 'Prezime',
        imeIPrezime: 'Ime i prezime',
        imeOca: 'Ime roditelja',
        jmbgOib: 'JMBG / OIB',
        datumRodenja: 'Datum rođenja',
        miestoRodenja: 'Mjesto rođenja',
        radnoMjesto: 'Radno mjesto',
        odjel: 'Odjel',
        tipTesta: 'Tip testa',
        datumTesta: 'Datum testa',
        status: 'Status',
        polozio: 'Položio',
        pao: 'Nije položio',
        paoPdf: 'Pao',
        generatedFrom: 'Generisano iz digitalne arhive eZNR',
        pageOf: 'Stranica 1 od 1',
        imeIzTesta: 'Ime iz testa (AI)',
        pronadeniRadnik: 'Pronađeni radnik (Baza)',
        odaberiRadnikaPlaceholder: '— Odaberite radnika —',
        keepName: '⚠️ Zadrži ime: "{0}" (Nije u bazi)',
        nijeUBazi: 'Nije u bazi',
        rucno: 'Ručno',
        podudaranje: 'Podudaranje',
        ukloniRed: 'Ukloni red',
        sheetName: 'Skenirani testovi radnici',
        fileName: 'Skenirani_Testovi_Izvjestaj',
        printPdf: 'Isprintaj / Snimi kao PDF',
        pohraniUArhivu: 'Pohrani testove u arhivu',
        historyTitle: 'Povijest skeniranih testova',
        savedSuccess: 'Skenirani test uspješno pohranjen!',
        datumSkeniranja: 'Datum skeniranja',
        nazivDatoteke: 'Naziv datoteke',
        velicina: 'Veličina',
        detalji: 'Prikaži detalje',
        brisi: 'Obriši',
        detaljiSkeniranogTesta: 'Detalji skeniranog testa',
        zatvori: 'Zatvori',
        confirmDeleteScan: 'Jeste li sigurni da želite obrisati ovaj skenirani test iz arhive?',
    },
    hr: {
        title: 'POPIS RADNIKA SA SKENIRANOG TESTA',
        docScanned: 'Dokument skeniranog testa',
        genDate: 'Datum generiranja',
        numWorkers: 'Broj radnika',
        ime: 'Ime',
        prezime: 'Prezime',
        imeIPrezime: 'Ime i prezime',
        imeOca: 'Ime roditelja',
        jmbgOib: 'JMBG / OIB',
        datumRodenja: 'Datum rođenja',
        miestoRodenja: 'Mjesto rođenja',
        radnoMjesto: 'Radno mjesto',
        odjel: 'Odjel',
        tipTesta: 'Tip testa',
        datumTesta: 'Datum testa',
        status: 'Status',
        polozio: 'Položio',
        pao: 'Nije položio',
        paoPdf: 'Pao',
        generatedFrom: 'Generirano iz digitalne arhive eZNR',
        pageOf: 'Stranica 1 od 1',
        imeIzTesta: 'Ime iz testa (AI)',
        pronadeniRadnik: 'Pronađeni radnik (Baza)',
        odaberiRadnikaPlaceholder: '— Odaberite radnika —',
        keepName: '⚠️ Zadrži ime: "{0}" (Nije u bazi)',
        nijeUBazi: 'Nije u bazi',
        rucno: 'Ručno',
        podudaranje: 'Podudaranje',
        ukloniRed: 'Ukloni red',
        sheetName: 'Skenirani testovi radnici',
        fileName: 'Skenirani_Testovi_Izvjestaj',
        printPdf: 'Isprintaj / Snimi kao PDF',
        pohraniUArhivu: 'Pohrani testove u arhivu',
        historyTitle: 'Povijest skeniranih testova',
        savedSuccess: 'Skenirani test uspješno pohranjen!',
        datumSkeniranja: 'Datum skeniranja',
        nazivDatoteke: 'Naziv datoteke',
        velicina: 'Veličina',
        detalji: 'Prikaži detalje',
        brisi: 'Obriši',
        detaljiSkeniranogTesta: 'Detalji skeniranog testa',
        zatvori: 'Zatvori',
        confirmDeleteScan: 'Jeste li sigurni da želite obrisati ovaj skenirani test iz arhive?',
    },
    sr: {
        title: 'LISTA RADNIKA SA SKENIRANOG TESTA',
        docScanned: 'Dokument skeniranog testa',
        genDate: 'Datum generisanja',
        numWorkers: 'Broj radnika',
        ime: 'Ime',
        prezime: 'Prezime',
        imeIPrezime: 'Ime i prezime',
        imeOca: 'Ime roditelja',
        jmbgOib: 'JMBG / OIB',
        datumRodenja: 'Datum rođenja',
        miestoRodenja: 'Mjesto rođenja',
        radnoMjesto: 'Radno mjesto',
        odjel: 'Odjel',
        tipTesta: 'Tip testa',
        datumTesta: 'Datum testa',
        status: 'Status',
        polozio: 'Položio',
        pao: 'Nije položio',
        paoPdf: 'Pao',
        generatedFrom: 'Generisano iz digitalne arhive eZNR',
        pageOf: 'Stranica 1 od 1',
        imeIzTesta: 'Ime iz testa (AI)',
        pronadeniRadnik: 'Pronađeni radnik (Baza)',
        odaberiRadnikaPlaceholder: '— Odaberite radnika —',
        keepName: '⚠️ Zadrži ime: "{0}" (Nije u bazi)',
        nijeUBazi: 'Nije u bazi',
        rucno: 'Ručno',
        podudaranje: 'Podudaranje',
        ukloniRed: 'Ukloni red',
        sheetName: 'Skenirani testovi radniki',
        fileName: 'Skenirani_Testovi_Izvještaj',
        printPdf: 'Isprintaj / Snimi kao PDF',
        pohraniUArhivu: 'Sačuvaj testove u arhivu',
        historyTitle: 'Istorija skeniranih testova',
        savedSuccess: 'Skenirani test uspešno sačuvan!',
        datumSkeniranja: 'Datum skeniranja',
        nazivDatoteke: 'Naziv datoteke',
        velicina: 'Veličina',
        detalji: 'Prikaži detalje',
        brisi: 'Obriši',
        detaljiSkeniranogTesta: 'Detalji skeniranog testa',
        zatvori: 'Zatvori',
        confirmDeleteScan: 'Da li ste sigurni da želite da obrišete ovaj skenirani test iz arhive?',
    },
    en: {
        title: 'WORKER LIST FROM SCANNED TEST',
        docScanned: 'Scanned test document',
        genDate: 'Generation date',
        numWorkers: 'Number of workers',
        ime: 'First Name',
        prezime: 'Last Name',
        imeIPrezime: 'Full Name',
        imeOca: 'Parent Name',
        jmbgOib: 'ID Number (JMBG/OIB)',
        datumRodenja: 'Date of Birth',
        miestoRodenja: 'Place of Birth',
        radnoMjesto: 'Workplace',
        odjel: 'Department',
        tipTesta: 'Test Type',
        datumTesta: 'Test Date',
        status: 'Status',
        polozio: 'Passed',
        pao: 'Failed',
        paoPdf: 'Failed',
        generatedFrom: 'Generated from eZNR digital archive',
        pageOf: 'Page 1 of 1',
        imeIzTesta: 'Name from test (AI)',
        pronadeniRadnik: 'Found worker (Database)',
        odaberiRadnikaPlaceholder: '— Select worker —',
        keepName: '⚠️ Keep name: "{0}" (Not in database)',
        nijeUBazi: 'Not in database',
        rucno: 'Manual',
        podudaranje: 'Match',
        ukloniRed: 'Remove row',
        sheetName: 'Scanned tests workers',
        fileName: 'Scanned_Tests_Report',
        printPdf: 'Print / Save as PDF',
        pohraniUArhivu: 'Save tests to archive',
        historyTitle: 'Scanned Tests History',
        savedSuccess: 'Scanned test successfully saved!',
        datumSkeniranja: 'Scan Date',
        nazivDatoteke: 'File Name',
        velicina: 'Size',
        detalji: 'View Details',
        brisi: 'Delete',
        detaljiSkeniranogTesta: 'Scanned Test Details',
        zatvori: 'Close',
        confirmDeleteScan: 'Are you sure you want to delete this scanned test from the archive?',
    },
    de: {
        title: 'MITARBEITERLISTE VOM GESCANNTEN TEST',
        docScanned: 'Gescannte Testdokument',
        genDate: 'Erstellungsdatum',
        numWorkers: 'Mitarbeiteranzahl',
        ime: 'Vorname',
        prezime: 'Nachname',
        imeIPrezime: 'Name, Vorname',
        imeOca: 'Elternteil Name',
        jmbgOib: 'Identifikationsnummer',
        datumRodenja: 'Geburtsdatum',
        miestoRodenja: 'Geburtsort',
        radnoMjesto: 'Arbeitsplatz',
        odjel: 'Abteilung',
        tipTesta: 'Testtyp',
        datumTesta: 'Testdatum',
        status: 'Status',
        polozio: 'Bestanden',
        pao: 'Nicht bestanden',
        paoPdf: 'Nicht bestanden',
        generatedFrom: 'Generiert aus dem eZNR Digitalarchiv',
        pageOf: 'Seite 1 von 1',
        imeIzTesta: 'Name aus dem Test (AI)',
        pronadeniRadnik: 'Gefundener Mitarbeiter (Datenbank)',
        odaberiRadnikaPlaceholder: '— Mitarbeiter auswählen —',
        keepName: '⚠️ Name behalten: "{0}" (Nicht in der Datenbank)',
        nijeUBazi: 'Nicht in der Datenbank',
        rucno: 'Manuell',
        podudaranje: 'Übereinstimmung',
        ukloniRed: 'Zeile entfernen',
        sheetName: 'Gescannte Tests Mitarbeiter',
        fileName: 'Gescannte_Tests_Bericht',
        printPdf: 'Drucken / Als PDF speichern',
        pohraniUArhivu: 'Tests im Archiv speichern',
        historyTitle: 'Verlauf der gescannten Tests',
        savedSuccess: 'Gescannter Test erfolgreich gespeichert!',
        datumSkeniranja: 'Scandatum',
        nazivDatoteke: 'Dateiname',
        velicina: 'Größe',
        detalji: 'Details anzeigen',
        brisi: 'Löschen',
        detaljiSkeniranogTesta: 'Details des gescannten Tests',
        zatvori: 'Schließen',
        confirmDeleteScan: 'Sind Sie sicher, dass Sie diesen gescannten Test aus dem Archiv löschen möchten?',
    },
    sl: {
        title: 'SEZNAM DELAVCEV IZ SKENIRANEGA TESTA',
        docScanned: 'Skeniran testni dokument',
        genDate: 'Datum generiranja',
        numWorkers: 'Število delavcev',
        ime: 'Ime',
        prezime: 'Priimek',
        imeIPrezime: 'Ime in priimek',
        imeOca: 'Ime starša',
        jmbgOib: 'EMŠO / Davčna št.',
        datumRodenja: 'Datum rojstva',
        miestoRodenja: 'Kraj rojstva',
        radnoMjesto: 'Delovno mesto',
        odjel: 'Oddelek',
        tipTesta: 'Tip testa',
        datumTesta: 'Datum testa',
        status: 'Status',
        polozio: 'Opravil',
        pao: 'Ni opravil',
        paoPdf: 'Ni opravil',
        generatedFrom: 'Generirano iz digitalnega arhiva eZNR',
        pageOf: 'Stran 1 od 1',
        imeIzTesta: 'Ime iz testa (AI)',
        pronadeniRadnik: 'Najden delavec (Baza)',
        odaberiRadnikaPlaceholder: '— Izberite delavca —',
        keepName: '⚠️ Obdrži ime: "{0}" (Ni v bazi)',
        nijeUBazi: 'Ni v bazi',
        rucno: 'Ročno',
        podudaranje: 'Ujemanje',
        ukloniRed: 'Odstrani vrstico',
        sheetName: 'Skenirani testi delavci',
        fileName: 'Skenirani_Testi_Porocilo',
        printPdf: 'Natisni / Shrani kot PDF',
        pohraniUArhivu: 'Shrani teste v arhiv',
        historyTitle: 'Zgodovina skeniranih testov',
        savedSuccess: 'Skeniran test uspešno shranjen!',
        datumSkeniranja: 'Datum skeniranja',
        nazivDatoteke: 'Ime datoteke',
        velicina: 'Velikost',
        detalji: 'Prikaži podrobnosti',
        brisi: 'Izbriši',
        detaljiSkeniranogTesta: 'Podrobnosti skeniranega testa',
        zatvori: 'Zapri',
        confirmDeleteScan: 'Ali ste prepričani, da želite izbrisati ta skeniran test iz arhiva?',
    }
};

function ScannedTestsPageContent() {
    const { t, lang } = useLanguage();
    const getExp = useCallback((k) => EXPORT_TRANSLATIONS[lang]?.[k] || EXPORT_TRANSLATIONS.bs[k], [lang]);
    const { alert, confirm, DialogRenderer } = useDialog();

    const [scanFile, setScanFile] = useState(null);
    const [rawFile, setRawFile] = useState(null);
    const [scanDragging, setScanDragging] = useState(false);
    const [scanSearched, setScanSearched] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [matchedRows, setMatchedRows] = useState([]);
    const scanFileRef = useRef(null);
    
    const [savedScans, setSavedScans] = useState([]);
    const [saving, setSaving] = useState(false);
    const [viewScan, setViewScan] = useState(null);
    const [modalWorkers, setModalWorkers] = useState([]);

    const loadData = useCallback(async () => {
        await ensureCollection(COLLECTIONS.SCANNED_TESTS);
        setSavedScans(getAll(COLLECTIONS.SCANNED_TESTS) || []);
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    const formatSize = (bytes) => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const handleScanFileRead = async (file) => {
        if (file.size > 10 * 1024 * 1024) { alert('Max 10MB za skenirani test!'); return; }
        
        setRawFile(file);
        setScanFile({ name: file.name, size: file.size, type: file.type });
        setAnalyzing(true);
        setScanSearched(false);
        setMatchedRows([]);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64Data = e.target.result.split(',')[1];
                const res = await fetch('https://eznr-ai-backend-757041188739.europe-west1.run.app/api/analyze-scanned-tests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Data, mimeType: file.type })
                });
                
                const result = await res.json();
                if (result.success && Array.isArray(result.workers)) {
                    const allWorkers = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false);
                    const workplaces = getAll(COLLECTIONS.WORKPLACES);
                    const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
                    const rows = result.workers.map((ext, idx) => {
                        const matches = matchWorkers(ext.extractedName, ext.birthDate || '', allWorkers);
                        const bestMatch = matches[0];
                        const hasGoodMatch = bestMatch && bestMatch.score >= 0.35;
                        const wId = hasGoodMatch ? bestMatch.worker.id : '__NOT_IN_DB__';

                        let ime = '';
                        let prezime = '';
                        let imeOca = '';
                        let jmbgOib = '';
                        let datumRodenja = '';
                        let miestoRodenja = '';
                        let radnoMjesto = '';
                        let odjel = '';

                        if (wId !== '__NOT_IN_DB__') {
                            const w = bestMatch.worker;
                            const wp = workplaces.find(x => x.id === w.radnoMjestoId) || {};
                            const ou = orgUnits.find(x => x.id === w.orgJedinicaId) || {};
                            ime = w.ime || '';
                            prezime = w.prezime || '';
                            imeOca = w.imeRoditelja || '';
                            jmbgOib = w.jmbg || w.oib || '';
                            datumRodenja = w.datumRodenja || w.datumRodjenja || '';
                            miestoRodenja = w.miestoRodenja || w.mjestoRodjenja || '';
                            radnoMjesto = wp.naziv || w.radnoMjesto || '';
                            odjel = ou.naziv || w.orgJedinica || '';
                        } else {
                            const parts = ext.extractedName.trim().split(/\s+/);
                            ime = parts[0] || '';
                            prezime = parts.slice(1).join(' ') || '';
                            datumRodenja = ext.birthDate || '';
                            miestoRodenja = ext.birthPlace || '';
                            radnoMjesto = ext.workplace || '';
                            odjel = ext.department || '';
                        }

                        return {
                            id: `row-${idx}-${Date.now()}`,
                            extractedName: ext.extractedName,
                            birthDate: ext.birthDate || '',
                            birthPlace: ext.birthPlace || '',
                            workplace: ext.workplace || '',
                            department: ext.department || '',
                            type: ext.type || '',
                            passed: ext.passed !== false,
                            selectedWorkerId: wId,
                            score: bestMatch ? bestMatch.score : 0,
                            dobMatch: bestMatch ? bestMatch.dobMatch : false,
                            ime,
                            prezime,
                            imeOca,
                            jmbgOib,
                            datumRodenja,
                            miestoRodenja,
                            radnoMjesto,
                            odjel
                        };
                    });
                    setMatchedRows(rows);
                    setScanSearched(true);
                } else {
                    alert(result.error || 'Nije uspjelo analiziranje skeniranog dokumenta.');
                }
            } catch (err) {
                console.error('Scan analysis error:', err);
                alert('Greška pri komunikaciji sa AI modelom: ' + err.message);
            } finally {
                setAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateRowWorker = (rowId, workerId) => {
        const allWorkers = getAll(COLLECTIONS.WORKERS);
        const workplaces = getAll(COLLECTIONS.WORKPLACES);
        const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
        const w = allWorkers.find(x => x.id === workerId);
        setMatchedRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            const isNotInDb = workerId === '__NOT_IN_DB__';
            
            let ime = r.ime;
            let prezime = r.prezime;
            let imeOca = r.imeOca;
            let jmbgOib = r.jmbgOib;
            let datumRodenja = r.datumRodenja;
            let miestoRodenja = r.miestoRodenja;
            let radnoMjesto = r.radnoMjesto;
            let odjel = r.odjel;

            if (!isNotInDb && w) {
                const wp = workplaces.find(x => x.id === w.radnoMjestoId) || {};
                const ou = orgUnits.find(x => x.id === w.orgJedinicaId) || {};
                ime = w.ime || '';
                prezime = w.prezime || '';
                imeOca = w.imeRoditelja || '';
                jmbgOib = w.jmbg || w.oib || '';
                datumRodenja = w.datumRodenja || w.datumRodjenja || '';
                miestoRodenja = w.miestoRodenja || w.mjestoRodjenja || '';
                radnoMjesto = wp.naziv || w.radnoMjesto || '';
                odjel = ou.naziv || w.orgJedinica || '';
            } else if (isNotInDb) {
                const parts = r.extractedName.trim().split(/\s+/);
                ime = parts[0] || '';
                prezime = parts.slice(1).join(' ') || '';
                imeOca = '';
                jmbgOib = '';
                datumRodenja = r.birthDate || '';
                miestoRodenja = r.birthPlace || '';
                radnoMjesto = r.workplace || '';
                odjel = r.department || '';
            }

            return {
                ...r,
                selectedWorkerId: workerId,
                score: isNotInDb ? 0 : (workerId ? 100 : 0),
                dobMatch: !isNotInDb && w && r.birthDate && (w.datumRodenja === r.birthDate || w.datumRodjenja === r.birthDate),
                ime,
                prezime,
                imeOca,
                jmbgOib,
                datumRodenja,
                miestoRodenja,
                radnoMjesto,
                odjel
            };
        }));
    };

    const handleUpdateRowField = (rowId, field, value) => {
        setMatchedRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            return {
                ...r,
                [field]: value
            };
        }));
    };

    const handleDeleteRow = (rowId) => {
        setMatchedRows(prev => prev.filter(r => r.id !== rowId));
    };

    const handleClearScan = () => {
        setScanFile(null);
        setRawFile(null);
        setMatchedRows([]);
        setScanSearched(false);
    };

    const handleSaveScan = async () => {
        if (matchedRows.length === 0) return;
        setSaving(true);
        try {
            const docData = {
                fileName: scanFile.name,
                fileSize: scanFile.size,
                dateScanned: todayISO(),
                workersCount: matchedRows.length,
                workers: matchedRows.map(r => ({
                    ime: r.ime || '',
                    prezime: r.prezime || '',
                    imeOca: r.imeOca || '',
                    jmbgOib: r.jmbgOib || '',
                    datumRodenja: r.datumRodenja || '',
                    miestoRodenja: r.miestoRodenja || '',
                    radnoMjesto: r.radnoMjesto || '',
                    odjel: r.odjel || '',
                    type: r.type || '',
                    passed: r.passed !== false,
                    selectedWorkerId: r.selectedWorkerId || '__NOT_IN_DB__'
                }))
            };

            await create(COLLECTIONS.SCANNED_TESTS, docData);
            await alert(getExp('savedSuccess'));
            handleClearScan();
            loadData();
        } catch (err) {
            console.error('Failed to save scanned test:', err);
            await alert('Greška pri pohranjivanju: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleViewDetails = (scan) => {
        setViewScan(scan);
        setModalWorkers(scan.workers || []);
    };

    const handleUpdateModalWorkerField = (idx, field, value) => {
        setModalWorkers(prev => {
            const copy = [...prev];
            copy[idx] = {
                ...copy[idx],
                [field]: value
            };
            return copy;
        });
    };

    const handleUpdateModalWorkerLink = (idx, workerId) => {
        const allWorkers = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false);
        const workplaces = getAll(COLLECTIONS.WORKPLACES);
        const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
        const w = allWorkers.find(x => x.id === workerId);
        setModalWorkers(prev => {
            const copy = [...prev];
            const isNotInDb = workerId === '__NOT_IN_DB__';
            
            let ime = copy[idx].ime;
            let prezime = copy[idx].prezime;
            let imeOca = copy[idx].imeOca;
            let jmbgOib = copy[idx].jmbgOib;
            let datumRodenja = copy[idx].datumRodenja;
            let miestoRodenja = copy[idx].miestoRodenja;
            let radnoMjesto = copy[idx].radnoMjesto;
            let odjel = copy[idx].odjel;

            if (!isNotInDb && w) {
                const wp = workplaces.find(x => x.id === w.radnoMjestoId) || {};
                const ou = orgUnits.find(x => x.id === w.orgJedinicaId) || {};
                ime = w.ime || '';
                prezime = w.prezime || '';
                imeOca = w.imeRoditelja || '';
                jmbgOib = w.jmbg || w.oib || '';
                datumRodenja = w.datumRodenja || w.datumRodjenja || '';
                miestoRodenja = w.miestoRodenja || w.mjestoRodjenja || '';
                radnoMjesto = wp.naziv || w.radnoMjesto || '';
                odjel = ou.naziv || w.orgJedinica || '';
            }

            copy[idx] = {
                ...copy[idx],
                selectedWorkerId: workerId,
                ime,
                prezime,
                imeOca,
                jmbgOib,
                datumRodenja,
                miestoRodenja,
                radnoMjesto,
                odjel
            };
            return copy;
        });
    };

    const handleDeleteModalRow = (idx) => {
        setModalWorkers(prev => prev.filter((_, i) => i !== idx));
    };

    const handleAddModalRow = () => {
        setModalWorkers(prev => [...prev, {
            ime: '',
            prezime: '',
            imeOca: '',
            jmbgOib: '',
            datumRodenja: '',
            miestoRodenja: '',
            radnoMjesto: '',
            odjel: '',
            type: 'ZNR',
            passed: true,
            selectedWorkerId: '__NOT_IN_DB__'
        }]);
    };

    const handleSaveModalChanges = async () => {
        try {
            const { update } = await import('@/lib/dataStore');
            const updated = {
                ...viewScan,
                workers: modalWorkers,
                workersCount: modalWorkers.length
            };
            await update(COLLECTIONS.SCANNED_TESTS, viewScan.id, updated);
            await alert(lang === 'en' ? 'Changes saved successfully!' : 'Izmjene uspješno sačuvane!');
            setViewScan(null);
            loadData();
        } catch (err) {
            console.error('Failed to save changes:', err);
            await alert('Greška pri pohranjivanju: ' + err.message);
        }
    };

    const handleModalDownloadExcel = async () => {
        const XLSX = await import('xlsx');
        const getExp = (k) => EXPORT_TRANSLATIONS[lang]?.[k] || EXPORT_TRANSLATIONS.bs[k];

        const dataRows = modalWorkers.map((row, idx) => {
            return {
                '#': idx + 1,
                [getExp('ime')]: row.ime || '',
                [getExp('prezime')]: row.prezime || '',
                [getExp('imeOca')]: row.imeOca || '—',
                [getExp('jmbgOib')]: row.jmbgOib || '—',
                [getExp('datumRodenja')]: row.datumRodenja ? formatDate(row.datumRodenja) : '—',
                [getExp('miestoRodenja')]: row.miestoRodenja || '—',
                [getExp('radnoMjesto')]: t(row.radnoMjesto?.trim()) || row.radnoMjesto || '—',
                [getExp('odjel')]: t(row.odjel?.trim()) || row.odjel || '—',
                [getExp('tipTesta')]: t(row.type?.trim()) || row.type || '—',
                [getExp('status')]: row.passed ? getExp('polozio') : getExp('pao')
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, getExp('sheetName'));
        XLSX.writeFile(wb, `${getExp('fileName')}_${viewScan.fileName.replace(/\.[^/.]+$/, "")}_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handleModalDownloadPDF = () => {
        const companyId = getActiveCompanyId();
        let company = { naziv: '', adresa: '', oib: '', jib: '' };
        if (companyId && companyId !== 'all') {
            const allComps = getAll('companies');
            const c = allComps.find(x => x.id === companyId);
            if (c) company = c;
        }

        const getExp = (k) => EXPORT_TRANSLATIONS[lang]?.[k] || EXPORT_TRANSLATIONS.bs[k];

        const rowsHtml = modalWorkers.map((row, idx) => {
            const fullName = `${row.ime || ''} ${row.prezime || ''}`.trim() || row.extractedName || '';
            const parentName = row.imeOca || '—';
            const nationalId = row.jmbgOib || '—';
            const birthD = row.datumRodenja ? formatDate(row.datumRodenja) : '—';
            const birthP = row.miestoRodenja || '—';
            const workplaceName = t(row.radnoMjesto?.trim()) || row.radnoMjesto || '—';
            const deptName = t(row.odjel?.trim()) || row.odjel || '—';
            const testType = t(row.type?.trim()) || row.type || '—';

            return `
                <tr>
                    <td style="color:#aaa; text-align:center">${idx + 1}</td>
                    <td style="font-weight:600">${fullName}</td>
                    <td>${parentName}</td>
                    <td>${nationalId}</td>
                    <td>${birthD}</td>
                    <td>${birthP}</td>
                    <td>${workplaceName}</td>
                    <td>${deptName}</td>
                    <td>${testType}</td>
                    <td><span class="badge ${row.passed ? 'badge-ok' : 'badge-danger'}">${row.passed ? getExp('polozio') : getExp('paoPdf')}</span></td>
                </tr>
            `;
        }).join('');

        const companyName = company.naziv || company.name || 'eZNR Firma';
        const docTitle = getExp('title');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8"/>
                <title>${docTitle}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a2e; padding: 20mm; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #00BFA6; padding-bottom: 12px; margin-bottom: 20px; }
                    .brand { font-size: 16pt; font-weight: 800; color: #00BFA6; }
                    .company-info { text-align: right; font-size: 8pt; color: #555; }
                    .title { font-size: 14pt; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; }
                    .meta { font-size: 9pt; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th { background: #f5f6fa; font-size: 8pt; font-weight: 700; text-transform: uppercase; padding: 8px 10px; border-bottom: 2px solid #e0e0e0; text-align: left; }
                    td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 9pt; }
                    tr:nth-child(even) td { background: #fafbfd; }
                    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 7.5pt; font-weight: 700; }
                    .badge-ok { background: #e8f5e9; color: #2e7d32; }
                    .badge-danger { background: #ffebee; color: #c62828; }
                    .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8pt; color: #888; }
                    .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: #00BFA6; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
                    @media print {
                        .print-btn { display: none; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="brand">eZNR</div>
                        <div style="font-size: 9pt; font-weight: bold; margin-top: 4px;">${companyName}</div>
                    </div>
                    <div class="company-info">
                        ${company.adresa ? `<div>${company.adresa}</div>` : ''}
                        ${company.mjesto ? `<div>${company.mjesto}</div>` : ''}
                        ${company.jib || company.oib ? `<div>JIB/OIB: ${company.jib || company.oib}</div>` : ''}
                    </div>
                </div>
                <div class="title">${docTitle}</div>
                <div class="meta">
                    ${getExp('docScanned')}: <strong>${viewScan.fileName}</strong><br/>
                    ${getExp('genDate')}: <strong>${new Date().toLocaleDateString('hr-HR')}</strong> · ${getExp('numWorkers')}: <strong>${modalWorkers.length}</strong>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 4%">#</th>
                            <th>${getExp('imeIPrezime')}</th>
                            <th>${getExp('imeOca')}</th>
                            <th>${getExp('jmbgOib')}</th>
                            <th>${getExp('datumRodenja')}</th>
                            <th>${getExp('miestoRodenja')}</th>
                            <th>${getExp('radnoMjesto')}</th>
                            <th>${getExp('odjel')}</th>
                            <th>${getExp('tipTesta')}</th>
                            <th>${getExp('status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    <span>${getExp('generatedFrom')}</span>
                    <span>${getExp('pageOf')}</span>
                </div>
                <button class="print-btn" onclick="window.print()">🖨️ ${getExp('printPdf')}</button>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            alert('Molimo dozvolite popup prozore za ispis.');
        }
    };

    const handleDownloadExcel = async () => {
        const XLSX = await import('xlsx');
        const getExp = (k) => EXPORT_TRANSLATIONS[lang]?.[k] || EXPORT_TRANSLATIONS.bs[k];

        const dataRows = matchedRows.map((row, idx) => {
            return {
                '#': idx + 1,
                [getExp('ime')]: row.ime || '',
                [getExp('prezime')]: row.prezime || '',
                [getExp('imeOca')]: row.imeOca || '—',
                [getExp('jmbgOib')]: row.jmbgOib || '—',
                [getExp('datumRodenja')]: row.datumRodenja ? formatDate(row.datumRodenja) : '—',
                [getExp('miestoRodenja')]: row.miestoRodenja || '—',
                [getExp('radnoMjesto')]: t(row.radnoMjesto?.trim()) || row.radnoMjesto || '—',
                [getExp('odjel')]: t(row.odjel?.trim()) || row.odjel || '—',
                [getExp('imeIPrezime') + ' (AI)']: row.extractedName,
                [getExp('tipTesta')]: t(row.type?.trim()) || row.type || '—',
                [getExp('status')]: row.passed ? getExp('polozio') : getExp('pao')
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, getExp('sheetName'));
        XLSX.writeFile(wb, `${getExp('fileName')}_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handleDownloadPDF = () => {
        const companyId = getActiveCompanyId();
        let company = { naziv: '', adresa: '', oib: '', jib: '' };
        if (companyId && companyId !== 'all') {
            const allComps = getAll('companies');
            const c = allComps.find(x => x.id === companyId);
            if (c) company = c;
        }

        const getExp = (k) => EXPORT_TRANSLATIONS[lang]?.[k] || EXPORT_TRANSLATIONS.bs[k];

        const rowsHtml = matchedRows.map((row, idx) => {
            const fullName = `${row.ime || ''} ${row.prezime || ''}`.trim() || row.extractedName;
            const parentName = row.imeOca || '—';
            const nationalId = row.jmbgOib || '—';
            const birthD = row.datumRodenja ? formatDate(row.datumRodenja) : '—';
            const birthP = row.miestoRodenja || '—';
            const workplaceName = t(row.radnoMjesto?.trim()) || row.radnoMjesto || '—';
            const deptName = t(row.odjel?.trim()) || row.odjel || '—';
            const testType = t(row.type?.trim()) || row.type || '—';

            return `
                <tr>
                    <td style="color:#aaa; text-align:center">${idx + 1}</td>
                    <td style="font-weight:600">${fullName}</td>
                    <td>${parentName}</td>
                    <td>${nationalId}</td>
                    <td>${birthD}</td>
                    <td>${birthP}</td>
                    <td>${workplaceName}</td>
                    <td>${deptName}</td>
                    <td>${testType}</td>
                    <td><span class="badge ${row.passed ? 'badge-ok' : 'badge-danger'}">${row.passed ? getExp('polozio') : getExp('paoPdf')}</span></td>
                </tr>
            `;
        }).join('');

        const companyName = company.naziv || company.name || 'eZNR Firma';
        const docTitle = getExp('title');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8"/>
                <title>${docTitle}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a2e; padding: 20mm; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #00BFA6; padding-bottom: 12px; margin-bottom: 20px; }
                    .brand { font-size: 16pt; font-weight: 800; color: #00BFA6; }
                    .company-info { text-align: right; font-size: 8pt; color: #555; }
                    .title { font-size: 14pt; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; }
                    .meta { font-size: 9pt; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th { background: #f5f6fa; font-size: 8pt; font-weight: 700; text-transform: uppercase; padding: 8px 10px; border-bottom: 2px solid #e0e0e0; text-align: left; }
                    td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 9pt; }
                    tr:nth-child(even) td { background: #fafbfd; }
                    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 7.5pt; font-weight: 700; }
                    .badge-ok { background: #e8f5e9; color: #2e7d32; }
                    .badge-danger { background: #ffebee; color: #c62828; }
                    .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8pt; color: #888; }
                    .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: #00BFA6; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
                    @media print {
                        .print-btn { display: none; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="brand">eZNR</div>
                        <div style="font-size: 9pt; font-weight: bold; margin-top: 4px;">${companyName}</div>
                    </div>
                    <div class="company-info">
                        ${company.adresa ? `<div>${company.adresa}</div>` : ''}
                        ${company.mjesto ? `<div>${company.mjesto}</div>` : ''}
                        ${company.jib || company.oib ? `<div>JIB/OIB: ${company.jib || company.oib}</div>` : ''}
                    </div>
                </div>
                <div class="title">${docTitle}</div>
                <div class="meta">
                    ${getExp('docScanned')}: <strong>${scanFile ? scanFile.name : '—'}</strong><br/>
                    ${getExp('genDate')}: <strong>${new Date().toLocaleDateString('hr-HR')}</strong> · ${getExp('numWorkers')}: <strong>${matchedRows.length}</strong>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 4%">#</th>
                            <th>${getExp('imeIPrezime')}</th>
                            <th>${getExp('imeOca')}</th>
                            <th>${getExp('jmbgOib')}</th>
                            <th>${getExp('datumRodenja')}</th>
                            <th>${getExp('miestoRodenja')}</th>
                            <th>${getExp('radnoMjesto')}</th>
                            <th>${getExp('odjel')}</th>
                            <th>${getExp('tipTesta')}</th>
                            <th>${getExp('status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    <span>${getExp('generatedFrom')}</span>
                    <span>${getExp('pageOf')}</span>
                </div>
                <button class="print-btn" onclick="window.print()">🖨️ ${getExp('printPdf')}</button>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            alert('Molimo dozvolite popup prozore za ispis.');
        }
    };

    // Calculate page statistics
    const totalScans = savedScans.length;
    const totalWorkers = savedScans.reduce((acc, scan) => acc + (scan.workersCount || scan.workers?.length || 0), 0);
    
    let totalCount = 0;
    let passedCount = 0;
    savedScans.forEach(scan => {
        (scan.workers || []).forEach(w => {
            totalCount++;
            if (w.passed) passedCount++;
        });
    });
    const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 100;

    let znrCount = 0;
    let zopCount = 0;
    savedScans.forEach(scan => {
        (scan.workers || []).forEach(w => {
            if (w.type === 'ZNR') znrCount++;
            else if (w.type === 'ZOP') zopCount++;
        });
    });

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader icon="📝" title={t('scannedTests') || 'Skenirani testovi'} />

            {/* Visual KPI Stats Cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    flex: '1 1 200px',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>📄</span>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
                            {totalScans}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 4 }}>
                            {lang === 'en' ? 'Total Scanned Docs' : 'Ukupno skeniranih dok.'}
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    flex: '1 1 200px',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>👷</span>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
                            {totalWorkers}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 4 }}>
                            {lang === 'en' ? 'Processed Workers' : 'Obrađeni radnici'}
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    flex: '1 1 200px',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>🎯</span>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: passRate >= 80 ? 'var(--success)' : 'var(--danger)', lineHeight: 1.1 }}>
                            {passRate}%
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 4 }}>
                            {lang === 'en' ? 'Pass Rate' : 'Stopa prolaznosti'}
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    flex: '1 1 200px',
                    boxShadow: 'var(--shadow-sm)'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>🎓</span>
                    <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
                            {znrCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>ZNR</span> · {zopCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>ZOP</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 4 }}>
                            {lang === 'en' ? 'Tests by Type' : 'Testovi po vrstama'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-body">
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                        {t('ubaciSkeniraniTest')}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                        Aplikacija će analizirati skenirane testove pomoću AI, izdvojiti imena radnika i uporediti ih sa bazom podataka.
                    </div>

                    {/* Drop zone */}
                    <div
                        style={{
                            border: scanDragging ? '2px solid var(--primary)' : `2px dashed ${scanFile ? 'var(--success)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-md)', padding: '28px 20px', textAlign: 'center',
                            background: scanDragging ? 'rgba(0,191,166,0.04)' : scanFile ? 'rgba(34,197,94,0.04)' : 'transparent',
                            cursor: 'pointer', transition: 'all 0.2s', marginBottom: 20,
                        }}
                        onDragOver={e => { e.preventDefault(); setScanDragging(true); }}
                        onDragLeave={() => setScanDragging(false)}
                        onDrop={e => { e.preventDefault(); setScanDragging(false); const f = e.dataTransfer.files[0]; if (f) handleScanFileRead(f); }}
                        onClick={() => scanFileRef.current?.click()}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>
                            {analyzing ? '⏳' : scanFile ? '✅' : scanDragging ? '📂' : '📄'}
                        </div>
                        {analyzing ? (
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Analiziranje dokumenta pomoću AI...</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                    Čitanje teksta i prepoznavanje imena radnika iz skeniranog testa...
                                </div>
                            </div>
                        ) : scanFile ? (
                            <div>
                                <div style={{ fontWeight: 700, color: 'var(--success)' }}>{scanFile.name}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                    {formatSize(scanFile.size)} · {t('klikniZaPromjenu')}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                    {scanDragging
                                        ? (t('ispustiTestOvdje'))
                                        : (t('prevuciSkeniraniTestIliKlikni'))}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                    PDF, JPG, PNG — max 10MB
                                </div>
                            </div>
                        )}
                        <input ref={scanFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files[0]; if (f) handleScanFileRead(f); e.target.value = ''; }}
                            disabled={analyzing} />
                    </div>

                    {scanFile && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button 
                                className="btn btn-outline" 
                                onClick={() => { if (rawFile) handleScanFileRead(rawFile); }} 
                                disabled={analyzing}
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                🔄 {lang === 'en' ? 'Rescan Document' : 'Ponovo analiziraj'}
                            </button>
                            <button className="btn btn-ghost" onClick={handleClearScan} disabled={analyzing}>
                                ❌ {t('pocisti')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Table */}
            {scanSearched && (
                <div className="card">
                    <div className="card-body" style={{ paddingBottom: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 20px' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Rezultati prepoznavanja radnika ({matchedRows.length})
                            </div>
                            {matchedRows.length > 0 && (
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button className="btn btn-outline btn-sm" onClick={handleDownloadExcel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        📊 Izvezi u Excel
                                    </button>
                                    <button className="btn btn-outline btn-sm" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                                        🖨️ Isprintaj / PDF
                                    </button>
                                </div>
                            )}
                        </div>

                        {matchedRows.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔎</div>
                                <div style={{ fontWeight: 600 }}>Nema pronađenih radnika u testu</div>
                                <div style={{ fontSize: '0.82rem', marginTop: 4 }}>AI nije uspio detektovati niti jedno ime iz dokumenta.</div>
                            </div>
                        ) : (
                            <>
                                <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '2%' }}>#</th>
                                                <th style={{ width: '12%' }}>{getExp('imeIzTesta')}</th>
                                                <th style={{ width: '14%' }}>{getExp('pronadeniRadnik')}</th>
                                                <th style={{ width: '8%' }}>{getExp('ime')}</th>
                                                <th style={{ width: '8%' }}>{getExp('prezime')}</th>
                                                <th style={{ width: '6%' }}>{getExp('imeOca')}</th>
                                                <th style={{ width: '8%' }}>{getExp('jmbgOib')}</th>
                                                <th style={{ width: '8%' }}>{getExp('datumRodenja')}</th>
                                                <th style={{ width: '8%' }}>{getExp('miestoRodenja')}</th>
                                                <th style={{ width: '9%' }}>{getExp('radnoMjesto')}</th>
                                                <th style={{ width: '9%' }}>{getExp('odjel')}</th>
                                                <th style={{ width: '6%' }}>{getExp('tipTesta')}</th>
                                                <th style={{ width: '6%' }}>{getExp('status')}</th>
                                                <th style={{ width: '4%' }}>{getExp('podudaranje')}</th>
                                                <th style={{ width: '2%' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matchedRows.map((row, idx) => {
                                                const allWorkers = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false);
                                                const isNotInDb = row.selectedWorkerId === '__NOT_IN_DB__';
                                                const isManual = row.score === 100 && !row.dobMatch;
                                                const conf = isNotInDb
                                                    ? { emoji: '👤', label: getExp('nijeUBazi'), color: 'var(--text-muted)' }
                                                    : isManual
                                                        ? { emoji: '✍️', label: getExp('rucno'), color: 'var(--text)' }
                                                        : confidenceLabel(row.score);
                                                
                                                return (
                                                    <tr key={row.id}>
                                                        <td>{idx + 1}</td>
                                                        <td style={{ fontWeight: 600 }}>{row.extractedName}</td>
                                                        <td>
                                                            <select 
                                                                className="form-select" 
                                                                value={row.selectedWorkerId}
                                                                onChange={e => handleUpdateRowWorker(row.id, e.target.value)}
                                                                style={{ minWidth: 150, padding: '4px 8px', fontSize: '0.82rem' }}
                                                            >
                                                                <option value="">{getExp('odaberiRadnikaPlaceholder')}</option>
                                                                <option value="__NOT_IN_DB__">{getExp('keepName').replace('{0}', row.extractedName)}</option>
                                                                {allWorkers.map(w => (
                                                                    <option key={w.id} value={w.id}>
                                                                        {w.ime} {w.prezime} {w.jmbg ? `(JMBG: ${w.jmbg})` : w.oib ? `(OIB: ${w.oib})` : ''}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                value={row.ime || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'ime', e.target.value)}
                                                                style={{ minWidth: 80, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                value={row.prezime || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'prezime', e.target.value)}
                                                                style={{ minWidth: 80, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                value={row.imeOca || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'imeOca', e.target.value)}
                                                                style={{ minWidth: 70, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                value={row.jmbgOib || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'jmbgOib', e.target.value)}
                                                                style={{ minWidth: 90, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                type="date"
                                                                value={row.datumRodenja || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'datumRodenja', e.target.value)}
                                                                style={{ minWidth: 110, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)', border: '1px solid var(--border)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                value={row.miestoRodenja || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'miestoRodenja', e.target.value)}
                                                                style={{ minWidth: 95, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                value={row.radnoMjesto || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'radnoMjesto', e.target.value)}
                                                                style={{ minWidth: 100, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                value={row.odjel || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'odjel', e.target.value)}
                                                                style={{ minWidth: 100, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <input 
                                                                className="form-input" 
                                                                value={row.type || ''} 
                                                                onChange={e => handleUpdateRowField(row.id, 'type', e.target.value)}
                                                                style={{ minWidth: 80, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            />
                                                        </td>
                                                        <td>
                                                            <select 
                                                                className="form-select" 
                                                                value={row.passed ? 'true' : 'false'}
                                                                onChange={e => handleUpdateRowField(row.id, 'passed', e.target.value === 'true')}
                                                                style={{ minWidth: 80, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                            >
                                                                <option value="true">{getExp('polozio')}</option>
                                                                <option value="false">{getExp('pao')}</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <span title={conf.label} style={{ fontSize: '1rem' }}>{conf.emoji}</span>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: conf.color }}>{conf.label}</span>
                                                                {row.dobMatch && <span style={{ color: 'var(--success)', fontSize: '0.72rem', fontWeight: 600 }} title="Datum rođenja se podudara">🎂</span>}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button 
                                                                className="btn btn-ghost btn-sm btn-icon" 
                                                                style={{ color: 'var(--danger)', padding: 0 }}
                                                                onClick={() => handleDeleteRow(row.id)}
                                                                title={getExp('ukloniRed')}
                                                            >
                                                                🗑️
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', borderTop: '1px solid var(--border-light)', gap: 12, marginTop: 16 }}>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={handleSaveScan} 
                                        disabled={saving}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        💾 {saving ? 'Pohranjivanje...' : getExp('pohraniUArhivu')}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* History Table */}
            <div className="card" style={{ marginTop: 24 }}>
                <div className="card-body">
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                        {getExp('historyTitle')}
                    </div>
                    
                    {savedScans.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 20px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                            {lang === 'en' ? 'No saved scanned tests found.' : 'Nema pohranjenih skeniranih testova.'}
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '5%' }}>#</th>
                                        <th style={{ width: '45%' }}>{getExp('nazivDatoteke')}</th>
                                        <th style={{ width: '20%' }}>{getExp('datumSkeniranja')}</th>
                                        <th style={{ width: '15%' }}>{getExp('numWorkers')}</th>
                                        <th style={{ width: '15%', textAlign: 'right' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {savedScans.map((scan, idx) => (
                                        <tr key={scan.id}>
                                            <td>{idx + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{scan.fileName}</td>
                                            <td>{scan.dateScanned ? formatDate(scan.dateScanned) : '—'}</td>
                                            <td>{scan.workersCount || (scan.workers?.length || 0)}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                    <button 
                                                        className="btn btn-outline btn-sm" 
                                                        onClick={() => handleViewDetails(scan)}
                                                    >
                                                        👁️ {getExp('detalji')}
                                                    </button>
                                                    <button 
                                                        className="btn btn-ghost btn-sm btn-icon" 
                                                        style={{ color: 'var(--danger)' }}
                                                        onClick={() => handleDeleteScan(scan.id)}
                                                        title={getExp('brisi')}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* View Details Modal */}
            {viewScan && (
                <div 
                    style={{ 
                        position: 'fixed', 
                        inset: 0, 
                        zIndex: 10000, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        background: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(2px)' 
                    }}
                    onClick={e => { if (e.target === e.currentTarget) setViewScan(null); }}
                >
                    <div 
                        style={{ 
                            background: 'var(--bg-card)', 
                            borderRadius: 'var(--radius-lg)', 
                            padding: 28, 
                            width: '95%', 
                            maxWidth: 1200, 
                            maxHeight: '90vh', 
                            overflow: 'auto', 
                            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', 
                            border: '1px solid var(--border)' 
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                                📂 {getExp('detaljiSkeniranogTesta')}: {viewScan.fileName}
                            </h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setViewScan(null)}>
                                ❌
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {getExp('datumSkeniranja')}: <strong>{viewScan.dateScanned ? formatDate(viewScan.dateScanned) : '—'}</strong> · {getExp('numWorkers')}: <strong>{modalWorkers.length}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="btn btn-outline btn-sm" onClick={handleModalDownloadExcel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    📊 Izvezi u Excel
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={handleModalDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                                    🖨️ Isprintaj / PDF
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={handleAddModalRow} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    ➕ {lang === 'en' ? 'Add Worker' : 'Dodaj radnika'}
                                </button>
                            </div>
                        </div>

                        <div className="data-table-wrapper" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '2%' }}>#</th>
                                        <th style={{ width: '15%' }}>{getExp('pronadeniRadnik')}</th>
                                        <th style={{ width: '9%' }}>{getExp('ime')}</th>
                                        <th style={{ width: '9%' }}>{getExp('prezime')}</th>
                                        <th style={{ width: '7%' }}>{getExp('imeOca')}</th>
                                        <th style={{ width: '9%' }}>{getExp('jmbgOib')}</th>
                                        <th style={{ width: '9%' }}>{getExp('datumRodenja')}</th>
                                        <th style={{ width: '9%' }}>{getExp('miestoRodenja')}</th>
                                        <th style={{ width: '10%' }}>{getExp('radnoMjesto')}</th>
                                        <th style={{ width: '10%' }}>{getExp('odjel')}</th>
                                        <th style={{ width: '8%' }}>{getExp('tipTesta')}</th>
                                        <th style={{ width: '8%' }}>{getExp('status')}</th>
                                        <th style={{ width: '2%' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modalWorkers.map((w, idx) => {
                                        const allWorkers = getAll(COLLECTIONS.WORKERS).filter(wk => wk.aktivan !== false);
                                        return (
                                            <tr key={idx}>
                                                <td>{idx + 1}</td>
                                                <td>
                                                    <select 
                                                        className="form-select" 
                                                        value={w.selectedWorkerId || '__NOT_IN_DB__'}
                                                        onChange={e => handleUpdateModalWorkerLink(idx, e.target.value)}
                                                        style={{ minWidth: 150, padding: '4px 8px', fontSize: '0.82rem' }}
                                                    >
                                                        <option value="">{getExp('odaberiRadnikaPlaceholder')}</option>
                                                        <option value="__NOT_IN_DB__">{getExp('nijeUBazi')}</option>
                                                        {allWorkers.map(wk => (
                                                            <option key={wk.id} value={wk.id}>
                                                                {wk.ime} {wk.prezime} {wk.jmbg ? `(JMBG: ${wk.jmbg})` : wk.oib ? `(OIB: ${wk.oib})` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        value={w.ime || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'ime', e.target.value)}
                                                        style={{ minWidth: 80, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        value={w.prezime || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'prezime', e.target.value)}
                                                        style={{ minWidth: 80, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        value={w.imeOca || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'imeOca', e.target.value)}
                                                        style={{ minWidth: 70, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        value={w.jmbgOib || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'jmbgOib', e.target.value)}
                                                        style={{ minWidth: 90, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        type="date"
                                                        value={w.datumRodenja || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'datumRodenja', e.target.value)}
                                                        style={{ minWidth: 110, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)', border: '1px solid var(--border)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        value={w.miestoRodenja || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'miestoRodenja', e.target.value)}
                                                        style={{ minWidth: 95, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        value={w.radnoMjesto || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'radnoMjesto', e.target.value)}
                                                        style={{ minWidth: 100, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        value={w.odjel || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'odjel', e.target.value)}
                                                        style={{ minWidth: 100, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input 
                                                        className="form-input" 
                                                        value={w.type || ''} 
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'type', e.target.value)}
                                                        style={{ minWidth: 80, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <select 
                                                        className="form-select" 
                                                        value={w.passed ? 'true' : 'false'}
                                                        onChange={e => handleUpdateModalWorkerField(idx, 'passed', e.target.value === 'true')}
                                                        style={{ minWidth: 80, padding: '4px 8px', fontSize: '0.82rem', background: 'var(--bg-input)' }}
                                                    >
                                                        <option value="true">{getExp('polozio')}</option>
                                                        <option value="false">{getExp('pao')}</option>
                                                    </select>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button 
                                                        className="btn btn-ghost btn-sm btn-icon" 
                                                        style={{ color: 'var(--danger)', padding: 0 }}
                                                        onClick={() => handleDeleteModalRow(idx)}
                                                        title={getExp('ukloniRed')}
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
                            <button className="btn btn-primary" onClick={handleSaveModalChanges}>
                                💾 {lang === 'en' ? 'Save Changes' : 'Sačuvaj izmjene'}
                            </button>
                            <button className="btn btn-outline" onClick={() => setViewScan(null)}>
                                {getExp('zatvori')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import SubscriptionGate from '@/components/SubscriptionGate';

export default function ScannedTestsPage() {
    return (
        <SubscriptionGate moduleKey="scannedTests">
            <ScannedTestsPageContent />
        </SubscriptionGate>
    );
}
