const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/import/page.js', 'utf8');

const seedOzoImpl = `
    const handleSeedOZO = async () => {
        setImporting(true);
        setFileError('Seedovanje OZO baze u toku...');
        try {
            const novaOp = [
                { id: 'ozo_sljem', naziv: 'Zaštitni šljem (kaciga)', kategorija: 'Zaštita glave', norm: 'EN 397' },
                { id: 'ozo_kapa', naziv: 'Zaštitna kapa', kategorija: 'Zaštita glave', norm: 'EN 812' },
                { id: 'ozo_potkapa', naziv: 'Potkapa (termo/vatrootporna)', kategorija: 'Zaštita glave', norm: '' },
                { id: 'ozo_vizir', naziv: 'Vizir od polikarbonata', kategorija: 'Zaštita očiju i lica', norm: 'EN 166' },
                { id: 'ozo_naocale_b', naziv: 'Zaštitne naočale s bočnom zaštitom', kategorija: 'Zaštita očiju i lica', norm: 'EN 166' },
                { id: 'ozo_maska_zav', naziv: 'Maska za zavarivanje', kategorija: 'Zaštita očiju i lica', norm: 'EN 175' },
                { id: 'ozo_antifoni', naziv: 'Antifoni (štitnici za uši)', kategorija: 'Zaštita sluha', norm: 'EN 352-1' },
                { id: 'ozo_cepici', naziv: 'Čepići za uši', kategorija: 'Zaštita sluha', norm: 'EN 352-2' },
                { id: 'ozo_ffp2', naziv: 'FFP2/FFP3 respirator', kategorija: 'Zaštita dišnih organa', norm: 'EN 149' },
                { id: 'ozo_polumaska', naziv: 'Polumaska s filterom', kategorija: 'Zaštita dišnih organa', norm: 'EN 140' },
                { id: 'ozo_ruk_koz', naziv: 'Kožne radne rukavice', kategorija: 'Zaštita ruku', norm: 'EN 388' },
                { id: 'ozo_ruk_kem', naziv: 'Rukavice za kemikalije (nitril)', kategorija: 'Zaštita ruku', norm: 'EN 374' },
                { id: 'ozo_ruk_kevlar', naziv: 'Rukavice protiv prosijecanja (Kevlar)', kategorija: 'Zaštita ruku', norm: 'EN 388' },
                { id: 'ozo_cipele_s3', naziv: 'Radne cipele S3 (čelična kapica)', kategorija: 'Zaštita nogu', norm: 'EN ISO 20345' },
                { id: 'ozo_cizme_pvc', naziv: 'Zaštitne čizme (PVC)', kategorija: 'Zaštita nogu', norm: 'EN ISO 20345' },
                { id: 'ozo_koljen', naziv: 'Štitnici za koljena', kategorija: 'Zaštita nogu', norm: 'EN 14404' },
                { id: 'ozo_prsluk', naziv: 'Reflektirajući prsluk', kategorija: 'Zaštita trupa', norm: 'EN ISO 20471' },
                { id: 'ozo_kombinezon', naziv: 'Vatrootporni kombinezon', kategorija: 'Zaštita trupa', norm: 'EN ISO 11612' },
                { id: 'ozo_radno', naziv: 'Radno odijelo (dvodijelno)', kategorija: 'Zaštita trupa', norm: '' },
                { id: 'ozo_pregaca', naziv: 'Kožna pregača za zavarivanje', kategorija: 'Zaštita trupa', norm: 'EN ISO 11611' },
                { id: 'ozo_uprtac', naziv: 'Sigurnosni uprtač', kategorija: 'Zaštita od pada', norm: 'EN 361' }
            ];
            
            const batch = writeBatch(db);
            novaOp.forEach(d => {
                const ref = doc(collection(db, 'ppeTypes'), d.id);
                batch.set(ref, d, { merge: true });
            });
            await batch.commit();

            alert('OZO baza uspjesno dopunjena sa 20+ novih artikala!');
            setFileError('');
        } catch(e) {
            alert('GRESKA (OZO): ' + e.message);
        }
        setImporting(false);
    };
`;

const buttonHtml = `
                                <button className="btn btn-primary" onClick={handleSeedOZO} style={{ whiteSpace: 'nowrap', background: '#FF9800', borderColor: '#FF9800', marginLeft: 8 }}>
                                    🦺 SEED OZO LIST
                                </button>`;

if(!content.includes('handleSeedOZO')) {
    content = content.replace('const handleWipeDev = async () => {', seedOzoImpl + '\n    const handleWipeDev = async () => {');
    content = content.replace('☠️ HARD WIPE DSC\n                                </button>', '☠️ HARD WIPE DSC\n                                </button>' + buttonHtml);
    fs.writeFileSync('src/app/dashboard/import/page.js', content, 'utf8');
    console.log('injected OZO logic');
} else {
    console.log('OZO logic already injected');
}
