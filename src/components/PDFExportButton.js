'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * PDFExportButton — A dropdown button for generating PDF reports.
 *
 * Usage:
 *   <PDFExportButton
 *     options={[
 *       { label: 'Svi radnici', icon: '👷', onClick: () => generateWorkersReport([], lang) },
 *       { label: 'Odabrani (3)', icon: '✓', onClick: () => generateWorkersReport(selectedIds, lang) },
 *     ]}
 *   />
 *
 * Props:
 *   - options: Array<{ label: string, icon?: string, onClick: () => void }>
 *   - label?: Custom button label (default: "📄 PDF Izvještaj")
 *   - single?: If true, acts as a single button (no dropdown)
 */
export default function PDFExportButton({ options = [], label, single = false }) {
  const { lang } = useLanguage();
  const bs = lang === 'bs';
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const btnLabel = label || (bs ? '📄 PDF Izvještaj' : '📄 PDF Report');

  // Single mode — no dropdown, just call the first option
  if (single && options.length === 1) {
    return (
      <button
        className="print-export-btn"
        onClick={options[0].onClick}
        title={options[0].label}
      >
        {btnLabel}
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="print-export-btn"
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        {btnLabel} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▾</span>
      </button>

      {open && options.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 220,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
            zIndex: 200,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{
            padding: '6px 12px',
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-light)',
            marginBottom: 4,
          }}>
            {bs ? 'Generiši izvještaj' : 'Generate report'}
          </div>
          {options.map((opt, i) => (
            <button
              key={i}
              className="dropdown-item"
              onClick={() => { setOpen(false); opt.onClick(); }}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 6,
                color: 'var(--text)',
                fontFamily: 'var(--font-body)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {opt.icon && <span>{opt.icon}</span>}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
