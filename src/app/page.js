"use client";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
    badge: "Nova Era Sigurnosti",
    heroTitle: "Sigurnost vaših radnika sada je na jedan klik od vas",
    heroSub: "eZNR platforma jedino je rješenje koje vam je potrebno za potpunu tehničku, pravnu i operativnu zaštitu na radu.",
    ctaPrimary: "Zatražite Kontakt",
    ctaSecondary: "Istražite mogućnosti",
    videoTitle: "Pogledajte eZNR u akciji",
    videoSoon: "Video prezentacija uskoro",
    appTitle: "Vaša nova komandna ploča",
    app1T: "Sve je međusobno povezano",
    app1D: "Svaki dokument, radnik i komad opreme klikabilan je na svakom koraku. Navigacija bez zaustavljanja.",
    app2T: "Automatska upozorenja",
    app2D: "Liječnički pregledi, PP aparati, vozila ili certifikati koji ulaze u kritičnu zonu automatski trepere crvenim signalima.",
    app3T: "Trenutni PDF Export",
    app3D: "Generirajte profesionalna A4 Uvjerenja za više radnika unutar sekunde, s vašim korporativnim bojama i logotipom.",
    modulesTitle: "Sveobuhvatni Ekosustav Modula",
    m1T: "Centralni registar radnika",
    m1D: "Upravljajte tisućama radnika. Liječnička uvjerenja, klinike, noćne smjene — sve na jednom mjestu.",
    m2T: "Osobna zaštitna oprema (OZO)",
    m2D: "Precizan inventar opreme. Zadužite, pratite i zamijenite opremu pravovremeno bez duplanja troškova.",
    m3T: "Upitnici & Certifikati",
    m3D: "Drag & Drop dizajn ZOP testova. Pošaljite link radnicima na mobitel. Sustav sam ocjenjuje i bilježi rezultate.",
    m4T: "Vozni park & Zaštita od požara",
    m4D: "Praćenje tehničkih pregleda voznog parka i rokova servisiranja vatrogasnih aparata.",
    m5T: "Zia AI Asistent",
    m5D: "Pitajte AI agenta o zakonima ili radnicima. Zia čita vašu bazu i daje trenutne odgovore.",
    m6T: "Multi-Grupna arhitektura",
    m6D: "Administrirajte svaku granu holdinga jednim klikom. Segmentirano, sigurno, centralizirano.",
    contactTitle: "Spremni za podizanje standarda?",
    contactSub: "Zatražite kontakt s našim timom kako bismo demonstrirali aplikaciju prilagođenu vašim potrebama.",
    fName: "Ime i Prezime",
    fCompany: "Naziv Tvrtke",
    fEmail: "Poslovni e-mail",
    fPhone: "Telefon za kontakt",
    fSubmit: "Zatraži Kontakt i Pristup",
    fAlert: "Vaš upit je poslan! Uskoro ćemo Vas kontaktirati.",
    footerDesc: "Enterprise Occupational Safety & Health ERP System.",
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
    badge: "A New Era of Safety",
    heroTitle: "Your workers' safety is now just one click away",
    heroSub: "eZNR is the only platform you need for complete technical, legal and operational occupational safety management.",
    ctaPrimary: "Request a Call",
    ctaSecondary: "Explore Features",
    videoTitle: "See eZNR in Action",
    videoSoon: "Video presentation coming soon",
    appTitle: "Your New Command Center",
    app1T: "Everything is interconnected",
    app1D: "Every document, worker and piece of equipment is clickable at every step. Navigation without dead ends.",
    app2T: "Automatic Alerts",
    app2D: "Medical exams, fire extinguishers, vehicles or certificates entering the critical zone automatically flash red warnings.",
    app3T: "Instant PDF Export",
    app3D: "Generate professional A4 certificates for multiple workers in seconds, branded with your corporate colors and logo.",
    modulesTitle: "Comprehensive Module Ecosystem",
    m1T: "Central Worker Registry",
    m1D: "Manage thousands of workers. Medical certificates, clinics, night shifts — all in one place.",
    m2T: "Personal Protective Equipment (PPE)",
    m2D: "Precise equipment inventory. Assign, track and replace equipment on time without doubling costs.",
    m3T: "Questionnaires & Certificates",
    m3D: "Drag & Drop fire safety test designer. Send links to workers' phones. The system auto-grades and records results.",
    m4T: "Fleet & Fire Protection",
    m4D: "Track fleet technical inspections and fire extinguisher servicing deadlines automatically.",
    m5T: "Zia AI Assistant",
    m5D: "Ask the AI agent about regulations or workers. Zia reads your database and provides instant answers.",
    m6T: "Multi-Group Architecture",
    m6D: "Administer every branch of a holding with one click. Segmented, secure, centralized.",
    contactTitle: "Ready to raise the standard?",
    contactSub: "Request a call with our team so we can demonstrate the app tailored to your specific needs.",
    fName: "Full Name",
    fCompany: "Company Name",
    fEmail: "Business Email",
    fPhone: "Phone Number",
    fSubmit: "Request Contact & Access",
    fAlert: "Your inquiry has been sent! We will contact you shortly.",
    footerDesc: "Enterprise Occupational Safety & Health ERP System.",
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
  const particles = useMemo(() => generateParticles(50), []);
  const sectionRefs = useRef([]);

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
      {/* ── Ambient grid lines ── */}
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
      <nav className="landing-nav" style={{ ...S.nav, background: scrolled ? "rgba(8,20,31,0.92)" : "rgba(8,20,31,0.4)", boxShadow: scrolled ? "0 4px 30px rgba(0,0,0,0.3)" : "none" }}>
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
        {/* Ambient glows */}
        <div style={S.heroGlow} />
        <div style={S.heroGlow2} />
        {/* Cursor glow */}
        <div style={{ ...S.cursorGlow, left: mousePos.x, top: mousePos.y }} />

        {/* Orbital rings */}
        <div style={S.orbitContainer}>
          <div style={{ ...S.orbitRing, width: 280, height: 280, animation: "landing-ring-pulse 4s ease-in-out infinite" }} />
          <div style={{ ...S.orbitRing, width: 380, height: 380, animation: "landing-ring-pulse 5s ease-in-out infinite 1s" }} />
          {/* Orbiting dots */}
          <div style={{ ...S.orbitDot, animation: "landing-orbit 12s linear infinite" }} />
          <div style={{ ...S.orbitDotSmall, animation: "landing-orbit-reverse 18s linear infinite" }} />
        </div>

        <div style={S.heroContent}>
          {/* Logo */}
          <div style={S.heroLogoWrap}>
            <div style={S.heroLogoPulse} />
            <Image src="/logo-transparent.png" width={340} height={160} alt="eZNR Digitalna Platforma" style={{ position: "relative", zIndex: 2, objectFit: "contain", maxWidth: "90vw", height: "auto" }} priority />
          </div>

          <div style={S.badge}>{t.badge}</div>
          <h1 className="landing-hero-title" style={S.heroTitle}>{t.heroTitle}</h1>
          <p className="landing-hero-subtitle" style={S.heroSubtitle}>{t.heroSub}</p>

          <div className="landing-cta-group" style={S.heroCtaGroup}>
            <a href="#kontakt" style={S.btnPrimary}>{t.ctaPrimary}</a>
            <a href="#moduli" style={S.btnSecondary}>{t.ctaSecondary}</a>
          </div>
        </div>
      </header>

      {/* ══════════════ VIDEO PLACEHOLDER ══════════════ */}
      <section style={{ ...S.section, paddingTop: 60, paddingBottom: 60 }}>
        <div className="landing-section-reveal" style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="landing-section-title" style={{ ...S.sectionTitle, marginBottom: 30 }}>{t.videoTitle}</h2>
          <div style={S.videoPlaceholder}>
            <div style={S.videoPlayBtn}>▶</div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.9rem", marginTop: 16 }}>{t.videoSoon}</p>
          </div>
        </div>
      </section>

      {/* ══════════════ APP HIGHLIGHTS ══════════════ */}
      <section id="aplikacija" style={S.section}>
        <div className="landing-section-reveal" style={S.container}>
          <h2 className="landing-section-title" style={S.sectionTitle}>{t.appTitle}</h2>
          <div className="landing-grid-3" style={S.grid3}>
            {[
              { icon: "📊", t: t.app1T, d: t.app1D },
              { icon: "⏱️", t: t.app2T, d: t.app2D },
              { icon: "📄", t: t.app3T, d: t.app3D },
            ].map((item, i) => (
              <div key={i} className="landing-card" style={S.featureCard}>
                <div style={S.cardGlow} />
                <div style={S.icon}>{item.icon}</div>
                <h3 style={S.cardTitle}>{item.t}</h3>
                <p style={S.cardDesc}>{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ MODULES ══════════════ */}
      <section id="moduli" style={{ ...S.section, background: "rgba(0, 191, 166, 0.015)" }}>
        <div className="landing-section-reveal" style={S.container}>
          <h2 className="landing-section-title" style={S.sectionTitle}>{t.modulesTitle}</h2>
          <div className="landing-grid-2" style={S.grid2}>
            {[
              { icon: "👷", t: t.m1T, d: t.m1D },
              { icon: "🦺", t: t.m2T, d: t.m2D },
              { icon: "📝", t: t.m3T, d: t.m3D },
              { icon: "🚗", t: t.m4T, d: t.m4D },
              { icon: "🤖", t: t.m5T, d: t.m5D },
              { icon: "🏢", t: t.m6T, d: t.m6D },
            ].map((item, i) => (
              <div key={i} className="landing-card" style={{ ...S.featureCard, padding: 36 }}>
                <div style={{ fontSize: "2rem", marginBottom: 10 }}>{item.icon}</div>
                <h3 style={{ ...S.cardTitle, fontSize: "1.3rem", marginTop: 6 }}>{item.t}</h3>
                <p style={S.cardDesc}>{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ CONTACT ══════════════ */}
      <section id="kontakt" style={S.section}>
        <div className="landing-section-reveal landing-container-card" style={S.containerCard}>
          <h2 className="landing-section-title" style={S.sectionTitle}>{t.contactTitle}</h2>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", marginBottom: 30, maxWidth: 560, margin: "0 auto 30px" }}>{t.contactSub}</p>
          <form onSubmit={(e) => { e.preventDefault(); alert(t.fAlert); }} style={S.contactForm}>
            <div style={S.formRow}>
              <input style={S.input} type="text" placeholder={t.fName} required />
              <input style={S.input} type="text" placeholder={t.fCompany} required />
            </div>
            <div style={S.formRow}>
              <input style={S.input} type="email" placeholder={t.fEmail} required />
              <input style={S.input} type="tel" placeholder={t.fPhone} />
            </div>
            <button type="submit" style={{ ...S.btnPrimary, width: "100%", display: "flex", justifyContent: "center" }}>{t.fSubmit}</button>
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
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* STYLES                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */
const S = {
  page: {
    minHeight: "100vh",
    background: "#06111B",
    color: "#ffffff",
    fontFamily: "var(--font-heading)",
    overflowX: "hidden",
    position: "relative",
  },
  gridBg: {
    position: "fixed",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(0,191,166,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,191,166,0.04) 1px, transparent 1px)",
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
    padding: "0 36px",
    backdropFilter: "blur(24px)",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    zIndex: 100,
    transition: "background 0.3s ease, box-shadow 0.3s ease",
  },
  navBrand: { display: "flex", alignItems: "center", gap: 10 },
  brandTitle: { fontSize: "1.35rem", fontWeight: 900, color: "white", letterSpacing: "-0.02em" },
  navLinks: { display: "flex", alignItems: "center", gap: 28 },
  navLink: { color: "rgba(255,255,255,0.6)", textDecoration: "none", fontSize: "0.88rem", fontWeight: 600, transition: "color 0.2s" },
  loginBtn: {
    padding: "9px 26px",
    background: "rgba(0,191,166,0.1)",
    border: "1px solid rgba(0,191,166,0.25)",
    borderRadius: 12,
    color: "#00BFA6",
    fontSize: "0.88rem",
    fontWeight: 700,
    textDecoration: "none",
    transition: "all 0.2s",
  },
  langPill: {
    display: "flex",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 3,
    gap: 2,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  langFlag: {
    background: "transparent",
    border: "none",
    fontSize: "1.15rem",
    padding: "4px 8px",
    borderRadius: 8,
    cursor: "pointer",
    transition: "all 0.2s",
    lineHeight: 1,
  },
  langFlagActive: {
    background: "rgba(0,191,166,0.2)",
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
    background: "rgba(255,255,255,0.7)",
    borderRadius: 2,
    transition: "all 0.3s ease",
  },
  mobileDropdown: {
    position: "fixed",
    top: 72,
    left: 0, right: 0,
    background: "rgba(6,17,27,0.97)",
    backdropFilter: "blur(20px)",
    display: "flex",
    flexDirection: "column",
    padding: "20px 24px",
    gap: 16,
    zIndex: 99,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    animation: "landing-fade-up 0.25s ease",
  },
  mobileLink: {
    color: "rgba(255,255,255,0.7)",
    textDecoration: "none",
    fontSize: "1rem",
    fontWeight: 600,
    padding: "8px 0",
  },

  /* ── Hero ── */
  hero: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    padding: "100px 20px 40px",
    textAlign: "center",
  },
  heroContent: { position: "relative", zIndex: 2, maxWidth: 800 },
  heroLogoWrap: {
    position: "relative",
    display: "inline-block",
    marginBottom: 32,
  },
  heroLogoPulse: {
    position: "absolute",
    top: "50%", left: "50%",
    width: "120%", height: "200%",
    transform: "translate(-50%, -50%)",
    background: "radial-gradient(ellipse, rgba(0,191,166,0.18) 0%, transparent 65%)",
    animation: "landing-pulse-glow 4s ease-in-out infinite",
    zIndex: 1,
    pointerEvents: "none",
  },
  badge: {
    display: "inline-block",
    background: "rgba(0,191,166,0.08)",
    color: "#00BFA6",
    border: "1px solid rgba(0,191,166,0.2)",
    padding: "5px 16px",
    borderRadius: 50,
    fontSize: "0.82rem",
    fontWeight: 700,
    marginBottom: 20,
    letterSpacing: "0.5px",
  },
  heroTitle: {
    fontSize: "4rem",
    lineHeight: 1.08,
    fontWeight: 900,
    marginBottom: 20,
    background: "linear-gradient(175deg, #ffffff 30%, rgba(0,191,166,0.7) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-0.02em",
  },
  heroSubtitle: {
    fontSize: "1.15rem",
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.5)",
    maxWidth: 580,
    margin: "0 auto 36px",
  },
  heroCtaGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  btnPrimary: {
    padding: "15px 34px",
    background: "linear-gradient(135deg, #00BFA6 0%, #00897B 100%)",
    color: "#fff",
    borderRadius: 14,
    fontSize: "0.95rem",
    fontWeight: 800,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 8px 32px rgba(0,191,166,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  btnSecondary: {
    padding: "15px 34px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "white",
    borderRadius: 14,
    fontSize: "0.95rem",
    fontWeight: 700,
    textDecoration: "none",
    transition: "all 0.2s",
  },
  heroGlow: {
    position: "absolute",
    top: "25%", left: "50%",
    transform: "translate(-50%, -50%)",
    width: "70vw", height: "50vh",
    background: "radial-gradient(ellipse, rgba(0,191,166,0.12) 0%, transparent 55%)",
    zIndex: 1,
    pointerEvents: "none",
  },
  heroGlow2: {
    position: "absolute",
    top: "60%", left: "30%",
    transform: "translate(-50%, -50%)",
    width: "40vw", height: "40vh",
    background: "radial-gradient(ellipse, rgba(120,100,255,0.06) 0%, transparent 60%)",
    zIndex: 1,
    pointerEvents: "none",
  },
  cursorGlow: {
    position: "fixed",
    width: 500, height: 500,
    background: "radial-gradient(circle, rgba(0,191,166,0.07) 0%, rgba(120,100,255,0.03) 40%, transparent 65%)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: 1,
    transition: "left 0.05s linear, top 0.05s linear",
  },
  orbitContainer: {
    position: "absolute",
    top: "42%", left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 1,
    pointerEvents: "none",
  },
  orbitRing: {
    position: "absolute",
    top: "50%", left: "50%",
    border: "1px solid rgba(0,191,166,0.1)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
  },
  orbitDot: {
    position: "absolute",
    top: "50%", left: "50%",
    width: 6, height: 6,
    background: "#00BFA6",
    borderRadius: "50%",
    boxShadow: "0 0 12px rgba(0,191,166,0.6)",
    transformOrigin: "0 0",
  },
  orbitDotSmall: {
    position: "absolute",
    top: "50%", left: "50%",
    width: 4, height: 4,
    background: "rgba(120,100,255,0.8)",
    borderRadius: "50%",
    boxShadow: "0 0 10px rgba(120,100,255,0.5)",
    transformOrigin: "0 0",
  },

  /* ── Video ── */
  videoPlaceholder: {
    width: "100%",
    aspectRatio: "16/9",
    background: "rgba(255,255,255,0.02)",
    border: "1px dashed rgba(255,255,255,0.1)",
    borderRadius: 20,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "border-color 0.3s",
  },
  videoPlayBtn: {
    width: 72, height: 72,
    borderRadius: "50%",
    background: "rgba(0,191,166,0.1)",
    border: "2px solid rgba(0,191,166,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.6rem",
    color: "#00BFA6",
  },

  /* ── Sections ── */
  section: { padding: "100px 20px", position: "relative", zIndex: 2 },
  container: { maxWidth: 1200, margin: "0 auto" },
  containerCard: {
    maxWidth: 780,
    margin: "0 auto",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 28,
    padding: 56,
    boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
  },
  sectionTitle: {
    fontSize: "2.4rem",
    fontWeight: 800,
    textAlign: "center",
    marginBottom: 56,
    background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.7) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 24 },
  featureCard: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 28,
    position: "relative",
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: -40, right: -40,
    width: 130, height: 130,
    background: "radial-gradient(circle, rgba(0,191,166,0.08) 0%, transparent 70%)",
  },
  icon: {
    fontSize: "2.2rem",
    marginBottom: 16,
    height: 54, width: 54,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 14,
  },
  cardTitle: { fontSize: "1.15rem", fontWeight: 700, marginBottom: 10 },
  cardDesc: { fontSize: "0.9rem", lineHeight: 1.65, color: "rgba(255,255,255,0.45)" },

  /* ── Form ── */
  contactForm: { display: "flex", flexDirection: "column", gap: 14 },
  formRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  input: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "15px 18px",
    borderRadius: 12,
    color: "white",
    fontSize: "0.92rem",
    fontFamily: "var(--font-heading)",
    outline: "none",
    transition: "border-color 0.2s",
  },

  /* ── Footer ── */
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.04)",
    padding: "50px 36px",
    background: "rgba(0,0,0,0.25)",
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
    gap: 36,
  },
  footerBrand: { maxWidth: 280 },
};
