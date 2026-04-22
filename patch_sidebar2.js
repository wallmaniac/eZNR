const fs = require('fs');

let content = fs.readFileSync('src/components/Sidebar.js', 'utf8');

// target to remove
const targetOriginal = `            { key: 'questionnaires', icon: '❓', path: '/dashboard/questionnaires' },
            { key: 'observations',   icon: '🚨', path: '/dashboard/observations', label_bs: 'Prijave opasnosti', label_en: 'Hazard Reports' },`;

content = content.replace(targetOriginal, `            { key: 'questionnaires', icon: '❓', path: '/dashboard/questionnaires' },`);

// target to insert
const safetyAnchor = `{ key: 'diseaseReport',      icon: '🏥', path: '/dashboard/diseases' },
            { key: 'annualInjuryReport', icon: '📈', path: '/dashboard/annual-injuries' },`;

const safetyNew = `{ key: 'diseaseReport',      icon: '🏥', path: '/dashboard/diseases' },
            { key: 'observations',       icon: '🚨', path: '/dashboard/observations', label_bs: 'Prijave opasnosti', label_en: 'Hazard Reports' },
            { key: 'annualInjuryReport', icon: '📈', path: '/dashboard/annual-injuries' },`;

content = content.replace(safetyAnchor, safetyNew);

fs.writeFileSync('src/components/Sidebar.js', content, 'utf8');
console.log('Sidebar.js successfully updated.');
