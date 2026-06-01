'use client';
/**
 * DateInput.js — Universal European-format date input for eZNR
 *
 * Displays/accepts DD/MM/YYYY. Stores as ISO "YYYY-MM-DD".
 *
 * Custom calendar with 3 views (click header to drill up):
 *   DAY view   → standard month grid
 *   MONTH view → 12-month grid
 *   YEAR view  → 12-year decade grid with ‹ › to navigate decades
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/contexts/LanguageContext';

// ── Helpers ──────────────────────────────────────────────────────────────────
function isoToDisplay(iso) {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

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

function autoFormat(prev, next) {
    if (next.length < prev.length) return next;
    const digits = next.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekday(y, m) { return (new Date(y, m, 1).getDay() + 6) % 7; } // Mon=0

const LOCALIZED_DATA = {
    bs: {
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
        monthsFull: ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'],
        days: ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne']
    },
    hr: {
        months: ['Jan', 'Feb', 'Ožu', 'Tra', 'Svi', 'Lip', 'Srp', 'Kol', 'Ruj', 'Lis', 'Stu', 'Pro'],
        monthsFull: ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'],
        days: ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne']
    },
    sr: {
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
        monthsFull: ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'],
        days: ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne']
    },
    en: {
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        monthsFull: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        days: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    },
    de: {
        months: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
        monthsFull: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
        days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    },
    sl: {
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'],
        monthsFull: ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'],
        days: ['Po', 'To', 'Sr', 'Če', 'Pe', 'So', 'Ne']
    }
};

// Year-decade: show 12 years starting at decadeStart (e.g. 2020)
function decadeStart(year) { return Math.floor(year / 12) * 12; }

// ── Shared button styles ──────────────────────────────────────────────────────
const navBtn = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: '1.1rem',
    padding: '2px 8px', borderRadius: 4, lineHeight: 1,
    fontFamily: 'inherit',
};

/**
 * DateInput — drop-in replacement for <input type="date" />
 *
 * Props: value, onChange, label, required, disabled,
 *        className, style, inputStyle, placeholder, id, tooltip
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
    const { t, lang } = useLanguage();
    const locale = LOCALIZED_DATA[lang] || LOCALIZED_DATA.bs;
    const MONTHS = locale.months;
    const MONTHS_FULL = locale.monthsFull;
    const DAYS = locale.days;

    const [text, setText] = useState(() => isoToDisplay(value));
    const [prev, setPrev] = useState(() => isoToDisplay(value));
    const [open, setOpen] = useState(false);
    const [view, setView] = useState('days'); // 'days' | 'months' | 'years'
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0, bottom: 'auto' });

    const today = new Date();
    const parseYear  = () => value ? parseInt(value.slice(0, 4)) : today.getFullYear();
    const parseMonth = () => value ? parseInt(value.slice(5, 7)) - 1 : today.getMonth();

    const [calYear,  setCalYear]  = useState(parseYear);
    const [calMonth, setCalMonth] = useState(parseMonth);
    const [decStart, setDecStart] = useState(() => decadeStart(parseYear()));

    const wrapperRef = useRef(null);

    // Sync text + calendar when external value changes
    useEffect(() => {
        const disp = isoToDisplay(value);
        setText(disp);
        setPrev(disp);
        if (value) {
            const y = parseInt(value.slice(0, 4));
            const mo = parseInt(value.slice(5, 7)) - 1;
            setCalYear(y);
            setCalMonth(mo);
            setDecStart(decadeStart(y));
        }
    }, [value]); // eslint-disable-line

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const h = (e) => { 
            if (e.target.closest('.date-picker-popup')) return;
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); 
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [open]);

    // Position portal and close on scroll
    useEffect(() => {
        if (!open) return;
        const updatePos = () => {
            if (!wrapperRef.current) return;
            const rect = wrapperRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const popupHeight = 310;
            if (spaceBelow < popupHeight && rect.top > popupHeight) {
                setPopupPos({ top: 'auto', bottom: window.innerHeight - rect.top + 4, left: rect.left });
            } else {
                setPopupPos({ top: rect.bottom + 4, bottom: 'auto', left: rect.left });
            }
        };
        updatePos();
        window.addEventListener('resize', updatePos);
        const handleScroll = (e) => {
            if (e.target.closest('.date-picker-popup')) return;
            setOpen(false);
        };
        // useCapture true to catch scroll on any container
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('resize', updatePos);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [open]);

    // ── Text input handlers ───────────────────────────────────────────────────
    const handleTextChange = (e) => {
        const formatted = autoFormat(prev, e.target.value);
        setPrev(formatted);
        setText(formatted);
        const iso = displayToISO(formatted);
        if (iso) onChange?.(iso);
        else if (!formatted) onChange?.('');
    };

    const handleBlur = () => {
        const iso = displayToISO(text);
        if (iso) { const c = isoToDisplay(iso); setText(c); setPrev(c); }
        else if (!text) onChange?.('');
    };

    // ── Calendar selection ────────────────────────────────────────────────────
    const selectDay = (day) => {
        const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange?.(iso);
        setText(isoToDisplay(iso));
        setPrev(isoToDisplay(iso));
        setOpen(false);
        setView('days');
    };

    const selectMonth = (m) => { setCalMonth(m); setView('days'); };

    const selectYear = (y) => { setCalYear(y); setDecStart(decadeStart(y)); setView('months'); };

    // ── Navigation ────────────────────────────────────────────────────────────
    const prevNav = () => {
        if (view === 'days') {
            if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
            else setCalMonth(m => m - 1);
        } else if (view === 'months') {
            setCalYear(y => y - 1);
        } else {
            setDecStart(d => d - 12);
        }
    };
    const nextNav = () => {
        if (view === 'days') {
            if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
            else setCalMonth(m => m + 1);
        } else if (view === 'months') {
            setCalYear(y => y + 1);
        } else {
            setDecStart(d => d + 12);
        }
    };

    // ── Header label clicks ───────────────────────────────────────────────────
    const headerClick = () => {
        if (view === 'days') setView('months');
        else if (view === 'months') { setDecStart(decadeStart(calYear)); setView('years'); }
        // 'years' → nowhere to go up further
    };

    // ── Grid data ─────────────────────────────────────────────────────────────
    const selectedDay   = value && `${calYear}-${String(calMonth+1).padStart(2,'0')}` === value.slice(0,7)
        ? parseInt(value.slice(8, 10)) : null;
    const selectedMonth = value ? parseInt(value.slice(5, 7)) - 1 : null;
    const selectedYear  = value ? parseInt(value.slice(0, 4)) : null;
    const todayDay   = today.getFullYear() === calYear && today.getMonth() === calMonth ? today.getDate() : null;
    const totalDays  = daysInMonth(calYear, calMonth);
    const startOff   = firstWeekday(calYear, calMonth);
    const dayCells   = Array.from({ length: startOff + totalDays }, (_, i) => i < startOff ? null : i - startOff + 1);
    const yearGrid   = Array.from({ length: 12 }, (_, i) => decStart + i);

    // ── Cell style helper ─────────────────────────────────────────────────────
    const cellBase = (isSelected, isToday, isOther) => ({
        padding: '7px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
        fontSize: isOther ? '0.82rem' : '0.84rem', fontWeight: isSelected ? 700 : isToday ? 600 : 400,
        background: isSelected ? 'var(--primary)' : isToday ? 'rgba(0,191,166,0.15)' : 'none',
        color: isSelected ? '#fff' : isToday ? 'var(--primary)' : isOther ? 'var(--text-muted)' : 'var(--text)',
        fontFamily: 'var(--font-body)',
        transition: 'background 0.1s',
        textAlign: 'center',
    });

    // ── Header text ───────────────────────────────────────────────────────────
    const headerText = view === 'days'
        ? `${MONTHS_FULL[calMonth]} ${calYear}`
        : view === 'months'
        ? `${calYear}`
        : `${decStart} – ${decStart + 11}`;

    const popupContent = open && !disabled && (
        <div className="date-picker-popup" style={{
            position: 'fixed', top: popupPos.top, bottom: popupPos.bottom, left: popupPos.left, zIndex: 99999,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            width: 280, userSelect: 'none', overflow: 'hidden',
        }}>
            {/* ── Navigation header ── */}
            <div style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 12px', borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-input)',
            }}>
                <button style={navBtn} onClick={prevNav} title={t('previous')}>‹</button>
                <button
                    onClick={headerClick}
                    style={{
                        flex: 1, background: 'none', border: 'none', cursor: view === 'years' ? 'default' : 'pointer',
                        fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)',
                        fontFamily: 'var(--font-body)', padding: '2px 4px', borderRadius: 4,
                        textAlign: 'center',
                    }}
                    title={view === 'years' ? '' : t('changeView')}
                >
                    {headerText} {view !== 'years' && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>▾</span>}
                </button>
                <button style={navBtn} onClick={nextNav} title={t('next')}>›</button>
            </div>

            {/* ── YEAR VIEW: decade grid ── */}
            {view === 'years' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 10 }}>
                    {yearGrid.map(y => {
                        const isSel = y === selectedYear;
                        const isNow = y === today.getFullYear();
                        return (
                            <button
                                key={y}
                                onClick={() => selectYear(y)}
                                style={cellBase(isSel, isNow, false)}
                                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isNow ? 'rgba(0,191,166,0.15)' : 'none'; }}
                            >
                                {y}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── MONTH VIEW: 12-month grid ── */}
            {view === 'months' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, padding: 10 }}>
                    {MONTHS.map((m, i) => {
                        const isSel = i === selectedMonth && calYear === selectedYear;
                        const isNow = i === today.getMonth() && calYear === today.getFullYear();
                        return (
                            <button
                                key={m}
                                onClick={() => selectMonth(i)}
                                style={cellBase(isSel, isNow, false)}
                                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isNow ? 'rgba(0,191,166,0.15)' : 'none'; }}
                            >
                                {m}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── DAY VIEW: calendar grid ── */}
            {view === 'days' && (
                <div style={{ padding: '8px 10px' }}>
                    {/* Weekday headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                        {DAYS.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>{d}</div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                        {dayCells.map((day, idx) => {
                            if (!day) return <div key={`e${idx}`} />;
                            const isSel = day === selectedDay;
                            const isNow = day === todayDay;
                            return (
                                <button
                                    key={day}
                                    onClick={() => selectDay(day)}
                                    style={cellBase(isSel, isNow, false)}
                                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-table-row-hover)'; }}
                                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isNow ? 'rgba(0,191,166,0.15)' : 'none'; }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    {/* Clear button */}
                    {value && (
                        <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 8, paddingTop: 6, textAlign: 'center' }}>
                            <button
                                onClick={() => { onChange?.(''); setText(''); setPrev(''); setOpen(false); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                            >
                                ✕ {t('clearDate')}
                            </button>
                        </div>
                    )}
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
                            fontSize: '0.95rem', lineHeight: 1, padding: 2,
                            display: 'flex', alignItems: 'center',
                        }}
                        title={t('selectDate')}
                        tabIndex={-1}
                    >📅</button>
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
                {tooltip && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 4 }}>({tooltip})</span>}
            </label>
            {inputEl}
        </div>
    );
}
