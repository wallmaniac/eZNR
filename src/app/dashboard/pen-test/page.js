'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

export default function FirebasePenTest() {
    const [logs, setLogs] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isStorming, setIsStorming] = useState(false);

    const log = (msg, type = 'info') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    const runStormTest = async () => {
        setIsStorming(true);
        setLogs([]);
        log('Starting 100-User Background Storm Simulation...', 'warning');
        
        const activeCompanyId = localStorage.getItem('eznr_activeCompany');
        if (!activeCompanyId) {
            log('No active company. Please select a company.', 'error');
            setIsStorming(false);
            return;
        }

        log(`Spamming 'storm_events' for company: ${activeCompanyId} in background...`, 'info');
        
        try {
            const promises = [];
            for(let i = 0; i < 100; i++) {
                const stormDoc = doc(db, 'companies', activeCompanyId, 'storm_events', `event_${i}`);
                promises.push(setDoc(stormDoc, { timestamp: Date.now(), rand: Math.random() }));
            }
            await Promise.all(promises);
            log('✅ Storm injected successfully. If your dashboard did not freeze, the local state engine efficiently handled the burst!', 'success');
        } catch (err) {
            log(`❌ Storm failed: ${err.message}`, 'error');
        }
        setIsStorming(false);
    };

    const runTests = async () => {
        setIsRunning(true);
        setLogs([]);
        log('Starting Firebase Multi-Tenancy Penetration Test...', 'info');

        const activeCompanyId = localStorage.getItem('eznr_activeCompany');
        const userStr = localStorage.getItem('eznr_user');
        const user = userStr ? JSON.parse(userStr) : null;

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

        // TEST 2: Read Foreign Company
        try {
            log(`[TEST 2] Attempting to read FOREIGN company workers (/companies/${dummyTargetId}/workers)...`, 'info');
            const foreignRef = collection(db, 'companies', dummyTargetId, 'workers');
            await getDocs(foreignRef);
            log('❌ TEST 2 FAILED: SECURITY BREACH! Successfully read foreign company data.', 'error');
        } catch (err) {
            if (err.code === 'permission-denied') {
                log('✅ TEST 2 PASSED: Permission strictly denied for foreign read.', 'success');
            } else {
                log(`🤔 TEST 2 UNKNOWN: Failed, but not with permission-denied. Error: ${err.message}`, 'warning');
            }
        }

        // TEST 3: Write Foreign Company
        try {
            log(`[TEST 3] Attempting to write FOREIGN company document (/companies/${dummyTargetId}/workers/hack)...`, 'info');
            const foreignDoc = doc(db, 'companies', dummyTargetId, 'workers', 'hack');
            await setDoc(foreignDoc, { hacked: true });
            log('❌ TEST 3 FAILED: SECURITY BREACH! Successfully wrote to foreign company.', 'error');
        } catch (err) {
            if (err.code === 'permission-denied') {
                log('✅ TEST 3 PASSED: Permission strictly denied for foreign write.', 'success');
            } else {
                log(`🤔 TEST 3 UNKNOWN: Failed, but not with permission-denied. Error: ${err.message}`, 'warning');
            }
        }

        log('Penetration tests concluded.', 'info');
        setIsRunning(false);
    };

    return (
        <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', fontFamily: 'var(--font-body)' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16 }}>Firebase PenTest</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
                This tool attempts to read and write to Firestore directly, bypassing localStorage. 
                It verifies that <code>firestore.rules</code> actively blocks requests to foreign <code>companyId</code> partitions.
                <br /><br />
                <strong>Important:</strong> You must log in as a regular <code>officer</code>, NOT an <code>admin</code>, to test isolation properly, because admins have unrestricted access.
            </p>
            
            <button 
                onClick={runTests} 
                disabled={isRunning}
                style={{ 
                    padding: '10px 20px', 
                    background: 'var(--primary)', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 8, 
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    marginBottom: 24
                }}>
                {isRunning ? 'Running Tests...' : 'Execute Pen Test'}
            </button>
            <button 
                onClick={runStormTest} 
                disabled={isRunning || isStorming}
                style={{ 
                    padding: '10px 20px', 
                    background: 'var(--warning)', 
                    color: 'white', 
                    border: 'none', 
                    marginLeft: 12,
                    borderRadius: 8, 
                    cursor: (isRunning || isStorming) ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    marginBottom: 24
                }}>
                {isStorming ? 'Storming...' : 'Simulate 100-User Background Storm'}
            </button>

            <div style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border)', 
                borderRadius: 12, 
                padding: 16,
                minHeight: 300,
                maxHeight: 500,
                overflowY: 'auto'
            }}>
                {logs.length === 0 ? (
                    <div style={{ color: 'var(--text-light)', textAlign: 'center', marginTop: 100 }}>Ready to run.</div>
                ) : (
                    logs.map((l, i) => {
                        const colors = {
                            info: 'var(--text-muted)',
                            success: 'var(--success)',
                            error: 'var(--danger)',
                            warning: 'var(--warning)'
                        };
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
