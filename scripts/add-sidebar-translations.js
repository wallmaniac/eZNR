const fs = require('fs');
const path = require('path');

const transPath = path.join(__dirname, '..', 'src', 'i18n', 'translations.js');
let content = fs.readFileSync(transPath, 'utf-8');

const newKeys = {
  serviceRecords: {
    bs: 'Servisni zapisnici',
    en: 'Service Records',
    hr: 'Servisni zapisnici',
    de: 'Serviceberichte',
    sl: 'Servisni zapisniki',
    sr: 'Servisni zapisnici'
  },
  observations: {
    bs: 'Prijave opasnosti',
    en: 'Hazard Reports',
    hr: 'Prijave opasnosti',
    de: 'Gefahrenmeldungen',
    sl: 'Prijave nevarnosti',
    sr: 'Prijave opasnosti'
  },
  testoviZopZnr: {
    bs: 'Testovi ZOP i ZNR',
    en: 'ZOP & ZNR Tests',
    hr: 'Testovi ZOP i ZNR',
    de: 'ZOP & ZNR Tests',
    sl: 'ZOP & ZNR testi',
    sr: 'Testovi ZOP i ZNR'
  },
  obrasciIUputnice: {
    bs: 'Obrasci i uputnice',
    en: 'Forms & Referrals',
    hr: 'Obrasci i uputnice',
    de: 'Formulare & Überweisungen',
    sl: 'Obrazci in napotnice',
    sr: 'Obrasci i uputnice'
  },
  zapisniciAlat: {
    bs: 'Zapisnici',
    en: 'Minutes',
    hr: 'Zapisnici',
    de: 'Protokolle',
    sl: 'Zapisniki',
    sr: 'Zapisnici'
  },
  fleetVehicles: {
    bs: 'Popis vozila',
    en: 'Vehicle List',
    hr: 'Popis vozila',
    de: 'Fahrzeugliste',
    sl: 'Seznam vozil',
    sr: 'Popis vozila'
  },
  fleetAssignments: {
    bs: 'Zaduženja',
    en: 'Vehicle Assignments',
    hr: 'Zaduženja',
    de: 'Fahrzeugzuweisungen',
    sl: 'Dodelitve vozil',
    sr: 'Zaduženja'
  },
  fleetDocuments: {
    bs: 'Dokumentacija',
    en: 'Vehicle Documents',
    hr: 'Dokumentacija',
    de: 'Fahrzeugdokumentation',
    sl: 'Dokumentacija vozil',
    sr: 'Dokumentacija'
  },
  fleetOrders: {
    bs: 'Putni nalozi',
    en: 'Travel Orders',
    hr: 'Putni nalozi',
    de: 'Reiseaufträge',
    sl: 'Potni nalogi',
    sr: 'Putni nalozi'
  },
  evacuationPlans: {
    bs: 'Planovi evakuacije',
    en: 'Evacuation Plans',
    hr: 'Planovi evakuacije',
    de: 'Evakuierungspläne',
    sl: 'Evakuacijski načrti',
    sr: 'Planovi evakuacije'
  },
  evacuationDrills: {
    bs: 'Vježbe evakuacije',
    en: 'Evacuation Drills',
    hr: 'Vježbe evakuacije',
    de: 'Evakuierungsübungen',
    sl: 'Evakuacijske vaje',
    sr: 'Vežbe evakuacije'
  },
  grpISZNR: {
    bs: 'Interni akti ZNR',
    en: 'Internal OSH Acts',
    hr: 'Interni akti ZNR',
    de: 'Interne Arbeitsschutzvorschriften',
    sl: 'Interni akti varnosti pri delu',
    sr: 'Interni akti ZNR'
  }
};

const languages = ['bs', 'en', 'hr', 'de', 'sl', 'sr'];

for (const lang of languages) {
  // Build translations to insert
  const linesToInsert = [];
  for (const [key, valObj] of Object.entries(newKeys)) {
    const val = valObj[lang].replace(/'/g, "\\'");
    linesToInsert.push(`    ${key}: '${val}',`);
  }
  
  // Find block end
  const startIdx = content.indexOf(`  ${lang}: {`);
  if (startIdx === -1) {
    console.error(`Could not find block for ${lang}`);
    continue;
  }
  const endIdx = content.indexOf('\n  },', startIdx);
  if (endIdx === -1) {
    console.error(`Could not find end of block for ${lang}`);
    continue;
  }
  
  const insertText = '\n    // ── Sidebar translations ──\n' + linesToInsert.join('\n') + '\n';
  content = content.substring(0, endIdx) + insertText + content.substring(endIdx);
}

fs.writeFileSync(transPath, content, 'utf-8');
console.log('Successfully added sidebar translations to all 6 languages.');
