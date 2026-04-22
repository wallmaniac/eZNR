const fs = require('fs');

// Patch workers page
let wrkContent = fs.readFileSync('src/app/dashboard/workers/page.js', 'utf8');
wrkContent = wrkContent.replace(
    "setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));",
    "setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));\n            window.dispatchEvent(new CustomEvent('eznr:data-synced'));"
);
fs.writeFileSync('src/app/dashboard/workers/page.js', wrkContent, 'utf8');

// Patch worker-ppe page
let wppeContent = fs.readFileSync('src/app/dashboard/worker-ppe/page.js', 'utf8');
wppeContent = wppeContent.replace(
    "setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));\n    }",
    "setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));\n        window.dispatchEvent(new CustomEvent('eznr:data-synced'));\n    }"
);
fs.writeFileSync('src/app/dashboard/worker-ppe/page.js', wppeContent, 'utf8');
console.log('Added event dispatching to OZO auto-create blocks.');
