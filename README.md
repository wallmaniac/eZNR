# eZNR — Elektronička zaštita na radu

**eZNR** je produkcijski sustav za digitalno upravljanje zaštitom na radu (ZNR), zaštitom od požara (ZOP) i praćenjem zdravstvene sposobnosti zaposlenika. Sustav je u potpunosti usklađen sa zakonskom regulativom **Bosne i Hercegovine** i **Republike Hrvatske** te se koristi kao zamjena za papirnate registratore i Excel evidencije u poduzećima obje države.

Aplikacija je dostupna na domeni **[zastitanaradu.ba](https://zastitanaradu.ba)**.

---

## 🎯 Svrha i poslovni model

### Problem koji rješavamo
Stručnjaci za zaštitu na radu u regiji i danas vode evidencije ručno — kroz papirnate registratore, nepregledne Excel tablice i fizičke fascikle. Posljedice:
- Propušteni rokovi za periodičke liječničke preglede, ispitivanja opreme i obnovu uvjerenja o osposobljenosti.
- Zakonske kazne pri inspekcijskom nadzoru (kazne u BiH kreću se do 20.000 KM po prekršaju).
- Višesatni administrativni poslovi koji se mogu automatizirati.

### Naše rješenje
eZNR centralizira sve podatke o zaposlenicima, opremi, uvjerenjima, vozilima, protupožarnoj zaštiti i dokumentaciji u jedinstveni digitalni sustav. Sustav automatski prati rokove, šalje upozorenja, generira zakonski usklađene dokumente i omogućuje AI-potpomognutu analizu radnih mjesta.

### Poslovni model: B2B prodaja s onboardingom
U prvoj godini poslovanja, eZNR se ne plasira kao SaaS samoposluživanje, već kroz **izravnu B2B prodaju** tvrtkama uz personalizirani onboarding:

1. **Akvizicija klijenta**: Kontaktiranje poduzeća koja imaju obvezu zaštite na radu (svako poduzeće s jednim ili više zaposlenika).
2. **Data entry i priprema**: Klijentu se isporučuje standardizirani **Excel template** (9 sheet-ova: Organizacijske jedinice, Radna mjesta, Radnici, Uvjerenja, OZO, Oprema, Ljekarski pregledi, Vozila, PP aparati, Hidranti) koji klijent ispunjava postojećim podacima.
3. **Import i postavljanje**: Ispunjeni Excel se učitava u sustav putem modula za import koji automatski parsira podatke, provodi fuzzy matching radnika po JMBG-u ili imenu, povezuje relacijske zapise (radnik → radno mjesto → organizacijska jedinica) i kreira kompletnu bazu tvrtke.
4. **Aktivacija i edukacija**: Tvrtki se dodjeljuje korisnički račun, konfigurira se organizacijska struktura, i provodi kratka edukacija za korištenje sustava.

---

## 🏗️ Tehnička arhitektura

### Tehnološki stack

| Sloj | Tehnologija | Detalj |
|:---|:---|:---|
| **Framework** | Next.js 16.1.6 (App Router) | React 19, JavaScript (bez TypeScripta) |
| **Stilizacija** | Vanilla CSS + CSS varijable | Potpuna Dark/Light mode podrška, bez Tailwinda ili Bootstrapa |
| **Primarna pohrana** | localStorage (offline-first) | Svi CRUD-ovi putem `dataStore.js`, latencija 0ms, prefiks `eznr_` |
| **Cloud sinkronizacija** | Firebase Firestore | Backup, cross-device pristup, company-scoped izolacija podataka |
| **Pohrana datoteka** | Firebase Storage | Skenovi dokumenata, slike, dokumentacija vozila |
| **Autentifikacija** | Firebase Auth + WebAuthn | Email/lozinka + biometrijska prijava (otisak prsta / lice) |
| **AI motor** | Google Gemini (1.5/2.0 Flash) | 18 API ruta za AI funkcionalnosti |
| **E-pošta** | Resend API | `noreply@mail.zastitanaradu.ba`, automatizirani dnevni digest |
| **PDF konverzija** | Python `pdf2docx` mikroservis | Railway.app, poziva se iz Next.js API ruta |
| **PWA** | `@ducanh2912/next-pwa` | Service worker, offline fallback stranica, instalacija na uređaj |
| **Hosting** | Vercel | CI/CD s GitHub `main` grane, Vercel Cron za dnevne notifikacije |
| **Domena** | zastitanaradu.ba | Custom domena na Vercelu |

### Hibridna pohrana podataka (Dual Storage)

Sustav koristi **offline-first** hibridni model:

- **localStorage (primarni sloj)**: Sve operacije čitanja i pisanja rade instantno u pregledniku putem centraliziranog `dataStore.js` modula. To osigurava rad bez čekanja i djelomični offline način rada.
- **Firebase Firestore (sinkronizacijski sloj)**: Podaci se repliciraju u oblak putem `firebaseSync.js` modula za trajnu pohranu i pristup s drugih uređaja. Podaci su grupirani po `companyId` identifikatoru (multi-tenancy izolacija).
- **Izuzetak**: Sesije upitnika i odgovori radnika pohranjuju se **isključivo u Firestore** jer im radnici pristupaju putem javnih tokeniziranih linkova bez potrebe za prijavom.

### Multi-tenancy i sigurnost

- Podaci su strogo segmentirani po `companyId`. Svaki upit filtrira prema aktivnoj tvrtki.
- **Firestore Security Rules** štite bazu: `belongsToCompany()` funkcija provjerava pripada li korisnik tvrtki čijim podacima pristupa.
- Uloge: **SuperAdmin** (pristup svim tvrtkama), **Admin** (upravljanje jednom ili više tvrtki), **Safety Officer** (samo dodijeljene tvrtke).
- Integrirani penetracijski test modul (`/dashboard/pen-test`) koji simulira neovlašteni pristup i potvrđuje `permission-denied` na razini Firestore-a.

### Dual-Jurisdiction pravni motor

Sustav dinamički prilagođava zakonske reference ovisno o državi tvrtke (BA ili HR) putem centraliziranog `lawConfig.js` modula:

- **Zakoni**: ZNR FBiH (79/20) ↔ ZNR HR (NN 71/14), Zakon o radu FBiH ↔ ZoR HR, Zakon o ZOP FBiH ↔ ZOP HR.
- **Pravilnici**: 5 pravilnika za BiH + 7 za Hrvatsku (OZO, procjena rizika, ljekarski pregledi, prijave povreda, osposobljavanje...).
- **Institucije**: FUZIP, DIRH, HZZZSR, Sl. novine FBiH, Narodne novine — automatski linkovi ovisno o jurisdikciji.
- **Članci zakona**: Koriste se u HelpTip tooltipovima, print šablonama i AI promptovima (npr. čl. 44 ZNR FBiH za ljekarski noćni rad).

---

## 📦 Implementirani moduli (68+ stranica)

### Jezgra sustava
- **Dashboard**: Agregirane statistike, interaktivni kalendar s automatskim eventima (isteci uvjerenja, servisi, ljekarski pregledi, mjere rizika), notifikacijski centar s razinama ozbiljnosti (urgent/info/critical), klikabilne stat kartice s deep-linkingom.
- **Radnici (Workers)**: CRUD evidencija zaposlenika, izračun staža i životne dobi, accordion profil s uvjerenjima/OZO/ljekarskim/posebnim uvjetima, upload fotografije, bulk selekcija, brze akcije (novi pregled, uvjerenje, povreda).
- **Organizacijska struktura**: Organizacijske jedinice, organizacijske grupe, radna mjesta s definiranim smjenama.

### Uvjerenja i osposobljavanje
- **Uvjerenja radnika**: Praćenje valjanosti s tri razine statusa (Važeće / Ističe uskoro / Isteklo), gumb za brzu obnovu ("Obnovi" duplicira stari zapis), baza ispitivača.
- **Tipovi uvjerenja**: Katalog s automatskim izračunom perioda valjanosti.
- **ZOS/ZOP print šablone**: A4 formalni dokumenti s komisijom, potpisima, zakonskim referencama ovisno o jurisdikciji.

### Oprema i pregledi
- **Radna oprema i strojevi**: Evidencija s periodičkim pregledima, servisnim intervalima i statusima.
- **Tipovi opreme, Pregledi opreme, Servisni zapisi**: Kompletni CRUD s kalendarskim eventima.
- **OZO (Osobna zaštitna oprema)**: Katalog opreme, evidencija zaduživanja i razduživanja po radniku, praćenje količina.

### Zdravlje i sigurnost
- **Ljekarski pregledi**: Praćenje periodičkih, prethodnih i izvanrednih pregleda s rezultatima.
- **Uputnice RA-1**: Uputnice za ljekarske preglede.
- **Povrede na radu**: Prijava i evidencija povreda, godišnji izvještaj povreda.
- **Obrasci RO-1, RO-2, OIR-1**: Zakonski propisani obrasci za prijavu povreda i profesionalnih oboljenja.
- **Noćni rad**: Evidencija noćnog rada s automatskom detekcijom (22:00–06:00) i crvenim zakonskim upozorenjem u profilu radnika.
- **Registar profesionalnih bolesti**: Katalog bolesti.

### Dokumentacija i arhiva
- **Dokumenti poslodavca**: Akti, pravilnici, ugovori s datumima isteka i upload datoteka.
- **Digitalna arhiva**: Centralna arhiva svih dokumenata.
- **Zapisnici, Zahtjevnice**: Interni dokumenti.

### Vozni park (Fleet Management)
- **Popis vozila**: Grid sa trodijelnim semaforom (registracija / tehnički / osiguranje).
- **Zaduženja vozila**: Globalni prikaz s historijskim praćenjem kilometraže.
- **Dokumentacija vozila**: Firebase Storage upload.
- **Putni nalozi**: PN-3 (teretna) / PN-4 (putnička) prema Zakonu o cestovnom prijevozu FBiH, s print layoutom.

### Zaštita od požara
- **PP Aparati (vatrogasni aparati)**: Evidencija s serijskim brojevima, lokacijama, servisnim datumima.
- **Hidranti**: Evidencija s pregledima i rokovima.
- **Zaštita od požara i Evakuacija**: Planovi evakuacije, periodičke vježbe (Premium/Enterprise moduli).

### Procjena rizika — najsloženiji modul
- **5×5 interaktivna matrica rizika** s klikabilnim ćelijama i bubble brojevima.
- **CRUD stavki rizika**: Radno mjesto, opasnost, početni rizik (V₀×P₀), rezidualni rizik (V₁×P₁), mjere, odgovorna osoba, rok.
- **AI prijedlog mjera**: Poziva `/api/risk-measures` s opcijom prilaganja dokumenta.
- **AI analiza dokumenata**: Multi-document upload (PDF/Word) → AI čita mjerne protokole i zapisnike.
- **Kontekst panel**: Prikazuje OZO, opremu i posebne uvjete iz sistematizacije za odabrano radno mjesto.
- **PDF i Word eksport**: Kompletan "Akt o procjeni rizika" s cover stranicom, ocjenama i potpisnim linijama.
- **Auto-sync u Employer Docs**: Automatski kreira/ažurira dokument s 2-godišnjim rokom.

### Upitnici i obuke
- **Drag-and-drop graditelj upitnika** s automatskim ocjenjivanjem (prolaz/pad).
- **Email dispatch**: Slanje putem Resend API-ja s unikatnim token linkovima.
- **Javna forma** (`/q/[token]`): Radnik ispunjava na mobitelu bez prijave u sustav.
- **Podsjetnici**: Batch slanje radnicima koji nisu završili.
- **Rezultati**: Dashboard s statistikama, sesijama, individualnim odgovorima, postotkom ispunjenosti.
- **Obuke** (`/t/[token]`): Prezentacija → kviz → A4 landscape certifikat o završenoj obuci.
- **AI generiranje upitnika**: Za specifično radno mjesto, 7-sekcijski upitnik.

### Sistematizacija radnih mjesta
- **7 zakonski obveznih polja** po čl. 118. Zakona o radu FBiH: naziv posla, kategorija RM, složenost, probni rad, odgovornosti, potrebne obuke, pravni osnov.
- **AI generiranje**: Iz opisa firme generira kompletnu sistematizaciju.
- **AI parsiranje**: Upload postojećih dokumenata sistematizacije.

### Zia — AI Asistent
- **Draggable FAB** s edge snappingom i perzistencijom pozicije.
- **Function Calling (Gemini)**: `navigate_to`, `search_workers`, `get_expiring_certs`, `get_sick_leave_workers`, `assign_ppe`, `dispatch_questionnaire`.
- **Pristup živim podacima**: Zia u realnom vremenu čita radnike, uvjerenja, OZO, organizacijsku strukturu iz localStorage-a.
- **Proaktivni jutarnji brifing**: Skenira bazu pri prijavi i generira sažetak kritičnih isteka.
- **Dinamički kontekstualni chipovi**: Pametni prijedlozi bazirani na live podacima (npr. "📜 3 uvjerenja ističu ovaj mjesec").

### Ostali moduli
- **Import podataka**: Excel import s 9+ sheet-ova, fuzzy matching radnika po JMBG/imenu, statistike povezivanja.
- **Eksport podataka**: Excel eksport svih podataka aktivne tvrtke.
- **AI vijesti**: Automatski generirane vijesti o ZNR zakonima u BiH i HR.
- **ZNR zakonodavstvo**: Baza zakona i pravilnika s linkovima na službene glasnike.
- **PDF ↔ Word konverter**: Integriran Python mikroservis za konverziju dokumenata.
- **Adresar**: Kontakti inspektora, doktora medicine rada, institucija.
- **Ovlaštene organizacije, Doktori, Ispitivači**: Registri.
- **ISZNR**: Inspektorski dokumenti (6 pod-modula).
- **Admin panel**: Upravljanje korisnicima, dodjeljivanje tvrtki, role.
- **Activity Log**: Svaka akcija se logira (tko, što, kada) s kategorijama i ikonama.

---

## ⚙️ Tehničke specifikacije

### 18 API ruta

| Endpoint | Opis |
|:---|:---|
| `/api/zia` | Zia AI asistent s Function Calling podrškom |
| `/api/news` | AI generirane ZNR vijesti za BiH/HR |
| `/api/send-email` | Slanje e-pošte putem Resend API-ja |
| `/api/notify-expiry` | Dnevni automatski pregled isteklih rokova + email digest (Vercel Cron, 07:00 CET) |
| `/api/notif-settings` | Pohrana i dohvat notifikacijskih postavki |
| `/api/risk-measures` | AI prijedlog sigurnosnih mjera s opcijom prilaganja dokumenta |
| `/api/generate-risk-questionnaire` | AI generira 7-sekcijski upitnik za radno mjesto |
| `/api/analyze-questionnaire` | AI analizira odgovore → generira stavke rizika |
| `/api/analyze-risk-docs` | AI multi-document analiza mjernih protokola |
| `/api/generate-opis-procesa` | AI generira opis tehničko-tehnološkog procesa |
| `/api/generate-sistematizacija` | AI generira sistematizaciju radnih mjesta |
| `/api/generate-quiz` | AI generira ZOP/ZNR testove |
| `/api/generate-from-document` | AI parsira postojeće testove iz Word/PDF |
| `/api/parse-presentation` | AI parsira prezentacije za obuku |
| `/api/parse-sistematizacija` | AI parsira upload-ane dokumente sistematizacije |
| `/api/pdf-parse` | Parsira PDF datoteke za analizu |
| `/api/pdf-to-word` | Konvertira PDF u Word |
| `/api/firebase-proxy` | Proxy za Firebase operacije |

### Ključne komponente

| Komponenta | Veličina | Opis |
|:---|:---|:---|
| `AIAssistant.js` | 159 KB | Zia AI asistent — draggable FAB, Function Calling, jutarnji brifing, dinamički chipovi |
| `Header.js` | 65 KB | Floating Three-Island header — navigacija, globalni search (Ctrl+K), profil, notifikacije, jezični switch (BS/EN) |
| `Sidebar.js` | 62 KB | Desktop accordion sidebar / Mobile bottom-sheet drawer (88vh) |
| `WorkerProfileModal.js` | 58 KB | Profil radnika — brze akcije, accordion sekcije, statusni indikatori |
| `SurveyCreator.js` | 38 KB | Drag-and-drop editor upitnika s auto-ocjenjivanjem |
| `Dashboard page.js` | 147 KB | Glavni dashboard — kalendar, statistike, tablica radnika, upozorenja |
| `Import page.js` | 61 KB | Excel import modul s 9 sheet-ova, fuzzy matching, preview, statistike |

### Mobilna optimizacija
- **Bottom nav bar** (56px) s 5 tabova: Home, Radnici, Uvjerenja, Pretraga, Menu.
- **Bottom-sheet drawer**: Sidebar izlazi odozdo (88vh) s drag handle-om.
- **Pull-to-Refresh**: Custom animirani spinner s toast porukom "Podaci osvježeni".
- **Long Press Menu** (0.5s): Kontekstualni popup na redovima tablice.
- **Offline Indicator**: Crveni/zeleni banner za status internet konekcije.
- **Collapsible widgeti**: Sklopive dashboard sekcije s perzistiranim stanjem.
- **Biometrijska prijava (WebAuthn)**: Otisak prsta / prepoznavanje lica (samo HTTPS).

### Branding Engine
Svaka tvrtka-klijent može prilagoditi vizualni identitet sustava:
- **PDF Branding**: Accent boja, vodeni žig (9 pozicija, konfigurabilan sadržaj i opacity), pozicija loga, formatiranje zaglavlja.
- **UI Branding**: Primary boja (10 preset-a + custom), boja sidebar-a (8 preset-a + custom), logo tvrtke u sidebar-u.
- **Automatsko deriviranje**: Iz jedne boje sustav generira light/dark/glow varijante putem HSL manipulacije.

### Generiranje dokumenata
- **PDF generiranje**: Procjena rizika, putni nalozi, certifikati obuka, godišnji izvještaji povreda, ZOS/ZOP obrasci.
- **Word/DOCX generiranje**: Procjena rizika (kompletni akt), konverzija PDF → Word.
- **Excel generiranje**: Template za import, eksport svih podataka tvrtke.
- **Obrasci**: RO-1, RO-2, OIR-1, RA-1, PN-3, PN-4 — zakonski propisani formati.

---

## 🚀 Pokretanje projekta lokalno

### Preduvjeti
- **Node.js** ≥ 22.0.0
- Firebase projekt (Auth, Firestore, Storage)
- Google Gemini API ključ
- Resend API ključ

### Instalacija
```bash
git clone https://github.com/wallmaniac/eZNR.git
cd eZNR
npm install
```

### Konfiguracija
Kreirajte `.env.local` datoteku:
```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# AI
NEXT_PUBLIC_GEMINI_API_KEY=...

# Email
RESEND_API_KEY=...
RESEND_FROM_EMAIL=noreply@mail.zastitanaradu.ba

# Firebase Admin (server-side)
FIREBASE_SERVICE_ACCOUNT=...
```

### Pokretanje
```bash
npm run dev
```
Otvorite [http://localhost:3000](http://localhost:3000).

---

## 🔄 Onboarding tok za nove klijente

```
1. Preuzimanje Excel template-a (9 sheet-ova s uputama i primjerima)
         ↓
2. Klijent ispunjava template postojećim podacima
         ↓
3. Upload ispunjenog Excel-a u /dashboard/import
         ↓
4. Sustav parsira podatke (fuzzy matching po JMBG/imenu)
         ↓
5. Prikaz preview-a s brojem zapisa po kategoriji
         ↓
6. Potvrda importa → automatsko kreiranje svih zapisa
         ↓
7. Prikaz statistike (kreirano/preskočeno/povezano po modulu)
         ↓
8. Klijent je spreman za korištenje sustava
```

### Excel template sadrži 9 sheet-ova:
1. **OrgJedinice** — organizacijske jedinice (odjeli, sektori)
2. **RadnaMjesta** — radna mjesta s vezom na organizacijske jedinice
3. **Radnici** — 25 polja (ime, prezime, JMBG, radno mjesto, staž, kontakt...)
4. **Uvjerenja** — uvjerenja o osposobljenosti s datumima valjanosti
5. **OZO** — zadužena osobna zaštitna oprema
6. **Oprema** — radna oprema i strojevi s periodičkim pregledima
7. **Ljekarski** — liječnički pregledi s rezultatima
8. **Vozila** — vozni park s rokovima registracije/tehničkog/osiguranja
9. **PPAparati / Hidranti** — protupožarna oprema

---

## 📈 Što je još u razvoju

Aplikacija je funkcionalno kompletna za svakodnevno korištenje. Sljedeće stavke su u planu za nadogradnju:

- [ ] Implementacija billing sustava (Stripe/Paddle) za prelazak na SaaS model nakon prve godine
- [ ] Feature gating po subscription tier-u (Basic/Premium/Enterprise)
- [ ] Auto-sync pri svakom spremanju (umjesto ručnog Firebase Sync gumba)
- [ ] ISZNR signing workflow (digitalni potpis inspektorskih dokumenata)
- [ ] GDPR / data retention politika
- [ ] Integracija SwipeRow geste u sve tablice
