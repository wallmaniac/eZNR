'use client';
import { useEffect, useRef, useCallback } from 'react';

/**
 * GlobalSwipeNav — adds swipe-left / swipe-right gestures on .data-table-wrapper
 * elements to navigate between table pages (pagination).
 * 
 * Swipe left → next page (clicks ▶ button)
 * Swipe right → previous page (clicks ◀ button)
 * 
 * Uses event delegation so it works on every table page automatically.
 */
export default function GlobalSwipeNav() {
    const touchRef = useRef({ startX: 0, startY: 0, active: false, target: null });

    const handleTouchStart = useCallback((e) => {
        if (window.innerWidth > 768) return;
        // Don't swipe if touching inside a modal or a horizontally scrollable element that is actually scrolling
        if (e.target.closest('.modal')) return;

        touchRef.current = {
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY,
            active: true,
            target: e.target,
        };
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (!touchRef.current.active) return;
        const { startX, startY, target } = touchRef.current;
        touchRef.current.active = false;

        if (!e.changedTouches || !e.changedTouches[0]) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const dx = endX - startX;
        const dy = endY - startY;

        // Trigger on swipes > 35px horizontal, allowing up to 1.5x vertical drift
        if (Math.abs(dx) < 35 || Math.abs(dy) > Math.abs(dx) * 1.5) return;

        // Find pagination buttons globally (usually just one table per mobile view)
        const paginationBtns = document.querySelectorAll('.pagination-btn');
        if (!paginationBtns.length) return;

        if (dx < 0) {
            // Swipe LEFT → next page
            // Find the ▶ button (not disabled)
            for (const btn of paginationBtns) {
                if (btn.textContent.includes('▶') && !btn.textContent.includes('⏭') && !btn.disabled) {
                    btn.click();
                    // Visual feedback
                    showSwipeFeedback(target, 'left');
                    break;
                }
            }
        } else {
            // Swipe RIGHT → previous page
            for (const btn of paginationBtns) {
                if (btn.textContent.includes('◀') && !btn.textContent.includes('⏮') && !btn.disabled) {
                    btn.click();
                    showSwipeFeedback(target, 'right');
                    break;
                }
            }
        }
    }, []);

    useEffect(() => {
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchEnd]);

    return null;
}

/** Flash a subtle directional arrow overlay on swipe */
function showSwipeFeedback(element, direction) {
    const arrow = document.createElement('div');
    arrow.textContent = direction === 'left' ? '→' : '←';
    Object.assign(arrow.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '3rem',
        fontWeight: '900',
        color: 'var(--primary)',
        opacity: '0.7',
        zIndex: '9999',
        pointerEvents: 'none',
        transition: 'opacity 0.4s ease-out',
        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
    });
    document.body.appendChild(arrow);
    // Haptic
    if (navigator.vibrate) navigator.vibrate(15);
    setTimeout(() => { arrow.style.opacity = '0'; }, 100);
    setTimeout(() => { arrow.remove(); }, 500);
}
