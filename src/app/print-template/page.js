'use client';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { LAWS } from '@/lib/lawConfig';
import { useLanguage } from '@/contexts/LanguageContext';

/** Read the company country synchronously from localStorage */
function detectCountryFromStorage() {
    try {
        const activeId = localStorage.getItem('eznr_activeCompany');
        if (activeId && activeId !== 'all') {
            const raw = localStorage.getItem('eznr_data_companies');
            if (raw) {
                const companies = JSON.parse(raw);
                const comp = companies.find(c => c.id === activeId);
                if (comp?.country) return comp.country.toUpperCase();
            }
        }
    } catch (_) {}
    return null;
}

export default function PrintTemplatePage() {
    const searchParams = useSearchParams();
    const type = searchParams.get('type') || 'ZOS'; // ZOS or ZOP
    const workerName = searchParams.get('worker') || '_________________________';
    const urlCountry = searchParams.get('country');
    const urlLang = searchParams.get('lang');

    const { t, lang, setLang, isInitialized } = useLanguage();

    // Sync language if passed in URL
    useEffect(() => {
        if (urlLang && ['bs', 'hr', 'en', 'de', 'sl', 'sr'].includes(urlLang)) {
            setLang(urlLang);
        }
    }, [urlLang, setLang]);

    // Detect country: URL param > localStorage > fallback BA
    const [country, setCountry] = useState('BA');
    const ready = useRef(false);

    useEffect(() => {
        const detected = urlCountry || detectCountryFromStorage() || 'BA';
        setCountry(detected);
        ready.current = true;
    }, [urlCountry]);

    // Print only after country and language have been resolved
    useEffect(() => {
        if (!ready.current || !isInitialized) return;
        const timer = setTimeout(() => { window.print(); }, 400);
        return () => clearTimeout(timer);
    }, [country, isInitialized]);

    if (!isInitialized) return null;

    const today = new Date().toLocaleDateString(
        lang === 'en' ? 'en-US' : lang === 'de' ? 'de-DE' : lang === 'sl' ? 'sl-SI' : 'hr-HR'
    );

    const osh = LAWS[country]?.osh || LAWS.BA.osh;
    const fire = LAWS[country]?.fire || LAWS.BA.fire;

    return (
        <div className="print-template-wrapper" style={{ maxWidth: '210mm', minHeight: '297mm', margin: '0 auto', padding: '20mm', fontFamily: 'serif', boxSizing: 'border-box' }}>
            {type === 'ZOS' ? (
                <>
                    <div style={{ textAlign: 'center', marginBottom: '10mm', fontWeight: 'bold' }}>
                        {t('zapisnikZnrTitle')}
                    </div>

                    <div style={{ lineHeight: 1.8, fontSize: '11pt', textAlign: 'justify' }}>
                        <p>{t('komisijaUSastavu')}</p>
                        <ol style={{ marginLeft: '10mm', paddingLeft: 0, listStylePosition: 'inside' }}>
                            <li>______________________________, {t('predsjednikKomisije')}</li>
                            <li>______________________________, {t('clan')}</li>
                            <li>______________________________, {t('clan')}</li>
                        </ol>

                        <p>
                            {t('naOsnovu')} {t(osh.articleWord)} {osh.articles?.trainingObligation || '26'}. {t(osh.name)} ("{osh.gazette}")
                            {country === 'HR'
                                ? t('iPravilnikaHR')
                                : t('iPravilnikaBA')
                            }
                            {t('komisijaDonosiOcjenu')}
                        </p>

                        <div style={{ textAlign: 'center', margin: '10mm 0', fontSize: '14pt', fontWeight: 'bold' }}>
                            {workerName}
                        </div>

                        <p>
                            {t('upoznatSaUvjetima')}
                        </p>

                        <p>
                            {t('mjestoIDatum').replace('{0}', today)}
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25mm', fontSize: '11pt' }}>
                        <div style={{ textAlign: 'center' }}>
                            {t('radnikca')}<br/><br/>
                            _________________________
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            {t('komisijaPotpisi')}<br/><br/>
                            1. _________________________<br/><br/>
                            2. _________________________<br/><br/>
                            3. _________________________
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div style={{ textAlign: 'center', marginBottom: '10mm', fontWeight: 'bold' }}>
                        {t('zapisnikZopTitle')}
                    </div>

                    <div style={{ lineHeight: 1.8, fontSize: '11pt', textAlign: 'justify' }}>
                        <p>{t('komisijaUSastavu')}</p>
                        <ol style={{ marginLeft: '10mm', paddingLeft: 0, listStylePosition: 'inside' }}>
                            <li>______________________________, {t('predsjednikKomisije')}</li>
                            <li>______________________________, {t('clan')}</li>
                            <li>______________________________, {t('clan')}</li>
                        </ol>

                        <p>
                            {t('naOsnovu')} {t('zakonPropsZop').replace('{0}', t(fire.name)).replace('{1}', fire.gazette)}
                            {t('zopDonosiOcjenu')}
                        </p>

                        <div style={{ textAlign: 'center', margin: '10mm 0', fontSize: '14pt', fontWeight: 'bold' }}>
                            {workerName}
                        </div>

                        <p>
                            {t('zopEdukacijaTekst')}
                        </p>

                        <p>
                            {t('mjestoIDatum').replace('{0}', today)}
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25mm', fontSize: '11pt' }}>
                        <div style={{ textAlign: 'center' }}>
                            {t('radnikca')}<br/><br/>
                            _________________________
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            {t('komisijaPotpisi')}<br/><br/>
                            1. _________________________<br/><br/>
                            2. _________________________<br/><br/>
                            3. _________________________
                        </div>
                    </div>
                </>
            )}

            <style>{`
                .print-template-wrapper {
                    background-color: white !important;
                    color: black !important;
                }
                @media print {
                    body { background: white !important; margin: 0; padding: 0; }
                    nav, header, footer, .sidebar, button { display: none !important; }
                    @page { margin: 0; size: A4; }
                }
            `}
            </style>
        </div>
    );
}
