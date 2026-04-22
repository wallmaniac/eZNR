const fs = require('fs');

let content = fs.readFileSync('src/app/dashboard/import/page.js', 'utf8');

if (!content.includes('const [isUploading, setIsUploading] = useState(false);')) {
    content = content.replace(
        "const [importing, setImporting] = useState(false);",
        "const [importing, setImporting] = useState(false);\n    const [isUploading, setIsUploading] = useState(false);"
    );
}

const newProcessFile = `    const processFile = (file) => {
        setIsUploading(true);
        setTimeout(() => {
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
                } finally {
                    setIsUploading(false);
                }
            };
            reader.readAsBinaryString(file);
        }, 50); // Yield to browser to paint UI
    };`;

content = content.replace(/    const processFile = \(file\) => \{[\s\S]*?reader\.readAsBinaryString\(file\);\n    };\n/g, newProcessFile + "\n");

if (!content.includes('isUploading ?')) {
    content = content.replace(
        `{lang === 'bs' ? 'Kliknite ili prevucite .xlsx dokument ovdje' : 'Click or drag & drop .xlsx file here'}`,
        `{isUploading ? (lang === 'bs' ? '⚙️ Učitavanje u toku...' : '⚙️ Processing file...') : (lang === 'bs' ? 'Kliknite ili prevucite .xlsx dokument ovdje' : 'Click or drag & drop .xlsx file here')}`
    );
}

// Yield handleImport
const newHandleImport = `    const handleImport = async () => {
        setImporting(true);
        await new Promise(r => setTimeout(r, 50)); // Yield to paint UI
        const { workers: wRows = [], `;

content = content.replace(
    /    const handleImport = async \(\) => \{\n        setImporting\(true\);\n        const \{ workers: wRows = \[\], /g,
    newHandleImport
);


fs.writeFileSync('src/app/dashboard/import/page.js', content, 'utf8');
console.log('patched import yielding');
