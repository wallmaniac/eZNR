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
    const { lang , t } = useLanguage();
    
    const country = useCountry();
    const { activeCompanyId } = useAuth();
    const [loading, setLoading] = useState(null);
    const [activeTab, setActiveTab] = useState('DOWNLOAD'); // DOWNLOAD or GENERATOR

    const tests = [
        {
            title: t('zopTest'),
            desc: t('fireProtectionTest'),
            file: '/templates/Test ZOP.docx',
            bg: 'rgba(239, 68, 68, 0.05)',
            border: 'rgba(239, 68, 68, 0.2)',
            icon: '🔥'
        },
        {
            title: t('znrTest'),
            desc: t('occupationalSafetyTest'),
            file: '/templates/Test ZNR.docx',
            bg: 'rgba(34, 197, 94, 0.05)',
            border: 'rgba(34, 197, 94, 0.2)',
            icon: '👷'
        }
    ];

    const generateEmailObject = (test) => {
        const subject = t('completeYourTest').replace('{0}', test.title);
        const body = t('dearWorkernnpleaseFindAttachedThe').replace('{0}', test.title);
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
            alert(t('errorDownloadingDocument'));
            setLoading(null);
        }
    };

    return (
        <div className="animate-fadeIn">
            <PageHeader icon="📝" title={t('testoviZopZnr')} />
            
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('DOWNLOAD')}
                    className={`tab-btn ${activeTab === 'DOWNLOAD' ? 'active' : ''}`}>
                    ⬇️ {t('downloadTemplates')}
                </button>
                <button onClick={() => setActiveTab('GENERATOR')}
                    className={`tab-btn ${activeTab === 'GENERATOR' ? 'active' : ''}`}>
                    ⚙️ {t('testGenerator')}
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                    <button className="btn btn-dark btn-sm" onClick={() => window.open(`/print-template?type=ZOS&country=${country}`, '_blank')} title={t('generirajtePrazanZapisnikOOcjeni')}>🖨️ {t('zapisnikZos')}</button>
                    <button className="btn btn-dark btn-sm" onClick={() => window.open(`/print-template?type=ZOP&country=${country}`, '_blank')} style={{ background: '#d32f2f', color: 'white', borderColor: '#b71c1c' }} title={t('generirajtePrazanZapisnikOOcjeni1')}>🔥 {t('zapisnikZop')}</button>
                </div>
            </div>

            {activeTab === 'DOWNLOAD' ? (
                <>
                    <div className="card" style={{ marginBottom: 24 }}>
                        <div className="card-body">
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 20, lineHeight: 1.5 }}>
                                {t('downloadOfficialOshTestTemplates')}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                                {tests.map(test => (
                                    <div key={test.title} style={{ 
                                        padding: 20, 
                                        borderRadius: 'var(--radius-md)', 
                                        background: test.bg, 
                                        border: `1px solid ${test.border}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 16
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: '2rem' }}>{test.icon}</span>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{test.title}</h3>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{test.desc}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                                            <button onClick={() => handleDownload(test)} disabled={loading === test.title} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                                                {loading === test.title ? '🔄...' : `📥 ${t('downloadDocx')}`}
                                            </button>
                                            <a href={generateEmailObject(test)} className="btn btn-outline btn-sm btn-icon" title={t('sendViaEmail')}>
                                                ✉️
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ padding: '12px 18px', borderRadius: 'var(--radius-sm)', background: 'rgba(33,150,243,0.05)', border: '1px solid rgba(33,150,243,0.18)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        <strong style={{ color: 'var(--text)' }}>⚖️ {t('certificateIssuanceProcedure')}</strong><br/>
                        {t('whenIssuingAnOshOr')}
                    </div>
                </>
            ) : (
                <TestGenerator />
            )}
        </div>
    );
}
