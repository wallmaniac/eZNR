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
import { uploadSecureFile } from '@/lib/storageService';
import {
  ACCENT_PRESETS, SIDEBAR_PRESETS, EZNR_DEFAULTS,
  PDF_DEFAULTS, UI_DEFAULTS, WATERMARK_POSITIONS, LOGO_POSITIONS,
  getCompanyBranding, savePdfBranding,
  getUIBranding, saveUIBranding, applyUIBranding, resetUIBranding,
} from '@/lib/brandingService';

export default function SettingsPage() {
  const { t, lang, toggleLang } = useLanguage();
  const { user, isAdmin, activeCompanyId, login, changePassword, reauthenticate, changeEmail, changeName } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'activity');
  const [saved, setSaved] = useState(false);
  // Dirty-tracking: which tab has unsaved edits (null = clean)
  const [dirtyTab, setDirtyTab] = useState(null);
  const [logoError, setLogoError] = useState('');

  const { choose, alert, confirm, prompt, DialogRenderer } = useDialog();

  // Profile state
  const [profileData, setProfileData] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [passwordData, setPasswordData] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [biometricError, setBiometricError] = useState('');
  const [biometricSuccess, setBiometricSuccess] = useState('');

  // Company state
  const [companyData, setCompanyData] = useState({ naziv: '', skraceniNaziv: '', oib: '', adresa: '', mjesto: '', postanskiBroj: '', telefon: '', email: '', direktor: '', strucnoLice: '', logo: '' });
  const [assignedOfficers, setAssignedOfficers] = useState([]);
  // Branding state
  const [pdfAccentColor, setPdfAccentColor] = useState(EZNR_DEFAULTS.accentColor);
  const [wmEnabled, setWmEnabled] = useState(PDF_DEFAULTS.watermarkEnabled);
  const [wmPosition, setWmPosition] = useState(PDF_DEFAULTS.watermarkPosition); // fallback if I typo'd
  const [wmOpacity, setWmOpacity] = useState(PDF_DEFAULTS.watermarkOpacity);
  const [wmSize, setWmSize] = useState(PDF_DEFAULTS.watermarkSize);
  const [wmContent, setWmContent] = useState(PDF_DEFAULTS.watermarkContent);
  const [logoPosition, setLogoPosition] = useState(PDF_DEFAULTS.logoPosition);
  const [logoSize, setLogoSize] = useState(PDF_DEFAULTS.logoSize);
  const [headerText, setHeaderText] = useState('');
  const [headerFontSize, setHeaderFontSize] = useState(PDF_DEFAULTS.headerFontSize);
  const [headerBold, setHeaderBold] = useState(false);
  const [headerItalic, setHeaderItalic] = useState(false);
  const [headerUnderline, setHeaderUnderline] = useState(false);
  const [headerColor, setHeaderColor] = useState(PDF_DEFAULTS.headerColor);

  const [uiPrimaryColor, setUiPrimaryColor] = useState('');
  const [uiSidebarColor, setUiSidebarColor] = useState('');
  const [sidebarLogoEnabled, setSidebarLogoEnabled] = useState(false);
  const [sidebarText, setSidebarText] = useState(UI_DEFAULTS.sidebarText);

  // Color picker open state (toggle-to-close + X button)
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false);
  const [headerColorPickerOpen, setHeaderColorPickerOpen] = useState(false);
  const [uiPrimaryPickerOpen, setUiPrimaryPickerOpen] = useState(false);
  const [uiSidebarPickerOpen, setUiSidebarPickerOpen] = useState(false);

  // Notification settings state
  const [notifSettings, setNotifSettings] = useState(getNotificationSettings());

  // App settings state
  const [appSettings, setAppSettings] = useState(getAppSettings());

  // Stats (admin only)
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (isAdmin && activeTab === 'system') {
      const timer = setTimeout(() => setStats(getSystemStats()), 500);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, activeTab]);

  // Activity log state
  const [logFilter, setLogFilter] = useState(null);
  const [logRefresh, setLogRefresh] = useState(0);
  const [logLimit, setLogLimit] = useState(15);
  const userLog = useMemo(() => getUserLog(logLimit, logFilter, activeCompanyId), [logLimit, logFilter, logRefresh, activeCompanyId]);
  const adminLog = useMemo(() => getAdminLog(logLimit, logFilter, activeCompanyId), [logLimit, logFilter, logRefresh, activeCompanyId]);
  const onlineUsers = useMemo(() => getOnlineUsers(), [logRefresh]);


  // Firebase Sync state (admin only)
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [syncStats, setSyncStats] = useState({});
  useEffect(() => {
    if (isAdmin && activeTab === 'system') {
      const timer = setTimeout(() => setSyncStats(getSyncStats()), 800);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, activeTab]);

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
      // Load branding
      const pdfBrand = getCompanyBranding(activeCompanyId);
      setPdfAccentColor(pdfBrand.accentColor || EZNR_DEFAULTS.accentColor);
      const uiBrand = getUIBranding(activeCompanyId);
      setUiPrimaryColor(uiBrand.primaryColor || '');
      setUiSidebarColor(uiBrand.sidebarColor || '');
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
    try {
      // Step 1: Re-authenticate with Firebase using the current password
      await reauthenticate(passwordData.current);
    } catch (e) {
      const code = e?.code || e?.message || '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setPasswordError(lang === 'bs' ? 'Trenutna lozinka je netočna!' : 'Current password is incorrect!');
      } else {
        setPasswordError(lang === 'bs' ? 'Greška pri provjeri lozinke: ' + e.message : 'Password verification error: ' + e.message);
      }
      return;
    }
    try {
      // Step 2: Update password in Firebase Auth (the only source of truth)
      await changePassword(passwordData.newPass);
      setPasswordSuccess(lang === 'bs' ? 'Lozinka uspješno promijenjena!' : 'Password successfully changed!');
      setPasswordData({ current: '', newPass: '', confirm: '' });
    } catch (e) {
      setPasswordError(lang === 'bs' ? 'Greška pri promjeni lozinke: ' + e.message : 'Error changing password: ' + e.message);
    }
  };

  const handleSaveCompany = () => {
    if (!activeCompanyId) return;
    update(COLLECTIONS.COMPANIES, activeCompanyId, companyData);
    // Save branding
    savePdfBranding(activeCompanyId, { accentColor: pdfAccentColor });
    saveUIBranding(activeCompanyId, { primaryColor: uiPrimaryColor, sidebarColor: uiSidebarColor });
    applyUIBranding(activeCompanyId);
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
      <div className="settings-tabs-container" style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
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
            {biometricError && <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>⚠️ {biometricError}</div>}
            {biometricSuccess && <div style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(76,175,80,0.1)', color: 'var(--success)', fontSize: '0.82rem', fontWeight: 600, marginBottom: 12 }}>✅ {biometricSuccess}</div>}
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
                      setBiometricSuccess(lang === 'bs' ? 'Otisak uspješno uklonjen' : 'Fingerprint removed');
                    }}
                    style={{ background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', border: '1px solid rgba(244,67,54,0.3)', fontWeight: 600 }}
                  >
                    🗑️ {lang === 'bs' ? 'Ukloni otisak' : 'Remove fingerprint'}
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary" 
                    onClick={async () => {
                      setBiometricError('');
                      setBiometricSuccess('');
                      if (!isWebAuthnAvailable()) {
                        await alert(lang === 'bs' ? 'Biometrija nije podržana na ovom uređaju (potreban HTTPS).' : 'Biometrics not supported on this device/browser.');
                        return;
                      }
                      // Prompt user for their current password so we can stash it for biometric login
                      const pwdInput = await prompt(
                        lang === 'bs' ? 'Unesite vašu trenutnu lozinku za aktivaciju otiska prsta:' : 'Enter your current password to enable fingerprint:',
                        lang === 'bs' ? 'Potvrda lozinke' : 'Confirm Password'
                      );
                      if (!pwdInput) {
                        setBiometricError(lang === 'bs' ? 'Lozinka je obavezna za aktivaciju otiska prsta.' : 'Password is required to enable fingerprint.');
                        return;
                      }
                      // Verify password is correct by re-authenticating
                      try {
                        await reauthenticate(pwdInput);
                      } catch (err) {
                        const code = err?.code || err?.message || '';
                        if (code.includes('wrong-password') || code.includes('invalid-credential')) {
                          setBiometricError(lang === 'bs' ? 'Pogrešna lozinka!' : 'Wrong password!');
                        } else {
                          setBiometricError(lang === 'bs' ? 'Greška pri provjeri: ' + err.message : 'Verification error: ' + err.message);
                        }
                        return;
                      }
                      try {
                        const userData = {
                          id: user.id,
                          email: user.email,
                          firstName: profileData.firstName,
                          lastName: profileData.lastName,
                          role: user.role,
                          companyIds: user.companyIds || [],
                          fsPassword: pwdInput,
                        };
                        await registerCredential(user.id, user.email, userData);
                        setBiometricSuccess(lang === 'bs' ? 'Otisak uspješno sačuvan! Na login ekranu ćete vidjeti opciju za brzu prijavu.' : 'Fingerprint saved! You will see quick login option on the login screen.');
                      } catch (err) {
                        setBiometricError('Greška: ' + err.message);
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
                            // Convert to base64 data URL (bypasses Firebase Storage permissions)
                            const reader = new FileReader();
                            reader.onload = () => {
                              setCompanyData(p => ({ ...p, logo: reader.result }));
                            };
                            reader.onerror = () => {
                              setLogoError(lang === 'bs' ? 'Greška pri čitanju fajla' : 'Error reading file');
                            };
                            reader.readAsDataURL(file);
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

                {/* ══ BRANDING SECTION ══ */}
                
                {/* ── BRANDING SECTION ── */}
                <hr style={{ margin: '28px 0', border: 'none', borderTop: '2px solid var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r="1" fill="#FF5252" stroke="none"/>
                    <circle cx="17.5" cy="10.5" r="1" fill="#FFAB40" stroke="none"/>
                    <circle cx="8.5" cy="7.5" r="1" fill="#69F0AE" stroke="none"/>
                    <circle cx="6.5" cy="12" r="1" fill="#448AFF" stroke="none"/>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/>
                  </svg>
                  <h3 style={{ margin: 0 }}>{lang === 'bs' ? 'Branding kompanije' : 'Company Branding'}</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 24 }}>
                  {lang === 'bs'
                    ? 'Prilagodite izgled PDF izvještaja i korisničkog sučelja prema vizualnom identitetu vaše firme.'
                    : 'Customize PDF report appearance and dashboard UI to match your corporate identity.'}
                </p>

                {/* PDF BRANDING CARD */}
                <div style={{ borderRadius: 16, background: 'var(--bg-input)', border: '1px solid var(--border)', marginBottom: 16, overflow: 'hidden' }}>
                  {/* Card header */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lang === 'bs' ? 'PDF Branding' : 'PDF Report Branding'}</span>
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* === ACCENT COLOR === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text)' }}>{lang === 'bs' ? 'Boja naglaska' : 'Accent Color'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }}>{lang === 'bs' ? 'Koristi se za zaglavlje, linije i naglašene elemente.' : 'Used for header lines, badges and accents.'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        {ACCENT_PRESETS.map(p => (
                          <button key={p.color} title={p.name}
                            onClick={() => { setPdfAccentColor(p.color); setDirty('company'); }}
                            style={{ width: 34, height: 34, borderRadius: 8, border: pdfAccentColor === p.color ? '3px solid var(--text)' : '2px solid transparent', background: p.color, cursor: 'pointer', transition: 'transform 0.15s', boxShadow: pdfAccentColor === p.color ? '0 0 0 2px var(--bg-card)' : 'none', transform: pdfAccentColor === p.color ? 'scale(1.18)' : 'scale(1)' }} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Paleta boja:' : 'Color picker:'}</span>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => setPdfPickerOpen(v => !v)}
                            style={{ width: 34, height: 34, borderRadius: 8, border: '2px solid var(--border)', background: pdfAccentColor, cursor: 'pointer', padding: 0, display: 'block' }}
                          />
                          {pdfPickerOpen && (
                            <>
                              <div onClick={() => setPdfPickerOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199 }} />
                              <div style={{ position: 'absolute', top: 42, left: 0, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                                  <button onClick={() => setPdfPickerOpen(false)} style={{ border: 'none', background: 'var(--bg-input)', color: 'var(--text-muted)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                                </div>
                                <input type="color" value={pdfAccentColor}
                                  onChange={e => { setPdfAccentColor(e.target.value); setDirty('company'); }}
                                  style={{ width: 200, height: 180, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                              </div>
                            </>
                          )}
                        </div>
                        <code style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '3px 8px', borderRadius: 6 }}>{pdfAccentColor}</code>
                      </div>
                    </div>

                    {/* === LOGO POSITION & SIZE === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 10, color: 'var(--text)' }}>{lang === 'bs' ? 'Logo – pozicija i veličina' : 'Logo Position & Size'}</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        {LOGO_POSITIONS.map(p => (
                          <button key={p.id} onClick={() => { setLogoPosition(p.id); setDirty('company'); }}
                            style={{ padding: '6px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: logoPosition === p.id ? '2px solid var(--primary)' : '1px solid var(--border)', background: logoPosition === p.id ? 'var(--primary-glow)' : 'var(--bg-card)', color: logoPosition === p.id ? 'var(--primary)' : 'var(--text-muted)' }}
                          >{p.label}</button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', minWidth: 60 }}>{lang === 'bs' ? 'Veličina:' : 'Size:'}</span>
                        <input type="range" min={20} max={80} value={logoSize}
                          onChange={e => { setLogoSize(+e.target.value); setDirty('company'); }}
                          style={{ flex: 1, maxWidth: 260, accentColor: 'var(--primary)' }} />
                        <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 40, textAlign: 'right' }}>{logoSize}px</code>
                      </div>
                    </div>

                    {/* === HEADER TEXT === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text)' }}>{lang === 'bs' ? 'Tekst zaglavlja' : 'Header Text'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>{lang === 'bs' ? 'Opcionalni tekst ispod zaglavlja na svim PDF izvještajima.' : 'Optional text below the header on all PDF reports.'}</div>
                      <input type="text" value={headerText}
                        onChange={e => { setHeaderText(e.target.value); setDirty('company'); }}
                        placeholder={lang === 'bs' ? 'Npr. "Zaštita na radu i požaru"' : 'e.g. "Safety & Health Division"'}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.85rem', marginBottom: 10, boxSizing: 'border-box' }} />
                      {/* Formatting toolbar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button title={lang === 'bs' ? 'Podebljano' : 'Bold'}
                          onClick={() => { setHeaderBold(b => !b); setDirty('company'); }}
                          style={{ width: 34, height: 34, borderRadius: 6, border: headerBold ? '2px solid var(--primary)' : '1px solid var(--border)', background: headerBold ? 'var(--primary-glow)' : 'var(--bg-card)', cursor: 'pointer', fontWeight: 900, fontSize: '0.9rem', color: 'var(--text)' }}>B</button>
                        <button title={lang === 'bs' ? 'Kurziv' : 'Italic'}
                          onClick={() => { setHeaderItalic(i => !i); setDirty('company'); }}
                          style={{ width: 34, height: 34, borderRadius: 6, border: headerItalic ? '2px solid var(--primary)' : '1px solid var(--border)', background: headerItalic ? 'var(--primary-glow)' : 'var(--bg-card)', cursor: 'pointer', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text)' }}>I</button>
                        <button title={lang === 'bs' ? 'Podcrtano' : 'Underline'}
                          onClick={() => { setHeaderUnderline(u => !u); setDirty('company'); }}
                          style={{ width: 34, height: 34, borderRadius: 6, border: headerUnderline ? '2px solid var(--primary)' : '1px solid var(--border)', background: headerUnderline ? 'var(--primary-glow)' : 'var(--bg-card)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem', color: 'var(--text)' }}>U</button>
                        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Aa</span>
                          <select value={headerFontSize} onChange={e => { setHeaderFontSize(+e.target.value); setDirty('company'); }}
                            style={{ height: 34, padding: '0 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.8rem' }}>
                            {[8,9,10,11,12,14,16,18,20,24].map(s => <option key={s} value={s}>{s}pt</option>)}
                          </select>
                        </div>
                        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>A</span>
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => setHeaderColorPickerOpen(v => !v)}
                              style={{ width: 34, height: 34, borderRadius: 6, border: '2px solid var(--border)', background: headerColor, cursor: 'pointer', padding: 0 }}
                            />
                            {headerColorPickerOpen && (
                              <>
                                <div onClick={() => setHeaderColorPickerOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199 }} />
                                <div style={{ position: 'absolute', top: 42, left: 0, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                                    <button onClick={() => setHeaderColorPickerOpen(false)} style={{ border: 'none', background: 'var(--bg-input)', color: 'var(--text-muted)', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                                  </div>
                                  <input type="color" value={headerColor}
                                    onChange={e => { setHeaderColor(e.target.value); setDirty('company'); }}
                                    style={{ width: 180, height: 160, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }} />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* === WATERMARK === */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{lang === 'bs' ? 'Vodeni Žig' : 'Watermark'}</div>
                        <button
                          onClick={() => { setWmEnabled(e => !e); setDirty('company'); }}
                          title={wmEnabled ? 'Isključi' : 'Uključi'}
                          style={{ display: 'flex', alignItems: 'center', height: 26, padding: '0 12px', borderRadius: 13, fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', border: 'none', background: wmEnabled ? 'var(--primary)' : 'var(--border)', color: wmEnabled ? '#fff' : 'var(--text-muted)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                        >{wmEnabled ? (lang === 'bs' ? 'Uključen' : 'ON') : (lang === 'bs' ? 'Isključen' : 'OFF')}</button>
                      </div>

                      {wmEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* Content type */}
                          <div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{lang === 'bs' ? 'Sadržaj:' : 'Content:'}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {[{id:'logo',lbl:'Logo'},{id:'name',lbl:lang==='bs'?'Naziv':'Name'},{id:'both',lbl:lang==='bs'?'Oboje':'Both'}].map(o => (
                                <button key={o.id} onClick={()=>{setWmContent(o.id);setDirty('company');}}
                                  style={{padding:'5px 14px',borderRadius:8,fontSize:'0.78rem',fontWeight:600,cursor:'pointer',border:wmContent===o.id?'2px solid var(--primary)':'1px solid var(--border)',background:wmContent===o.id?'var(--primary-glow)':'var(--bg-card)',color:wmContent===o.id?'var(--primary)':'var(--text-muted)'}}>
                                  {o.lbl}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Position grid */}
                          <div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{lang === 'bs' ? 'Pozicija:' : 'Position:'}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,36px)', gap: 4 }}>
                              {WATERMARK_POSITIONS.map(pos => (
                                <button key={pos.id} title={pos.id}
                                  onClick={()=>{setWmPosition(pos.id);setDirty('company');}}
                                  style={{ width:36,height:36,borderRadius:8,fontSize:'0.85rem',cursor:'pointer', border:wmPosition===pos.id?'2px solid var(--primary)':'1px solid var(--border)', background:wmPosition===pos.id?'var(--primary)':'var(--bg-card)', color:wmPosition===pos.id?'#fff':'var(--text-muted)', display:'flex',alignItems:'center',justifyContent:'center' }}>
                                  {pos.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Opacity */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', minWidth: 100, whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'Transparentnost:' : 'Opacity:'}</span>
                            <input type="range" min={1} max={30} value={wmOpacity}
                              onChange={e=>{setWmOpacity(+e.target.value);setDirty('company');}}
                              style={{flex:1,maxWidth:220,accentColor:'var(--primary)'}} />
                            <code style={{fontSize:'0.73rem',color:'var(--text-muted)',minWidth:36,textAlign:'right'}}>{wmOpacity}%</code>
                          </div>

                          {/* Size */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', minWidth: 100, whiteSpace: 'nowrap' }}>{lang === 'bs' ? 'Veličina:' : 'Size:'}</span>
                            <input type="range" min={80} max={500} value={wmSize}
                              onChange={e=>{setWmSize(+e.target.value);setDirty('company');}}
                              style={{flex:1,maxWidth:220,accentColor:'var(--primary)'}} />
                            <code style={{fontSize:'0.73rem',color:'var(--text-muted)',minWidth:46,textAlign:'right'}}>{wmSize}px</code>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* === LIVE PDF PREVIEW === */}
                    <div>
                      <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>{lang === 'bs' ? 'PDF pregled uživo' : 'Live PDF Preview'}</div>
                      <div style={{ background: '#fff', border: '1px solid #d0d0d0', borderRadius: 10, padding: '16px 16px 40px', position: 'relative', overflow: 'hidden', maxWidth: 340, minHeight: 180, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
                        {/* Watermark */}
                        {wmEnabled && (
                          <div style={{
                            position:'absolute', pointerEvents:'none', zIndex:0, textAlign:'center',
                            top:wmPosition.includes('top')?'14%':wmPosition.includes('bottom')?'82%':'50%',
                            left:wmPosition.includes('left')?'18%':wmPosition.includes('right')?'82%':'50%',
                            transform:'translate(-50%,-50%)', opacity:wmOpacity/100,
                          }}>
                            {(wmContent==='logo'||wmContent==='both')&&companyData.logo&&
                              <img src={companyData.logo} alt="" style={{maxWidth:wmSize*0.45,maxHeight:wmSize*0.28,objectFit:'contain',display:'block',margin:'0 auto 3px'}} />}
                            {(wmContent==='name'||wmContent==='both')&&
                              <div style={{fontSize:Math.max(5,Math.round(wmSize/22))+'pt',fontWeight:900,letterSpacing:1,textTransform:'uppercase',color:'#000'}}>
                                {companyData.naziv||(lang==='bs'?'Naziv firme':'Company')}
                              </div>}
                          </div>
                        )}
                        {/* Header */}
                        <div style={{display:'flex',justifyContent:logoPosition==='center'?'center':'space-between',alignItems:'flex-start',borderBottom:'2px solid '+pdfAccentColor,paddingBottom:5,marginBottom:5,position:'relative',zIndex:1}}>
                          <div style={{textAlign:logoPosition==='center'?'center':'left'}}>
                            {companyData.logo
                              ?<img src={companyData.logo} alt="" style={{height:logoSize*0.45,maxWidth:90,objectFit:'contain'}}/>
                              :<span style={{fontSize:'7pt',fontWeight:800,color:pdfAccentColor}}>{companyData.naziv||(lang==='bs'?'Naziv firme':'Company')}</span>}
                            {companyData.logo&&companyData.naziv&&<div style={{fontSize:'3.5pt',color:'#555',fontWeight:600,marginTop:1}}>{companyData.naziv}</div>}
                          </div>
                          {logoPosition!=='center'&&<div style={{textAlign:'right',fontSize:'3.5pt',color:'#555'}}>{companyData.adresa}</div>}
                        </div>
                        {headerText&&<div style={{fontSize:Math.max(4,headerFontSize*0.45)+'pt',fontWeight:headerBold?800:400,fontStyle:headerItalic?'italic':'normal',textDecoration:headerUnderline?'underline':'none',color:headerColor,marginBottom:3,position:'relative',zIndex:1}}>{headerText}</div>}
                        <div style={{fontSize:'5pt',fontWeight:800,textTransform:'uppercase',letterSpacing:0.4,color:'#1a1a2e',position:'relative',zIndex:1}}>{lang==='bs'?'EVIDENCIJA RADNIKA':'WORKER REGISTRY'}</div>
                        <div style={{fontSize:'3pt',color:'#aaa',marginBottom:5,position:'relative',zIndex:1}}>Preview</div>
                        <div style={{position:'relative',zIndex:1}}>{[1,2,3,4].map(i=>(
                          <div key={i} style={{display:'flex',gap:4,marginBottom:3}}>
                            <div style={{width:'25%',height:3,background:i===1?pdfAccentColor+'22':'#f5f5f5',borderRadius:1}}/>
                            <div style={{width:'45%',height:3,background:i===1?pdfAccentColor+'22':'#f5f5f5',borderRadius:1}}/>
                            <div style={{width:'30%',height:3,background:i===1?pdfAccentColor+'22':'#f5f5f5',borderRadius:1}}/>
                          </div>
                        ))}</div>
                        <div style={{position:'absolute',bottom:8,left:16,right:16,borderTop:'1px solid #eee',paddingTop:3,display:'flex',justifyContent:'space-between',fontSize:'3pt',color:'#bbb',zIndex:1}}>
                          <span>{companyData.naziv}</span>
                          <span>{new Date().toLocaleDateString('bs-BA')}</span>
                        </div>
                      </div>
                    </div>

                  </div>{/* end pdf card body */}
                </div>{/* end pdf card */}

                {/* UI BRANDING CARD */}
                <div style={{ borderRadius: 16, background: 'var(--bg-input)', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
                  {/* Card header */}
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{lang === 'bs' ? 'Branding aplikacije' : 'App Branding'}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'linear-gradient(135deg,#7B1FA2,#E040FB)', color: '#fff', marginLeft: 'auto' }}>ENTERPRISE</span>
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* === PRIMARY COLOR === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text)' }}>{lang === 'bs' ? 'Primarna boja (gumbi, akcenti)' : 'Primary color (buttons, accents)'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <button title={lang==='bs'?'Zadano':'Default'} onClick={()=>{setUiPrimaryColor('');setDirty('company');}}
                          style={{width:34,height:34,borderRadius:8,border:!uiPrimaryColor?'3px solid var(--text)':'2px solid var(--border)',background:'linear-gradient(135deg,#ccc,#eee)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'#888',transform:!uiPrimaryColor?'scale(1.15)':'scale(1)'}}>⟲</button>
                        {ACCENT_PRESETS.map(p=>(
                          <button key={'ui-'+p.color} title={p.name} onClick={()=>{setUiPrimaryColor(p.color);setDirty('company');}}
                            style={{width:34,height:34,borderRadius:8,border:uiPrimaryColor===p.color?'3px solid var(--text)':'2px solid transparent',background:p.color,cursor:'pointer',transition:'transform 0.15s',boxShadow:uiPrimaryColor===p.color?'0 0 0 2px var(--bg-card)':' none',transform:uiPrimaryColor===p.color?'scale(1.18)':'scale(1)'}} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Paleta boja:' : 'Color picker:'}</span>
                        <div style={{ position: 'relative' }}>
                          <button onClick={()=>setUiPrimaryPickerOpen(v=>!v)}
                            style={{width:34,height:34,borderRadius:8,border:'2px solid var(--border)',background:uiPrimaryColor||EZNR_DEFAULTS.primaryColor,cursor:'pointer',padding:0}} />
                          {uiPrimaryPickerOpen && (
                            <>
                              <div onClick={() => setUiPrimaryPickerOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199 }} />
                              <div style={{position:'absolute',top:42,left:0,zIndex:200,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:12,boxShadow:'0 8px 32px rgba(0,0,0,0.35)'}}>
                                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}>
                                  <button onClick={()=>setUiPrimaryPickerOpen(false)} style={{border:'none',background:'var(--bg-input)',color:'var(--text-muted)',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:'0.8rem',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
                                </div>
                                <input type="color" value={uiPrimaryColor||EZNR_DEFAULTS.primaryColor}
                                  onChange={e=>{setUiPrimaryColor(e.target.value);setDirty('company');}}
                                  style={{width:200,height:180,border:'none',background:'transparent',cursor:'pointer',padding:0}} />
                              </div>
                            </>
                          )}
                        </div>
                        <code style={{fontSize:'0.78rem',color:'var(--text-muted)',background:'var(--bg-card)',padding:'3px 8px',borderRadius:6}}>{uiPrimaryColor||EZNR_DEFAULTS.primaryColor}</code>
                      </div>
                    </div>

                    {/* === SIDEBAR COLOR === */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4, color: 'var(--text)' }}>{lang === 'bs' ? 'Boja bočne trake' : 'Sidebar color'}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <button title={lang==='bs'?'Zadano':'Default'} onClick={()=>{setUiSidebarColor('');setDirty('company');}}
                          style={{width:34,height:34,borderRadius:8,border:!uiSidebarColor?'3px solid var(--text)':'2px solid var(--border)',background:'linear-gradient(135deg,#ccc,#eee)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem',color:'#888',transform:!uiSidebarColor?'scale(1.15)':'scale(1)'}}>⟲</button>
                        {SIDEBAR_PRESETS.map(p=>(
                          <button key={'sb-'+p.color} title={p.name} onClick={()=>{setUiSidebarColor(p.color);setDirty('company');}}
                            style={{width:34,height:34,borderRadius:8,border:uiSidebarColor===p.color?'3px solid var(--text)':'2px solid transparent',background:p.color,cursor:'pointer',transition:'transform 0.15s',boxShadow:uiSidebarColor===p.color?'0 0 0 2px var(--bg-card)':'none',transform:uiSidebarColor===p.color?'scale(1.18)':'scale(1)'}} />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Paleta boja:' : 'Color picker:'}</span>
                        <div style={{ position: 'relative' }}>
                          <button onClick={()=>setUiSidebarPickerOpen(v=>!v)}
                            style={{width:34,height:34,borderRadius:8,border:'2px solid var(--border)',background:uiSidebarColor||EZNR_DEFAULTS.sidebarColor,cursor:'pointer',padding:0}} />
                          {uiSidebarPickerOpen && (
                            <>
                              <div onClick={() => setUiSidebarPickerOpen(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199 }} />
                              <div style={{position:'absolute',top:42,left:0,zIndex:200,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:12,boxShadow:'0 8px 32px rgba(0,0,0,0.35)'}}>
                                <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}>
                                  <button onClick={()=>setUiSidebarPickerOpen(false)} style={{border:'none',background:'var(--bg-input)',color:'var(--text-muted)',borderRadius:6,width:24,height:24,cursor:'pointer',fontSize:'0.8rem',display:'flex',alignItems:'center',justifyContent:'center'}}>x</button>
                                </div>
                                <input type="color" value={uiSidebarColor||EZNR_DEFAULTS.sidebarColor}
                                  onChange={e=>{setUiSidebarColor(e.target.value);setDirty('company');}}
                                  style={{width:200,height:180,border:'none',background:'transparent',cursor:'pointer',padding:0}} />
                              </div>
                            </>
                          )}
                        </div>
                        <code style={{fontSize:'0.78rem',color:'var(--text-muted)',background:'var(--bg-card)',padding:'3px 8px',borderRadius:6}}>{uiSidebarColor||EZNR_DEFAULTS.sidebarColor}</code>
                      </div>
                    </div>

                    {/* === SIDEBAR LOGO & TEXT === */}
                    <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 12, color: 'var(--text)' }}>{lang === 'bs' ? 'Logo i tekst u bočnoj traci' : 'Sidebar Logo & Text'}</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
                        <div onClick={()=>{setSidebarLogoEnabled(e=>!e);setDirty('company');}}
                          style={{width:44,height:24,borderRadius:12,background:sidebarLogoEnabled?'var(--primary)':'var(--border)',position:'relative',flexShrink:0,cursor:'pointer',transition:'background 0.2s'}}>
                          <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:sidebarLogoEnabled?23:3,transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.25)'}} />
                        </div>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{lang === 'bs' ? 'Koristi logo firme u bočnoj traci' : 'Use company logo in sidebar'}</span>
                      </label>
                      {!companyData.logo && sidebarLogoEnabled && (
                        <div style={{fontSize:'0.75rem',color:'var(--danger)',fontWeight:600,marginBottom:10,padding:'8px 12px',borderRadius:8,background:'rgba(220,53,69,0.08)',border:'1px solid rgba(220,53,69,0.18)'}}>
                          {lang==='bs'?'Potrebno je prvo postaviti logo firme iznad.':'Upload a company logo first (in the Logo field above).'}
                        </div>
                      )}
                      <div>
                        <div style={{fontSize:'0.73rem',color:'var(--text-muted)',marginBottom:5,fontWeight:600}}>{lang==='bs'?'Tekst ispod loga (prazno = sakriveno):':'Text below logo (empty = hidden):'}</div>
                        <input type="text" value={sidebarText}
                          onChange={e=>{setSidebarText(e.target.value);setDirty('company');}}
                          placeholder={lang==='bs'?'Npr. zastitanaradu.ba':'e.g. yourdomain.com'}
                          style={{width:'100%',maxWidth:300,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text)',fontSize:'0.82rem',boxSizing:'border-box'}} />
                      </div>
                    </div>

                    {/* === LIVE UI PREVIEW === */}
                    <div>
                      <div style={{fontSize:'0.73rem',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>{lang==='bs'?'Pregled uživo':'Live Preview'}</div>
                      <div style={{display:'flex',borderRadius:10,overflow:'hidden',height:90,border:'1px solid var(--border)',maxWidth:340}}>
                        <div style={{width:60,background:uiSidebarColor||EZNR_DEFAULTS.sidebarColor,display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 0',gap:4,flexShrink:0}}>
                          {sidebarLogoEnabled&&companyData.logo
                            ?<img src={companyData.logo} alt="" style={{width:26,height:26,borderRadius:6,objectFit:'contain',background:'#fff',padding:2}}/>
                            :<div style={{width:26,height:26,borderRadius:8,background:(uiPrimaryColor||EZNR_DEFAULTS.primaryColor)+'30',border:'1px solid '+(uiPrimaryColor||EZNR_DEFAULTS.primaryColor)+'50',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',color:'#fff'}}>eZ</div>}
                          {sidebarText&&<div style={{fontSize:'2.5pt',color:'rgba(255,255,255,0.5)',textAlign:'center',maxWidth:50,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sidebarText}</div>}
                          <div style={{width:26,height:3,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/>
                          <div style={{width:26,height:3,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/>
                          <div style={{width:26,height:3,borderRadius:2,background:'rgba(255,255,255,0.15)'}}/>
                        </div>
                        <div style={{flex:1,background:'var(--bg-page)',padding:10,display:'flex',flexDirection:'column',gap:6}}>
                          <div style={{display:'flex',gap:5}}>
                            <div style={{padding:'3px 10px',borderRadius:5,background:uiPrimaryColor||EZNR_DEFAULTS.primaryColor,color:'#fff',fontSize:'0.6rem',fontWeight:700}}>+ {lang==='bs'?'Dodaj':'Add'}</div>
                            <div style={{padding:'3px 10px',borderRadius:5,background:(uiPrimaryColor||EZNR_DEFAULTS.primaryColor)+'18',color:uiPrimaryColor||EZNR_DEFAULTS.primaryColor,fontSize:'0.6rem',fontWeight:600,border:'1px solid '+(uiPrimaryColor||EZNR_DEFAULTS.primaryColor)+'30'}}>PDF</div>
                          </div>
                          <div style={{height:3,borderRadius:2,background:'var(--border)',width:'80%'}}/>
                          <div style={{height:3,borderRadius:2,background:'var(--border)',width:'60%'}}/>
                        </div>
                      </div>
                    </div>

                    {(uiPrimaryColor||uiSidebarColor||sidebarLogoEnabled)&&(
                      <button onClick={()=>{setUiPrimaryColor('');setUiSidebarColor('');setSidebarLogoEnabled(false);setSidebarText(UI_DEFAULTS.sidebarText);setDirty('company');}}
                        style={{padding:'7px 16px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:'0.8rem',fontWeight:600,display:'flex',alignItems:'center',gap:6,width:'fit-content',marginTop:14}}>
                        ⟲ {lang==='bs'?'Vrati zadane vrijednosti':'Reset to defaults'}
                      </button>
                    )}

                  </div>{/* end ui card body */}
                </div>{/* end ui card */}

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button className="btn btn-primary" onClick={handleSaveCompany}>💾 {lang === 'bs' ? 'Spremi branding i firmu' : 'Save branding & company'}</button>

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

              {(userLog.length >= logLimit || (isAdmin && adminLog.length >= logLimit)) && (
                <button 
                  onClick={() => setLogLimit(l => l + 20)} 
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px dashed var(--border)', borderRadius: 8, cursor: 'pointer', marginTop: 12, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  {lang === 'bs' ? 'Učitaj starije aktivnosti' : 'Load older activities'}
                </button>
              )}

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
