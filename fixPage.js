const fs = require('fs');

const path = 'c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/import/page.js';
let c = fs.readFileSync(path, 'utf8');
c = c.replace("import { create, getAll, COLLECTIONS } from '@/lib/dataStore';", "import { create, createMass, getAll, COLLECTIONS } from '@/lib/dataStore';");

const start = 'const handleImport = () => {';
const end = "setStep('done');\r\n    };";
let idxA = c.indexOf(start);
let idxB = c.indexOf(end);
if (idxB === -1) {
    // try fallback
    const fallbackEnd = "setStep('done');\n    };";
    idxB = c.indexOf(fallbackEnd);
    if(idxB !== -1) {
        endStrLen = fallbackEnd.length;
    }
} else {
    endStrLen = end.length;
}

if(idxA === -1 || idxB === -1) {
    console.error('Cannot find block', idxA, idxB);
    process.exit(1);
}

const reqScript = fs.readFileSync('c:/Users/zzida/Desktop/znrba/app/refactorImport.js', 'utf8');
const newHandleImport = reqScript.split('const newHandleImport = `')[1].split('`;')[0].trim();

c = c.substring(0, idxA) + newHandleImport + '\r\n' + c.substring(idxB + endStrLen);
fs.writeFileSync(path, c);
console.log('Success');
