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

const REPORT_TEXT = {
  bs: {
    employer: 'Poslodavac:',
    dateOfMake: 'Datum izrade:',
    place: 'Mjesto:',
    title: 'Godišnji izvještaj o stanju zaštite na radu',
    sec1: '1. Opšti podaci',
    sec1_text: 'Na dan {dateFormatted}, poslodavac {companyName} broji ukupno {activeWorkersLength} aktivnih radnika prema evidenciji Informacionog sistema ZNR. Sistem kontinuirano vrši nadzor nad valjanošću obuka, ljekarskih uvjerenja, ocjenom radne opreme te praćenjem evidencija povreda na radu kako bi se osigurala optimalna prevencija rizika te usklađenost sa Zakonom o zaštiti na radu.',
    sec2: '2. Povrede i bolesti na radu (posljednjih 12 mjeseci)',
    sec2_incidents: 'U prethodnih 12 mjeseci zabilježeno je {last12mLength} incidenata.',
    sec2_noIncidents: ' S obzirom da u navedenom periodu nisu prijavljeni incidenti, stanje se ocjenjuje izuzetno povoljnim.',
    th_date: 'Datum',
    th_worker: 'Radnik',
    th_incType: 'Vrsta incidenta',
    openLeave: '(Otvoreno bolovanje)',
    sec3: '3. Evidencija ljudskih resursa (Uvjerenja i Ljekarski)',
    sec3_warnings: 'Upozorenja zbog prekoračenja roka: Ukupno je detektovano {expiredMedLength} prekoračenih ljekarskih pregleda, te {expiredCertsLength} isteklih uvjerenja i stručnih obuka. Detaljna lista lica obuhvaćenih upozorenjem navedena je u tabelama niže. Neophodno je navedena lica u što skorijem roku uputiti na obnavljanje periodičnih kontrola.',
    expiredMedTitle: 'Istekli ljekarski pregledi:',
    th_name: 'Ime i prezime',
    th_examType: 'Tip pregleda',
    th_expiredOn: 'Isteklo dana',
    expiredCertsTitle: 'Istekla obavezna uvjerenja (ZOS, ZOP i sl.):',
    th_certType: 'Vrsta uvjerenja',
    sec3_note: 'Napomena: Postoje uvjerenja i pregledi koji ističu u narednih 30 dana (Ljekarski: {expiringSoonMedLength}, Uvjerenja: {expiringSoonCertsLength}). Nadzorno lice je dužno preduzeti aktivnosti planiranja.',
    sec4: '4. Stanje radne opreme i objekata',
    sec4_text: 'Evidentirano je {totalEquipment} komada radne opreme, sredstava za rad, uređaja i instalacija u objektima poslodavca. Prikaz trenutne procjene usklađenosti ispitivanja opreme iznosi {eqCompliance}%.',
    sec4_prio: 'Apsolutni prioritet za ispitivanje:',
    sec4_prioDesc: 'Sljedeća oprema je prerasla svoj rok obaveznog atestiranja/ispitivanja i ne bi se trebala koristiti dok se isto ne obnovi:',
    th_eqName: 'Naziv opreme',
    th_eqSerial: 'Serijski br. / Id',
    th_eqLocation: 'Lokacija',
    th_eqExpiry: 'Datum isteka ispitivanja',
    sec4_ok: 'Nema opreme kojoj je rok obaveznog pregleda istekao. Sva radna sredstva su opremljena važećim upotrebnim dozvolama.',
    sig1_title: 'Za poslodavca / Direktor',
    sig1_line: 'M.P. i Potpis',
    sig2_title: 'Sastavio (Stručnjak ZNR)',
    sig2_line: 'Potpis'
  },
  hr: {
    employer: 'Poslodavac:',
    dateOfMake: 'Datum izrade:',
    place: 'Mjesto:',
    title: 'Godišnje izvješće o stanju zaštite na radu',
    sec1: '1. Opći podaci',
    sec1_text: 'Na dan {dateFormatted}, poslodavac {companyName} broji ukupno {activeWorkersLength} aktivnih radnika prema evidenciji Informacijskog sustava ZNR. Sustav kontinuirano vrši nadzor nad valjanošću osposobljavanja, liječničkih uvjerenja, ocjenom radne opreme te praćenjem evidencija ozljeda na radu kako bi se osigurala optimalna prevencija rizika te usklađenost sa Zakonom o zaštiti na radu.',
    sec2: '2. Ozljede i bolesti na radu (posljednjih 12 mjeseci)',
    sec2_incidents: 'U prethodnih 12 mjeseci zabilježeno je {last12mLength} incidenata.',
    sec2_noIncidents: ' S obzirom da u navedenom razdoblju nisu prijavljeni incidenti, stanje se ocjenjuje iznimno povoljnim.',
    th_date: 'Datum',
    th_worker: 'Radnik',
    th_incType: 'Vrsta incidenta',
    openLeave: '(Otvoreno bolovanje)',
    sec3: '3. Evidencija ljudskih resursa (Uvjerenja i Liječnički)',
    sec3_warnings: 'Upozorenja zbog prekoračenja roka: Ukupno je detektirano {expiredMedLength} prekoračenih liječničkih pregleda, te {expiredCertsLength} isteklih uvjerenja i stručnih osposobljavanja. Detaljna lista osoba obuhvaćenih upozorenjem navedena je u tablicama niže. Neophodno je navedene osobe u što skorijem roku uputiti na obnavljanje periodičnih kontrola.',
    expiredMedTitle: 'Istekli liječnički pregledi:',
    th_name: 'Ime i prezime',
    th_examType: 'Tip pregleda',
    th_expiredOn: 'Isteklo dana',
    expiredCertsTitle: 'Istekla obvezna uvjerenja (ZOS, ZOP i sl.):',
    th_certType: 'Vrsta uvjerenja',
    sec3_note: 'Napomena: Postoje uvjerenja i pregledi koji ističu u narednih 30 dana (Liječnički: {expiringSoonMedLength}, Uvjerenja: {expiringSoonCertsLength}). Nadzorna osoba je dužna poduzeti aktivnosti planiranja.',
    sec4: '4. Stanje radne opreme i objekata',
    sec4_text: 'Evidentirano je {totalEquipment} komada radne opreme, sredstava za rad, uređaja i instalacija u objektima poslodavca. Prikaz trenutne procjene usklađenosti ispitivanja opreme iznosi {eqCompliance}%.',
    sec4_prio: 'Apsolutni prioritet za ispitivanje:',
    sec4_prioDesc: 'Sljedeća oprema je prerasla svoj rok obveznog atestiranja/ispitivanja i ne bi se trebala koristiti dok se isto ne obnovi:',
    th_eqName: 'Naziv opreme',
    th_eqSerial: 'Serijski br. / Id',
    th_eqLocation: 'Lokacija',
    th_eqExpiry: 'Datum isteka ispitivanja',
    sec4_ok: 'Nema opreme kojoj je rok obveznog pregleda istekao. Sva radna sredstva su opremljena važećim uporabnim dozvolama.',
    sig1_title: 'Za poslodavca / Direktor',
    sig1_line: 'M.P. i Potpis',
    sig2_title: 'Sastavio (Stručnjak ZNR)',
    sig2_line: 'Potpis'
  },
  en: {
    employer: 'Employer:',
    dateOfMake: 'Date generated:',
    place: 'Location:',
    title: 'Annual Occupational Safety Report',
    sec1: '1. General Data',
    sec1_text: 'As of {dateFormatted}, the employer {companyName} has a total of {activeWorkersLength} active workers according to the OSH Information System records. The system continuously monitors the validity of trainings, medical certificates, equipment assessments, and injury records to ensure optimal risk prevention and compliance with the Occupational Safety Act.',
    sec2: '2. Work Injuries and Diseases (Last 12 Months)',
    sec2_incidents: 'In the past 12 months, {last12mLength} incidents were recorded.',
    sec2_noIncidents: ' Given that no incidents were reported in the specified period, the condition is assessed as exceptionally favorable.',
    th_date: 'Date',
    th_worker: 'Worker',
    th_incType: 'Incident Type',
    openLeave: '(Open Medical Leave)',
    sec3: '3. Human Resources Records (Certificates & Medical)',
    sec3_warnings: 'Deadline expiration warnings: A total of {expiredMedLength} overdue medical exams and {expiredCertsLength} expired certificates/trainings have been detected. A detailed list of individuals subject to this warning is provided in the tables below. It is imperative to direct these individuals to renew their periodic checks as soon as possible.',
    expiredMedTitle: 'Expired Medical Exams:',
    th_name: 'Full Name',
    th_examType: 'Exam Type',
    th_expiredOn: 'Expired On',
    expiredCertsTitle: 'Expired Mandatory Certificates (Safety, Fire, etc.):',
    th_certType: 'Certificate Type',
    sec3_note: 'Note: There are certificates and exams expiring in the next 30 days (Medical: {expiringSoonMedLength}, Certificates: {expiringSoonCertsLength}). Supervisors must take planning actions.',
    sec4: '4. Equipment and Facility Status',
    sec4_text: 'There are {totalEquipment} pieces of work equipment, devices, and installations recorded in the employer facilities. The current equipment testing compliance rate is {eqCompliance}%.',
    sec4_prio: 'Absolute testing priority:',
    sec4_prioDesc: 'The following equipment has exceeded its mandatory testing/certification deadline and should not be used until renewed:',
    th_eqName: 'Equipment Name',
    th_eqSerial: 'Serial No. / ID',
    th_eqLocation: 'Location',
    th_eqExpiry: 'Testing Expiry Date',
    sec4_ok: 'No equipment has expired mandatory inspection deadlines. All work assets are equipped with valid usage permits.',
    sig1_title: 'For Employer / Director',
    sig1_line: 'Stamp & Signature',
    sig2_title: 'Prepared by (OSH Expert)',
    sig2_line: 'Signature'
  }
};

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
    lang = 'bs',
    companyLogo = null
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

    const tLocal = REPORT_TEXT[lang] || REPORT_TEXT.bs;

    return (
        <div style={styles.container} className="printable-report">
            <div style={styles.header}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <strong>{tLocal.employer}</strong> {companyName}<br />
                        <strong>{tLocal.dateOfMake}</strong> {dateFormatted}<br />
                        <strong>{tLocal.place}</strong> _____________________
                    </div>
                    {companyLogo && (
                        <img src={companyLogo} alt="Logo" style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain' }} />
                    )}
                </div>
            </div>

            <div style={styles.title}>
                {tLocal.title}
            </div>

            <div style={styles.h2}>{tLocal.sec1}</div>
            <div style={styles.p}>
                {tLocal.sec1_text
                    .replace('{dateFormatted}', dateFormatted)
                    .replace('{companyName}', companyName)
                    .replace('{activeWorkersLength}', activeWorkers.length)}
            </div>

            <div style={styles.h2}>{tLocal.sec2}</div>
            <div style={styles.p}>
                {tLocal.sec2_incidents.replace('{last12mLength}', last12m.length)}
                {last12m.length === 0 ? tLocal.sec2_noIncidents : ''}
            </div>
            {last12m.length > 0 && (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>{tLocal.th_date}</th>
                            <th style={styles.th}>{tLocal.th_worker}</th>
                            <th style={styles.th}>{tLocal.th_incType}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {last12m.map((i, index) => (
                            <tr key={index}>
                                <td style={styles.td}>{formatDate(i.datum)}</td>
                                <td style={styles.td}>{i.radnikIme || workerMap[i.workerId] || 'Nepoznato'}</td>
                                <td style={styles.td}>{i.tip} {i.bolovanje ? tLocal.openLeave : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            <div style={styles.h2}>{tLocal.sec3}</div>
            <div style={styles.p}>
                <strong>{tLocal.sec3_warnings.split(':')[0]}:</strong> {tLocal.sec3_warnings.split(':')[1]
                    .replace('{expiredMedLength}', expiredMed.length)
                    .replace('{expiredCertsLength}', expiredCerts.length)}
            </div>

            {expiredMed.length > 0 && (
                <>
                    <strong>{tLocal.expiredMedTitle}</strong>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>{tLocal.th_name}</th>
                                <th style={styles.th}>{tLocal.th_examType}</th>
                                <th style={styles.th}>{tLocal.th_expiredOn}</th>
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
                    <strong>{tLocal.expiredCertsTitle}</strong>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>{tLocal.th_name}</th>
                                <th style={styles.th}>{tLocal.th_certType}</th>
                                <th style={styles.th}>{tLocal.th_expiredOn}</th>
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
                    <em>{tLocal.sec3_note
                        .replace('{expiringSoonMedLength}', expiringSoonMed.length)
                        .replace('{expiringSoonCertsLength}', expiringSoonCerts.length)}</em>
                </div>
            )}

            <div style={styles.h2}>{tLocal.sec4}</div>
            <div style={styles.p}>
                {tLocal.sec4_text
                    .replace('{totalEquipment}', totalEquipment)
                    .replace('{eqCompliance}', eqCompliance)}
            </div>

            {expiredEq.length > 0 ? (
                <>
                    <div style={styles.p}>
                        <strong style={{ color: 'red' }}>{tLocal.sec4_prio}</strong> {tLocal.sec4_prioDesc}
                    </div>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>{tLocal.th_eqName}</th>
                                <th style={styles.th}>{tLocal.th_eqSerial}</th>
                                <th style={styles.th}>{tLocal.th_eqLocation}</th>
                                <th style={styles.th}>{tLocal.th_eqExpiry}</th>
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
                    {tLocal.sec4_ok}
                </div>
            )}

            <div style={styles.footer}>
                <div>
                    <div>{tLocal.sig1_title}</div>
                    <div style={styles.signLine}>{tLocal.sig1_line}</div>
                </div>
                <div>
                    <div>{tLocal.sig2_title}</div>
                    <div style={styles.signLine}>{tLocal.sig2_line}</div>
                </div>
            </div>
        </div>
    );
}
