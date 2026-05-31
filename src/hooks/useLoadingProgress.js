'use client';
import { useState, useEffect, useCallback } from 'react';
import { getLoadingProgress, onDataChange } from '@/lib/dataStore';

/**
 * Hook that tracks data loading progress across three tiers.
 * Returns { criticalDone, priorityDone, deferredDone, fullyLoaded, percent }
 * Re-renders whenever data syncs (via onDataChange listener).
 */
export function useLoadingProgress() {
    const [progress, setProgress] = useState(() => getLoadingProgress());

    const refresh = useCallback(() => {
        setProgress(getLoadingProgress());
    }, []);

    useEffect(() => {
        // Listen to data changes from dataStore
        const unsub = onDataChange(refresh);

        // Also listen for the custom event dispatched during loading
        const handler = () => refresh();
        window.addEventListener('eznr:data-synced', handler);

        // Initial check
        refresh();

        return () => {
            unsub();
            window.removeEventListener('eznr:data-synced', handler);
        };
    }, [refresh]);

    return progress;
}
