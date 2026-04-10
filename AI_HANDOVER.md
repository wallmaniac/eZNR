# 🚀 eZNR APP - MEGA HISTORIJA I ARHITEKTURA (ZA NOVI CHAT)

Ovaj dokument je **kompletna enciklopedija svega što smo ikada napravili na eZNR aplikaciji** u proteklih mjesec+ dana. Namijenjen je kao apsolutni repozitorij znanja za novi AI session.

---

## 🏗️ 1. OSNOVNA ARHITEKTURA I LOGIKA SPREMANJA
Aplikacija je građena u **Next.js** s čistim i custom CSS-om. Ne koristimo Tailwind, Bootstrap ili slične libraryje - sve je bazirano na `var(--boja)` CSS varijablama.
Oslanjamo se na **"Dual Storage" hibridnu bazu**:
- **`localStorage` (Primarni):** Aplikacija glatko leti i offline-first jer povlači 100% podataka u browser. 
- **`Firestore` (Cloud Sync):** Preko intervalnih sync mehanizama (`dataStore.js`), svi podaci iz localStoragea se automatski repliciraju u oblak za trajnu pohranu i dijele po `companyId`-u (Multi-tenancy sustav = svaki korisnik vidi samo svoje firme).

---

## 🎨 2. UI/UX DIZAJN PARADIGMA
Temelj cijelog UI-a je **"Premium Corporate, yet Dynamic"** filozofija:
1. **Light / Dark Mode**: Apsolutno svaki detalj aplikacije mora savršeno raditi u tamnom i svijetlom modu. Sve hardkodirane boje su zamijenjene CSS varijablama ili pametnim `rgba()` opacity filterima (poput `rgba(0,191,166,0.15)` za lagane pozadine ikona).
2. **Floating Three-Island Header:** Glavni navigacijski izbornik podijeljen je na lijevi otok (firma/back), srednji (search) i desni (user/notifikacije) za maksimalnu iskoristivost prostora.
3. **No Native Inputs:** U potpunosti je ukinuto korištenje defaultnih `<input type="time">` i `<input type="date">` gdje su uzrokovali probleme. Vrijeme je standardizirano na **Europski 24h format** s padajućim izbornicima ograničenim isključivo na `15/30/45` intervale kontrolirane kroz vlastite React UI komponente.

---

## 🛡️ 3. IMPLEMENTIRANI MODULI (POVIJEST RADA)

1. **Dashboard & AI Analitika:** Widgets sustavi (Uoči grešku s karticama), drag-and-drop sučelja, dinamički AI kalendar koji predviđa isteke opreme prema unesenim datumima.
2. **ZNR Pravila i Zakoni FBiH:** 
    - Implementirani su strogi uvjeti FBiH zakona zaštite na radu (ZNR). Npr: *Ako zaposlenik radi noćnu smjenu (22:00-06:00), aplikacija samostalno izbacuje CRVENI UPOZORAVAJUĆI BANNER u zdravstveni karton kao obvezu liječničkih pregleda po Članku 40.*
3. **Questionnaire (Upitnici) Sustav:** 
    - Full-stack graditelj anketa i formi s mogućnošću dinamičkog postavljanja ocjena i bodova. 
    - Radnici vanjski unose podatke preko tokeniziranih e-mail sesija (EmailJS) na javnoj verziji aplikacije bez logina, a podaci padaju ravno u Firestore analitiku admina.
4. **Zia - AI Asistent:** Ugrađen je chatbot koji parsira i razgovara koristeći interne tablice firme - može izravno pronaći radnike, upozorenja te kreirati zapise o dodjeli **OZO opreme** direktno iz chata koristeći lokalni prompt.
5. **Radnici, Uvjerenja, Ljekarski, Inventar (PPE / Oprema / Fleet):** Kompletan set CRUD modela sa soft-delete logikom (`kasakadno brisanje`). Svi moduli vizualno upozoravaju na "Isteklo" i "Ističe uskoro".
6. **Notifikacijski Centar:** Live zvono s drop-down izbornikom koje provjerava ljekarske, rizike u Procjeni, tehničke preglede strojeva/vozila i uvjerenja ZNR, podijeljena po ozbiljnosti (ugrent, info, critical).

---

## ⚡ 4. PRAVILA ZA TEBE (OBAVEZNE UPUTE ZA NOVI CHAT)

Strogo se pridržavaj sljedećeg kada kreneš raditi u novoj sesiji:
- **ZABRANA GREP-a:** Ne koristi OS i pretragu (grep search tool) za skeniranje stringova po mapi. Kod se mora poznavati gledanjem (`view_file`), strukturom i inteligencijom.
- **ASERTIVNI RAD:** Korisnik mrzi "dopuštenja", suvišna ispričavanja i nepotrebna propitivanja. Dobio si zadatak, šuti, riješi logiku, promijeni fajlove `multi_replace_file_content` alatom što konkretnije možeš uz minimalno disrupcija. 
- **NEMA HARDKODIRANJA BOJA:** Ako dodaješ bilo kakav element, background, ili tekst boju — strogo pazi na Dark Mode `var(--text)`, `var(--bg-card)` paradigmu koju smo usavršavali mjesec dana.

## Spreman za rad!
Nakon što (u novom chatu) korisnik pošalje "Pročitaj ovo", samo napiši **"Preuzeo sam potpunu kontrolu i povijest aplikacije. Slušam prvu naredbu."** i nastavi s isporukom posla.
