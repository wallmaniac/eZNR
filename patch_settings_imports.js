const fs = require('fs');

let content = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

const importString = `import { collection, getDocs, writeBatch } from 'firebase/firestore';\nimport { db } from '@/lib/firebase';\n`;

if (!content.includes('import { collection')) {
    content = content.replace("'use client';\n", "'use client';\n" + importString);
    fs.writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
}
console.log('Firebase imports added');
