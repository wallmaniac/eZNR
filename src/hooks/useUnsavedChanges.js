/**
 * useUnsavedChanges — drop this hook into any page/form component.
 *
 * Usage:
 *   const { markDirty, markClean } = useUnsavedChanges(handleSave);
 *
 *   // when the user starts editing:
 *   onChange={e => { setValue(e.target.value); markDirty(); }}
 *
 *   // when the form is successfully saved:
 *   markClean();
 *
 * The hook wires itself into the NavigationGuardContext so the user
 * is automatically prompted if they try to navigate away.
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigationGuard } from '@/contexts/NavigationGuardContext';

export function useUnsavedChanges(onSave) {
    const { markDirty, markClean, isDirty } = useNavigationGuard();
    
    // Keep a ref to the latest onSave so we never hand a stale closure to the guard
    const onSaveRef = useRef(onSave);
    useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

    // Always pass a wrapper that reads the ref — never closes over onSave directly
    const markDirtyWithSave = useCallback(() => {
        markDirty(onSaveRef.current ? (() => onSaveRef.current()) : null);
    }, [markDirty]);

    // Auto-clean on unmount
    useEffect(() => {
        return () => markClean();
    }, [markClean]);

    return { markDirty: markDirtyWithSave, markClean, isDirty };
}
