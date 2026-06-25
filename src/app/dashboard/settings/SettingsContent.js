'use client';
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { deleteUser } from 'firebase/auth';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getAll, getById, update, getRawAll, COLLECTIONS, COMPANY_SCOPED,
} from '@/lib/dataStore';
import {
  getNotificationSettings, saveNotificationSettings, apiSaveNotifSettings,
  getAppSettings, saveAppSettings,
  getSystemStats, APP_VERSION, APP_BUILD_DATE, CHANGELOG,
} from '@/lib/systemMonitor';
import {
  getUserLog, getAdminLog, clearUserLog, clearAdminLog, formatLogTime, getSeverityColors,
  getOnlineUsers, humanizePage,
} from '@/lib/activityLog';


import { useDialog } from '@/hooks/useDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { isWebAuthnAvailable, hasStoredCredentialForUser, clearBiometricCredentialForUser, registerCredential } from '@/lib/webAuthn';
import { uploadSecureFile } from '@/lib/storageService';
import PageHeader from '@/components/PageHeader';
import { runCountryMigration } from '@/lib/migrateCountry';
import {
  ACCENT_PRESETS, SIDEBAR_PRESETS, EZNR_DEFAULTS,
  PDF_DEFAULTS, UI_DEFAULTS, WATERMARK_POSITIONS, LOGO_POSITIONS,
  getCompanyBranding, savePdfBranding,
  getUIBranding, saveUIBranding, applyUIBranding, resetUIBranding, applyPreviewUIBranding,
} from '@/lib/brandingService';

// Render-time translation helpers for activity log
function translateLogTitle(title, lang, t) {
  if (!title) return '';
  if (title === 'Prijavili ste se') return t('logLogin') || title;
  if (title.startsWith('Dodan radnik:')) {
    const name = title.replace('Dodan radnik:', '').trim();
    return `${t('logWorkerCreated') || 'Dodan radnik'}: ${name}`;
  }
  if (title.startsWith('Ažuriran radnik:')) {
    const name = title.replace('Ažuriran radnik:', '').trim();
    return `${t('logWorkerUpdated') || 'Ažuriran radnik'}: ${name}`;
  }
  if (title.startsWith('Obrisan radnik:')) {
    const name = title.replace('Obrisan radnik:', '').trim();
    return `${t('logWorkerDeleted') || 'Obrisan radnik'}: ${name}`;
  }
  if (title.startsWith('Dodano uvjerenje:')) {
    const cert = title.replace('Dodano uvjerenje:', '').trim();
    return `${t('logCertCreated') || 'Dodano uvjerenje'}: ${cert}`;
  }
  if (title.startsWith('Isteklo uvjerenje:')) {
    const cert = title.replace('Isteklo uvjerenje:', '').trim();
    return `${t('logCertExpired') || 'Isteklo uvjerenje'}: ${cert}`;
  }
  if (title.startsWith('Dodana oprema:')) {
    const eq = title.replace('Dodana oprema:', '').trim();
    return `${t('logEquipmentCreated') || 'Dodana oprema'}: ${eq}`;
  }
  if (title.startsWith('Istekao pregled opreme:')) {
    const eq = title.replace('Istekao pregled opreme:', '').trim();
    return `${t('logEquipmentExpired') || 'Istekao pregled opreme'}: ${eq}`;
  }
  if (title.startsWith('Dodan dokument:')) {
    const doc = title.replace('Dodan dokument:', '').trim();
    return `${t('logDocumentCreated') || 'Dodan dokument'}: ${doc}`;
  }
  if (title.startsWith('Zadužena OZO:')) {
    const ppe = title.replace('Zadužena OZO:', '').trim();
    return `${t('logPpeAssigned') || 'Zadužena OZO'}: ${ppe}`;
  }
  if (title.startsWith('Nova kompanija:')) {
    const comp = title.replace('Nova kompanija:', '').trim();
    return `${t('logCompanyCreated') || 'Nova kompanija'}: ${comp}`;
  }
  if (title.startsWith('Kreirana firma:')) {
    const comp = title.replace('Kreirana firma:', '').trim();
    return `${t('logCompanyCreatedUser') || 'Kreirana firma'}: ${comp}`;
  }
  if (title.startsWith('Novi korisnik:')) {
    const user = title.replace('Novi korisnik:', '').trim();
    return `${t('logUserRegistered') || 'Novi korisnik'}: ${user}`;
  }

  // Parse dynamic automatic log patterns (like "Dodan(a) Med. pregled: Diko Braz")
  const verbMatch = title.match(/^(Dodan\(a\)|Ažuriran\(a\)|Obrisan\(a\))\s+(.*)$/);
  if (verbMatch) {
    const rawVerb = verbMatch[1];
    const rest = verbMatch[2].trim();
    const colonIdx = rest.indexOf(':');
    let noun = '';
    let value = '';
    
    if (colonIdx !== -1) {
      noun = rest.substring(0, colonIdx).trim();
      value = rest.substring(colonIdx + 1).trim();
    } else {
      noun = rest;
    }
    
    const verbsDict = {
      en: { 'Dodan(a)': 'Added', 'Ažuriran(a)': 'Updated', 'Obrisan(a)': 'Deleted' },
      de: { 'Dodan(a)': 'Hinzugefügt', 'Ažuriran(a)': 'Aktualisiert', 'Obrisan(a)': 'Gelöscht' },
      sl: { 'Dodan(a)': 'Dodano', 'Ažuriran(a)': 'Posodobljeno', 'Obrisan(a)': 'Izbrisano' },
      sr: { 'Dodan(a)': 'Dodato', 'Ažuriran(a)': 'Ažurirano', 'Obrisan(a)': 'Obrisano' },
      hr: { 'Dodan(a)': 'Dodan(a)', 'Ažuriran(a)': 'Ažuriran(a)', 'Obrisan(a)': 'Obrisan(a)' },
      bs: { 'Dodan(a)': 'Dodan(a)', 'Ažuriran(a)': 'Ažuriran(a)', 'Obrisan(a)': 'Obrisan(a)' },
    };
    
    const nounsDict = {
      en: {
        'Događaj': 'Event',
        'Procjena rizika': 'Risk Assessment',
        'Zahtjev': 'Request',
        'Zapisnik': 'Record',
        'Vozilo': 'Vehicle',
        'Zaduženje vozila': 'Vehicle Assignment',
        'Putni nalog': 'Travel Order',
        'Vatrogasni aparat': 'Fire Extinguisher',
        'Hidrantska mreža': 'Hydrant Network',
        'Plan evakuacije': 'Evacuation Plan',
        'Vježba evakuacije': 'Evacuation Drill',
        'Servis': 'Service',
        'Noćni rad': 'Night Work',
        'Uputnica RA-1': 'Referral RA-1',
        'OIR-1': 'Form OIR-1',
        'RO-1': 'Form RO-1',
        'RO-2': 'Form RO-2',
        'Uputnica Noćni Rad': 'Night Work Referral',
        'Povreda': 'Injury',
        'Bolest': 'Disease',
        'Radno mjesto': 'Workplace',
        'Org. jedinica': 'Org Unit',
        'Med. pregled': 'Medical Exam',
        'Obuka': 'Training',
        'Upitnik': 'Questionnaire',
        'Sistematizacija': 'Job Systematization',
        'Uvjerenje': 'Certificate',
        'Oprema': 'Equipment',
        'Dokument': 'Document',
        'OZO': 'PPE',
        'Radnik': 'Worker',
        'Prva pomoć': 'First Aid'
      },
      de: {
        'Događaj': 'Ereignis',
        'Procjena rizika': 'Gefährdungsbeurteilung',
        'Zahtjev': 'Anforderung',
        'Zapisnik': 'Protokoll',
        'Vozilo': 'Fahrzeug',
        'Zaduženje vozila': 'Fahrzeugzuweisung',
        'Putni nalog': 'Reiseauftrag',
        'Vatrogasni aparat': 'Feuerlöscher',
        'Hidrantska mreža': 'Hydrantennetz',
        'Plan evakuacije': 'Evakuierungsplan',
        'Vježba evakuacije': 'Evakuierungsübung',
        'Servis': 'Wartung',
        'Noćni rad': 'Nachtarbeit',
        'Uputnica RA-1': 'Überweisung RA-1',
        'OIR-1': 'OIR-1-Formular',
        'RO-1': 'RO-1-Formular',
        'RO-2': 'RO-2-Formular',
        'Uputnica Noćni Rad': 'Überweisung für Nachtarbeit',
        'Povreda': 'Verletzung',
        'Bolest': 'Krankheit',
        'Radno mjesto': 'Arbeitsplatz',
        'Org. jedinica': 'Org.-Einheit',
        'Med. pregled': 'Ärztliche Untersuchung',
        'Obuka': 'Schulung',
        'Upitnik': 'Fragebogen',
        'Sistematizacija': 'Systematisierung',
        'Uvjerenje': 'Zertifikat',
        'Oprema': 'Ausrüstung',
        'Dokument': 'Dokument',
        'OZO': 'PSA',
        'Radnik': 'Arbeiter',
        'Prva pomoć': 'Erste Hilfe'
      },
      sl: {
        'Događaj': 'Dogodek',
        'Procjena rizika': 'Ocena tveganja',
        'Zahtjev': 'Zahteva',
        'Zapisnik': 'Zapisnik',
        'Vozilo': 'Vozilo',
        'Zaduženje vozila': 'Dodelitev vozila',
        'Putni nalog': 'Potni nalog',
        'Vatrogasni aparat': 'Gasilni aparat',
        'Hidrantska mreža': 'Hidrantno omrežje',
        'Plan evakuacije': 'Načrt evakuacije',
        'Vježba evakuacije': 'Vaja evakuacije',
        'Servis': 'Servis',
        'Noćni rad': 'Nočno delo',
        'Uputnica RA-1': 'Napotnica RA-1',
        'OIR-1': 'OIR-1',
        'RO-1': 'RO-1',
        'RO-2': 'RO-2',
        'Uputnica Noćni Rad': 'Napotnica za nočno delo',
        'Povreda': 'Poškodba',
        'Bolest': 'Bolezen',
        'Radno mjesto': 'Delovno mesto',
        'Org. jedinica': 'Org. enota',
        'Med. pregled': 'Zdravniški pregled',
        'Obuka': 'Usposabljanje',
        'Upitnik': 'Vprašalnik',
        'Sistematizacija': 'Sistematizacija',
        'Uvjerenje': 'Potrdilo',
        'Oprema': 'Oprema',
        'Dokument': 'Dokument',
        'OZO': 'OVO',
        'Radnik': 'Delavec',
        'Prva pomoć': 'Prva pomoč'
      },
      sr: {
        'Događaj': 'Događaj',
        'Procjena rizika': 'Procena rizika',
        'Zahtjev': 'Zahtev',
        'Zapisnik': 'Zapisnik',
        'Vozilo': 'Vozilo',
        'Zaduženje vozila': 'Zaduženje vozila',
        'Putni nalog': 'Putni nalog',
        'Vatrogasni aparat': 'Vatrogasni aparat',
        'Hidrantska mreža': 'Hidrantska mreža',
        'Plan evakuacije': 'Plan evakuacije',
        'Vježba evakuacije': 'Vežba evakuacije',
        'Servis': 'Servis',
        'Noćni rad': 'Noćni rad',
        'Uputnica RA-1': 'Uputnica RA-1',
        'OIR-1': 'OIR-1',
        'RO-1': 'RO-1',
        'RO-2': 'RO-2',
        'Uputnica Noćni Rad': 'Uputnica za noćni rad',
        'Povreda': 'Povreda',
        'Bolest': 'Bolest',
        'Radno mjesto': 'Radno mesto',
        'Org. jedinica': 'Org. jedinica',
        'Med. pregled': 'Med. pregled',
        'Obuka': 'Obuka',
        'Upitnik': 'Upitnik',
        'Sistematizacija': 'Sistematizacija',
        'Uvjerenje': 'Uverenje',
        'Oprema': 'Oprema',
        'Dokument': 'Dokument',
        'OZO': 'OZO',
        'Radnik': 'Radnik',
        'Prva pomoć': 'Prva pomoć'
      }
    };

    const l = lang || 'bs';
    const translatedVerb = (verbsDict[l] && verbsDict[l][rawVerb]) || rawVerb;
    const translatedNoun = (nounsDict[l] && nounsDict[l][noun]) || noun;
    
    if (colonIdx !== -1) {
      if (l === 'de' || l === 'en') {
        return `${translatedNoun} ${translatedVerb.toLowerCase()}: ${value}`;
      } else {
        return `${translatedVerb}: ${translatedNoun}: ${value}`;
      }
    } else {
      if (l === 'de' || l === 'en') {
        return `${translatedNoun} ${translatedVerb.toLowerCase()}`;
      } else {
        return `${translatedVerb}: ${translatedNoun}`;
      }
    }
  }

  return title;
}

function translateLogDetail(detail, lang, t) {
  if (!detail) return '';
  const parts = detail.split('|').map(p => p.trim());
  const translated = parts.map(part => {
    if (!part) return '';
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) return part;
    const label = part.substring(0, colonIdx).trim();
    const value = part.substring(colonIdx + 1).trim();
    let transLabel = label;
    if (label === 'Radnik') transLabel = t('radnik') ? t('radnik').replace('*', '').trim() : 'Radnik';
    else if (label === 'Vrijedi do') transLabel = t('vrijediDo') || 'Vrijedi do';
    else if (label === 'TV br') transLabel = t('tvBroj') || 'TV br';
    else if (label === 'Sljedeći pregled') transLabel = t('iduci') || 'Sljedeći pregled';
    else if (label === 'Trebalo') transLabel = t('trebaloLabel') || 'Trebalo';
    else if (label === 'Ističe') transLabel = t('istice') || 'Ističe';
    else if (label === 'Isteklo') {
      const expiredDict = {
        en: 'Expired',
        de: 'Abgelaufen',
        sl: 'Poteklo',
        sr: 'Isteklo',
        hr: 'Isteklo',
        bs: 'Isteklo'
      };
      transLabel = expiredDict[lang || 'bs'] || 'Isteklo';
    }
    else if (label === 'Kol') transLabel = t('kol') || 'Kol';
    else if (label === 'Datum') transLabel = t('datum') || 'Datum';
    else if (label === 'OIB') transLabel = t('idBrojOib') || 'OIB';
    else if (label === 'Kreirao') transLabel = t('kreiraoLabel') || 'Kreirao';
    else if (label === 'Email') transLabel = t('email') || 'Email';
    else if (label === 'Uloga') transLabel = t('uloga') || 'Uloga';
    else if (label === 'Evidencijski br.') transLabel = t('evidencijskiBroj') || 'Evidencijski br.';
    return `${transLabel}: ${value}`;
  });
  return translated.filter(Boolean).join(' | ');
}

const gdprLocalTrans = {
  bs: {
    title: '🔒 GDPR, Privatnost i Prava Korisnika',
    cookieConsent: 'Upravljanje kolačićima',
    cookieConsentDesc: 'Podesite koje kategorije kolačića i lokalne pohrane prihvatate prilikom korištenja eZNR platforme.',
    essential: 'Neophodni kolačići (Sistemski)',
    essentialDesc: 'Ovi kolačići su neophodni za rad platforme (npr. sesija, jezik, tema, lokalna sinhronizacija podataka) i ne mogu se isključiti.',
    analytical: 'Analitički kolačići',
    analyticalDesc: 'Koriste se za praćenje performansi platforme, automatsko bilježenje grešaka i optimizaciju brzine rada.',
    marketing: 'Marketinški kolačići',
    marketingDesc: 'Omogućavaju prikaz obavijesti o novim verzijama, interaktivnu pomoć asistentice Zia i ankete o zadovoljstvu.',
    saveConsent: 'Sačuvaj postavke kolačića',
    resetConsent: 'Poništi pristanak kolačića (Prikaži baner)',
    portability: 'Prenosivost podataka (Pravo na pristup i izvoz)',
    portabilityDesc: 'U skladu sa GDPR regulativom (Član 20), imate pravo preuzeti sve vaše lične podatke koje eZNR obrađuje u strukturiranom obliku.',
    exportBtn: '📥 Izvezi moje podatke (JSON)',
    forget: 'Pravo na zaborav (Brisanje računa)',
    forgetDesc: 'Brisanjem računa trajno uklanjate svoj profil iz baze podataka i brišete pristup eZNR sistemu. Ova akcija je nepovratna.',
    deleteBtn: '🗑️ Trajno obriši moj račun',
    confirmDeleteTitle: 'Potvrda brisanja računa',
    confirmDeleteDesc: 'Da biste trajno obrisali račun, unesite vašu lozinku za potvrdu identiteta. Svi vaši profilni podaci bit će trajno obrisani iz sistema.',
    enterPassword: 'Unesite lozinku',
    cancel: 'Odustani',
    deleteConfirm: '🗑️ Da, trajno obriši račun',
    deleting: 'Brisanje u toku...',
    successSaved: 'Postavke kolačića su uspješno ažurirane!'
  },
  hr: {
    title: '🔒 GDPR, Privatnost i Prava Korisnika',
    cookieConsent: 'Upravljanje kolačićima',
    cookieConsentDesc: 'Podesite koje kategorije kolačića i lokalne pohrane prihvaćate prilikom korištenja eZNR platforme.',
    essential: 'Neophodni kolačići (Sistemski)',
    essentialDesc: 'Ovi kolačići su neophodni za rad platforme (npr. sesija, jezik, tema, lokalna sinkronizacija podataka) i ne mogu se isključiti.',
    analytical: 'Analitički kolačići',
    analyticalDesc: 'Koriste se za praćenje performansi platforme, automatsko bilježenje grešaka i optimizaciju brzine rada.',
    marketing: 'Marketinški kolačići',
    marketingDesc: 'Omogućavaju prikaz obavijesti o novim verzijama, interaktivnu pomoć asistentice Zia i ankete o zadovoljstvu.',
    saveConsent: 'Spremi postavke kolačića',
    resetConsent: 'Poništi pristanak kolačića (Prikaži baner)',
    portability: 'Prenosivost podataka (Pravo na pristup i izvoz)',
    portabilityDesc: 'U skladu sa GDPR regulativom (Član 20), imate pravo preuzeti sve vaše osobne podatke koje eZNR obrađuje u strukturiranom obliku.',
    exportBtn: '📥 Izvezi moje podatke (JSON)',
    forget: 'Pravo na zaborav (Brisanje računa)',
    forgetDesc: 'Brisanjem računa trajno uklanjate svoj profil iz baze podataka i brišete pristup eZNR sustavu. Ova akcija je nepovratna.',
    deleteBtn: '🗑️ Trajno obriši moj račun',
    confirmDeleteTitle: 'Potvrda brisanja računa',
    confirmDeleteDesc: 'Da biste trajno obrisali račun, unesite vašu lozinku za potvrdu identiteta. Svi vaši profilni podaci bit će trajno obrisani iz sustava.',
    enterPassword: 'Unesite lozinku',
    cancel: 'Odustani',
    deleteConfirm: '🗑️ Da, trajno obriši račun',
    deleting: 'Brisanje u tijeku...',
    successSaved: 'Postavke kolačića su uspješno ažurirane!'
  },
  en: {
    title: '🔒 GDPR, Privacy & User Rights',
    cookieConsent: 'Cookie Preferences',
    cookieConsentDesc: 'Manage which categories of cookies and local storage items you accept when using eZNR.',
    essential: 'Essential Cookies (System)',
    essentialDesc: 'Required for basic functionality (session, language, theme, sync) and cannot be disabled.',
    analytical: 'Analytical Cookies',
    analyticalDesc: 'Used for performance monitoring, automatic error logging, and optimization.',
    marketing: 'Marketing Cookies',
    marketingDesc: 'Enables release notifications, Zia interactive AI help, and user feedback surveys.',
    saveConsent: 'Save Cookie Settings',
    resetConsent: 'Reset Cookie Consent (Show Banner)',
    portability: 'Data Portability (Right to Access & Export)',
    portabilityDesc: 'Under GDPR (Article 20), you can download all personal data processed by eZNR in a structured machine-readable format.',
    exportBtn: '📥 Export My Data (JSON)',
    forget: 'Right to be Forgotten (Account Deletion)',
    forgetDesc: 'Deleting your account permanently removes your profile from the database and revokes eZNR access. This action is irreversible.',
    deleteBtn: '🗑️ Permanently Delete My Account',
    confirmDeleteTitle: 'Confirm Account Deletion',
    confirmDeleteDesc: 'To permanently delete your account, please enter your password to confirm your identity. All profile data will be permanently wiped.',
    enterPassword: 'Enter password',
    cancel: 'Cancel',
    deleteConfirm: '🗑️ Yes, Permanently Delete',
    deleting: 'Deleting...',
    successSaved: 'Cookie preferences updated successfully!'
  },
  de: {
    title: '🔒 GDPR, Datenschutz & Benutzerrechte',
    cookieConsent: 'Cookie-Einstellungen',
    cookieConsentDesc: 'Verwalten Sie, welche Cookie-Kategorien Sie bei der Nutzung von eZNR akzeptieren.',
    essential: 'Notwendige Cookies (System)',
    essentialDesc: 'Erforderlich für grundlegende Funktionen (Sitzung, Sprache, Thema, Synchronisierung) und können nicht deaktiviert werden.',
    analytical: 'Analytische Cookies',
    analyticalDesc: 'Verwendet für Leistungsüberwachung, automatische Fehlerprotokollierung und Optimierung.',
    marketing: 'Marketing-Cookies',
    marketingDesc: 'Ermöglicht Versionsbenachrichtigungen, interaktive Zia-KI-Hilfe und Feedback-Umfragen.',
    saveConsent: 'Cookie-Einstellungen speichern',
    resetConsent: 'Einwilligung zurücksetzen (Banner anzeigen)',
    portability: 'Datenübertragbarkeit (Recht auf Auskunft & Export)',
    portabilityDesc: 'Nach der DSGVO (Artikel 20) können Sie alle von eZNR verarbeiteten personenbezogenen Daten im JSON-Format herunterladen.',
    exportBtn: '📥 Meine Daten exportieren (JSON)',
    forget: 'Recht auf Vergessenwerden (Kontolöschung)',
    forgetDesc: 'Das Löschen Ihres Kontos entfernt Ihr Profil dauerhaft aus der Datenbank und hebt den Zugriff auf eZNR auf. Dies kann nicht rückgängig gemacht werden.',
    deleteBtn: '🗑️ Mein Konto dauerhaft löschen',
    confirmDeleteTitle: 'Kontolöschung bestätigen',
    confirmDeleteDesc: 'Bitte geben Sie Ihr Passwort ein, um Ihre Identität zu bestätigen. Alle Profildaten werden dauerhaft gelöscht.',
    enterPassword: 'Passwort eingeben',
    cancel: 'Abbrechen',
    deleteConfirm: '🗑️ Ja, dauerhaft löschen',
    deleting: 'Löschen...',
    successSaved: 'Cookie-Einstellungen erfolgreich aktualisiert!'
  },
  sl: {
    title: '🔒 GDPR, Zasebnost in Pravice Uporabnika',
    cookieConsent: 'Nastavitve piškotkov',
    cookieConsentDesc: 'Upravljajte s tem, katere kategorije piškotkov sprejemate med uporabo eZNR.',
    essential: 'Nujni piškotki (Sistemski)',
    essentialDesc: 'Potrebni za osnovno delovanje (seje, jezik, tema, sinhronizacija) in jih ni mogoče onemogočiti.',
    analytical: 'Analitični piškotki',
    analyticalDesc: 'Uporabljajo se za spremljanje uspešnosti, samodejno beleženje napak in optimizacijo.',
    marketing: 'Trženjski piškotki',
    marketingDesc: 'Omogoča obvestila o različicah, interaktivno pomoč asistentke Zia in ankete.',
    saveConsent: 'Shrani nastavitve piškotkov',
    resetConsent: 'Ponastavi pristanek (Prikaži pasico)',
    portability: 'Prenosljivost podatkov (Pravica do izvoza)',
    portabilityDesc: 'V skladu z GDPR (člen 20) lahko prenesete vse svoje osebne podatke v strukturirani obliki.',
    exportBtn: '📥 Izvozi moje podatke (JSON)',
    forget: 'Pravica do pozabe (Izbris računa)',
    forgetDesc: 'Z izbrisom računa trajno odstranite svoj profil iz baze in prekličete dostop do eZNR. Ta akcija je dokončna.',
    deleteBtn: '🗑️ Trajno izbriši moj račun',
    confirmDeleteTitle: 'Potrditev izbrisa računa',
    confirmDeleteDesc: 'Za trajen izbris računa vnesite geslo, da potrdite svojo identiteto. Vsi vaši podatki bodo trajno izbrisani.',
    enterPassword: 'Vnesite geslo',
    cancel: 'Prekliči',
    deleteConfirm: '🗑️ Da, trajno izbriši račun',
    deleting: 'Brisanje...',
    successSaved: 'Nastavitve piškotkov so posodobljene!'
  },
  sr: {
    title: '🔒 GDPR, Приватност и Права Корисника',
    cookieConsent: 'Управљање колачићима',
    cookieConsentDesc: 'Подесите које категорије колачића прихватате приликом коришћења eZNR платформе.',
    essential: 'Неопходни колачићи (Системски)',
    essentialDesc: 'Ови колачићи су неопходни за рад платформе (нпр. сесија, језик, тема, локарна синхронизација) и не могу се искључити.',
    analytical: 'Аналитички колачићи',
    analyticalDesc: 'Користе се за праћење перформанси платформе, аутоматско бележење грешака и оптимизацију.',
    marketing: 'Маркетиншки колачићи',
    marketingDesc: 'Омогућавају приказ обавештења о новим верзијама и помоћ асистенткиње Zia.',
    saveConsent: 'Сачувај поставке колачиća',
    resetConsent: 'Поништи пристанак (Прикажи банер)',
    portability: 'Преносивост података (Право на извоз)',
    portabilityDesc: 'У складу са GDPR регулативом, имате право преузети све ваше личне податке у структурисаном облику.',
    exportBtn: '📥 Извези моје податке (JSON)',
    forget: 'Право на заборав (Брисање налога)',
    forgetDesc: 'Брисањем налога трајно уклањате свој профил из базе података. Ова акција је неповратна.',
    deleteBtn: '🗑️ Трајно обриши мој налог',
    confirmDeleteTitle: 'Потврда брисања налога',
    confirmDeleteDesc: 'Да бисте трајно обрисали налог, унесите лозинку за потврду идентитета. Сви профилни подаци биће трајно обрисани.',
    enterPassword: 'Унесите лозинку',
    cancel: 'Одустани',
    deleteConfirm: '🗑️ Да, трајно обриши налог',
    deleting: 'Брисање у току...',
    successSaved: 'Поставке колачића су успешно ажурисане!'
  }
};

export default function SettingsContent() {
  const { t, lang, setLang, toggleLang } = useLanguage();
  const { user, isAdmin, isSuperAdmin, activeCompanyId, logout, changePassword, reauthenticate, changeEmail, changeName, updateUserContext } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'activity');
  const [saved, setSaved] = useState(false);
  // Dirty-tracking: which tab has unsaved edits (null = clean)
  const [dirtyTab, setDirtyTab] = useState(null);
  const [logoError, setLogoError] = useState('');

  const { choose, alert, confirm, prompt, DialogRenderer } = useDialog();

  // Mobile Tabs scroll indicator state
  const tabsWrapperRef = useRef(null);
  const originalCountryRef = useRef('BA'); // tracks initial country to detect changes on save
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (tabsWrapperRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = tabsWrapperRef.current;
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
      }
    };
    handleScrollOrResize();
    const el = tabsWrapperRef.current;
    if (el) el.addEventListener('scroll', handleScrollOrResize);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      if (el) el.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeTab]);

  // Profile state
  const [profileData, setProfileData] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [passwordData, setPasswordData] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [biometricError, setBiometricError] = useState('');
  const [biometricSuccess, setBiometricSuccess] = useState('');

  // Company state
  const [companyData, setCompanyData] = useState({ naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '', postanskiBroj: '', telefon: '', email: '', direktor: '', strucnoLice: '', logo: '', country: 'BA' });
  const [assignedOfficers, setAssignedOfficers] = useState([]);
  // Branding state
  const [pdfAccentColor, setPdfAccentColor] = useState(EZNR_DEFAULTS.accentColor);
  const [wmEnabled, setWmEnabled] = useState(PDF_DEFAULTS.watermarkEnabled);
  const [headerEnabled, setHeaderEnabled] = useState(PDF_DEFAULTS.headerEnabled);
  const [showCompanyInfo, setShowCompanyInfo] = useState(true);
  const [showCompanyName, setShowCompanyName] = useState(true);
  const [wmPosition, setWmPosition] = useState(PDF_DEFAULTS.watermarkPosition); // fallback if I typo'd
  const [wmOpacity, setWmOpacity] = useState(PDF_DEFAULTS.watermarkOpacity);
  const [wmSize, setWmSize] = useState(PDF_DEFAULTS.watermarkSize);
  const [wmContent, setWmContent] = useState(PDF_DEFAULTS.watermarkContent);
  const [logoPosition, setLogoPosition] = useState(PDF_DEFAULTS.logoPosition);
  const [logoSize, setLogoSize] = useState(PDF_DEFAULTS.logoSize);
  const [headerText, setHeaderText] = useState('');
  const [headerFontSize, setHeaderFontSize] = useState(PDF_DEFAULTS.headerFontSize);
  const [headerBold, setHeaderBold] = useState(false);
  const [headerItalic, setHeaderItalic] = useState(false);
  const [headerUnderline, setHeaderUnderline] = useState(false);
  const [headerColor, setHeaderColor] = useState(PDF_DEFAULTS.headerColor);

  const [uiPrimaryColor, setUiPrimaryColor] = useState('');
  const [uiSidebarColor, setUiSidebarColor] = useState('');
  const [sidebarLogoEnabled, setSidebarLogoEnabled] = useState(false);
  const [sidebarText, setSidebarText] = useState(UI_DEFAULTS.sidebarText);

  // Color picker open state (toggle-to-close + X button)
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false);
  const [headerColorPickerOpen, setHeaderColorPickerOpen] = useState(false);
  const [uiPrimaryPickerOpen, setUiPrimaryPickerOpen] = useState(false);
  const [uiSidebarPickerOpen, setUiSidebarPickerOpen] = useState(false);

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState(getNotificationSettings());
  const [notifSyncError, setNotifSyncError] = useState(false);

  // GDPR and Account Deletion states
  const [gdprConsent, setGdprConsent] = useState({ essential: true, analytical: false, marketing: false });
  const [gdprSaved, setGdprSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Load GDPR Consent from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eznr_gdpr_consent');
      if (saved) {
        try {
          setGdprConsent(JSON.parse(saved));
        } catch (e) {
          console.error('[Settings] Failed to parse GDPR consent:', e);
        }
      }
    }
  }, []);

  // Listen to GDPR consent changes (e.g. from banner)
  useEffect(() => {
    const handleConsentChange = (e) => {
      if (e && e.detail) {
        setGdprConsent(e.detail);
      }
    };
    window.addEventListener('eznr:gdpr-consent-changed', handleConsentChange);
    return () => window.removeEventListener('eznr:gdpr-consent-changed', handleConsentChange);
  }, []);

  const handleSaveGdprConsent = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eznr_gdpr_consent', JSON.stringify(gdprConsent));
      setGdprSaved(true);
      setTimeout(() => setGdprSaved(false), 3000);
      // Notify other instances
      window.dispatchEvent(new CustomEvent('eznr:gdpr-consent-changed', { detail: gdprConsent }));
    }
  };

  const handleResetGdprConsent = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eznr_gdpr_consent');
      window.location.reload(); // Refresh to trigger the consent banner
    }
  };

  const handleExportData = () => {
    try {
      const logs = getUserLog(1000);
      const myLogs = logs.filter(l => l.userId === user?.id);
      
      const exportPayload = {
        profile: {
          id: user?.id,
          firstName: user?.firstName || '',
          lastName: user?.lastName || '',
          email: user?.email || '',
          role: user?.role || '',
          companyIds: user?.companyIds || [],
          username: user?.username || '',
        },
        activityLogs: myLogs,
        exportedAt: new Date().toISOString(),
        version: APP_VERSION,
      };

      const jsonStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `eznr_osobni_podaci_${user?.firstName || 'user'}_${user?.lastName || 'data'}.json`.toLowerCase();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Settings] Failed to export data:', err);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError(lang === 'en' ? 'Password is required.' : 'Lozinka je obavezna.');
      return;
    }
    setDeleting(true);
    try {
      // 1. Re-authenticate
      await reauthenticate(deletePassword);
      
      const userId = user?.id;
      if (!userId) {
        throw new Error('Korisnički ID nije validan.');
      }
      
      // 2. Delete Firestore profile
      await deleteDoc(doc(db, 'users', userId));
      
      // 3. Delete Firebase Auth user
      const currentUser = auth.currentUser;
      if (currentUser) {
        await deleteUser(currentUser);
      }
      
      setDeleting(false);
      setShowDeleteModal(false);
      
      // 4. Logout and redirect
      await logout();
      router.push('/login');
    } catch (err) {
      setDeleting(false);
      const code = err?.code || err?.message || '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setDeleteError(lang === 'en' ? 'Incorrect password. Please try again.' : 'Pogrešna lozinka. Pokušajte ponovo.');
      } else {
        setDeleteError(lang === 'en' ? `Failed to delete account: ${err.message}` : `Neuspješno brisanje računa: ${err.message}`);
      }
    }
  };


  // Load notif settings from Firestore whenever notifications tab is opened
  useEffect(() => {
    if (activeTab !== 'notifications' || !activeCompanyId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/firebase-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'getNotifSettings', data: { companyId: String(activeCompanyId) } }),
        });
        const json = await res.json();
        const fsSettings = (json.result || json)?.settings;
        if (!cancelled && fsSettings) {
          // Merge: Firestore is source of truth for server-side keys; localStorage wins for UI toggles
          setNotifSettings(prev => ({ ...prev, ...fsSettings }));
          // Also keep localStorage in sync
          saveNotificationSettings({ ...getNotificationSettings(), ...fsSettings });
          console.log('[Settings] Loaded notif settings from Firestore:', fsSettings);
        } else if (!cancelled && fsSettings === null) {
          console.warn('[Settings] No Firestore notif_settings doc found — will create on save.');
        }
      } catch (e) {
        console.error('[Settings] Failed to load notif settings from Firestore:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeCompanyId]);

  // App settings state
  const [appSettings, setAppSettings] = useState(getAppSettings());

  // Stats (admin only)
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (isAdmin && activeTab === 'system') {
      const timer = setTimeout(() => setStats(getSystemStats()), 500);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, activeTab]);

  // Activity log state
  const [logFilter, setLogFilter] = useState(null);
  const [logRefresh, setLogRefresh] = useState(0);
  const [logLimit, setLogLimit] = useState(15);
  const userLog = useMemo(() => getUserLog(logLimit, logFilter, activeCompanyId), [logLimit, logFilter, logRefresh, activeCompanyId]);
  const adminLog = useMemo(() => getAdminLog(logLimit, logFilter, activeCompanyId), [logLimit, logFilter, logRefresh, activeCompanyId]);
  const onlineUsers = useMemo(() => getOnlineUsers(), [logRefresh]);

  // Refresh logs when database syncs
  useEffect(() => {
    const handleSync = () => {
      setLogRefresh(r => r + 1);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('eznr:data-synced', handleSync);
      return () => {
        window.removeEventListener('eznr:data-synced', handleSync);
      };
    }
  }, []);




  // Load profile data
  useEffect(() => {
    if (user) {
      const dbUser = getAll(COLLECTIONS.USERS).find(u => u.id === user.id);
      if (dbUser) {
        setProfileData({
          firstName: dbUser.firstName || '',
          lastName: dbUser.lastName || '',
          email: dbUser.email || '',
          phone: dbUser.phone || '',
        });
      }
    }
  }, [user]);

  // Load company data
  useEffect(() => {
    const loadData = () => {
      if (dirtyTab === 'company') return; // Do not overwrite user edits in progress
      if (activeCompanyId) {
        const company = getById(COLLECTIONS.COMPANIES, activeCompanyId);
        if (company) {
          setCompanyData({
            naziv: company.naziv || '', skraceniNaziv: company.skraceniNaziv || '',
            oib: company.oib || '', adresa: company.adresa || '',
            mjesto: company.mjesto || '', postanskiBroj: company.postanskiBroj || '',
            telefon: company.telefon || '', email: company.email || '',
            direktor: company.direktor || '', strucnoLice: company.strucnoLice || '',
            logo: company.logo || '', parentId: company.parentId || '',
            country: company.country || 'BA',
          });
          originalCountryRef.current = company.country || 'BA';
        }
        if (isAdmin) {
          const hasAccess = getRawAll(COLLECTIONS.USERS).filter(u => 
            (u.role === 'officer' || u.role === 'admin' || u.role === 'companyadmin') && 
            (u.companyIds || []).includes(activeCompanyId)
          );
          setAssignedOfficers(hasAccess.map(o => o.id));
        }
        // Load branding
        const pdfBrand = getCompanyBranding(activeCompanyId);
        setPdfAccentColor(pdfBrand.accentColor);
        setWmEnabled(pdfBrand.watermarkEnabled);
        setWmPosition(pdfBrand.watermarkPosition);
        setWmOpacity(pdfBrand.watermarkOpacity);
        setWmSize(pdfBrand.watermarkSize);
        setWmContent(pdfBrand.watermarkContent);
        setLogoPosition(pdfBrand.logoPosition);
        setLogoSize(pdfBrand.logoSize);
        setHeaderEnabled(pdfBrand.headerEnabled ?? true);
        setShowCompanyInfo(pdfBrand.showCompanyInfo ?? true);
        setShowCompanyName(pdfBrand.showCompanyName ?? true);
        setHeaderText(pdfBrand.headerText);
        setHeaderFontSize(pdfBrand.headerFontSize);
        setHeaderBold(pdfBrand.headerBold);
        setHeaderItalic(pdfBrand.headerItalic);
        setHeaderUnderline(pdfBrand.headerUnderline);
        setHeaderColor(pdfBrand.headerColor);

        const uiBrand = getUIBranding(activeCompanyId);
        setUiPrimaryColor(uiBrand.primaryColor);
        setUiSidebarColor(uiBrand.sidebarColor);
        setSidebarLogoEnabled(uiBrand.sidebarLogoEnabled);
        setSidebarText(uiBrand.sidebarText);
      }
    };

    loadData();

    if (typeof window !== 'undefined') {
      window.addEventListener('eznr:data-synced', loadData);
      return () => {
        window.removeEventListener('eznr:data-synced', loadData);
      };
    }
  }, [activeCompanyId, isAdmin, dirtyTab]);

  // Live UI branding preview
  useEffect(() => {
    if (activeTab === 'company' && (uiPrimaryColor || uiSidebarColor)) {
      applyPreviewUIBranding(uiPrimaryColor, uiSidebarColor);
    }
  }, [uiPrimaryColor, uiSidebarColor, activeTab]);

  const allOfficersList = useMemo(() => {
    if (!isAdmin) return [];
    return getRawAll(COLLECTIONS.USERS).filter(u => (u.role === 'officer' || u.role === 'admin') && u.aktivan !== false);
  }, [isAdmin]);

  const toggleOfficerAssignment = (officerId) => {
    const officer = getRawAll(COLLECTIONS.USERS).find(u => u.id === officerId);
    if (!officer || !activeCompanyId) return;
    
    const assigned = officer.companyIds || [];
    const isAssigned = assigned.includes(activeCompanyId);
    const newIds = isAssigned 
      ? assigned.filter(id => id !== activeCompanyId)
      : [...assigned, activeCompanyId];
      
    update(COLLECTIONS.USERS, officer.id, { companyIds: newIds });
    setAssignedOfficers(prev => isAssigned ? prev.filter(id => id !== officerId) : [...prev, officerId]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Update tab from URL param
  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  const handleAllSaves = async () => {
    if (activeTab === 'profile') return handleSaveProfile();
    if (activeTab === 'company') return handleSaveCompany();
    if (activeTab === 'notifications') return handleSaveNotifSettings();
  };
  const { markDirty, markClean } = useUnsavedChanges(handleAllSaves);

  // NOTE: validTabs and currentTab are derived after the tabs array is defined below

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  
  const setDirty = (tabKey) => {
    setDirtyTab(tabKey);
    markDirty();
  };
  
  const clearDirty = () => {
    setDirtyTab(null);
    markClean();
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    
    try {
      if (user.email !== profileData.email) {
        await changeEmail(profileData.email);
      }
      if (user.firstName !== profileData.firstName || user.lastName !== profileData.lastName) {
        await changeName(profileData.firstName, profileData.lastName);
      }
    } catch (e) {
      alert(t('firebaseUpdateError').replace('{0}', e.message));
      return; 
    }

    update(COLLECTIONS.USERS, user.id, {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email,
      phone: profileData.phone,
    });
    updateUserContext({ firstName: profileData.firstName, lastName: profileData.lastName, email: profileData.email, phone: profileData.phone });
    clearDirty(); showSaved();
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!passwordData.current || !passwordData.newPass) {
      setPasswordError(t('svaPoljaSuObavezna'));
      return;
    }
    if (passwordData.newPass !== passwordData.confirm) {
      setPasswordError(t('noveLozinkeSeNePodudaraju'));
      return;
    }
    if (passwordData.newPass.length < appSettings.minPasswordLength) {
      setPasswordError(t('passwordMustBeAtLeast').replace('{0}', appSettings.minPasswordLength));
      return;
    }
    try {
      // Step 1: Re-authenticate with Firebase using the current password
      await reauthenticate(passwordData.current);
    } catch (e) {
      const code = e?.code || e?.message || '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setPasswordError(t('trenutnaLozinkaJeNetocna'));
      } else {
        setPasswordError(lang !== 'en' ? 'Greška pri provjeri lozinke: ' + e.message : 'Password verification error: ' + e.message);
      }
      return;
    }
    try {
      // Step 2: Update password in Firebase Auth (the only source of truth)
      await changePassword(passwordData.newPass);
      setPasswordSuccess(t('lozinkaUspjesnoPromijenjena'));
      setPasswordData({ current: '', newPass: '', confirm: '' });
    } catch (e) {
      setPasswordError(lang !== 'en' ? 'Greška pri promjeni lozinke: ' + e.message : 'Error changing password: ' + e.message);
    }
  };

  const handleSaveCompany = () => {
    if (!activeCompanyId) return;
    
    // Save standard and branding structure back to the company
    const newBranding = {
        accentColor: pdfAccentColor,
        watermarkEnabled: wmEnabled, 
        watermarkPosition: wmPosition, 
        watermarkOpacity: wmOpacity, 
        watermarkSize: wmSize, 
        watermarkContent: wmContent,
        logoPosition: logoPosition, 
        logoSize: logoSize,
        headerEnabled: headerEnabled,
        headerText: headerText, 
        headerFontSize: headerFontSize, 
        headerBold: headerBold, 
        headerItalic: headerItalic, 
        headerUnderline: headerUnderline, 
        headerColor: headerColor,
        showCompanyInfo: showCompanyInfo,
        showCompanyName: showCompanyName,
        primaryColor: uiPrimaryColor, 
        sidebarColor: uiSidebarColor,
        sidebarLogoEnabled: sidebarLogoEnabled,
        sidebarText: sidebarText
    };
    
    try {
      const payload = { ...companyData, branding: newBranding };
      update(COLLECTIONS.COMPANIES, activeCompanyId, payload);
      applyUIBranding(activeCompanyId);

      // Invalidate news cache when jurisdiction changes (BA↔HR)
      const oldCountry = originalCountryRef.current;
      const newCountry = companyData.country || 'BA';
      if (oldCountry !== newCountry) {
        try {
          localStorage.removeItem(`eznr_news_cache_${oldCountry}`);
          localStorage.removeItem(`eznr_news_cache_${newCountry}`);
        } catch { /* localStorage may be unavailable */ }
        originalCountryRef.current = newCountry;
      }

      clearDirty(); showSaved();
    } catch(err) {
      console.error('Save failed:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleSaveNotifSettings = async () => {
    // 1) Always keep localStorage in sync (used by in-app notification system)
    saveNotificationSettings(notifSettings);

    // 2) Persist to Firestore via server API (Admin SDK bypasses auth rules)
    const cId = activeCompanyId;
    setNotifSyncError(false);
    if (cId) {
      const ok = await apiSaveNotifSettings(String(cId), notifSettings);
      if (!ok) {
        setNotifSyncError(true);
        console.error('[Settings] Firestore save failed for notif_settings. CompanyId:', cId);
      } else {
        console.log('[Settings] notif_settings saved to Firestore for company:', cId);
      }
    } else {
      console.warn('[Settings] No activeCompanyId — Firestore save skipped.');
    }

    clearDirty(); showSaved();
  };

  const handleSaveAppSettings = () => {
    saveAppSettings(appSettings);
    clearDirty(); showSaved();
  };

  const updateNotif = (key, value) => { setNotifSettings(prev => ({ ...prev, [key]: value })); setDirty('notifications'); };
  const updateApp = (key, value) => { setAppSettings(prev => ({ ...prev, [key]: value })); setDirty('display'); };
  // Dirty-aware setters for profile / company inline inputs
  const setProfileDirty = (updater) => { setProfileData(updater); setDirty('profile'); };
  const setCompanyDirty = (updater) => { setCompanyData(updater); setDirty('company'); };

  
  const [wiping, setWiping] = useState(false);
  const handleWipeDev = async () => {
    if (!isAdmin) return;
    if (activeCompanyId === 'all' || !activeCompanyId) {
        alert('MORA BITI ODABRANA KONKRETNA KOMPANIJA!');
        return;
    }
    const pwd = await prompt('Type "WIPE" to confirm deleting ALL DATA for ' + activeCompanyId);
    if(pwd !== 'WIPE') return;

    setWiping(true);
    try {
        let totalD = 0;
        const allCols = Object.values(COLLECTIONS).filter(c => COMPANY_SCOPED.includes(c));
        
        for(let c of allCols) {
            const ref = collection(db, `companies/${activeCompanyId}/${c}`);
            const snap = await getDocs(ref);
            if(snap.empty) continue;
            for(let i=0; i<snap.docs.length; i+=400) {
                const chunk = snap.docs.slice(i, i+400);
                const batch = writeBatch(db);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
                totalD += chunk.length;
            }
        }
        await alert('WIPE GOTOV! Obrisano zapisa: ' + totalD);
    } catch(e) {
        await alert('GRESKA: ' + e.message);
    }
    setWiping(false);
  };





  // ── Tabs ──
  const tabs = [
    { key: 'activity', label: t('aktivnost'), icon: '📋' },
    { key: 'profile', label: t('profil'), icon: '👤' },
    { key: 'company', label: t('firma'), icon: '🏢' },
    { key: 'notifications', label: t('obavijesti'), icon: '🔔' },
    { key: 'display', label: t('prikaz'), icon: '🎨' },
    ...(isAdmin ? [
      { key: 'system', label: t('sistem'), icon: '🛡️' },
      { key: 'statistics', label: t('statistika'), icon: '📊' },
    ] : []),
    { key: 'gdpr', label: lang === 'en' ? 'GDPR & Privacy' : lang === 'de' ? 'GDPR & Datenschutz' : lang === 'sl' ? 'GDPR in Zasebnost' : lang === 'sr' ? 'ГДПР и Приватност' : 'GDPR i Privatnost', icon: '🔒' },
  ];



  const validTabs = tabs.map(t => t.key);
  const currentTab = validTabs.includes(activeTab) ? activeTab : validTabs[0];


  // ── Toggle component ──
  const Toggle = ({ checked, onChange, label, description }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</div>
        {description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--primary)' : 'var(--bg-input)',
          position: 'relative', transition: 'background 0.3s', flexShrink: 0,
          border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`
        }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? 24 : 2,
          width: 20, height: 20, borderRadius: '50%', background: 'var(--neutral)',
          transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );

  // ── Stat card component ──
  const StatCard = ({ icon, value, label, color }) => (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12, padding: '20px 16px',
      boxShadow: 'var(--shadow-sm)', textAlign: 'center', border: '1px solid var(--border-light)',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: color || 'var(--text)', fontFamily: 'var(--font-heading)' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );

  // ── Section header ──
  const SectionHeader = ({ icon, title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--border)' }}>
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>{title}</span>
    </div>
  );

  // ── Navigation for Activity Log ──
  const handleLogClick = (entry) => {
    if (!entry.relatedId) return;

    let workerSection = '';
    if (entry.title.includes('OZO') || entry.icon === '🦺') workerSection = '&section=ozo';
    else if (entry.title.includes('Med. pregled') || entry.icon === '🩺' || entry.title.includes('Bolest') || entry.icon === '🏥') workerSection = '&section=medExams';
    else if (entry.title.includes('Povreda') || entry.icon === '🩹') workerSection = '&section=povrede';
    else if (entry.category === 'certificate' || entry.icon === '📋') workerSection = '&section=uvjerenja';

    // To ensure back button returns here with the correct tab, replace URL with tab=activity if not present
    if (!searchParams.get('tab')) {
      window.history.replaceState(null, '', '/dashboard/settings?tab=activity');
    }

    switch (entry.category) {
      case 'worker':
      case 'ppe': // Legacy OZO support
        router.push(`/dashboard/workers?openWorker=${entry.relatedId}${workerSection}`);
        break;
      case 'certificate':
        router.push(`/dashboard/worker-certificates/edit/${entry.relatedId}`);
        break;
      case 'equipment':
        router.push(`/dashboard/equipment?openItem=${entry.relatedId}`);
        break;
      case 'document':
        router.push(`/dashboard/employer-docs?highlight=${entry.relatedId}`);
        break;
      default: break;
    }
  };

  return (
    <div className="animate-fadeIn">
      <DialogRenderer />
      <PageHeader 
        icon="⚙️" 
        title={t('settings')} 
        actions={
          <button className="btn" onClick={logout} style={{ background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', border: '1px solid rgba(244,67,54,0.3)', fontWeight: 700, padding: '8px 16px', fontSize: '0.85rem' }}>
            🚪 {t('odjava')}
          </button>
        } 
      />

      {/* Removed global Success toast */}

      {/* Tabs */}
      <div style={{ position: 'relative', margin: '0 -16px 24px -16px', padding: '0 16px' }}>
        <div 
          className="settings-tabs-container" 
          ref={tabsWrapperRef}
          style={{ 
            display: 'flex', gap: 6, paddingBottom: 6, borderBottom: '2px solid var(--border)', 
            flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none'
          }}>
          <style>{`.settings-tabs-container::-webkit-scrollbar { display: none; }`}</style>
        {tabs.map(tb => (
          <button key={tb.key}
            className={`tab-btn ${currentTab === tb.key ? 'active' : ''}`}
            onClick={async () => {
              if (dirtyTab && dirtyTab !== tb.key) {
                const saveFns = {
                  notifications: handleSaveNotifSettings,
                  display: handleSaveAppSettings,
                  profile: handleSaveProfile,
                  company: handleSaveCompany,
                };
                const action = await choose(
                  t('imateNesacuvanePromjenenzeliteLiIh'),
                  [
                    { label: '💾 Sačuvaj i nastavi', value: 'save', primary: true },
                    { label: '🗑️ Odbaci promjene', value: 'discard', danger: true },
                    { label: 'Odustani', value: null }
                  ]
                );
                if (action === null) return;
                
                if (action === 'save' && saveFns[dirtyTab]) {
                  await saveFns[dirtyTab]();
                } else {
                  clearDirty();
                }
              }
              setActiveTab(tb.key);
            }}>
            {tb.icon} {tb.label}
            {dirtyTab === tb.key && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)', marginLeft: 6, verticalAlign: 'middle', boxShadow: '0 0 4px var(--warning)' }} title="Nesačuvane promjene" />}
          </button>
        ))}
        </div>
        {canScrollRight && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 6, width: 64,
            background: 'linear-gradient(to left, var(--bg-page) 30%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: 10, pointerEvents: 'none', color: 'var(--text-muted)'
          }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, opacity: 0.9, animation: 'pulse-x 1.5s infinite alternate' }}>›</span>
          </div>
        )}
      </div>
      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 1: PROFILE                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'profile' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>👤 {t('korisnickiProfil')}</h3>

            {/* Avatar & role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 16, borderRadius: 12, background: 'var(--bg-input)' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: isAdmin ? 'linear-gradient(135deg, #7B1FA2, #E040FB)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 800, fontSize: '1.2rem', fontFamily: 'var(--font-heading)',
              }}>
                {profileData.firstName?.[0]}{profileData.lastName?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{profileData.firstName} {profileData.lastName}</div>
                <span style={{
                  display: 'inline-block', marginTop: 4,
                  padding: '2px 10px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
                  background: isAdmin ? 'linear-gradient(135deg, #7B1FA2, #E040FB)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  color: 'white',
                }}>
                  {isAdmin ? '👑 Admin' : (t('strucnjakZnr1'))}
                </span>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>@{user?.username}</div>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">{t('firstName')}</label>
                <input className="form-input" value={profileData.firstName} onChange={e => setProfileDirty(p => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('lastName')}</label>
                <input className="form-input" value={profileData.lastName} onChange={e => setProfileDirty(p => ({ ...p, lastName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={profileData.email} onChange={e => setProfileDirty(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('phone')}</label>
                <input className="form-input" value={profileData.phone} onChange={e => setProfileDirty(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveProfile}>💾 {t('save')}</button>
              {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {t('sacuvano1')}</span>}
            </div>

            <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <h4 style={{ marginBottom: 16 }}>🔐 {t('promjenaLozinke')}</h4>
            {passwordError && <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>⚠️ {passwordError}</div>}
            {passwordSuccess && <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(76,175,80,0.1)', color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>✅ {passwordSuccess}</div>}
            <div className="form-grid-3">
              <div className="form-group">
                <label className="form-label">{t('trenutnaLozinka')}</label>
                <input className="form-input" type="password" value={passwordData.current} onChange={e => setPasswordData(p => ({ ...p, current: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('novaLozinka')}</label>
                <input className="form-input" type="password" value={passwordData.newPass} onChange={e => setPasswordData(p => ({ ...p, newPass: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('confirmPassword')}</label>
                <input className="form-input" type="password" value={passwordData.confirm} onChange={e => setPasswordData(p => ({ ...p, confirm: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleChangePassword}>🔐 {t('promijeniLozinku')}</button>
            </div>

            <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <h4 style={{ marginBottom: 16 }}>👆 {t('biometrijskaPrijava')}</h4>
            {biometricError && <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>⚠️ {biometricError}</div>}
            {biometricSuccess && <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(76,175,80,0.1)', color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>✅ {biometricSuccess}</div>}
            <div style={{ padding: '16px', borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{t('otisakPrsta')}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t('omoguciteBrzuPrijavuNaOvom')}
                </div>
              </div>
              <div>
                {(typeof window !== 'undefined' && user?.id && hasStoredCredentialForUser(user.id)) ? (
                  <button 
                    className="btn" 
                    onClick={async () => {
                      const isConfirmed = await confirm(t('daLiSteSigurniDa'));
                      if (!isConfirmed) return;
                      clearBiometricCredentialForUser(user.id);
                      window.dispatchEvent(new Event('storage')); // force react refresh if needed
                      setBiometricSuccess(t('otisakUspjesnoUklonjen'));
                    }}
                    style={{ background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', border: '1px solid rgba(244,67,54,0.3)', fontWeight: 600 }}>
                    🗑️ {t('ukloniOtisak')}
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary" 
                    onClick={async () => {
                      setBiometricError('');
                      setBiometricSuccess('');
                      if (!isWebAuthnAvailable()) {
                        await alert(t('biometrijaNijePodrzanaNaOvom'));
                        return;
                      }
                      // Prompt user for their current password so we can stash it for biometric login
                      const pwdInput = await prompt(
                        t('unesiteVasuTrenutnuLozinkuZa'),
                        t('potvrdaLozinke')
                      );
                      if (!pwdInput) {
                        setBiometricError(t('lozinkaJeObaveznaZaAktivaciju'));
                        return;
                      }
                      // Verify password is correct by re-authenticating
                      try {
                        await reauthenticate(pwdInput);
                      } catch (err) {
                        const code = err?.code || err?.message || '';
                        if (code.includes('wrong-password') || code.includes('invalid-credential')) {
                          setBiometricError(t('pogresnaLozinka'));
                        } else {
                          setBiometricError(lang !== 'en' ? 'Greška pri provjeri: ' + err.message : 'Verification error: ' + err.message);
                        }
                        return;
                      }
                      try {
                        const userData = {
                          id: user.id,
                          email: user.email,
                          firstName: profileData.firstName,
                          lastName: profileData.lastName,
                          role: user.role,
                          companyIds: user.companyIds || [],
                          fsPassword: pwdInput,
                        };
                        await registerCredential(user.id, user.email, userData);
                        setBiometricSuccess(t('otisakUspjesnoSacuvanNaLogin'));
                      } catch (err) {
                        setBiometricError('Greška: ' + err.message);
                      }
                    }}>
                    ➕ {t('dodajOtisak')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 2: COMPANY                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'company' && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h3 style={{ margin: 0 }}>🏢 {t('podaciOFirmi')}</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  const ok = await confirm(
                    t('zeliteLiPokrenutiCarobnjakZa')
                  );
                  if (ok) {
                    localStorage.removeItem(`eznr_wizard_completed_${activeCompanyId}`);
                    router.push('/dashboard?wizard=true');
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem' }}
                title={t('pokreceInteraktivniCarobnjakKojiVas')}
              >
                🚀 {t('pokreniCarobnjak')}
              </button>
            </div>
            {!activeCompanyId ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                {t('odaberiteFirmuKrozBiracFirma')}
              </div>
            ) : (
              <>
                <div className="form-grid-2">
                  <div className="form-group"><label className="form-label">{t('nazivFirme')}</label><input className="form-input" value={companyData.naziv} onChange={e => setCompanyDirty(p => ({ ...p, naziv: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('skraceniNaziv')}</label><input className="form-input" value={companyData.skraceniNaziv} onChange={e => setCompanyDirty(p => ({ ...p, skraceniNaziv: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('idBrojOib')}</label><input className="form-input" value={companyData.oib} onChange={e => setCompanyDirty(p => ({ ...p, oib: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('address')}</label><input className="form-input" value={companyData.adresa} onChange={e => setCompanyDirty(p => ({ ...p, adresa: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('city')}</label><input className="form-input" value={companyData.mjesto} onChange={e => setCompanyDirty(p => ({ ...p, mjesto: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('postanskiBroj')}</label><input className="form-input" value={companyData.postanskiBroj} onChange={e => setCompanyDirty(p => ({ ...p, postanskiBroj: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('phone')}</label><input className="form-input" value={companyData.telefon} onChange={e => setCompanyDirty(p => ({ ...p, telefon: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={companyData.email} onChange={e => setCompanyDirty(p => ({ ...p, email: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('direktor')}</label><input className="form-input" value={companyData.direktor} onChange={e => setCompanyDirty(p => ({ ...p, direktor: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('strucnoLiceZnr')}</label><input className="form-input" value={companyData.strucnoLice} onChange={e => setCompanyDirty(p => ({ ...p, strucnoLice: e.target.value }))} /></div>
                </div>

                {/* ── Područje djelovanja (Jurisdiction) ── */}
                <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>🌍 {t('podrucjeDjelovanja')}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    {t('odaberiteDrzavuUKojojFirma')}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[{ code: 'BA', flag: '🇧🇦', label: 'Bosna i Hercegovina', law: 'Zakon o ZNR FBiH (79/20)' }, { code: 'HR', flag: '🇭🇷', label: 'Republika Hrvatska', law: 'Zakon o ZNR (NN 71/14)' }].map(opt => (
                      <button key={opt.code} type="button" onClick={() => setCompanyDirty(p => ({ ...p, country: opt.code }))}
                        style={{
                          flex: 1, padding: '12px 14px', borderRadius: 'var(--radius-md, 10px)', cursor: 'pointer',
                          border: `2px solid ${companyData.country === opt.code ? 'var(--primary)' : 'var(--border)'}`,
                          background: companyData.country === opt.code ? 'rgba(0,191,166,0.08)' : 'transparent',
                          display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
                        }}>
                        <span style={{ fontSize: '1.5rem' }}>{opt.flag}</span>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: companyData.country === opt.code ? 700 : 500, fontSize: '0.88rem', color: companyData.country === opt.code ? 'var(--primary)' : 'var(--text)' }}>
                            {companyData.country === opt.code ? '✓ ' : ''}{opt.label}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{opt.law}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {companyData.parentId && (
                    <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'rgba(0,191,166,0.05)', border: '1px solid var(--primary)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4, color: 'var(--primary)' }}>🔗 {t('dioHoldinga1')}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {t('ovaFirmaJeKcerkaFirma')}
                            <strong style={{ color: 'var(--text)' }}>{getById(COLLECTIONS.COMPANIES, companyData.parentId)?.naziv || 'Nepoznato'}</strong>
                        </div>
                    </div>
                )}


                {isAdmin && allOfficersList.length> 0 && (
                  <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12 }}>👮 {t('dodijeljeniStrucnjaciZnrIAdministratori')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      {t('odaberiteKojiStrucnjaciadministratoriImajuPristup')}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {allOfficersList.map(officer => {
                        const isAssigned = assignedOfficers.includes(officer.id);
                        return (
                          <button
                            key={officer.id}
                            onClick={() => toggleOfficerAssignment(officer.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                              border: `1px solid ${isAssigned ? 'var(--primary)' : 'var(--border)'}`,
                              background: isAssigned ? 'rgba(0,191,166,0.1)' : 'transparent',
                              color: isAssigned ? 'var(--primary)' : 'var(--text-muted)',
                              fontWeight: isAssigned ? 700 : 600, fontSize: '0.8rem',
                              transition: 'all 0.2s',
                            }}>
                            <span>{isAssigned ? '✅' : '➕'}</span>
                            {officer.firstName} {officer.lastName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Logo upload */}
                <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12 }}>🖼️ {t('logoFirme')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {companyData.logo ? (
                      <img src={companyData.logo} alt="Logo" style={{ height: 64, maxWidth: 200, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />
                    ) : (
                      <div style={{ height: 64, width: 120, borderRadius: 8, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {t('nemaLoga')}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', display: 'inline-block' }}>
                        📁 {t('ucitajLogo')}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            setLogoError(t('logoMoraBitiManjiOd1') || 'Logo mora biti manji od 5MB');
                            return;
                          }
                          setLogoError('');
                          try {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const img = new Image();
                              img.onload = () => {
                                const MAX_WIDTH = 300;
                                const MAX_HEIGHT = 300;
                                let width = img.width;
                                let height = img.height;

                                if (width > height) {
                                  if (width > MAX_WIDTH) {
                                    height *= MAX_WIDTH / width;
                                    width = MAX_WIDTH;
                                  }
                                } else {
                                  if (height > MAX_HEIGHT) {
                                    width *= MAX_HEIGHT / height;
                                    height = MAX_HEIGHT;
                                  }
                                }

                                const canvas = document.createElement('canvas');
                                canvas.width = width;
                                canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0, width, height);

                                try {
                                  const compressed = canvas.toDataURL('image/png');
                                  setCompanyData(p => ({ ...p, logo: compressed }));
                                } catch (err) {
                                  setLogoError(t('greskaPriCitanjuFajla') || 'Greška pri čitanju datoteke');
                                }
                              };
                              img.onerror = () => {
                                setLogoError(t('greskaPriCitanjuFajla') || 'Greška pri čitanju datoteke');
                              };
                              img.src = event.target.result;
                            };
                            reader.onerror = () => {
                              setLogoError(t('greskaPriCitanjuFajla') || 'Greška pri čitanju datoteke');
                            };
                            reader.readAsDataURL(file);
                          } catch (err) {
                            setLogoError(t('greskaPriUploaduLoga') || 'Greška pri učitavanju logotipa');
                          }
                        }} />
                      </label>
                      {logoError && <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>⚠️ {logoError}</div>}
                      {companyData.logo && (
                        <button onClick={() => setCompanyData(p => ({ ...p, logo: '' }))} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                          🗑️ {t('ukloniLogo')}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t('logoCeBitiPrikazanNa')}<br />
                      {t('preporucenaVelicinaPngIliSvg')}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button className="btn btn-primary" onClick={handleSaveCompany}>💾 {t('save')}</button>
                  {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {t('sacuvano1')}</span>}
                </div>

                {/* ══ BRANDING SECTION ══ */}
                
                {/* ── SUPER PREMIUM BRANDING SECTION ── */}
                <div style={{ marginTop: 40, borderTop: '1px solid rgba(150,150,150,0.1)', paddingTop: 36 }}>
                  {companyData.parentId ? (
                    <div style={{ padding: 32, borderRadius: 20, background: 'rgba(0,191,166,0.05)', border: '1px solid var(--primary)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, margin: '24px 0' }}>
                      <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 4px 12px rgba(0,191,166,0.25))' }}>🔗</span>
                      <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text)' }}>Naslijeđeni dizajn i brendiranje</div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0, maxWidth: 540, lineHeight: '1.6' }}>
                        Ova firma je podružnica (sub-kompanija) matične firme <strong style={{ color: 'var(--text)' }}>{getById(COLLECTIONS.COMPANIES, companyData.parentId)?.naziv || 'matične kompanije'}</strong>. Postavke izgleda, logotipa, boja i PDF brendiranja se automatski nasljeđuju od nje.
                      </p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                        Da biste promijenili dizajn ili brendiranje, prebacite se na matičnu firmu kroz birač firmi u zaglavlju aplikacije i uredite njene postavke.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #059669))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/></svg>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.3px' }}>{t('brandingIdentitet')}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, marginTop: 4 }}>{t('vrhunskiDizajnZaVasuAplikaciju')}</p>
                      </div>
                    </div>
                    {/* Add back Default Settings Reset entirely */}
                    <button type="button" onClick={() => { if(confirm(t('ponistiSveNaPocetneEznr'))){setUiPrimaryColor(EZNR_DEFAULTS.primaryColor);setUiSidebarColor(EZNR_DEFAULTS.sidebarColor);setSidebarLogoEnabled(false);setSidebarText(UI_DEFAULTS.sidebarText);setPdfAccentColor(EZNR_DEFAULTS.accentColor);setWmEnabled(true);setHeaderEnabled(true);setShowCompanyInfo(true);setShowCompanyName(true);setWmOpacity(5);setWmSize(280);setLogoPosition('left');setLogoSize(40);setHeaderText('');setHeaderColor('#1a1a2e');setDirty('company');} }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>↺ {t('vratiZadanePostavke')}</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>
                  
                    {/* === APP BRANDING CARD ( PREMIUM ) === */}
                    <div style={{ borderRadius: 20, background: 'var(--bg-card)', border: '1px solid rgba(150,150,150,0.15)', boxShadow: '0 12px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                      <div style={{ padding: '20px 24px', background: 'linear-gradient(to right, rgba(150,150,150,0.03), transparent)', borderBottom: '1px solid rgba(150,150,150,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: 10, background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{t('izgledAplikacije')}</div>
                        </div>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '4px 10px', borderRadius: 12, background: 'linear-gradient(135deg,#1f2937,#111827)', color: '#fff', marginLeft: 'auto', letterSpacing: 0.5 }}>ENTERPRISE</span>
                      </div>
                      
                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                          {/* SMART THEMES */}
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '1.1rem' }}>✨</span> {t('pametneTematskePalete')}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                              {[
                                { name: 'Ocean', primary: '#0ea5e9', sidebar: '#0f172a' },
                                { name: 'Smaragd', primary: '#10b981', sidebar: '#064e3b' },
                                { name: 'Amethyst', primary: '#a855f7', sidebar: '#2e1065' },
                                { name: 'Sunset', primary: '#f97316', sidebar: '#1c1917' },
                                { name: 'Minimal', primary: '#14b8a6', sidebar: '#1e293b' },
                                { name: 'Classic', primary: '#005bea', sidebar: '#1c1c28' }
                              ].map(t => (
                                <button key={t.name} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 16, cursor: 'pointer', transition: 'all 0.25s', position: 'relative', overflow: 'hidden' }} 
                                  onClick={() => { setUiPrimaryColor(t.primary); setUiSidebarColor(t.sidebar); if(typeof window !== 'undefined') { document.documentElement.style.setProperty('--accent', t.primary); document.documentElement.style.setProperty('--bg-sidebar', t.sidebar); } setDirty('company'); }} 
                                  onMouseOver={e=>{e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.08)';}} 
                                  onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>
                                  <div style={{ display: 'flex', width: '100%', height: 28, borderRadius: 8, overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <div style={{ flex: 1, background: t.sidebar }}></div>
                                    <div style={{ flex: 1, background: t.primary }}></div>
                                  </div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{t.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* MANUAL COLORS & SIDEBAR LOGO ROW */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '20px', background: 'var(--bg-input)', borderRadius: 20, border: '1px solid var(--border)' }}>
                            {/* Primary */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: '1 1 200px' }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('primarnaWebBoja')}</div>
                              </div>
                              <label style={{ display: 'inline-block', width: 42, height: 42, borderRadius: 12, border: '2px solid rgba(150,150,150,0.2)', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                                <input type="color" value={uiPrimaryColor || EZNR_DEFAULTS.primaryColor} onChange={e=>{setUiPrimaryColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 80, height: 80, cursor: 'pointer', opacity: 0 }} />
                                <div style={{ width: '100%', height: '100%', background: uiPrimaryColor || EZNR_DEFAULTS.primaryColor, pointerEvents: 'none' }} />
                              </label>
                            </div>
                            {/* Sidebar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: '1 1 200px' }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('bojaBocneTrake')}</div>
                              </div>
                              <label style={{ display: 'inline-block', width: 42, height: 42, borderRadius: 12, border: '2px solid rgba(150,150,150,0.2)', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                                <input type="color" value={uiSidebarColor || EZNR_DEFAULTS.sidebarColor} onChange={e=>{setUiSidebarColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 80, height: 80, cursor: 'pointer', opacity: 0 }} />
                                <div style={{ width: '100%', height: '100%', background: uiSidebarColor || EZNR_DEFAULTS.sidebarColor, pointerEvents: 'none' }} />
                              </label>
                            </div>
                            {/* Logo Replace */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', paddingTop: 16, borderTop: '1px solid rgba(150,150,150,0.1)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: sidebarLogoEnabled ? 'var(--text)' : 'var(--text-muted)' }}>{t('zamijeniLogoMojimLogomU')}</div>
                                  <div onClick={()=>{setSidebarLogoEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: sidebarLogoEnabled ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                    <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: sidebarLogoEnabled ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                  </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input type="text" value={sidebarText || ''} onChange={e=>{setSidebarText(e.target.value);setDirty('company');}} placeholder={t('tekstIspodLogaOpcionalno')} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.82rem', width: '100%', maxWidth: 400 }} />
                              </div>
                            </div>
                          </div>

                      </div>
                    </div>



                    {/* === PDF BRANDING CARD ( PREMIUM ) === */}
                    <div style={{ borderRadius: 20, background: 'var(--bg-card)', border: '1px solid rgba(150,150,150,0.15)', boxShadow: '0 12px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                      <div style={{ padding: '20px 24px', background: 'linear-gradient(to right, rgba(150,150,150,0.03), transparent)', borderBottom: '1px solid rgba(150,150,150,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: 10, background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg></div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{t('pdfBranding')}</div>
                        </div>
                        <button type="button" onClick={() => { if(confirm(t('ponistiPdfPostavkeNaPocetne'))){setPdfAccentColor(EZNR_DEFAULTS.accentColor);setWmEnabled(true);setHeaderEnabled(true);setShowCompanyInfo(true);setShowCompanyName(true);setWmPosition('center');setWmOpacity(5);setWmSize(280);setWmContent('both');setLogoPosition('left');setLogoSize(40);setHeaderText('');setHeaderFontSize(12);setHeaderBold(false);setHeaderItalic(false);setHeaderUnderline(false);setHeaderColor('#1a1a2e');setDirty('company');} }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>↺ {t('vratiZadanePostavke')}</button>
                      </div>

                      <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                        
                        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                          
                          {/* Top Row Base settings */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('akcentBoja')}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <label style={{ display: 'inline-block', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                                    <input type="color" value={pdfAccentColor || EZNR_DEFAULTS.accentColor} onChange={e=>{setPdfAccentColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, cursor: 'pointer', opacity: 0 }} />
                                    <div style={{ width: '100%', height: '100%', background: pdfAccentColor || EZNR_DEFAULTS.accentColor, pointerEvents: 'none' }} />
                                  </label>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('podaciFirme')}</div>
                                <div onClick={()=>{setShowCompanyInfo(e=>!e);setDirty('company');}} style={{ width: 42, height: 24, background: showCompanyInfo !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                  <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: showCompanyInfo !== false ? 20 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('nazivFirme1')}</div>
                                <div onClick={()=>{setShowCompanyName(e=>!e);setDirty('company');}} style={{ width: 42, height: 24, background: showCompanyName !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                  <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: showCompanyName !== false ? 20 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                </div>
                            </div>
                          </div>

                          {/* Header / Zaglavlje */}
                          <div style={{ background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)', textTransform: 'uppercase' }}>{t('zaglavljeDokumenta')}</div>
                              <div onClick={()=>{setHeaderEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: headerEnabled !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: headerEnabled !== false ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                              </div>
                            </div>
                            
                            {headerEnabled !== false && (
                              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{t('pozicijaLoga')}</span>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {LOGO_POSITIONS.map(p => (
                                        <button key={p.id} onClick={() => { setLogoPosition(p.id); setDirty('company'); }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: logoPosition === p.id ? '2px solid var(--primary)' : '1px solid var(--border)', background: logoPosition === p.id ? 'var(--primary-glow)' : 'var(--bg-card)', color: logoPosition === p.id ? 'var(--primary)' : 'var(--text-muted)' }}>{p.label}</button>
                                      ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: 100 }}>{t('velicinaLoga')}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                                      <input type="range" min={20} max={80} value={logoSize} onChange={e => { setLogoSize(+e.target.value); setDirty('company'); }} style={{ flex: 1, accentColor: 'var(--primary)' }} />
                                      <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>{logoSize}px</code>
                                    </div>
                                </div>

                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                                <div className="scrollable-toolbar" style={{ padding: 0, gap: 8 }}>
                                    <input type="text" value={headerText} onChange={e => { setHeaderText(e.target.value); setDirty('company'); }} placeholder={t('dodatniTekstOpcionalno')} style={{ flex: '1 1 200px', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600 }} />
                                    
                                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: '3px', borderRadius: 8, border: '1px solid var(--border)' }}>
                                      <button onClick={() => { setHeaderBold(b => !b); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerBold ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', fontWeight: 900, color: headerBold ? 'var(--primary)' : 'var(--text-muted)' }}>B</button>
                                      <button onClick={() => { setHeaderItalic(i => !i); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerItalic ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', fontStyle: 'italic', fontWeight: 700, color: headerItalic ? 'var(--primary)' : 'var(--text-muted)' }}>I</button>
                                      <button onClick={() => { setHeaderUnderline(u => !u); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerUnderline ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700, color: headerUnderline ? 'var(--primary)' : 'var(--text-muted)' }}>U</button>
                                    </div>
                                    <select value={headerFontSize} onChange={e => { setHeaderFontSize(+e.target.value); setDirty('company'); }} style={{ height: 40, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: '0.8rem' }}>
                                      {[8,9,10,11,12,14,16,18,20].map(s => <option key={s} value={s}>{s}pt</option>)}
                                    </select>
                                    <label style={{ display: 'inline-block', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '1px solid var(--border)' }}>
                                      <input type="color" value={headerColor || '#000000'} onChange={e=>{setHeaderColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, cursor: 'pointer', opacity: 0 }} />
                                      <div style={{ width: '100%', height: '100%', background: headerColor || '#000000', pointerEvents: 'none' }} />
                                    </label>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* WATERMARK MODULE */}
                          <div style={{ background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(150,150,150,0.1)' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)', textTransform: 'uppercase' }}>{t('vodeniZigPecat')}</div>
                              <div onClick={()=>{setWmEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: wmEnabled !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: wmEnabled !== false ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                              </div>
                            </div>
                            
                            {wmEnabled !== false && (
                              <div style={{ padding: '20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minWidth: 200 }}>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{t('sadrzaj')}</div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      {[{id:'logo',lbl:'Logo'},{id:'name',lbl:t('naziv')},{id:'both',lbl:t('oboje')}].map(o => (
                                        <button key={o.id} onClick={()=>{setWmContent(o.id);setDirty('company');}} style={{flex: 1, padding:'8px 6px',borderRadius:8,fontSize:'0.75rem',fontWeight:700,cursor:'pointer',border:wmContent===o.id?'2px solid var(--primary)':'1px solid var(--border)',background:wmContent===o.id?'var(--primary-glow)':'var(--bg-card)',color:wmContent===o.id?'var(--primary)':'var(--text-muted)'}}>{o.lbl}</button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{t('transparentnost')} ({wmOpacity}%)</div>
                                    <input type="range" min={1} max={30} value={wmOpacity} onChange={e=>{setWmOpacity(+e.target.value);setDirty('company');}} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{t('velicina')} ({wmSize}px)</div>
                                    <input type="range" min={80} max={600} value={wmSize} onChange={e=>{setWmSize(+e.target.value);setDirty('company');}} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{t('pozicija')}</div>
                                  <table style={{ borderCollapse: 'separate', borderSpacing: '4px' }}>
                                    <tbody>
                                      {[0,1,2].map(r => (
                                        <tr key={r}>
                                          {[0,1,2].map(c => {
                                            const pos = WATERMARK_POSITIONS.find(p => p.row === r && p.col === c);
                                            if(!pos) return <td key={c}></td>;
                                            return (
                                              <td key={c} style={{ padding: 0 }}>
                                                <button type="button" onClick={()=>{setWmPosition(pos.id);setDirty('company');}} style={{ width: 44, height: 44, borderRadius: 10, fontSize: '1rem', cursor: 'pointer', border: 'none', background: wmPosition===pos.id ? 'var(--primary)' : 'var(--bg-card)', color: wmPosition===pos.id ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s', transform: wmPosition===pos.id ? 'scale(1.05)' : 'scale(1)', boxShadow: wmPosition===pos.id ? '0 4px 12px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>{pos.label}</button>
                                              </td>
                                            )
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                
                              </div>
                            )}
                          </div>

                        </div>

                        {/* LIVE REPORT PREVIEW HERO */}
                        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
                           <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>{t('pdfSimulacija')}</div>
                           <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, padding: '24px 24px 60px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', height: '100%', minHeight: 400 }}>
                              {/* Watermark Rendering */}
                              {wmEnabled !== false && (
                                <div style={{ position:'absolute', pointerEvents:'none', zIndex:0, textAlign:'center', top:wmPosition.includes('top')?'15%':wmPosition.includes('bottom')?'90%':'50%', left:wmPosition.includes('left')?'15%':wmPosition.includes('right')?'85%':'50%', transform:'translate(-50%,-50%)', opacity:wmOpacity/100, transition: 'all 0.4s ease' }}>
                                  {(wmContent==='logo'||wmContent==='both') && companyData.logo && <img src={companyData.logo} alt="" style={{maxWidth:wmSize*0.5,maxHeight:wmSize*0.3,objectFit:'contain',display:'block',margin:'0 auto'}} />}
                                  {(wmContent==='name'||wmContent==='both') && <div style={{fontSize:Math.max(6,Math.round(wmSize/16))+'pt',fontWeight:900,letterSpacing:1,textTransform:'uppercase',color:'#000',marginTop:4}}>{companyData.naziv||'NAZIV'}</div>}
                                </div>
                              )}

                              {/* Header Rendering */}
                              {headerEnabled !== false && (
                                <div style={{display:'flex',justifyContent:logoPosition==='center'?'center':'space-between',alignItems:'flex-start',borderBottom:'3px solid '+pdfAccentColor,paddingBottom:8,marginBottom:12,position:'relative',zIndex:1, transition: 'border-color 0.3s'}}>
                                  <div style={{textAlign:logoPosition==='center'?'center':'left'}}>
                                    {companyData.logo
                                      ?<img src={companyData.logo} alt="" style={{height:Math.max(logoSize*0.45, 30),maxWidth:120,objectFit:'contain',display:'block'}}/>
                                      :<div style={{fontSize:'8pt',fontWeight:800,color:pdfAccentColor}}>{companyData.naziv||'Company'}</div>}
                                    {showCompanyName !== false && companyData.logo && <div style={{fontSize:'5pt',fontWeight:800,color:'#333',textAlign:'center',width:Math.max(logoSize*0.45*4, 120),maxWidth:120,marginTop:2}}>{companyData.naziv}</div>}
                                  </div>
                                  {logoPosition!=='center' && showCompanyInfo !== false && (
                                    <div style={{textAlign:'right',fontSize:'3.5pt',color:'#666', lineHeight: 1.4}}>
                                      <div style={{fontWeight: 700, color: '#333', fontSize: '4.5pt'}}>{companyData.naziv}</div>
                                      <div>{companyData.adresa}</div>
                                      {companyData.jib && <div>JIB: {companyData.jib}</div>}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Custom text */}
                              {headerEnabled !== false && (
                                <div style={{fontSize:Math.max(5,headerFontSize*0.5)+'pt',fontWeight:headerBold?800:500,fontStyle:headerItalic?'italic':'normal',textDecoration:headerUnderline?'underline':'none',color:headerColor,marginBottom:15,position:'relative',zIndex:1}}>{headerText || (t('prazno'))}</div>
                              )}
                              
                              {/* Mock Content */}
                              <div style={{fontSize:'6pt',fontWeight:800,textTransform:'uppercase',letterSpacing:0.5,color:'#1e293b',position:'relative',zIndex:1, marginBottom: 8}}>{t('izvjestajOProcjeni')}</div>
                              <div style={{position:'relative',zIndex:1}}>{[1,2,3,4,5].map(i=>(
                                <div key={i} style={{display:'flex',gap:6,marginBottom:6}}>
                                  <div style={{width:'30%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                  <div style={{width:'50%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                  <div style={{width:'20%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                </div>
                              ))}</div>
                           </div>
                        </div>

                      </div>
                    </div>

                  </div>
                  </>
                  )}
                </div>{/* end super premium wrapper */}



                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button className="btn btn-primary" onClick={handleSaveCompany}>💾 {t('save')}</button>

                  {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {t('sacuvano1')}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 3: NOTIFICATIONS                              */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'notifications' && (
        <div className="card">
          <div className="card-body">
            {/* Top save bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>🔔 {t('postavkeObavijesti')}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {dirtyTab === 'notifications' && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600 }}>● {t('nesacuvano')}</span>
                )}
                <button className="btn btn-primary btn-sm" onClick={handleSaveNotifSettings}>
                  💾 {t('save')}
                </button>
                {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>✅</span>}
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 16 }}>
              {t('odaberiteKojeObavijestiZelitePrimati')}
            </p>

            {/* ── Certificates ── */}
            <SectionHeader icon="📋" title={t('uvjerenjaRadnika')} />
            <Toggle
              checked={notifSettings.certExpiryEnabled}
              onChange={v => updateNotif('certExpiryEnabled', v)}
              label={t('obavijestOIstekuUvjerenja')}
              description={t('upozoriMeKadaRadnickoUvjerenje')}
            />
            {notifSettings.certExpiryEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('upozoriMe')}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.certExpiryDays} onChange={e => updateNotif('certExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('danaPrijeIsteka')}</span>
              </div>
            )}

            {/* ── Equipment ── */}
            <SectionHeader icon="⚙️" title={t('pregledOpreme')} />
            <Toggle
              checked={notifSettings.equipExpiryEnabled}
              onChange={v => updateNotif('equipExpiryEnabled', v)}
              label={t('obavijestOPregleduOpreme')}
              description={t('upozoriMeKadaOpremaTreba')}
            />
            {notifSettings.equipExpiryEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('upozoriMe')}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.equipExpiryDays} onChange={e => updateNotif('equipExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('danaPrijeIsteka')}</span>
              </div>
            )}

            {/* ── Documents ── */}
            <SectionHeader icon="📄" title={t('dokumentiPoslodavca')} />
            <Toggle
              checked={notifSettings.docExpiryEnabled}
              onChange={v => updateNotif('docExpiryEnabled', v)}
              label={t('obavijestOIstekuDokumenata')}
              description={t('upozoriMeKadaDokumentiIsticu')}
            />
            {notifSettings.docExpiryEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('upozoriMe')}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.docExpiryDays} onChange={e => updateNotif('docExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('danaPrijeIsteka')}</span>
              </div>
            )}

            {/* ── Workers ── */}
            <SectionHeader icon="👷" title={t('radnici')} />
            <Toggle
              checked={notifSettings.workersNoCerts}
              onChange={v => updateNotif('workersNoCerts', v)}
              label={t('radniciBezUvjerenja')}
              description={t('prikaziKolikoAktivnihRadnikaNema')}
            />
            <Toggle
              checked={notifSettings.workersNoPPE}
              onChange={v => updateNotif('workersNoPPE', v)}
              label={t('radniciBezZastitneOpreme')}
              description={t('prikaziKolikoAktivnihRadnikaNema1')}
            />

            {/* ── Calendar ── */}
            <SectionHeader icon="📅" title={t('kalendar')} />
            <Toggle
              checked={notifSettings.calendarWeek}
              onChange={v => updateNotif('calendarWeek', v)}
              label={t('dogaajiOvogTjedna')}
              description={t('prikaziNadolazeceKalendarskeDogaaje')}
            />
            <div style={{ marginTop: 12, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12, color: 'var(--text)' }}>
                {t('prikazaniDogaajiNaKalendaru')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Toggle checked={notifSettings.calShowCerts ?? true} onChange={v => updateNotif('calShowCerts', v)} label={t('uvjerenjaRadnika1')} />
                <Toggle checked={notifSettings.calShowEquip ?? true} onChange={v => updateNotif('calShowEquip', v)} label={t('radnaOprema')} />
                <Toggle checked={notifSettings.calShowDoc ?? true} onChange={v => updateNotif('calShowDoc', v)} label={t('dokumenti')} />
                <Toggle checked={notifSettings.calShowRisk ?? true} onChange={v => updateNotif('calShowRisk', v)} label={t('mjereRizika')} />
                <Toggle checked={notifSettings.calShowMed ?? true} onChange={v => updateNotif('calShowMed', v)} label={t('ljekarskiPregledi')} />
                <Toggle checked={notifSettings.calShowService ?? true} onChange={v => updateNotif('calShowService', v)} label={t('servisi')} />
                <Toggle checked={notifSettings.calShowFleet ?? true} onChange={v => updateNotif('calShowFleet', v)} label={t('vozilaRegtehnicki')} />
              </div>
            </div>

            {/* ── Vozni Park (Fleet) ── */}
            <SectionHeader icon="🚗" title={t('vozniPark')} />
            <Toggle
              checked={notifSettings.fleetExpiryEnabled ?? true}
              onChange={v => updateNotif('fleetExpiryEnabled', v)}
              label={t('obavijestOIstekuRegistracijeI')}
              description={t('upozoriMeKadaVozilimaIstice')}
            />
            {(notifSettings.fleetExpiryEnabled ?? true) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('upozoriMe')}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.fleetExpiryDays || 30} onChange={e => updateNotif('fleetExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('danaPrijeIsteka')}</span>
              </div>
            )}

            {/* ── Zaštita od požara (ZOP) ── */}
            <SectionHeader icon="🧯" title={lang === 'bs' || lang === 'hr' ? 'Zaštita od požara (ZOP)' : 'Fire Protection (ZOP)'} />
            <Toggle
              checked={notifSettings.fireExpiryEnabled ?? true}
              onChange={v => updateNotif('fireExpiryEnabled', v)}
              label={lang === 'bs' || lang === 'hr' ? 'Obavijest o isteku servisa/pregleda protupožarne opreme' : 'Fire protection service/inspection alerts'}
              description={lang === 'bs' || lang === 'hr' ? 'Upozori me kada vatrogasnim aparatima ili hidrantima ističe rok ispitivanja' : 'Warn me when fire extinguishers or hydrants require testing'}
            />
            {(notifSettings.fireExpiryEnabled ?? true) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('upozoriMe')}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.fireExpiryDays || 30} onChange={e => updateNotif('fireExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('danaPrijeIsteka')}</span>
              </div>
            )}

            {/* ── Evakuacija ── */}
            <SectionHeader icon="🚨" title={lang === 'bs' || lang === 'hr' ? 'Evakuacija' : 'Evacuation'} />
            <Toggle
              checked={notifSettings.evacExpiryEnabled ?? true}
              onChange={v => updateNotif('evacExpiryEnabled', v)}
              label={lang === 'bs' || lang === 'hr' ? 'Obavijest o vježbama i revizijama planova evakuacije' : 'Evacuation drill and plan revision alerts'}
              description={lang === 'bs' || lang === 'hr' ? 'Upozori me kada planovima evakuacije ističe rok revizije ili kada je potrebno održati vježbu evakuacije' : 'Warn me when evacuation plans require revision or when drills are due'}
            />
            {(notifSettings.evacExpiryEnabled ?? true) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('upozoriMe')}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.evacExpiryDays || 30} onChange={e => updateNotif('evacExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('danaPrijeIsteka')}</span>
              </div>
            )}

            {/* ── Admin-only notifications ── */}
            {isAdmin && (
              <>
                <SectionHeader icon="🛡️" title={t('adminZdravljeSistema')} />
                <Toggle
                  checked={notifSettings.adminDbSize}
                  onChange={v => updateNotif('adminDbSize', v)}
                  label={t('upozorenjeOVeliciniBaze')}
                  description={t('obavijestiMeKadaBazaPodataka')}
                />
                {notifSettings.adminDbSize && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('pragUpozorenjaZapisi')}</label>
                      <input className="form-input" type="number" value={notifSettings.adminDbWarnThreshold} onChange={e => updateNotif('adminDbWarnThreshold', Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('kriticniPragZapisi')}</label>
                      <input className="form-input" type="number" value={notifSettings.adminDbCriticalThreshold} onChange={e => updateNotif('adminDbCriticalThreshold', Number(e.target.value))} />
                    </div>
                  </div>
                )}

                <SectionHeader icon="📈" title={t('adminRastIAktivnost')} />
                <Toggle checked={notifSettings.adminNewCompanies} onChange={v => updateNotif('adminNewCompanies', v)} label={t('noveKompanije')} description={t('obavijestiMeKadaSeRegistrira')} />
                <Toggle checked={notifSettings.adminNewUsers} onChange={v => updateNotif('adminNewUsers', v)} label={t('noviKorisnici')} description={t('obavijestiMeKadaSeRegistrira1')} />
                <Toggle checked={notifSettings.adminMilestones} onChange={v => updateNotif('adminMilestones', v)} label={t('milestoneObavijesti')} description={t('obavijestiNa50100250')} />

                <SectionHeader icon="🔒" title={t('adminSigurnost')} />
                <Toggle checked={notifSettings.adminFailedLogins} onChange={v => updateNotif('adminFailedLogins', v)} label={t('neuspjesnePrijave')} description={t('upozoriMeNa5Neuspjesnih')} />
                <Toggle checked={notifSettings.adminInactiveCompanies} onChange={v => updateNotif('adminInactiveCompanies', v)} label={t('neaktivneKompanije')} description={t('prikaziKompanijeBezPrijave30')} />
              </>
            )}

            {/* ── Automated Email Notifications ── */}
            <SectionHeader icon="📧" title={t('automatskiEmailDnevniPregled')} />
            <div style={{ padding: '14px 18px', marginBottom: 8, borderRadius: 10, background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.2)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {t('svakiDanU0700Sistem')}
              </div>
            </div>
            <Toggle
              checked={notifSettings.emailNotifEnabled ?? false}
              onChange={v => updateNotif('emailNotifEnabled', v)}
              label={t('aktivirajAutomatskiEmailDnevnik')}
              description={t('svakiDanU0700Salje')}
            />
            {(notifSettings.emailNotifEnabled ?? false) && (<>
              {/* Recipients */}
              <div style={{ padding: '14px 0 6px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 10 }}>📬 {t('primatelji')}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}>
                    <input type="checkbox" id="notif-to-company" checked={notifSettings.emailNotifToCompany ?? true} onChange={e => updateNotif('emailNotifToCompany', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                    🏢 {t('emailFirme')}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(email polje firme)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}>
                    <input type="checkbox" id="notif-to-officer" checked={notifSettings.emailNotifToOfficer ?? true} onChange={e => updateNotif('emailNotifToOfficer', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                    👤 {t('mojEmailStrucnjakZnr')}
                  </label>
                </div>
              </div>

              {/* Language */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', flexShrink: 0 }}>🌐 {t('jezikEmaila')}</div>
                <select
                  className="form-select"
                  style={{ width: 200 }}
                  value={notifSettings.emailNotifLang ?? 'bs'}
                  onChange={e => updateNotif('emailNotifLang', e.target.value)}>
                  <option value="bs">🇧🇦 Bosanski</option>
                  <option value="hr">🇭🇷 Hrvatski</option>
                  <option value="sr">🇷🇸 Srpski</option>
                  <option value="sl">🇸🇮 Slovenščina</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="en">🇬🇧 English only</option>
                  <option value="bilingual">🌍 Bilingual (Local + English)</option>
                </select>
              </div>

              {/* Days threshold */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>{t('ukljuciStavkeKojeIsticuU')}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.emailNotifDays ?? 30} onChange={e => updateNotif('emailNotifDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{t('dana')}</span>
              </div>

              {/* Per-category toggles */}
              <div style={{ padding: '12px 0 4px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 10 }}>📋 {t('ukljuciKategorijeUEmail')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <Toggle checked={notifSettings.emailNotifCerts ?? true} onChange={v => updateNotif('emailNotifCerts', v)} label={t('uvjerenjaRadnika1')} />
                  <Toggle checked={notifSettings.emailNotifEquip ?? true} onChange={v => updateNotif('emailNotifEquip', v)} label={t('radnaOprema')} />
                  <Toggle checked={notifSettings.emailNotifDocs ?? true} onChange={v => updateNotif('emailNotifDocs', v)} label={t('dokumentiPoslodavca1')} />
                  <Toggle checked={notifSettings.emailNotifFleet ?? true} onChange={v => updateNotif('emailNotifFleet', v)} label={t('vozniPark1')} />
                  <Toggle checked={notifSettings.emailNotifMedical ?? true} onChange={v => updateNotif('emailNotifMedical', v)} label={t('ljekarskiPregledi')} />


                </div>
              </div>
            </>)}

            {/* ── ALARMI SA TERENA (Real-time) ── */}
            <SectionHeader icon="🚨" title={t('hitniAlarmiTerenskePrijave')} />
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                                {t('emailZaObavijestiSaTerena')}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                {t('ovoJeEmailAdresaNa')}
                            </div>
                            <input 
                                className="form-input" 
                                style={{ maxWidth: 500, background: 'var(--bg-page)', borderColor: 'var(--danger)', borderWidth: 1 }}
                                placeholder={t('nprSigurnostfirmabaDirektorfirmaba')}
                                value={notifSettings.obsNotifEmail || ''} 
                                onChange={e => updateNotif('obsNotifEmail', e.target.value)} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleSaveNotifSettings}>💾 {t('sacuvajPostavkeObavijesti')}</button>
              {saved && !notifSyncError && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {t('sacuvano1')}</span>}
              {notifSyncError && (
                <span className="animate-fadeIn" style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                  ⚠️ {t('greskaPriSnimanjuNaServer')}
                </span>
              )}
            </div>
            {notifSyncError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8rem', color: 'var(--danger)' }}>
                {t('postavkeSuSacuvaneLokalnoAli')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 4: DISPLAY                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'display' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>🎨 {t('postavkePrikaza')}</h3>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">{t('language')}</label>
                <select className="form-select" value={lang} onChange={e => setLang(e.target.value)}>
                  <option value="bs">🇧🇦 Bosanski</option>
                  <option value="hr">🇭🇷 Hrvatski</option>
                  <option value="sr">🇷🇸 Srpski</option>
                  <option value="sl">🇸🇮 Slovenščina</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="en">🇬🇧 English</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('formatDatuma')}</label>
                <select className="form-select" value={appSettings.dateFormat} onChange={e => updateApp('dateFormat', e.target.value)}>
                  <option value="dd.mm.yyyy">DD.MM.YYYY.</option>
                  <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                  <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('zapisiPoStranici')}</label>
                <select className="form-select" value={appSettings.recordsPerPage} onChange={e => updateApp('recordsPerPage', Number(e.target.value))}>
                  <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                </select>
              </div>
            </div>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

            <Toggle checked={appSettings.compactView} onChange={v => updateApp('compactView', v)} label={t('kompaktniPrikaz')} description={t('smanjiRazmakeIzmeuElemenata')} />
            <Toggle checked={appSettings.animations} onChange={v => updateApp('animations', v)} label={t('animacije')} description={t('ukljuciGlatkePrijelazeIAnimacije')} />
            <Toggle checked={appSettings.notificationSound} onChange={v => updateApp('notificationSound', v)} label={t('zvukObavijesti')} description={t('pustiZvukKadaStigneNova')} />
            <Toggle checked={appSettings.sidebarOpen} onChange={v => updateApp('sidebarOpen', v)} label={t('bocnaTrakaUvijekOtvorena')} description={t('zadrziBocnuTrakuOtvorenomPri')} />

            <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: '1.2rem', backgroundImage: 'linear-gradient(135deg, #E040FB, #7C4DFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>Zia AI</span>
              </div>
              <Toggle 
                checked={appSettings.proactiveZia !== false} 
                onChange={v => updateApp('proactiveZia', v)} 
                label={t('proaktivnaAsistentica')} 
                description={t('dozvoliZiiDaAnaliziraStanje')} 
              />
            </div>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

            {/* Dark mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                  {isDark ? '🌙' : '☀️'} {t('tamniMod')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('trenutno')}
                  <strong>{isDark ? (t('tamni')) : (t('svijetli'))}</strong>
                  {t('promjenaSeOdmahPrimjenjuje')}
                </div>
              </div>
              <button
                onClick={toggleTheme}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 'var(--radius-full)',
                  border: `2px solid ${isDark ? 'var(--primary)' : 'var(--border)'}`,
                  background: isDark ? 'var(--bg-input)' : 'var(--bg-input)',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                  fontFamily: 'var(--font-heading)',
                  color: isDark ? 'var(--primary)' : 'var(--text-light)',
                  transition: 'all 0.25s ease',
                }}>
                <span style={{ fontSize: '1.1rem' }}>{isDark ? '🌙' : '☀️'}</span>
                <span>{isDark ? (t('ukljuciSvijetliMod')) : (t('ukljuciTamniMod'))}</span>
              </button>
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveAppSettings}>💾 {t('sacuvajPostavkePrikaza')}</button>
              {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {t('sacuvano1')}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 5: SYSTEM (Admin only)                       */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'system' && isAdmin && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>🛡️ {t('postavkeSistema')}</h3>



            <SectionHeader icon="🔒" title={t('sigurnost')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '12px 0' }}>
              <div className="form-group">
                <label className="form-label">{t('minimalnaDuzinaLozinke')}</label>
                <select className="form-select" value={appSettings.minPasswordLength} onChange={e => updateApp('minPasswordLength', Number(e.target.value))}>
                  {[6, 8, 10, 12, 16, 20].map(n => <option key={n} value={n}>{n} {t('znakova')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('automatskoOdjavljivanje')}</label>
                <select className="form-select" value={appSettings.autoLogoutMinutes} onChange={e => updateApp('autoLogoutMinutes', Number(e.target.value))}>
                  <option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 {t('sat')}</option><option value={120}>2 {t('sata')}</option><option value={0}>{t('nikada')}</option>
                </select>
              </div>
            </div>

            <SectionHeader icon="📁" title={t('datoteke')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '12px 0' }}>
              <div className="form-group">
                <label className="form-label">{t('maksimalnaVelicinaDatoteke')}</label>
                <select className="form-select" value={appSettings.maxFileSizeMB} onChange={e => updateApp('maxFileSizeMB', Number(e.target.value))}>
                  <option value={5}>5 MB</option><option value={10}>10 MB</option><option value={25}>25 MB</option><option value={50}>50 MB</option>
                </select>
              </div>
            </div>

            <SectionHeader icon="🔧" title={t('odrzavanje')} />
            <Toggle checked={appSettings.maintenanceMode} onChange={v => updateApp('maintenanceMode', v)} label={t('rezimOdrzavanja')} description={t('prikaziStranicuOdrzavanjaZaSve')} />
            {appSettings.maintenanceMode && (
              <div className="form-group" style={{ padding: '12px 0 0 24px' }}>
                <label className="form-label">{t('porukaOdrzavanja')}</label>
                <input className="form-input" value={appSettings.maintenanceMessage} onChange={e => updateApp('maintenanceMessage', e.target.value)} placeholder={t('aplikacijaJeTrenutnoNaOdrzavanju')} />
              </div>
            )}

            {isSuperAdmin && (
              <>
                <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />


            {/* ── Country Migration ── */}
            <SectionHeader icon="🌍" title={t('migracijaJurisdikcijeBahr')} />
            <CountryMigrationPanel lang={lang} t={t} />

            <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <SectionHeader icon="☠️" title={t('opasnaZonaSuperAdmin')} />
            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.3)' }}>
              <div style={{ fontSize: '0.85rem', color: '#D32F2F', marginBottom: 16, fontWeight: 500 }}>
                {t('paznjaHardWipeBriseSve')}
              </div>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleWipeDev}
                disabled={wiping || !activeCompanyId}
                style={{ background: '#D32F2F', borderColor: '#D32F2F' }}>
                {wiping ? <span className="spinner" style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span> : '☠️'} 
                {t('hardWipeDsc')}
              </button>
            </div>
            </>
            )}

            <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />            {/* App version info */}
            <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-input)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>eZNR v{APP_VERSION}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('datumIzgradnje')}: {APP_BUILD_DATE}</div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(76,175,80,0.1)', color: 'var(--success)' }}>
                  {t('najnovijaVerzija')}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>{t('changelog')}:</div>
              {CHANGELOG[0]?.changes?.map((c, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '2px 0', paddingLeft: 12, borderLeft: '2px solid var(--primary)' }}>• {c}</div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveAppSettings}>💾 {t('sacuvajPostavkeSistema')}</button>
              {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {t('sacuvano1')}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 6: STATISTICS (Admin only)                   */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'statistics' && isAdmin && stats && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <h3 style={{ marginBottom: 20 }}>📊 {t('pregledSistema')}</h3>

              {/* Main stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                <StatCard icon="🏢" value={stats.totalCompanies} label={t('kompanije')} color="var(--primary)" />
                <StatCard icon="👥" value={stats.totalUsers} label={t('korisnici')} color="#7B1FA2" />
                <StatCard icon="👷" value={stats.totalWorkers} label={t('radnici')} color="#1976D2" />
                <StatCard icon="📋" value={stats.totalCertificates} label={t('uvjerenja')} color="var(--warning)" />
                <StatCard icon="⚙️" value={stats.totalEquipment} label={t('oprema')} color="#388E3C" />
                <StatCard icon="💾" value={stats.totalRecords} label={t('ukupnoZapisa')} color="var(--danger)" />
              </div>

              {/* Workers breakdown */}
              <SectionHeader icon="👷" title={t('radniciPregled')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-badge)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--info)' }}>{stats.activeWorkers}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--info)' }}>{t('aktivni')}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: 'rgba(255,152,0,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)' }}>{stats.inactiveWorkers}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>{t('neaktivni')}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: '#F3E5F5', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7B1FA2' }}>{stats.totalWorkers}</div>
                  <div style={{ fontSize: '0.75rem', color: '#7B1FA2' }}>{t('ukupno')}</div>
                </div>
              </div>

              {/* Certificate breakdown */}
              <SectionHeader icon="📋" title={t('uvjerenjaStatus')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 16, borderRadius: 10, background: 'rgba(76,175,80,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{stats.activeCerts}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>{t('aktivna')}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: 'rgba(244,67,54,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)' }}>{stats.expiredCerts}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{t('istekla')}</div>
                </div>
              </div>

              {/* Top companies */}
              {stats.topCompanies?.length> 0 && (
                <>
                  <SectionHeader icon="🏆" title={t('topKompanijePoBrojuRadnika')} />
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('kompanija')}</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('radnici')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topCompanies.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '8px 12px', fontSize: '0.85rem', fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{c.name}</td>
                          <td style={{ padding: '8px 12px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right' }}>{c.workers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Collection breakdown */}
              <SectionHeader icon="📦" title={t('zapisiPoKolekcijama')} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {Object.entries(stats.collectionCounts)
                  .filter(([, count]) => count> 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([col, count]) => (
                    <div key={col} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: '0.8rem', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{col}</span>
                      <span style={{ fontWeight: 700 }}>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 7: ACTIVITY LOG (all users)                   */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'activity' && (
        <div>
          {/* ── Admin: Online users ── */}
          {isAdmin && onlineUsers.length> 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', boxShadow: '0 0 6px #22C55E' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t('korisniciOnline')} ({onlineUsers.length})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {onlineUsers.map(u => (
                    <div key={u.userId} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 12px', borderRadius: 20,
                      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', fontSize: '0.78rem',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                      <span style={{ fontWeight: 600 }}>{u.userName}</span>
                      <span style={{ color: 'var(--text-muted)' }}>• {u.companyName || '—'}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{humanizePage(u.page)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>📋 {t('dnevnikAktivnosti')}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    onClick={() => { if (isAdmin) { clearAdminLog(); } clearUserLog(); setLogRefresh(r => r + 1); }}>
                    🗑️ {t('obrisiLog')}
                  </button>
                  <button className="btn" style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    onClick={() => setLogRefresh(r => r + 1)}>
                    🔄
                  </button>
                </div>
              </div>

              {/* Category filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {[null, 'worker', 'certificate', 'equipment', 'ppe', 'document', 'company', 'expiry', 'auth'].map(cat => (
                  <button key={cat || 'all'} onClick={() => setLogFilter(cat)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                      border: '1px solid var(--border)', cursor: 'pointer',
                      background: logFilter === cat ? 'var(--primary)' : 'var(--bg-input)',
                      color: logFilter === cat ? 'white' : 'var(--text)',
                    }}>
                    {cat === null ? (t('filterSve')) :
                      cat === 'worker' ? t('filterRadnici') :
                        cat === 'certificate' ? t('filterUvjerenja') :
                          cat === 'equipment' ? t('filterOprema') :
                            cat === 'ppe' ? t('filterOzo') :
                              cat === 'document' ? t('filterDokumenti') :
                                cat === 'company' ? t('filterFirme') :
                                  cat === 'expiry' ? t('filterIsteci') : t('filterPrijave')}
                  </button>
                ))}
              </div>

              {/* Admin log section */}
              {isAdmin && adminLog.length> 0 && (
                <>
                  <SectionHeader icon="🛡️" title={t('adminAktivnosti')} />
                  <div style={{ marginBottom: 16 }}>
                    {adminLog.map(entry => {
                      const colors = getSeverityColors(entry.severity);
                      return (
                        <div key={entry.id} 
                          onClick={() => handleLogClick(entry)}
                          style={{
                          display: 'flex', gap: 12, padding: '10px 12px',
                          borderBottom: '1px solid var(--border-light)',
                          borderLeft: `3px solid ${colors.dot}`,
                          background: colors.bg,
                          marginBottom: 2, borderRadius: '0 6px 6px 0',
                          cursor: entry.relatedId ? 'pointer' : 'default',
                          transition: 'filter 0.2s'
                        }}
                        onMouseEnter={(e) => { if (entry.relatedId) e.currentTarget.style.filter = 'brightness(0.95)'; }}
                        onMouseLeave={(e) => { if (entry.relatedId) e.currentTarget.style.filter = ''; }}>
                          <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{entry.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{translateLogTitle(entry.title, lang, t)}</div>
                            {entry.detail && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>{translateLogDetail(entry.detail, lang, t)}</div>}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatLogTime(entry.timestamp)}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* User log section */}
              <SectionHeader icon="📝" title={t('mojeAktivnosti')} />
              {userLog.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                  {t('nemaEvidentiranihAktivnosti')}
                  <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{t('aktivnostiSeBiljezeKadaDodajete')}</div>
                </div>
              ) : userLog.map(entry => {
                const colors = getSeverityColors(entry.severity);
                return (
                  <div key={entry.id}
                    onClick={() => handleLogClick(entry)}
                    style={{
                    display: 'flex', gap: 12, padding: '10px 12px',
                    borderBottom: '1px solid var(--border-light)',
                    borderLeft: `3px solid ${colors.dot}`,
                    background: colors.bg,
                    marginBottom: 2, borderRadius: '0 6px 6px 0',
                    cursor: entry.relatedId ? 'pointer' : 'default',
                    transition: 'filter 0.2s'
                  }}
                  onMouseEnter={(e) => { if (entry.relatedId) e.currentTarget.style.filter = 'brightness(0.95)'; }}
                  onMouseLeave={(e) => { if (entry.relatedId) e.currentTarget.style.filter = ''; }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{entry.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{translateLogTitle(entry.title, lang, t)}</div>
                      {entry.detail && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>{translateLogDetail(entry.detail, lang, t)}</div>}
                      {entry.userName && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>👤 {entry.userName}</div>}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatLogTime(entry.timestamp)}</div>
                  </div>
                );
              })}

              {(userLog.length>= logLimit || (isAdmin && adminLog.length>= logLimit)) && (
                <button 
                  onClick={() => setLogLimit(l => l + 20)} 
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', marginTop: 12, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                  {t('ucitajStarijeAktivnosti')}
                </button>
              )}

              {userLog.length === 0 && isAdmin && adminLog.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {t('logJePrazan')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 8: GDPR & PRIVACY                             */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'gdpr' && (
        <div className="animate-fadeIn">
          {/* Cookie consent settings */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <h3 style={{ marginBottom: 12 }}>🍪 {gdprLocalTrans[lang || 'bs']?.cookieConsent}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                {gdprLocalTrans[lang || 'bs']?.cookieConsentDesc}
              </p>

              {/* Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg-input)', padding: 20, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{gdprLocalTrans[lang || 'bs']?.essential}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{gdprLocalTrans[lang || 'bs']?.essentialDesc}</div>
                  </div>
                  <input type="checkbox" className="gdpr-toggle-input" checked={true} disabled={true} readOnly={true} style={{ pointerEvents: 'none', opacity: 0.6 }} />
                </div>
                
                <hr style={{ margin: 0, border: 'none', borderTop: '1px solid var(--border-light)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{gdprLocalTrans[lang || 'bs']?.analytical}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{gdprLocalTrans[lang || 'bs']?.analyticalDesc}</div>
                  </div>
                  <input
                    type="checkbox"
                    className="gdpr-toggle-input"
                    checked={gdprConsent.analytical}
                    onChange={e => setGdprConsent(c => ({ ...c, analytical: e.target.checked }))}
                    style={{
                      appearance: 'none',
                      width: '36px',
                      height: '20px',
                      backgroundColor: gdprConsent.analytical ? 'var(--primary)' : '#2D3148',
                      borderRadius: '20px',
                      position: 'relative',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'background-color 0.2s',
                    }}
                  />
                </div>

                <hr style={{ margin: 0, border: 'none', borderTop: '1px solid var(--border-light)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>{gdprLocalTrans[lang || 'bs']?.marketing}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{gdprLocalTrans[lang || 'bs']?.marketingDesc}</div>
                  </div>
                  <input
                    type="checkbox"
                    className="gdpr-toggle-input"
                    checked={gdprConsent.marketing}
                    onChange={e => setGdprConsent(c => ({ ...c, marketing: e.target.checked }))}
                    style={{
                      appearance: 'none',
                      width: '36px',
                      height: '20px',
                      backgroundColor: gdprConsent.marketing ? 'var(--primary)' : '#2D3148',
                      borderRadius: '20px',
                      position: 'relative',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'background-color 0.2s',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={handleSaveGdprConsent}>
                  💾 {gdprLocalTrans[lang || 'bs']?.saveConsent}
                </button>
                <button className="btn" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }} onClick={handleResetGdprConsent}>
                  🔄 {gdprLocalTrans[lang || 'bs']?.resetConsent}
                </button>
                {gdprSaved && <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem', marginLeft: 8 }} className="animate-fadeIn">✅ {gdprLocalTrans[lang || 'bs']?.successSaved}</span>}
              </div>
            </div>
          </div>

          {/* Data Portability (Export) */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <h3 style={{ marginBottom: 12 }}>📥 {gdprLocalTrans[lang || 'bs']?.portability}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                {gdprLocalTrans[lang || 'bs']?.portabilityDesc}
              </p>
              <button className="btn btn-primary" onClick={handleExportData}>
                {gdprLocalTrans[lang || 'bs']?.exportBtn}
              </button>
            </div>
          </div>

          {/* Account deletion (Right to forgotten) */}
          <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.02)' }}>
            <div className="card-body">
              <h3 style={{ color: 'var(--danger)', marginBottom: 12 }}>🗑️ {gdprLocalTrans[lang || 'bs']?.forget}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                {gdprLocalTrans[lang || 'bs']?.forgetDesc}
              </p>
              <button className="btn btn-danger" onClick={() => { setDeletePassword(''); setDeleteError(''); setShowDeleteModal(true); }}>
                {gdprLocalTrans[lang || 'bs']?.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Account Verification Modal ── */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99998,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.12s ease-out',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
            padding: '32px 36px', maxWidth: 440, width: '90%',
            boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
            animation: 'slideUp 0.15s ease-out', position: 'relative',
            color: 'var(--text)'
          }}>
            {/* × close button */}
            <button
              onClick={() => setShowDeleteModal(false)}
              style={{
                position: 'absolute', top: 14, right: 14,
                background: 'none', border: 'none', fontSize: '1.1rem',
                cursor: 'pointer', color: 'var(--text-muted)',
                lineHeight: 1, padding: '4px 6px', borderRadius: 6,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              title="Zatvori"
            >✕</button>

            {/* Icon & Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{ fontSize: '1.6rem' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                {gdprLocalTrans[lang || 'bs']?.confirmDeleteTitle}
              </h3>
            </div>

            {/* Description */}
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', lineHeight: 1.6, fontSize: '0.88rem' }}>
              {gdprLocalTrans[lang || 'bs']?.confirmDeleteDesc}
            </p>

            {/* Password input */}
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                {gdprLocalTrans[lang || 'bs']?.enterPassword}
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleDeleteAccountConfirm(); }}
                autoFocus
              />
            </div>

            {/* Error Message */}
            {deleteError && (
              <div style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)',
                fontSize: '0.8rem', fontWeight: 600, marginBottom: 18,
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }} className="animate-fadeIn">
                ⚠️ {deleteError}
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn"
                style={{
                  padding: '9px 18px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-input)', color: 'var(--text)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.88rem'
                }}
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                {gdprLocalTrans[lang || 'bs']?.cancel}
              </button>
              <button
                className="btn btn-danger"
                style={{
                  padding: '9px 20px', borderRadius: 'var(--radius-md)',
                  fontWeight: 700, fontSize: '0.88rem'
                }}
                onClick={handleDeleteAccountConfirm}
                disabled={deleting}
              >
                {deleting ? gdprLocalTrans[lang || 'bs']?.deleting : gdprLocalTrans[lang || 'bs']?.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/** Country migration panel — admin tool to set missing `country` on legacy companies */
function CountryMigrationPanel({ lang, t }) {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState('BA');

  const handleDryRun = async () => {
    setMigrating(true); setResult(null);
    try {
      const r = await runCountryMigration(false, selectedCountry);
      setResult({ ...r, mode: 'dry-run' });
    } catch (e) { setResult({ error: e.message }); }
    setMigrating(false);
  };

  const handleExecute = async () => {
    setMigrating(true); setResult(null);
    try {
      const r = await runCountryMigration(true, selectedCountry);
      setResult({ ...r, mode: 'execute' });
    } catch (e) { setResult({ error: e.message }); }
    setMigrating(false);
  };

  return (
    <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        {t('skeniraSveKompanijeUFirestoreu')}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select className="form-select" value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} style={{ width: 130, height: 38, padding: '0 8px', fontSize: '0.85rem' }}>
          <option value="BA">🇧🇦 BA</option>
          <option value="HR">🇭🇷 HR</option>
        </select>
        <button className="btn" onClick={handleDryRun} disabled={migrating} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.8rem' }}>
          {migrating ? '⏳' : '🔍'} DRY RUN
        </button>
        <button className="btn btn-primary" onClick={handleExecute} disabled={migrating} style={{ fontWeight: 600, fontSize: '0.8rem' }}>
          {migrating ? '⏳' : '🚀'} {t('izvrsiMigraciju')}
        </button>
      </div>
      {result && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: result.error ? 'rgba(244,67,54,0.08)' : 'rgba(76,175,80,0.08)', border: `1px solid ${result.error ? 'rgba(244,67,54,0.3)' : 'rgba(76,175,80,0.3)'}`, fontSize: '0.82rem' }}>
          {result.error ? (
            <div style={{ color: 'var(--danger)' }}>❌ {result.error}</div>
          ) : (
            <>
              <div><strong>{result.mode === 'dry-run' ? '🔍 DRY RUN' : '✅ MIGRATED'}</strong></div>
              <div>{t('ukupnoKompanija')}: <strong>{result.total}</strong></div>
              <div>{t('vecPostavljeno')}: <strong>{result.alreadySet}</strong></div>
              {result.wouldMigrate != null && <div>{t('zaMigraciju')}: <strong>{result.wouldMigrate}</strong></div>}
              {result.migrated> 0 && <div style={{ color: 'var(--success)', fontWeight: 700, marginTop: 4 }}>{t('migrirano')}: {result.migrated}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
