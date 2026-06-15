'use client';
import { useAuth } from '@/contexts/AuthContext';
import { getById, COLLECTIONS, onDataChange } from '@/lib/dataStore';
import { useEffect, useState } from 'react';

// Define which modules require which tier by default
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
    const { activeCompanyId, isSuperAdmin, user } = useAuth();
    const [tier, setTier] = useState('BASIC');
    const [companyConfig, setCompanyConfig] = useState(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const updateCompanyConfig = () => {
            if (!activeCompanyId || activeCompanyId === 'all') {
                setTier('BASIC'); // safe fallback
                setCompanyConfig(null);
                return;
            }

            try {
                const company = getById(COLLECTIONS.COMPANIES, activeCompanyId);
                // Default to 'BASIC' if no tier is specifically set
                setTier(company?.subscriptionTier || 'BASIC');
                setCompanyConfig(company || null);
            } catch (e) {
                setTier('BASIC');
                setCompanyConfig(null);
            }
        };

        updateCompanyConfig();

        // Listen for changes in the data store (e.g. after background fetches)
        const unsubscribe = onDataChange(updateCompanyConfig);
        return () => unsubscribe();
    }, [activeCompanyId]);

    // Determine effective tier and flags
    // User settings take precedence if any user-level modular override exists.
    const userHasConfig = user && (
        user.subscriptionTier !== undefined || 
        user.fleetEnabled !== undefined || 
        user.riskAssessmentEnabled !== undefined || 
        user.questionnairesEnabled !== undefined || 
        user.testoviEnabled !== undefined || 
        user.fireProtectionEnabled !== undefined
    );

    const effectiveTier = (userHasConfig && user.subscriptionTier) ? user.subscriptionTier : tier;

    const isFleetEnabled = (userHasConfig && user.fleetEnabled !== undefined)
        ? user.fleetEnabled
        : (companyConfig ? companyConfig.fleetEnabled !== false : true);

    const isRiskAssessmentEnabled = (userHasConfig && user.riskAssessmentEnabled !== undefined)
        ? user.riskAssessmentEnabled
        : (companyConfig ? companyConfig.riskAssessmentEnabled !== false : true);

    const isQuestionnairesEnabled = (userHasConfig && user.questionnairesEnabled !== undefined)
        ? user.questionnairesEnabled
        : (companyConfig ? companyConfig.questionnairesEnabled !== false : true);

    const isTestoviEnabled = (userHasConfig && user.testoviEnabled !== undefined)
        ? user.testoviEnabled
        : (companyConfig ? companyConfig.testoviEnabled !== false : true);

    const isFireProtectionEnabled = (userHasConfig && user.fireProtectionEnabled !== undefined)
        ? user.fireProtectionEnabled
        : (companyConfig ? companyConfig.fireProtectionEnabled !== false : true);

    const hasAccess = (moduleKey) => {
        if (isSuperAdmin) return true; // Superadmin always has access

        // 1. Check FLEET_ONLY tier
        if (effectiveTier === 'FLEET_ONLY') {
            // Under FLEET_ONLY tier, the user has access ONLY to:
            // - dashboard, home (news), settings
            // - grpWorkers -> workers (ONLY basic workers list, others inside grpWorkers are blocked)
            // - grpFleet and its children
            // - alati and its children (excelImport, converter, digitalArchive)
            const allowedInFleetOnly = [
                'dashboard',
                'home',
                'settings',
                'grpWorkers',
                'workers',
                'grpFleet',
                'fleetVehicles',
                'fleetAssignments',
                'fleetDocuments',
                'fleetOrders',
                'alati',
                'excelImport',
                'converter',
                'digitalArchive'
            ];
            if (!allowedInFleetOnly.includes(moduleKey)) {
                return false;
            }
        }

        // 2. Check individual module flags
        if (['grpFleet', 'fleetVehicles', 'fleetAssignments', 'fleetDocuments', 'fleetOrders'].includes(moduleKey)) {
            if (!isFleetEnabled) return false;
        }
        
        if (moduleKey === 'riskAssessment') {
            if (!isRiskAssessmentEnabled) return false;
        }

        if (moduleKey === 'questionnaires') {
            if (!isQuestionnairesEnabled) return false;
        }

        if (['testoviZopZnr', 'scannedTests'].includes(moduleKey)) {
            if (!isTestoviEnabled) return false;
        }

        if (['grpFireProtection', 'grpEvacuation', 'evacuationPlans', 'evacuationDrills', 'fireExtinguishers'].includes(moduleKey)) {
            if (!isFireProtectionEnabled) return false;
        }

        // 3. Fallback to default tier rules
        if (ENTERPRISE_MODULES.includes(moduleKey)) {
            if (['grpFleet', 'fleetVehicles', 'fleetAssignments', 'fleetDocuments', 'fleetOrders'].includes(moduleKey)) {
                if (isFleetEnabled) return true;
            }
            if (['grpFireProtection', 'grpEvacuation', 'evacuationPlans', 'evacuationDrills', 'fireExtinguishers'].includes(moduleKey)) {
                if (isFireProtectionEnabled) return true;
            }
            return effectiveTier === 'ENTERPRISE';
        }

        // Risk Assessment, Questionnaires, Tests require ENTERPRISE by default, unless explicitly enabled
        if (['riskAssessment', 'questionnaires', 'testoviZopZnr', 'scannedTests'].includes(moduleKey)) {
            if (moduleKey === 'riskAssessment' && isRiskAssessmentEnabled) return true;
            if (moduleKey === 'questionnaires' && isQuestionnairesEnabled) return true;
            if (['testoviZopZnr', 'scannedTests'].includes(moduleKey) && isTestoviEnabled) return true;
            return effectiveTier === 'ENTERPRISE';
        }

        return true; // Everything else defaults to BASIC access
    };

    return { tier: effectiveTier, hasAccess };
}

