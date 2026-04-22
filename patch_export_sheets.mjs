import fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/import/page.js', 'utf8');

// ==== UVJERENJA ====
const oldUvjerenja = `    const certs = getAll(COLLECTIONS.CERTIFICATES).filter(c => companyId === 'all' || c.companyId === companyId);
    certs.forEach(c => {
        const worker = workers.find(w => w.id === c.workerId);
        cRows.push([
            worker?.ime || '', worker?.prezime || '', worker?.jmbg || '',
            c.naziv || '', c.oznaka || '', c.tipUvjerenja || '', c.datum || '', c.vrijediDo || '', c.sposobnost || '', c.ogranicenje || ''
        ]);
    });`;

const newUvjerenja = `    const certs = getAll(COLLECTIONS.CERTIFICATES).filter(c => companyId === 'all' || c.companyId === companyId);
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
    });`;
content = content.replace(oldUvjerenja, newUvjerenja);


// ==== OZO ====
const oldOzo = `    const ppe = getAll(COLLECTIONS.PPE_ASSIGNMENTS).filter(p => companyId === 'all' || p.companyId === companyId);
    ppe.forEach(p => {
        const worker = workers.find(w => w.id === p.workerId);
        pRows.push([
            worker?.ime || '', worker?.prezime || '', worker?.jmbg || '',
            p.naziv || '', p.datumZaduzenja || '', p.datumRazduzenja || '', p.kolicina || ''
        ]);
    });`;

const newOzo = `    const ppe = getAll(COLLECTIONS.PPE_ASSIGNMENTS).filter(p => companyId === 'all' || p.companyId === companyId);
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
    });`;
content = content.replace(oldOzo, newOzo);


// ==== LJEKARSKI ====
const oldLjekarski = `    const medExams = getAll(COLLECTIONS.MEDICAL_EXAMS).filter(m => companyId === 'all' || m.companyId === companyId);
    medExams.forEach(m => {
        const worker = workers.find(w => w.id === m.workerId);
        mRows.push([
            worker?.ime || '', worker?.prezime || '', worker?.jmbg || '',
            m.tipPregleda || '', m.datumPregleda || m.datum || '', m.vrijediDo || '', m.rezultat || '', m.napomena || ''
        ]);
    });`;

const newLjekarski = `    const medExams = getAll(COLLECTIONS.MEDICAL_EXAMS).filter(m => companyId === 'all' || m.companyId === companyId);
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
    });`;
content = content.replace(oldLjekarski, newLjekarski);


fs.writeFileSync('src/app/dashboard/import/page.js', content, 'utf8');
console.log('patched generateExport empty rows structure.');
