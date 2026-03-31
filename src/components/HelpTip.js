'use client';
import { useState, useRef, useEffect } from 'react';

/**
 * HelpTip — hover [i] icon that shows a tooltip with explanation text.
 * Usage: <HelpTip text="Explanation of this field" />
 */
export default function HelpTip({ text, style = {} }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState({ vertical: 'bottom', horizontal: 'center' });
    const tipRef = useRef(null);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (show && tipRef.current && wrapRef.current) {
            const tipRect = tipRef.current.getBoundingClientRect();
            const wrapRect = wrapRef.current.getBoundingClientRect();
            let v = 'bottom', h = 'center';

            if (tipRect.bottom > window.innerHeight - 12) v = 'top';
            else if (wrapRect.top - tipRect.height < 12) v = 'bottom';

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
                justifyContent: 'center',
                cursor: 'help',
                flexShrink: 0,
                ...style,
            }}
        >
            {/* Custom styled circle badge — consistent across all backgrounds */}
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 15,
                    height: 15,
                    borderRadius: '50%',
                    background: 'rgba(0,191,166,0.18)',
                    border: '1.5px solid rgba(0,191,166,0.6)',
                    color: 'var(--primary, #00bfa6)',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    lineHeight: 1,
                    userSelect: 'none',
                    transition: 'background 0.18s, border-color 0.18s',
                    flexShrink: 0,
                }}
                onMouseOver={e => {
                    e.currentTarget.style.background = 'rgba(0,191,166,0.32)';
                    e.currentTarget.style.borderColor = 'var(--primary, #00bfa6)';
                }}
                onMouseOut={e => {
                    e.currentTarget.style.background = 'rgba(0,191,166,0.18)';
                    e.currentTarget.style.borderColor = 'rgba(0,191,166,0.6)';
                }}
            >
                i
            </span>

            {/* Tooltip popup */}
            {show && (
                <span
                    ref={tipRef}
                    style={{
                        position: 'absolute',
                        [pos.vertical === 'top' ? 'bottom' : 'top']: 'calc(100% + 8px)',
                        ...getHorizontalStyle(),
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
