'use client';
/**
 * TimeInput.js — Custom 24-hour time input for eZNR
 *
 * Replaces native <input type="time"> which renders inconsistently across
 * OS/browser combinations (especially on Safari/mobile).
 *
 * Features:
 *   - Manual text entry with auto-formatting (HH:MM)
 *   - Click-to-open dropdown with hour/minute grid
 *   - Consistent look across all platforms
 *   - Matches DateInput design language
 *
 * Props: value (HH:MM string), onChange, label, required, disabled,
 *        className, style, inputStyle, placeholder, id
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// ── Auto-format: insert colon after 2 digits ─────────────────────────────────
function autoFormat(prev, next) {
    if (next.length < prev.length) return next; // backspace
    const digits = next.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTime(str) {
    if (!str) return false;
    const m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return false;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

function normalizeTime(str) {
    if (!str) return '';
    const m = str.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return '';
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return '';
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ── Hours and minutes for grid ───────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function TimeInput({
    value = '',
    onChange,
    label,
    required,
    disabled,
    className = '',
    style,
    inputStyle,
    placeholder = 'HH:MM',
    id,
}) {
    const [text, setText] = useState(value || '');
    const [open, setOpen] = useState(false);
    const [pickerView, setPickerView] = useState('hours'); // 'hours' | 'minutes'
    const [selectedHour, setSelectedHour] = useState(null);
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0, bottom: 'auto' });
    const wrapperRef = useRef(null);

    // Sync text when external value changes
    useEffect(() => {
        setText(value || '');
        if (value) {
            const h = parseInt(value.split(':')[0], 10);
            if (!isNaN(h)) setSelectedHour(h);
        }
    }, [value]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (e.target.closest('.time-picker-popup')) return;
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
                setPickerView('hours');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Position portal and close on scroll
    useEffect(() => {
        if (!open) return;
        const updatePos = () => {
            if (!wrapperRef.current) return;
            const rect = wrapperRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const popupHeight = 280;
            if (spaceBelow < popupHeight && rect.top > popupHeight) {
                setPopupPos({ top: 'auto', bottom: window.innerHeight - rect.top + 4, left: rect.left });
            } else {
                setPopupPos({ top: rect.bottom + 4, bottom: 'auto', left: rect.left });
            }
        };
        updatePos();
        window.addEventListener('resize', updatePos);
        const handleScroll = (e) => {
            if (e.target.closest?.('.time-picker-popup')) return;
            setOpen(false);
            setPickerView('hours');
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('resize', updatePos);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [open]);

    // ── Text input handlers ──────────────────────────────────────────────────
    const handleTextChange = (e) => {
        const formatted = autoFormat(text, e.target.value);
        setText(formatted);
        const normalized = normalizeTime(formatted);
        if (normalized) onChange?.(normalized);
        else if (!formatted) onChange?.('');
    };

    const handleBlur = () => {
        const normalized = normalizeTime(text);
        if (normalized) {
            setText(normalized);
            onChange?.(normalized);
        } else if (!text) {
            onChange?.('');
        }
    };

    // ── Picker selection ─────────────────────────────────────────────────────
    const selectHour = (h) => {
        setSelectedHour(h);
        setPickerView('minutes');
    };

    const selectMinute = (m) => {
        const time = `${String(selectedHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        setText(time);
        onChange?.(time);
        setOpen(false);
        setPickerView('hours');
    };

    // ── Styles ───────────────────────────────────────────────────────────────
    const cellStyle = (isSelected) => ({
        padding: '6px 2px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.84rem',
        fontWeight: isSelected ? 700 : 400,
        background: isSelected ? 'var(--primary)' : 'none',
        color: isSelected ? '#fff' : 'var(--text)',
        fontFamily: 'var(--font-body)',
        transition: 'background 0.1s',
        textAlign: 'center',
    });

    // Parse current value for highlight
    const currentH = value ? parseInt(value.split(':')[0], 10) : null;
    const currentM = value ? parseInt(value.split(':')[1], 10) : null;

    const popupContent = open && !disabled && (
        <div className="time-picker-popup" style={{
            position: 'fixed', top: popupPos.top, bottom: popupPos.bottom, left: popupPos.left, zIndex: 99999,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            width: 260, userSelect: 'none', overflow: 'hidden',
        }}>
            {/* ── Header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '10px 12px', borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-input)', gap: 4,
            }}>
                <button
                    onClick={() => setPickerView('hours')}
                    style={{
                        background: pickerView === 'hours' ? 'var(--primary)' : 'none',
                        color: pickerView === 'hours' ? '#fff' : 'var(--text)',
                        border: 'none', cursor: 'pointer', borderRadius: 6,
                        padding: '4px 12px', fontWeight: 700, fontSize: '0.9rem',
                        fontFamily: 'var(--font-body)',
                    }}
                >
                    {selectedHour !== null ? String(selectedHour).padStart(2, '0') : 'HH'}
                </button>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-muted)' }}>:</span>
                <button
                    onClick={() => { if (selectedHour !== null) setPickerView('minutes'); }}
                    style={{
                        background: pickerView === 'minutes' ? 'var(--primary)' : 'none',
                        color: pickerView === 'minutes' ? '#fff' : 'var(--text)',
                        border: 'none', cursor: selectedHour !== null ? 'pointer' : 'default',
                        borderRadius: 6, padding: '4px 12px', fontWeight: 700, fontSize: '0.9rem',
                        fontFamily: 'var(--font-body)', opacity: selectedHour !== null ? 1 : 0.4,
                    }}
                >
                    {currentM !== null && selectedHour === currentH ? String(currentM).padStart(2, '0') : 'MM'}
                </button>
            </div>

            {/* ── HOURS VIEW: 6×4 grid (00-23) ── */}
            {pickerView === 'hours' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 2, padding: 8 }}>
                    {HOURS.map(h => (
                        <button
                            key={h}
                            onClick={() => selectHour(h)}
                            style={cellStyle(h === currentH)}
                            onMouseEnter={e => { if (h !== currentH) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                            onMouseLeave={e => { if (h !== currentH) e.currentTarget.style.background = 'none'; }}
                        >
                            {String(h).padStart(2, '0')}
                        </button>
                    ))}
                </div>
            )}

            {/* ── MINUTES VIEW: 4×3 grid (in 5-min steps) ── */}
            {pickerView === 'minutes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, padding: 8 }}>
                    {MINUTES.map(m => (
                        <button
                            key={m}
                            onClick={() => selectMinute(m)}
                            style={cellStyle(m === currentM && selectedHour === currentH)}
                            onMouseEnter={e => { if (!(m === currentM && selectedHour === currentH)) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                            onMouseLeave={e => { if (!(m === currentM && selectedHour === currentH)) e.currentTarget.style.background = 'none'; }}
                        >
                            :{String(m).padStart(2, '0')}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Clear button ── */}
            {value && (
                <div style={{ borderTop: '1px solid var(--border-light)', padding: '6px 0', textAlign: 'center' }}>
                    <button
                        onClick={() => { onChange?.(''); setText(''); setOpen(false); setPickerView('hours'); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                    >
                        ✕ Obriši vrijeme
                    </button>
                </div>
            )}
        </div>
    );

    const popup = popupContent && typeof document !== 'undefined' ? createPortal(popupContent, document.body) : null;

    const inputEl = (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                    id={id}
                    className="form-input"
                    type="text"
                    value={text}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    maxLength={5}
                    disabled={disabled}
                    style={{
                        paddingRight: 34,
                        ...(required && !value ? { borderColor: '#FF9800' } : {}),
                        ...(inputStyle || {}),
                    }}
                />
                {!disabled && (
                    <button
                        type="button"
                        onClick={() => { setOpen(o => !o); if (!open) setPickerView('hours'); }}
                        style={{
                            position: 'absolute', right: 8,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: open ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '0.95rem', lineHeight: 1, padding: 2,
                            display: 'flex', alignItems: 'center',
                        }}
                        title="Odaberi vrijeme"
                        tabIndex={-1}
                    >🕐</button>
                )}
            </div>
            {popup}
        </div>
    );

    if (!label) return inputEl;

    return (
        <div className={`form-group ${className}`} style={style}>
            <label
                htmlFor={id}
                className="form-label"
                style={{ display: 'flex', alignItems: 'center', gap: 6, ...(required ? { fontWeight: 700 } : {}) }}
            >
                {label}
                {required && <span style={{ color: 'var(--danger)' }}>*</span>}
            </label>
            {inputEl}
        </div>
    );
}
