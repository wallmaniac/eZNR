'use client';

import React from 'react';

// A helper to format dates nicely 
function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('bs-BA');
    } catch { return dateStr; }
}

export default function PrintableAnnualReport({
    companyName = "Naša Kompanija",
    workers = [],
    certs = [],
    equipment = [],
    injuries = [],
    diseases = [],
    riskItems = [],
    riskAssessments = [],
    medicalExams = [],
    lang = 'bs'
}) {
    const today = new Date();
    const dateFormatted = today.toLocaleDateString('bs-BA');
    const in30Days = new Date(today.getTime() + 30 * 86400000);

    const activeWorkers = workers.filter(w => w.aktivan !== false);

    // Filter injuries from the last 12 months
    const last12m = injuries.filter(i => {
        if (!i.datum) return false;
        const d = new Date(i.datum);
        return (today - d) <= (365 * 86400000);
    });

    // Medical Exams Analysis
    const expiredMed = medicalExams.filter(m => m.vrijediDo && new Date(m.vrijediDo) < today);
    const expiringSoonMed = medicalExams.filter(m => m.vrijediDo && new Date(m.vrijediDo) >= today && new Date(m.vrijediDo) <= in30Days);

    // Certs Analysis
    const expiredCerts = certs.filter(c => c.vrijediDo && new Date(c.vrijediDo) < today);
    const expiringSoonCerts = certs.filter(c => c.vrijediDo && new Date(c.vrijediDo) >= today && new Date(c.vrijediDo) <= in30Days);

    // Equipment Analysis
    const totalEquipment = equipment.length;
    const expiredEq = equipment.filter(e => e.iduci && new Date(e.iduci) < today);
    const expiringSoonEq = equipment.filter(e => e.iduci && new Date(e.iduci) >= today && new Date(e.iduci) <= in30Days);
    const eqCompliance = totalEquipment > 0 ? Math.round(((totalEquipment - expiredEq.length) / totalEquipment) * 100) : 100;

    // Worker lookup map
    const workerMap = {};
    workers.forEach(w => workerMap[w.id] = `${w.ime} ${w.prezime}`);

    const styles = {
        container: {
            width: '210mm',
            minHeight: '297mm',
            padding: '20mm',
            margin: 'auto',
            background: '#ffffff',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: '12pt',
            lineHeight: 1.5,
            boxSizing: 'border-box'
        },
        header: {
            borderBottom: '2px solid #000000',
            paddingBottom: '10px',
            marginBottom: '20px',
            textAlign: 'center',
        },
        title: {
            fontSize: '16pt',
            fontWeight: 'bold',
            marginTop: '20px',
            marginBottom: '20px',
            textAlign: 'center',
            textTransform: 'uppercase'
        },
        h2: {
            fontSize: '14pt',
            fontWeight: 'bold',
            marginTop: '25px',
            marginBottom: '10px',
            textDecoration: 'underline'
        },
        p: {
            marginBottom: '10px',
            textAlign: 'justify' // Professional format
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '15px',
            fontSize: '11pt'
        },
        th: {
            border: '1px solid #000000',
            padding: '6px',
            backgroundColor: '#ededed',
            color: '#000000',
            fontWeight: 'bold',
            textAlign: 'left'
        },
        td: {
            border: '1px solid #000000',
            padding: '6px',
            color: '#000000',
            backgroundColor: '#ffffff'
        },
        footer: {
            marginTop: '50px',
            display: 'flex',
            justifyContent: 'space-between',
        },
        signLine: {
            width: '200px',
            borderTop: '1px solid #000000',
            textAlign: 'center',
            paddingTop: '5px'
        }
    };

    return (
        <div style={styles.container} className="printable-report">
            <div style={styles.header}>
                <strong>Poslodavac:</strong> {companyName}<br />
                <strong>Datum izrade:</strong> {dateFormatted}<br />
                <strong>Mjesto:</strong> _____________________
            </div>

            <div style={styles.title}>
                {lang === 'bs' ? 'Godišnji izvještaj o stanju zaštite na radu' : 'Annual Occupational Safety Report'}
            </div>

            <div style={styles.h2}>1. Opšti podaci</div>
            <div style={styles.p}>
                Na dan {dateFormatted}, poslodavac {companyName} broji ukupno <strong>{activeWorkers.length} aktivnih radnika</strong> prema evidenciji Informacionog sistema ZNR. 
                Sistem kontinuirano vrši nadzor nad valjanošću obuka, ljekarskih uvjerenja, ocjenom radne opreme te praćenjem evidencija povreda na radu kako bi se osigurala optimalna prevencija rizika te usklađenost sa Zakonom o zaštiti na radu.
            </div>

            <div style={styles.h2}>2. Povrede i bolesti na radu (posljednjih 12 mjeseci)</div>
            <div style={styles.p}>
                U prethodnih 12 mjeseci zabilježeno je <strong>{last12m.length} incidenata</strong>.
                {last12m.length === 0 ? ' S obzirom da na navedeni period nisu prijavljeni incidenti, stanje se ocjenjuje izuzetno povoljnim.' : ''}
            </div>
            {last12m.length > 0 && (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Datum</th>
                            <th style={styles.th}>Radnik</th>
                            <th style={styles.th}>Vrsta incidenta</th>
                        </tr>
                    </thead>
                    <tbody>
                        {last12m.map((i, index) => (
                            <tr key={index}>
                                <td style={styles.td}>{formatDate(i.datum)}</td>
                                <td style={styles.td}>{i.radnikIme || workerMap[i.workerId] || 'Nepoznato'}</td>
                                <td style={styles.td}>{i.tip} {i.bolovanje ? '(Otvoreno bolovanje)' : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <div style={styles.h2}>3. Evidencija ljudskih resursa (Uvjerenja i Ljekarski)</div>
            <div style={styles.p}>
                <strong>Upozorenja zbog prekoračenja roka:</strong> Ukupno je detektovano <strong>{expiredMed.length}</strong> prekoračenih ljekarskih pregleda, te <strong>{expiredCerts.length}</strong> isteklih uvjerenja i stručnih obuka. Detaljna lista lica obuhvaćenih upozorenjem navedena je u tabelama niže. Neophodno je navedena lica u što skorijem roku uputiti na obnavljanje periodičnih kontrola.
            </div>

            {expiredMed.length > 0 && (
                <>
                    <strong>Istekli ljekarski pregledi:</strong>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Ime i prezime</th>
                                <th style={styles.th}>Tip pregleda</th>
                                <th style={styles.th}>Isteklo dana</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiredMed.map((m, index) => (
                                <tr key={index}>
                                    <td style={styles.td}>{workerMap[m.workerId] || 'N/A'}</td>
                                    <td style={styles.td}>{m.vrsta || 'Ljekarski pregled'}</td>
                                    <td style={styles.td} style={{...styles.td, color: 'red'}}>{formatDate(m.vrijediDo)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {expiredCerts.length > 0 && (
                <>
                    <strong>Istekla obavezna uvjerenja (ZOS, ZOP i sl.):</strong>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Ime i prezime</th>
                                <th style={styles.th}>Vrsta uvjerenja</th>
                                <th style={styles.th}>Isteklo dana</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiredCerts.map((c, index) => (
                                <tr key={index}>
                                    <td style={styles.td}>{workerMap[c.workerId] || 'N/A'}</td>
                                    <td style={styles.td}>{c.vrsta}</td>
                                    <td style={styles.td} style={{...styles.td, color: 'red'}}>{formatDate(c.vrijediDo)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {(expiringSoonMed.length > 0 || expiringSoonCerts.length > 0) && (
                <div style={styles.p}>
                    <em>Napomena: Postoje uvjerenja i pregledi koji ističu u narednih 30 dana (Ljekarski: {expiringSoonMed.length}, Uvjerenja: {expiringSoonCerts.length}). Nadzorno lice je dužno preduzeti aktivnosti planiranja.</em>
                </div>
            )}

            <div style={styles.h2}>4. Stanje radne opreme i objekata</div>
            <div style={styles.p}>
                Evidentirano je {totalEquipment} komada radne opreme, sredstava za rad, uređaja i instalacija u objektima poslodavca. Prikaz trenutne procjene usklađenosti ispitivanja opreme iznosi <strong>{eqCompliance}%</strong>.
            </div>

            {expiredEq.length > 0 ? (
                <>
                    <div style={styles.p}>
                        <strong style={{ color: 'red' }}>Apsolutni prioritet za ispitivanje:</strong> Sljedeća oprema je prerasla svoj rok obaveznog atestiranja/ispitivanja i ne bi se trebala koristiti dok se isto ne obnovi:
                    </div>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Naziv opreme</th>
                                <th style={styles.th}>Serijski br. / Id</th>
                                <th style={styles.th}>Lokacija</th>
                                <th style={styles.th}>Datum isteka ispitivanja</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expiredEq.map((e, index) => (
                                <tr key={index}>
                                    <td style={styles.td}>{e.naziv}</td>
                                    <td style={styles.td}>{e.serijskiBroj || '-'}</td>
                                    <td style={styles.td}>{e.lokacija || '-'}</td>
                                    <td style={styles.td} style={{...styles.td, color: 'red'}}>{formatDate(e.iduci)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            ) : (
                <div style={styles.p}>
                    Nema opreme kojoj je rok obaveznog pregleda istekao. Sva radna sredstva su opremljena važećim upotrebnim dozvolama.
                </div>
            )}

            <div style={styles.footer}>
                <div>
                    <div>Za poslodavca / Direktor</div>
                    <div style={styles.signLine}>M.P. i Potpis</div>
                </div>
                <div>
                    <div>Sastavio (Stručnjak ZNR)</div>
                    <div style={styles.signLine}>Potpis</div>
                </div>
            </div>
        </div>
    );
}
