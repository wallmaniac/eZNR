'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
    getAll, getById, create, update, COLLECTIONS,
} from '@/lib/dataStore';
import { uploadSecureFile } from '@/lib/storageService';
import { useDialog } from '@/hooks/useDialog';
import { printZosPdf } from '@/lib/zosPdfGenerator';
import HelpTip from '@/components/HelpTip';
import { useCountry } from '@/contexts/CountryContext';
import PageHeader from '@/components/PageHeader';
import TabBar from '@/components/TabBar';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

const DEFAULT_CERT_TYPES = [
    'Koordinatora ZNR tijekom građenja',
    'Koordinatora ZNR tijekom izrade projekta',
    'Povremena provjera znanja radnika iz zaštite na radu',
    'Stručnjak ZNR - opći dio',
    'Stručnjak ZNR - opći i posebni dio',
    'Stručnjak ZNR - posebni dio',
    'Usavršavanje stručnjaka ZNR',
    'Uvjerenje o osposobljenosti za pružanje prve pomoći',
    'Uvjerenje o zdravstvenoj sposobnosti radnika',
    'Zapisnik o ocjeni osposobljenosti radnika za rad na siguran način',
    'PP - Osposobljenost za gašenje požara',
    'Licenca / Certifikat',
];
const FILE_TYPE_OPTIONS = ['Sken', 'Original', 'Kopija', 'Email potvrda', 'Digitalni dokument'];

function EditCertPageInner() {
    const { t, lang } = useLanguage();
    const country = useCountry();
    const { activeCompanyId } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const certId = params?.id;
    const returnTo = searchParams?.get('returnTo');

    const [cert, setCert] = useState(null);
    const [worker, setWorker] = useState(null);
    const [examiners, setExaminers] = useState([]);
    const [certTypes, setCertTypes] = useState([]);
    const [authorizedCompanies, setAuthorizedCompanies] = useState([]);
    const [formData, setFormData] = useState(null);
    const [tipSearch, setTipSearch] = useState('');
    const [showTipDropdown, setShowTipDropdown] = useState(false);
    const [ispitivacSearch, setIspitivacSearch] = useState('');
    const [showIspitivacDropdown, setShowIspitivacDropdown] = useState(false);
    const [showNewTypeForm, setShowNewTypeForm] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const tipRef = useRef(null);
    const ispitivacRef = useRef(null);
    const [activeTab, setActiveTab] = useState(searchParams?.get('tab') || 'podaci');

    const { markDirty, markClean } = useUnsavedChanges();
    const set = (k, v) => { setFormData(f => ({ ...f, [k]: v })); markDirty(); };
    const { alert: dlgAlert, DialogRenderer } = useDialog();
    const isSavingRef = useRef(false); // prevent duplicate submissions

    const load = useCallback(() => {
        const c = getById(COLLECTIONS.CERTIFICATES, certId);
        if (!c) { router.back(); return; }
        setCert(c);
        // Migrate legacy single-file to attachments array
        const data = { ...c };
        if (!data.attachments) {
            data.attachments = [];
            if (data.attachedFileUrl || data.attachedFileData) {
                data.attachments.push({
                    id: 'legacy_' + Date.now(),
                    url: data.attachedFileUrl || null,
                    data: data.attachedFileData || null,
                    name: data.attachedFileName || 'document',
                    size: data.attachedFileSize || 0,
                    type: data.attachedFileType || '',
                    opis: data.fileOpis || '',
                    vrsta: data.vrstaDateotekeId || '',
                });
            }
        }
        setFormData(data);
        if (c.workerId) {
            const w = getById(COLLECTIONS.WORKERS, c.workerId);
            setWorker(w);
        }
        setExaminers(getAll(COLLECTIONS.EXAMINERS));
        setAuthorizedCompanies(getAll(COLLECTIONS.AUTHORIZED_COMPANIES));
        const stored = getAll(COLLECTIONS.CERT_TYPES);
        const storedNames = stored.map(x => x.naziv);
        setCertTypes([
            ...stored,
            ...DEFAULT_CERT_TYPES.filter(n => !storedNames.includes(n)).map(n => ({ id: `default_${n}`, naziv: n })),
        ]);
    }, [certId, router]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const h = (e) => {
            if (tipRef.current && !tipRef.current.contains(e.target)) setShowTipDropdown(false);
            if (ispitivacRef.current && !ispitivacRef.current.contains(e.target)) setShowIspitivacDropdown(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    if (!formData) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{t('ucitavanje')}...</div>;

    const getExaminerLabel = (ex) => {
        const company = authorizedCompanies.find(c => c.id === ex.ovlaštenaTvrtkaId);
        return `${ex.ime}${company ? ` (${company.naziv})` : ''}`;
    };

    const handleAddNewType = () => {
        if (!newTypeName.trim()) return;
        const existing = certTypes.find(ct => ct.naziv.toLowerCase() === newTypeName.trim().toLowerCase());
        if (!existing) {
            const created = create(COLLECTIONS.CERT_TYPES, { naziv: newTypeName.trim() });
            setCertTypes(prev => [...prev, created]);
            set('tipUvjerenjaId', created.id); set('tipUvjerenjaIme', created.naziv);
        } else {
            set('tipUvjerenjaId', existing.id); set('tipUvjerenjaIme', existing.naziv);
        }
        setShowNewTypeForm(false); setNewTypeName(''); setShowTipDropdown(false);
    };

    const handleSave = async () => {
        if (isSavingRef.current) return;
        if (!formData.tipUvjerenjaIme && !formData.tipUvjerenjaId && !formData.ime) {
            await dlgAlert(t('tipUvjerenjaJeObavezan'));
            return;
        }
        isSavingRef.current = true;
        try {
            // Sync first attachment back to legacy fields for backward compat with archive
            const first = (formData.attachments || [])[0];
            const saveData = {
                ...formData,
                ime: formData.tipUvjerenjaIme || formData.ime,
                sposobnost: formData.sposoban ? 'Sposoban' : 'Nesposoban',
                attachedFileUrl: first?.url || null,
                attachedFileData: first?.data || null,
                attachedFileName: first?.name || '',
                attachedFileSize: first?.size || 0,
                attachedFileType: first?.type || '',
                fileOpis: first?.opis || '',
                vrstaDateotekeId: first?.vrsta || '',
            };
            update(COLLECTIONS.CERTIFICATES, certId, saveData);
            // Toast feedback (non-blocking)
            markClean();
            if (typeof window !== 'undefined' && window.eznrToast) {
                window.eznrToast(t('uvjerenjeSacuvano'), 'success');
            }
            if (returnTo) {
                router.replace(decodeURIComponent(returnTo));
            } else {
                router.replace('/dashboard/worker-certificates');
            }
        } finally {
            isSavingRef.current = false;
        }
    };

    const labelStyle = {
        display: 'inline-block', fontSize: '0.72rem', fontWeight: 700,
        color: 'white', background: '#455a64', padding: '2px 8px',
        borderRadius: 3, marginBottom: 4,
    };

    const filteredTips = certTypes.filter(ct => !tipSearch || ct.naziv.toLowerCase().includes(tipSearch.toLowerCase()));
    const filteredIspitivac = examiners.filter(ex => !ispitivacSearch || getExaminerLabel(ex).toLowerCase().includes(ispitivacSearch.toLowerCase()));

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button className="btn btn-ghost" onClick={() => { if (returnTo) router.push(returnTo); else router.back(); }}>←</button>
                <div>
                    <h1 style={{ margin: 0 }}>✏️ {t('urediUvjerenje')}</h1>
                    {worker && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            👤 {worker.ime} {worker.prezime}
                            {worker.evidencijskiBroj ? ` · Ev.br: ${worker.evidencijskiBroj}` : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Form */}
            <div className="card">
                <div className="card-body">
                    {/* Tab Bar */}
                    <div style={{ marginBottom: 20 }}>
                        <TabBar active={activeTab} onChange={setActiveTab} 
                            tabs={[
                                { key: 'podaci', icon: '📝', label: t('podaci') },
                                { key: 'dokumenti', icon: '📁', label: `${t('dokumenti1')} (${(formData.attachments || []).length})` },
                            ]} 
                        />
                    </div>

                    {activeTab === 'podaci' && (<>

                    {/* Row 1: Oznaka | Tip uvjerenja | Sposoban */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, marginBottom: 16, alignItems: 'start' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>Oznaka</div>
                            <input className="form-input" value={formData.oznaka || ''} onChange={e => set('oznaka', e.target.value)}
                                placeholder={t('sifraReferentniBroj')} />
                        </div>

                        {/* Tip uvjerenja */}
                        <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={tipRef}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <div style={{...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 4}}>{t('tipUvjerenja')} * <HelpTip text="Ukoliko radnik polaže i teoretski i praktični dio, oba moraju biti unesena unutar istog tipa uvjerenja ili odvojeno." /></div>
                                <button className="btn btn-ghost btn-sm"
                                style={{ width: 22, height: 22, borderRadius: '50%', padding: 0, fontSize: '1.2rem', paddingBottom: 2, lineHeight: 0, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
                                    onClick={() => setShowNewTypeForm(true)} title={t('dodajNoviTip')}>+</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', padding: '0 8px', minHeight: 38, cursor: 'pointer' }}
                                onClick={() => setShowTipDropdown(v => !v)}>
                                <span style={{ flex: 1, fontSize: '0.88rem', color: formData.tipUvjerenjaIme ? 'var(--text)' : 'var(--text-muted)' }}>
                                    {formData.tipUvjerenjaIme || formData.ime || (t('odaberiteTip'))}
                                </span>
                                {formData.tipUvjerenjaIme && (
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0 2px' }}
                                        onClick={e => { e.stopPropagation(); set('tipUvjerenjaIme', ''); set('tipUvjerenjaId', ''); setTipSearch(''); }}>×</button>
                                )}
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>▾</span>
                            </div>
                            {showTipDropdown && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, maxHeight: 260, overflowY: 'auto' }}>
                                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                                        <input className="form-input" style={{ padding: '4px 8px', fontSize: '0.85rem' }} placeholder="🔍 Pretraži..."
                                            value={tipSearch} onChange={e => setTipSearch(e.target.value)} autoFocus onClick={e => e.stopPropagation()} />
                                    </div>
                                    {filteredTips.map(ct => (
                                        <div key={ct.id}
                                            onClick={() => { set('tipUvjerenjaId', ct.id); set('tipUvjerenjaIme', ct.naziv); setShowTipDropdown(false); setTipSearch(''); }}
                                            style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.86rem', background: formData.tipUvjerenjaId === ct.id ? 'var(--primary)' : undefined, color: formData.tipUvjerenjaId === ct.id ? 'white' : undefined }}>
                                            {t(ct.naziv?.trim()) || ct.naziv}
                                        </div>
                                    ))}
                                    {filteredTips.length === 0 && <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('nemaRezultata')}</div>}
                                    <div
                                        onClick={() => { setShowTipDropdown(false); setShowNewTypeForm(true); setTipSearch(''); }}
                                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.86rem', borderTop: '1px solid var(--border-light)', fontWeight: 600, color: 'var(--primary)' }}>
                                        + {t('ostalo1')}
                                    </div>
                                </div>
                            )}
                            {showNewTypeForm && (
                                <div style={{ marginTop: 8, padding: 10, background: 'var(--bg-input)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input className="form-input" style={{ flex: 1, fontSize: '0.85rem' }} placeholder={t('nazivNovogTipa')}
                                        value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddNewType(); if (e.key === 'Escape') { setShowNewTypeForm(false); setNewTypeName(''); } }} autoFocus />
                                    <button className="btn btn-primary btn-sm" onClick={handleAddNewType}>{t('dodaj')}</button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowNewTypeForm(false); setNewTypeName(''); }}>✕</button>
                                </div>
                            )}
                        </div>

                        {/* Sposoban */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{t('sposobannesposoban')}</div>
                            <div style={{ paddingTop: 6 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input type="checkbox" checked={formData.sposoban ?? formData.sposobnost !== 'Nesposoban'} onChange={e => set('sposoban', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                                    {(formData.sposoban ?? formData.sposobnost !== 'Nesposoban')
                                        ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ {t('sposoban')}</span>
                                        : <span style={{ color: 'var(--danger)', fontWeight: 600 }}>✗ {t('nesposoban')}</span>}
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Datum | Vrijedi do */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={{...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 4}}>{t('datum')} <HelpTip text="Datum donošenja zapisnika/ljekarskog nalaza" /></div>
                            <DateInput value={formData.datum || ''} onChange={v => set('datum', v)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={{...labelStyle, display: 'inline-flex', alignItems: 'center', gap: 4}}>{t('vrijediDo')} <HelpTip text={country === 'HR' ? "Zakon o zaštiti na radu nalaže periodičnu obnovu procjene radne sposobnosti ili osposobljavanja u rokovima predviđenima posebnim propisima ili samom procjenom rizika." : "Zakon o zaštiti na radu nalaže obnovu certifikata/pregleda svake 2 ili 3 godine, ovisno o radnom mjestu."} /></div>
                            <DateInput value={formData.vrijediDo || ''} onChange={v => set('vrijediDo', v)} />
                        </div>
                    </div>

                    {/* Row 3: Ispitivač | Stručnjak ZNR */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ marginBottom: 0, position: 'relative' }} ref={ispitivacRef}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <div style={labelStyle}>{t('ispitivac')}</div>
                                <button className="btn btn-ghost btn-sm" style={{ width: 22, height: 22, borderRadius: '50%', padding: 0, fontSize: '1.2rem', paddingBottom: 2, lineHeight: 0, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
                                    onClick={() => router.push('/dashboard/examiners')} title={t('upravljajIspitivacima')}>+</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', padding: '0 8px', minHeight: 38, cursor: 'pointer' }}
                                onClick={() => setShowIspitivacDropdown(v => !v)}>
                                <span style={{ flex: 1, fontSize: '0.88rem', color: formData.ispitivacId ? 'var(--text)' : 'var(--text-muted)' }}>
                                    {formData.ispitivacId ? getExaminerLabel(examiners.find(e => e.id === formData.ispitivacId) || {}) : (t('odaberiteIspitivaca'))}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>▾</span>
                            </div>
                            {showIspitivacDropdown && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, maxHeight: 220, overflowY: 'auto' }}>
                                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                                        <input className="form-input" style={{ padding: '4px 8px', fontSize: '0.85rem' }} placeholder="🔍 Pretraži..."
                                            value={ispitivacSearch} onChange={e => setIspitivacSearch(e.target.value)} autoFocus onClick={e => e.stopPropagation()} />
                                    </div>
                                    {filteredIspitivac.length === 0 ? (
                                        <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('nemaIspitivaca')}</div>
                                    ) : filteredIspitivac.map(ex => (
                                        <div key={ex.id} onClick={() => { set('ispitivacId', ex.id); setShowIspitivacDropdown(false); setIspitivacSearch(''); }}
                                            style={{ padding: '9px 12px', cursor: 'pointer', fontSize: '0.86rem' }}>
                                            {getExaminerLabel(ex)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{t('strucnjakZnr')}</div>
                            <input className="form-input" value={formData.strucnjakZNR || ''} onChange={e => set('strucnjakZNR', e.target.value)} />
                        </div>
                    </div>

                    {/* Row 4: Upisao | Cijena */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{t('upisao')}</div>
                            <input className="form-input" value={formData.upisao || ''} onChange={e => set('upisao', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{t('cijena')}</div>
                            <input className="form-input" type="number" min="0" step="0.01" style={{ textAlign: 'right' }}
                                value={formData.cijena || ''} onChange={e => set('cijena', e.target.value)} placeholder="0,00" />
                        </div>
                    </div>

                    {/* Row 5: Izdano za radno mjesto | Ograničenja */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{t('izdanoZaRadnoMjesto')}</div>
                            <input className="form-input" value={formData.vydanoZaRadnoMjesto || ''} onChange={e => set('vydanoZaRadnoMjesto', e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <div style={labelStyle}>{t('ogranicenjaNapomena')}</div>
                            <textarea className="form-input" rows={3} value={formData.ogranicenja || ''} onChange={e => set('ogranicenja', e.target.value)} style={{ resize: 'vertical' }} />
                        </div>
                    </div>

                    </>)}

                    {activeTab === 'dokumenti' && (<>
                    {/* Attachments — Multi-file */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                📎 {t('attachedFiles').replace('{0}', (formData.attachments || []).length)}
                            </div>
                            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                                + {t('dodajDatoteku')}
                                <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (file.size> 15 * 1024 * 1024) { dlgAlert('Max 15MB!'); return; }
                                        try {
                                            const uploadResult = await uploadSecureFile(activeCompanyId, 'certificates', file);
                                            setFormData(f => ({ ...f, attachments: [...(f.attachments || []), {
                                                id: 'att_' + Date.now(),
                                                url: uploadResult.url,
                                                name: file.name,
                                                size: file.size,
                                                type: file.type,
                                                opis: '',
                                                vrsta: '',
                                            }] }));
                                        } catch (err) {
                                            dlgAlert('Upload failed: ' + err.message);
                                        }
                                        e.target.value = '';
                                    }} />
                            </label>
                        </div>
                        {(formData.attachments || []).length === 0 ? (
                            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                                📄 {t('nemaPrilozenihDatotekaKlikniteDodaj')}
                            </div>
                        ) : (formData.attachments || []).map((att, idx) => (
                            <div key={att.id} style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.25)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <span style={{ fontSize: '1.4rem' }}>{att.name?.endsWith('.pdf') ? '📕' : '🖼️'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{att.size ? `${(att.size / 1024).toFixed(1)} KB` : ''}</div>
                                </div>
                                <select className="form-select" style={{ width: 120, fontSize: '0.75rem', padding: '2px 6px', height: 28 }}
                                    value={att.vrsta || ''} onClick={e => e.stopPropagation()}
                                    onChange={e => { const v = e.target.value; setFormData(f => { const a = [...(f.attachments || [])]; a[idx] = { ...a[idx], vrsta: v }; return { ...f, attachments: a }; }); }}>
                                    <option value="">{t('vrsta1')}</option>
                                    {FILE_TYPE_OPTIONS.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                                </select>
                                <button className="btn btn-ghost btn-sm btn-icon" title={t('otvori')}
                                    onClick={() => { const src = att.url || att.data; if (src?.startsWith('http')) window.open(src, '_blank'); else if (src) { const w = window.open('', '_blank'); w.document.write(src.includes('pdf') ? `<embed src="${src}" width="100%" height="100%" type="application/pdf" />` : `<img src="${src}" style="max-width:100%;margin:20px auto;display:block;" />`); w.document.close(); } }}>👁️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" title={t('preuzmi')}
                                    onClick={() => { const a = document.createElement('a'); a.href = att.url || att.data; a.download = att.name; if (att.url) a.target = '_blank'; a.click(); }}>⬇️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={t('ukloni')}
                                    onClick={() => setFormData(f => ({ ...f, attachments: (f.attachments || []).filter((_, i) => i !== idx) }))}>✕</button>
                            </div>
                        ))}
                        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(33,150,243,0.06)', border: '1px solid rgba(33,150,243,0.2)', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                            💡 {t('prilozeneDatotekeSeAutomatskiPojavljuju')}
                        </div>
                    </div>
                    </>)}

                    <div className="scrollable-toolbar" style={{ padding: 0, gap: 10 }}>
                        <button className="btn btn-primary" onClick={handleSave}>
                            💾 {t('save')}
                        </button>
                        <button className="btn btn-ghost" onClick={() => { if (returnTo) router.push(returnTo); else router.back(); }}>
                            ↩ {t('cancel')}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => {
                            const url = `/dashboard/worker-certificates/create?workerId=${cert?.workerId || ''}&copyFrom=${certId}${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`;
                            router.push(url);
                        }}>
                            📋 {t('kopiraj')}
                        </button>
                        {(formData.tipUvjerenjaIme || formData.ime || '').toLowerCase().includes('zapisnik o ocjeni osposobljenosti') && worker && (
                            <button className="btn btn-outline btn-sm" onClick={() => {
                                const wps = getAll(COLLECTIONS.WORKPLACES);
                                const wpN = wps.find(wp => wp.id === worker.radnoMjestoId)?.naziv || formData.vydanoZaRadnoMjesto || formData.izdanoZaRadnoMjesto || '';
                                const companyFull = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
                                printZosPdf({
                                    company: companyFull,
                                    worker,
                                    workplaceName: wpN,
                                    training: { naziv: formData.izdanoIzObuke || formData.tipUvjerenjaIme || formData.ime },
                                    officer: formData.strucnjakZNR || formData.upisao || '',
                                    date: formData.datum || new Date().toISOString(),
                                    certOznaka: formData.oznaka,
                                    testResult: formData.rezultatTesta || '',
                                }, lang);
                            }}>
                                🖨️ {t('ispisiZos')}
                            </button>
                        )}
                        {worker && (
                            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}
                                onClick={() => router.push(`/dashboard/workers?openWorker=${worker.id}&section=uvjerenja`)}>
                                👤 {t('otvoriRadnika')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function EditCertPage() {
    return (
        <Suspense fallback={null}>
            <EditCertPageInner />
        </Suspense>
    );
}
