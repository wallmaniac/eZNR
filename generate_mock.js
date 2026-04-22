const XLSX = require('xlsx');

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndi(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const IMENA = ['Amir', 'Nermin', 'Sanin', 'Haris', 'Eldin', 'Damir', 'Mirza', 'Dino', 'Adis', 'Semir', 'Lejla', 'Amra', 'Selma', 'Jasmina', 'Emina', 'Medina', 'Nadina', 'Nejra', 'Merima', 'Amela'];
const PREZIMENA = ['Hodžić', 'Kovačević', 'Halilović', 'Marić', 'Delić', 'Klarić', 'Šarić', 'Brkić', 'Jurić', 'Vidović', 'Knežević', 'Kovač', 'Lukić', 'Milić', 'Marković', 'Mehić', 'Alić', 'Babić'];
const OČEVA = ['Hasan', 'Mirsad', 'Muhamed', 'Zoran', 'Miroslav', 'Senad', 'Enes', 'Slobodan', 'Sead', 'Nijaz'];
const GRADOVI = ['Sarajevo', 'Zenica', 'Tuzla', 'Mostar', 'Banja Luka', 'Bihać', 'Travnik', 'Doboj', 'Cazin', 'Prijedor'];

const radnaMjesta = [
    { naziv: 'Zavarivač', opis: 'Spajanje metalnih konstrukcija MIG/MAG postupkom' },
    { naziv: 'Bravar', opis: 'Izrada i obrada metalnih dijelova' },
    { naziv: 'Operater na CNC stroju', opis: 'Upravljanje CNC glodalicom/tokarilicom' },
    { naziv: 'Skladištar', opis: 'Prijem, skladištenje i izdavanje robe' },
    { naziv: 'Vozač viljuškara', opis: 'Manipulacija teretom unutar tvornice' },
    { naziv: 'Komercijalista', opis: 'Prodaja i nabavka' },
    { naziv: 'Računovođa', opis: 'Finansije i računovodstvo' },
    { naziv: 'Direktor', opis: 'Upravljanje tvrtkom' },
];

const orgJedinice = [
    { naziv: 'Proizvodnja', opis: 'Glavni pogon 1' },
    { naziv: 'Skladište', opis: 'Skladište gotovih proizvoda' },
    { naziv: 'Logistika', opis: 'Transport i distribucija' },
    { naziv: 'Uprava', opis: 'Administracija i menadžment' },
];

const opremaList = [];
for(let i=1; i<=50; i++) {
    opremaList.push({
        naziv: `Mašina ${i} Tip ${rnd(['A', 'B', 'C'])}`,
        vrsta: rnd(['Elektro', 'Strojna', 'Hidraulična', 'Pneumatska']),
        tip: rnd(['Prijenosna', 'Stacionarna', 'Viseća']),
        tvBroj: `TV-${rndi(1000, 9999)}`,
        invBroj: `INV-${rndi(10000, 99999)}`,
        proizvodjac: rnd(['Bosch', 'Makita', 'Siemens', 'ABB', 'Caterpillar', 'Hilti']),
        godinaProizvodnje: rndi(2010, 2025).toString(),
        posljednji: `2024-0${rndi(1,9)}-15`,
        iduci: `2025-0${rndi(1,9)}-15`,
        status: rnd(['active', 'active', 'active', 'inactive', 'expired'])
    });
}

const vozilaList = [];
for(let i=1; i<=20; i++) {
    vozilaList.push({
        registracija: `A${rndi(10,99)}-${rnd(['A','E','J','K','M','T'])}-${rndi(100,999)}`,
        marka: rnd(['VW', 'Škoda', 'Mercedes', 'MAN', 'Iveco', 'Renault', 'Peugeot']),
        model: rnd(['Golf', 'Octavia', 'Sprinter', 'TGS', 'Daily', 'Master', 'Boxer']),
        godinaProizvodnje: rndi(2015, 2024).toString(),
        tip: rnd(['osobno', 'teretno', 'kombi', 'kamion']),
        vin: 'WVGZZZ' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        boja: rnd(['Bijela', 'Crna', 'Siva', 'Plava', 'Crvena']),
        datumRegistracije: `2023-0${rndi(1,9)}-10`,
        registracijaIstice: `2024-0${rndi(1,9)}-10`,
        datumTehnickogPregleda: `2023-0${rndi(1,9)}-10`,
        tehnickiIstice: `2024-0${rndi(1,9)}-10`,
        osiguranjeIstice: `2024-0${rndi(1,9)}-10`,
        vatrogasniAparatDatum: `2024-05-15`,
        prvaPomocIstice: `2026-01-01`,
        radnik_ime: '', radnik_prezime: '', radnik_jmbg: '',
        status: 'aktivan', napomena: 'Mock vozilo'
    });
}

const hidrantiList = [
    { oznaka: 'H-01', tip: 'unutarnji', lokacija: 'Hala 1', datumZadnjegPregleda: '2024-01-01', sljedeciPregled: '2025-01-01', status: 'ispravan', napomena: '' },
    { oznaka: 'H-02', tip: 'vanjski', lokacija: 'Skladište', datumZadnjegPregleda: '2024-02-01', sljedeciPregled: '2025-02-01', status: 'ispravan', napomena: '' },
];

const ppAparatiList = [
    { serijskiBroj: 'PP-101', tip: 'prah', tezina: '6', lokacija: 'Uprava ulaz', datumNabavke: '2021-01-01', zadnjiServis: '2024-01-15', sljedeciServis: '2024-07-15', odgovornaOsoba: 'Domar', status: 'ispravan', napomena: '' },
    { serijskiBroj: 'PP-102', tip: 'co2', tezina: '5', lokacija: 'Server soba', datumNabavke: '2022-05-01', zadnjiServis: '2024-02-10', sljedeciServis: '2024-08-10', odgovornaOsoba: 'Domar', status: 'ispravan', napomena: '' },
];


let wb = XLSX.utils.book_new();

// 1. OrgJedinice
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orgJedinice), 'OrgJedinice');
// 2. RadnaMjesta
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(radnaMjesta), 'RadnaMjesta');

// 3. Workers
const workersList = [];
for(let i=1; i<=200; i++) {
    const rm = rnd(radnaMjesta).naziv;
    const isUprava = rm === 'Direktor' || rm === 'Računovođa' || rm === 'Komercijalista';
    const oj = rnd(orgJedinice).naziv; // simplify

    const jmbgPrefix = rndi(1, 31).toString().padStart(2, '0') + rndi(1, 12).toString().padStart(2, '0') + rndi(970, 999).toString().slice(1);
    const jmbg = `${jmbgPrefix}17${rndi(1000, 9999)}`;

    workersList.push({
        ime: rnd(IMENA), prezime: rnd(PREZIMENA), imeRoditelja: rnd(OČEVA),
        jmbg: jmbg, oib: '', spol: rnd(['M', 'Ž']),
        datumRodenja: `19${rndi(70,99)}-0${rndi(1,9)}-15`,
        miestoRodenja: rnd(GRADOVI),
        datumZaposlenja: `20${rndi(10,23)}-0${rndi(1,9)}-01`, datumOdlaska: '',
        stazDoDolaska: `${rndi(0,10)}g${rndi(0,11)}mj`, koef: (1.0 + Math.random()).toFixed(2),
        radnoMjesto: rm, orgJedinica: oj, lokacija: rnd(GRADOVI),
        evidencijskiBroj: `EV-${rndi(1000,9999)}`,
        telefonTvrtki: `033-${rndi(100,999)}-${rndi(100,999)}`, mobitel: `061-${rndi(100,999)}-${rndi(100,999)}`,
        email: `radnik${i}@mock.ba`, ulica: `Ulica ${rndi(1,50)}`, kucniBroj: `${rndi(1,100)}A`,
        mjesto: rnd(GRADOVI), napomena: '', aktivan: 'DA', vanjskiSuradnik: 'NE'
    });
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(workersList), 'Radnici');

// Link Vozila drivers 
vozilaList.forEach(v => {
    const w = rnd(workersList);
    v.radnik_ime = w.ime;
    v.radnik_prezime = w.prezime;
    v.radnik_jmbg = w.jmbg;
});
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vozilaList), 'Vozila');

// 4. Mocks tied to workers
const uvjerenjaList = [];
const ozoList = [];
const ljekarskiList = [];

const certTypes = ['Osposobljavanje iz ZNR', 'Osposobljavanje ZOP', 'Prva pomoć', 'Vozač viljuškara', 'Rukovalac kranom', 'Rad na visini'];
const ozoTypes = ['Radno odijelo (kombinezon)', 'Zaštitne cipele S3', 'Zaštitne rukavice kožne', 'Zaštitni šljem', 'Reflektirajući prsluk', 'Zimska jakna', 'Naočale za zavarivanje', 'Antifoni'];

// 400 certs ~ 2 per worker
for(let w of workersList) {
    // 2 certs per worker
    uvjerenjaList.push({
        radnik_ime: w.ime, radnik_prezime: w.prezime, radnik_jmbg: w.jmbg,
        naziv: rnd(certTypes), oznaka: `CERT-${rndi(1000,9999)}`, tipUvjerenja: 'ZNR',
        datum: `2023-0${rndi(1,9)}-15`, vrijediDo: `2025-0${rndi(1,9)}-15`,
        sposobnost: 'Sposoban', ogranicenje: ''
    });
    uvjerenjaList.push({
        radnik_ime: w.ime, radnik_prezime: w.prezime, radnik_jmbg: w.jmbg,
        naziv: rnd(certTypes), oznaka: `CERT-${rndi(1000,9999)}`, tipUvjerenja: 'ZOP',
        datum: `2022-0${rndi(1,9)}-10`, vrijediDo: `2024-0${rndi(1,9)}-10`,
        sposobnost: 'Sposoban', ogranicenje: ''
    });

    // OZO (at least 1 per worker)
    ozoList.push({
        radnik_ime: w.ime, radnik_prezime: w.prezime, radnik_jmbg: w.jmbg,
        naziv: rnd(ozoTypes), datumZaduzenja: `2024-01-10`, datumRazduzenja: '', kolicina: 1
    });

    // Ljekarski
    ljekarskiList.push({
        radnik_ime: w.ime, radnik_prezime: w.prezime, radnik_jmbg: w.jmbg,
        tipPregleda: rnd(['Prethodni', 'Periodični']), datum: `2023-0${rndi(1,9)}-10`, vrijediDo: `2025-0${rndi(1,9)}-10`,
        rezultat: 'Sposoban', napomena: ''
    });
}

// Append sheets
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(uvjerenjaList), 'Uvjerenja');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ozoList), 'OZO');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(opremaList), 'Oprema');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ljekarskiList), 'Ljekarski');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ppAparatiList), 'PPAparati');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hidrantiList), 'Hidranti');

XLSX.writeFile(wb, '../eZNR_Mass_MockTemplate.xlsx');
console.log('eZNR_Mass_MockTemplate.xlsx generated successfully with ALL requirements!');
