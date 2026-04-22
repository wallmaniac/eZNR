const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/import/page.js', 'utf8');

const importsToAdd = `import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';\nimport { db } from '@/lib/firebaseConfig';`;
if(!content.includes('firebase/firestore')) {
    content = content.replace("import * as XLSX from 'xlsx';", "import * as XLSX from 'xlsx';\n" + importsToAdd);
}

const wipeImpl = `
    const handleWipeDev = async () => {
        if (activeCompanyId === 'all' || !activeCompanyId) {
            alert('MORA BITI ODABRANA KONKRETNA KOMPANIJA!');
            return;
        }
        if (!confirm('DA LI STE SIGURNI DA ZELITE TRAJNO OBRISATI SVE PODATKE ZA TRENUTNU KOMPANIJU? OVO SE NE MOZE VRATITI!')) return;
        setImporting(true);
        setFileError('Brisanje u toku, molim sacekajte...');
        try {
            const colsToWipe = ['radnici', 'uvjerenja', 'ozo', 'oprema', 'vozila', 'ljekarski', 'orgJedinice', 'radnaMjesta', 'ppAparati', 'hidranti', 'ppeAssignments', 'medicalExams', 'fireExtinguishers', 'equipment', 'certificates', 'vehicles', 'hydrants', 'workplaces', 'orgUnits', 'workers'];
            let totalD = 0;
            for(let c of colsToWipe) {
                const ref = collection(db, \`companies/\${activeCompanyId}/\${c}\`);
                const snap = await getDocs(ref);
                if(snap.empty) continue;
                for(let i=0; i<snap.docs.length; i+=400) {
                    const chunk = snap.docs.slice(i, i+400);
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                    totalD += chunk.length;
                }
            }
            alert('WIPE GOTOV! Obrisano zapisa: ' + totalD);
            setFileError('');
        } catch(e) {
            alert('GRESKA: ' + e.message);
        }
        setImporting(false);
    };
`;

const buttonHtml = `
                                <button className="btn btn-primary" onClick={handleWipeDev} style={{ whiteSpace: 'nowrap', background: '#D32F2F', borderColor: '#D32F2F' }}>
                                    ☠️ HARD WIPE DSC
                                </button>`;

if(!content.includes('handleWipeDev')) {
    content = content.replace('const reset = () => {', wipeImpl + '\n    const reset = () => {');
    content = content.replace('<button className="btn btn-primary" onClick={() => generateExport(activeCompanyId)} style={{ whiteSpace: \'nowrap\' }}>', buttonHtml + '\n                                <button className="btn btn-primary" onClick={() => generateExport(activeCompanyId)} style={{ whiteSpace: \'nowrap\' }}>');
    fs.writeFileSync('src/app/dashboard/import/page.js', content, 'utf8');
    console.log('injected wipe logic');
}
