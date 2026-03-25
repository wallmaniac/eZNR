'use client';
import { useState, useRef, useEffect } from 'react';

/**
 * HelpTip — hover ℹ️ icon that shows a tooltip with explanation text.
 * Usage: <HelpTip text="Explanation of this field" />
 */
export default function HelpTip({ text, icon = 'ℹ️', style = {} }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ vertical: 'bottom', horizontal: 'center' });
    const tipRef = useRef(null);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (show && tipRef.current && wrapRef.current) {
            const tipRect = tipRef.current.getBoundingClientRect();
            const wrapRect = wrapRef.current.getBoundingClientRect();
            let v = 'bottom', h = 'center';

            // Vertical: flip if no room below
            if (tipRect.bottom > window.innerHeight - 12) v = 'top';
            else if (wrapRect.top - tipRect.height < 12) v = 'bottom';

            // Horizontal: shift if overflowing left/right
            if (tipRect.left < 12) h = 'left';
            else if (tipRect.right > window.innerWidth - 12) h = 'right';

            setPos({ vertical: v, horizontal: h });
        }
    }, [show]);

    const getHorizontalStyle = () => {
        if (pos.horizontal === 'left') return { left: 0, transform: 'none' };
        if (pos.horizontal === 'right') return { right: 0, transform: 'none' };
        return { left: '50%', transform: 'translateX(-50%)' };
    };

    return (
        <span
            ref={wrapRef}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onClick={(e) => { e.stopPropagation(); setShow(s => !s); }}
            style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'help',
                marginLeft: 5,
                fontSize: '0.7rem',
                opacity: 0.65,
                transition: 'opacity 0.2s',
                ...style,
            }}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '0.65'; }}
        >
            <span style={{ userSelect: 'none' }}>{icon}</span>
            {show && (
                <span
                    ref={tipRef}
                    style={{
                        position: 'absolute',
                        [pos.vertical === 'top' ? 'bottom' : 'top']: 'calc(100% + 8px)',
                        ...getHorizontalStyle(),
                        /* ── Solid opaque background ── */
                        background: '#1a1f2e',
                        color: '#e2e8f0',
                        border: '1px solid #3b4560',
                        borderRadius: 10,
                        padding: '10px 14px',
                        fontSize: '0.76rem',
                        fontWeight: 400,
                        lineHeight: 1.55,
                        letterSpacing: '0.01em',
                        textTransform: 'none',
                        minWidth: 220,
                        maxWidth: 340,
                        whiteSpace: 'normal',
                        zIndex: 999999,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)',
                        pointerEvents: 'none',
                        animation: 'helpTipFadeIn 0.12s ease-out',
                    }}
                >
                    {text}
                </span>
            )}
            <style>{`@keyframes helpTipFadeIn { from { opacity: 0; transform: translateY(${pos.vertical === 'top' ? '4px' : '-4px'}); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </span>
    );
}
