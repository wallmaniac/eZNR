'use client';
import DateInput from '@/components/DateInput';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { getAll, create, remove, update, COLLECTIONS, getActiveCompanyId } from '@/lib/dataStore';
import { uploadDocument } from '@/lib/storageService';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { matchWorkers, confidenceLabel } from '@/lib/textMatch';
import Link from 'next/link';
import { idbOpenFile, idbDownloadFile } from '@/lib/idbFiles';
import PageHeader from '@/components/PageHeader';
import * as XLSX from 'xlsx';
import HelpTip from '@/components/HelpTip';


const FILE_ICONS = {
    pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
    ppt: '📙', pptx: '📙', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
    gif: '🖼️', zip: '📦', rar: '📦', txt: '📄', csv: '📊',
};

const getIcon = (name = '') => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return FILE_ICONS[ext] || '📎';
};

const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const CATEGORIES = ['Sve', 'Obrasci', 'Zapisnici', 'Ugovori', 'Certifikati', 'Pravilnici', 'Izvješća', 'Upute', 'Ostalo'];

const EXPORT_TRANSLATIONS = {
    bs: {
        title: 'LISTA RADNIKA SA SKENIRANOG TESTA',
        docScanned: 'Dokument skeniranog testa',
        genDate: 'Datum generisanja',
        numWorkers: 'Broj radnika',
        ime: 'Ime',
        prezime: 'Prezime',
        imeIPrezime: 'Ime i prezime',
        imeOca: 'Ime roditelja',
        jmbgOib: 'JMBG / OIB',
        datumRodenja: 'Datum rođenja',
        radnoMjesto: 'Radno mjesto',
        odjel: 'Odjel',
        tipTesta: 'Tip testa',
        datumTesta: 'Datum testa',
        status: 'Status',
        polozio: 'Položio',
        pao: 'Nije položio',
        paoPdf: 'Pao',
        generatedFrom: 'Generisano iz digitalne arhive eZNR',
        pageOf: 'Stranica 1 od 1',
    },
    hr: {
        title: 'POPIS RADNIKA SA SKENIRANOG TESTA',
        docScanned: 'Dokument skeniranog testa',
        genDate: 'Datum generiranja',
        numWorkers: 'Broj radnika',
        ime: 'Ime',
        prezime: 'Prezime',
        imeIPrezime: 'Ime i prezime',
        imeOca: 'Ime roditelja',
        jmbgOib: 'JMBG / OIB',
        datumRodenja: 'Datum rođenja',
        radnoMjesto: 'Radno mjesto',
        odjel: 'Odjel',
        tipTesta: 'Tip testa',
        datumTesta: 'Datum testa',
        status: 'Status',
        polozio: 'Položio',
        pao: 'Nije položio',
        paoPdf: 'Pao',
        generatedFrom: 'Generirano iz digitalne arhive eZNR',
        pageOf: 'Stranica 1 od 1',
    },
    sr: {
        title: 'ЛИСТА РАДНИКА СА СКЕНИРАНОГ ТЕСТА',
        docScanned: 'Документ скенираног теста',
        genDate: 'Датум генерисања',
        numWorkers: 'Број радника',
        ime: 'Име',
        prezime: 'Презиме',
        imeIPrezime: 'Име и презиме',
        imeOca: 'Иme родитеља',
        jmbgOib: 'ЈМБГ / ОИБ',
        datumRodenja: 'Датум рођења',
        radnoMjesto: 'Радно мјесто',
        odjel: 'Одјел',
        tipTesta: 'Тип testa',
        datumTesta: 'Датум testa',
        status: 'Статус',
        polozio: 'Положио',
        pao: 'Није положио',
        paoPdf: 'Пао',
        generatedFrom: 'Генерисано из дигиталне архиве eZNR',
        pageOf: 'Страница 1 од 1',
    },
    en: {
        title: 'WORKER LIST FROM SCANNED TEST',
        docScanned: 'Scanned test document',
        genDate: 'Generation date',
        numWorkers: 'Number of workers',
        ime: 'First Name',
        prezime: 'Last Name',
        imeIPrezime: 'Full Name',
        imeOca: 'Parent Name',
        jmbgOib: 'ID Number (JMBG/OIB)',
        datumRodenja: 'Date of Birth',
        radnoMjesto: 'Workplace',
        odjel: 'Department',
        tipTesta: 'Test Type',
        datumTesta: 'Test Date',
        status: 'Status',
        polozio: 'Passed',
        pao: 'Failed',
        paoPdf: 'Failed',
        generatedFrom: 'Generated from eZNR digital archive',
        pageOf: 'Page 1 of 1',
    },
    de: {
        title: 'MITARBEITERLISTE VOM GESCANNTEN TEST',
        docScanned: 'Gescannte Testdokument',
        genDate: 'Erstellungsdatum',
        numWorkers: 'Mitarbeiteranzahl',
        ime: 'Vorname',
        prezime: 'Nachname',
        imeIPrezime: 'Name, Vorname',
        imeOca: 'Elternteil Name',
        jmbgOib: 'Identifikationsnummer',
        datumRodenja: 'Geburtsdatum',
        radnoMjesto: 'Arbeitsplatz',
        odjel: 'Abteilung',
        tipTesta: 'Testtyp',
        datumTesta: 'Testdatum',
        status: 'Status',
        polozio: 'Bestanden',
        pao: 'Nicht bestanden',
        paoPdf: 'Nicht bestanden',
        generatedFrom: 'Generiert aus dem eZNR Digitalarchiv',
        pageOf: 'Seite 1 von 1',
    },
    sl: {
        title: 'SEZNAM DELAVCEV IZ SKENIRANEGA TESTA',
        docScanned: 'Skeniran testni dokument',
        genDate: 'Datum generiranja',
        numWorkers: 'Število delavcev',
        ime: 'Ime',
        prezime: 'Priimek',
        imeIPrezime: 'Ime in priimek',
        imeOca: 'Ime starša',
        jmbgOib: 'EMŠO / Davčna št.',
        datumRodenja: 'Datum rojstva',
        radnoMjesto: 'Delovno mesto',
        odjel: 'Oddelek',
        tipTesta: 'Tip testa',
        datumTesta: 'Datum testa',
        status: 'Status',
        polozio: 'Opravil',
        pao: 'Ni opravil',
        paoPdf: 'Ni opravil',
        generatedFrom: 'Generirano iz digitalnega arhiva eZNR',
        pageOf: 'Stran 1 od 1',
    }
};

// Form collections that contribute read-only attachments classified as Obrasci
const FORM_SOURCES = [
  { col: 'requests',      label: 'Zahtjevnica', link: '/dashboard/requests' },
  { col: 'formsOir1',     label: 'Obrazac OIR-1', link: '/dashboard/form-oir1' },
  { col: 'formsRo1',      label: 'Obrazac RO-1', link: '/dashboard/form-ro1' },
  { col: 'formsRo2',      label: 'Obrazac RO-2', link: '/dashboard/form-ro2' },
  { col: 'referralsNr1',  label: 'Lj. uputnica (NR1)', link: '/dashboard/medical-exams' },
  { col: 'referralsRa1',  label: 'Lj. uputnica (RA1)', link: '/dashboard/referral-ra1' },
  { col: 'employerDocs',  label: 'Dokumentacija za poslodavca', link: '/dashboard/employer-docs' },
  { col: 'certificates',  label: 'Uvjerenje radnika', link: '/dashboard/worker-certificates' },
];

export default function ArchivePage() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('archive'); // 'archive' | 'scan'
    const [files, setFiles] = useState(() => getAll(COLLECTIONS.DIGITAL_ARCHIVE));
    const [formDocs, setFormDocs] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('Sve');
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef(null);
    const MAX_MB = 5;

    // ── Scan tab state ─────────────────────────────────────────────────────────
    const [scanFile, setScanFile] = useState(null);
    const [rawFile, setRawFile] = useState(null); // Cache raw HTML5 File for rescanning
    const [scanDragging, setScanDragging] = useState(false);
    const [scanSearched, setScanSearched] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [matchedRows, setMatchedRows] = useState([]); // Array of { id, extractedName, date, type, passed, selectedWorkerId }
    const scanFileRef = useRef(null);

    const handleScanFileRead = async (file) => {
        if (file.size > 10 * 1024 * 1024) { alert('Max 10MB za skenirani test!'); return; }
        
        setRawFile(file);
        setScanFile({ name: file.name, size: file.size, type: file.type });
        setAnalyzing(true);
        setScanSearched(false);
        setMatchedRows([]);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const base64Data = e.target.result.split(',')[1];
                const res = await fetch('/api/analyze-scanned-tests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Data, mimeType: file.type })
                });
                
                const result = await res.json();
                if (result.success && Array.isArray(result.workers)) {
                    const allWorkers = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false);
                    const rows = result.workers.map((ext, idx) => {
                        const matches = matchWorkers(ext.extractedName, ext.date || '', allWorkers);
                        const bestMatch = matches[0]; // { worker, score, dobMatch }
                        const hasGoodMatch = bestMatch && bestMatch.score >= 0.35;
                        return {
                            id: `row-${idx}-${Date.now()}`,
                            extractedName: ext.extractedName,
                            date: ext.date || '',
                            type: ext.type || '',
                            passed: ext.passed !== false,
                            selectedWorkerId: hasGoodMatch ? bestMatch.worker.id : '__NOT_IN_DB__',
                            score: bestMatch ? bestMatch.score : 0,
                            dobMatch: bestMatch ? bestMatch.dobMatch : false
                        };
                    });
                    setMatchedRows(rows);
                    setScanSearched(true);
                } else {
                    alert(result.error || 'Nije uspjelo analiziranje skeniranog dokumenta.');
                }
            } catch (err) {
                console.error('Scan analysis error:', err);
                alert('Greška pri komunikaciji sa AI modelom: ' + err.message);
            } finally {
                setAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateRowWorker = (rowId, workerId) => {
        const allWorkers = getAll(COLLECTIONS.WORKERS);
        const w = allWorkers.find(x => x.id === workerId);
        setMatchedRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            const isNotInDb = workerId === '__NOT_IN_DB__';
            return {
                ...r,
                selectedWorkerId: workerId,
                score: isNotInDb ? 0 : (workerId ? 100 : 0),
                dobMatch: !isNotInDb && w && r.date && w.datumRodjenja === r.date
            };
        }));
    };

    const handleDeleteRow = (rowId) => {
        setMatchedRows(prev => prev.filter(r => r.id !== rowId));
    };

    const handleClearScan = () => {
        setScanFile(null);
        setRawFile(null);
        setMatchedRows([]);
        setScanSearched(false);
    };

    const handleDownloadExcel = () => {
        const allWorkers = getAll(COLLECTIONS.WORKERS);
        const workplaces = getAll(COLLECTIONS.WORKPLACES);
        const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
        const getExp = (k) => EXPORT_TRANSLATIONS[lang]?.[k] || EXPORT_TRANSLATIONS.bs[k];

        const dataRows = matchedRows.map((row, idx) => {
            const isNotInDb = row.selectedWorkerId === '__NOT_IN_DB__';
            const w = isNotInDb ? {} : (allWorkers.find(x => x.id === row.selectedWorkerId) || {});
            const wp = workplaces.find(x => x.id === w.radnoMjestoId) || {};
            const ou = orgUnits.find(x => x.id === w.orgJedinicaId) || {};

            let firstName = w.ime || '';
            let lastName = w.prezime || '';
            if (isNotInDb && row.extractedName) {
                const parts = row.extractedName.trim().split(/\s+/);
                firstName = parts[0] || '';
                lastName = parts.slice(1).join(' ') || '';
            }

            return {
                '#': idx + 1,
                [getExp('ime')]: firstName,
                [getExp('prezime')]: lastName,
                [getExp('imeOca')]: w.imeRoditelja || '—',
                [getExp('jmbgOib')]: w.jmbg || w.oib || '—',
                [getExp('datumRodenja')]: w.datumRodjenja || '—',
                [getExp('radnoMjesto')]: wp.naziv || w.radnoMjesto || '—',
                [getExp('odjel')]: ou.naziv || w.orgJedinica || '—',
                [getExp('imeIPrezime') + ' (AI)']: row.extractedName,
                [getExp('datumTesta')]: row.date || '—',
                [getExp('tipTesta')]: row.type || '—',
                [getExp('status')]: row.passed ? getExp('polozio') : getExp('pao')
            };
        });

        const ws = XLSX.utils.json_to_sheet(dataRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Skenirani Testovi Radnici");
        XLSX.writeFile(wb, `Skenirani_Testovi_Izvjestaj_${new Date().toISOString().slice(0,10)}.xlsx`);
    };

    const handleDownloadPDF = () => {
        const companyId = getActiveCompanyId();
        let company = { naziv: '', adresa: '', oib: '', jib: '' };
        if (companyId && companyId !== 'all') {
            const allComps = getAll('companies');
            const c = allComps.find(x => x.id === companyId);
            if (c) company = c;
        }

        const allWorkers = getAll(COLLECTIONS.WORKERS);
        const workplaces = getAll(COLLECTIONS.WORKPLACES);
        const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
        const getExp = (k) => EXPORT_TRANSLATIONS[lang]?.[k] || EXPORT_TRANSLATIONS.bs[k];

        const rowsHtml = matchedRows.map((row, idx) => {
            const isNotInDb = row.selectedWorkerId === '__NOT_IN_DB__';
            const w = isNotInDb ? {} : (allWorkers.find(x => x.id === row.selectedWorkerId) || {});
            const wp = workplaces.find(x => x.id === w.radnoMjestoId) || {};
            const ou = orgUnits.find(x => x.id === w.orgJedinicaId) || {};

            const fullName = isNotInDb ? row.extractedName : `${w.ime || ''} ${w.prezime || ''}`.trim();
            const parentName = w.imeRoditelja || '—';
            const nationalId = w.jmbg || w.oib || '—';
            const workplaceName = wp.naziv || w.radnoMjesto || '—';
            const deptName = ou.naziv || w.orgJedinica || '—';

            return `
                <tr>
                    <td style="color:#aaa; text-align:center">${idx + 1}</td>
                    <td style="font-weight:600">${fullName}</td>
                    <td>${parentName}</td>
                    <td>${nationalId}</td>
                    <td>${workplaceName}</td>
                    <td>${deptName}</td>
                    <td>${row.type || 'ZNR/ZOP'}</td>
                    <td>${row.date || '—'}</td>
                    <td><span class="badge ${row.passed ? 'badge-ok' : 'badge-danger'}">${row.passed ? getExp('polozio') : getExp('paoPdf')}</span></td>
                </tr>
            `;
        }).join('');

        const companyName = company.naziv || company.name || 'eZNR Firma';
        const docTitle = getExp('title');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8"/>
                <title>${docTitle}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a2e; padding: 20mm; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #00BFA6; padding-bottom: 12px; margin-bottom: 20px; }
                    .brand { font-size: 16pt; font-weight: 800; color: #00BFA6; }
                    .company-info { text-align: right; font-size: 8pt; color: #555; }
                    .title { font-size: 14pt; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; }
                    .meta { font-size: 9pt; color: #666; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th { background: #f5f6fa; font-size: 8pt; font-weight: 700; text-transform: uppercase; padding: 8px 10px; border-bottom: 2px solid #e0e0e0; text-align: left; }
                    td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 9pt; }
                    tr:nth-child(even) td { background: #fafbfd; }
                    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 7.5pt; font-weight: 700; }
                    .badge-ok { background: #e8f5e9; color: #2e7d32; }
                    .badge-danger { background: #ffebee; color: #c62828; }
                    .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; font-size: 8pt; color: #888; }
                    .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: #00BFA6; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
                    @media print {
                        .print-btn { display: none; }
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="brand">eZNR</div>
                        <div style="font-size: 9pt; font-weight: bold; margin-top: 4px;">${companyName}</div>
                    </div>
                    <div class="company-info">
                        ${company.adresa ? `<div>${company.adresa}</div>` : ''}
                        ${company.mjesto ? `<div>${company.mjesto}</div>` : ''}
                        ${company.jib || company.oib ? `<div>JIB/OIB: ${company.jib || company.oib}</div>` : ''}
                    </div>
                </div>
                <div class="title">${docTitle}</div>
                <div class="meta">
                    ${getExp('docScanned')}: <strong>${scanFile ? scanFile.name : '—'}</strong><br/>
                    ${getExp('genDate')}: <strong>${new Date().toLocaleDateString('hr-HR')}</strong> · ${getExp('numWorkers')}: <strong>${matchedRows.length}</strong>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 4%">#</th>
                            <th>${getExp('imeIPrezime')}</th>
                            <th>${getExp('imeOca')}</th>
                            <th>${getExp('jmbgOib')}</th>
                            <th>${getExp('radnoMjesto')}</th>
                            <th>${getExp('odjel')}</th>
                            <th>${getExp('tipTesta')}</th>
                            <th>${getExp('datumTesta')}</th>
                            <th>${getExp('status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    <span>${getExp('generatedFrom')}</span>
                    <span>${getExp('pageOf')}</span>
                </div>
                <button class="print-btn" onclick="window.print()">🖨️ ${lang === 'en' ? 'Print / Save as PDF' : 'Isprintaj / Save as PDF'}</button>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            alert('Molimo dozvolite popup prozore za ispis.');
        }
    };

        const reload = useCallback(() => {
        setFiles(getAll(COLLECTIONS.DIGITAL_ARCHIVE));
        // Aggregate form attachments
        const docs = [];
        FORM_SOURCES.forEach(({ col, label, link }) => {
            const recs = getAll(col);
            recs.forEach(r => {
                let finalLink = link;
                if (col === 'certificates') {
                    finalLink = `${link}/edit/${r.id}`;
                } else if (col === 'requests' || col.startsWith('forms') || col.startsWith('referrals') || col === 'employerDocs') {
                    finalLink = `${link}?openId=${r.id}`;
                }

                // For certificates: read from attachments[] array (multi-file)
                if (col === 'certificates' && Array.isArray(r.attachments) && r.attachments.length> 0) {
                    r.attachments.forEach((att, idx) => {
                        if (att.name && (att.url || att.data)) {
                            docs.push({
                                id: `form-${col}-${r.id}-att${idx}`,
                                name: att.name,
                                data: att.data || null,
                                url: att.url || null,
                                category: 'Certifikati',
                                description: r.ime || r.tipUvjerenjaIme || label,
                                size: att.size || null,
                                uploadedAt: r.datum || null,
                                _readonly: true,
                                _sourceLabel: label,
                                _sourceLink: finalLink,
                            });
                        }
                    });
                } else {
                    // Legacy single-file fields
                    const fName = r.docName || r.attachedFileName || r.fileName || r.datotekaIme;
                    const fData = r.docData || r.attachedFileData || r.fileData || r.datotekaSadrzaj;
                    const fUrl = r.fileUrl || r.attachedFileUrl || r.docUrl;

                    if (fName && (fData || fUrl)) {
                        docs.push({
                            id: `form-${col}-${r.id}`,
                            name: fName,
                            data: fData || null,
                            url: fUrl || null,
                            category: label.includes('Uvjerenje') ? 'Certifikati' : 'Obrasci',
                            description: r.ime ? `${r.ime}` : label,
                            size: r.fileSize || r.attachedFileSize || null,
                            uploadedAt: r.datum || r.datumDogadjaja || r.datumPrijave || null,
                            _readonly: true,
                            _sourceLabel: label,
                            _sourceLink: finalLink,
                        });
                    }
                }
            });
        });

        // Aggregate equipment service logs
        const serviceLogs = getAll(COLLECTIONS.SERVICE_LOG);
        const equipments = getAll(COLLECTIONS.EQUIPMENT);
        serviceLogs.forEach(sl => {
            const fName = sl.docName || sl.fileName || sl.attachedFileName || sl.datotekaIme;
            const fData = sl.docData || sl.fileData || sl.attachedFileData || sl.datotekaSadrzaj;
            const fUrl = sl.fileUrl || sl.attachedFileUrl || sl.docUrl;
            if (fName && (fData || fUrl)) {
                const eq = equipments.find(e => e.id === sl.equipmentId);
                const eqName = eq ? eq.naziv : 'Oprema';
                docs.push({
                    id: `eq-svclog-${sl.id}`,
                    name: fName,
                    data: fData || null,
                    url: fUrl || null,
                    category: 'Zapisnici',
                    description: `Servisni zapisnik — ${eqName}`,
                    size: sl.fileSize || null,
                    uploadedAt: sl.datum || null,
                    _readonly: true,
                    _sourceLabel: 'Popis radne opreme i objekata',
                    _sourceLink: `/dashboard/equipment?openItem=${sl.equipmentId}&tab=servis&returnTo=/dashboard/archive`,
                });
            }
        });

        // Aggregate fleet vehicle documents (nested inside vehicle records)
        const vehicles = getAll('vehicles');
        vehicles.forEach(v => {
            const vDocs = v.dokumenti || [];
            vDocs.forEach(d => {
                // Support both legacy base64 (docData) and Firebase Storage URLs (fileUrl)
                if (d.naziv && (d.docData || d.fileUrl)) {
                    docs.push({
                        id: `fleet-doc-${v.id}-${d.id}`,
                        name: d.docName || d.naziv,
                        data: d.docData || null,
                        url: d.fileUrl || null,
                        category: d.kategorija === 'Osiguranje' ? 'Ugovori' : d.kategorija === 'Tehnički pregled' ? 'Certifikati' : 'Ostalo',
                        description: `${v.registracija || 'Vozilo'} — ${d.kategorija || 'Ostalo'}`,
                        size: d.fileSize || (d.velicina ? parseFloat(d.velicina) * 1024 : null),
                        uploadedAt: d.datumUpisa || null,
                        _readonly: true,
                        _sourceLabel: 'Vozni park',
                        _sourceLink: `/dashboard/fleet?openId=${v.id}&tab=arhiva`,
                    });
                }
            });
        });

        // Aggregate fleet-documents module docs
        const fleetDocs = getAll('fleetDocuments');
        fleetDocs.forEach(fd => {
            const fName = fd.docName || fd.attachedFileName || fd.fileName || fd.datotekaIme;
            const fData = fd.docData || fd.attachedFileData || fd.fileData || fd.datotekaSadrzaj;
            if (fName && fData) {
                docs.push({
                    id: `fleet-fdoc-${fd.id}`,
                    name: fName,
                    data: fData,
                    category: 'Ostalo',
                    description: fd.naziv || fd.ime || 'Flota dokument',
                    size: fd.attachedFileSize || null,
                    uploadedAt: fd.datum || fd.datumUpisa || null,
                    _readonly: true,
                    _sourceLabel: 'Flota dokumenti',
                    _sourceLink: `/dashboard/fleet-documents?openId=${fd.id}`,
                });
            }
        });

        // Aggregate fleet-orders travel orders
        const fleetOrders = getAll('fleetOrders');
        fleetOrders.forEach(fo => {
            const fName = fo.docName || fo.attachedFileName || fo.fileName || fo.datotekaIme;
            const fData = fo.docData || fo.attachedFileData || fo.fileData || fo.datotekaSadrzaj;
            if (fName && fData) {
                docs.push({
                    id: `fleet-order-${fo.id}`,
                    name: fName,
                    data: fData,
                    category: 'Obrasci',
                    description: fo.opis || fo.naziv || 'Putni nalog',
                    size: fo.attachedFileSize || null,
                    uploadedAt: fo.datum || fo.datumUpisa || null,
                    _readonly: true,
                    _sourceLabel: 'Putni nalozi',
                    _sourceLink: `/dashboard/fleet-orders?openId=${fo.id}`,
                });
            }
        });

        // Aggregate Zapisnici docs (stored in IDB — flagged with _idbKey)
        const zapisnici = getAll(COLLECTIONS.ZAPISNICI);
        zapisnici.forEach(z => {
            if (z.idbKey && z.attachedFileName) {
                docs.push({
                    id: `zap-${z.id}`,
                    name: z.attachedFileName,
                    data: null,          // lives in IDB, not base64
                    _idbKey: z.idbKey,  // signal to open/download via idbFiles
                    category: 'Zapisnici',
                    description: `${z.naziv}${z.broj ? ` · ${z.broj}` : ''}${z.vrsta ? ` · ${z.vrsta}` : ''}`,
                    size: z.attachedFileSize || null,
                    uploadedAt: z.datum || null,
                    _readonly: true,
                    _sourceLabel: 'Zapisnici',
                    _sourceLink: `/dashboard/zapisnici`,
                });
            }
        });

        // Aggregate worker-level documents (ZOS/ZOP uploads stored on worker.dokumenti[])
        const allWorkers = getAll(COLLECTIONS.WORKERS);
        allWorkers.forEach(w => {
            const wDocs = w.dokumenti || [];
            wDocs.forEach(d => {
                if (d.name && (d.url || d.data)) {
                    docs.push({
                        id: `worker-doc-${w.id}-${d.id}`,
                        name: d.name,
                        data: d.data || null,
                        url: d.url || null,
                        category: d.source?.includes('ZOS') ? 'Zapisnici' : d.source?.includes('ZOP') ? 'Zapisnici' : 'Ostalo',
                        description: `${w.ime} ${w.prezime}${d.source ? ` — ${d.source}` : ''}`,
                        size: d.size || null,
                        uploadedAt: d.date || null,
                        _readonly: true,
                        _sourceLabel: 'Radnici',
                        _sourceLink: `/dashboard/workers?openWorker=${w.id}&section=dokumenti`,
                    });
                }
            });
        });

        setFormDocs(docs);
    }, []);

    // Populate form docs on mount
    useEffect(() => { reload(); }, [reload]);

    const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(
        [...files, ...formDocs].filter(f => {
            const matchSearch = !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.description?.toLowerCase().includes(search.toLowerCase());
            const matchCat = category === 'Sve' || f.category === category;
            return matchSearch && matchCat;
        }),
        'name'
    );

    const processFile = async (file) => {
        if (file.size> MAX_MB * 1024 * 1024) {
            setUploadError(t('fileMustBeUnderMb').replace('{0}', MAX_MB));
            return;
        }
        setUploadError('');
        setUploading(true);
        try {
            let url = null;
            try {
                const cid = getActiveCompanyId();
                const res = await uploadDocument(file, cid, 'digital-archive');
                url = res.url;
            } catch (e) {
                throw new Error('Upload rejected');
            }

            create(COLLECTIONS.DIGITAL_ARCHIVE, {
                name: file.name,
                size: file.size,
                type: file.type,
                category: 'Ostalo',
                description: '',
                data: url,
                uploadedAt: new Date().toISOString(),
            });
            reload();
        } catch {
            setUploadError(t('greskaPriUcitavanjuDatoteke'));
        } finally {
            setUploading(false);
        }
    };

    const handleFiles = (fileList) => {
        Array.from(fileList).forEach(f => processFile(f));
    };

    const handleDelete = async (id, name) => {
        const ok = await confirm(t('delete1').replace('{0}', name));
        if (ok) { remove(COLLECTIONS.DIGITAL_ARCHIVE, id); reload(); }
    };

    const handleDownload = async (file) => {
        if (file._idbKey) {
            try { await idbDownloadFile(file._idbKey, file.name); } catch { /* ignore */ }
            return;
        }
        if (file.url) {
            try {
                const response = await fetch(file.url);
                if (!response.ok) throw new Error('Network error');
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = file.name || 'document';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(blobUrl);
            } catch (err) {
                console.error('Download failed:', err);
                window.open(file.url, '_blank');
            }
            return;
        }
        if (file.data) {
            const a = document.createElement('a');
            a.href = file.data;
            a.download = file.name;
            a.click();
        }
    };

    const handleOpen = async (file) => {
        if (file._idbKey) {
            try { await idbOpenFile(file._idbKey); } catch { /* ignore */ }
            return;
        }
        if (file.url) {
            window.open(file.url, '_blank');
            return;
        }
        if (file.data) {
            const w = window.open();
            if (w) {
                w.document.write(`<html><head><title>${file.name}</title></head><body style="margin:0"><iframe src="${file.data}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
                w.document.close();
            }
        }
    };

    const handleAskZia = async (file) => {
        const isPdf = typeof file?.name === 'string' && file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            alert(t('ziaTrenutnoMozeAnaliziratiSamo'));
            return;
        }

        try {
            let base64Data = null;
            let fileType = 'application/pdf';

            // Base64 already present
            if (file.data && file.data.startsWith('data:')) {
                base64Data = file.data.split(',')[1];
            } 
            // Remote URL
            else if (file.url) {
                const res = await fetch(file.url);
                const blob = await res.blob();
                if (blob.size> 4_000_000) {
                    alert(t('datotekaJePrevelikaZaAi'));
                    return;
                }
                const reader = new FileReader();
                base64Data = await new Promise(resolve => {
                    reader.onload = e => resolve(e.target.result.split(',')[1]);
                    reader.readAsDataURL(blob);
                });
            }
            // IndexedDB 
            else if (file._idbKey) {
                // Not easily supported synchronously right here without importing IDB logic deeply
                alert(t('skeniraniTestoviNisuPodrzaniPreuzmite'));
                return;
            }

            if (base64Data) {
                window.dispatchEvent(new CustomEvent('ziaLoadFile', {
                    detail: { name: file.name, type: fileType, data: base64Data, size: file.size }
                }));
            }
        } catch (err) {
            alert(t('errorLoadingFile').replace('{0}', err.message));
        }
    };

    const handleCategoryChange = (id, cat) => {
        update(COLLECTIONS.DIGITAL_ARCHIVE, id, { category: cat });
        reload();
    };

    const handleDescChange = (id, desc) => {
        update(COLLECTIONS.DIGITAL_ARCHIVE, id, { description: desc });
        reload();
    };

    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader icon="🗄️" title={t('digitalnaArhiva')} />

            {/* ── Tab bar ── */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
                {[
                    { id: 'archive', icon: '📁', label_bs: 'Arhiva', label_en: 'Archive' },
                    { id: 'scan',    icon: '📝', label_bs: 'Skenirani testovi', label_en: 'Scanned Tests' },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                        padding: '9px 20px', border: 'none', cursor: 'pointer',
                        fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: activeTab === tab.id ? 700 : 500,
                        background: 'transparent', borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                        color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                        marginBottom: -2, transition: 'all 0.15s',
                    }}>
                        {tab.icon} {lang !== 'en' ? tab.label_bs : tab.label_en}
                    </button>
                ))}
            </div>

            {/* ── Scan tab ── */}
            {activeTab === 'scan' && (
                <div>
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-body">
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                {t('ubaciSkeniraniTest')}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                                Aplikacija će analizirati skenirane testove pomoću AI, izdvojiti imena radnika i uporediti ih sa bazom podataka.
                            </div>

                            {/* Drop zone */}
                            <div
                                style={{
                                    border: scanDragging ? '2px solid var(--primary)' : `2px dashed ${scanFile ? 'var(--success)' : 'var(--border)'}`,
                                    borderRadius: 'var(--radius-md)', padding: '28px 20px', textAlign: 'center',
                                    background: scanDragging ? 'rgba(0,191,166,0.04)' : scanFile ? 'rgba(34,197,94,0.04)' : 'transparent',
                                    cursor: 'pointer', transition: 'all 0.2s', marginBottom: 20,
                                }}
                                onDragOver={e => { e.preventDefault(); setScanDragging(true); }}
                                onDragLeave={() => setScanDragging(false)}
                                onDrop={e => { e.preventDefault(); setScanDragging(false); const f = e.dataTransfer.files[0]; if (f) handleScanFileRead(f); }}
                                onClick={() => scanFileRef.current?.click()}>
                                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>
                                    {analyzing ? '⏳' : scanFile ? '✅' : scanDragging ? '📂' : '📄'}
                                </div>
                                {analyzing ? (
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Analiziranje dokumenta pomoću AI...</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            Čitanje teksta i prepoznavanje imena radnika iz skeniranog testa...
                                        </div>
                                    </div>
                                ) : scanFile ? (
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>{scanFile.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            {formatSize(scanFile.size)} · {t('klikniZaPromjenu')}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                            {scanDragging
                                                ? (t('ispustiTestOvdje'))
                                                : (t('prevuciSkeniraniTestIliKlikni'))}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            PDF, JPG, PNG — max 10MB
                                        </div>
                                    </div>
                                )}
                                <input ref={scanFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files[0]; if (f) handleScanFileRead(f); e.target.value = ''; }}
                                    disabled={analyzing} />
                            </div>

                            {scanFile && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                    <button 
                                        className="btn btn-outline" 
                                        onClick={() => { if (rawFile) handleScanFileRead(rawFile); }} 
                                        disabled={analyzing}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        🔄 {lang === 'en' ? 'Rescan Document' : 'Ponovo analiziraj'}
                                    </button>
                                    <button className="btn btn-ghost" onClick={handleClearScan} disabled={analyzing}>
                                        ❌ {t('ocistiSve')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Results Table */}
                    {scanSearched && (
                        <div className="card">
                            <div className="card-body">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Rezultati prepoznavanja radnika ({matchedRows.length})
                                    </div>
                                    {matchedRows.length > 0 && (
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <button className="btn btn-outline btn-sm" onClick={handleDownloadExcel} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                📊 Izvezi u Excel
                                            </button>
                                            <button className="btn btn-outline btn-sm" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                                                🖨️ Isprintaj / PDF
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {matchedRows.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔎</div>
                                        <div style={{ fontWeight: 600 }}>Nema pronađenih radnika u testu</div>
                                        <div style={{ fontSize: '0.82rem', marginTop: 4 }}>AI nije uspio detektovati niti jedno ime iz dokumenta.</div>
                                    </div>
                                ) : (
                                    <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '3%' }}>#</th>
                                                    <th>Ime iz testa (AI)</th>
                                                    <th>Pronađeni radnik (Baza)</th>
                                                    <th>Ime oca</th>
                                                    <th>JMBG / OIB</th>
                                                    <th>Tip / Datum testa</th>
                                                    <th style={{ width: 120 }}>Podudaranje</th>
                                                    <th style={{ width: 60 }}>Akcije</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {matchedRows.map((row, idx) => {
                                                    const allWorkers = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false);
                                                    const selectedW = allWorkers.find(w => w.id === row.selectedWorkerId);
                                                    const isNotInDb = row.selectedWorkerId === '__NOT_IN_DB__';
                                                    const isManual = row.score === 100 && !row.dobMatch;
                                                    const conf = isNotInDb
                                                        ? { emoji: '👤', label: 'Nije u bazi', color: 'var(--text-muted)' }
                                                        : isManual
                                                            ? { emoji: '✍️', label: 'Ručno', color: 'var(--text)' }
                                                            : confidenceLabel(row.score);
                                                    
                                                    return (
                                                        <tr key={row.id}>
                                                            <td>{idx + 1}</td>
                                                            <td style={{ fontWeight: 600 }}>{row.extractedName}</td>
                                                            <td>
                                                                <select 
                                                                    className="form-select" 
                                                                    value={row.selectedWorkerId}
                                                                    onChange={e => handleUpdateRowWorker(row.id, e.target.value)}
                                                                    style={{ minWidth: 200, padding: '4px 8px', fontSize: '0.85rem' }}
                                                                >
                                                                    <option value="">— Odaberite radnika —</option>
                                                                    <option value="__NOT_IN_DB__">⚠️ Zadrži ime: "{row.extractedName}" (Nije u bazi)</option>
                                                                    {allWorkers.map(w => (
                                                                        <option key={w.id} value={w.id}>
                                                                            {w.ime} {w.prezime} {w.jmbg ? `(JMBG: ${w.jmbg})` : w.oib ? `(OIB: ${w.oib})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td>{selectedW?.imeRoditelja || '—'}</td>
                                                            <td>{selectedW?.jmbg || selectedW?.oib || '—'}</td>
                                                            <td>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{row.type || '—'}</span>
                                                                {row.date && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{row.date}</div>}
                                                            </td>
                                                            <td>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <span title={conf.label} style={{ fontSize: '1rem' }}>{conf.emoji}</span>
                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: conf.color }}>{conf.label}</span>
                                                                    {row.dobMatch && <span style={{ color: 'var(--success)', fontSize: '0.72rem', fontWeight: 600 }} title="Datum rođenja se podudara">🎂</span>}
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <button 
                                                                    className="btn btn-ghost btn-sm btn-icon" 
                                                                    style={{ color: 'var(--danger)', padding: 0 }}
                                                                    onClick={() => handleDeleteRow(row.id)}
                                                                    title="Ukloni red"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {/* ── Archive tab content ── */}
            {activeTab === 'archive' && (<>


            <div
                className="card"
                style={{
                    marginBottom: 20, border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)',
                    background: dragging ? 'rgba(0,191,166,0.04)' : uploading ? 'rgba(99,102,241,0.04)' : 'transparent',
                    transition: 'all 0.2s', cursor: 'pointer',
                }}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}>
                <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{uploading ? '⏳' : dragging ? '📂' : '☁️'}</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {uploading
                            ? (t('ucitavanje'))
                            : dragging
                            ? (t('ispustiDatotekeOvdje'))
                            : (t('prevuciDatotekeOvdjeIliKlikni'))}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        PDF, Word, Excel, PowerPoint, slike, ZIP — max {MAX_MB}MB
                    </div>
                    {uploadError && (
                        <div style={{ marginTop: 8, color: 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>⚠️ {uploadError}</div>
                    )}
                    <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
                </div>
            </div>

            {/* Filters */}
            <div className="scrollable-toolbar" style={{ padding: 0, gap: 10, marginBottom: 16 }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
                    <input placeholder={t('pretraziArhivu')}
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                    {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>✕</button>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {CATEGORIES.map(cat => (
                        <button key={cat} onClick={() => setCategory(cat)} style={{
                            padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)',
                            fontSize: '0.78rem', fontWeight: category === cat ? 700 : 400, cursor: 'pointer',
                            background: category === cat ? 'var(--primary)' : 'var(--bg-card)',
                            color: category === cat ? '#fff' : 'var(--text)',
                        }}>{cat}</button>
                    ))}
                </div>
            </div>

            {/* File list */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    {sorted.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🗄️</div>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('arhivaJePrazna')}</div>
                            <div style={{ fontSize: '0.82rem' }}>{t('prevuciteDatotekeGoreDaPocnete')}</div>
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}></th>
                                        <th onClick={() => toggleSort('name')} style={thStyle('name')}>{t('naziv')}{sortIcon('name')}</th>
                                        <th style={{ width: 160 }}>{t('kategorija')}</th>
                                        <th onClick={() => toggleSort('size')} style={{ ...thStyle('size'), width: 90 }}>{t('velicina')}{sortIcon('size')}</th>
                                        <th onClick={() => toggleSort('uploadedAt')} style={{ ...thStyle('uploadedAt'), width: 120 }}>{t('datum')}{sortIcon('uploadedAt')}</th>
                                        <th style={{ width: 100 }}>{t('akcije')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(file => (
                                        <tr key={file.id}>
                                            <td style={{ textAlign: 'center', fontSize: '1.4rem' }}>{getIcon(file.name)}</td>
                                            <td>
                                                <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                                                    onClick={() => handleOpen(file)} title={t('otvori')}>
                                                    {file.name}
                                                </div>
                                                {file._readonly ? (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                        📋 <Link href={file._sourceLink || '#'} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>{file._sourceLabel}</Link>
                                                    </div>
                                                ) : (
                                                    <input
                                                        defaultValue={file.description || ''}
                                                        onBlur={e => handleDescChange(file.id, e.target.value)}
                                                        placeholder={t('opisOpcionalno')}
                                                        style={{ border: 'none', background: 'transparent', fontSize: '0.75rem', color: 'var(--text-muted)', width: '100%', outline: 'none', marginTop: 2, fontFamily: 'var(--font-body)' }}
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                {file._readonly ? (
                                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 12, background: 'rgba(0,191,166,0.12)', color: 'var(--primary)', fontWeight: 600 }}>{file.category || 'Obrasci'}</span>
                                                ) : (
                                                    <select value={file.category || 'Ostalo'} onChange={e => handleCategoryChange(file.id, e.target.value)}
                                                        style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', fontSize: '0.78rem', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer', width: '100%' }}>
                                                        {CATEGORIES.filter(c => c !== 'Sve').map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{file.size ? formatSize(file.size) : '—'}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString('hr-HR') : '-'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'grid', gridTemplateColumns: '28px 28px 28px 28px', gap: 4, alignItems: 'center' }}>
                                                    <div>
                                                        {typeof file?.name === 'string' && file.name.toLowerCase().endsWith('.pdf') && (
                                                            <button className="btn btn-ghost btn-sm btn-icon" style={{color: 'transparent', textShadow: '0 0 0 var(--primary)', width: '100%', padding: 0}} title={t('analizirajSaZia')} onClick={() => handleAskZia(file)}>✨</button>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ width: '100%', padding: 0 }} title={t('otvori')} onClick={() => handleOpen(file)}>👁️</button>
                                                    </div>
                                                    <div>
                                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ width: '100%', padding: 0 }} title={t('preuzmi')} onClick={() => handleDownload(file)}>⬇️</button>
                                                    </div>
                                                    <div>
                                                        {!file._readonly && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', width: '100%', padding: 0 }} title={t('obrisi')} onClick={() => handleDelete(file.id, file.name)}>🗑️</button>}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            </>)}

        </div>
    );
}

