'use client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function NewsPage() {
    const { t, lang } = useLanguage();
    const [activeTab, setActiveTab] = useState('news');

    const tabs = [
        { key: 'news', label: t('news'), icon: '📰' },
        { key: 'forms', label: t('foreignForms'), icon: '📄' },
        { key: 'laws', label: t('lawsRegulations'), icon: '⚖️' },
    ];

    const newsItems = lang === 'bs' ? [
        { id: 1, datum: '24.02.2026.', naslov: 'Novi Zakon o zaštiti na radu u FBiH', opis: 'Usvojen novi zakon koji obavezuje sve poslodavce na usklađivanje s novim propisima do kraja godine.', tip: 'zakon' },
        { id: 2, datum: '20.02.2026.', naslov: 'Seminar: Upravljanje rizicima na radnom mjestu', opis: 'Pozivamo vas na besplatni online seminar o modernim pristupima upravljanju rizicima. Registracija otvorena.', tip: 'edukacija' },
        { id: 3, datum: '15.02.2026.', naslov: 'Ažurirane smjernice za osobnu zaštitnu opremu', opis: 'Objavljene nove smjernice za odabir i korištenje osobne zaštitne opreme u proizvodnji.', tip: 'smjernice' },
        { id: 4, datum: '10.02.2026.', naslov: 'Obveza elektronske prijave povreda na radu', opis: 'Od 01.03.2026. sve prijave povreda na radu moraju se podnositi kroz elektronski sustav eZNR.', tip: 'obavijest' },
        { id: 5, datum: '05.02.2026.', naslov: 'Godišnji izvještaj o zaštiti na radu za 2025.', opis: 'Rok za predaju godišnjeg izvještaja o stanju zaštite na radu je 31.03.2026.', tip: 'rok' },
    ] : [
        { id: 1, datum: '24.02.2026', naslov: 'New Occupational Safety Law in FBiH', opis: 'A new law has been adopted requiring all employers to comply with new regulations by the end of the year.', tip: 'law' },
        { id: 2, datum: '20.02.2026', naslov: 'Seminar: Workplace Risk Management', opis: 'Join our free online seminar on modern approaches to risk management. Registration is open.', tip: 'education' },
        { id: 3, datum: '15.02.2026', naslov: 'Updated PPE Guidelines', opis: 'New guidelines for selection and use of personal protective equipment in manufacturing published.', tip: 'guidelines' },
        { id: 4, datum: '10.02.2026', naslov: 'Mandatory Electronic Injury Reporting', opis: 'From 01.03.2026, all work injury reports must be submitted through the eZNR electronic system.', tip: 'notice' },
        { id: 5, datum: '05.02.2026', naslov: 'Annual Safety Report for 2025', opis: 'The deadline for submitting the annual occupational safety report is 31.03.2026.', tip: 'deadline' },
    ];

    const lawCategories = [
        {
            label: t('znrLaw'), icon: '🛡️', items: [
                { name: lang === 'bs' ? 'Zakon o zaštiti na radu (Sl. novine FBiH br. 22/02)' : 'Occupational Safety Law (Official Gazette FBiH no. 22/02)' },
                { name: lang === 'bs' ? 'Zakon o zaštiti na radu (Sl. glasnik RS br. 1/08)' : 'Occupational Safety Law (Official Gazette RS no. 1/08)' },
            ]
        },
        {
            label: t('znrRules'), icon: '📜', items: [
                { name: lang === 'bs' ? 'Pravilnik o sadržaju i načinu vođenja evidencija o radnicima' : 'Regulation on content and method of keeping worker records' },
                { name: lang === 'bs' ? 'Pravilnik o procjeni rizika' : 'Regulation on risk assessment' },
                { name: lang === 'bs' ? 'Pravilnik o osobnoj zaštitnoj opremi' : 'Regulation on personal protective equipment' },
            ]
        },
        {
            label: t('fireLaw'), icon: '🔥', items: [
                { name: lang === 'bs' ? 'Zakon o zaštiti od požara i vatrogastvu (Sl. novine FBiH br. 64/09)' : 'Fire Safety Law (Official Gazette FBiH no. 64/09)' },
            ]
        },
        {
            label: t('fireRules'), icon: '🧯', items: [
                { name: lang === 'bs' ? 'Pravilnik o tehničkim normativima za zaštitu od požara' : 'Regulation on technical norms for fire protection' },
            ]
        },
    ];

    const tipColors = {
        zakon: '#1565C0', edukacija: '#00897B', smjernice: '#6A1B9A', obavijest: '#E65100', rok: '#C62828',
        law: '#1565C0', education: '#00897B', guidelines: '#6A1B9A', notice: '#E65100', deadline: '#C62828',
    };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>🏠 {t('home')}</h1>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {tabs.map(tb => (
                    <button key={tb.key} onClick={() => setActiveTab(tb.key)} style={{
                        padding: '12px 24px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.9rem',
                        background: activeTab === tb.key ? 'var(--dark)' : 'var(--bg-input)',
                        color: activeTab === tb.key ? 'white' : 'var(--text)',
                        boxShadow: activeTab === tb.key ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                        transition: 'all 0.2s',
                    }}>
                        {tb.icon} {tb.label}
                    </button>
                ))}
            </div>

            {activeTab === 'news' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {newsItems.map(item => (
                        <div key={item.id} className="card" style={{ borderLeft: `4px solid ${tipColors[item.tip] || 'var(--primary)'}` }}>
                            <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.datum}</span>
                                        <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 700, background: `${tipColors[item.tip]}15`, color: tipColors[item.tip] }}>
                                            {item.tip.toUpperCase()}
                                        </span>
                                    </div>
                                    <h3 style={{ marginBottom: 8, fontSize: '1.05rem' }}>{item.naslov}</h3>
                                    <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', lineHeight: 1.6 }}>{item.opis}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'forms' && (
                <div className="card">
                    <div className="card-body">
                        <h3 style={{ marginBottom: 16 }}>📄 {t('foreignForms')}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                            {['Obrazac OR - Prijava povrede na radu', 'Obrazac PB - Prijava profesionalne bolesti', 'Obrazac OIR1', 'Obrazac RA1 - Ljekarska uputnica', 'Obrazac RO1', 'Obrazac RO2', 'Obrazac NR1 - Noćni rad'].map((form, idx) => (
                                <div key={idx} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                                    <span style={{ fontSize: '1.5rem' }}>📋</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{form}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF • {lang === 'bs' ? 'Preuzmi' : 'Download'}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'laws' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {lawCategories.map((cat, idx) => (
                        <div key={idx} className="card">
                            <div className="card-body">
                                <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {cat.icon} {cat.label}
                                </h3>
                                {cat.items.map((item, i) => (
                                    <div key={i} style={{ padding: '12px 16px', borderBottom: i < cat.items.length - 1 ? '1px solid var(--border-light)' : 'none', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <span style={{ color: 'var(--primary)' }}>📄</span>
                                        <span style={{ fontSize: '0.9rem' }}>{item.name}</span>
                                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--primary)' }}>⬇ {lang === 'bs' ? 'Preuzmi' : 'Download'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
