const fs = require('fs');

let content = fs.readFileSync('src/app/api/firebase-proxy/route.js', 'utf8');

if (!content.includes('saveHazard')) {
    const newFn = `        else if (body.functionName === 'saveHazard') {
            const { companyId, payload } = body.data;
            if (!companyId || !payload) return NextResponse.json({ success: false, error: 'Missing data' });
            
            const docRef = await adminDb.collection('companies').doc(companyId).collection('safety_observations').add(payload);
            
            return NextResponse.json({ success: true, id: docRef.id });
        }`;
    
    const target = `        return NextResponse.json({ success: false, error: 'Nepoznata funkcija' }, { status: 400 });`;
    content = content.replace(target, newFn + '\n' + target);
    fs.writeFileSync('src/app/api/firebase-proxy/route.js', content, 'utf8');
    console.log('Proxy patched for saveHazard.');
} else {
    console.log('Proxy already has saveHazard.');
}
