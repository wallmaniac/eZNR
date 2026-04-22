'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS, getAllCompanies, getAllUsers,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

export default function AdminCompaniesPage() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [companies, setCompanies] = useState([]);
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editCompany, setEditCompany] = useState(null);
    const [logoError, setLogoError] = useState('');
    const [formData, setFormData] = useState({
        naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '',
        postanskiBroj: '', telefon: '', email: '', direktor: '', strucnoLice: '',
        aktivan: true, logo: '', parentId: '',
    });

    useEffect(() => {
        if (!isAdmin) { router.push('/dashboard'); return; }
        setCompanies(getAllCompanies());
        setUsers(getAllUsers());
    }, [isAdmin]);

    const refreshData = () => {
        setCompanies(getAllCompanies());
        setUsers(getAllUsers());
    };

    const emptyForm = { naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '', postanskiBroj: '', telefon: '', email: '', direktor: '', strucnoLice: '', aktivan: true, logo: '', parentId: '' };

    const openNew = () => {
        setEditCompany(null);
        setFormData(emptyForm);
        setLogoError('');
        setShowModal(true);
    };

    const openEdit = (c) => {
        setEditCompany(c);
        setFormData({
            naziv: c.naziv || '', skraceniNaziv: c.skraceniNaziv || '', oib: c.oib || '',
            adresa: c.adresa || '', mjesto: c.mjesto || '', postanskiBroj: c.postanskiBroj || '',
            telefon: c.telefon || '', email: c.email || '', direktor: c.direktor || '',
            strucnoLice: c.strucnoLice || '', aktivan: c.aktivan !== false, logo: c.logo || '', parentId: c.parentId || '',
        });
        setLogoError('');
        setShowModal(true);
    };

    const handleSave = () => {
        if (!formData.naziv.trim()) return;
        if (editCompany) {
            update(COLLECTIONS.COMPANIES, editCompany.id, formData);
        } else {
            create(COLLECTIONS.COMPANIES, formData);
        }
        setShowModal(false);
        refreshData();
    };

    const handleDelete = async (c) => {
        const usersInCompany = users.filter(u => (u.companyIds || []).includes(c.id));
        if (usersInCompany.length > 0) {
            await alert(lang === 'bs'
                ? `Ne možete obrisati firmu "${c.naziv}" jer ima ${usersInCompany.length} korisnika.`
                : `Cannot delete company "${c.naziv}" — it has ${usersInCompany.length} users.`);
            return;
        }
        const ok = await confirm(lang === 'bs' ? `Obrisati firmu ${c.naziv}?` : `Delete company ${c.naziv}?`);
        if (ok) {
            remove(COLLECTIONS.COMPANIES, c.id);
            refreshData();
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setLogoError(lang === 'bs' ? 'Samo slike su dozvoljene.' : 'Only images are allowed.');
            return;
        }
        if (file.size > 500000) {
            setLogoError(lang === 'bs' ? 'Logo mora biti manji od 500KB' : 'Logo must be under 500KB');
            return;
        }
        setLogoError('');
        const reader = new FileReader();
        reader.onload = (ev) => setFormData(p => ({ ...p, logo: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const getUsersForCompany = (compId) => users.filter(u => (u.companyIds || []).includes(compId));

    if (!isAdmin) return null;

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                        🏢 {lang === 'bs' ? 'Upravljanje firmama' : 'Company Management'}
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {lang === 'bs' ? 'Sve registrirane firme u sistemu' : 'All registered companies in the system'}
                    </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={openNew} style={{ flexShrink: 0 }}>
                    ➕ {lang === 'bs' ? 'Nova firma' : 'New Company'}
                </button>
            </div>

            {/* Company Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {companies.map(c => {
                    const companyUsers = getUsersForCompany(c.id);
                    return (
                        <div key={c.id} className="card" style={{ borderLeft: `4px solid ${c.aktivan !== false ? 'var(--primary)' : '#ccc'}`, opacity: c.aktivan === false ? 0.6 : 1 }}>
                            <div className="card-body" style={{ padding: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                        {c.logo && (
                                            <img src={c.logo} alt="Logo" style={{ height: 36, width: 36, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 2, border: '1px solid var(--border-light)', flexShrink: 0 }} />
                                        )}
                                        <div style={{ minWidth: 0 }}>
                                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {!c.logo && '🏢 '}{c.naziv}
                                            </h3>
                                            {c.skraceniNaziv && c.skraceniNaziv !== c.naziv && (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.skraceniNaziv}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span style={{
                                        padding: '3px 9px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600, flexShrink: 0,
                                        background: c.aktivan !== false ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)',
                                        color: c.aktivan !== false ? 'var(--success)' : 'var(--danger)',
                                    }}>
                                        {c.aktivan !== false ? '✅ Aktivna' : '⛔ Neaktivna'}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {c.mjesto && <div>📍 {c.adresa ? `${c.adresa}, ` : ''}{c.mjesto}{c.postanskiBroj ? ` ${c.postanskiBroj}` : ''}</div>}
                                    {c.telefon && <div>📞 {c.telefon}</div>}
                                    {c.email && <div>📧 {c.email}</div>}
                                    {c.oib && <div>🆔 OIB: {c.oib}</div>}
                                    {c.direktor && <div>👤 {c.direktor}</div>}
                                    {c.strucnoLice && <div>🛡️ {c.strucnoLice}</div>}
                                </div>

                                {/* Users in this company */}
                                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 5 }}>
                                        👥 {lang === 'bs' ? 'Korisnici' : 'Users'} ({companyUsers.length})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {companyUsers.map(u => (
                                            <span key={u.id} style={{
                                                padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600,
                                                background: u.role === 'admin' ? 'rgba(123,31,162,0.15)' : 'rgba(33,150,243,0.12)',
                                                color: u.role === 'admin' ? '#7B1FA2' : 'var(--info)',
                                            }}>
                                                {u.role === 'admin' ? '👑' : '🛡️'} {u.firstName} {u.lastName}
                                            </span>
                                        ))}
                                        {companyUsers.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️ {lang === 'bs' ? 'Uredi' : 'Edit'}</button>
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c)}>🗑️</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Company Modal — matches Postavke Firma editor */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                            <h2 style={{ color: 'white' }}>
                                {editCompany ? '✏️' : '➕'} {editCompany ? (lang === 'bs' ? 'Uredi firmu' : 'Edit Company') : (lang === 'bs' ? 'Nova firma' : 'New Company')}
                            </h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>

                            {/* Puni naziv */}
                            <div className="form-group">
                                <label className="form-label">{lang === 'bs' ? 'Puni naziv' : 'Full name'} *</label>
                                <input className="form-input" value={formData.naziv} onChange={e => setFormData(p => ({ ...p, naziv: e.target.value }))} required />
                            </div>

                            
                            {/* Parent Company */}
                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 700 }}>🔗 {lang === 'bs' ? 'Pripada Holdingu (Kćerka firma)' : 'Parent Company (Subsidiary)'}</label>
                                <select className="form-select" value={formData.parentId} onChange={e => setFormData(p => ({ ...p, parentId: e.target.value }))}>
                                    <option value="">- Nema (Nezavisna firma / Holding) -</option>
                                    {companies.filter(c => c.id !== editCompany?.id && !c.parentId).map(c => (
                                        <option key={c.id} value={c.id}>🏢 {c.naziv}</option>
                                    ))}
                                </select>
                            </div>


                            {/* Skraćeni naziv + OIB */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Skraćeni naziv' : 'Short name'}</label>
                                    <input className="form-input" value={formData.skraceniNaziv} onChange={e => setFormData(p => ({ ...p, skraceniNaziv: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">OIB / JIB</label>
                                    <input className="form-input" value={formData.oib} onChange={e => setFormData(p => ({ ...p, oib: e.target.value }))} />
                                </div>
                            </div>

                            {/* Adresa + Mjesto */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Adresa' : 'Address'}</label>
                                    <input className="form-input" value={formData.adresa} onChange={e => setFormData(p => ({ ...p, adresa: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Mjesto' : 'City'}</label>
                                    <input className="form-input" value={formData.mjesto} onChange={e => setFormData(p => ({ ...p, mjesto: e.target.value }))} />
                                </div>
                            </div>

                            {/* Poštanski broj + Telefon + Email */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Poštanski br.' : 'Postal code'}</label>
                                    <input className="form-input" value={formData.postanskiBroj} onChange={e => setFormData(p => ({ ...p, postanskiBroj: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Telefon' : 'Phone'}</label>
                                    <input className="form-input" value={formData.telefon} onChange={e => setFormData(p => ({ ...p, telefon: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                                </div>
                            </div>

                            {/* Direktor + Stručno lice */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Direktor' : 'Director'}</label>
                                    <input className="form-input" value={formData.direktor} onChange={e => setFormData(p => ({ ...p, direktor: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Stručno lice ZNR' : 'OHS Specialist'}</label>
                                    <input className="form-input" value={formData.strucnoLice} onChange={e => setFormData(p => ({ ...p, strucnoLice: e.target.value }))} />
                                </div>
                            </div>

                            {/* Logo upload — same as Postavke */}
                            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10 }}>🖼️ {lang === 'bs' ? 'Logo firme' : 'Company Logo'}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                    {formData.logo ? (
                                        <img src={formData.logo} alt="Logo" style={{ height: 56, maxWidth: 180, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4, border: '1px solid var(--border-light)' }} />
                                    ) : (
                                        <div style={{ height: 56, width: 100, borderRadius: 8, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                            {lang === 'bs' ? 'Nema loga' : 'No logo'}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                        <label style={{ cursor: 'pointer', padding: '7px 14px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.8rem', display: 'inline-block' }}>
                                            📁 {lang === 'bs' ? 'Učitaj logo' : 'Upload Logo'}
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                                        </label>
                                        {logoError && <div style={{ fontSize: '0.73rem', color: 'var(--danger)', fontWeight: 600 }}>⚠️ {logoError}</div>}
                                        {formData.logo && (
                                            <button onClick={() => setFormData(p => ({ ...p, logo: '' }))} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                                                🗑️ {lang === 'bs' ? 'Ukloni logo' : 'Remove Logo'}
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {lang === 'bs' ? 'PNG ili SVG, max 500KB.' : 'PNG or SVG, max 500KB.'}
                                    </div>
                                </div>
                            </div>

                            {/* Aktivna firma */}
                            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" id="aktivan-check" checked={formData.aktivan} onChange={e => setFormData(p => ({ ...p, aktivan: e.target.checked }))} />
                                <label htmlFor="aktivan-check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>{lang === 'bs' ? 'Aktivna firma' : 'Active company'}</label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!formData.naziv.trim()}>
                                💾 {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
