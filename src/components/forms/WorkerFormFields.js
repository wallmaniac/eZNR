'use client';
import { useState } from 'react';
import DateInput from '@/components/DateInput';
import { useLanguage } from '@/contexts/LanguageContext';

// Converts "YYYY-MM-DD" → "DD/MM/YYYY"
export function isoToDisplay(iso) {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// Converts "DD/MM/YYYY" or "DD.MM.YYYY" → "YYYY-MM-DD"
export function displayToISO(text) {
    if (!text) return '';
    const m = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return '';
}

// Auto-inserts slashes as user types: "0" → "0", "06" → "06/", "06/0" → "06/0", "06/03" → "06/03/", etc.
export function DateField({ label, value, onChange, required, tooltip }) {
    return (
        <DateInput
            label={label}
            value={value || ''}
            onChange={onChange}
            required={required}
            tooltip={tooltip}
        />
    );
}

export function Field({ label, value, onChange, type = 'text', required, placeholder, tooltip, ...props }) {
    if (type === 'date') {
        return <DateField label={label} value={value} onChange={onChange} required={required} tooltip={tooltip} />;
    }
    return (
        <div className="form-group">
            <label className="form-label" style={{ ...(required ? { fontWeight: 700 } : {}), display: 'flex', alignItems: 'center', gap: 6 }}>
                {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                {tooltip && <InfoTip text={tooltip} />}
            </label>
            <input
                className="form-input"
                type={type}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={required ? (placeholder || 'Obavezno polje') : placeholder}
                style={required && !value ? { borderColor: '#FF9800' } : {}}
                {...props}
            />
        </div>
    );
}

export function SelectField({ label, value, onChange, options, placeholder, required, tooltip }) {
    return (
        <div className="form-group">
            <label className="form-label" style={{ ...(required ? { fontWeight: 700 } : {}), display: 'flex', alignItems: 'center', gap: 6 }}>
                {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
                {tooltip && <InfoTip text={tooltip} />}
            </label>
            <select className="form-select" value={value || ''} onChange={(e) => onChange(e.target.value)}
                style={required && !value ? { borderColor: '#FF9800' } : {}}>
                <option value="">{placeholder || '-- Odaberi --'}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

// -- InfoTip: instant hover tooltip icon -------------------------------------
export function InfoTip({ text }) {
    const [show, setShow] = useState(false);
    return (
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            <span
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                style={{ cursor: 'help', fontSize: '0.7rem', width: 15, height: 15, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}
            >i</span>
            {show && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: '0.78rem', color: 'var(--text-light)', zIndex: 9999, whiteSpace: 'normal', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', pointerEvents: 'none', minWidth: 200, maxWidth: 300, lineHeight: 1.5, fontWeight: 400 }}>
                    {text}
                </div>
            )}
        </span>
    );
}

// -- StazPicker: 3-dropdown prior experience picker --------------------------
export function StazPicker({ label, value, onChange }) {
    const { lang } = useLanguage();
    const parse = (v) => {
        if (!v) return { g: '', m: '', d: '' };
        const m1 = v.match(/(\d+)g(\d+)mj(\d+)d/i);
        if (m1) return { g: String(+m1[1]), m: String(+m1[2]), d: String(+m1[3]) };
        const m2 = v.match(/^(\d{2})(\d{2})(\d{2})$/);
        if (m2) return { g: String(+m2[1]), m: String(+m2[2]), d: String(+m2[3]) };
        return { g: '', m: '', d: '' };
    };
    const parts = parse(value);
    const update = (field, val) => {
        const next = { ...parts, [field]: val };
        const g = next.g || '0', m = next.m || '0', d = next.d || '0';
        const formatted = `${g}g${m}mj${d}d`;
        onChange(formatted === '0g0mj0d' ? '' : formatted);
    };
    const g_opts = Array.from({ length: 61 }, (_, i) => i);
    const m_opts = Array.from({ length: 12 }, (_, i) => i);
    const d_opts = Array.from({ length: 31 }, (_, i) => i);
    return (
        <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <InfoTip text={lang === 'bs' ? "Staž prije dolaska u firmu: Godina / Mjeseci / Dana" : "Prior experience: Years / Months / Days"} />
                {value && <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>{value.toUpperCase()}</span>}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, textAlign: 'center' }}>Godina</div>
                    <select className="form-select" style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.82rem' }} value={parts.g} onChange={e => update('g', e.target.value)}>
                        {g_opts.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, textAlign: 'center' }}>Mjeseci</div>
                    <select className="form-select" style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.82rem' }} value={parts.m} onChange={e => update('m', e.target.value)}>
                        {m_opts.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 2, textAlign: 'center' }}>Dana</div>
                    <select className="form-select" style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.82rem' }} value={parts.d} onChange={e => update('d', e.target.value)}>
                        {d_opts.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );
}

export function Accordion({ title, open, onToggle, children }) {
    return (
        <div className="card" style={{ marginBottom: 12 }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: open ? 'var(--bg-sidebar)' : 'linear-gradient(135deg, #455a64, #37474f)', color: 'white',
                    border: 'none', borderRadius: open ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
                    cursor: 'pointer', fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.95rem',
                    transition: 'all 0.2s',
                }}
            >
                {title}
                <span style={{ fontSize: '1.2rem', transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(0deg)' }}>
                    {open ? '−' : '+'}
                </span>
            </button>
            {open && (
                <div className="card-body" style={{ borderTop: '1px solid var(--border-light)' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

export function TimePicker({ label, value, onChange }) {
    const [h, m] = (value || ':').split(':');
    return (
        <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{label}</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <select className="form-select" style={{ padding: '8px 4px', minWidth: 60, textAlign: 'center' }} 
                        value={h || ''} 
                        onChange={e => onChange(`${e.target.value}:${m || '00'}`)}>
                    <option value="">--</option>
                    {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>)}
                </select>
                <span style={{ fontWeight: 700 }}>:</span>
                <select className="form-select" style={{ padding: '8px 4px', minWidth: 60, textAlign: 'center' }} 
                        value={m || ''} 
                        onChange={e => onChange(`${h || '08'}:${e.target.value}`)}>
                    <option value="">--</option>
                    {['00','15','30','45'].map(min => <option key={min} value={min}>{min}</option>)}
                </select>
            </div>
        </div>
    );
}
