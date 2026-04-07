'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MobileMoreSheet({ isOpen, onClose }) {
    const { user, isAdmin, activeCompany, activeCompanyId, companies, switchCompany, logout } = useAuth();
    const { t, lang, toggleLang } = useLanguage();
    const { isDark, toggleTheme } = useTheme();
    const router = useRouter();
    const [showCompanyMenu, setShowCompanyMenu] = useState(false);

    if (!isOpen) return null;

    const roleBadge = isAdmin ? { label: 'Admin', bg: '#4A148C', color: '#FFF' } : (user?.isManager ? { label: 'Rukovodilac', bg: '#006064', color: '#FFF' } : { label: 'Referent ZNR', bg: '#004D40', color: '#FFF' });

    const handleNav = (path) => {
        onClose();
        router.push(path);
    };

    const handleLogout = async () => {
        if (!window.confirm(t('confirmLogout'))) return;
        try {
            onClose();
            await logout();
            router.push('/');
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const navLinks = [
        { path: '/dashboard/health', icon: '🩺', label: lang === 'bs' ? 'Ljekarski pregledi' : 'Medical Exams' },
        { path: '/dashboard/fire-protection', icon: '🧯', label: lang === 'bs' ? 'Zaštita od požara' : 'Fire Protection' },
        { path: '/dashboard/evacuation', icon: '🏃', label: lang === 'bs' ? 'Plan evakuacije' : 'Evacuation' },
        { path: '/dashboard/fleet', icon: '🚗', label: lang === 'bs' ? 'Vozni park' : 'Fleet' },
        { path: '/dashboard/settings', icon: '⚙️', label: t('settings') }
    ];

    if (isAdmin) {
        navLinks.push({ path: '/dashboard/admin/users', icon: '👑', label: lang === 'bs' ? 'Administracija' : 'Admin Panel', color: '#7B1FA2' });
    }

    return (
        <>
            {/* Backdrop */}
            <div onClick={onClose} style={{
                position: 'fixed', inset: 0, zIndex: 400,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
                animation: 'fadeIn 0.2s ease'
            }} />
            
            {/* Sheet */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
                background: 'var(--bg-card)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
                padding: '24px 20px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
                maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <style>{`
                    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                `}</style>
                
                {/* Drag Handle */}
                <div style={{ width: 40, height: 5, background: 'var(--border)', borderRadius: 10, margin: '0 auto 20px' }} />

                {/* Profile Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                    <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.2rem', flexShrink: 0 }}>
                        {user?.firstName?.[0] || 'K'}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>{user?.firstName} {user?.lastName}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{activeCompany?.naziv || ''}</div>
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: roleBadge.bg, color: roleBadge.color }}>{roleBadge.label}</span>
                    </div>
                </div>

                {/* Company Switcher */}
                <div style={{ marginBottom: 20 }}>
                    <button onClick={() => setShowCompanyMenu(v => !v)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--bg-page)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '1.2rem' }}>🏢</span>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{lang === 'bs' ? 'Aktivna firma' : 'Active Company'}</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>{activeCompanyId === 'all' ? (lang === 'bs' ? 'Sve firme' : 'All companies') : activeCompany?.skraceniNaziv}</div>
                            </div>
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}>▼</span>
                    </button>
                    {showCompanyMenu && (
                        <div style={{ marginTop: 8, background: 'var(--bg-page)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <button onClick={() => { switchCompany('all'); setShowCompanyMenu(false); window.location.reload(); }} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: '1px solid var(--border-light)', fontWeight: activeCompanyId === 'all' ? 700 : 400, display: 'flex', alignItems: 'center', gap: 10 }}>
                                {activeCompanyId === 'all' ? '✅' : '🌐'} {lang === 'bs' ? 'Sve firme (Globalno)' : 'All companies'}
                            </button>
                            {companies.map(c => (
                                <button key={c.id} onClick={() => { switchCompany(c.id); setShowCompanyMenu(false); window.location.reload(); }} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', border: 'none', background: 'transparent', borderBottom: '1px solid var(--border-light)', fontWeight: c.id === activeCompanyId ? 700 : 400, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {c.id === activeCompanyId ? '✅' : '🏛️'} {c.naziv}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ height: 1, background: 'var(--border-light)', margin: '20px 0' }} />

                {/* Navigation Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {navLinks.map((link, idx) => (
                        <button key={idx} onClick={() => handleNav(link.path)} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-page)', border: 'none', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', color: link.color || 'var(--text)' }}>
                            <span style={{ fontSize: '1.4rem' }}>{link.icon}</span>
                            <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{link.label}</span>
                        </button>
                    ))}
                </div>

                <div style={{ height: 1, background: 'var(--border-light)', margin: '20px 0' }} />

                {/* Toggles (Theme / Lang) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    <button onClick={toggleTheme} style={{ padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, color: 'var(--text)' }}>
                        <span style={{ fontSize: '1.2rem' }}>{isDark ? '☀️' : '🌙'}</span>
                        {isDark ? (lang === 'bs' ? 'Svijetla' : 'Light') : (lang === 'bs' ? 'Tamna' : 'Dark')}
                    </button>
                    <button onClick={toggleLang} style={{ padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, color: 'var(--text)' }}>
                        <span style={{ fontSize: '1.2rem' }}>🌍</span>
                        {lang === 'bs' ? 'English' : 'Bosanski'}
                    </button>
                </div>

                {/* Logout Button */}
                <button onClick={handleLogout} style={{ width: '100%', padding: '16px', borderRadius: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1.5px solid rgba(239, 68, 68, 0.4)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem' }}>
                    🚪 {t('logout')}
                </button>
            </div>
        </>
    );
}
