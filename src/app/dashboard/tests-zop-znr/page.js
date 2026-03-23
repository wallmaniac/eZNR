'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TestsZopZnrPage() {
    const { lang } = useLanguage();
    const bs = lang === 'bs';

    const tests = [
        {
            title: bs ? 'Test ZOP' : 'ZOP Test',
            desc: bs ? 'Test iz Zaštite od požara (Osposobljavanje ZOP)' : 'Fire Protection Test',
            file: '/templates/Test ZOP.docx',
            bg: 'rgba(239, 68, 68, 0.05)',
            border: 'rgba(239, 68, 68, 0.2)',
            icon: '🔥'
        },
        {
            title: bs ? 'Test ZNR' : 'ZNR Test',
            desc: bs ? 'Test iz Zaštite na radu (Osposobljavanje ZNR)' : 'Occupational Safety Test',
            file: '/templates/Test ZNR.docx',
            bg: 'rgba(34, 197, 94, 0.05)',
            border: 'rgba(34, 197, 94, 0.2)',
            icon: '👷'
        }
    ];

    const generateEmailObject = (test) => {
        const subject = bs ? `Položite ${test.title} test` : `Complete your ${test.title} test`;
        const body = bs 
            ? `Poštovani,\n\nU prilogu Vam šaljemo zvanični dokument "${test.title}".\nMolimo Vas da test popunite i potpišete, te ga vratite referentu ZNR/ZOP ili predate zaduženoj osobi, kako bi Vam se izdalo važeće Uvjerenje.\n\nHvala!`
            : `Dear worker,\n\nPlease find attached the official "${test.title}".\nKindly fill and sign the test, then return it to your OSH officer so your Certificate can be issued.\n\nThank you!`;
        return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ marginBottom: 24 }}>📝 {bs ? 'Testovi ZOP i ZNR' : 'ZOP & ZNR Tests'}</h1>
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body">
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.5 }}>
                        {bs 
                            ? 'Ovdje možete preuzeti zvanične obrasce testova za provjeru znanja radnika iz oblasti zaštite na radu (ZNR) i zaštite od požara (ZOP). Referent ZNR prepušta radniku blanko test. Nakon što radnik popuni i potpiše test, referent ga pohranjuje kao dokaz (prilog Uvjerenja).'
                            : 'Download official OSH test templates here. The OSH officer gives the blank test to the worker. Once the worker fills and signs the test, it must be uploaded as proof (Certificate attachment).'}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                        {tests.map(t => (
                            <div key={t.title} style={{ 
                                padding: 20, 
                                borderRadius: 'var(--radius-md)', 
                                background: t.bg, 
                                border: `1px solid ${t.border}`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: '2rem' }}>{t.icon}</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{t.title}</h3>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{t.desc}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                                    <a href={t.file} download className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                                        📥 {bs ? 'Preuzmi DOCX' : 'Download DOCX'}
                                    </a>
                                    <a href={generateEmailObject(t)} className="btn btn-outline btn-sm btn-icon" title={bs ? 'Pošalji e-mailom' : 'Send via email'}>
                                        ✉️
                                    </a>
                                    <button onClick={() => {
                                        const w = window.open(t.file);
                                        // Some browsers may try to print PDF directly, but with DOCX it triggers download anyway.
                                        // A simple alert if they just want to print immediately
                                        alert(bs ? 'Preuzmite DOCX fajl na svoj računar, otvorite ga u Wordu i potom odštampajte.' : 'Please download the DOCX file, open it in Word, and print it.');
                                    }} className="btn btn-outline btn-sm btn-icon" title={bs ? 'Ispiši' : 'Print'}>
                                        🖨️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div style={{ padding: '12px 18px', borderRadius: 'var(--radius-sm)', background: 'rgba(33,150,243,0.05)', border: '1px solid rgba(33,150,243,0.18)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text)' }}>⚖️ {bs ? 'Procedura izdavanja uvjerenja:' : 'Certificate Issuance Procedure:'}</strong><br/>
                {bs ? 'Kada dodjeljujete Uvjerenje o osposobljenosti za zaštitu na radu (ZNR) ili zaštitu od požara (ZOP) konkretnom radniku, potrebno je obavezno skenirati ovaj test (nakon što ga radnik ispuni i potpiše) te taj skenirani papir dodati kao prilog ("Upload potpisan scan") u kartonu tog Uvjerenja.' : 'When issuing an OSH or Fire Safety Certificate to a specific worker, you must scan this test (after the worker fills and signs it) and add the scanned paper as an attachment ("Upload signed scan") in the Certificate\'s record.'}
            </div>
        </div>
    );
}
