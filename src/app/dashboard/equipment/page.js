'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS,
    getOrgUnitName, formatDate, getActiveCompanyId, getById
} from '@/lib/dataStore';
import { uploadDocument } from '@/lib/storageService';
import QRCodeLabel from '@/components/QRCodeLabel';
import PrintPortal from '@/components/PrintPortal';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useSortedList } from '@/hooks/useSortedList';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/Pagination';
import PDFExportButton from '@/components/PDFExportButton';
import { generateEquipmentReport } from '@/lib/pdfReportGenerator';
import Icon3D from '@/components/Icon3D';
import PageHeader from '@/components/PageHeader';

const emptyEQ = {
    naziv: '', vrsta: '', tip: '', tvBroj: '', invBroj: '',
    orgJedinicaId: '', zaduzenOsoba: '', datumUpisa: '', uPrimjeniOd: '',
    izvanUpotrebeOd: '', evidencijskiBroj: '', brojMjernihMjesta: 0,
    proizvodjac: '', godinaProizvodnje: '', posljednji: '', iduci: '', status: 'active',
};

const emptyServiceEntry = {
    datum: '', tip: 'pregled', servisirao: '', napomena: '', iduciServis: '', docName: '', docData: '', fileObj: null,
};

function EquipmentPageInner() {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const [items, setItems] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [returnPath, setReturnPath] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [lastEditedId, setLastEditedId] = useState(null);
    const [formData, setFormData] = useState({ ...emptyEQ });
    const [activeTab, setActiveTab] = useState('podaci'); // 'podaci' | 'servis'
    const [serviceLogs, setServiceLogs] = useState([]);
    const [showServiceForm, setShowServiceForm] = useState(false);
    const [serviceFormData, setServiceFormData] = useState({ ...emptyServiceEntry });
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrgUnit, setFilterOrgUnit] = useState('');
    const [showOutOfUse, setShowOutOfUse] = useState(false);
    const [actionMenuId, setActionMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, maxH: 300 });
    const [selectedIds, setSelectedIds] = useState(new Set());
    const openItemHandledRef = useRef(false);
    const serviceDocRef = useRef(null);
    const { activeCompanyId } = useAuth();
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printSelection, setPrintSelection] = useState([]);

    const loadData = useCallback(() => { setItems(getAll(COLLECTIONS.EQUIPMENT)); }, []);
    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    const toggleAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(filtered.map(x => x.id)));
        else setSelectedIds(new Set());
    };
    const toggleOne = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };
    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (await confirm(t('deleteItems6').replace('{0}', selectedIds.size))) {
            for (let id of selectedIds) await remove(COLLECTIONS.EQUIPMENT, id);
            setSelectedIds(new Set());
            loadData();
        }
    };

    // Load service logs when editing an item
    const loadServiceLogs = useCallback((equipmentId) => {
        const all = getAll(COLLECTIONS.SERVICE_LOG);
        setServiceLogs(all.filter(l => l.equipmentId === equipmentId).sort((a, b) => new Date(b.datum) - new Date(a.datum)));
    }, []);

    const [deepLinkId] = useState(() => {
        if (typeof window !== 'undefined') {
            return new URLSearchParams(window.location.search).get('openItem');
        }
        return null;
    });

    // Auto-open item from URL param (calendar event click or QR code)
    useEffect(() => {
        if (openItemHandledRef.current || !deepLinkId || items.length === 0) return;
        const retParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') : null;
        if (retParam) setReturnPath(retParam);
        const openTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null; // e.g. ?tab=servis
        
        const found = items.find(x => x.id === deepLinkId);
        if (found) {
            openItemHandledRef.current = true;
            handleEdit(found, openTab || 'servis'); // default to servis tab when from calendar or qr

            // Strip from URL so it doesn't re-trigger on reload
            window.history.replaceState({}, '', window.location.pathname);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, deepLinkId]);

    const filtered = useMemo(() => {
        return items.filter(eq => {
            const matchSearch = !searchTerm || eq.naziv.toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = showOutOfUse ? !!eq.izvanUpotrebeOd : !eq.izvanUpotrebeOd;
            const matchOrgUnit = !filterOrgUnit || eq.orgJedinicaId === filterOrgUnit || eq.orgJedinica === filterOrgUnit;
            return matchSearch && matchStatus && matchOrgUnit;
        });
    }, [items, searchTerm, showOutOfUse, filterOrgUnit]);

    const equipmentTypes = getAll(COLLECTIONS.EQUIPMENT_TYPES);
    const orgUnits = getAll(COLLECTIONS.ORG_UNITS);
    const workers = getAll(COLLECTIONS.WORKERS);

    const enrichedItems = filtered.map(eq => ({ ...eq, orgName: getOrgUnitName(eq.orgJedinicaId) }));
    const { sorted: sortedEquipment, toggleSort, sortIcon, thStyle } = useSortedList(enrichedItems, 'naziv');
    const { page, perPage, setPage, setPerPage, totalPages, pagedData: pagedEquipment, totalItems, nextPage, prevPage } = usePagination(sortedEquipment, 25);

    const handleNew = () => { setFormData({ ...emptyEQ }); setEditingId(null); setActiveTab('podaci'); setServiceLogs([]); setShowForm(true); };
    const handleEdit = (item, tab = 'podaci') => {
        setFormData({ ...item });
        setEditingId(item.id);
        setLastEditedId(null);
        setActiveTab(tab);
        loadServiceLogs(item.id);
        setShowForm(true);
        setActionMenuId(null);
    };
    const handleDelete = async (id) => {
        const delOk = await confirm(t('jesteLiSigurni'));
        if (delOk) { remove(COLLECTIONS.EQUIPMENT, id); setActionMenuId(null); loadData(); }
    };
    const handleSave = async () => {
        if (!formData.naziv) { await alert(t('nazivJeObaveznoPolje')); return; }
        let savedId = editingId;
        if (editingId) {
            update(COLLECTIONS.EQUIPMENT, editingId, formData);
        } else {
            const newItem = create(COLLECTIONS.EQUIPMENT, formData);
            savedId = newItem.id;
            setEditingId(savedId);
        }
        setLastEditedId(savedId);
        setShowForm(false); loadData(); showFlash(); if(returnPath) { router.push(returnPath); setReturnPath(null); }
    };
    const updateField = (field, value) => { setFormData(prev => ({ ...prev, [field]: value })); };

    // ── Service log handlers ──────────────────────────────────────
    const handleNewService = () => {
        const today = new Date().toISOString().slice(0, 10);
        setServiceFormData({ ...emptyServiceEntry, datum: today });
        setEditingServiceId(null);
        setShowServiceForm(true);
    };

    const handleEditService = (log) => {
        setServiceFormData({ ...log });
        setEditingServiceId(log.id);
        setShowServiceForm(true);
    };

    const handleSaveService = async () => {
        if (!serviceFormData.datum) {
            await alert(t('datumServisaJeObavezan'));
            return;
        }
        if (!editingId) {
            await alert(t('najprijeSacuvajteOpremu'));
            return;
        }

        let uploadedUrl = serviceFormData.docData;
        if (serviceFormData.fileObj) {
            try {
                const cid = getActiveCompanyId();
                const res = await uploadDocument(serviceFormData.fileObj, cid, 'service-logs');
                uploadedUrl = res.url;
            } catch (e) {
                await alert('Upload failed: ' + e.message); return;
            }
        }

        const data = { ...serviceFormData, equipmentId: editingId, docData: uploadedUrl };
        delete data.fileObj;
        
        if (editingServiceId) {
            update(COLLECTIONS.SERVICE_LOG, editingServiceId, data);
        } else {
            create(COLLECTIONS.SERVICE_LOG, data);
        }
        
        // Auto-update posljednji/iduci dates on equipment
        if (serviceFormData.datum) {
            const updates = { posljednji: serviceFormData.datum };
            if (serviceFormData.iduciServis) updates.iduci = serviceFormData.iduciServis;
            update(COLLECTIONS.EQUIPMENT, editingId, { ...formData, ...updates });
            setFormData(prev => ({ ...prev, ...updates }));
        }

        setShowServiceForm(false);
        loadServiceLogs(editingId);
        loadData();
    };

    const handleDeleteService = async (id) => {
        const ok = await confirm(t('obrisatiServisniZapis'));
        if (ok) { remove(COLLECTIONS.SERVICE_LOG, id); loadServiceLogs(editingId); }
    };

    const handleDocUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size> 15 * 1024 * 1024) {
            await alert(t('dokumentMoraBitiManjiOd'));
            return;
        }
        setServiceFormData(prev => ({ ...prev, fileObj: file, docName: file.name }));
    };

    const openDocInTab = (log) => {
        if (!log.docData) return;
        if (log.docData.startsWith('http')) {
            window.open(log.docData, '_blank');
            return;
        }
        // For PDFs and images, open in new tab for preview/print
        const isPdf = log.docData.startsWith('data:application/pdf');
        const isImage = log.docData.startsWith('data:image/');
        if (isPdf || isImage) {
            const byteString = atob(log.docData.split(',')[1]);
            const mimeString = log.docData.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: mimeString });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        } else {
            // For Word/other files, download directly
            const a = document.createElement('a');
            a.href = log.docData;
            a.download = log.docName || 'servisni_dokument';
            a.click();
        }
    };

    const downloadDoc = (log) => {
        if (!log.docData) return;
        if (log.docData.startsWith('http')) {
            window.open(log.docData, '_blank');
            return;
        }
        const a = document.createElement('a');
        a.href = log.docData;
        a.download = log.docName || 'servisni_dokument';
        a.click();
    };

    const handleCopy = async (eq) => {
        setActionMenuId(null);
        if (!await confirm(t('duplicateEquipment').replace('{0}', eq.naziv))) return;
        const copyData = { ...eq };
        delete copyData.id;
        copyData.naziv = (copyData.naziv || '') + ' (Kopija)';
        copyData.status = 'active';
        create(COLLECTIONS.EQUIPMENT, copyData);
        loadData();
        showFlash();
    };

    const handleCancel = () => {
        if (editingId) setLastEditedId(editingId);
        setEditingId(null);
        setShowForm(false);
        if (returnPath) { router.push(returnPath); setReturnPath(null); }
    };

    const handlePrintSingle = (eq) => {
        setActionMenuId(null);
        const orgName = getOrgUnitName(eq.orgJedinicaId);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${eq.naziv}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;font-size:11pt;color:#1a1a1a;padding:20px}h1{font-size:18pt;color:#1a237e}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#e8eaf6;font-weight:700;color:#283593;width:200px}@media print{button{display:none!important}}</style></head><body>
<h1>🔩 ${eq.naziv}</h1>
<table>
<tr><th>Vrsta</th><td>${eq.vrsta || '—'}</td></tr>
<tr><th>Tip</th><td>${eq.tip || '—'}</td></tr>
<tr><th>Tv. broj</th><td>${eq.tvBroj || '—'}</td></tr>
<tr><th>Inv. broj</th><td>${eq.invBroj || '—'}</td></tr>
<tr><th>Organizacija</th><td>${orgName || '—'}</td></tr>
<tr><th>Proizvođač</th><td>${eq.proizvodjac || '—'}</td></tr>
<tr><th>Godina proizvodnje</th><td>${eq.godinaProizvodnje || '—'}</td></tr>
<tr><th>Posljednji pregled</th><td>${eq.posljednji ? formatDate(eq.posljednji) : '—'}</td></tr>
<tr><th>Idući pregled</th><td>${eq.iduci ? formatDate(eq.iduci) : '—'}</td></tr>
</table>
<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:12px 24px;font-size:14px;cursor:pointer;background:#3f51b5;color:white;border:none;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:999">🖨️ Print</button>
<script>setTimeout(()=>window.print(),500);<\/script></body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const tipLabel = (tip) => ({
        pregled: t('pregled'),
        servis: t('servis'),
        popravak: t('popravak'),
        kalibracija: t('kalibracija'),
        zamjena: t('zamjenaDijela'),
    }[tip] || tip);

    const menuItemSt = {
        display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
        color: 'var(--text)', fontFamily: 'var(--font-body)', transition: 'background 0.12s',
    };

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Icon3D name="Oprema.png" size={64} />
                <h1 style={{ margin: 0 }}>{t('equipment')}</h1>
            </div>
            
            <PrintPortal isPrinting={showPrintModal}>
                <div id="qr-print-area" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 60mm)', gap: '4mm', alignContent: 'start', justifyContent: 'center', padding: '10mm' }}>
                    {(() => {
                        const company = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                        return printSelection.map((eq, i) => (
                            <QRCodeLabel 
                                key={i} 
                                type="eq" 
                                id={eq.id} 
                                title={eq.naziv.toUpperCase()} 
                                subtitle={eq.invBroj || eq.tvBroj || (t('na'))} 
                                companyLogo={company?.logo} 
                                companyId={activeCompanyId}
                            />
                        ));
                    })()}
                </div>
            </PrintPortal>
            
            {showPrintModal && (
                <div className="modal-overlay no-print" onClick={() => setShowPrintModal(false)}>
                    <div className="modal" style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🖨️ Isprintaj QR kodove</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowPrintModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ background: '#f5f5f5', padding: 20 }}>
                            <div style={{ marginBottom: 16, fontSize: '0.85rem', color: '#555' }}>
                                Pripremljeno <strong>{printSelection.length}</strong> etiketa za print. 
                                Koristite uobičajeni A4 papir ili formatirajte ladicu na samoljepljivi papir.
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 60mm)', gap: '4mm', alignContent: 'start', justifyContent: 'center', opacity: 0.5, pointerEvents: 'none' }}>
                                {(() => {
                                    const company = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                                    return printSelection.map((eq, i) => (
                                        <QRCodeLabel 
                                            key={i} 
                                            type="eq" 
                                            id={eq.id} 
                                            title={eq.naziv.toUpperCase()} 
                                            subtitle={eq.invBroj || eq.tvBroj || (t('na'))} 
                                            companyLogo={company?.logo} 
                                            companyId={activeCompanyId}
                                        />
                                    ));
                                })()}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowPrintModal(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={() => window.print()}>🖨️ Printaj stranicu</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Equipment Edit Modal ── */}
            {showForm && (
                <div className="modal-overlay" onClick={handleCancel}>
                    <div className="modal" style={{ width: '100%', maxWidth: 860, minHeight: 650, display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Icon3D name="Oprema.png" size={48} />
                                    <h2 style={{ margin: 0 }}>{t('radnaOpremaObjekt')} {formData.naziv && `— ${formData.naziv}`}</h2>
                                </div>
                            <button className="btn btn-ghost btn-icon" onClick={handleCancel}>✕</button>
                        </div>

                        {/* Tab bar */}
                        <div className="scrollable-tabs-bar" style={{ gap: 4, padding: '0 24px', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
                            {[
                                { key: 'podaci', icon: '📋', label: t('podaci') },
                                { key: 'servis', icon: '🔧', label: t('servisniZapisnici') },
                            ].map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                                    padding: '9px 20px', border: 'none', cursor: 'pointer',
                                    fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontWeight: activeTab === tab.key ? 700 : 500,
                                    background: 'transparent', borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                                    color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                                    marginBottom: -2, transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                    {tab.icon} {tab.label}
                                    {tab.key === 'servis' && serviceLogs.length> 0 && (
                                        <span style={{ marginLeft: 6, background: 'rgba(0,191,166,0.15)', color: 'var(--primary)', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem', fontWeight: 700 }}>
                                            {serviceLogs.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
                            {/* ── TAB: Podaci ── */}
                            {activeTab === 'podaci' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16 }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label" style={{ fontWeight: 700 }}>{t('name')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                        <input className="form-input" value={formData.naziv} onChange={e => updateField('naziv', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('proizvoac')}</label>
                                        <input className="form-input" value={formData.proizvodjac} onChange={e => updateField('proizvodjac', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('vrsta')}</label>
                                        <select className="form-select" value={formData.vrsta} onChange={e => updateField('vrsta', e.target.value)}>
                                            <option value="">-</option>
                                            {equipmentTypes.map(et => <option key={et.id} value={et.naziv}>{et.naziv}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('tipmodel')}</label>
                                        <input className="form-input" value={formData.tip} onChange={e => updateField('tip', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('tvBroj')}</label>
                                        <input className="form-input" value={formData.tvBroj} onChange={e => updateField('tvBroj', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('invBroj')}</label>
                                        <input className="form-input" value={formData.invBroj} onChange={e => updateField('invBroj', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('godinaProizvodnje')}</label>
                                        <input className="form-input" value={formData.godinaProizvodnje} onChange={e => updateField('godinaProizvodnje', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('orgUnit')}</label>
                                        <select className="form-select" value={formData.orgJedinicaId} onChange={e => updateField('orgJedinicaId', e.target.value)}>
                                            <option value="">-</option>
                                            {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('zaduzenaOsoba')}</label>
                                        <input className="form-input" list="workerNames" value={formData.zaduzenOsoba || ''} onChange={e => updateField('zaduzenOsoba', e.target.value)} placeholder={t('imeIPrezime')} />
                                        <datalist id="workerNames">
                                            {workers.filter(w => w.aktivan !== false).map(w => (
                                                <option key={w.id} value={`${w.ime} ${w.prezime}`} />
                                            ))}
                                        </datalist>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('datumUpisa')}</label>
                                        <DateInput value={formData.datumUpisa} onChange={v => updateField('datumUpisa', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('uPrimjeniOd')}</label>
                                        <DateInput value={formData.uPrimjeniOd} onChange={v => updateField('uPrimjeniOd', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('izvanUpotrebeOd')}</label>
                                        <DateInput value={formData.izvanUpotrebeOd} onChange={v => updateField('izvanUpotrebeOd', v)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('evidenceNumber')}</label>
                                        <input className="form-input" value={formData.evidencijskiBroj} onChange={e => updateField('evidencijskiBroj', e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('brojMjernihMjesta')}</label>
                                        <input className="form-input" type="number" value={formData.brojMjernihMjesta} onChange={e => updateField('brojMjernihMjesta', Number(e.target.value))} />
                                    </div>
                                    <div className="form-group" style={{ background: 'rgba(0,191,166,0.04)', borderRadius: 8, padding: 12, border: '1px solid rgba(0,191,166,0.15)' }}>
                                        <label className="form-label" style={{ color: 'var(--primary)' }}>🕐 {t('posljednjiPregled')}</label>
                                        <DateInput value={formData.posljednji} onChange={v => updateField('posljednji', v)} />
                                    </div>
                                    <div className="form-group" style={{ background: 'rgba(0,191,166,0.04)', borderRadius: 8, padding: 12, border: '1px solid rgba(0,191,166,0.15)' }}>
                                        <label className="form-label" style={{ color: 'var(--primary)' }}>📅 {t('iduciPregled')}</label>
                                        <DateInput value={formData.iduci} onChange={v => updateField('iduci', v)} />
                                    </div>
                                </div>
                            )}

                            {/* ── TAB: Servisni zapisnici ── */}
                            {activeTab === 'servis' && (
                                <div style={{ paddingTop: 16 }}>
                                    {!editingId && (
                                        <div style={{ padding: '20px', background: 'rgba(255,152,0,0.06)', borderRadius: 8, border: '1px solid rgba(255,152,0,0.2)', marginBottom: 16, fontSize: '0.85rem', color: 'var(--warning)' }}>
                                            ⚠️ {t('najprijeSacuvajteOpremuDaBiste')}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
                                        <button className="btn btn-primary btn-sm" onClick={handleNewService} disabled={!editingId} title={t('dodajNoviServisniZapisnik')}>
                                            + {t('dodajZapisnik')}
                                        </button>
                                        {serviceLogs.length> 0 && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {serviceLogs.length} {t('zapisa1')}
                                            </span>
                                        )}
                                    </div>

                                    {serviceLogs.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔧</div>
                                            <div>{t('nemaServisnihZapisa')}</div>
                                            <div style={{ fontSize: '0.8rem', marginTop: 6 }}>
                                                {t('dodajteServisniZapisSDatumom')}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {serviceLogs.map(log => (
                                                <div key={log.id} style={{
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 10,
                                                    padding: '14px 16px',
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr 1fr auto',
                                                    gap: 12,
                                                    alignItems: 'start',
                                                }}>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                                                            {tipLabel(log.tip)}
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                            📅 {formatDate(log.datum)}
                                                            {log.servisirao && <span style={{ marginLeft: 10 }}>👤 {log.servisirao}</span>}
                                                        </div>
                                                        {log.iduciServis && (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: 4 }}>
                                                                ⏭ {t('iduci')}: {formatDate(log.iduciServis)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        {log.napomena && (
                                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                                                                "{log.napomena}"
                                                            </div>
                                                        )}
                                                        {log.docName && (
                                                            <button onClick={() => openDocInTab(log)} title={t('klikniteZaPregledDokumentaU')} style={{
                                                                marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.2)',
                                                                borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--info)',
                                                                textDecoration: 'underline',
                                                            }}>
                                                                📎 {log.docName}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleEditService(log)} title={t('urediServisniZapisnik')}>✏️</button>
                                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteService(log.id)} title={t('obrisiServisniZapisnik')}>🗑️</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{ marginTop: 'auto' }}>
                            <button className="btn btn-ghost" onClick={handleCancel}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Service Entry Form Modal ── */}
            {showServiceForm && (
                <div className="modal-overlay" onClick={() => setShowServiceForm(false)}>
                    <div className="modal" style={{ maxWidth: 560, zIndex: 1100 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🔧 {editingServiceId ? (t('urediServisniZapis')) : (t('noviServisniZapis'))}</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowServiceForm(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid-2">
                                <div className="form-group">
                                    <label className="form-label" style={{ fontWeight: 700 }}>📅 {t('datumServisa')} <span style={{ color: 'var(--danger)' }}>*</span></label>
                                    <DateInput value={serviceFormData.datum} onChange={v => setServiceFormData(p => ({ ...p, datum: v }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('tipServisa')}</label>
                                    <select className="form-select" value={serviceFormData.tip} onChange={e => setServiceFormData(p => ({ ...p, tip: e.target.value }))}>
                                        <option value="pregled">{t('pregled')}</option>
                                        <option value="servis">{t('servis')}</option>
                                        <option value="popravak">{t('popravak')}</option>
                                        <option value="kalibracija">{t('kalibracija')}</option>
                                        <option value="zamjena">{t('zamjenaDijela')}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">👤 {t('servisiraoOvlastenaFirma')}</label>
                                    <input className="form-input" value={serviceFormData.servisirao} onChange={e => setServiceFormData(p => ({ ...p, servisirao: e.target.value }))} placeholder={t('imeIliNazivFirme')} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">📅 {t('iduciServis')}</label>
                                    <DateInput value={serviceFormData.iduciServis} onChange={v => setServiceFormData(p => ({ ...p, iduciServis: v }))} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">📝 {t('napomenaOpisRadova')}</label>
                                    <textarea className="form-textarea" rows={3} value={serviceFormData.napomena} onChange={e => setServiceFormData(p => ({ ...p, napomena: e.target.value }))} placeholder={t('opisObavljenihRadovaZamijenjeniDijelovi')} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">📎 {t('prilogDokazServisaMaks2mb')}</label>
                                    {serviceFormData.docName ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--info)' }}>📎 {serviceFormData.docName}</span>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setServiceFormData(p => ({ ...p, docName: '', docData: '' }))} style={{ marginLeft: 'auto', color: 'var(--danger)' }}>✕ {t('ukloni')}</button>
                                        </div>
                                    ) : (
                                        <div onClick={() => serviceDocRef.current?.click()} style={{
                                            border: '2px dashed var(--border)', borderRadius: 8, padding: '16px',
                                            textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)',
                                            transition: 'all 0.15s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                                            📂 {t('klikniteZaUploadDokumentaPdf')}
                                        </div>
                                    )}
                                    <input ref={serviceDocRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
                                </div>
                            </div>
                            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(0,191,166,0.04)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                💡 {t('datumPosljednjegIIducegPregleda')}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowServiceForm(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSaveService}>💾 {t('save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Equipment List ── */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew} title={t('dodajNovuOpremu')}>+ {t('novaOprema')}</button>
                        <div className="search-bar" style={{ flexShrink: 0, height: 38, border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', width: 220, display: 'flex', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', marginRight: 8 }}>🔍</span>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                            {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }} title={t('ponistiPretragu')}>✕</button>}
                        </div>
                        <PDFExportButton title={t('prikaziPdfIzvjestaje')} buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }} options={[
                            { label: t('svaOprema'), icon: '⚙️', onClick: () => generateEquipmentReport(sortedEquipment.map(eq => eq.id), lang) },
                            ...(selectedIds.size> 0 ? [{ label: `${t('odabrano1')} (${selectedIds.size})`, icon: '✓', onClick: () => generateEquipmentReport(sortedEquipment.filter(eq => selectedIds.has(eq.id)).map(eq => eq.id), lang) }] : []),
                        ]} />
                        <PDFExportButton label={t('qrKod')} buttonStyle={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', height: 38 }} options={[
                            { label: t('sviKodovi'), icon: '🖨️', onClick: () => { setPrintSelection(sortedEquipment); setShowPrintModal(true); } },
                            ...(selectedIds.size> 0 ? [{ label: `${t('odabrani')} (${selectedIds.size})`, icon: '✓', onClick: () => { setPrintSelection(sortedEquipment.filter(eq => selectedIds.has(eq.id))); setShowPrintModal(true); } }] : []),
                        ]} />
                        <SavedFlash />
                        <select className="form-select" style={{ height: 38, padding: '0 12px', minWidth: 160, width: 'auto', fontSize: '0.85rem' }}  title={t('filtrirajPoOdjelu')} value={filterOrgUnit} onChange={e => setFilterOrgUnit(e.target.value)}>
                            <option value="">{t('sviOdjeliSektori')}</option>
                            {orgUnits.map(ou => <option key={ou.id} value={ou.id}>{ou.naziv}</option>)}
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={showOutOfUse} onChange={e => setShowOutOfUse(e.target.checked)} />
                            {t('radnaOpremaIzvanUpotrebe')}
                        </label>
                        {selectedIds.size> 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selectedIds.size} {t('odabrano')} &mdash; Grupne akcije:
                                </span>
                                <button className="btn btn-primary btn-sm" onClick={() => { setPrintSelection(sortedEquipment.filter(eq => selectedIds.has(eq.id))); setShowPrintModal(true); }} title={t('isprintajQrKodoveZaOdabrano')}>🖨️ {t('isprintajQr')}</button>
                                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} title={t('obrisiOdabranuOpremu')}>🗑️ {t('obrisi')}</button>
                            </div>
                        )}
                    </div>
                    <div className="data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                                    <th style={{ width: 100 }}>{t('actions')}</th>
                                    <th onClick={() => toggleSort('vrsta')} style={thStyle('vrsta')}>{t('vrsta')}{sortIcon('vrsta')}</th>
                                    <th onClick={() => toggleSort('naziv')} style={thStyle('naziv')}>{t('name')}{sortIcon('naziv')}</th>
                                    <th onClick={() => toggleSort('tvBroj')} style={thStyle('tvBroj')}>{t('tvBroj')}{sortIcon('tvBroj')}</th>
                                    <th onClick={() => toggleSort('invBroj')} style={thStyle('invBroj')}>{t('invBroj')}{sortIcon('invBroj')}</th>
                                    <th onClick={() => toggleSort('orgName')} style={thStyle('orgName')}>{t('organizacija')}{sortIcon('orgName')}</th>
                                    <th onClick={() => toggleSort('posljednji')} style={thStyle('posljednji')}>{t('posljednji')}{sortIcon('posljednji')}</th>
                                    <th onClick={() => toggleSort('iduci')} style={thStyle('iduci')}>{t('iduci')}{sortIcon('iduci')}</th>
                                    <th style={{ width: 60 }}>{t('zapisi')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEquipment.length === 0 ? (
                                    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                ) : pagedEquipment.map((eq) => {
                                    const isExpired = eq.iduci && new Date(eq.iduci) < new Date();
                                    const serviceLogsForEq = getAll(COLLECTIONS.SERVICE_LOG).filter(l => l.equipmentId === eq.id);
                                    const logCount = serviceLogsForEq.length;
                                    const docLog = [...serviceLogsForEq].sort((a,b) => new Date(b.datum) - new Date(a.datum)).find(l => l.docData);

                                    return (
                                        <tr key={eq.id} onClick={() => handleEdit(eq, 'podaci')} style={{ background: lastEditedId === eq.id ? 'rgba(102,126,234,0.15)' : undefined, transition: 'background 0.5s ease', cursor: 'pointer' }}>
                                            <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(eq.id)} onChange={() => toggleOne(eq.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} /></td>
                                            <td onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                                                <button className="btn btn-primary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={e => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const spaceBelow = window.innerHeight - rect.bottom;
                                                    const spaceAbove = rect.top;
                                                    const flipUp = spaceBelow < 280 && spaceAbove> spaceBelow;
                                                    setMenuPos(flipUp
                                                        ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                                                        : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                                                    );
                                                    setActionMenuId(actionMenuId === eq.id ? null : eq.id);
                                                }} title={t('prikaziAkcijeZaOpremu')}>
                                                    {t('actions')} ▼
                                                </button>
                                                {actionMenuId === eq.id && (
                                                    <>
                                                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setActionMenuId(null)} />
                                                    <div data-menu onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                                        <button onClick={() => handleEdit(eq, 'podaci')} className="dropdown-item">📂 {t('open')}</button>
                                                        <button onClick={() => handleEdit(eq, 'servis')} className="dropdown-item">🔧 {t('serviceRecords')}</button>
                                                        <button onClick={() => { setActionMenuId(null); setPrintSelection([eq]); setShowPrintModal(true); }} className="dropdown-item">🖨️ {t('printajQrKod')}</button>
                                                        {docLog && (
                                                            <>
                                                                <button onClick={() => downloadDoc(docLog)} className="dropdown-item">📎 {t('preuzmiZapisnik')}</button>
                                                                <button onClick={() => openDocInTab(docLog)} className="dropdown-item">🖨️ {t('isprintaj')}</button>
                                                            </>
                                                        )}
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => handleCopy(eq)} className="dropdown-item">📋 {t('kopiraj')}</button>
                                                        <button onClick={() => handlePrintSingle(eq)} className="dropdown-item">🖨️ {t('isprintajPodatke')}</button>
                                                        <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                        <button onClick={() => { setActionMenuId(null); handleDelete(eq.id); }} className="dropdown-item text-danger">🗑️ {t('delete')}</button>
                                                    </div>
                                                    </>
                                                )}
                                            </td>
                                            <td>{eq.vrsta}</td>
                                            <td style={{ fontWeight: 600 }}>{eq.naziv}</td>
                                            <td><code>{eq.tvBroj}</code></td>
                                            <td>{eq.invBroj}</td>
                                            <td>{eq.orgName}</td>
                                            <td>{formatDate(eq.posljednji)}</td>
                                            <td style={{ color: isExpired ? 'var(--danger)' : undefined, fontWeight: isExpired ? 700 : undefined }}>
                                                {formatDate(eq.iduci)} {isExpired && '⚠️'}
                                            </td>
                                            <td onClick={e => e.stopPropagation()}>
                                                {logCount> 0 ? (
                                                    <button
                                                        onClick={() => handleEdit(eq, 'servis')}
                                                        style={{ background: 'rgba(0,191,166,0.12)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                                        
                                                        
                                                        title={t('otvoriServisneZapisnike')}>
                                                        🔧 {logCount}
                                                    </button>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <Pagination 
                        page={page} 
                        perPage={perPage} 
                        totalPages={totalPages} 
                        totalItems={filtered.length} 
                        setPage={setPage} 
                        setPerPage={setPerPage} 
                        prevPage={prevPage} 
                        nextPage={nextPage} 
                        onPerPageChangeExtra={() => setSelectedIds(new Set())} 
                    />
                </div>
            </div>
            <DialogRenderer />
        </div>
    );
}

export default function EquipmentPage() {
    return (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Učitavanje...</div>}>
            <EquipmentPageInner />
        </Suspense>
    );
}
