'use client';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { LAWS } from '@/lib/lawConfig';

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

    // Detect country: URL param > localStorage > fallback BA
    const [country, setCountry] = useState('BA');
    const ready = useRef(false);

    useEffect(() => {
        const detected = urlCountry || detectCountryFromStorage() || 'BA';
        setCountry(detected);
        ready.current = true;
    }, [urlCountry]);

    // Print only after country has been resolved (next tick after setCountry)
    useEffect(() => {
        if (!ready.current) return;
        const t = setTimeout(() => { window.print(); }, 400);
        return () => clearTimeout(t);
    }, [country]);

    const today = new Date().toLocaleDateString('hr-HR');

    const osh = LAWS[country]?.osh || LAWS.BA.osh;
    const fire = LAWS[country]?.fire || LAWS.BA.fire;

    return (
        <div className="print-template-wrapper" style={{ maxWidth: '210mm', minHeight: '297mm', margin: '0 auto', padding: '20mm', fontFamily: 'serif', boxSizing: 'border-box' }}>
            {type === 'ZOS' ? (
                <>
                    <div style={{ textAlign: 'center', marginBottom: '10mm', fontWeight: 'bold' }}>
                        ZAPISNIK<br/>
                        O OCJENI OSPOSOBLJENOSTI RADNIKA ZA RAD NA SIGURAN NAČIN
                    </div>

                    <div style={{ lineHeight: 1.8, fontSize: '11pt', textAlign: 'justify' }}>
                        <p>Komisija u sastavu:</p>
                        <ol style={{ marginLeft: '10mm', paddingLeft: 0, listStylePosition: 'inside' }}>
                            <li>______________________________, Predsjednik komisije</li>
                            <li>______________________________, Član</li>
                            <li>______________________________, Član</li>
                        </ol>

                        <p>
                            Na osnovu {osh.articleWord} {osh.articles?.trainingObligation || '26'}. {osh.name} ("{osh.gazette}")
                            {country === 'HR'
                                ? ' i Pravilnika o osposobljavanju i usavršavanju iz zaštite na radu (NN 142/21), '
                                : ' i Pravilnika o načinu, postupku i rokovima vršenja periodičnih pregleda i ispitivanja iz oblasti zaštite na radu, '
                            }
                            komisija donosi ocjenu da je radnik/ca:
                        </p>

                        <div style={{ textAlign: 'center', margin: '10mm 0', fontSize: '14pt', fontWeight: 'bold' }}>
                            {workerName}
                        </div>

                        <p>
                            upoznat/a sa uvjetima rada, opasnostima i štetnostima na radnom mjestu, te je nakon provedene
                            teoretske i praktične obuke uspješno položio/la provjeru znanja i <strong>OSPOSOBLJEN/A</strong> je za rad na siguran način.
                        </p>

                        <p>
                            Mjesto i datum: _______________________, {today} godine.
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25mm', fontSize: '11pt' }}>
                        <div style={{ textAlign: 'center' }}>
                            Radnik/ca:<br/><br/>
                            _________________________
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            Komisija (potpisi):<br/><br/>
                            1. _________________________<br/><br/>
                            2. _________________________<br/><br/>
                            3. _________________________
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div style={{ textAlign: 'center', marginBottom: '10mm', fontWeight: 'bold' }}>
                        ZAPISNIK<br/>
                        O OCJENI OSPOSOBLJENOSTI RADNIKA IZ OBLASTI ZAŠTITE OD POŽARA
                    </div>

                    <div style={{ lineHeight: 1.8, fontSize: '11pt', textAlign: 'justify' }}>
                        <p>Komisija u sastavu:</p>
                        <ol style={{ marginLeft: '10mm', paddingLeft: 0, listStylePosition: 'inside' }}>
                            <li>______________________________, Predsjednik komisije</li>
                            <li>______________________________, Član</li>
                            <li>______________________________, Član</li>
                        </ol>

                        <p>
                            Na osnovu zakonskih propisa iz oblasti zaštite od požara ({fire.name}, "{fire.gazette}"),
                            komisija donosi ocjenu da je opće i posebno poznavanje mjera zaštite od požara usvojio/la radnik/ca:
                        </p>

                        <div style={{ textAlign: 'center', margin: '10mm 0', fontSize: '14pt', fontWeight: 'bold' }}>
                            {workerName}
                        </div>

                        <p>
                            koji/a je nakon edukacije i provedene provjere znanja, uspješno položio/la ispit i
                            <strong> OSPOSOBLJEN/A</strong> je za provođenje mjera zaštite od požara, gašenje početnih požara
                            kao i za evakuaciju i spašavanje.
                        </p>

                        <p>
                            Mjesto i datum: _______________________, {today} godine.
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25mm', fontSize: '11pt' }}>
                        <div style={{ textAlign: 'center' }}>
                            Radnik/ca:<br/><br/>
                            _________________________
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            Komisija (potpisi):<br/><br/>
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
