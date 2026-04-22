const fs = require('fs');

// PATCH WORKERS PAGE
let wrkContent = fs.readFileSync('src/app/dashboard/workers/page.js', 'utf8');
wrkContent = wrkContent.replace(
    "create(COLLECTIONS.PPE_TYPES, { naziv: ppeFormData.naziv.trim(), kategorija: 'Ostala OZO', norm: '' });",
    "create(COLLECTIONS.PPE_TYPES, { naziv: ppeFormData.naziv.trim(), kategorija: 'Ostala OZO', norm: '' });\n            setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));"
);
fs.writeFileSync('src/app/dashboard/workers/page.js', wrkContent, 'utf8');

// PATCH WORKER-PPE PAGE
let wppeContent = fs.readFileSync('src/app/dashboard/worker-ppe/page.js', 'utf8');
wppeContent = wppeContent.replace(
    "const ppeTypes = useMemo(() => getAll(COLLECTIONS.PPE_TYPES), []);",
    "const [ppeTypes, setPpeTypes] = useState(() => getAll(COLLECTIONS.PPE_TYPES));"
);
const handleSaveRep = `  const handleSave = () => {
    if (!addForm.workerId || !addForm.naziv.trim()) return;
    setSaving(true);
    
    // Auto-create new OZO if missing from Codebook
    const existingOzo = getAll(COLLECTIONS.PPE_TYPES).find(o => o.naziv.toLowerCase().trim() === addForm.naziv.trim().toLowerCase());
    if (!existingOzo) {
        create(COLLECTIONS.PPE_TYPES, { naziv: addForm.naziv.trim(), kategorija: 'Ostala OZO', norm: '' });
        setPpeTypes(getAll(COLLECTIONS.PPE_TYPES));
    }
    
    // Create new PPE Assignment
    const saved = create(COLLECTIONS.PPE_ASSIGNMENTS, {`;

wppeContent = wppeContent.replace(
    /  const handleSave = \(\) => \{\n    if \(\!addForm\.workerId \|\| \!addForm\.naziv\.trim\(\)\) return;\n    setSaving\(true\);\n    const saved = create\(COLLECTIONS\.PPE_ASSIGNMENTS, \{/g,
    handleSaveRep
);
fs.writeFileSync('src/app/dashboard/worker-ppe/page.js', wppeContent, 'utf8');
console.log('patched OZO immediate states');
