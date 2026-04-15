const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');

// Ensure you set GOOGLE_APPLICATION_CREDENTIALS before running
const serviceAccount = require('../eznr-ee559-firebase-adminsdk-fbsvc-5b826d8d68.json');

initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();

async function cleanUsers() {
    console.log('Fetching companies...');
    const compsSnap = await db.collection('companies').get();
    const validCompIds = new Set(compsSnap.docs.map(d => d.id));
    console.log('Valid companies:', validCompIds.size);

    const usersSnap = await db.collection('users').get();
    for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        if (data.companyIds && Array.isArray(data.companyIds)) {
            const originalLength = data.companyIds.length;
            const validIds = data.companyIds.filter(id => validCompIds.has(id));
            if (validIds.length < originalLength) {
                console.log(`Cleaning user ${userDoc.id} (${data.email}): removed ${originalLength - validIds.length} dead companies.`);
                await userDoc.ref.update({ companyIds: validIds });
            }
        }
    }
    console.log('Done.');
}

cleanUsers().catch(console.error);
