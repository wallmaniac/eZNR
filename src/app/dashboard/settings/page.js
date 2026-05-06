'use client';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getAll, getById, update, getRawAll, COLLECTIONS, COMPANY_SCOPED,
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
import { isWebAuthnAvailable, hasStoredCredentialForUser, clearBiometricCredentialForUser, registerCredential } from '@/lib/webAuthn';
import { uploadSecureFile } from '@/lib/storageService';
import PageHeader from '@/components/PageHeader';
import {
  ACCENT_PRESETS, SIDEBAR_PRESETS, EZNR_DEFAULTS,
  PDF_DEFAULTS, UI_DEFAULTS, WATERMARK_POSITIONS, LOGO_POSITIONS,
  getCompanyBranding, savePdfBranding,
  getUIBranding, saveUIBranding, applyUIBranding, resetUIBranding,
} from '@/lib/brandingService';

export default function SettingsPage() {
  const { t, lang, toggleLang } = useLanguage();
  const { user, isAdmin, activeCompanyId, logout, changePassword, reauthenticate, changeEmail, changeName, updateUserContext } = useAuth();
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

  // Mobile Tabs scroll indicator state
  const tabsWrapperRef = useRef(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (tabsWrapperRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = tabsWrapperRef.current;
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
      }
    };
    handleScrollOrResize();
    const el = tabsWrapperRef.current;
    if (el) el.addEventListener('scroll', handleScrollOrResize);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      if (el) el.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeTab]);

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
  const [headerEnabled, setHeaderEnabled] = useState(PDF_DEFAULTS.headerEnabled);
  const [showCompanyInfo, setShowCompanyInfo] = useState(true);
  const [showCompanyName, setShowCompanyName] = useState(true);
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
  const [notifSyncError, setNotifSyncError] = useState(false);

  // Load notif settings from Firestore whenever notifications tab is opened
  useEffect(() => {
    if (activeTab !== 'notifications' || !activeCompanyId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/firebase-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ functionName: 'getNotifSettings', data: { companyId: String(activeCompanyId) } }),
        });
        const json = await res.json();
        const fsSettings = (json.result || json)?.settings;
        if (!cancelled && fsSettings) {
          // Merge: Firestore is source of truth for server-side keys; localStorage wins for UI toggles
          setNotifSettings(prev => ({ ...prev, ...fsSettings }));
          // Also keep localStorage in sync
          saveNotificationSettings({ ...getNotificationSettings(), ...fsSettings });
          console.log('[Settings] Loaded notif settings from Firestore:', fsSettings);
        } else if (!cancelled && fsSettings === null) {
          console.warn('[Settings] No Firestore notif_settings doc found — will create on save.');
        }
      } catch (e) {
        console.error('[Settings] Failed to load notif settings from Firestore:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeCompanyId]);

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
          logo: company.logo || '', parentId: company.parentId || '',
        });
      }
      if (isAdmin) {
        const hasAccess = getRawAll(COLLECTIONS.USERS).filter(u => u.role === 'officer' && (u.companyIds || []).includes(activeCompanyId));
        setAssignedOfficers(hasAccess.map(o => o.id));
      }
      // Load branding
      const pdfBrand = getCompanyBranding(activeCompanyId);
      setPdfAccentColor(pdfBrand.accentColor);
      setWmEnabled(pdfBrand.watermarkEnabled);
      setWmPosition(pdfBrand.watermarkPosition);
      setWmOpacity(pdfBrand.watermarkOpacity);
      setWmSize(pdfBrand.watermarkSize);
      setWmContent(pdfBrand.watermarkContent);
      setLogoPosition(pdfBrand.logoPosition);
      setLogoSize(pdfBrand.logoSize);
      setHeaderEnabled(pdfBrand.headerEnabled ?? true);
      setShowCompanyInfo(pdfBrand.showCompanyInfo ?? true);
      setShowCompanyName(pdfBrand.showCompanyName ?? true);
      setHeaderText(pdfBrand.headerText);
      setHeaderFontSize(pdfBrand.headerFontSize);
      setHeaderBold(pdfBrand.headerBold);
      setHeaderItalic(pdfBrand.headerItalic);
      setHeaderUnderline(pdfBrand.headerUnderline);
      setHeaderColor(pdfBrand.headerColor);

      const uiBrand = getUIBranding(activeCompanyId);
      setUiPrimaryColor(uiBrand.primaryColor);
      setUiSidebarColor(uiBrand.sidebarColor);
      setSidebarLogoEnabled(uiBrand.sidebarLogoEnabled);
      setSidebarText(uiBrand.sidebarText);
    }
  }, [activeCompanyId, isAdmin]);

  const allOfficersList = useMemo(() => {
    if (!isAdmin) return [];
    return getRawAll(COLLECTIONS.USERS).filter(u => (u.role === 'officer' || u.role === 'admin') && u.aktivan !== false);
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
    updateUserContext({ firstName: profileData.firstName, lastName: profileData.lastName, email: profileData.email, phone: profileData.phone });
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
    
    // Save standard and branding structure back to the company
    const newBranding = {
        accentColor: pdfAccentColor,
        watermarkEnabled: wmEnabled, 
        watermarkPosition: wmPosition, 
        watermarkOpacity: wmOpacity, 
        watermarkSize: wmSize, 
        watermarkContent: wmContent,
        logoPosition: logoPosition, 
        logoSize: logoSize,
        headerEnabled: headerEnabled,
        headerText: headerText, 
        headerFontSize: headerFontSize, 
        headerBold: headerBold, 
        headerItalic: headerItalic, 
        headerUnderline: headerUnderline, 
        headerColor: headerColor,
        showCompanyInfo: showCompanyInfo,
        showCompanyName: showCompanyName,
        primaryColor: uiPrimaryColor, 
        sidebarColor: uiSidebarColor,
        sidebarLogoEnabled: sidebarLogoEnabled,
        sidebarText: sidebarText
    };
    
    try {
      const payload = { ...companyData, branding: newBranding };
      update(COLLECTIONS.COMPANIES, activeCompanyId, payload);
      applyUIBranding(activeCompanyId);
      clearDirty(); showSaved();
    } catch(err) {
      console.error('Save failed:', err);
      alert('Error: ' + err.message);
    }
  };

  const handleSaveNotifSettings = async () => {
    // 1) Always keep localStorage in sync (used by in-app notification system)
    saveNotificationSettings(notifSettings);

    // 2) Persist to Firestore via server API (Admin SDK bypasses auth rules)
    const cId = activeCompanyId;
    setNotifSyncError(false);
    if (cId) {
      const ok = await apiSaveNotifSettings(String(cId), notifSettings);
      if (!ok) {
        setNotifSyncError(true);
        console.error('[Settings] Firestore save failed for notif_settings. CompanyId:', cId);
      } else {
        console.log('[Settings] notif_settings saved to Firestore for company:', cId);
      }
    } else {
      console.warn('[Settings] No activeCompanyId — Firestore save skipped.');
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

  
  const [wiping, setWiping] = useState(false);
  const handleWipeDev = async () => {
    if (!isAdmin) return;
    if (activeCompanyId === 'all' || !activeCompanyId) {
        alert('MORA BITI ODABRANA KONKRETNA KOMPANIJA!');
        return;
    }
    const pwd = await prompt('Type "WIPE" to confirm deleting ALL DATA for ' + activeCompanyId);
    if(pwd !== 'WIPE') return;

    setWiping(true);
    try {
        let totalD = 0;
        const allCols = Object.values(COLLECTIONS).filter(c => COMPANY_SCOPED.includes(c));
        
        for(let c of allCols) {
            const ref = collection(db, `companies/${activeCompanyId}/${c}`);
            const snap = await getDocs(ref);
            if(snap.empty) continue;
            for(let i=0; i<snap.docs.length; i+=400) {
                const chunk = snap.docs.slice(i, i+400);
                const batch = writeBatch(db);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
                totalD += chunk.length;
            }
        }
        await alert('WIPE GOTOV! Obrisano zapisa: ' + totalD);
    } catch(e) {
        await alert('GRESKA: ' + e.message);
    }
    setWiping(false);
  };

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
      <PageHeader 
        icon="⚙️" 
        title={t('settings')} 
        actions={
          <button className="btn" onClick={logout} style={{ background: 'rgba(244,67,54,0.1)', color: 'var(--danger)', border: '1px solid rgba(244,67,54,0.3)', fontWeight: 700, padding: '8px 16px', fontSize: '0.85rem' }}>
            🚪 {lang === 'bs' ? 'Odjava' : 'Logout'}
          </button>
        } 
      />

      {/* Removed global Success toast */}

      {/* Tabs */}
      <div style={{ position: 'relative', margin: '0 -16px 24px -16px', padding: '0 16px' }}>
        <div 
          className="settings-tabs-container" 
          ref={tabsWrapperRef}
          style={{ 
            display: 'flex', gap: 6, paddingBottom: 6, borderBottom: '2px solid var(--border)', 
            flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none'
          }}>
          <style>{`.settings-tabs-container::-webkit-scrollbar { display: none; }`}</style>
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
                    { label: '💾 Sačuvaj i nastavi', value: 'save', primary: true },
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
        {canScrollRight && (
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 6, width: 64,
            background: 'linear-gradient(to left, var(--bg-page) 30%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: 10, pointerEvents: 'none', color: 'var(--text-muted)'
          }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, opacity: 0.9, animation: 'pulse-x 1.5s infinite alternate' }}>›</span>
          </div>
        )}
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

            <div className="form-grid-2">
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
            <div className="form-grid-3">
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
                {(typeof window !== 'undefined' && user?.id && hasStoredCredentialForUser(user.id)) ? (
                  <button 
                    className="btn" 
                    onClick={async () => {
                      const isConfirmed = await confirm(lang === 'bs' ? 'Da li ste sigurni da želite ukloniti sačuvani otisak s ovog uređaja za ovaj nalog?' : 'Remove saved fingerprint from device for this account?');
                      if (!isConfirmed) return;
                      clearBiometricCredentialForUser(user.id);
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
                <div className="form-grid-2">
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

                
                {companyData.parentId && (
                    <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'rgba(0,191,166,0.05)', border: '1px solid var(--primary)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 4, color: 'var(--primary)' }}>🔗 {lang === 'bs' ? 'Dio Holdinga' : 'Part of Holding'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {lang === 'bs' ? 'Ova firma je kćerka firma i pripada holdingu: ' : 'This is a subsidiary company belonging to: '}
                            <strong style={{ color: 'var(--text)' }}>{getById(COLLECTIONS.COMPANIES, companyData.parentId)?.naziv || 'Nepoznato'}</strong>
                        </div>
                    </div>
                )}


                {isAdmin && allOfficersList.length > 0 && (
                  <div style={{ marginTop: 20, padding: 16, borderRadius: 12, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12 }}>👮 {lang === 'bs' ? 'Dodijeljeni stručnjaci ZNR i Administratori' : 'Assigned Officers and Admins'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      {lang === 'bs' ? 'Odaberite koji stručnjaci/administratori imaju pristup ovoj firmi:' : 'Select which officers/admins can access this company:'}
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
                          if (file.size > 2000000) {
                            setLogoError(lang === 'bs' ? 'Logo mora biti manji od 2MB' : 'Logo must be under 2MB');
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
                      {lang === 'bs' ? 'Preporučena veličina: PNG ili SVG, max 2MB.' : 'Recommended: PNG or SVG, max 2MB.'}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button className="btn btn-primary" onClick={handleSaveCompany}>💾 {t('save')}</button>
                  {saved && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {lang === 'bs' ? 'Sačuvano!' : 'Saved!'}</span>}
                </div>

                {/* ══ BRANDING SECTION ══ */}
                
                {/* ── SUPER PREMIUM BRANDING SECTION ── */}
                <div style={{ marginTop: 40, borderTop: '1px solid rgba(150,150,150,0.1)', paddingTop: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #059669))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-5.5-4.5-10-10-10z"/></svg>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.3px' }}>{lang === 'bs' ? 'Branding & Identitet' : 'Brand Identity'}</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, marginTop: 4 }}>{lang === 'bs' ? 'Vrhunski dizajn za vašu aplikaciju i tiskane PDF izvještaje.' : 'Premium design elements for your dashboard and reports.'}</p>
                      </div>
                    </div>
                    {/* Add back Default Settings Reset entirely */}
                    <button type="button" onClick={() => { if(confirm(lang==='bs'?'Poništi sve na početne EZNR vrijednosti?':'Reset to EZNR defaults?')){setUiPrimaryColor(EZNR_DEFAULTS.primaryColor);setUiSidebarColor(EZNR_DEFAULTS.sidebarColor);setSidebarLogoEnabled(false);setSidebarText(UI_DEFAULTS.sidebarText);setPdfAccentColor(EZNR_DEFAULTS.accentColor);setWmEnabled(true);setHeaderEnabled(true);setShowCompanyInfo(true);setShowCompanyName(true);setWmOpacity(5);setWmSize(280);setLogoPosition('left');setLogoSize(40);setHeaderText('');setHeaderColor('#1a1a2e');setDirty('company');} }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>↺ {lang === 'bs' ? 'Vrati zadane postavke' : 'Reset to Defaults'}</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>
                  
                    {/* === APP BRANDING CARD ( PREMIUM ) === */}
                    <div style={{ borderRadius: 20, background: 'var(--bg-card)', border: '1px solid rgba(150,150,150,0.15)', boxShadow: '0 12px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                      <div style={{ padding: '20px 24px', background: 'linear-gradient(to right, rgba(150,150,150,0.03), transparent)', borderBottom: '1px solid rgba(150,150,150,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: 10, background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg></div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{lang === 'bs' ? 'Izgled Aplikacije' : 'Application Appereance'}</div>
                        </div>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '4px 10px', borderRadius: 12, background: 'linear-gradient(135deg,#1f2937,#111827)', color: '#fff', marginLeft: 'auto', letterSpacing: 0.5 }}>ENTERPRISE</span>
                      </div>
                      
                      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                          {/* SMART THEMES */}
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '1.1rem' }}>✨</span> {lang === 'bs' ? 'Pametne Tematske Palete' : 'Smart Theme Palettes'}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                              {[
                                { name: 'Ocean', primary: '#0ea5e9', sidebar: '#0f172a' },
                                { name: 'Smaragd', primary: '#10b981', sidebar: '#064e3b' },
                                { name: 'Amethyst', primary: '#a855f7', sidebar: '#2e1065' },
                                { name: 'Sunset', primary: '#f97316', sidebar: '#1c1917' },
                                { name: 'Minimal', primary: '#14b8a6', sidebar: '#1e293b' },
                                { name: 'Classic', primary: '#005bea', sidebar: '#1c1c28' }
                              ].map(t => (
                                <button key={t.name} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 16, cursor: 'pointer', transition: 'all 0.25s', position: 'relative', overflow: 'hidden' }} 
                                  onClick={() => { setUiPrimaryColor(t.primary); setUiSidebarColor(t.sidebar); if(typeof window !== 'undefined') { document.documentElement.style.setProperty('--accent', t.primary); document.documentElement.style.setProperty('--bg-sidebar', t.sidebar); } setDirty('company'); }} 
                                  onMouseOver={e=>{e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.08)';}} 
                                  onMouseOut={e=>{e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none';}}>
                                  <div style={{ display: 'flex', width: '100%', height: 28, borderRadius: 8, overflow: 'hidden', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                                    <div style={{ flex: 1, background: t.sidebar }}></div>
                                    <div style={{ flex: 1, background: t.primary }}></div>
                                  </div>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{t.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* MANUAL COLORS & SIDEBAR LOGO ROW */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, padding: '20px', background: 'var(--bg-input)', borderRadius: 20, border: '1px solid var(--border)' }}>
                            {/* Primary */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: '1 1 200px' }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lang === 'bs' ? 'Primarna Web Boja' : 'Primary Color'}</div>
                              </div>
                              <label style={{ display: 'inline-block', width: 42, height: 42, borderRadius: 12, border: '2px solid rgba(150,150,150,0.2)', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                                <input type="color" value={uiPrimaryColor || EZNR_DEFAULTS.primaryColor} onChange={e=>{setUiPrimaryColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 80, height: 80, cursor: 'pointer', opacity: 0 }} />
                                <div style={{ width: '100%', height: '100%', background: uiPrimaryColor || EZNR_DEFAULTS.primaryColor, pointerEvents: 'none' }} />
                              </label>
                            </div>
                            {/* Sidebar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: '1 1 200px' }}>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{lang === 'bs' ? 'Boja Bočne Trake' : 'Sidebar Color'}</div>
                              </div>
                              <label style={{ display: 'inline-block', width: 42, height: 42, borderRadius: 12, border: '2px solid rgba(150,150,150,0.2)', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                                <input type="color" value={uiSidebarColor || EZNR_DEFAULTS.sidebarColor} onChange={e=>{setUiSidebarColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 80, height: 80, cursor: 'pointer', opacity: 0 }} />
                                <div style={{ width: '100%', height: '100%', background: uiSidebarColor || EZNR_DEFAULTS.sidebarColor, pointerEvents: 'none' }} />
                              </label>
                            </div>
                            {/* Logo Replace */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', paddingTop: 16, borderTop: '1px solid rgba(150,150,150,0.1)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: sidebarLogoEnabled ? 'var(--text)' : 'var(--text-muted)' }}>{lang === 'bs' ? 'Zamijeni logo mojim logom u bočnoj traci' : 'Replace logo with mine in sidebar'}</div>
                                  <div onClick={()=>{setSidebarLogoEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: sidebarLogoEnabled ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                    <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: sidebarLogoEnabled ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                  </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input type="text" value={sidebarText || ''} onChange={e=>{setSidebarText(e.target.value);setDirty('company');}} placeholder={lang==='bs'?'Tekst ispod loga... (opcionalno)':'Text below logo... (optional)'} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: '0.82rem', width: '100%', maxWidth: 400 }} />
                              </div>
                            </div>
                          </div>

                      </div>
                    </div>



                    {/* === PDF BRANDING CARD ( PREMIUM ) === */}
                    <div style={{ borderRadius: 20, background: 'var(--bg-card)', border: '1px solid rgba(150,150,150,0.15)', boxShadow: '0 12px 30px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                      <div style={{ padding: '20px 24px', background: 'linear-gradient(to right, rgba(150,150,150,0.03), transparent)', borderBottom: '1px solid rgba(150,150,150,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: 10, background: 'var(--bg-input)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg></div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text)' }}>{lang === 'bs' ? 'PDF Branding' : 'PDF Report Branding'}</div>
                        </div>
                        <button type="button" onClick={() => { if(confirm(lang==='bs'?'Poništi PDF postavke na početne EZNR vrijednosti?':'Reset PDF settings to EZNR defaults?')){setPdfAccentColor(EZNR_DEFAULTS.accentColor);setWmEnabled(true);setHeaderEnabled(true);setShowCompanyInfo(true);setShowCompanyName(true);setWmPosition('center');setWmOpacity(5);setWmSize(280);setWmContent('both');setLogoPosition('left');setLogoSize(40);setHeaderText('');setHeaderFontSize(12);setHeaderBold(false);setHeaderItalic(false);setHeaderUnderline(false);setHeaderColor('#1a1a2e');setDirty('company');} }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>↺ {lang === 'bs' ? 'Vrati zadane postavke' : 'Reset to Defaults'}</button>
                      </div>

                      <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                        
                        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                          
                          {/* Top Row Base settings */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{lang==='bs'?'Akcent Boja':'Accent Color'}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <label style={{ display: 'inline-block', width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                                    <input type="color" value={pdfAccentColor || EZNR_DEFAULTS.accentColor} onChange={e=>{setPdfAccentColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, cursor: 'pointer', opacity: 0 }} />
                                    <div style={{ width: '100%', height: '100%', background: pdfAccentColor || EZNR_DEFAULTS.accentColor, pointerEvents: 'none' }} />
                                  </label>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{lang==='bs'?'Podaci Firme':'Company Info'}</div>
                                <div onClick={()=>{setShowCompanyInfo(e=>!e);setDirty('company');}} style={{ width: 42, height: 24, background: showCompanyInfo !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                  <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: showCompanyInfo !== false ? 20 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{lang==='bs'?'Naziv Firme':'Company Name'}</div>
                                <div onClick={()=>{setShowCompanyName(e=>!e);setDirty('company');}} style={{ width: 42, height: 24, background: showCompanyName !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                  <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: showCompanyName !== false ? 20 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                </div>
                            </div>
                          </div>

                          {/* Header / Zaglavlje */}
                          <div style={{ background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)', textTransform: 'uppercase' }}>{lang === 'bs' ? 'Zaglavlje Dokumenta' : 'Document Header'}</div>
                              <div onClick={()=>{setHeaderEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: headerEnabled !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: headerEnabled !== false ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                              </div>
                            </div>
                            
                            {headerEnabled !== false && (
                              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>{lang==='bs'?'Pozicija Loga:':'Logo Position:'}</span>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {LOGO_POSITIONS.map(p => (
                                        <button key={p.id} onClick={() => { setLogoPosition(p.id); setDirty('company'); }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: logoPosition === p.id ? '2px solid var(--primary)' : '1px solid var(--border)', background: logoPosition === p.id ? 'var(--primary-glow)' : 'var(--bg-card)', color: logoPosition === p.id ? 'var(--primary)' : 'var(--text-muted)' }}>{p.label}</button>
                                      ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: 100 }}>{lang==='bs'?'Veličina Loga:':'Logo Size:'}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 200 }}>
                                      <input type="range" min={20} max={80} value={logoSize} onChange={e => { setLogoSize(+e.target.value); setDirty('company'); }} style={{ flex: 1, accentColor: 'var(--primary)' }} />
                                      <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 40, textAlign: 'right' }}>{logoSize}px</code>
                                    </div>
                                </div>

                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input type="text" value={headerText} onChange={e => { setHeaderText(e.target.value); setDirty('company'); }} placeholder={lang === 'bs' ? 'Dodatni tekst... (opcionalno)' : 'Header text... (optional)'} style={{ flex: '1 1 200px', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: '0.85rem', fontWeight: 600 }} />
                                    
                                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: '3px', borderRadius: 8, border: '1px solid var(--border)' }}>
                                      <button onClick={() => { setHeaderBold(b => !b); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerBold ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', fontWeight: 900, color: headerBold ? 'var(--primary)' : 'var(--text-muted)' }}>B</button>
                                      <button onClick={() => { setHeaderItalic(i => !i); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerItalic ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', fontStyle: 'italic', fontWeight: 700, color: headerItalic ? 'var(--primary)' : 'var(--text-muted)' }}>I</button>
                                      <button onClick={() => { setHeaderUnderline(u => !u); setDirty('company'); }} style={{ width: 34, height: 34, borderRadius: 6, border: 'none', background: headerUnderline ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', textDecoration: 'underline', fontWeight: 700, color: headerUnderline ? 'var(--primary)' : 'var(--text-muted)' }}>U</button>
                                    </div>
                                    <select value={headerFontSize} onChange={e => { setHeaderFontSize(+e.target.value); setDirty('company'); }} style={{ height: 40, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', fontSize: '0.8rem' }}>
                                      {[8,9,10,11,12,14,16,18,20].map(s => <option key={s} value={s}>{s}pt</option>)}
                                    </select>
                                    <label style={{ display: 'inline-block', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative', border: '1px solid var(--border)' }}>
                                      <input type="color" value={headerColor || '#000000'} onChange={e=>{setHeaderColor(e.target.value);setDirty('company');}} style={{ position: 'absolute', top: -10, left: -10, width: 60, height: 60, cursor: 'pointer', opacity: 0 }} />
                                      <div style={{ width: '100%', height: '100%', background: headerColor || '#000000', pointerEvents: 'none' }} />
                                    </label>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* WATERMARK MODULE */}
                          <div style={{ background: 'var(--bg-input)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(150,150,150,0.1)' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)', textTransform: 'uppercase' }}>{lang === 'bs' ? 'Vodeni Žig / Pečat' : 'Watermark'}</div>
                              <div onClick={()=>{setWmEnabled(e=>!e);setDirty('company');}} style={{ width: 46, height: 26, background: wmEnabled !== false ? 'var(--primary)' : 'var(--border)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ width: 22, height: 22, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: wmEnabled !== false ? 22 : 2, transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                              </div>
                            </div>
                            
                            {wmEnabled !== false && (
                              <div style={{ padding: '20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minWidth: 200 }}>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{lang === 'bs' ? 'Sadržaj:' : 'Content:'}</div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      {[{id:'logo',lbl:'Logo'},{id:'name',lbl:lang==='bs'?'Naziv':'Name'},{id:'both',lbl:lang==='bs'?'Oboje':'Both'}].map(o => (
                                        <button key={o.id} onClick={()=>{setWmContent(o.id);setDirty('company');}} style={{flex: 1, padding:'8px 6px',borderRadius:8,fontSize:'0.75rem',fontWeight:700,cursor:'pointer',border:wmContent===o.id?'2px solid var(--primary)':'1px solid var(--border)',background:wmContent===o.id?'var(--primary-glow)':'var(--bg-card)',color:wmContent===o.id?'var(--primary)':'var(--text-muted)'}}>{o.lbl}</button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{lang === 'bs' ? 'Transparentnost' : 'Opacity'} ({wmOpacity}%)</div>
                                    <input type="range" min={1} max={30} value={wmOpacity} onChange={e=>{setWmOpacity(+e.target.value);setDirty('company');}} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{lang === 'bs' ? 'Veličina' : 'Size'} ({wmSize}px)</div>
                                    <input type="range" min={80} max={600} value={wmSize} onChange={e=>{setWmSize(+e.target.value);setDirty('company');}} style={{ width: '100%', accentColor: 'var(--primary)' }} />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>{lang === 'bs' ? 'Pozicija' : 'Position'}</div>
                                  <table style={{ borderCollapse: 'separate', borderSpacing: '4px' }}>
                                    <tbody>
                                      {[0,1,2].map(r => (
                                        <tr key={r}>
                                          {[0,1,2].map(c => {
                                            const pos = WATERMARK_POSITIONS.find(p => p.row === r && p.col === c);
                                            if(!pos) return <td key={c}></td>;
                                            return (
                                              <td key={c} style={{ padding: 0 }}>
                                                <button type="button" onClick={()=>{setWmPosition(pos.id);setDirty('company');}} style={{ width: 44, height: 44, borderRadius: 10, fontSize: '1rem', cursor: 'pointer', border: 'none', background: wmPosition===pos.id ? 'var(--primary)' : 'var(--bg-card)', color: wmPosition===pos.id ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s', transform: wmPosition===pos.id ? 'scale(1.05)' : 'scale(1)', boxShadow: wmPosition===pos.id ? '0 4px 12px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>{pos.label}</button>
                                              </td>
                                            )
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                
                              </div>
                            )}
                          </div>

                        </div>

                        {/* LIVE REPORT PREVIEW HERO */}
                        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column' }}>
                           <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>{lang === 'bs' ? 'PDF simulacija' : 'Live Report Simulation'}</div>
                           <div style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 14, padding: '24px 24px 60px', position: 'relative', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', height: '100%', minHeight: 400 }}>
                              {/* Watermark Rendering */}
                              {wmEnabled !== false && (
                                <div style={{ position:'absolute', pointerEvents:'none', zIndex:0, textAlign:'center', top:wmPosition.includes('top')?'15%':wmPosition.includes('bottom')?'90%':'50%', left:wmPosition.includes('left')?'15%':wmPosition.includes('right')?'85%':'50%', transform:'translate(-50%,-50%)', opacity:wmOpacity/100, transition: 'all 0.4s ease' }}>
                                  {(wmContent==='logo'||wmContent==='both') && companyData.logo && <img src={companyData.logo} alt="" style={{maxWidth:wmSize*0.5,maxHeight:wmSize*0.3,objectFit:'contain',display:'block',margin:'0 auto'}} />}
                                  {(wmContent==='name'||wmContent==='both') && <div style={{fontSize:Math.max(6,Math.round(wmSize/16))+'pt',fontWeight:900,letterSpacing:1,textTransform:'uppercase',color:'#000',marginTop:4}}>{companyData.naziv||'NAZIV'}</div>}
                                </div>
                              )}

                              {/* Header Rendering */}
                              {headerEnabled !== false && (
                                <div style={{display:'flex',justifyContent:logoPosition==='center'?'center':'space-between',alignItems:'flex-start',borderBottom:'3px solid '+pdfAccentColor,paddingBottom:8,marginBottom:12,position:'relative',zIndex:1, transition: 'border-color 0.3s'}}>
                                  <div style={{textAlign:logoPosition==='center'?'center':'left'}}>
                                    {companyData.logo
                                      ?<img src={companyData.logo} alt="" style={{height:Math.max(logoSize*0.45, 30),maxWidth:120,objectFit:'contain',display:'block'}}/>
                                      :<div style={{fontSize:'8pt',fontWeight:800,color:pdfAccentColor}}>{companyData.naziv||'Company'}</div>}
                                    {showCompanyName !== false && companyData.logo && <div style={{fontSize:'5pt',fontWeight:800,color:'#333',textAlign:'center',width:Math.max(logoSize*0.45*4, 120),maxWidth:120,marginTop:2}}>{companyData.naziv}</div>}
                                  </div>
                                  {logoPosition!=='center' && showCompanyInfo !== false && (
                                    <div style={{textAlign:'right',fontSize:'3.5pt',color:'#666', lineHeight: 1.4}}>
                                      <div style={{fontWeight: 700, color: '#333', fontSize: '4.5pt'}}>{companyData.naziv}</div>
                                      <div>{companyData.adresa}</div>
                                      {companyData.jib && <div>JIB: {companyData.jib}</div>}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Custom text */}
                              {headerEnabled !== false && (
                                <div style={{fontSize:Math.max(5,headerFontSize*0.5)+'pt',fontWeight:headerBold?800:500,fontStyle:headerItalic?'italic':'normal',textDecoration:headerUnderline?'underline':'none',color:headerColor,marginBottom:15,position:'relative',zIndex:1}}>{headerText || (lang==='bs'?'Prazno...':'Empty...')}</div>
                              )}
                              
                              {/* Mock Content */}
                              <div style={{fontSize:'6pt',fontWeight:800,textTransform:'uppercase',letterSpacing:0.5,color:'#1e293b',position:'relative',zIndex:1, marginBottom: 8}}>{lang==='bs'?'IZVJEŠTAJ O PROCJENI':'ASSESSMENT REPORT'}</div>
                              <div style={{position:'relative',zIndex:1}}>{[1,2,3,4,5].map(i=>(
                                <div key={i} style={{display:'flex',gap:6,marginBottom:6}}>
                                  <div style={{width:'30%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                  <div style={{width:'50%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                  <div style={{width:'20%',height:4,background:i===1?pdfAccentColor+'33':'#f1f5f9',borderRadius:2}}/>
                                </div>
                              ))}</div>
                           </div>
                        </div>

                      </div>
                    </div>

                  </div>
                </div>{/* end super premium wrapper */}



                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
                  💾 {t('save')}
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

            {/* ── ALARMI SA TERENA (Real-time) ── */}
            <SectionHeader icon="🚨" title={lang === 'bs' ? 'Hitni Alarmi / Terenske Prijave' : 'Instant Alerts / Hazard Reports'} />
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body">
                    <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>
                                {lang === 'bs' ? 'Email za obavijesti sa terena' : 'Field Alert Email'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                                {lang === 'bs' 
                                    ? 'Ovo je email adresa na koju se šalju trenutačni alarmi čim neko skenira javni QR kod i prijavi opasnu situaciju. Možete unijeti više emailova odvojenih zarezom (,).' 
                                    : 'Immediate alerts will be sent here as soon as someone scans the public QR code and reports a hazard. You can enter multiple emails separated by commas (,).'}
                            </div>
                            <input 
                                className="form-input" 
                                style={{ maxWidth: 500, background: 'var(--bg-page)', borderColor: 'var(--danger)', borderWidth: 1 }}
                                placeholder={lang === 'bs' ? 'Npr. sigurnost@firma.ba, direktor@firma.ba' : 'E.g. safety@company.com, ceo@company.com'}
                                value={notifSettings.obsNotifEmail || ''} 
                                onChange={e => updateNotif('obsNotifEmail', e.target.value)} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={handleSaveNotifSettings}>💾 {lang === 'bs' ? 'Sačuvaj postavke obavijesti' : 'Save Notification Settings'}</button>
              {saved && !notifSyncError && <span className="animate-fadeIn" style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>✅ {lang === 'bs' ? 'Sačuvano!' : 'Saved!'}</span>}
              {notifSyncError && (
                <span className="animate-fadeIn" style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                  ⚠️ {lang === 'bs' ? 'Greška pri snimanju na server. Provjerite konzolu.' : 'Failed to save to server. Check the console.'}
                </span>
              )}
            </div>
            {notifSyncError && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.8rem', color: 'var(--danger)' }}>
                {lang === 'bs'
                  ? '⚠️ Postavke su sačuvane lokalno ali nisu sinhronizovane sa serverom. Email obavijesti s terena neće raditi dok se ovo ne ispravi. Provjerite da ste prijavljeni i pokušajte ponovo.'
                  : '⚠️ Settings saved locally but failed to sync to server. Field alert emails will not work until this is resolved. Make sure you are logged in and try again.'}
              </div>
            )}
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

            <div className="form-grid-2">
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
              <button className="btn btn-primary" onClick={handleSaveAppSettings}>💾 {lang === 'bs' ? 'Sačuvaj postavke prikaza' : 'Save Display Settings'}</button>
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
              

            {isAdmin && (
              <>
                <hr style={{ margin: '24px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                <SectionHeader icon="☠️" title={lang === 'bs' ? 'Opasna zona (Super Admin)' : 'Danger Zone'} />
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.3)' }}>
                  <div style={{ fontSize: '0.85rem', color: '#D32F2F', marginBottom: 16, fontWeight: 500 }}>
                    {lang === 'bs' 
                      ? 'PAŽNJA: Hard Wipe briše sve podatke za trenutno aktivnu kompaniju direktno sa Firebase Clouda. Ovo je nepovratno.' 
                      : 'WARNING: Hard Wipe completely deletes all data for the currently active company directly from Firebase. This cannot be undone.'}
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleWipeDev}
                    disabled={wiping || !activeCompanyId}
                    style={{ background: '#D32F2F', borderColor: '#D32F2F' }}
                  >
                    {wiping ? <span className="spinner" style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span> : '☠️'} 
                    {lang === 'bs' ? 'HARD WIPE DSC' : 'HARD WIPE COMPANY'}
                  </button>
                </div>
              </>
            )}

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
              <button className="btn btn-primary" onClick={handleSaveAppSettings}>💾 {lang === 'bs' ? 'Sačuvaj postavke sistema' : 'Save System Settings'}</button>
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
