"use client";
import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

/* ── i18n inline (landing-only texts) ─────────────────────────────────── */
const T = {
  bs: {
    navApp: "Platforma",
    navModules: "Mogućnosti",
    navContact: "Kontakt",
    login: "Prijava",
    badge: "🚀 Sljedeća generacija za ZNR",
    heroTitle: "Nova era zaštite na radu u vašem pregledniku",
    heroSub: "eZNR je jedino rješenje koje vam je potrebno za potpunu tehničku, pravnu i operativnu zaštitu na radu. Modernizirajte i ubrzajte svoje poslovanje danas.",
    ctaPrimary: "Zatražite Demo",
    ctaSecondary: "Saznajte više",
    videoTitle: "Upoznajte eZNR u akciji",
    videoSub: "Pogledajte kako izgleda svakodnevni rad u najnaprednijoj aplikaciji za zaštitu na radu.",
    modulesTitle: "Sveobuhvatni Ekosistem",
    m1T: "Popis opreme",
    m1D: "Upravljajte svom opremom na jednom mjestu, sa pametnim upozorenjima o isteku pregleda i atesta. Zaboravite na Excel tabele.",
    m2T: "Zia AI Asistent",
    m2D: "Pitajte našeg pametnog AI agenta o zakonima ili radnicima. Zia čita vašu bazu u stvarnom vremenu i daje precizne, kontekstualne odgovore.",
    m3T: "Certifikati i Uvjerenja",
    m3D: "Pravite ZOS i ZOP zapisnike te pratite rokove važenja ljekarskih uvjerenja. Sistem će vas automatski obavijestiti prije isteka.",
    m4T: "Izrada procjene rizika",
    m4D: "Kreirajte detaljne, zakonski usklađene procjene rizika za radna mjesta uz pomoć umjetne inteligencije i izvezite ih direktno u DOCX format.",
    m5T: "Mobilna aplikacija",
    m5D: "eZNR je u potpunosti dostupan i optimiziran za vaš pametni telefon. Brzo pristupite podacima, dodajte slike i izvršite provjere direktno na terenu.",
    contactTitle: "Obratite nam se!",
    contactSub: "Kontaktirajte nas za personaliziranu prezentaciju sistema i saznajte kako možemo značajno unaprijediti vaš proces zaštite na radu.",
    fName: "Ime i Prezime",
    fCompany: "Naziv Tvrtke",
    fEmail: "Poslovni e-mail",
    fPhone: "Telefon za kontakt",
    fSubmit: "Pošalji Upit",
    fAlert: "Vaš upit je poslan! Uskoro ćemo Vas kontaktirati.",
    footerDesc: "Enterprise Occupational Safety & Health System.",
    footerDistLabel: "Ekskluzivni distributer za Bosnu i Hercegovinu:",
    footerDist: "zastitanaradu.ba",
    footerTerms: "Uvjeti korištenja",
    footerPrivacy: "Politika privatnosti",
    termsUrl: "/legal/terms-bs.html",
    privacyUrl: "/legal/privacy-bs.html",
  },
  en: {
    navApp: "Platform",
    navModules: "Features",
    navContact: "Contact",
    login: "Sign In",
    badge: "🚀 Next-generation OSH Platform",
    heroTitle: "A new era of Occupational Safety in your browser",
    heroSub: "eZNR is the only platform you need for complete technical, legal and operational occupational safety management. Modernize your business today.",
    ctaPrimary: "Request Demo",
    ctaSecondary: "Learn More",
    videoTitle: "See eZNR in Action",
    videoSub: "Watch what daily operations look like in the most advanced occupational safety app.",
    modulesTitle: "Comprehensive Ecosystem",
    m1T: "Equipment Inventory",
    m1D: "Manage all your equipment in one place, with smart inspection and certification expiration alerts. Forget about Excel spreadsheets.",
    m2T: "Zia AI Assistant",
    m2D: "Ask our smart AI agent about regulations or workers. Zia reads your database in real time and provides precise, contextual answers.",
    m3T: "Certificates & Training",
    m3D: "Create ZOS and ZOP records and track the validity periods of medical certificates. The system will automatically notify you before expiration.",
    m4T: "Risk Assessment Generation",
    m4D: "Create detailed, legally compliant risk assessments for workplaces with the help of artificial intelligence and export directly to DOCX.",
    m5T: "Mobile Application",
    m5D: "eZNR is fully available and optimized for your smartphone. Quickly access data, add photos, and perform field checks on the go.",
    contactTitle: "Get in touch!",
    contactSub: "Contact us for a personalized system presentation and learn how we can significantly improve your occupational safety process.",
    fName: "Full Name",
    fCompany: "Company Name",
    fEmail: "Business Email",
    fPhone: "Phone Number",
    fSubmit: "Send Inquiry",
    fAlert: "Your inquiry has been sent! We will contact you shortly.",
    footerDesc: "Enterprise Occupational Safety & Health System.",
    footerDistLabel: "Exclusive distributor for Bosnia and Herzegovina:",
    footerDist: "zastitanaradu.ba",
    footerTerms: "Terms of Use",
    footerPrivacy: "Privacy Policy",
    termsUrl: "/legal/terms-en.html",
    privacyUrl: "/legal/privacy-en.html",
  },
};

export default function LandingPage() {
  const { lang, setLang } = useLanguage();
  const t = T[lang] || T.bs;
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(".reveal-element");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="landing-root">
      
      {/* ── Ambient Backgrounds ── */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>
      <div className="grid-overlay"></div>

      {/* ══════════════ NAVBAR ══════════════ */}
      <nav className={\`fixed-nav \${scrolled ? 'scrolled' : ''}\`}>
        <div className="nav-container">
          <div className="nav-brand">
            <Image src="/logo-icon.png" width={36} height={36} alt="eZNR" style={{ borderRadius: 8 }} />
            <span>eZNR</span>
          </div>

          <div className="nav-links desktop-only">
            <a href="#aplikacija">{t.navApp}</a>
            <a href="#moduli">{t.navModules}</a>
            <a href="#kontakt">{t.navContact}</a>
            
            <div className="lang-switcher">
              <button onClick={() => setLang("bs")} className={lang === "bs" ? "active" : ""}>BA</button>
              <button onClick={() => setLang("en")} className={lang === "en" ? "active" : ""}>EN</button>
            </div>
            
            <Link href="/login" className="btn-login">{t.login}</Link>
          </div>

          {/* Mobile hamburger */}
          <div className="mobile-only">
             <button className="hamburger" onClick={() => setMobileMenu(!mobileMenu)}>
               ☰
             </button>
          </div>
        </div>
      </nav>

      {mobileMenu && (
        <div className="mobile-menu">
          <a href="#aplikacija" onClick={() => setMobileMenu(false)}>{t.navApp}</a>
          <a href="#moduli" onClick={() => setMobileMenu(false)}>{t.navModules}</a>
          <a href="#kontakt" onClick={() => setMobileMenu(false)}>{t.navContact}</a>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button onClick={() => {setLang("bs"); setMobileMenu(false)}} style={{padding: '8px 16px', background: lang === 'bs' ? '#00BFA6' : '#222', borderRadius: 8, color: 'white', border: 'none'}}>BA</button>
            <button onClick={() => {setLang("en"); setMobileMenu(false)}} style={{padding: '8px 16px', background: lang === 'en' ? '#00BFA6' : '#222', borderRadius: 8, color: 'white', border: 'none'}}>EN</button>
          </div>
          <Link href="/login" className="btn-login" onClick={() => setMobileMenu(false)} style={{marginTop: 20}}>{t.login}</Link>
        </div>
      )}

      {/* ══════════════ HERO ══════════════ */}
      <header className="hero-section">
        <div className="hero-content reveal-element">
          <div style={{ marginBottom: 30 }}>
            <Image src="/landing/eznr_logo_main.png" width={220} height={70} alt="eZNR" style={{ objectFit: 'contain' }} />
          </div>
          <h1 className="hero-title">{t.heroTitle}</h1>
          <p className="hero-subtitle">{t.heroSub}</p>
          <div className="hero-cta">
            <a href="#kontakt" className="btn-primary-glow">{t.ctaPrimary}</a>
            <a href="#moduli" className="btn-secondary">{t.ctaSecondary}</a>
          </div>
        </div>
        
        <div className="hero-image-wrapper reveal-element" style={{ animationDelay: '0.2s' }}>
          <div className="hero-image-glow"></div>
          <img src="/landing/heropage.png" alt="eZNR Dashboard" className="hero-dashboard-img" />
        </div>
      </header>

      {/* ══════════════ VIDEO SHOWCASE ══════════════ */}
      <section id="aplikacija" className="video-section">
        <div className="container reveal-element">
          <div className="section-header center">
            <h2>{t.videoTitle}</h2>
            <p>{t.videoSub}</p>
          </div>
          <div className="mac-window">
            <div className="mac-header">
              <span className="dot close"></span>
              <span className="dot min"></span>
              <span className="dot max"></span>
            </div>
            <img src="/landing/demo-video.webp" alt="eZNR Demo" className="mac-content" />
          </div>
        </div>
      </section>

      {/* ══════════════ FEATURE SHOWCASE (Z-PATTERN) ══════════════ */}
      <section id="moduli" className="features-section">
        <div className="container">
          <div className="section-header center reveal-element">
            <h2>{t.modulesTitle}</h2>
            <div className="header-line"></div>
          </div>

          {/* Feature 1: Popis Opreme (Image Left) */}
          <div className="feature-row reveal-element">
            <div className="feature-img-container">
               <div className="feature-img-glow" style={{ background: 'rgba(0, 191, 166, 0.2)' }}></div>
               <img src="/landing/hpop.png" alt="Oprema" className="feature-img floating" />
            </div>
            <div className="feature-text">
               <div className="feature-badge">01</div>
               <h3>{t.m1T}</h3>
               <p>{t.m1D}</p>
               <ul className="feature-list">
                 <li>✓ Praćenje atesta</li>
                 <li>✓ QR kodovi opreme</li>
                 <li>✓ Historija servisa</li>
               </ul>
            </div>
          </div>

          {/* Feature 2: Zia AI (Image Right) */}
          <div className="feature-row reverse reveal-element">
            <div className="feature-img-container">
               <div className="feature-img-glow" style={{ background: 'rgba(99, 102, 241, 0.2)' }}></div>
               <img src="/landing/hzia_new.png" alt="Zia AI" className="feature-img floating-delay" />
            </div>
            <div className="feature-text">
               <div className="feature-badge" style={{ color: '#6366F1', background: 'rgba(99, 102, 241, 0.1)' }}>02</div>
               <h3>{t.m2T}</h3>
               <p>{t.m2D}</p>
               <ul className="feature-list">
                 <li>✓ Razumije kontekst vaših podataka</li>
                 <li>✓ Poznaje zakone BiH</li>
                 <li>✓ Chat uživo</li>
               </ul>
            </div>
          </div>

          {/* Feature 3: Certifikati i Uvjerenja (Image Left) */}
          <div className="feature-row reveal-element">
            <div className="feature-img-container">
               <div className="feature-img-glow" style={{ background: 'rgba(245, 158, 11, 0.2)' }}></div>
               <img src="/landing/hcert.png" alt="Certifikati" className="feature-img floating" />
            </div>
            <div className="feature-text">
               <div className="feature-badge" style={{ color: '#F59E0B', background: 'rgba(245, 158, 11, 0.1)' }}>03</div>
               <h3>{t.m3T}</h3>
               <p>{t.m3D}</p>
               <ul className="feature-list">
                 <li>✓ Ljekarska uvjerenja</li>
                 <li>✓ Generiranje ZOS i ZOP Zapisnika</li>
                 <li>✓ Evidencija radnika</li>
               </ul>
            </div>
          </div>

          {/* Feature 4: Procjena Rizika (Image Right) */}
          <div className="feature-row reverse reveal-element">
            <div className="feature-img-container">
               <div className="feature-img-glow" style={{ background: 'rgba(239, 68, 68, 0.2)' }}></div>
               <img src="/landing/hproc.png" alt="Procjena rizika" className="feature-img floating-delay" />
            </div>
            <div className="feature-text">
               <div className="feature-badge" style={{ color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)' }}>04</div>
               <h3>{t.m4T}</h3>
               <p>{t.m4D}</p>
               <ul className="feature-list">
                 <li>✓ AUVA Matrica procjene</li>
                 <li>✓ Preporuke mjera</li>
                 <li>✓ Generiranje službenog Word dokumenta</li>
               </ul>
            </div>
          </div>

          {/* Feature 5: Mobile App (Dual Images Left) */}
          <div className="feature-row reveal-element">
            <div className="feature-img-container dual-mobile">
               <div className="feature-img-glow" style={{ background: 'rgba(0, 191, 166, 0.3)', width: '120%' }}></div>
               <img src="/landing/hmob.jpg" alt="Mobile 1" className="mobile-img left-mobile floating" />
               <img src="/landing/hmob1.jpg" alt="Mobile 2" className="mobile-img right-mobile floating-delay" />
            </div>
            <div className="feature-text">
               <div className="feature-badge" style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.1)' }}>05</div>
               <h3>{t.m5T}</h3>
               <p>{t.m5D}</p>
               <ul className="feature-list">
                 <li>✓ Unos obilazaka na terenu</li>
                 <li>✓ Slanje slika drito u sistem</li>
                 <li>✓ Notifikacije u stvarnom vremenu</li>
               </ul>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════════ CONTACT ══════════════ */}
      <section id="kontakt" className="contact-section">
        <div className="container">
          <div className="contact-card reveal-element">
            <div className="contact-card-bg"></div>
            <h2 className="gradient-text text-center">{t.contactTitle}</h2>
            <p className="contact-sub">{t.contactSub}</p>
            
            <form className="modern-form" onSubmit={(e) => { e.preventDefault(); alert(t.fAlert); }}>
              <div className="form-grid">
                <div className="input-group">
                  <label>{t.fName}</label>
                  <input type="text" placeholder="John Doe" />
                </div>
                <div className="input-group">
                  <label>{t.fCompany}</label>
                  <input type="text" placeholder="Company d.o.o." />
                </div>
                <div className="input-group">
                  <label>{t.fEmail} *</label>
                  <input type="email" placeholder="john@company.com" required />
                </div>
                <div className="input-group">
                  <label>{t.fPhone}</label>
                  <input type="tel" placeholder="+387 61 123 456" />
                </div>
              </div>
              <div style={{ marginTop: 32, textAlign: 'center' }}>
                <button type="submit" className="btn-primary-glow large">{t.fSubmit}</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="modern-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
             <div className="brand-logo">
               <Image src="/logo-icon.png" width={32} height={32} alt="eZNR" style={{ borderRadius: 8 }} />
               <span>eZNR</span>
             </div>
             <p>{t.footerDesc}</p>
          </div>
          
          <div className="footer-dist">
            <span className="dist-label">{t.footerDistLabel}</span>
            <span className="dist-name">{t.footerDist}</span>
          </div>

          <div className="footer-links">
             <div className="links-row">
               <a href={t.termsUrl} target="_blank" rel="noopener noreferrer">{t.footerTerms}</a>
               <span className="dot-sep">•</span>
               <a href={t.privacyUrl} target="_blank" rel="noopener noreferrer">{t.footerPrivacy}</a>
             </div>
             <p className="copyright">© {new Date().getFullYear()} eZNR. Sva prava pridržana.</p>
          </div>
        </div>
      </footer>

      {/* ══════════════ STYLES ══════════════ */}
      <style>{`
        :root {
          --c-bg: #03080c;
          --c-surface: rgba(16, 28, 40, 0.6);
          --c-surface-hover: rgba(22, 38, 54, 0.8);
          --c-border: rgba(255, 255, 255, 0.08);
          --c-primary: #00BFA6;
          --c-primary-glow: rgba(0, 191, 166, 0.4);
          --c-text: #ffffff;
          --c-text-muted: rgba(255, 255, 255, 0.65);
          --font-main: 'Inter', sans-serif;
          --radius-lg: 24px;
          --radius-md: 16px;
        }

        /* Base */
        .landing-root {
          background-color: var(--c-bg);
          color: var(--c-text);
          font-family: var(--font-main);
          min-height: 100vh;
          overflow-x: hidden;
          position: relative;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Typography */
        h1, h2, h3 { font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; }
        p { line-height: 1.6; }
        .text-center { textAlign: center; }

        /* Backgrounds */
        .bg-glow { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.15; pointer-events: none; z-index: 0; }
        .bg-glow-1 { top: -10%; left: -10%; width: 50vw; height: 50vw; background: var(--c-primary); }
        .bg-glow-2 { top: 40%; right: -20%; width: 60vw; height: 60vw; background: #6366F1; }
        
        .grid-overlay {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        /* Nav */
        .fixed-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          padding: 20px 0; transition: all 0.3s ease;
        }
        .fixed-nav.scrolled {
          padding: 12px 0; background: rgba(3, 8, 12, 0.85); backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--c-border);
        }
        .nav-container { max-width: 1300px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; }
        .nav-brand { display: flex; align-items: center; gap: 12px; font-size: 1.5rem; font-weight: 900; }
        .nav-links { display: flex; align-items: center; gap: 32px; font-weight: 600; font-size: 0.95rem; }
        .nav-links a { color: var(--c-text-muted); text-decoration: none; transition: color 0.2s; }
        .nav-links a:hover { color: var(--c-text); }
        
        .lang-switcher { display: flex; background: rgba(255,255,255,0.05); padding: 4px; border-radius: 8px; }
        .lang-switcher button { background: none; border: none; color: var(--c-text-muted); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-weight: 700; transition: 0.2s; }
        .lang-switcher button.active { background: rgba(0, 191, 166, 0.2); color: var(--c-primary); }

        .btn-login { background: rgba(0, 191, 166, 0.1); border: 1px solid rgba(0, 191, 166, 0.3); color: var(--c-primary); padding: 10px 24px; border-radius: 12px; transition: 0.2s; text-decoration: none; }
        .btn-login:hover { background: rgba(0, 191, 166, 0.2); }

        .mobile-only { display: none; }
        .hamburger { background: none; border: none; color: white; font-size: 1.8rem; cursor: pointer; }
        .mobile-menu { position: fixed; top: 70px; left: 0; right: 0; background: rgba(3,8,12,0.98); padding: 24px; z-index: 99; display: flex; flex-direction: column; gap: 20px; border-bottom: 1px solid var(--c-border); backdrop-filter: blur(20px); }
        .mobile-menu a { color: white; text-decoration: none; font-size: 1.2rem; font-weight: 600; }

        @media (max-width: 900px) {
          .desktop-only { display: none; }
          .mobile-only { display: block; }
        }

        /* Hero */
        .hero-section {
          padding-top: 180px; padding-bottom: 80px; position: relative; z-index: 2; text-align: center;
        }
        .hero-content { max-width: 900px; margin: 0 auto 60px; }
        .hero-title { font-size: 4.8rem; margin-bottom: 24px; text-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .hero-subtitle { font-size: 1.25rem; color: var(--c-text-muted); max-width: 700px; margin: 0 auto 40px; }
        
        .hero-cta { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
        .btn-primary-glow {
          background: linear-gradient(135deg, #00e5c8 0%, #00a892 100%); color: #000; padding: 16px 36px; border-radius: 14px; font-weight: 800; font-size: 1rem; text-decoration: none; box-shadow: 0 10px 30px var(--c-primary-glow); transition: 0.3s;
        }
        .btn-primary-glow:hover { transform: translateY(-2px); box-shadow: 0 15px 40px rgba(0, 191, 166, 0.6); }
        .btn-primary-glow.large { font-size: 1.1rem; padding: 18px 48px; }
        
        .btn-secondary {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 16px 36px; border-radius: 14px; font-weight: 700; font-size: 1rem; text-decoration: none; transition: 0.3s; backdrop-filter: blur(10px);
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }

        .hero-image-wrapper { position: relative; max-width: 1200px; margin: 0 auto; perspective: 1200px; }
        .hero-image-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; height: 80%; background: radial-gradient(circle, var(--c-primary-glow) 0%, transparent 70%); filter: blur(60px); z-index: -1; }
        .hero-dashboard-img { width: 100%; border-radius: 20px; border: 1px solid var(--c-border); box-shadow: 0 40px 100px rgba(0,0,0,0.8); transform: rotateX(10deg); transform-origin: top; animation: float 8s ease-in-out infinite; }

        @keyframes float { 0%, 100% { transform: rotateX(10deg) translateY(0); } 50% { transform: rotateX(10deg) translateY(-20px); } }

        /* Video Showcase */
        .video-section { padding: 100px 0; background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.4), transparent); position: relative; z-index: 2; }
        .section-header { margin-bottom: 60px; }
        .section-header h2 { font-size: 2.8rem; margin-bottom: 16px; }
        .section-header p { font-size: 1.1rem; color: var(--c-text-muted); max-width: 600px; margin: 0 auto; }
        .header-line { width: 60px; height: 4px; background: var(--c-primary); margin: 24px auto 0; border-radius: 4px; }
        
        .mac-window { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-md); overflow: hidden; backdrop-filter: blur(20px); box-shadow: 0 30px 60px rgba(0,0,0,0.5); }
        .mac-header { background: rgba(0,0,0,0.3); padding: 12px 16px; display: flex; gap: 8px; border-bottom: 1px solid var(--c-border); }
        .mac-header .dot { width: 12px; height: 12px; border-radius: 50%; }
        .mac-header .close { background: #ff5f56; } .mac-header .min { background: #ffbd2e; } .mac-header .max { background: #27c93f; }
        .mac-content { width: 100%; display: block; }

        /* Features Z-Pattern Layout */
        .features-section { padding: 120px 0; position: relative; z-index: 2; }
        .feature-row { display: flex; align-items: center; gap: 60px; margin-bottom: 140px; }
        .feature-row.reverse { flex-direction: row-reverse; }
        
        .feature-img-container { flex: 1; position: relative; border-radius: var(--radius-lg); padding: 20px; }
        .feature-img-glow { position: absolute; inset: 0; filter: blur(50px); z-index: -1; border-radius: 50%; opacity: 0.6; }
        .feature-img { width: 100%; border-radius: var(--radius-md); border: 1px solid var(--c-border); box-shadow: 0 20px 50px rgba(0,0,0,0.4); object-fit: cover; }
        
        .feature-text { flex: 1; padding: 20px; }
        .feature-badge { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: rgba(0, 191, 166, 0.1); color: var(--c-primary); font-size: 1.2rem; font-weight: 800; border-radius: 12px; margin-bottom: 24px; }
        .feature-text h3 { font-size: 2.4rem; margin-bottom: 20px; }
        .feature-text p { font-size: 1.15rem; color: var(--c-text-muted); margin-bottom: 30px; }
        .feature-list { list-style: none; padding: 0; margin: 0; }
        .feature-list li { font-size: 1.05rem; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; font-weight: 500; color: #E2E8F0; }

        .floating { animation: float-simple 6s ease-in-out infinite; }
        .floating-delay { animation: float-simple 6s ease-in-out infinite; animation-delay: -3s; }
        @keyframes float-simple { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }

        /* Dual Mobile Setup */
        .dual-mobile { display: flex; align-items: flex-end; justify-content: center; gap: 20px; padding-top: 40px; }
        .mobile-img { width: 45%; max-width: 260px; border-radius: 24px; border: 1px solid var(--c-border); box-shadow: 0 20px 40px rgba(0,0,0,0.5); object-fit: contain; }
        .right-mobile { transform: translateY(30px); }

        /* Contact Section */
        .contact-section { padding: 80px 0 140px; position: relative; z-index: 2; }
        .contact-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 32px; padding: 80px 60px; position: relative; overflow: hidden; backdrop-filter: blur(20px); box-shadow: 0 40px 100px rgba(0,0,0,0.5); }
        .contact-card-bg { position: absolute; top: -50%; right: -50%; width: 100%; height: 100%; background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%); z-index: -1; }
        
        .gradient-text { background: linear-gradient(135deg, #00BFA6 0%, #6366F1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 3.5rem; margin-bottom: 20px; }
        .contact-sub { font-size: 1.15rem; color: var(--c-text-muted); text-align: center; max-width: 600px; margin: 0 auto 50px; }
        
        .modern-form { max-width: 800px; margin: 0 auto; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .input-group { display: flex; flex-direction: column; gap: 8px; }
        .input-group label { font-size: 0.9rem; font-weight: 600; color: rgba(255,255,255,0.8); padding-left: 4px; }
        .input-group input { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); padding: 16px 20px; border-radius: 14px; color: white; font-size: 1rem; font-family: var(--font-main); transition: 0.3s; outline: none; }
        .input-group input:focus { border-color: var(--c-primary); background: rgba(0,0,0,0.6); box-shadow: 0 0 0 4px rgba(0,191,166,0.1); }

        /* Footer */
        .modern-footer { border-top: 1px solid var(--c-border); padding: 60px 0 40px; background: #020406; position: relative; z-index: 2; }
        .footer-grid { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 40px; }
        .footer-brand { max-width: 300px; }
        .brand-logo { display: flex; align-items: center; gap: 12px; font-size: 1.3rem; font-weight: 800; margin-bottom: 16px; }
        .footer-brand p { color: var(--c-text-muted); font-size: 0.9rem; }
        
        .footer-dist { display: flex; flex-direction: column; gap: 6px; }
        .dist-label { color: rgba(255,255,255,0.4); font-size: 0.85rem; }
        .dist-name { color: var(--c-primary); font-weight: 700; font-size: 1.1rem; }
        
        .footer-links { text-align: right; }
        .links-row { display: flex; gap: 12px; align-items: center; justify-content: flex-end; margin-bottom: 12px; }
        .links-row a { color: var(--c-text-muted); text-decoration: none; font-size: 0.9rem; transition: 0.2s; }
        .links-row a:hover { color: white; }
        .dot-sep { color: rgba(255,255,255,0.2); }
        .copyright { color: rgba(255,255,255,0.3); font-size: 0.8rem; }

        /* Reveal Animation */
        .reveal-element { opacity: 0; transform: translateY(30px); transition: all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); }
        .reveal-element.visible { opacity: 1; transform: translateY(0); }

        /* Responsive */
        @media (max-width: 1024px) {
          .hero-title { font-size: 3.5rem; }
          .feature-row { flex-direction: column; gap: 40px; margin-bottom: 100px; }
          .feature-row.reverse { flex-direction: column; }
          .feature-img-container { width: 100%; }
          .feature-text { padding: 0; }
        }
        @media (max-width: 768px) {
          .hero-title { font-size: 2.8rem; }
          .form-grid { grid-template-columns: 1fr; }
          .contact-card { padding: 40px 24px; }
          .gradient-text { font-size: 2.5rem; }
          .footer-grid { flex-direction: column; align-items: center; text-align: center; }
          .footer-links { text-align: center; }
          .links-row { justify-content: center; }
        }
      `}</style>
    </div>
  );
}
