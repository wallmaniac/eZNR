'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * EmptyDashboard — Shown when a company has no workers and no certificates.
 * Guides the user through initial setup with a visual stepper.
 * Fully responsive: adapts layout for mobile (< 768px).
 */
export default function EmptyDashboard() {
    const router = useRouter();
    const { lang } = useLanguage();
    const bs = lang !== 'en';

    // ── Mobile detection (mirrors dashboard pattern) ──
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const steps = [
        {
            num: 1,
            icon: '🏢',
            title: bs ? 'Postavite podatke o tvrtki' : 'Set up company data',
            desc: bs
                ? 'Unesite naziv, adresu, OIB, logo i kontakt podatke vaše tvrtke.'
                : 'Enter company name, address, ID, logo and contact details.',
            action: bs ? 'Otvori postavke' : 'Open settings',
            route: '/dashboard/settings',
            color: 'var(--secondary)',
        },
        {
            num: 2,
            icon: '👥',
            title: bs ? 'Dodajte radnike' : 'Add workers',
            desc: bs
                ? 'Ručno dodajte radnike ili uvezite iz Excel predloška za brži unos podataka.'
                : 'Add workers manually or import from an Excel template for faster data entry.',
            action: bs ? 'Otvori radnike' : 'Open workers',
            route: '/dashboard/workers',
            color: 'var(--primary)',
            badge: bs ? '📥 Excel import' : '📥 Excel import',
        },
        {
            num: 3,
            icon: '📜',
            title: bs ? 'Dodajte uvjerenja i preglede' : 'Add certificates & exams',
            desc: bs
                ? 'Evidentirajte uvjerenja o osposobljenosti, ljekarske preglede i OZO opremu.'
                : 'Record training certificates, medical exams and PPE assignments.',
            action: bs ? 'Otvori uvjerenja' : 'Open certificates',
            route: '/dashboard/worker-certificates',
            color: '#FF9800',
        },
        {
            num: 4,
            icon: '📊',
            title: bs ? 'Pratite sve na dashboardu' : 'Track everything on the dashboard',
            desc: bs
                ? 'Dashboard automatski prikazuje isteke, upozorenja, kalendar i analitiku.'
                : 'The dashboard automatically shows expirations, alerts, calendar and analytics.',
            action: null,
            route: null,
            color: 'var(--success)',
        },
    ];

    // ── Hover guard: only on non-touch ──
    const hoverIn = (e, route) => {
        if (!route || !window.matchMedia('(hover: hover)').matches) return;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
    };
    const hoverOut = (e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
    };

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 760, margin: '0 auto' }}>
            {/* Hero */}
            <div className="card" style={{
                background: 'linear-gradient(135deg, rgba(0,191,166,0.08) 0%, rgba(99,102,241,0.06) 100%)',
                border: '1px solid rgba(0,191,166,0.18)',
                marginBottom: isMobile ? 20 : 28,
            }}>
                <div className="card-body" style={{ textAlign: 'center', padding: isMobile ? '28px 16px' : '40px 28px' }}>
                    <div style={{ fontSize: isMobile ? '2.4rem' : '3.2rem', marginBottom: 10 }}>🛡️</div>
                    <h1 style={{
                        margin: '0 0 8px', fontSize: isMobile ? '1.25rem' : '1.6rem', fontWeight: 800,
                        fontFamily: 'var(--font-heading)',
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}>
                        {bs ? 'Dobrodošli u eZNR!' : 'Welcome to eZNR!'}
                    </h1>
                    <p style={{
                        margin: 0, fontSize: isMobile ? '0.85rem' : '0.95rem', color: 'var(--text-muted)',
                        lineHeight: 1.6, maxWidth: 520, marginInline: 'auto',
                    }}>
                        {bs
                            ? 'Vaš digitalni sustav zaštite na radu. Pratite radnike, uvjerenja, opremu, rokove i zakonske obveze — sve na jednom mjestu.'
                            : 'Your digital occupational safety system. Track workers, certificates, equipment, deadlines and legal obligations — all in one place.'}
                    </p>
                </div>
            </div>

            {/* Quick Start Stepper */}
            <div style={{
                fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                🚀 {bs ? 'Brzi početak' : 'Quick Start'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
                {steps.map((step) => (
                    <div
                        key={step.num}
                        className="card"
                        style={{
                            cursor: step.route ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            borderLeft: `4px solid ${step.color}`,
                        }}
                        onClick={() => step.route && router.push(step.route)}
                        onMouseEnter={e => hoverIn(e, step.route)}
                        onMouseLeave={hoverOut}
                    >
                        <div className="card-body" style={{
                            display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                            gap: isMobile ? 12 : 16, padding: isMobile ? '14px 14px' : '16px 20px',
                        }}>
                            {/* Step number badge */}
                            <div style={{
                                width: isMobile ? 36 : 42, height: isMobile ? 36 : 42, borderRadius: '50%',
                                background: step.color, color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: isMobile ? '0.85rem' : '1rem',
                                fontFamily: 'var(--font-heading)',
                                flexShrink: 0,
                                boxShadow: `0 4px 12px ${step.color}40`,
                                marginTop: isMobile ? 2 : 0,
                            }}>
                                {step.num}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    marginBottom: 2, flexWrap: 'wrap',
                                }}>
                                    <span style={{ fontSize: isMobile ? '1rem' : '1.2rem' }}>{step.icon}</span>
                                    <span style={{
                                        fontWeight: 700, fontSize: isMobile ? '0.85rem' : '0.95rem',
                                        fontFamily: 'var(--font-heading)', color: 'var(--text)',
                                    }}>{step.title}</span>
                                    {step.badge && (
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700,
                                            padding: '2px 7px', borderRadius: 999,
                                            background: 'rgba(0,191,166,0.1)',
                                            color: 'var(--primary)',
                                            border: '1px solid rgba(0,191,166,0.2)',
                                            whiteSpace: 'nowrap',
                                        }}>{step.badge}</span>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: isMobile ? '0.78rem' : '0.84rem',
                                    color: 'var(--text-muted)', lineHeight: 1.5,
                                }}>{step.desc}</div>

                                {/* Action link — shown below desc on mobile for cleaner layout */}
                                {isMobile && step.action && (
                                    <div style={{
                                        marginTop: 8, fontSize: '0.8rem', fontWeight: 600,
                                        color: step.color, display: 'flex', alignItems: 'center', gap: 4,
                                    }}>
                                        {step.action} →
                                    </div>
                                )}
                            </div>

                            {/* Action arrow — desktop only (right side) */}
                            {!isMobile && step.action && (
                                <div style={{
                                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: '0.82rem', fontWeight: 600, color: step.color,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {step.action} →
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer hint */}
            <div style={{
                marginTop: isMobile ? 18 : 24, padding: isMobile ? '10px 12px' : '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(33,150,243,0.06)', border: '1px solid rgba(33,150,243,0.15)',
                fontSize: isMobile ? '0.75rem' : '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5,
                display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
                <span style={{ flexShrink: 0 }}>💡</span>
                <span>
                    {bs
                        ? 'Savjet: Najbrži način za početak je uvoz radnika iz Excel predloška. Otvorite modul Radnici i kliknite "Uvezi iz Excel-a".'
                        : 'Tip: The fastest way to start is importing workers from an Excel template. Open the Workers module and click "Import from Excel".'}
                </span>
            </div>
        </div>
    );
}
