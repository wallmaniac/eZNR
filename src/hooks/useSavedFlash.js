'use client';
import { useState, useCallback, useRef } from 'react';

/**
 * useSavedFlash — provides a "✓ Sačuvano" confirmation that appears near the save button.
 * 
 * Usage:
 *   const { showFlash, SavedFlash } = useSavedFlash();
 *   // In save handler: showFlash();
 *   // In JSX: <button onClick={handleSave}>Sačuvaj</button><SavedFlash />
 */
export function useSavedFlash(duration = 2200) {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef(null);

    const showFlash = useCallback(() => {
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(false), duration);
    }, [duration]);

    const SavedFlash = useCallback(({ label = '✓ Sačuvano' }) => {
        if (!visible) return null;
        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginLeft: 10,
                padding: '4px 12px',
                borderRadius: 8,
                background: 'rgba(76, 175, 80, 0.18)',
                color: '#4caf50',
                fontSize: '0.8rem',
                fontWeight: 600,
                animation: 'savedFlashIn 0.25s ease-out',
                whiteSpace: 'nowrap',
            }}>
                {label}
                <style>{`@keyframes savedFlashIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }`}</style>
            </span>
        );
    }, [visible]);

    return { showFlash, SavedFlash };
}
