const fs = require('fs');

let content = fs.readFileSync('src/app/q/obs/[companyId]/page.js', 'utf8');

const newHandleSubmit = `    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (!formData.opis.trim() || !formData.lokacija.trim() || !imageFile) {
            setErrorMsg(lang === 'bs' ? 'Popunite opis, lokaciju i obavezno uslikajte problem.' : 'Description, location and photo are mandatory.');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Upload File to Firebase Storage
            const uploaded = await uploadSecureFile(companyId, 'safety_observations', imageFile);

            // 2. Save directly to Firestore using Client SDK
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
            }

            // 3. Send Email Alert by requesting proxy
            let targetEmail = '';
            try {
                const nsRes = await fetch('/api/firebase-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ functionName: 'getNotifSettings', data: { companyId } })
                });
                const nsData = await nsRes.json();
                if (nsData?.success && nsData.settings?.obsNotifEmail) {
                    targetEmail = nsData.settings.obsNotifEmail;
                }
            } catch(e) { }

            if (targetEmail) {
                // Send hazard email
                await fetch('/api/firebase-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        functionName: 'sendEmail',
                        data: {
                            isHazard: true,
                            toEmail: targetEmail,
                            companyName: companyInfo.name,
                            location: formData.lokacija,
                            description: formData.opis,
                            reporterName: formData.ime || 'Anonimno',
                            imageLink: uploaded.url,
                            dashboardLink: window.location.origin + '/dashboard/observations'
                        }
                    })
                });
            }

            setSuccess(true);
        } catch (err) {
            console.error(err);
            setErrorMsg(lang === 'bs' ? 'Desila se greška pri slanju. Pokušajte ponovo.' : 'An error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };`;

content = content.replace(/    const handleSubmit = async \(e\) => \{[\s\S]*?setSubmitting\(false\);\n        \}\n    \};/, newHandleSubmit);
fs.writeFileSync('src/app/q/obs/[companyId]/page.js', content, 'utf8');
console.log('patched handleSubmit!');
