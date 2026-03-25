'use client';
import { useState, useRef, useEffect } from 'react';

/**
 * HelpTip — hover ℹ️ icon that shows a tooltip with explanation text.
 * Usage: <HelpTip text="Explanation of this field" />
 */
export default function HelpTip({ text, icon = 'ℹ️', style = {} }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState('bottom');
    const tipRef = useRef(null);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (show && tipRef.current) {
            const rect = tipRef.current.getBoundingClientRect();
            if (rect.bottom > window.innerHeight - 20) setPos('top');
            else if (rect.top < 20) setPos('bottom');
        }
    }, [show]);

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
                marginLeft: 4,
                fontSize: '0.72rem',
                opacity: 0.7,
                transition: 'opacity 0.2s',
                ...style,
            }}
        >
            <span style={{ userSelect: 'none' }}>{icon}</span>
            {show && (
                <span
                    ref={tipRef}
                    style={{
                        position: 'absolute',
                        [pos === 'top' ? 'bottom' : 'top']: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: pos === 'bottom' ? 6 : 0,
                        marginBottom: pos === 'top' ? 6 : 0,
                        background: 'var(--bg-card, #1e293b)',
                        color: 'var(--text, #e5e7eb)',
                        border: '1px solid var(--border, #334155)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        fontSize: '0.74rem',
                        lineHeight: 1.45,
                        minWidth: 200,
                        maxWidth: 320,
                        whiteSpace: 'normal',
                        zIndex: 99999,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                        pointerEvents: 'none',
                        animation: 'fadeIn 0.15s ease',
                    }}
                >
                    {text}
                </span>
            )}
        </span>
    );
}
