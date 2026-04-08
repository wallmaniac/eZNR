'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';

// ─── App knowledge base for the AI system prompt ───────────────────────────
const APP_KNOWLEDGE = {
    pages: [
        { path: '/dashboard', label_bs: 'Kontrolna ploča', label_en: 'Dashboard', desc_en: 'Main overview with statistics, calendar and recent activity', desc_bs: 'Pregled statistika, kalendara i nedavnih aktivnosti' },
        { path: '/dashboard/news', label_bs: 'Početna / Novosti', label_en: 'Home / News', desc_en: 'News, laws and regulations about occupational safety', desc_bs: 'Novosti, zakoni i pravilnici o zaštiti na radu' },
        { path: '/dashboard/org-units', label_bs: 'Organizacijske jedinice', label_en: 'Organizational Units', desc_en: 'Manage company departments and organizational structure', desc_bs: 'Upravljanje odjelima i organizacijskom strukturom firme' },
        { path: '/dashboard/workplaces', label_bs: 'Radna mjesta', label_en: 'Workplaces', desc_en: 'Define and manage job positions and workplaces', desc_bs: 'Definisanje i upravljanje radnim mjestima' },
        { path: '/dashboard/workers', label_bs: 'Radnici', label_en: 'Workers', desc_en: 'Manage employees: personal data, certificates, training, PPE', desc_bs: 'Upravljanje radnicima: lični podaci, uvjerenja, obuke, zaštitna oprema' },
        { path: '/dashboard/equipment', label_bs: 'Radna oprema i objekti', label_en: 'Equipment & Testing Objects', desc_en: 'Track work equipment and testing facilities with inspection records', desc_bs: 'Praćenje radne opreme i objekata ispitivanja s evidencijom pregleda' },
        { path: '/dashboard/injuries', label_bs: 'Prijava povrede na radu', label_en: 'Work Injury Report', desc_en: 'Report and document workplace injuries', desc_bs: 'Prijava i evidentiranje povreda na radu' },
        { path: '/dashboard/diseases', label_bs: 'Prijava profesionalne bolesti', label_en: 'Professional Disease Report', desc_en: 'Report professional diseases to relevant authorities', desc_bs: 'Prijava profesionalnih bolesti nadležnim organima' },
        { path: '/dashboard/form-oir1', label_bs: 'Obrazac OIR1', label_en: 'Form OIR1', desc_en: 'Official injury report form OIR1', desc_bs: 'Zvanični obrazac za prijavu povrede OIR1' },
        { path: '/dashboard/annual-injuries', label_bs: 'Godišnji izvještaj o povredama', label_en: 'Annual Injury Report', desc_en: 'Annual statistics and reporting on workplace injuries', desc_bs: 'Godišnja statistika i izvještavanje o povredama na radu' },
        { path: '/dashboard/referral-ra1', label_bs: 'Ljekarska uputnica RA1', label_en: 'Medical Referral RA1', desc_en: 'Generate RA1 medical referral forms for workers', desc_bs: 'Generisanje RA1 ljekarskih uputnica za radnike' },
        { path: '/dashboard/form-ro1', label_bs: 'Obrazac RO1', label_en: 'Form RO1', desc_en: 'RO1 report form for occupational safety', desc_bs: 'Obrazac RO1 za zaštitu na radu' },
        { path: '/dashboard/form-ro2', label_bs: 'Obrazac RO2', label_en: 'Form RO2', desc_en: 'RO2 report form for occupational safety', desc_bs: 'Obrazac RO2 za zaštitu na radu' },
        { path: '/dashboard/night-work', label_bs: 'Uputnica za noćni rad', label_en: 'Night Work Referral', desc_en: 'Medical referrals and records for night shift workers', desc_bs: 'Ljekarske uputnice i evidencija za radnike na noćnoj smjeni' },
        { path: '/dashboard/archive', label_bs: 'Digitalna arhiva', label_en: 'Digital Archive', desc_en: 'Store and manage all company documents digitally', desc_bs: 'Čuvanje i upravljanje svim dokumentima firme digitalno' },
        { path: '/dashboard/requests', label_bs: 'Zahtjevnice', label_en: 'Requests', desc_en: 'Manage procurement and material requests', desc_bs: 'Upravljanje zahtjevnicama za nabavku i materijal' },
        { path: '/dashboard/risk-assessment', label_bs: 'Procjena rizika', label_en: 'Risk Assessment', desc_en: 'Perform and document workplace risk assessments', desc_bs: 'Provođenje i dokumentovanje procjene rizika na radnom mjestu' },
        { path: '/dashboard/questionnaires', label_bs: 'Upitnici/Ankete', label_en: 'Questionnaires/Surveys', desc_en: 'Create and manage safety questionnaires for workers', desc_bs: 'Kreiranje i upravljanje sigurnosnim upitnicima za radnike' },
        { path: '/dashboard/countries', label_bs: 'Države', label_en: 'Countries', desc_en: 'Reference list of countries', desc_bs: 'Referentna lista država' },
        { path: '/dashboard/counties', label_bs: 'Županije/Kantoni', label_en: 'Counties/Cantons', desc_en: 'Reference list of counties and cantons in BiH', desc_bs: 'Referentna lista županija i kantona u BiH' },
        { path: '/dashboard/places', label_bs: 'Mjesta', label_en: 'Places', desc_en: 'Reference list of cities and places', desc_bs: 'Referentna lista gradova i mjesta' },
        { path: '/dashboard/org-groups', label_bs: 'Grupe org. jedinica', label_en: 'Org. Unit Groups', desc_en: 'Group organizational units for easier management', desc_bs: 'Grupiranje organizacijskih jedinica za lakše upravljanje' },
        { path: '/dashboard/authorized-companies', label_bs: 'Ovlaštene firme', label_en: 'Authorized Companies', desc_en: 'Registered companies authorized for safety inspections', desc_bs: 'Registrirane ovlaštene firme za inspekcije sigurnosti' },
        { path: '/dashboard/examiners', label_bs: 'Ispitivači', label_en: 'Examiners', desc_en: 'Personnel authorized to conduct safety examinations', desc_bs: 'Osoblje ovlašteno za provođenje sigurnosnih ispitivanja' },
        { path: '/dashboard/doctors', label_bs: 'Doktori', label_en: 'Doctors', desc_en: 'Occupational medicine doctors for worker health checks', desc_bs: 'Doktori medicine rada za zdravstvene preglede radnika' },
        { path: '/dashboard/exam-types', label_bs: 'Tipovi pregleda', label_en: 'Examination Types', desc_en: 'Define types of medical and safety examinations', desc_bs: 'Definisanje tipova ljekarskih i sigurnosnih pregleda' },
        { path: '/dashboard/cert-types', label_bs: 'Tipovi uvjerenja', label_en: 'Certification Types', desc_en: 'Define types of worker certifications and training certificates', desc_bs: 'Definisanje tipova radničkih uvjerenja i certifikata obuke' },
        { path: '/dashboard/equipment-types', label_bs: 'Vrste opreme', label_en: 'Equipment Types', desc_en: 'Categorize work equipment and testing objects', desc_bs: 'Kategorizacija radne opreme i objekata ispitivanja' },
        { path: '/dashboard/ppe', label_bs: 'Zaštitna oprema (PPE)', label_en: 'Personal Protective Equipment', desc_en: 'Catalog of personal protective equipment items', desc_bs: 'Katalog osobnih zaštitnih sredstava' },
        { path: '/dashboard/file-types', label_bs: 'Vrsta datoteke', label_en: 'File Types', desc_en: 'Define file type categories for the digital archive', desc_bs: 'Definisanje kategorija vrsta datoteka za digitalnu arhivu' },
        { path: '/dashboard/extra-fields', label_bs: 'Dodatna polja', label_en: 'Extra Fields', desc_en: 'Add custom data fields to records', desc_bs: 'Dodavanje prilagođenih polja podataka u evidencije' },
        { path: '/dashboard/address-book', label_bs: 'Adresar', label_en: 'Address Book', desc_en: 'Contact directory of workers and companies', desc_bs: 'Adresar radnika i firmi' },
        { path: '/dashboard/worker-certificates', label_bs: 'Uvjerenja radnika', label_en: 'Worker Certificates', desc_en: 'List and track all worker training certificates and expiry dates', desc_bs: 'Lista i praćenje svih uvjerenja radnika i datuma isteka' },
        { path: '/dashboard/worker-ppe', label_bs: 'Zaštitna oprema radnika', label_en: 'Worker PPE', desc_en: 'Track PPE assigned to each worker', desc_bs: 'Praćenje zaštitne opreme dodijeljene svakom radniku' },
        { path: '/dashboard/workplace-list', label_bs: 'Popis radnih mjesta', label_en: 'Workplace List', desc_en: 'Report listing all workplaces and their details', desc_bs: 'Izvještaj sa popisom svih radnih mjesta i njihovim detaljima' },
        { path: '/dashboard/injury-list', label_bs: 'Popis povreda', label_en: 'Injury List', desc_en: 'Full list of recorded workplace injuries', desc_bs: 'Cjeloviti popis evidentiranih povreda na radu' },
        { path: '/dashboard/training-book', label_bs: 'Matična knjiga osposobljavanja', label_en: 'Training Master Book', desc_en: 'Official training records for all workers', desc_bs: 'Zvanična evidencija obuke za sve radnike' },
        { path: '/dashboard/ek-workers', label_bs: 'EK - Radnici', label_en: 'EK - Workers', desc_en: 'Worker records exported for EK format', desc_bs: 'Evidencija radnika u EK formatu' },
        { path: '/dashboard/ek-equipment', label_bs: 'EK - Oprema', label_en: 'EK - Equipment', desc_en: 'Equipment records exported for EK format', desc_bs: 'Evidencija opreme u EK formatu' },
        { path: '/dashboard/equipment-exams', label_bs: 'Pregledi opreme', label_en: 'Equipment Exam List', desc_en: 'List of all scheduled and completed equipment inspections', desc_bs: 'Lista svih planiranih i izvršenih pregleda opreme' },
        { path: '/dashboard/isznr-documents', label_bs: 'ISZNR Dokumenti', label_en: 'ISZNR Documents', desc_en: 'Official documents submitted to the ISZNR system', desc_bs: 'Zvanični dokumenti predati ISZNR sistemu' },
        { path: '/dashboard/isznr-parties', label_bs: 'ISZNR Stranke', label_en: 'ISZNR Parties', desc_en: 'Parties and clients in the ISZNR system', desc_bs: 'Stranke i klijenti u ISZNR sistemu' },
        { path: '/dashboard/isznr-doc-types', label_bs: 'ISZNR Tipovi dokumenata', label_en: 'ISZNR Document Types', desc_en: 'Document type definitions for the ISZNR module', desc_bs: 'Definicije tipova dokumenata za ISZNR modul' },
        { path: '/dashboard/isznr-signing', label_bs: 'Digitalno potpisivanje', label_en: 'Digital Signing', desc_en: 'Digitally sign official documents', desc_bs: 'Digitalno potpisivanje zvaničnih dokumenata' },
        { path: '/dashboard/isznr-examiners', label_bs: 'ISZNR Ispitivači', label_en: 'ISZNR Examiners', desc_en: 'Examiners registered in the ISZNR system', desc_bs: 'Ispitivači registrirani u ISZNR sistemu' },
        { path: '/dashboard/isznr-measure-equipment', label_bs: 'Mjerna oprema', label_en: 'Measuring Equipment', desc_en: 'Calibrated measuring and testing equipment', desc_bs: 'Kalibrisana mjerna i ispitna oprema' },
        { path: '/dashboard/employer-docs', label_bs: 'Dokumentacija za poslodavca', label_en: 'Employer Documentation', desc_en: 'Mandatory employer safety documentation and periodic reviews', desc_bs: 'Obavezna sigurnosna dokumentacija poslodavca i periodični pregledi' },
        { path: '/dashboard/settings', label_bs: 'Postavke', label_en: 'Settings', desc_en: 'Application settings, user profile and company information', desc_bs: 'Postavke aplikacije, korisnički profil i podaci o firmi' },
    ],
};

// ─── Live data context builder ────────────────────────────────────────────────
function buildDataContext(lang) {
    if (typeof window === 'undefined') return '';
    try {
        const prefix = 'eznr_';
        const get = (key) => { try { return JSON.parse(localStorage.getItem(prefix + key) || '[]'); } catch { return []; } };

        const workers = get('workers');
        const injuries = get('injuries');
        const diseases = get('diseases');
        const certificates = get('certificates');
        const equipment = get('equipment');
        const questionnaires = get('questionnaires');

        const lines = [];
        const today = new Date();
        const in30 = new Date(); in30.setDate(in30.getDate() + 30);
        const in60 = new Date(); in60.setDate(in60.getDate() + 60);

        // Workers on sick leave
        const injuryBol = injuries.filter(i => i.bolovanje && i.status !== 'zatvorena').map(i => ({ name: i.radnikIme, src: 'injury' }));
        const diseaseBol = diseases.filter(d => d.bolovanje && d.status !== 'zatvorena').map(d => ({ name: d.radnikIme, src: 'disease' }));
        const allBol = [...injuryBol, ...diseaseBol].filter((b, i, arr) => b.name && arr.findIndex(x => x.name === b.name) === i);
        lines.push(lang === 'bs'
            ? `\nRADNICI NA BOLOVANJU (${allBol.length}): ${allBol.length === 0 ? 'Nema.' : allBol.map(b => `${b.name} (${b.src === 'injury' ? 'povreda' : 'bolest'})`).join(', ')}`
            : `\nWORKERS ON SICK LEAVE (${allBol.length}): ${allBol.length === 0 ? 'None.' : allBol.map(b => `${b.name} (${b.src === 'injury' ? 'injury' : 'disease'})`).join(', ')}`
        );

        // Expired certificates
        const expiredCerts = certificates.filter(c => c.vrijediDo && new Date(c.vrijediDo) < today);
        const soonCerts = certificates.filter(c => c.vrijediDo && new Date(c.vrijediDo) >= today && new Date(c.vrijediDo) <= in30);
        const workerMap = Object.fromEntries(workers.map(w => [w.id, `${w.ime} ${w.prezime}`]));
        if (expiredCerts.length > 0) {
            lines.push(lang === 'bs'
                ? `ISTEKLA UVJERENJA (${expiredCerts.length}): ${expiredCerts.slice(0, 8).map(c => `${c.ime || c.oznaka} — ${workerMap[c.radnikId] || 'N/A'} (isteklo: ${c.vrijediDo})`).join('; ')}`
                : `EXPIRED CERTIFICATES (${expiredCerts.length}): ${expiredCerts.slice(0, 8).map(c => `${c.ime || c.oznaka} — ${workerMap[c.radnikId] || 'N/A'} (expired: ${c.vrijediDo})`).join('; ')}`
            );
        }
        if (soonCerts.length > 0) {
            lines.push(lang === 'bs'
                ? `UVJERENJA KOJA USKORO ISTIČU - 30 DANA (${soonCerts.length}): ${soonCerts.slice(0, 8).map(c => `${c.ime || c.oznaka} — ${workerMap[c.radnikId] || 'N/A'} (ističe: ${c.vrijediDo})`).join('; ')}`
                : `CERTIFICATES EXPIRING SOON - 30 DAYS (${soonCerts.length}): ${soonCerts.slice(0, 8).map(c => `${c.ime || c.oznaka} — ${workerMap[c.radnikId] || 'N/A'} (expires: ${c.vrijediDo})`).join('; ')}`
            );
        }

        // Overdue equipment
        const overdueEquip = equipment.filter(e => e.iduci && new Date(e.iduci) < today);
        const soonEquip = equipment.filter(e => e.iduci && new Date(e.iduci) >= today && new Date(e.iduci) <= in60);
        if (overdueEquip.length > 0) lines.push(lang === 'bs'
            ? `OPREMA S PREKORAČENIM PREGLEDOM (${overdueEquip.length}): ${overdueEquip.slice(0, 6).map(e => `${e.naziv} (trebalo do: ${e.iduci})`).join('; ')}`
            : `EQUIPMENT WITH OVERDUE INSPECTION (${overdueEquip.length}): ${overdueEquip.slice(0, 6).map(e => `${e.naziv} (was due: ${e.iduci})`).join('; ')}`
        );
        if (soonEquip.length > 0) lines.push(lang === 'bs'
            ? `OPREMA ČIJI PREGLED USKORO DOSPIJEVA - 60 DANA (${soonEquip.length}): ${soonEquip.slice(0, 6).map(e => `${e.naziv} (do: ${e.iduci})`).join('; ')}`
            : `EQUIPMENT INSPECTION DUE SOON - 60 DAYS (${soonEquip.length}): ${soonEquip.slice(0, 6).map(e => `${e.naziv} (due: ${e.iduci})`).join('; ')}`
        );

        // Recent injuries
        const recentInj = injuries.filter(i => i.datum && new Date(i.datum) >= new Date(Date.now() - 90 * 86400000)).sort((a, b) => new Date(b.datum) - new Date(a.datum));
        if (recentInj.length > 0) lines.push(lang === 'bs'
            ? `NEDAVNE POVREDE (90 dana, ${recentInj.length}): ${recentInj.slice(0, 6).map(i => `${i.radnikIme || 'N/A'} ${i.datum} ${i.tip}${i.bolovanje ? ' BOLOVANJE' : ''}`).join('; ')}`
            : `RECENT INJURIES (90 days, ${recentInj.length}): ${recentInj.slice(0, 6).map(i => `${i.radnikIme || 'N/A'} ${i.datum} ${i.tip}${i.bolovanje ? ' SICK LEAVE' : ''}`).join('; ')}`
        );

        // ── Workers roster with workplace & org unit ──────────────────────────
        const workplaces = get('workplaces');
        const orgUnits = get('orgUnits');
        const wpMap = Object.fromEntries(workplaces.map(w => [w.id, w.naziv]));
        const ouMap = Object.fromEntries(orgUnits.map(o => [o.id, o.naziv]));

        const activeWorkerList = workers.filter(w => w.aktivan !== false);
        if (activeWorkerList.length > 0) {
            const rosterLines = activeWorkerList.map(w => {
                const wp = wpMap[w.radnoMjestoId] || wpMap[w.radnoMjesto] || '';
                const ou = ouMap[w.orgJedinicaId] || ouMap[w.orgJedinica] || '';
                return `[ID:${w.id}] ${w.ime} ${w.prezime}${wp ? ` → ${wp}` : ''}${ou ? ` (${ou})` : ''}`;
            });
            lines.push(lang === 'bs'
                ? `\nSVI AKTIVNI RADNICI (${activeWorkerList.length}) sa radnim mjestima:\n${rosterLines.join('\n')}`
                : `\nALL ACTIVE WORKERS (${activeWorkerList.length}) with positions:\n${rosterLines.join('\n')}`
            );
        }

        // ── Workplace → workers lookup (who holds each position) ─────────────
        if (workplaces.length > 0) {
            const wpWorkers = workplaces.map(wp => {
                const assigned = workers.filter(w =>
                    w.aktivan !== false &&
                    (w.radnoMjestoId === wp.id || w.radnoMjesto === wp.naziv)
                );
                if (assigned.length === 0) return null;
                return `${wp.naziv}: ${assigned.map(w => `${w.ime} ${w.prezime}`).join(', ')}`;
            }).filter(Boolean);

            if (wpWorkers.length > 0) {
                lines.push(lang === 'bs'
                    ? `\nRADNA MJESTA → RADNICI:\n${wpWorkers.join('\n')}`
                    : `\nWORKPLACES → WORKERS:\n${wpWorkers.join('\n')}`
                );
            }
        }

        // ── Org unit → workers lookup ─────────────────────────────────────────
        if (orgUnits.length > 0) {
            const ouWorkers = orgUnits.map(ou => {
                const assigned = workers.filter(w =>
                    w.aktivan !== false &&
                    (w.orgJedinicaId === ou.id || w.orgJedinica === ou.naziv)
                );
                if (assigned.length === 0) return null;
                return `${ou.naziv}: ${assigned.map(w => `${w.ime} ${w.prezime}`).join(', ')}`;
            }).filter(Boolean);

            if (ouWorkers.length > 0) {
                lines.push(lang === 'bs'
                    ? `\nORGANIZACIJSKE JEDINICE → RADNICI:\n${ouWorkers.join('\n')}`
                    : `\nORG UNITS → WORKERS:\n${ouWorkers.join('\n')}`
                );
            }
        }

        // ── Questionnaires ─────────────────────────────────────────────────────
        if (questionnaires.length > 0) {
            const qList = questionnaires.map(q => `ID:${q.id} "${q.naziv || '(bez naziva)'}"${q.zaVrstu ? ` [${q.zaVrstu}]` : ''}`).join('; ');
            lines.push(lang === 'bs'
                ? `\nUPITNICI (${questionnaires.length}): ${qList}`
                : `\nQUESTIONNAIRES (${questionnaires.length}): ${qList}`);
        }

        // Stats
        const activeWorkers = workers.filter(w => w.aktivan !== false).length;
        lines.push(lang === 'bs'
            ? `\nSTATISTIKE: ${activeWorkers} aktivnih radnika, ${equipment.length} opreme, ${certificates.length} uvjerenja, ${questionnaires.length} upitnika`
            : `\nSTATISTICS: ${activeWorkers} active workers, ${equipment.length} equipment, ${certificates.length} certificates, ${questionnaires.length} questionnaires`
        );

        return lines.join('\n');
    } catch { return ''; }
}

function buildSystemPrompt(lang, currentPath, dataContext) {
    const currentPage = APP_KNOWLEDGE.pages.find(p => p.path === currentPath);
    const pageDesc = currentPage
        ? (lang === 'bs' ? `Korisnik se trenutno nalazi na: ${currentPage.label_bs} — ${currentPage.desc_bs}` : `User is currently on: ${currentPage.label_en} — ${currentPage.desc_en}`)
        : '';

    const pagesText = APP_KNOWLEDGE.pages
        .map(p => lang === 'bs'
            ? `• ${p.label_bs} (${p.path}): ${p.desc_bs}`
            : `• ${p.label_en} (${p.path}): ${p.desc_en}`)
        .join('\n');

    const today = new Date().toLocaleDateString(lang === 'bs' ? 'bs-BA' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    if (lang === 'bs') {
        return `Ti si Zia, napredni AI AGENT za eZNR — digitalnu platformu za zaštitu na radu u Bosni i Hercegovini. Razgovaraš na bosanskom jeziku. Danas je ${today}.

NISI SAMO CHATBOT — TI SI AGENT. Možeš aktivno pomagati službenicima da izvršavaju zadatke:
- Navigirati do stranica umjesto korisnika (koristi navigate_to alat)
- Otvoriti modal za slanje upitnika (koristi open_dispatch_modal alat)
- Otvoriti formu za NOVOG RADNIKA s pre-popunjenim imenom (koristi create_new_worker alat)
- Otvoriti formu za PRIJAVU POVREDE za određenog radnika (koristi report_injury alat)
- Analizirati podatke i dati konkretne preporuke

KADA KORISTITI ALATE:
- Ako korisnik kaže "idi na", "otvori", "prikaži stranicu" → ODMAH koristi navigate_to
- Ako korisnik želi poslati upitnik → koristi open_dispatch_modal s ID-om upitnika iz ŽIVIH PODATAKA
- Ako korisnik kaže "dodaj radnika", "novi radnik", "unesi radnika" → koristi create_new_worker s imenom/prezimenom
- Ako korisnik kaže "povreda na radu", "ozljeda", "incident" za određenog radnika → koristi report_injury s podacima radnika iz ŽIVIH PODATAKA
- Ako korisnik kaže "dodaj uvjerenje", "nova potvrda", "novi pregled" za radnika → koristi add_certificate s ID-om radnika iz ŽIVIH PODATAKA i svim detaljima (tipUvjerenja, datum, vrijediDo)
- Ako korisnik navede trajanje (npr. "2 godine"), izračunaj vrijediDo = datum + trajanje i proslijeđi u alat
- Ako korisnik kaže da je radnik dobio opremu, zaštitna sredstva, kaciga, rukavice, prsluk, cipele ili slično (OZO) → koristi assign_ppe s worker_id iz ŽIVIH PODATAKA. Podrazumijevano: datum = danas, kolicina = 1, osim ako korisnik ne navede drugačije. Snima DIREKTNO — nije potrebna forma.
- Ako korisnik pita za podatke koje već imaš → odgovori direktno bez alata
- Ako korisnik traži izmjenu svih povreda na radu za neku godinu → koristi alat bulk_update_injuries

RJEČNIK POJMOVA (koristi kad korisnik pita "šta znači...?" ili kad nešto nije jasno):

PROCJENA RIZIKA:
- Nacrt = procjena se još priprema, nije finalizirana ni odobrena
- Aktivna = procjena je trenutno na snazi, važeća, primjenjuje se
- Arhivirana = zamijenjena novijom verzijom ili istekla, čuva se za historiju
- Vjerovatnoća (V) = koliko je vjerovatno da će se opasnost dogoditi (1-5 skala: 1=zanemarivo, 5=gotovo sigurno)
- Posljedica (P) = kolika bi bila šteta ako se opasnost dogodi (1-5 skala: 1=bez opasnosti, 5=smrtni ishod)
- Rizik (R) = V × P, ukupna ocjena rizika (1-25)
- Neznatan rizik (R: 1-5) = prihvatljiv, ne zahtijeva posebne mjere
- Dopustiv rizik (R: 6-10) = prihvatljiv uz praćenje i redovne kontrole
- Umjeren rizik (R: 11-15) = potrebno smanjenje rizika, planirati mjere
- Znatan rizik (R: 16-20) = neprihvatljiv, hitno potrebne mjere smanjenja
- Nedopustiv rizik (R: 21-25) = zabraniti rad dok se rizik ne smanji

DOKUMENTACIJA POSLODAVCA:
- Obavezna dokumentacija = dokumenti zakonom propisani za svakog poslodavca (akti, pravilnici, elaborati)
- Periodični pregledi = pregledi koji se redovno ponavljaju (PP aparati, hidranti, elektro instalacije)
- Dodatne evidencije = ostala neobavezna ali korisna dokumentacija
- Status Aktivan = dokument je važeći i na snazi
- Status Istekao = rok važenja dokumenta je prošao, potrebna obnova

SISTEMATIZACIJA RADNIH MJESTA:
- Sistematizacija = formalni opis svakog radnog mjesta: opis poslova, uvjeti rada, potrebna oprema, zdravstveni zahtjevi
- Posebni uvjeti = posebni zahtjevi za radno mjesto (rad na visini, buka, hemikalije)
- OZO = Osobna zaštitna oprema (kaciga, cipele, rukavice, naočale, prsluk)
- Stručna sprema = potrebni nivo obrazovanja (NKV, PKV, KV, SSS, VŠS, VSS)
- Uvjeti rada = opasnosti i štetnosti na radnom mjestu po kategorijama (fizički, kemijski, biološki, ergonomski, psihosocijalni)

UVJERENJA I CERTIFIKATI:
- ZNR uvjerenje = osposobljavanje za zaštitu na radu (obavezno za svakog radnika)
- PP uvjerenje = osposobljavanje za zaštitu od požara
- Vrijedi do = datum isteka uvjerenja, nakon toga radnik mora obnoviti
- Sposobnost = rezultat ljekarskog pregleda (Sposoban, Sposoban uz ograničenja, Nesposoban)

RADNA OPREMA:
- Radna oprema = strojevi, uređaji i instalacije koji podliježu periodičnim pregledima
- Posljednji pregled = datum zadnjeg redovnog pregleda
- Idući pregled = datum sljedećeg obaveznog pregleda
- Status Active = oprema u upotrebi, pregled važeći
- Status Expired = pregled istekao, potreban novi pregled

ISZNR:
- ISZNR = Informacioni sistem zaštite na radu (državni sistem za evidenciju)
- Stranke = tvrtke i organizacije registrirane u ISZNR sistemu
- Ispitivači = ovlaštene osobe za provođenje pregleda opreme i objekata

OBRASCI:
- OIR-1 = Obrazac za izvještaj o povredi na radu (prijava inspektoratu)
- RO-1, RO-2 = Obrasci za redovne preglede opreme
- RA-1 = Ljekarska uputnica za pregled radnika
- NR-1 = Uputnica za noćni rad

${pageDesc}

STRANICE APLIKACIJE:
${pagesText}

ŽIVI PODACI IZ APLIKACIJE (ažurirano u realnom vremenu):
${dataContext || 'Nema podataka u bazi.'}

VIŠEKORAČNI ZADACI:
- Ako korisnik traži više radnji odjednom (npr. "dodaj radnika I dodaj mu uvjerenje"), uradi PRVU radnju odmah alatom
- Nakon što alat otvori formu, objasni korisniku: "Otvorio sam formu. Nakon što sačuvaš radnika, reci mi i dodat ću uvjerenje."
- NIKAD ne pokušavaj uraditi obje radnje odjednom — jedna po jedna

ODGOVORI kratko i akcijski, bez dugih uvoda`;
    } else {
        return `You are Zia, an advanced AI AGENT for eZNR — a digital platform for occupational safety in Bosnia and Herzegovina. You communicate in English. Today is ${today}.

YOU ARE NOT JUST A CHATBOT — YOU ARE AN AGENT. You can actively help officers complete tasks:
- Navigate to pages on their behalf (use navigate_to tool)
- Open the questionnaire dispatch modal (use open_dispatch_modal tool)
- Open a NEW WORKER form pre-filled with a name (use create_new_worker tool)
- Open an INJURY REPORT form pre-filled with a worker (use report_injury tool)
- Analyse data and give concrete recommendations

WHEN TO USE TOOLS:
- If the user says "go to", "open", "show me" a page → USE navigate_to immediately
- If the user wants to send a questionnaire → use open_dispatch_modal with the questionnaire ID from LIVE DATA
- If the user says "add worker", "new worker", "register employee" → use create_new_worker with the name
- If the user mentions a work injury, accident, or incident for a specific worker → use report_injury with that worker's data from LIVE DATA
- If the user says "add certificate", "new training", "new medical exam" for a worker → use add_certificate with the worker ID from LIVE DATA and all details (tipUvjerenja, datum, vrijediDo)
- If user specifies duration (e.g. "2 years"), calculate vrijediDo = datum + duration and pass it to the tool
- If the user mentions assigning PPE (equipment, gloves, helmet, vest, boots, etc.) to a worker → use assign_ppe with worker_id from LIVE DATA. Default datum = today, default kolicina = 1 unless user specifies otherwise. This saves DIRECTLY — no form needed.
- If the user asks about data you already have → answer directly without tools
- If the user asks to change the year for all work injuries → use bulk_update_injuries tool

DOMAIN GLOSSARY (use when user asks "what does X mean?" or needs clarification):

RISK ASSESSMENT:
- Draft (Nacrt) = assessment is still being prepared, not yet finalized
- Active (Aktivna) = assessment currently in effect and applicable
- Archived (Arhivirana) = replaced by newer version or expired, kept for history
- Probability (V) = likelihood of hazard occurring (1-5 scale: 1=negligible, 5=almost certain)
- Consequence (P) = severity of damage if hazard occurs (1-5 scale: 1=none, 5=fatal)
- Risk (R) = V × P, overall risk score (1-25)
- Negligible risk (1-5), Tolerable (6-10), Moderate (11-15), Significant (16-20), Intolerable (21-25)

EMPLOYER DOCUMENTATION:
- Mandatory = legally required documents for every employer
- Periodic reviews = regularly recurring inspections (fire extinguishers, hydrants, electrical)
- Additional records = optional but useful documentation
- Active = document is valid and in effect
- Expired = document validity has lapsed, needs renewal

JOB SYSTEMATIZATION:
- Sistematizacija = formal description of each workplace: duties, conditions, equipment, health requirements
- OZO = Personal Protective Equipment (PPE)
- Special conditions = specific workplace requirements (height work, noise, chemicals)

CERTIFICATES:
- ZNR = Occupational Safety Training certificate
- PP = Fire Protection certificate
- Valid until = expiry date, worker must renew after this

FORMS: OIR-1 = Injury report, RO-1/RO-2 = Equipment inspection, RA-1 = Medical referral, NR-1 = Night work referral
ISZNR = National Information System for Occupational Safety

${pageDesc}

APPLICATION PAGES:
${pagesText}

LIVE APP DATA (updated in real time):
${dataContext || 'No data in the database.'}

MULTI-STEP TASKS:
- If the user asks for multiple actions at once (e.g., "add worker AND add certificate"), execute the FIRST action immediately with a tool
- After opening the form, tell the user: "I've opened the form. Once you save the worker, ask me again and I'll add the certificate."
- NEVER try to do both actions simultaneously — one at a time

Keep responses short and action-focused`;
    }
}

// ─── Dynamic suggestion chips based on live data ────────────────────────────
function buildDynamicSuggestions(lang) {
    const chips = [];
    try {
        const prefix = 'eznr_';
        const get = (key) => { try { return JSON.parse(localStorage.getItem(prefix + key) || '[]'); } catch { return []; } };
        const certificates = get('certificates');
        const injuries = get('injuries');
        const diseases = get('diseases');
        const equipment = get('equipment');
        const today = new Date();
        const in30 = new Date(); in30.setDate(in30.getDate() + 30);

        const expired = certificates.filter(c => c.vrijediDo && new Date(c.vrijediDo) < today);
        const expiring = certificates.filter(c => c.vrijediDo && new Date(c.vrijediDo) >= today && new Date(c.vrijediDo) <= in30);
        const sickLeave = [...injuries, ...diseases].filter(i => i.bolovanje && i.status !== 'zatvorena');
        const overdueEq = equipment.filter(e => e.iduci && new Date(e.iduci) < today);

        if (expired.length > 0) chips.push(lang === 'bs'
            ? { label: `🔴 ${expired.length} istekla uvjerenja`, text: 'Koji radnici imaju istekla uvjerenja?' }
            : { label: `🔴 ${expired.length} expired certs`, text: 'Which workers have expired certificates?' });
        if (expiring.length > 0) chips.push(lang === 'bs'
            ? { label: `📜 ${expiring.length} uvjerenja uskoro iste`, text: 'Prikaži mi uvjerenja koja uskoro ističu.' }
            : { label: `📜 ${expiring.length} certs expiring soon`, text: 'Show me certificates expiring soon.' });
        if (sickLeave.length > 0) chips.push(lang === 'bs'
            ? { label: `🏥 ${sickLeave.length} na bolovanju`, text: 'Ko je trenutno na bolovanju?' }
            : { label: `🏥 ${sickLeave.length} on sick leave`, text: 'Who is currently on sick leave?' });
        if (overdueEq.length > 0) chips.push(lang === 'bs'
            ? { label: `⚠️ ${overdueEq.length} pregleda opreme kasni`, text: 'Koja oprema ima prekoračen pregled?' }
            : { label: `⚠️ ${overdueEq.length} equipment overdue`, text: 'Which equipment has overdue inspection?' });
    } catch { /* ignore */ }

    // Always-available actions
    if (lang === 'bs') {
        chips.push({ label: '📧 Pošalji upitnik radnicima', text: 'Pošalji upitnik radnicima u određenom odjelu.' });
        chips.push({ label: '📊 Pregled stanja', text: 'Daj mi pregled trenutnog stanja zaštite na radu.' });
        chips.push({ label: '👷 Dodaj novog radnika', text: 'Otvori formu za dodavanje novog radnika.' });
        chips.push({ label: '📋 Obavezna dokumentacija', text: 'Koja je obavezna dokumentacija za poslodavca?' });
    } else {
        chips.push({ label: '📧 Send questionnaire', text: 'Send a questionnaire to workers in a department.' });
        chips.push({ label: '📊 Status overview', text: 'Give me a current occupational safety status overview.' });
        chips.push({ label: '👷 Add new worker', text: 'Open the form to add a new worker.' });
        chips.push({ label: '📋 Mandatory docs', text: 'What mandatory documentation is required for employers?' });
    }
    return chips.slice(0, 6);
}

// ─── Tool definitions for Gemini function calling ────────────────────────────
const ZIA_TOOLS = [
    {
        name: 'navigate_to',
        description: 'Navigate the user to a specific page in the eZNR app. Use this whenever the user wants to go to a page, see a list, or open a section.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'App path to navigate to, e.g. /dashboard/workers' },
                reason: { type: 'string', description: 'One-sentence explanation shown to the user' },
            },
            required: ['path', 'reason'],
        },
    },
    {
        name: 'open_dispatch_modal',
        description: 'Navigate to the Questionnaires page and trigger the dispatch modal so the officer can send a questionnaire to workers. Use when the user wants to send a questionnaire.',
        parameters: {
            type: 'object',
            properties: {
                questionnaire_id: { type: 'string', description: 'ID of the questionnaire to dispatch (from LIVE DATA)' },
                questionnaire_name: { type: 'string', description: 'Name of the questionnaire for display' },
            },
            required: ['questionnaire_id', 'questionnaire_name'],
        },
    },
    {
        name: 'create_new_worker',
        description: 'Open the new worker creation form, optionally pre-filled with a name. Use this when the user says they want to add, create, or register a new worker/employee.',
        parameters: {
            type: 'object',
            properties: {
                ime: { type: 'string', description: 'First name (ime) of the new worker, if mentioned' },
                prezime: { type: 'string', description: 'Last name (prezime) of the new worker, if mentioned' },
            },
        },
    },
    {
        name: 'report_injury',
        description: 'Open the injury report form pre-filled with a worker. Use when the user says a worker had an injury, accident, or work incident. The date defaults to today if not specified.',
        parameters: {
            type: 'object',
            properties: {
                worker_name: { type: 'string', description: 'Full name of the injured worker' },
                worker_id: { type: 'string', description: 'ID of the worker from LIVE DATA (SVI AKTIVNI RADNICI section)' },
                datum: { type: 'string', description: 'Date of injury in YYYY-MM-DD format, defaults to today' },
                tip: { type: 'string', description: 'Injury type: laka (minor), teska (severe), or smrtna (fatal). Default: laka' },
            },
            required: ['worker_name'],
        },
    },
    {
        name: 'add_certificate',
        description: 'Open the certificate creation form pre-filled with worker and certificate details. Use when user wants to add a certificate, training, or medical fitness record for a worker.',
        parameters: {
            type: 'object',
            properties: {
                worker_id: { type: 'string', description: 'ID of the worker from LIVE DATA' },
                worker_name: { type: 'string', description: 'Full name of the worker' },
                tipUvjerenja: { type: 'string', description: 'Certificate type name. For fire protection use "PP - Osposobljenost za gašenje požara". Match to available types in the app.' },
                datum: { type: 'string', description: 'Issue date in YYYY-MM-DD format. Default: today.' },
                vrijediDo: { type: 'string', description: 'Expiry date in YYYY-MM-DD format. Calculate from datum + duration if user specifies (e.g. "2 years" = datum + 730 days).' },
            },
            required: ['worker_name'],
        },
    },
    {
        name: 'assign_ppe',
        description: 'Assign personal protective equipment (Osobna zaštitna oprema / OZO) to a worker. Use when user says a worker received, was given, or needs safety equipment (gloves, helmet, vest, boots, etc). Directly saves the record — no form navigation needed.',
        parameters: {
            type: 'object',
            properties: {
                worker_id: { type: 'string', description: 'ID of the worker from LIVE DATA. Always look this up from the workers list before calling.' },
                worker_name: { type: 'string', description: 'Full name of the worker for confirmation message.' },
                ppe_name: { type: 'string', description: 'Name of the PPE item in the local language (e.g. Zaštitne rukavice, Kaska, Zaštitne cipele, Prsluk, Naočale).' },
                datum: { type: 'string', description: 'Assignment date in YYYY-MM-DD format. Default: today if not specified by user.' },
                kolicina: { type: 'number', description: 'Quantity assigned. Default: 1 if not specified.' },
            },
            required: ['worker_id', 'worker_name', 'ppe_name'],
        },
    },
    {
        name: 'bulk_update_injuries',
        description: 'Update the year of all existing work injury records (povrede na radu). Use this specifically when a user asks to change the dates or the year of all injuries.',
        parameters: {
            type: 'object',
            properties: {
                target_year: { type: 'string', description: 'The 4-digit year to set for all injuries (e.g., "2025")' }
            },
            required: ['target_year'],
        },
    },
];

// ─── Main component ─────────────────────────────────────────────────────────
export default function AIAssistant() {
    const { lang } = useLanguage();
    const { isDark } = useTheme();
    const router = useRouter();
    const pathname = usePathname();

    // Compute theme-aware chat styles
    const chatStyles = makeChatStyles(isDark);

    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [pulseAnimation, setPulseAnimation] = useState(false); // no pulse
    const [retryCountdown, setRetryCountdown] = useState(0);
    const [attachments, setAttachments] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [urgentCount, setUrgentCount] = useState(0); // badge on FAB

    // ── Draggable FAB state ─────────────────────────────────────────────────
    const [fabPos, setFabPos] = useState(null); // { x, y } or null = default
    const dragRef = useRef({ dragging: false, startX: 0, startY: 0, totalDist: 0 });
    const fabRef = useRef(null);

    // Load saved position
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('eznr_zia_position'));
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                // Validate within viewport
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const x = Math.max(4, Math.min(saved.x, vw - 56));
                const y = Math.max(4, Math.min(saved.y, vh - 56));
                setFabPos({ x, y });
            }
        } catch { /* use default */ }
    }, []);

    // Drag handlers
    const handleDragStart = useCallback((clientX, clientY) => {
        dragRef.current = { dragging: true, startX: clientX, startY: clientY, totalDist: 0 };
    }, []);

    const handleDragMove = useCallback((clientX, clientY) => {
        const d = dragRef.current;
        if (!d.dragging) return;
        const dx = clientX - d.startX;
        const dy = clientY - d.startY;
        d.totalDist += Math.abs(dx) + Math.abs(dy);
        d.startX = clientX;
        d.startY = clientY;

        setFabPos(prev => {
            const cur = prev || { x: window.innerWidth - 64, y: window.innerHeight - 64 };
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            return {
                x: Math.max(4, Math.min(cur.x + dx, vw - 56)),
                y: Math.max(4, Math.min(cur.y + dy, vh - 56)),
            };
        });
    }, []);

    const handleDragEnd = useCallback(() => {
        const d = dragRef.current;
        d.dragging = false;

        // Only snap + persist if it was a real drag (not a click)
        if (d.totalDist > 8) {
            setFabPos(prev => {
                if (!prev) return prev;
                const vw = window.innerWidth;
                // Snap to nearest horizontal edge
                const snapped = {
                    x: prev.x < vw / 2 ? 12 : vw - 60,
                    y: prev.y,
                };
                try { localStorage.setItem('eznr_zia_position', JSON.stringify(snapped)); } catch {}
                return snapped;
            });
        }
    }, []);

    // Mouse drag
    const onFabMouseDown = useCallback((e) => {
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);

        const onMove = (ev) => handleDragMove(ev.clientX, ev.clientY);
        const onUp = () => {
            handleDragEnd();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            // If total dist < threshold, treat as click
            if (dragRef.current.totalDist <= 8) {
                if (isOpen) handleClose(); else handleOpen();
            }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [handleDragStart, handleDragMove, handleDragEnd, isOpen]);

    // Touch drag
    const onFabTouchStart = useCallback((e) => {
        const t = e.touches[0];
        handleDragStart(t.clientX, t.clientY);
    }, [handleDragStart]);

    const onFabTouchMove = useCallback((e) => {
        e.preventDefault(); // prevent scroll while dragging
        const t = e.touches[0];
        handleDragMove(t.clientX, t.clientY);
    }, [handleDragMove]);

    const onFabTouchEnd = useCallback(() => {
        handleDragEnd();
        if (dragRef.current.totalDist <= 8) {
            if (isOpen) handleClose(); else handleOpen();
        }
    }, [handleDragEnd, isOpen]);

    // Computed FAB styles
    const fabPosition = fabPos
        ? { position: 'fixed', left: fabPos.x, top: fabPos.y, bottom: 'auto', right: 'auto' }
        : { position: 'fixed', bottom: 16, right: 16 };

    // Is FAB on the left side of the screen?
    const isFabLeft = fabPos ? fabPos.x < window.innerWidth / 2 : false;

    // Is the screen mobile-sized?
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatHistoryRef = useRef([]); // keep full history for context
    const retryTimerRef = useRef(null);
    const pendingRetryRef = useRef(null); // stores { text, history } for auto-retry
    const retryAttemptRef = useRef(0);    // counts how many auto-retries done

    // ── Compute badge count from live data (no auto-open) ──────────────────
    useEffect(() => {
        const updateBadge = () => {
            try {
                const sysSettings = JSON.parse(localStorage.getItem('eznr_app_settings') || '{}');
                if (sysSettings.proactiveZia === false) {
                    setUrgentCount(0);
                    return;
                }

                const get = (k) => { try { return JSON.parse(localStorage.getItem('eznr_' + k) || '[]'); } catch { return []; } };
                const today = new Date();
                const certs = get('certificates');
                const equip = get('equipment');
                const expired = certs.filter(c => c.vrijediDo && new Date(c.vrijediDo) < today).length;
                const overdueEq = equip.filter(e => e.iduci && new Date(e.iduci) < today).length;
                setUrgentCount(expired + overdueEq);
            } catch { /* ignore */ }
        };

        updateBadge();
        window.addEventListener('appSettingsUpdated', updateBadge);
        return () => window.removeEventListener('appSettingsUpdated', updateBadge);
    }, [pathname]);

    // Cleanup retry timer on unmount
    useEffect(() => {
        return () => { if (retryTimerRef.current) clearInterval(retryTimerRef.current); };
    }, []);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && !isMinimized && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, isMinimized]);



    const handleOpen = useCallback(() => {
        setIsOpen(true);
        setIsMinimized(false);
        setHasNewMessage(false);
        setPulseAnimation(false);

        // On first open: show data-driven summary instead of generic welcome
        if (messages.length === 0) {
            try {
                const get = (k) => { try { return JSON.parse(localStorage.getItem('eznr_' + k) || '[]'); } catch { return []; } };
                const today = new Date();
                const in30 = new Date(); in30.setDate(in30.getDate() + 30);
                const certs = get('certificates');
                const equip = get('equipment');
                const injuries = get('injuries');
                const diseases = get('diseases');
                const expired = certs.filter(c => c.vrijediDo && new Date(c.vrijediDo) < today).length;
                const soonCerts = certs.filter(c => c.vrijediDo && new Date(c.vrijediDo) >= today && new Date(c.vrijediDo) <= in30).length;
                const overdueEq = equip.filter(e => e.iduci && new Date(e.iduci) < today).length;
                const sickLeave = [...injuries, ...diseases].filter(i => i.bolovanje && i.status !== 'zatvorena').length;

                const total = expired + soonCerts + overdueEq + sickLeave;

                let welcome;
                if (total === 0) {
                    welcome = lang === 'bs'
                        ? `Zdravo! Ja sam **Zia** ✨\n\nSve izgleda uredno — nema ničeg hitnog.\n\nMogu navigirati do stranica, analizirati podatke ili pokrenuti slanje upitnika. Šta trebate?`
                        : `Hello! I'm **Zia** ✨\n\nEverything looks good — nothing urgent right now.\n\nI can navigate pages, analyse data, or trigger questionnaire dispatch. What do you need?`;
                } else {
                    const items = [];
                    if (expired > 0) items.push(lang === 'bs' ? `🔴 **${expired}** istekla uvjerenja` : `🔴 **${expired}** expired certificates`);
                    if (soonCerts > 0) items.push(lang === 'bs' ? `⏰ **${soonCerts}** uvjerenja ističe u 30 dana` : `⏰ **${soonCerts}** certificates expiring in 30 days`);
                    if (overdueEq > 0) items.push(lang === 'bs' ? `⚠️ **${overdueEq}** pregleda opreme u zakašnjenju` : `⚠️ **${overdueEq}** equipment inspections overdue`);
                    if (sickLeave > 0) items.push(lang === 'bs' ? `🏥 **${sickLeave}** radnika na bolovanju` : `🏥 **${sickLeave}** workers on sick leave`);
                    welcome = lang === 'bs'
                        ? `Zdravo! Ja sam **Zia** ✨\n\nImate **${total}** stvari koje zahtijevaju pažnju:\n• ${items.join('\n• ')}\n\nŠta želite uraditi?`
                        : `Hello! I'm **Zia** ✨\n\nYou have **${total}** items needing attention:\n• ${items.join('\n• ')}\n\nWhat would you like to do?`;
                }
                setMessages([{ role: 'assistant', content: welcome, timestamp: new Date() }]);
            } catch {
                const welcome = lang === 'bs'
                    ? `Zdravo! Ja sam **Zia**, vaš AI agent za eZNR. ✨\n\nŠta trebate uraditi?`
                    : `Hello! I'm **Zia**, your AI agent for eZNR. ✨\n\nWhat do you need to get done?`;
                setMessages([{ role: 'assistant', content: welcome, timestamp: new Date() }]);
            }
        }
    }, [lang, messages.length]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    const handleMinimize = useCallback(() => {
        setIsMinimized(prev => !prev);
    }, []);

    // Parse assistant response for navigation links
    const parseResponse = useCallback((text) => {
        // Look for [Label](/dashboard/path) patterns and make them clickable
        return text.replace(/\[([^\]]+)\]\((\/dashboard[^\)]*)\)/g, (match, label, path) => {
            return `__NAV_LINK__${label}__${path}__END_NAV__`;
        });
    }, []);

    // ── Proxy API call through /api/zia (key never leaves server) ────────────
    const callZiaAPI = useCallback(async (history, systemPrompt, tools) => {
        const res = await fetch('/api/zia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: history, systemPrompt, tools }),
        });
        const data = await res.json();
        if (!res.ok) {
            const err = new Error(data.error || `API error ${res.status}`);
            err.isRateLimit = data.isRateLimit || res.status === 429;
            err.retryAfter = data.retryAfter || 30;
            throw err;
        }
        return data; // { text } or { function_call: { name, args } }
    }, []);

    // ── Execute a tool call from Gemini ──────────────────────────────────────
    const executeTool = useCallback(async (name, args) => {
        if (name === 'navigate_to') {
            router.push(args.path);
            setIsMinimized(true);
            return { success: true, message: args.reason };
        }
        if (name === 'open_dispatch_modal') {
            // Store intent for the questionnaires page to pick up
            try { sessionStorage.setItem('zia_dispatch_intent', JSON.stringify({ id: args.questionnaire_id, name: args.questionnaire_name })); } catch { }
            router.push('/dashboard/questionnaires');
            setIsMinimized(true);
            return { success: true, message: `Opening dispatch for ${args.questionnaire_name}` };
        }
        if (name === 'create_new_worker') {
            const params = new URLSearchParams({ zia_new: '1' });
            if (args.ime) params.set('ime', args.ime);
            if (args.prezime) params.set('prezime', args.prezime);
            router.push(`/dashboard/workers?${params.toString()}`);
            setIsMinimized(true);
            return { success: true, message: `Opening new worker form` };
        }
        if (name === 'report_injury') {
            const today = new Date().toISOString().split('T')[0];
            const params = new URLSearchParams({ zia_new: '1' });
            if (args.worker_name) params.set('radnikIme', args.worker_name);
            if (args.worker_id) params.set('radnikId', args.worker_id);
            params.set('datum', args.datum || today);
            if (args.tip) params.set('tip', args.tip);
            router.push(`/dashboard/injuries?${params.toString()}`);
            setIsMinimized(true);
            return { success: true, message: `Opening injury report for ${args.worker_name}` };
        }
        if (name === 'add_certificate') {
            const params = new URLSearchParams();
            if (args.worker_id) params.set('workerId', args.worker_id);
            if (args.tipUvjerenja) params.set('tipUvjerenja', args.tipUvjerenja);
            if (args.datum) params.set('datum', args.datum);
            if (args.vrijediDo) params.set('vrijediDo', args.vrijediDo);
            router.push(`/dashboard/worker-certificates/create?${params.toString()}`);
            setIsMinimized(true);
            return { success: true, message: `Opening certificate form for ${args.worker_name}` };
        }
        if (name === 'assign_ppe') {
            try {
                const { create: createRecord, getAll: getRecords, COLLECTIONS: COLS } = await import('@/lib/dataStore');
                const { logPPEAssigned } = await import('@/lib/activityLog');
                const today = new Date().toISOString().split('T')[0];

                // Resolve worker_id — prefer provided ID, fall back to name match
                let resolvedId = args.worker_id;
                const allWorkers = getRecords(COLS.WORKERS);
                if (!resolvedId || !allWorkers.find(w => w.id === resolvedId)) {
                    // Try to find by name
                    const nameParts = (args.worker_name || '').toLowerCase().split(' ');
                    const match = allWorkers.find(w =>
                        nameParts.some(p => p && (w.ime || '').toLowerCase().includes(p)) &&
                        nameParts.some(p => p && (w.prezime || '').toLowerCase().includes(p))
                    );
                    if (match) { resolvedId = match.id; }
                }

                if (!resolvedId) {
                    return { error: `Radnik "${args.worker_name}" nije prona\u0111en. Provjeri ime i prezime.` };
                }

                const newPpe = createRecord(COLS.PPE_ASSIGNMENTS, {
                    workerId: resolvedId,
                    naziv: args.ppe_name,
                    datumZaduzenja: args.datum || today,
                    kolicina: args.kolicina || 1,
                    datumRazduzenja: '',
                });

                // Log to activity log
                try { logPPEAssigned(newPpe, args.worker_name, null); } catch { }

                router.push('/dashboard/worker-ppe');
                setIsMinimized(true);
                return { success: true, message: `OZO "${args.ppe_name}" dodijeljen${args.worker_name ? ` radniku ${args.worker_name}` : ''} (kol: ${args.kolicina || 1}, datum: ${args.datum || today})` };
            } catch (err) {
                return { error: `Failed to save PPE: ${err.message}` };
            }
        }
        if (name === 'bulk_update_injuries') {
            try {
                const { getAll, update, COLLECTIONS } = await import('@/lib/dataStore');
                const injuries = getAll(COLLECTIONS.INJURIES);
                let updatedCount = 0;
                injuries.forEach(inj => {
                    if (inj.datum) {
                        const parts = inj.datum.split('-');
                        if (parts.length === 3 && parts[0] !== args.target_year) {
                            parts[0] = args.target_year;
                            update(COLLECTIONS.INJURIES, inj.id, { datum: parts.join('-') });
                            updatedCount++;
                        }
                    }
                });
                return { success: true, message: `Uspješno izmijenjeno ${updatedCount} zapisa o povredama na godinu ${args.target_year}. Osvježite stranicu za prikaz promjena.` };
            } catch (err) {
                return { error: `Failed to update injuries: ${err.message}` };
            }
        }
        return { error: 'unknown_tool' };
    }, [router, pathname]);


    // ── Start retry countdown, then auto-resend ───────────────────────────────
    const startRetryCountdown = useCallback((seconds, text, history) => {
        const MAX_RETRIES = 2;
        retryAttemptRef.current += 1;

        // If we've retried too many times, the quota is truly exhausted for the day
        if (retryAttemptRef.current > MAX_RETRIES) {
            if (retryTimerRef.current) clearInterval(retryTimerRef.current);
            setRetryCountdown(0);
            pendingRetryRef.current = null;
            const quotaMsg = lang === 'bs'
                ? `🚫 **Dnevna kvota iscrpljena.** Vaš API ključ je dostigao besplatni dnevni limit.

**Šta uraditi:**
• 🔗 Omogućite naplatu na [Google Cloud Console](https://console.cloud.google.com/billing) za više zahtjeva
• ⏳ Ili pričekajte do suće dok se limiti ne resetuju (oko pononoći po pacifičkom vremenu)
• 🔑 Alternativno, koristite novi API ključ sa [Google AI Studio](https://aistudio.google.com/apikey)`
                : `🚫 **Daily quota exhausted.** Your API key has hit the free daily limit.

**What to do:**
• 🔗 Enable billing on [Google Cloud Console](https://console.cloud.google.com/billing) for higher limits
• ⏳ Or wait until tomorrow when limits reset (around midnight Pacific Time)
• 🔑 Alternatively, use a new API key from [Google AI Studio](https://aistudio.google.com/apikey)`;
            setMessages(prev => [...prev, { role: 'assistant', content: quotaMsg, timestamp: new Date() }]);
            return;
        }

        if (retryTimerRef.current) clearInterval(retryTimerRef.current);
        setRetryCountdown(seconds);
        pendingRetryRef.current = { text, history };

        retryTimerRef.current = setInterval(() => {
            setRetryCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(retryTimerRef.current);
                    retryTimerRef.current = null;
                    // Auto-resend
                    const pending = pendingRetryRef.current;
                    pendingRetryRef.current = null;
                    if (pending) sendMessageInternal(pending.text, pending.history, true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Internal send (supports retry loop + function calling) ───────────────
    const sendMessageInternal = useCallback(async (text, existingHistory, isRetry = false, attachedFiles = []) => {
        // Build parts: text + any attached file data
        const msgParts = [];
        if (text) msgParts.push({ text });
        attachedFiles.forEach(att => msgParts.push({ inlineData: { mimeType: att.type, data: att.data } }));
        if (msgParts.length === 0) msgParts.push({ text: ' ' });

        const newHistory = existingHistory || [...chatHistoryRef.current, { role: 'user', parts: msgParts }];
        if (!existingHistory) chatHistoryRef.current = newHistory;

        setIsLoading(true);
        const systemPrompt = buildSystemPrompt(lang, pathname, buildDataContext(lang));

        try {
            const result = await callZiaAPI(newHistory, systemPrompt, ZIA_TOOLS);

            // ── Function call: Zia wants to take an action ────────────────────
            if (result.function_call) {
                const { name, args } = result.function_call;

                // Add model's function_call turn to history
                const historyWithCall = [...newHistory, { role: 'model', parts: [{ function_call: { name, args } }] }];

                // Execute the tool
                const toolResult = await executeTool(name, args);

                // Add function response turn
                const historyWithResult = [...historyWithCall, {
                    role: 'user',
                    parts: [{ function_response: { name, response: toolResult } }],
                }];

                // Get Zia's final text response after seeing the tool result
                let reply;
                try {
                    const finalResult = await callZiaAPI(historyWithResult, systemPrompt, ZIA_TOOLS);
                    reply = finalResult.text || (lang === 'bs' ? 'Urađeno.' : 'Done.');
                } catch {
                    // If second call fails (rate limit etc), use the tool result message
                    reply = toolResult.message || toolResult.error || (lang === 'bs' ? 'Urađeno.' : 'Done.');
                }

                chatHistoryRef.current = [...historyWithResult, { role: 'model', parts: [{ text: reply }] }];
                setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date(), isAction: true }]);
                if (isMinimized) setHasNewMessage(true);
                retryAttemptRef.current = 0;
                setIsLoading(false);
                return;
            }

            // ── Normal text response ──────────────────────────────────────────
            const reply = result.text || (lang === 'bs' ? 'Nema odgovora.' : 'No response.');
            chatHistoryRef.current = [...newHistory, { role: 'model', parts: [{ text: reply }] }];
            setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
            if (isMinimized) setHasNewMessage(true);
            retryAttemptRef.current = 0;
            setIsLoading(false);

        } catch (err) {
            console.warn('Zia API error:', err.message);
            if (err.isRateLimit) {
                const waitSec = err.retryAfter || 30;
                const countdownMsg = lang === 'bs'
                    ? `⏳ Limit zahtjeva dostignut. Pokušavam ponovo za **${waitSec}s**...`
                    : `⏳ Rate limit reached. Auto-retrying in **${waitSec}s**...`;
                setMessages(prev => [...prev, { role: 'assistant', content: countdownMsg, timestamp: new Date(), isRetryMsg: true }]);
                setIsLoading(false);
                startRetryCountdown(waitSec, text, newHistory);
                return;
            }
            const errText = lang === 'bs' ? `⚠️ Greška: ${err.message}` : `⚠️ Error: ${err.message}`;
            setMessages(prev => [...prev, { role: 'assistant', content: errText, timestamp: new Date() }]);
            setIsLoading(false);
        }
    }, [callZiaAPI, executeTool, isMinimized, lang, pathname, startRetryCountdown]);

    // ── Proactive logic REMOVED — badge count instead ─────────────────────────
    // (urgentCount computed in separate useEffect above)

    const sendMessage = useCallback(async (text) => {
        if ((!text.trim() && attachments.length === 0) || isLoading || retryCountdown > 0) return;
        const attachedFiles = [...attachments];
        const displayText = text.trim() || (attachedFiles.length > 0 ? (lang === 'bs' ? '[Prilog]' : '[Attachment]') : '');
        const userMessage = {
            role: 'user',
            content: displayText,
            attachmentPreviews: attachedFiles.map(a => ({ name: a.name, type: a.type, preview: a.preview })),
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setAttachments([]);
        setShowSuggestions(false);
        await sendMessageInternal(text.trim(), undefined, false, attachedFiles);
    }, [isLoading, retryCountdown, sendMessageInternal, attachments, lang]);

    const handleSuggestion = useCallback((suggestion) => {
        sendMessage(suggestion.text);
    }, [sendMessage]);

    // ── File attachment handler ───────────────────────────────────────────────
    const handleFilesSelected = useCallback((files) => {
        Array.from(files).forEach(file => {
            const ok = file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/');
            if (!ok || file.size > 20_000_000) return; // 20 MB max
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const base64 = dataUrl.split(',')[1];
                setAttachments(prev => [...prev, {
                    name: file.name,
                    type: file.type,
                    data: base64,
                    preview: file.type.startsWith('image/') ? dataUrl : null,
                }]);
            };
            reader.readAsDataURL(file);
        });
    }, []);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(inputValue);
        }
    }, [inputValue, sendMessage]);

    const handleNavLink = useCallback((path) => {
        router.push(path);
        setIsMinimized(true);
    }, [router]);

    const clearChat = useCallback(() => {
        setMessages([]);
        chatHistoryRef.current = [];
        setShowSuggestions(true);
        // Re-show welcome
        const welcome = lang === 'bs'
            ? `Zdravo! Ja sam **Zia**, vaš AI agent za eZNR. ✨\n\nMogu navigirati do stranica, pokrenuti slanje upitnika i analizirati vaše podatke. Šta trebate uraditi?`
            : `Hello! I'm **Zia**, your AI agent for eZNR. ✨\n\nI can navigate pages, trigger questionnaire dispatch, and analyse your data. What do you need to get done?`;
        setMessages([{ role: 'assistant', content: welcome, timestamp: new Date() }]);
    }, [lang]);

    const formatTime = (date) => {
        return date.toLocaleTimeString(lang === 'bs' ? 'bs-BA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    };

    // ── Render message content with bold and nav links ──────────────────────
    const renderMessageContent = (content) => {
        const parsed = parseResponse(content);
        // Split by nav links
        const parts = parsed.split(/(__NAV_LINK__.*?__END_NAV__)/g);

        return parts.map((part, idx) => {
            if (part.startsWith('__NAV_LINK__')) {
                const inner = part.replace('__NAV_LINK__', '').replace('__END_NAV__', '');
                const [label, path] = inner.split('__');
                return (
                    <button key={idx} onClick={() => handleNavLink(path)} style={chatStyles.navLink}>
                        🔗 {label}
                    </button>
                );
            }
            // Render markdown-ish formatting (bold, bullets)
            return (
                <span key={idx} dangerouslySetInnerHTML={{
                    __html: part
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n•\s/g, '<br/>• ')
                        .replace(/\n/g, '<br/>')
                }} />
            );
        });
    };

    const suggestions = buildDynamicSuggestions(lang);

    return (
        <>
            {/* ── Floating Action Button (Draggable) ── */}
            <button
                ref={fabRef}
                id="ai-assistant-fab"
                onMouseDown={isOpen ? undefined : onFabMouseDown}
                onTouchStart={isOpen ? undefined : onFabTouchStart}
                onTouchMove={isOpen ? undefined : onFabTouchMove}
                onTouchEnd={isOpen ? undefined : onFabTouchEnd}
                onClick={isOpen ? handleClose : undefined}
                style={{
                    ...fabStyles.fab,
                    ...fabPosition,
                    ...(isOpen ? { width: 32, height: 32,
                        ...(isMobileScreen ? { bottom: 72, right: 16, left: 'auto', top: 'auto' } : { bottom: 16, right: 16, left: 'auto', top: 'auto' }),
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)' } : {}),
                    animation: !isOpen && pulseAnimation ? 'aiPulse 2s ease-in-out infinite' : 'none',
                    transition: dragRef.current.dragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    touchAction: 'none',
                    cursor: 'grab',
                }}
                title={isOpen
                    ? (lang === 'bs' ? 'Zatvori AI asistenta Zia' : 'Close AI assistant Zia')
                    : (lang === 'bs' ? 'Otvori AI asistenta Zia (povuci da pomjeriš)' : 'Open AI assistant Zia (drag to move)')}
            >
                <span style={{ ...fabStyles.fabIcon, fontSize: isOpen ? '0.8rem' : '1.3rem' }}>{isOpen ? '✕' : '✨'}</span>
                {!isOpen && <span style={fabStyles.fabLabel}>Zia</span>}
                {/* Numeric urgent badge */}
                {!isOpen && urgentCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -5, right: -5,
                        minWidth: 18, height: 18, borderRadius: 9,
                        background: '#EF4444', border: '2px solid white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.6rem', color: 'white', fontWeight: 800,
                        padding: '0 3px', lineHeight: 1,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                    }}>
                        {urgentCount > 99 ? '99+' : urgentCount}
                    </span>
                )}
            </button>

            {/* ── Chat Window ── */}
            {isOpen && (
                <div id="ai-assistant-window" style={{
                    ...chatStyles.window,
                    // Mobile: full-screen overlay
                    ...(isMobileScreen ? {
                        position: 'fixed', top: 52, left: 0, right: 0, bottom: 60,
                        width: 'auto', height: 'auto',
                        borderRadius: 0,
                    } : {
                        height: isMinimized ? 'auto' : 580,
                        // Position relative to FAB or default
                        ...(isFabLeft
                            ? { left: 28, right: 'auto', bottom: 72 }
                            : { right: 28, bottom: 72 }),
                    }),
                }}>
                    {/* Header */}
                    <div style={chatStyles.header}>
                        <div style={chatStyles.headerLeft}>
                            <div style={chatStyles.avatar}>
                                <span style={{ fontSize: '1.2rem' }}>✨</span>
                            </div>
                            <div>
                                <div style={chatStyles.avatarName}>Zia</div>
                                <div style={chatStyles.avatarStatus}>
                                    <span style={{
                                        ...chatStyles.statusDot,
                                        background: retryCountdown > 0 ? '#FF9800' : '#4CAF50',
                                    }} />
                                    {retryCountdown > 0
                                        ? (lang === 'bs' ? `Pokušavam ponovo za ${retryCountdown}s...` : `Retrying in ${retryCountdown}s...`)
                                        : isLoading
                                            ? (lang === 'bs' ? 'Tipka...' : 'Typing...')
                                            : (lang === 'bs' ? 'Online • AI Agent' : 'Online • AI Agent')}
                                </div>
                            </div>
                        </div>
                        <div style={chatStyles.headerActions}>
                            <button onClick={clearChat} style={chatStyles.actionBtn} title={lang === 'bs' ? 'Novi razgovor' : 'New conversation'}>↺</button>
                            <button onClick={handleMinimize} style={chatStyles.actionBtn} title={lang === 'bs' ? 'Minimiziraj' : 'Minimize'}>
                                {isMinimized ? '▲' : '▼'}
                            </button>
                            <button onClick={handleClose} style={{ ...chatStyles.actionBtn, ...chatStyles.closeBtn }} title={lang === 'bs' ? 'Zatvori' : 'Close'}>✕</button>
                        </div>
                    </div>

                    {/* Body — hidden when minimized */}
                    {!isMinimized && (
                        <>
                            {/* Messages — drag-drop zone */}
                            <div
                                style={{ ...chatStyles.messages, position: 'relative' }}
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
                                onDrop={e => { e.preventDefault(); setIsDragging(false); handleFilesSelected(e.dataTransfer.files); }}
                            >
                                {isDragging && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,191,166,0.12)', border: '2px dashed #00BFA6', borderRadius: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#00BFA6', fontWeight: 700, fontSize: '0.95rem', pointerEvents: 'none' }}>
                                        <span style={{ fontSize: '2rem' }}>📎</span>
                                        {lang === 'bs' ? 'Ispustite datoteke ovdje' : 'Drop files here'}
                                    </div>
                                )}
                                {messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            ...chatStyles.messageRow,
                                            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        }}
                                    >
                                        {msg.role === 'assistant' && (
                                            <div style={chatStyles.botAvatarSmall}>✨</div>
                                        )}
                                        <div style={{
                                            ...chatStyles.bubble,
                                            ...(msg.role === 'user' ? chatStyles.userBubble : chatStyles.botBubble),
                                        }}>
                                            {/* Attachment previews inside bubble */}
                                            {msg.attachmentPreviews?.length > 0 && (
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                                    {msg.attachmentPreviews.map((att, ai) => att.preview
                                                        ? <img key={ai} src={att.preview} alt={att.name} style={{ maxWidth: 140, maxHeight: 140, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                                                        : <div key={ai} style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.15)', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600 }}>📄 {att.name}</div>
                                                    )}
                                                </div>
                                            )}
                                            <div style={chatStyles.bubbleContent}>
                                                {renderMessageContent(msg.content)}
                                            </div>
                                            <div style={chatStyles.timestamp}>{formatTime(msg.timestamp)}</div>
                                        </div>
                                    </div>
                                ))}

                                {/* Loading indicator */}
                                {isLoading && (
                                    <div style={{ ...chatStyles.messageRow, justifyContent: 'flex-start' }}>
                                        <div style={chatStyles.botAvatarSmall}>✨</div>
                                        <div style={{ ...chatStyles.bubble, ...chatStyles.botBubble }}>
                                            <div style={{ display: 'flex', gap: 4, padding: '4px 2px', alignItems: 'center' }}>
                                                <span className="ai-typing-dot" />
                                                <span className="ai-typing-dot" />
                                                <span className="ai-typing-dot" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Suggestions */}
                            {showSuggestions && messages.length <= 1 && (
                                <div style={chatStyles.suggestions}>
                                    <div style={chatStyles.suggestionsLabel}>
                                        {lang === 'bs' ? 'Česta pitanja:' : 'Quick questions:'}
                                    </div>
                                    <div style={chatStyles.suggestionsGrid}>
                                        {suggestions.map((s, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSuggestion(s)}
                                                style={chatStyles.suggestionChip}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-glow-strong)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Input */}
                            <div style={chatStyles.inputArea}>
                                {/* Attachment previews */}
                                {attachments.length > 0 && (
                                    <div style={{ display: 'flex', gap: 6, padding: '4px 12px 0', flexWrap: 'wrap' }}>
                                        {attachments.map((att, i) => (
                                            <div key={i} style={{ position: 'relative', display: 'inline-flex' }}>
                                                {att.preview
                                                    ? <img src={att.preview} alt={att.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                                                    : <div style={{ width: 48, height: 48, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📄</div>
                                                }
                                                <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: '#EF4444', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, lineHeight: 1 }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={chatStyles.inputWrapper}>
                                    {/* Hidden file input */}
                                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.csv" style={{ display: 'none' }} onChange={e => { handleFilesSelected(e.target.files); e.target.value = ''; }} />
                                    {/* + attach button */}
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isLoading}
                                        title={lang === 'bs' ? 'Priloži datoteku' : 'Attach file'}
                                        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'var(--text-muted)', transition: 'all 0.15s', marginRight: 4 }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#00BFA6'; e.currentTarget.style.color = '#00BFA6'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                    >+</button>
                                    <textarea
                                        ref={inputRef}
                                        id="ai-assistant-input"
                                        style={chatStyles.input}
                                        placeholder={lang === 'bs' ? 'Postavite pitanje Zia...' : 'Ask Zia a question...'}
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        rows={1}
                                        onInput={e => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                                        }}
                                    />
                                    <button
                                        id="ai-assistant-send"
                                        onClick={() => sendMessage(inputValue)}
                                        disabled={(!inputValue.trim() && attachments.length === 0) || isLoading || retryCountdown > 0}
                                        style={{
                                            ...chatStyles.sendBtn,
                                            opacity: ((!inputValue.trim() && attachments.length === 0) || isLoading || retryCountdown > 0) ? 0.4 : 1,
                                        }}
                                        title={lang === 'bs' ? 'Pošalji' : 'Send'}
                                    >
                                        ➤
                                    </button>
                                </div>
                                <div style={chatStyles.inputFooter}>
                                    {lang === 'bs' ? 'Pokretano sa Google Gemini' : 'Powered by Google Gemini'} ·{' '}
                                    {lang === 'bs' ? 'Enter za slanje • + za prilog' : 'Enter to send • + to attach'}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── CSS Animations ── */}
            <style>{`
                @keyframes aiPulse {
                    0%, 100% { box-shadow: 0 4px 20px rgba(0,191,166,0.4), 0 0 0 0 rgba(0,191,166,0.4); }
                    50% { box-shadow: 0 4px 20px rgba(0,191,166,0.6), 0 0 0 12px rgba(0,191,166,0); }
                }
                @keyframes aiTyping {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30% { transform: translateY(-6px); opacity: 1; }
                }
                #ai-assistant-input:focus { outline: none; }
                #ai-assistant-fab:hover { transform: scale(1.08) translateY(-2px) !important; }
            `}</style>
        </>
    );
}
// ─── Styles ─────────────────────────────────────────────────────────────────
const fabStyles = {
    fab: {
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #00BFA6, #009985)',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,191,166,0.45)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        gap: 1,
    },
    fabIcon: {
        fontSize: '1.3rem',
        lineHeight: 1,
    },
    fabLabel: {
        fontSize: '0.55rem',
        fontWeight: 700,
        color: 'white',
        fontFamily: 'var(--font-heading)',
        letterSpacing: 0.5,
    },
    fabBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: '#F44336',
        border: '2px solid white',
    },
};

const makeChatStyles = (isDark) => ({
    window: {
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 999,
        width: 380,
        background: isDark ? 'var(--bg-card)' : 'white',
        borderRadius: 20,
        boxShadow: isDark
            ? '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,191,166,0.2)'
            : '0 20px 60px rgba(11,42,60,0.2), 0 0 0 1px rgba(0,191,166,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'var(--font-body)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #0B2A3C, #143d54)',
        flexShrink: 0,
        WebkitUserSelect: 'none',
        userSelect: 'none',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #00BFA6, #4CAF50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,191,166,0.4)',
        WebkitUserSelect: 'none',
        userSelect: 'none',
    },
    avatarName: {
        color: 'white',
        fontWeight: 700,
        fontSize: '0.9rem',
        fontFamily: 'var(--font-heading)',
        WebkitUserSelect: 'none',
        userSelect: 'none',
    },
    avatarStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.7rem',
        color: 'rgba(255,255,255,0.6)',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#4CAF50',
        flexShrink: 0,
    },
    headerActions: {
        display: 'flex',
        gap: 4,
    },
    actionBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        fontWeight: 600,
    },
    closeBtn: {
        background: 'rgba(244,67,54,0.15)',
        borderColor: 'rgba(244,67,54,0.3)',
        color: '#ef9a9a',
    },
    messages: {
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: isDark ? 'var(--bg-body)' : '#f8fafb',
    },
    messageRow: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
    },
    botAvatarSmall: {
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #00BFA6, #4CAF50)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: '0.75rem',
    },
    bubble: {
        maxWidth: '78%',
        padding: '10px 14px',
        borderRadius: 16,
        fontSize: '0.85rem',
        lineHeight: 1.5,
    },
    userBubble: {
        background: 'linear-gradient(135deg, #00BFA6, #009985)',
        color: 'white',
        borderBottomRightRadius: 4,
    },
    botBubble: {
        background: isDark ? 'var(--bg-card)' : 'white',
        color: isDark ? 'var(--text)' : '#263238',
        border: isDark ? '1px solid var(--border)' : '1px solid #eef2f5',
        borderBottomLeftRadius: 4,
        boxShadow: isDark
            ? '0 1px 4px rgba(0,0,0,0.3)'
            : '0 1px 3px rgba(11,42,60,0.06)',
    },
    bubbleContent: {
        wordBreak: 'break-word',
    },
    timestamp: {
        fontSize: '0.65rem',
        opacity: 0.6,
        marginTop: 4,
        textAlign: 'right',
    },
    typingDots: {
        display: 'flex',
        gap: 4,
        padding: '4px 2px',
        '& span': {
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#90A4AE',
            animation: 'aiTyping 1.2s ease-in-out infinite',
        },
    },
    suggestions: {
        padding: '8px 14px 4px',
        background: isDark ? 'var(--bg-card)' : 'white',
        borderTop: isDark ? '1px solid var(--border)' : '1px solid #eef2f5',
        flexShrink: 0,
    },
    suggestionsLabel: {
        fontSize: '0.7rem',
        color: isDark ? 'var(--text-muted)' : '#90A4AE',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    suggestionsGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        maxHeight: 120,
        overflowY: 'auto',
    },
    suggestionChip: {
        padding: '5px 10px',
        borderRadius: 20,
        border: '1px solid rgba(0,191,166,0.3)',
        background: isDark ? 'rgba(0,191,166,0.12)' : 'rgba(0,191,166,0.08)',
        color: isDark ? 'var(--primary)' : '#009985',
        cursor: 'pointer',
        fontSize: '0.75rem',
        fontWeight: 500,
        fontFamily: 'var(--font-body)',
        transition: 'background 0.15s',
        whiteSpace: 'nowrap',
    },
    inputArea: {
        padding: '10px 14px 12px',
        borderTop: isDark ? '1px solid var(--border)' : '1px solid #eef2f5',
        flexShrink: 0,
        background: isDark ? 'var(--bg-card)' : 'white',
    },
    inputWrapper: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        background: isDark ? 'var(--bg-input)' : '#f8fafb',
        border: isDark ? '2px solid var(--border)' : '2px solid #dde4e9',
        borderRadius: 14,
        padding: '6px 8px 6px 14px',
        transition: 'border-color 0.15s',
    },
    input: {
        flex: 1,
        border: 'none',
        background: 'transparent',
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        color: isDark ? 'var(--text)' : '#263238',
        resize: 'none',
        lineHeight: 1.5,
        maxHeight: 100,
        overflow: 'auto',
    },
    sendBtn: {
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: 'none',
        background: 'linear-gradient(135deg, #00BFA6, #009985)',
        color: 'white',
        cursor: 'pointer',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'opacity 0.15s, transform 0.15s',
    },
    inputFooter: {
        fontSize: '0.65rem',
        color: isDark ? 'var(--text-muted)' : '#90A4AE',
        textAlign: 'center',
        marginTop: 6,
    },
    navLink: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 20,
        border: '1px solid rgba(0,191,166,0.4)',
        background: isDark ? 'rgba(0,191,166,0.12)' : 'rgba(0,191,166,0.08)',
        color: isDark ? 'var(--primary)' : '#009985',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
        fontFamily: 'var(--font-body)',
        margin: '2px 0',
        transition: 'background 0.15s',
    },
});
