'use client';
import TabBar from '@/components/TabBar';
import DateInput from '@/components/DateInput';
import Icon3D from '@/components/Icon3D';
import { fmtDate } from '@/lib/dateUtils';
import { uploadSecureFile } from '@/lib/storageService';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { TimePicker, StazPicker } from '@/components/forms/WorkerFormFields';
import {
    getAll, getById, update, create, remove, COLLECTIONS,
    getWorkerCertificates, getWorkerPPE, formatDate, todayISO, getActiveCompanyId, getWorkplaceName,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { logPPEAssigned } from '@/lib/activityLog';
import { useAuth } from '@/contexts/AuthContext';

/* ── Stable sub-components (defined outside to avoid recreating on every render) ── */

const labelStyle = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 };
const valueStyle = { fontSize: '0.88rem', color: 'var(--text)', fontWeight: 500 };

function ModalField({ label, field, type = 'text', opts = null, editMode, formData, set, lang }) {
    const { t } = useLanguage();
    return (
        <div className="form-group" style={{ marginBottom: 12 }}>
            <div style={labelStyle}>{label}</div>
            {editMode ? (
                opts ? (
                    <select className="form-select" value={formData[field] || ''} onChange={e => set(field, e.target.value)}>
                        <option value="">-</option>
                        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                ) : type === 'checkbox' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 6 }}>
                        <input type="checkbox" checked={!!formData[field]} onChange={e => set(field, e.target.checked)} />
                        {t('da')}
                    </label>
                ) : type === 'date' ? (
                    <DateInput value={formData[field] || ''} onChange={v => set(field, v)} />
                ) : (
                    <input className="form-input" type={type} value={formData[field] || ''} onChange={e => set(field, type === 'number' ? Number(e.target.value) : e.target.value)} />
                )
            ) : (
                <div style={valueStyle}>{
                    type === 'checkbox' ? (formData[field] ? (t('da')) : (t('ne')))
                        : opts ? (opts.find(o => o.value === formData[field])?.label || '—')
                        : type === 'date' ? (fmtDate(formData[field]) || '—')
                        : (formData[field] || '—')
                }</div>
            )}
        </div>
    );
}

function ModalSection({ title, action, children }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
                    {title}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

/**
 * WorkerProfileModal
 * Props:
 *   workerId  — string ID of the worker to show
 *   onClose   — () => void
 *   onSaved   — optional () => void called after save
 */
export default function WorkerProfileModal({ workerId, onClose, onSaved, onOpenFull, initialTab }) {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();

    const [worker, setWorker] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState(null);
    const [orgUnits, setOrgUnits] = useState([]);
    const [workplaces, setWorkplaces] = useState([]);
    const [places, setPlaces] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [ppeAssign, setPpeAssign] = useState([]);
    const [medExams, setMedExams] = useState([]);

    // Certificate inline form
    const [showCertForm, setShowCertForm] = useState(false);
    const [certFormData, setCertFormData] = useState({});
    const [certEditId, setCertEditId] = useState(null);

    // PPE inline form
    const [showPpeForm, setShowPpeForm] = useState(false);
    const [ppeFormData, setPpeFormData] = useState({});
    const [ppeEditId, setPpeEditId] = useState(null);
    const [activeTab, setActiveTab] = useState(initialTab || 'osnovno');
    const { activeCompanyId } = useAuth();

    const refreshCerts = () => setCertificates(getWorkerCertificates(workerId));
    const refreshPpe = () => setPpeAssign(getWorkerPPE(workerId));
    const refreshMed = () => setMedExams(getAll(COLLECTIONS.MEDICAL_EXAMS).filter(e => e.workerId === workerId));

    useEffect(() => {
        if (!workerId) return;
        const w = getById(COLLECTIONS.WORKERS, workerId);
        if (!w) return;
        setWorker(w);
        setFormData({ ...w });
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        setPlaces(getAll(COLLECTIONS.PLACES) || []);
        refreshCerts();
        refreshPpe();
        refreshMed();
    }, [workerId]);

    // Auto-calculate Ukupni staž
    useEffect(() => {
        if (!formData) return;
        const { stazDoDolaska, datumZaposlenja, datumOdlaska } = formData;
        if (!datumZaposlenja) return;
        let pg = 0, pm = 0, pd = 0;
        if (stazDoDolaska) {
            const m1 = stazDoDolaska.match(/(\d+)g(\d+)mj(\d+)d/i);
            if (m1) { pg = +m1[1]; pm = +m1[2]; pd = +m1[3]; }
            else { const m2 = (stazDoDolaska+'').replace(/[^0-9]/g, '').match(/^(\d{2})(\d{2})(\d{2})$/); if (m2) { pg = +m2[1]; pm = +m2[2]; pd = +m2[3]; } }
        }
        const start = new Date(datumZaposlenja);
        const end = datumOdlaska ? new Date(datumOdlaska) : new Date();
        if (isNaN(start) || isNaN(end) || end < start) return;
        let yy = end.getFullYear() - start.getFullYear();
        let mm = end.getMonth() - start.getMonth();
        let dd = end.getDate() - start.getDate();
        if (dd < 0) { mm--; dd += 30; }
        if (mm < 0) { yy--; mm += 12; }
        dd += pd; if (dd >= 30) { mm++; dd -= 30; }
        mm += pm; if (mm >= 12) { yy++; mm -= 12; }
        yy += pg;
        setFormData(prev => ({ ...prev, ukupniStaz: `${yy}g${mm}mj${dd}d` }));
    }, [formData?.stazDoDolaska, formData?.datumZaposlenja, formData?.datumOdlaska]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-calculate Životna dob
    useEffect(() => {
        if (!formData?.datumRodenja) return;
        const birth = new Date(formData.datumRodenja);
        if (isNaN(birth)) return;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const mth = today.getMonth() - birth.getMonth();
        if (mth < 0 || (mth === 0 && today.getDate() < birth.getDate())) age--;
        setFormData(prev => ({ ...prev, zivotnaDob: age }));
    }, [formData?.datumRodenja]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!worker || !formData) return null;

    const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        if (!formData.ime || !formData.prezime) {
            await alert(t('imeIPrezimeSuObavezna'));
            return;
        }
        update(COLLECTIONS.WORKERS, workerId, formData);
        setWorker({ ...formData });
        setEditMode(false);
        onSaved?.();
        onClose();
    };

    const handleSaveCert = async () => {
        if (!certFormData.oznaka || !certFormData.ime) {
            await alert(t('oznakaINazivSuObavezni'));
            return;
        }
        if (certEditId) {
            update(COLLECTIONS.CERTIFICATES, certEditId, { ...certFormData, workerId });
        } else {
            create(COLLECTIONS.CERTIFICATES, { ...certFormData, workerId });
        }
        refreshCerts();
        setShowCertForm(false);
        setCertEditId(null);
    };

    const handleSavePpe = async () => {
        if (!ppeFormData.naziv) {
            await alert(t('nazivJeObavezan'));
            return;
        }
        let saved;
        if (ppeEditId) {
            update(COLLECTIONS.PPE_ASSIGNMENTS, ppeEditId, { ...ppeFormData, workerId });
            saved = { ...ppeFormData, workerId, id: ppeEditId };
        } else {
            saved = create(COLLECTIONS.PPE_ASSIGNMENTS, { ...ppeFormData, workerId });
        }
        // Log to activity log
        try { logPPEAssigned(saved, `${worker?.ime || ''} ${worker?.prezime || ''}`.trim(), null); } catch { }
        refreshPpe();
        setShowPpeForm(false);
        setPpeEditId(null);
    };

    const wp = workplaces.find(w => w.id === formData.radnoMjestoId);
    const ou = orgUnits.find(o => o.id === formData.orgJedinicaId);
    const initials = `${worker.ime?.[0] || ''}${worker.prezime?.[0] || ''}`.toUpperCase();

    const isNightShift = (odStr, doStr) => {
        if (!odStr || !doStr) return false;
        const start = parseInt((odStr || '').replace(':', ''));
        const end = parseInt((doStr || '').replace(':', ''));
        if (isNaN(start) || isNaN(end)) return false;
        if (start > end) return true;
        if (start < 600 || end >= 2200) return true;
        return false;
    };

    const openFullEdit = () => {
        if (onOpenFull) {
            onOpenFull();
        } else {
            onClose();
            // Small delay to let onClose state flush (resets openWorkerHandledRef)
            setTimeout(() => router.push(`/dashboard/workers?openWorker=${workerId}`), 50);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 860, height: '88vh', minHeight: 650, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <DialogRenderer />

                {/* ── Header ── */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
                            {initials}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                                {worker.ime} {worker.prezime}
                                {editMode && <span style={{ marginLeft: 10, fontSize: '0.72rem', background: 'rgba(255,200,0,0.2)', color: '#FFD700', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>✏️ {t('ureivanje')}</span>}
                            </h2>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                                {wp?.naziv || '—'} · {ou?.naziv || '—'}
                                {worker.evidencijskiBroj ? ` · Ev.br: ${worker.evidencijskiBroj}` : ''}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {!editMode && (
                            <>
                                <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)} style={{ fontSize: '0.8rem', padding: '6px 12px', height: 32, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    ✏️ {t('uredi')}
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={openFullEdit}
                                    style={{ fontSize: '0.8rem', padding: '6px 12px', height: 32, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Icon3D name="Radnici.png" size={16} />
                                    {t('otvoriPotpuno')}
                                </button>
                            </>
                        )}
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* ── Tab Bar (scrollable on mobile) ── */}
                <div style={{ padding: '0 24px', marginBottom: 20 }}>
                    <TabBar active={activeTab} onChange={setActiveTab} 
                        tabs={[
                            { key: 'osnovno', icon: '👤', label: t('osnovno') },
                            { key: 'uvjerenja', icon: '📜', label: `${t('uvjerenja')} (${certificates.length})` },
                            { key: 'ozo', icon: '🦺', label: `OZO (${ppeAssign.length})` },
                            { key: 'pregledi', icon: '👨‍⚕️', label: `${t('pregledi')} (${medExams.length})` },
                            { key: 'dokumenti', icon: '📁', label: `${t('dokumenti1')} (${(formData.dokumenti || []).length})` },
                        ]} 
                    />
                </div>

                {wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo) && (
                    <div style={{ background: 'rgba(239,83,80,0.15)', borderBottom: '1px solid var(--danger)', color: 'var(--danger)', padding: '8px 24px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🌙 Obavezan ljekarski pregled najmanje 1x u 2 godine (Noćni rad)
                    </div>
                )}

                {/* ── Body ── */}
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

                {activeTab === 'osnovno' && (<>
                    {/* Quick Actions */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', background: 'var(--bg-card)' }}
                            onClick={() => { onClose(); router.push(`/dashboard/medical-exams?openNew=1&workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers')}`); }}>
                            👨‍⚕️ {t('noviPregled')}
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', background: 'var(--bg-card)' }}
                            onClick={() => { onClose(); router.push(`/dashboard/worker-certificates/create?workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers')}`); }}>
                            📄 {t('novoUvjerenje')}
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'var(--bg-card)' }}
                            onClick={() => { onClose(); router.push(`/dashboard/injuries?openNew=1&workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers')}`); }}>
                            🚑 {t('prijaviPovredu')}
                        </button>
                    </div>

                    <ModalSection title={t('osnovno')}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('ime')} field="ime" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('prezime')} field="prezime" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('parentName')} field="imeRoditelja" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label="JMBG" field="jmbg" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label="OIB" field="oib" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('spol')} field="spol"
                                opts={[{ value: 'M', label: t('muski') }, { value: 'Z', label: t('zenski') }]} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('datumRoenja1')} field="datumRodenja" type="date" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('zivotnaDob')} field="zivotnaDob" type="number" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('mjestoRoenja')} field="mjestoRodenja" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('opcinaRoenja')} field="opcinaRodenja" />
                        </div>
                    </ModalSection>

                    <ModalSection title={t('radnoMjesto')}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('workplace')} field="radnoMjestoId"
                                opts={workplaces.map(w => ({ value: w.id, label: w.naziv }))} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('orgUnit')} field="orgJedinicaId"
                                opts={orgUnits.map(o => ({ value: o.id, label: o.naziv }))} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('evBroj')} field="evidencijskiBroj" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('lokacija')} field="lokacija" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('datumZaposlenja')} field="datumZaposlenja" type="date" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('datumOdlaska')} field="datumOdlaska" type="date" />
                            {editMode ? (
                                <StazPicker label={t('stazDoDolaska')} value={formData.stazDoDolaska} onChange={v => set('stazDoDolaska', v)} />
                            ) : (
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{t('stazDoDolaska')}</div>
                                    <div style={valueStyle}>{formData.stazDoDolaska || '—'}</div>
                                </div>
                            )}
                            {editMode ? (
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{t('ukupniStaz')}</div>
                                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-input)', color: formData.ukupniStaz ? 'var(--text)' : 'var(--text-muted)', cursor: 'not-allowed' }}>{formData.ukupniStaz || '—'}</div>
                                </div>
                            ) : (
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{t('ukupniStaz')}</div>
                                    <div style={valueStyle}>{formData.ukupniStaz || '—'}</div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('koeficijent')} field="koef" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('vanjskiSuradnik')} field="vanjskiSuradnik" type="checkbox" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('posebniUvjeti')} field="posebniUvjeti" type="checkbox" />
                        </div>
                        {/* Radno vrijeme */}
                        {editMode ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', marginTop: 12 }}>
                                <TimePicker label={t('radnoVrijemeOd')} value={formData.radnoVrijemeOd} onChange={v => set('radnoVrijemeOd', v)} />
                                <TimePicker label={t('radnoVrijemeDo')} value={formData.radnoVrijemeDo} onChange={v => set('radnoVrijemeDo', v)} />
                            </div>
                        ) : (formData.radnoVrijemeOd || formData.radnoVrijemeDo || (wp && (wp.radnoVrijemeOd || wp.radnoVrijemeDo))) ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', marginTop: 12 }}>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{t('radnoVrijemeOd')}</div>
                                    <div style={valueStyle}>{formData.radnoVrijemeOd || wp?.radnoVrijemeOd || '—'}</div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{t('radnoVrijemeDo')}</div>
                                    <div style={valueStyle}>{formData.radnoVrijemeDo || wp?.radnoVrijemeDo || '—'}</div>
                                </div>
                            </div>
                        ) : null}
                        {((formData.radnoVrijemeOd && formData.radnoVrijemeDo && isNightShift(formData.radnoVrijemeOd, formData.radnoVrijemeDo)) || (wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo))) && (
                            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,83,80,0.12)', border: '1px solid var(--danger)', fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🌙 {t('obavezanLjekarskiPregledNajmanje1x1')}
                            </div>
                        )}
                        {formData.posebniUvjeti && (
                            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600, marginTop: 4 }}>
                                ⚠️ {t('zaPozicijeSaPosebnimUvjetima')}
                            </div>
                        )}
                        {editMode && (
                            <div style={{ marginTop: 8 }}>
                                <div style={labelStyle}>{t('dodatniPoslovi')}</div>
                                <textarea className="form-input" rows={2} value={formData.dodatniPoslovi || ''} onChange={e => set('dodatniPoslovi', e.target.value)}
                                    placeholder={t('opisiteDodatnePoslove')} />
                            </div>
                        )}
                        {!editMode && formData.dodatniPoslovi && (
                            <div style={{ marginTop: 4 }}><div style={labelStyle}>{t('dodatniPoslovi')}</div><div style={valueStyle}>{formData.dodatniPoslovi}</div></div>
                        )}
                    </ModalSection>

                    <ModalSection title={t('kontaktAdresa')}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('mobitel')} field="mobitel" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('telKuce')} field="telefonKuce" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('telFirme')} field="telefonTvrtki" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label="Email" field="email" type="email" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 2fr 1fr', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('ulica')} field="ulica" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('br')} field="kucniBroj" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('mjesto')} field="mjestoId"
                                opts={places.map(p => ({ value: p.id, label: `${p.naziv} (${p.postBroj || ''})` }))} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('opcina')} field="opcina" />
                        </div>
                    </ModalSection>

                    {(editMode || formData.napomena) && (
                        <ModalSection title={t('napomena')}>
                            {editMode ? (
                                <textarea className="form-input" rows={3} value={formData.napomena || ''} onChange={e => set('napomena', e.target.value)} />
                            ) : (
                                <div style={valueStyle}>{formData.napomena}</div>
                            )}
                        </ModalSection>
                    )}
                </>)}

                {activeTab === 'uvjerenja' && (
                    <>
                    <ModalSection
                        title={`${t('workerCerts')} (${certificates.length})`}
                        action={
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                                    onClick={() => { onClose(); router.push(`/dashboard/worker-certificates/create?workerId=${workerId}`); }}>
                                    + {t('dodaj')}
                                </button>
                            </div>
                        }
                    >
                        {showCertForm && (
                            <div style={{ padding: 14, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid var(--primary)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('oznaka')} *</div>
                                        <input className="form-input" value={certFormData.oznaka || ''} onChange={e => setCertFormData(f => ({ ...f, oznaka: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('nazivUvjerenja1')} *</div>
                                        <input className="form-input" value={certFormData.ime || ''} onChange={e => setCertFormData(f => ({ ...f, ime: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('tip')}</div>
                                        <select className="form-select" value={certFormData.tipUvjerenja || 'ZNR'} onChange={e => setCertFormData(f => ({ ...f, tipUvjerenja: e.target.value }))}>
                                            <option value="ZNR">ZNR</option>
                                            <option value="PP">PP</option>
                                            <option value="Ljekar.">Ljekar.</option>
                                            <option value="Ostalo">Ostalo</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('datum')}</div>
                                        <DateInput value={certFormData.datum || ''} onChange={v => setCertFormData(f => ({ ...f, datum: v }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('vrijediDo')}</div>
                                        <DateInput value={certFormData.vrijediDo || ''} onChange={v => setCertFormData(f => ({ ...f, vrijediDo: v }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('sposobnost')}</div>
                                        <select className="form-select" value={certFormData.sposobnost || 'Sposoban'} onChange={e => setCertFormData(f => ({ ...f, sposobnost: e.target.value }))}>
                                            <option value="Sposoban">{t('sposoban')}</option>
                                            <option value="Nesposoban">{t('nesposoban')}</option>
                                            <option value="Uvjetno sposoban">{t('uvjetnoSposoban')}</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowCertForm(false); setCertEditId(null); }}>{t('cancel')}</button>
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveCert}>💾 {t('save')}</button>
                                </div>
                            </div>
                        )}
                        {certificates.length === 0 && !showCertForm ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>{t('nemaUvjerenja')}</div>
                        ) : certificates.map(c => {
                            const isExpired = c.vrijediDo && new Date(c.vrijediDo) < new Date();
                            return (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: `1px solid ${isExpired ? 'var(--danger)' : 'var(--border-light)'}` }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 55 }}>{c.oznaka}</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>{t(c.ime?.trim()) || c.ime}</span>
                                    <span style={{ fontSize: '0.75rem', color: isExpired ? 'var(--danger)' : 'var(--text-muted)' }}>
                                        {isExpired ? '⚠️ ' : ''}{t('do')}: {formatDate(c.vrijediDo) || '—'}
                                    </span>
                                    <span className={`badge ${c.sposobnost === 'Sposoban' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>{t(c.sposobnost?.toLowerCase()) || c.sposobnost}</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-ghost btn-sm btn-icon" title={t('brzaIzmjena')}
                                            onClick={() => { setCertFormData({ ...c }); setCertEditId(c.id); setShowCertForm(true); }}>✏️</button>
                                        <button className="btn btn-ghost btn-sm btn-icon" title={t('otvoriPuniObrazac')}
                                            onClick={() => { onClose(); router.push(`/dashboard/worker-certificates/edit/${c.id}`); }}>📄</button>
                                        <button className="btn btn-ghost btn-sm btn-icon" title={t('kopirajUNovoUvjerenje')}
                                            onClick={() => { onClose(); router.push(`/dashboard/worker-certificates/create?copyFrom=${c.id}`); }}>📋</button>
                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={t('delete')}
                                            onClick={async () => { const ok = await confirm(t('obrisatiUvjerenje')); if (ok) { remove(COLLECTIONS.CERTIFICATES, c.id); refreshCerts(); } }}>🗑️</button>
                                    </div>
                                </div>
                            );
                        })}
                    </ModalSection>
                    </>
                )}

                {activeTab === 'ozo' && (
                    <ModalSection
                        title={`${t('workerPPESection')} (${ppeAssign.length})`}
                        action={
                            <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                                onClick={() => { setPpeFormData({ naziv: '', datumZaduzenja: todayISO(), datumRazduzenja: '', kolicina: 1 }); setPpeEditId(null); setShowPpeForm(true); }}>
                                + {t('dodaj')}
                            </button>
                        }
                    >
                        {showPpeForm && (
                            <div style={{ padding: 14, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid var(--primary)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 70px', gap: 10, marginBottom: 10 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('nazivOzo')} *</div>
                                        <input className="form-input" value={ppeFormData.naziv || ''} onChange={e => setPpeFormData(f => ({ ...f, naziv: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('datumZaduzenja')}</div>
                                        <DateInput value={ppeFormData.datumZaduzenja || ''} onChange={v => setPpeFormData(f => ({ ...f, datumZaduzenja: v }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('datumRazduzenja')}</div>
                                        <DateInput value={ppeFormData.datumRazduzenja || ''} onChange={v => setPpeFormData(f => ({ ...f, datumRazduzenja: v }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{t('kol')}</div>
                                        <input className="form-input" type="number" min="1" value={ppeFormData.kolicina ?? 1} onChange={e => setPpeFormData(f => ({ ...f, kolicina: parseInt(e.target.value) || 1 }))} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowPpeForm(false); setPpeEditId(null); }}>{t('cancel')}</button>
                                    <button className="btn btn-primary btn-sm" onClick={handleSavePpe}>💾 {t('save')}</button>
                                </div>
                            </div>
                        )}
                        {ppeAssign.length === 0 && !showPpeForm ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>{t('nemaOzoZaduzenja')}</div>
                        ) : ppeAssign.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>🦺 {t(p.naziv?.trim()) || p.naziv}</span>
                                {p.kolicina && p.kolicina > 1 && <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: 10, background: 'rgba(0,191,166,0.1)', color: 'var(--primary)', fontWeight: 700 }}>×{p.kolicina}</span>}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('zaduz')}: {formatDate(p.datumZaduzenja) || '—'}</span>
                                {p.datumRazduzenja && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('razduz')}: {formatDate(p.datumRazduzenja)}</span>}
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn btn-ghost btn-sm btn-icon" title={t('edit')} onClick={() => { setPpeFormData({ ...p }); setPpeEditId(p.id); setShowPpeForm(true); }}>✏️</button>
                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={t('delete')} onClick={async () => { const ok = await confirm(t('obrisatiZaduzenje')); if (ok) { remove(COLLECTIONS.PPE_ASSIGNMENTS, p.id); refreshPpe(); } }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </ModalSection>
                )}

                {activeTab === 'pregledi' && (
                    <ModalSection
                        title={`${t('ljekarskiPregledi1')} (${medExams.length})`}
                        action={
                            <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                                onClick={() => { onClose(); router.push(`/dashboard/medical-exams?openNew=1&workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers')}`); }}>
                                + {t('noviPregled')}
                            </button>
                        }
                    >
                        {medExams.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0', textAlign: 'center' }}>🩺 {t('nemaLjekarskihPregleda')}</div>
                        ) : [...medExams].sort((a, b) => (b.datumPregleda || '').localeCompare(a.datumPregleda || '')).map(m => {
                            const expDate = m.vrijediDo ? new Date(m.vrijediDo) : null;
                            const now = new Date();
                            const isExp = expDate && expDate < now;
                            const diffDays = expDate ? Math.ceil((expDate - now) / 86400000) : null;
                            const isSoon = !isExp && diffDays !== null && diffDays <= 60;
                            const statusColor = isExp ? 'var(--danger)' : isSoon ? 'var(--warning)' : 'var(--success)';
                            const statusLabel = isExp ? (t('istekao')) : isSoon ? `${diffDays}d` : (t('vrijedi'));
                            return (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: `1px solid ${isExp ? 'var(--danger)' : 'var(--border-light)'}`, cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                    onClick={() => { onClose(); router.push(`/dashboard/workers?openWorker=${workerId}&section=medExams`); }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--primary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = isExp ? 'var(--danger)' : 'var(--border-light)'; e.currentTarget.style.boxShadow = 'none'; }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>🩺</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                            {m.tipPregleda === 'prethodni' ? t('prethodniPregled') :
                                             m.tipPregleda === 'periodicni' ? t('periodicniPregled') :
                                             m.tipPregleda === 'vanredni' ? t('vanredniPregled') :
                                             m.tipPregleda === 'nocniRad' ? t('pregledNocniRad') :
                                             m.tipPregleda === 'ostalo' ? t('ostalo') :
                                             (m.tipPregleda || t('pregled1'))}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {m.datumPregleda ? `${t('datum')}: ${formatDate(m.datumPregleda)}` : ''}
                                            {m.vrijediDo ? ` · ${t('vrijediDo')}: ${formatDate(m.vrijediDo)}` : ''}
                                            {m.rezultat ? ` · ${m.rezultat}` : ''}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${statusColor}22`, color: statusColor }}>
                                        {statusLabel}
                                    </span>
                                    <button className="btn btn-ghost btn-sm btn-icon" title={t('obrisi')} style={{ color: 'var(--danger)' }}
                                        onClick={async (e) => { e.stopPropagation(); if (await confirm(t('obrisatiPregled'))) { remove(COLLECTIONS.MEDICAL_EXAMS, m.id); refreshMed(); } }}>🗑️</button>
                                </div>
                            );
                        })}
                        {medExams.length > 0 && (
                            <div style={{ marginTop: 8, textAlign: 'center' }}>
                                <button className="btn btn-ghost btn-sm" onClick={() => { onClose(); router.push(`/dashboard/medical-exams?workerId=${workerId}`); }} style={{ fontSize: '0.78rem' }}>
                                    {t('sviPregledi')}
                                </button>
                            </div>
                        )}
                    </ModalSection>
                )}

                {activeTab === 'dokumenti' && (
                    <ModalSection
                        title={`${t('dokumenti1')} (${(formData.dokumenti || []).length})`}
                        action={
                            <label className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '3px 10px', cursor: 'pointer' }}>
                                + {t('upload')}
                                <input type="file" style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                            const cid = activeCompanyId || getActiveCompanyId();
                                            const res = await uploadSecureFile(cid, 'workers', file);
                                            const newDoc = { id: Date.now().toString(36), name: file.name, url: res.url, storagePath: res.storagePath, size: res.size, type: res.type, source: 'Upload', date: new Date().toISOString().split('T')[0] };
                                            const updated = { ...formData, dokumenti: [...(formData.dokumenti || []), newDoc] };
                                            update(COLLECTIONS.WORKERS, workerId, { dokumenti: updated.dokumenti });
                                            setFormData(updated);
                                            setWorker(w => ({ ...w, dokumenti: updated.dokumenti }));
                                        } catch (err) { await alert('Upload error: ' + err.message); }
                                        e.target.value = '';
                                    }} />
                            </label>
                        }
                    >
                        {(formData.dokumenti || []).length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0', textAlign: 'center' }}>📄 {t('nemaDokumenata')}</div>
                        ) : (formData.dokumenti || []).map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <span style={{ fontSize: '1.2rem' }}>{d.name?.endsWith('.pdf') ? '📕' : '🖼️'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.source || ''}{d.date ? ` · ${formatDate(d.date)}` : ''}{d.size ? ` · ${(d.size/1024).toFixed(0)}KB` : ''}</div>
                                </div>
                                <button className="btn btn-ghost btn-sm btn-icon" title={t('otvori')} onClick={() => window.open(d.url, '_blank')}>👁️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" title={t('preuzmi')} onClick={async () => { 
                                    if (d.url) {
                                        try {
                                            const response = await fetch(d.url);
                                            if (!response.ok) throw new Error('Network error');
                                            const blob = await response.blob();
                                            const blobUrl = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = blobUrl;
                                            a.download = d.name || 'document';
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            window.URL.revokeObjectURL(blobUrl);
                                        } catch(e) {
                                            window.open(d.url, '_blank');
                                        }
                                    } else if (d.data) {
                                        const a = document.createElement('a'); 
                                        a.href = d.data; 
                                        a.download = d.name; 
                                        document.body.appendChild(a);
                                        a.click(); 
                                        document.body.removeChild(a);
                                    }
                                }}>⬇️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" title={t('isprintaj')} onClick={async () => {
                                    if (d.url) {
                                        try {
                                            const res = await fetch(d.url);
                                            const blob = await res.blob();
                                            const blobUrl = window.URL.createObjectURL(blob);
                                            const isPdf = d.name?.toLowerCase().endsWith('.pdf') || blob.type === 'application/pdf';
                                            const win = window.open(isPdf ? blobUrl : '');
                                            if (win) {
                                                if (isPdf) {
                                                    setTimeout(() => win.print(), 1000);
                                                } else {
                                                    win.document.write(`<html><head><title>${d.name}</title></head><body style="margin:0"><img src="${blobUrl}" style="max-width:100%;max-height:95vh;margin:20px auto;display:block;" onload="window.print()" /></body></html>`);
                                                    win.document.close();
                                                }
                                            }
                                        } catch (e) {
                                            console.error('Print failed', e);
                                            const win = window.open(d.url, '_blank');
                                            if (win) setTimeout(() => win.print(), 1000);
                                        }
                                    } else if (d.data) {
                                        const isPdf = d.data.startsWith('data:application/pdf');
                                        const win = window.open('');
                                        if (win) {
                                            win.document.write(`<html><head><title>${d.name}</title></head><body style="margin:0">${isPdf ? `<iframe src="${d.data}" style="width:100%;height:100vh;border:none"></iframe>` : `<img src="${d.data}" style="max-width:100%;max-height:95vh;margin:20px auto;display:block;" onload="window.print()" />`}</body></html>`);
                                            win.document.close();
                                            if (isPdf) setTimeout(() => win.print(), 1000);
                                        }
                                    }
                                }}>🖨️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={t('obrisi')}
                                    onClick={async () => {
                                        if (await confirm(t('obrisatiDokument'))) {
                                            const updated = (formData.dokumenti || []).filter(x => x.id !== d.id);
                                            update(COLLECTIONS.WORKERS, workerId, { dokumenti: updated });
                                            setFormData(f => ({ ...f, dokumenti: updated }));
                                        }
                                    }}>🗑️</button>
                            </div>
                        ))}
                    </ModalSection>
                )}

                </div>

                {/* ── Footer ── */}
                <div className="modal-footer">
                    {editMode ? (
                        <>
                            <button className="btn btn-ghost" onClick={() => { setFormData({ ...worker }); setEditMode(false); }}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {t('save')}</button>
                        </>
                    ) : (
                        <button className="btn btn-ghost" onClick={onClose}>{t('zatvori')}</button>
                    )}
                </div>
            </div>
        </div>
    );
}
