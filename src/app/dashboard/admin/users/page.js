'use client';
import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS, getAllCompanies,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import PageHeader from '@/components/PageHeader';

export default function AdminUsersPage() {
    const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
    const { isAdmin, isSuperAdmin, user } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompany, setFilterCompany] = useState('all');
    const [filterRole, setFilterRole] = useState('all');
    const [showCompanyDetail, setShowCompanyDetail] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        username: '', password: '', firstName: '', lastName: '', email: '',
        role: 'officer', companyIds: [], aktivan: true,
    });

    useEffect(() => {
        if (!isAdmin) { router.push('/dashboard'); return; }
        setUsers(getAll(COLLECTIONS.USERS));
        const allComps = getAllCompanies();
        setCompanies(isSuperAdmin ? allComps : allComps.filter(c => (user?.companyIds || []).includes(c.id)));
    }, [isAdmin, isSuperAdmin, user]);

    const refreshData = () => {
        setUsers(getAll(COLLECTIONS.USERS));
        const allComps = getAllCompanies();
        setCompanies(isSuperAdmin ? allComps : allComps.filter(c => (user?.companyIds || []).includes(c.id)));
    };

    // Listen for background data-sync so the page populates once users/companies finish loading
    useEffect(() => {
        const handler = () => refreshData();
        window.addEventListener('eznr:data-synced', handler);
        return () => window.removeEventListener('eznr:data-synced', handler);
    }, [isSuperAdmin, user]);

    // Filtered users based on search, company filter, and role filter
    const filteredUsers = useMemo(() => {
        let result = users;
        if (!isSuperAdmin) {
            result = result.filter(u => u.role === 'officer' && ((u.companyIds || []).some(cid => (user?.companyIds || []).includes(cid)) || u.creatorId === user?.id));
        }
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(u =>
                `${u.firstName} ${u.lastName} ${u.username} ${u.email || ''}`.toLowerCase().includes(q)
            );
        }
        if (filterCompany !== 'all') {
            result = result.filter(u => (u.companyIds || []).includes(filterCompany));
        }
        if (filterRole !== 'all') {
            result = result.filter(u => u.role === filterRole);
        }
        return result;
    }, [users, searchTerm, filterCompany, filterRole, isSuperAdmin, user]);

    const openNew = () => {
        setEditUser(null);
        setFormData({ username: '', password: '', firstName: '', lastName: '', email: '', role: 'officer', companyIds: [], aktivan: true });
        setShowModal(true);
    };

    const openEdit = (u) => {
        setEditUser(u);
        setFormData({
            username: u.username, password: u.password || '', firstName: u.firstName,
            lastName: u.lastName, email: u.email || '', role: u.role,
            companyIds: u.companyIds || [], aktivan: u.aktivan !== false,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        // firstName is required; username is optional (Firebase users may not have one)
        if (!formData.firstName.trim()) return;
        const payload = { ...formData };
        if (!isSuperAdmin) {
            payload.role = 'officer';
        }

        setIsSaving(true);
        try {
            if (editUser) {
                update(COLLECTIONS.USERS, editUser.id, payload);
                setShowModal(false);
                refreshData();
            } else {
                if (!payload.email || !payload.password) {
                    await alert(lang !== 'en' ? 'Email i lozinka su obavezni za novog korisnika.' : 'Email and password are required for a new user.');
                    setIsSaving(false);
                    return;
                }

                // Check if user already exists in Firestore cache
                const existingInDb = users.find(u => u.email === payload.email);
                if (existingInDb) {
                    await alert(lang !== 'en' ? 'Korisnik sa ovom email adresom već postoji u bazi.' : 'User with this email already exists in the database.');
                    setIsSaving(false);
                    return;
                }
                
                // 1. Create Firebase Auth user securely
                const res = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: payload.email,
                        password: payload.password,
                        displayName: `${payload.firstName} ${payload.lastName}`.trim()
                    })
                });
                
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Greška prilikom kreiranja korisnika.');
                }
                
                // 2. Save user to Firestore with the new UID
                payload.creatorId = user?.id;
                payload.id = data.uid;
                create(COLLECTIONS.USERS, payload);
                setShowModal(false);
                refreshData();
            }
        } catch (error) {
            await alert(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (u) => {
        if (u.id === user?.id) return;
        const ok = await confirm(lang !== 'en' ? `Obrisati korisnika ${u.firstName} ${u.lastName}?` : `Delete user ${u.firstName} ${u.lastName}?`); if (ok) {
            remove(COLLECTIONS.USERS, u.id);
            refreshData();
        }
    };

    const handleToggleActive = (u) => {
        update(COLLECTIONS.USERS, u.id, { aktivan: !u.aktivan });
        refreshData();
    };

    const toggleCompany = (compId) => {
        setFormData(prev => ({
            ...prev,
            companyIds: prev.companyIds.includes(compId)
                ? prev.companyIds.filter(id => id !== compId)
                : [...prev.companyIds, compId],
        }));
    };

    const getCompanyName = (id) => companies.find(c => c.id === id)?.naziv || id;
    const getCompanyById = (id) => companies.find(c => c.id === id);

    if (!isAdmin) return null;

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />
            {/* Header — stack on mobile */}
            <PageHeader 
                icon="👤" 
                title={lang !== 'en' ? 'Upravljanje korisnicima' : 'User Management'} 
                subtitle={lang !== 'en' ? 'Kreirajte, uređujte i upravljajte korisničkim računima' : 'Create, edit and manage user accounts'} 
                actions={
                    <button className="btn btn-primary btn-sm" onClick={openNew} style={{ flexShrink: 0 }}>
                        ➕ {lang !== 'en' ? 'Novi korisnik' : 'New User'}
                    </button>
                }
            />

            {/* Stats — 2x2 on mobile */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                    { label: lang !== 'en' ? 'Ukupno' : 'Total', value: filteredUsers.length, icon: '👥', color: 'var(--primary)' },
                    ...(isSuperAdmin ? [{ label: 'Superadmin', value: filteredUsers.filter(u => u.role === 'superadmin').length, icon: '👑', color: '#7B1FA2' }] : []),
                    { label: lang !== 'en' ? 'Stručnjaci ZNR i Admini' : 'Officers & Admins', value: filteredUsers.filter(u => u.role === 'officer' || u.role === 'admin' || u.role === 'companyadmin').length, icon: '🛡️', color: 'var(--info)' },
                    { label: lang !== 'en' ? 'Aktivni' : 'Active', value: filteredUsers.filter(u => u.aktivan !== false).length, icon: '✅', color: 'var(--success)' },
                ].map((s, i) => (
                    <div key={i} className="card" style={{ borderLeft: `4px solid ${s.color}` }}>
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                            <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
                            <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filter Bar — stacked on mobile */}
            <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-body" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.85rem' }}>🔍</span>
                        <input
                            className="form-input"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={lang !== 'en' ? 'Pretraži korisnike (ime, prezime, email)...' : 'Search users...'}
                            style={{ paddingLeft: 34, borderRadius: 'var(--radius-full)', width: '100%', boxSizing: 'border-box' }}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem',
                            }}>✕</button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select className="form-input" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
                            style={{ flex: 1, minWidth: 120, borderRadius: 'var(--radius-full)', fontSize: '0.8rem' }}>
                            <option value="all">🏢 {lang !== 'en' ? 'Sve firme' : 'All companies'}</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.naziv}</option>
                            ))}
                        </select>
                        {isSuperAdmin && (
                            <select className="form-input" value={filterRole} onChange={e => setFilterRole(e.target.value)}
                                style={{ flex: 1, minWidth: 110, borderRadius: 'var(--radius-full)', fontSize: '0.8rem' }}>
                                <option value="all">👥 {lang !== 'en' ? 'Sve uloge' : 'All roles'}</option>
                                <option value="superadmin">👑 Superadmin</option>
                                <option value="officer">🛡️ {lang !== 'en' ? 'Stručnjak ZNR' : 'Officer'}</option>
                                <option value="admin">⚙️ Admin</option>
                            </select>
                        )}
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {filteredUsers.length} / {users.length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Users — card-based layout (works on all screen sizes) */}
            {filteredUsers.length === 0 ? (
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        {searchTerm ? (lang !== 'en' ? 'Nema rezultata pretrage' : 'No search results') : t('noRecords')}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredUsers.map((u) => {
                        const roleMap = {
                            superadmin: { label: '👑 Superadmin', bg: 'linear-gradient(135deg, #E65100, #FF6D00)' },
                            admin:      { label: '⚙️ Admin',      bg: 'linear-gradient(135deg, #7B1FA2, #E040FB)' },
                            officer:    { label: '🛡️ Stručnjak ZNR', bg: 'linear-gradient(135deg, var(--primary), var(--secondary))' },
                            companyadmin: { label: '🛡️ Stručnjak ZNR', bg: 'linear-gradient(135deg, var(--primary), var(--secondary))' },
                        };
                        const role = roleMap[u.role] || roleMap.officer;
                        return (
                            <div key={u.id} className="card" style={{ opacity: u.aktivan === false ? 0.55 : 1 }}>
                                <div className="card-body" style={{ padding: '12px 14px' }}>
                                    {/* Top: avatar + name + edit/delete */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <div style={{
                                            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                                            background: u.role === 'admin' || u.role === 'superadmin' ? 'linear-gradient(135deg, #7B1FA2, #E040FB)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 700, fontSize: '0.85rem',
                                        }}>
                                            {u.firstName?.[0]}{u.lastName?.[0]}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.firstName} {u.lastName}</div>
                                            {u.username && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{u.username}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>✏️</button>
                                            {u.id !== user?.id && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u)} style={{ color: 'var(--danger)' }}>🗑️</button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Role + status badges */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: role.bg, color: 'white' }}>
                                            {role.label}
                                        </span>
                                        <button onClick={() => handleToggleActive(u)} style={{
                                            padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                                            border: 'none', cursor: 'pointer',
                                            background: u.aktivan !== false ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)',
                                            color: u.aktivan !== false ? 'var(--success)' : 'var(--danger)',
                                        }}>
                                            {u.aktivan !== false ? '✅ Aktivan' : '⛔ Neaktivan'}
                                        </button>
                                    </div>
                                    {/* Email */}
                                    {u.email && (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6, wordBreak: 'break-all' }}>
                                            📧 {u.email}
                                        </div>
                                    )}
                                    {/* Companies */}
                                    {(u.companyIds || []).length> 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {(u.companyIds || []).map(cid => (
                                                <button key={cid} onClick={() => setShowCompanyDetail(getCompanyById(cid))} style={{
                                                    padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem',
                                                    background: 'rgba(33,150,243,0.10)', color: 'var(--info)', fontWeight: 600,
                                                    border: '1px solid transparent', cursor: 'pointer',
                                                }}>
                                                    🏢 {getCompanyName(cid)}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* User Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #7B1FA2, #E040FB)' }}>
                            <h2 style={{ color: 'white' }}>
                                {editUser ? '✏️' : '➕'} {editUser ? (lang !== 'en' ? 'Uredi korisnika' : 'Edit User') : (lang !== 'en' ? 'Novi korisnik' : 'New User')}
                            </h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang !== 'en' ? 'Ime' : 'First name'} *</label>
                                    <input className="form-input" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang !== 'en' ? 'Prezime' : 'Last name'}</label>
                                    <input className="form-input" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang !== 'en' ? 'Korisničko ime' : 'Username'} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>({lang !== 'en' ? 'opcionalno' : 'optional'})</span></label>
                                    <input className="form-input" value={formData.username || ''} onChange={e => setFormData(p => ({ ...p, username: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{editUser ? (lang !== 'en' ? 'Nova lozinka' : 'New password') : (lang !== 'en' ? 'Lozinka' : 'Password')} {!editUser && '*'}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            className="form-input" 
                                            type={showPassword ? "text" : "password"} 
                                            value={formData.password || ''} 
                                            onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} 
                                            placeholder={editUser ? '(ne mijenjaj)' : ''} 
                                            style={{ paddingRight: 36 }}
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ 
                                                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', 
                                                background: 'none', border: 'none', cursor: 'pointer', 
                                                fontSize: '1.1rem', opacity: 0.6, padding: 4 
                                            }}
                                            title={showPassword ? (lang !== 'en' ? 'Sakrij lozinku' : 'Hide password') : (lang !== 'en' ? 'Prikaži lozinku' : 'Show password')}>
                                            {showPassword ? '👁️' : '👁️‍🗨️'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Email (KORISTI SE ZA PRIJAVU)</label>
                                    <input className="form-input" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang !== 'en' ? 'Uloga' : 'Role'}</label>
                                    <select className="form-input" value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))} disabled={!isSuperAdmin}>
                                        <option value="officer">{lang !== 'en' ? '🛡️ Stručnjak ZNR' : '🛡️ Safety Officer'}</option>
                                        {isSuperAdmin && <option value="admin">⚙️ Admin</option>}
                                        {isSuperAdmin && <option value="superadmin">👑 Superadmin</option>}
                                    </select>
                                </div>
                            </div>

                            {/* Company assignment */}
                            <div style={{ marginTop: 16 }}>
                                <label className="form-label" style={{ marginBottom: 8 }}>{lang !== 'en' ? 'Firme kojima ima pristup' : 'Companies with access'}</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {companies.map(c => (
                                        <button key={c.id} type="button"
                                            onClick={() => toggleCompany(c.id)}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, fontSize: '0.8rem',
                                                border: formData.companyIds.includes(c.id) ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                background: formData.companyIds.includes(c.id) ? 'rgba(0,191,166,0.1)' : 'var(--bg-card)',
                                                color: formData.companyIds.includes(c.id) ? 'var(--primary)' : 'var(--text)',
                                                fontWeight: formData.companyIds.includes(c.id) ? 700 : 400,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                            }}>
                                            {formData.companyIds.includes(c.id) ? '✅' : '🏛️'} {c.naziv}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={formData.aktivan} onChange={e => setFormData(p => ({ ...p, aktivan: e.target.checked }))} />
                                <label style={{ fontSize: '0.85rem' }}>{lang !== 'en' ? 'Aktivan račun' : 'Active account'}</label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={isSaving}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!formData.firstName.trim() || isSaving}>
                                {isSaving ? '⏳...' : `💾 ${t('save')}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Company Detail Modal — shown when clicking a company badge */}
            {showCompanyDetail && (
                <div className="modal-overlay" onClick={() => setShowCompanyDetail(null)}>
                    <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                            <h2 style={{ color: 'white' }}>🏢 {showCompanyDetail.naziv}</h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowCompanyDetail(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                                {showCompanyDetail.skraceniNaziv && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{lang !== 'en' ? 'Skraćeni naziv' : 'Short name'}</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.skraceniNaziv}</div></div>}
                                {showCompanyDetail.oib && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>OIB / JIB</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.oib}</div></div>}
                                {showCompanyDetail.mjesto && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>📍 {lang !== 'en' ? 'Lokacija' : 'Location'}</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.adresa ? `${showCompanyDetail.adresa}, ` : ''}{showCompanyDetail.mjesto}</div></div>}
                                {showCompanyDetail.telefon && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>📞 {lang !== 'en' ? 'Telefon' : 'Phone'}</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.telefon}</div></div>}
                                {showCompanyDetail.email && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>📧 Email</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.email}</div></div>}
                                {showCompanyDetail.direktor && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>👤 {lang !== 'en' ? 'Direktor' : 'Director'}</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.direktor}</div></div>}
                            </div>
                            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                                    👥 {lang !== 'en' ? 'Korisnici u ovoj firmi' : 'Users in this company'}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {users.filter(u => (u.companyIds || []).includes(showCompanyDetail.id)).map(u => (
                                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-input)' }}>
                                            <div style={{
                                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                                background: u.role === 'admin' ? 'linear-gradient(135deg, #7B1FA2, #E040FB)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 700, fontSize: '0.65rem',
                                            }}>{u.firstName?.[0]}{u.lastName?.[0]}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{u.firstName} {u.lastName}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.username}</div>
                                            </div>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 8, fontSize: '0.65rem', fontWeight: 700,
                                                background: u.role === 'admin' ? 'rgba(123,31,162,0.15)' : 'rgba(33,150,243,0.12)',
                                                color: u.role === 'admin' ? '#7B1FA2' : 'var(--info)',
                                            }}>{u.role === 'admin' ? '👑 Admin' : '🛡️ Officer'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowCompanyDetail(null)}>{lang !== 'en' ? 'Zatvori' : 'Close'}</button>
                            <button className="btn btn-primary" onClick={() => { setShowCompanyDetail(null); router.push('/dashboard/admin/companies'); }}>
                                🏢 {lang !== 'en' ? 'Upravljanje firmama' : 'Company Management'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
