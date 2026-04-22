const fs = require('fs');

let content = fs.readFileSync('src/components/Sidebar.js', 'utf8');

const targetMenu = "{ key: 'questionnaires', icon: '❓', path: '/dashboard/questionnaires' },";
const replacementMenu = `{ key: 'questionnaires', icon: '❓', path: '/dashboard/questionnaires' },
            { key: 'observations',   icon: '🚨', path: '/dashboard/observations', label_bs: 'Prijave opasnosti', label_en: 'Hazard Reports' },`;

content = content.replace(targetMenu, replacementMenu);

const tooltipBsItem = "questionnaires: 'Upitnici i ankete — kreiranje i slanje obrazaca radnicima putem emaila',";
const tooltipBsRepl = `questionnaires: 'Upitnici i ankete — kreiranje i slanje obrazaca radnicima putem emaila',
        observations: 'Prijave opasnosti — prijave problema sa terena putem QR koda',`;

content = content.replace(tooltipBsItem, tooltipBsRepl);

const tooltipEnItem = "questionnaires: 'Questionnaires & surveys — create and email forms to workers',";
const tooltipEnRepl = `questionnaires: 'Questionnaires & surveys — create and email forms to workers',
        observations: 'Hazard Reports — field issue reports via QR code',`;

content = content.replace(tooltipEnItem, tooltipEnRepl);

fs.writeFileSync('src/components/Sidebar.js', content, 'utf8');
console.log('patched Sidebar.js');
