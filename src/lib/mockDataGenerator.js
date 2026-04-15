'use client';

import { genId, COMPANY_SCOPED } from './dataStore';

// ============================================================================
// MOCK DATA GENERATOR
// Injects exactly 1 dummy record into ALL company-scoped collections 
// locally, allowing developers/admins to verify that the Firebase Sync
// utility migrates 100% of the platform modules.
// ============================================================================

export function seedMockDataConfig(companyId) {
    if (!companyId) {
        throw new Error('Za generisanje podataka potrebna je aktivna kompanija.');
    }
    
    if (typeof window === 'undefined') return;

    let totalCreated = 0;

    for (const collection of COMPANY_SCOPED) {
        const key = 'eznr_' + collection;
        let existing = [];
        try {
            existing = JSON.parse(localStorage.getItem(key)) || [];
            if (!Array.isArray(existing)) existing = [];
        } catch(e) {
            existing = [];
        }
        
        // Create a generic record suitable for Firestore testing
        const mockItem = {
            id: genId(),
            companyId: companyId,
            naziv: `Test mock podatak - ${collection}`,
            createdAt: new Date().toISOString(),
            isDevMock: true,
            _collection: collection,
        };
        
        existing.push(mockItem);
        localStorage.setItem(key, JSON.stringify(existing));
        totalCreated++;
    }

    return totalCreated;
}
