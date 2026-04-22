import fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/import/page.js', 'utf8');

const updatedCerts = `    // 2. Uvjerenja
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
    const wsC = XLSX.utils.aoa_to_sheet(cRows);`;

const updatedPpe = `    // 3. OZO
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
    const wsP = XLSX.utils.aoa_to_sheet(pRows);`;

const updatedMed = `    // 5. Ljekarski
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
    const wsM = XLSX.utils.aoa_to_sheet(mRows);`;

content = content.replace(/\/\/ 2\. Uvjerenja[\s\S]*?const wsC = XLSX\.utils\.aoa_to_sheet\(cRows\);/, updatedCerts);
content = content.replace(/\/\/ 3\. OZO[\s\S]*?const wsP = XLSX\.utils\.aoa_to_sheet\(pRows\);/, updatedPpe);
content = content.replace(/\/\/ 5\. Ljekarski[\s\S]*?const wsM = XLSX\.utils\.aoa_to_sheet\(mRows\);/, updatedMed);

fs.writeFileSync('src/app/dashboard/import/page.js', content, 'utf8');
console.log('REGEX PATCH APPLIED!');
