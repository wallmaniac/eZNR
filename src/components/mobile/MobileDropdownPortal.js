'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * MobileDropdownPortal — renders dropdown content in a portal attached to document.body.
 * Positions itself below the anchor button using getBoundingClientRect().
 * Solves all clipping/overflow issues permanently.
 *
 * Props:
 *   anchorRef  — ref to the trigger button
 *   isOpen     — boolean
 *   onClose    — callback
 *   align      — 'left' | 'right' | 'center' (default 'right')
 *   fullWidth  — if true, spans ~95vw centered
 *   children   — dropdown content
 */
export default function MobileDropdownPortal({ anchorRef, isOpen, onClose, align = 'right', fullWidth = false, children }) {
    const dropRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, right: 'auto', width: 'auto' });

    // Calculate position from anchor
    const updatePosition = useCallback(() => {
        if (!anchorRef?.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const vw = window.innerWidth;

        if (fullWidth) {
            setPos({
                top: rect.bottom + 6,
                left: Math.round(vw * 0.025),
                right: 'auto',
                width: Math.round(vw * 0.95),
            });
        } else if (align === 'right') {
            // Right-align: dropdown's right edge aligns with button's right edge
            const dropWidth = 280;
            let left = rect.right - dropWidth;
            if (left < 8) left = 8;
            setPos({ top: rect.bottom + 6, left, right: 'auto', width: dropWidth });
        } else if (align === 'left') {
            let left = rect.left;
            if (left + 280 > vw - 8) left = vw - 288;
            setPos({ top: rect.bottom + 6, left, right: 'auto', width: 280 });
        } else {
            // center
            const dropWidth = 300;
            let left = rect.left + rect.width / 2 - dropWidth / 2;
            if (left < 8) left = 8;
            if (left + dropWidth > vw - 8) left = vw - dropWidth - 8;
            setPos({ top: rect.bottom + 6, left, right: 'auto', width: dropWidth });
        }
    }, [anchorRef, align, fullWidth]);

    useEffect(() => {
        if (!isOpen) return;
        updatePosition();
        // Recalculate on scroll/resize
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, updatePosition]);

    // Click outside to close
    useEffect(() => {
        if (!isOpen) return;
        const handleClick = (e) => {
            if (dropRef.current && !dropRef.current.contains(e.target) &&
                anchorRef?.current && !anchorRef.current.contains(e.target)) {
                onClose();
            }
        };
        // Use a slight delay so the opening click doesn't immediately close
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClick);
            document.addEventListener('touchstart', handleClick, { passive: true });
        }, 50);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('touchstart', handleClick);
        };
    }, [isOpen, onClose, anchorRef]);

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <>
            {/* Invisible backdrop for touch dismissal */}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={onClose}
                onTouchStart={onClose}
            />
            <div
                ref={dropRef}
                className="dropdown-menu"
                style={{
                    position: 'fixed',
                    top: pos.top,
                    left: pos.left,
                    width: pos.width,
                    zIndex: 9999,
                    maxHeight: '70vh',
                    overflowY: 'auto',
                    borderRadius: 16,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
                    animation: 'fadeIn 0.15s ease-out',
                }}
            >
                {children}
            </div>
        </>,
        document.body
    );
}
