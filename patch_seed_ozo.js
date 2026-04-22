const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/ppe/page.js', 'utf8');

// Inject useAuth import
if (!content.includes('useAuth')) {
    content = content.replace("import { useLanguage } from '@/contexts/LanguageContext';", "import { useLanguage } from '@/contexts/LanguageContext';\nimport { useAuth } from '@/contexts/AuthContext';\nimport { collection, doc, writeBatch } from 'firebase/firestore';\nimport { db } from '@/lib/firebase';");
}

// Inject user into component
if (!content.includes('const { user, isAdmin } = useAuth();')) {
    content = content.replace("const { t, lang } = useLanguage();", "const { t, lang } = useLanguage();\n  const { user, isAdmin } = useAuth();");
}

const seedLogic = `
  const handleSeedOZO = async () => {
    if(!isAdmin) return;
    setFormData({ naziv: 'Sijanje u toku...' });
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
            const ref = doc(collection(db, COLLECTIONS.PPE_TYPES), d.id);
            batch.set(ref, d, { merge: true });
        });
        await batch.commit();

        await alert('OZO baza uspjesno dopunjena sa 20+ novih artikala!');
        setFormData({ naziv: '' });
        loadData();
    } catch(e) {
        setFormData({ naziv: '' });
        alert('GRESKA (OZO): ' + e.message);
    }
  };
`;

if (!content.includes('handleSeedOZO')) {
    content = content.replace("const handleNew = () => {", seedLogic + "\n  const handleNew = () => {");
}

const seedButton = `
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={handleSeedOZO} style={{ background: '#FF9800', borderColor: '#FF9800' }}>🦺 SEED OZO LIST</button>}
`;

if (!content.includes('SEED OZO LIST')) {
    content = content.replace("<button className=\"btn btn-primary btn-sm\" onClick={handleNew}>+ {t('add')}</button>", "<button className=\"btn btn-primary btn-sm\" onClick={handleNew}>+ {t('add')}</button>" + seedButton);
}


fs.writeFileSync('src/app/dashboard/ppe/page.js', content, 'utf8');
console.log('injected SEED OZO into ppe/page.js');
