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
import { useEffect, useCallback } from 'react';
import { useNavigationGuard } from '@/contexts/NavigationGuardContext';

export function useUnsavedChanges(onSave) {
    const { markDirty, markClean, isDirty } = useNavigationGuard();

    // Allow passing an onSave so the guard can offer "Save & continue"
    const markDirtyWithSave = useCallback(() => {
        markDirty(onSave || null);
    }, [markDirty, onSave]);

    // Auto-clean on unmount
    useEffect(() => {
        return () => markClean();
    }, [markClean]);

    return { markDirty: markDirtyWithSave, markClean, isDirty };
}
