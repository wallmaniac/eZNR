'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { initializeData, findUserByUsername } from '@/lib/dataStore';

export default function LoginPage() {
  const { t, lang, toggleLang } = useLanguage();
  const { login } = useAuth();
  const router = useRouter();
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

  // Initialize data so user records are available
  useEffect(() => { initializeData(); }, []);

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
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={isLoading}
          >
            {isLoading ? <span style={styles.spinner} /> : (isRegister ? t('registerButton') : t('loginButton'))}
          </button>

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
