'use client';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import {
    getAll, getById, update, create, remove, COLLECTIONS,
    getWorkerCertificates, getWorkerPPE, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { logPPEAssigned } from '@/lib/activityLog';

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
                ) : (
                    <input className="form-input" type={type} value={formData[field] || ''} onChange={e => set(field, type === 'number' ? Number(e.target.value) : e.target.value)} />
                )
            ) : (
                <div style={valueStyle}>{
                    type === 'checkbox' ? (formData[field] ? (lang === 'bs' ? 'Da' : 'Yes') : (lang === 'bs' ? 'Ne' : 'No'))
                        : opts ? (opts.find(o => o.value === formData[field])?.label || '—')
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
export default function WorkerProfileModal({ workerId, onClose, onSaved }) {
    const { t, lang } = useLanguage();
    const router = useRouter();
    const { alert, confirm, DialogRenderer } = useDialog();

    const [worker, setWorker] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState(null);
    const [orgUnits, setOrgUnits] = useState([]);
    const [workplaces, setWorkplaces] = useState([]);
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

    const refreshCerts = () => setCertificates(getWorkerCertificates(workerId));
    const refreshPpe = () => setPpeAssign(getWorkerPPE(workerId));

    useEffect(() => {
        if (!workerId) return;
        const w = getById(COLLECTIONS.WORKERS, workerId);
        setWorker(w);
        setFormData(w ? { ...w } : null);
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        setCertificates(getWorkerCertificates(workerId));
        setPpeAssign(getWorkerPPE(workerId));
    }, [workerId]);

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



    const openFullEdit = () => {
        onClose();
        router.push(`/dashboard/workers?openWorker=${workerId}`);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <DialogRenderer />

                {/* ── Header ── */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {worker.slika ? (
                            <img src={worker.slika} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} />
                        ) : (
                            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>
                                {initials}
                            </div>
                        )}
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
                                <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)}>
                                    ✏️ {lang === 'bs' ? 'Uredi' : 'Edit'}
                                </button>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={openFullEdit}
                                    title={lang === 'bs' ? 'Otvori potpuni profil radnika (uvjerenja, OZO, dokumenti...)' : 'Open full worker profile'}
                                >
                                    👤 {lang === 'bs' ? 'Otvori potpuno' : 'Open full'}
                                </button>
                            </>
                        )}
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* ── Quick Actions ── */}
                <div style={{ display: 'flex', gap: 10, padding: '12px 24px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginRight: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        ⚡ {lang === 'bs' ? 'Brze akcije:' : 'Quick Actions:'}
                    </div>
                    <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', background: 'var(--bg-card)' }}
                        onClick={() => { onClose(); router.push(`/dashboard/medical-exams?openNew=1&workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers?openWorker=' + workerId)}`); }}>
                        👨‍⚕️ {lang === 'bs' ? 'Novi ljekarski pregled' : 'New exam'}
                    </button>
                    <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', background: 'var(--bg-card)' }}
                        onClick={() => { onClose(); router.push(`/dashboard/worker-certificates/create?workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers?openWorker=' + workerId)}`); }}>
                        📄 {lang === 'bs' ? 'Novo uvjerenje' : 'New cert'}
                    </button>
                    <button className="btn btn-outline btn-sm" style={{ fontSize: '0.8rem', padding: '4px 10px', height: 'auto', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'var(--bg-card)' }}
                        onClick={() => { onClose(); router.push(`/dashboard/injuries?openNew=1&workerId=${workerId}&returnTo=${encodeURIComponent('/dashboard/workers?openWorker=' + workerId)}`); }}>
                        🚑 {lang === 'bs' ? 'Prijavi povredu' : 'Report injury'}
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

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
                    </ModalSection>

                    <ModalSection title={lang === 'bs' ? 'Radno mjesto' : 'Employment'}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('workplace')} field="radnoMjestoId"
                                opts={workplaces.map(w => ({ value: w.id, label: w.naziv }))} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={t('orgUnit')} field="orgJedinicaId"
                                opts={orgUnits.map(o => ({ value: o.id, label: o.naziv }))} />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Ev. broj' : 'Emp. number'} field="evidencijskiBroj" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Datum zaposlenja' : 'Employment date'} field="datumZaposlenja" type="date" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Staz do dolaska' : 'Prior experience'} field="stazDoDolaska" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Ukupni staz' : 'Total experience'} field="ukupniStaz" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Koeficijent' : 'Coefficient'} field="koef" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Vanjski suradnik' : 'External'} field="vanjskiSuradnik" type="checkbox" />
                        </div>
                    </ModalSection>

                    <ModalSection title={lang === 'bs' ? 'Kontakt' : 'Contact'}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Mobitel' : 'Mobile'} field="mobitel" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Tel. kuće' : 'Home phone'} field="telefonKuce" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label={lang === 'bs' ? 'Tel. firme' : 'Company phone'} field="telefonTvrtki" />
                            <ModalField editMode={editMode} formData={formData} set={set} lang={lang} label="Email" field="email" type="email" />
                        </div>
                    </ModalSection>

                    {/* ── Certificates with full CRUD ── */}
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
                                        <input className="form-input" type="date" value={certFormData.datum || ''} onChange={e => setCertFormData(f => ({ ...f, datum: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Vrijedi do' : 'Valid until'}</div>
                                        <input className="form-input" type="date" value={certFormData.vrijediDo || ''} onChange={e => setCertFormData(f => ({ ...f, vrijediDo: e.target.value }))} />
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

                    {/* ── PPE with full CRUD ── */}
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
                                        <input className="form-input" type="date" value={ppeFormData.datumZaduzenja || ''} onChange={e => setPpeFormData(f => ({ ...f, datumZaduzenja: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <div style={labelStyle}>{lang === 'bs' ? 'Datum razduženja' : 'Returned'}</div>
                                        <input className="form-input" type="date" value={ppeFormData.datumRazduzenja || ''} onChange={e => setPpeFormData(f => ({ ...f, datumRazduzenja: e.target.value }))} />
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

                    {(editMode || formData.napomena) && (
                        <ModalSection title={lang === 'bs' ? 'Napomena' : 'Notes'}>
                            {editMode ? (
                                <textarea className="form-input" rows={3} value={formData.napomena || ''} onChange={e => set('napomena', e.target.value)} />
                            ) : (
                                <div style={valueStyle}>{formData.napomena}</div>
                            )}
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
