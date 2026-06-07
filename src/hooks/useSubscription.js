'use client';
import { useAuth } from '@/contexts/AuthContext';
import { getById, COLLECTIONS } from '@/lib/dataStore';
import { useEffect, useState } from 'react';

// Define which modules require which tier
const ENTERPRISE_MODULES = [
    'fleetVehicles',
    'fireExtinguishers',
    'evacuationPlans',
    'evacuationDrills',
    'grpFleet',
    'grpFireProtection',
    'grpEvacuation'
];

export function useSubscription() {
    const { activeCompanyId, isSuperAdmin } = useAuth();
    const [tier, setTier] = useState('BASIC');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        if (!activeCompanyId || activeCompanyId === 'all') {
            setTier('BASIC'); // safe fallback
            return;
        }

        try {
            const company = getById(COLLECTIONS.COMPANIES, activeCompanyId);
            // Default to 'BASIC' if no tier is specifically set
            setTier(company?.subscriptionTier || 'BASIC');
        } catch (e) {
            setTier('BASIC');
        }
    }, [activeCompanyId]);

    const hasAccess = (moduleKey) => {
        if (isSuperAdmin) return true; // Superadmin always has access
        if (ENTERPRISE_MODULES.includes(moduleKey)) {
            return tier === 'ENTERPRISE';
        }
        return true; // Everything else defaults to BASIC access
    };

    return { tier, hasAccess };
}
