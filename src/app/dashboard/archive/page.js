'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, remove, update, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import Link from 'next/link';

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

const CATEGORIES = ['Sve', 'Obrasci', 'Ugovori', 'Certifikati', 'Pravilnici', 'Izvješća', 'Upute', 'Ostalo'];

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
                const fName = r.docName || r.attachedFileName || r.fileName || r.datotekaIme;
                const fData = r.docData || r.attachedFileData || r.fileData || r.datotekaSadrzaj;
                if (fName && fData) {
                    // Decide if we can deep-link into the specific document editor/view
                    let finalLink = link;
                    if (col === 'certificates') {
                        finalLink = `${link}/edit/${r.id}`;
                    } else if (col === 'requests' || col.startsWith('forms') || col.startsWith('referrals') || col === 'employerDocs') {
                        // For generic single-page modules, try appending open parameter just in case
                        finalLink = `${link}?openId=${r.id}`;
                    }
                    
                    docs.push({
                        id: `form-${col}-${r.id}`,
                        name: fName,
                        data: fData,
                        category: label.includes('Uvjerenje') ? 'Certifikati' : 'Obrasci',
                        description: r.ime ? `${r.ime}` : label,
                        size: r.attachedFileSize || null,
                        uploadedAt: r.datum || r.datumDogadjaja || r.datumPrijave || null,
                        _readonly: true,
                        _sourceLabel: label,
                        _sourceLink: finalLink,
                    });
                }
            });
        });

        // Aggregate fleet vehicle documents (nested inside vehicle records)
        const vehicles = getAll('vehicles');
        vehicles.forEach(v => {
            const vDocs = v.dokumenti || [];
            vDocs.forEach(d => {
                if (d.naziv && d.docData) {
                    docs.push({
                        id: `fleet-doc-${v.id}-${d.id}`,
                        name: d.naziv,
                        data: d.docData,
                        category: d.kategorija === 'Osiguranje' ? 'Ugovori' : d.kategorija === 'Tehnički pregled' ? 'Certifikati' : 'Ostalo',
                        description: `${v.registracija || 'Vozilo'} — ${d.kategorija || 'Ostalo'}`,
                        size: d.velicina ? parseFloat(d.velicina) * 1024 : null,
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
            const data = await new Promise((res, rej) => {
                const reader = new FileReader();
                reader.onload = e => res(e.target.result);
                reader.onerror = rej;
                reader.readAsDataURL(file);
            });
            create(COLLECTIONS.DIGITAL_ARCHIVE, {
                name: file.name,
                size: file.size,
                type: file.type,
                category: 'Ostalo',
                description: '',
                data,
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

    const handleDownload = (file) => {
        const a = document.createElement('a');
        a.href = file.data;
        a.download = file.name;
        a.click();
    };

    const handleOpen = (file) => {
        const w = window.open();
        if (w) {
            w.document.write(`<html><head><title>${file.name}</title></head><body style="margin:0"><iframe src="${file.data}" style="width:100%;height:100vh;border:none"></iframe></body></html>`);
            w.document.close();
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: '1.6rem' }}>🗄️</span>
                <div>
                    <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Digitalna arhiva' : 'Digital Archive'}</h1>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {files.length} {lang === 'bs' ? 'datoteka' : 'files'} · {formatSize(totalSize)} {lang === 'bs' ? 'ukupno' : 'total'} · max {MAX_MB}MB po datoteci
                    </p>
                </div>
            </div>

            {/* Upload drop zone */}
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
                                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 12, background: 'rgba(0,191,166,0.12)', color: 'var(--primary)', fontWeight: 600 }}>Obrasci</span>
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
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Otvori' : 'Open'} onClick={() => handleOpen(file)}>👁️</button>
                                                    <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Preuzmi' : 'Download'} onClick={() => handleDownload(file)}>⬇️</button>
                                                    {!file._readonly && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={lang === 'bs' ? 'Obriši' : 'Delete'} onClick={() => handleDelete(file.id, file.name)}>🗑️</button>}
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
