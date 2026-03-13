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

      <div style={styles.container}>
        {/* Left panel - branding */}
        <div style={styles.brandPanel}>
          <div style={styles.brandContent}>
            <Image
              src="/logo-full.png"
              alt="eZNR Logo"
              width={400}
              height={400}
              style={styles.brandLogo}
              priority
            />
            <p style={styles.brandDesc}>
              {lang === 'bs'
                ? 'Kompletno rješenje za vođenje evidencija zaštite na radu i zaštite od požara u Bosni i Hercegovini.'
                : 'Complete solution for managing occupational safety and fire protection records in Bosnia and Herzegovina.'}
            </p>
            <div style={styles.features}>
              {[
                { icon: '📋', text: lang === 'bs' ? 'Evidencija radnika i opreme' : 'Worker & equipment records' },
                { icon: '📅', text: lang === 'bs' ? 'Automatsko praćenje rokova' : 'Automatic deadline tracking' },
                { icon: '📊', text: lang === 'bs' ? 'Izvještaji i analitika' : 'Reports & analytics' },
                { icon: '🔒', text: lang === 'bs' ? 'Sigurnost podataka' : 'Data security' },
              ].map((f, i) => (
                <div key={i} style={styles.featureItem}>
                  <span style={styles.featureIcon}>{f.icon}</span>
                  <span style={styles.featureText}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel - form */}
        <div style={styles.formPanel}>
          <div style={styles.formContainer}>
            <div style={styles.formHeader}>
              <Image
                src="/logo-icon.png"
                alt="eZNR"
                width={48}
                height={48}
                style={{ borderRadius: 12 }}
              />
              <div>
                <h1 style={styles.formTitle}>{isRegister ? t('register') : t('login')}</h1>
                <p style={styles.formSubtitle}>
                  {isRegister
                    ? (lang === 'bs' ? 'Kreirajte svoj račun' : 'Create your account')
                    : (lang === 'bs' ? 'Prijavite se na svoj račun' : 'Sign in to your account')}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {isRegister && (
                <>
                  <div style={styles.formRow}>
                    <div className="form-group">
                      <label className="form-label">{t('firstName')}</label>
                      <input
                        className="form-input"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder={t('mandatory')}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t('lastName')}</label>
                      <input
                        className="form-input"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        placeholder={t('mandatory')}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('companyName')}</label>
                    <input
                      className="form-input"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      placeholder={t('mandatory')}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('email')}</label>
                    <input
                      className="form-input"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder={t('mandatory')}
                      required
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">{t('username')}</label>
                <input
                  className="form-input"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder={lang === 'bs' ? 'ID firme ili email adresa' : 'Company ID or email address'}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('password')}</label>
                <input
                  className="form-input"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              {isRegister && (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('confirmPassword')}</label>
                    <input
                      className="form-input"
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('phone')}</label>
                    <input
                      className="form-input"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-checkbox-wrapper">
                    <input
                      className="form-checkbox"
                      type="checkbox"
                      name="acceptTerms"
                      checked={formData.acceptTerms}
                      onChange={handleChange}
                      required
                    />
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
                      {t('acceptTerms')}
                    </label>
                  </div>
                </>
              )}

              {!isRegister && (
                <div style={styles.formOptions}>
                  <div className="form-checkbox-wrapper">
                    <input
                      className="form-checkbox"
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                    />
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
                      {t('rememberMe')}
                    </label>
                  </div>
                  <a href="#" style={styles.forgotLink}>{t('forgotPassword')}</a>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span style={styles.spinner} />
                ) : (
                  isRegister ? t('registerButton') : t('loginButton')
                )}
              </button>

              {loginError && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginTop: 8,
                  background: 'rgba(244,67,54,0.12)', border: '1px solid rgba(244,67,54,0.3)',
                  color: '#C62828', fontSize: '0.85rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  ⚠️ {loginError}
                </div>
              )}

              {!isRegister && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginTop: 8,
                  background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)',
                  fontSize: '0.78rem', color: '#2E7D32',
                }}>
                  <strong>Demo:</strong> admin / admin123 {lang === 'bs' ? 'ili' : 'or'} officer / officer123
                </div>
              )}
            </form>

            <div style={styles.switchMode}>
              <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                {isRegister ? t('alreadyHaveAccount') : t('newUser')}
              </span>
              <button
                onClick={() => setIsRegister(!isRegister)}
                style={styles.switchBtn}
              >
                {isRegister ? t('loginHere') : t('registerHere')}
              </button>
            </div>
          </div>

          <div style={styles.footer}>
            <span>©2026 <strong>eZNR</strong> | www.zastitanaradu.ba</span>
          </div>
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
    padding: 20,
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,191,166,0.07) 1px, transparent 0)`,
    backgroundSize: '40px 40px',
  },
  bgGlow1: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(0,191,166,0.15) 0%, transparent 70%)',
    top: -200,
    right: -100,
  },
  bgGlow2: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(76,175,80,0.1) 0%, transparent 70%)',
    bottom: -150,
    left: -100,
  },
  langSwitcher: {
    position: 'fixed',
    top: 20,
    right: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 'var(--radius-full)',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: 'var(--font-heading)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.2s',
    zIndex: 10,
  },
  langIcon: { fontSize: '1.1rem' },
  container: {
    display: 'flex',
    width: '100%',
    maxWidth: 1100,
    minHeight: 650,
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden',
    boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
    position: 'relative',
    zIndex: 1,
  },
  brandPanel: {
    flex: '1 1 50%',
    background: 'linear-gradient(160deg, #0B2A3C 0%, #143d54 100%)',
    padding: '60px 40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  brandLogo: {
    width: '100%',
    maxWidth: 320,
    height: 'auto',
    marginBottom: 24,
    filter: 'drop-shadow(0 10px 30px rgba(0,191,166,0.3))',
  },
  brandDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '1rem',
    lineHeight: 1.7,
    maxWidth: 380,
    marginBottom: 32,
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: 320,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    background: 'rgba(0,191,166,0.08)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(0,191,166,0.15)',
  },
  featureIcon: { fontSize: '1.3rem' },
  featureText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  formPanel: {
    flex: '1 1 50%',
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  formContainer: {
    padding: '48px 40px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  formHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  formTitle: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'var(--dark)',
    fontFamily: 'var(--font-heading)',
  },
  formSubtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-light)',
    marginTop: 2,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  formOptions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotLink: {
    fontSize: '0.85rem',
    color: 'var(--primary)',
    fontWeight: 500,
  },
  switchMode: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginTop: 24,
  },
  switchBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary)',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-heading)',
  },
  footer: {
    padding: '16px 40px',
    borderTop: '1px solid var(--border-light)',
    textAlign: 'center',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  spinner: {
    display: 'inline-block',
    width: 20,
    height: 20,
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
};
