'use client';

/**
 * ActionBar — Unified save/cancel/action buttons row.
 * 
 * Props:
 *   children — button elements to render in the bar
 *   style    — optional additional styles
 */
export default function ActionBar({ children, style }) {
    return (
        <div className="action-bar" style={style}>
            {children}
        </div>
    );
}
