'use client';
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'eznr_widget_collapsed';

/**
 * CollapsibleWidget — wraps a dashboard section with collapse/expand on mobile.
 * Persists collapsed state to localStorage.
 * 
 * @param {string} id — unique widget identifier
 * @param {string} title — section title shown in header
 * @param {string} icon — emoji icon
 * @param {boolean} isMobile — only show collapse controls on mobile
 * @param {boolean} defaultCollapsed — default state
 * @param {ReactNode} children
 */
export default function CollapsibleWidget({
    id,
    title,
    icon = '📊',
    isMobile = false,
    defaultCollapsed = false,
    alwaysCollapsible = false,
    children,
}) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    // Load persisted state
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (saved[id] !== undefined) setCollapsed(saved[id]);
        } catch { /* ignore */ }
    }, [id]);

    const toggle = useCallback(() => {
        setCollapsed(prev => {
            const next = !prev;
            try {
                const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
                saved[id] = next;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
            } catch { /* ignore */ }
            return next;
        });
    }, [id]);

    // Desktop: render children directly without wrapper unless explicitly requested
    if (!isMobile && !alwaysCollapsible) return children;

    return (
        <div style={{ marginBottom: collapsed ? 8 : 0 }}>
            {/* Collapse/expand header bar */}
            <button
                onClick={toggle}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid var(--border-light)',
                    borderRadius: collapsed ? 12 : '12px 12px 0 0',
                    background: collapsed
                        ? 'rgba(0,191,166,0.06)'
                        : 'rgba(0,191,166,0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: collapsed ? 0 : -1,
                }}
            >
                <span style={{ fontSize: '1rem' }}>{icon}</span>
                <span style={{
                    flex: 1, textAlign: 'left',
                    fontSize: '0.82rem', fontWeight: 700,
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--text)',
                }}>{title}</span>
                <span style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                    transition: 'transform 0.2s',
                }}>▼</span>
            </button>

            {/* Content: animated collapse */}
            <div style={{
                maxHeight: collapsed ? 0 : 5000,
                overflow: 'hidden',
                opacity: collapsed ? 0 : 1,
                transition: collapsed
                    ? 'max-height 0.3s ease, opacity 0.2s ease'
                    : 'max-height 0.5s ease, opacity 0.3s ease 0.1s',
            }}>
                {children}
            </div>
        </div>
    );
}
