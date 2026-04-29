'use client';

/**
 * PageHeader — Unified page header component for all dashboard pages.
 * 
 * Props:
 *   icon     — emoji or React node (e.g. '📋' or <Icon3D ... />)
 *   title    — page title string
 *   subtitle — optional subtitle string or React node
 *   actions  — optional React node for right-side action buttons
 *   backBtn  — optional { label, onClick } for back navigation
 */
export default function PageHeader({ icon, title, subtitle, actions, backBtn }) {
    return (
        <div className="page-header">
            {backBtn && (
                <button className="btn btn-ghost" onClick={backBtn.onClick}>
                    ← {backBtn.label || ''}
                </button>
            )}
            {icon && <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{icon}</span>}
            <div className="page-header-content">
                <h1 className="page-title">{title}</h1>
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="page-actions">{actions}</div>}
        </div>
    );
}
