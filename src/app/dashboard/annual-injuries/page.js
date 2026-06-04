'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCountry } from '@/contexts/CountryContext';
import { getAll, getById, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import WorkerProfileModal from '@/components/WorkerProfileModal';
import { fmtDate, fmtDateTime } from '@/lib/dateUtils';
import PageHeader from '@/components/PageHeader';

const MONTHS_MAP = {
  bs: ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'August', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'],
  hr: ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'],
  sr: ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Juni', 'Juli', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  sl: ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December']
};

const EMPTY_COMPANY = { naziv: '', adresa: '', jib: '', odgovornaOsoba: '', telefon: '', email: '' };

const DOPIS_TEXT = {
  bs: {
    inspectorateTitle: 'KANTONALNA INSPEKCIJA ZNR',
    inspectorateSubtitle: '(Nadležna kantonalna inspekcija zaštite na radu)',
    subject: 'Predmet: Godišnji izvještaj o povredama na radu za {year}. godinu',
    dear: 'Poštovani,',
    p1: 'U skladu sa odredbama Zakona o zaštiti na radu, dostavljamo Vam godišnji izvještaj o povredama na radu za {year}. godinu, za privredni subjekt',
    p2_1: 'U navedenom periodu evidentirano je ukupno',
    p2_2: 'povreda na radu, od čega:',
    p2_laka: 'lakih',
    p2_teska: 'teških',
    p2_smrtna: 'smrtnih i',
    p2_kol: 'kolektivnih.',
    p3: 'Detaljan pregled povreda na radu sa lakom, teškom ili smrtnom posljedicom dat je u tabeli u prilogu ovog dopisa.',
    p4: 'Ostajemo na Vašem raspolaganju za sva dodatna pojašnjenja.',
    regards: 'S poštovanjem,',
    officer: 'Odgovorna osoba / Stručnjak ZNR',
    seal: 'Pečat i potpis',
    attachment: 'PRILOG: Pregled povreda na radu sa lakom, teškom ili smrtnom posljedicom — {year}. godina',
    empName: 'Naziv poslodavca:',
    table_rb: 'Rb.',
    table_death: 'Povreda na radu sa smrtnom posljedicom',
    table_personal: 'Lični podaci stradalih (ime i prezime, datum rod., spol)',
    table_location: 'Datum i mjesto nesreće / povrede',
    table_cause: 'Uzroci pojave, sadišta teške ili kolektivne povrede rada',
    table_report: 'Prijava MUP stanici i Kantonalnoj inspekciji (broj i datum)',
    table_note: 'Napomena',
    table_sub1: 'Pojedinačna',
    table_sub2: 'Kolektivna',
    table_sub3: 'Broj stradalih',
    no_injuries: '✅ Nije evidentirano povreda na radu za {year}. godinu.',
    form_title: 'Podaci poslodavca (za zaglavlje dopisa)',
    form_f1: 'Naziv firme / poslodavca',
    form_f2: 'Adresa sjedišta',
    form_f3: 'JIB / ID broj',
    form_f4: 'Odgovorna osoba (ime i prezime)',
    form_f5: 'Telefon',
    form_f6: 'Email',
    tab_dopis: '📄 Dopis / Zvanični izvještaj',
    tab_stats: '📊 Statistika po mjesecima',
    stat_total: 'Ukupno',
    stat_laka: 'Lake',
    stat_teska: 'Teške',
    stat_smrtna: 'Smrtne',
    stat_kolektivna: 'Kolektivne',
    stat_bolovanje: 'Bolovanje',
    deadline_warning: '<strong>Rok za dostavu:</strong> Godišnji izvještaj o povredama na radu dostavlja se <strong>Kantonalnoj inspekciji ZNR</strong> do <strong>{deadline}</strong>.',
    deadline_date: '15. januar {nextYear}. godine',
    tbl_month: 'Mjesec',
    tbl_worker: 'Radnik',
    tbl_date: 'Datum',
    tbl_tip: 'Tip',
    tbl_location: 'Lokacija',
    tbl_cause: 'Uzrok',
    tbl_bolovanje: 'Bolovanje',
    pdf_filename: 'Godisnji_izvjestaj_{year}.pdf',
    word_filename: 'Godisnji_izvjestaj_{year}.doc',
    word_title: 'Godišnji izvještaj',
    excel_filename: 'Pregled_povreda_{year}.xlsx',
    excel_sheetname: 'Izvjestaj',
    total_lbl: 'Ukupno:',
    no_reported_injuries: '✅ Nema prijavljenih povreda za {year}. godinu.',
    attachment_list_title: 'Pregled svih povreda',
    letter_number: 'Broj',
    letter_date: 'Datum'
  },
  hr: {
    inspectorateTitle: 'INSPEKTORAT RADA',
    inspectorateSubtitle: '(Nadležni inspektorat zaštite na radu)',
    subject: 'Predmet: Godišnje izvješće o ozljedama na radu za {year}. godinu',
    dear: 'Poštovani,',
    p1: 'U skladu s odredbama Zakona o zaštiti na radu, dostavljamo Vam godišnje izvješće o ozljedama na radu za {year}. godinu, za poslovni subjekt',
    p2_1: 'U navedenom razdoblju preventirano je ukupno',
    p2_2: 'ozljeda na radu, od čega:',
    p2_laka: 'lakih',
    p2_teska: 'teških',
    p2_smrtna: 'smrtnih i',
    p2_kol: 'kolektivnih.',
    p3: 'Detaljan pregled ozljeda na radu s lakom, teškom ili smrtnom posljedicom dan je u tablici u prilogu ovog dopisa.',
    p4: 'Ostajemo na Vašem raspolaganju za sva dodatna pojašnjenja.',
    regards: 'S poštovanjem,',
    officer: 'Odgovorna osoba / Stručnjak ZNR',
    seal: 'Pečat i potpis',
    attachment: 'PRILOG: Pregled ozljeda na radu s lakom, teškom ili smrtnom posljedicom — {year}. godina',
    empName: 'Naziv poslodavca:',
    table_rb: 'Rbr.',
    table_death: 'Ozljeda na radu sa smrtnom posljedicom',
    table_personal: 'Osobni podaci stradalih (ime i prezime, datum rođ., spol)',
    table_location: 'Datum i mjesto nesreće / ozljede',
    table_cause: 'Uzroci pojave teške ili kolektivne ozljede na radu',
    table_report: 'Prijava MUP-u i Inspektoratu (broj i datum)',
    table_note: 'Napomena',
    table_sub1: 'Pojedinačna',
    table_sub2: 'Kolektivna',
    table_sub3: 'Broj stradalih',
    no_injuries: '✅ Nije evidentirano ozljeda na radu za {year}. godinu.',
    form_title: 'Podaci poslodavca (za zaglavlje dopisa)',
    form_f1: 'Naziv tvrtke / poslodavca',
    form_f2: 'Adresa sjedišta',
    form_f3: 'OIB',
    form_f4: 'Odgovorna osoba (ime i prezime)',
    form_f5: 'Telefon',
    form_f6: 'Email',
    tab_dopis: '📄 Dopis / Službeno izvješće',
    tab_stats: '📊 Statistika po mjesecima',
    stat_total: 'Ukupno',
    stat_laka: 'Lake',
    stat_teska: 'Teške',
    stat_smrtna: 'Smrtne',
    stat_kolektivna: 'Kolektivne',
    stat_bolovanje: 'Bolovanje',
    deadline_warning: '<strong>Napomena za RH:</strong> Poslodavci u Hrvatskoj nemaju zakonsku obvezu dostavljanja godišnjeg izvješća inspekcijskim tijelima, već su dužni ovu evidenciju voditi interno.',
    deadline_date: '15. siječnja {nextYear}. godine',
    tbl_month: 'Mjesec',
    tbl_worker: 'Radnik',
    tbl_date: 'Datum',
    tbl_tip: 'Tip',
    tbl_location: 'Lokacija',
    tbl_cause: 'Uzrok',
    tbl_bolovanje: 'Bolovanje',
    pdf_filename: 'Godisnje_izvjesce_{year}.pdf',
    word_filename: 'Godisnje_izvjesce_{year}.doc',
    word_title: 'Godišnje izvješće',
    excel_filename: 'Pregled_ozljeda_{year}.xlsx',
    excel_sheetname: 'Izvjesce',
    total_lbl: 'Ukupno:',
    no_reported_injuries: '✅ Nema prijavljenih ozljeda za {year}. godinu.',
    attachment_list_title: 'Pregled svih ozljeda',
    letter_number: 'Broj',
    letter_date: 'Datum'
  },
  en: {
    inspectorateTitle: 'LABOR INSPECTORATE',
    inspectorateSubtitle: '(Competent Occupational Safety Inspectorate)',
    subject: 'Subject: Annual Work Injury Report for {year}',
    dear: 'Dear Sir/Madam,',
    p1: 'In accordance with the provisions of the Occupational Safety Act, we hereby submit the annual report on work injuries for the year {year}, for the business entity',
    p2_1: 'During the specified period, a total of',
    p2_2: 'work injuries were recorded, of which:',
    p2_laka: 'minor',
    p2_teska: 'severe',
    p2_smrtna: 'fatal and',
    p2_kol: 'collective.',
    p3: 'A detailed overview of work injuries with minor, severe, or fatal consequences is provided in the table attached to this letter.',
    p4: 'We remain at your disposal for any further clarifications.',
    regards: 'Sincerely,',
    officer: 'Responsible Person / OSH Expert',
    seal: 'Stamp and signature',
    attachment: 'ATTACHMENT: Overview of work injuries with minor, severe, or fatal consequences — {year}',
    empName: 'Employer name:',
    table_rb: 'No.',
    table_death: 'Work injury with fatal consequence',
    table_personal: 'Personal data of victims (name, DOB, gender)',
    table_location: 'Date and location of accident',
    table_cause: 'Causes of severe or collective work injury',
    table_report: 'Report to Police & Inspectorate (number and date)',
    table_note: 'Note',
    table_sub1: 'Individual',
    table_sub2: 'Collective',
    table_sub3: 'Number of victims',
    no_injuries: '✅ No work injuries recorded for {year}.',
    form_title: 'Employer data (for letterhead)',
    form_f1: 'Company name',
    form_f2: 'Headquarters address',
    form_f3: 'Company ID / VAT',
    form_f4: 'Responsible person (name)',
    form_f5: 'Phone',
    form_f6: 'Email',
    tab_dopis: '📄 Official Letter / Report',
    tab_stats: '📊 Monthly Statistics',
    stat_total: 'Total',
    stat_laka: 'Minor',
    stat_teska: 'Severe',
    stat_smrtna: 'Fatal',
    stat_kolektivna: 'Collective',
    stat_bolovanje: 'Sick Leave',
    deadline_warning: '<strong>Submission deadline:</strong> The annual work injury report must be submitted to the <strong>Labor Inspectorate</strong> by <strong>{deadline}</strong>.',
    deadline_date: 'January 15, {nextYear}',
    tbl_month: 'Month',
    tbl_worker: 'Worker',
    tbl_date: 'Date',
    tbl_tip: 'Type',
    tbl_location: 'Location',
    tbl_cause: 'Cause',
    tbl_bolovanje: 'Sick Leave',
    pdf_filename: 'Annual_injury_report_{year}.pdf',
    word_filename: 'Annual_injury_report_{year}.doc',
    word_title: 'Annual Injury Report',
    excel_filename: 'Overview_of_injuries_{year}.xlsx',
    excel_sheetname: 'Report',
    total_lbl: 'Total:',
    no_reported_injuries: '✅ No injuries reported for the year {year}.',
    attachment_list_title: 'Overview of all injuries',
    letter_number: 'Number',
    letter_date: 'Date'
  },
  de: {
    inspectorateTitle: 'ARBEITSINSPEKTORAT',
    inspectorateSubtitle: '(Zuständige Inspektion für Arbeitssicherheit und Gesundheitsschutz)',
    subject: 'Betreff: Jahresbericht über Arbeitsunfälle für das Jahr {year}',
    dear: 'Sehr geehrte Damen und Herren,',
    p1: 'in Übereinstimmung mit den Bestimmungen des Arbeitsschutzgesetzes überreichen wir Ihnen den Jahresbericht über Arbeitsunfälle für das Jahr {year} für das Unternehmen',
    p2_1: 'Im genannten Zeitraum wurden insgesamt',
    p2_2: 'Arbeitsunfälle registriert, davon:',
    p2_laka: 'leichte',
    p2_teska: 'schwere',
    p2_smrtna: 'tödliche und',
    p2_kol: 'kollektive.',
    p3: 'Eine detaillierte Übersicht der Arbeitsunfälle mit leichten, schweren oder tödlichen Folgen finden Sie in der Tabelle im Anhang dieses Schreibens.',
    p4: 'Für weitere Fragen stehen wir Ihnen gerne zur Verfügung.',
    regards: 'Mit freundlichen Grüßen',
    officer: 'Verantwortliche Person / Sicherheitsfachkraft',
    seal: 'Stempel und Unterschrift',
    attachment: 'ANHANG: Übersicht der Arbeitsunfälle mit leichten, schweren oder tödlichen Folgen — Jahr {year}',
    empName: 'Name des Arbeitgebers:',
    table_rb: 'Nr.',
    table_death: 'Arbeitsunfall mit tödlicher Folge',
    table_personal: 'Persönliche Daten der Verunfallten (Name, Geburtsdatum, Geschlecht)',
    table_location: 'Datum und Ort des Unfalls',
    table_cause: 'Ursachen des schweren oder kollektiven Arbeitsunfalls',
    table_report: 'Meldung an Polizei und Inspektorat (Nummer und Datum)',
    table_note: 'Anmerkung',
    table_sub1: 'Einzelunfall',
    table_sub2: 'Kollektivunfall',
    table_sub3: 'Anzahl der Verunfallten',
    no_injuries: '✅ Für das Jahr {year} wurden keine Arbeitsunfälle registriert.',
    form_title: 'Arbeitgeberdaten (für den Briefkopf)',
    form_f1: 'Name des Unternehmens / Arbeitgebers',
    form_f2: 'Anschrift des Hauptsitzes',
    form_f3: 'Unternehmens-ID / Steuernummer',
    form_f4: 'Verantwortliche Person (Name)',
    form_f5: 'Telefon',
    form_f6: 'E-Mail',
    tab_dopis: '📄 Offizielles Anschreiben / Bericht',
    tab_stats: '📊 Monatliche Statistik',
    stat_total: 'Gesamt',
    stat_laka: 'Leicht',
    stat_teska: 'Schwer',
    stat_smrtna: 'Tödlich',
    stat_kolektivna: 'Kollektiv',
    stat_bolovanje: 'Krankenstand',
    deadline_warning: '<strong>Abgabefrist:</strong> Der Jahresbericht über Arbeitsunfälle ist bis zum <strong>{deadline}</strong> an das <strong>Arbeitsinspektorat</strong> zu übermitteln.',
    deadline_date: '15. Januar {nextYear}',
    tbl_month: 'Monat',
    tbl_worker: 'Mitarbeiter',
    tbl_date: 'Datum',
    tbl_tip: 'Typ',
    tbl_location: 'Ort',
    tbl_cause: 'Ursache',
    tbl_bolovanje: 'Krankenstand',
    pdf_filename: 'Jahresbericht_Arbeitsunfaelle_{year}.pdf',
    word_filename: 'Jahresbericht_Arbeitsunfaelle_{year}.doc',
    word_title: 'Jahresbericht',
    excel_filename: 'Uebersicht_Arbeitsunfaelle_{year}.xlsx',
    excel_sheetname: 'Bericht',
    total_lbl: 'Gesamt:',
    no_reported_injuries: '✅ Für das Jahr {year} wurden keine Arbeitsunfälle gemeldet.',
    attachment_list_title: 'Übersicht aller Arbeitsunfälle',
    letter_number: 'Nummer',
    letter_date: 'Datum'
  },
  sl: {
    inspectorateTitle: 'INŠPEKTORAT ZA DELO',
    inspectorateSubtitle: '(Pristojni inšpektorat za varnost in zdravje pri delu)',
    subject: 'Zadeva: Letno poročilo o poškodbah pri delu za leto {year}',
    dear: 'Spoštovani,',
    p1: 'V skladu z določili Zakona o varnosti in zdravju pri delu vam pošiljamo letno poročilo o poškodbah pri delu za leto {year} za poslovni subjekt',
    p2_1: 'V navedenom obdobju je bilo evidentiranih skupaj',
    p2_2: 'poškodb pri delu, od tega:',
    p2_laka: 'lažjih',
    p2_teska: 'hujših',
    p2_smrtna: 'smrtnih in',
    p2_kol: 'kolektivnih.',
    p3: 'Podroben pregled poškodb pri delu z lažjimi, hujšimi ali smrtnimi posledicami je naveden v tabeli v prilogi tega dopisa.',
    p4: 'Za vsa dodatna pojasnila smo vam na voljo.',
    regards: 'S spoštovanjem,',
    officer: 'Odgovorna oseba / Strokovni delavec za VZD',
    seal: 'Žig in podpis',
    attachment: 'PRILOGA: Pregled poškodb pri delu z lažjimi, hujšimi ali smrtnimi posledicami — leto {year}',
    empName: 'Naziv delodajalca:',
    table_rb: 'Št.',
    table_death: 'Poškodba pri delu s smrtnim izidom',
    table_personal: 'Osebni podatki poškodovancev (ime in priimek, datum roj., spol)',
    table_location: 'Datum in kraj nesreče / poškodbe',
    table_cause: 'Vzroki za nastanek hujše ali kolektivne poškodbe pri delu',
    table_report: 'Prijava policiji in inšpektoratu (številka in datum)',
    table_note: 'Opomba',
    table_sub1: 'Posamična',
    table_sub2: 'Kolektivna',
    table_sub3: 'Število ponesrečencev',
    no_injuries: '✅ Za leto {year} ni evidentiranih poškodb pri delu.',
    form_title: 'Podatki o delodajalcu (za glavo dopisa)',
    form_f1: 'Naziv podjetja / delodajalca',
    form_f2: 'Naslov sedeža',
    form_f3: 'Matična številka / Davčna št.',
    form_f4: 'Odgovorna oseba (ime in priimek)',
    form_f5: 'Telefon',
    form_f6: 'E-pošta',
    tab_dopis: '📄 Dopis / Uradno poročilo',
    tab_stats: '📊 Statistika po mesecih',
    stat_total: 'Skupaj',
    stat_laka: 'Lažje',
    stat_teska: 'Hujše',
    stat_smrtna: 'Smrtne',
    stat_kolektivna: 'Kolektivne',
    stat_bolovanje: 'Bolniška',
    deadline_warning: '<strong>Rok za oddajo:</strong> Letno poročilo o poškodbah pri delu je treba oddati <strong>Inšpektoratu za delo</strong> do <strong>{deadline}</strong>.',
    deadline_date: '15. januar {nextYear}',
    tbl_month: 'Mesec',
    tbl_worker: 'Delavec',
    tbl_date: 'Datum',
    tbl_tip: 'Tip',
    tbl_location: 'Lokacija',
    tbl_cause: 'Vzrok',
    tbl_bolovanje: 'Bolniška',
    pdf_filename: 'Letno_porocilo_poskodbe_{year}.pdf',
    word_filename: 'Letno_porocilo_poskodbe_{year}.doc',
    word_title: 'Letno poročilo',
    excel_filename: 'Pregled_poskodb_{year}.xlsx',
    excel_sheetname: 'Porocilo',
    total_lbl: 'Skupaj:',
    no_reported_injuries: '✅ Za leto {year} ni prijavljenih poškodb pri delu.',
    attachment_list_title: 'Pregled vseh poškodb',
    letter_number: 'Številka',
    letter_date: 'Datum'
  },
  sr: {
    inspectorateTitle: 'INSPEKTORAT RADA',
    inspectorateSubtitle: '(Nadležna inspekcija rada za zaštitu na radu)',
    subject: 'Predmet: Godišnji izveštaj o povredama na radu za {year}. godinu',
    dear: 'Poštovani,',
    p1: 'U skladu sa odredbama Zakona o bezbednosti i zdravlju na radu, dostavljamo Vam godišnji izveštaj o povredama na radu za {year}. godinu, za privredni subjekat',
    p2_1: 'U navedenom periodu evidentirano je ukupno',
    p2_2: 'povreda na radu, od čega:',
    p2_laka: 'lakih',
    p2_teska: 'teških',
    p2_smrtna: 'smrtnih i',
    p2_kol: 'kolektivnih.',
    p3: 'Detaljan pregled povreda na radu sa lakom, teškom ili smrtnom posledicom dat je u tabeli u prilogu ovog dopisa.',
    p4: 'Ostajemo na Vašem raspolaganju za sva dodatna pojašnjenja.',
    regards: 'S poštovanjem,',
    officer: 'Odgovorno lice / Stručnjak za bezbednost i zdravlje na radu',
    seal: 'Pečat i potpis',
    attachment: 'PRILOG: Pregled povreda na radu sa lakom, teškom ili smrtnom posledicom — {year}. godina',
    empName: 'Naziv poslodavca:',
    table_rb: 'Rb.',
    table_death: 'Povreda na radu sa smrtnom posledicom',
    table_personal: 'Lični podaci stradalih (ime i prezime, datum rođ., pol)',
    table_location: 'Datum i mesto nesreće / povrede',
    table_cause: 'Uzroci pojave teške ili kolektivne povrede na radu',
    table_report: 'Prijava policiji i Inspekciji rada (broj i datum)',
    table_note: 'Napomena',
    table_sub1: 'Pojedinačna',
    table_sub2: 'Kolektivna',
    table_sub3: 'Broj stradalih',
    no_injuries: '✅ Nije evidentirano povreda na radu za {year}. godinu.',
    form_title: 'Podaci poslodavca (za zaglavlje dopisa)',
    form_f1: 'Naziv firme / poslodavca',
    form_f2: 'Adresa sedišta',
    form_f3: 'JIB / PIB',
    form_f4: 'Odgovorno lice (ime i prezime)',
    form_f5: 'Telefon',
    form_f6: 'Email',
    tab_dopis: '📄 Dopis / Zvanični izveštaj',
    tab_stats: '📊 Statistika po mesecima',
    stat_total: 'Ukupno',
    stat_laka: 'Lake',
    stat_teska: 'Teške',
    stat_smrtna: 'Smrtne',
    stat_kolektivna: 'Kolektivne',
    stat_bolovanje: 'Bolovanje',
    deadline_warning: '<strong>Rok za dostavu:</strong> Godišnji izveštaj o povredama na radu dostavlja se <strong>Inspektoratu rada</strong> do <strong>{deadline}</strong>.',
    deadline_date: '15. januar {nextYear}. godine',
    tbl_month: 'Mesec',
    tbl_worker: 'Radnik',
    tbl_date: 'Datum',
    tbl_tip: 'Tip',
    tbl_location: 'Lokacija',
    tbl_cause: 'Uzrok',
    tbl_bolovanje: 'Bolovanje',
    pdf_filename: 'Godisnji_izvestaj_{year}.pdf',
    word_filename: 'Godisnji_izvestaj_{year}.doc',
    word_title: 'Godišnji izveštaj',
    excel_filename: 'Pregled_povreda_{year}.xlsx',
    excel_sheetname: 'Izveštaj',
    total_lbl: 'Ukupno:',
    no_reported_injuries: '✅ Nije evidentirano povreda na radu za {year}. godinu.',
    attachment_list_title: 'Pregled svih povreda',
    letter_number: 'Broj',
    letter_date: 'Datum'
  }
};

export default function AnnualInjuriesPage() {
  const { t, lang } = useLanguage();
  const country = useCountry();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { markDirty, markClean } = useUnsavedChanges();
  const currentYear = new Date().getFullYear();
  const tLocal = DOPIS_TEXT[lang] || DOPIS_TEXT.bs;

  // ── Core state ──
  const [year, setYear] = useState(String(currentYear));
  const [injuries, setInjuries] = useState([]);
  const [tab, setTab] = useState('dopis');
  const [viewWorkerId, setViewWorkerId] = useState(null);

  // ── Report persistence ──
  const [savedReports, setSavedReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null); // currently open saved report
  const [generated, setGenerated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'editor'
  const [pdfDropdown, setPdfDropdown] = useState(false); // Editor Preuzmi dropdown
  const [listPdfDropdown, setListPdfDropdown] = useState(null); // list row report id
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 }); // fixed position for list dropdown
  const printRef = useRef(null); // ref to printable content (dopis + table)

  // ── Company info (editable) ──
  const [companyInfo, setCompanyInfo] = useState({ ...EMPTY_COMPANY });

  // ── Load data ──
  const loadData = useCallback(() => {
    setInjuries(getAll(COLLECTIONS.INJURIES));
    setSavedReports(getAll(COLLECTIONS.ANNUAL_REPORTS));
    try {
      const stored = localStorage.getItem('eznr_company');
      if (stored) {
        const c = JSON.parse(stored);
        setCompanyInfo(prev => ({
          naziv: c.naziv || c.name || prev.naziv,
          adresa: c.adresa || c.address || prev.adresa,
          jib: c.jib || c.id || prev.jib,
          odgovornaOsoba: c.odgovornaOsoba || c.contactPerson || prev.odgovornaOsoba,
          telefon: c.telefon || c.phone || prev.telefon,
          email: c.email || prev.email,
        }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);

  // ── Years dropdown: include current year ──
  const years = useMemo(() => {
    const yrs = [];
    for (let y = currentYear; y>= currentYear - 4; y--) yrs.push(y);
    return yrs;
  }, [currentYear]);

  // ── Computed injury data ──
  const yearInjuries = useMemo(() =>
    injuries.filter(inj => inj.datum && new Date(inj.datum).getFullYear() === Number(year)),
    [injuries, year]);

  const byMonth = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const mi = yearInjuries.filter(inj => new Date(inj.datum).getMonth() === i);
      return {
        month: i,
        laka: mi.filter(x => x.tip === 'laka' || !x.tip).length,
        teska: mi.filter(x => x.tip === 'teska').length,
        smrtna: mi.filter(x => x.tip === 'smrtna').length,
        kolektivna: mi.filter(x => x.kolektivna).length,
        bolovanje: mi.filter(x => x.bolovanje).length,
        items: mi,
      };
    }), [yearInjuries]);

  const totals = useMemo(() => ({
    laka: byMonth.reduce((s, m) => s + m.laka, 0),
    teska: byMonth.reduce((s, m) => s + m.teska, 0),
    smrtna: byMonth.reduce((s, m) => s + m.smrtna, 0),
    kolektivna: byMonth.reduce((s, m) => s + m.kolektivna, 0),
    bolovanje: byMonth.reduce((s, m) => s + m.bolovanje, 0),
  }), [byMonth]);

  const smrtnePovreda = useMemo(() => yearInjuries.filter(x => x.tip === 'smrtna'), [yearInjuries]);
  const teskePovreda = useMemo(() => yearInjuries.filter(x => x.tip === 'teska'), [yearInjuries]);
  const kolektivnePovreda = useMemo(() => yearInjuries.filter(x => x.kolektivna), [yearInjuries]);

  const MONTHS = MONTHS_MAP[lang] || MONTHS_MAP.bs;
  const nextYear = Number(year) + 1;
  const deadline = tLocal.deadline_date.replace('{nextYear}', nextYear);

  // ── LIVE STATS (Updates dynamically based on selected year) ──
  const selectedYearInjuries = useMemo(() =>
    injuries.filter(inj => inj.datum && new Date(inj.datum).getFullYear() === Number(year)),
    [injuries, year]);

  const selectedYearTotals = useMemo(() => ({
    laka: selectedYearInjuries.filter(x => x.tip === 'laka' || !x.tip).length,
    teska: selectedYearInjuries.filter(x => x.tip === 'teska').length,
    smrtna: selectedYearInjuries.filter(x => x.tip === 'smrtna').length,
    kolektivna: selectedYearInjuries.filter(x => x.kolektivna).length,
  }), [selectedYearInjuries]);

  // ── Saved reports for the selected year ──
  const reportsForYear = useMemo(() =>
    savedReports.filter(r => r.year === year).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [savedReports, year]);

  // ── Dirty tracking ──
  const handleCompanyChange = (key, val) => {
    setCompanyInfo(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
    markDirty();
  };

  // ── Save report ──
  const handleSaveReport = async () => {
    const reportData = {
      year,
      companyInfo,
      tab,
      totalInjuries: yearInjuries.length,
      totals: { ...totals },
      savedAt: new Date().toISOString(),
    };

    if (activeReportId) {
      update(COLLECTIONS.ANNUAL_REPORTS, activeReportId, reportData);
    } else {
      const created = create(COLLECTIONS.ANNUAL_REPORTS, reportData);
      setActiveReportId(created.id);
    }
    setIsDirty(false);
    markClean();
    setSavedReports(getAll(COLLECTIONS.ANNUAL_REPORTS));
    await alert(t('izvjestajUspjesnoSacuvan'));
  };

  // ── Handle Browser / App Back Button ──
  useEffect(() => {
    const handlePopState = async (e) => {
      // Occurs when user hits "Back" (browser or app's top-left button)
      if (view === 'editor') {
        if (isDirty) {
          const ok = await confirm(t('imateNesacuvanePromjeneZeliteLi'));
          if (ok) {
            await handleSaveReport();
          }
        }
        setView('list');
        setGenerated(false);
        setIsDirty(false);
        markClean();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view, isDirty, lang, confirm, markClean, handleSaveReport]); 

  // ── Generate new report ──
  const handleGenerate = async () => {
    if (isDirty) {
      const ok = await confirm(t('imateNesacuvanePromjeneGenerisanjeNovog'));
      if (!ok) return;
    }
    setActiveReportId(null);
    setGenerated(true);
    setIsDirty(false);
    markClean();
    window.history.pushState({ annualInjuriesView: 'editor' }, '');
    setView('editor');
    setTab('dopis');
  };

  // ── Load saved report ──
  const handleLoadReport = (report) => {
    setYear(report.year);
    if (report.companyInfo) setCompanyInfo({ ...EMPTY_COMPANY, ...report.companyInfo });
    setActiveReportId(report.id);
    setGenerated(true);
    setIsDirty(false);
    markClean();
    window.history.pushState({ annualInjuriesView: 'editor' }, '');
    setView('editor');
    setTab('dopis');
  };

  // ── Delete saved report ──
  const handleDeleteReport = async (id) => {
    const ok = await confirm(t('obrisatiSacuvanIzvjestaj'));
    if (!ok) return;
    remove(COLLECTIONS.ANNUAL_REPORTS, id);
    setSavedReports(getAll(COLLECTIONS.ANNUAL_REPORTS));
    if (activeReportId === id) {
      setActiveReportId(null);
      setGenerated(false);
      setView('list');
    }
  };

  // ── Back to list with unsaved check ──
  const handleBackToList = () => {
    // We just trigger history back, which will inherently fire popstate and run the logic above
    window.history.back();
  };

  const tipBadge = (tip) => {
    const map = {
      laka: { color: '#F59E0B', label: tLocal.stat_laka },
      teska: { color: '#EF4444', label: tLocal.stat_teska },
      smrtna: { color: '#7C3AED', label: tLocal.stat_smrtna },
    };
    const s = map[tip] || map.laka;
    return <span style={{ color: s.color, fontWeight: 700, fontSize: '0.78rem' }}>{s.label}</span>;
  };

  // ── PDF: Direct download using html2pdf.js (landscape) ──
  const generatePdf = useCallback(async () => {
    setPdfDropdown(false);
    setListPdfDropdown(null);
    setTab('dopis');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const el = printRef.current;
    if (!el) return;

    const tempStyle = document.createElement('style');
    tempStyle.textContent = `
      .card, .card-body { border: none !important; box-shadow: none !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
      table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; border: 1px solid #000 !important; }
      th, td { white-space: normal !important; overflow-wrap: normal !important; word-break: normal !important; hyphens: none !important; border: 1px solid #000 !important; padding: 4px 5px !important; color: #000 !important; background: #fff !important; }
      th { background-color: #f0f0f0 !important; font-weight: bold !important; color: #000 !important; text-align: center !important; font-size: 6.5pt !important; padding: 2px !important; }
      td { font-size: 7.5pt !important; }
      span { color: #000 !important; }
    `;
    el.appendChild(tempStyle);

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const opt = {
        margin: [10, 10, 10, 10], // top, left, bottom, right in mm
        filename: tLocal.pdf_filename.replace('{year}', year),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };
      await html2pdf().set(opt).from(el).save();
    } catch (err) {
      console.error('PDF generation error:', err);
      await alert(t('greskaPriGenerisanjuPdfa'));
    } finally {
      if (el.contains(tempStyle)) el.removeChild(tempStyle);
    }
  }, [year, lang]);

  // ── Word: High-Fidelity .doc (Portrait + Forced Page Break) ──
  const generateWord = useCallback(async () => {
    setPdfDropdown(false);
    setListPdfDropdown(null);
    setTab('dopis');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const el = printRef.current;
    if (!el) return;

    // Word-specific XML and CSS for Portrait orientation and Page Breaks
    const htmlHeader = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset='utf-8'>
        <title>${tLocal.word_title}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: 21cm 29.7cm; /* A4 Portrait */
            margin: 2cm 2cm 2cm 2cm;
            mso-page-orientation: portrait;
          }
          body { font-family: 'Georgia', serif; font-size: 11pt; color: #000; background: #fff; }
          .dopis-letter { width: 100%; border: none; margin-bottom: 30px; }
          
          /* Table Styles */
          table { border-collapse: collapse; width: 100%; border: 1pt solid #333; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
          th, td { border: 1pt solid #333 !important; padding: 5px; vertical-align: top; font-size: 8.5pt; color: #000; }
          th { background-color: #f2f2f2 !important; font-weight: bold; text-align: center; }
          
          p { margin: 0 0 10pt 0; }
          .no-print { display: none !important; }
          
          /* The magic Word Page Break line */
          .word-break {
            page-break-before: always;
            clear: all;
            mso-break-type: section-break;
          }
        </style>
      </head>
      <body>
        <div contenteditable="true">
    `;

    const htmlFooter = `</div></body></html>`;
    
    // Process HTML
    let contentHtml = el.innerHTML;
    
    // 1. Force the page break by replacing our marked div with Word's section break
    // We use a regex to catch the div regardless of how the browser formats the style string
    contentHtml = contentHtml.replace(/<div id="word-page-break"[^>]*><\/div>/g, '<br clear=all style="mso-special-character:line-break;page-break-before:always" class="word-break">');
    
    // 2. Fix the signature block (Word hates Flexbox)
    // We replace the flex container with a table for better alignment in Word
    contentHtml = contentHtml.replace(
      /<div style="display: flex; justify-content: space-between;[^>]*">([\s\S]*?)<\/div>/,
      (match) => {
        // Simple heuristic to keep the structure inside a table
        return `<table border="0" style="width:100%; border:none;"><tr><td style="width:50%; border:none;">` + match + `</td></tr></table>`;
      }
    );

    // 3. Cleanup other dynamic classes
    contentHtml = contentHtml.replace(/class="card[^"]*"/g, 'style="border:none; margin-bottom: 20px; background:white;"');
    contentHtml = contentHtml.replace(/class="card-body[^"]*"/g, 'style="padding: 10px;"');

    const fullHtml = htmlHeader + contentHtml + htmlFooter;
    
    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tLocal.word_filename.replace('{year}', year);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [year]);

  // ── Excel: Export .xlsx (──
  const generateExcel = useCallback(async () => {
    setPdfDropdown(false);
    setListPdfDropdown(null);
    setTab('dopis');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const el = printRef.current;
    if (!el) return;
    
    const table = el.querySelector('table');
    if (!table) return;

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.table_to_book(table, { raw: true, sheet: tLocal.excel_sheetname });
      const ws = wb.Sheets[tLocal.excel_sheetname];
      
      // Auto-fit columns based on max content length
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const colWidths = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        let maxLen = 8;
        for (let R = range.s.r; R <= range.e.r; R++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          if (cell && cell.v != null) {
            const len = String(cell.v).length;
            if (len> maxLen) maxLen = len;
          }
        }
        colWidths.push({ wch: Math.min(maxLen + 2, 50) }); // cap at 50 chars
      }
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, tLocal.excel_filename.replace('{year}', year));
    } catch (err) {
      console.error('Excel export error', err);
      await alert(t('greskaPriGenerisanjuExcela'));
    }
  }, [year, lang]);

  // ── Print: inject content into DOM, scope print CSS, call window.print() ──
  const printReport = useCallback(async () => {
    setTab('dopis');
    await new Promise(resolve => setTimeout(resolve, 300));
    const el = printRef.current;
    if (!el) return;

    const overlay = document.createElement('div');
    overlay.id = '__izvj_print__';
    overlay.innerHTML = el.innerHTML;
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: '#fff', zIndex: -1, display: 'none',
    });
    document.body.appendChild(overlay);

    const styleEl = document.createElement('style');
    styleEl.id = '__izvj_print_css__';
    styleEl.textContent = `
      @media print {
        body > *:not(#__izvj_print__) { display: none !important; }
        #__izvj_print__ {
          display: block !important;
          position: static !important;
          z-index: auto !important;
          font-family: Georgia, serif;
          font-size: 10pt;
          color: #111;
          background: #fff;
          padding: 0;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        #__izvj_print__ .data-table-wrapper {
          overflow: visible !important;
          width: 100% !important;
        }
        #__izvj_print__ table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 7.5pt !important; margin-top: 14px !important; border: 1px solid #000 !important; }
        #__izvj_print__ th, #__izvj_print__ td { border: 1px solid #000 !important; border-color: #000 !important; padding: 4px 5px !important; overflow-wrap: normal !important; word-break: normal !important; hyphens: none !important; white-space: normal !important; }
        #__izvj_print__ th { background: #e8e8e8 !important; font-weight: 700 !important; text-align: center !important; color: #000 !important; font-size: 6.5pt !important; padding: 2px !important; }
        #__izvj_print__ td { vertical-align: top !important; color: #000 !important; }
        #__izvj_print__ .card, #__izvj_print__ .card-body { all: unset !important; display: block !important; width: 100% !important; box-sizing: border-box !important; }
        @page { size: A4 landscape !important; margin: 10mm !important; }
      }
    `;
    document.head.appendChild(styleEl);

    // Give browser time to apply styles
    await new Promise(resolve => setTimeout(resolve, 100));
    
    window.print();

    setTimeout(() => {
      document.getElementById('__izvj_print__')?.remove();
      document.getElementById('__izvj_print_css__')?.remove();
    }, 1500);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.dropdown-container')) {
        setPdfDropdown(false);
        setListPdfDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // LIST VIEW — shows saved reports + generate button
  // ════════════════════════════════════════════════════════════════════════════
  if (view === 'list') {
    return (
      <>
        <DialogRenderer />
        {/* Fixed-position Preuzmi dropdown portal — bypasses overflow:auto clipping */}
        {listPdfDropdown && (
          <div
            className="dropdown-container"
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              zIndex: 99999, userSelect: 'none', WebkitUserSelect: 'none',
              minWidth: 150,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: 4,
            }}>
            {(() => {
              const r = savedReports.find(x => x.id === listPdfDropdown);
              if (!r) return null;
              return (
                <>
                  <button className="dropdown-item" onClick={() => { setListPdfDropdown(null); handleLoadReport(r); setTimeout(() => generatePdf(), 800); }} style={{ fontSize: '0.85rem' }}>📄 PDF</button>
                  <button className="dropdown-item" onClick={() => { setListPdfDropdown(null); handleLoadReport(r); setTimeout(() => generateWord(), 800); }} style={{ fontSize: '0.85rem' }}>📝 WORD</button>
                  <button className="dropdown-item" onClick={() => { setListPdfDropdown(null); handleLoadReport(r); setTimeout(() => generateExcel(), 800); }} style={{ fontSize: '0.85rem' }}>📊 EXCEL</button>
                </>
              );
            })()}
          </div>
        )}
        <div className="animate-fadeIn">
          <PageHeader icon="📈" title={t('annualInjuryReport')} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <select className="form-select" style={{ width: 100 }} value={year} onChange={e => setYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }} onClick={handleGenerate} title={t('kreirajNoviGodisnjiIzvjestaj')}>
              + {t('generisiNoviIzvjestaj')}
            </button>
          </div>

          {/* Deadline reminder */}
          {country === 'BA' && (
            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>⏰</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }} dangerouslySetInnerHTML={{ __html: tLocal.deadline_warning.replace('{deadline}', deadline) }}>
              </span>
            </div>
          )}
          {country === 'HR' && (
            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }} dangerouslySetInnerHTML={{ __html: tLocal.deadline_warning }}>
              </span>
            </div>
          )}

          {/* Quick stats (Updates dynamically based on selected year) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: tLocal.stat_total, value: selectedYearInjuries.length, color: 'var(--primary)' },
              { label: tLocal.stat_laka, value: selectedYearTotals.laka, color: '#F59E0B' },
              { label: tLocal.stat_teska, value: selectedYearTotals.teska, color: '#EF4444' },
              { label: tLocal.stat_smrtna, value: selectedYearTotals.smrtna, color: '#7C3AED' },
              { label: tLocal.stat_kolektivna, value: selectedYearTotals.kolektivna, color: '#10B981' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ textAlign: 'center' }}>
                <div className="card-body" style={{ padding: '12px 8px' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label} ({year})</div>
                </div>
              </div>
            ))}
          </div>

          {/* Saved reports list */}
          <div className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
                {t('sacuvaniIzvjestaji')} ({savedReports.length})
              </div>

              {savedReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
                  <p>{t('nemaSacuvanihIzvjestaja')}</p>
                  <p style={{ fontSize: '0.82rem', marginTop: 8 }}>{t('odaberiteGodinuIKlikniteGenerisi')}</p>
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 130 }}>{t('akcije')}</th>
                        <th>{t('godina')}</th>
                        <th>{t('firma')}</th>
                        <th>{t('povreda')}</th>
                        <th>{t('sacuvano')}</th>
                        <th>{t('zadnjaIzmjena')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedReports.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(r => (
                        <tr key={r.id} onClick={() => handleLoadReport(r)} style={{ cursor: 'pointer' }}>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button className="btn btn-ghost btn-sm btn-icon" title={t('uredi')} onClick={() => handleLoadReport(r)}>✏️</button>
                              <button className="btn btn-ghost btn-sm btn-icon" title={t('isprintaj')} onClick={() => { handleLoadReport(r); setTimeout(() => printReport(), 800); }}>🖨️</button>
                              
                              <div className="dropdown-container" style={{ position: 'relative' }}>
                                <button
                                  className="btn btn-ghost btn-sm btn-icon"
                                  title={t('preuzmi')}
                                  onClick={e => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    // prefer upward; dropdown is ~120px tall
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    const top = spaceBelow < 130 ? rect.top - 130 : rect.bottom + 4;
                                    setDropdownPos({ top, left: rect.left });
                                    setListPdfDropdown(listPdfDropdown === r.id ? null : r.id);
                                  }}>⬇️</button>
                              </div>
                              
                              <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={t('obrisi')} onClick={() => handleDeleteReport(r.id)}>🗑️</button>
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, fontSize: '1rem' }}>{r.year}</td>
                          <td>{r.companyInfo?.naziv || '—'}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{r.totalInjuries || 0}</span>
                            {r.totals && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>({r.totals.laka || 0}{tLocal.stat_laka[0]} / {r.totals.teska || 0}{tLocal.stat_teska[0]} / {r.totals.smrtna || 0}{tLocal.stat_smrtna[0]})</span>}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{r.savedAt ? fmtDate(r.savedAt) : '—'}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fmtDateTime(r.updatedAt) || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EDITOR VIEW — the generated report
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <>
      <DialogRenderer />
      <div className="animate-fadeIn">
        {/* print-only items hidden on screen */}
        <style>{`.print-only { display: none; }`}</style>

        {/* Header bar */}
        <div className="no-print" className="scrollable-toolbar" style={{ padding: 0, gap: 12, marginBottom: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleBackToList} style={{ fontSize: '0.85rem' }} title={t('povratakNaListuIzvjestaja')}>
            ← {t('nazadNaListu')}
          </button>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>📈 {t('annualInjuryReport')} — {year}.</h1>
          {activeReportId && <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>💾 {t('sacuvano')}</span>}
          {isDirty && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>● {t('nesacuvano')}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSaveReport} title={t('sacuvajIzvjestaj')}>
              💾 {t('sacuvaj')}
            </button>
            <button className="btn btn-outline btn-sm" onClick={printReport} title={t('isprintajIzvjestaj')}>
              🖨️ {t('printaj')}
            </button>
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setPdfDropdown(!pdfDropdown)} title={t('preuzmiIzvjestaj')}>
                ⬇️ {t('preuzmi1')}
              </button>
              {pdfDropdown && (
                <div onClick={e => e.stopPropagation()} className="dropdown-menu" style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: 160, zIndex: 200, padding: 4 }}>
                  <button className="dropdown-item" onClick={generatePdf} style={{ fontSize: '0.85rem' }}>📄 PDF</button>
                  <button className="dropdown-item" onClick={generateWord} style={{ fontSize: '0.85rem' }}>📝 WORD</button>
                  <button className="dropdown-item" onClick={generateExcel} style={{ fontSize: '0.85rem' }}>📊 EXCEL</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deadline */}
        {country === 'BA' && (
          <div className="no-print" style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>⏰</span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }} dangerouslySetInnerHTML={{ __html: tLocal.deadline_warning.replace('{deadline}', deadline) }}>
            </span>
          </div>
        )}
        {country === 'HR' && (
          <div className="no-print" style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-light)' }} dangerouslySetInnerHTML={{ __html: tLocal.deadline_warning }}>
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="no-print" style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', width: 'fit-content' }}>
          {[
            { key: 'dopis', label: tLocal.tab_dopis },
            { key: 'stats', label: tLocal.tab_stats },
          ].map(tab_ => (
            <button key={tab_.key} onClick={() => setTab(tab_.key)}
              style={{ padding: '8px 20px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: tab === tab_.key ? 700 : 400,
                background: tab === tab_.key ? 'var(--primary)' : 'var(--bg-card)',
                color: tab === tab_.key ? '#fff' : 'var(--text)' }}>
              {tab_.label}
            </button>
          ))}
        </div>

        {tab === 'dopis' ? (
          <>
            {/* Company info form */}
            <div className="card no-print" style={{ marginBottom: 20 }}>
              <div className="card-body">
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 12 }}>
                  {tLocal.form_title}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { key: 'naziv', label: tLocal.form_f1 },
                    { key: 'adresa', label: tLocal.form_f2 },
                    { key: 'jib', label: tLocal.form_f3 },
                    { key: 'odgovornaOsoba', label: tLocal.form_f4 },
                    { key: 'telefon', label: tLocal.form_f5 },
                    { key: 'email', label: tLocal.form_f6 },
                  ].map(f => (
                    <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>{f.label}</label>
                      <input className="form-input" value={companyInfo[f.key]} onChange={e => handleCompanyChange(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── PRINTABLE CONTENT (captured by html2pdf) ─── */}
            <div ref={printRef} style={{ background: '#fff', padding: 0 }}>

            {/* ─── THE OFFICIAL LETTER / DOPIS ─── */}
            <div className="card dopis-letter" style={{ marginBottom: 20, background: '#fff', border: '1px solid var(--border)' }}>
              <div className="card-body" style={{ fontFamily: 'Georgia, serif', color: '#111', lineHeight: 1.7, maxWidth: 900, margin: '0 auto', padding: '32px 40px' }}>
                {/* Sender */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{companyInfo.naziv || `[${tLocal.form_f1}]`}</div>
                  <div>{companyInfo.adresa || `[${tLocal.form_f2}]`}</div>
                  {companyInfo.jib && <div>{tLocal.form_f3}: {companyInfo.jib}</div>}
                  {companyInfo.telefon && <div>{tLocal.form_f5}: {companyInfo.telefon}</div>}
                  {companyInfo.email && <div>{tLocal.form_f6}: {companyInfo.email}</div>}
                </div>

                {/* Date + number */}
                <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>{tLocal.letter_number}: _____ / {Number(year) + 1}</div>
                  <div>{tLocal.letter_date}: _________________________</div>
                </div>

                {/* Recipient */}
                <div style={{ marginBottom: 24, paddingLeft: 40 }}>
                  <div style={{ fontWeight: 700 }}>{tLocal.inspectorateTitle}</div>
                  <div>{tLocal.inspectorateSubtitle}</div>
                </div>

                {/* Subject */}
                <div style={{ marginBottom: 20 }}>
                  <strong>{tLocal.subject.replace('{year}', year)}</strong>
                </div>

                {/* Body */}
                <div style={{ marginBottom: 20 }}>
                  <p>{tLocal.dear}</p>
                  <p>
                    {tLocal.p1.replace('{year}', year)} <strong>{companyInfo.naziv || '[Naziv]'}</strong>.
                  </p>
                  <p>
                    {tLocal.p2_1} <strong>{yearInjuries.length}</strong> {tLocal.p2_2}{' '}
                    <strong>{totals.laka}</strong> {tLocal.p2_laka},{' '}
                    <strong>{totals.teska}</strong> {tLocal.p2_teska},{' '}
                    <strong>{totals.smrtna}</strong> {tLocal.p2_smrtna}{' '}
                    <strong>{totals.kolektivna}</strong> {tLocal.p2_kol}
                  </p>
                  <p>
                    {tLocal.p3}
                  </p>
                  <p>{tLocal.p4}</p>
                </div>

                {/* Signature */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, flexWrap: 'wrap', gap: 24 }}>
                  <div>
                    <div>{tLocal.regards}</div>
                    <div style={{ marginTop: 40, borderTop: '1px solid #000', minWidth: 200, paddingTop: 4, textAlign: 'center', fontSize: '0.85rem' }}>
                      {companyInfo.odgovornaOsoba || tLocal.officer}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ marginTop: 40, borderTop: '1px solid #000', minWidth: 200, paddingTop: 4, textAlign: 'center', fontSize: '0.85rem' }}>
                      {tLocal.seal}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Print break to push table to next page naturally */}
            <div id="word-page-break" style={{ pageBreakBefore: 'always', margin: '20px 0' }} />

            {/* ─── OFFICIAL TABLE ─── */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-body">
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 4, textAlign: 'center', fontFamily: 'Georgia, serif' }}>
                  {tLocal.attachment.replace('{year}', year)}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16 }}>
                  {tLocal.empName} <strong>{companyInfo.naziv || '___________________'}</strong>
                </div>

                <div className="data-table-wrapper">
                  <table className="data-table" style={{ fontSize: '0.8rem', fontFamily: 'Georgia, serif' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', width: '3%' }}>{tLocal.table_rb}</th>
                        <th colSpan={3} style={{ textAlign: 'center', background: 'rgba(239,68,68,0.08)', width: '24%' }}>
                          {tLocal.table_death}
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', width: '16%', whiteSpace: 'pre-line' }}>
                          {tLocal.table_personal}
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', width: '12%' }}>
                          {tLocal.table_location}
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', width: '20%' }}>
                          {tLocal.table_cause}
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', width: '15%' }}>
                          {tLocal.table_report}
                        </th>
                        <th rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', width: '10%' }}>
                          {tLocal.table_note}
                        </th>
                      </tr>
                      <tr>
                        <th style={{ textAlign: 'center', background: 'rgba(239,68,68,0.05)', fontSize: '0.72rem' }}>{tLocal.table_sub1}</th>
                        <th style={{ textAlign: 'center', background: 'rgba(239,68,68,0.05)', fontSize: '0.72rem' }}>{tLocal.table_sub2}</th>
                        <th style={{ textAlign: 'center', background: 'rgba(239,68,68,0.05)', fontSize: '0.72rem' }}>{tLocal.table_sub3}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearInjuries.length === 0 ? (
                        <>
                          {[1, 2, 3].map(i => (
                            <tr key={i} style={{ height: 48 }}>
                              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i}</td>
                              <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                            </tr>
                          ))}
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px', fontStyle: 'italic', fontSize: '0.82rem' }}>
                              {tLocal.no_injuries.replace('{year}', year)}
                            </td>
                          </tr>
                        </>
                      ) : yearInjuries
                          .sort((a, b) => new Date(a.datum) - new Date(b.datum))
                          .map((inj, idx) => {
                        const isSmrtna = inj.tip === 'smrtna';
                        const isKolektivna = inj.kolektivna;
                        // Try to get worker details for richer data
                        const worker = inj.radnikId ? (() => { try { return getById(COLLECTIONS.WORKERS, inj.radnikId); } catch { return null; } })() : null;
                        const workerInfo = worker
                          ? `${worker.ime} ${worker.prezime}${worker.datumRodenja ? `, ${fmtDate(worker.datumRodenja)}` : ''}${worker.spol ? `, ${worker.spol}` : ''}`
                          : (inj.radnikIme || '—');
                        return (
                          <tr key={inj.id}>
                            <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ textAlign: 'center' }}>{isSmrtna && !isKolektivna ? '✓' : ''}</td>
                            <td style={{ textAlign: 'center' }}>{isKolektivna ? '✓' : ''}</td>
                            <td style={{ textAlign: 'center' }}>{isKolektivna ? (inj.brojStradalih || '—') : (isSmrtna ? '1' : '')}</td>
                            <td>{workerInfo}</td>
                            <td>
                              {inj.datum ? fmtDate(inj.datum) : '—'}
                              {inj.lokacija ? `, ${inj.lokacija}` : ''}
                            </td>
                            <td style={{ maxWidth: 180, fontSize: '0.75rem' }}>{inj.uzrokPovrede || inj.opisPovrede || '—'}</td>
                            <td style={{ fontSize: '0.75rem' }}>{inj.prijavaOrgan || '—'}</td>
                            <td style={{ fontSize: '0.75rem' }}>{inj.napomena || '—'}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: 'var(--bg-table-header)', fontWeight: 700 }}>
                        <td colSpan={2} style={{ textAlign: 'right', fontStyle: 'italic' }}>{tLocal.total_lbl}</td>
                        <td style={{ textAlign: 'center' }}>{totals.kolektivna}</td>
                        <td style={{ textAlign: 'center' }}>{totals.smrtna + totals.kolektivna}</td>
                        <td colSpan={5}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            </div>{/* /printRef wrapper */}
          </>
        ) : (
          /* ─── STATS TAB ─── */
          <>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: tLocal.stat_total, value: yearInjuries.length, color: 'var(--primary)' },
                { label: tLocal.stat_laka, value: totals.laka, color: '#F59E0B' },
                { label: tLocal.stat_teska, value: totals.teska, color: '#EF4444' },
                { label: tLocal.stat_smrtna, value: totals.smrtna, color: '#7C3AED' },
                { label: tLocal.stat_kolektivna, value: totals.kolektivna, color: '#10B981' },
              ].map((s, i) => (
                <div key={i} className="card" style={{ textAlign: 'center' }}>
                  <div className="card-body" style={{ padding: '12px 8px' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Monthly table */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-body">
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{tLocal.tbl_month}</th>
                        <th>{tLocal.stat_laka}</th>
                        <th>{tLocal.stat_teska}</th>
                        <th>{tLocal.stat_smrtna}</th>
                        <th>{tLocal.stat_kolektivna}</th>
                        <th>{tLocal.stat_total}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byMonth.map(m => (
                        <tr key={m.month}>
                          <td style={{ fontWeight: 600 }}>{MONTHS[m.month]}</td>
                          <td>{m.laka> 0 ? <span style={{ color: '#F59E0B', fontWeight: 700 }}>{m.laka}</span> : '0'}</td>
                          <td>{m.teska> 0 ? <span style={{ color: '#EF4444', fontWeight: 700 }}>{m.teska}</span> : '0'}</td>
                          <td>{m.smrtna> 0 ? <span style={{ color: '#7C3AED', fontWeight: 700 }}>{m.smrtna}</span> : '0'}</td>
                          <td>{m.kolektivna> 0 ? <span style={{ color: '#10B981', fontWeight: 700 }}>{m.kolektivna}</span> : '0'}</td>
                          <td><strong>{m.laka + m.teska + m.smrtna}</strong></td>
                        </tr>
                      ))}
                      <tr style={{ background: 'var(--bg-table-header)', fontWeight: 700 }}>
                        <td>{tLocal.stat_total}</td>
                        <td style={{ color: '#F59E0B' }}>{totals.laka}</td>
                        <td style={{ color: '#EF4444' }}>{totals.teska}</td>
                        <td style={{ color: '#7C3AED' }}>{totals.smrtna}</td>
                        <td style={{ color: '#10B981' }}>{totals.kolektivna}</td>
                        <td style={{ color: 'var(--primary)' }}>{totals.laka + totals.teska + totals.smrtna}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Detail injury list */}
            {yearInjuries.length> 0 && (
              <div className="card">
                <div className="card-body">
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border-light)' }}>
                    {tLocal.attachment_list_title} ({yearInjuries.length})
                  </div>
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{tLocal.table_rb}</th>
                          <th>{tLocal.tbl_worker}</th>
                          <th>{tLocal.tbl_date}</th>
                          <th>{tLocal.tbl_tip}</th>
                          <th>{tLocal.tbl_location}</th>
                          <th>{tLocal.tbl_cause}</th>
                          <th>{tLocal.tbl_bolovanje}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearInjuries.map((inj, idx) => (
                          <tr key={inj.id}>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                            <td style={{ fontWeight: 600 }}>
                              <button
                                onClick={() => { if (inj.radnikId) setViewWorkerId(inj.radnikId); }}
                                style={{ background: 'none', border: 'none', cursor: inj.radnikId ? 'pointer' : 'default', color: 'var(--text)', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', padding: 0, textDecoration: inj.radnikId ? 'underline' : 'none', textDecorationStyle: 'solid', textDecorationColor: 'var(--text-muted)' }}>{inj.radnikIme || '—'}</button>
                            </td>
                            <td>{inj.datum ? fmtDate(inj.datum) : '—'}</td>
                            <td>{tipBadge(inj.tip)}</td>
                            <td>{inj.lokacija || '—'}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inj.uzrokPovrede || inj.opisPovrede || '—'}</td>
                            <td style={{ textAlign: 'center' }}>{inj.bolovanje ? '✅' : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {yearInjuries.length === 0 && (
              <div style={{ marginTop: 24, textAlign: 'center', padding: 32, color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                {tLocal.no_reported_injuries.replace('{year}', year)}
              </div>
            )}
          </>
        )}

        {viewWorkerId && (
          <WorkerProfileModal
            workerId={viewWorkerId}
            onClose={() => setViewWorkerId(null)}
            onSaved={() => setViewWorkerId(null)}
          />
        )}
      </div>
    </>
  );
}
