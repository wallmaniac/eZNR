'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS, getAllCompanies, getAllUsers,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import PageHeader from '@/components/PageHeader';

export default function AdminCompaniesPage() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { isAdmin, isSuperAdmin, user } = useAuth();
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
        const allComps = getAllCompanies();
        const allUsers = getAllUsers();
        setCompanies(isSuperAdmin ? allComps : allComps.filter(c => (user?.companyIds || []).includes(c.id) || c.creatorId === user?.id));
        setUsers(allUsers);
    }, [isAdmin, isSuperAdmin, user]);

    const refreshData = () => {
        const allComps = getAllCompanies();
        const allUsers = getAllUsers();
        setCompanies(isSuperAdmin ? allComps : allComps.filter(c => (user?.companyIds || []).includes(c.id) || c.creatorId === user?.id));
        setUsers(allUsers);
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

        const payload = { ...formData };
        if (!isSuperAdmin && !editCompany) {
            payload.creatorId = user?.id;
        }

        if (editCompany) {
            update(COLLECTIONS.COMPANIES, editCompany.id, payload);
        } else {
            const newCompany = create(COLLECTIONS.COMPANIES, payload);
            if (!isSuperAdmin) {
                // Grant the creator access to the new company immediately
                const currentUserData = users.find(u => u.id === user?.id);
                if (currentUserData) {
                    const newCompanyIds = [...(currentUserData.companyIds || []), newCompany.id];
                    update(COLLECTIONS.USERS, currentUserData.id, { companyIds: newCompanyIds });
                }
            }
        }
        setShowModal(false);
        refreshData();
    };

    const handleDelete = async (c) => {
        const usersInCompany = users.filter(u => (u.companyIds || []).includes(c.id));
        if (usersInCompany.length > 0) {
            await alert(lang !== 'en'
                ? `Ne možete obrisati firmu "${c.naziv}" jer ima ${usersInCompany.length} korisnika.`
                : `Cannot delete company "${c.naziv}" — it has ${usersInCompany.length} users.`);
            return;
        }
        const ok = await confirm(lang !== 'en' ? `Obrisati firmu ${c.naziv}?` : `Delete company ${c.naziv}?`);
        if (ok) {
            remove(COLLECTIONS.COMPANIES, c.id);
            refreshData();
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setLogoError(lang !== 'en' ? 'Samo slike su dozvoljene.' : 'Only images are allowed.');
            return;
        }
        if (file.size > 500000) {
            setLogoError(lang !== 'en' ? 'Logo mora biti manji od 500KB' : 'Logo must be under 500KB');
            return;
        }
        setLogoError('');
        const reader = new FileReader();
        reader.onload = (ev) => setFormData(p => ({ ...p, logo: ev.target.result }));
        reader.readAsDataURL(file);
    };

    const getUsersForCompany = (compId) => {
        const c = companies.find(comp => comp.id === compId);
        return users.filter(u => {
            if ((u.companyIds || []).includes(compId)) return true;
            if (c && c.parentId && (u.companyIds || []).includes(c.parentId)) return true;
            return false;
        });
    };

    const toggleOfficerAssignment = (officerId) => {
        if (!editCompany) return;
        const officer = users.find(u => u.id === officerId);
        if (!officer) return;
        const assigned = officer.companyIds || [];
        const isAssigned = assigned.includes(editCompany.id);
        const newIds = isAssigned 
            ? assigned.filter(id => id !== editCompany.id)
            : [...assigned, editCompany.id];
            
        update(COLLECTIONS.USERS, officer.id, { companyIds: newIds });
        refreshData();
    };

    const assignableUsers = users.filter(u => (u.role === 'officer' || u.role === 'admin') && u.aktivan !== false);

    if (!isAdmin) return null;

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            <PageHeader 
                icon="🏢" 
                title={lang !== 'en' ? 'Upravljanje firmama' : 'Company Management'} 
                subtitle={lang !== 'en' ? 'Sve registrirane firme u sistemu' : 'All registered companies in the system'} 
                actions={
                    <button className="btn btn-primary btn-sm" onClick={openNew} style={{ flexShrink: 0 }}>
                        ➕ {lang !== 'en' ? 'Nova firma' : 'New Company'}
                    </button>
                }
            />

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
                                            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {!c.logo && '🏢 '}{c.naziv}
                                                {companies.some(sub => sub.parentId === c.id) && <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(0,191,166,0.1)', color: 'var(--primary)', fontWeight: 800 }}>HOLDING</span>}
                                            </h3>
                                            {c.skraceniNaziv && c.skraceniNaziv !== c.naziv && (
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>{c.skraceniNaziv}</span>
                                            )}
                                            {c.parentId && (() => {
                                                const p = companies.find(comp => comp.id === c.parentId);
                                                return p ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>🔗 {lang !== 'en' ? 'Dio Holdinga:' : 'Part of Holding:'} {p.naziv}</div> : null;
                                            })()}
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
                                        👥 {lang !== 'en' ? 'Korisnici' : 'Users'} ({companyUsers.length})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {companyUsers.map(u => {
                                            const isInherited = !(u.companyIds || []).includes(c.id);
                                            return (
                                                <span key={u.id} style={{
                                                    padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600,
                                                    background: isInherited ? 'rgba(0,191,166,0.1)' : (u.role === 'admin' ? 'rgba(123,31,162,0.15)' : 'rgba(33,150,243,0.12)'),
                                                    color: isInherited ? 'var(--primary)' : (u.role === 'admin' ? '#7B1FA2' : 'var(--info)'),
                                                    border: isInherited ? '1px dashed var(--primary)' : '1px solid transparent'
                                                }}>
                                                    {u.role === 'admin' ? '👑' : '🛡️'} {u.firstName} {u.lastName} {isInherited && '🔗'}
                                                </span>
                                            );
                                        })}
                                        {companyUsers.length === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️ {lang !== 'en' ? 'Uredi' : 'Edit'}</button>
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
                                {editCompany ? '✏️' : '➕'} {editCompany ? (lang !== 'en' ? 'Uredi firmu' : 'Edit Company') : (lang !== 'en' ? 'Nova firma' : 'New Company')}
                            </h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>

                            {/* Puni naziv */}
                            <div className="form-group">
                                <label className="form-label">{lang !== 'en' ? 'Puni naziv' : 'Full name'} *</label>
                                <input className="form-input" value={formData.naziv} onChange={e => setFormData(p => ({ ...p, naziv: e.target.value }))} required />
                            </div>

                            
                            {/* Parent Company */}
                            <div className="form-group" style={{ marginTop: 12 }}>
                                <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 700 }}>🔗 {lang !== 'en' ? 'Pripada Holdingu (Kćerka firma)' : 'Parent Company (Subsidiary)'}</label>
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
                                    <label className="form-label">{lang !== 'en' ? 'Skraćeni naziv' : 'Short name'}</label>
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
                                    <label className="form-label">{lang !== 'en' ? 'Adresa' : 'Address'}</label>
                                    <input className="form-input" value={formData.adresa} onChange={e => setFormData(p => ({ ...p, adresa: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang !== 'en' ? 'Mjesto' : 'City'}</label>
                                    <input className="form-input" value={formData.mjesto} onChange={e => setFormData(p => ({ ...p, mjesto: e.target.value }))} />
                                </div>
                            </div>

                            {/* Poštanski broj + Telefon + Email */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang !== 'en' ? 'Poštanski br.' : 'Postal code'}</label>
                                    <input className="form-input" value={formData.postanskiBroj} onChange={e => setFormData(p => ({ ...p, postanskiBroj: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang !== 'en' ? 'Telefon' : 'Phone'}</label>
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
                                    <label className="form-label">{lang !== 'en' ? 'Direktor' : 'Director'}</label>
                                    <input className="form-input" value={formData.direktor} onChange={e => setFormData(p => ({ ...p, direktor: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang !== 'en' ? 'Stručno lice ZNR' : 'OHS Specialist'}</label>
                                    <input className="form-input" value={formData.strucnoLice} onChange={e => setFormData(p => ({ ...p, strucnoLice: e.target.value }))} />
                                </div>
                            </div>

                            {/* Logo upload — same as Postavke */}
                            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10 }}>🖼️ {lang !== 'en' ? 'Logo firme' : 'Company Logo'}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                                    {formData.logo ? (
                                        <img src={formData.logo} alt="Logo" style={{ height: 56, maxWidth: 180, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4, border: '1px solid var(--border-light)' }} />
                                    ) : (
                                        <div style={{ height: 56, width: 100, borderRadius: 8, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                            {lang !== 'en' ? 'Nema loga' : 'No logo'}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                        <label style={{ cursor: 'pointer', padding: '7px 14px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.8rem', display: 'inline-block' }}>
                                            📁 {lang !== 'en' ? 'Učitaj logo' : 'Upload Logo'}
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                                        </label>
                                        {logoError && <div style={{ fontSize: '0.73rem', color: 'var(--danger)', fontWeight: 600 }}>⚠️ {logoError}</div>}
                                        {formData.logo && (
                                            <button onClick={() => setFormData(p => ({ ...p, logo: '' }))} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                                                🗑️ {lang !== 'en' ? 'Ukloni logo' : 'Remove Logo'}
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        {lang !== 'en' ? 'PNG ili SVG, max 500KB.' : 'PNG or SVG, max 500KB.'}
                                    </div>
                                </div>
                            </div>

                            {editCompany && assignableUsers.length > 0 && (
                              <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12 }}>👮 {lang !== 'en' ? 'Dodijeljeni korisnici (Admini i Stručnjaci)' : 'Assigned Users (Admins and Officers)'}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                  {assignableUsers.map(officer => {
                                    const isDirectlyAssigned = (officer.companyIds || []).includes(editCompany.id);
                                    const isInherited = editCompany.parentId && (officer.companyIds || []).includes(editCompany.parentId);
                                    const isAssigned = isDirectlyAssigned || isInherited;
                                    return (
                                      <button
                                        key={officer.id}
                                        type="button"
                                        onClick={() => {
                                            if (isInherited) return; // Cannot toggle inherited assignment directly here
                                            toggleOfficerAssignment(officer.id);
                                        }}
                                        disabled={isInherited}
                                        title={isInherited ? (lang !== 'en' ? 'Naslijeđen pristup preko holdinga' : 'Inherited access via holding') : ''}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: 6,
                                          padding: '4px 10px', borderRadius: 20, cursor: isInherited ? 'default' : 'pointer',
                                          border: `1px solid ${isAssigned ? 'var(--primary)' : 'var(--border)'}`,
                                          background: isAssigned ? 'rgba(0,191,166,0.1)' : 'transparent',
                                          color: isAssigned ? 'var(--primary)' : 'var(--text-muted)',
                                          fontWeight: isAssigned ? 700 : 600, fontSize: '0.75rem',
                                          transition: 'all 0.2s',
                                          opacity: isInherited ? 0.75 : 1
                                        }}
                                      >
                                        <span>{isInherited ? '🔗' : (isDirectlyAssigned ? '✅' : '➕')}</span>
                                        {officer.firstName} {officer.lastName}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Aktivna firma */}
                            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" id="aktivan-check" checked={formData.aktivan} onChange={e => setFormData(p => ({ ...p, aktivan: e.target.checked }))} />
                                <label htmlFor="aktivan-check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>{lang !== 'en' ? 'Aktivna firma' : 'Active company'}</label>
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
