const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');

console.log('eZNR Backend Stress Test Configured for 100 Concurrent Connections');

let serviceAccount;
try {
    serviceAccount = require('../eznr-ee559-firebase-adminsdk-fbsvc-5b826d8d68.json');
} catch (err) {
    console.error('FATAL: Firebase Admin key missing. Cannot run stress test.');
    process.exit(1);
}

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const TARGET_COMPANY_ID = 'mo00gqbmhsqj2rrd0ksw0'; // Example company ID, fallback will dynamically pick

async function runTest() {
    console.log('Initializing test... fetching a real company ID for targets...');
    let target = TARGET_COMPANY_ID;
    const comps = await db.collection('companies').limit(1).get();
    if (!comps.empty) target = comps.docs[0].id;
    
    console.log(`\n===========================================`);
    console.log(`🚀 LAUNCHING 100 CONCURRENT USERS STRESS TEST`);
    console.log(`🎯 Target Company ID: ${target}`);
    console.log(`===========================================\n`);

    const stats = {
        totalReads: 0,
        totalWrites: 0,
        failedWrites: 0,
        latencies: []
    };

    const CONCURRENT_USERS = 100;
    const WRITE_CYCLES = 3;

    // 1. Simulate 100 users opening the app at the exact same moment
    console.log(`Phase 1: Simulating ${CONCURRENT_USERS} users parallel initial data load...`);
    const startLoad = performance.now();
    
    // We will do parallel raw reads directly targeting the companies/{id}/ workers collection
    const readPromises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
        readPromises.push((async () => {
            const startReadMs = performance.now();
            await db.collection(`companies/${target}/workers`).get();
            stats.totalReads++;
            return performance.now() - startReadMs;
        })());
    }

    const readResults = await Promise.all(readPromises);
    const avgRead = readResults.reduce((a,b) => a + b, 0) / CONCURRENT_USERS;
    console.log(`✅ Phase 1 Complete in ${((performance.now() - startLoad)/1000).toFixed(2)}s`);
    console.log(`📊 Average Read Latency per User: ${avgRead.toFixed(2)}ms`);

    // 2. Simulate users performing concurrent WRITES (e.g., saving forms at the same time)
    console.log(`\nPhase 2: Executing ${CONCURRENT_USERS * WRITE_CYCLES} concurrent background database writes...`);
    const writePromises = [];
    
    // Create a temporary load testing document we will constantly smash
    const testDocRef = db.collection(`companies/${target}/load_test_logs`).doc('traffic_spike');
    await testDocRef.set({ init: true });

    const startWrite = performance.now();
    
    for (let c = 0; c < WRITE_CYCLES; c++) {
        for (let i = 0; i < CONCURRENT_USERS; i++) {
            writePromises.push((async () => {
                const s = performance.now();
                try {
                    await testDocRef.update({
                        [`hits.user_${i}_cycle_${c}`]: FieldValue.serverTimestamp(),
                        totalOperations: FieldValue.increment(1)
                    });
                    stats.totalWrites++;
                    stats.latencies.push(performance.now() - s);
                } catch(e) {
                    stats.failedWrites++;
                }
            })());
        }
    }

    await Promise.all(writePromises);
    const avgWrite = stats.latencies.reduce((a,b) => a+b, 0) / Math.max(stats.latencies.length, 1);
    
    console.log(`✅ Phase 2 Complete in ${((performance.now() - startWrite)/1000).toFixed(2)}s`);
    console.log(`📊 Average Write Latency per Transaction: ${avgWrite.toFixed(2)}ms`);
    if (stats.failedWrites > 0) {
        console.warn(`⚠️ ${stats.failedWrites} writes failed due to concurrent contention limits!`);
    }

    console.log(`\n🧹 Cleaning up test data...`);
    await testDocRef.delete();

    console.log(`\n🏁 EXTREME LOAD TEST FINISHED.`);
    console.log(`Total DB Operations: ${stats.totalReads} reads, ${stats.totalWrites} writes.`);
}

runTest().catch(console.error);
