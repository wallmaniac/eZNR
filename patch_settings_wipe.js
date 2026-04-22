const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// Inject imports
if (!content.includes('writeBatch')) {
    content = content.replace("import { db } from '@/lib/firebase';", "import { db } from '@/lib/firebase';\nimport { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';");
}
if (!content.includes('COMPANY_SCOPED')) {
    content = content.replace("import { COLLECTIONS, getAll, create, update, remove, importMassData, generateExportData, getLocalData, saveLocalData } from '@/lib/dataStore';", "import { COLLECTIONS, COMPANY_SCOPED, getAll, create, update, remove, importMassData, generateExportData, getLocalData, saveLocalData } from '@/lib/dataStore';");
}

const wipeLogic = `
  const [wiping, setWiping] = useState(false);
  const handleWipeDev = async () => {
    if (!isAdmin) return;
    if (activeCompanyId === 'all' || !activeCompanyId) {
        alert('MORA BITI ODABRANA KONKRETNA KOMPANIJA!');
        return;
    }
    const pwd = prompt('Type "WIPE" to confirm deleting ALL DATA for ' + activeCompanyId);
    if(pwd !== 'WIPE') return;

    setWiping(true);
    try {
        let totalD = 0;
        const allCols = Object.values(COLLECTIONS).filter(c => COMPANY_SCOPED.includes(c));
        
        for(let c of allCols) {
            const ref = collection(db, \`companies/\${activeCompanyId}/\${c}\`);
            const snap = await getDocs(ref);
            if(snap.empty) continue;
            for(let i=0; i<snap.docs.length; i+=400) {
                const chunk = snap.docs.slice(i, i+400);
                const batch = writeBatch(db);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
                totalD += chunk.length;
            }
        }
        await alert('WIPE GOTOV! Obrisano zapisa: ' + totalD);
    } catch(e) {
        await alert('GRESKA: ' + e.message);
    }
    setWiping(false);
  };
`;

if (!content.includes('handleWipeDev')) {
    content = content.replace("const handleRunSync = async () => {", wipeLogic + "\n  const handleRunSync = async () => {");
}

const dangerZoneUI = `
            {isAdmin && (
              <>
                <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                <SectionHeader icon="☠️" title={lang === 'bs' ? 'Opasna zona (Super Admin)' : 'Danger Zone'} />
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.3)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#D32F2F', marginBottom: 16, fontWeight: 500 }}>
                    {lang === 'bs' 
                      ? 'PAŽNJA: Hard Wipe briše sve podatke za trenutno aktivnu kompaniju direktno sa Firebase Clouda. Ovo je nepovratno.' 
                      : 'WARNING: Hard Wipe completely deletes all data for the currently active company directly from Firebase. This cannot be undone.'}
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleWipeDev}
                    disabled={wiping || !activeCompanyId}
                    style={{ background: '#D32F2F', borderColor: '#D32F2F' }}
                  >
                    {wiping ? <span className="spinner" style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span> : '☠️'} 
                    {lang === 'bs' ? 'HARD WIPE DSC' : 'HARD WIPE COMPANY'}
                  </button>
                </div>
              </>
            )}
`;

if (!content.includes('Opasna zona (Super Admin)')) {
    // Inject at the very end of the <div className="card-body"> inside the System Settings Tab
    content = content.replace("              {syncResults && (\n                <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.15)'", 
    dangerZoneUI + "\n              {syncResults && (\n                <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.15)'");
}

fs.writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
console.log('injected WIPE DSC into settings/page.js');
