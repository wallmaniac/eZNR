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
    const [scanFile, setScanFile] = useState(null);   // { name, data, size, type }
    const [scanName, setScanName] = useState('');
    const [scanDob, setScanDob] = useState('');
    const [scanDragging, setScanDragging] = useState(false);
    const [scanMatches, setScanMatches] = useState([]); // top worker matches
    const [scanSearched, setScanSearched] = useState(false);
    const scanFileRef = useRef(null);

    const handleScanFileRead = (file) => {
        if (file.size > 10 * 1024 * 1024) { alert('Max 10MB za skenirani test!'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            setScanFile({ name: file.name, data: e.target.result, size: file.size, type: file.type });
            // Try to parse name hint from filename: e.g. "Mujo_Mujic_1990.pdf" → "Mujo Mujic"
            const base = file.name.replace(/\.[^.]+$/, '').replace(/[_\-\.]/g, ' ').replace(/\d{4,}/g, '').trim();
            if (base.split(' ').length >= 2) setScanName(base);
            setScanSearched(false);
            setScanMatches([]);
        };
        reader.readAsDataURL(file);
    };

    const handleScanSearch = () => {
        if (!scanName.trim()) { alert(lang === 'bs' ? 'Unesite ime radnika!' : 'Enter worker name!'); return; }
        const workers = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false);
        const results = matchWorkers(scanName, scanDob, workers);
        setScanMatches(results);
        setScanSearched(true);
    };

    const handleScanSelectWorker = (worker) => {
        if (!scanFile) { alert('Nema odabranog skena!'); return; }
        try {
            sessionStorage.setItem('eznr_scan_prefill', JSON.stringify({
                data: scanFile.data, name: scanFile.name,
                size: scanFile.size, type: scanFile.type,
            }));
        } catch { /* storage full */ }
        router.push(`/dashboard/worker-certificates/create?workerId=${worker.id}&fromScan=1`);
    };



    const reload = useCallback(() => {
        setFiles(getAll(COLLECTIONS.DIGITAL_ARCHIVE));
        // Aggregate form attachments
        const docs = [];
        FORM_SOURCES.forEach(({ col, label, link }) => {
            const recs = getAll(col);
            recs.forEach(r => {
                // Support both legacy base64 and new Firebase Storage URLs
                const fName = r.docName || r.attachedFileName || r.fileName || r.datotekaIme;
                const fData = r.docData || r.attachedFileData || r.fileData || r.datotekaSadrzaj;
                const fUrl = r.fileUrl || r.attachedFileUrl || r.docUrl;

                if (fName && (fData || fUrl)) {
                    let finalLink = link;
                    if (col === 'certificates') {
                        finalLink = `${link}/edit/${r.id}`;
                    } else if (col === 'requests' || col.startsWith('forms') || col.startsWith('referrals') || col === 'employerDocs') {
                        finalLink = `${link}?openId=${r.id}`;
                    }
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
        if (file.size > MAX_MB * 1024 * 1024) {
            setUploadError(lang === 'bs' ? `Datoteka mora biti manja od ${MAX_MB}MB!` : `File must be under ${MAX_MB}MB!`);
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
            setUploadError(lang === 'bs' ? 'Greška pri učitavanju datoteke.' : 'File read error.');
        } finally {
            setUploading(false);
        }
    };

    const handleFiles = (fileList) => {
        Array.from(fileList).forEach(f => processFile(f));
    };

    const handleDelete = async (id, name) => {
        const ok = await confirm(lang === 'bs' ? `Obrisati "${name}"?` : `Delete "${name}"?`);
        if (ok) { remove(COLLECTIONS.DIGITAL_ARCHIVE, id); reload(); }
    };

    const handleDownload = async (file) => {
        if (file._idbKey) {
            try { await idbDownloadFile(file._idbKey, file.name); } catch { /* ignore */ }
            return;
        }
        if (file.url) {
            const a = document.createElement('a');
            a.href = file.url;
            a.download = file.name;
            a.target = '_blank';
            a.click();
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
            alert(lang === 'bs' ? 'Zia trenutno može analizirati samo PDF datoteke iz arhive.' : 'Zia can currently only analyze PDF files from the archive.');
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
                if (blob.size > 4_000_000) {
                    alert(lang === 'bs' ? 'Datoteka je prevelika za AI analizu (Maks 4MB).' : 'File is too large for AI analysis (Max 4MB).');
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
                alert(lang === 'bs' ? 'Skenirani testovi nisu podržani. Preuzmite datoteku pa je prevucite u Zia chat.' : 'Scanned tests not supported directly. Download the file and drop it into Zia chat.');
                return;
            }

            if (base64Data) {
                window.dispatchEvent(new CustomEvent('ziaLoadFile', {
                    detail: { name: file.name, type: fileType, data: base64Data, size: file.size }
                }));
            }
        } catch (err) {
            alert(lang === 'bs' ? `Greška pri učenju datoteke: ${err.message}` : `Error loading file: ${err.message}`);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: '1.6rem' }}>🗄️</span>
                <div>
                    <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Digitalna arhiva' : 'Digital Archive'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {files.length} {lang === 'bs' ? 'datoteka' : 'files'} · {formatSize(totalSize)} {lang === 'bs' ? 'ukupno' : 'total'} · max {MAX_MB}MB po datoteci
                    </p>
                </div>
            </div>

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
                        {tab.icon} {lang === 'bs' ? tab.label_bs : tab.label_en}
                    </button>
                ))}
            </div>

            {/* ── Scan tab ── */}
            {activeTab === 'scan' && (
                <div>
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-body">
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                {lang === 'bs' ? '📝 Ubaci skenirani test' : '📝 Upload Scanned Test'}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                                {lang === 'bs'
                                    ? 'Aplikacija će pronaći odgovarajućeg radnika prema imenu i datumu rođenja, a vi možete po potrebi ručno doraditi unos.'
                                    : 'The app will find the matching worker by name and date of birth. You can manually adjust if needed.'}
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
                                onClick={() => scanFileRef.current?.click()}
                            >
                                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>
                                    {scanFile ? '✅' : scanDragging ? '📂' : '📄'}
                                </div>
                                {scanFile ? (
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>{scanFile.name}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                            {formatSize(scanFile.size)} · {lang === 'bs' ? 'Klikni za promjenu' : 'Click to change'}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                            {scanDragging
                                                ? (lang === 'bs' ? 'Ispusti test ovdje' : 'Drop test here')
                                                : (lang === 'bs' ? 'Prevuci skenirani test ili klikni za odabir' : 'Drag scanned test here or click to select')}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            PDF, JPG, PNG, DOCX — max 10MB
                                        </div>
                                    </div>
                                )}
                                <input ref={scanFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files[0]; if (f) handleScanFileRead(f); e.target.value = ''; }} />
                            </div>

                            {/* Name / DOB hints */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: 12, alignItems: 'flex-end' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                                        {lang === 'bs' ? 'Ime i prezime (iz testa)' : 'Name (from test)'}
                                    </div>
                                    <input className="form-input" value={scanName}
                                        onChange={e => { setScanName(e.target.value); setScanSearched(false); setScanMatches([]); }}
                                        placeholder={lang === 'bs' ? 'npr. Mujo Mujić' : 'e.g. John Smith'}
                                        onKeyDown={e => { if (e.key === 'Enter') handleScanSearch(); }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                                        {lang === 'bs' ? 'Datum r. (opciono)' : 'Date of birth (opt.)'}
                                    </div>
                                    <DateInput value={scanDob}
                                        onChange={v => { setScanDob(v); setScanSearched(false); setScanMatches([]); }} />
                                </div>
                                <button className="btn btn-primary" onClick={handleScanSearch} style={{ whiteSpace: 'nowrap' }}>
                                    🔍 {lang === 'bs' ? 'Pronađi radnika' : 'Find worker'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Results */}
                    {scanSearched && (
                        <div className="card">
                            <div className="card-body">
                                <div style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.88rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {lang === 'bs' ? `Pronađeni radnici (top ${scanMatches.length})` : `Matched workers (top ${scanMatches.length})`}
                                </div>
                                {scanMatches.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔎</div>
                                        <div style={{ fontWeight: 600 }}>{lang === 'bs' ? 'Nema rezultata' : 'No results'}</div>
                                        <div style={{ fontSize: '0.82rem', marginTop: 4 }}>{lang === 'bs' ? 'Pokušajte s drugačijim imenom ili dodajte datum rođenja.' : 'Try a different name or add date of birth.'}</div>
                                    </div>
                                ) : scanMatches.map(({ worker: w, score, dobMatch }) => {
                                    const conf = confidenceLabel(score);
                                    return (
                                        <div key={w.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                            marginBottom: 8, cursor: 'pointer', transition: 'all 0.15s',
                                            background: 'var(--bg-card)',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                                            onClick={() => handleScanSelectWorker(w)}
                                        >
                                            <div style={{
                                                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                                                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 700, fontSize: '1rem',
                                            }}>
                                                {(w.ime || '?')[0]}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{w.ime} {w.prezime}</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                    {w.datumRodjenja && `🎂 ${w.datumRodjenja}`}
                                                    {w.jmbg && ` · JMBG: ${w.jmbg}`}
                                                    {dobMatch && <span style={{ color: 'var(--success)', marginLeft: 6, fontWeight: 600 }}>✓ DOB match</span>}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                                                <div style={{ fontSize: '1.2rem' }}>{conf.emoji}</div>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: conf.color }}>{conf.label}</div>
                                            </div>
                                            <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); handleScanSelectWorker(w); }}>
                                                {lang === 'bs' ? 'Odaberi →' : 'Select →'}
                                            </button>
                                        </div>
                                    );
                                })}
                                {!scanFile && scanMatches.length > 0 && (
                                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.82rem', color: 'var(--warning)' }}>
                                        ⚠️ {lang === 'bs' ? 'Odaberite datoteku skeniranog testa prije nego nastavite!' : 'Please select the scanned test file before continuing!'}
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
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="card-body" style={{ textAlign: 'center', padding: '28px 20px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{uploading ? '⏳' : dragging ? '📂' : '☁️'}</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {uploading
                            ? (lang === 'bs' ? 'Učitavanje...' : 'Uploading...')
                            : dragging
                            ? (lang === 'bs' ? 'Ispusti datoteke ovdje' : 'Drop files here')
                            : (lang === 'bs' ? 'Prevuci datoteke ovdje ili klikni za odabir' : 'Drag & drop files here or click to select')}
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
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
                    <input placeholder={lang === 'bs' ? 'Pretraži arhivu...' : 'Search archive...'}
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
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>{lang === 'bs' ? 'Arhiva je prazna' : 'Archive is empty'}</div>
                            <div style={{ fontSize: '0.82rem' }}>{lang === 'bs' ? 'Prevucite datoteke gore da počnete' : 'Drag files above to get started'}</div>
                        </div>
                    ) : (
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 44 }}></th>
                                        <th onClick={() => toggleSort('name')} style={thStyle('name')}>{lang === 'bs' ? 'Naziv' : 'Name'}{sortIcon('name')}</th>
                                        <th style={{ width: 160 }}>{lang === 'bs' ? 'Kategorija' : 'Category'}</th>
                                        <th onClick={() => toggleSort('size')} style={{ ...thStyle('size'), width: 90 }}>{lang === 'bs' ? 'Veličina' : 'Size'}{sortIcon('size')}</th>
                                        <th onClick={() => toggleSort('uploadedAt')} style={{ ...thStyle('uploadedAt'), width: 120 }}>{lang === 'bs' ? 'Datum' : 'Date'}{sortIcon('uploadedAt')}</th>
                                        <th style={{ width: 100 }}>{lang === 'bs' ? 'Akcije' : 'Actions'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(file => (
                                        <tr key={file.id}>
                                            <td style={{ textAlign: 'center', fontSize: '1.4rem' }}>{getIcon(file.name)}</td>
                                            <td>
                                                <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                                                    onClick={() => handleOpen(file)} title={lang === 'bs' ? 'Otvori' : 'Open'}>
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
                                                        placeholder={lang === 'bs' ? 'Opis (opcionalno)...' : 'Description (optional)...'}
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
                                                            <button className="btn btn-ghost btn-sm btn-icon" style={{color: 'transparent', textShadow: '0 0 0 var(--primary)', width: '100%', padding: 0}} title={lang === 'bs' ? 'Analiziraj sa Zia' : 'Ask Zia'} onClick={() => handleAskZia(file)}>✨</button>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ width: '100%', padding: 0 }} title={lang === 'bs' ? 'Otvori' : 'Open'} onClick={() => handleOpen(file)}>👁️</button>
                                                    </div>
                                                    <div>
                                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ width: '100%', padding: 0 }} title={lang === 'bs' ? 'Preuzmi' : 'Download'} onClick={() => handleDownload(file)}>⬇️</button>
                                                    </div>
                                                    <div>
                                                        {!file._readonly && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)', width: '100%', padding: 0 }} title={lang === 'bs' ? 'Obriši' : 'Delete'} onClick={() => handleDelete(file.id, file.name)}>🗑️</button>}
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

