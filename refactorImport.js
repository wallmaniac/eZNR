const fs = require('fs');

const path = 'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/import/page.js';
let content = fs.readFileSync(path, 'utf8');

// Also update imports at the top
content = content.replace("import { create, getAll, COLLECTIONS } from '@/lib/dataStore';", "import { create, createMass, getAll, COLLECTIONS } from '@/lib/dataStore';");

// The replacement handleImport block
const newHandleImport = `
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
            newWorkerMap[\`\${sw.ime}__\${sw.prezime}\`] = sw.id;
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
                radnikIme: \`\${worker.ime} \${worker.prezime}\`, tipPregleda: tipPregleda,
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
                vozacId: worker ? worker.id : '', vozacIme: worker ? \`\${worker.ime} \${worker.prezime}\` : '',
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
    };`;

function replaceBlock(source, startStr, endStr, newBlock) {
    const startIndex = source.indexOf(startStr);
    if (startIndex === -1) throw new Error("Could not find start str: " + startStr.substring(0, 50));
    
    // Find the matching end index
    const endIndex = source.indexOf(endStr, startIndex + startStr.length);
    if (endIndex === -1) throw new Error("Could not find end str: " + endStr);
    
    return source.substring(0, startIndex) + newBlock + source.substring(endIndex + endStr.length);
}

// target string starts exactly at "const handleImport = () => {"
const startMatches = "const handleImport = () => {\n        setImporting(true);";
const endMatches = "setStep('done');\n    };";

const finalContent = replaceBlock(content, startMatches, endMatches, newHandleImport.trim());
fs.writeFileSync(path, finalContent);
console.log('Successfully refactored handleImport in page.js');
