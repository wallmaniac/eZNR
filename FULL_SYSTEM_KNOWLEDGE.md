# ══════════════════════════════════════════════════════════════
# eZNR — POTPUNA ENCIKLOPEDIJA PROJEKTA / COMPLETE PROJECT ENCYCLOPEDIA
# ══════════════════════════════════════════════════════════════
# Kreirano: 10.04.2026
# Razvojni period: 08.02.2026 — 10.04.2026 (2 mjeseca svakodnevnog rada)
# Svrha: Potpuni kontekst za nastavak rada u novom AI chat-u
# ══════════════════════════════════════════════════════════════

---

# 🇭🇷 DIO 1: HRVATSKI / BOSANSKI JEZIK

---

## 1. TEHNOLOŠKI STEK I INFRASTRUKTURA

- **Framework:** Next.js 16.1.6 (App Router) sa React 19
- **Jezik koda:** JavaScript (bez TypeScripta)
- **Stilizacija:** Čisti Vanilla CSS sa CSS varijablama (tematizacija Dark/Light)
- **Deployment:** Vercel (automatski CI/CD sa GitHub `main` granke)
- **Domena:** `zastitanaradu.ba` (custom domena na Vercelu)
- **Backend servisi:** Firebase (Auth, Firestore, Storage)
- **Email:** Resend API (`noreply@mail.zastitanaradu.ba`) — ranije korišten Nodemailer, pa EmailJS, oba potpuno uklonjeni
- **AI motor:** Google Gemini (1.5 Flash / 2.0 Flash) za sve AI funkcionalnosti
- **PDF konverzija:** Python `pdf2docx` mikroservis na Railway.app, poziva se iz Next.js API ruta
- **Repozitorij:** GitHub privatni repo `eZNR`

---

## 2. HIBRIDNA BAZA PODATAKA (NAJVAŽNIJI KONCEPT)

Aplikacija koristi **offline-first hibridni model**:
1. **Primarno skladište: `localStorage`** — sve CRUD operacije rade instantno u pregledniku putem `src/lib/dataStore.js`. Prefiks ključeva: `eznr_`. Ovo daje 0ms latenciju za UI.
2. **Sekundarno skladište: Firebase Firestore** — sinkronizacija se pokreće ručno iz Postavke → Firebase Sync (gumb). Služi kao backup i za pristup s drugog uređaja. Modul: `src/lib/firebaseSync.js`.
3. **Izuzetak:** Questionnaire sesije i odgovori radnika žive **isključivo u Firestore-u** jer im radnici pristupaju putem javnih linkova bez lokalne pohrane.

### Ključne file-ove:
- `src/lib/dataStore.js` — centralni CRUD interfejs, relacijska logika, kolekcije
- `src/lib/firebase.js` — Firebase SDK inicijalizacija
- `src/lib/firebaseSync.js` — sinkronizacija, migracija, sesije upitnika
- `src/lib/systemMonitor.js` — zdravlje sustava, notifikacijske postavke, default vrijednosti

---

## 3. MULTI-TENANCY (VIŠESTRUKE FIRME)

Cijeli sustav izgrađen je za istovremeno upravljanje **više firmi** pod jednim korisničkim računom.

- **Podaci su segmentirani po `companyId`**. Svaka kolekcija (radnici, oprema, uvjerenja...) filtrira se prema aktivnoj firmi.
- **SuperAdmin** ima `companyIds: ['all']` — vidi agregirane podatke svih firmi.
- **Safety Officer** vidi samo dodijeljene firme.
- **"Sve Firme" pogled:** Dashboard agregira statistike, kalendar i alarme iz svih firmi istovremeno. Događaji prikazuju bedž s imenom firme.
- **Kreiranje nove firme:** Gumb "+ Dodaj novu firmu" u dropdown-u firmi. Automatski seedira org. jedinice (Uprava, Proizvodnja, Administracija) i tipove uvjerenja/OZO.
- **Prebacivanje firmi** okida potpuni reload stranice da se podaci osvježe.
- **Penetration test modul:** `/dashboard/pen-test` — testni skript koji pokušava pristupiti podacima tuđe firme preko Firestore-a i potvrđuje `permission-denied`.

---

## 4. KOMPLETNA LISTA DASHBOARD MODULA (64 stranice)

### Glavni moduli:
| Modul | Ruta | Opis |
|-------|------|------|
| Dashboard | `/dashboard` | Statistike, kalendar, upozorenja, tablica radnika |
| Radnici | `/dashboard/workers` | CRUD radnika, profil modal, brze akcije |
| Org. jedinice | `/dashboard/org-units` | Organizacijska struktura firme |
| Org. grupe | `/dashboard/org-groups` | Grupiranje org. jedinica |
| Radna mjesta | `/dashboard/workplaces` | Definicija radnih mjesta sa smjenama |
| Popis radnih mjesta | `/dashboard/workplace-list` | Alternativni popis prikaz |
| Uvjerenja radnika | `/dashboard/worker-certificates` | Izdana uvjerenja sa statusima |
| Kreiranje uvjerenja | `/dashboard/worker-certificates/create` | Forma za nova uvjerenja |
| Tipovi uvjerenja | `/dashboard/cert-types` | Katalog tipova uvjerenja |
| OZO oprema (PPE) | `/dashboard/ppe` | Katalog zaštitne opreme |
| Zaduženja OZO | `/dashboard/worker-ppe` | Evidencija tko ima koju opremu |
| Ispitivanje opreme | `/dashboard/equipment` | Radna oprema sa datumima ispitivanja |
| Tipovi opreme | `/dashboard/equipment-types` | Katalog tipova opreme |
| Pregledi opreme | `/dashboard/equipment-exams` | Evidencija obavljenih pregleda |
| Ljekarski pregledi | `/dashboard/medical-exams` | Praćenje ljekarskih pregleda radnika |
| Povrede na radu | `/dashboard/injuries` | Prijava i evidencija povreda (spojeno iz 2 modula) |
| Godišnji izvještaj povreda | `/dashboard/annual-injuries` | Statistika povreda po godinama |
| Noćni rad | `/dashboard/night-work` | Evidencija noćnog rada |
| Uputnice RA-1 | `/dashboard/referral-ra1` | Uputnice za ljekarske preglede |
| Obrasci RO-1 | `/dashboard/form-ro1` | Prijava povrede na radu |
| Obrasci RO-2 | `/dashboard/form-ro2` | Završni izvještaj o povredi |
| Obrasci OIR-1 | `/dashboard/form-oir1` | Evidencija profesionalnih oboljenja |
| Registar bolesti | `/dashboard/diseases` | Katalog profesionalnih bolesti |
| Zahtjevnice | `/dashboard/requests` | Interne zahtjevnice |
| Dokumenti poslodavca | `/dashboard/employer-docs` | Akti, pravilnici, ugovori sa upload-om datoteka |
| Digitalna arhiva | `/dashboard/archive` | Centralna arhiva svih dokumenata |
| Sistematizacija | `/dashboard/sistematizacija` | Pravilnik o sistematizaciji sa 7 zakonskih polja (čl. 118 ZoR FBiH) |
| Procjena rizika | `/dashboard/risk-assessment` | 5×5 matrica, AI mjere, Word/PDF export |
| Upitnici | `/dashboard/questionnaires` | Drag-and-drop editor, slanje, rezultati, podsjetnici |
| Obuke | `/dashboard/trainings` | Sustav obuka sa prezentacijama, kvizom i certifikatom |
| Knjiga obuka | `/dashboard/training-book` | Evidencija provedenih obuka |
| Testovi ZOP/ZNR | `/dashboard/tests-zop-znr` | Generator testova za zaštitu od požara i ZNR |
| Vozni park | `/dashboard/fleet` | Popis vozila sa semaforima (reg/tehnički/osiguranje) |
| Zaduženja vozila | `/dashboard/fleet-assignments` | Globalni prikaz zaduženja vozila |
| Dokumenti vozila | `/dashboard/fleet-documents` | Arhiva dokumenata vozila (Firebase Storage) |
| Putni nalozi | `/dashboard/fleet-orders` | PN-3/PN-4 putni nalozi po FBiH Zakonu |
| Zaštita od požara | `/dashboard/fire-protection` | Modul zaštite od požara (Premium/Enterprise) |
| Evakuacija | `/dashboard/evacuation` | Planovi evakuacije (Premium/Enterprise) |
| Vježbe evakuacije | `/dashboard/evacuation-drills` | Evidencija vježbi (Premium/Enterprise) |
| Adresar | `/dashboard/address-book` | Kontakti inspektora, doktora, institucija |
| Ovlaštene firme | `/dashboard/authorized-companies` | Registar ovlaštenih organizacija za ZNR |
| Doktori | `/dashboard/doctors` | Registar doktora medicine rada |
| Ispitivači | `/dashboard/examiners` | Registar ispitivača opreme |
| Import podataka | `/dashboard/import` | Excel import sa 6 sheet-ova i fuzzy matching-om |
| Konverter | `/dashboard/converter` | PDF ↔ Word konverter (koristi Railway Python servis) |
| AI vijesti | `/dashboard/news` | AI-generirane vijesti o ZNR zakonodavstvu BiH |
| ZNR zakonodavstvo | `/dashboard/znr-zakonodavstvo` | Baza zakona i pravilnika |
| Postavke | `/dashboard/settings` | Profil, firma, notifikacije, kalendar, prikaz, Firebase sync |
| Admin panel | `/dashboard/admin` | Upravljanje korisnicima |
| Setup čarobnjak | `/dashboard/setup` | Inicijalno postavljanje nove firme |
| Extra polja | `/dashboard/extra-fields` | Custom polja za radnike |
| Pen test | `/dashboard/pen-test` | Sigurnosni test Firestore izolacije |
| ISZNR moduli | `/dashboard/isznr-*` | Inspektorski dokumenti (6 pod-modula) |

---

## 5. API ENDPOINT-OVI (18 ruta)

| Endpoint | Opis |
|----------|------|
| `/api/zia` | Zia AI asistent — prima poruku, vraća odgovor uz Function Calling |
| `/api/news` | AI vijesti o ZNR zakonima — Gemini generira dnevne BiH novosti |
| `/api/send-email` | Slanje emailova putem Resend API-ja (upitnici, podsjetnici) |
| `/api/notify-expiry` | Dnevni automatski pregled isteklih rokova + email digest |
| `/api/notif-settings` | Dohvat/pohrana notifikacijskih postavki |
| `/api/risk-measures` | AI prijedlog sigurnosnih mjera za stavke rizika, podržava prilog dokumenata |
| `/api/generate-risk-questionnaire` | AI generira 7-sekcijski upitnik za radno mjesto |
| `/api/analyze-questionnaire` | AI analizira odgovore upitnika → generira stavke rizika s V/P |
| `/api/analyze-risk-docs` | AI multi-document analiza (mjerni protokoli, zapisnici) → opis procesa + opasnosti |
| `/api/generate-opis-procesa` | AI generira Opis tehničko-tehnološkog procesa iz podataka firme |
| `/api/generate-sistematizacija` | AI generira sistematizaciju radnih mjesta (čl. 118 ZoR) |
| `/api/generate-quiz` | AI generira ZOP/ZNR testove |
| `/api/generate-from-document` | AI parsira postojeće testove iz Word/PDF u drag-and-drop format |
| `/api/parse-presentation` | AI parsira prezentacije za obuku |
| `/api/parse-sistematizacija` | AI parsira upload-ane dokumente sistematizacije |
| `/api/pdf-parse` | Parsira PDF datoteke za analizu |
| `/api/pdf-to-word` | Konvertira PDF u Word (lokalno ili putem Railway servisa) |
| `/api/debug-pdf` | Debug endpoint za PDF parsiranje |

---

## 6. KOMPONENTE (`src/components/`)

| Komponenta | Opis |
|-----------|------|
| `Header.js` (47KB) | "Floating Three-Island" header — 3 lebdeća otoka: navigacija, globalni search (Ctrl+K), profil/notifikacije. Na mobitelu: kompaktna 48px traka sa ←→, firma chip, zvonce |
| `Sidebar.js` (37KB) | Desktop: klasični lijevi sidebar sa accordion gupama. Mobitel: bottom-sheet drawer (88vh) koji izlijeće odozdo |
| `AIAssistant.js` (98KB) | Zia AI asistent — draggable FAB bubble, Function Calling (navigate, search_workers, assign_ppe), proaktivni jutarnji pozdrav |
| `WorkerProfileModal.js` (33KB) | Profil radnika — brze akcije (novi pregled / uvjerenje / povreda), stupci podataka |
| `EmailDispatchModal.js` (26KB) | Slanje upitnika/obuka radnicima — odabir radnika, ručni email, rok, progress bar |
| `SurveyCreator.js` (38KB) | Drag-and-drop editor upitnika sa auto-ocjenjivanjem |
| `PublicQuestionnaireForm.js` (27KB) | Renderer forme na javnoj ruti `/q/[token]` — bez prijave |
| `QuestionnaireResults.js` (20KB) | Dashboard rezultata upitnika — statistike, sesije, odgovori |
| `ReminderModal.js` (17KB) | Podsjetnik za nedovršene upitnike — prikazuje tko nije završio, šalje batch email |
| `HelpTip.js` (5KB) | Klikabilni [i] tooltip sa pravnim pojašnjenjima pored polja u formama |
| `UndoBar.js` (6KB) | Undo traka nakon brisanja zapisa |
| `GenericPage.js` (2KB) | Generička wrapper stranica |

### Mobilne komponente (`src/components/mobile/`):
| Komponenta | Opis |
|-----------|------|
| `MobileBottomNav.js` | Fiksna bottom navigacija (56px) — 📊 Home, 👷 Radnici, 📜 Uvjerenja, 🔍 Pretraga, ☰ Menu |
| `MobileSearchOverlay.js` | Full-screen pretraga — pretražuje radnike, opremu, radna mjesta |
| `MobileDropdownPortal.js` | Portal-bazirani dropdown renderer za ispravno pozicioniranje na mobitelu |
| `PullToRefresh.js` | Pull-down-to-refresh gesta s animiranim spinnerom |
| `OfflineIndicator.js` | Crveni/zeleni banner za status internet konekcije |
| `LongPressMenu.js` | Long-press kontekstualni popup na redovima tablice (0.5s) |
| `SwipeRow.js` | Swipe-ulijevo za otkrivanje akcija (iOS stil) |
| `CollapsibleWidget.js` | Sklopivi/raskolopivi dashboard widgeti s animacijom |

---

## 7. DIZAJN I UI/UX PRAVILA (STRIKTNA!)

### 7.1 Dark/Light Mode
- **SVE boje moraju koristiti CSS varijable:** `var(--primary)`, `var(--bg-card)`, `var(--text-primary)`, `var(--danger)`, itd.
- **APSOLUTNO ZABRANJENO hardkodiranje HEX boja** unutar React komponenti!
- Za suptilne pozadine: `rgba(var(--primary-rgb), 0.15)` — "glassmorphism" efekt
- Dark mode se prebacuje u `globals.css` preko `[data-theme="dark"]` selektora
- Native `<input type="date">` koristi `color-scheme: dark;` za automatsko tamno prilagođenje

### 7.2 Floating Three-Island Header
- Tri lebdeća elementa u headeru radi prozračnosti
- Srednji otok: globalni Search (Ctrl+K shortcut)
- Desni otok: notifikacije zvonce, profil, dark/light toggle, BS/EN jezični switch
- Na mobitelu (≤767px): kompaktna 48px traka, bez searcha i bez toggleova (prebačeni u bottom nav i drawer)
- Mobile header height: 56px (povećano da stanu dark mode i language toggle gumbi)
- Company chip: `maxWidth: 140px` za prevenciju layout breakage-a

### 7.3 Bilingvalni sustav
- Potpuna podrška za **Bosanski (bs)** i **Engleski (en)** jezik
- Prebacivanje jezike je instantno putem centraliziranog rječnika/state-a
- Sav UI tekst provučen kroz prijevodne ključeve

### 7.4 Standardizirani UI uzorci tablice
- **Checkbox kolona** na početku svake tablice za multi-selekciju
- **"Akcije ▼" dropdown** umjesto inline gumba — pametno se flip-a ovisno o prostoru na ekranu
- **"Grupne akcije" bar** za bulk brisanje/ispis
- **`useSortedList` hook** za sortiranje po stupcima sa vizualnim indikatorima
- **Klikabilni redovi** — klik bilo gdje na red otvara modal/detalje
- **`e.stopPropagation()`** na interaktivnim elementima unutar redova da se spriječi otvaranje modala

### 7.5 Standardizirani dijalozi
- **Zabranjeni: `window.alert()` i `window.confirm()`** — potpuno zamijenjeni custom `useDialog()` hook-om
- **`SavedFlash`** zelena potvrda nakon svakog CRUD save-a
- **`useSavedFlash` hook** za feedback "Spremljeno ✓"

---

## 8. PROCJENA RIZIKA — NAJSLOŽENIJI MODUL

Ovo je najkompleksniji dio aplikacije sa 5 tab-ova koji prate FBiH Pravilnik:

### Tab 1: Opšti podaci
- Podaci o firmi (sjedište, djelatnost, broj zaposlenih)
- Ovlaštena organizacija (ime, kvalifikacije)
- Revizija i datum

### Tab 2: Opis procesa
- **🤖 AI Generiši opis** — poziva `/api/generate-opis-procesa` sa podacima firme
- **🤖 AI Analiza dokumenata** — multi-document upload (PDF/Word), AI čita mjerne protokole i zapisnike, generira opis procesa + automatski detektira opasnosti

### Tab 3: Procjena (5×5 Matrica)
- Interaktivna **5×5 risk matrica** sa klikabilnim ćelijama
- Boje: 🟢 1-5 (Neznatan) → 🟡 6-10 → 🟠 11-15 → 🔴 16-20 → ⬛ 21-25 (Nedopustiv)
- Bubble counteri pokazuju koliko stavki je u svakoj ćeliji
- **CRUD za stavke rizika** — svaka ima: radno mjesto, opasnost, V₀×P₀ (početni), V₁×P₁ (rezidualni), mjere, odgovorna osoba, rok
- **🤖 AI Predloži mjere** — poziva `/api/risk-measures` + opcija prilaganja dokumenta za preciznije prijedloge
- **⚠️ Dodaj iz kataloga** — bulk dodavanje opasnosti iz hazard kataloga
- **Kontekst panel** — kad odabereš radno mjesto, prikazuje OZO, opremu, posebne uvjete iz Sistematizacije
- **Inline editing** na Mjere tab-u — real-time uređivanje odgovorne osobe i roka

### Tab 4: Mjere
- Filtrirani prikaz stavki s R ≥ 6
- Inline editabilni `Odgovorna Osoba` (datalist sa radnicima) i `Rok Provedbe` (date input)

### Tab 5: Zaključak
- Ukupna ocjena **prije i nakon mjera** sa postotkom smanjenja
- **🤖 AI Generiši zaključak** — profesionalni tekst zaključka
- **📄 Preuzmi PDF** — kompletan "Akt o procjeni rizika" sa 6 sekcija, cover stranicom, ocjenama, potpisnim linijama
- **📗 Preuzmi Word (.docx)** — identičan dokument u Word formatu

### Integracije procjene rizika:
- **Auto-sync u Employer Docs** — pri spremi, automatski kreira/ažurira "Akt procjene rizika" u Dokumentima poslodavca s 2-godišnjim rokom
- **Mjere u kalendaru** — mjere s rokovima provedbe (`rokProvedbe`) automatski generiraju 🛡️ događaje u kalendaru
- **Alarmi** — zakašnjele mjere i mjere koje ističu unutar 30 dana pojavljuju se u Dashboard upozorenjima

---

## 9. MODUL UPITNIKA I OBUKA

### Upitnici (`/dashboard/questionnaires`)
- **Drag-and-drop** editor za kreiranje upitnika sa tipovima pitanja
- **Auto-ocjenjivanje** — prolaz/pad na temelju postotka
- **Rok isteka** (`rokIsteka`) — blokira ispunjavanje nakon isteka
- **Email dispatch** — slanje putem Resend API-ja s unikatnim token linkovima
- **Javna forma** (`/q/[token]`) — radnik ispunjava bez prijave
- **Podsjetnik** — ReminderModal prikazuje tko nije završio, šalje batch reminder s narančastom "PODSJETNIK" email temom
- **Rezultati** — dashboard sa statistikama, sesijama, individualnim odgovorima
- **Completion %** — kolona "Ispunjenost" s progress barom u tablici
- **AI generiranje upitnika za radno mjesto** — button u Questionnaires za odabir radnog mjesta → AI generira 7-sekcijski upitnik
- **Import u procjenu rizika** — AI analizira odgovore → auto-kreira stavke rizika

### Obuke (`/dashboard/trainings`)
- Isti tok kao upitnici ali s prezentacijom + kvizom
- **Javna forma** (`/t/[token]`) — prezentacija → kviz → rezultat
- **Certifikat o završenoj obuci** — A4 landscape, dekorativne bordure, Google Fonts (Playfair Display + Inter), Score badge, potpisi, broj certifikata
- **Rok isteka** — blokira pristup nakon isteka

---

## 10. VOZNI PARK (FLEET MANAGEMENT)

Kompletan FBiH-usklađen modul za upravljanje vozilima:

### Struktura:
- **Popis vozila** (`/dashboard/fleet`) — grid svih vozila sa trodijelnim semaforom (Registration / Technical / Insurance)
- **Zaduženja** (`/dashboard/fleet-assignments`) — globalni prikaz svih zaduženja, + Novo zaduženje direktno
- **Dokumentacija** (`/dashboard/fleet-documents`) — Firebase Storage upload (ne base64!), kategorije, datumi
- **Putni nalozi** (`/dashboard/fleet-orders`) — PN-3 (teretno) / PN-4 (putničko) prema FBiH Zakonu o cestovnom prijevozu

### Ključne funkcionalnosti:
- **Zaduženje vozila:** Start Date, Starting Mileage, Return Date, Ending Mileage — historijski tracking
- **Modal-over-modal arhitektura:** Sub-forme (zaduženje, nalog, dokument) otvaraju se kao overlay modali sa z-index 12000 iznad parent modala
- **Bulk selekcija i Akcije dropdown** na svakom tab-u
- **Click-to-edit** na svim redovima
- **Print layout** za putne naloge — FBiH PN-3/PN-4 format s praznim tablicama za ručno ispunjavanje
- **Kopiranje naloga** — "📋 Kopiraj" kreira duplikat s novim brojem (PN-2026-XXX)
- **Podsjetnici** — Settings → Obavijesti → 🚗 Vozni park section: toggle alarma, threshold (7/14/30/60 dana), kalendar vidljivost
- **Dashboard integracija** — vozila s isteklim/uskoro istečenim rokovima prikazuju se kao kalendarski događaji

---

## 11. ZIA — AI ASISTENT

### Arhitektura:
- **Draggable FAB bubble** — drag po ekranu, edge snapping (lijevo/desno), pozicija sprema se u localStorage
- **Function Calling (Gemini)** — Zia nije samo chatbot, već agent koji može:
  - `navigate_to(path)` — navigira na stranicu
  - `search_workers(query)` — filtrira radnike
  - `get_expiring_certs(days)` — lista uvjerenja koja ističu
  - `get_sick_leave_workers()` — radnici na bolovanju
  - `assign_ppe(workerId, ppeId)` — zaduži OZO opremu
  - `dispatch_questionnaire(qId, workerIds)` — poziva email dispatch
- **Proaktivni jutarnji pozdrav** — kada se korisnik prijavi, Zia skenira datumski bazirane podatke i generira morning briefing
- **Settings toggle** — Postavke → Prikaz → "Proaktivna asistentica" (da/ne)
- **Mobile:** Full-screen chat overlay. Desktop: prozorčić pokraj FAB-a
- **Bug fix:** TDZ (Temporal Dead Zone) ReferenceError riješen reorderiranjem React Hook pipeline-a

### Dinamički kontekstualni chipovi:
Umjesto statičnih prijedloga, Zia prikazuje pametne chipove bazirane na live podacima:
- "📜 3 uvjerenja ističu ovaj mjesec"
- "👷 Marko Marić na bolovanju"
- "⚠️ Pregled opreme kasni"

---

## 12. EMAIL SUSTAV — EVOLUCIJA

1. **Faza 1 — Nodemailer/SMTP:** Prva implementacija. Uklonjeno jer zahtijevalo server.
2. **Faza 2 — EmailJS (client-side):** Radilo ali ograničeno. Paketi uklonjeni iz `package.json`.
3. **Faza 3 — Resend API (server-side):** Finalna implementacija.
   - API ruta: `/api/send-email`
   - From: `noreply@mail.zastitanaradu.ba`
   - HTML email template sa eZNR logom u headeru
   - Podrška za: dispatch upitnika (purple CTA), reminder (orange CTA)
   - Env varijable: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

### Automatske daily notifikacije:
- **API ruta:** `/api/notify-expiry` — dnevni pregled svih isteklih rokova
- **Trigger:** GCP Cloud Scheduler (`0 7 * * *`, Europe/Sarajevo timezone)
- **Secret:** query param autentikacija
- **Konfiguracija po officers-u:** Settings → Obavijesti → Automatski Email — jezik (BS/EN/Bilingual), threshold, kategorije
- **Firebase Admin SDK** — koristi service account za server-side Firestore čitanje

---

## 13. SISTEMATIZACIJA I PRAVNI OBRASCI

### Sistematizacija (`/dashboard/sistematizacija`)
7 zakonski obaveznih polja po čl. 118 Zakona o radu FBiH:
- Naziv posla, Kategorija RM (Rukovodeće/Izvršno/Pomoćno), Složenost, Probni rad, Odgovornosti, Potrebne obuke, Pravni osnov
- AI generiranje iz opisa firme → `/api/generate-sistematizacija`

### ZOS (Zapisnik o ocjeni osposobljenosti)
- **NEMA datum isteka** — vrijedi dok radnik ostaje na istom radnom mjestu
- Kod promjene radnog mjesta → postojeći ZOS postaje nevažeći (čl. 34)
- Print template: `/print-template?type=ZOS` — A4, formalni tekst, komisija, potpisi
- Upload skeniranog ZOS-a direktno u profil radnika → automatski kreira Uvjerenje

### ZOP (Zaštita od požara)
- Isti workflow kao ZOS ali za protupožarnu obuku
- Print template: `/print-template?type=ZOP`

---

## 14. MOBILNA OPTIMIZACIJA (OPSEŽNA!)

### Navigacija:
- **Bottom nav bar** (56px) — 5 tab-ova: Home, Radnici, Uvjerenja, Pretraga, Menu
- **Bottom-sheet drawer** — sidebar izlazi odozdo (88vh), drag handle, scrollable, korisnik info + logout na dnu
- **Kompaktni header** (48px) — samo ←→, firma chip, zvonce

### Geste i interakcije:
- **Pull-to-Refresh** — custom spinner koji skalira s udaljenošću pull-a, toast "Podaci osvježeni"
- **Long Press Menu** (0.5s) — kontekstualni popup na redovima (Otvori profil, Uvjerenja, OZO, Ljekarski, Obriši)
- **Swipe-to-Navigate** — SwipeRow komponenta (pripremljena, čeka integraciju)
- **Collapsible widgets** — 4 sekcije dashboarda (Pregled, Upozorenja, Kalendar, Radnici) sa collapse/expand animacijom, stanje persista u localStorageu
- **Zia draggable FAB** — touch+mouse podrška, edge snapping, razlikovanje click vs drag (< 8px = click)

### Biometric Login (WebAuthn):
- **Registracija:** Nakon prvog login-a, modal ponudi "Omogući brzu prijavu?" → biometrijski prompt (otisak/lice)
- **Kasniji login:** "🔐 Prijava otiskom prsta" gumb ispod standardne forme
- **Samo na HTTPS** (Vercel deployment), ne radi na localhost
- Modul: `src/lib/webAuthn.js`

### Offline podrška:
- **Crveni banner:** "📡 Nema internet konekcije" kad se izgubi veza
- **Zeleni banner:** "✅ Ponovo online" (auto-hide nakon 2.5s)

### Toast sustav:
- Global toast: `window.eznrToast('poruka', 'success'|'error'|'info'|'warning')`
- Slide up iz dna, auto-dismiss 3s, stack-anje, tap za dismiss
- Context: `src/contexts/ToastContext.js`, wrapped u `layout.js`

---

## 15. KALENDAR I DASHBOARD

### Kalendar:
- **Month picker:** Hidden native `<input type="month">` iza `<h2>` headera — klik na tekst otvara OS picker
- **Mobilni scrolling:** `WebkitOverflowScrolling: 'touch'`, `overscrollBehavior: 'contain'`
- **Auto-eventi:** Certifikati, oprema, dokumenti, fleet, ljekarski, servisi, mjere rizika — svi sa toggle-ovima u Settings
- **Date sanitizacija:** `.split('T')[0]` strip za timezone-agnostic matching
- **Servis tip događaja:** Dropdown s listom opreme iz aktivne firme
- **Day-detail popover:** Klik na dan s događajima otvara popup s listom, badgeovima (Isteklo/Auto/Firma), navigacijom na module

### Dashboard statistike:
- **Klikabilne stat kartice** — "Ističe uskoro" i "Isteklo" linkaju na pre-sortirane module (`?sort=expiry`)
- **Upozorenja widget:** 🚨 kategorije — istekli certifikati, oprema, ljekarski, mjere rizika
- **Sortiranje praznih datuma:** `useSortedList` hook gura zapise bez datuma isteka na dno tablice

---

## 16. INPUT PRAVILA I FBiH ZAKONSKA USKLAĐENOST

### Vrijeme — 24-satni format:
- **APSOLUTNA ZABRANA `<input type="time">`** — iOS i specifični Android sustavi lomili su format na AM/PM
- Zamijenjeno sa **dva `<select>` elementa**: Sati (00-23), Minute (00/15/30/45)
- Implementirano na: `workplaces/page.js`, `injuries/page.js`, i svim ostalim formama s unosom vremena

### Noćni rad — čl. 40 ZNR FBiH:
- Ako radno mjesto ima smjenu u rasponu **22:00 — 06:00**, sustav automatski u Worker Profile prikazuje crveni banner:
  *"⚠️ Obavezan ljekarski pregled 1x u 2 godine (Noćni Rad - ZNR čl. 40)"*
- Implementirano u `workers/page.js` — dinamička provjera sati radnog mjesta

---

## 17. IMPORT / EXPORT SUSTAV

### Excel Import (`/dashboard/import`):
- Template sa **6 sheet-ova:** Radnici, Uvjerenja, OZO, Oprema, Ljekarski, Upute
- **Fuzzy name matching** za `radnoMjesto` i `orgJedinica` kolone (exact → substring fallback)
- **Validacija:** Preskače redove bez `ime`/`prezime` ili `naziv`
- **Linking statistike** prikazuju uspješno povezane zapise

### Export mogućnosti:
- PDF (Procjena rizika, putni nalozi, certifikati obuka)
- Word/DOCX (Procjena rizika)
- Excel (template download)
- **Bulk PDF** za uvjerenja — checkbox selekcija → batch print u 1 PDF

---

## 18. SUBSCRIPTION / PRETPLATA SUSTAV

### B2B tier sustav:
- `useSubscription` hook provjerava `subscriptionTier` na aktivnoj firmi
- Premium/Enterprise moduli (Vozni Park, ZOP, Evakuacija) prikazuju **🔒 ikonu** u Sidebar-u za BASIC korisnike
- Klik na zaključani modul otvara upgrade modal

### Pricing plan:
- **eZNR 50 (Basic):** €50/mjesec — do 50 radnika, svi compliance moduli
- **Skaliranje:** €1.50/mjesec po ekstra radniku iznad 50
- **Enterprise dodaci:** Multi-Company (+199 BAM/mj), Digitalni potpisi (+99 BAM/mj), Onboarding (jednokratno)
- **Projekcija:** 50 firmi × 100 radnika = ~14,950 BAM/mjesec MRR

---

## 19. BUGOVI KOJI SU POPRAVLJENI (KRONOLOŠKI)

1. **injuries/page.js crash** — Group actions UI bez definiranih handlera → dodani `selectedIds`, `toggleAll`, `toggleOne`, `handleDeleteSelected`
2. **injury-list/page.js crash** — 6 referenci na nedefiniranu `records` varijablu → zamijenjeno sa `filtered`, dodani `handleEdit`, `getWorkerName`, `formatDate`
3. **Settings blank page** — URL inicijalizacija bez fallbacka → dodano `currentTab = TAB_KEYS.includes(activeTab) ? activeTab : 'profile'`
4. **Napomena bug** — "Potrebna revizija" pogrešno persistirala u auto-sync-u rizika → popravljeno
5. **Fleet sub-tab crashes** — Missing `useRef` za worker search, krivi variable names → popravljeno
6. **Fleet documents data bindings** — `linkedTo` umjesto `kategorija`, `vrijediDo` umjesto `datumIsteka` → popravljeno
7. **Zia TDZ crash** — `sendMessageInternal` pristupan prije definiranja → reorderian React Hook pipeline
8. **Calendar timezone mismatch** — `T00:00:00Z` sufiks lomio matching → `.split('T')[0]` sanitizacija
9. **Duplicate injury modules** — 2 odvojena modula (injuries + injury-list) → spojeno u jedan, `injury-list` obrisan
10. **Workers sort blank dates** — Radnici bez datuma isteka sortirali se na vrh → `useSortedList` gura prazne na dno
11. **Native calendar dark mode** — `<input type="date">` bio bijel u dark modu → `color-scheme: dark;` u globals.css
12. **Mobile header overflow** — Previše gumba za mobilni header → height 56px, company chip maxWidth 140px

---

## 20. UX POBOLJŠANJA I WORKFLOW PREČICE

### Brze akcije u profilu radnika:
Ispod headera WorkerProfileModal — 3 gumba:
- 👨‍⚕️ Novi ljekarski pregled
- 📄 Novo uvjerenje
- 🚑 Prijavi povredu
Svi prenose `workerId` i automatski se vraćaju u modal nakon spreme.

### Obnova uvjerenja:
- Istekle certifikate imaju "📋 (Obnovi)" gumb → otvara create formu s `?copyFrom=[ID]` za dupliciranje podataka
- Defaultno otvara "Single Worker Mode" umjesto tablice 700+ radnika

### Deep linking:
- `?sort=expiry` na stat karticama
- `?openNew=1` na RA-1 modulu iz medicinskih pregleda
- `?editId=ID` na povredama za otvaranje specifičnog zapisa
- `?copyFrom=ID` za kopiranje certifikata
- Equipment `Zadužena osoba` koristi HTML5 `<datalist>` s aktivnim radnicima za autocomplete

### HelpTip tooltipovi:
- 20+ [i] ikonica na ključnim poljima (JMBG vs OIB, rad na visini, kolektivna povreda, itd.)
- Pravna pojašnjenja za inspektorski relevantna polja

---

## 21. LISTA FAJLOVA U PROJEKTU (KLJUČNI)

### Jezgra podataka:
- `src/lib/dataStore.js` — centralni CRUD, kolekcije, relacije
- `src/lib/firebase.js` — Firebase init
- `src/lib/firebaseSync.js` — sync, sesije, migracija
- `src/lib/systemMonitor.js` — health, notif defaults
- `src/lib/emailService.js` — Resend email wrapper
- `src/lib/emailTemplate.js` — HTML email templates (dispatch + reminder)
- `src/lib/storageService.js` — Firebase Storage upload/delete za fleet docs
- `src/lib/webAuthn.js` — WebAuthn biometrijski helperi
- `src/lib/trainingCertificate.js` — A4 landscape certifikat generator

### Layout:
- `src/app/layout.js` — root layout, ToastProvider
- `src/app/page.js` — login stranica, biometric enrollment
- `src/app/dashboard/layout.js` — dashboard wrapper
- `src/app/dashboard/layout-client.js` — client layout sa sidebar, header, mobile nav, offline indicator
- `src/app/dashboard/page.js` (117KB!) — glavni dashboard
- `src/app/globals.css` — sve CSS varijable, responsive breakpoints, print styles

### Javne rute (bez login-a):
- `src/app/q/[token]/page.js` — javna forma upitnika
- `src/app/t/[token]/page.js` — javna forma obuke + certifikat
- `src/app/print-template/page.js` — ZOS/ZOP print templates

---

## 22. GIT COMMITOVI (KRONOLOŠKI, NAJVAŽNIJI)

- `7a817df` — 5×5 Risk Matrix foundation
- `4163397` — Risk grading formula + AI measures
- `fba66a4` — Questionnaire import + AI analysis
- `b311075` — PDF report generation
- `dc6bfe5` — window.alert/confirm replacement audit (57 stranica)
- `756bef7` — injuries + injury-list bug fixes
- `3d79086` — Sistematizacija BiH law alignment
- `94074c4` — Feature batch (search, print, import, firebase sync)
- `4722e47` → `943022d` — Multi-company implementation
- `75d7110` — Fleet management stability fixes
- Commit sa Resend integracijom (2026-03-28)
- Commit sa mobile responsive overhaul (2026-04-07)

---

## 23. PENDING ZADACI I BUDUĆI RAD

- [ ] Dovršiti Firebase Sync testiranje s realnim podacima
- [ ] Deploy firestore.rules na Firebase Console (CLI auth nedostupan)
- [ ] Implementirati billing sustav (Stripe/Paddle)
- [ ] Gate-ati feature po subscription tier-u
- [ ] ISZNR signing workflow
- [ ] Ukloniti stare EmailJS env varijable s Vercela
- [ ] SwipeRow integracija u tablice
- [ ] Globalni audit preostalih native time input-a
- [ ] Auto-sync na save (umjesto ručnog Firebase Sync gumba)
- [ ] GDPR/data retention policy

---

## 24. PRAVILA RADA ZA NOVOG AI AGENTA (OBAVEZNO!)

1. **NE KORISTI GREP/ripgrep pretrage!** Koristi isključivo `view_file` za navigaciju kodom.
2. **NE POSTAVLJAJ SUVIŠNA PITANJA.** Dobivaš naredbu — nalaziš fajl — implementiraš — puštaš.
3. **SMANJI BROJ FILE OPERACIJA.** Koristi `multi_replace_file_content` za više izmjena u jednom fajlu umjesto višestrukih poziva.
4. **POŠTUJ CSS VARIJABLE.** Nikad ne hardkodiraj boje.
5. **POŠTUJ 24H FORMAT.** Nikad ne koristi native `<input type="time">`.
6. **POŠTUJ DARK MODE.** Testiraj vizualno u oba moda.
7. **BUDI ASERTIVAN.** Korisnik želi vojnički učinak bez ispričavanja.

---
---
---

# 🇬🇧 PART 2: ENGLISH LANGUAGE

---

## 1. TECHNOLOGY STACK & INFRASTRUCTURE

- **Framework:** Next.js 16.1.6 (App Router) with React 19
- **Code Language:** JavaScript (no TypeScript)
- **Styling:** Pure Vanilla CSS with CSS Variables (Dark/Light theming)
- **Deployment:** Vercel (auto CI/CD from GitHub `main` branch)
- **Domain:** `zastitanaradu.ba` (custom domain on Vercel)
- **Backend Services:** Firebase (Auth, Firestore, Storage)
- **Email:** Resend API (`noreply@mail.zastitanaradu.ba`) — previously Nodemailer then EmailJS, both completely removed
- **AI Engine:** Google Gemini (1.5 Flash / 2.0 Flash) for all AI features
- **PDF Conversion:** Python `pdf2docx` microservice on Railway.app, called from Next.js API routes
- **Repository:** GitHub private repo `eZNR`

---

## 2. HYBRID DATABASE (MOST IMPORTANT CONCEPT)

The app uses an **offline-first hybrid model**:
1. **Primary store: `localStorage`** — all CRUD operations execute instantly in the browser via `src/lib/dataStore.js`. Key prefix: `eznr_`. This gives 0ms UI latency.
2. **Secondary store: Firebase Firestore** — sync is triggered manually from Settings → Firebase Sync button. Serves as backup and for cross-device access. Module: `src/lib/firebaseSync.js`.
3. **Exception:** Questionnaire sessions and worker responses live **exclusively in Firestore** because workers access them via public links without local storage.

### Key files:
- `src/lib/dataStore.js` — central CRUD interface, relational logic, collections
- `src/lib/firebase.js` — Firebase SDK initialization
- `src/lib/firebaseSync.js` — synchronization, migration, questionnaire sessions
- `src/lib/systemMonitor.js` — system health, notification settings, defaults

---

## 3. MULTI-TENANCY (MULTIPLE COMPANIES)

The entire system is built for simultaneous management of **multiple companies** under one user account.

- **Data is segmented by `companyId`**. Every collection (workers, equipment, certificates...) filters by active company.
- **SuperAdmin** has `companyIds: ['all']` — sees aggregated data across all companies.
- **Safety Officer** sees only assigned companies.
- **"All Companies" view:** Dashboard aggregates stats, calendar, and alerts from all companies simultaneously. Events display company name badges.
- **New company creation:** "+ Add new company" button in company dropdown. Auto-seeds org units and certificate/PPE types.
- **Company switching** triggers full page reload to refresh data.
- **Penetration test module:** `/dashboard/pen-test` — test script that tries to access another company's data via Firestore and confirms `permission-denied`.

---

## 4. COMPLETE LIST OF DASHBOARD MODULES (64 pages)

The application has **64 dashboard sub-directories** covering:
- Worker management (CRUD, profiles, org structure, workplaces)
- Certificate & training tracking (types, issuance, renewal, expiry alerts)
- PPE/OZO equipment (catalog, assignments, stock tracking)
- Equipment inspection scheduling
- Medical examinations tracking
- Workplace injury reporting & yearly statistics (FBiH forms RO-1, RO-2, OIR-1)
- Night work tracking
- Employer documents with file uploads
- Digital archive
- Internal requests
- Systematization of positions (FBiH Art. 118)
- Risk Assessment (5×5 matrix, AI measures, PDF/DOCX export)
- Questionnaires (drag-and-drop builder, email dispatch, public fill, grading, reminders)
- Training system (presentations, quizzes, completion certificates)
- Fleet Management (vehicles, assignments, documents, travel orders PN-3/PN-4)
- Fire protection & Evacuation (Premium/Enterprise gated)
- Address book, authorized companies, doctors, examiners
- Excel bulk import with fuzzy matching
- PDF ↔ Word converter
- AI-powered BiH safety news
- Settings (profile, company, notifications, calendar, display, Firebase sync)
- Admin panel, setup wizard, ISZNR inspector documents
- Penetration testing tool

---

## 5. API ENDPOINTS (18 routes)

| Endpoint | Description |
|----------|-------------|
| `/api/zia` | Zia AI assistant — receives message, returns response with Function Calling |
| `/api/news` | AI news about safety laws — Gemini generates daily BiH news |
| `/api/send-email` | Send emails via Resend API (questionnaires, reminders) |
| `/api/notify-expiry` | Daily automated expiry check + email digest |
| `/api/notif-settings` | Get/save notification settings |
| `/api/risk-measures` | AI suggested safety measures for risk items, supports document attachment |
| `/api/generate-risk-questionnaire` | AI generates 7-section questionnaire for a workplace |
| `/api/analyze-questionnaire` | AI analyzes questionnaire responses → generates risk items with V/P |
| `/api/analyze-risk-docs` | AI multi-document analysis (measurement protocols, records) → process description + hazards |
| `/api/generate-opis-procesa` | AI generates Technical-technological process description |
| `/api/generate-sistematizacija` | AI generates job systematization (FBiH Art. 118) |
| `/api/generate-quiz` | AI generates fire protection/safety tests |
| `/api/generate-from-document` | AI parses existing tests from Word/PDF into drag-and-drop format |
| `/api/parse-presentation` | AI parses presentations for training |
| `/api/parse-sistematizacija` | AI parses uploaded systematization documents |
| `/api/pdf-parse` | Parses PDF files for analysis |
| `/api/pdf-to-word` | Converts PDF to Word (locally or via Railway service) |
| `/api/debug-pdf` | Debug endpoint for PDF parsing |

---

## 6. COMPONENTS (`src/components/`)

| Component | Description |
|-----------|-------------|
| `Header.js` (47KB) | "Floating Three-Island" header — 3 floating islands: nav, global search (Ctrl+K), profile/notifications. Mobile: compact 48px bar with ←→, company chip, bell |
| `Sidebar.js` (37KB) | Desktop: classic left sidebar with accordion groups. Mobile: bottom-sheet drawer (88vh) sliding up from bottom |
| `AIAssistant.js` (98KB) | Zia AI assistant — draggable FAB bubble, Function Calling (navigate, search_workers, assign_ppe), proactive morning greeting |
| `WorkerProfileModal.js` (33KB) | Worker profile — quick actions (new exam/cert/injury), data columns |
| `EmailDispatchModal.js` (26KB) | Send questionnaires/trainings to workers — worker selection, manual email, deadline, progress bar |
| `SurveyCreator.js` (38KB) | Drag-and-drop questionnaire editor with auto-grading |
| `PublicQuestionnaireForm.js` (27KB) | Form renderer on public route `/q/[token]` — no login required |
| `QuestionnaireResults.js` (20KB) | Results dashboard — stats, sessions, individual responses |
| `ReminderModal.js` (17KB) | Reminder for uncompleted questionnaires — shows who hasn't finished, sends batch email |
| `HelpTip.js` (5KB) | Clickable [i] tooltip with legal explanations beside form fields |
| `UndoBar.js` (6KB) | Undo bar after deleting records |

### Mobile components (`src/components/mobile/`):
| Component | Description |
|-----------|-------------|
| `MobileBottomNav.js` | Fixed bottom nav (56px) — 📊 Home, 👷 Workers, 📜 Certs, 🔍 Search, ☰ Menu |
| `MobileSearchOverlay.js` | Full-screen search — searches workers, equipment, workplaces |
| `PullToRefresh.js` | Pull-down-to-refresh gesture with animated spinner |
| `OfflineIndicator.js` | Red/green banner for internet status |
| `LongPressMenu.js` | Long-press contextual popup on table rows (0.5s) |
| `SwipeRow.js` | Swipe-left to reveal actions (iOS style) |
| `CollapsibleWidget.js` | Collapsible/expandable dashboard widgets with animation |

---

## 7. DESIGN & UI/UX RULES (STRICT!)

### 7.1 Dark/Light Mode
- **ALL colors must use CSS variables:** `var(--primary)`, `var(--bg-card)`, `var(--text-primary)`, `var(--danger)`, etc.
- **ABSOLUTELY FORBIDDEN to hardcode HEX colors** in React components!
- For subtle backgrounds: `rgba(var(--primary-rgb), 0.15)` — "glassmorphism" effect
- Dark mode toggled via `[data-theme="dark"]` selector in `globals.css`

### 7.2 Standardized Table Patterns
- **Checkbox column** at start of every table for multi-selection
- **"Akcije ▼" dropdown** instead of inline buttons — auto-flips based on screen space
- **"Grupne akcije" bar** for bulk delete/print
- **`useSortedList` hook** for column sorting with visual indicators
- **Clickable rows** — click anywhere opens modal/details
- **`e.stopPropagation()`** on interactive elements to prevent modal triggering

### 7.3 Banned patterns:
- **`window.alert()` and `window.confirm()`** → replaced with custom `useDialog()` hook
- **`<input type="time">`** → replaced with dual `<select>` (hours 00-23 + minutes 00/15/30/45)
- **Hardcoded colors** → must use CSS variables
- **grep/ripgrep terminal searches** → use `view_file` only

---

## 8. RISK ASSESSMENT — MOST COMPLEX MODULE

5-tab wizard following FBiH Pravilnik structure:
1. **General data** — company info, authorized org, revision
2. **Process description** — AI generation from company data, multi-doc AI analysis
3. **Risk assessment** — interactive 5×5 matrix (1-25), CRUD risk items, AI measures, hazard catalog import, sistematizacija context panel
4. **Measures** — filtered view of items with R ≥ 6, inline editing
5. **Conclusion** — before/after grades, AI conclusion, PDF/DOCX export

### Risk scoring formula:
```
Initial risk    R₀ = V₀ × P₀  (before measures)
Residual risk   R₁ = V₁ × P₁  (after measures)
Overall grade   = Σ(Ri) / N    (average of all items)
```

### Integrations:
- Auto-sync to Employer Documents (2-year expiry)
- Measures with deadlines appear as 🛡️ calendar events
- Overdue measures trigger dashboard alerts

---

## 9. FLEET MANAGEMENT

FBiH-compliant vehicle management:
- Vehicle grid with traffic-light semaphore (Registration / Technical / Insurance)
- Assignment history with start/end dates and mileage
- Firebase Storage document uploads (migrated from base64)
- PN-3/PN-4 travel orders per FBiH Transport Law
- Modal-over-modal architecture (z-index 12000)
- Reminder system with configurable thresholds (7/14/30/60 days)
- Sidebar: 4 sub-sections (Popis vozila, Zaduženja, Dokumentacija, Putni nalozi)

---

## 10. ZIA AI ASSISTANT

- **Draggable FAB** with edge snapping, position persistence
- **Function Calling** (Gemini): navigate, search_workers, get_expiring_certs, assign_ppe, dispatch_questionnaire
- **Proactive morning greeting** — scans for expiring items on login
- **Dynamic contextual chips** based on live data
- **Mobile:** full-screen chat overlay. Desktop: floating window

---

## 11. EMAIL SYSTEM EVOLUTION

1. Nodemailer/SMTP → removed (needed server)
2. EmailJS (client-side) → removed (limited)
3. **Resend API (server-side)** → final implementation via `/api/send-email`
4. **Daily automated notifications** via `/api/notify-expiry` + GCP Cloud Scheduler

---

## 12. MOBILE OPTIMIZATION

- Bottom nav bar (56px) with 5 tabs
- Bottom-sheet drawer sidebar (88vh)
- Compact header (48px)
- Pull-to-Refresh with animated spinner
- Long Press Menu (0.5s) on worker rows
- Biometric Login (WebAuthn) — fingerprint/face enrollment
- Offline Indicator (red/green banner)
- Toast notifications (`window.eznrToast()`)
- Collapsible dashboard widgets with state persistence
- SwipeRow component (built, pending integration)

---

## 13. LEGAL COMPLIANCE (FBiH)

- **Article 40 ZNR (Night Work):** Auto-detects 22:00-06:00 shifts → mandatory medical exam banner
- **Article 118 ZoR (Systematization):** 7 legally required fields in job positions
- **Articles 34, 48, 49 (ZOS):** Worker safety certification without expiry date, invalidated on workplace change
- **FBiH Transport Law:** PN-3/PN-4 travel order format compliance
- **24-hour European time format** enforced via custom select components

---

## 14. SUBSCRIPTION TIERS

- `useSubscription` hook checks `subscriptionTier` on company
- Premium modules show 🔒 in sidebar for BASIC users
- **Pricing:** €50/month base (50 workers) + €1.50/extra worker
- **Enterprise add-ons:** Multi-Company (+199 BAM), Digital Signatures (+99 BAM)

---

## 15. BUGS FIXED (CHRONOLOGICAL)

1. injuries/page.js crash — undefined state handlers for group actions
2. injury-list/page.js crash — 6 references to undefined `records` variable
3. Settings blank page — URL init without fallback
4. Napomena persistence bug in risk assessment auto-sync
5. Fleet sub-tab crashes — missing useRef hooks
6. Fleet document data bindings mismatch
7. Zia TDZ crash — sendMessageInternal accessed before definition
8. Calendar timezone mismatch — T00:00:00Z suffix breaking date matching
9. Duplicate injury modules merged into one
10. Workers sort blank dates pushed to bottom
11. Native calendar inputs white in dark mode
12. Mobile header overflow with too many buttons

---

## 16. PENDING TASKS

- [ ] Complete Firebase Sync testing with real data
- [ ] Deploy firestore.rules to Firebase Console
- [ ] Implement billing system (Stripe/Paddle)
- [ ] Feature gating by subscription tier
- [ ] ISZNR signing workflow
- [ ] Remove old EmailJS env vars from Vercel
- [ ] SwipeRow integration into tables
- [ ] Global audit of remaining native time inputs
- [ ] Auto-sync on save (instead of manual Firebase Sync button)
- [ ] GDPR/data retention policy

---

## 17. RULES FOR THE NEW AI AGENT (MANDATORY!)

1. **DO NOT USE grep/ripgrep searches!** Use `view_file` exclusively for code navigation.
2. **DO NOT ASK UNNECESSARY QUESTIONS.** You get an order — find the file — implement — deploy.
3. **MINIMIZE FILE OPERATIONS.** Use `multi_replace_file_content` for multiple changes in one file.
4. **RESPECT CSS VARIABLES.** Never hardcode colors.
5. **RESPECT 24H FORMAT.** Never use native `<input type="time">`.
6. **RESPECT DARK MODE.** Test visually in both modes.
7. **BE ASSERTIVE.** The user expects military-grade execution without apologies.

### WHEN YOU READ THIS IN A NEW CHAT, RESPOND WITH:
*"Full sync completed. I've loaded the architecture (Firestore Sync, WebAuthn, Resend, Vercel), I understand 24-hour FBiH night shift rules and the ban on native time inputs, I've accepted all Dark Mode CSS variables and know about the Floating Islands navbar. I don't use grep, I don't ask unnecessary questions, I write fast changes. Fire the task."*
