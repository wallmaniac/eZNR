'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { isWebAuthnAvailable, hasStoredCredential, registerCredential, authenticateCredential, clearAllBiometricCredentials } from '@/lib/webAuthn';

const recoverTexts = {
  bs: {
    passwordTab: "Zaboravljena lozinka",
    emailTab: "Zaboravljen e-mail",
    bothTab: "Zaboravljeno oboje",
    resetText: "Unesite e-mail za resetovanje lozinke:",
    forgotEmailTitle: "Zaboravili ste e-mail?",
    forgotEmailText: "Ukoliko ne znate e-mail adresu s kojom ste registrovani, obratite se administratoru svoje tvrtke koji Vas može pronaći u popisu radnika. Također možete kontaktirati našu podršku na:",
    forgotBothTitle: "Zaboravili ste oboje?",
    forgotBothText: "Ako ste zaboravili i e-mail i lozinku, kontaktirajte našu tehničku podršku telefonski ili putem e-maila za provjeru identiteta i obnovu pristupa:",
    supportPhone: "Telefon: +387 (0)33 922 922",
    supportEmail: "E-mail: podrska@zastitanaradu.ba",
    sending: "Slanje...",
  },
  hr: {
    passwordTab: "Zaboravljena lozinka",
    emailTab: "Zaboravljen e-mail",
    bothTab: "Zaboravljeno oboje",
    resetText: "Unesite e-mail za ponovno postavljanje lozinke:",
    forgotEmailTitle: "Zaboravili ste e-mail?",
    forgotEmailText: "Ako ne znate e-mail adresu s kojom ste registrirani, obratite se administratoru svoje tvrtke koji Vas može pronaći u popisu radnika. Također možete kontaktirati našu podršku na:",
    forgotBothTitle: "Zaboravili ste oboje?",
    forgotBothText: "Ako ste zaboravili i e-mail i lozinku, kontaktirajte našu tehničku podršku telefonski ili putem e-maila za provjeru identiteta i obnovu pristupa:",
    supportPhone: "Telefon: +385 (0)1 922 922",
    supportEmail: "E-mail: podrska@zastitanaradu.ba",
    sending: "Slanje...",
  },
  en: {
    passwordTab: "Forgot Password",
    emailTab: "Forgot Email",
    bothTab: "Forgot Both",
    resetText: "Enter your email to reset password:",
    forgotEmailTitle: "Forgot your email?",
    forgotEmailText: "If you do not know the email address you registered with, please contact your company administrator who can look you up in the directory. You can also contact our support at:",
    forgotBothTitle: "Forgot both?",
    forgotBothText: "If you have forgotten both your email and password, please contact our support team via phone or email to verify your identity and restore access:",
    supportPhone: "Phone: +387 (0)33 922 922",
    supportEmail: "Email: support@zastitanaradu.ba",
    sending: "Sending...",
  },
  de: {
    passwordTab: "Passwort vergessen",
    emailTab: "E-Mail vergessen",
    bothTab: "Beides vergessen",
    resetText: "Geben Sie Ihre E-Mail-Adresse ein, um Ihr Passwort zurückzusetzen:",
    forgotEmailTitle: "E-Mail-Adresse vergessen?",
    forgotEmailText: "Wenn Sie die registrierte E-Mail-Adresse nicht kennen, wenden Sie sich bitte an den Administrator Ihres Unternehmens. Sie können sich auch an unseren Support wenden:",
    forgotBothTitle: "Beides vergessen?",
    forgotBothText: "Wenn Sie sowohl E-Mail-Adresse als auch Passwort vergessen haben, wenden Sie sich an unseren Support per Telefon oder E-Mail, um Ihre Identität zu bestätigen:",
    supportPhone: "Tel: +387 (0)33 922 922",
    supportEmail: "E-Mail: podrska@zastitanaradu.ba",
    sending: "Wird gesendet...",
  },
  sl: {
    passwordTab: "Pozabljeno geslo",
    emailTab: "Pozabljena e-pošta",
    bothTab: "Pozabljeno oboje",
    resetText: "Vnesite e-poštni naslov za ponastavitev gesla:",
    forgotEmailTitle: "Pozabili e-pošto?",
    forgotEmailText: "Če ne veste e-poštnega naslova, s katerim ste registrirani, se obrnite na skrbnika svojega podjetja. Lahko se obrnete tudi na našo podporo na:",
    forgotBothTitle: "Pozabili oboje?",
    forgotBothText: "Če ste pozabili tako e-pošto kot geslo, se obrnite na našo tehnično podporo po telefonu ali e-pošti, da potrdimo vašo identiteto:",
    supportPhone: "Telefon: +387 (0)33 922 922",
    supportEmail: "E-pošta: podrska@zastitanaradu.ba",
    sending: "Pošiljanje...",
  },
  sr: {
    passwordTab: "Zaboravljena lozinka",
    emailTab: "Zaboravljen e-mail",
    bothTab: "Zaboravljeno oboje",
    resetText: "Unesite e-mail za resetovanje lozinke:",
    forgotEmailTitle: "Zaboravili ste e-mail?",
    forgotEmailText: "Ukoliko ne znate e-mail adresu s kojom ste registrovani, obratite se administratoru svoje firme koji Vas može pronaći u spisku radnika. Takođe možete kontaktirati našu podršku na:",
    forgotBothTitle: "Zaboravili ste oboje?",
    forgotBothText: "Ako ste zaboravili i e-mail i lozinku, kontaktirajte našu tehničku podršku telefonski ili putem e-maila za proveru identiteta i obnovu pristupa:",
    supportPhone: "Telefon: +387 (0)33 922 922",
    supportEmail: "E-mail: podrska@zastitanaradu.ba",
    sending: "Slanje...",
  }
};

export default function LoginPage() {
  const { t, lang, setLang } = useLanguage();
  const { login, register, isAuthenticated, forgotPassword } = useAuth();
  const router = useRouter();

  const [isRegister, setIsRegister] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotTab, setForgotTab] = useState('password');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // If already logged in, redirect to dashboard or deep link
  useEffect(() => {
    if (isAuthenticated && !showBiometricOffer) {
      const qs = new URLSearchParams(window.location.search);
      const redirectUrl = qs.get('redirect');
      router.replace(redirectUrl || '/dashboard');
    }
  }, [isAuthenticated, router, showBiometricOffer]);

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

    try {
      if (isRegister) {
        // ── Registration via Firebase Auth ──
        if (formData.password !== formData.confirmPassword) {
          setLoginError(t('passwordsDoNotMatch'));
          setIsLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setLoginError(t('passwordMustBeAtLeast1'));
          setIsLoading(false);
          return;
        }
        await register({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          companyName: formData.companyName,
          phone: formData.phone,
          city: formData.city,
          address: formData.address,
        });
        // onAuthStateChanged in AuthContext handles the rest
        const qs = new URLSearchParams(window.location.search);
        router.push(qs.get('redirect') || '/dashboard');
      } else {
        // ── Login via Firebase Auth ──
        const emailToUse = formData.username.includes('@') ? formData.username : formData.username;
        await login(emailToUse, formData.password);
        // onAuthStateChanged in AuthContext handles the rest
      }
    } catch (err) {
      console.error('Auth error:', err);
      const code = err?.code || err?.message || '';
      if (code.includes('user-not-found') || code === 'USER_PROFILE_NOT_FOUND') {
        setLoginError(t('userNotFound'));
      } else if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setLoginError(t('pogresnaLozinka'));
      } else if (code.includes('email-already-in-use')) {
        setLoginError(t('emailAlreadyRegistered'));
      } else if (code.includes('invalid-email')) {
        setLoginError(t('invalidEmailFormat'));
      } else if (code.includes('weak-password')) {
        setLoginError(t('passwordTooWeakMin6'));
      } else if (code === 'ACCOUNT_DEACTIVATED') {
        setLoginError(t('accountDeactivatedContactAdmin'));
      } else {
        setLoginError(t('loginFailedPleaseTryAgain'));
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    // If WebAuthn is available and no credential yet, offer to enroll
    if (!isRegister && isWebAuthnAvailable() && !hasStoredCredential() && !localStorage.getItem('eznr_biometric_declined')) {
      const userData = JSON.parse(localStorage.getItem('eznr_user'));
      if (userData) {
        // Temporarily stash password so we can authenticate against Firebase later!
        userData.fsPassword = formData.password;
        setPendingLoginData(userData);
        setShowBiometricOffer(true);
        return;
      }
    }
    const qs = new URLSearchParams(window.location.search);
    router.push(qs.get('redirect') || '/dashboard');
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    try {
      const userData = await authenticateCredential();
      if (userData && userData.fsPassword) {
        // WebAuthn success! Now login to Firebase using the stored password
        await login(userData.email, userData.fsPassword);
        const qs = new URLSearchParams(window.location.search);
        router.push(qs.get('redirect') || '/dashboard');
      } else {
        setLoginError(t('biometricLoginCanceledOrFailed'));
      }
    } catch (e) {
      setLoginError(t('biometricLoginFailed'));
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
    const qs = new URLSearchParams(window.location.search);
    router.push(qs.get('redirect') || '/dashboard');
  };

  const handleDeclineBiometric = () => {
    localStorage.setItem('eznr_biometric_declined', 'true');
    setShowBiometricOffer(false);
    const qs = new URLSearchParams(window.location.search);
    router.push(qs.get('redirect') || '/dashboard');
  };

  return (
    <div className="login-page-container" style={styles.page}>
      {/* Back button */}
      <Link href="/" style={styles.backButton} className="login-back-button">
        ← {t('nazad')}
      </Link>
      {/* Animated background */}
      <div style={styles.bgPattern} />
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      {/* Language switcher dropdown */}
      <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 999 }}>
        <button onClick={() => setShowLangMenu(!showLangMenu)} style={{...styles.langSwitcher, width: 110, justifyContent: 'flex-start'}}>
          <img src={lang === 'hr' ? 'https://flagcdn.com/hr.svg' : lang === 'en' ? 'https://flagcdn.com/gb.svg' : lang === 'de' ? 'https://flagcdn.com/de.svg' : lang === 'sl' ? 'https://flagcdn.com/si.svg' : lang === 'sr' ? 'https://flagcdn.com/rs.svg' : 'https://flagcdn.com/ba.svg'} width={18} height={18} alt={lang} style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: (lang === 'sl' || lang === 'sr') ? '28% 50%' : 'center' }} />
          <span>{lang === 'hr' ? 'HR' : lang === 'en' ? 'EN' : lang === 'de' ? 'DE' : lang === 'sl' ? 'SL' : lang === 'sr' ? 'SR' : 'BA'}</span>
        </button>
        {showLangMenu && (
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'rgba(20,40,60,0.95)', backdropFilter: 'blur(10px)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', padding: 6, width: 130, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {[
              { code: 'bs', label: 'BA', flag: 'https://flagcdn.com/ba.svg', title: 'Bosanski' },
              { code: 'hr', label: 'HR', flag: 'https://flagcdn.com/hr.svg', title: 'Hrvatski' },
              { code: 'en', label: 'EN', flag: 'https://flagcdn.com/gb.svg', title: 'English' },
              { code: 'de', label: 'DE', flag: 'https://flagcdn.com/de.svg', title: 'Deutsch' },
              { code: 'sl', label: 'SL', flag: 'https://flagcdn.com/si.svg', title: 'Slovenščina' },
              { code: 'sr', label: 'SR', flag: 'https://flagcdn.com/rs.svg', title: 'Srpski' }
            ].map(l => (
              <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: '8px 8px', width: '100%', border: 'none', background: lang === l.code ? 'rgba(0,191,166,0.15)' : 'transparent', color: lang === l.code ? '#00BFA6' : 'rgba(255,255,255,0.8)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontWeight: lang === l.code ? 700 : 500, transition: 'all 0.15s' }}
                onMouseEnter={e => { if(lang !== l.code) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={e => { if(lang !== l.code) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; } }}>
                <img src={l.flag} width={18} height={18} alt={l.label} style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: (l.code === 'sl' || l.code === 'sr') ? '28% 50%' : 'center' }} />
                <span>{l.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Single centered card ── */}
      <div style={styles.card}>
        {/* Full logo banner — same as email header */}
        <Link href="/" style={{ display: 'block', cursor: 'pointer', ...styles.logoHeader }}>
          <Image
            src="/email-header.png"
            alt="eZNR – Digitalna platforma zaštite na radu"
            width={840}
            height={240}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            priority
          />
        </Link>

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
            <label className="form-label" style={styles.label}>{isRegister ? t('email') : t('username')}</label>
            <input
              className="form-input" style={styles.input}
              name="username" value={formData.username} onChange={handleChange}
              placeholder={isRegister ? 'email@example.com' : (t('emailAddress'))}
              type={isRegister ? 'email' : 'text'}
              required autoComplete="username"
            />
          </div>

          <div className="form-group" style={styles.formGroup}>
            <label className="form-label" style={styles.label}>{t('password')}</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                className="form-input" style={{ ...styles.input, paddingRight: '40px', width: '100%' }}
                type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange}
                placeholder="••••••••" required autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  outline: 'none',
                }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>

          {isRegister && (
            <>
              <div className="form-group" style={styles.formGroup}>
                <label className="form-label" style={styles.label}>{t('confirmPassword')}</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    className="form-input" style={{ ...styles.input, paddingRight: '40px', width: '100%' }}
                    type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                    placeholder="••••••••" required
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      outline: 'none',
                    }}
                  >
                    {showConfirmPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    )}
                  </button>
                </div>
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
              <a href="#" onClick={(e) => { e.preventDefault(); setShowForgotPassword(true); }} style={styles.forgotLink}>{t('forgotPassword')}</a>
            </div>
          )}

          {/* Forgot password / account recovery modal */}
          {showForgotPassword && (
            <div style={{ padding: '16px', background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.2)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* Tab headers */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6, gap: 10 }}>
                {['password', 'email', 'both'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setForgotTab(tab)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: forgotTab === tab ? '#00BFA6' : 'rgba(255,255,255,0.5)',
                      fontWeight: forgotTab === tab ? 700 : 500,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: '4px 0',
                      borderBottom: forgotTab === tab ? '2px solid #00BFA6' : 'none',
                      outline: 'none',
                    }}
                  >
                    {recoverTexts[lang]?.[tab + 'Tab'] || recoverTexts.bs[tab + 'Tab']}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {forgotTab === 'password' && (
                <div>
                  {forgotSent ? (
                    <div style={{ textAlign: 'center', padding: '10px 0' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>✅</div>
                      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>
                        {t('passwordResetEmailSent')}
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(''); }}>
                        {t('zatvori')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontWeight: 600 }}>
                        {recoverTexts[lang]?.resetText || recoverTexts.bs.resetText}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="form-input" style={{ ...styles.input, flex: 1 }}
                          type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                          placeholder="email@example.com" disabled={isSendingForgot}
                        />
                        <button type="button" className="btn btn-primary btn-sm" disabled={isSendingForgot} onClick={async () => {
                          if (!forgotEmail || isSendingForgot) return;
                          setIsSendingForgot(true);
                          try {
                            await forgotPassword(forgotEmail);
                            setForgotSent(true);
                          } catch (err) {
                            setLoginError(t('emailNotFound'));
                            setShowForgotPassword(false);
                          } finally {
                            setIsSendingForgot(false);
                          }
                        }}>
                          {isSendingForgot ? (recoverTexts[lang]?.sending || recoverTexts.bs.sending) : t('posalji')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {forgotTab === 'email' && (
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: 'white', marginBottom: 6 }}>
                    {recoverTexts[lang]?.forgotEmailTitle || recoverTexts.bs.forgotEmailTitle}
                  </div>
                  <p style={{ marginBottom: 8 }}>
                    {recoverTexts[lang]?.forgotEmailText || recoverTexts.bs.forgotEmailText}
                  </p>
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>📞 {recoverTexts[lang]?.supportPhone || recoverTexts.bs.supportPhone}</div>
                    <div style={{ marginTop: 4 }}>✉️ {recoverTexts[lang]?.supportEmail || recoverTexts.bs.supportEmail}</div>
                  </div>
                </div>
              )}

              {forgotTab === 'both' && (
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: 'white', marginBottom: 6 }}>
                    {recoverTexts[lang]?.forgotBothTitle || recoverTexts.bs.forgotBothTitle}
                  </div>
                  <p style={{ marginBottom: 8 }}>
                    {recoverTexts[lang]?.forgotBothText || recoverTexts.bs.forgotBothText}
                  </p>
                  <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>📞 {recoverTexts[lang]?.supportPhone || recoverTexts.bs.supportPhone}</div>
                    <div style={{ marginTop: 4 }}>✉️ {recoverTexts[lang]?.supportEmail || recoverTexts.bs.supportEmail}</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}
                  onClick={() => setShowForgotPassword(false)}>
                  {t('cancel')}
                </button>
              </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <button
                type="button"
                onClick={handleBiometricLogin}
                className="btn btn-lg"
                disabled={isLoading}
                style={{
                  width: '100%', justifyContent: 'center', minHeight: 48,
                  background: 'rgba(0,191,166,0.12)', border: '1.5px solid rgba(0,191,166,0.3)',
                  color: '#00BFA6', fontSize: '0.92rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12,
                  cursor: 'pointer', fontFamily: 'var(--font-heading)',
                }}
              >
                🔐 {t('loginWithFingerprint')}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllBiometricCredentials();
                  localStorage.removeItem('eznr_biometric_declined');
                  setHasBiometric(false);
                }}
                style={{
                  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline',
                  padding: '4px', textAlign: 'center', margin: '0 auto'
                }}
              >
                {t('removeSavedFingerprintFromDevice')}
              </button>
            </div>
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
                  {t('enableQuickLogin')}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: 20, lineHeight: 1.5 }}>
                  {t('useFingerprintForQuickLogin')}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleDeclineBiometric}
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                      fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-heading)',
                    }}>
                    {t('notNow')}
                  </button>
                  <button onClick={handleAcceptBiometric}
                    className="btn btn-primary"
                    style={{
                      flex: 1, padding: '12px', borderRadius: 12,
                      fontSize: '0.85rem', fontWeight: 700, justifyContent: 'center',
                    }}>
                    ✅ {t('enable')}
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
  backButton: {
    position: 'fixed',
    top: 16,
    left: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 50,
    color: 'white',
    textDecoration: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
    fontFamily: 'var(--font-heading)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.2s',
    zIndex: 10,
  },
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
