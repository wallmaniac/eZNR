'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PrintTemplatePage() {
    const searchParams = useSearchParams();
    const type = searchParams.get('type') || 'ZOS'; // ZOS or ZOP
    const workerName = searchParams.get('worker') || '_________________________';

    useEffect(() => {
        // Automatically open print dialog a moment after loading
        const t = setTimeout(() => {
            window.print();
        }, 500);
        return () => clearTimeout(t);
    }, []);

    const today = new Date().toLocaleDateString('bs-BA');

    return (
        <div style={{ maxWidth: '210mm', minHeight: '297mm', margin: '0 auto', padding: '20mm', background: 'white', color: 'black', fontFamily: 'serif', boxSizing: 'border-box' }}>
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
                            Na osnovu člana 26. Zakona o zaštiti na radu ("Službene novine Federacije BiH", broj 79/20) 
                            i Pravilnika o načinu, postupku i rokovima vršenja periodičnih pregleda i ispitivanja iz oblasti zaštite na radu, 
                            komisija donosi ocjenu da je radnik/ca:
                        </p>

                        <div style={{ textAlign: 'center', margin: '10mm 0', fontSize: '14pt', fontWeight: 'bold' }}>
                            {workerName}
                        </div>

                        <p>
                            upoznat/a sa uslovima rada, opasnostima i štetnostima na radnom mjestu, te je nakon sprovedene 
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
                            Na osnovu zakonskih propisa iz oblasti Zaštite od požara ("Službene novine Federacije BiH"),
                            komisija donosi ocjenu da je opće i posebno poznavanje mjera zaštite od požara usvojio/la radnik/ca:
                        </p>

                        <div style={{ textAlign: 'center', margin: '10mm 0', fontSize: '14pt', fontWeight: 'bold' }}>
                            {workerName}
                        </div>

                        <p>
                            koji/a je nakon edukacije i sprovedene provjere znanja, uspješno položio/la ispit i 
                            <strong> OSPOSOBLJEN/A</strong> je za sprovođenje mjera zaštite od požara, gašenje početnih požara 
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
                @media print {
                    body { background: white !important; margin: 0; padding: 0; }
                    nav, header, footer, .sidebar, button { display: none !important; }
                    @page { margin: 0; size: A4; }
                }
            `}</style>
        </div>
    );
}
