'use client';
import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { create, createMass, getAll, COLLECTIONS } from '@/lib/dataStore';
import * as XLSX from 'xlsx';
import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Template column definitions ───────────────────────────────
const WORKER_COLS = [
    'ime', 'prezime', 'imeRoditelja', 'jmbg', 'oib', 'spol',
    'datumRodenja', 'miestoRodenja', 'datumZaposlenja', 'datumOdlaska',
    'stazDoDolaska', 'koef', 'radnoMjesto', 'orgJedinica',
    'lokacija', 'evidencijskiBroj', 'telefonTvrtki', 'mobitel',
    'email', 'ulica', 'kucniBroj', 'mjesto', 'napomena',
    'aktivan', 'vanjskiSuradnik'
];
const CERT_COLS = [
    'radnik_ime', 'radnik_prezime', 'radnik_jmbg',
    'naziv', 'oznaka', 'tipUvjerenja', 'datum', 'vrijediDo', 'sposobnost', 'ogranicenje'
];
const PPE_COLS = [
    'radnik_ime', 'radnik_prezime', 'radnik_jmbg',
    'naziv', 'datumZaduzenja', 'datumRazduzenja', 'kolicina'
];
const EQUIP_COLS = [
    'naziv', 'vrsta', 'tip', 'tvBroj', 'invBroj',
    'proizvodjac', 'godinaProizvodnje', 'posljednji', 'iduci', 'status'
];
const MEDEXAM_COLS = [
    'radnik_ime', 'radnik_prezime', 'radnik_jmbg',
    'tipPregleda', 'datum', 'vrijediDo', 'rezultat', 'napomena'
];
const OU_COLS = ['naziv', 'opis'];
const WP_COLS = ['naziv', 'opis'];
const VEH_COLS = [
    'registracija', 'marka', 'model', 'godinaProizvodnje', 'tip', 'vin', 'boja',
    'datumRegistracije', 'registracijaIstice', 'datumTehnickogPregleda', 'tehnickiIstice',
    'osiguranjeIstice', 'vatrogasniAparatDatum', 'prvaPomocIstice',
    'radnik_ime', 'radnik_prezime', 'radnik_jmbg', 'status', 'napomena'
];
const EXT_COLS = [
    'serijskiBroj', 'tip', 'tezina', 'lokacija',
    'datumNabavke', 'zadnjiServis', 'sljedeciServis',
    'odgovornaOsoba', 'status', 'napomena'
];
const HYD_COLS = [
    'oznaka', 'tip', 'lokacija',
    'datumZadnjegPregleda', 'sljedeciPregled',
    'status', 'napomena'
];
function generateTemplate() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Org. Jedinice
    const wsOU = XLSX.utils.aoa_to_sheet([
        OU_COLS,
        ['Produkcija', 'Glavni pogon za proizvodnju'],
    ]);
    wsOU['!cols'] = OU_COLS.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, wsOU, 'OrgJedinice');

    // Sheet 2: Radna Mjesta
    const wsWP = XLSX.utils.aoa_to_sheet([
        WP_COLS,
        ['Serviser', 'Održavanje mašina i sistema'],
    ]);
    wsWP['!cols'] = WP_COLS.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, wsWP, 'RadnaMjesta');

    // Sheet 3: Radnici
    const wsW = XLSX.utils.aoa_to_sheet([
        WORKER_COLS,
        ['Pero', 'Perić', 'Ivanov', '0101123456789', '', 'M', '1985-01-01', 'Sarajevo',
         '2020-06-01', '', '5g2mj0d', '1.2', 'Serviser', 'Produkcija',
         'Pogon A', 'EV-001', '+387 33 123 456', '+387 61 123 456',
         'pero@firma.ba', 'Aleja lipa 5', '3A', 'Sarajevo', '',
         'DA', 'NE'],
    ]);
    wsW['!cols'] = WORKER_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsW, 'Radnici');

    // Sheet 2: Uvjerenja
    const wsC = XLSX.utils.aoa_to_sheet([
        CERT_COLS,
        ['Pero', 'Perić', '0101123456789',
         'Osposobljavanje ZNR', 'ZNR-001', 'ZNR', '2023-01-15', '2025-01-15', 'Sposoban', ''],
    ]);
    wsC['!cols'] = CERT_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsC, 'Uvjerenja');

    // Sheet 3: OZO
    const wsP = XLSX.utils.aoa_to_sheet([
        PPE_COLS,
        ['Pero', 'Perić', '0101123456789', 'Zaštitna kaciga', '2023-03-01', '', '1'],
    ]);
    wsP['!cols'] = PPE_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsP, 'OZO');

    // Sheet 4: Oprema
    const wsE = XLSX.utils.aoa_to_sheet([
        EQUIP_COLS,
        ['Mostna dizalica MD-200', 'Dizalice', 'Mostna', 'MD-200-2020', 'INV-001',
         'GANZ', '2019', '2025-06-15', '2026-06-15', 'active'],
    ]);
    wsE['!cols'] = EQUIP_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsE, 'Oprema');

    // Sheet 5: Ljekarski pregledi
    const wsM = XLSX.utils.aoa_to_sheet([
        MEDEXAM_COLS,
        ['Pero', 'Perić', '0101123456789', 'Periodični', '2024-06-15', '2026-06-15', 'Sposoban', ''],
    ]);
    wsM['!cols'] = MEDEXAM_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsM, 'Ljekarski');

    // Sheet 6: Vozila
    const wsV = XLSX.utils.aoa_to_sheet([
        VEH_COLS,
        ['A12-B-345', 'VW', 'Golf 8', '2022', 'osobno', 'WVW123456789', 'Bijela',
         '2022-05-10', '2024-05-10', '2023-05-10', '2024-05-10',
         '2024-05-10', '2025-05-10', '2027-05-10',
         'Pero', 'Perić', '0101123456789', 'aktivan', 'Službeno vozilo'],
    ]);
    wsV['!cols'] = VEH_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsV, 'Vozila');

    // Sheet 7: PP Aparati
    const wsF = XLSX.utils.aoa_to_sheet([
        EXT_COLS,
        ['PP-001', 'prah', '6', 'Hala 1 - Ulaz',
         '2021-02-10', '2023-02-10', '2024-02-10',
         'Mujo Mujić', 'ispravan', 'Redovni servis'],
    ]);
    wsF['!cols'] = EXT_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsF, 'PPAparati');

    // Sheet 8: Hidranti
    const wsH = XLSX.utils.aoa_to_sheet([
        HYD_COLS,
        ['H-01', 'unutarnji', 'Hala 1 - Sjever',
         '2023-08-15', '2024-02-15',
         'ispravan', 'Testiran pritisak'],
    ]);
    wsH['!cols'] = HYD_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsH, 'Hidranti');

    // Sheet 9: Upute
    const wsI = XLSX.utils.aoa_to_sheet([
        ['UPUTE ZA POPUNJAVANJE'],
        [],
        ['RADNICI sheet:'],
        ['  - aktivan: DA / NE'],
        ['  - vanjskiSuradnik: DA / NE'],
        ['  - spol: M / F'],
        ['  - datumZaposlenja format: YYYY-MM-DD (npr. 2024-01-15)'],
        ['  - stazDoDolaska format: 5g2mj4d (godina/mj/dan) ili prazno'],
        [],
        ['UVJERENJA sheet:'],
        ['  - Povezi radnika s radnik_jmbg ILI radnik_ime + radnik_prezime'],
        ['  - datum/vrijediDo format: YYYY-MM-DD'],
        ['  - sposobnost: Sposoban / Nesposoban / Uvjetno sposoban'],
        [],
        ['OZO sheet:'],
        ['  - Povezi radnika s radnik_jmbg ILI radnik_ime + radnik_prezime'],
        ['  - datumZaduzenja format: YYYY-MM-DD'],
        ['  - datumRazduzenja: ostavite prazno ako nije razduženo'],
        ['  - kolicina: cijeli broj (npr. 1)'],
        [],
        ['OPREMA sheet:'],
        ['  - naziv: obavezno polje'],
        ['  - status: active / expired / inactive'],
        ['  - datumi format: YYYY-MM-DD'],
        [],
        ['LJEKARSKI sheet:'],
        ['  - Povezi radnika s radnik_jmbg ILI radnik_ime + radnik_prezime'],
        ['  - tipPregleda: Prethodni / Periodični / Izvanredni / Kontrolni'],
        ['  - rezultat: Sposoban / Nesposoban / Uvjetno sposoban'],
        [],
        ['ORG JEDINICE & RADNA MJESTA:'],
        ['  - naziv mora biti tacan kako bi se radnici uspjesno povezali'],
    ]);
    wsI['!cols'] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsI, 'Upute');

    XLSX.writeFile(wb, 'eZNR_Import_Template.xlsx');
}

function generateExport(companyId) {
    const wb = XLSX.utils.book_new();
    const allWp = getAll(COLLECTIONS.WORKPLACES);
    const allOU = getAll(COLLECTIONS.ORG_UNITS);

    // 0a. Org Jedinice
    const ouRows = [OU_COLS];
    allOU.filter(ou => companyId === 'all' || ou.companyId === companyId).forEach(ou => {
        ouRows.push([ou.naziv || '', ou.opis || '']);
    });
    const wsOU = XLSX.utils.aoa_to_sheet(ouRows);
    wsOU['!cols'] = OU_COLS.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, wsOU, 'OrgJedinice');

    // 0b. Radna Mjesta
    const wpRows = [WP_COLS];
    allWp.filter(wp => companyId === 'all' || wp.companyId === companyId).forEach(wp => {
        wpRows.push([wp.naziv || '', wp.opis || '']);
    });
    const wsWP = XLSX.utils.aoa_to_sheet(wpRows);
    wsWP['!cols'] = WP_COLS.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(wb, wsWP, 'RadnaMjesta');

    // 1. Radnici
    const wRows = [WORKER_COLS];
    const workers = getAll(COLLECTIONS.WORKERS).filter(w => companyId === 'all' || w.companyId === companyId);
    workers.forEach(w => {
        wRows.push([
            w.ime || '', w.prezime || '', w.imeRoditelja || '', w.jmbg || '', w.oib || '', w.spol || '',
            w.datumRodenja || '', w.miestoRodenja || '', w.datumZaposlenja || '', w.datumOdlaska || '',
            w.stazDoDolaska || '', w.koef || '',
            // Resolve radnoMjesto and orgJedinica names for export
            (() => { const wp = allWp.find(x => x.id === w.radnoMjestoId); return wp?.naziv || ''; })(),
            (() => { const ou = allOU.find(x => x.id === w.orgJedinicaId); return ou?.naziv || ''; })(),
            w.lokacija || '', w.evidencijskiBroj || '', w.telefonTvrtki || '', w.mobitel || '',
            w.email || '', w.ulica || '', w.kucniBroj || '', w.mjesto || '', w.napomena || '',
            w.aktivan ? 'DA' : 'NE', w.vanjskiSuradnik ? 'DA' : 'NE'
        ]);
    });
    const wsW = XLSX.utils.aoa_to_sheet(wRows);
    wsW['!cols'] = WORKER_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsW, 'Radnici');

        // 2. Uvjerenja
    const cRows = [CERT_COLS];
    const certs = getAll(COLLECTIONS.CERTIFICATES).filter(c => companyId === 'all' || c.companyId === companyId);
    workers.forEach(w => {
        const wCerts = certs.filter(c => c.workerId === w.id);
        if (wCerts.length > 0) {
            wCerts.forEach(c => {
                cRows.push([
                    w.ime || '', w.prezime || '', w.jmbg || '',
                    c.naziv || '', c.oznaka || '', c.tipUvjerenja || '', c.datum || '', c.vrijediDo || '', c.sposobnost || '', c.ogranicenje || ''
                ]);
            });
        } else {
            cRows.push([
                w.ime || '', w.prezime || '', w.jmbg || '',
                '', '', '', '', '', '', ''
            ]);
        }
    });
    const wsC = XLSX.utils.aoa_to_sheet(cRows);
    wsC['!cols'] = CERT_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsC, 'Uvjerenja');

        // 3. OZO
    const pRows = [PPE_COLS];
    const ppe = getAll(COLLECTIONS.PPE_ASSIGNMENTS).filter(p => companyId === 'all' || p.companyId === companyId);
    workers.forEach(w => {
        const wPpe = ppe.filter(p => p.workerId === w.id);
        if (wPpe.length > 0) {
            wPpe.forEach(p => {
                pRows.push([
                    w.ime || '', w.prezime || '', w.jmbg || '',
                    p.naziv || '', p.datumZaduzenja || '', p.datumRazduzenja || '', p.kolicina || ''
                ]);
            });
        } else {
            pRows.push([
                w.ime || '', w.prezime || '', w.jmbg || '',
                '', '', '', ''
            ]);
        }
    });
    const wsP = XLSX.utils.aoa_to_sheet(pRows);
    wsP['!cols'] = PPE_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsP, 'OZO');

    // 4. Oprema
    const eRows = [EQUIP_COLS];
    const equip = getAll(COLLECTIONS.EQUIPMENT).filter(e => companyId === 'all' || e.companyId === companyId);
    equip.forEach(e => {
        eRows.push([
            e.naziv || '', e.vrsta || '', e.tip || '', e.tvBroj || '', e.invBroj || '',
            e.proizvodjac || '', e.godinaProizvodnje || '', e.posljednji || '', e.iduci || '', e.status || ''
        ]);
    });
    const wsE = XLSX.utils.aoa_to_sheet(eRows);
    wsE['!cols'] = EQUIP_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsE, 'Oprema');

        // 5. Ljekarski
    const mRows = [MEDEXAM_COLS];
    const medExams = getAll(COLLECTIONS.MEDICAL_EXAMS).filter(m => companyId === 'all' || m.companyId === companyId);
    workers.forEach(w => {
        const wExams = medExams.filter(m => m.workerId === w.id);
        if (wExams.length > 0) {
            wExams.forEach(m => {
                mRows.push([
                    w.ime || '', w.prezime || '', w.jmbg || '',
                    m.tipPregleda || '', m.datumPregleda || m.datum || '', m.vrijediDo || '', m.rezultat || '', m.napomena || ''
                ]);
            });
        } else {
            mRows.push([
                w.ime || '', w.prezime || '', w.jmbg || '',
                '', '', '', '', ''
            ]);
        }
    });
    const wsM = XLSX.utils.aoa_to_sheet(mRows);
    wsM['!cols'] = MEDEXAM_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsM, 'Ljekarski');

    // 6. Vozila
    const vRows = [VEH_COLS];
    const vehicles = getAll(COLLECTIONS.VEHICLES).filter(v => companyId === 'all' || v.companyId === companyId);
    vehicles.forEach(v => {
        vRows.push([
            v.registracija || '', v.marka || '', v.model || '', v.godinaProizvodnje || '', v.tip || '', v.vin || '', v.boja || '',
            v.datumRegistracije || '', v.registracijaIstice || '', v.datumTehnickogPregleda || '', v.tehnickiIstice || '',
            v.osiguranjeIstice || '', v.vatrogasniAparatDatum || '', v.prvaPomocIstice || '',
            // We only have vozacIme, but to link it back properly we might need the worker
            (() => { const w = workers.find(x => x.id === v.vozacId); return w?.ime || v.vozacIme || ''; })(),
            (() => { const w = workers.find(x => x.id === v.vozacId); return w?.prezime || ''; })(),
            (() => { const w = workers.find(x => x.id === v.vozacId); return w?.jmbg || ''; })(),
            v.status || 'aktivan', v.napomena || ''
        ]);
    });
    const wsV = XLSX.utils.aoa_to_sheet(vRows);
    wsV['!cols'] = VEH_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsV, 'Vozila');

    // 7. PP Aparati
    const fRows = [EXT_COLS];
    const fireExts = getAll(COLLECTIONS.FIRE_EXTINGUISHERS).filter(f => companyId === 'all' || f.companyId === companyId);
    fireExts.forEach(f => {
        fRows.push([
            f.serijskiBroj || '', f.tip || '', f.tezina || '', f.lokacija || '',
            f.datumNabavke || '', f.zadnjiServis || '', f.sljedeciServis || '',
            f.odgovornaOsoba || '', f.status || 'ispravan', f.napomena || ''
        ]);
    });
    const wsF = XLSX.utils.aoa_to_sheet(fRows);
    wsF['!cols'] = EXT_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsF, 'PPAparati');

    // 8. Hidranti
    const hRows = [HYD_COLS];
    const hyds = getAll(COLLECTIONS.HYDRANTS).filter(h => companyId === 'all' || h.companyId === companyId);
    hyds.forEach(h => {
        hRows.push([
            h.oznaka || '', h.tip || '', h.lokacija || '',
            h.datumZadnjegPregleda || '', h.sljedeciPregled || '',
            h.status || 'ispravan', h.napomena || ''
        ]);
    });
    const wsH = XLSX.utils.aoa_to_sheet(hRows);
    wsH['!cols'] = HYD_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsH, 'Hidranti');

    let fileName = `eZNR_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

function matchWorker(workers, ime, prezime, jmbg) {
    if (jmbg) {
        const found = workers.find(w => w.jmbg === String(jmbg).trim());
        if (found) return found;
    }
    if (ime && prezime) {
        return workers.find(w =>
            w.ime?.toLowerCase().trim() === String(ime).toLowerCase().trim() &&
            w.prezime?.toLowerCase().trim() === String(prezime).toLowerCase().trim()
        );
    }
    return null;
}

function parseSheet(wb, sheetName) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return data;
}

export default function ImportPage() {
    const { t, lang } = useLanguage();
    const { activeCompanyId, user } = useAuth();
    const fileRef = useRef(null);
    const [step, setStep] = useState('upload'); // upload | preview | done
    const [preview, setPreview] = useState(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [fileError, setFileError] = useState('');

    const companyId = activeCompanyId === 'all'
        ? (user?.companyIds?.[0] || '')
        : activeCompanyId;

    const processFile = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
                const ouRows = parseSheet(wb, 'OrgJedinice');
                const wpRows = parseSheet(wb, 'RadnaMjesta');
                const workers = parseSheet(wb, 'Radnici');
                const certs = parseSheet(wb, 'Uvjerenja');
                const ppe = parseSheet(wb, 'OZO');
                const equip = parseSheet(wb, 'Oprema');
                const medExams = parseSheet(wb, 'Ljekarski');
                const vRows = parseSheet(wb, 'Vozila');
                const fRows = parseSheet(wb, 'PPAparati');
                const hRows = parseSheet(wb, 'Hidranti');
                setPreview({ ouRows, wpRows, workers, certs, ppe, equip, medExams, vRows, fRows, hRows });
                setStep('preview');
            } catch (err) {
                setFileError('Greška pri čitanju dokumenta: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleImport = async () => {
        setImporting(true);
        const { workers: wRows = [], certs: cRows = [], ppe: pRows = [], equip: eRows = [], medExams: mRows = [], ouRows = [], wpRows = [], vRows = [], fRows = [], hRows = [] } = preview;
        let wCreated = 0, wSkipped = 0, cCreated = 0, cSkipped = 0, pCreated = 0, pSkipped = 0, eCreated = 0, eSkipped = 0, mCreated = 0, mSkipped = 0;
        let ouCreated = 0, ouSkipped = 0, wpCreated = 0, wpSkipped = 0;
        let wpLinked = 0, wpTotal = 0, ouLinked = 0, ouTotal = 0;
        let vCreated = 0, vSkipped = 0, fCreated = 0, fSkipped = 0, hCreated = 0, hSkipped = 0;

        // Ensure we load existing cache properly
        const allWorkplaces = getAll(COLLECTIONS.WORKPLACES);
        const allOrgUnits = getAll(COLLECTIONS.ORG_UNITS);

        const fuzzyMatch = (list, text, field = 'naziv') => {
            if (!text) return null;
            const t = String(text).toLowerCase().trim();
            const filtered = list.filter(item => item.companyId === companyId || item.companyId === 'all');
            return filtered.find(item => (item[field] || '').toLowerCase().trim() === t)
                || filtered.find(item => (item[field] || '').toLowerCase().trim().includes(t) || t.includes((item[field] || '').toLowerCase().trim()));
        };

        // 0. Org Units
        const newOU = [];
        ouRows.forEach(row => {
            const naziv = String(row.naziv || '').trim();
            if (!naziv) { ouSkipped++; return; }
            if (allOrgUnits.some(o => o.companyId === companyId && o.naziv.toLowerCase() === naziv.toLowerCase())) {
                ouSkipped++; return;
            }
            newOU.push({ naziv, opis: String(row.opis || '').trim(), companyId });
        });
        if (newOU.length > 0) await createMass(COLLECTIONS.ORG_UNITS, newOU);
        ouCreated = newOU.length;

        // 0.5 Workplaces
        const newWP = [];
        wpRows.forEach(row => {
            const naziv = String(row.naziv || '').trim();
            if (!naziv) { wpSkipped++; return; }
            if (allWorkplaces.some(w => w.companyId === companyId && w.naziv.toLowerCase() === naziv.toLowerCase())) {
                wpSkipped++; return;
            }
            newWP.push({ naziv, opis: String(row.opis || '').trim(), companyId });
        });
        if (newWP.length > 0) await createMass(COLLECTIONS.WORKPLACES, newWP);
        wpCreated = newWP.length;

        // 1. Workers
        const existingWorkers = getAll(COLLECTIONS.WORKERS);
        const newWList = [];
        const newWorkerMap = {};

        wRows.forEach(row => {
            if (!row.ime || !row.prezime) { wSkipped++; return; }
            const jmbg = String(row.jmbg || '').trim();
            if (jmbg && existingWorkers.some(w => w.jmbg === jmbg)) {
                const existing = existingWorkers.find(w => w.jmbg === jmbg);
                newWorkerMap[jmbg] = existing.id;
                wSkipped++;
                return;
            }
            newWList.push({
                ime: String(row.ime || '').trim(), prezime: String(row.prezime || '').trim(),
                imeRoditelja: String(row.imeRoditelja || '').trim(), jmbg: jmbg, oib: String(row.oib || '').trim(),
                spol: String(row.spol || '').trim(), datumRodenja: String(row.datumRodenja || '').trim(),
                miestoRodenja: String(row.miestoRodenja || '').trim(), datumZaposlenja: String(row.datumZaposlenja || '').trim(),
                datumOdlaska: String(row.datumOdlaska || '').trim(), stazDoDolaska: String(row.stazDoDolaska || '').trim(),
                koef: String(row.koef || '').trim(), lokacija: String(row.lokacija || '').trim(),
                evidencijskiBroj: String(row.evidencijskiBroj || '').trim(), telefonTvrtki: String(row.telefonTvrtki || '').trim(),
                mobitel: String(row.mobitel || '').trim(), email: String(row.email || '').trim(),
                ulica: String(row.ulica || '').trim(), kucniBroj: String(row.kucniBroj || '').trim(),
                napomena: String(row.napomena || '').trim(), aktivan: String(row.aktivan || 'DA').toUpperCase() !== 'NE',
                vanjskiSuradnik: String(row.vanjskiSuradnik || 'NE').toUpperCase() === 'DA', companyId,
                radnoMjestoId: (() => {
                    const rm = String(row.radnoMjesto || '').trim();
                    if (!rm) return '';
                    wpTotal++;
                    const match = fuzzyMatch(getAll(COLLECTIONS.WORKPLACES), rm);
                    if (match) { wpLinked++; return match.id; }
                    return '';
                })(),
                orgJedinicaId: (() => {
                    const oj = String(row.orgJedinica || '').trim();
                    if (!oj) return '';
                    ouTotal++;
                    const match = fuzzyMatch(getAll(COLLECTIONS.ORG_UNITS), oj);
                    if (match) { ouLinked++; return match.id; }
                    return '';
                })(),
                prefix: '', sufiks: '', zivotnaDob: 0, ukupniStaz: '',
                posebniUvjeti: false, slika: '', dodatniPoslovi: '',
                opcina: '', opcinaRodenja: '', telefonKuce: '', mjestoId: '', miestoRodenja_: '',
            });
        });

        let savedWorkers = [];
        if (newWList.length > 0) {
            savedWorkers = await createMass(COLLECTIONS.WORKERS, newWList);
        }
        wCreated = newWList.length;

        // Fill map
        savedWorkers.forEach(sw => {
            if (sw.jmbg) newWorkerMap[sw.jmbg] = sw.id;
            newWorkerMap[`${sw.ime}__${sw.prezime}`] = sw.id;
        });

        // Get complete workers list for subsequent matches
        const allWorkers = getAll(COLLECTIONS.WORKERS);

        function matchWorker(workers, ime, prezime, jmbg) {
            if (jmbg) {
                const found = workers.find(w => w.jmbg === String(jmbg).trim());
                if (found) return found;
            }
            if (ime && prezime) {
                return workers.find(w =>
                    w.ime?.toLowerCase().trim() === String(ime).toLowerCase().trim() &&
                    w.prezime?.toLowerCase().trim() === String(prezime).toLowerCase().trim()
                );
            }
            return null;
        }

        // 2. Certificates
        const existingCerts = getAll(COLLECTIONS.CERTIFICATES);
        const newCerts = [];
        cRows.forEach(row => {
            if (!row.naziv) { cSkipped++; return; }
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            if (!worker) { cSkipped++; return; }
            const datum = String(row.datum || '').trim();
            const naziv = String(row.naziv || '').trim();
            if (existingCerts.some(c => c.workerId === worker.id && c.naziv === naziv && c.datum === datum)) {
                cSkipped++; return;
            }
            newCerts.push({
                workerId: worker.id, companyId: worker.companyId || companyId,
                ime: naziv, naziv: naziv, oznaka: String(row.oznaka || '').trim(),
                tipUvjerenja: String(row.tipUvjerenja || '').trim(), datum: datum,
                vrijediDo: String(row.vrijediDo || '').trim(),
                sposobnost: String(row.sposobnost || 'Sposoban').trim(),
                ogranicenje: String(row.ogranicenje || '').trim(), upisao: 'Import',
            });
        });
        if (newCerts.length > 0) await createMass(COLLECTIONS.CERTIFICATES, newCerts);
        cCreated = newCerts.length;

        // 3. PPE
        const existingPPE = getAll(COLLECTIONS.PPE_ASSIGNMENTS);
        const newPPE = [];
        pRows.forEach(row => {
            if (!row.naziv) { pSkipped++; return; }
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            if (!worker) { pSkipped++; return; }
            const naziv = String(row.naziv || '').trim();
            const datumZaduzenja = String(row.datumZaduzenja || '').trim();
            if (existingPPE.some(p => p.workerId === worker.id && p.naziv === naziv && p.datumZaduzenja === datumZaduzenja)) {
                pSkipped++; return;
            }
            newPPE.push({
                workerId: worker.id, companyId: worker.companyId || companyId,
                naziv: naziv, datumZaduzenja: datumZaduzenja,
                datumRazduzenja: String(row.datumRazduzenja || '').trim(),
                kolicina: parseInt(row.kolicina) || 1,
            });
        });
        if (newPPE.length > 0) await createMass(COLLECTIONS.PPE_ASSIGNMENTS, newPPE);
        pCreated = newPPE.length;

        // 4. Equipment
        const existingEquip = getAll(COLLECTIONS.EQUIPMENT);
        const newEquip = [];
        eRows.forEach(row => {
            if (!row.naziv) { eSkipped++; return; }
            const naziv = String(row.naziv || '').trim();
            const tvBroj = String(row.tvBroj || '').trim();
            if (existingEquip.some(e => e.companyId === companyId && e.naziv === naziv && e.tvBroj === tvBroj)) {
                eSkipped++; return;
            }
            newEquip.push({
                companyId, naziv: naziv, vrsta: String(row.vrsta || '').trim(),
                tip: String(row.tip || '').trim(), tvBroj: tvBroj,
                invBroj: String(row.invBroj || '').trim(), proizvodjac: String(row.proizvodjac || '').trim(),
                godinaProizvodnje: String(row.godinaProizvodnje || '').trim(), posljednji: String(row.posljednji || '').trim(),
                iduci: String(row.iduci || '').trim(), status: String(row.status || 'active').trim(),
                orgJedinicaId: '', zaduzenOsoba: '', datumUpisa: '', uPrimjeniOd: '',
                izvanUpotrebeOd: '', evidencijskiBroj: '', brojMjernihMjesta: 0, serijskiBroj: '',
            });
        });
        if (newEquip.length > 0) await createMass(COLLECTIONS.EQUIPMENT, newEquip);
        eCreated = newEquip.length;

        // 5. Medical Exams
        const existingMedExams = getAll(COLLECTIONS.MEDICAL_EXAMS);
        const newMedExams = [];
        mRows.forEach(row => {
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            if (!worker) { mSkipped++; return; }
            const tipPregleda = String(row.tipPregleda || '').trim();
            const datum = String(row.datum || '').trim();
            if (existingMedExams.some(m => m.workerId === worker.id && m.tipPregleda === tipPregleda && (m.datumPregleda || m.datum || '') === datum)) {
                mSkipped++; return;
            }
            newMedExams.push({
                workerId: worker.id, companyId: worker.companyId || companyId,
                radnikIme: `${worker.ime} ${worker.prezime}`, tipPregleda: tipPregleda,
                datumPregleda: datum, vrijediDo: String(row.vrijediDo || '').trim(),
                rezultat: String(row.rezultat || 'Sposoban').trim(), napomena: String(row.napomena || '').trim(),
            });
        });
        if (newMedExams.length > 0) await createMass(COLLECTIONS.MEDICAL_EXAMS, newMedExams);
        mCreated = newMedExams.length;

        // 6. Vehicles
        const existingVehicles = getAll(COLLECTIONS.VEHICLES);
        const newVehicles = [];
        vRows.forEach(row => {
            const registracija = String(row.registracija || '').trim();
            if (!registracija) { vSkipped++; return; }
            if (existingVehicles.some(v => v.companyId === companyId && v.registracija === registracija)) {
                vSkipped++; return;
            }
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            newVehicles.push({
                companyId, registracija, marka: String(row.marka || '').trim(),
                model: String(row.model || '').trim(), godinaProizvodnje: String(row.godinaProizvodnje || '').trim(),
                tip: String(row.tip || 'osobno').trim(), vin: String(row.vin || '').trim(),
                boja: String(row.boja || '').trim(), datumRegistracije: String(row.datumRegistracije || '').trim(),
                registracijaIstice: String(row.registracijaIstice || '').trim(), datumTehnickogPregleda: String(row.datumTehnickogPregleda || '').trim(),
                tehnickiIstice: String(row.tehnickiIstice || '').trim(), osiguranjeIstice: String(row.osiguranjeIstice || '').trim(),
                vatrogasniAparatDatum: String(row.vatrogasniAparatDatum || '').trim(), prvaPomocIstice: String(row.prvaPomocIstice || '').trim(),
                vozacId: worker ? worker.id : '', vozacIme: worker ? `${worker.ime} ${worker.prezime}` : '',
                orgJedinicaId: '', status: String(row.status || 'aktivan').trim(), napomena: String(row.napomena || '').trim()
            });
        });
        if (newVehicles.length > 0) await createMass(COLLECTIONS.VEHICLES, newVehicles);
        vCreated = newVehicles.length;

        // 7. Fire Extinguishers
        const existingExts = getAll(COLLECTIONS.FIRE_EXTINGUISHERS);
        const newExts = [];
        fRows.forEach(row => {
            const serijskiBroj = String(row.serijskiBroj || '').trim();
            if (!serijskiBroj) { fSkipped++; return; }
            if (existingExts.some(f => f.companyId === companyId && f.serijskiBroj === serijskiBroj)) {
                fSkipped++; return;
            }
            newExts.push({
                companyId, serijskiBroj, tip: String(row.tip || 'prah').trim(),
                tezina: String(row.tezina || '').trim(), lokacija: String(row.lokacija || '').trim(),
                datumNabavke: String(row.datumNabavke || '').trim(), zadnjiServis: String(row.zadnjiServis || '').trim(),
                sljedeciServis: String(row.sljedeciServis || '').trim(), odgovornaOsoba: String(row.odgovornaOsoba || '').trim(),
                status: String(row.status || 'ispravan').trim(), napomena: String(row.napomena || '').trim()
            });
        });
        if (newExts.length > 0) await createMass(COLLECTIONS.FIRE_EXTINGUISHERS, newExts);
        fCreated = newExts.length;

        // 8. Hydrants
        const existingHyds = getAll(COLLECTIONS.HYDRANTS);
        const newHydrants = [];
        hRows.forEach(row => {
            const oznaka = String(row.oznaka || '').trim();
            if (!oznaka) { hSkipped++; return; }
            if (existingHyds.some(h => h.companyId === companyId && h.oznaka === oznaka)) {
                hSkipped++; return;
            }
            newHydrants.push({
                companyId, oznaka, tip: String(row.tip || 'unutarnji').trim(),
                lokacija: String(row.lokacija || '').trim(), datumZadnjegPregleda: String(row.datumZadnjegPregleda || '').trim(),
                sljedeciPregled: String(row.sljedeciPregled || '').trim(), status: String(row.status || 'ispravan').trim(),
                napomena: String(row.napomena || '').trim()
            });
        });
        if (newHydrants.length > 0) await createMass(COLLECTIONS.HYDRANTS, newHydrants);
        hCreated = newHydrants.length;

        setResult({ wCreated, wSkipped, cCreated, cSkipped, pCreated, pSkipped, eCreated, eSkipped, mCreated, mSkipped, vCreated, vSkipped, fCreated, fSkipped, hCreated, hSkipped, wpLinked, wpTotal, ouLinked, ouTotal, ouCreated, ouSkipped, wpCreated, wpSkipped });
        setImporting(false);
        setStep('done');
    };


    
    


    const reset = () => {
        setStep('upload');
        setPreview(null);
        setResult(null);
        if (fileRef.current) fileRef.current.value = '';
    };

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 860, margin: '0 auto' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                📥 {lang === 'bs' ? 'Excel Import/Export' : 'Excel Import/Export'}
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.9rem' }}>
                {lang === 'bs'
                    ? 'Uvezi podatke iz Excel-a ili preuzmi (exportuj) sve podatke aktivne firme u Excel formatu.'
                    : 'Import data from Excel or download (export) all active company data in Excel format.'}
            </p>

            {fileError && (
                <div style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#D32F2F', fontSize: '0.85rem' }}>
                    ⚠️ {fileError} <button onClick={() => setFileError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#D32F2F' }}>✕</button>
                </div>
            )}
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 32, background: 'var(--bg-card)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
                {['upload', 'preview', 'done'].map((s, i) => (
                    <div key={s} style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
                        background: step === s ? 'var(--primary)' : 'transparent',
                        color: step === s ? 'white' : 'var(--text-muted)',
                        transition: 'all 0.2s',
                    }}>
                        {i + 1}. {s === 'upload' ? (lang === 'bs' ? 'Upload' : 'Upload') : s === 'preview' ? (lang === 'bs' ? 'Pregled' : 'Preview') : (lang === 'bs' ? 'Gotovo' : 'Done')}
                    </div>
                ))}
            </div>

            {/* ── STEP 1: Upload ── */}
            {step === 'upload' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Template / Export download */}
                    <div className="card">
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>📋 {lang === 'bs' ? 'Korak 1: Preuzimanje Excela' : 'Step 1: Download Excel'}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {lang === 'bs'
                                        ? 'Preuzmite prazan predložak za unos ILI izvezite (export) postojeće podatke.'
                                        : 'Download empty template for new data OR export existing data.'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-outline" onClick={generateTemplate} style={{ whiteSpace: 'nowrap' }}>
                                    ⬇️ {lang === 'bs' ? 'Prazan template' : 'Empty template'}
                                </button>
                                
                                <button className="btn btn-primary" onClick={() => generateExport(activeCompanyId)} style={{ whiteSpace: 'nowrap' }}>
                                    📤 {lang === 'bs' ? 'Export podataka' : 'Export data'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Drop zone */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
                            borderRadius: 16,
                            padding: '48px 32px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: dragOver ? 'rgba(0,191,166,0.04)' : 'var(--bg-card)',
                            transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: 12 }}>📂</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                            {lang === 'bs' ? 'Korak 2: Uploadajte popunjeni Excel' : 'Step 2: Upload your filled Excel'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {lang === 'bs' ? 'Kliknite ili prevucite .xlsx dokument ovdje' : 'Click or drag & drop .xlsx file here'}
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Company warning if needed */}
                    {activeCompanyId === 'all' && (
                        <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: 'var(--warning)' }}>
                            ⚠️ {lang === 'bs' ? `Podaci će biti uvezeni za prvu firmu u vašoj listi. Odaberite aktivnu firmu u headeru za preciznost.` : `Data will be imported to the first company. Select an active company in the header for accuracy.`}
                        </div>
                    )}
                </div>
            )}

            {/* ── STEP 2: Preview ── */}
            {step === 'preview' && preview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Summary cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                        {[
                            { label: lang === 'bs' ? 'Org. Jedinice' : 'Org Units', count: (preview.ouRows || []).length, icon: '🏢', color: '#3F51B5' },
                            { label: lang === 'bs' ? 'Radna mjesta' : 'Workplaces', count: (preview.wpRows || []).length, icon: '📍', color: '#00BCD4' },
                            { label: lang === 'bs' ? 'Radnika' : 'Workers', count: preview.workers.length, icon: '👷', color: 'var(--primary)' },
                            { label: lang === 'bs' ? 'Uvjerenja' : 'Certificates', count: preview.certs.length, icon: '📜', color: '#9C27B0' },
                            { label: 'OZO / PPE', count: preview.ppe.length, icon: '🦺', color: '#FF9800' },
                            { label: lang === 'bs' ? 'Oprema' : 'Equipment', count: (preview.equip || []).length, icon: '⚙️', color: '#607D8B' },
                            { label: lang === 'bs' ? 'Ljekarski' : 'Medical', count: (preview.medExams || []).length, icon: '🩺', color: '#E91E63' },
                            { label: lang === 'bs' ? 'Vozila' : 'Vehicles', count: (preview.vRows || []).length, icon: '🚗', color: '#F44336' },
                            { label: lang === 'bs' ? 'PP Aparati' : 'Fire Extinguishers', count: (preview.fRows || []).length, icon: '🧯', color: '#E53935' },
                            { label: lang === 'bs' ? 'Hidranti' : 'Hydrants', count: (preview.hRows || []).length, icon: '🚰', color: '#1E88E5' },
                        ].filter(x => x.count > 0).map(({ label, count, icon, color }) => (
                            <div key={label} className="card" style={{ textAlign: 'center', padding: 16 }}>
                                <div style={{ fontSize: '1.6rem', marginBottom: 4 }}>{icon}</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{count}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Workers preview table */}
                    {preview.workers.length > 0 && (
                        <div className="card">
                            <div className="card-body">
                                <div style={{ fontWeight: 700, marginBottom: 12 }}>👷 {lang === 'bs' ? 'Radnici (pregled, prvih 5)' : 'Workers (preview, first 5)'}</div>
                                <div className="data-table-wrapper">
                                    <table className="data-table">
                                        <thead><tr>
                                            <th>Ime</th><th>Prezime</th><th>JMBG</th><th>Zaposlenje</th><th>Aktivan</th>
                                        </tr></thead>
                                        <tbody>
                                            {preview.workers.slice(0, 5).map((r, i) => (
                                                <tr key={i}>
                                                    <td>{r.ime}</td><td>{r.prezime}</td><td><code>{r.jmbg}</code></td>
                                                    <td>{r.datumZaposlenja}</td>
                                                    <td><span className={`badge ${String(r.aktivan).toUpperCase() !== 'NE' ? 'badge-success' : 'badge-danger'}`}>{String(r.aktivan || 'DA')}</span></td>
                                                </tr>
                                            ))}
                                            {preview.workers.length > 5 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>...i još {preview.workers.length - 5} radnika</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Certs preview */}
                    {preview.certs.length > 0 && (
                        <div className="card">
                            <div className="card-body">
                                <div style={{ fontWeight: 700, marginBottom: 12 }}>📜 {lang === 'bs' ? 'Uvjerenja (pregled, prvih 5)' : 'Certificates (preview, first 5)'}</div>
                                <div className="data-table-wrapper">
                                    <table className="data-table">
                                        <thead><tr>
                                            <th>Radnik</th><th>Naziv</th><th>Oznaka</th><th>Vrijedi do</th>
                                        </tr></thead>
                                        <tbody>
                                            {preview.certs.slice(0, 5).map((r, i) => (
                                                <tr key={i}>
                                                    <td>{r.radnik_ime} {r.radnik_prezime}</td>
                                                    <td>{r.naziv}</td><td><code>{r.oznaka}</code></td><td>{r.vrijediDo}</td>
                                                </tr>
                                            ))}
                                            {preview.certs.length > 5 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>...i još {preview.certs.length - 5} uvjerenja</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-ghost" onClick={reset}>← {lang === 'bs' ? 'Nazad' : 'Back'}</button>
                        <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                            {importing ? '⏳ ' : '📥 '}{lang === 'bs' ? 'Pokreni import' : 'Start import'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP 3: Done ── */}
            {step === 'done' && result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem' }}>✅</div>
                    <h2>{lang === 'bs' ? 'Import završen!' : 'Import complete!'}</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, width: '100%', maxWidth: 700 }}>
                        {[
                            { label: lang === 'bs' ? 'Org. kreirano' : 'Org created', val: result.ouCreated || 0, color: '#3F51B5' },
                            { label: lang === 'bs' ? 'Mjesta kreirano' : 'WP created', val: result.wpCreated || 0, color: '#00BCD4' },
                            { label: lang === 'bs' ? 'Radnika kreirano' : 'Workers created', val: result.wCreated, color: 'var(--primary)' },
                            { label: lang === 'bs' ? 'Radnika preskočeno' : 'Workers skipped', val: result.wSkipped, color: 'var(--text-muted)' },
                            { label: lang === 'bs' ? 'Uvjerenja kreirano' : 'Certs created', val: result.cCreated, color: '#9C27B0' },
                            { label: lang === 'bs' ? 'Uvjerenja preskočeno' : 'Certs skipped', val: result.cSkipped, color: 'var(--text-muted)' },
                            { label: lang === 'bs' ? 'OZO kreirano' : 'PPE created', val: result.pCreated, color: '#FF9800' },
                            { label: lang === 'bs' ? 'OZO preskočeno' : 'PPE skipped', val: result.pSkipped, color: 'var(--text-muted)' },
                            { label: lang === 'bs' ? 'Oprema kreirano' : 'Equipment created', val: result.eCreated || 0, color: '#607D8B' },
                            { label: lang === 'bs' ? 'Oprema preskočeno' : 'Equipment skipped', val: result.eSkipped || 0, color: 'var(--text-muted)' },
                            { label: lang === 'bs' ? 'Ljekarski kreirano' : 'Medical created', val: result.mCreated || 0, color: '#E91E63' },
                            { label: lang === 'bs' ? 'Ljekarski preskočeno' : 'Medical skipped', val: result.mSkipped || 0, color: 'var(--text-muted)' },
                            { label: lang === 'bs' ? 'Vozila kreirano' : 'Vehicles created', val: result.vCreated || 0, color: '#F44336' },
                            { label: lang === 'bs' ? 'Vozila preskočeno' : 'Vehicles skipped', val: result.vSkipped || 0, color: 'var(--text-muted)' },
                            { label: lang === 'bs' ? 'PP Aparati kreirano' : 'Ext. created', val: result.fCreated || 0, color: '#E53935' },
                            { label: lang === 'bs' ? 'PP Aparati preskočeno' : 'Ext. skipped', val: result.fSkipped || 0, color: 'var(--text-muted)' },
                            { label: lang === 'bs' ? 'Hidranti kreirano' : 'Hydrants created', val: result.hCreated || 0, color: '#1E88E5' },
                            { label: lang === 'bs' ? 'Hidranti preskočeno' : 'Hydrants skipped', val: result.hSkipped || 0, color: 'var(--text-muted)' },
                        ].filter(x => x.val > 0).map(({ label, val, color }) => (
                            <div key={label} className="card" style={{ padding: 14, textAlign: 'center' }}>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{val}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Linking stats */}
                    {(result.wpTotal > 0 || result.ouTotal > 0) && (
                        <div style={{ background: 'rgba(102,126,234,0.08)', border: '1px solid rgba(102,126,234,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: '#667eea' }}>🔗 Povezivanje podataka</div>
                            {result.wpTotal > 0 && <div>📍 Radna mjesta: <strong>{result.wpLinked}/{result.wpTotal}</strong> uspješno povezano{result.wpLinked < result.wpTotal && <span style={{ color: '#ff9800' }}> — {result.wpTotal - result.wpLinked} nije pronađeno u bazi</span>}</div>}
                            {result.ouTotal > 0 && <div>🏢 Org. jedinice: <strong>{result.ouLinked}/{result.ouTotal}</strong> uspješno povezano{result.ouLinked < result.ouTotal && <span style={{ color: '#ff9800' }}> — {result.ouTotal - result.ouLinked} nije pronađeno u bazi</span>}</div>}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-ghost" onClick={reset}>📥 {lang === 'bs' ? 'Novi import' : 'New import'}</button>
                        <a href="/dashboard/workers" className="btn btn-primary">👷 {lang === 'bs' ? 'Idi na Radnike' : 'Go to Workers'}</a>
                    </div>
                </div>
            )}
        </div>
    );
}
