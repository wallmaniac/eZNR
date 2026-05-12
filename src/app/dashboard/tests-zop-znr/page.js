'use client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCountry } from '@/contexts/CountryContext';
import { useAuth } from '@/contexts/AuthContext';
import { getById, COLLECTIONS } from '@/lib/dataStore';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useState } from 'react';
import TestGenerator from './TestGenerator';

import PageHeader from '@/components/PageHeader';
export default function TestsZopZnrPage() {
    const { lang } = useLanguage();
    const bs = lang !== 'en';
    const country = useCountry();
    const { activeCompanyId } = useAuth();
    const [loading, setLoading] = useState(null);
    const [activeTab, setActiveTab] = useState('DOWNLOAD'); // DOWNLOAD or GENERATOR

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

    const handleDownload = async (test) => {
        try {
            setLoading(test.title);
            // Fetch template
            const response = await fetch(test.file);
            const arrayBuffer = await response.arrayBuffer();
            
            // Load zip
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            // Find which media files are actually referenced in the header rels
            const usedMedia = new Set();
            for (let i = 1; i <= 3; i++) {
                const relFile = zip.file(`word/_rels/header${i}.xml.rels`);
                if (relFile) {
                    const relText = await relFile.async('string');
                    // Regex to find Target="media/imageX.ext"
                    const matches = relText.match(/Target="media\/[^"]+"/g);
                    if (matches) {
                        matches.forEach(m => {
                            const imgName = m.split('"')[1];
                            usedMedia.add(`word/${imgName}`);
                        });
                    }
                }
            }

            // Update company logo and text
            if (activeCompanyId) {
                const company = getById(COLLECTIONS.COMPANIES, activeCompanyId);
                
                // Replace {{COMPANY_NAME}} in all headers
                let companyName = "Vaša Kompanija";
                if (company) companyName = company.naziv || company.skraceniNaziv || companyName;
                
                for (let i = 1; i <= 3; i++) {
                    const f = zip.file(`word/header${i}.xml`);
                    if (f) {
                        let xmlData = await f.async('string');
                        xmlData = xmlData.replace(/{{COMPANY_NAME}}/g, companyName);
                        zip.file(`word/header${i}.xml`, xmlData);
                    }
                }
                
                if (company && company.logo) {
                    let base64Logo = company.logo;
                    if (base64Logo.includes('base64,')) {
                        base64Logo = base64Logo.split('base64,')[1];
                    }
                    
                    usedMedia.forEach(mediaPath => {
                        if (zip.file(mediaPath)) {
                            zip.file(mediaPath, base64Logo, { base64: true });
                        }
                    });
                } else {
                    // Transparent 1x1 image (PNG)
                    const transparentBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                    usedMedia.forEach(mediaPath => {
                        if (zip.file(mediaPath)) {
                            zip.file(mediaPath, transparentBase64, { base64: true });
                        }
                    });
                }
            }
            
            // Generate and download
            const blob = await zip.generateAsync({ type: "blob" });
            saveAs(blob, test.title + ".docx");
            setLoading(null);
            
        } catch (error) {
            console.error("Error generating docx:", error);
            alert(bs ? "Došlo je do greške prilikom preuzimanja." : "Error downloading document.");
            setLoading(null);
        }
    };

    return (
        <div className="animate-fadeIn">
            <PageHeader icon="📝" title={bs ? 'Testovi ZOP i ZNR' : 'ZOP & ZNR Tests'} />
            
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('DOWNLOAD')}
                    className={`tab-btn ${activeTab === 'DOWNLOAD' ? 'active' : ''}`}>
                    ⬇️ {bs ? 'Preuzimanje obrazaca' : 'Download Templates'}
                </button>
                <button onClick={() => setActiveTab('GENERATOR')}
                    className={`tab-btn ${activeTab === 'GENERATOR' ? 'active' : ''}`}>
                    ⚙️ {bs ? 'Generator testova' : 'Test Generator'}
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                    <button className="btn btn-dark btn-sm" onClick={() => window.open(`/print-template?type=ZOS&country=${country}`, '_blank')}>🖨️ {bs ? 'Zapisnik ZOS' : 'Print ZOS'}</button>
                    <button className="btn btn-dark btn-sm" onClick={() => window.open(`/print-template?type=ZOP&country=${country}`, '_blank')} style={{ background: '#d32f2f', color: 'white', borderColor: '#b71c1c' }}>🔥 {bs ? 'Zapisnik ZOP' : 'Print ZOP'}</button>
                </div>
            </div>

            {activeTab === 'DOWNLOAD' ? (
                <>
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
                                            <button onClick={() => handleDownload(t)} disabled={loading === t.title} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                                                {loading === t.title ? '🔄...' : `📥 ${bs ? 'Preuzmi DOCX' : 'Download DOCX'}`}
                                            </button>
                                            <a href={generateEmailObject(t)} className="btn btn-outline btn-sm btn-icon" title={bs ? 'Pošalji e-mailom' : 'Send via email'}>
                                                ✉️
                                            </a>
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
                </>
            ) : (
                <TestGenerator />
            )}
        </div>
    );
}
