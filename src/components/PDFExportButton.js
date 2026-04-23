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
export default function PDFExportButton({ options = [], label, single = false, buttonStyle = {} }) {
  const { lang } = useLanguage();
  const bs = lang === 'bs';
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 220, right: 0 });

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Check if click was inside the button
      if (ref.current && ref.current.contains(e.target)) return;
      // Also close if click was anything generic (bubble to top)
      setOpen(false);
    };
    
    // Slight delay to attach so we don't catch the initial click
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const handleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      let leftProp = rect.left + window.scrollX;
      // If expanding to the right would overflow the screen (220px width dropdown)
      if (leftProp + 220 > window.innerWidth) {
        leftProp = window.innerWidth - 230; // Push it back
      }
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: leftProp,
      });
    }
    setOpen(true);
  };

  const btnLabel = label || (bs ? '📄 PDF Izvještaj' : '📄 PDF Report');

  // Single mode — no dropdown, just call the first option
  if (single && options.length === 1) {
    return (
      <button
        className="print-export-btn"
        onClick={options[0].onClick}
        title={options[0].label}
        style={buttonStyle}
      >
        {btnLabel}
      </button>
    );
  }

  const dropdownMenu = open && options.length > 0 ? (
    <div
      style={{
        position: 'absolute',
        top: dropdownPos.top,
        left: dropdownPos.left,
        minWidth: 220,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: 4,
        zIndex: 9999,
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => e.stopPropagation()}
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
  ) : null;

  return (
    <>
      <div ref={ref} style={{ display: 'inline-block' }}>
        <button
          className="print-export-btn"
          onClick={handleOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 4, ...buttonStyle }}
        >
          {btnLabel} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▾</span>
        </button>
      </div>
      {typeof window !== 'undefined' && dropdownMenu ? require('react-dom').createPortal(dropdownMenu, document.body) : null}
    </>
  );
}
