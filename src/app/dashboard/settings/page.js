'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getAll, getById, update, getRawAll, COLLECTIONS,
} from '@/lib/dataStore';
import {
  getNotificationSettings, saveNotificationSettings, apiSaveNotifSettings,
  getAppSettings, saveAppSettings,
  getSystemStats, APP_VERSION, APP_BUILD_DATE, CHANGELOG,
} from '@/lib/systemMonitor';
import {
  getUserLog, getAdminLog, clearUserLog, clearAdminLog, formatLogTime, getSeverityColors,
  getOnlineUsers, humanizePage,
} from '@/lib/activityLog';
import { syncAllToFirebase, getSyncStats } from '@/lib/firebaseSync';
import { seedMockDataConfig } from '@/lib/mockDataGenerator';
import { useDialog } from '@/hooks/useDialog';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { isWebAuthnAvailable, hasStoredCredential, registerCredential } from '@/lib/webAuthn';

export default function SettingsPage() {
  const { t, lang, toggleLang } = useLanguage();
  const { user, isAdmin, activeCompanyId, login, changePassword, changeEmail, changeName } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'activity');
  const [saved, setSaved] = useState(false);
  // Dirty-tracking: which tab has unsaved edits (null = clean)
  const [dirtyTab, setDirtyTab] = useState(null);
  const [logoError, setLogoError] = useState('');

  const { choose, alert, confirm, DialogRenderer } = useDialog();

  // Profile state
  const [profileData, setProfileData] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [passwordData, setPasswordData] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Company state
  const [companyData, setCompanyData] = useState({ naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '', postanskiBroj: '', telefon: '', email: '', direktor: '', strucnoLice: '', logo: '' });
  const [assignedOfficers, setAssignedOfficers] = useState([]);

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState(getNotificationSettings());

  // App settings state
  const [appSettings, setAppSettings] = useState(getAppSettings());

  // Stats (admin only)
  const stats = useMemo(() => isAdmin ? getSystemStats() : null, [isAdmin]);

  // Activity log state
  const [logFilter, setLogFilter] = useState(null);
  const [logRefresh, setLogRefresh] = useState(0);
  const userLog = useMemo(() => getUserLog(100, logFilter, activeCompanyId), [logFilter, logRefresh, activeCompanyId]);
  const adminLog = useMemo(() => getAdminLog(100, logFilter, activeCompanyId), [logFilter, logRefresh, activeCompanyId]);
  const onlineUsers = useMemo(() => getOnlineUsers(), [logRefresh]);


  // Firebase Sync state (admin only)
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const syncStats = useMemo(() => isAdmin ? getSyncStats() : {}, [isAdmin]);

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

  // Load company data
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
          logo: company.logo || '',
        });
      }
      if (isAdmin) {
        const hasAccess = getRawAll(COLLECTIONS.USERS).filter(u => u.role === 'officer' && (u.companyIds || []).includes(activeCompanyId));
        setAssignedOfficers(hasAccess.map(o => o.id));
      }
    }
  }, [activeCompanyId, isAdmin]);

  const allOfficersList = useMemo(() => {
    if (!isAdmin) return [];
    return getRawAll(COLLECTIONS.USERS).filter(u => u.role === 'officer' && u.aktivan !== false);
  }, [isAdmin]);

  const toggleOfficerAssignment = (officerId) => {
    const officer = getRawAll(COLLECTIONS.USERS).find(u => u.id === officerId);
    if (!officer || !activeCompanyId) return;
    
    const assigned = officer.companyIds || [];
    const isAssigned = assigned.includes(activeCompanyId);
    const newIds = isAssigned 
      ? assigned.filter(id => id !== activeCompanyId)
      : [...assigned, activeCompanyId];
      
    update(COLLECTIONS.USERS, officer.id, { companyIds: newIds });
    setAssignedOfficers(prev => isAssigned ? prev.filter(id => id !== officerId) : [...prev, officerId]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Update tab from URL param
  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  const handleAllSaves = async () => {
    if (activeTab === 'profile') return handleSaveProfile();
    if (activeTab === 'company') return handleSaveCompany();
    if (activeTab === 'notifications') return handleSaveNotifSettings();
  };
  const { markDirty, markClean } = useUnsavedChanges(handleAllSaves);

  // NOTE: validTabs and currentTab are derived after the tabs array is defined below

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  
  const setDirty = (tabKey) => {
    setDirtyTab(tabKey);
    markDirty();
  };
  
  const clearDirty = () => {
    setDirtyTab(null);
    markClean();
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    
    try {
      if (user.email !== profileData.email) {
        await changeEmail(profileData.email);
      }
      if (user.firstName !== profileData.firstName || user.lastName !== profileData.lastName) {
        await changeName(profileData.firstName, profileData.lastName);
      }
    } catch (e) {
      alert(lang === 'bs' ? `Greška pri ažuriranju emaila/imena u Firebase: ${e.message}` : `Firebase update error: ${e.message}`);
      return; 
    }

    update(COLLECTIONS.USERS, user.id, {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email,
      phone: profileData.phone,
    });
    login({ ...user, firstName: profileData.firstName, lastName: profileData.lastName, email: profileData.email });
    clearDirty(); showSaved();
  };

  const handleChangePassword = async () => {
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
    if (passwordData.newPass.length < appSettings.minPasswordLength) {
      setPasswordError(lang === 'bs' ? `Lozinka mora imati barem ${appSettings.minPasswordLength} znakova!` : `Password must be at least ${appSettings.minPasswordLength} characters!`);
      return;
    }
    const dbUser = getAll(COLLECTIONS.USERS).find(u => u.id === user.id);
    if (!dbUser || dbUser.password !== passwordData.current) {
      setPasswordError(lang === 'bs' ? 'Trenutna lozinka je netočna!' : 'Current password is incorrect!');
      return;
    }
    try {
      await changePassword(passwordData.newPass);
      update(COLLECTIONS.USERS, user.id, { password: passwordData.newPass });
      setPasswordSuccess(lang === 'bs' ? 'Lozinka uspješno promijenjena!' : 'Password successfully changed!');
      setPasswordData({ current: '', newPass: '', confirm: '' });
    } catch (e) {
      setPasswordError(lang === 'bs' ? 'Greška (možda se trebate ponovo prijaviti): ' + e.message : 'Error (requires recent login): ' + e.message);
    }
  };

  const handleSaveCompany = () => {
    if (!activeCompanyId) return;
    update(COLLECTIONS.COMPANIES, activeCompanyId, companyData);
    clearDirty(); showSaved();
  };

  const handleSaveNotifSettings = async () => {
    // 1) Always keep localStorage in sync (used by in-app notification system)
    saveNotificationSettings(notifSettings);

    // 2) Persist to Firestore via server API (Admin SDK bypasses auth rules)
    //    The client SDK cannot write directly — app uses localStorage auth, not Firebase Auth
    const cId = activeCompanyId;
    if (cId) {
      await apiSaveNotifSettings(cId, notifSettings);
    }

    clearDirty(); showSaved();
  };

  const handleSaveAppSettings = () => {
    saveAppSettings(appSettings);
    clearDirty(); showSaved();
  };

  const updateNotif = (key, value) => { setNotifSettings(prev => ({ ...prev, [key]: value })); setDirty('notifications'); };
  const updateApp = (key, value) => { setAppSettings(prev => ({ ...prev, [key]: value })); setDirty('display'); };
  // Dirty-aware setters for profile / company inline inputs
  const setProfileDirty = (updater) => { setProfileData(updater); setDirty('profile'); };
  const setCompanyDirty = (updater) => { setCompanyData(updater); setDirty('company'); };

  const handleRunSync = async () => {
    if (!activeCompanyId) return;
    const isConfirmed = await confirm(lang === 'bs' 
      ? 'Ova akcija će učitati sve lokalne podatke na Firebase za TRENUTNU KOMPANIJU. Da li ste sigurni?' 
      : 'This will upload all local data to Firebase for the CURRENT COMPANY. Are you sure?');
    if (!isConfirmed) return;
      
    setIsSyncing(true);
    setSyncStatus(lang === 'bs' ? 'Pokrećem učitavanje na oblak...' : 'Starting cloud sync...');
    setSyncResults(null);
    try {
      const { results, errors } = await syncAllToFirebase(activeCompanyId, (msg) => {
        setSyncStatus(msg);
      });
      setSyncResults({ results, errors });
      setSyncStatus(lang === 'bs' ? '✅ Učitavanje završeno!' : '✅ Sync completed!');
    } catch (e) {
      setSyncStatus(`❌ Greška: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedMockData = async () => {
    if (!activeCompanyId) return;
    const isSure = await confirm(lang === 'bs' 
      ? 'Ovo će kreirati preko 30 mock zapisa (za svaku kolekciju) u vašem browseru za testiranje migracije. Nastaviti?'
      : 'This will seed over 30 mock records (one for each collection) in your browser to test migration. Proceed?'
    );
    if (!isSure) return;

    try {
      const generated = seedMockDataConfig(activeCompanyId);
      await alert(lang === 'bs' ? `Uspješno generirano ${generated} mock zapisa! Stranica će se osvježiti.` : `Successfully generated ${generated} mock records! Reloading...`);
      window.location.reload();
    } catch (e) {
      await alert(`Greška: ${e.message}`);
    }
  };

  // ── Tabs ──
  const tabs = [
    { key: 'activity', label: lang === 'bs' ? 'Aktivnost' : 'Activity', icon: '📋' },
    { key: 'profile', label: lang === 'bs' ? 'Profil' : 'Profile', icon: '👤' },
    { key: 'company', label: lang === 'bs' ? 'Firma' : 'Company', icon: '🏢' },
    { key: 'notifications', label: lang === 'bs' ? 'Obavijesti' : 'Notifications', icon: '🔔' },
    { key: 'display', label: lang === 'bs' ? 'Prikaz' : 'Display', icon: '🎨' },
    ...(isAdmin ? [
      { key: 'system', label: lang === 'bs' ? 'Sistem' : 'System', icon: '🛡️' },
      { key: 'statistics', label: lang === 'bs' ? 'Statistika' : 'Statistics', icon: '📊' },
    ] : []),
  ];



  const validTabs = tabs.map(t => t.key);
  const currentTab = validTabs.includes(activeTab) ? activeTab : validTabs[0];


  // ── Toggle component ──
  const Toggle = ({ checked, onChange, label, description }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</div>
        {description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--primary)' : 'var(--bg-input)',
          position: 'relative', transition: 'background 0.3s', flexShrink: 0,
          border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 24 : 2,
          width: 20, height: 20, borderRadius: '50%', background: 'var(--neutral)',
          transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );

  // ── Stat card component ──
  const StatCard = ({ icon, value, label, color }) => (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12, padding: '20px 16px',
      boxShadow: 'var(--shadow-sm)', textAlign: 'center', border: '1px solid var(--border-light)',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: color || 'var(--text)', fontFamily: 'var(--font-heading)' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );

  // ── Section header ──
  const SectionHeader = ({ icon, title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid var(--border)' }}>
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>{title}</span>
    </div>
  );

  // ── Navigation for Activity Log ──
  const handleLogClick = (entry) => {
    if (!entry.relatedId) return;

    let workerSection = '';
    if (entry.title.includes('OZO') || entry.icon === '🦺') workerSection = '&section=ozo';
    else if (entry.title.includes('Med. pregled') || entry.icon === '🩺' || entry.title.includes('Bolest') || entry.icon === '🏥') workerSection = '&section=medExams';
    else if (entry.title.includes('Povreda') || entry.icon === '🩹') workerSection = '&section=povrede';
    else if (entry.category === 'certificate' || entry.icon === '📋') workerSection = '&section=uvjerenja';

    // To ensure back button returns here with the correct tab, replace URL with tab=activity if not present
    if (!searchParams.get('tab')) {
      window.history.replaceState(null, '', '/dashboard/settings?tab=activity');
    }

    switch (entry.category) {
      case 'worker':
      case 'ppe': // Legacy OZO support
        router.push(`/dashboard/workers?openWorker=${entry.relatedId}${workerSection}`);
        break;
      case 'certificate':
        router.push(`/dashboard/worker-certificates/edit/${entry.relatedId}`);
        break;
      case 'equipment':
        router.push(`/dashboard/equipment?openItem=${entry.relatedId}`);
        break;
      case 'document':
        router.push(`/dashboard/employer-docs?highlight=${entry.relatedId}`);
        break;
      default: break;
    }
  };

  return (
    <div className="animate-fadeIn">
      <DialogRenderer />
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>⚙️ {t('settings')}</h1>

      {/* Removed global Success toast */}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
        {tabs.map(tb => (
          <button key={tb.key}
            className={`tab-btn ${currentTab === tb.key ? 'active' : ''}`}
            onClick={async () => {
              if (dirtyTab && dirtyTab !== tb.key) {
                const saveFns = {
                  notifications: handleSaveNotifSettings,
                  display: handleSaveAppSettings,
                  profile: handleSaveProfile,
                  company: handleSaveCompany,
                };
                const action = await choose(
                  lang === 'bs'
                    ? 'Imate nesačuvane promjene.\nŽelite li ih sačuvati prije promjene taba?'
                    : 'You have unsaved changes.\nDo you want to save them before switching tabs?',
                  [
                    { label: '💾 Spremi i nastavi', value: 'save', primary: true },
                    { label: '🗑️ Odbaci promjene', value: 'discard', danger: true },
                    { label: 'Odustani', value: null }
                  ]
                );
                if (action === null) return;
                
                if (action === 'save' && saveFns[dirtyTab]) {
                  await saveFns[dirtyTab]();
                } else {
                  clearDirty();
                }
              }
              setActiveTab(tb.key);
            }}
          >
            {tb.icon} {tb.label}
            {dirtyTab === tb.key && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)', marginLeft: 6, verticalAlign: 'middle', boxShadow: '0 0 4px var(--warning)' }} title="Nesačuvane promjene" />}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 1: PROFILE                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'profile' && (
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
                <input className="form-input" value={profileData.firstName} onChange={e => setProfileDirty(p => ({ ...p, firstName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('lastName')}</label>
                <input className="form-input" value={profileData.lastName} onChange={e => setProfileDirty(p => ({ ...p, lastName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={profileData.email} onChange={e => setProfileDirty(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('phone')}</label>
                <input className="form-input" value={profileData.phone} onChange={e => setProfileDirty(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveProfile}>💾 {t('save')}</button>
              {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {lang === 'bs' ? 'Sačuvano!' : 'Saved!'}</span>}
            </div>

            <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <h4 style={{ marginBottom: 16 }}>🔐 {lang === 'bs' ? 'Promjena lozinke' : 'Change Password'}</h4>
            {passwordError && <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>⚠️ {passwordError}</div>}
            {passwordSuccess && <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(76,175,80,0.1)', color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>✅ {passwordSuccess}</div>}
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

            <hr style={{ margin: '28px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <h4 style={{ marginBottom: 16 }}>👆 {lang === 'bs' ? 'Biometrijska prijava' : 'Biometric Login'}</h4>
            <div style={{ padding: '16px', borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{lang === 'bs' ? 'Otisak prsta' : 'Fingerprint'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {lang === 'bs' 
                    ? 'Omogućite brzu prijavu na ovom uređaju bez unošenja šifre.' 
                    : 'Enable quick login on this device without a password.'}
                </div>
              </div>
              <div>
                {(typeof window !== 'undefined' && hasStoredCredential()) ? (
                  <button 
                    className="btn" 
                    onClick={async () => {
                      const isConfirmed = await confirm(lang === 'bs' ? 'Da li ste sigurni da želite ukloniti sačuvani otisak s ovog uređaja?' : 'Remove saved fingerprint from device?');
                      if (!isConfirmed) return;
                      localStorage.removeItem('eznr_webauthn_cred');
                      localStorage.removeItem('eznr_webauthn_user');
                      window.dispatchEvent(new Event('storage')); // force react refresh if needed
                      setPasswordSuccess(lang === 'bs' ? 'Otisak uspješno uklonjen' : 'Fingerprint removed');
                    }}
                    style={{ background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', border: '1px solid rgba(244,67,54,0.3)', fontWeight: 600 }}
                  >
                    🗑️ {lang === 'bs' ? 'Ukloni otisak' : 'Remove fingerprint'}
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary" 
                    onClick={async () => {
                      if (!isWebAuthnAvailable()) {
                        alert(lang === 'bs' ? 'Biometrija nije podržana na ovom uređaju (potreban HTTPS).' : 'Biometrics not supported on this device/browser.');
                        return;
                      }
                      try {
                        const userData = { ...user, firstName: profileData.firstName, lastName: profileData.lastName };
                        await registerCredential(user.id, user.email, userData);
                        setPasswordSuccess(lang === 'bs' ? 'Otisak uspješno sačuvan!' : 'Fingerprint successfully saved!');
                      } catch (err) {
                        setPasswordError('Greška: ' + err.message);
                      }
                    }}
                  >
                    ➕ {lang === 'bs' ? 'Dodaj otisak' : 'Add fingerprint'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 2: COMPANY                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'company' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>🏢 {lang === 'bs' ? 'Podaci o firmi' : 'Company Data'}</h3>
            {!activeCompanyId ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                {lang === 'bs' ? 'Odaberite firmu kroz birač firma u gornjem meniju.' : 'Select a company from the company switcher.'}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Naziv firme' : 'Company name'}</label><input className="form-input" value={companyData.naziv} onChange={e => setCompanyDirty(p => ({ ...p, naziv: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Skraćeni naziv' : 'Short name'}</label><input className="form-input" value={companyData.skraceniNaziv} onChange={e => setCompanyDirty(p => ({ ...p, skraceniNaziv: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'ID broj / OIB' : 'ID number'}</label><input className="form-input" value={companyData.oib} onChange={e => setCompanyDirty(p => ({ ...p, oib: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('address')}</label><input className="form-input" value={companyData.adresa} onChange={e => setCompanyDirty(p => ({ ...p, adresa: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('city')}</label><input className="form-input" value={companyData.mjesto} onChange={e => setCompanyDirty(p => ({ ...p, mjesto: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Poštanski broj' : 'Postal code'}</label><input className="form-input" value={companyData.postanskiBroj} onChange={e => setCompanyDirty(p => ({ ...p, postanskiBroj: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{t('phone')}</label><input className="form-input" value={companyData.telefon} onChange={e => setCompanyDirty(p => ({ ...p, telefon: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={companyData.email} onChange={e => setCompanyDirty(p => ({ ...p, email: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Direktor' : 'Director'}</label><input className="form-input" value={companyData.direktor} onChange={e => setCompanyDirty(p => ({ ...p, direktor: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label">{lang === 'bs' ? 'Stručno lice ZNR' : 'OHS Specialist'}</label><input className="form-input" value={companyData.strucnoLice} onChange={e => setCompanyDirty(p => ({ ...p, strucnoLice: e.target.value }))} /></div>
                </div>

                {isAdmin && allOfficersList.length > 0 && (
                  <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12 }}>👮 {lang === 'bs' ? 'Dodijeljeni stručnjaci ZNR' : 'Assigned Officers'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      {lang === 'bs' ? 'Odaberite koji stručnjaci imaju pristup ovoj firmi:' : 'Select which officers can access this company:'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {allOfficersList.map(officer => {
                        const isAssigned = assignedOfficers.includes(officer.id);
                        return (
                          <button
                            key={officer.id}
                            onClick={() => toggleOfficerAssignment(officer.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                              border: `1px solid ${isAssigned ? 'var(--primary)' : 'var(--border)'}`,
                              background: isAssigned ? 'rgba(0,191,166,0.1)' : 'transparent',
                              color: isAssigned ? 'var(--primary)' : 'var(--text-muted)',
                              fontWeight: isAssigned ? 700 : 600, fontSize: '0.8rem',
                              transition: 'all 0.2s',
                            }}
                          >
                            <span>{isAssigned ? '✅' : '➕'}</span>
                            {officer.firstName} {officer.lastName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Logo upload */}
                <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12 }}>🖼️ {lang === 'bs' ? 'Logo firme' : 'Company Logo'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {companyData.logo ? (
                      <img src={companyData.logo} alt="Logo" style={{ height: 64, maxWidth: 200, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }} />
                    ) : (
                      <div style={{ height: 64, width: 120, borderRadius: 8, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {lang === 'bs' ? 'Nema loga' : 'No logo'}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.82rem', display: 'inline-block' }}>
                        📁 {lang === 'bs' ? 'Učitaj logo' : 'Upload Logo'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 500000) {
                            setLogoError(lang === 'bs' ? 'Logo mora biti manji od 500KB' : 'Logo must be under 500KB');
                            return;
                          }
                          setLogoError('');
                          try {
                            const url = await uploadSecureFile(activeCompanyId, 'company_logo', file);
                            setCompanyData(p => ({ ...p, logo: url }));
                          } catch (err) {
                            setLogoError(lang === 'bs' ? 'Greška pri uploadu loga' : 'Error uploading logo');
                          }
                        }} />
                      </label>
                      {logoError && <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>⚠️ {logoError}</div>}
                      {companyData.logo && (
                        <button onClick={() => setCompanyData(p => ({ ...p, logo: '' }))} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                          🗑️ {lang === 'bs' ? 'Ukloni logo' : 'Remove Logo'}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {lang === 'bs' ? 'Logo će biti prikazan na svim obukama i upitnicima koje radnici primaju.' : 'Logo will appear on all trainings and questionnaires sent to workers.'}<br />
                      {lang === 'bs' ? 'Preporučena veličina: PNG ili SVG, max 500KB.' : 'Recommended: PNG or SVG, max 500KB.'}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button className="btn btn-primary" onClick={handleSaveCompany}>💾 {t('save')}</button>
                  {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {lang === 'bs' ? 'Sačuvano!' : 'Saved!'}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 3: NOTIFICATIONS                              */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'notifications' && (
        <div className="card">
          <div className="card-body">
            {/* Top save bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>🔔 {lang === 'bs' ? 'Postavke obavijesti' : 'Notification Preferences'}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {dirtyTab === 'notifications' && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600 }}>● {lang === 'bs' ? 'Nesačuvano' : 'Unsaved'}</span>
                )}
                <button className="btn btn-primary btn-sm" onClick={handleSaveNotifSettings}>
                  💾 {lang === 'bs' ? 'Spremi' : 'Save'}
                </button>
                {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.85rem' }}>✅</span>}
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 16 }}>
              {lang === 'bs' ? 'Odaberite koje obavijesti želite primati u aplikaciji.' : 'Choose which notifications you want to receive.'}
            </p>

            {/* ── Certificates ── */}
            <SectionHeader icon="📋" title={lang === 'bs' ? 'Uvjerenja radnika' : 'Worker Certificates'} />
            <Toggle
              checked={notifSettings.certExpiryEnabled}
              onChange={v => updateNotif('certExpiryEnabled', v)}
              label={lang === 'bs' ? 'Obavijest o isteku uvjerenja' : 'Certificate expiry alerts'}
              description={lang === 'bs' ? 'Upozori me kada radničko uvjerenje uskoro ističe' : 'Warn me when worker certificates are expiring soon'}
            />
            {notifSettings.certExpiryEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Upozori me' : 'Warn me'}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.certExpiryDays} onChange={e => updateNotif('certExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'dana prije isteka' : 'days before expiry'}</span>
              </div>
            )}

            {/* ── Equipment ── */}
            <SectionHeader icon="⚙️" title={lang === 'bs' ? 'Pregled opreme' : 'Equipment Inspections'} />
            <Toggle
              checked={notifSettings.equipExpiryEnabled}
              onChange={v => updateNotif('equipExpiryEnabled', v)}
              label={lang === 'bs' ? 'Obavijest o pregledu opreme' : 'Equipment inspection alerts'}
              description={lang === 'bs' ? 'Upozori me kada oprema treba pregled' : 'Warn me when equipment inspection is due'}
            />
            {notifSettings.equipExpiryEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Upozori me' : 'Warn me'}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.equipExpiryDays} onChange={e => updateNotif('equipExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'dana prije isteka' : 'days before expiry'}</span>
              </div>
            )}

            {/* ── Documents ── */}
            <SectionHeader icon="📄" title={lang === 'bs' ? 'Dokumenti poslodavca' : 'Employer Documents'} />
            <Toggle
              checked={notifSettings.docExpiryEnabled}
              onChange={v => updateNotif('docExpiryEnabled', v)}
              label={lang === 'bs' ? 'Obavijest o isteku dokumenata' : 'Document expiry alerts'}
              description={lang === 'bs' ? 'Upozori me kada dokumenti ističu' : 'Warn me when employer documents expire'}
            />
            {notifSettings.docExpiryEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Upozori me' : 'Warn me'}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.docExpiryDays} onChange={e => updateNotif('docExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'dana prije isteka' : 'days before expiry'}</span>
              </div>
            )}

            {/* ── Workers ── */}
            <SectionHeader icon="👷" title={lang === 'bs' ? 'Radnici' : 'Workers'} />
            <Toggle
              checked={notifSettings.workersNoCerts}
              onChange={v => updateNotif('workersNoCerts', v)}
              label={lang === 'bs' ? 'Radnici bez uvjerenja' : 'Workers without certificates'}
              description={lang === 'bs' ? 'Prikaži koliko aktivnih radnika nema uvjerenja' : 'Show how many active workers have no certificates'}
            />
            <Toggle
              checked={notifSettings.workersNoPPE}
              onChange={v => updateNotif('workersNoPPE', v)}
              label={lang === 'bs' ? 'Radnici bez zaštitne opreme' : 'Workers without PPE'}
              description={lang === 'bs' ? 'Prikaži koliko aktivnih radnika nema dodijeljenu zaštitnu opremu' : 'Show workers missing PPE assignments'}
            />

            {/* ── Calendar ── */}
            <SectionHeader icon="📅" title={lang === 'bs' ? 'Kalendar' : 'Calendar'} />
            <Toggle
              checked={notifSettings.calendarWeek}
              onChange={v => updateNotif('calendarWeek', v)}
              label={lang === 'bs' ? 'Događaji ovog tjedna' : 'Events this week'}
              description={lang === 'bs' ? 'Prikaži nadolazeće kalendarske događaje' : 'Show upcoming calendar events'}
            />
            <div style={{ marginTop: 12, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12, color: 'var(--text)' }}>
                {lang === 'bs' ? 'Prikazani događaji na kalendaru' : 'Events shown on calendar'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Toggle checked={notifSettings.calShowCerts ?? true} onChange={v => updateNotif('calShowCerts', v)} label={lang === 'bs' ? '📜 Uvjerenja radnika' : '📜 Worker certificates'} />
                <Toggle checked={notifSettings.calShowEquip ?? true} onChange={v => updateNotif('calShowEquip', v)} label={lang === 'bs' ? '⚙️ Radna oprema' : '⚙️ Work equipment'} />
                <Toggle checked={notifSettings.calShowDoc ?? true} onChange={v => updateNotif('calShowDoc', v)} label={lang === 'bs' ? '📄 Dokumenti' : '📄 Documents'} />
                <Toggle checked={notifSettings.calShowRisk ?? true} onChange={v => updateNotif('calShowRisk', v)} label={lang === 'bs' ? '🛡️ Mjere rizika' : '🛡️ Risk measures'} />
                <Toggle checked={notifSettings.calShowMed ?? true} onChange={v => updateNotif('calShowMed', v)} label={lang === 'bs' ? '🩺 Ljekarski pregledi' : '🩺 Medical exams'} />
                <Toggle checked={notifSettings.calShowService ?? true} onChange={v => updateNotif('calShowService', v)} label={lang === 'bs' ? '🔧 Servisi' : '🔧 Services'} />
                <Toggle checked={notifSettings.calShowFleet ?? true} onChange={v => updateNotif('calShowFleet', v)} label={lang === 'bs' ? '🚗 Vozila (Reg/Tehnički)' : '🚗 Vehicles (Reg/Tech)'} />
              </div>
            </div>

            {/* ── Vozni Park (Fleet) ── */}
            <SectionHeader icon="🚗" title={lang === 'bs' ? 'Vozni park' : 'Vehicle Fleet'} />
            <Toggle
              checked={notifSettings.fleetExpiryEnabled ?? true}
              onChange={v => updateNotif('fleetExpiryEnabled', v)}
              label={lang === 'bs' ? 'Obavijest o isteku registracije i tehničkog' : 'Registration and tech inspection alerts'}
              description={lang === 'bs' ? 'Upozori me kada vozilima ističe registracija, osiguranje ili pregled' : 'Warn me when vehicle registration or inspection expires'}
            />
            {(notifSettings.fleetExpiryEnabled ?? true) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Upozori me' : 'Warn me'}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.fleetExpiryDays || 30} onChange={e => updateNotif('fleetExpiryDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'dana prije isteka' : 'days before expiry'}</span>
              </div>
            )}

            {/* ── Admin-only notifications ── */}
            {isAdmin && (
              <>
                <SectionHeader icon="🛡️" title={lang === 'bs' ? 'Admin: Zdravlje sistema' : 'Admin: System Health'} />
                <Toggle
                  checked={notifSettings.adminDbSize}
                  onChange={v => updateNotif('adminDbSize', v)}
                  label={lang === 'bs' ? 'Upozorenje o veličini baze' : 'Database size warning'}
                  description={lang === 'bs' ? 'Obavijesti me kada baza podataka raste iznad pragova' : 'Alert me when database grows past thresholds'}
                />
                {notifSettings.adminDbSize && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '12px 0 12px 24px', borderBottom: '1px solid var(--border-light)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>{lang === 'bs' ? 'Prag upozorenja (zapisi)' : 'Warning threshold (records)'}</label>
                      <input className="form-input" type="number" value={notifSettings.adminDbWarnThreshold} onChange={e => updateNotif('adminDbWarnThreshold', Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>{lang === 'bs' ? 'Kritični prag (zapisi)' : 'Critical threshold (records)'}</label>
                      <input className="form-input" type="number" value={notifSettings.adminDbCriticalThreshold} onChange={e => updateNotif('adminDbCriticalThreshold', Number(e.target.value))} />
                    </div>
                  </div>
                )}

                <SectionHeader icon="📈" title={lang === 'bs' ? 'Admin: Rast i aktivnost' : 'Admin: Growth & Activity'} />
                <Toggle checked={notifSettings.adminNewCompanies} onChange={v => updateNotif('adminNewCompanies', v)} label={lang === 'bs' ? 'Nove kompanije' : 'New companies'} description={lang === 'bs' ? 'Obavijesti me kada se registrira nova kompanija' : 'Notify when new company registers'} />
                <Toggle checked={notifSettings.adminNewUsers} onChange={v => updateNotif('adminNewUsers', v)} label={lang === 'bs' ? 'Novi korisnici' : 'New users'} description={lang === 'bs' ? 'Obavijesti me kada se registrira novi korisnik' : 'Notify when new user registers'} />
                <Toggle checked={notifSettings.adminMilestones} onChange={v => updateNotif('adminMilestones', v)} label={lang === 'bs' ? 'Milestone obavijesti' : 'Milestone alerts'} description={lang === 'bs' ? 'Obavijesti na 50, 100, 250, 500 kompanija/korisnika' : 'Alerts at 50, 100, 250, 500 companies/users'} />

                <SectionHeader icon="🔒" title={lang === 'bs' ? 'Admin: Sigurnost' : 'Admin: Security'} />
                <Toggle checked={notifSettings.adminFailedLogins} onChange={v => updateNotif('adminFailedLogins', v)} label={lang === 'bs' ? 'Neuspješne prijave' : 'Failed login attempts'} description={lang === 'bs' ? 'Upozori me na 5+ neuspješnih prijava' : 'Alert on 5+ failed logins for same account'} />
                <Toggle checked={notifSettings.adminInactiveCompanies} onChange={v => updateNotif('adminInactiveCompanies', v)} label={lang === 'bs' ? 'Neaktivne kompanije' : 'Inactive companies'} description={lang === 'bs' ? 'Prikaži kompanije bez prijave 30+ dana' : 'Show companies with no login in 30+ days'} />
              </>
            )}

            {/* ── Automated Email Notifications ── */}
            <SectionHeader icon="📧" title={lang === 'bs' ? 'Automatski Email (Dnevni Pregled)' : 'Automated Email (Daily Digest)'} />
            <div style={{ padding: '14px 18px', marginBottom: 8, borderRadius: 10, background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.2)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {lang === 'bs'
                  ? '📬 Svaki dan u 07:00 sistem automatski šalje email sa pregledom svih stavki koje uskoro ističu. Vi birate kome ide email i šta uključiti.'
                  : '📬 Every day at 07:00 the system sends an automatic email with a summary of all soon-to-expire items. Choose who receives it and what to include.'}
              </div>
            </div>
            <Toggle
              checked={notifSettings.emailNotifEnabled ?? false}
              onChange={v => updateNotif('emailNotifEnabled', v)}
              label={lang === 'bs' ? 'Aktiviraj automatski email dnevnik' : 'Enable automatic daily email digest'}
              description={lang === 'bs' ? 'Svaki dan u 07:00 šalje se email sa isticanjima' : 'Sends an expiry summary email every day at 07:00'}
            />
            {(notifSettings.emailNotifEnabled ?? false) && (<>
              {/* Recipients */}
              <div style={{ padding: '14px 0 6px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 10 }}>📬 {lang === 'bs' ? 'Primatelji' : 'Recipients'}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}>
                    <input type="checkbox" id="notif-to-company" checked={notifSettings.emailNotifToCompany ?? true} onChange={e => updateNotif('emailNotifToCompany', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                    🏢 {lang === 'bs' ? 'Email firme' : 'Company email'}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(email polje firme)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500 }}>
                    <input type="checkbox" id="notif-to-officer" checked={notifSettings.emailNotifToOfficer ?? true} onChange={e => updateNotif('emailNotifToOfficer', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                    👤 {lang === 'bs' ? 'Moj email (stručnjak ZNR)' : 'My email (safety officer)'}
                  </label>
                </div>
              </div>

              {/* Language */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', flexShrink: 0 }}>🌐 {lang === 'bs' ? 'Jezik emaila' : 'Email language'}</div>
                <select
                  className="form-select"
                  style={{ width: 200 }}
                  value={notifSettings.emailNotifLang ?? 'bs'}
                  onChange={e => updateNotif('emailNotifLang', e.target.value)}
                >
                  <option value="bs">🇧🇦 Bosanski</option>
                  <option value="hr">🇭🇷 Hrvatski</option>
                  <option value="sr">🇷🇸 Srpski</option>
                  <option value="sl">🇸🇮 Slovenski</option>
                  <option value="en">🇬🇧 English only</option>
                  <option value="bilingual">🌍 Bilingual (Local + English)</option>
                </select>
              </div>

              {/* Days threshold */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>{lang === 'bs' ? 'Uključi stavke koje ističu u narednih' : 'Include items expiring within'}</span>
                <select className="form-select" style={{ width: 80 }} value={notifSettings.emailNotifDays ?? 30} onChange={e => updateNotif('emailNotifDays', Number(e.target.value))}>
                  <option value={7}>7</option><option value={14}>14</option><option value={30}>30</option><option value={60}>60</option>
                </select>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'dana' : 'days'}</span>
              </div>

              {/* Per-category toggles */}
              <div style={{ padding: '12px 0 4px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 10 }}>📋 {lang === 'bs' ? 'Uključi kategorije u email' : 'Include categories in email'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <Toggle checked={notifSettings.emailNotifCerts ?? true} onChange={v => updateNotif('emailNotifCerts', v)} label={lang === 'bs' ? '📜 Uvjerenja radnika' : '📜 Worker certificates'} />
                  <Toggle checked={notifSettings.emailNotifEquip ?? true} onChange={v => updateNotif('emailNotifEquip', v)} label={lang === 'bs' ? '⚙️ Radna oprema' : '⚙️ Equipment inspections'} />
                  <Toggle checked={notifSettings.emailNotifDocs ?? true} onChange={v => updateNotif('emailNotifDocs', v)} label={lang === 'bs' ? '📄 Dokumenti poslodavca' : '📄 Employer documents'} />
                  <Toggle checked={notifSettings.emailNotifFleet ?? true} onChange={v => updateNotif('emailNotifFleet', v)} label={lang === 'bs' ? '🚗 Vozni park' : '🚗 Fleet / Vehicles'} />
                  <Toggle checked={notifSettings.emailNotifMedical ?? true} onChange={v => updateNotif('emailNotifMedical', v)} label={lang === 'bs' ? '🩺 Ljekarski pregledi' : '🩺 Medical exams'} />
                </div>
              </div>
            </>)}

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleSaveNotifSettings}>💾 {lang === 'bs' ? 'Spremi postavke obavijesti' : 'Save Notification Settings'}</button>
              {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {lang === 'bs' ? 'Sačuvano!' : 'Saved!'}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 4: DISPLAY                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'display' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>🎨 {lang === 'bs' ? 'Postavke prikaza' : 'Display Settings'}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">{t('language')}</label>
                <select className="form-select" value={lang} onChange={() => toggleLang()}>
                  <option value="bs">🇧🇦 Bosanski</option>
                  <option value="en">🇬🇧 English</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Format datuma' : 'Date format'}</label>
                <select className="form-select" value={appSettings.dateFormat} onChange={e => updateApp('dateFormat', e.target.value)}>
                  <option value="dd.mm.yyyy">DD.MM.YYYY.</option>
                  <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                  <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Zapisi po stranici' : 'Records per page'}</label>
                <select className="form-select" value={appSettings.recordsPerPage} onChange={e => updateApp('recordsPerPage', Number(e.target.value))}>
                  <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                </select>
              </div>
            </div>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

            <Toggle checked={appSettings.compactView} onChange={v => updateApp('compactView', v)} label={lang === 'bs' ? 'Kompaktni prikaz' : 'Compact view'} description={lang === 'bs' ? 'Smanji razmake između elemenata' : 'Reduce spacing between elements'} />
            <Toggle checked={appSettings.animations} onChange={v => updateApp('animations', v)} label={lang === 'bs' ? 'Animacije' : 'Animations'} description={lang === 'bs' ? 'Uključi glatke prijelaze i animacije' : 'Enable smooth transitions and animations'} />
            <Toggle checked={appSettings.notificationSound} onChange={v => updateApp('notificationSound', v)} label={lang === 'bs' ? 'Zvuk obavijesti' : 'Notification sound'} description={lang === 'bs' ? 'Pusti zvuk kada stigne nova obavijest' : 'Play sound for new notifications'} />
            <Toggle checked={appSettings.sidebarOpen} onChange={v => updateApp('sidebarOpen', v)} label={lang === 'bs' ? 'Bočna traka uvijek otvorena' : 'Sidebar always open'} description={lang === 'bs' ? 'Zadrži bočnu traku otvorenom pri pokretanju' : 'Keep sidebar expanded on startup'} />

            <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: '1.2rem', backgroundImage: 'linear-gradient(135deg, #E040FB, #7C4DFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>Zia AI</span>
              </div>
              <Toggle 
                checked={appSettings.proactiveZia !== false} 
                onChange={v => updateApp('proactiveZia', v)} 
                label={lang === 'bs' ? 'Proaktivna asistentica' : 'Proactive assistant'} 
                description={lang === 'bs' ? 'Dozvoli Zii da analizira stanje i automatski progovori o istecima prilikom otvaranja aplikacije.' : 'Allow Zia to analyze the state and automatically speak about expiring items when opening the app.'} 
              />
            </div>

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

            {/* Dark mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                  {isDark ? '🌙' : '☀️'} {lang === 'bs' ? 'Tamni mod' : 'Dark mode'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {lang === 'bs' ? 'Trenutno: ' : 'Currently: '}
                  <strong>{isDark ? (lang === 'bs' ? 'Tamni' : 'Dark') : (lang === 'bs' ? 'Svijetli' : 'Light')}</strong>
                  {lang === 'bs' ? ' — promjena se odmah primjenjuje' : ' — changes apply immediately'}
                </div>
              </div>
              <button
                onClick={toggleTheme}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 'var(--radius-full)',
                  border: `2px solid ${isDark ? 'var(--primary)' : 'var(--border)'}`,
                  background: isDark ? 'var(--bg-input)' : 'var(--bg-input)',
                  cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
                  fontFamily: 'var(--font-heading)',
                  color: isDark ? 'var(--primary)' : 'var(--text-light)',
                  transition: 'all 0.25s ease',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{isDark ? '🌙' : '☀️'}</span>
                <span>{isDark ? (lang === 'bs' ? 'Uključi Svijetli mod' : 'Switch to Light') : (lang === 'bs' ? 'Uključi Tamni mod' : 'Switch to Dark')}</span>
              </button>
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveAppSettings}>💾 {lang === 'bs' ? 'Spremi postavke prikaza' : 'Save Display Settings'}</button>
              {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {lang === 'bs' ? 'Sačuvano!' : 'Saved!'}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 5: SYSTEM (Admin only)                       */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'system' && isAdmin && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 20 }}>🛡️ {lang === 'bs' ? 'Postavke sistema' : 'System Settings'}</h3>

            <SectionHeader icon="🔐" title={lang === 'bs' ? 'Registracija i pristup' : 'Registration & Access'} />
            <Toggle checked={appSettings.allowRegistration} onChange={v => updateApp('allowRegistration', v)} label={lang === 'bs' ? 'Omogući registraciju' : 'Allow registration'} description={lang === 'bs' ? 'Dozvolite novim korisnicima da se sami registriraju' : 'Allow new users to self-register'} />
            <Toggle checked={appSettings.requireApproval} onChange={v => updateApp('requireApproval', v)} label={lang === 'bs' ? 'Potrebna admin potvrda' : 'Require admin approval'} description={lang === 'bs' ? 'Novi korisnici moraju biti odobreni od admina' : 'New accounts must be approved by admin'} />
            <Toggle checked={appSettings.googleSignIn} onChange={v => updateApp('googleSignIn', v)} label={lang === 'bs' ? 'Google prijava' : 'Google sign-in'} description={lang === 'bs' ? 'Dozvolite prijavu putem Google računa' : 'Allow login via Google account'} />

            <SectionHeader icon="🔒" title={lang === 'bs' ? 'Sigurnost' : 'Security'} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '12px 0' }}>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Minimalna dužina lozinke' : 'Minimum password length'}</label>
                <select className="form-select" value={appSettings.minPasswordLength} onChange={e => updateApp('minPasswordLength', Number(e.target.value))}>
                  {[6, 8, 10, 12, 16, 20].map(n => <option key={n} value={n}>{n} {lang === 'bs' ? 'znakova' : 'characters'}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Automatsko odjavljivanje' : 'Auto-logout'}</label>
                <select className="form-select" value={appSettings.autoLogoutMinutes} onChange={e => updateApp('autoLogoutMinutes', Number(e.target.value))}>
                  <option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>1 {lang === 'bs' ? 'sat' : 'hour'}</option><option value={120}>2 {lang === 'bs' ? 'sata' : 'hours'}</option><option value={0}>{lang === 'bs' ? 'Nikada' : 'Never'}</option>
                </select>
              </div>
            </div>

            <SectionHeader icon="📁" title={lang === 'bs' ? 'Datoteke' : 'Files'} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '12px 0' }}>
              <div className="form-group">
                <label className="form-label">{lang === 'bs' ? 'Maksimalna veličina datoteke' : 'Max file size'}</label>
                <select className="form-select" value={appSettings.maxFileSizeMB} onChange={e => updateApp('maxFileSizeMB', Number(e.target.value))}>
                  <option value={5}>5 MB</option><option value={10}>10 MB</option><option value={25}>25 MB</option><option value={50}>50 MB</option>
                </select>
              </div>
            </div>

            <SectionHeader icon="🔧" title={lang === 'bs' ? 'Održavanje' : 'Maintenance'} />
            <Toggle checked={appSettings.maintenanceMode} onChange={v => updateApp('maintenanceMode', v)} label={lang === 'bs' ? 'Režim održavanja' : 'Maintenance mode'} description={lang === 'bs' ? 'Prikaži stranicu održavanja za sve korisnike osim admina' : 'Show maintenance page to all users except admin'} />
            {appSettings.maintenanceMode && (
              <div className="form-group" style={{ padding: '12px 0 0 24px' }}>
                <label className="form-label">{lang === 'bs' ? 'Poruka održavanja' : 'Maintenance message'}</label>
                <input className="form-input" value={appSettings.maintenanceMessage} onChange={e => updateApp('maintenanceMessage', e.target.value)} placeholder={lang === 'bs' ? 'Aplikacija je trenutno na održavanju...' : 'Application is under maintenance...'} />
              </div>
            )}

            <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

            {/* ── Firebase Migration ── */}
            <SectionHeader icon="☁️" title={lang === 'bs' ? 'Sinkronizacija sa Cloudom (Firebase)' : 'Cloud Synchronization'} />
            <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--primary)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                {lang === 'bs' 
                  ? 'Prijenos i sinkronizacija lokalnih podataka u Firebase bazu za trenutno aktivnu kompaniju.' 
                  : 'Transfer and synchronize local data to Firebase database for the currently active company.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6, marginBottom: 16 }}>
                {Object.entries(syncStats)
                  .filter(([name, count]) => count > 0)
                  .map(([name, count]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6 }}>
                      <span style={{color: 'var(--text-muted)'}}>{name}:</span><strong>{count}</strong>
                    </div>
                  ))}
                {Object.values(syncStats).every(count => count === 0) && (
                  <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', gridColumn: '1 / -1' }}>
                    {lang === 'bs' ? 'Nema lokalnih podataka za ovu kompaniju.' : 'No local data found for this company.'}
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleRunSync}
                  disabled={isSyncing || !activeCompanyId || Object.values(syncStats).every(count => count === 0)}
                >
                  {isSyncing ? <span className="spinner" style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span> : '☁️'} 
                  {lang === 'bs' ? 'Sinkroniziraj na Firebase' : 'Sync to Firebase'}
                </button>
                
                <button 
                  type="button" 
                  className="btn"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', fontSize: '0.8rem', padding: '8px 14px' }}
                  onClick={handleSeedMockData}
                  disabled={isSyncing || !activeCompanyId}
                >
                  🛠️ {lang === 'bs' ? 'Generiši testne podatke (40+)' : 'Generate Mock Data (40+)'}
                </button>

                {syncStatus && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: syncStatus.includes('Greška') || syncStatus.includes('Error') ? 'var(--danger)' : 'var(--success)' }}>
                    {syncStatus}
                  </span>
                )}
              </div>
              
              {syncResults && (
                <div style={{ marginTop: 12, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 8, fontSize: '0.7rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Detalji sinkronizacije:</div>
                  <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {syncResults.results.filter(r => r.synced > 0).map((r, i) => (
                      <div key={i} style={{ color: 'var(--text-muted)' }}>✅ {r.collection}: {r.synced} zapisa</div>
                    ))}
                    {syncResults.errors.map((e, i) => (
                      <div key={i} style={{ color: 'var(--danger)' }}>❌ {e.collection}: {e.error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />            {/* App version info */}
            <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-input)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>eZNR v{APP_VERSION}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Datum izgradnje' : 'Build date'}: {APP_BUILD_DATE}</div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(76,175,80,0.1)', color: 'var(--success)' }}>
                  {lang === 'bs' ? 'Najnovija verzija' : 'Latest version'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>{lang === 'bs' ? 'Changelog' : 'Changelog'}:</div>
              {CHANGELOG[0]?.changes?.map((c, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '2px 0', paddingLeft: 12, borderLeft: '2px solid var(--primary)' }}>• {c}</div>
              ))}
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveAppSettings}>💾 {lang === 'bs' ? 'Spremi postavke sistema' : 'Save System Settings'}</button>
              {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {lang === 'bs' ? 'Sačuvano!' : 'Saved!'}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 6: STATISTICS (Admin only)                   */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'statistics' && isAdmin && stats && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <h3 style={{ marginBottom: 20 }}>📊 {lang === 'bs' ? 'Pregled sistema' : 'System Overview'}</h3>

              {/* Main stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                <StatCard icon="🏢" value={stats.totalCompanies} label={lang === 'bs' ? 'Kompanije' : 'Companies'} color="var(--primary)" />
                <StatCard icon="👥" value={stats.totalUsers} label={lang === 'bs' ? 'Korisnici' : 'Users'} color="#7B1FA2" />
                <StatCard icon="👷" value={stats.totalWorkers} label={lang === 'bs' ? 'Radnici' : 'Workers'} color="#1976D2" />
                <StatCard icon="📋" value={stats.totalCertificates} label={lang === 'bs' ? 'Uvjerenja' : 'Certificates'} color="var(--warning)" />
                <StatCard icon="⚙️" value={stats.totalEquipment} label={lang === 'bs' ? 'Oprema' : 'Equipment'} color="#388E3C" />
                <StatCard icon="💾" value={stats.totalRecords} label={lang === 'bs' ? 'Ukupno zapisa' : 'Total records'} color="var(--danger)" />
              </div>

              {/* Workers breakdown */}
              <SectionHeader icon="👷" title={lang === 'bs' ? 'Radnici — Pregled' : 'Workers — Breakdown'} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg-badge)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--info)' }}>{stats.activeWorkers}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--info)' }}>{lang === 'bs' ? 'Aktivni' : 'Active'}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: 'rgba(255,152,0,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)' }}>{stats.inactiveWorkers}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>{lang === 'bs' ? 'Neaktivni' : 'Inactive'}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: '#F3E5F5', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7B1FA2' }}>{stats.totalWorkers}</div>
                  <div style={{ fontSize: '0.75rem', color: '#7B1FA2' }}>{lang === 'bs' ? 'Ukupno' : 'Total'}</div>
                </div>
              </div>

              {/* Certificate breakdown */}
              <SectionHeader icon="📋" title={lang === 'bs' ? 'Uvjerenja — Status' : 'Certificates — Status'} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 16, borderRadius: 10, background: 'rgba(76,175,80,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{stats.activeCerts}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>{lang === 'bs' ? 'Aktivna' : 'Active'}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 10, background: 'rgba(244,67,54,0.1)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)' }}>{stats.expiredCerts}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{lang === 'bs' ? 'Istekla' : 'Expired'}</div>
                </div>
              </div>

              {/* Top companies */}
              {stats.topCompanies?.length > 0 && (
                <>
                  <SectionHeader icon="🏆" title={lang === 'bs' ? 'Top kompanije po broju radnika' : 'Top Companies by Workers'} />
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Kompanija' : 'Company'}</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Radnici' : 'Workers'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topCompanies.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '8px 12px', fontSize: '0.85rem', fontWeight: 700 }}>{i + 1}</td>
                          <td style={{ padding: '8px 12px', fontSize: '0.85rem' }}>{c.name}</td>
                          <td style={{ padding: '8px 12px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right' }}>{c.workers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Collection breakdown */}
              <SectionHeader icon="📦" title={lang === 'bs' ? 'Zapisi po kolekcijama' : 'Records by Collection'} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                {Object.entries(stats.collectionCounts)
                  .filter(([, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([col, count]) => (
                    <div key={col} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: '0.8rem', borderBottom: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{col}</span>
                      <span style={{ fontWeight: 700 }}>{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════ */}
      {/* TAB 7: ACTIVITY LOG (all users)                   */}
      {/* ══════════════════════════════════════════════════ */}
      {currentTab === 'activity' && (
        <div>
          {/* ── Admin: Online users ── */}
          {isAdmin && onlineUsers.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', boxShadow: '0 0 6px #22C55E' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{lang === 'bs' ? 'Korisnici online' : 'Users online'} ({onlineUsers.length})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {onlineUsers.map(u => (
                    <div key={u.userId} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 12px', borderRadius: 20,
                      background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', fontSize: '0.78rem',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                      <span style={{ fontWeight: 600 }}>{u.userName}</span>
                      <span style={{ color: 'var(--text-muted)' }}>• {u.companyName || '—'}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{humanizePage(u.page)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>📋 {lang === 'bs' ? 'Dnevnik aktivnosti' : 'Activity Log'}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                    onClick={() => { if (isAdmin) { clearAdminLog(); } clearUserLog(); setLogRefresh(r => r + 1); }}>
                    🗑️ {lang === 'bs' ? 'Obriši log' : 'Clear log'}
                  </button>
                  <button className="btn" style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    onClick={() => setLogRefresh(r => r + 1)}>
                    🔄
                  </button>
                </div>
              </div>

              {/* Category filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {[null, 'worker', 'certificate', 'equipment', 'ppe', 'document', 'company', 'expiry', 'auth'].map(cat => (
                  <button key={cat || 'all'} onClick={() => setLogFilter(cat)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                      border: '1px solid var(--border)', cursor: 'pointer',
                      background: logFilter === cat ? 'var(--primary)' : 'var(--bg-input)',
                      color: logFilter === cat ? 'white' : 'var(--text)',
                    }}>
                    {cat === null ? (lang === 'bs' ? '📋 Sve' : '📋 All') :
                      cat === 'worker' ? '👷 Radnici' :
                        cat === 'certificate' ? '📋 Uvjerenja' :
                          cat === 'equipment' ? '⚙️ Oprema' :
                            cat === 'ppe' ? '🦺 OZO' :
                              cat === 'document' ? '📄 Dokumenti' :
                                cat === 'company' ? '🏢 Firme' :
                                  cat === 'expiry' ? '⏰ Isteci' : '🔐 Prijave'}
                  </button>
                ))}
              </div>

              {/* Admin log section */}
              {isAdmin && adminLog.length > 0 && (
                <>
                  <SectionHeader icon="🛡️" title={lang === 'bs' ? 'Admin aktivnosti' : 'Admin Events'} />
                  <div style={{ marginBottom: 16 }}>
                    {adminLog.map(entry => {
                      const colors = getSeverityColors(entry.severity);
                      return (
                        <div key={entry.id} 
                          onClick={() => handleLogClick(entry)}
                          style={{
                          display: 'flex', gap: 12, padding: '10px 12px',
                          borderBottom: '1px solid var(--border-light)',
                          borderLeft: `3px solid ${colors.dot}`,
                          background: colors.bg,
                          marginBottom: 2, borderRadius: '0 6px 6px 0',
                          cursor: entry.relatedId ? 'pointer' : 'default',
                          transition: 'filter 0.2s'
                        }}
                        onMouseEnter={(e) => { if (entry.relatedId) e.currentTarget.style.filter = 'brightness(0.95)'; }}
                        onMouseLeave={(e) => { if (entry.relatedId) e.currentTarget.style.filter = ''; }}
                        >
                          <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{entry.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{entry.title}</div>
                            {entry.detail && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>{entry.detail}</div>}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatLogTime(entry.timestamp)}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* User log section */}
              <SectionHeader icon="📝" title={lang === 'bs' ? 'Moje aktivnosti' : 'My Activities'} />
              {userLog.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                  {lang === 'bs' ? 'Nema evidentiranih aktivnosti.' : 'No activities recorded yet.'}
                  <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{lang === 'bs' ? 'Aktivnosti se bilježe kada dodajete, mijenjate ili brišete podatke.' : 'Activities are recorded when you add, edit or delete data.'}</div>
                </div>
              ) : userLog.map(entry => {
                const colors = getSeverityColors(entry.severity);
                return (
                  <div key={entry.id}
                    onClick={() => handleLogClick(entry)}
                    style={{
                    display: 'flex', gap: 12, padding: '10px 12px',
                    borderBottom: '1px solid var(--border-light)',
                    borderLeft: `3px solid ${colors.dot}`,
                    background: colors.bg,
                    marginBottom: 2, borderRadius: '0 6px 6px 0',
                    cursor: entry.relatedId ? 'pointer' : 'default',
                    transition: 'filter 0.2s'
                  }}
                  onMouseEnter={(e) => { if (entry.relatedId) e.currentTarget.style.filter = 'brightness(0.95)'; }}
                  onMouseLeave={(e) => { if (entry.relatedId) e.currentTarget.style.filter = ''; }}
                  >
                    <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{entry.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{entry.title}</div>
                      {entry.detail && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 2 }}>{entry.detail}</div>}
                      {entry.userName && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>👤 {entry.userName}</div>}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatLogTime(entry.timestamp)}</div>
                  </div>
                );
              })}

              {userLog.length === 0 && isAdmin && adminLog.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {lang === 'bs' ? 'Log je prazan.' : 'Log is empty.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
