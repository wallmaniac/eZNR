"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
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
  hr: {
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
    modulesTitle: "Sveobuhvatni Ekosustav",
    m1T: "Popis opreme",
    m1D: "Upravljajte svom opremom na jednom mjestu, s pametnim upozorenjima o isteku pregleda i atesta. Zaboravite na Excel tablice.",
    m2T: "Zia AI Asistent",
    m2D: "Pitajte našeg pametnog AI agenta o zakonima ili radnicima. Zia čita vašu bazu u stvarnom vremenu i daje precizne, kontekstualne odgovore.",
    m3T: "Certifikati i Uvjerenja",
    m3D: "Izradite ZOS i ZOP zapisnike te pratite rokove važenja liječničkih uvjerenja. Sustav će vas automatski obavijestiti prije isteka.",
    m4T: "Izrada procjene rizika",
    m4D: "Kreirajte detaljne, zakonski usklađene procjene rizika za radna mjesta uz pomoć umjetne inteligencije i izvezite ih izravno u DOCX format.",
    m5T: "Mobilna aplikacija",
    m5D: "eZNR je u potpunosti dostupan i optimiziran za vaš pametni telefon. Brzo pristupite podacima, dodajte slike i izvršite provjere izravno na terenu.",
    contactTitle: "Obratite nam se!",
    contactSub: "Kontaktirajte nas za personaliziranu prezentaciju sustava i saznajte kako možemo značajno unaprijediti vaš proces zaštite na radu.",
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
};

export default function LandingPage() {
  const { lang, setLang } = useLanguage();
  const t = T[lang] || T.bs;
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const landingRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      // Normalize to -1 to 1
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (landingRef.current) {
        landingRef.current.style.setProperty('--mouse-x', x);
        landingRef.current.style.setProperty('--mouse-y', y);
      }
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

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
    <div className="landing-root" ref={landingRef}>
      
      {/* ── Animated Aurora & Stars Background ── */}
      <div className="aurora-bg">
        <div className="aurora-orb a-1"></div>
        <div className="aurora-orb a-2"></div>
        <div className="aurora-orb a-3"></div>
        <div className="aurora-orb a-4"></div>
      </div>
      <div className="starry-layer slow"></div>
      <div className="starry-layer fast"></div>
      <div className="grid-overlay"></div>

      {/* ══════════════ NAVBAR ══════════════ */}
      <nav className={`fixed-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-brand">
            <Image src="/logo-icon.png" width={36} height={36} alt="eZNR" style={{ borderRadius: 8 }} />
            <span>eZNR</span>
          </div>

          <div className="nav-links desktop-only">
            <a href="#aplikacija">{t.navApp}</a>
            <a href="#moduli">{t.navModules}</a>
            <a href="#kontakt">{t.navContact}</a>
            
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowLangMenu(!showLangMenu)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 6, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '6px 12px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                <img src={lang === 'hr' ? 'https://flagcdn.com/w40/hr.png' : lang === 'en' ? 'https://flagcdn.com/w40/gb.png' : lang === 'de' ? 'https://flagcdn.com/w40/de.png' : lang === 'sl' ? 'https://flagcdn.com/w40/si.png' : lang === 'sr' ? 'https://flagcdn.com/w40/rs.png' : 'https://flagcdn.com/w40/ba.png'} width={16} height={16} alt={lang} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                <span>{lang === 'hr' ? 'HR' : lang === 'en' ? 'EN' : lang === 'de' ? 'DE' : lang === 'sl' ? 'SL' : lang === 'sr' ? 'SR' : 'BA'}</span>
              </button>
              {showLangMenu && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 'auto', marginTop: 8, background: 'rgba(15,25,35,0.95)', backdropFilter: 'blur(10px)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', padding: '6px', minWidth: 120, zIndex: 100 }}>
                  {[
                    { code: 'bs', label: 'BA', flag: 'https://flagcdn.com/w40/ba.png', title: 'Bosanski' },
                    { code: 'hr', label: 'HR', flag: 'https://flagcdn.com/w40/hr.png', title: 'Hrvatski' },
                    { code: 'en', label: 'EN', flag: 'https://flagcdn.com/w40/gb.png', title: 'English' },
                    { code: 'de', label: 'DE', flag: 'https://flagcdn.com/w40/de.png', title: 'Deutsch' },
                    { code: 'sl', label: 'SL', flag: 'https://flagcdn.com/w40/si.png', title: 'Slovenščina' },
                    { code: 'sr', label: 'SR', flag: 'https://flagcdn.com/w40/rs.png', title: 'Srpski' }
                  ].map(l => (
                    <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: '6px 6px', width: '100%', border: 'none', background: lang === l.code ? 'rgba(0,191,166,0.15)' : 'transparent', color: lang === l.code ? '#00BFA6' : 'white', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontWeight: lang === l.code ? 700 : 500 }}>
                      <img src={l.flag} width={16} height={16} alt={l.label} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                      <span>{l.title}</span>
                    </button>
                  ))}
                </div>
              )}
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
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { code: 'bs', label: 'BA', flag: 'https://flagcdn.com/w40/ba.png' },
              { code: 'hr', label: 'HR', flag: 'https://flagcdn.com/w40/hr.png' },
              { code: 'en', label: 'EN', flag: 'https://flagcdn.com/w40/gb.png' },
              { code: 'de', label: 'DE', flag: 'https://flagcdn.com/w40/de.png' },
              { code: 'sl', label: 'SL', flag: 'https://flagcdn.com/w40/si.png' },
              { code: 'sr', label: 'SR', flag: 'https://flagcdn.com/w40/rs.png' }
            ].map(l => (
              <button key={l.code} onClick={() => {setLang(l.code); setMobileMenu(false)}} 
                style={{display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: lang === l.code ? '#00BFA6' : '#222', borderRadius: 8, color: 'white', border: 'none', fontWeight: 600}}>
                <img src={l.flag} width={18} height={18} alt={l.label} style={{ borderRadius: '50%', objectFit: 'cover' }} /> {l.label}
              </button>
            ))}
          </div>
          <Link href="/login" className="btn-login" onClick={() => setMobileMenu(false)} style={{marginTop: 20}}>{t.login}</Link>
        </div>
      )}

      {/* ══════════════ HERO ══════════════ */}
      <header className="hero-section">
        <div className="hero-content reveal-element">
          <div style={{ marginBottom: 30, display: 'flex', justifyContent: 'center' }}>
            {/* The logo was 220px originally. User wants it twice as big as it was *before*, making it 660x210. Let's make it massive (660x210) so it's fully visible and large. */}
            <Image src="/landing/eznr_logo_main.png" width={660} height={210} alt="eZNR" className="hero-main-logo" priority />
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

          <div className="bento-grid">
            
            {/* Feature 1: Popis Opreme */}
            <div className="bento-card reveal-element">
              <div className="feature-text">
                 <div className="feature-badge">01</div>
                 <h3>{t.m1T}</h3>
                 <p>{t.m1D}</p>
              </div>
              <div className="feature-img-container bento-img">
                 <div className="feature-img-glow" style={{ background: 'rgba(0, 191, 166, 0.3)' }}></div>
                 <img src="/landing/hpop.png" alt="Oprema" className="feature-img floating" />
              </div>
              <ul className="feature-list bento-list bento-list-vertical">
                 <li>✓ Praćenje atesta</li>
                 <li>✓ QR kodovi opreme</li>
                 <li>✓ Historija servisa</li>
              </ul>
            </div>

            {/* Feature 2: Zia AI */}
            <div className="bento-card reveal-element" style={{ transitionDelay: '0.1s' }}>
              <div className="feature-text">
                 <div className="feature-badge" style={{ color: '#6366F1', background: 'rgba(99, 102, 241, 0.1)' }}>02</div>
                 <h3>{t.m2T}</h3>
                 <p>{t.m2D}</p>
              </div>
              <div className="feature-img-container bento-img">
                 <div className="feature-img-glow" style={{ background: 'rgba(99, 102, 241, 0.3)' }}></div>
                 <img src="/landing/hzia_new.png" alt="Zia AI" className="feature-img floating-delay" />
              </div>
              <ul className="feature-list bento-list bento-list-vertical">
                 <li>✓ Razumije kontekst vaših podataka</li>
                 <li>✓ Poznaje zakone Zaštite na radu</li>
                 <li>✓ Chat uživo</li>
              </ul>
            </div>

            {/* Feature 3: Certifikati i Uvjerenja */}
            <div className="bento-card reveal-element">
              <div className="feature-text">
                 <div className="feature-badge" style={{ color: '#F59E0B', background: 'rgba(245, 158, 11, 0.1)' }}>03</div>
                 <h3>{t.m3T}</h3>
                 <p>{t.m3D}</p>
              </div>
              <div className="feature-img-container bento-img">
                 <div className="feature-img-glow" style={{ background: 'rgba(245, 158, 11, 0.3)' }}></div>
                 <img src="/landing/hcert.png" alt="Certifikati" className="feature-img floating" />
              </div>
              <ul className="feature-list bento-list bento-list-vertical">
                 <li>✓ Ljekarska uvjerenja</li>
                 <li>✓ Generiranje ZOS/ZOP Zapisnika</li>
                 <li>✓ Evidencija radnika</li>
              </ul>
            </div>

            {/* Feature 4: Procjena Rizika */}
            <div className="bento-card reveal-element" style={{ transitionDelay: '0.1s' }}>
              <div className="feature-text">
                 <div className="feature-badge" style={{ color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)' }}>04</div>
                 <h3>{t.m4T}</h3>
                 <p>{t.m4D}</p>
              </div>
              <div className="feature-img-container bento-img">
                 <div className="feature-img-glow" style={{ background: 'rgba(239, 68, 68, 0.3)' }}></div>
                 <img src="/landing/hproc.png" alt="Procjena rizika" className="feature-img floating-delay" />
              </div>
              <ul className="feature-list bento-list bento-list-vertical">
                 <li>✓ AUVA Matrica procjene</li>
                 <li>✓ Preporuke mjera</li>
                 <li>✓ Word izvoz</li>
              </ul>
            </div>

            {/* Feature 5: Mobile App (Full Width) */}
            <div className="bento-card full reveal-element">
              <div className="feature-text">
                 <div className="feature-badge" style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.1)' }}>05</div>
                 <h3>{t.m5T}</h3>
                 <p>{t.m5D}</p>
                 <ul className="feature-list bento-list bento-list-vertical">
                   <li>✓ Unos obilazaka na terenu</li>
                   <li>✓ Slanje slika direktno u sistem</li>
                   <li>✓ Notifikacije u stvarnom vremenu</li>
                 </ul>
              </div>
              <div className="feature-img-container dual-mobile">
                 <div className="feature-img-glow" style={{ background: 'rgba(0, 191, 166, 0.4)', width: '120%' }}></div>
                 <img src="/landing/hmob.jpg" alt="Mobile 1" className="mobile-img left-mobile floating" />
                 <img src="/landing/hmob1.jpg" alt="Mobile 2" className="mobile-img right-mobile floating-delay" />
              </div>
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
    </div>
  );
}
