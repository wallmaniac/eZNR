'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter, usePathname } from 'next/navigation';
import { useCountry } from '@/contexts/CountryContext';
import { getRawAll } from '@/lib/dataStore';
import { useAuth } from '@/contexts/AuthContext';
import { apiCallZia } from '@/lib/ziaAPI';

// ─── PII Sanitization Interceptors ──────────────────────────────────────────
const globalWorkerMap = {};

function maskPIIInput(text, workers) {
    if (!text) return text;
    let masked = text;
    // Sort descending by name length to match longer names first
    const sorted = [...workers].sort((a,b) => (`${b.ime} ${b.prezime}`.length) - (`${a.ime} ${a.prezime}`.length));
    sorted.forEach(w => {
        globalWorkerMap[w.id] = `${w.ime} ${w.prezime}`;
        const fullName = `${w.ime} ${w.prezime}`.trim();
        const firstName = (w.ime || '').trim();
        
        // Replace full name matches
        if (fullName) {
            // Basic regex to match name regardless of some suffixes
            const escaped = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Try to match the full name with optional suffixes (a, u, e, om, em, i)
            const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(a|u|e|om|em|i)?(?![\\p{L}\\p{N}])`, 'gui');
            masked = masked.replace(regex, `W[${w.id}]`);
        }
        // Replace just first name if it's unique and long enough
        if (firstName && firstName.length > 3) {
            const sameFirstNameCount = workers.filter(x => x.ime === w.ime).length;
            if (sameFirstNameCount === 1) {
                const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regexFirst = new RegExp(`(?<![\\p{L}\\p{N}])${escapedFirst}(a|u|e|om|em|i)?(?![\\p{L}\\p{N}])`, 'gui');
                masked = masked.replace(regexFirst, `W[${w.id}]`);
            }
        }
    });
    return masked;
}

function unmaskPIIOutput(text) {
    if (!text) return text;
    return text.replace(/W\[([^\]]+)\]/g, (match, id) => {
        return globalWorkerMap[id] ? `**${globalWorkerMap[id]}**` : match;
    });
}

// ─── App knowledge base for the AI system prompt ───────────────────────────
const APP_KNOWLEDGE = {
    pages: [
        { path: '/dashboard', label_bs: 'Kontrolna ploča', label_en: 'Dashboard', desc_en: 'Main overview with statistics, calendar and recent activity', desc_bs: 'Pregled statistika, kalendara i nedavnih aktivnosti' },
        { path: '/dashboard/news', label_bs: 'Početna / Novosti', label_en: 'Home / News', desc_en: 'News, laws and regulations about occupational safety', desc_bs: 'Novosti, zakoni i pravilnici o zaštiti na radu' },
        { path: '/dashboard/org-units', label_bs: 'Organizacijske jedinice', label_en: 'Organizational Units', desc_en: 'Manage company departments and organizational structure', desc_bs: 'Upravljanje odjelima i organizacijskom strukturom firme' },
        { path: '/dashboard/org-groups', label_bs: 'Grupe org. jedinica', label_en: 'Org. Unit Groups', desc_en: 'Group organizational units for easier management', desc_bs: 'Grupiranje organizacijskih jedinica za lakše upravljanje' },
        { path: '/dashboard/workplaces', label_bs: 'Radna mjesta', label_en: 'Workplaces', desc_en: 'Define and manage job positions and workplaces', desc_bs: 'Definisanje i upravljanje radnim mjestima' },
        { path: '/dashboard/workplace-list', label_bs: 'Popis radnih mjesta', label_en: 'Workplace List', desc_en: 'Report listing all workplaces and their details', desc_bs: 'Izvještaj sa popisom svih radnih mjesta i njihovim detaljima' },
        { path: '/dashboard/sistematizacija', label_bs: 'Sistematizacija', label_en: 'Systematization', desc_en: 'Job systematization rules and requirements', desc_bs: 'Sistematizacija radnih mjesta i obrazovanja' },
        { path: '/dashboard/workers', label_bs: 'Radnici', label_en: 'Workers', desc_en: 'Manage employees: personal data, certificates, training, PPE', desc_bs: 'Upravljanje radnicima: lični podaci, uvjerenja, obuke, zaštitna oprema' },
        { path: '/dashboard/medical-exams', label_bs: 'Ljekarski pregledi', label_en: 'Medical Exams', desc_en: 'Track and manage worker medical examinations', desc_bs: 'Praćenje i upravljanje ljekarskim pregledima radnika' },
        { path: '/dashboard/trainings', label_bs: 'Obuke iz ZNR/ZOP', label_en: 'Safety Trainings', desc_en: 'Occupational safety and fire protection trainings', desc_bs: 'Obuke iz zaštite na radu i zaštite od požara' },
        { path: '/dashboard/tests-zop-znr', label_bs: 'Testovi ZNR/ZOP', label_en: 'ZNR/ZOP Tests', desc_en: 'Results of worker safety knowledge tests', desc_bs: 'Rezultati provjere znanja radnika iz sigurnosti' },
        { path: '/dashboard/training-book', label_bs: 'Matična knjiga osposobljavanja', label_en: 'Training Master Book', desc_en: 'Official training records for all workers', desc_bs: 'Zvanična evidencija obuke za sve radnike' },
        { path: '/dashboard/worker-certificates', label_bs: 'Uvjerenja radnika', label_en: 'Worker Certificates', desc_en: 'List and track all worker training certificates and expiry dates', desc_bs: 'Lista i praćenje svih uvjerenja radnika i datuma isteka' },
        { path: '/dashboard/equipment', label_bs: 'Radna oprema i objekti', label_en: 'Equipment & Testing Objects', desc_en: 'Track work equipment and testing facilities with inspection records', desc_bs: 'Praćenje radne opreme i objekata ispitivanja s evidencijom pregleda' },
        { path: '/dashboard/ppe', label_bs: 'Katalog OZO', label_en: 'PPE Catalog', desc_en: 'Catalog of personal protective equipment items', desc_bs: 'Katalog lične zaštitne opreme (OZO)' },
        { path: '/dashboard/worker-ppe', label_bs: 'Zaduženja OZO radnika', label_en: 'Worker PPE assignments', desc_en: 'Track PPE assigned to each worker', desc_bs: 'Praćenje zaštitne opreme dodijeljene svakom radniku' },
        { path: '/dashboard/injuries', label_bs: 'Povrede na radu', label_en: 'Work Injuries', desc_en: 'Report and full list of recorded workplace injuries', desc_bs: 'Prijava i popis svih evidentiranih povreda na radu' },
        { path: '/dashboard/diseases', label_bs: 'Profesionalne bolesti', label_en: 'Professional Diseases', desc_en: 'Report professional diseases to authorities', desc_bs: 'Evidencija profesionalnih bolesti' },
        { path: '/dashboard/form-oir1', label_bs: 'Obrazac OIR1', label_en: 'Form OIR1', desc_en: 'Official injury report form OIR1', desc_bs: 'Zvanični obrazac za prijavu povrede OIR1' },
        { path: '/dashboard/annual-injuries', label_bs: 'Godišnji izvještaj o povredama', label_en: 'Annual Injury Report', desc_en: 'Annual statistics and reporting on workplace injuries', desc_bs: 'Godišnja statistika i izvještavanje o povredama na radu' },
        { path: '/dashboard/referral-ra1', label_bs: 'Ljekarska uputnica RA1', label_en: 'Medical Referral RA1', desc_en: 'Generate RA1 medical referral forms for workers', desc_bs: 'Generisanje RA1 ljekarskih uputnica za radnike' },
        { path: '/dashboard/form-ro1', label_bs: 'Obrazac RO1', label_en: 'Form RO1', desc_en: 'RO1 report form for occupational safety', desc_bs: 'Obrazac RO1 za zaštitu na radu' },
        { path: '/dashboard/form-ro2', label_bs: 'Obrazac RO2', label_en: 'Form RO2', desc_en: 'RO2 report form for occupational safety', desc_bs: 'Obrazac RO2 za zaštitu na radu' },
        { path: '/dashboard/night-work', label_bs: 'Uputnica za noćni rad', label_en: 'Night Work Referral', desc_en: 'Medical referrals and records for night shift workers', desc_bs: 'Ljekarske uputnice i evidencija za radnike na noćnoj smjeni' },
        { path: '/dashboard/fleet', label_bs: 'Vozni park', label_en: 'Fleet Management', desc_en: 'Manage company vehicles and fleet', desc_bs: 'Upravljanje službenim vozilima' },
        { path: '/dashboard/fleet-assignments', label_bs: 'Zaduženja vozila', label_en: 'Fleet Assignments', desc_en: 'Track which worker is assigned which vehicle', desc_bs: 'Evidencije koja vozila duže radnici' },
        { path: '/dashboard/fleet-orders', label_bs: 'Putni nalozi', label_en: 'Travel Orders', desc_en: 'Manage vehicle travel orders', desc_bs: 'Upravljanje putnim nalozima i vožnjama' },
        { path: '/dashboard/fleet-documents', label_bs: 'Dokumentacija flote', label_en: 'Fleet Docs', desc_en: 'Insurance and registration documents for vehicles', desc_bs: 'Dokumenti registracije i osiguranja vozila' },
        { path: '/dashboard/fire-protection', label_bs: 'Zaštita od požara (ZOP)', label_en: 'Fire Protection', desc_en: 'Manage fire extinguishers and hydrants', desc_bs: 'Upravljanje PP aparatima i hidrantima' },
        { path: '/dashboard/evacuation', label_bs: 'Plan evakuacije', label_en: 'Evacuation Plan', desc_en: 'Evacuation maps and emergency procedures', desc_bs: 'Mape evakuacije i procedure spašavanja' },
        { path: '/dashboard/evacuation-drills', label_bs: 'Vježbe evakuacije', label_en: 'Evacuation Drills', desc_en: 'Records of conducted fire and evacuation drills', desc_bs: 'Zapisnici o provedenim vježbama evakuacije' },
        { path: '/dashboard/archive', label_bs: 'Digitalna arhiva', label_en: 'Digital Archive', desc_en: 'Store and manage all company documents digitally', desc_bs: 'Čuvanje i upravljanje svim dokumentima firme digitalno' },
        { path: '/dashboard/observations', label_bs: 'Prijava opasnosti', label_en: 'Hazard Reports', desc_en: 'Report and track workplace hazards and safety observations', desc_bs: 'Prijava i praćenje uočenih opasnosti na radnom mjestu' },
        { path: '/dashboard/service-records', label_bs: 'Servisni zapisi', label_en: 'Service Records', desc_en: 'Equipment service history and maintenance logs', desc_bs: 'Historija servisa i održavanja opreme' },
        { path: '/dashboard/import', label_bs: 'Excel uvoz', label_en: 'Excel Import', desc_en: 'Bulk import workers, equipment and certificates from Excel files', desc_bs: 'Masovni uvoz radnika, opreme i uvjerenja iz Excel datoteka' },
        { path: '/dashboard/company-profile', label_bs: 'Profil firme', label_en: 'Company Profile', desc_en: 'View and edit company information and legal details', desc_bs: 'Pregled i uređivanje podataka o firmi' },
        { path: '/dashboard/requests', label_bs: 'Zahtjevnice', label_en: 'Requests', desc_en: 'Manage procurement and material requests', desc_bs: 'Upravljanje zahtjevnicama za nabavku opreme' },
        { path: '/dashboard/risk-assessment', label_bs: 'Procjena rizika', label_en: 'Risk Assessment', desc_en: 'Perform and document workplace risk assessments', desc_bs: 'Provođenje i dokumentovanje procjene rizika na radnom mjestu' },
        { path: '/dashboard/questionnaires', label_bs: 'Upitnici/Ankete', label_en: 'Questionnaires', desc_en: 'Create and manage safety questionnaires for workers', desc_bs: 'Kreiranje upitnika i on-line testiranja za radnike' },
        { path: '/dashboard/zapisnici', label_bs: 'Zapisnici', label_en: 'Meeting Minutes', desc_en: 'Meeting minutes and safety committee records', desc_bs: 'Zapisnici sa sastanaka odbora za zaštitu na radu' },
        { path: '/dashboard/countries', label_bs: 'Šifrarnik - Države', label_en: 'Countries Reference', desc_en: 'Reference list of countries', desc_bs: 'Šifrarnici: Lista država' },
        { path: '/dashboard/counties', label_bs: 'Šifrarnik - Kantoni', label_en: 'Counties Reference', desc_en: 'Reference list of counties in BiH', desc_bs: 'Šifrarnici: Kantoni i županije' },
        { path: '/dashboard/places', label_bs: 'Šifrarnik - Mjesta', label_en: 'Places Reference', desc_en: 'Reference list of cities', desc_bs: 'Šifrarnici: Gradovi i općine' },
        { path: '/dashboard/authorized-companies', label_bs: 'Ovlaštene firme', label_en: 'Authorized Companies', desc_en: 'Registered companies authorized for safety inspections', desc_bs: 'Ovlaštene ustanove za inspekcije i preglede' },
        { path: '/dashboard/examiners', label_bs: 'Ispitivači', label_en: 'Examiners', desc_en: 'Personnel authorized to conduct safety examinations', desc_bs: 'Ososbe ovlaštene za sigurnosna ispitivanja' },
        { path: '/dashboard/doctors', label_bs: 'Doktori', label_en: 'Doctors', desc_en: 'Occupational medicine doctors for worker health checks', desc_bs: 'Ljekari medicine rada' },
        { path: '/dashboard/exam-types', label_bs: 'Tipovi pregleda', label_en: 'Exam Types', desc_en: 'Define types of medical and safety examinations', desc_bs: 'Kategorije pregleda' },
        { path: '/dashboard/cert-types', label_bs: 'Tipovi uvjerenja', label_en: 'Cert Types', desc_en: 'Define types of worker certifications and training', desc_bs: 'Kategorije uvjerenja o osposobljavanju' },
        { path: '/dashboard/equipment-types', label_bs: 'Vrste opreme', label_en: 'Equipment Types', desc_en: 'Categorize work equipment', desc_bs: 'Kategorije mašina i uređaja' },
        { path: '/dashboard/file-types', label_bs: 'Vrsta datoteke', label_en: 'File Types', desc_en: 'Define file type categories for the digital archive', desc_bs: 'Kategorije arhive' },
        { path: '/dashboard/extra-fields', label_bs: 'Dodatna polja', label_en: 'Extra Fields', desc_en: 'Add custom data fields', desc_bs: 'Razna dodatna polja po entitetima' },
        { path: '/dashboard/address-book', label_bs: 'Adresar', label_en: 'Address Book', desc_en: 'Contact directory of workers and companies', desc_bs: 'Imenik klijenata i firmi' },
        { path: '/dashboard/ek-workers', label_bs: 'EK - Radnici', label_en: 'EK - Workers', desc_en: 'Worker records exported for EK format', desc_bs: 'Radnici za e-katastar (EK)' },
        { path: '/dashboard/ek-equipment', label_bs: 'EK - Oprema', label_en: 'EK - Equipment', desc_en: 'Equipment records exported for EK format', desc_bs: 'Oprema za e-katastar (EK)' },
        { path: '/dashboard/ek-ppe', label_bs: 'EK - OZO', label_en: 'EK - PPE', desc_en: 'PPE data exported for EK format', desc_bs: 'OZO za e-katastar (EK)' },
        { path: '/dashboard/isznr-documents', label_bs: 'ISZNR Dokumenti', label_en: 'ISZNR Documents', desc_en: 'Official documents submitted to the ISZNR system', desc_bs: 'Dokumenti za nacionalni informacioni sistem (ISZNR)' },
        { path: '/dashboard/isznr-parties', label_bs: 'ISZNR Stranke', label_en: 'ISZNR Parties', desc_en: 'Parties and clients in the ISZNR system', desc_bs: 'Klijenti za informacioni sistem (ISZNR)' },
        { path: '/dashboard/isznr-doc-types', label_bs: 'ISZNR Tipovi', label_en: 'ISZNR Types', desc_en: 'Document type definitions for ISZNR', desc_bs: 'Tipovi dokumenata za sistem (ISZNR)' },
        { path: '/dashboard/isznr-signing', label_bs: 'Digitalno potpisivanje', label_en: 'Digital Signing', desc_en: 'Digitally sign ISZNR documents', desc_bs: 'Masovno digitalno potpisivanje PDF fajlova' },
        { path: '/dashboard/isznr-examiners', label_bs: 'ISZNR Ispitivači', label_en: 'ISZNR Examiners', desc_en: 'Examiners registered in ISZNR', desc_bs: 'Lista ispitivača povezanih na nacionalnu mrežu' },
        { path: '/dashboard/isznr-measure-equipment', label_bs: 'Mjerna oprema (ISZNR)', label_en: 'Measuring Equip.', desc_en: 'Calibrated measuring and testing equipment', desc_bs: 'Laboratorijska i mjerna oprema ISZNR' },
        { path: '/dashboard/employer-docs', label_bs: 'Dokumentacija za poslodavca', label_en: 'Employer Docs', desc_en: 'Mandatory employer safety documentation', desc_bs: 'Obavezni normativni akti poslodavaca' },
        { path: '/dashboard/znr-zakonodavstvo', label_bs: 'Zakonodavstvo / Baza znanja', label_en: 'Legislation Base', desc_en: 'Library of safety laws and standard operational procedures', desc_bs: 'Pravna baza ZNR, propisi, i pravilnici' },
        { path: '/dashboard/settings', label_bs: 'Postavke Sistema', label_en: 'Settings', desc_en: 'Application settings, user profile and company information', desc_bs: 'Glavne postavke organizacije i aplikacije' }
    ],
};

// ─── Live data context builder ────────────────────────────────────────────────
function buildDataContext(lang, activeCompanyId, userCompanies, t) {
    if (typeof window === 'undefined') return '';
    try {
        const get = (key) => getRawAll(key);

        const workers = get('workers');
        const injuries = get('injuries');
        const diseases = get('diseases');
        const certificates = get('certificates');
        const equipment = get('equipment');
        const questionnaires = get('questionnaires');
        const vehicles = get('vehicles');
        const fireExtinguishers = get('fireExtinguishers');
        const calendarEvents = get('calendarEvents');
        const medicalExams = get('medicalExams');
        const employerDocs = get('employerDocs');
        const riskAssessments = get('riskAssessments');
        const riskItems = get('riskItems');
        const safetyObservations = get('safety_observations');
        const evacuationPlans = get('evacuationPlans');
        const evacuationDrills = get('evacuationDrills');
        const trainings = get('trainings');
        const ppeAssignments = get('ppeAssignments');
        const serviceLog = get('serviceLog');

        const lines = [];
        
        // Add multi-tenant context awareness
        const activeCompName = activeCompanyId === 'all' 
            ? (t('sveDodijeljeneFirmeAgregatniPrikaz'))
            : (userCompanies?.find(c => c.id === activeCompanyId)?.naziv || activeCompanyId);
            
        lines.push(t('currentCompanyContextWhenAnswering').replace('{0}', activeCompName)
        );

        const today = new Date();
        const in30 = new Date(); in30.setDate(in30.getDate() + 30);
        const in60 = new Date(); in60.setDate(in60.getDate() + 60);

        // ── PII SANITIZATION: We ONLY send W[id] to the AI! ──
        const injuryBol = injuries.filter(i => i.bolovanje && i.status !== 'zatvorena').map(i => ({ id: i.radnikId, src: 'injury' }));
        const diseaseBol = diseases.filter(d => d.bolovanje && d.status !== 'zatvorena').map(d => ({ id: d.radnikId, src: 'disease' }));
        const allBol = [...injuryBol, ...diseaseBol].filter((b, i, arr) => b.id && arr.findIndex(x => x.id === b.id) === i);
        lines.push(lang !== 'en'
            ? `\nRADNICI NA BOLOVANJU (${allBol.length}): ${allBol.length === 0 ? 'Nema.' : allBol.map(b => `W[${b.id}] (${b.src === 'injury' ? 'povreda' : 'bolest'})`).join(', ')}`
            : `\nWORKERS ON SICK LEAVE (${allBol.length}): ${allBol.length === 0 ? 'None.' : allBol.map(b => `W[${b.id}] (${b.src === 'injury' ? 'injury' : 'disease'})`).join(', ')}`
        );

        // Calendar Events
        const upcomingEvents = calendarEvents.filter(e => e.datum && new Date(e.datum) >= today).sort((a,b) => new Date(a.datum) - new Date(b.datum));
        if (upcomingEvents.length > 0) {
            lines.push(lang !== 'en'
                ? `\nPREDSTOJEĆI DOGAĐAJI U KALENDARU (${upcomingEvents.length}): ${upcomingEvents.slice(0, 5).map(e => `${e.datum}: ${e.opis || e.tip}`).join('; ')}`
                : `\nUPCOMING CALENDAR EVENTS (${upcomingEvents.length}): ${upcomingEvents.slice(0, 5).map(e => `${e.datum}: ${e.opis || e.tip}`).join('; ')}`
            );
        }

        // Expired certificates
        const expiredCerts = certificates.filter(c => c.vrijediDo && new Date(c.vrijediDo) < today);
        const soonCerts = certificates.filter(c => c.vrijediDo && new Date(c.vrijediDo) >= today && new Date(c.vrijediDo) <= in30);
        
        if (expiredCerts.length > 0) {
            lines.push(lang !== 'en'
                ? `ISTEKLA UVJERENJA (${expiredCerts.length}): ${expiredCerts.slice(0, 8).map(c => `${c.ime || c.oznaka} — W[${c.workerId}] (isteklo: ${c.vrijediDo})`).join('; ')}`
                : `EXPIRED CERTIFICATES (${expiredCerts.length}): ${expiredCerts.slice(0, 8).map(c => `${c.ime || c.oznaka} — W[${c.workerId}] (expired: ${c.vrijediDo})`).join('; ')}`
            );
        }
        if (soonCerts.length > 0) {
            lines.push(lang !== 'en'
                ? `UVJERENJA KOJA USKORO ISTIČU - 30 DANA (${soonCerts.length}): ${soonCerts.slice(0, 8).map(c => `${c.ime || c.oznaka} — W[${c.workerId}] (ističe: ${c.vrijediDo})`).join('; ')}`
                : `CERTIFICATES EXPIRING SOON - 30 DAYS (${soonCerts.length}): ${soonCerts.slice(0, 8).map(c => `${c.ime || c.oznaka} — W[${c.workerId}] (expires: ${c.vrijediDo})`).join('; ')}`
            );
        }

        // Medical Exams
        const overdueMed = medicalExams.filter(m => m.vrijediDo && new Date(m.vrijediDo) < today);
        const soonMed = medicalExams.filter(m => m.vrijediDo && new Date(m.vrijediDo) >= today && new Date(m.vrijediDo) <= in60);
        if (overdueMed.length > 0) lines.push(lang !== 'en'
            ? `PREKORAČENI LJEKARSKI PREGLEDI (${overdueMed.length}): ${overdueMed.slice(0, 6).map(m => `W[${m.workerId}] (isteklo: ${m.vrijediDo})`).join('; ')}`
            : `OVERDUE MEDICAL EXAMS (${overdueMed.length}): ${overdueMed.slice(0, 6).map(m => `W[${m.workerId}] (expired: ${m.vrijediDo})`).join('; ')}`
        );
        if (soonMed.length > 0) lines.push(lang !== 'en'
            ? `LJEKARSKI PREGLEDI USKORO (${soonMed.length}): ${soonMed.slice(0, 6).map(m => `W[${m.workerId}] (ističe: ${m.vrijediDo})`).join('; ')}`
            : `MEDICAL EXAMS DUE SOON (${soonMed.length}): ${soonMed.slice(0, 6).map(m => `W[${m.workerId}] (expires: ${m.vrijediDo})`).join('; ')}`
        );

        // Employer Docs
        const docsObj = employerDocs.map(d => `${d.naziv} (Vrijedi do: ${d.datumIsteka || 'Nema roka'})`);
        if (docsObj.length > 0) {
            lines.push(t('nemployerDocumentation').replace('{0}', docsObj.join('; '))
            );
        }

        // Risk Assessments
        const activeAssessments = riskAssessments.filter(r => r.nazivProcjene);
        if (activeAssessments.length > 0) {
            lines.push(t('nactiveRiskAssessments').replace('{0}', activeAssessments.length).replace('{1}', activeAssessments.map(r => r.nazivTvrtke + ' - ' + r.nazivProcjene).join(', '))
            );
            const highRisks = riskItems.filter(ri => ri.rizik >= 16); // 16-20 Znatan, 21-25 Nedopustiv
            if (highRisks.length > 0) {
                lines.push(t('criticalRisksHighAndUnacceptable').replace('{0}', highRisks.length).replace('{1}', highRisks.slice(0, 10).map(ri => ri.opisOpasnosti + ' (' + ri.nivoRizika + ', R=' + ri.rizik + ')').join('; '))
                );
            }
        }

        // Overdue equipment
        const overdueEquip = equipment.filter(e => e.iduci && new Date(e.iduci) < today);
        const soonEquip = equipment.filter(e => e.iduci && new Date(e.iduci) >= today && new Date(e.iduci) <= in60);
        if (overdueEquip.length > 0) lines.push(lang !== 'en'
            ? `OPREMA S PREKORAČENIM PREGLEDOM (${overdueEquip.length}): ${overdueEquip.slice(0, 6).map(e => `${e.naziv} (trebalo do: ${e.iduci})`).join('; ')}`
            : `EQUIPMENT WITH OVERDUE INSPECTION (${overdueEquip.length}): ${overdueEquip.slice(0, 6).map(e => `${e.naziv} (was due: ${e.iduci})`).join('; ')}`
        );
        if (soonEquip.length > 0) lines.push(lang !== 'en'
            ? `OPREMA ČIJI PREGLED USKORO DOSPIJEVA - 60 DANA (${soonEquip.length}): ${soonEquip.slice(0, 6).map(e => `${e.naziv} (do: ${e.iduci})`).join('; ')}`
            : `EQUIPMENT INSPECTION DUE SOON - 60 DAYS (${soonEquip.length}): ${soonEquip.slice(0, 6).map(e => `${e.naziv} (due: ${e.iduci})`).join('; ')}`
        );

        // Fleet
        const activeVehicles = vehicles.filter(v => v.status === 'aktivan' || v.status === 'servis');
        if (activeVehicles.length > 0) {
            lines.push(lang !== 'en' 
                ? `\nVOZNI PARK (${activeVehicles.length} vozila): ${activeVehicles.map(v => `[ID:${v.id}] ${v.marka} ${v.model} (${v.registracija}, Vozač: ${v.vozacIme || 'Nema'})`).join('; ')}`
                : `\nFLEET (${activeVehicles.length} vehicles): ${activeVehicles.map(v => `[ID:${v.id}] ${v.marka} ${v.model} (${v.registracija}, Driver: ${v.vozacIme || 'None'})`).join('; ')}`
            );
            const expiredReg = activeVehicles.filter(v => v.registracijaIstice && new Date(v.registracijaIstice) < today);
            if (expiredReg.length > 0) lines.push(lang !== 'en' 
                ? `ISTEKLE REGISTRACIJE VOZILA (${expiredReg.length}): ${expiredReg.map(v => `${v.registracija} (isteklo: ${v.registracijaIstice})`).join('; ')}`
                : `EXPIRED VECHICLE REGISTRATIONS (${expiredReg.length}): ${expiredReg.map(v => `${v.registracija} (expired: ${v.registracijaIstice})`).join('; ')}`
            );
        }

        // Fire Extinguishers
        const overdueFire = fireExtinguishers.filter(f => f.datumSljedecegIspitivanja && new Date(f.datumSljedecegIspitivanja) < today);
        if (overdueFire.length > 0) lines.push(lang !== 'en'
            ? `VATROGASNI APARATI PREKORAČEN PREGLED (${overdueFire.length}): ${overdueFire.slice(0, 6).map(f => `${f.serijskiBroj} na lokaciji ${f.lokacija || 'Nepoznato'}`).join('; ')}`
            : `OVERDUE FIRE EXTINGUISHERS (${overdueFire.length}): ${overdueFire.slice(0, 6).map(f => `${f.serijskiBroj} at ${f.lokacija || 'Unknown'}`).join('; ')}`
        );

        // Recent injuries
        const recentInj = injuries.filter(i => i.datum && new Date(i.datum) >= new Date(Date.now() - 90 * 86400000)).sort((a, b) => new Date(b.datum) - new Date(a.datum));
        if (recentInj.length > 0) lines.push(lang !== 'en'
            ? `NEDAVNE POVREDE (90 dana, ${recentInj.length}): ${recentInj.slice(0, 6).map(i => `W[${i.radnikId}] ${i.datum} ${i.tip}${i.bolovanje ? ' BOLOVANJE' : ''}`).join('; ')}`
            : `RECENT INJURIES (90 days, ${recentInj.length}): ${recentInj.slice(0, 6).map(i => `W[${i.radnikId}] ${i.datum} ${i.tip}${i.bolovanje ? ' SICK LEAVE' : ''}`).join('; ')}`
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
                const compMatch = userCompanies?.find(c => c.id === w.companyId);
                const compStr = compMatch ? ` [Firma: ${compMatch.name}]` : '';
                return `W[${w.id}]${wp ? ` → ${wp}` : ''}${ou ? ` (${ou})` : ''}${compStr}`;
            });
            lines.push(t('nallActiveWorkersWithPositionsn').replace('{0}', activeWorkerList.length).replace('{1}', rosterLines.join('\n'))
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
                return `${wp.naziv}: ${assigned.map(w => `W[${w.id}]`).join(', ')}`;
            }).filter(Boolean);

            if (wpWorkers.length > 0) {
                lines.push(t('nworkplacesWorkersn').replace('{0}', wpWorkers.join('\n'))
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
                return `${ou.naziv}: ${assigned.map(w => `W[${w.id}]`).join(', ')}`;
            }).filter(Boolean);

            if (ouWorkers.length > 0) {
                lines.push(t('norgUnitsWorkersn').replace('{0}', ouWorkers.join('\n'))
                );
            }
        }

        // ── Questionnaires ─────────────────────────────────────────────────────
        if (questionnaires.length > 0) {
            const qList = questionnaires.map(q => `ID:${q.id} "${q.naziv || '(bez naziva)'}"${q.zaVrstu ? ` [${q.zaVrstu}]` : ''}`).join('; ');
            lines.push(t('nquestionnaires').replace('{0}', questionnaires.length).replace('{1}', qList));
        }

        // ── Safety Observations (Prijava opasnosti) ──────────────────────────────
        const openObs = safetyObservations.filter(o => o.status !== 'zatvorena' && o.status !== 'riješeno');
        if (openObs.length > 0) {
            lines.push(lang !== 'en'
                ? `\nOTVORENE PRIJAVE OPASNOSTI (${openObs.length}): ${openObs.slice(0, 8).map(o => `"${o.opis || o.lokacija || 'Bez opisa'}" (Lokacija: ${o.lokacija || '?'}, Status: ${o.status || 'nova'}, Datum: ${o.datum || '?'})`).join('; ')}`
                : `\nOPEN HAZARD REPORTS (${openObs.length}): ${openObs.slice(0, 8).map(o => `"${o.opis || o.lokacija || 'No desc'}" (Location: ${o.lokacija || '?'}, Status: ${o.status || 'new'}, Date: ${o.datum || '?'})`).join('; ')}`
            );
        }
        if (safetyObservations.length > 0 && openObs.length === 0) {
            lines.push(t('nhazardReportsAllReportsAre').replace('{0}', safetyObservations.length)
            );
        }

        // ── Evacuation Plans & Drills ────────────────────────────────────────────
        if (evacuationPlans.length > 0 || evacuationDrills.length > 0) {
            const planNames = evacuationPlans.slice(0, 5).map(p => `"${p.nazivObjekta || p.naziv || 'Plan'}" (Status: ${p.status || '?'})`);
            const drillNames = evacuationDrills.sort((a,b) => (b.datum || '').localeCompare(a.datum || '')).slice(0, 5).map(d => `"${d.nazivVjezbe || 'Vježba'}" (${d.datum || '?'}, Evakuirano: ${d.brojEvakuiranih || '?'})`);
            lines.push(t('nevacuationPlansDrills').replace('{0}', evacuationPlans.length).replace('{1}', planNames.length > 0 ? ': ' + planNames.join('; ') : '').replace('{2}', evacuationDrills.length).replace('{3}', drillNames.length > 0 ? ': ' + drillNames.join('; ') : '')
            );
        }

        // ── Trainings ────────────────────────────────────────────────────────────
        if (trainings.length > 0) {
            const recentTrainings = trainings.sort((a,b) => (b.datum || '').localeCompare(a.datum || '')).slice(0, 6);
            lines.push(lang !== 'en'
                ? `\nOBUKE (${trainings.length}): ${recentTrainings.map(t => `"${t.naziv || t.vrsta || 'Obuka'}" (${t.datum || '?'}, Polaznika: ${t.brojPolaznika || '?'})`).join('; ')}`
                : `\nTRAININGS (${trainings.length}): ${recentTrainings.map(t => `"${t.naziv || t.vrsta || 'Training'}" (${t.datum || '?'}, Attendees: ${t.brojPolaznika || '?'})`).join('; ')}`
            );
        }

        // ── PPE Assignments overview ─────────────────────────────────────────────
        if (ppeAssignments.length > 0) {
            const activePpe = ppeAssignments.filter(p => !p.datumRazduzenja);
            const ppeSummary = {};
            activePpe.forEach(p => { ppeSummary[p.naziv || 'Nepoznato'] = (ppeSummary[p.naziv || 'Nepoznato'] || 0) + (p.kolicina || 1); });
            const topPpe = Object.entries(ppeSummary).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([name, cnt]) => `${name}: ${cnt}`);
            lines.push(t('nactivePpeAssignments').replace('{0}', activePpe.length).replace('{1}', topPpe.join(', '))
            );
        }

        // ── Service Records (Equipment Maintenance) ────────────────────────────
        if (serviceLog.length > 0) {
            const recentServices = serviceLog.sort((a,b) => (b.datum || '').localeCompare(a.datum || '')).slice(0, 5);
            lines.push(lang !== 'en'
                ? `\nSERVISNI ZAPISI (${serviceLog.length}): ${recentServices.map(s => `"${s.opis || s.tip || 'Servis'}" (${s.datum || '?'}, Oprema: ${s.equipmentNaziv || s.equipmentId || '?'})`).join('; ')}`
                : `\nSERVICE RECORDS (${serviceLog.length}): ${recentServices.map(s => `"${s.opis || s.tip || 'Service'}" (${s.datum || '?'}, Equipment: ${s.equipmentNaziv || s.equipmentId || '?'})`).join('; ')}`
            );
        }

        // Stats
        const activeWorkers = workers.filter(w => w.aktivan !== false).length;
        const activePpeCount = ppeAssignments.filter(p => !p.datumRazduzenja).length;
        lines.push(t('nstatisticsActiveWorkersEquipmentCertificates').replace('{0}', activeWorkers).replace('{1}', equipment.length).replace('{2}', certificates.length).replace('{3}', questionnaires.length).replace('{4}', trainings.length).replace('{5}', safetyObservations.length).replace('{6}', activePpeCount)
        );

        return lines.join('\n');
    } catch { return ''; }
}

function buildSystemPrompt(lang, currentPath, dataContext, activeCompanyId, userCompanies, country, t) {
    const LANG_MAP = {
        bs: 'Bosnian (bosanski)',
        hr: 'Croatian (hrvatski)',
        sr: 'Serbian Latin (srpski latinica)',
        en: 'English (engleski)',
        de: 'German (njemački)',
        sl: 'Slovenian (slovenski)'
    };
    const targetLanguage = LANG_MAP[lang] || LANG_MAP.bs;

    const currentPage = APP_KNOWLEDGE.pages.find(p => p.path === currentPath);
    const pageDesc = currentPage
        ? (t('userIsCurrentlyOn').replace('{0}', currentPage.label_bs).replace('{1}', currentPage.desc_bs).replace('{2}', currentPage.label_en).replace('{3}', currentPage.desc_en))
        : '';

    const pagesText = APP_KNOWLEDGE.pages
        .map(p => t('tempKey').replace('{0}', p.label_bs).replace('{1}', p.path).replace('{2}', p.desc_bs).replace('{3}', p.label_en).replace('{4}', p.desc_en))
        .join('\n');

    const today = new Date().toLocaleDateString(t('bsba'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    if (lang !== 'en') {
        return `Ti si Zia, napredni AI AGENT za eZNR — digitalnu platformu za zaštitu na radu. Razgovaraš na jeziku: ${targetLanguage}. UVIJEK odgovaraj isključivo na tom jeziku. Danas je ${today}.

NISI SAMO CHATBOT I NAVIGATOR — TI SI NAPREDNI ANALITIČAR PODATAKA (DATA ANALYST). 
Tvoj zadatak je da direktno odgovaraš na pitanja korisnika o njihovoj firmi čitajući 'ŽIVE PODATKE' koji su ti proslijeđeni ispod.
VAŽNO ZA ZAŠTITU PODATAKA: Imena radnika su pseudonimizirana u format W[id]. Ako korisnik pita "Da li je Haso na bolovanju?", tvoj ulaz će već biti pretvoren u "Da li je W[123] na bolovanju?". Ti UVIJEK u odgovorima i pozivima alata koristi tačno taj isti W[id] token (npr. W[123]). Nikada ne pokušavaj izmisliti pravo ime. Mi ćemo ga na klijentu prevesti nazad u pravo ime. Zabranjeno je obrađivati JMBG i OIB. Ako korisnik sam unese JMBG ili OIB u chat, MORAŠ ga upozoriti u odgovoru da zbog GDPR/ZZPL zakona nemaš pravo prikupljati lične identifikacijske brojeve, te da ih mora unijeti ručno.

Ako te korisnik pita "koliko imamo radnika", "kakvo nam je stanje opreme", "imamo li nedavnih povreda", NEMOJ mu govoriti da nemaš pristup bazi. TI IMAŠ PRISTUP – svi ti podaci se nalaze u ovom promptu! PREBROJ, ANALIZIRAJ i odgovori vrlo precizno.

Možeš i aktivno pomagati pri kreiranju zapisa:
- Navigirati do stranica umjesto korisnika (koristi navigate_to alat)
- Otvoriti modal za slanje upitnika (koristi open_dispatch_modal alat)
- Direktno kreirati NOVOG RADNIKA u bazi (koristi create_new_worker alat nakon prikupljanja podataka)
- Otvoriti formu za PRIJAVU POVREDE za određenog radnika (koristi report_injury alat)
- Pomoći s kalendarom i opremom

- VAŽNO: NIKADA nemoj koristiti "dummy" ili izmišljene podatke. Ako ti nedostaju obavezni podaci za kreiranje zapisa, PITAJ KORISNIKA da ti ih proslijedi prije nego pozoveš alat.
- Ako korisnik kaže "idi na", "otvori", "prikaži stranicu" → ODMAH koristi navigate_to
- Ako korisnik želi poslati upitnik → koristi open_dispatch_modal s ID-om upitnika iz ŽIVIH PODATAKA
- Ako korisnik kaže "dodaj radnika", "novi radnik" → prikupi samo ime i prezime, zatim odmah koristi create_new_worker alat da SNIMIŠ radnika (OIB nije potreban).
- Ako korisnik kaže "povreda na radu", "ozljeda" → prikupi obavezne podatke (radnik, datum, tip), zatim koristi report_injury alat da SNIMIŠ u bazu.
- Ako korisnik kaže "dodaj uvjerenje", "novi pregled" → prikupi obavezne podatke (radnik, tip, datum, vrijediDo), zatim koristi add_certificate alat da SNIMIŠ u bazu.
- Ako korisnik navede trajanje (npr. "2 godine"), izračunaj vrijediDo = datum + trajanje i proslijeđi u alat
- Ako korisnik kaže da je radnik dobio opremu, zaštitna sredstva, kaciga, rukavice, prsluk, cipele ili slično (OZO) → koristi assign_ppe s worker_id iz ŽIVIH PODATAKA. Podrazumijevano: datum = danas, kolicina = 1, osim ako korisnik ne navede drugačije. Snima DIREKTNO — nije potrebna forma.
- Ako korisnik kaže da je radnik VRATIO, izgubio ili više nema OZO opremu → koristi remove_ppe s worker_id iz ŽIVIH PODATAKA. Alat će pronaći i obrisati zadnju aktivnu OZO stavku tog naziva.
- Ako korisnik pita za podatke koje već imaš → odgovori direktno bez alata
- Ako korisnik traži izmjenu svih povreda na radu za neku godinu → koristi alat bulk_update_injuries
- Ako korisnik kaže "dodaj vozilo", "novo vozilo", "napravi vozilo" → prikupi osnovne podatke (marka, model, registracija), zatim koristi create_vehicle alat da SNIMIŠ.
- Ako korisnik kaže da "zadužiš vozilo" nekom radniku, "prebaci auto", "daj vozilo" → koristi assign_vehicle sa vehicle_id (iz VOZNI PARK) i worker_id (iz SVI AKTIVNI RADNICI). Snima DIREKTNO, forma nije potrebna.
- Ako korisnik kaže "napravi događaj", "dodaj u kalendar" ili "podsjeti me" → prikupi datum i opis, pa koristi create_calendar_event. Ako kaže "idući ponedjeljak", preračunaj u YYYY-MM-DD.
- Ako korisnik kaže "dodaj ljekarski", "obavio ljekarski" → prikupi worker_id (iz SVI AKTIVNI RADNICI), tip pregleda (prethodni, periodični, vanredni), datum, rezultat (Sposoban/Nesposoban), pa koristi add_medical_exam.
- Ako korisnik kaže "vratio se sa bolovanja", "zatvori bolovanje" → koristi close_sick_leave sa worker_id. Pronalazi i zatvara otvoreno bolovanje u ŽIVIM PODACIMA.
- Ako korisnik pita "imamo li akt XYZ" ili pita za dokumente firme → prvo provjeri NORMATIVNI AKTI POSLODAVCA u svom kontekstu.
- Ako korisnik kaže "prijavi opasnost", "uočena opasnost", "opasan uvjet", "nesigurno" → prikupi opis i lokaciju, pa koristi create_observation. Podrazumijevano: datum = danas, prioritet = srednji.
- Ako korisnik kaže "održana obuka", "obuka ZNR", "obučeni radnici", "provedena obuka" → prikupi naziv i datum, pa koristi create_training. Podrazumijevano: vrsta = ZNR.
- Ako korisnik pita "imamo li otvorenih prijava opasnosti" ili "koliko je hazarda" → provjeri OTVORENE PRIJAVE OPASNOSTI u ŽIVIM PODACIMA i odgovori direktno.
- Ako korisnik pita "kad smo zadnji put imali vježbu evakuacije" → provjeri EVAKUACIJA u ŽIVIM PODACIMA.
- Ako korisnik pita "koliko obuka smo proveli" ili "koje obuke imamo" → provjeri OBUKE u ŽIVIM PODACIMA.
- VAŽNO O FIRMAMA: Ako je u kontekstu vidljivo da radnik pripada određenoj firmi, a trenutni kontekst je "Sve firme", obavezno u odgovorima spomeni i naziv firme radnika kako bi korisnik znao o kome se radi.

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
${country === 'HR' 
    ? '- Prijava ozljede na radu = HZZO obrazac za prijavu ozljede\n- Obrasci za redovne preglede opreme\n- Uputnica za liječnički pregled'
    : '- OIR-1 = Obrazac za izvještaj o povredi na radu (prijava inspektoratu)\n- RO-1, RO-2 = Obrasci za redovne preglede opreme\n- RA-1 = Ljekarska uputnica za pregled radnika\n- NR-1 = Uputnica za noćni rad'}

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
        return `You are Zia, an advanced AI AGENT for eZNR — a digital platform for occupational safety. You communicate in language: ${targetLanguage}. ALWAYS reply in this language. Today is ${today}.

YOU ARE NOT JUST A CHATBOT — YOU ARE AN AGENT. You can actively help officers complete tasks:
- Navigate to pages on their behalf (use navigate_to tool)
- Open the questionnaire dispatch modal (use open_dispatch_modal tool)
- Open a NEW WORKER form pre-filled with a name (use create_new_worker tool)
- Open an INJURY REPORT form pre-filled with a worker (use report_injury tool)
- Analyse data and give concrete recommendations

IMPORTANT DATA PROTECTION: Worker names are pseudonymized as W[id]. If the user asks "Is John on sick leave?", the input you receive will automatically be "Is W[123] on sick leave?". You must ALWAYS use W[123] in your responses and tool calls. Never try to invent a real name. We will translate it back on the client side. Processing JMBG or OIB is forbidden. If the user explicitly enters a JMBG or OIB in the chat, you MUST warn them in your response that due to GDPR/ZZPL laws you are not allowed to process personal identification numbers, and they must enter them manually.

- IMPORTANT: NEVER use "dummy" or fake data. If you are missing required data to create a record, ASK THE USER to provide it before calling the tool.
- If the user says "go to", "open", "show me" a page → USE navigate_to immediately
- If the user wants to send a questionnaire → use open_dispatch_modal with the questionnaire ID from LIVE DATA
- If the user says "add worker" or "new worker" → collect only first and last name, then immediately use create_new_worker to SAVE to database (OIB is not required).
- If the user mentions a work injury → collect required data (worker, date, type) via chat, then use report_injury to SAVE to database.
- If the user says "add certificate" → collect required data (worker, type, date, validUntil) via chat, then use add_certificate to SAVE to database.
- If user specifies duration (e.g. "2 years"), calculate vrijediDo = datum + duration and pass it to the tool
- If the user mentions assigning PPE (equipment, gloves, helmet, vest, boots, etc.) to a worker → use assign_ppe with worker_id from LIVE DATA. Default datum = today, default kolicina = 1 unless user specifies otherwise. This saves DIRECTLY — no form needed.
- If the user says a worker RETURNED, lost, or no longer has a PPE item → use remove_ppe with worker_id from LIVE DATA. The tool will find and delete the most recent active assignment matching the name.
- If the user asks about data you already have → answer directly without tools
- If the user asks to change the year for all work injuries → use bulk_update_injuries tool
- If the user says "add vehicle" or "new vehicle" → collect required data (marka, model, registracija) via chat, then use create_vehicle tool.
- If the user says to "assign vehicle" or "give car" to a worker → use assign_vehicle with vehicle_id (from FLEET) and worker_id (from LIVE DATA). Saves DIRECTLY.
- If the user says "add to calendar", "create event" or "remind me" → collect date and description, then use create_calendar_event. Calculate exact YYYY-MM-DD if they say "next Monday".
- If the user says "add medical exam", "did medical exam" → collect worker_id, type (prethodni, periodični, vanredni), date, result, and use add_medical_exam.
- If the user says "returned from sick leave", "close sick leave" → use close_sick_leave with worker_id.
- If the user asks about an employer document → check EMPLOYER DOCUMENTATION in your context.
- If the user says "report hazard", "unsafe condition", "danger at location" → collect description and location, then use create_observation. Default: datum = today, prioritet = srednji.
- If the user says "training was held", "completed training", "ZNR training" → collect name and date, then use create_training. Default: vrsta = ZNR.
- If the user asks about open hazard reports → check OPEN HAZARD REPORTS in LIVE DATA and answer directly.
- If the user asks about evacuation drills → check EVACUATION in LIVE DATA.
- If the user asks about trainings → check TRAININGS in LIVE DATA.

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

FORMS: ${country === 'HR' ? 'HZZO Injury report, Equipment inspection forms, Medical referral' : 'OIR-1 = Injury report, RO-1/RO-2 = Equipment inspection, RA-1 = Medical referral, NR-1 = Night work referral'}
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
function buildDynamicSuggestions(lang, pathname) {
    const chips = [];
    try {
        const get = (key) => getRawAll(key);
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

        // ALWAYS show urgent issues first
        if (expired.length > 0) chips.push(lang !== 'en'
            ? { label: `🔴 ${expired.length} istekla uvjerenja`, text: 'Koji radnici imaju istekla uvjerenja?' }
            : { label: `🔴 ${expired.length} expired certs`, text: 'Which workers have expired certificates?' });
        if (expiring.length > 0) chips.push(lang !== 'en'
            ? { label: `📜 ${expiring.length} uvjerenja uskoro iste`, text: 'Prikaži mi uvjerenja koja uskoro ističu.' }
            : { label: `📜 ${expiring.length} certs expiring soon`, text: 'Show me certificates expiring soon.' });
        if (sickLeave.length > 0) chips.push(lang !== 'en'
            ? { label: `🏥 ${sickLeave.length} na bolovanju`, text: 'Ko je trenutno na bolovanju?' }
            : { label: `🏥 ${sickLeave.length} on sick leave`, text: 'Who is currently on sick leave?' });
        if (overdueEq.length > 0) chips.push(lang !== 'en'
            ? { label: `⚠️ ${overdueEq.length} pregleda opreme kasni`, text: 'Koja oprema ima prekoračen pregled?' }
            : { label: `⚠️ ${overdueEq.length} equipment overdue`, text: 'Which equipment has overdue inspection?' });

        // Context-aware suggestions based on current page
        if (pathname === '/dashboard/workers') {
            chips.push(lang !== 'en' ? { label: '👷 Dodaj novog radnika', text: 'Otvori formu za dodavanje novog radnika.' } : { label: '👷 Add new worker', text: 'Open the form to add a new worker.' });
            chips.push(lang !== 'en' ? { label: '📊 Statistika radnika', text: 'Koliko ukupno imamo radnika po odjelima?' } : { label: '📊 Worker stats', text: 'How many workers do we have per department?' });
        } else if (pathname === '/dashboard/equipment') {
            chips.push(lang !== 'en' ? { label: '📅 Idući pregledi', text: 'Kojoj opremi najprije ističe pregled?' } : { label: '📅 Upcoming exams', text: 'Which equipment needs inspection next?' });
        } else if (pathname === '/dashboard/injuries') {
            chips.push(lang !== 'en' ? { label: '🚑 Prijavi tešku povredu', text: 'Želim prijaviti tešku povredu na radu.' } : { label: '🚑 Report severe injury', text: 'I want to report a severe injury.' });
            chips.push(lang !== 'en' ? { label: '✅ Zatvori bolovanje', text: 'Radnik se vratio, zatvori mu bolovanje.' } : { label: '✅ Close sick leave', text: 'Worker returned, close their sick leave.' });
            chips.push(lang !== 'en' ? { label: '📅 Promijeni godinu svima', text: 'Želim prebaciti sve povrede u 2026. godinu.' } : { label: '📅 Change all years', text: 'Set all injuries to year 2026.' });
        } else if (pathname === '/dashboard/worker-ppe' || pathname === '/dashboard/ppe') {
            chips.push(lang !== 'en' ? { label: '🦺 Zaduži šljem', text: 'Želim zadužiti zaštitni šljem radniku.' } : { label: '🦺 Assign helmet', text: 'I want to assign a safety helmet to a worker.' });
            chips.push(lang !== 'en' ? { label: '🧤 Zaduži rukavice', text: 'Radnik je zadužio zaštitne rukavice.' } : { label: '🧤 Assign gloves', text: 'Worker received safety gloves.' });
        } else if (pathname === '/dashboard/questionnaires') {
            chips.push(lang !== 'en' ? { label: '📧 Pošalji anketu', text: 'Želim poslati upitnik radnicima.' } : { label: '📧 Send survey', text: 'I want to send a questionnaire to workers.' });
        } else if (pathname === '/dashboard/archive') {
            chips.push(lang !== 'en' ? { label: '📄 Analiza PDF-a', text: 'Analiziraj mi sadržaj ovog dokumenta kojeg uslikam.' } : { label: '📄 PDF Analysis', text: 'Analyze the contents of a document I upload.' });
        } else if (pathname === '/dashboard/medical-exams') {
            chips.push(lang !== 'en' ? { label: '⚕️ Dodaj pregled', text: 'Želim upisati novi periodični ljekarski pregled.' } : { label: '⚕️ Add exam', text: 'I want to record a new periodic medical exam.' });
            chips.push(lang !== 'en' ? { label: '📅 Kome ističe?', text: 'Kome sve ljekarski pregled ističe u narednih mjesec dana?' } : { label: '📅 Expiring soon', text: 'Whose medical exams are expiring in the next month?' });
        } else if (pathname === '/dashboard/fleet') {
            chips.push(lang !== 'en' ? { label: '🚗 Novo vozilo', text: 'Želim dodati novo vozilo u vozni park.' } : { label: '🚗 New vehicle', text: 'I want to add a new vehicle to the fleet.' });
            chips.push(lang !== 'en' ? { label: '🔑 Zaduži vozilo', text: 'Želim zadužiti vozilo određenom radniku.' } : { label: '🔑 Assign vehicle', text: 'I want to assign a vehicle to a worker.' });
        } else if (pathname === '/dashboard/fire-protection') {
            chips.push(lang !== 'en' ? { label: '🧯 Zaostali servisi', text: 'Koji protupožarni aparati već kasne sa servisom?' } : { label: '🧯 Overdue services', text: 'Which fire extinguishers are overdue for service?' });
        } else if (pathname === '/dashboard/employer-docs') {
            chips.push(lang !== 'en' ? { label: '📄 Traženje akta', text: 'Da li imamo važeći Pravilnik o zaštiti od požara?' } : { label: '📄 Find document', text: 'Do we have a valid Fire Protection Rulebook?' });
        } else if (pathname === '/dashboard/risk-assessment') {
            chips.push(lang !== 'en' ? { label: '⚠️ Kritični rizici', text: 'Koja radna mjesta kod nas imaju Znatan ili Nedopustiv rizik (R ≥ 16)?' } : { label: '⚠️ Critical risks', text: 'Which workplaces have High or Unacceptable risks (R ≥ 16)?' });
            chips.push(lang !== 'en' ? { label: '📋 Propisane mjere', text: 'Koje su propisane mjere za smanjenje znatnih rizika?' } : { label: '📋 Prescribed measures', text: 'What are the prescribed measures to reduce high risks?' });
        } else if (pathname === '/dashboard/zapisnici') {
            chips.push(lang !== 'en' ? { label: '📝 Novi zapisnik', text: 'Kreiraj mi novi zapisnik za današnji sastanak odbora: dogovorena nabavka novih šljemova.' } : { label: '📝 Draft minute', text: 'Draft a new meeting minute for today regarding the purchase of helmets.' });
        } else if (pathname === '/dashboard/observations') {
            chips.push(lang !== 'en' ? { label: '⚠️ Prijavi opasnost', text: 'Želim prijaviti opasnost na radnom mjestu.' } : { label: '⚠️ Report hazard', text: 'I want to report a workplace hazard.' });
            chips.push(lang !== 'en' ? { label: '📊 Otvorene prijave', text: 'Koliko imamo otvorenih prijava opasnosti?' } : { label: '📊 Open reports', text: 'How many open hazard reports do we have?' });
        } else if (pathname === '/dashboard/trainings') {
            chips.push(lang !== 'en' ? { label: '🎓 Nova obuka', text: 'Želim evidentirati novu obuku iz ZNR.' } : { label: '🎓 New training', text: 'I want to record a new safety training.' });
            chips.push(lang !== 'en' ? { label: '📊 Pregled obuka', text: 'Koliko obuka smo proveli ove godine?' } : { label: '📊 Training overview', text: 'How many trainings have we conducted this year?' });
        } else if (pathname === '/dashboard/evacuation') {
            chips.push(lang !== 'en' ? { label: '🗺️ Planovi evakuacije', text: 'Koji planovi evakuacije su trenutno aktivni?' } : { label: '🗺️ Evacuation plans', text: 'Which evacuation plans are currently active?' });
        } else if (pathname === '/dashboard/evacuation-drills') {
            chips.push(lang !== 'en' ? { label: '🏃 Posljednja vježba', text: 'Kad smo zadnji put imali vježbu evakuacije i koliko je bilo evakuiranih?' } : { label: '🏃 Last drill', text: 'When was our last evacuation drill and how many were evacuated?' });
        } else if (pathname === '/dashboard') {
            chips.push(lang !== 'en' ? { label: '📅 Novi podsjetnik', text: 'Dodaj podsjetnik u kalendar za idući ponedjeljak.' } : { label: '📅 New reminder', text: 'Add a calendar reminder for next Monday.' });
        }

    } catch { /* ignore */ }

    // Fallback actions if we don't have enough chips
    if (chips.length < 4) {
        if (lang !== 'en') {
            chips.push({ label: '📊 Pregled stanja', text: 'Daj mi pregled trenutnog stanja zaštite na radu.' });
            chips.push({ label: '📋 Obavezna dokumentacija', text: 'Koja je obavezna dokumentacija za poslodavca?' });
            chips.push({ label: 'ℹ️ Šta sve možeš?', text: 'Šta sve mogu uraditi sa tobom?' });
        } else {
            chips.push({ label: '📊 Status overview', text: 'Give me a current occupational safety status overview.' });
            chips.push({ label: '📋 Mandatory docs', text: 'What mandatory documentation is required for employers?' });
            chips.push({ label: 'ℹ️ What can you do?', text: 'What can I do with you?' });
        }
    }
    
    // Shuffle the non-urgent context chips to keep it dynamic, but keep urgents at top
    const urgents = chips.filter(c => c.label.includes('🔴') || c.label.includes('📜') || c.label.includes('🏥') || c.label.includes('⚠️'));
    const others = chips.filter(c => !urgents.includes(c));
    const shuffledOthers = others.sort(() => 0.5 - Math.random());
    
    return [...urgents, ...shuffledOthers].slice(0, 5);
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
        name: 'open_creation_form',
        description: 'Navigate to a specific page AND open its "New Item" or "Create" form immediately. Use this when the user specifically asks to create, initiate, or make a new document or record. Supports: uputnica, bolovanje, povreda, vozilo, etc.',
        parameters: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'App path WITHOUT query params, e.g. /dashboard/referral-ra1, /dashboard/injuries, /dashboard/medical-exams, /dashboard/diseases' },
                worker_id: { type: 'string', description: 'Optional. If creating an item for a specific worker, look up their ID from LIVE DATA and provide it.' },
                worker_name: { type: 'string', description: 'Optional. Full name of the worker for the confirmation message.' },
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
        description: 'Create and save a new worker directly to the database. Ime (first name) is required. DatumZaposlenja is optional. IMPORTANT: Do NOT ask for or process OIB or JMBG. If the user provides an OIB or JMBG, ignore it and explicitly tell the user in your text response that you are not allowed to process personal identification numbers due to GDPR/ZZPL laws and they must enter it manually.',
        parameters: {
            type: 'object',
            properties: {
                ime: { type: 'string', description: 'First name (ime)' },
                prezime: { type: 'string', description: 'Last name (prezime)' },
                datumZaposlenja: { type: 'string', description: 'Employment start date (YYYY-MM-DD). Optional, leave blank if not provided.' },
            },
            required: ['ime']
        },
    },
    {
        name: 'report_injury',
        description: 'Create and save an injury report (Obrada Povrede OIR-1) directly to the database.',
        parameters: {
            type: 'object',
            properties: {
                worker_name: { type: 'string', description: 'Full name of the injured worker' },
                worker_id: { type: 'string', description: 'ID of the worker from LIVE DATA' },
                datum: { type: 'string', description: 'Date of injury in YYYY-MM-DD format.' },
                tip: { type: 'string', description: 'Injury type: laka (minor), teska (severe), or smrtna (fatal).' },
                opis: { type: 'string', description: 'Brief description of what happened, provided by user.' }
            },
            required: ['worker_name', 'worker_id', 'datum', 'tip', 'opis'],
        },
    },
    {
        name: 'add_certificate',
        description: 'Create and save a certificate, training, or medical fitness record directly to the database.',
        parameters: {
            type: 'object',
            properties: {
                worker_id: { type: 'string', description: 'ID of the worker from LIVE DATA' },
                worker_name: { type: 'string', description: 'Full name of the worker' },
                tipUvjerenja: { type: 'string', description: 'Certificate type name.' },
                datum: { type: 'string', description: 'Issue date in YYYY-MM-DD format.' },
                vrijediDo: { type: 'string', description: 'Expiry date in YYYY-MM-DD format.' },
            },
            required: ['worker_id', 'worker_name', 'tipUvjerenja', 'datum', 'vrijediDo'],
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
        name: 'remove_ppe',
        description: 'Remove / unassign a PPE (OZO) item that was previously assigned to a worker. Use when the user says a worker returned, lost, or no longer has a piece of equipment. Looks up the exact assignment by worker and item name and deletes it.',
        parameters: {
            type: 'object',
            properties: {
                worker_id: { type: 'string', description: 'ID of the worker from LIVE DATA.' },
                worker_name: { type: 'string', description: 'Full name of the worker for the confirmation message.' },
                ppe_name: { type: 'string', description: 'Name of the PPE item to remove (partial match is fine, e.g. "rukavice", "kaska").' },
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
    {
        name: 'create_vehicle',
        description: 'Creates a new vehicle in the Fleet (Vozni park) module. Use when the user asks to add a vehicle, providing basic details.',
        parameters: {
            type: 'object',
            properties: {
                marka: { type: 'string', description: 'Brand of the vehicle (e.g. VW, Mercedes).' },
                model: { type: 'string', description: 'Model of the vehicle (e.g. Golf 8, Sprinter).' },
                registracija: { type: 'string', description: 'License plate number (registarske oznake).' },
            },
            required: ['marka', 'model', 'registracija'],
        },
    },
    {
        name: 'assign_vehicle',
        description: 'Assigns a vehicle to a driver/worker. Creates a record in the Vehicle Assignments history and updates the vehicle. Use when user says to give a car to someone.',
        parameters: {
            type: 'object',
            properties: {
                vehicle_id: { type: 'string', description: 'ID of the vehicle from the VOZNI PARK list in LIVE DATA.' },
                worker_id: { type: 'string', description: 'ID of the worker from the ACTIVE WORKERS list in LIVE DATA.' },
                worker_name: { type: 'string', description: 'Full name of the worker for confirmation message.' },
                napomena: { type: 'string', description: 'Any optional note.' },
            },
            required: ['vehicle_id', 'worker_id', 'worker_name'],
        },
    },
    {
        name: 'create_calendar_event',
        description: 'Creates a new manual reminder or event in the Calendar. Use when user says to remind them of something, schedule a meeting, or add an event.',
        parameters: {
            type: 'object',
            properties: {
                datum: { type: 'string', description: 'Date of the event in YYYY-MM-DD format.' },
                opis: { type: 'string', description: 'Description or title of the reminder/event.' },
                tip: { type: 'string', description: 'Type of event. Default to "other". Allowed: cert, ppe, equip, doc, service, risk, med, fleet, other.' }
            },
            required: ['datum', 'opis'],
        },
    },
    {
        name: 'add_medical_exam',
        description: 'Record a new medical examination (ljekarski pregled) for a worker.',
        parameters: {
            type: 'object',
            properties: {
                worker_id: { type: 'string', description: 'ID of the worker.' },
                worker_name: { type: 'string', description: 'Name of worker.' },
                datum: { type: 'string', description: 'Date of exam (YYYY-MM-DD).' },
                tip: { type: 'string', description: 'Type of exam.', enum: ['prethodni', 'periodični', 'vanredni', 'nocniRad', 'ostalo'] },
                vrijedi_do: { type: 'string', description: 'Next exam deadline (YYYY-MM-DD).' },
                rezultat: { type: 'string', description: 'Result.', enum: ['Sposoban', 'Uvjetno Sposoban', 'Nesposoban'] },
                ustanova: { type: 'string', description: 'Optional medical institution.' }
            },
            required: ['worker_id', 'worker_name', 'datum', 'tip', 'rezultat'],
        },
    },
    {
        name: 'close_sick_leave',
        description: 'Closes an active sick leave (bolovanje) for a worker. Sets the status of the open injury or disease to "zatvorena".',
        parameters: {
            type: 'object',
            properties: {
                worker_id: { type: 'string', description: 'ID of the worker.' },
                worker_name: { type: 'string', description: 'Name of worker.' }
            },
            required: ['worker_id', 'worker_name'],
        },
    },
    {
        name: 'draft_meeting_minutes',
        description: 'CREATE a new meeting minute (Zapisnik db record). Use when a user describes what was agreed upon in a meeting or says "kreiraj zapisnik".',
        parameters: {
            type: 'object',
            properties: {
                naziv: { type: 'string', description: 'Name of the meeting minute (e.g. "Sastanak odbora za ZNR").' },
                broj: { type: 'string', description: 'Reference number, if provided.' },
                datum: { type: 'string', description: 'Date in YYYY-MM-DD.' },
                vrsta: { type: 'string', description: 'Type: "Zapisnik o ispitivanju", "Zapisnik o osposobljenosti", "Zapisnik o pregledu", "Zapisnik o vježbi", "Ostalo". Default to "Ostalo".' },
                napomena: { type: 'string', description: 'Body text or summary of conclusions.' }
            },
            required: ['naziv', 'datum', 'vrsta']
        }
    },
    {
        name: 'create_observation',
        description: 'Report a workplace hazard or safety observation (Prijava opasnosti). Use when user says they noticed a danger, hazard, unsafe condition, or wants to report a safety concern at a location.',
        parameters: {
            type: 'object',
            properties: {
                opis: { type: 'string', description: 'Description of the hazard or observation.' },
                lokacija: { type: 'string', description: 'Location where the hazard was observed.' },
                datum: { type: 'string', description: 'Date of observation in YYYY-MM-DD format. Default: today.' },
                prioritet: { type: 'string', description: 'Priority level: nizak (low), srednji (medium), visok (high), kritičan (critical). Default: srednji.' },
            },
            required: ['opis', 'lokacija'],
        },
    },
    {
        name: 'create_training',
        description: 'Record a completed safety training (Obuka iz ZNR/ZOP). Use when user says a training was held, a worker completed a course, or they want to log a training event.',
        parameters: {
            type: 'object',
            properties: {
                naziv: { type: 'string', description: 'Name/title of the training (e.g. "Obuka iz ZNR", "Protupožarna obuka").' },
                datum: { type: 'string', description: 'Date of training in YYYY-MM-DD format.' },
                vrsta: { type: 'string', description: 'Type: ZNR, ZOP, or Ostalo. Default: ZNR.' },
                brojPolaznika: { type: 'number', description: 'Number of attendees if known.' },
                napomena: { type: 'string', description: 'Optional notes about the training.' },
            },
            required: ['naziv', 'datum'],
        },
    },
];

// ─── Main component ─────────────────────────────────────────────────────────
export default function AIAssistant() {
    const { lang , t } = useLanguage();
    const { isDark } = useTheme();
    const { userCompanies } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const country = useCountry();

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
    const fabPosRef = useRef(null);
    const lastTouchEndRef = useRef(0);
    const dragRef = useRef({ dragging: false, startX: 0, startY: 0, totalDist: 0 });
    const fabRef = useRef(null);

    // Load saved position — respect desktop vs mobile boundaries
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('eznr_zia_position'));
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const isMob = vw < 768;
                const minX = 0;
                const maxX = vw - 60; // 60 is approx width of the edge tab
                const minY = 60;
                const maxY = isMob ? vh - 120 : vh - 60;
                setFabPos({
                    x: saved.x < vw / 2 ? minX : maxX,
                    y: Math.max(minY, Math.min(saved.y, maxY)),
                });
            }
        } catch { /* use default */ }
    }, []);

    // ── Listen for ziaLoadFile events (Context-Aware PDF Analysis) ───────────
    useEffect(() => {
        const handleZiaLoad = (e) => {
            const { name, type, data, size } = e.detail;
            setAttachments(prev => {
                // Prevent duplicate loading
                if (prev.some(a => a.name === name)) return prev;
                return [...prev, { name, type, data, size, preview: null }];
            });
            setIsOpen(true);
            setIsMinimized(false);
            
            // Welcome message for file analysis
            const welcomeMsg = t('iveLoadedTheDocumentWhat').replace('{0}', name);
            setMessages(prev => [...prev.filter(m => !m.isSystemWelcome), { role: 'assistant', content: welcomeMsg, timestamp: new Date(), isSystemWelcome: true }]);
        };
        window.addEventListener('ziaLoadFile', handleZiaLoad);
        return () => window.removeEventListener('ziaLoadFile', handleZiaLoad);
    }, [lang]);

    // Drag handlers
    const handleDragStart = useCallback((clientX, clientY) => {
        dragRef.current = { dragging: true, startX: clientX, startY: clientY, currentX: clientX, currentY: clientY };
    }, []);

    const handleDragMove = useCallback((clientX, clientY) => {
        const d = dragRef.current;
        if (!d.dragging) return;
        const dy = clientY - d.currentY;
        d.currentX = clientX;
        d.currentY = clientY;

        setFabPos(prev => {
            const cur = prev || { y: window.innerHeight - (window.innerWidth < 768 ? 120 : 100) };
            const vh = window.innerHeight;
            const isMob = window.innerWidth < 768;
            const minY = 60;
            const maxY = isMob ? vh - 120 : vh - 60;
            return {
                x: 0,
                y: Math.max(minY, Math.min(cur.y + dy, maxY)),
            };
        });
    }, []);

    const handleDragEnd = useCallback(() => {
        const d = dragRef.current;
        d.dragging = false;
        const dist = Math.abs(d.currentX - d.startX) + Math.abs(d.currentY - d.startY);

        if (dist > 15) {
            setFabPos(prev => {
                if (!prev) return prev;
                const vh = window.innerHeight;
                const isMob = window.innerWidth < 768;
                const snapped = {
                    x: 0,
                    y: Math.max(60, Math.min(prev.y, isMob ? vh - 120 : vh - 60)),
                };
                try { localStorage.setItem('eznr_zia_position', JSON.stringify(snapped)); } catch {}
                return snapped;
            });
        }
    }, []);

    // Mouse drag
    const onFabMouseDown = useCallback((e) => {
        // Prevent ghost mouse down events that fire right after touch end
        if (Date.now() - lastTouchEndRef.current < 500) return;
        e.preventDefault();
        handleDragStart(e.clientX, e.clientY);

        const onMove = (ev) => handleDragMove(ev.clientX, ev.clientY);
        const onUp = () => {
            handleDragEnd();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            // If drag distance < threshold, treat as click
            const d = dragRef.current;
            const dist = Math.abs(d.currentX - d.startX) + Math.abs(d.currentY - d.startY);
            if (dist <= 15) {
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

    const onFabTouchEnd = useCallback((e) => {
        lastTouchEndRef.current = Date.now();
        handleDragEnd();
        const d = dragRef.current;
        const dist = Math.abs(d.currentX - d.startX) + Math.abs(d.currentY - d.startY);
        if (dist <= 15) {
            if (e && e.cancelable) e.preventDefault();
            if (isOpen) handleClose(); else handleOpen();
        }
    }, [handleDragEnd, isOpen]);

    // ── Non-passive touch listeners on the FAB ────────────────────────────────
    // React synthetic events are ALWAYS passive on mobile — e.preventDefault()
    // inside onTouchMove is silently ignored, so the page scrolls while dragging.
    // Fix: attach listeners imperatively with { passive: false } so the browser
    // actually honours preventDefault and suppresses page scroll during drag.
    useEffect(() => {
        const el = fabRef.current;
        if (!el) return;
        const onTMStart = (e) => {
            const t = e.touches[0];
            handleDragStart(t.clientX, t.clientY);
        };
        const onTMMove = (e) => {
            if (!dragRef.current.dragging) return;
            e.preventDefault(); // now actually works — listener is non-passive
            const t = e.touches[0];
            handleDragMove(t.clientX, t.clientY);
        };
        el.addEventListener('touchstart', onTMStart, { passive: false });
        el.addEventListener('touchmove', onTMMove, { passive: false });
        return () => {
            el.removeEventListener('touchstart', onTMStart);
            el.removeEventListener('touchmove', onTMMove);
        };
    }, [handleDragStart, handleDragMove]);

    // Computed FAB styles
    // Default position: above the bottom nav (80px from bottom)
    const fabPosition = fabPos
        ? { position: 'fixed', left: fabPos.x, top: fabPos.y, bottom: 'auto', right: 'auto' }
        : { position: 'fixed', bottom: 80, right: 0 };

    // Is FAB on the left side of the screen?
    const isFabLeft = (typeof window !== 'undefined' && fabPos) ? fabPos.x < window.innerWidth / 2 : false;

    // Is the screen mobile-sized?
    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatHistoryRef = useRef([]); // keep full history for context
    const recognitionRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);

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

                const get = (k) => getRawAll(k);
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

        // Listen for files sent from other components (like Archive)
        const handleLoadFile = (e) => {
            const { name, type, data, size } = e.detail;
            setAttachments([{ name, type, data, preview: null }]);
            setIsOpen(true);
            setIsMinimized(false);
            const msg = t('iAttachedWhatShouldI').replace('{0}', name);
            setMessages(prev => [...prev, { role: 'assistant', content: msg, timestamp: new Date() }]);
        };
        window.addEventListener('ziaLoadFile', handleLoadFile);

        return () => {
            window.removeEventListener('appSettingsUpdated', updateBadge);
            window.removeEventListener('ziaLoadFile', handleLoadFile);
        };
    }, [pathname, lang]);

    // Cleanup retry timer on unmount
    useEffect(() => {
        return () => { if (retryTimerRef.current) clearInterval(retryTimerRef.current); };
    }, []);

    // ── Reset chat when language changes so Zia adopts new language instantly ──
    const prevLangRef = useRef(lang);
    useEffect(() => {
        if (prevLangRef.current !== lang) {
            prevLangRef.current = lang;
            // Clear conversation & history so greeting regenerates in new language
            setMessages([]);
            chatHistoryRef.current = [];
            setShowSuggestions(true);
        }
    }, [lang]);

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
                const get = (k) => getRawAll(k);
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
                    welcome = t('helloImZiaNneverythingLooks');
                } else {
                    const items = [];
                    if (expired > 0) items.push(t('expiredCertificates').replace('{0}', expired));
                    if (soonCerts > 0) items.push(t('certificatesExpiringIn30Days').replace('{0}', soonCerts));
                    if (overdueEq > 0) items.push(t('equipmentInspectionsOverdue').replace('{0}', overdueEq));
                    if (sickLeave > 0) items.push(t('workersOnSickLeave').replace('{0}', sickLeave));
                    welcome = t('helloImZiaNnyouHave').replace('{0}', total).replace('{1}', items.join('\n• '));
                }
                setMessages([{ role: 'assistant', content: welcome, timestamp: new Date() }]);
            } catch {
                const welcome = t('helloImZiaYourAi');
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
        return await apiCallZia({ messages: history, systemPrompt, tools });
    }, []);

    // ── Execute a tool call from Gemini ──────────────────────────────────────
    const executeTool = useCallback(async (name, args) => {
        if (name === 'navigate_to') {
            router.push(args.path);
            setIsMinimized(true);
            return { success: true, message: args.reason };
        }
        if (name === 'open_creation_form') {
            const url = new URL(args.path, window.location.origin);
            url.searchParams.set('openNew', '1');
            if (args.worker_id) {
                url.searchParams.set('workerId', args.worker_id);
            }
            router.push(url.pathname + url.search);
            setIsMinimized(true);
            return { success: true, message: `Opening creation form at ${args.path}${args.worker_name ? ` for ${args.worker_name}` : ''}` };
        }
        if (name === 'open_dispatch_modal') {
            // Store intent for the questionnaires page to pick up
            try { sessionStorage.setItem('zia_dispatch_intent', JSON.stringify({ id: args.questionnaire_id, name: args.questionnaire_name })); } catch { }
            router.push('/dashboard/questionnaires');
            setIsMinimized(true);
            return { success: true, message: `Opening dispatch for ${args.questionnaire_name}` };
        }
        if (name === 'create_new_worker') {
            try {
                const { create: createRecord, COLLECTIONS: COLS } = await import('@/lib/dataStore');
                const newWorker = createRecord(COLS.WORKERS, {
                    ime: args.ime,
                    prezime: args.prezime || '',
                    identifikacijskiBroj: '',
                    datumZaposlenja: args.datumZaposlenja || new Date().toISOString().split('T')[0],
                    oib: '',
                    aktivan: true
                });
                router.push(`/dashboard/workers?openWorker=${newWorker.id}`);
                setIsMinimized(true);
                return { success: true, message: `Radnik "${args.ime} ${args.prezime}" uspješno kreiran.` };
            } catch (e) { return { error: e.message }; }
        }
        if (name === 'report_injury') {
            try {
                const { create: createRecord, COLLECTIONS: COLS } = await import('@/lib/dataStore');
                const newInjury = createRecord(COLS.INJURIES, {
                    radnikId: args.worker_id,
                    radnikIme: args.worker_name,
                    datum: args.datum,
                    tip: args.tip,
                    opisDogadaja: args.opis || '',
                    status: 'otvorena'
                });
                router.push(`/dashboard/injuries/edit/${newInjury.id}`);
                setIsMinimized(true);
                return { success: true, message: `Prijava povrede za "${args.worker_name}" uspješno kreirana i otvorena.` };
            } catch (e) { return { error: e.message }; }
        }
        if (name === 'add_certificate') {
            try {
                const { create: createRecord, COLLECTIONS: COLS } = await import('@/lib/dataStore');
                const newCert = createRecord(COLS.CERTIFICATES, {
                    workerId: args.worker_id,
                    tipUvjerenja: args.tipUvjerenja,
                    datum: args.datum,
                    vrijediDo: args.vrijediDo,
                });
                router.push(`/dashboard/worker-certificates/edit/${newCert.id}`);
                setIsMinimized(true);
                return { success: true, message: `Uvjerenje "${args.tipUvjerenja}" dodano radniku "${args.worker_name}" i otvoreno.` };
            } catch (e) { return { error: e.message }; }
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

                router.push(`/dashboard/workers?openWorker=${resolvedId}&section=ozo`);
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
        if (name === 'remove_ppe') {
            try {
                const { getAll: getRecords, remove: removeRecord, COLLECTIONS: COLS } = await import('@/lib/dataStore');
                const allPpe = getRecords(COLS.PPE_ASSIGNMENTS);
                const needle = (args.ppe_name || '').toLowerCase();
                // Find assignments for this worker whose name partially matches
                const matches = allPpe.filter(p =>
                    p.workerId === args.worker_id &&
                    (p.naziv || '').toLowerCase().includes(needle) &&
                    !p.datumRazduzenja // only unretired items
                );
                if (matches.length === 0) {
                    return { error: `Nije prona\u0111ena aktivna OZO stavka "${args.ppe_name}" za radnika "${args.worker_name}". Provjeri naziv OZO i ime radnika.` };
                }
                // Remove the most recent one
                const target = matches.sort((a, b) => (b.datumZaduzenja || '').localeCompare(a.datumZaduzenja || ''))[0];
                removeRecord(COLS.PPE_ASSIGNMENTS, target.id);
                router.push(`/dashboard/workers?openWorker=${args.worker_id}&section=ozo`);
                setIsMinimized(true);
                return { success: true, message: `OZO "${target.naziv}" uspješno uklonjen od radnika "${args.worker_name}".` };
            } catch (err) {
                return { error: `Failed to remove PPE: ${err.message}` };
            }
        }
        if (name === 'create_vehicle') {
            try {
                const { create, COLLECTIONS } = await import('@/lib/dataStore');
                const newVeh = create(COLLECTIONS.VEHICLES, {
                    marka: args.marka,
                    model: args.model,
                    registracija: args.registracija,
                    tip: 'osobno',
                    status: 'aktivan'
                });
                router.push(`/dashboard/fleet?openId=${newVeh.id}`);
                setIsMinimized(true);
                return { success: true, message: `Vozilo "${args.marka} ${args.model} (${args.registracija})" uspješno dodano i otvoreno.` };
            } catch (err) {
                return { error: `Failed to create vehicle: ${err.message}` };
            }
        }
        if (name === 'assign_vehicle') {
            try {
                const { create, update, COLLECTIONS } = await import('@/lib/dataStore');
                const today = new Date().toISOString().split('T')[0];
                create(COLLECTIONS.VEHICLE_ASSIGNMENTS, {
                    vehicleId: args.vehicle_id,
                    workerId: args.worker_id,
                    workerIme: args.worker_name,
                    datumZaduzenja: today,
                    datumRazduzenja: '',
                    napomena: args.napomena || ''
                });
                update(COLLECTIONS.VEHICLES, args.vehicle_id, {
                    vozacId: args.worker_id,
                    vozacIme: args.worker_name
                });
                return { success: true, message: `Vozilo uspješno zaduženo radniku "${args.worker_name}". [Otvori Vozni Park](/dashboard/fleet?openVozilo=${args.vehicle_id}&tab=zaduzenja)` };
            } catch (err) {
                return { error: `Failed to assign vehicle: ${err.message}` };
            }
        }
        if (name === 'create_calendar_event') {
            try {
                const { create, COLLECTIONS } = await import('@/lib/dataStore');
                create(COLLECTIONS.CALENDAR_EVENTS, {
                    datum: args.datum,
                    opis: args.opis,
                    tip: args.tip || 'other',
                    auto: false
                });
                router.push(`/dashboard`);
                setIsMinimized(true);
                return { success: true, message: `Događaj / podsjetnik uspješno kreiran za datum ${args.datum}.` };
            } catch (err) {
                return { error: `Failed to create calendar event: ${err.message}` };
            }
        }
        if (name === 'add_medical_exam') {
            try {
                const { create, COLLECTIONS } = await import('@/lib/dataStore');
                create(COLLECTIONS.MEDICAL_EXAMS, {
                    workerId: args.worker_id,
                    tipPregleda: args.tip,
                    datumPregleda: args.datum,
                    vrijediDo: args.vrijedi_do || '',
                    rezultat: args.rezultat,
                    zdravstvenaUstanova: args.ustanova || ''
                });
                router.push(`/dashboard/medical-exams`);
                setIsMinimized(true);
                return { success: true, message: `Ljekarski pregled za radnika "${args.worker_name}" uspješno snimljen i otvoren.` };
            } catch (err) {
                return { error: `Failed to add medical exam: ${err.message}` };
            }
        }
        if (name === 'close_sick_leave') {
            try {
                const { getAll, update, COLLECTIONS } = await import('@/lib/dataStore');
                const pInj = getAll(COLLECTIONS.INJURIES);
                const pDis = getAll(COLLECTIONS.DISEASES);
                
                let foundAny = false;
                
                pInj.forEach(i => {
                    if (i.radnikId === args.worker_id && i.bolovanje && i.status !== 'zatvorena') {
                        update(COLLECTIONS.INJURIES, i.id, { status: 'zatvorena' });
                        foundAny = true;
                    }
                });
                pDis.forEach(d => {
                    if (d.radnikId === args.worker_id && d.bolovanje && d.status !== 'zatvorena') {
                        update(COLLECTIONS.DISEASES, d.id, { status: 'zatvorena' });
                        foundAny = true;
                    }
                });
                
                if (!foundAny) return { error: `Nije pronađeno otvoreno bolovanje za radnika ${args.worker_name}.` };
                return { success: true, message: `Bolovanje za radnika "${args.worker_name}" je uspješno zaključeno.` };
            } catch (err) {
                return { error: `Failed to close sick leave: ${err.message}` };
            }
        }
        if (name === 'draft_meeting_minutes') {
            try {
                const { create, COLLECTIONS } = await import('@/lib/dataStore');
                const nova = create(COLLECTIONS.ZAPISNICI, {
                    naziv: args.naziv,
                    broj: args.broj || '',
                    datum: args.datum,
                    vrsta: args.vrsta || 'Ostalo',
                    napomena: args.napomena || '',
                    attachedFileName: '', attachedFileSize: 0, attachedFileType: ''
                });
                router.push(`/dashboard/zapisnici`);
                setIsMinimized(true);
                return { success: true, message: `Zapisnik "${args.naziv}" uspješno kreiran.` };
            } catch (err) { return { error: err.message }; }
        }
        if (name === 'create_observation') {
            try {
                const { create, COLLECTIONS } = await import('@/lib/dataStore');
                const today = new Date().toISOString().split('T')[0];
                const newObs = create(COLLECTIONS.SAFETY_OBSERVATIONS, {
                    opis: args.opis,
                    lokacija: args.lokacija,
                    datum: args.datum || today,
                    prioritet: args.prioritet || 'srednji',
                    status: 'nova',
                });
                router.push('/dashboard/observations');
                setIsMinimized(true);
                return { success: true, message: `Prijava opasnosti "${args.opis}" na lokaciji "${args.lokacija}" uspješno kreirana.` };
            } catch (err) { return { error: `Failed to create observation: ${err.message}` }; }
        }
        if (name === 'create_training') {
            try {
                const { create, COLLECTIONS } = await import('@/lib/dataStore');
                const newTraining = create(COLLECTIONS.TRAININGS, {
                    naziv: args.naziv,
                    datum: args.datum,
                    vrsta: args.vrsta || 'ZNR',
                    brojPolaznika: args.brojPolaznika || 0,
                    napomena: args.napomena || '',
                });
                router.push('/dashboard/trainings');
                setIsMinimized(true);
                return { success: true, message: `Obuka "${args.naziv}" (${args.datum}) uspješno snimljena.` };
            } catch (err) { return { error: `Failed to create training: ${err.message}` }; }
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
            const quotaMsg = t('dailyQuotaExhaustedYourApi');
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
                    if (pending) {
                        const activeCompId = localStorage.getItem('eznr_activeCompany') || '';
                        const dataContextTxt = buildDataContext(lang, activeCompId, userCompanies, t);
                        const systemPromptTxt = buildSystemPrompt(lang, pathname, dataContextTxt, activeCompId, userCompanies, country, t);
                        sendMessageInternal(pending.text, pending.history, true);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [lang, userCompanies, pathname, t, country]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Internal send (supports retry loop + function calling) ───────────────
    const sendMessageInternal = useCallback(async (text, prefilledHistory, forceAutoSend = false, attachedFiles = []) => {
        const workers = getRawAll('workers') || [];
        const safeText = maskPIIInput(text, workers);

        setIsLoading(true);
        try {
            const activeCompId = localStorage.getItem('eznr_activeCompany') || '';
            const dataCtx = buildDataContext(lang, activeCompId, userCompanies, t);
            const systemPrompt = buildSystemPrompt(lang, pathname, dataCtx, activeCompId, userCompanies, country, t);

            const newHistory = prefilledHistory || [...chatHistoryRef.current, { role: 'user', parts: [{ text: safeText }] }];
            if (!prefilledHistory) chatHistoryRef.current = newHistory;

            const result = await callZiaAPI(newHistory, systemPrompt, ZIA_TOOLS);

            // ── Function call: Zia wants to take an action ────────────────────
            if (result.function_call) {
                const { name, args } = result.function_call;
                
                const cleanArgs = { ...args };
                if (cleanArgs.worker_id && cleanArgs.worker_id.startsWith('W[')) {
                    cleanArgs.worker_id = cleanArgs.worker_id.replace(/^W\[/, '').replace(/\]$/, '');
                }
                if (cleanArgs.worker_name && cleanArgs.worker_name.startsWith('W[')) {
                    const extractedId = cleanArgs.worker_name.replace(/^W\[/, '').replace(/\]$/, '');
                    cleanArgs.worker_name = globalWorkerMap[extractedId] || cleanArgs.worker_name;
                }

                // Add model's function_call turn to history
                const historyWithCall = [...newHistory, { role: 'model', parts: [{ function_call: { name, args } }] }];

                // Execute the tool
                const toolResult = await executeTool(name, cleanArgs);

                // Add function response turn
                const historyWithResult = [...historyWithCall, {
                    role: 'user',
                    parts: [{ function_response: { name, response: toolResult } }],
                }];

                // Get Zia's final text response after seeing the tool result
                let reply;
                try {
                    const finalResult = await callZiaAPI(historyWithResult, systemPrompt, ZIA_TOOLS);
                    reply = unmaskPIIOutput(finalResult.text) || unmaskPIIOutput(toolResult.message || toolResult.error || (t('uraeno')));
                } catch {
                    // If second call fails (rate limit etc), use the tool result message
                    reply = unmaskPIIOutput(toolResult.message || toolResult.error || (t('uraeno')));
                }

                chatHistoryRef.current = [...historyWithResult, { role: 'model', parts: [{ text: reply }] }];
                setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date(), isAction: true }]);
                if (isMinimized) setHasNewMessage(true);
                retryAttemptRef.current = 0;
                setIsLoading(false);
                return;
            }

            // ── Normal text response ──────────────────────────────────────────
            const reply = unmaskPIIOutput(result.text) || (t('nemaOdgovora'));
            chatHistoryRef.current = [...newHistory, { role: 'model', parts: [{ text: reply }] }];
            setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
            if (isMinimized) setHasNewMessage(true);
            retryAttemptRef.current = 0;
            setIsLoading(false);

        } catch (err) {
            console.warn('Zia API error:', err.message);
            if (err.isRateLimit) {
                const waitSec = 10; // Changed to 10s per user request (reduced from 30)
                const countdownMsg = t('rateLimitReachedAutoretryingIn').replace('{0}', waitSec);
                setMessages(prev => [...prev, { role: 'assistant', content: countdownMsg, timestamp: new Date(), isRetryMsg: true }]);
                setIsLoading(false);
                startRetryCountdown(waitSec, text, newHistory);
                return;
            }
            const errText = t('error4').replace('{0}', err.message);
            setMessages(prev => [...prev, { role: 'assistant', content: errText, timestamp: new Date() }]);
            setIsLoading(false);
        }
    }, [callZiaAPI, executeTool, isMinimized, lang, pathname, startRetryCountdown, userCompanies, country, t]);

    // ── Proactive logic REMOVED — badge count instead ─────────────────────────
    // (urgentCount computed in separate useEffect above)

    const sendMessage = useCallback(async (text) => {
        if ((!text.trim() && attachments.length === 0) || isLoading || retryCountdown > 0) return;
        // Stop any active voice recording so it doesn't overwrite the cleared input
        if (isRecording) {
            wantRecordingRef.current = false;
            recognitionRef.current?.stop();
            setIsRecording(false);
            accumulatedTranscriptRef.current = '';
        }
        const attachedFiles = [...attachments];
        const displayText = text.trim() || (attachedFiles.length > 0 ? (t('prilog1')) : '');
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
    }, [isLoading, retryCountdown, sendMessageInternal, attachments, lang, isRecording]);

    const handleSuggestion = useCallback((suggestion) => {
        sendMessage(suggestion.text);
    }, [sendMessage]);

    // ── File attachment handler ───────────────────────────────────────────────
    const handleFilesSelected = useCallback((files) => {
        Array.from(files).forEach(file => {
            const ok = file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/');
            // Keep under 4MB to avoid Vercel 4.5MB Serverless Function payload limits
            if (!ok || file.size > 4_000_000) {
                alert(t('fileIsTooLargeMax2').replace('{0}', file.name));
                return;
            }
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

    // ── Microphone recording (Speech-to-Text) ─────────────────────────────────
    // We use single-shot mode (continuous=false) to avoid Android Chrome's
    // duplication bug where interim results stack in continuous mode.
    // A ref accumulates final transcripts across recognition restarts.
    const accumulatedTranscriptRef = useRef('');
    const wantRecordingRef = useRef(false);

    const handleMicClick = useCallback(() => {
        if (isRecording) {
            wantRecordingRef.current = false;
            recognitionRef.current?.stop();
            setIsRecording(false);
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert(t('vasPreglednikNePodrzavaGlasovni'));
            return;
        }

        // Capture current input as the prefix
        const startValue = inputValue;
        accumulatedTranscriptRef.current = '';
        wantRecordingRef.current = true;

        const startRecognition = () => {
            const recognition = new SpeechRecognition();
            recognition.lang = t('bsba');
            recognition.interimResults = true;
            recognition.continuous = false; // single-shot prevents Android duplication
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setIsRecording(true);
            recognition.onresult = (e) => {
                // In single-shot mode there is only one result
                const result = e.results[0];
                const transcript = result[0].transcript;
                if (result.isFinal) {
                    // Accumulate final text
                    accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + ' ' + transcript).trim();
                }
                // Show accumulated finals + current interim
                const display = result.isFinal
                    ? accumulatedTranscriptRef.current
                    : (accumulatedTranscriptRef.current + ' ' + transcript).trim();
                setInputValue(startValue ? (startValue + ' ' + display).replace(/\s+/g, ' ') : display);
            };
            recognition.onerror = (e) => {
                if (e.error === 'no-speech' || e.error === 'aborted') return; // not fatal
                console.error('Speech recognition error', e.error);
                wantRecordingRef.current = false;
                setIsRecording(false);
            };
            recognition.onend = () => {
                // Auto-restart if user hasn't pressed stop
                if (wantRecordingRef.current) {
                    try { startRecognition(); } catch { setIsRecording(false); }
                } else {
                    setIsRecording(false);
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        };

        startRecognition();
    }, [isRecording, inputValue, lang]);

    const handleNavLink = useCallback((path) => {
        router.push(path);
        setIsMinimized(true);
    }, [router]);

    const clearChat = useCallback(() => {
        setMessages([]);
        chatHistoryRef.current = [];
        setShowSuggestions(true);
        // Re-show welcome
        const welcome = t('helloImZiaYourAi1');
        setMessages([{ role: 'assistant', content: welcome, timestamp: new Date() }]);
    }, [lang]);

    const formatTime = (date) => {
        const d = date instanceof Date ? date : new Date(date);
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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

    const suggestions = buildDynamicSuggestions(lang, pathname);

    return (
        <>
            <style>{`
                @keyframes pulse-red {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>
            {/* ── Floating Action Button (Draggable) — hidden when chat is open ── */}
            {!isOpen && (
                <button
                    ref={fabRef}
                    id="ai-assistant-fab"
                    onMouseDown={onFabMouseDown}
                    onTouchEnd={onFabTouchEnd}
                    style={{
        ...fabStyles.fab,
        right: 0,
        top: fabPos && fabPos.y !== undefined ? fabPos.y : 'auto',
        bottom: fabPos && fabPos.y !== undefined ? 'auto' : (isMobileScreen ? '120px' : '100px'),
        transform: 'none',
        transition: dragRef.current && dragRef.current.dragging ? 'none' : 'transform 0.2s, filter 0.2s, top 0.2s',
        animation: pulseAnimation ? 'aiPulse 2s ease-in-out infinite' : 'none',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(0,191,166,0.6))'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}
                    title={t('otvoriAiAsistentaZia')}
                >
                    <span style={{ fontSize: '0.9rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))', marginBottom: 4 }}>✨</span>
    <span style={{ writingMode: 'vertical-rl', textOrientation: 'upright', fontSize: '0.6rem', fontWeight: 800, letterSpacing: 2 }}>ZIA</span>
                    {/* Numeric urgent badge */}
                    {urgentCount > 0 && (
                        <span style={{
                            position: 'absolute', top: -6, left: -6,
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
            )}

            {/* ── Chat Window ── */}
            {isOpen && (
                <div id="ai-assistant-window" style={{
                    ...chatStyles.window,
                    // Mobile: full-screen when open, compact header bar when minimized
                    ...(isMobileScreen ? (
                        isMinimized ? {
                            // Minimized on mobile: small bar at bottom-right (above nav)
                            position: 'fixed', bottom: 70, right: 12, left: 'auto',
                            width: 220, height: 'auto',
                            borderRadius: 14,
                            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                        } : {
                            // Expanded on mobile: full-screen
                            position: 'fixed', top: 52, left: 0, right: 0, bottom: 60,
                            width: 'auto', height: 'auto',
                            borderRadius: 0,
                        }
                    ) : {
                        height: isMinimized ? 'auto' : 580,
                        // Position relative to FAB or default
                        ...({ right: 28, left: 'auto', bottom: 28 }),
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
                                        ? (
                                           <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                               {t('retryInS').replace('{0}', retryCountdown)}
                                               <button onClick={(e) => { e.stopPropagation(); if (retryTimerRef.current) clearInterval(retryTimerRef.current); retryTimerRef.current = null; setRetryCountdown(0); pendingRetryRef.current = null; setIsLoading(false); }} style={{ background: 'transparent', border: '1px solid currentColor', borderRadius: 4, fontSize: '0.6rem', padding: '2px 5px', cursor: 'pointer', opacity: 0.85, color: 'inherit', fontWeight: 600 }}>{t('otkazi')}</button>
                                           </div>
                                        )
                                        : isLoading
                                            ? (t('tipka'))
                                            : (t('onlineAiAgent'))}
                                </div>
                            </div>
                        </div>
                        <div style={chatStyles.headerActions}>
                            <button onClick={clearChat} style={chatStyles.actionBtn} title={t('noviRazgovor')}>↺</button>
                            <button onClick={handleMinimize} style={chatStyles.actionBtn} title={t('minimiziraj')}>
                                {isMinimized ? '▲' : '▼'}
                            </button>
                            <button onClick={handleClose} style={{ ...chatStyles.actionBtn, ...chatStyles.closeBtn }} title={t('zatvori')}>✕</button>
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
                                        {t('ispustiteDatotekeOvdje')}
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
                                        {t('cestaPitanja')}
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
                                        title={t('priloziDatoteku')}
                                        style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--bg-input)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'var(--text-muted)', transition: 'all 0.15s', marginRight: 4 }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#00BFA6'; e.currentTarget.style.color = '#00BFA6'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                    >+</button>
                                    <textarea
                                        ref={inputRef}
                                        id="ai-assistant-input"
                                        style={chatStyles.input}
                                        placeholder={t('postavitePitanjeZia')}
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        rows={1}
                                        onInput={e => {
                                            e.target.style.height = 'auto';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                                        }}
                                    />
                                    {/* Mic recording button */}
                                    <button
                                        onClick={handleMicClick}
                                        disabled={isLoading && !isRecording}
                                        title={lang !== 'en' ? (isRecording ? 'Završi snimanje' : 'Glasovni unos') : (isRecording ? 'Stop recording' : 'Voice input')}
                                        style={{
                                            flexShrink: 0,
                                            width: isRecording ? 'auto' : 34,
                                            padding: isRecording ? '0 12px' : 0,
                                            height: 34,
                                            borderRadius: isRecording ? 17 : '50%',
                                            border: 'none',
                                            background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 6,
                                            fontSize: '1.2rem',
                                            color: isRecording ? '#EF4444' : 'var(--text-muted)',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            animation: isRecording ? 'pulse-red 1.5s infinite' : 'none'
                                        }}
                                    >
                                        <span>{isRecording ? '🛑' : '🎙️'}</span>
                                        {isRecording && <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>SNIMANJE...</span>}
                                    </button>
                                    <button
                                        id="ai-assistant-send"
                                        onClick={() => sendMessage(inputValue)}
                                        disabled={(!inputValue.trim() && attachments.length === 0) || isLoading || retryCountdown > 0}
                                        style={{
                                            ...chatStyles.sendBtn,
                                            opacity: ((!inputValue.trim() && attachments.length === 0) || isLoading || retryCountdown > 0) ? 0.4 : 1,
                                        }}
                                        title={t('posalji')}
                                    >
                                        ➤
                                    </button>
                                </div>
                                <div style={chatStyles.inputFooter}>
                                    {t('pokretanoSaGoogleGemini')} ·{' '}
                                    {t('enterZaSlanjeZaPrilog')}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── Close bubble anchored at bottom-right of chat window ── */}
                    <button
                        onClick={handleClose}
                        style={{
                            position: 'absolute',
                            zIndex: 1002,
                            bottom: -10,
                            right: -10,
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #00BFA6, #009985)',
                            border: '2px solid rgba(255,255,255,0.25)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 3px 12px rgba(0,191,166,0.4)',
                            transition: 'transform 0.15s',
                            color: 'white',
                        }}
                        title={t('zatvoriZia')}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                    >
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1 }}>✕</span>
                    </button>
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
        zIndex: 1001,
        background: 'linear-gradient(180deg, #00BFA6, #009985)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        cursor: 'pointer',
        transition: 'transform 0.2s, filter 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 4px',
        color: 'white',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRight: 'none',
        borderRadius: '16px 0 0 16px',
        boxShadow: '-2px 0 12px rgba(0,191,166,0.3)',
        outline: 'none',
    },
    fabIcon: {
        fontSize: '1rem',
        lineHeight: 1,
        filter: 'drop-shadow(0 0 4px rgba(0,191,166,0.5))',
    },
    fabLabel: {
        fontSize: '0.75rem',
        fontWeight: 700,
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
        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: 'var(--font-body)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #0B2A3C, #143d54)',
        borderRadius: '20px 20px 0 0',
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
        borderRadius: '0 0 20px 20px',
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
