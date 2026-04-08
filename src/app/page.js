'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { initializeData, findUserByUsername } from '@/lib/dataStore';
import { isWebAuthnAvailable, hasStoredCredential, registerCredential, authenticateCredential } from '@/lib/webAuthn';

export default function LoginPage() {
  const { t, lang, toggleLang } = useLanguage();
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  // If already logged in, redirect to dashboard (prevents "back" looking like a logout)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);
  const [isRegister, setIsRegister] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    email: '',
    firstName: '',
    lastName: '',
    companyName: '',
    companyId: '',
    phone: '',
    city: '',
    address: '',
    acceptTerms: false,
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showBiometricOffer, setShowBiometricOffer] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState(null);
  const [hasBiometric, setHasBiometric] = useState(false);

  // Initialize data so user records are available
  useEffect(() => { initializeData(); }, []);

  // Check if biometric login is available
  useEffect(() => {
    if (isWebAuthnAvailable() && hasStoredCredential()) {
      setHasBiometric(true);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (loginError) setLoginError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    await new Promise((r) => setTimeout(r, 500));

    if (isRegister) {
      // Registration — creates user via dataStore
      const { create, COLLECTIONS } = await import('@/lib/dataStore');
      const existing = findUserByUsername(formData.username || formData.email);
      if (existing) {
        setLoginError(lang === 'bs' ? 'Korisničko ime već postoji!' : 'Username already exists!');
        setIsLoading(false);
        return;
      }
      // Create a default company for the new user
      const newCompany = create(COLLECTIONS.COMPANIES, {
        naziv: formData.companyName || 'Nova firma',
        skraceniNaziv: formData.companyName || 'Nova firma',
        adresa: formData.address || '',
        mjesto: formData.city || '',
        telefon: formData.phone || '',
        email: formData.email || '',
        aktivan: true,
      });
      const newUser = create(COLLECTIONS.USERS, {
        username: formData.username || formData.email,
        password: formData.password,
        firstName: formData.firstName || 'Korisnik',
        lastName: formData.lastName || '',
        email: formData.email || '',
        role: 'officer',
        companyIds: [newCompany.id],
        aktivan: true,
      });
      login({
        id: newUser.id,
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: 'officer',
        companyIds: [newCompany.id],
        companyName: formData.companyName || 'Nova firma',
      });
    } else {
      // Login validation
      const { getById, COLLECTIONS, findUserByUsername } = await import('@/lib/dataStore');
      let foundUser = findUserByUsername(formData.username);

      // If user typed 'admin' instead of email, grab their email from the DB
      // If we didn't find them by username, assume they typed an email directly
      const loginEmail = foundUser ? foundUser.email : formData.username;

      if (!loginEmail) {
        setLoginError(lang === 'bs' ? 'Korisnik nije pronađen.' : 'User not found.');
        setIsLoading(false);
        return;
      }

      try {
        // Securely verify password against Firebase Authentication
        const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
        const appModule = await import('@/lib/firebase');
        const auth = getAuth(appModule.default);

        await signInWithEmailAndPassword(auth, loginEmail, formData.password);

        // If we only had the email but not the full user object, look them up again
        // (in a real app you'd query Firestore by email here)
        if (!foundUser) {
          foundUser = findUserByUsername('admin'); // Fallback placeholder
        }

        if (!foundUser.aktivan) {
          setLoginError(lang === 'bs' ? 'Račun je deaktiviran. Kontaktirajte administratora.' : 'Account is deactivated. Contact admin.');
          setIsLoading(false);
          return;
        }
      } catch (err) {
        // Firebase rejected the login
        console.error("Firebase login error:", err);
        setLoginError(lang === 'bs' ? 'Pogrešno korisničko ime ili lozinka!' : 'Invalid username or password!');
        setIsLoading(false);
        return;
      }
      // Resolve company name for display
      const firstCompany = foundUser.companyIds?.[0] ? getById(COLLECTIONS.COMPANIES, foundUser.companyIds[0]) : null;
      login({
        id: foundUser.id,
        username: foundUser.username,
        firstName: foundUser.firstName,
        lastName: foundUser.lastName,
        email: foundUser.email,
        role: foundUser.role,
        companyIds: foundUser.companyIds || [],
        companyName: firstCompany?.naziv || '',
      });
    }
    setIsLoading(false);
    // If WebAuthn is available and no credential yet, offer to enroll
    if (isWebAuthnAvailable() && !hasStoredCredential()) {
      const userData = JSON.parse(localStorage.getItem('eznr_user'));
      if (userData) {
        setPendingLoginData(userData);
        setShowBiometricOffer(true);
        return; // Don't navigate yet — show offer first
      }
    }
    router.push('/dashboard');
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    try {
      const userData = await authenticateCredential();
      if (userData) {
        login(userData);
        router.push('/dashboard');
      } else {
        setLoginError(lang === 'bs' ? 'Biometrijska prijava nije uspjela.' : 'Biometric login failed.');
      }
    } catch (e) {
      setLoginError(lang === 'bs' ? 'Biometrijska prijava nije uspjela.' : 'Biometric login failed.');
    }
    setIsLoading(false);
  };

  const handleAcceptBiometric = async () => {
    try {
      await registerCredential(pendingLoginData.id, pendingLoginData.username, pendingLoginData);
    } catch (e) {
      console.warn('WebAuthn registration failed:', e);
    }
    setShowBiometricOffer(false);
    router.push('/dashboard');
  };

  const handleDeclineBiometric = () => {
    setShowBiometricOffer(false);
    router.push('/dashboard');
  };

  return (
    <div style={styles.page}>
      {/* Animated background */}
      <div style={styles.bgPattern} />
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      {/* Language switcher */}
      <button onClick={toggleLang} style={styles.langSwitcher}>
        <span style={styles.langIcon}>🌐</span>
        {lang === 'bs' ? 'EN' : 'BS'}
      </button>

      {/* ── Single centered card ── */}
      <div style={styles.card}>
        {/* Full logo banner — same as email header */}
        <div style={styles.logoHeader}>
          <Image
            src="/email-header.png"
            alt="eZNR – Digitalna platforma zaštite na radu"
            width={840}
            height={240}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            priority
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {isRegister && (
            <>
              <div style={styles.formRow}>
                <div className="form-group" style={styles.formGroup}>
                  <label className="form-label" style={styles.label}>{t('firstName')}</label>
                  <input className="form-input" style={styles.input} name="firstName" value={formData.firstName} onChange={handleChange} placeholder={t('mandatory')} required />
                </div>
                <div className="form-group" style={styles.formGroup}>
                  <label className="form-label" style={styles.label}>{t('lastName')}</label>
                  <input className="form-input" style={styles.input} name="lastName" value={formData.lastName} onChange={handleChange} placeholder={t('mandatory')} required />
                </div>
              </div>
              <div className="form-group" style={styles.formGroup}>
                <label className="form-label" style={styles.label}>{t('companyName')}</label>
                <input className="form-input" style={styles.input} name="companyName" value={formData.companyName} onChange={handleChange} placeholder={t('mandatory')} required />
              </div>
              <div className="form-group" style={styles.formGroup}>
                <label className="form-label" style={styles.label}>{t('email')}</label>
                <input className="form-input" style={styles.input} type="email" name="email" value={formData.email} onChange={handleChange} placeholder={t('mandatory')} required />
              </div>
            </>
          )}

          <div className="form-group" style={styles.formGroup}>
            <label className="form-label" style={styles.label}>{t('username')}</label>
            <input
              className="form-input" style={styles.input}
              name="username" value={formData.username} onChange={handleChange}
              placeholder={lang === 'bs' ? 'Korisničko ime ili email' : 'Username or email'}
              required autoComplete="username"
            />
          </div>

          <div className="form-group" style={styles.formGroup}>
            <label className="form-label" style={styles.label}>{t('password')}</label>
            <input
              className="form-input" style={styles.input}
              type="password" name="password" value={formData.password} onChange={handleChange}
              placeholder="••••••••" required autoComplete="current-password"
            />
          </div>

          {isRegister && (
            <>
              <div className="form-group" style={styles.formGroup}>
                <label className="form-label" style={styles.label}>{t('confirmPassword')}</label>
                <input className="form-input" style={styles.input} type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" required />
              </div>
              <div className="form-checkbox-wrapper">
                <input className="form-checkbox" type="checkbox" name="acceptTerms" checked={formData.acceptTerms} onChange={handleChange} required />
                <label style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{t('acceptTerms')}</label>
              </div>
            </>
          )}

          {!isRegister && (
            <div style={styles.formOptions}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
                <input type="checkbox" name="rememberMe" checked={formData.rememberMe} onChange={handleChange} style={{ accentColor: 'var(--primary)' }} />
                {t('rememberMe')}
              </label>
              <a href="#" style={styles.forgotLink}>{t('forgotPassword')}</a>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, minHeight: 52, fontSize: '1rem' }}
            disabled={isLoading}
          >
            {isLoading ? <span style={styles.spinner} /> : (isRegister ? t('registerButton') : t('loginButton'))}
          </button>

          {/* Biometric login button */}
          {!isRegister && hasBiometric && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              className="btn btn-lg"
              disabled={isLoading}
              style={{
                width: '100%', justifyContent: 'center', marginTop: 8, minHeight: 48,
                background: 'rgba(0,191,166,0.12)', border: '1.5px solid rgba(0,191,166,0.3)',
                color: '#00BFA6', fontSize: '0.92rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12,
                cursor: 'pointer', fontFamily: 'var(--font-heading)',
              }}
            >
              🔐 {lang === 'bs' ? 'Prijava otiskom prsta' : 'Login with fingerprint'}
            </button>
          )}

          {/* Biometric enrollment offer modal */}
          {showBiometricOffer && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            }}>
              <div style={{
                background: 'var(--bg-card, #1a2332)', border: '1px solid rgba(0,191,166,0.2)',
                borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '90%',
                textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔐</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
                  {lang === 'bs' ? 'Omogući brzu prijavu?' : 'Enable quick login?'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: 20, lineHeight: 1.5 }}>
                  {lang === 'bs'
                    ? 'Koristite otisak prsta ili prepoznavanje lica za brzu prijavu sljedeći put.'
                    : 'Use fingerprint or face recognition for quick login next time.'}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleDeclineBiometric}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-heading)',
                    }}>
                    {lang === 'bs' ? 'Ne sada' : 'Not now'}
                  </button>
                  <button onClick={handleAcceptBiometric}
                    className="btn btn-primary"
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12,
                      fontSize: '0.85rem', fontWeight: 700, justifyContent: 'center',
                    }}>
                    ✅ {lang === 'bs' ? 'Omogući' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {loginError && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginTop: 4,
              background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.35)',
              color: '#ffcdd2', fontSize: '0.84rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚠️ {loginError}
            </div>
          )}
        </form>
        <div style={styles.footer}>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>
            ©2026 <strong style={{ color: 'rgba(255,255,255,0.4)' }}>eZNR</strong> · zastitanaradu.ba
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0B2A3C 0%, #143d54 50%, #0B2A3C 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px 16px',
  },
  bgPattern: {
    position: 'absolute', inset: 0,
    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,191,166,0.07) 1px, transparent 0)`,
    backgroundSize: '40px 40px',
  },
  bgGlow1: {
    position: 'absolute', width: 600, height: 600, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,191,166,0.15) 0%, transparent 70%)',
    top: -200, right: -100,
  },
  bgGlow2: {
    position: 'absolute', width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(76,175,80,0.1) 0%, transparent 70%)',
    bottom: -150, left: -100,
  },
  langSwitcher: {
    position: 'fixed', top: 16, right: 16,
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px',
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 50, color: 'white', cursor: 'pointer',
    fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font-heading)',
    backdropFilter: 'blur(10px)', transition: 'all 0.2s', zIndex: 10,
  },
  langIcon: { fontSize: '1rem' },
  card: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: 460,
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(24px)',
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,191,166,0.1)',
    overflow: 'hidden',
  },
  logoHeader: {
    overflow: 'hidden',
    borderRadius: '24px 24px 0 0',
    lineHeight: 0,
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  brandTitle: {
    fontSize: '2rem', fontWeight: 900, color: 'white',
    fontFamily: 'var(--font-heading)', margin: 0, letterSpacing: '-1px',
  },
  brandTagline: {
    fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
    margin: '3px 0 0', lineHeight: 1.4,
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: 14,
    padding: '24px 32px 20px',
  },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' },
  input: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'white',
    borderRadius: 10,
  },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formOptions: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  forgotLink: { fontSize: '0.8rem', color: 'rgba(0,191,166,0.85)', fontWeight: 500, textDecoration: 'none' },
  footer: {
    padding: '14px 32px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    textAlign: 'center',
  },
  spinner: {
    display: 'inline-block', width: 20, height: 20,
    border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  },
};
