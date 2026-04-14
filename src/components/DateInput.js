'use client';
/**
 * DateInput.js — Universal European-format date input for eZNR
 *
 * Always displays and accepts dates as DD/MM/YYYY (or DD.MM.YYYY).
 * Stores values as ISO "YYYY-MM-DD" strings via the `onChange` callback.
 * Includes a calendar icon that opens a hidden native date picker.
 *
 * Browser locale is completely bypassed — no more MM/DD/YYYY on US-locale Windows.
 */
import { useState, useEffect, useRef } from 'react';

// "YYYY-MM-DD" → "DD/MM/YYYY"
function isoToDisplay(iso) {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// "DD/MM/YYYY" | "DD.MM.YYYY" → "YYYY-MM-DD" (or "" if incomplete/invalid)
function displayToISO(text) {
    if (!text) return '';
    const m = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (!m) return '';
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    // Basic validity check
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (isNaN(d)) return '';
    return `${yyyy}-${mm}-${dd}`;
}

// Auto-formats typed digits into DD/MM/YYYY as user types
function autoFormat(prev, next) {
    if (next.length < prev.length) return next; // allow backspace freely
    const digits = next.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * DateInput — drop-in replacement for <input type="date" />
 *
 * Props:
 *   value     — ISO string "YYYY-MM-DD" (or empty)
 *   onChange  — called with ISO string "YYYY-MM-DD" when valid date entered
 *   label     — optional label text (renders full form-group if provided)
 *   required  — shows orange border if empty
 *   disabled  — disables input
 *   className — extra CSS classes for the outer wrapper div (only if label provided)
 *   style     — style for the outer wrapper (only if label provided)
 *   inputStyle— style for the text input element itself
 *   placeholder — defaults to "DD/MM/YYYY"
 *   id        — passed to the input
 */
export default function DateInput({
    value = '',
    onChange,
    label,
    required,
    disabled,
    className = '',
    style,
    inputStyle,
    placeholder = 'DD/MM/YYYY',
    id,
    tooltip,
}) {
    const [text, setText] = useState(() => isoToDisplay(value));
    const [prev, setPrev] = useState(() => isoToDisplay(value));
    const nativeRef = useRef(null);
    const pickerOpenRef = useRef(false);

    // Sync display when external value changes (e.g. form reset or edit-load)
    useEffect(() => {
        const disp = isoToDisplay(value);
        setText(disp);
        setPrev(disp);
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleTextChange = (e) => {
        const raw = e.target.value;
        const formatted = autoFormat(prev, raw);
        setPrev(formatted);
        setText(formatted);
        const iso = displayToISO(formatted);
        if (iso) onChange?.(iso);
        else if (!formatted) onChange?.('');
    };

    const handleBlur = () => {
        const iso = displayToISO(text);
        if (iso) {
            const clean = isoToDisplay(iso);
            setText(clean);
            setPrev(clean);
        } else if (!text) {
            onChange?.('');
        }
    };

    const togglePicker = () => {
        if (pickerOpenRef.current) {
            // Close picker by blurring
            nativeRef.current?.blur?.();
            pickerOpenRef.current = false;
            return;
        }
        pickerOpenRef.current = true;
        try { nativeRef.current?.showPicker?.(); }
        catch { nativeRef.current?.click?.(); }
    };

    const handlePickerChange = (e) => {
        const iso = e.target.value;
        onChange?.(iso);
        const d = isoToDisplay(iso);
        setText(d);
        setPrev(d);
        pickerOpenRef.current = false;
    };

    const handlePickerBlur = () => {
        pickerOpenRef.current = false;
    };

    const inputEl = (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
                id={id}
                className="form-input"
                type="text"
                value={text}
                onChange={handleTextChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                maxLength={10}
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
                    onClick={togglePicker}
                    style={{
                        position: 'absolute', right: 8,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1,
                        padding: 2, display: 'flex', alignItems: 'center',
                    }}
                    title="Odaberi datum iz kalendara"
                    tabIndex={-1}
                >📅</button>
            )}
            {/* Hidden native date picker — only used by the calendar button */}
            <input
                ref={nativeRef}
                type="date"
                value={value || ''}
                onChange={handlePickerChange}
                onBlur={handlePickerBlur}
                disabled={disabled}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                tabIndex={-1}
                aria-hidden="true"
            />
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
                {tooltip && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 4 }}>({tooltip})</span>
                )}
            </label>
            {inputEl}
        </div>
    );
}
