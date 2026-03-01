'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    getAll, create, update, remove, COLLECTIONS, getAllCompanies, getAllUsers, formatDate,
} from '@/lib/dataStore';

export default function AdminCompaniesPage() {
    const { t, lang } = useLanguage();
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [companies, setCompanies] = useState([]);
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editCompany, setEditCompany] = useState(null);
    const [formData, setFormData] = useState({
        naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '',
        postanskiBroj: '', telefon: '', email: '', direktor: '', aktivan: true,
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

    const openNew = () => {
        setEditCompany(null);
        setFormData({ naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '', postanskiBroj: '', telefon: '', email: '', direktor: '', aktivan: true });
        setShowModal(true);
    };

    const openEdit = (c) => {
        setEditCompany(c);
        setFormData({
            naziv: c.naziv || '', skraceniNaziv: c.skraceniNaziv || '', oib: c.oib || '',
            adresa: c.adresa || '', mjesto: c.mjesto || '', postanskiBroj: c.postanskiBroj || '',
            telefon: c.telefon || '', email: c.email || '', direktor: c.direktor || '',
            aktivan: c.aktivan !== false,
        });
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

    const handleDelete = (c) => {
        const usersInCompany = users.filter(u => (u.companyIds || []).includes(c.id));
        if (usersInCompany.length > 0) {
            alert(lang === 'bs'
                ? `Ne možete obrisati firmu "${c.naziv}" jer ima ${usersInCompany.length} korisnika.`
                : `Cannot delete company "${c.naziv}" — it has ${usersInCompany.length} users.`);
            return;
        }
        if (confirm(lang === 'bs' ? `Obrisati firmu ${c.naziv}?` : `Delete company ${c.naziv}?`)) {
            remove(COLLECTIONS.COMPANIES, c.id);
            refreshData();
        }
    };

    const getUsersForCompany = (compId) => users.filter(u => (u.companyIds || []).includes(compId));

    if (!isAdmin) return null;

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dark)' }}>
                        🏢 {lang === 'bs' ? 'Upravljanje firmama' : 'Company Management'}
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {lang === 'bs' ? 'Sve registrirane firme u sistemu' : 'All registered companies in the system'}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    ➕ {lang === 'bs' ? 'Nova firma' : 'New Company'}
                </button>
            </div>

            {/* Company Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {companies.map(c => {
                    const companyUsers = getUsersForCompany(c.id);
                    return (
                        <div key={c.id} className="card" style={{ borderLeft: `4px solid ${c.aktivan !== false ? 'var(--primary)' : '#ccc'}`, opacity: c.aktivan === false ? 0.6 : 1 }}>
                            <div className="card-body" style={{ padding: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div>
                                        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                                            🏢 {c.naziv}
                                        </h3>
                                        {c.skraceniNaziv && c.skraceniNaziv !== c.naziv && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.skraceniNaziv}</span>
                                        )}
                                    </div>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                                        background: c.aktivan !== false ? '#E8F5E9' : '#FFEBEE',
                                        color: c.aktivan !== false ? '#2E7D32' : '#C62828',
                                    }}>
                                        {c.aktivan !== false ? '✅ Aktivna' : '⛔ Neaktivna'}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {c.mjesto && <div>📍 {c.adresa ? `${c.adresa}, ` : ''}{c.mjesto}</div>}
                                    {c.telefon && <div>📞 {c.telefon}</div>}
                                    {c.email && <div>📧 {c.email}</div>}
                                    {c.oib && <div>🆔 OIB: {c.oib}</div>}
                                    {c.direktor && <div>👤 {c.direktor}</div>}
                                </div>

                                {/* Users in this company */}
                                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                                        👥 {lang === 'bs' ? 'Korisnici' : 'Users'} ({companyUsers.length})
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {companyUsers.map(u => (
                                            <span key={u.id} style={{
                                                padding: '2px 8px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600,
                                                background: u.role === 'admin' ? '#F3E5F5' : '#E3F2FD',
                                                color: u.role === 'admin' ? '#7B1FA2' : '#1565C0',
                                            }}>
                                                {u.role === 'admin' ? '👑' : '🛡️'} {u.firstName} {u.lastName}
                                            </span>
                                        ))}
                                        {companyUsers.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️ {lang === 'bs' ? 'Uredi' : 'Edit'}</button>
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c)}>🗑️</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Company Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                            <h2 style={{ color: 'white' }}>
                                {editCompany ? '✏️' : '➕'} {editCompany ? (lang === 'bs' ? 'Uredi firmu' : 'Edit Company') : (lang === 'bs' ? 'Nova firma' : 'New Company')}
                            </h2>
                            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">{lang === 'bs' ? 'Puni naziv' : 'Full name'} *</label>
                                <input className="form-input" value={formData.naziv} onChange={e => setFormData(p => ({ ...p, naziv: e.target.value }))} required />
                            </div>
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Telefon' : 'Phone'}</label>
                                    <input className="form-input" value={formData.telefon} onChange={e => setFormData(p => ({ ...p, telefon: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{lang === 'bs' ? 'Direktor' : 'Director'}</label>
                                    <input className="form-input" value={formData.direktor} onChange={e => setFormData(p => ({ ...p, direktor: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" checked={formData.aktivan} onChange={e => setFormData(p => ({ ...p, aktivan: e.target.checked }))} />
                                <label style={{ fontSize: '0.85rem' }}>{lang === 'bs' ? 'Aktivna firma' : 'Active company'}</label>
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
