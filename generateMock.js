const XLSX = require('xlsx');

const OU_COLS = ['naziv', 'opis'];
const WP_COLS = ['naziv', 'opis'];
const WORKER_COLS = [
    'ime', 'prezime', 'imeRoditelja', 'jmbg', 'oib', 'spol',
    'datumRodenja', 'miestoRodenja', 'datumZaposlenja', 'datumOdlaska',
    'stazDoDolaska', 'koef', 'radnoMjesto', 'orgJedinica', 'lokacija',
    'evidencijskiBroj', 'telefonTvrtki', 'mobitel', 'email', 'ulica',
    'kucniBroj', 'mjesto', 'napomena', 'aktivan', 'vanjskiSuradnik'
];
const CERT_COLS = [
    'radnik_ime', 'radnik_prezime', 'radnik_jmbg',
    'naziv', 'oznaka', 'tipUvjerenja', 'datum', 'vrijediDo', 'sposobnost', 'ogranicenje'
];
const PPE_COLS = [
    'radnik_ime', 'radnik_prezime', 'radnik_jmbg',
    'naziv', 'datumZaduzenja', 'datumRazduzenja', 'kolicina'
];
const EQUIP_COLS = [
    'naziv', 'vrsta', 'tip', 'tvBroj', 'invBroj',
    'proizvodjac', 'godinaProizvodnje', 'posljednji', 'iduci', 'status'
];
const MEDEXAM_COLS = [
    'radnik_ime', 'radnik_prezime', 'radnik_jmbg',
    'tipPregleda', 'datum', 'vrijediDo', 'rezultat', 'napomena'
];
const VEH_COLS = [
    'registracija', 'marka', 'model', 'godinaProizvodnje', 'tip', 'vin', 'boja',
    'datumRegistracije', 'registracijaIstice', 'datumTehnickogPregleda', 'tehnickiIstice',
    'osiguranjeIstice', 'vatrogasniAparatDatum', 'prvaPomocIstice',
    'radnik_ime', 'radnik_prezime', 'radnik_jmbg', 'status', 'napomena'
];
const EXT_COLS = [
    'serijskiBroj', 'tip', 'tezina', 'lokacija',
    'datumNabavke', 'zadnjiServis', 'sljedeciServis',
    'odgovornaOsoba', 'status', 'napomena'
];
const HYD_COLS = [
    'oznaka', 'tip', 'lokacija',
    'datumZadnjegPregleda', 'sljedeciPregled',
    'status', 'napomena'
];

function rInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(n) {
    return n < 10 ? '0'+n : n;
}

function rDate(startYear, endYear) {
    const y = rInt(startYear, endYear);
    const m = pad(rInt(1, 12));
    const d = pad(rInt(1, 28));
    return `${y}-${m}-${d}`;
}

const firstNames = ['Amir', 'Denis', 'Amar', 'Tarik', 'Haris', 'Kenan', 'Aldin', 'Edin', 'Adnan', 'Semir', 'Admir', 'Enes', 'Jusuf', 'Armin', 'Alen', 'Adis', 'Vedad', 'Emir', 'Ermin', 'Damir'];
const lastNames = ['Hodžić', 'Spahić', 'Kovačević', 'Avdić', 'Omerović', 'Delić', 'Halilović', 'Bašić', 'Savić', 'Babić', 'Jahić', 'Hasanović', 'Musić', 'Sarić'];

const orgUnits = ['Produkcija', 'Logistika', 'Prodaja', 'Uprava', 'Održavanje', 'Skladište', 'Nabava', 'IT', 'Ljudski resursi', 'Marketing'];
const workplaces = ['Radnik u pogonu', 'Magacioner', 'Vozač', 'Komercijalista', 'Menadžer', 'Inženjer', 'Tehničar', 'Monter', 'Čistač', 'Direktor'];

const wb = XLSX.utils.book_new();

// 1. Org Jedinice
const ouRows = [OU_COLS];
orgUnits.forEach(ou => ouRows.push([ou, `Opis za ${ou}`]));
const wsOU = XLSX.utils.aoa_to_sheet(ouRows);
XLSX.utils.book_append_sheet(wb, wsOU, 'OrgJedinice');

// 2. Radna Mjesta
const wpRows = [WP_COLS];
workplaces.forEach(wp => wpRows.push([wp, `Opis radnog mjesta: ${wp}`]));
const wsWP = XLSX.utils.aoa_to_sheet(wpRows);
XLSX.utils.book_append_sheet(wb, wsWP, 'RadnaMjesta');

// 3. Workers (200)
const workers = [];
const workerRows = [WORKER_COLS];
for (let i = 1; i <= 200; i++) {
    const ime = firstNames[rInt(0, firstNames.length - 1)];
    const prezime = lastNames[rInt(0, lastNames.length - 1)];
    const jmbg = `1234567${pad(rInt(0, 99))}${pad(rInt(0, 99))}${pad(rInt(0, 9))}`;
    
    workers.push({ ime, prezime, jmbg });
    
    workerRows.push([
        ime, prezime, 'Otac', jmbg, '', 'M',
        rDate(1970, 2000), 'Sarajevo', rDate(2015, 2023), '',
        '', '1.0', workplaces[rInt(0, workplaces.length - 1)], orgUnits[rInt(0, orgUnits.length - 1)], 'Lokacija 1',
        `E-${i}`, '+38761123456', '', 'test@firma.ba', 'Ulica',
        `${i}`, 'Sarajevo', '', 'DA', 'NE'
    ]);
}
const wsW = XLSX.utils.aoa_to_sheet(workerRows);
XLSX.utils.book_append_sheet(wb, wsW, 'Radnici');

// 4. Uvjerenja (100)
const certs = ['Osposobljavanje ZNR', 'Protupožarna zaštita', 'Rukovalac viličarom', 'Rad na visini'];
const certRows = [CERT_COLS];
for(let i=0; i<100; i++) {
    const w = workers[rInt(0, workers.length - 1)];
    certRows.push([
        w.ime, w.prezime, w.jmbg,
        certs[rInt(0, certs.length - 1)], `C-${i}`, 'ZNR', rDate(2022, 2023), rDate(2024, 2026), 'Sposoban', ''
    ]);
}
const wsC = XLSX.utils.aoa_to_sheet(certRows);
XLSX.utils.book_append_sheet(wb, wsC, 'Uvjerenja');

// 5. OZO (600)
const ppeItems = ['Kaciga', 'Cipele S3', 'Radno odijelo', 'Zaštitne naočale', 'Rukavice', 'Antifoni', 'Prsluk'];
const ppeRows = [PPE_COLS];
for (let i = 0; i < 600; i++) {
    const w = workers[rInt(0, workers.length - 1)];
    ppeRows.push([
        w.ime, w.prezime, w.jmbg,
        ppeItems[rInt(0, ppeItems.length - 1)], rDate(2023, 2024), '', '1'
    ]);
}
const wsP = XLSX.utils.aoa_to_sheet(ppeRows);
XLSX.utils.book_append_sheet(wb, wsP, 'OZO');

// 6. Oprema (40)
const eqTypes = ['Viličar', 'Dizalica', 'Bager', 'Kamion', 'Presa', 'Tokarski stroj'];
const eqRows = [EQUIP_COLS];
for(let i=1; i<=40; i++) {
    eqRows.push([
        `${eqTypes[rInt(0, eqTypes.length - 1)]} EQ-${i}`, 'Mašina', 'Električna', `TV-${i}`, `INV-${i}`,
        'Proizvođač A', rDate(2010, 2023).substring(0,4), rDate(2023, 2024), rDate(2025, 2026), 'active'
    ]);
}
const wsE = XLSX.utils.aoa_to_sheet(eqRows);
XLSX.utils.book_append_sheet(wb, wsE, 'Oprema');

// 7. Ljekarski (100)
const medRows = [MEDEXAM_COLS];
for(let i=0; i<100; i++) {
    const w = workers[rInt(0, workers.length - 1)];
    medRows.push([
        w.ime, w.prezime, w.jmbg,
        'Periodični', rDate(2023, 2024), rDate(2025, 2026), 'Sposoban', ''
    ]);
}
const wsM = XLSX.utils.aoa_to_sheet(medRows);
XLSX.utils.book_append_sheet(wb, wsM, 'Ljekarski');

// 8. Vozila (30)
const vehRows = [VEH_COLS];
const marke = ['VW', 'Skoda', 'Mercedes', 'MAN', 'Volvo'];
for(let i=1; i<=30; i++) {
    const w = workers[rInt(0, workers.length - 1)];
    vehRows.push([
        `A${pad(rInt(10,99))}-M-1${pad(rInt(10,99))}`, marke[rInt(0, marke.length - 1)], `Model ${i}`, '2020', 'osobno', `VIN12345${i}`, 'Bijela',
        rDate(2020, 2022), rDate(2024, 2025), rDate(2023, 2024), rDate(2024, 2025),
        rDate(2024, 2025), rDate(2024, 2025), rDate(2024, 2025),
        w.ime, w.prezime, w.jmbg, 'aktivan', 'Sluzbeno auto'
    ]);
}
const wsV = XLSX.utils.aoa_to_sheet(vehRows);
XLSX.utils.book_append_sheet(wb, wsV, 'Vozila');

// 9. PP Aparati (100)
const ppRows = [EXT_COLS];
for(let i=1; i<=100; i++) {
    ppRows.push([
        `PP-${pad(rInt(100, 999))}-${i}`, 'prah', '6', `Hala ${rInt(1, 5)}`,
        rDate(2018, 2020), rDate(2023, 2024), rDate(2025, 2026),
        'Osoba O.', 'ispravan', ''
    ]);
}
const wsF = XLSX.utils.aoa_to_sheet(ppRows);
XLSX.utils.book_append_sheet(wb, wsF, 'PPAparati');

// 10. Hidranti (50)
const hydRows = [HYD_COLS];
for(let i=1; i<=50; i++) {
    hydRows.push([
        `H-${pad(i)}`, 'unutarnji', `Sektor ${rInt(1,10)}`,
        rDate(2023, 2024), rDate(2025, 2026), 'ispravan', ''
    ]);
}
const wsH = XLSX.utils.aoa_to_sheet(hydRows);
XLSX.utils.book_append_sheet(wb, wsH, 'Hidranti');

const path = 'C:/Users/zzida/Desktop/znrba/app/public/eZNR_Mass_Mock_Data.xlsx';
XLSX.writeFile(wb, path);
console.log('Successfully generated ' + path);
