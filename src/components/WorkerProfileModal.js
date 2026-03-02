'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, getById, update, create, remove, COLLECTIONS,
    getWorkerCertificates, getWorkerPPE, formatDate, todayISO,
} from '@/lib/dataStore';

/**
 * WorkerProfileModal
 * Props:
 *   workerId  — string ID of the worker to show
 *   onClose   — () => void
 *   onSaved   — optional () => void called after save
 */
export default function WorkerProfileModal({ workerId, onClose, onSaved }) {
    const { t, lang } = useLanguage();

    const [worker, setWorker] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState(null);
    const [orgUnits, setOrgUnits] = useState([]);
    const [workplaces, setWorkplaces] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [ppeAssign, setPpeAssign] = useState([]);

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

    const handleSave = () => {
        if (!formData.ime || !formData.prezime) {
            alert(lang === 'bs' ? 'Ime i prezime su obavezna polja!' : 'First and last name are required!');
            return;
        }
        update(COLLECTIONS.WORKERS, workerId, formData);
        setWorker({ ...formData });
        setEditMode(false);
        onSaved?.();
    };

    const wp = workplaces.find(w => w.id === formData.radnoMjestoId);
    const ou = orgUnits.find(o => o.id === formData.orgJedinicaId);
    const initials = `${worker.ime?.[0] || ''}${worker.prezime?.[0] || ''}`.toUpperCase();

    // ── Label styles ──
    const labelStyle = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 };
    const valueStyle = { fontSize: '0.88rem', color: 'var(--text)', fontWeight: 500 };

    const Field = ({ label, field, type = 'text', opts = null }) => (
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

    const Section = ({ title, children }) => (
        <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', marginBottom: 10, paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>
                {title}
            </div>
            {children}
        </div>
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

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
                                {wp?.naziv || '—'}  ·  {ou?.naziv || '—'}
                                {worker.evidencijskiBroj ? `  ·  Ev.br: ${worker.evidencijskiBroj}` : ''}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {!editMode && (
                            <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)}>✏️ {lang === 'bs' ? 'Uredi' : 'Edit'}</button>
                        )}
                        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '24px 28px' }}>

                    <Section title={lang === 'bs' ? 'Osnovno' : 'Basic info'}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <Field label={lang === 'bs' ? 'Ime' : 'First name'} field="ime" />
                            <Field label={lang === 'bs' ? 'Prezime' : 'Last name'} field="prezime" />
                            <Field label={lang === 'bs' ? 'Ime roditelja' : "Parent's name"} field="imeRoditelja" />
                            <Field label="JMBG" field="jmbg" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <Field label="OIB" field="oib" />
                            <Field label={lang === 'bs' ? 'Spol' : 'Gender'} field="spol"
                                opts={[{ value: 'M', label: lang === 'bs' ? 'Muški' : 'Male' }, { value: 'Z', label: lang === 'bs' ? 'Ženski' : 'Female' }]} />
                            <Field label={lang === 'bs' ? 'Datum rođenja' : 'Date of birth'} field="datumRodenja" type="date" />
                            <Field label={lang === 'bs' ? 'Životna dob' : 'Age'} field="zivotnaDob" type="number" />
                        </div>
                    </Section>

                    <Section title={lang === 'bs' ? 'Radno mjesto' : 'Employment'}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <Field label={t('workplace')} field="radnoMjestoId"
                                opts={workplaces.map(w => ({ value: w.id, label: w.naziv }))} />
                            <Field label={t('orgUnit')} field="orgJedinicaId"
                                opts={orgUnits.map(o => ({ value: o.id, label: o.naziv }))} />
                            <Field label={lang === 'bs' ? 'Ev. broj' : 'Emp. number'} field="evidencijskiBroj" />
                            <Field label={lang === 'bs' ? 'Datum zaposlenja' : 'Employment date'} field="datumZaposlenja" type="date" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <Field label={lang === 'bs' ? 'Staz do dolaska' : 'Prior experience'} field="stazDoDolaska" />
                            <Field label={lang === 'bs' ? 'Ukupni staz' : 'Total experience'} field="ukupniStaz" />
                            <Field label={lang === 'bs' ? 'Koeficijent' : 'Coefficient'} field="koef" />
                            <Field label={lang === 'bs' ? 'Vanjski suradnik' : 'External'} field="vanjskiSuradnik" type="checkbox" />
                        </div>
                    </Section>

                    <Section title={lang === 'bs' ? 'Kontakt' : 'Contact'}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                            <Field label={lang === 'bs' ? 'Mobitel' : 'Mobile'} field="mobitel" />
                            <Field label={lang === 'bs' ? 'Tel. kuće' : 'Home phone'} field="telefonKuce" />
                            <Field label={lang === 'bs' ? 'Tel. firme' : 'Company phone'} field="telefonTvrtki" />
                            <Field label="Email" field="email" type="email" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0 16px' }}>
                            <Field label={lang === 'bs' ? 'Ulica' : 'Street'} field="ulica" />
                            <Field label={lang === 'bs' ? 'Kućni broj' : 'House no.'} field="kucniBroj" />
                            <Field label={lang === 'bs' ? 'Opcija' : 'Municipality'} field="opcina" />
                        </div>
                    </Section>

                    {/* Certificates */}
                    <Section title={t('workerCerts')}>
                        {certificates.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{lang === 'bs' ? 'Nema uvjerenja.' : 'No certificates.'}</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {certificates.map(c => {
                                    const isExpired = c.vrijediDo && new Date(c.vrijediDo) < new Date();
                                    return (
                                        <div key={c.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                                            background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)',
                                            border: `1px solid ${isExpired ? 'var(--danger)' : 'var(--border-light)'}`,
                                        }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 60 }}>{c.oznaka}</span>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>{c.ime}</span>
                                            <span style={{ fontSize: '0.75rem', color: isExpired ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                {isExpired ? '⚠️ ' : ''}{lang === 'bs' ? 'Vrijedi do' : 'Until'}: {formatDate(c.vrijediDo) || '—'}
                                            </span>
                                            <span className={`badge ${c.sposobnost === 'Sposoban' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>{c.sposobnost}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Section>

                    {/* PPE */}
                    {ppeAssign.length > 0 && (
                        <Section title={t('workerPPESection')}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {ppeAssign.map(p => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem', flex: 1 }}>🦺 {p.naziv}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Zaduž.' : 'Assigned'}: {formatDate(p.datumZaduzenja) || '—'}</span>
                                        {p.datumRazduzenja && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Razduž.' : 'Returned'}: {formatDate(p.datumRazduzenja)}</span>}
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Notes */}
                    {(editMode || formData.napomena) && (
                        <Section title={lang === 'bs' ? 'Napomena' : 'Notes'}>
                            {editMode ? (
                                <textarea className="form-input" rows={3} value={formData.napomena || ''} onChange={e => set('napomena', e.target.value)} />
                            ) : (
                                <div style={valueStyle}>{formData.napomena}</div>
                            )}
                        </Section>
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
                        <>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {lang === 'bs' ? 'Klikni Uredi za izmjenu podataka' : 'Click Edit to modify data'}
                            </div>
                            <button className="btn btn-ghost" onClick={onClose}>{lang === 'bs' ? 'Zatvori' : 'Close'}</button>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)}>✏️ {lang === 'bs' ? 'Uredi' : 'Edit'}</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
