'use client';

import { LAWS, getArticleWord } from '@/lib/lawConfig';
import { t as _t } from '@/i18n/translations';

// Dictionary mapping document labels for 6 languages
const ZOS_T = {
    bs: {
        title: 'Zapisnik o ocjeni osposobljenosti<br>radnika za rad na siguran način',
        subtitle: 'Obrazac ZOS — u skladu sa {0} ("{1}")',
        refNum: 'Broj:',
        date: 'Datum:',
        sec1Title: 'I. Podaci o radniku',
        workerName: 'Ime i prezime:',
        jmbg: 'JMBG:',
        oib: 'OIB / ID broj radnika:',
        workplace: 'Radno mjesto:',
        sec2Title: 'II. Podaci o osposobljavanju',
        theoreticalPart: 'Teoretski dio osposobljavanja:',
        location: 'Mjesto provođenja:',
        trainingDate: 'Datum osposobljavanja:',
        testResult: 'Rezultat provjere znanja:',
        officer: 'Stručnjak zaštite na radu:',
        sec3Title: 'III. Ocjena teoretskog dijela osposobljavanja',
        assessmentText: 'Stručnjak zaštite na radu ocjenjuje da je radnik <strong>{0}</strong> u teoretskom dijelu <strong>osposobljen</strong> za rad na siguran način za poslove radnog mjesta <strong>{1}</strong>, na koje je raspoređen/a.',
        legalText: 'Tijekom osposobljavanja radnik je upoznat sa: tehničko-tehnološkim procesom rada, opasnostima koje ugrožavaju sigurnost na radu, pravilnim korištenjem sredstava rada i zaštitne opreme, mjerama zaštite na radu, te pravima i dužnostima u provođenju propisa zaštite na radu ({0} {1}. {2}).',
        sec4Title: 'IV. Provjera praktične osposobljenosti',
        checklistPreamble: 'Neposredni ovlaštenik poslodavca i stručnjak ZNR potvrđuju da radnik:',
        checkItems: [
            'Prije početka rada pregleda radno mjesto te o uočenim nedostacima izvještava poslodavca ili ovlaštenika',
            'Pravilno koristi sredstva rada (radnu opremu) u skladu sa uputama proizvođača',
            'Pravilno koristi propisanu osobnu zaštitnu opremu (OZO) i vraća na za to određeno mjesto',
            'Ne isključuje, ne vrši preinake i ne uklanja zaštite na sredstvima rada',
            'Odmah obavještava poslodavca/ovlaštenika o situacijama s rizikom za sigurnost i zdravlje',
            'Posao obavlja u skladu s pravilima zaštite na radu, struke te uputama poslodavca',
            'Prije odlaska ostavlja sredstva rada u stanju koje ne ugrožava ostale radnike',
            'Surađuje sa stručnjakom ZNR, specijalistom medicine rada i povjerenikom za ZNR'
        ],
        sec5Title: 'V. Zaključna ocjena',
        conclusionText: 'Na osnovu provedenog teoretskog i praktičnog osposobljavanja, ocjenjuje se da je radnik/ca<br><strong style="font-size:12pt;">{0}</strong><br><strong>OSPOSOBLJEN/A</strong> za rad na siguran način<br>na poslovima radnog mjesta: <strong>{1}</strong>',
        roleWorker: 'Osposobljeni radnik',
        sigWorker: '(potpis radnika)',
        roleEmployer: 'Neposredni ovlaštenik poslodavca',
        sigEmployer: '(potpis ovlaštenika)',
        roleOfficer: 'Stručnjak zaštite na radu',
        sigOfficer: '(potpis stručnjaka ZNR)',
        footerText: 'Ovaj zapisnik se čuva trajno u evidencijama poslodavca i predočava inspektoru rada na zahtjev.'
    },
    hr: {
        title: 'Zapisnik o ocjeni osposobljenosti<br>radnika za rad na siguran način',
        subtitle: 'Obrazac ZOS — u skladu sa {0} ("{1}")',
        refNum: 'Broj:',
        date: 'Datum:',
        sec1Title: 'I. Podaci o radniku',
        workerName: 'Ime i prezime:',
        jmbg: 'JMBG:',
        oib: 'OIB / Osobni identifikacijski broj:',
        workplace: 'Radno mjesto:',
        sec2Title: 'II. Podaci o osposobljavanju',
        theoreticalPart: 'Teoretski dio osposobljavanja:',
        location: 'Mjesto provođenja:',
        trainingDate: 'Datum osposobljavanja:',
        testResult: 'Rezultat provjere znanja:',
        officer: 'Stručnjak zaštite na radu:',
        sec3Title: 'III. Ocjena teoretskog dijela osposobljavanja',
        assessmentText: 'Stručnjak zaštite na radu ocjenjuje da je radnik <strong>{0}</strong> u teoretskom dijelu <strong>osposobljen</strong> za rad na siguran način za poslove radnog mjesta <strong>{1}</strong>, na koje je raspoređen/a.',
        legalText: 'Tijekom osposobljavanja radnik je upoznat sa: tehničko-tehnološkim procesom rada, opasnostima koje ugrožavaju sigurnost na radu, pravilnim korištenjem sredstava rada i zaštitne opreme, mjerama zaštite na radu, te pravima i dužnostima u provođenju propisa zaštite na radu ({0} {1}. {2}).',
        sec4Title: 'IV. Provjera praktične osposobljenosti',
        checklistPreamble: 'Neposredni ovlaštenik poslodavca i stručnjak ZNR potvrđuju da radnik:',
        checkItems: [
            'Prije početka rada pregleda radno mjesto te o uočenim nedostacima izvještava poslodavca ili ovlaštenika',
            'Pravilno koristi sredstva rada (radnu opremu) u skladu sa uputama proizvođača',
            'Pravilno koristi propisanu osobnu zaštitnu opremu (OZO) i vraća na za to određeno mjesto',
            'Ne isključuje, ne vrši preinake i ne uklanja zaštite na sredstvima rada',
            'Odmah obavještava poslodavca/ovlaštenika o situacijama s rizikom za sigurnost i zdravlje',
            'Posao obavlja u skladu s pravilima zaštite na radu, struke te uputama poslodavca',
            'Prije odlaska ostavlja sredstva rada u stanju koje ne ugrožava ostale radnike',
            'Surađuje sa stručnjakom ZNR, specijalistom medicine rada i povjerenikom za ZNR'
        ],
        sec5Title: 'V. Zaključna ocjena',
        conclusionText: 'Na osnovu provedenog teoretskog i praktičnog osposobljavanja, ocjenjuje se da je radnik/ca<br><strong style="font-size:12pt;">{0}</strong><br><strong>OSPOSOBLJEN/A</strong> za rad na siguran način<br>na poslovima radnog mjesta: <strong>{1}</strong>',
        roleWorker: 'Osposobljeni radnik',
        sigWorker: '(potpis radnika)',
        roleEmployer: 'Neposredni ovlaštenik poslodavca',
        sigEmployer: '(potpis ovlaštenika)',
        roleOfficer: 'Stručnjak zaštite na radu',
        sigOfficer: '(potpis stručnjaka ZNR)',
        footerText: 'Ovaj zapisnik se čuva trajno u evidencijama poslodavca i predočava inspektoru rada na zahtjev.'
    },
    sr: {
        title: 'Zapisnik o oceni osposobljenosti<br>radnika za bezbedan rad',
        subtitle: 'Obrazac ZOS — u skladu sa {0} ("{1}")',
        refNum: 'Broj:',
        date: 'Datum:',
        sec1Title: 'I. Podaci o radniku',
        workerName: 'Ime i prezime:',
        jmbg: 'JMBG:',
        oib: 'OIB / ID broj radnika:',
        workplace: 'Radno mesto:',
        sec2Title: 'II. Podaci o osposobljavanju',
        theoreticalPart: 'Teoretski deo osposobljavanja:',
        location: 'Mesto sprovođenja:',
        trainingDate: 'Datum osposobljavanja:',
        testResult: 'Rezultat provere znanja:',
        officer: 'Stručnjak za bezbednost i zdravlje na radu:',
        sec3Title: 'III. Ocena teoretskog dela osposobljavanja',
        assessmentText: 'Stručnjak za bezbednost i zdravlje na radu ocenjuje da je radnik <strong>{0}</strong> u teoretskom delu <strong>osposobljen</strong> za bezbedan rad za poslove radnog mesta <strong>{1}</strong>, na koje je raspoređen/a.',
        legalText: 'Tokom osposobljavanja radnik je upoznat sa: tehničko-tehnološkim procesom rada, opasnostima koje ugrožavaju bezbednost na radu, pravilnim korišćenjem sredstava rada i zaštitne opreme, merama bezbednosti na radu, te pravima i dužnostima u sprovođenju propisa bezbednosti na radu ({0} {1}. {2}).',
        sec4Title: 'IV. Provera praktične osposobljenosti',
        checklistPreamble: 'Neposredni ovlašćeni predstavnik poslodavca i stručnjak za BZN potvrđuju da radnik:',
        checkItems: [
            'Pre početka rada pregleda radno mesto te o uočenim nedostacima izveštava poslodavca ili ovlašćenog predstavnika',
            'Pravilno koristi sredstva rada (radnu opremu) u skladu sa uputstvima proizvođača',
            'Pravilno koristi propisanu ličnu zaštitnu opremu (LZO) i vraća je na za to određeno mesto',
            'Ne isključuje, ne vrši prepravke i ne uklanja zaštite na sredstvima rada',
            'Odmah obaveštava poslodavca/ovlašćenog predstavnika o situacijama sa rizikom po bezbednost i zdravlje',
            'Posao obavlja u skladu sa pravilima bezbednosti na radu, struke te uputstvima poslodavca',
            'Pre odlaska ostavlja sredstva rada u stanju koje ne ugrožava ostale radnike',
            'Sarađuje sa stručnjakom za BZN, specijalistom medicine rada i poverenikom za BZN'
        ],
        sec5Title: 'V. Zaključna ocena',
        conclusionText: 'Na osnovu sprovedenog teoretskog i praktičnog osposobljavanja, ocenjuje se da je radnik/ca<br><strong style="font-size:12pt;">{0}</strong><br><strong>OSPOSOBLJEN/A</strong> za bezbedan rad<br>na poslovima radnog mesta: <strong>{1}</strong>',
        roleWorker: 'Osposobljeni radnik',
        sigWorker: '(potpis radnika)',
        roleEmployer: 'Neposredni ovlašćeni predstavnik poslodavca',
        sigEmployer: '(potpis ovlašćenog predstavnika)',
        roleOfficer: 'Stručnjak za bezbednost i zdravlje na radu',
        sigOfficer: '(potpis stručnjaka za BZN)',
        footerText: 'Ovaj zapisnik se čuva trajno u evidencijama poslodavca i predočava inspektoru rada na zahtev.'
    },
    en: {
        title: 'Report on Safety Training<br>and Workplace Qualification Assessment',
        subtitle: 'ZOS Form — in accordance with {0} ("{1}")',
        refNum: 'Number:',
        date: 'Date:',
        sec1Title: 'I. Worker Data',
        workerName: 'Full Name:',
        jmbg: 'National ID (JMBG/OIB):',
        oib: 'Worker ID Number:',
        workplace: 'Workplace / Position:',
        sec2Title: 'II. Training Details',
        theoreticalPart: 'Theoretical Part of Training:',
        location: 'Location:',
        trainingDate: 'Training Date:',
        testResult: 'Knowledge Test Score:',
        officer: 'Safety Officer / Specialist:',
        sec3Title: 'III. Theoretical Knowledge Evaluation',
        assessmentText: 'The safety officer evaluates that the worker <strong>{0}</strong> has been <strong>qualified</strong> in the theoretical part of safety at work for the duties of the position <strong>{1}</strong> to which they are assigned.',
        legalText: 'During the training, the worker was introduced to: technical and technological processes, safety hazards, proper use of work equipment and personal protective equipment, safety measures, and rights and duties under safety laws ({0} {1}. {2}).',
        sec4Title: 'IV. Practical Ability Assessment',
        checklistPreamble: 'The employer representative and the safety officer confirm that the worker:',
        checkItems: [
            'Inspects the workplace before starting work and reports any observed deficiencies',
            'Uses work equipment correctly and in accordance with manufacturer instructions',
            'Correctly uses prescribed personal protective equipment (PPE) and returns it to the designated area',
            'Does not disable, modify, or remove protective guards on work equipment',
            'Immediately informs the employer of situations posing a risk to safety and health',
            'Performs work in accordance with safety rules, professional standards, and employer instructions',
            'Leaves work equipment in a safe condition before leaving so as not to endanger others',
            'Cooperates with the safety specialist, occupational health doctor, and safety representative'
        ],
        sec5Title: 'V. Final Assessment',
        conclusionText: 'Based on the theoretical and practical training conducted, the worker<br><strong style="font-size:12pt;">{0}</strong><br>is evaluated as <strong>QUALIFIED / FIT</strong> for safe work<br>at the workplace: <strong>{1}</strong>',
        roleWorker: 'Trained Worker',
        sigWorker: '(worker signature)',
        roleEmployer: 'Direct Employer Representative',
        sigEmployer: '(representative signature)',
        roleOfficer: 'Safety Officer',
        sigOfficer: '(safety officer signature)',
        footerText: 'This record is permanently archived in the employer\'s records and presented to the labor inspector upon request.'
    },
    de: {
        title: 'Protokoll über die Beurteilung der Befähigung<br>des Arbeitnehmers für sicheres Arbeiten',
        subtitle: 'ZOS-Formular — gemäß {0} ("{1}")',
        refNum: 'Nummer:',
        date: 'Datum:',
        sec1Title: 'I. Mitarbeiterdaten',
        workerName: 'Name, Vorname:',
        jmbg: 'National ID / Registernummer:',
        oib: 'Mitarbeiter-ID Nummer:',
        workplace: 'Arbeitsplatz / Stelle:',
        sec2Title: 'II. Angaben zur Schulung',
        theoreticalPart: 'Theoretischer Teil der Schulung:',
        location: 'Durchführungsort:',
        trainingDate: 'Schulungsdatum:',
        testResult: 'Wissenstest Ergebnis:',
        officer: 'Fachkraft für Arbeitssicherheit:',
        sec3Title: 'III. Beurteilung der theoretischen Befähigung',
        assessmentText: 'Die Fachkraft für Arbeitssicherheit beurteilt, dass der Arbeitnehmer <strong>{0}</strong> im theoretischen Teil für sicheres Arbeiten am Arbeitsplatz <strong>{1}</strong> <strong>befähigt</strong> ist.',
        legalText: 'Während der Schulung wurde der Arbeitnehmer vertraut gemacht mit: technologischen Prozessen, Sicherheitsrisiken, ordnungsgemäßer Verwendung von Arbeitsmitteln und PSA, Sicherheitsmaßnahmen sowie Rechten und Pflichten nach den Arbeitsschutzgesetzen ({0} {1}. {2}).',
        sec4Title: 'IV. Überprüfung der praktischen Befähigung',
        checklistPreamble: 'Der direkte Vorgesetzte des Arbeitgebers und die Fachkraft für Arbeitssicherheit bestätigen, dass der Arbeitnehmer:',
        checkItems: [
            'Vor Arbeitsbeginn den Arbeitsplatz prüft und Mängel meldet',
            'Arbeitsmittel ordnungsgemäß gemäß Herstelleranleitung verwendet',
            'Die vorgeschriebene persönliche Schutzausrüstung (PSA) richtig verwendet und zurücklegt',
            'Schutzvorrichtungen an Arbeitsmitteln nicht deaktiviert, verändert oder entfernt',
            'Den Arbeitgeber unverzüglich über Situationen mit Sicherheits- oder Gesundheitsrisiken informiert',
            'Die Arbeit in Übereinstimmung mit Arbeitsschutzregeln, Fachstandards und Anweisungen ausführt',
            'Die Arbeitsmittel vor dem Verlassen in einem sicheren Zustand hinterlässt',
            'Mit der Fachkraft für Arbeitssicherheit, dem Betriebsarzt und dem Sicherheitsbeauftragten kooperiert'
        ],
        sec5Title: 'V. Abschließende Beurteilung',
        conclusionText: 'Basierend auf der durchgeführten theoretischen und praktischen Schulung wird der Arbeitnehmer<br><strong style="font-size:12pt;">{0}</strong><br>als <strong>BEFÄHIGT</strong> für sicheres Arbeiten beurteilt<br>am Arbeitsplatz: <strong>{1}</strong>',
        roleWorker: 'Geschulter Mitarbeiter',
        sigWorker: '(Unterschrift des Mitarbeiters)',
        roleEmployer: 'Direkter Vertreter des Arbeitgebers',
        sigEmployer: '(Unterschrift des Vertreters)',
        roleOfficer: 'Fachkraft für Arbeitssicherheit',
        sigOfficer: '(Unterschrift der Fachkraft)',
        footerText: 'Dieses Protokoll wird dauerhaft in den Unterlagen des Arbeitgebers aufbewahrt und der Arbeitsaufsichtsbehörde auf Verlangen vorgelegt.'
    },
    sl: {
        title: 'Zapisnik o oceni usposobljenosti<br>delavca za varno delo',
        subtitle: 'Obrazec ZOS — v skladu z {0} ("{1}")',
        refNum: 'Številka:',
        date: 'Datum:',
        sec1Title: 'I. Podatki o delavcu',
        workerName: 'Ime in priimek:',
        jmbg: 'EMŠO / Davčna številka:',
        oib: 'OIB / Identifikacijska številka delavca:',
        workplace: 'Delovno mesto:',
        sec2Title: 'II. Podatki o usposabljanju',
        theoreticalPart: 'Teoretični del usposabljanja:',
        location: 'Kraj izvajanja:',
        trainingDate: 'Datum usposabljanja:',
        testResult: 'Rezultat preizkusa znanja:',
        officer: 'Strokovni delavec za varnost pri delu:',
        sec3Title: 'III. Ocena teoretičnega dela usposabljanja',
        assessmentText: 'Strokovni delavec za varnost pri delu ocenjuje, da je delavec <strong>{0}</strong> v teoretičnem delu <strong>usposobljen</strong> za varno delo na delovnem mestu <strong>{1}</strong>, na katerega je razporejen.',
        legalText: 'Med usposabljanjem je bil delavec seznanjen s: tehnično-tehnološkim procesom dela, nevarnostmi, ki ogrožajo varnost pri delu, pravilno uporabo delovne opreme in osebne varovalne opreme, varnostnimi ukrepi ter pravicami in dolžnostmi pri izvajanju predpisov o varnosti pri delu ({0} {1}. {2}).',
        sec4Title: 'IV. Preverjanje praktične usposobljenosti',
        checklistPreamble: 'Neposredni pooblaščenec delodajalca in strokovni delavec potrjujeta, da delavec:',
        checkItems: [
            'Pred začetkom dela pregleda delovno mesto in o ugotovljenih pomanjkljivostih poroča delodajalcu ali pooblaščencu',
            'Pravilno uporablja delovno opremo v skladu z navodili proizvajalca',
            'Pravilno uporablja predpisano osebno varovalno opremo (OVO) in jo vrača na določeno mesto',
            'Ne izklaplja, spreminja ali odstranjuje zaščitnih naprav na delovni opremi',
            'Takoj obvesti delodajalca/pooblaščenca o situacijah z neposrednim tveganjem za varnost in zdravje',
            'Delo opravlja v skladu s pravili o varnosti pri delu, stroke in navodili delodajalca',
            'Pred odhodom zapusti delovno opremo v stanju, ki ne ogroža ostalih delavcev',
            'Sodeluje s strokovnim delavcem za varnost, zdravnikom medicine dela in pooblaščencem za varnost pri delu'
        ],
        sec5Title: 'V. Končna ocena',
        conclusionText: 'Na podlagi opravljenega teoretičnega in praktičnega usposabljanja se ocenjuje, da je delavec/ka<br><strong style="font-size:12pt;">{0}</strong><br><strong>USPOSOBLJEN/A</strong> za varno delo<br>na delovnem mestu: <strong>{1}</strong>',
        roleWorker: 'Usposobljeni delavec',
        sigWorker: '(podpis delavca)',
        roleEmployer: 'Neposredni pooblaščenec delodajalca',
        sigEmployer: '(podpis pooblaščenca)',
        roleOfficer: 'Strokovni delavec za varnost pri delu',
        sigOfficer: '(podpis strokovnega delavca)',
        footerText: 'Ta zapisnik se trajno hrani v evidencah delodajalca in predloži inšpektorju za delo na zahtevo.'
    }
};

export function generateZosPdf({
    company,       // { naziv, adresa, mjesto, postanskiBroj, oib, direktor, strucnoLice, logo }
    worker,        // { ime, prezime, jmbg, oib, radnoMjestoId }
    workplaceName, // string
    training,      // { naziv }
    officer,       // string (stručnjak ZNR name)
    date,          // string ISO
    certOznaka,    // string e.g. ZOS-XYZ
    testResult,    // string e.g. "85%"
    lang = 'bs',   // string
}) {
    // Standardize lang code to supported set
    const activeLang = ZOS_T[lang] ? lang : 'bs';
    const tDict = ZOS_T[activeLang];

    // Select date formatter based on language
    const localeMap = { bs: 'hr-HR', hr: 'hr-HR', sr: 'sr-Latn-RS', en: 'en-US', de: 'de-DE', sl: 'sl-SI' };
    const localeCode = localeMap[activeLang] || 'hr-HR';
    const formattedDate = date ? new Date(date).toLocaleDateString(localeCode, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '__.__.____.';

    const country = company.country || 'BA';
    const osh = LAWS[country]?.osh || LAWS.BA.osh;
    const artWord = getArticleWord(country);
    const logoHtml = company.logo
        ? `<img src="${company.logo}" style="max-height:60px; max-width:180px; object-fit:contain;" />`
        : '';

    // Interpolation helpers
    const subtitleText = tDict.subtitle.replace('{0}', osh.name).replace('{1}', osh.gazette);
    const assessmentTextVal = tDict.assessmentText
        .replace('{0}', `${worker.ime || ''} ${worker.prezime || ''}`)
        .replace('{1}', workplaceName || '________________________');
    const legalTextVal = tDict.legalText
        .replace('{0}', artWord)
        .replace('{1}', osh.articles.trainingAssessment)
        .replace('{2}', osh.shortName);
    const conclusionTextVal = tDict.conclusionText
        .replace('{0}', `${worker.ime || ''} ${worker.prezime || ''}`)
        .replace('{1}', workplaceName || '________________');
    const legalRefFooter = `${artWord} ${osh.articles.training}. ${osh.name} ("${osh.gazette}")`;

    const html = `<!DOCTYPE html>
<html lang="${activeLang}">
<head>
<meta charset="UTF-8">
<title>ZOS - ${worker.ime || ''} ${worker.prezime || ''}</title>
<style>
    @page { size: A4; margin: 20mm 18mm 20mm 18mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Segoe UI', 'Arial', sans-serif;
        font-size: 11pt;
        color: #1a1a1a;
        line-height: 1.5;
        background: #fff;
    }
    .page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 0; }
    
    /* Header */
    .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 3px solid #1a365d;
        padding-bottom: 12px;
        margin-bottom: 8px;
    }
    .company-info { flex: 1; }
    .company-name { font-size: 14pt; font-weight: 800; color: #1a365d; }
    .company-details { font-size: 8.5pt; color: #555; margin-top: 3px; line-height: 1.4; }
    .logo-area { text-align: right; }
    
    /* Title */
    .doc-title {
        text-align: center;
        margin: 18px 0 6px;
        font-size: 13pt;
        font-weight: 800;
        text-transform: uppercase;
        color: #1a365d;
        letter-spacing: 0.5px;
    }
    .doc-subtitle {
        text-align: center;
        font-size: 9pt;
        color: #666;
        margin-bottom: 16px;
    }
    .doc-ref {
        text-align: center;
        font-size: 8.5pt;
        color: #888;
        margin-bottom: 20px;
    }
    
    /* Sections */
    .section { margin-bottom: 14px; }
    .section-title {
        font-size: 10pt;
        font-weight: 700;
        color: #1a365d;
        border-bottom: 1.5px solid #ddd;
        padding-bottom: 3px;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    
    /* Data table */
    .data-row {
        display: flex;
        border-bottom: 1px solid #eee;
        padding: 4px 0;
        font-size: 10pt;
    }
    .data-label {
        width: 220px;
        font-weight: 600;
        color: #444;
        flex-shrink: 0;
    }
    .data-value {
        flex: 1;
        font-weight: 400;
    }
    
    /* Checklist */
    .checklist { margin: 8px 0; }
    .check-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 3px 0;
        font-size: 9.5pt;
        line-height: 1.4;
    }
    .check-box {
        width: 14px; height: 14px;
        border: 1.5px solid #1a365d;
        border-radius: 2px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #1a365d;
        flex-shrink: 0;
        margin-top: 2px;
    }
    
    /* Assessment */
    .assessment-box {
        border: 2px solid #1a365d;
        border-radius: 6px;
        padding: 12px 16px;
        margin: 14px 0;
        background: #f7fafc;
    }
    .assessment-text {
        font-size: 10.5pt;
        font-weight: 600;
        text-align: center;
        color: #1a365d;
    }
    
    /* Signatures */
    .signatures {
        display: flex;
        justify-content: space-between;
        margin-top: 30px;
        gap: 20px;
    }
    .sig-block {
        flex: 1;
        text-align: center;
    }
    .sig-role {
        font-size: 8.5pt;
        color: #666;
        margin-bottom: 4px;
        font-weight: 600;
    }
    .sig-line {
        border-top: 1.5px solid #333;
        margin-top: 40px;
        padding-top: 4px;
        font-size: 9.5pt;
        font-weight: 600;
    }
    .sig-note {
        font-size: 7.5pt;
        color: #999;
        margin-top: 2px;
    }
    
    /* Footer */
    .footer {
        border-top: 2px solid #1a365d;
        margin-top: 20px;
        padding-top: 8px;
        font-size: 7.5pt;
        color: #999;
        text-align: center;
    }
    
    .legal-ref {
        font-size: 8pt;
        color: #888;
        font-style: italic;
        text-align: center;
        margin: 6px 0;
    }
    
    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page { page-break-after: always; }
        .no-print { display: none !important; }
    }
</style>
</head>
<body>
<div class="page">
    <!-- HEADER -->
    <div class="header">
        <div class="company-info">
            <div class="company-name">${company.naziv || '________________________________'}</div>
            <div class="company-details">
                ${company.adresa ? company.adresa + ', ' : ''}${company.mjesto || ''} ${company.postanskiBroj || ''}<br>
                ${company.oib ? (country === 'HR' ? 'OIB: ' : 'ID broj: ') + company.oib : ''}
                ${company.telefon ? ' | Tel: ' + company.telefon : ''}
                ${company.email ? ' | ' + company.email : ''}
            </div>
        </div>
        <div class="logo-area">${logoHtml}</div>
    </div>
    
    <!-- TITLE -->
    <div class="doc-title">${tDict.title}</div>
    <div class="doc-subtitle">${subtitleText}</div>
    <div class="doc-ref">${tDict.refNum} ${certOznaka || '________'} &nbsp;&nbsp;|&nbsp;&nbsp; ${tDict.date} ${formattedDate}</div>
    
    <!-- SECTION 1: WORKER DATA -->
    <div class="section">
        <div class="section-title">${tDict.sec1Title}</div>
        <div class="data-row"><span class="data-label">${tDict.workerName}</span><span class="data-value">${worker.ime || ''} ${worker.prezime || ''}</span></div>
        <div class="data-row"><span class="data-label">${tDict.jmbg}</span><span class="data-value">${worker.jmbg || '________________________'}</span></div>
        <div class="data-row"><span class="data-label">${tDict.oib}</span><span class="data-value">${worker.oib || '________________________'}</span></div>
        <div class="data-row"><span class="data-label">${tDict.workplace}</span><span class="data-value">${workplaceName || '________________________'}</span></div>
    </div>
    
    <!-- SECTION 2: TRAINING DATA -->
    <div class="section">
        <div class="section-title">${tDict.sec2Title}</div>
        <div class="data-row"><span class="data-label">${tDict.theoreticalPart}</span><span class="data-value">${training?.naziv || '________________________'}</span></div>
        <div class="data-row"><span class="data-label">${tDict.location}</span><span class="data-value">${company.adresa || ''}, ${company.mjesto || ''}</span></div>
        <div class="data-row"><span class="data-label">${tDict.trainingDate}</span><span class="data-value">${formattedDate}</span></div>
        <div class="data-row"><span class="data-label">${tDict.testResult}</span><span class="data-value">${testResult || '________'}</span></div>
        <div class="data-row"><span class="data-label">${tDict.officer}</span><span class="data-value">${officer || '________________________'}</span></div>
    </div>
    
    <!-- SECTION 3: THEORETICAL ASSESSMENT -->
    <div class="section">
        <div class="section-title">${tDict.sec3Title}</div>
        <p style="font-size:9.5pt; margin-bottom:6px; color:#333;">
            ${assessmentTextVal}
        </p>
        <p style="font-size:9pt; color:#666;">
            ${legalTextVal}
        </p>
    </div>
    
    <!-- SECTION 4: PRACTICAL ASSESSMENT CHECKLIST -->
    <div class="section">
        <div class="section-title">${tDict.sec4Title}</div>
        <p style="font-size:9pt; color:#666; margin-bottom:8px;">
            ${tDict.checklistPreamble}
        </p>
        <div class="checklist">
            ${tDict.checkItems.map(item => `
                <div class="check-item"><span class="check-box">✓</span> ${item}</div>
            `).join('')}
        </div>
    </div>
    
    <!-- SECTION 5: FINAL ASSESSMENT -->
    <div class="section">
        <div class="section-title">${tDict.sec5Title}</div>
        <div class="assessment-box">
            <div class="assessment-text">
                ${conclusionTextVal}
            </div>
        </div>
    </div>
    
    <div class="legal-ref">
        ${legalRefFooter}
    </div>
    
    <!-- SIGNATURES -->
    <div class="signatures">
        <div class="sig-block">
            <div class="sig-role">${tDict.roleWorker}</div>
            <div class="sig-line">${worker.ime || ''} ${worker.prezime || ''}</div>
            <div class="sig-note">${tDict.sigWorker}</div>
        </div>
        <div class="sig-block">
            <div class="sig-role">${tDict.roleEmployer}</div>
            <div class="sig-line">${company.direktor || '________________________'}</div>
            <div class="sig-note">${tDict.sigEmployer}</div>
        </div>
        <div class="sig-block">
            <div class="sig-role">${tDict.roleOfficer}</div>
            <div class="sig-line">${officer || '________________________'}</div>
            <div class="sig-note">${tDict.sigOfficer}</div>
        </div>
    </div>
    
    <!-- FOOTER -->
    <div class="footer">
        ${company.naziv || ''} &nbsp;|&nbsp; ${company.adresa || ''}, ${company.mjesto || ''} &nbsp;|&nbsp; ${certOznaka || ''} &nbsp;|&nbsp; ${formattedDate}
        <br>${tDict.footerText}
    </div>
</div>
</body>
</html>`;

    return html;
}

/**
 * Opens a new window with the ZOS document and triggers print
 */
export function printZosPdf(params, lang = 'bs') {
    const html = generateZosPdf({ ...params, lang });
    const printWindow = window.open('', '_blank', 'width=800,height=1100');
    if (!printWindow) {
        alert(_t('allowPopupsPrint', lang));
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for images (logo) to load before printing
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}
