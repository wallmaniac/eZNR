"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

/* ── i18n inline (landing-only texts) ─────────────────────────────────── */
const T = {
  bs: {
    navApp: "Moć Aplikacije",
    navModules: "Moduli",
    navContact: "Kontakt",
    login: "Prijava",
    badge: "🚀 Sljedeća generacija za ZNR",
    heroTitle: "Sveobuhvatna zaštita na radu u vašem pregledniku",
    heroSub: "eZNR platforma jedino je rješenje koje vam je potrebno za potpunu tehničku, pravnu i operativnu zaštitu na radu. Modernizirajte svoje poslovanje danas.",
    ctaPrimary: "Zatražite Demo",
    ctaSecondary: "Saznajte više",
    videoTitle: "Upoznajte eZNR u akciji",
    videoSub: "Pogledajte kako izgleda svakodnevni rad u najnaprednijoj aplikaciji za zaštitu na radu.",
    modulesTitle: "Sveobuhvatni Ekosustav",
    m1T: "Popis opreme",
    m1D: "Upravljajte svom opremom na jednom mjestu, sa upozorenjima o isteku pregleda i atesta.",
    m2T: "Zia AI Asistent",
    m2D: "Pitajte našeg AI agenta o zakonima ili radnicima. Zia čita vašu bazu i daje precizne odgovore.",
    m3T: "Certifikati i Uvjerenja",
    m3D: "Pravite ZOS i ZOP zapisnike te pratite rokove važenja ljekarskih uvjerenja bez muke.",
    m4T: "Izrada procjene rizika",
    m4D: "Kreirajte detaljne procjene rizika za radna mjesta uz pomoć umjetne inteligencije i izvezite u DOCX.",
    m5T: "Mobilna aplikacija",
    m5D: "eZNR je dostupan i na vašem pametnom telefonu. Brzo pristupite podacima i izvršite provjere na terenu.",
    contactTitle: "Obratite nam se!",
    contactSub: "Kontaktirajte nas za personaliziranu prezentaciju sistema i saznajte kako možemo unaprijediti vaš proces zaštite na radu.",
    fName: "Ime i Prezime",
    fCompany: "Naziv Tvrtke",
    fEmail: "Poslovni e-mail",
    fPhone: "Telefon za kontakt",
    fSubmit: "Zatraži Kontakt i Pristup",
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
    navApp: "App Power",
    navModules: "Modules",
    navContact: "Contact",
    login: "Sign In",
    badge: "🚀 Next-generation OSH Platform",
    heroTitle: "Comprehensive Occupational Safety in your browser",
    heroSub: "eZNR is the only platform you need for complete technical, legal and operational occupational safety management. Modernize your business today.",
    ctaPrimary: "Request Demo",
    ctaSecondary: "Learn More",
    videoTitle: "See eZNR in Action",
    videoSub: "Watch what daily operations look like in the most advanced occupational safety app.",
    modulesTitle: "Comprehensive Ecosystem",
    m1T: "Equipment Inventory",
    m1D: "Manage all your equipment in one place, with inspection and certification expiration alerts.",
    m2T: "Zia AI Assistant",
    m2D: "Ask our AI agent about regulations or workers. Zia reads your database and provides precise answers.",
    m3T: "Certificates & Training",
    m3D: "Create ZOS and ZOP records and track the validity periods of medical certificates effortlessly.",
    m4T: "Risk Assessment Generation",
    m4D: "Create detailed risk assessments for workplaces with the help of artificial intelligence and export to DOCX.",
    m5T: "Mobile Application",
    m5D: "eZNR is also available on your smartphone. Quickly access data and perform field checks.",
    contactTitle: "Get in touch!",
    contactSub: "Contact us for a personalized system presentation and learn how we can improve your occupational safety process.",
    fName: "Full Name",
    fCompany: "Company Name",
    fEmail: "Business Email",
    fPhone: "Phone Number",
    fSubmit: "Request Contact & Access",
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

/* ── Particle config ──────────────────────────────────────────────────── */
function generateParticles(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    size: Math.random() * 3 + 1.5,
    delay: Math.random() * 25,
    duration: Math.random() * 18 + 12,
    hue: Math.random() > 0.5 ? "0, 191, 166" : "120, 100, 255",
    opacity: Math.random() * 0.5 + 0.2,
  }));
}

export default function LandingPage() {
  const { lang, setLang } = useLanguage();
  const t = T[lang] || T.bs;

  const [mousePos, setMousePos] = useState({ x: -500, y: -500 });
  const [scrolled, setScrolled] = useState(false);
  const particles = useMemo(() => generateParticles(40), []);

  /* Mouse tracker */
  useEffect(() => {
    const onMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  /* Scroll tracker for sticky nav + section reveals */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* IntersectionObserver for scroll-reveal */
  useEffect(() => {
    const els = document.querySelectorAll(".landing-section-reveal");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.08 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div style={S.page}>
      {/* ── Ambient Backgrounds ── */}
      <div style={S.heroBgContainer}>
        <img src="/landing/hero-bg.png" alt="Background" style={S.heroBgImg} />
      </div>
      <div style={S.gridBg} />

      {/* ── Floating particles ── */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="landing-particle"
          style={{
            left: p.x + "%",
            bottom: "-10%",
            width: p.size,
            height: p.size,
            background: `rgba(${p.hue}, ${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px rgba(${p.hue}, 0.4)`,
            animationDelay: p.delay + "s",
            animationDuration: p.duration + "s",
          }}
        />
      ))}

      {/* ══════════════ NAVBAR ══════════════ */}
      <nav className="landing-nav" style={{ ...S.nav, background: scrolled ? "rgba(6,17,27,0.85)" : "transparent", boxShadow: scrolled ? "0 4px 30px rgba(0,0,0,0.5)" : "none", backdropFilter: scrolled ? "blur(12px)" : "none" }}>
        <div style={S.navBrand}>
          <Image src="/logo-icon.png" width={36} height={36} alt="eZNR" style={{ borderRadius: 8 }} />
          <span style={S.brandTitle}>eZNR</span>
        </div>

        {/* Desktop links */}
        <div className="landing-nav-links-desktop" style={S.navLinks}>
          <a href="#aplikacija" style={S.navLink}>{t.navApp}</a>
          <a href="#moduli" style={S.navLink}>{t.navModules}</a>
          <a href="#kontakt" style={S.navLink}>{t.navContact}</a>

          {/* Flag toggle */}
          <div style={S.langPill}>
            <button onClick={() => setLang("bs")} style={{ ...S.langFlag, ...(lang === "bs" ? S.langFlagActive : {}) }} aria-label="Bosanski">🇧🇦</button>
            <button onClick={() => setLang("en")} style={{ ...S.langFlag, ...(lang === "en" ? S.langFlagActive : {}) }} aria-label="English">🇬🇧</button>
          </div>

          <Link href="/login" style={S.loginBtn}>{t.login}</Link>
        </div>

        {/* Mobile hamburger */}
        <div className="landing-nav-mobile" style={{ display: "none", alignItems: "center", gap: 12 }}>
          <div style={S.langPill}>
            <button onClick={() => setLang("bs")} style={{ ...S.langFlag, ...(lang === "bs" ? S.langFlagActive : {}) }}>🇧🇦</button>
            <button onClick={() => setLang("en")} style={{ ...S.langFlag, ...(lang === "en" ? S.langFlagActive : {}) }}>🇬🇧</button>
          </div>
          <button onClick={() => setMobileMenu(!mobileMenu)} style={S.hamburger} aria-label="Menu">
            <span style={{ ...S.hamLine, transform: mobileMenu ? "rotate(45deg) translate(5px,5px)" : "none" }} />
            <span style={{ ...S.hamLine, opacity: mobileMenu ? 0 : 1 }} />
            <span style={{ ...S.hamLine, transform: mobileMenu ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
          </button>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {mobileMenu && (
        <div style={S.mobileDropdown}>
          <a href="#aplikacija" onClick={() => setMobileMenu(false)} style={S.mobileLink}>{t.navApp}</a>
          <a href="#moduli" onClick={() => setMobileMenu(false)} style={S.mobileLink}>{t.navModules}</a>
          <a href="#kontakt" onClick={() => setMobileMenu(false)} style={S.mobileLink}>{t.navContact}</a>
          <Link href="/login" onClick={() => setMobileMenu(false)} style={{ ...S.mobileLink, color: "#00BFA6" }}>{t.login}</Link>
        </div>
      )}

      {/* ══════════════ HERO ══════════════ */}
      <header style={S.hero}>
        <div style={{ ...S.cursorGlow, left: mousePos.x, top: mousePos.y }} />

        <div className="landing-section-reveal" style={S.heroContent}>
          <div style={{ marginBottom: 24 }}>
            <Image src="/landing/eznr_logo_main.png" width={180} height={60} alt="eZNR" style={{ objectFit: 'contain' }} />
          </div>
          <h1 className="landing-hero-title" style={S.heroTitle}>{t.heroTitle}</h1>
          <p className="landing-hero-subtitle" style={S.heroSubtitle}>{t.heroSub}</p>

          <div className="landing-cta-group" style={S.heroCtaGroup}>
            <a href="#kontakt" className="btn-glow" style={S.btnPrimary}>{t.ctaPrimary}</a>
            <a href="#moduli" style={S.btnSecondary}>{t.ctaSecondary}</a>
          </div>
        </div>

        {/* Floating Dashboard Image */}
        <div className="landing-section-reveal" style={S.heroImageWrapper}>
            <div style={S.heroImageGlow} />
            <img src="/landing/heropage.png" alt="eZNR Dashboard" style={S.heroImage} />
        </div>
      </header>

      {/* ══════════════ VIDEO SHOWCASE ══════════════ */}
      <section id="aplikacija" style={{...S.section, background: "rgba(0,0,0,0.3)"}}>
        <div className="landing-section-reveal" style={S.container}>
          <div style={S.sectionHeader}>
            <h2 className="landing-section-title" style={S.sectionTitle}>{t.videoTitle}</h2>
            <p style={S.sectionSub}>{t.videoSub}</p>
          </div>
          <div className="glass-window" style={S.videoContainer}>
            <div style={S.windowBar}>
                <div style={{...S.windowDot, background: "#ff5f56"}}/>
                <div style={{...S.windowDot, background: "#ffbd2e"}}/>
                <div style={{...S.windowDot, background: "#27c93f"}}/>
            </div>
            <img src="/landing/demo-video.webp" alt="eZNR Demo Video" style={S.videoImg} />
          </div>
        </div>
      </section>

      {/* ══════════════ BENTO GRID MODULES ══════════════ */}
      <section id="moduli" style={S.section}>
        <div className="landing-section-reveal" style={S.container}>
          <div style={S.sectionHeader}>
            <h2 className="landing-section-title" style={S.sectionTitle}>{t.modulesTitle}</h2>
          </div>
          
          <div className="bento-grid" style={S.bentoGrid}>
            {/* Popis opreme - Large */}
            <div className="bento-card bento-lg glass-card">
              <div style={S.bentoText}>
                <h3 style={S.bentoTitle}>{t.m1T}</h3>
                <p style={S.bentoDesc}>{t.m1D}</p>
              </div>
              <div style={S.bentoImgWrap}>
                <img src="/landing/hpop.png" alt="Oprema" style={S.bentoImg} />
              </div>
            </div>

            {/* Izrada procjene rizika - Large */}
            <div className="bento-card bento-lg glass-card">
              <div style={S.bentoText}>
                <h3 style={S.bentoTitle}>{t.m4T}</h3>
                <p style={S.bentoDesc}>{t.m4D}</p>
              </div>
              <div style={S.bentoImgWrap}>
                <img src="/landing/hproc.png" alt="Procjena Rizika" style={S.bentoImg} />
              </div>
            </div>

            {/* Zia AI - Small */}
            <div className="bento-card bento-sm glass-card">
              <div style={S.bentoText}>
                <h3 style={S.bentoTitle}>{t.m2T}</h3>
                <p style={S.bentoDesc}>{t.m2D}</p>
              </div>
              <div style={{...S.bentoImgWrap, alignItems: 'center', padding: '0 20px 20px'}}>
                <img src="/landing/hzia.png" alt="Zia AI" style={{...S.bentoImg, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)'}} />
              </div>
            </div>

            {/* Certificates - Small */}
            <div className="bento-card bento-sm glass-card">
              <div style={S.bentoText}>
                <h3 style={S.bentoTitle}>{t.m3T}</h3>
                <p style={S.bentoDesc}>{t.m3D}</p>
              </div>
              <div style={{...S.bentoImgWrap, alignItems: 'center', padding: '0 20px 20px'}}>
                <img src="/landing/hcert.png" alt="Certificates" style={{...S.bentoImg, borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)'}} />
              </div>
            </div>

            {/* Mobilna aplikacija - Large with two images */}
            <div className="bento-card bento-lg glass-card" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <div style={{...S.bentoText, flex: '1 1 50%'}}>
                <h3 style={S.bentoTitle}>{t.m5T}</h3>
                <p style={S.bentoDesc}>{t.m5D}</p>
              </div>
              <div style={{...S.bentoImgWrap, flex: '1 1 50%', display: 'flex', flexDirection: 'row', gap: '20px', padding: '36px 36px 0 0', justifyContent: 'center', alignItems: 'flex-end', overflow: 'hidden'}}>
                <img src="/landing/hmob.jpg" alt="Mobilna aplikacija" style={{ width: '45%', height: 'auto', objectFit: 'contain', borderTopLeftRadius: 16, borderTopRightRadius: 16, border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                <img src="/landing/hmob1.jpg" alt="Mobilna aplikacija" style={{ width: '45%', height: 'auto', objectFit: 'contain', borderTopLeftRadius: 16, borderTopRightRadius: 16, border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transform: 'translateY(20px)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ CONTACT ══════════════ */}
      <section id="kontakt" style={S.section}>
        <div className="landing-section-reveal landing-container-card" style={S.containerCard}>
          <div style={S.contactGlow} />
          <h2 className="landing-section-title" style={{ ...S.sectionTitle, textAlign: "center", background: "linear-gradient(135deg, #00e5c8 0%, #6366F1 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t.contactTitle}</h2>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", marginBottom: 30, maxWidth: 560, margin: "0 auto 30px" }}>{t.contactSub}</p>
          <form onSubmit={(e) => { e.preventDefault(); alert(t.fAlert); }} style={S.contactForm}>
            <div style={S.formRow}>
              <input style={S.input} type="text" placeholder={t.fName} />
              <input style={S.input} type="text" placeholder={t.fCompany} />
            </div>
            <div style={S.formRow}>
              <input style={S.input} type="email" placeholder={t.fEmail} required />
              <input style={S.input} type="tel" placeholder={t.fPhone} />
            </div>
            <button type="submit" className="btn-glow" style={{ ...S.btnPrimary, width: "100%", display: "flex", justifyContent: "center" }}>{t.fSubmit}</button>
          </form>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer style={S.footer}>
        <div className="landing-footer-container" style={S.footerContainer}>
          <div style={S.footerBrand}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Image src="/logo-icon.png" width={28} height={28} alt="eZNR" style={{ borderRadius: 6 }} />
              <span style={{ fontSize: "1.2rem", fontWeight: 800 }}>eZNR</span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.35)", marginTop: 8 }}>{t.footerDesc}</p>
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 4 }}>{t.footerDistLabel}</span>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#00BFA6" }}>{t.footerDist}</span>
          </div>
          <div>
            <div style={{ display: "flex", gap: 16, fontSize: "0.85rem", marginBottom: 8 }}>
              <a href={t.termsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>{t.footerTerms}</a>
              <a href={t.privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none" }}>{t.footerPrivacy}</a>
            </div>
            <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.2)" }}>© 2026 eZNR. Sva prava pridržana.</p>
          </div>
        </div>
      </footer>

      {/* Inline styles for complex animations and specific grid rules */}
      <style>{`
        .glass-card {
            background: rgba(16, 28, 40, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            overflow: hidden;
            transition: all 0.3s ease;
        }
        .glass-card:hover {
            border-color: rgba(0, 191, 166, 0.3);
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 40px rgba(0, 191, 166, 0.1);
        }
        .glass-window {
            background: rgba(16, 28, 40, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 100px rgba(0,191,166,0.15);
        }
        .btn-glow {
            position: relative;
        }
        .btn-glow::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: inherit;
            box-shadow: 0 0 20px rgba(0, 191, 166, 0.4);
            opacity: 0;
            transition: opacity 0.3s;
        }
        .btn-glow:hover::after {
            opacity: 1;
        }
        .bento-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
            grid-auto-rows: minmax(380px, auto);
        }
        .bento-lg {
            grid-column: span 2;
            display: flex;
            flex-direction: row;
        }
        .bento-sm {
            grid-column: span 1;
            display: flex;
            flex-direction: column;
        }
        
        @keyframes dashboard-float {
            0% { transform: perspective(1200px) rotateX(12deg) translateY(0px); }
            50% { transform: perspective(1200px) rotateX(12deg) translateY(-15px); }
            100% { transform: perspective(1200px) rotateX(12deg) translateY(0px); }
        }

        .dashboard-img-anim {
            animation: dashboard-float 8s ease-in-out infinite;
        }

        @media (max-width: 900px) {
            .bento-grid { grid-template-columns: 1fr; }
            .bento-lg { grid-column: span 1; flex-direction: column; }
            .bento-sm { grid-column: span 1; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* STYLES                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#03080c", // Deep dark base
    color: "#ffffff",
    fontFamily: "var(--font-heading)",
    overflowX: "hidden",
    position: "relative",
  },
  heroBgContainer: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "140vh",
    zIndex: 0,
    pointerEvents: "none",
    overflow: "hidden"
  },
  heroBgImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "top center",
    opacity: 0.8,
    mixBlendMode: "screen",
  },
  gridBg: {
    position: "fixed",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
    backgroundSize: "60px 60px",
    animation: "landing-grid-fade 8s ease-in-out infinite",
    pointerEvents: "none",
    zIndex: 0,
  },

  /* ── Nav ── */
  nav: {
    position: "fixed",
    top: 0, left: 0, right: 0,
    height: 72,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 40px",
    zIndex: 100,
    transition: "all 0.3s ease",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  navBrand: { display: "flex", alignItems: "center", gap: 12 },
  brandTitle: { fontSize: "1.4rem", fontWeight: 900, color: "white", letterSpacing: "-0.02em" },
  navLinks: { display: "flex", alignItems: "center", gap: 32 },
  navLink: { color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600, transition: "color 0.2s" },
  loginBtn: {
    padding: "10px 28px",
    background: "rgba(0,191,166,0.15)",
    border: "1px solid rgba(0,191,166,0.3)",
    borderRadius: 12,
    color: "#00BFA6",
    fontSize: "0.9rem",
    fontWeight: 700,
    textDecoration: "none",
    transition: "all 0.2s",
  },
  langPill: {
    display: "flex",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    padding: 4,
    gap: 2,
    border: "1px solid rgba(255,255,255,0.1)",
  },
  langFlag: {
    background: "transparent",
    border: "none",
    fontSize: "1.1rem",
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
    transition: "all 0.2s",
    lineHeight: 1,
  },
  langFlagActive: {
    background: "rgba(0,191,166,0.25)",
    boxShadow: "0 0 10px rgba(0,191,166,0.2)",
  },
  hamburger: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 5,
    padding: 6,
  },
  hamLine: {
    width: 24,
    height: 2,
    background: "white",
    borderRadius: 2,
    transition: "all 0.3s ease",
  },
  mobileDropdown: {
    position: "fixed",
    top: 72,
    left: 0, right: 0,
    background: "rgba(3,8,12,0.98)",
    backdropFilter: "blur(20px)",
    display: "flex",
    flexDirection: "column",
    padding: "24px",
    gap: 20,
    zIndex: 99,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    animation: "landing-fade-up 0.3s ease",
  },
  mobileLink: {
    color: "rgba(255,255,255,0.8)",
    textDecoration: "none",
    fontSize: "1.1rem",
    fontWeight: 600,
    padding: "8px 0",
  },

  /* ── Hero ── */
  hero: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    position: "relative",
    padding: "160px 20px 40px",
    textAlign: "center",
    zIndex: 2,
  },
  heroContent: { position: "relative", zIndex: 3, maxWidth: 900, marginBottom: 60 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(0,191,166,0.1)",
    color: "#00e5c8",
    border: "1px solid rgba(0,191,166,0.3)",
    padding: "6px 16px",
    borderRadius: 50,
    fontSize: "0.95rem",
    fontWeight: 700,
    marginBottom: 24,
    letterSpacing: "0.5px",
    boxShadow: "0 4px 20px rgba(0,191,166,0.15)"
  },
  heroTitle: {
    fontSize: "4.5rem",
    lineHeight: 1.1,
    fontWeight: 900,
    marginBottom: 24,
    color: "white",
    textShadow: "0 10px 30px rgba(0,0,0,0.5)",
    letterSpacing: "-0.02em",
  },
  heroSubtitle: {
    fontSize: "1.25rem",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.7)",
    maxWidth: 700,
    margin: "0 auto 40px",
  },
  heroCtaGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  btnPrimary: {
    padding: "16px 36px",
    background: "linear-gradient(135deg, #00e5c8 0%, #00a892 100%)",
    color: "#000",
    borderRadius: 14,
    fontSize: "1rem",
    fontWeight: 800,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(0,191,166,0.3)",
    transition: "all 0.2s",
  },
  btnSecondary: {
    padding: "16px 36px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "white",
    borderRadius: 14,
    fontSize: "1rem",
    fontWeight: 700,
    textDecoration: "none",
    transition: "all 0.2s",
    backdropFilter: "blur(10px)"
  },
  heroImageWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: 1200,
    marginTop: 20,
    zIndex: 2,
    perspective: "1200px"
  },
  heroImageGlow: {
    position: "absolute",
    top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    width: "80%", height: "80%",
    background: "radial-gradient(circle, rgba(0,191,166,0.2) 0%, transparent 70%)",
    filter: "blur(60px)",
    zIndex: -1
  },
  heroImage: {
    width: "100%",
    height: "auto",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
    transform: "rotateX(12deg)",
    transformOrigin: "top center",
    className: "dashboard-img-anim"
  },
  cursorGlow: {
    position: "fixed",
    width: 600, height: 600,
    background: "radial-gradient(circle, rgba(0,191,166,0.05) 0%, rgba(0,0,0,0) 60%)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: 1,
    transition: "left 0.1s linear, top 0.1s linear",
  },

  /* ── Sections ── */
  section: { padding: "120px 20px", position: "relative", zIndex: 2 },
  container: { maxWidth: 1200, margin: "0 auto" },
  sectionHeader: {
    textAlign: "center",
    marginBottom: 60,
  },
  sectionTitle: {
    fontSize: "2.8rem",
    fontWeight: 800,
    marginBottom: 16,
    color: "white",
    letterSpacing: "-0.01em"
  },
  sectionSub: {
    fontSize: "1.1rem",
    color: "rgba(255,255,255,0.6)",
    maxWidth: 600,
    margin: "0 auto",
  },

  /* ── Video Container ── */
  videoContainer: {
    position: "relative",
    width: "100%",
    padding: "40px 10px 10px 10px", // space for window bar
  },
  windowBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 40,
    background: "rgba(0,0,0,0.2)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    gap: 8
  },
  windowDot: {
    width: 12, height: 12,
    borderRadius: "50%",
  },
  videoImg: {
    width: "100%",
    height: "auto",
    borderRadius: 8,
    display: "block"
  },

  /* ── Bento Grid Elements ── */
  bentoText: {
    padding: 36,
    flex: "1 1 auto",
  },
  bentoTitle: {
    fontSize: "1.6rem",
    fontWeight: 800,
    marginBottom: 12,
    color: "white"
  },
  bentoDesc: {
    fontSize: "1.05rem",
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.6)"
  },
  bentoImgWrap: {
    flex: "1 1 auto",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
    paddingLeft: 36,
    overflow: "hidden"
  },
  bentoImg: {
    width: "100%",
    height: "auto",
    objectFit: "cover",
    objectPosition: "left top",
    borderTopLeftRadius: 16,
    border: "1px solid rgba(255,255,255,0.1)",
    borderBottom: "none",
    borderRight: "none",
    boxShadow: "-10px -10px 30px rgba(0,0,0,0.3)"
  },

  /* ── Contact ── */
  containerCard: {
    maxWidth: 800,
    margin: "0 auto",
    background: "rgba(16, 28, 40, 0.7)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 32,
    padding: 64,
    boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
    position: "relative",
    overflow: "hidden"
  },
  contactGlow: {
    position: "absolute",
    top: 0, right: 0,
    width: 300, height: 300,
    background: "radial-gradient(circle, rgba(0,191,166,0.1) 0%, transparent 70%)",
    pointerEvents: "none"
  },
  contactForm: { display: "flex", flexDirection: "column", gap: 16, position: "relative", zIndex: 2 },
  formRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  input: {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "16px 20px",
    borderRadius: 14,
    color: "white",
    fontSize: "1rem",
    fontFamily: "var(--font-heading)",
    outline: "none",
    transition: "border-color 0.2s, background 0.2s",
  },

  /* ── Footer ── */
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.05)",
    padding: "60px 40px",
    background: "#020508",
    position: "relative",
    zIndex: 2,
  },
  footerContainer: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 40,
  },
  footerBrand: { maxWidth: 300 },
};
