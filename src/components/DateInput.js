'use client';
/**
 * DateInput.js — Universal European-format date input for eZNR
 *
 * Displays/accepts DD/MM/YYYY. Stores as ISO "YYYY-MM-DD".
 * Custom calendar popup with:
 *   - Direct year text-input (no more endless scrolling!)
 *   - Month grid for fast month selection
 *   - Day grid
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// "YYYY-MM-DD" → "DD/MM/YYYY"
function isoToDisplay(iso) {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// "DD/MM/YYYY" | "DD.MM.YYYY" → "YYYY-MM-DD" (or "" if incomplete)
function displayToISO(text) {
    if (!text) return '';
    const m = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (!m) return '';
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (isNaN(d.getTime())) return '';
    return `${yyyy}-${mm}-${dd}`;
}

// Auto-formats typed digits into DD/MM/YYYY
function autoFormat(prev, next) {
    if (next.length < prev.length) return next;
    const digits = next.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const MONTHS_BS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni',
    'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
const DAYS_BS = ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne'];

function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}
function firstWeekday(year, month) {
    // Monday-based: Mon=0 … Sun=6
    return (new Date(year, month, 1).getDay() + 6) % 7;
}

/**
 * DateInput — drop-in replacement for <input type="date" />
 *
 * Props: value, onChange, label, required, disabled, className, style,
 *        inputStyle, placeholder, id, tooltip
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
    const [open, setOpen] = useState(false);

    // Calendar nav state
    const today = new Date();
    const initYear  = value ? parseInt(value.slice(0, 4)) : today.getFullYear();
    const initMonth = value ? parseInt(value.slice(5, 7)) - 1 : today.getMonth();
    const [calYear,  setCalYear]  = useState(initYear);
    const [calMonth, setCalMonth] = useState(initMonth);
    const [yearInput, setYearInput] = useState(String(initYear));
    const [view, setView] = useState('days'); // 'days' | 'months'

    const wrapperRef = useRef(null);

    // Sync text when external value changes
    useEffect(() => {
        const disp = isoToDisplay(value);
        setText(disp);
        setPrev(disp);
        if (value) {
            const y = parseInt(value.slice(0, 4));
            const mo = parseInt(value.slice(5, 7)) - 1;
            setCalYear(y);
            setCalMonth(mo);
            setYearInput(String(y));
        }
    }, [value]); // eslint-disable-line

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

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

    const selectDay = (day) => {
        const mm = String(calMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const iso = `${calYear}-${mm}-${dd}`;
        onChange?.(iso);
        setText(isoToDisplay(iso));
        setPrev(isoToDisplay(iso));
        setOpen(false);
        setView('days');
    };

    const prevMonth = () => {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); setYearInput(String(calYear - 1)); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); setYearInput(String(calYear + 1)); }
        else setCalMonth(m => m + 1);
    };

    const handleYearInput = (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        setYearInput(val);
        const n = parseInt(val);
        if (val.length === 4 && n >= 1900 && n <= 2100) {
            setCalYear(n);
        }
    };

    const handleYearKey = (e) => {
        if (e.key === 'ArrowUp') { setCalYear(y => { const n = y + 1; setYearInput(String(n)); return n; }); e.preventDefault(); }
        if (e.key === 'ArrowDown') { setCalYear(y => { const n = y - 1; setYearInput(String(n)); return n; }); e.preventDefault(); }
    };

    // Build calendar grid
    const selectedDay   = value && value.slice(0, 7) === `${calYear}-${String(calMonth+1).padStart(2,'0')}`
        ? parseInt(value.slice(8, 10)) : null;
    const todayDay      = today.getFullYear() === calYear && today.getMonth() === calMonth ? today.getDate() : null;
    const totalDays     = daysInMonth(calYear, calMonth);
    const startOffset   = firstWeekday(calYear, calMonth);
    const gridCells     = Array.from({ length: startOffset + totalDays }, (_, i) =>
        i < startOffset ? null : i - startOffset + 1
    );

    const calPopup = open && !disabled && (
        <div
            style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 9999,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                width: 280, userSelect: 'none', overflow: 'hidden',
            }}
        >
            {/* ── Header: prev | month name | year input | next ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '10px 12px', borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
            }}>
                <button
                    onClick={prevMonth}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '2px 6px', borderRadius: 4 }}
                    title="Prethodni mjesec"
                >‹</button>

                <button
                    onClick={() => setView(v => v === 'months' ? 'days' : 'months')}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', flex: 1,
                        textAlign: 'center', padding: '2px 4px', borderRadius: 4,
                    }}
                    title="Odaberi mjesec"
                >
                    {MONTHS_BS[calMonth]}
                </button>

                {/* Year direct input */}
                <input
                    type="text"
                    value={yearInput}
                    onChange={handleYearInput}
                    onKeyDown={handleYearKey}
                    maxLength={4}
                    title="Unesite godinu (↑↓ za promjenu)"
                    style={{
                        width: 52, textAlign: 'center', fontWeight: 700, fontSize: '0.88rem',
                        border: '1px solid var(--border)', borderRadius: 4, padding: '2px 4px',
                        background: 'var(--bg-card)', color: 'var(--text)',
                        fontFamily: 'var(--font-body)',
                    }}
                />

                <button
                    onClick={nextMonth}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '2px 6px', borderRadius: 4 }}
                    title="Sljedeći mjesec"
                >›</button>
            </div>

            {/* ── Month picker view ── */}
            {view === 'months' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 10 }}>
                    {MONTHS_BS.map((m, i) => (
                        <button key={m} onClick={() => { setCalMonth(i); setView('days'); }}
                            style={{
                                padding: '7px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 600,
                                background: i === calMonth ? 'var(--primary)' : 'var(--bg-input)',
                                color: i === calMonth ? '#fff' : 'var(--text)',
                                fontFamily: 'var(--font-body)',
                            }}>
                            {m.slice(0, 3)}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Day grid view ── */}
            {view === 'days' && (
                <div style={{ padding: '8px 10px' }}>
                    {/* Weekday headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                        {DAYS_BS.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>{d}</div>
                        ))}
                    </div>
                    {/* Day cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                        {gridCells.map((day, idx) => {
                            if (!day) return <div key={`e-${idx}`} />;
                            const isSelected = day === selectedDay;
                            const isToday = day === todayDay;
                            return (
                                <button
                                    key={day}
                                    onClick={() => selectDay(day)}
                                    style={{
                                        padding: '5px 2px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                        fontSize: '0.82rem', fontWeight: isSelected || isToday ? 700 : 400,
                                        background: isSelected
                                            ? 'var(--primary)'
                                            : isToday
                                            ? 'rgba(0,191,166,0.15)'
                                            : 'none',
                                        color: isSelected ? '#fff' : isToday ? 'var(--primary)' : 'var(--text)',
                                        fontFamily: 'var(--font-body)',
                                        transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? 'rgba(0,191,166,0.15)' : 'none'; }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Quick-clear */}
                    {value && (
                        <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 8, paddingTop: 6, textAlign: 'center' }}>
                            <button
                                onClick={() => { onChange?.(''); setText(''); setPrev(''); setOpen(false); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                            >
                                ✕ Obriši datum
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const inputEl = (
        <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
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
                    onClick={() => { setView('days'); setOpen(o => !o); }}
                    style={{
                        position: 'absolute', right: 8,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: open ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: '0.95rem', lineHeight: 1,
                        padding: 2, display: 'flex', alignItems: 'center',
                    }}
                    title="Odaberi datum iz kalendara"
                    tabIndex={-1}
                >📅</button>
            )}
            {calPopup}
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
