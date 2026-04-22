const fs = require('fs');

let content = fs.readFileSync('src/app/q/obs/[companyId]/page.js', 'utf8');

// 1. Remove capture="environment"
content = content.replace('capture="environment"', '');

// 2. Replace addDoc client SDK call with fetch proxy
const oldAddDoc = `            // 2. Save directly to Firestore using Client SDK
            try {
                const docRef = await addDoc(collection(db, \`companies/\${companyId}/safety_observations\`), {
                    opis: formData.opis,
                    lokacija: formData.lokacija,
                    ime: formData.ime || 'Anonimno',
                    slika: uploaded,
                    status: 'Novo',
                    datum: new Date().toISOString(),
                });
            } catch(dbErr) {
                console.error('Firestore save failed:', dbErr);
                throw new Error('Database locked or unavailable');
            }`;

const newAddDoc = `            // 2. Save to Firestore via Firebase Proxy to bypass Client Security Rules
            try {
                const proxyDbRes = await fetch('/api/firebase-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        functionName: 'saveHazard',
                        data: {
                            companyId,
                            payload: {
                                opis: formData.opis,
                                lokacija: formData.lokacija,
                                ime: formData.ime || 'Anonimno',
                                slika: uploaded,
                                status: 'Novo',
                                datum: new Date().toISOString(),
                            }
                        }
                    })
                });
                const proxyDbData = await proxyDbRes.json();
                if (!proxyDbData.success) {
                    throw new Error(proxyDbData.error || 'Server rejected saveHazard');
                }
            } catch(dbErr) {
                console.error('Firestore save via proxy failed:', dbErr);
                throw new Error('Database locked or unavailable');
            }`;

content = content.replace(oldAddDoc, newAddDoc);

fs.writeFileSync('src/app/q/obs/[companyId]/page.js', content, 'utf8');
console.log('patched public page!');
