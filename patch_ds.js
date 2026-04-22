const fs = require('fs');
let content = fs.readFileSync('src/lib/dataStore.js', 'utf8');

content = content.replace(
    /EVACUATION_DRILLS: 'evacuationDrills',\n    ZAPISNICI: 'zapisnici',\n};/g,
    "EVACUATION_DRILLS: 'evacuationDrills',\n    ZAPISNICI: 'zapisnici',\n    SAFETY_OBSERVATIONS: 'safety_observations',\n};"
);

content = content.replace(
    /'zapisnici', 'serviceLog', 'activityLog', 'nightWork',\n\];/g,
    "'zapisnici', 'serviceLog', 'activityLog', 'nightWork', 'safety_observations',\n];"
);

fs.writeFileSync('src/lib/dataStore.js', content, 'utf8');
console.log('patched datastore');
