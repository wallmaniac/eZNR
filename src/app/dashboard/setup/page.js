'use client';

import { useState } from 'react';
import { seedFirestore } from '@/lib/firestoreService';
import { SEED_DATA } from '@/lib/dataStore';
import PageHeader from '@/components/PageHeader';

export default function SetupPage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleSeed = async () => {
        setLoading(true);
        setStatus('Seeding database... Please check console for details.');
        try {
            await seedFirestore(SEED_DATA);
            setStatus('✅ Database seeded successfully! You can now use Firestore.');
        } catch (err) {
            console.error(err);
            setStatus('❌ Error seeding database: ' + err.message);
        }
        setLoading(false);
    };

    return (
        <div style={{ padding: 40, maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
            <PageHeader icon="🔥" title={"Firestore Setup"} />
            <p>Click the button below to upload all your demo data from memory to the Google Cloud database.</p>
            <div style={{ marginTop: 30 }}>
                <button
                    onClick={handleSeed}
                    disabled={loading}
                    style={{
                        padding: '12px 24px',
                        fontSize: '1.2rem',
                        backgroundColor: loading ? '#ccc' : '#f59e0b',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? 'Seeding...' : 'Seed Database'}
                </button>
            </div>
            {status && (
                <div style={{ marginTop: 20, padding: 16, backgroundColor: '#f0fdf4', borderRadius: 8, color: 'var(--success)' }}>
                    {status}
                </div>
            )}
        </div>
    );
}
