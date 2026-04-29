'use client';

/**
 * TabBar — Unified scrollable tab bar for all pages/modals.
 * 
 * Props:
 *   tabs     — [{ key: string, icon?: string, label: string }]
 *   active   — current active tab key
 *   onChange  — (key) => void
 *   style    — optional additional styles on container
 */
export default function TabBar({ tabs, active, onChange, style }) {
    return (
        <div className="tab-bar" style={style}>
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    className={`tab-bar-item${active === tab.key ? ' active' : ''}`}
                    onClick={() => onChange(tab.key)}
                >
                    {tab.icon && <span>{tab.icon}</span>}
                    <span style={{ opacity: active === tab.key ? 1 : 0.85 }}>{tab.label}</span>
                </button>
            ))}
        </div>
    );
}
