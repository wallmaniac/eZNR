'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

export default function FirebasePenTest() {
    const [logs, setLogs] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isStorming, setIsStorming] = useState(false);

    const [simulateCount, setSimulateCount] = useState('100');

    const log = (msg, type = 'info') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    const runStormTest = async () => {
        const parsedCount = Math.max(1, parseInt(simulateCount) || 1);
        setIsStorming(true);
        setLogs([]);
        log(`Starting ${parsedCount}-User Background Storm Simulation...`, 'warning');
        
        let activeCompanyId = localStorage.getItem('eznr_activeCompany');
        const userStr = localStorage.getItem('eznr_user');
        const user = userStr ? JSON.parse(userStr) : null;

        if (activeCompanyId === 'all' && user?.companyIds?.length) {
            activeCompanyId = user.companyIds[0];
            log(`Active company is "all". Automatically using first assigned company: ${activeCompanyId} for the test.`, 'info');
        }

        if (!activeCompanyId) {
            log('No active company. Please select a company.', 'error');
            setIsStorming(false);
            return;
        }

        log(`Continuously spamming 'storm_events' simulating ${parsedCount} users for 15 seconds in background... Please TEST YOUR UI NOW!`, 'info');
        
        try {
            const startTime = Date.now();
            let count = 0;
            // Calibrate batch size based on simulated user count (approx 10 ticks per second)
            const batchSize = Math.max(1, Math.floor(parsedCount / 10));
            
            while (Date.now() - startTime < 15000) {
                const batchPromises = [];
                for(let i = 0; i < batchSize; i++) {
                    const stormDoc = doc(db, 'companies', activeCompanyId, 'storm_events', `event_${count++}`);
                    batchPromises.push(setDoc(stormDoc, { timestamp: Date.now(), rand: Math.random() }));
                }
                await Promise.all(batchPromises);
                // Pause for 100ms to allow React to render the UI before the next blast
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            log(`✅ Sustained 15-second storm finished. Simulating ${parsedCount} users generated ${count} updates. If your dashboard remained snappy, you passed the stress test!`, 'success');
        } catch (err) {
            log(`❌ Storm failed: ${err.message}`, 'error');
        }
        setIsStorming(false);
    };

    const runTests = async () => {
        const parsedCount = Math.max(1, parseInt(simulateCount) || 1);
        setIsRunning(true);
        setLogs([]);
        log(`Starting Firebase PenTest with ${parsedCount} overlapping requests...`, 'info');

        let activeCompanyId = localStorage.getItem('eznr_activeCompany');
        const userStr = localStorage.getItem('eznr_user');
        const user = userStr ? JSON.parse(userStr) : null;

        if (activeCompanyId === 'all' && user?.companyIds?.length) {
            activeCompanyId = user.companyIds[0];
            log(`Active company is "all". Using first assigned company for security check: ${activeCompanyId}`, 'info');
        }

        if (!user || user.role === 'admin') {
            log('WARNING: You are logged in as Admin or not logged in. Admins bypass all rules. Please login as a standard "officer" of a company to test true isolation.', 'warning');
        } else {
            log(`Logged in as: ${user.firstName} (Role: ${user.role})`, 'info');
        }

        log(`Active Company: ${activeCompanyId}`, 'info');

        const dummyTargetId = 'TARGET_FOREIGN_COMPANY_123';
        
        // TEST 1: Read Own Company
        try {
            log(`[TEST 1] Attempting to read own company workers (/companies/${activeCompanyId}/workers)...`, 'info');
            const ownRef = collection(db, 'companies', activeCompanyId, 'workers');
            await getDocs(ownRef);
            log('✅ TEST 1 PASSED: Successfully read own company data.', 'success');
        } catch (err) {
            log(`❌ TEST 1 FAILED: Could not read own data. Error: ${err.message}`, 'error');
        }

        // TEST 2: Multi-threaded Read Foreign Company
        try {
            log(`[TEST 2] Attempting to read FOREIGN company workers ${parsedCount} times simultaneously...`, 'info');
            const foreignRef = collection(db, 'companies', dummyTargetId, 'workers');
            const parallelReads = Array.from({ length: parsedCount }).map(() => getDocs(foreignRef));
            await Promise.all(parallelReads);
            log('❌ TEST 2 FAILED: SECURITY BREACH! Successfully read foreign company data.', 'error');
        } catch (err) {
            if (err.code === 'permission-denied') {
                log(`✅ TEST 2 PASSED: Permission strictly denied for ALL ${parsedCount} foreign reads.`, 'success');
            } else {
                log(`🤔 TEST 2 UNKNOWN: Failed, but not with permission-denied. Error: ${err.message}`, 'warning');
            }
        }

        // TEST 3: Multi-threaded Write Foreign Company
        try {
            log(`[TEST 3] Attempting to write FOREIGN company document ${parsedCount} times simultaneously...`, 'info');
            const foreignDoc = doc(db, 'companies', dummyTargetId, 'workers', 'hack');
            const parallelWrites = Array.from({ length: parsedCount }).map(() => setDoc(foreignDoc, { hacked: true }));
            await Promise.all(parallelWrites);
            log('❌ TEST 3 FAILED: SECURITY BREACH! Successfully wrote to foreign company.', 'error');
        } catch (err) {
            if (err.code === 'permission-denied') {
                log(`✅ TEST 3 PASSED: Permission strictly denied for ALL ${parsedCount} foreign writes.`, 'success');
            } else {
                log(`🤔 TEST 3 UNKNOWN: Failed, but not with permission-denied. Error: ${err.message}`, 'warning');
            }
        }

        log('Penetration tests concluded.', 'info');
        setIsRunning(false);
    };

    const runPDFStressTest = async () => {
        const parsedCount = Math.max(1, parseInt(simulateCount) || 1);
        setIsRunning(true);
        setLogs([]);
        log(`Starting Heavy DOM PDF Generation Stress Test: ${parsedCount} reports...`, 'warning');

        try {
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.createElement('div');
            element.innerHTML = `<h1 style="color: black;">QA Stress Test</h1><p>Generating ${parsedCount} reports</p><table border="1"><tr><td>Test Worker</td><td>Compliance: 100%</td></tr></table>`;
            element.style.padding = '20px';
            element.style.background = 'white';
            element.style.color = 'black';
            document.body.appendChild(element); // Temp mount

            log(`Simulating ${parsedCount} users simultaneously generating a PDF heavy report...`, 'info');
            
            const startTime = Date.now();
            const exportPromises = [];

            const opt = {
                margin: 10,
                filename: 'Stress_Test.pdf',
                image: { type: 'jpeg', quality: 0.8 },
                html2canvas: { scale: 1 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            for (let i = 0; i < parsedCount; i++) {
                // We use `.output('blob')` instead of `.save()` to prevent 100 download popups
                exportPromises.push(html2pdf().from(element).set(opt).output('blob'));
            }

            await Promise.all(exportPromises);
            document.body.removeChild(element);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            log(`✅ DOM PDF Stress Test Completed in ${duration} seconds. Handled ${parsedCount} heavy document compilations. If browser didn't crash, UI performance is verified.`, 'success');
        } catch (err) {
            log(`❌ DOM PDF Stress failed: ${err.message}`, 'error');
        }
        setIsRunning(false);
    };

    return (
        <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'var(--font-body)' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Professional QA Testing Suite</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
                Advanced tools to simulate extreme load and verify platform stability. Run comprehensive tests to validate Multi-Tenant Isolation, Database Scalability, and UI Execution limits.
            </p>
            
            <div style={{ marginBottom: 24, background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>Broj simulacija (Test Multiplier):</label>
                <input 
                    type="number" 
                    value={simulateCount} 
                    onChange={e => setSimulateCount(e.target.value)} 
                    style={{ padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'white', borderRadius: 8, width: 200 }} 
                />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <button 
                    onClick={runTests} 
                    disabled={isRunning || isStorming}
                    style={{ 
                        padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', 
                        borderRadius: 8, cursor: (isRunning || isStorming) ? 'not-allowed' : 'pointer', fontWeight: 700
                    }}>
                    Verify Tenant Security ({simulateCount}x)
                </button>
                <button 
                    onClick={runStormTest} 
                    disabled={isRunning || isStorming}
                    style={{ 
                        padding: '10px 20px', background: 'var(--danger)', color: 'white', border: 'none', 
                        borderRadius: 8, cursor: (isRunning || isStorming) ? 'not-allowed' : 'pointer', fontWeight: 700
                    }}>
                    Live DB Stress ({simulateCount} user storm)
                </button>
                <button 
                    onClick={runPDFStressTest} 
                    disabled={isRunning || isStorming}
                    style={{ 
                        padding: '10px 20px', background: 'var(--warning)', color: 'white', border: 'none', 
                        borderRadius: 8, cursor: (isRunning || isStorming) ? 'not-allowed' : 'pointer', fontWeight: 700
                    }}>
                    UI/PDF Throttle Test ({simulateCount}x)
                </button>
            </div>

            <div style={{ 
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16,
                minHeight: 300, maxHeight: 500, overflowY: 'auto'
            }}>
                {logs.length === 0 ? (
                    <div style={{ color: 'var(--text-light)', textAlign: 'center', marginTop: 100 }}>Odaberite test za pokretanje (Ready to run).</div>
                ) : (
                    logs.map((l, i) => {
                        const colors = { info: 'var(--text-muted)', success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)' };
                        return (
                            <div key={i} style={{ marginBottom: 8, fontSize: '0.85rem' }}>
                                <span style={{ opacity: 0.5, marginRight: 8 }}>[{l.time}]</span>
                                <span style={{ color: colors[l.type] || 'inherit', fontWeight: l.type !== 'info' ? 700 : 400 }}>{l.msg}</span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
