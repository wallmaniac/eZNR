const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

initializeApp({
    credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const db = getFirestore();

const COMPANY_SCOPED = [
    'orgUnits', 'workplaces', 'workers', 'equipment', 'injuries', 'diseases',
    'certificates', 'ppeAssignments', 'calendarEvents', 'employerDocs', 'referralsRa1', 'formsOir1', 'formsRo1', 'formsRo2', 'referralsNr1',
    'digitalArchive', 'requests', 'riskAssessments', 'riskItems', 'isznrDocuments', 'isznrParties',
    'authorizedCompanies', 'examiners', 'personTypes', 'hazards', 'questionnaires',
    'trainings', 'annualReports', 'medicalExams', 'sistematizacije',
    'vehicles', 'vehicleAssignments', 'travelOrders', 'fireExtinguishers', 'hydrants', 'evacuationPlans', 'evacuationDrills',
    'zapisnici', 'serviceLog', 'activityLog', 'nightWork',
];

async function run() {
    console.log('Searching for company "Dad"...');
    const snapshot = await db.collection('companies').where('naziv', '==', 'Dad').get();
    
    if (snapshot.empty) {
        console.log('No company found with naziv "Dad".');
        return;
    }

    const companyId = snapshot.docs[0].id;
    console.log(`Found company "Dad" with ID: ${companyId}`);

    // Delete subcollections
    for (const col of COMPANY_SCOPED) {
        const subColSnapshot = await db.collection(`companies/${companyId}/${col}`).get();
        if (!subColSnapshot.empty) {
            console.log(`Found ${subColSnapshot.size} docs in ${col}, deleting...`);
            const batch = db.batch();
            let count = 0;
            subColSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
                count++;
            });
            await batch.commit();
            console.log(`Deleted ${count} from ${col}.`);
        }
    }

    // Delete the company document itself
    await db.collection('companies').doc(companyId).delete();
    console.log('Company "Dad" deleted completely.');
}

run().catch(console.error);
