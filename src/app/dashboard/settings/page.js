'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import {
  getAll, getById, update, COLLECTIONS, getAllCompanies, getUserCompanies,
} from '@/lib/dataStore';

export default function SettingsPage() {
  const { t, lang, toggleLang } = useLanguage();
  const { user, isAdmin, activeCompanyId, login } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'profile');
  const [saved, setSaved] = useState(false);

  // Profile state
  const [profileData, setProfileData] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [passwordData, setPasswordData] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Company state
  const [companyData, setCompanyData] = useState({ naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '', postanskiBroj: '', telefon: '', email: '', direktor: '', strucnoLice: '' });

  // Load profile data
  useEffect(() => {
    if (user) {
      const dbUser = getAll(COLLECTIONS.USERS).find(u => u.id === user.id);
      if (dbUser) {
        setProfileData({
          firstName: dbUser.firstName || '',
          lastName: dbUser.lastName || '',
          email: dbUser.email || '',
          phone: dbUser.phone || '',
        });
      }
    }
  }, [user]);

  // Load company data when activeCompanyId changes
  useEffect(() => {
    if (activeCompanyId) {
      const company = getById(COLLECTIONS.COMPANIES, activeCompanyId);
      if (company) {
        setCompanyData({
          naziv: company.naziv || '', skraceniNaziv: company.skraceniNaziv || '',
          oib: company.oib || '', adresa: company.adresa || '',
          mjesto: company.mjesto || '', postanskiBroj: company.postanskiBroj || '',
          telefon: company.telefon || '', email: company.email || '',
          direktor: company.direktor || '', strucnoLice: company.strucnoLice || '',
        });
      }
    }
  }, [activeCompanyId]);

  // Update tab from URL param
  useEffect(() => {
    if (tabParam && ['profile', 'company', 'app'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const handleSaveProfile = () => {
    if (!user?.id) return;
    update(COLLECTIONS.USERS, user.id, {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email,
      phone: profileData.phone,
    });
    // Update auth context
    login({ ...user, firstName: profileData.firstName, lastName: profileData.lastName, email: profileData.email });
    showSaved();
  };

  const handleChangePassword = () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!passwordData.current || !passwordData.newPass) {
      setPasswordError(lang === 'bs' ? 'Sva polja su obavezna!' : 'All fields are required!');
      return;
    }
    if (passwordData.newPass !== passwordData.confirm) {
      setPasswordError(lang === 'bs' ? 'Nove lozinke se ne podudaraju!' : 'New passwords do not match!');
      return;
    }
    const dbUser = getAll(COLLECTIONS.USERS).find(u => u.id === user.id);
    if (!dbUser || dbUser.password !== passwordData.current) {
      setPasswordError(lang === 'bs' ? 'Trenutna lozinka je netočna!' : 'Current password is incorrect!');
      return;
    }
    update(COLLECTIONS.USERS, user.id, { password: passwordData.newPass });
    setPasswordSuccess(lang === 'bs' ? 'Lozinka uspješno promijenjena!' : 'Password successfully changed!');
    setPasswordData({ current: '', newPass: '', confirm: '' });
  };

  const handleSaveCompany = () => {
    if (!activeCompanyId) return;
    update(COLLECTIONS.COMPANIES, activeCompanyId, companyData);
    showSaved();
  };

  const tabs = [
    { key: 'profile', label: lang === 'bs' ? 'Korisnički profil' : 'User Profile', icon: '👤' },
    { key: 'company', label: lang === 'bs' ? 'Podaci o firmi' : 'Company Data', icon: '🏢' },
    { key: 'app', label: lang === 'bs' ? 'Postavke aplikacije' : 'App Settings', icon: '⚙️' },
  ];

  return (
    <div className="animate-fadeIn">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>⚙️ {t('settings')}</h1>

      {/* Success toast */}
      {saved && (
        <div style={{
          position: 'fixed', top: 90, right: 24, zIndex: 500,
          padding: '12px 24px', borderRadius: 12,
          background: '#E8F5E9', border: '1px solid #A5D6A7',
          color: '#2E7D32', fontWeight: 600, fontSize: '0.85rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)', animation: 'fadeIn 0.3s',
        }}>
          ✅ {lang === 'bs' ? 'Spremljeno!' : 'Saved!'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setActiveTab(tb.key)} style={{
            padding: '12px 24px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.85rem',
            background: activeTab === tb.key ? 'var(--dark)' : 'white',
            color: activeTab === tb.key ? 'white' : 'var(--text)',
            boxShadow: activeTab === tb.key ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            transition: 'all 0.2s',
          }}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      {/* ── Profile Tab ── */}
      {activeTab === 'profile' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>👤 {lang === 'bs' ? 'Korisnički profil' : 'User Profile'}</h3>

            {/* Avatar & role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 16, borderRadius: 12, background: 'var(--bg-input)' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: isAdmin ? 'linear-gradient(135deg, #7B1FA2, #E040FB)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 800, fontSize: '1.2rem', fontFamily: 'var(--font-heading)',
              }}>
                {profileData.firstName?.[0]}{profileData.lastName?.[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{profileData.firstName} {profileData.lastName}</div>
                <span style={{
                  display: 'inline-block', marginTop: 4,
                  padding: '2px 10px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700,
                  background: isAdmin ? 'linear-gradient(135deg, #7B1FA2, #E040FB)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  color: 'white',
                }}>
                  {isAdmin ? '👑 Admin' : (lang === 'bs' ? '🛡️ Stručnjak ZNR' : '🛡️ Safety Officer')}
                </span>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>@{user?.username}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">{t('firstName')}</label>
                <input className="form-input" value={profileData.firstName} onChange={e => setProfileData(p => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('lastName')}</label>
                <input className="form-input" value={profileData.lastName} onChange={e => setProfileData(p => ({ ...p, lastName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={profileData.email} onChange={e => setProfileData(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('phone')}</label>
                <input className="form-input" value={profileData.phone} onChange={e => setProfileData(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleSaveProfile}>💾 {t('save')}</button>
            </div>

            <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <h4 style={{ marginBottom: 16 }}>🔐 {lang === 'bs' ? 'Promjena lozinke' : 'Change Password'}</h4>
            {passwordError && <div style={{ padding: '8px 14px', borderRadius: 8, background: '#FFEBEE', color: '#C62828', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>⚠️ {passwordError}</div>}
            {passwordSuccess && <div style={{ padding: '8px 14px', borderRadius: 8, background: '#E8F5E9', color: '#2E7D32', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>✅ {passwordSuccess}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Trenutna lozinka' : 'Current password'}</label>
                <input className="form-input" type="password" value={passwordData.current} onChange={e => setPasswordData(p => ({ ...p, current: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Nova lozinka' : 'New password'}</label>
                <input className="form-input" type="password" value={passwordData.newPass} onChange={e => setPasswordData(p => ({ ...p, newPass: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('confirmPassword')}</label>
                <input className="form-input" type="password" value={passwordData.confirm} onChange={e => setPasswordData(p => ({ ...p, confirm: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleChangePassword}>🔐 {lang === 'bs' ? 'Promijeni lozinku' : 'Change Password'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Company Tab ── */}
      {activeTab === 'company' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>🏢 {lang === 'bs' ? 'Podaci o firmi' : 'Company Data'}</h3>
            {!activeCompanyId ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                {lang === 'bs' ? 'Odaberite firmu kroz birač firma u gornjem meniju.' : 'Select a company from the company switcher in the top menu.'}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Naziv firme' : 'Company name'}</label><input className="form-input" value={companyData.naziv} onChange={e => setCompanyData(p => ({ ...p, naziv: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Skraćeni naziv' : 'Short name'}</label><input className="form-input" value={companyData.skraceniNaziv} onChange={e => setCompanyData(p => ({ ...p, skraceniNaziv: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'ID broj / OIB' : 'ID number'}</label><input className="form-input" value={companyData.oib} onChange={e => setCompanyData(p => ({ ...p, oib: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('address')}</label><input className="form-input" value={companyData.adresa} onChange={e => setCompanyData(p => ({ ...p, adresa: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('city')}</label><input className="form-input" value={companyData.mjesto} onChange={e => setCompanyData(p => ({ ...p, mjesto: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Poštanski broj' : 'Postal code'}</label><input className="form-input" value={companyData.postanskiBroj} onChange={e => setCompanyData(p => ({ ...p, postanskiBroj: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('phone')}</label><input className="form-input" value={companyData.telefon} onChange={e => setCompanyData(p => ({ ...p, telefon: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={companyData.email} onChange={e => setCompanyData(p => ({ ...p, email: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Direktor' : 'Director'}</label><input className="form-input" value={companyData.direktor} onChange={e => setCompanyData(p => ({ ...p, direktor: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Stručno lice ZNR' : 'OHS Specialist'}</label><input className="form-input" value={companyData.strucnoLice} onChange={e => setCompanyData(p => ({ ...p, strucnoLice: e.target.value }))} /></div>
                </div>
                <div style={{ marginTop: 20 }}><button className="btn btn-primary" onClick={handleSaveCompany}>💾 {t('save')}</button></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── App Settings Tab ── */}
      {activeTab === 'app' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>⚙️ {lang === 'bs' ? 'Postavke aplikacije' : 'Application Settings'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">{t('language')}</label>
                <select className="form-select" value={lang} onChange={e => toggleLang()}>
                  <option value="bs">🇧🇦 Bosanski</option>
                  <option value="en">🇬🇧 English</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Format datuma' : 'Date format'}</label>
                <select className="form-select" defaultValue="dd.mm.yyyy">
                  <option value="dd.mm.yyyy">DD.MM.YYYY.</option>
                  <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                  <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Stavki po stranici' : 'Items per page'}</label>
                <select className="form-select" defaultValue="10">
                  <option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked />
                  {lang === 'bs' ? 'Prikaži obavijesti' : 'Show notifications'}
                </label>
              </div>
            </div>
            <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <div className="alert alert-info">
              ℹ️ eZNR v1.0.0 — {lang === 'bs' ? 'Digitalna platforma za zaštitu na radu u BiH' : 'Digital Platform for Occupational Safety in BiH'}
            </div>
            <div style={{ marginTop: 20 }}><button className="btn btn-primary">💾 {t('save')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
