const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/workers/page.js', 'utf8');

const target = `    // Save PPE
    const handleSavePpe = async () => {
        if (!ppeFormData.naziv) { await alert(lang === 'bs' ? 'Naziv je obavezan!' : 'Name is required!'); return; }
        if (ppeEditId) {
            update(COLLECTIONS.PPE_ASSIGNMENTS, ppeEditId, { ...ppeFormData, workerId: editingWorker });
        } else {
            create(COLLECTIONS.PPE_ASSIGNMENTS, { ...ppeFormData, workerId: editingWorker });
        }
        setPpeAssign(getWorkerPPE(editingWorker));
        setShowPpeForm(false);
        setPpeEditId(null);
    };`;

const replacement = `    // Save PPE
    const handleSavePpe = async () => {
        if (!ppeFormData.naziv) { await alert(lang === 'bs' ? 'Naziv je obavezan!' : 'Name is required!'); return; }
        
        // Auto-create new OZO if missing from Codebook
        const existingOzo = getAll(COLLECTIONS.PPE_TYPES).find(o => o.naziv.toLowerCase().trim() === ppeFormData.naziv.trim().toLowerCase());
        if (!existingOzo) {
            create(COLLECTIONS.PPE_TYPES, { naziv: ppeFormData.naziv.trim(), kategorija: 'Ostala OZO', norm: '' });
        }

        if (ppeEditId) {
            update(COLLECTIONS.PPE_ASSIGNMENTS, ppeEditId, { ...ppeFormData, workerId: editingWorker });
        } else {
            create(COLLECTIONS.PPE_ASSIGNMENTS, { ...ppeFormData, workerId: editingWorker });
        }
        setPpeAssign(getWorkerPPE(editingWorker));
        setShowPpeForm(false);
        setPpeEditId(null);
    };`;

content = content.replace(target, replacement);
fs.writeFileSync('src/app/dashboard/workers/page.js', content, 'utf8');
console.log('patched workers/page.js');
