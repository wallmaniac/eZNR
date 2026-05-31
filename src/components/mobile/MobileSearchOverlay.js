'use client';
import { useState, useRef, useMemo, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { getAll, COLLECTIONS, getOrgUnitName } from '@/lib/dataStore';

/**
 * MobileSearchOverlay — full-screen search triggered from the bottom nav.
 * Shows search results for workers, equipment, workplaces, org units.
 */
export default function MobileSearchOverlay({ isOpen, onClose }) {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const inputRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setTimeout(() => inputRef.current?.focus(), 200);
        }
    }, [isOpen]);

    // Escape to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    const searchResults = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const term = searchTerm.toLowerCase();
        const results = [];
        try {
            getAll(COLLECTIONS.WORKERS).forEach(w => {
                if (`${w.ime} ${w.prezime} ${w.jmbg || ''}`.toLowerCase().includes(term))
                    results.push({ type: 'worker', icon: '👷', label: `${w.ime} ${w.prezime}`, sub: getOrgUnitName(w.orgJedinicaId), id: w.id });
            });
            getAll(COLLECTIONS.EQUIPMENT).forEach(e => {
                if (`${e.naziv} ${e.tvBroj || ''} ${e.invBroj || ''}`.toLowerCase().includes(term))
                    results.push({ type: 'equipment', icon: '⚙️', label: e.naziv, sub: e.tvBroj || '', id: e.id });
            });
            getAll(COLLECTIONS.WORKPLACES).forEach(wp => {
                if (wp.naziv.toLowerCase().includes(term))
                    results.push({ type: 'workplace', icon: '🔧', label: wp.naziv, sub: wp.oznaka || '', id: wp.id });
            });
            getAll(COLLECTIONS.ORG_UNITS).forEach(ou => {
                if (ou.naziv.toLowerCase().includes(term))
                    results.push({ type: 'orgUnit', icon: '🏢', label: ou.naziv, sub: ou.skraceniNaziv || '', id: ou.id });
            });
            getAll(COLLECTIONS.VEHICLES || 'vehicles').forEach(v => {
                if (`${v.registracija || ''} ${v.marka || ''} ${v.model || ''}`.toLowerCase().includes(term))
                    results.push({ type: 'vehicle', icon: '🚗', label: v.registracija || 'Vozilo', sub: `${v.marka || ''} ${v.model || ''}`, id: v.id });
            });
            getAll(COLLECTIONS.MEDICAL_EXAMS || 'medicalExams').forEach(m => {
                if (`${m.radnikIme || ''} ${m.ustanova || ''} ${m.doktor || ''}`.toLowerCase().includes(term))
                    results.push({ type: 'medical_exam', icon: '🩺', label: m.radnikIme || 'Pregled', sub: m.ustanova || '', id: m.id });
            });
            getAll(COLLECTIONS.SAFETY_OBSERVATIONS || 'safety_observations').forEach(o => {
                if (`${o.opis || ''} ${o.lokacija || ''}`.toLowerCase().includes(term))
                    results.push({ type: 'observation', icon: '🚨', label: o.lokacija || 'Prijava opasnosti', sub: o.opis || '', id: o.id });
            });
            getAll(COLLECTIONS.CERTIFICATES).forEach(c => {
                if (`${c.naziv || ''} ${c.radnikIme || ''} ${c.oznaka || ''}`.toLowerCase().includes(term))
                    results.push({ type: 'certificate', icon: '📜', label: c.naziv || 'Uvjerenje', sub: c.radnikIme || '', id: c.id });
            });
        } catch { /* dataStore not ready */ }
        return results.slice(0, 12);
    }, [searchTerm]);

    const handleNav = (r) => {
        onClose();
        if (r.type === 'worker') router.push(`/dashboard/workers?openWorker=${r.id}`);
        else if (r.type === 'equipment') router.push(`/dashboard/equipment?openItem=${r.id}`);
        else if (r.type === 'workplace') router.push('/dashboard/workplaces');
        else if (r.type === 'vehicle') router.push('/dashboard/fleet');
        else if (r.type === 'medical_exam') router.push('/dashboard/medical-exams');
        else if (r.type === 'observation') router.push('/dashboard/observations');
        else if (r.type === 'certificate') router.push('/dashboard/certificates');
        else router.push('/dashboard/org-units');
    };

    const typeLabel = (type) => {
        if (type === 'worker') return t('radnik1');
        if (type === 'equipment') return t('oprema');
        if (type === 'workplace') return t('radnoMj');
        if (type === 'vehicle') return t('vozilo1');
        if (type === 'medical_exam') return t('ljPregled');
        if (type === 'observation') return t('prijavaOp1');
        if (type === 'certificate') return t('uvjerenje');
        return t('orgJed');
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            bottom: 56, // keep bottom nav visible
            zIndex: 450,
            background: 'var(--bg-page)',
            display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out',
        }}>
            {/* Header with search input */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
            }}>
                <button
                    onClick={onClose}
                    style={{
                        width: 36, height: 36, borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg-input)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.9rem', color: 'var(--text-muted)', flexShrink: 0,
                    }}
                >←</button>
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg-input)', border: '2px solid var(--primary)',
                    borderRadius: 100, padding: '0 14px', height: 42,
                    boxShadow: '0 0 0 4px var(--primary-glow)',
                }}>
                    <span style={{ fontSize: '0.9rem', opacity: 0.4 }}>🔍</span>
                    <input
                        ref={inputRef}
                        style={{
                            border: 'none', background: 'transparent', outline: 'none',
                            fontSize: '0.95rem', color: 'var(--text)', fontFamily: 'var(--font-body)',
                            flex: 1, minWidth: 0,
                        }}
                        placeholder={t('searchPlaceholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}>✕</button>
                    )}
                </div>
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                {searchTerm.length < 2 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                            {t('pretraziteRadnikeOpremuRadnaMjesta')}
                        </div>
                        <div style={{ fontSize: '0.8rem', marginTop: 6, opacity: 0.6 }}>
                            {t('unesiteMinimalno2Znaka')}
                        </div>
                    </div>
                ) : searchResults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>😕</div>
                        <div style={{ fontSize: '0.9rem' }}>
                            {t('nemaRezultataZa')} &quot;{searchTerm}&quot;
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 0 4px' }}>
                            {searchResults.length} {t('rezultata')}
                        </div>
                        {searchResults.map((r, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleNav(r)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '14px 12px', width: '100%', border: 'none',
                                    background: 'var(--bg-card)', borderRadius: 12,
                                    cursor: 'pointer', textAlign: 'left',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    transition: 'background 0.15s',
                                }}
                            >
                                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{r.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{r.label}</div>
                                    {r.sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.sub}</div>}
                                </div>
                                <span style={{
                                    fontSize: '0.68rem', padding: '3px 8px', borderRadius: 10,
                                    background: 'var(--bg-badge)', color: 'var(--primary-dark)', fontWeight: 600, flexShrink: 0,
                                }}>{typeLabel(r.type)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
