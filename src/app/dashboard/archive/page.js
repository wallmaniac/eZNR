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
        const [files, setFiles] = useState(() => getAll(COLLECTIONS.DIGITAL_ARCHIVE));
    const [formDocs, setFormDocs] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('Sve');
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef(null);
    const MAX_MB = 5;

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

        // Aggregate fire extinguisher documents (stored on extinguisher.dokumenti[])
        const extinguishers = getAll(COLLECTIONS.FIRE_EXTINGUISHERS) || [];
        extinguishers.forEach(e => {
            const eDocs = e.dokumenti || [];
            eDocs.forEach(d => {
                if (d.name && (d.url || d.data)) {
                    docs.push({
                        id: `ext-doc-${e.id}-${d.id}`,
                        name: d.name,
                        data: d.data || null,
                        url: d.url || null,
                        category: 'Zapisnici',
                        description: `${t('fireExtinguisher')} — ${e.serijskiBroj}${e.lokacija ? ` (${e.lokacija})` : ''}`,
                        size: d.size || null,
                        uploadedAt: d.uploadedAt || d.datumUpisa || null,
                        _readonly: true,
                        _sourceLabel: t('fireExtinguisher') + ` (${e.serijskiBroj})`,
                        _sourceLink: `/dashboard/fire-protection?openItem=${e.id}`,
                    });
                }
            });
        });

        // Aggregate hydrant documents (stored on hydrant.dokumenti[])
        const hydrants = getAll(COLLECTIONS.HYDRANTS) || [];
        hydrants.forEach(h => {
            const hDocs = h.dokumenti || [];
            hDocs.forEach(d => {
                if (d.name && (d.url || d.data)) {
                    docs.push({
                        id: `hyd-doc-${h.id}-${d.id}`,
                        name: d.name,
                        data: d.data || null,
                        url: d.url || null,
                        category: 'Zapisnici',
                        description: `${t('hidrant')} — ${h.oznaka}${h.lokacija ? ` (${h.lokacija})` : ''}`,
                        size: d.size || null,
                        uploadedAt: d.uploadedAt || d.datumUpisa || null,
                        _readonly: true,
                        _sourceLabel: t('hidrant') + ` (${h.oznaka})`,
                        _sourceLink: `/dashboard/fire-protection?openItem=${h.id}`,
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
            

        </div>
    );
}

