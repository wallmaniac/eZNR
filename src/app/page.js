"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const { lang, toggleLang } = useLanguage();
  const router = useRouter();

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.navBrand}>
          <div style={styles.logoContainer}>
            <Image src="/favicon.png" width={32} height={32} alt="eZNR Logo" />
            <span style={styles.brandTitle}>eZNR</span>
          </div>
          <span style={styles.distributorBadge}>by zastitanaradu.ba</span>
        </div>
        <div style={styles.navLinks}>
          <a href="#aplikacija" style={styles.navLink}>Moć Aplikacije</a>
          <a href="#moduli" style={styles.navLink}>Moduli Sustava</a>
          <button style={styles.langBtn} onClick={toggleLang}>
            {lang === "bs" ? "BS" : "EN"}
          </button>
          <Link href="/login" style={styles.loginBtn}>Prijava</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={styles.hero}>
        <div style={styles.heroGlow} />
        <div
          style={{
            ...styles.cursorGlow,
            left: mousePos.x,
            top: mousePos.y,
          }}
        />
        <div style={styles.heroContent}>
          <div style={styles.badge}>Nova Era Sigurnosti</div>
          <h1 style={styles.heroTitle}>
            Sigurnost vaših radnika sada je na klik od vas
          </h1>
          <p style={styles.heroSubtitle}>
            eZNR platforma jedino je rješenje koje vam je potrebno za potpunu tehničku, pravnu i operativnu zaštitu na radu.
          </p>
          <div style={styles.heroCtaGroup}>
            <a href="#kontakt" style={styles.btnPrimary}>Zatražite Orijentacijski Poziv</a>
            <a href="#moduli" style={styles.btnSecondary}>Istražite mogućnosti</a>
          </div>
        </div>
      </header>

      {/* App highlight section */}
      <section id="aplikacija" style={styles.section}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Vaša nova komandna ploča</h2>
          <div style={styles.grid3}>
            <div style={styles.featureCard}>
              <div style={styles.cardGlow} />
              <div style={styles.icon}>📊</div>
              <h3 style={styles.cardTitle}>Sve je međusobno povezano</h3>
              <p style={styles.cardDesc}>
                Aplikacija je građena s pristupom gdje je svaki dokument, radnik i komad opreme klikabilan na svakom koraku, olakšavajući navigaciju do nezamislivih brzina.
              </p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.cardGlow} />
              <div style={styles.icon}>⏱️</div>
              <h3 style={styles.cardTitle}>Automatska upozorenja</h3>
              <p style={styles.cardDesc}>
                Kada liječnički pregledi, PP aparati, vozila ili certifikati zaštite od požara uđu u kritičnih mjesec dana pred istek, sustav ih automatski označava crvenim signalima i sprečava eventualne inspekcijske kazne.
              </p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.cardGlow} />
              <div style={styles.icon}>📄</div>
              <h3 style={styles.cardTitle}>Trenutni PDF Export</h3>
              <p style={styles.cardDesc}>
                Generirajte profesionalna ispisna <i>A4</i> Uvjerenja za više radnika unutar sekunde. Kroz inovativni *engine*, aplikacija pretače bazu podataka u papir sa vašim korporativnim bojama.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="moduli" style={{ ...styles.section, background: "rgba(0, 191, 166, 0.02)" }}>
        <div style={styles.container}>
          <h2 style={styles.sectionTitle}>Sveobuhvatni Ekosustav Modula</h2>
          <div style={styles.grid2}>
            {/* Workers */}
            <div style={{ ...styles.featureCard, padding: 40 }}>
               <div style={styles.iconAlt}>👷</div>
              <h3 style={{ ...styles.cardTitle, fontSize: "1.4rem", marginTop: 10 }}>Centralni registar radnika i Zdravlje</h3>
              <p style={styles.cardDesc}>
                Upravljajte s tisućama radnika bez problema. Unutar kartoteke radnika vodi se detaljna povijest liječničkih zdravstvenih uvjerenja i preporuka s klinikama obitelji kao i praćenje eventualnih noćnih smjena.
              </p>
            </div>
            {/* OZO */}
            <div style={{ ...styles.featureCard, padding: 40 }}>
              <div style={styles.iconAlt}>🦺</div>
              <h3 style={{ ...styles.cardTitle, fontSize: "1.4rem", marginTop: 10 }}>Osobna zaštitna oprema (OZO)</h3>
              <p style={styles.cardDesc}>
                Precizan inventar. Svim radnicima i u jednoj sekundi zadužite opremu na digitalnoj razini. Aplikacija se brine da se oprema mijenja na vrijeme i da nema duplanja troškova poslovanja.
              </p>
            </div>
            {/* Questionnaires */}
            <div style={{ ...styles.featureCard, padding: 40 }}>
              <div style={styles.iconAlt}>📝</div>
              <h3 style={{ ...styles.cardTitle, fontSize: "1.4rem", marginTop: 10 }}>Upitnici, Certifikati i Edukacija</h3>
              <p style={styles.cardDesc}>
                Nudimo <i>drag & drop</i> dizajn upitnika. Izradite ZOP testove s videozapisima i pitanjima s višestrukim izborom, prebacite link radnicima na pametni telefon i neka vas softver obavijesti o prolaznoj ocjeni radnika u centralni EK.
              </p>
            </div>
             {/* Fleet */}
             <div style={{ ...styles.featureCard, padding: 40 }}>
              <div style={styles.iconAlt}>🚗</div>
              <h3 style={{ ...styles.cardTitle, fontSize: "1.4rem", marginTop: 10 }}>Vozni park & Požar</h3>
              <p style={styles.cardDesc}>
                ZNR nije samo papir za ljude. Sustav pomno pazi tehničke registracije voznog parka, tehničke preglede strojeva i rokove aparata o zaštiti od požara (ZOP).
              </p>
            </div>
            {/* AI */}
            <div style={{ ...styles.featureCard, padding: 40 }}>
              <div style={styles.iconAlt}>🤖</div>
              <h3 style={{ ...styles.cardTitle, fontSize: "1.4rem", marginTop: 10 }}>Zia AI Asistent</h3>
              <p style={styles.cardDesc}>
                Unutar same aplikacije nalazi se prvi umjetni pravni savjetnik (Agent) iskljućivo odgojen na regionalnim zakonskim biltenima, s kojim komunicirate baš kao sa živim stručnjakom - sve integrirano s bazom podataka sustava!
              </p>
            </div>
            {/* Scaling */}
            <div style={{ ...styles.featureCard, padding: 40 }}>
              <div style={styles.iconAlt}>🏢</div>
              <h3 style={{ ...styles.cardTitle, fontSize: "1.4rem", marginTop: 10 }}>Gigantska Multigrupna arhitektura</h3>
              <p style={styles.cardDesc}>
                Aplikacija fantastično rješava korporativni problem višestrukih pravnih identiteta. Administrirajte svaku granu holdinga sa istog izbornika u sigurnom Cloud trezoru! 
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Contact Section */}
      <section id="kontakt" style={styles.section}>
        <div style={styles.containerCard}>
          <h2 style={styles.sectionTitle}>Spremni za podizanje standarda?</h2>
          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", marginBottom: 30, maxWidth: 600, margin: "0 auto 30px" }}>
            Zahtjevajte od naših agenata službeni kontakt kako bismo vam omogućili demonstraciju aplikacije prilagođenu Vašim poslovnim potrebama! Učinite prvi korak.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); alert("Vaš upit je poslan (Simulacija - Spojite sa EmailJS). Uskoro ćemo Vas kontaktirati."); }}
            style={styles.contactForm}
          >
            <div style={styles.formRow}>
              <input style={styles.input} type="text" placeholder="Ime i Prezime" required />
              <input style={styles.input} type="text" placeholder="Naziv Tvrtke" required />
            </div>
            <div style={styles.formRow}>
              <input style={styles.input} type="email" placeholder="Poslovni e-mail" required />
              <input style={styles.input} type="tel" placeholder="Telefon za kontakt" />
            </div>
            <button type="submit" style={{ ...styles.btnPrimary, width: "100%", justifyContent: "center" }}>Zatraži Kontakt i Pristup Aplikaciji</button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContainer}>
          <div style={styles.footerBrand}>
            <div style={styles.logoContainer}>
              <Image src="/favicon.png" width={24} height={24} alt="eZNR Logo" />
              <span style={styles.brandTitle}>eZNR</span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginTop: 10 }}>Enterprise Occupational Safety & Health ERP System.</p>
          </div>
          <div>
            <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 5 }}>Ekskluzivni distributer za Bosnu i Hercegovinu:</span>
            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>Zastitanaradu.ba</span>
          </div>
          <div>
            <div style={{ display: "flex", gap: 15, fontSize: "0.85rem" }}>
              <a href="#" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Uvjeti korištenja</a>
              <a href="#" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Privatnost</a>
            </div>
            <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", marginTop: 10 }}>© 2026 eZNR. Sva prava pridržana.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#08141F", // Dark enterprise baseline
    color: "#ffffff",
    fontFamily: "var(--font-heading)",
    overflowX: "hidden",
    position: "relative",
  },
  nav: {
    position: "fixed",
    top: 0, left: 0, right: 0,
    height: 80,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 40px",
    background: "rgba(8, 20, 31, 0.7)",
    backdropFilter: "blur(20px)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    zIndex: 100,
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandTitle: {
    fontSize: "1.4rem",
    fontWeight: 900,
    color: "white",
  },
  distributorBadge: {
    background: "rgba(0, 191, 166, 0.15)",
    color: "#00BFA6",
    padding: "4px 8px",
    borderRadius: 8,
    fontSize: "0.7rem",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: 30,
  },
  navLink: {
    color: "rgba(255,255,255,0.7)",
    textDecoration: "none",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  loginBtn: {
    padding: "8px 24px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    color: "white",
    fontSize: "0.9rem",
    fontWeight: 700,
    textDecoration: "none",
  },
  langBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: 600,
  },
  hero: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    padding: "120px 20px 60px",
    textAlign: "center",
  },
  heroContent: {
    position: "relative",
    zIndex: 2,
    maxWidth: 800,
  },
  badge: {
    display: "inline-block",
    background: "rgba(0, 191, 166, 0.1)",
    color: "#00BFA6",
    border: "1px solid rgba(0, 191, 166, 0.3)",
    padding: "6px 16px",
    borderRadius: 50,
    fontSize: "0.85rem",
    fontWeight: 700,
    marginBottom: 24,
    letterSpacing: "1px",
  },
  heroTitle: {
    fontSize: "4.5rem",
    lineHeight: 1.1,
    fontWeight: 900,
    marginBottom: 24,
    background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  heroSubtitle: {
    fontSize: "1.2rem",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 40,
    maxWidth: 600,
    margin: "0 auto 40px",
  },
  heroCtaGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  btnPrimary: {
    padding: "16px 36px",
    background: "#00BFA6",
    color: "#08141F",
    borderRadius: 14,
    fontSize: "1rem",
    fontWeight: 800,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    boxShadow: "0 10px 30px rgba(0, 191, 166, 0.3)",
  },
  btnSecondary: {
    padding: "16px 36px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "white",
    borderRadius: 14,
    fontSize: "1rem",
    fontWeight: 700,
    textDecoration: "none",
  },
  heroGlow: {
    position: "absolute",
    top: "30%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "80vw",
    height: "50vh",
    background: "radial-gradient(ellipse, rgba(0, 191, 166, 0.15) 0%, transparent 60%)",
    zIndex: 1,
    pointerEvents: "none",
  },
  cursorGlow: {
    position: "absolute",
    width: 600,
    height: 600,
    background: "radial-gradient(circle, rgba(0,191,166,0.06) 0%, transparent 60%)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: 1,
  },
  section: {
    padding: "120px 20px",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
  },
  containerCard: {
    maxWidth: 800,
    margin: "0 auto",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 32,
    padding: 60,
    boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
  },
  sectionTitle: {
    fontSize: "2.5rem",
    fontWeight: 800,
    textAlign: "center",
    marginBottom: 60,
    background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.8) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 30,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
    gap: 30,
  },
  featureCard: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 24,
    padding: 30,
    position: "relative",
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    background: "radial-gradient(circle, rgba(0, 191, 166, 0.1) 0%, transparent 70%)",
  },
  icon: {
    fontSize: "2.5rem",
    marginBottom: 20,
    height: 60,
    width: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 16,
  },
  iconAlt: {
    fontSize: "2rem",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: "1.2rem",
    fontWeight: 700,
    marginBottom: 12,
  },
  cardDesc: {
    fontSize: "0.95rem",
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.5)",
  },
  contactForm: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 16,
  },
  input: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "16px 20px",
    borderRadius: 12,
    color: "white",
    fontSize: "0.95rem",
    fontFamily: "var(--font-heading)",
  },
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.05)",
    padding: "60px 40px",
    background: "rgba(0,0,0,0.2)",
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
  footerBrand: {
    maxWidth: 300,
  }
};
