'use client';
import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { create, getAll, COLLECTIONS } from '@/lib/dataStore';
import * as XLSX from 'xlsx';

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

function generateTemplate() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Radnici
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

    // Sheet 6: Upute
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
    ]);
    wsI['!cols'] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsI, 'Upute');

    XLSX.writeFile(wb, 'eZNR_Import_Template.xlsx');
}

function generateExport(companyId) {
    const wb = XLSX.utils.book_new();

    // 1. Radnici
    const wRows = [WORKER_COLS];
    const workers = getAll(COLLECTIONS.WORKERS).filter(w => companyId === 'all' || w.companyId === companyId);
    workers.forEach(w => {
        wRows.push([
            w.ime || '', w.prezime || '', w.imeRoditelja || '', w.jmbg || '', w.oib || '', w.spol || '',
            w.datumRodenja || '', w.miestoRodenja || '', w.datumZaposlenja || '', w.datumOdlaska || '',
            w.stazDoDolaska || '', w.koef || '', '', '', // radnoMjesto and orgJedinica left blank for now
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
    certs.forEach(c => {
        const worker = workers.find(w => w.id === c.workerId);
        cRows.push([
            worker?.ime || '', worker?.prezime || '', worker?.jmbg || '',
            c.naziv || '', c.oznaka || '', c.tipUvjerenja || '', c.datum || '', c.vrijediDo || '', c.sposobnost || '', c.ogranicenje || ''
        ]);
    });
    const wsC = XLSX.utils.aoa_to_sheet(cRows);
    wsC['!cols'] = CERT_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsC, 'Uvjerenja');

    // 3. OZO
    const pRows = [PPE_COLS];
    const ppe = getAll(COLLECTIONS.PPE_ASSIGNMENTS).filter(p => companyId === 'all' || p.companyId === companyId);
    ppe.forEach(p => {
        const worker = workers.find(w => w.id === p.workerId);
        pRows.push([
            worker?.ime || '', worker?.prezime || '', worker?.jmbg || '',
            p.naziv || '', p.datumZaduzenja || '', p.datumRazduzenja || '', p.kolicina || ''
        ]);
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
    medExams.forEach(m => {
        const worker = workers.find(w => w.id === m.workerId);
        mRows.push([
            worker?.ime || '', worker?.prezime || '', worker?.jmbg || '',
            m.tipPregleda || '', m.datumPregleda || m.datum || '', m.vrijediDo || '', m.rezultat || '', m.napomena || ''
        ]);
    });
    const wsM = XLSX.utils.aoa_to_sheet(mRows);
    wsM['!cols'] = MEDEXAM_COLS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, wsM, 'Ljekarski');

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
                const workers = parseSheet(wb, 'Radnici');
                const certs = parseSheet(wb, 'Uvjerenja');
                const ppe = parseSheet(wb, 'OZO');
                const equip = parseSheet(wb, 'Oprema');
                const medExams = parseSheet(wb, 'Ljekarski');
                setPreview({ workers, certs, ppe, equip, medExams });
                setStep('preview');
            } catch (err) {
                setFileError('Greška pri čitanju fajla: ' + err.message);
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

    const handleImport = () => {
        setImporting(true);
        const { workers: wRows, certs: cRows, ppe: pRows, equip: eRows = [], medExams: mRows = [] } = preview;
        let wCreated = 0, wSkipped = 0, cCreated = 0, cSkipped = 0, pCreated = 0, eCreated = 0, mCreated = 0;

        // 1. Import workers
        const existingWorkers = getAll(COLLECTIONS.WORKERS);
        const newWorkerMap = {};

        wRows.forEach(row => {
            if (!row.ime || !row.prezime) { wSkipped++; return; }
            if (row.jmbg && existingWorkers.find(w => w.jmbg === String(row.jmbg).trim())) {
                const existing = existingWorkers.find(w => w.jmbg === String(row.jmbg).trim());
                newWorkerMap[String(row.jmbg).trim()] = existing.id;
                wSkipped++;
                return;
            }
            const newW = create(COLLECTIONS.WORKERS, {
                ime: String(row.ime || '').trim(),
                prezime: String(row.prezime || '').trim(),
                imeRoditelja: String(row.imeRoditelja || '').trim(),
                jmbg: String(row.jmbg || '').trim(),
                oib: String(row.oib || '').trim(),
                spol: String(row.spol || '').trim(),
                datumRodenja: String(row.datumRodenja || '').trim(),
                miestoRodenja: String(row.miestoRodenja || '').trim(),
                datumZaposlenja: String(row.datumZaposlenja || '').trim(),
                datumOdlaska: String(row.datumOdlaska || '').trim(),
                stazDoDolaska: String(row.stazDoDolaska || '').trim(),
                koef: String(row.koef || '').trim(),
                lokacija: String(row.lokacija || '').trim(),
                evidencijskiBroj: String(row.evidencijskiBroj || '').trim(),
                telefonTvrtki: String(row.telefonTvrtki || '').trim(),
                mobitel: String(row.mobitel || '').trim(),
                email: String(row.email || '').trim(),
                ulica: String(row.ulica || '').trim(),
                kucniBroj: String(row.kucniBroj || '').trim(),
                napomena: String(row.napomena || '').trim(),
                aktivan: String(row.aktivan || 'DA').toUpperCase() !== 'NE',
                vanjskiSuradnik: String(row.vanjskiSuradnik || 'NE').toUpperCase() === 'DA',
                companyId,
                prefix: '', sufiks: '', zivotnaDob: 0, ukupniStaz: '',
                radnoMjestoId: '', orgJedinicaId: '', posebniUvjeti: false, slika: '', dodatniPoslovi: '',
                opcina: '', opcinaRodenja: '', telefonKuce: '', mjestoId: '', miestoRodenja_: '',
            });
            if (row.jmbg) newWorkerMap[String(row.jmbg).trim()] = newW.id;
            newWorkerMap[`${String(row.ime).trim()}__${String(row.prezime).trim()}`] = newW.id;
            wCreated++;
        });

        const allWorkers = getAll(COLLECTIONS.WORKERS);

        const existingCerts = getAll(COLLECTIONS.CERTIFICATES);
        
        // 2. Import certificates
        cRows.forEach(row => {
            if (!row.naziv) { cSkipped++; return; }
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            if (!worker) { cSkipped++; return; }
            
            // Duplicate check
            const datum = String(row.datum || '').trim();
            const naziv = String(row.naziv || '').trim();
            if (existingCerts.some(c => c.workerId === worker.id && c.naziv === naziv && c.datum === datum)) {
                cSkipped++;
                return;
            }

            create(COLLECTIONS.CERTIFICATES, {
                workerId: worker.id,
                companyId: worker.companyId || companyId,
                ime: naziv,
                naziv: naziv,
                oznaka: String(row.oznaka || '').trim(),
                tipUvjerenja: String(row.tipUvjerenja || '').trim(),
                datum: datum,
                vrijediDo: String(row.vrijediDo || '').trim(),
                sposobnost: String(row.sposobnost || 'Sposoban').trim(),
                ogranicenje: String(row.ogranicenje || '').trim(),
                upisao: 'Import',
            });
            cCreated++;
        });

        const existingPPE = getAll(COLLECTIONS.PPE_ASSIGNMENTS);

        // 3. Import PPE
        let pSkipped = 0;
        pRows.forEach(row => {
            if (!row.naziv) { pSkipped++; return; }
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            if (!worker) { pSkipped++; return; }

            // Duplicate check
            const naziv = String(row.naziv || '').trim();
            const datumZaduzenja = String(row.datumZaduzenja || '').trim();
            if (existingPPE.some(p => p.workerId === worker.id && p.naziv === naziv && p.datumZaduzenja === datumZaduzenja)) {
                pSkipped++;
                return;
            }

            create(COLLECTIONS.PPE_ASSIGNMENTS, {
                workerId: worker.id,
                companyId: worker.companyId || companyId,
                naziv: naziv,
                datumZaduzenja: datumZaduzenja,
                datumRazduzenja: String(row.datumRazduzenja || '').trim(),
                kolicina: parseInt(row.kolicina) || 1,
            });
            pCreated++;
        });

        const existingEquip = getAll(COLLECTIONS.EQUIPMENT);

        // 4. Import Equipment
        let eSkipped = 0;
        eRows.forEach(row => {
            if (!row.naziv) { eSkipped++; return; }

            // Duplicate check
            const naziv = String(row.naziv || '').trim();
            const tvBroj = String(row.tvBroj || '').trim();
            if (existingEquip.some(e => e.companyId === companyId && e.naziv === naziv && e.tvBroj === tvBroj)) {
                eSkipped++;
                return;
            }

            create(COLLECTIONS.EQUIPMENT, {
                companyId,
                naziv: naziv,
                vrsta: String(row.vrsta || '').trim(),
                tip: String(row.tip || '').trim(),
                tvBroj: tvBroj,
                invBroj: String(row.invBroj || '').trim(),
                proizvodjac: String(row.proizvodjac || '').trim(),
                godinaProizvodnje: String(row.godinaProizvodnje || '').trim(),
                posljednji: String(row.posljednji || '').trim(),
                iduci: String(row.iduci || '').trim(),
                status: String(row.status || 'active').trim(),
                orgJedinicaId: '', zaduzenOsoba: '', datumUpisa: '', uPrimjeniOd: '',
                izvanUpotrebeOd: '', evidencijskiBroj: '', brojMjernihMjesta: 0, serijskiBroj: '',
            });
            eCreated++;
        });

        const existingMedExams = getAll(COLLECTIONS.MEDICAL_EXAMS);

        // 5. Import Medical Exams
        let mSkipped = 0;
        mRows.forEach(row => {
            const worker = matchWorker(allWorkers, row.radnik_ime, row.radnik_prezime, row.radnik_jmbg);
            if (!worker) { mSkipped++; return; }

            // Duplicate check
            const tipPregleda = String(row.tipPregleda || '').trim();
            const datum = String(row.datum || '').trim();
            if (existingMedExams.some(m => m.workerId === worker.id && m.tipPregleda === tipPregleda && (m.datumPregleda || m.datum || '') === datum)) {
                mSkipped++;
                return;
            }

            create(COLLECTIONS.MEDICAL_EXAMS, {
                workerId: worker.id,
                companyId: worker.companyId || companyId,
                radnikIme: `${worker.ime} ${worker.prezime}`,
                tipPregleda: tipPregleda,
                datumPregleda: datum, // The system expects datumPregleda, but historically some imports wrote datum
                vrijediDo: String(row.vrijediDo || '').trim(),
                rezultat: String(row.rezultat || 'Sposoban').trim(),
                napomena: String(row.napomena || '').trim(),
            });
            mCreated++;
        });

        setResult({ wCreated, wSkipped, cCreated, cSkipped, pCreated, pSkipped, eCreated, eSkipped, mCreated, mSkipped });
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
                                <button className="btn btn-primary" onClick={() => generateExport(companyId)} style={{ whiteSpace: 'nowrap' }}>
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
                            {lang === 'bs' ? 'Kliknite ili prevucite .xlsx fajl ovdje' : 'Click or drag & drop .xlsx file here'}
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
                            { label: lang === 'bs' ? 'Radnika' : 'Workers', count: preview.workers.length, icon: '👷', color: 'var(--primary)' },
                            { label: lang === 'bs' ? 'Uvjerenja' : 'Certificates', count: preview.certs.length, icon: '📜', color: '#9C27B0' },
                            { label: 'OZO / PPE', count: preview.ppe.length, icon: '🦺', color: '#FF9800' },
                            { label: lang === 'bs' ? 'Oprema' : 'Equipment', count: (preview.equip || []).length, icon: '⚙️', color: '#607D8B' },
                            { label: lang === 'bs' ? 'Ljekarski' : 'Medical', count: (preview.medExams || []).length, icon: '🩺', color: '#E91E63' },
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
                        ].filter(x => x.val > 0).map(({ label, val, color }) => (
                            <div key={label} className="card" style={{ padding: 14, textAlign: 'center' }}>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{val}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn btn-ghost" onClick={reset}>📥 {lang === 'bs' ? 'Novi import' : 'New import'}</button>
                        <a href="/dashboard/workers" className="btn btn-primary">👷 {lang === 'bs' ? 'Idi na Radnike' : 'Go to Workers'}</a>
                    </div>
                </div>
            )}
        </div>
    );
}
