'use client';
import { useEffect, useRef, useCallback } from 'react';

/**
 * GlobalLongPress — adds a delegated long-press listener to the entire document.
 * When a user long-presses on any <tr> inside a .data-table, it automatically clicks
 * the first action button (Akcije ▼) in that row, opening the dropdown.
 * 
 * This makes every table row in the entire app long-press-actionable on mobile
 * without needing to modify each individual page.
 */
export default function GlobalLongPress() {
    const timerRef = useRef(null);
    const touchStartRef = useRef({ x: 0, y: 0 });
    const didFireRef = useRef(false);

    const handleTouchStart = useCallback((e) => {
        // Only on mobile-like viewports
        if (window.innerWidth > 768) return;

        const tr = e.target.closest('.data-table tbody tr');
        if (!tr) return;

        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
        };
        didFireRef.current = false;

        timerRef.current = setTimeout(() => {
            // Find the action button in this row
            const actionBtn = tr.querySelector('.btn-primary, [class*="btn"][class*="sm"]');
            if (actionBtn && actionBtn.textContent.includes('▼')) {
                // Vibrate for haptic feedback
                if (navigator.vibrate) navigator.vibrate(30);
                actionBtn.click();
                didFireRef.current = true;
            }
        }, 500);
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (!timerRef.current) return;
        const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
        const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
        if (dx > 10 || dy > 10) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        // If we fired the long-press, prevent the normal click
        if (didFireRef.current) {
            e.preventDefault();
            didFireRef.current = false;
        }
    }, []);

    useEffect(() => {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return null; // renders nothing — pure behavior
}
