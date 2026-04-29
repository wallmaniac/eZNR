'use client';
import TabBar from '@/components/TabBar';
import DateInput from '@/components/DateInput';
import Icon3D from '@/components/Icon3D';
import { fmtDate } from '@/lib/dateUtils';
import { uploadSecureFile } from '@/lib/storageService';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
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
                        {lang === 'bs' ? 'Da' : 'Yes'}
                    </label>
                ) : type === 'date' ? (
                    <DateInput value={formData[field] || ''} onChange={v => set(field, v)} />
                ) : (
                    <input className="form-input" type={type} value={formData[field] || ''} onChange={e => set(field, type === 'number' ? Number(e.target.value) : e.target.value)} />
                )
            ) : (
                <div style={valueStyle}>{
                    type === 'checkbox' ? (formData[field] ? (lang === 'bs' ? 'Da' : 'Yes') : (lang === 'bs' ? 'Ne' : 'No'))
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
export default function WorkerProfileModal({ workerId, onClose, onSaved, initialTab }) {
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
            await alert(lang === 'bs' ? 'Ime i prezime su obavezna polja!' : 'First and last name are required!');
            return;
        }
        update(COLLECTIONS.WORKERS, workerId, formData);
        setWorker({ ...formData });
        setEditMode(false);
        onSaved?.();
    };

    const handleSaveCert = async () => {
        if (!certFormData.oznaka || !certFormData.ime) {
            await alert(lang === 'bs' ? 'Oznaka i naziv su obavezni!' : 'Code and name are required!');
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
            await alert(lang === 'bs' ? 'Naziv je obavezan!' : 'Name is required!');
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
        onClose();
        // Small delay to let onClose state flush (resets openWorkerHandledRef)
        setTimeout(() => router.push(`/dashboard/workers?openWorker=${workerId}`), 50);
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
                                {editMode && <span style={{ marginLeft: 10, fontSize: '0.72rem', background: 'rgba(255,200,0,0.2)', color: '#FFD700', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>✏️ {lang === 'bs' ? 'Uređivanje' : 'Editing'}</span>}
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
                                    ✏️ {lang === 'bs' ? 'Uredi' : 'Edit'}
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={openFullEdit}
                                    style={{ fontSize: '0.8rem', padding: '6px 12px', height: 32, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Icon3D name="Radnici.png" size={16} />
                                    {lang === 'bs' ? 'Otvori potpuno' : 'Open full'}
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
                            { key: 'osnovno', icon: '👤', label: lang === 'bs' ? 'Osnovno' : 'Basic' },
                            { key: 'uvjerenja', icon: '📜', label: `${lang === 'bs' ? 'Uvjerenja' : 'Certs'} (${certificates.length})` },
                            { key: 'ozo', icon: '🦺', label: `OZO (${ppeAssign.length})` },
                            { key: 'dokumenti', icon: '📁', label: `${lang === 'bs' ? 'Dokumenti' : 'Docs'} (${(formData.dokumenti || []).length})` },
                        ]} 
                    />
                </div>

                {wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo) && (
                    <div style={{ background: 'rgba(239,83,80,0.15)', borderBottom: '1px solid var(--danger)', color: 'var(--danger)', padding: '8px 24px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🌙 Obavezan ljekarski pregled najmanje 1x u 2 godine (Noćni rad - čl. 40 FBiH)
                    </div>
                )}

                {/* ── Body ── */}
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

                {activeTab === 'osnovno' && (<>
                    {/* Quick Actions */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', background: 'var(--bg-card)' }}
                            onClick={() => { onClose(); router.push(`/dashboard/medical-exams?openNew=1&workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers')}`); }}>
                            👨‍⚕️ {lang === 'bs' ? 'Novi pregled' : 'New exam'}
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', background: 'var(--bg-card)' }}
                            onClick={() => { onClose(); router.push(`/dashboard/worker-certificates/create?workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers')}`); }}>
                            📄 {lang === 'bs' ? 'Novo uvjerenje' : 'New cert'}
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'var(--bg-card)' }}
                            onClick={() => { onClose(); router.push(`/dashboard/injuries?openNew=1&workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers')}`); }}>
                            🚑 {lang === 'bs' ? 'Prijavi povredu' : 'Report injury'}
                        </button>
                    </div>

                    <ModalSection title={lang === 'bs' ? 'Osnovno' : 'Basic info'}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Ime' : 'First name'} field="ime" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Prezime' : 'Last name'} field="prezime" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Ime roditelja' : "Parent's name"} field="imeRoditelja" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label="JMBG" field="jmbg" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label="OIB" field="oib" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Spol' : 'Gender'} field="spol"
                                opts={[{ value: 'M', label: lang === 'bs' ? 'Muški' : 'Male' }, { value: 'Z', label: lang === 'bs' ? 'Ženski' : 'Female' }]} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Datum rođenja' : 'Date of birth'} field="datumRodenja" type="date" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Životna dob' : 'Age'} field="zivotnaDob" type="number" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Mjesto rođenja' : 'Birth place'} field="mjestoRodenja" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Općina rođenja' : 'Birth municipality'} field="opcinaRodenja" />
                        </div>
                    </ModalSection>

                    <ModalSection title={lang === 'bs' ? 'Radno mjesto' : 'Employment'}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('workplace')} field="radnoMjestoId"
                                opts={workplaces.map(w => ({ value: w.id, label: w.naziv }))} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('orgUnit')} field="orgJedinicaId"
                                opts={orgUnits.map(o => ({ value: o.id, label: o.naziv }))} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Ev. broj' : 'Emp. number'} field="evidencijskiBroj" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Lokacija' : 'Location'} field="lokacija" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Datum zaposlenja' : 'Employment date'} field="datumZaposlenja" type="date" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Datum odlaska' : 'Departure date'} field="datumOdlaska" type="date" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Staz do dolaska' : 'Prior experience'} field="stazDoDolaska" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Ukupni staz' : 'Total experience'} field="ukupniStaz" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Koeficijent' : 'Coefficient'} field="koef" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Vanjski suradnik' : 'External'} field="vanjskiSuradnik" type="checkbox" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Posebni uvjeti' : 'Special conditions'} field="posebniUvjeti" type="checkbox" />
                        </div>
                        {/* Radno vrijeme */}
                        {editMode ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', marginTop: 12 }}>
                                <TimePicker label={lang === 'bs' ? 'Radno vrijeme od' : 'Work from'} value={formData.radnoVrijemeOd} onChange={v => set('radnoVrijemeOd', v)} />
                                <TimePicker label={lang === 'bs' ? 'Radno vrijeme do' : 'Work to'} value={formData.radnoVrijemeDo} onChange={v => set('radnoVrijemeDo', v)} />
                            </div>
                        ) : (formData.radnoVrijemeOd || formData.radnoVrijemeDo || (wp && (wp.radnoVrijemeOd || wp.radnoVrijemeDo))) ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', marginTop: 12 }}>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Radno vrijeme od' : 'Work from'}</div>
                                    <div style={valueStyle}>{formData.radnoVrijemeOd || wp?.radnoVrijemeOd || '—'}</div>
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <div style={labelStyle}>{lang === 'bs' ? 'Radno vrijeme do' : 'Work to'}</div>
                                    <div style={valueStyle}>{formData.radnoVrijemeDo || wp?.radnoVrijemeDo || '—'}</div>
                                </div>
                            </div>
                        ) : null}
                        {((formData.radnoVrijemeOd && formData.radnoVrijemeDo && isNightShift(formData.radnoVrijemeOd, formData.radnoVrijemeDo)) || (wp && isNightShift(wp.radnoVrijemeOd, wp.radnoVrijemeDo))) && (
                            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239,83,80,0.12)', border: '1px solid var(--danger)', fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🌙 {lang === 'bs' ? 'Obavezan ljekarski pregled najmanje 1x u 2 godine (Noćni rad - čl. 40 FBiH)' : 'Mandatory medical exam min. 1x per 2 years (Night work)'}
                            </div>
                        )}
                        {formData.posebniUvjeti && (
                            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600, marginTop: 4 }}>
                                ⚠️ {lang === 'bs' ? 'Za pozicije sa posebnim uvjetima rada potrebno je provesti periodične ljekarske preglede.' : 'Special conditions require periodic medical examinations.'}
                            </div>
                        )}
                        {editMode && (
                            <div style={{ marginTop: 8 }}>
                                <div style={labelStyle}>{lang === 'bs' ? 'Dodatni poslovi' : 'Additional jobs'}</div>
                                <textarea className="form-input" rows={2} value={formData.dodatniPoslovi || ''} onChange={e => set('dodatniPoslovi', e.target.value)}
                                    placeholder={lang === 'bs' ? 'Opišite dodatne poslove...' : 'Describe additional jobs...'} />
                            </div>
                        )}
                        {!editMode && formData.dodatniPoslovi && (
                            <div style={{ marginTop: 4 }}><div style={labelStyle}>{lang === 'bs' ? 'Dodatni poslovi' : 'Additional jobs'}</div><div style={valueStyle}>{formData.dodatniPoslovi}</div></div>
                        )}
                    </ModalSection>

                    <ModalSection title={lang === 'bs' ? 'Kontakt & Adresa' : 'Contact & Address'}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Mobitel' : 'Mobile'} field="mobitel" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Tel. kuće' : 'Home phone'} field="telefonKuce" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Tel. firme' : 'Company phone'} field="telefonTvrtki" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label="Email" field="email" type="email" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 2fr 1fr', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Ulica' : 'Street'} field="ulica" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Br.' : 'No.'} field="kucniBroj" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Mjesto' : 'Place'} field="mjestoId"
                                opts={places.map(p => ({ value: p.id, label: `${p.naziv} (${p.postBroj || ''})` }))} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Općina' : 'Municipality'} field="opcina" />
                        </div>
                    </ModalSection>

                    {(editMode || formData.napomena) && (
                        <ModalSection title={lang === 'bs' ? 'Napomena' : 'Notes'}>
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
                                    + {lang === 'bs' ? 'Dodaj' : 'Add'}
                                </button>
                            </div>
                        }
                    >
                        {showCertForm && (
                            <div style={{ padding: 14, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid var(--primary)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Oznaka' : 'Code'} *</div>
                                        <input className="form-input" value={certFormData.oznaka || ''} onChange={e => setCertFormData(f => ({ ...f, oznaka: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Naziv uvjerenja' : 'Certificate name'} *</div>
                                        <input className="form-input" value={certFormData.ime || ''} onChange={e => setCertFormData(f => ({ ...f, ime: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Tip' : 'Type'}</div>
                                        <select className="form-select" value={certFormData.tipUvjerenja || 'ZNR'} onChange={e => setCertFormData(f => ({ ...f, tipUvjerenja: e.target.value }))}>
                                            <option value="ZNR">ZNR</option>
                                            <option value="PP">PP</option>
                                            <option value="Ljekar.">Ljekar.</option>
                                            <option value="Ostalo">Ostalo</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Datum' : 'Date'}</div>
                                        <DateInput value={certFormData.datum || ''} onChange={v => setCertFormData(f => ({ ...f, datum: v }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Vrijedi do' : 'Valid until'}</div>
                                        <DateInput value={certFormData.vrijediDo || ''} onChange={v => setCertFormData(f => ({ ...f, vrijediDo: v }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Sposobnost' : 'Capability'}</div>
                                        <select className="form-select" value={certFormData.sposobnost || 'Sposoban'} onChange={e => setCertFormData(f => ({ ...f, sposobnost: e.target.value }))}>
                                            <option value="Sposoban">{lang === 'bs' ? 'Sposoban' : 'Capable'}</option>
                                            <option value="Nesposoban">{lang === 'bs' ? 'Nesposoban' : 'Not capable'}</option>
                                            <option value="Uvjetno sposoban">{lang === 'bs' ? 'Uvjetno sposoban' : 'Conditionally capable'}</option>
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
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>{lang === 'bs' ? 'Nema uvjerenja.' : 'No certificates.'}</div>
                        ) : certificates.map(c => {
                            const isExpired = c.vrijediDo && new Date(c.vrijediDo) < new Date();
                            return (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: `1px solid ${isExpired ? 'var(--danger)' : 'var(--border-light)'}` }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 55 }}>{c.oznaka}</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>{c.ime}</span>
                                    <span style={{ fontSize: '0.75rem', color: isExpired ? 'var(--danger)' : 'var(--text-muted)' }}>
                                        {isExpired ? '⚠️ ' : ''}{lang === 'bs' ? 'do' : 'until'}: {formatDate(c.vrijediDo) || '—'}
                                    </span>
                                    <span className={`badge ${c.sposobnost === 'Sposoban' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>{c.sposobnost}</span>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Brza izmjena' : 'Quick edit'}
                                            onClick={() => { setCertFormData({ ...c }); setCertEditId(c.id); setShowCertForm(true); }}>✏️</button>
                                        <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Otvori puni obrazac' : 'Open full form'}
                                            onClick={() => { onClose(); router.push(`/dashboard/worker-certificates/edit/${c.id}`); }}>📄</button>
                                        <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Kopiraj u novo uvjerenje' : 'Copy to new certificate'}
                                            onClick={() => { onClose(); router.push(`/dashboard/worker-certificates/create?copyFrom=${c.id}`); }}>📋</button>
                                        <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={t('delete')}
                                            onClick={async () => { const ok = await confirm(lang === 'bs' ? 'Obrisati uvjerenje?' : 'Delete certificate?'); if (ok) { remove(COLLECTIONS.CERTIFICATES, c.id); refreshCerts(); } }}>🗑️</button>
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
                                + {lang === 'bs' ? 'Dodaj' : 'Add'}
                            </button>
                        }
                    >
                        {showPpeForm && (
                            <div style={{ padding: 14, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid var(--primary)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 70px', gap: 10, marginBottom: 10 }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Naziv OZO' : 'PPE name'} *</div>
                                        <input className="form-input" value={ppeFormData.naziv || ''} onChange={e => setPpeFormData(f => ({ ...f, naziv: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Datum zaduženja' : 'Assigned'}</div>
                                        <DateInput value={ppeFormData.datumZaduzenja || ''} onChange={v => setPpeFormData(f => ({ ...f, datumZaduzenja: v }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Datum razduženja' : 'Returned'}</div>
                                        <DateInput value={ppeFormData.datumRazduzenja || ''} onChange={v => setPpeFormData(f => ({ ...f, datumRazduzenja: v }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Kol.' : 'Qty'}</div>
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
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px 0' }}>{lang === 'bs' ? 'Nema OZO zaduženja.' : 'No PPE assignments.'}</div>
                        ) : ppeAssign.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>🦺 {p.naziv}</span>
                                {p.kolicina && p.kolicina > 1 && <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: 10, background: 'rgba(0,191,166,0.1)', color: 'var(--primary)', fontWeight: 700 }}>×{p.kolicina}</span>}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Zaduž.' : 'Assigned'}: {formatDate(p.datumZaduzenja) || '—'}</span>
                                {p.datumRazduzenja && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Razduž.' : 'Returned'}: {formatDate(p.datumRazduzenja)}</span>}
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn btn-ghost btn-sm btn-icon" title={t('edit')} onClick={() => { setPpeFormData({ ...p }); setPpeEditId(p.id); setShowPpeForm(true); }}>✏️</button>
                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={t('delete')} onClick={async () => { const ok = await confirm(lang === 'bs' ? 'Obrisati zaduženje?' : 'Delete assignment?'); if (ok) { remove(COLLECTIONS.PPE_ASSIGNMENTS, p.id); refreshPpe(); } }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </ModalSection>
                )}

                {activeTab === 'dokumenti' && (
                    <ModalSection
                        title={`${lang === 'bs' ? 'Dokumenti' : 'Documents'} (${(formData.dokumenti || []).length})`}
                        action={
                            <label className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '3px 10px', cursor: 'pointer' }}>
                                + {lang === 'bs' ? 'Upload' : 'Upload'}
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
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px 0', textAlign: 'center' }}>📄 {lang === 'bs' ? 'Nema dokumenata.' : 'No documents.'}</div>
                        ) : (formData.dokumenti || []).map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 6, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <span style={{ fontSize: '1.2rem' }}>{d.name?.endsWith('.pdf') ? '📕' : '🖼️'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.source || ''}{d.date ? ` · ${formatDate(d.date)}` : ''}{d.size ? ` · ${(d.size/1024).toFixed(0)}KB` : ''}</div>
                                </div>
                                <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Otvori' : 'View'} onClick={() => window.open(d.url, '_blank')}>👁️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" title={lang === 'bs' ? 'Preuzmi' : 'Download'} onClick={() => { const a = document.createElement('a'); a.href = d.url; a.download = d.name; a.target='_blank'; a.click(); }}>⬇️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" style={{ color: 'var(--danger)' }} title={lang === 'bs' ? 'Obriši' : 'Delete'}
                                    onClick={async () => {
                                        if (await confirm(lang === 'bs' ? 'Obrisati dokument?' : 'Delete document?')) {
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
                        <button className="btn btn-ghost" onClick={onClose}>{lang === 'bs' ? 'Zatvori' : 'Close'}</button>
                    )}
                </div>
            </div>
        </div>
    );
}
