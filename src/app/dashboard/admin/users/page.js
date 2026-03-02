'use client';
import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS, getAllCompanies, formatDate,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

export default function AdminUsersPage() {
    const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
    const { isAdmin, user } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompany, setFilterCompany] = useState('all');
    const [filterRole, setFilterRole] = useState('all');
    const [showCompanyDetail, setShowCompanyDetail] = useState(null);
    const [formData, setFormData] = useState({
        username: '', password: '', firstName: '', lastName: '', email: '',
        role: 'officer', companyIds: [], aktivan: true,
    });

    useEffect(() => {
        if (!isAdmin) { router.push('/dashboard'); return; }
        setUsers(getAll(COLLECTIONS.USERS));
        setCompanies(getAllCompanies());
    }, [isAdmin]);

    const refreshData = () => {
        setUsers(getAll(COLLECTIONS.USERS));
        setCompanies(getAllCompanies());
    };

    // Filtered users based on search, company filter, and role filter
    const filteredUsers = useMemo(() => {
        let result = users;
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
    }, [users, searchTerm, filterCompany, filterRole]);

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

    const handleSave = () => {
        if (!formData.username.trim() || !formData.firstName.trim()) return;
        if (editUser) {
            update(COLLECTIONS.USERS, editUser.id, formData);
        } else {
            if (!formData.password.trim()) return;
            create(COLLECTIONS.USERS, formData);
        }
        setShowModal(false);
        refreshData();
    };

    const handleDelete = (u) => {
        if (u.id === user?.id) return;
        const ok = await confirm(lang === 'bs' ? `Obrisati korisnika ${u.firstName} ${u.lastName}?` : `Delete user ${u.firstName} ${u.lastName}?`); if (ok) {
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                        👑 {lang === 'bs' ? 'Upravljanje korisnicima' : 'User Management'}
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {lang === 'bs' ? 'Kreirajte, uređujte i upravljajte korisničkim računima' : 'Create, edit and manage user accounts'}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    ➕ {lang === 'bs' ? 'Novi korisnik' : 'New User'}
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { label: lang === 'bs' ? 'Ukupno' : 'Total', value: users.length, icon: '👥', color: 'var(--primary)' },
                    { label: 'Admin', value: users.filter(u => u.role === 'admin').length, icon: '👑', color: '#7B1FA2' },
                    { label: lang === 'bs' ? 'Stručnjaci' : 'Officers', value: users.filter(u => u.role === 'officer').length, icon: '🛡️', color: '#1565C0' },
                    { label: lang === 'bs' ? 'Aktivni' : 'Active', value: users.filter(u => u.aktivan !== false).length, icon: '✅', color: '#2E7D32' },
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

            {/* Search & Filter Bar */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-body" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem' }}>🔍</span>
                        <input
                            className="form-input"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={lang === 'bs' ? 'Pretraži korisnike (ime, prezime, email, username)...' : 'Search users (name, email, username)...'}
                            style={{ paddingLeft: 36, borderRadius: 'var(--radius-full)' }}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem',
                            }}>✕</button>
                        )}
                    </div>
                    {/* Company filter */}
                    <select className="form-input" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
                        style={{ width: 200, borderRadius: 'var(--radius-full)', fontSize: '0.82rem' }}>
                        <option value="all">🏢 {lang === 'bs' ? 'Sve firme' : 'All companies'}</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.naziv}</option>
                        ))}
                    </select>
                    {/* Role filter */}
                    <select className="form-input" value={filterRole} onChange={e => setFilterRole(e.target.value)}
                        style={{ width: 160, borderRadius: 'var(--radius-full)', fontSize: '0.82rem' }}>
                        <option value="all">👥 {lang === 'bs' ? 'Sve uloge' : 'All roles'}</option>
                        <option value="admin">👑 Admin</option>
                        <option value="officer">🛡️ Officer</option>
                    </select>
                    {/* Result count */}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {filteredUsers.length} / {users.length}
                    </span>
                </div>
            </div>

            {/* Users Table */}
            <div className="card">
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>{lang === 'bs' ? 'Korisnik' : 'User'}</th>
                                    <th>{lang === 'bs' ? 'Korisničko ime' : 'Username'}</th>
                                    <th>Email</th>
                                    <th>{lang === 'bs' ? 'Uloga' : 'Role'}</th>
                                    <th>{lang === 'bs' ? 'Firme' : 'Companies'}</th>
                                    <th>{lang === 'bs' ? 'Status' : 'Status'}</th>
                                    <th>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                        {searchTerm ? (lang === 'bs' ? 'Nema rezultata pretrage' : 'No search results') : t('noRecords')}
                                    </td></tr>
                                ) : filteredUsers.map((u, idx) => (
                                    <tr key={u.id} style={{ opacity: u.aktivan === false ? 0.5 : 1 }}>
                                        <td>{idx + 1}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    background: u.role === 'admin' ? 'linear-gradient(135deg, #7B1FA2, #E040FB)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontWeight: 700, fontSize: '0.75rem',
                                                }}>
                                                    {u.firstName?.[0]}{u.lastName?.[0]}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.firstName} {u.lastName}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><code style={{ fontSize: '0.82rem' }}>{u.username}</code></td>
                                        <td style={{ fontSize: '0.82rem' }}>{u.email || '—'}</td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
                                                background: u.role === 'admin' ? 'linear-gradient(135deg, #7B1FA2, #E040FB)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                                color: 'white',
                                            }}>
                                                {u.role === 'admin' ? '👑 Admin' : '🛡️ Officer'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {(u.companyIds || []).map(cid => (
                                                    <button key={cid} onClick={() => setShowCompanyDetail(getCompanyById(cid))} style={{
                                                        padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem',
                                                        background: '#E3F2FD', color: '#1565C0', fontWeight: 600,
                                                        border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s',
                                                    }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#1565C0'; e.currentTarget.style.background = '#BBDEFB'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#E3F2FD'; }}
                                                    >
                                                        🏢 {getCompanyName(cid)}
                                                    </button>
                                                ))}
                                                {(u.companyIds || []).length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <button onClick={() => handleToggleActive(u)} style={{
                                                padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                                                border: 'none', cursor: 'pointer',
                                                background: u.aktivan !== false ? '#E8F5E9' : '#FFEBEE',
                                                color: u.aktivan !== false ? '#2E7D32' : '#C62828',
                                            }}>
                                                {u.aktivan !== false ? '✅ Aktivan' : '⛔ Neaktivan'}
                                            </button>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} title="Edit">✏️</button>
                                                {u.id !== user?.id && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u)} title="Delete" style={{ color: 'var(--danger)' }}>🗑️</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* User Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #7B1FA2, #E040FB)' }}>
                            <h2 style={{ color: 'white' }}>
                                {editUser ? '✏️' : '➕'} {editUser ? (lang === 'bs' ? 'Uredi korisnika' : 'Edit User') : (lang === 'bs' ? 'Novi korisnik' : 'New User')}
                            </h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Ime' : 'First name'} *</label>
                                    <input className="form-input" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Prezime' : 'Last name'}</label>
                                    <input className="form-input" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Korisničko ime' : 'Username'} *</label>
                                    <input className="form-input" value={formData.username} onChange={e => setFormData(p => ({ ...p, username: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{editUser ? (lang === 'bs' ? 'Nova lozinka' : 'New password') : (lang === 'bs' ? 'Lozinka' : 'Password')} {!editUser && '*'}</label>
                                    <input className="form-input" type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder={editUser ? '(ne mijenjaj)' : ''} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Uloga' : 'Role'}</label>
                                    <select className="form-input" value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}>
                                        <option value="officer">{lang === 'bs' ? '🛡️ Stručnjak ZNR' : '🛡️ Safety Officer'}</option>
                                        <option value="admin">👑 Admin</option>
                                    </select>
                                </div>
                            </div>

                            {/* Company assignment */}
                            <div style={{ marginTop: 16 }}>
                                <label className="form-label" style={{ marginBottom: 8 }}>{lang === 'bs' ? 'Firme kojima ima pristup' : 'Companies with access'}</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {companies.map(c => (
                                        <button key={c.id} type="button"
                                            onClick={() => toggleCompany(c.id)}
                                            style={{
                                                padding: '6px 12px', borderRadius: 8, fontSize: '0.8rem',
                                                border: formData.companyIds.includes(c.id) ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                background: formData.companyIds.includes(c.id) ? 'rgba(0,191,166,0.1)' : 'white',
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
                                <label style={{ fontSize: '0.85rem' }}>{lang === 'bs' ? 'Aktivan račun' : 'Active account'}</label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={!formData.username.trim() || !formData.firstName.trim()}>
                                💾 {t('save')}
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
                                {showCompanyDetail.skraceniNaziv && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{lang === 'bs' ? 'Skraćeni naziv' : 'Short name'}</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.skraceniNaziv}</div></div>}
                                {showCompanyDetail.oib && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>OIB / JIB</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.oib}</div></div>}
                                {showCompanyDetail.mjesto && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>📍 {lang === 'bs' ? 'Lokacija' : 'Location'}</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.adresa ? `${showCompanyDetail.adresa}, ` : ''}{showCompanyDetail.mjesto}</div></div>}
                                {showCompanyDetail.telefon && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>📞 {lang === 'bs' ? 'Telefon' : 'Phone'}</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.telefon}</div></div>}
                                {showCompanyDetail.email && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>📧 Email</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.email}</div></div>}
                                {showCompanyDetail.direktor && <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>👤 {lang === 'bs' ? 'Direktor' : 'Director'}</div><div style={{ fontWeight: 600 }}>{showCompanyDetail.direktor}</div></div>}
                            </div>
                            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                                    👥 {lang === 'bs' ? 'Korisnici u ovoj firmi' : 'Users in this company'}
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
                                                background: u.role === 'admin' ? '#F3E5F5' : '#E3F2FD',
                                                color: u.role === 'admin' ? '#7B1FA2' : '#1565C0',
                                            }}>{u.role === 'admin' ? '👑 Admin' : '🛡️ Officer'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowCompanyDetail(null)}>{lang === 'bs' ? 'Zatvori' : 'Close'}</button>
                            <button className="btn btn-primary" onClick={() => { setShowCompanyDetail(null); router.push('/dashboard/admin/companies'); }}>
                                🏢 {lang === 'bs' ? 'Upravljanje firmama' : 'Company Management'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
