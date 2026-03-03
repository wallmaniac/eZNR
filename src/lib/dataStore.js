'use client';

// ============================================================================
// DATA STORE — localStorage-backed data management for eZNR
// Provides CRUD operations for all modules with relational data support
// ============================================================================

const STORE_PREFIX = 'eznr_';

function getStore(key) {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORE_PREFIX + key);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
}

function setStore(key, data) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(data));
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}.`;
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

// ============================================================================
// GENERIC CRUD
// ============================================================================

export function getAll(collection) {
    return getStore(collection);
}

export function getById(collection, id) {
    return getStore(collection).find(item => item.id === id) || null;
}

export function create(collection, data) {
    const items = getStore(collection);
    const newItem = {
        ...data,
        id: genId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    items.push(newItem);
    setStore(collection, items);
    return newItem;
}

export function update(collection, id, data) {
    const items = getStore(collection);
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
    setStore(collection, items);
    return items[idx];
}

export function remove(collection, id) {
    const items = getStore(collection);
    const filtered = items.filter(item => item.id !== id);
    setStore(collection, filtered);
    return filtered;
}

export function removeMany(collection, ids) {
    const items = getStore(collection);
    const filtered = items.filter(item => !ids.includes(item.id));
    setStore(collection, filtered);
    return filtered;
}

export function search(collection, query, fields) {
    const items = getStore(collection);
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
        fields.some(f => String(item[f] || '').toLowerCase().includes(q))
    );
}

// ============================================================================
// COLLECTION NAMES
// ============================================================================

export const COLLECTIONS = {
    ORG_UNITS: 'orgUnits',
    WORKPLACES: 'workplaces',
    WORKERS: 'workers',
    EQUIPMENT: 'equipment',
    INJURIES: 'injuries',
    DISEASES: 'diseases',
    CERTIFICATES: 'certificates',
    PPE_ASSIGNMENTS: 'ppeAssignments',
    COUNTRIES: 'countries',
    COUNTIES: 'counties',
    PLACES: 'places',
    AUTHORIZED_COMPANIES: 'authorizedCompanies',
    EXAMINERS: 'examiners',
    DOCTORS: 'doctors',
    EXAM_TYPES: 'examTypes',
    CERT_TYPES: 'certTypes',
    EQUIPMENT_TYPES: 'equipmentTypes',
    PPE_TYPES: 'ppeTypes',
    FILE_TYPES: 'fileTypes',
    DIGITAL_ARCHIVE: 'digitalArchive',
    REQUESTS: 'requests',
    RISK_ASSESSMENTS: 'riskAssessments',
    ISZNR_DOCUMENTS: 'isznrDocuments',
    ISZNR_PARTIES: 'isznrParties',
    ISZNR_DOC_TYPES: 'isznrDocTypes',
    CALENDAR_EVENTS: 'calendarEvents',
    EMPLOYER_DOCS: 'employerDocs',
    REFERRALS_RA1: 'referralsRa1',
    FORMS_OIR1: 'formsOir1',
    FORMS_RO1: 'formsRo1',
    FORMS_RO2: 'formsRo2',
    REFERRALS_NR1: 'referralsNr1',
    PERSON_TYPES: 'personTypes',
    HAZARDS: 'hazards',
    // ── Multi-company & User Management ──
    USERS: 'users',
    COMPANIES: 'companies',
};

// Collections that are company-scoped (data belongs to a specific company)
const COMPANY_SCOPED = [
    'orgUnits', 'workplaces', 'workers', 'equipment', 'injuries', 'diseases',
    'certificates', 'ppeAssignments', 'calendarEvents', 'employerDocs', 'referralsRa1', 'formsOir1', 'formsRo1', 'formsRo2', 'referralsNr1',
    'digitalArchive', 'requests', 'riskAssessments', 'isznrDocuments', 'isznrParties',
    'authorizedCompanies', 'examiners', 'personTypes', 'hazards',
];

// Get all records filtered by companyId
export function getAllForCompany(collection, companyId) {
    if (!companyId) return getAll(collection);
    if (!COMPANY_SCOPED.includes(collection)) return getAll(collection);
    return getAll(collection).filter(item => !item.companyId || item.companyId === companyId);
}

// Create a record with companyId attached
export function createForCompany(collection, data, companyId) {
    if (companyId && COMPANY_SCOPED.includes(collection)) {
        return create(collection, { ...data, companyId });
    }
    return create(collection, data);
}

// ── User helpers ──
export function findUserByUsername(username) {
    return getAll(COLLECTIONS.USERS).find(u => u.username === username) || null;
}

export function getUserCompanies(userId) {
    const user = getById(COLLECTIONS.USERS, userId);
    if (!user) return [];
    if (user.role === 'admin') return getAll(COLLECTIONS.COMPANIES);
    return getAll(COLLECTIONS.COMPANIES).filter(c => (user.companyIds || []).includes(c.id));
}

export function getAllUsers() {
    return getAll(COLLECTIONS.USERS);
}

export function getAllCompanies() {
    return getAll(COLLECTIONS.COMPANIES);
}

// ============================================================================
// SEED DATA — matching Croatian app structure
// ============================================================================

export const SEED_DATA = {
    [COLLECTIONS.ORG_UNITS]: [
        { id: 'ou1', naziv: 'Merkant d.o.o.', skraceniNaziv: 'Merkant', parentId: null, mjesto: 'Sarajevo', ulica: 'Zmaja od Bosne 5', kucniBroj: '5', tip: 'Tvrtka', mjestroTroska: '', odgovornaOsoba: '', grupaOrgJed: '', odabraniLijecnik: '' },
        { id: 'ou2', naziv: 'Uprava', skraceniNaziv: 'UPR', parentId: 'ou1', mjesto: 'Sarajevo', ulica: 'Zmaja od Bosne 5', kucniBroj: '5' },
        { id: 'ou3', naziv: 'Računovodstvo', skraceniNaziv: 'RAC', parentId: 'ou1', mjesto: 'Sarajevo', ulica: 'Zmaja od Bosne 5', kucniBroj: '5' },
        { id: 'ou4', naziv: 'Proizvodnja', skraceniNaziv: 'PRO', parentId: 'ou1', mjesto: 'Sarajevo', ulica: 'Zmaja od Bosne 5', kucniBroj: '5' },
        { id: 'ou5', naziv: 'Skladište', skraceniNaziv: 'SKL', parentId: 'ou4', mjesto: 'Sarajevo', ulica: 'Zmaja od Bosne 5', kucniBroj: '5' },
        { id: 'ou6', naziv: 'IT odjel', skraceniNaziv: 'IT', parentId: 'ou1', mjesto: 'Sarajevo', ulica: 'Zmaja od Bosne 5', kucniBroj: '5' },
    ],

    [COLLECTIONS.WORKPLACES]: [
        { id: 'wp1', naziv: 'Direktor', oznaka: 'DIR-01', strucnaSprema: 'VSS', grupaRM: '', radNaRacunalu: true, posebniUvjetiRada: false, orgUnitId: 'ou2' },
        { id: 'wp2', naziv: 'Računovođa', oznaka: 'RAC-01', strucnaSprema: 'VSS', grupaRM: '', radNaRacunalu: true, posebniUvjetiRada: false, orgUnitId: 'ou3' },
        { id: 'wp3', naziv: 'Šef smjene', oznaka: 'PRO-01', strucnaSprema: 'VŠS', grupaRM: '', radNaRacunalu: false, posebniUvjetiRada: true, orgUnitId: 'ou4' },
        { id: 'wp4', naziv: 'Radnik u proizvodnji', oznaka: 'PRO-02', strucnaSprema: 'SSS', grupaRM: '', radNaRacunalu: false, posebniUvjetiRada: true, orgUnitId: 'ou4' },
        { id: 'wp5', naziv: 'Skladištar', oznaka: 'SKL-01', strucnaSprema: 'SSS', grupaRM: '', radNaRacunalu: false, posebniUvjetiRada: true, orgUnitId: 'ou5' },
        { id: 'wp6', naziv: 'Komercijalista', oznaka: 'KOM-01', strucnaSprema: 'VSS', grupaRM: '', radNaRacunalu: true, posebniUvjetiRada: false, orgUnitId: 'ou2' },
        { id: 'wp7', naziv: 'Sistemski administrator', oznaka: 'IT-01', strucnaSprema: 'VSS', grupaRM: '', radNaRacunalu: true, posebniUvjetiRada: false, orgUnitId: 'ou6' },
        { id: 'wp8', naziv: 'Tehničar održavanja', oznaka: 'ODR-01', strucnaSprema: 'SSS', grupaRM: '', radNaRacunalu: false, posebniUvjetiRada: true, orgUnitId: 'ou4' },
    ],

    [COLLECTIONS.WORKERS]: [
        {
            id: 'w1', prefix: '', ime: 'Antonio', prezime: 'Ivic', sufiks: '',
            imeRoditelja: 'Ivan', jmbg: '0612985170548', oib: '59104787887',
            zivotnaDob: 40, stazDoDolaska: '000000',
            datumZaposlenja: '2024-01-15', datumOdlaska: '', ukupniStaz: '02 00 00',
            koef: '', radnoMjestoId: 'wp6', orgJedinicaId: 'ou1',
            lokacija: 'Sarajevo', evidencijskiBroj: 'EV-001', vanjskiSuradnik: false,
            // Kontakt podaci
            ulica: 'Maršala Tita 10', kucniBroj: '10', mjestoId: '',
            opcina: 'Stari Grad', telefonTvrtki: '033/123-456', telefonKuce: '033/789-012',
            mobitel: '061/234-567', email: 'antonio.ivic@merkant.ba',
            // Osobni podaci
            spol: 'M', datumRodenja: '1985-12-06', mjestoRodenja: 'Zagreb', opcinaRodenja: 'Zagreb',
            // Status
            aktivan: true, posebniUvjeti: false,
            napomena: '',
        },
        {
            id: 'w2', prefix: '', ime: 'Emina', prezime: 'Begović', sufiks: '',
            imeRoditelja: 'Alija', jmbg: '1503990170123', oib: '',
            zivotnaDob: 36, stazDoDolaska: '050000',
            datumZaposlenja: '2026-02-01', datumOdlaska: '', ukupniStaz: '00 00 25',
            koef: '', radnoMjestoId: 'wp2', orgJedinicaId: 'ou3',
            lokacija: 'Sarajevo', evidencijskiBroj: 'EV-002', vanjskiSuradnik: false,
            ulica: 'Ferhadija 15', kucniBroj: '15', mjestoId: '',
            opcina: 'Centar', telefonTvrtki: '', telefonKuce: '',
            mobitel: '062/345-678', email: 'emina.begovic@merkant.ba',
            spol: 'Z', datumRodenja: '1990-03-15', mjestoRodenja: 'Sarajevo', opcinaRodenja: 'Centar',
            aktivan: true, posebniUvjeti: false, napomena: '',
        },
        {
            id: 'w3', prefix: '', ime: 'Mirza', prezime: 'Selimović', sufiks: '',
            imeRoditelja: 'Faruk', jmbg: '2207988175432', oib: '',
            zivotnaDob: 37, stazDoDolaska: '100000',
            datumZaposlenja: '2026-02-05', datumOdlaska: '', ukupniStaz: '00 00 21',
            koef: '', radnoMjestoId: 'wp3', orgJedinicaId: 'ou4',
            lokacija: 'Sarajevo', evidencijskiBroj: 'EV-003', vanjskiSuradnik: false,
            ulica: 'Bulevar Meše Selimovića 30', kucniBroj: '30', mjestoId: '',
            opcina: 'Novo Sarajevo', telefonTvrtki: '033/555-123', telefonKuce: '',
            mobitel: '063/456-789', email: 'mirza.selimovic@merkant.ba',
            spol: 'M', datumRodenja: '1988-07-22', mjestoRodenja: 'Tuzla', opcinaRodenja: 'Tuzla',
            aktivan: true, posebniUvjeti: true, napomena: 'Zadužen za noćne smjene',
        },
        {
            id: 'w4', prefix: '', ime: 'Amra', prezime: 'Delić', sufiks: '',
            imeRoditelja: 'Hasan', jmbg: '1011992175890', oib: '',
            zivotnaDob: 33, stazDoDolaska: '030000',
            datumZaposlenja: '2026-01-10', datumOdlaska: '', ukupniStaz: '00 01 16',
            koef: '', radnoMjestoId: 'wp5', orgJedinicaId: 'ou5',
            lokacija: 'Sarajevo', evidencijskiBroj: 'EV-004', vanjskiSuradnik: false,
            ulica: 'Hamdije Kreševljakovića 20', kucniBroj: '20', mjestoId: '',
            opcina: 'Centar', telefonTvrtki: '', telefonKuce: '',
            mobitel: '064/567-890', email: 'amra.delic@merkant.ba',
            spol: 'Z', datumRodenja: '1992-11-10', mjestoRodenja: 'Zenica', opcinaRodenja: 'Zenica',
            aktivan: true, posebniUvjeti: true, napomena: 'Rad sa teškim teretima',
        },
        {
            id: 'w5', prefix: '', ime: 'Nermin', prezime: 'Kovačević', sufiks: '',
            imeRoditelja: 'Ibrahim', jmbg: '0305987175234', oib: '',
            zivotnaDob: 38, stazDoDolaska: '080000',
            datumZaposlenja: '2026-01-20', datumOdlaska: '', ukupniStaz: '00 01 06',
            koef: '', radnoMjestoId: 'wp7', orgJedinicaId: 'ou6',
            lokacija: 'Sarajevo', evidencijskiBroj: 'EV-005', vanjskiSuradnik: false,
            ulica: 'Obala Kulina bana 8', kucniBroj: '8', mjestoId: '',
            opcina: 'Stari Grad', telefonTvrtki: '033/222-333', telefonKuce: '',
            mobitel: '065/678-901', email: 'nermin.kovacevic@merkant.ba',
            spol: 'M', datumRodenja: '1987-05-03', mjestoRodenja: 'Mostar', opcinaRodenja: 'Mostar',
            aktivan: true, posebniUvjeti: false, napomena: '',
        },
    ],

    [COLLECTIONS.EQUIPMENT]: [
        { id: 'eq1', naziv: 'Mostna dizalica MD-200', vrsta: 'Dizalice', tip: 'Mostna', tvBroj: 'MD-200-2020', invBroj: 'INV-001', orgJedinicaId: 'ou4', zaduzenOsoba: 'Mirza Selimović', datumUpisa: '2020-06-15', uPrimjeniOd: '2020-07-01', izvanUpotrebeOd: '', evidencijskiBroj: 'RO-001', brojMjernihMjesta: 3, proizvodjac: 'GANZ', godinaProizvodnje: '2019', posljednji: '2025-06-15', iduci: '2026-06-15', status: 'active' },
        { id: 'eq2', naziv: 'Kompresor Atlas Copco GA15', vrsta: 'Kompresori', tip: 'Vijčani', tvBroj: 'GA15-2021', invBroj: 'INV-002', orgJedinicaId: 'ou4', zaduzenOsoba: '', datumUpisa: '2021-03-10', uPrimjeniOd: '2021-04-01', izvanUpotrebeOd: '', evidencijskiBroj: 'RO-002', brojMjernihMjesta: 2, proizvodjac: 'Atlas Copco', godinaProizvodnje: '2021', posljednji: '2025-03-10', iduci: '2026-03-10', status: 'active' },
        { id: 'eq3', naziv: 'Viličar Toyota 8FG25', vrsta: 'Viličari', tip: 'Plinski', tvBroj: '8FG25-123', invBroj: 'INV-003', orgJedinicaId: 'ou5', zaduzenOsoba: 'Amra Delić', datumUpisa: '2019-12-01', uPrimjeniOd: '2020-01-01', izvanUpotrebeOd: '', evidencijskiBroj: 'RO-003', brojMjernihMjesta: 1, proizvodjac: 'Toyota', godinaProizvodnje: '2019', posljednji: '2024-12-01', iduci: '2025-12-01', status: 'expired' },
        { id: 'eq4', naziv: 'Električna instalacija - Hala 1', vrsta: 'Elektro instalacije', tip: 'Nisko-naponska', tvBroj: 'EI-H1', invBroj: 'INV-004', orgJedinicaId: 'ou4', zaduzenOsoba: '', datumUpisa: '2018-09-20', uPrimjeniOd: '2018-10-01', izvanUpotrebeOd: '', evidencijskiBroj: 'RO-004', brojMjernihMjesta: 15, proizvodjac: '', godinaProizvodnje: '2018', posljednji: '2025-09-20', iduci: '2026-09-20', status: 'active' },
        { id: 'eq5', naziv: 'PP aparati S-9 (10 kom)', vrsta: 'PP aparati', tip: 'S-9', tvBroj: '', invBroj: 'INV-005', orgJedinicaId: 'ou1', zaduzenOsoba: '', datumUpisa: '2024-01-01', uPrimjeniOd: '2024-01-01', izvanUpotrebeOd: '', evidencijskiBroj: 'RO-005', brojMjernihMjesta: 10, proizvodjac: 'Primus', godinaProizvodnje: '2023', posljednji: '2026-01-01', iduci: '2027-01-01', status: 'active' },
    ],

    [COLLECTIONS.CERTIFICATES]: [
        { id: 'c1', workerId: 'w1', oznaka: 'ZNR-001', datum: '2024-02-15', vrijediDo: '2026-02-15', ime: 'Osposobljavanje ZNR', tipUvjerenja: 'ZNR', upisao: 'Admin', ogranicenje: '', sposobnost: 'Sposoban' },
        { id: 'c2', workerId: 'w1', oznaka: 'PZ-001', datum: '2024-02-15', vrijediDo: '2026-02-15', ime: 'Zaštita od požara', tipUvjerenja: 'Požar', upisao: 'Admin', ogranicenje: '', sposobnost: 'Sposoban' },
        { id: 'c3', workerId: 'w3', oznaka: 'ZNR-003', datum: '2026-02-10', vrijediDo: '2028-02-10', ime: 'Osposobljavanje ZNR', tipUvjerenja: 'ZNR', upisao: 'Admin', ogranicenje: '', sposobnost: 'Sposoban' },
        { id: 'c4', workerId: 'w4', oznaka: 'ZNR-004', datum: '2026-01-15', vrijediDo: '2028-01-15', ime: 'Osposobljavanje ZNR', tipUvjerenja: 'ZNR', upisao: 'Admin', ogranicenje: '', sposobnost: 'Sposoban' },
    ],

    [COLLECTIONS.PPE_ASSIGNMENTS]: [
        { id: 'ppe1', workerId: 'w3', naziv: 'Zaštitna kaciga', datumZaduzenja: '2026-02-05', datumRazduzenja: '' },
        { id: 'ppe2', workerId: 'w3', naziv: 'Zaštitne naočale', datumZaduzenja: '2026-02-05', datumRazduzenja: '' },
        { id: 'ppe3', workerId: 'w4', naziv: 'Zaštitne cipele S3', datumZaduzenja: '2026-01-10', datumRazduzenja: '' },
        { id: 'ppe4', workerId: 'w4', naziv: 'Zaštitne rukavice', datumZaduzenja: '2026-01-10', datumRazduzenja: '' },
    ],

    [COLLECTIONS.CERT_TYPES]: [
        { id: 'ct1', naziv: 'Zaštita na radu (ZNR)', oznaka: 'ZNR', trajanjeMjeseci: 24 },
        { id: 'ct2', naziv: 'Zaštita od požara', oznaka: 'PZ', trajanjeMjeseci: 24 },
        { id: 'ct3', naziv: 'Prva pomoć', oznaka: 'PP', trajanjeMjeseci: 36 },
        { id: 'ct4', naziv: 'Rad na visini', oznaka: 'RV', trajanjeMjeseci: 12 },
        { id: 'ct5', naziv: 'Rad sa dizalicama', oznaka: 'RD', trajanjeMjeseci: 12 },
        { id: 'ct6', naziv: 'Rad sa viličarom', oznaka: 'RVI', trajanjeMjeseci: 12 },
        { id: 'ct7', naziv: 'Evakuacijski voditelj', oznaka: 'EV', trajanjeMjeseci: 36 },
    ],

    [COLLECTIONS.PPE_TYPES]: [
        { id: 'pt1', naziv: 'Zaštitna kaciga' },
        { id: 'pt2', naziv: 'Zaštitne naočale' },
        { id: 'pt3', naziv: 'Zaštitne cipele S3' },
        { id: 'pt4', naziv: 'Zaštitne rukavice' },
        { id: 'pt5', naziv: 'Zaštitno odijelo' },
        { id: 'pt6', naziv: 'Čepići za uši' },
        { id: 'pt7', naziv: 'Zaštitna maska FFP2' },
        { id: 'pt8', naziv: 'Reflektirajući prsluk' },
    ],

    [COLLECTIONS.EQUIPMENT_TYPES]: [
        { id: 'et1', naziv: 'Dizalice' },
        { id: 'et2', naziv: 'Kompresori' },
        { id: 'et3', naziv: 'Viličari' },
        { id: 'et4', naziv: 'Elektro instalacije' },
        { id: 'et5', naziv: 'PP aparati' },
        { id: 'et6', naziv: 'Hidranti' },
        { id: 'et7', naziv: 'Gromobranske instalacije' },
        { id: 'et8', naziv: 'Plinske instalacije' },
    ],

    [COLLECTIONS.CALENDAR_EVENTS]: [
        { id: 'ev1', datum: '2026-02-03', tip: 'cert', opis: 'Istek uvjerenja ZNR - 6 radnika', count: 6 },
        { id: 'ev2', datum: '2026-02-03', tip: 'ppe', opis: 'Zamjena zaštitne opreme - 8 radnika', count: 8 },
        { id: 'ev3', datum: '2026-02-10', tip: 'ppe', opis: 'Pregled zaštitne opreme', count: 2 },
        { id: 'ev4', datum: '2026-02-14', tip: 'cert', opis: 'Obnova uvjerenja PZ - 10 radnika', count: 10 },
        { id: 'ev5', datum: '2026-02-17', tip: 'cert', opis: 'Istek uvjerenja - 5 radnika', count: 5 },
        { id: 'ev6', datum: '2026-02-17', tip: 'ppe', opis: 'Zaduženje OZO - 28 radnika', count: 28 },
        { id: 'ev7', datum: '2026-02-25', tip: 'cert', opis: 'Istek uvjerenja ZNR - 5 radnika', count: 5 },
        { id: 'ev8', datum: '2026-02-28', tip: 'equip', opis: 'Pregled radne opreme', count: 2 },
    ],

    [COLLECTIONS.EMPLOYER_DOCS]: [
        // Obavezna dokumentacija (11 items from screenshot)
        { id: 'ed1', naziv: 'Elaborat zaštite od požara', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-06-15', datumIsteka: '2029-06-15', napomena: '' },
        { id: 'ed2', naziv: 'Procjena rizika zaštite od požara', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-06-15', datumIsteka: '2029-06-15', napomena: '' },
        { id: 'ed3', naziv: 'Plan zaštite od požara', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-06-15', datumIsteka: '', napomena: '' },
        { id: 'ed10', naziv: 'Evakuacijske mape', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-06-20', datumIsteka: '', napomena: '' },
        { id: 'ed4', naziv: 'Pravilnik zaštite od požara', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-03-01', datumIsteka: '', napomena: '' },
        { id: 'ed5', naziv: 'Pravilnik zaštite na radu', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-03-01', datumIsteka: '', napomena: '' },
        { id: 'ed6', naziv: 'Akt procjene rizika zaštite na radu', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-06-20', datumIsteka: '2026-06-20', napomena: 'Potrebna revizija' },
        { id: 'ed11', naziv: 'Procjena rizika zaštite od prirodnih nepogoda', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-07-01', datumIsteka: '', napomena: '' },
        { id: 'ed12', naziv: 'Imenovanje stručnog lica zaštite od požara', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-03-01', datumIsteka: '', napomena: '' },
        { id: 'ed13', naziv: 'Imenovanje stručnog lica zaštite na radu', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-03-01', datumIsteka: '', napomena: '' },
        { id: 'ed14', naziv: 'Imenovanje predstavnika radnika', kategorija: 'obavezna', status: 'aktivan', datumIzdavanja: '2024-04-15', datumIsteka: '', napomena: '' },
        // Periodični obavezni pregledi (6 items from screenshot)
        { id: 'ed7', naziv: 'Pregled protupožarnih aparata', kategorija: 'periodicni', status: 'aktivan', datumIzdavanja: '2026-01-01', datumIsteka: '2027-01-01', napomena: '' },
        { id: 'ed8', naziv: 'Pregled hidrantske mreže', kategorija: 'periodicni', status: 'aktivan', datumIzdavanja: '2025-08-15', datumIsteka: '2026-08-15', napomena: '' },
        { id: 'ed15', naziv: 'Pregled panik rasvjete', kategorija: 'periodicni', status: 'aktivan', datumIzdavanja: '2025-06-01', datumIsteka: '2026-06-01', napomena: '' },
        { id: 'ed16', naziv: 'Pregled kutija prve pomoći', kategorija: 'periodicni', status: 'aktivan', datumIzdavanja: '2025-09-01', datumIsteka: '2026-09-01', napomena: '' },
        { id: 'ed9', naziv: 'Elektro instalacije i gromobranske instalacije', kategorija: 'periodicni', status: 'aktivan', datumIzdavanja: '2025-09-20', datumIsteka: '2026-09-20', napomena: '' },
        { id: 'ed17', naziv: 'Godišnji izvještaj o povredama na radu', kategorija: 'periodicni', status: 'aktivan', datumIzdavanja: '2026-01-15', datumIsteka: '2027-01-15', napomena: '' },
        // Dodatne evidencije (4 items from screenshot)
        { id: 'ed18', naziv: 'Pregled objekta', kategorija: 'dodatne', status: 'aktivan', datumIzdavanja: '2025-04-15', datumIsteka: '2026-04-15', napomena: '' },
        { id: 'ed19', naziv: 'Certifikati za pružatelja prve pomoći', kategorija: 'dodatne', status: 'aktivan', datumIzdavanja: '2025-03-01', datumIsteka: '2028-03-01', napomena: '' },
        { id: 'ed20', naziv: 'Certifikati za voditelja evakuacije', kategorija: 'dodatne', status: 'aktivan', datumIzdavanja: '2025-03-01', datumIsteka: '2028-03-01', napomena: '' },
        { id: 'ed21', naziv: 'Upute/obuka za higijenu', kategorija: 'dodatne', status: 'aktivan', datumIzdavanja: '2025-05-01', datumIsteka: '', napomena: '' },
    ],

    [COLLECTIONS.ISZNR_PARTIES]: [
        { id: 'ip1', naziv: 'Merkant d.o.o.', oib: '12345678901', adresa: 'Zmaja od Bosne 5, Sarajevo', kontaktOsoba: 'Amir Hadžić', telefon: '033/123-456', email: 'info@merkant.ba' },
        { id: 'ip2', naziv: 'ABC Kontrola d.o.o.', oib: '98765432109', adresa: 'Titova 25, Zenica', kontaktOsoba: 'Nedim Bašić', telefon: '032/222-333', email: 'info@abc-kontrola.ba' },
    ],

    [COLLECTIONS.ISZNR_DOC_TYPES]: [
        { id: 'idt1', naziv: 'Zapisnik', oznaka: 'ZAP' },
        { id: 'idt2', naziv: 'Uvjerenje', oznaka: 'UVJ' },
        { id: 'idt3', naziv: 'Radni nalog', oznaka: 'RN' },
        { id: 'idt4', naziv: 'Izvještaj', oznaka: 'IZV' },
    ],

    [COLLECTIONS.ISZNR_DOCUMENTS]: [
        { id: 'isd1', partyId: 'ip1', naslov: 'Zapisnik o ispitivanju dizalice', tipDokumentaId: 'idt1', datum: '2026-02-15', potpisano: true, datoteka: '' },
        { id: 'isd2', partyId: 'ip1', naslov: 'Uvjerenje o osposobljenosti - ZNR', tipDokumentaId: 'idt2', datum: '2026-02-10', potpisano: false, datoteka: '' },
        { id: 'isd3', partyId: 'ip2', naslov: 'Zapisnik o ispitivanju elektro instalacija', tipDokumentaId: 'idt1', datum: '2026-02-05', potpisano: true, datoteka: '' },
    ],

    [COLLECTIONS.PLACES]: [
        { id: 'pl1', naziv: 'Sarajevo', postBroj: '71000' },
        { id: 'pl2', naziv: 'Zenica', postBroj: '72000' },
        { id: 'pl3', naziv: 'Tuzla', postBroj: '75000' },
        { id: 'pl4', naziv: 'Mostar', postBroj: '88000' },
        { id: 'pl5', naziv: 'Banja Luka', postBroj: '78000' },
        { id: 'pl6', naziv: 'Bihać', postBroj: '77000' },
    ],

    [COLLECTIONS.COUNTRIES]: [
        { id: 'co1', naziv: 'Bosna i Hercegovina', kod: 'BA' },
        { id: 'co2', naziv: 'Hrvatska', kod: 'HR' },
        { id: 'co3', naziv: 'Srbija', kod: 'RS' },
        { id: 'co4', naziv: 'Crna Gora', kod: 'ME' },
        { id: 'co5', naziv: 'Slovenija', kod: 'SI' },
    ],

    [COLLECTIONS.DOCTORS]: [
        { id: 'doc1', ime: 'Dr. Jasmina Mujić', specijalizacija: 'Medicina rada', telefon: '033/444-555', email: 'j.mujic@med.ba' },
        { id: 'doc2', ime: 'Dr. Sead Osmanović', specijalizacija: 'Medicina rada', telefon: '033/555-666', email: 's.osmanovic@med.ba' },
    ],

    [COLLECTIONS.AUTHORIZED_COMPANIES]: [
        { id: 'ac1', naziv: 'ABC Kontrola d.o.o.', rješenjeBroj: 'RJ-2024-001', datumRješenja: '2024-01-01', adresa: 'Titova 25, Zenica', tel: '032/222-333' },
        { id: 'ac2', naziv: 'SafetyFirst d.o.o.', rješenjeBroj: 'RJ-2024-002', datumRješenja: '2024-03-15', adresa: 'Branilaca 10, Sarajevo', tel: '033/777-888' },
    ],

    [COLLECTIONS.EXAMINERS]: [
        { id: 'ex1', ime: 'Kemal Muratović', zvanje: 'Diplomirani inženjer ZNR', ovlaštenaTvrtkaId: 'ac1', telefon: '032/222-334' },
        { id: 'ex2', ime: 'Aida Halilović', zvanje: 'Diplomirani inženjer elektrotehnike', ovlaštenaTvrtkaId: 'ac2', telefon: '033/777-889' },
    ],

    // ── Users & Companies ──
    [COLLECTIONS.COMPANIES]: [
        { id: 'comp1', naziv: 'Merkant d.o.o.', skraceniNaziv: 'Merkant', oib: '12345678901', adresa: 'Zmaja od Bosne 5', mjesto: 'Sarajevo', postanskiBroj: '71000', telefon: '033/123-456', email: 'info@merkant.ba', direktor: 'Antonio Ivic', aktivan: true },
    ],
    [COLLECTIONS.USERS]: [
        { id: 'usr_admin', username: 'admin', password: 'admin123', firstName: 'Admin', lastName: 'Sistem', email: 'admin@eznr.ba', role: 'admin', companyIds: ['comp1'], aktivan: true },
        { id: 'usr_officer', username: 'officer', password: 'officer123', firstName: 'Emir', lastName: 'Hodžić', email: 'emir@merkant.ba', role: 'officer', companyIds: ['comp1'], aktivan: true },
    ],
};

let isInitialized = false;

export function initializeData() {
    if (typeof window === 'undefined' || isInitialized) return;
    isInitialized = true;

    Object.entries(SEED_DATA).forEach(([collection, seedItems]) => {
        const existing = getStore(collection);
        if (existing.length === 0) {
            setStore(collection, seedItems.map(item => ({
                ...item,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })));
        }
    });

    // Force re-seed employer docs if version changed (new items added)
    const EMPLOYER_DOCS_VERSION = 2;
    const currentVersion = parseInt(localStorage.getItem(STORE_PREFIX + 'employerDocsVersion') || '0');
    if (currentVersion < EMPLOYER_DOCS_VERSION) {
        setStore(COLLECTIONS.EMPLOYER_DOCS, SEED_DATA[COLLECTIONS.EMPLOYER_DOCS].map(item => ({
            ...item,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })));
        localStorage.setItem(STORE_PREFIX + 'employerDocsVersion', String(EMPLOYER_DOCS_VERSION));
    }
}

// ============================================================================
// HELPER — resolve relations
// ============================================================================

export function getWorkerDisplayName(worker) {
    if (!worker) return '';
    return `${worker.ime} ${worker.prezime}`;
}

export function getOrgUnitName(id) {
    const unit = getById(COLLECTIONS.ORG_UNITS, id);
    return unit ? unit.naziv : '';
}

export function getWorkplaceName(id) {
    const wp = getById(COLLECTIONS.WORKPLACES, id);
    return wp ? wp.naziv : '';
}

export function getWorkerCertificates(workerId) {
    return getAll(COLLECTIONS.CERTIFICATES).filter(c => c.workerId === workerId);
}

export function getWorkerPPE(workerId) {
    return getAll(COLLECTIONS.PPE_ASSIGNMENTS).filter(p => p.workerId === workerId);
}

export function getWorkersInOrgUnit(orgUnitId) {
    return getAll(COLLECTIONS.WORKERS).filter(w => w.orgJedinicaId === orgUnitId && w.aktivan);
}

export function getWorkersInWorkplace(workplaceId) {
    return getAll(COLLECTIONS.WORKERS).filter(w => w.radnoMjestoId === workplaceId && w.aktivan);
}

export function getChildOrgUnits(parentId) {
    return getAll(COLLECTIONS.ORG_UNITS).filter(ou => ou.parentId === parentId);
}

export function getCalendarEventsForMonth(year, month) {
    const events = getAll(COLLECTIONS.CALENDAR_EVENTS);
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return events.filter(e => e.datum.startsWith(prefix));
}

// ============================================================================
// SEED DEFAULT DATA — Vrsta osobe & Opasnosti
// ============================================================================

const DEFAULT_PERSON_TYPES = [
    { naziv: 'Član radne skupine', vrsta: 'Član radne skupine' },
    { naziv: 'Član radne skupine kod poslodavca', vrsta: 'Član radne skupine kod poslodavca' },
    { naziv: 'Povjerenik zaštite na radu', vrsta: 'Povjerenik zaštite na radu' },
    { naziv: 'Stručnjak zaštite na radu', vrsta: 'Stručnjak zaštite na radu' },
    { naziv: 'Voditelj radne skupine', vrsta: 'Voditelj radne skupine' },
];

const DEFAULT_HAZARDS = [
    { naziv: 'O.1. MEHANIČKE OPASNOSTI', oznaka: 'O.1' },
    { naziv: 'O.1.1. alati', oznaka: 'O.1.1' },
    { naziv: 'O.1.1.1. ručni', oznaka: 'O.1.1.1' },
    { naziv: 'O.1.1.2. mehanizirani', oznaka: 'O.1.1.2' },
    { naziv: 'O.1.2. strojevi i oprema', oznaka: 'O.1.2' },
    { naziv: 'O.1.3. sredstva za horizontalni prijenos', oznaka: 'O.1.3' },
    { naziv: 'O.1.3.1. prijevozna vozila: automobili, kamioni i dr', oznaka: 'O.1.3.1' },
    { naziv: 'O.1.3.2. prijenosna sredstva: viličari', oznaka: 'O.1.3.2' },
    { naziv: 'O.1.3.3. samohodni strojevi: bageri, buldožeri i dr', oznaka: 'O.1.3.3' },
    { naziv: 'O.1.4. sredstva za vertikalni prijenos', oznaka: 'O.1.4' },
    { naziv: 'O.1.4.1. dizalice', oznaka: 'O.1.4.1' },
    { naziv: 'O.1.4.2. transporteri', oznaka: 'O.1.4.2' },
    { naziv: 'O.1.5. rukovanje predmetima', oznaka: 'O.1.5' },
    { naziv: 'O.1.6. ostale mehaničke opasnosti', oznaka: 'O.1.6' },
    { naziv: 'O.2. OPASNOSTI OD PADOVA', oznaka: 'O.2' },
    { naziv: 'O.2.1. pad radnika i drugih osoba', oznaka: 'O.2.1' },
    { naziv: 'O.2.1.1. na istoj razini', oznaka: 'O.2.1.1' },
    { naziv: 'O.2.1.2. u dubinu', oznaka: 'O.2.1.2' },
    { naziv: 'O.2.1.3. s visine', oznaka: 'O.2.1.3' },
    { naziv: 'O.2.1.4. s visine iznad 3 metra', oznaka: 'O.2.1.4' },
    { naziv: 'O.2.2. pad predmeta', oznaka: 'O.2.2' },
    { naziv: 'O.3. ELEKTRIČNA STRUJA', oznaka: 'O.3' },
    { naziv: 'O.3.1. otvoreni električni krug', oznaka: 'O.3.1' },
    { naziv: 'O.3.2. ostale električne opasnosti', oznaka: 'O.3.2' },
    { naziv: 'O.4. POŽAR I EKSPLOZIJA', oznaka: 'O.4' },
    { naziv: 'O.4.1. eksplozivne tvari', oznaka: 'O.4.1' },
    { naziv: 'O.4.2. zapaljive tvari', oznaka: 'O.4.2' },
    { naziv: 'O.5. TERMIČKE OPASNOSTI', oznaka: 'O.5' },
    { naziv: 'O.5.1. vruće tvari', oznaka: 'O.5.1' },
    { naziv: 'O.5.2. hladne tvari', oznaka: 'O.5.2' },
    { naziv: 'Š.1. KEMIJSKE ŠTETNOSTI', oznaka: 'Š.1' },
    { naziv: 'Š.1.1. otrovi', oznaka: 'Š.1.1' },
    { naziv: 'Š.1.1.1. metali', oznaka: 'Š.1.1.1' },
    { naziv: 'Š.1.1.2. nemetali', oznaka: 'Š.1.1.2' },
    { naziv: 'Š.1.1.3. organski spojevi', oznaka: 'Š.1.1.3' },
    { naziv: 'Š.1.2. korozivi', oznaka: 'Š.1.2' },
    { naziv: 'Š.1.2.1. kiseline', oznaka: 'Š.1.2.1' },
    { naziv: 'Š.1.2.2. lužine', oznaka: 'Š.1.2.2' },
    { naziv: 'Š.1.2.3. drugi korozivi', oznaka: 'Š.1.2.3' },
    { naziv: 'Š.1.3. nadražljivci', oznaka: 'Š.1.3' },
    { naziv: 'Š.1.3.1. lako topivi u vodi', oznaka: 'Š.1.3.1' },
    { naziv: 'Š.1.3.2. slabo topivi u vodi', oznaka: 'Š.1.3.2' },
    { naziv: 'Š.1.3.3. odmašćivači', oznaka: 'Š.1.3.3' },
    { naziv: 'Š.1.3.4. drugi nadražljivci', oznaka: 'Š.1.3.4' },
    { naziv: 'Š.1.4. zagušljivci', oznaka: 'Š.1.4' },
    { naziv: 'Š.1.4.1. inertni', oznaka: 'Š.1.4.1' },
    { naziv: 'Š.1.4.2. kemijski', oznaka: 'Š.1.4.2' },
    { naziv: 'Š.1.5. senzibilizatori', oznaka: 'Š.1.5' },
    { naziv: 'Š.1.5.1. organske prašine biljnog porijekla', oznaka: 'Š.1.5.1' },
    { naziv: 'Š.1.5.2. organske prašine životinjskog porijekla', oznaka: 'Š.1.5.2' },
    { naziv: 'Š.1.5.3. kemijski spojevi alergogenog potencijala', oznaka: 'Š.1.5.3' },
    { naziv: 'Š.1.5.4. termofilne aktinomicete', oznaka: 'Š.1.5.4' },
    { naziv: 'Š.1.5.5. ostali senzibilizatori', oznaka: 'Š.1.5.5' },
    { naziv: 'Š.1.6. fibrogeni', oznaka: 'Š.1.6' },
    { naziv: 'Š.1.6.1. azbest', oznaka: 'Š.1.6.1' },
    { naziv: 'Š.1.6.2. silicijev dioksid', oznaka: 'Š.1.6.2' },
    { naziv: 'Š.1.6.3. ostali fibrogeni', oznaka: 'Š.1.6.3' },
    { naziv: 'Š.1.7. mutageni', oznaka: 'Š.1.7' },
    { naziv: 'Š.1.8. karcinogeni', oznaka: 'Š.1.8' },
    { naziv: 'Š.1.9. teratogeni', oznaka: 'Š.1.9' },
    { naziv: 'Š.2. BIOLOŠKE ŠTETNOSTI', oznaka: 'Š.2' },
    { naziv: 'Š.2.1. zarazni materijal', oznaka: 'Š.2.1' },
    { naziv: 'Š.2.2. zaraženi ljudi', oznaka: 'Š.2.2' },
    { naziv: 'Š.2.3. zaražene životinje', oznaka: 'Š.2.3' },
    { naziv: 'Š.2.4. opasne biljke', oznaka: 'Š.2.4' },
    { naziv: 'Š.2.5. opasne životinje', oznaka: 'Š.2.5' },
    { naziv: 'Š.3. FIZIKALNE ŠTETNOSTI', oznaka: 'Š.3' },
    { naziv: 'Š.3.1. buka', oznaka: 'Š.3.1' },
    { naziv: 'Š.3.1.1. kontinuirana buka', oznaka: 'Š.3.1.1' },
    { naziv: 'Š.3.1.2. diskontinuirana buka', oznaka: 'Š.3.1.2' },
    { naziv: 'Š.3.1.3. impulsna buka', oznaka: 'Š.3.1.3' },
    { naziv: 'Š.3.1.4. ometajuća', oznaka: 'Š.3.1.4' },
    { naziv: 'Š.3.2. vibracije', oznaka: 'Š.3.2' },
    { naziv: 'Š.3.2.1. vibracije koje se prenose na ruke', oznaka: 'Š.3.2.1' },
    { naziv: 'Š.3.2.2. vibracije koje se prenose na cijelo tijelo', oznaka: 'Š.3.2.2' },
    { naziv: 'Š.3.2.3. potresanja', oznaka: 'Š.3.2.3' },
    { naziv: 'Š.3.3. promijenjeni tlak', oznaka: 'Š.3.3' },
    { naziv: 'Š.3.3.1. povišeni tlak', oznaka: 'Š.3.3.1' },
    { naziv: 'Š.3.3.2. sniženi tlak', oznaka: 'Š.3.3.2' },
    { naziv: 'Š.3.3.3. promjene tlaka', oznaka: 'Š.3.3.3' },
    { naziv: 'Š.3.4. nepovoljni klimatski i mikroklimatski uvjeti', oznaka: 'Š.3.4' },
    { naziv: 'Š.3.4.1. rad na otvorenom', oznaka: 'Š.3.4.1' },
    { naziv: 'Š.3.4.2. vrući okoliš', oznaka: 'Š.3.4.2' },
    { naziv: 'Š.3.4.3. visoka vlažnost', oznaka: 'Š.3.4.3' },
    { naziv: 'Š.3.4.4. pojačano strujanje zraka', oznaka: 'Š.3.4.4' },
    { naziv: 'Š.3.4.5. hladan okoliš', oznaka: 'Š.3.4.5' },
    { naziv: 'Š.3.4.6. česte promjene temperature', oznaka: 'Š.3.4.6' },
    { naziv: 'Š.3.4.7. nepovoljni učinci umjetne ventilacije', oznaka: 'Š.3.4.7' },
    { naziv: 'Š.3.5. ionizirajuće zračenje', oznaka: 'Š.3.5' },
    { naziv: 'Š.3.5.1. rendgensko zračenje', oznaka: 'Š.3.5.1' },
    { naziv: 'Š.3.5.2. otvoreni radioaktivni elementi', oznaka: 'Š.3.5.2' },
    { naziv: 'Š.3.5.3. zatvoreni radioaktivni elementi', oznaka: 'Š.3.5.3' },
    { naziv: 'Š.3.6. neionizirajuće zračenje', oznaka: 'Š.3.6' },
    { naziv: 'Š.3.6.1. UV zračenje (A, B, C)', oznaka: 'Š.3.6.1' },
    { naziv: 'Š.3.6.2. toplinsko zračenje', oznaka: 'Š.3.6.2' },
    { naziv: 'Š.3.6.3. mikrovalno zračenje', oznaka: 'Š.3.6.3' },
    { naziv: 'Š.3.6.4. lasersko zračenje', oznaka: 'Š.3.6.4' },
    { naziv: 'Š.3.6.5. elektromagnetsko polje vrlo niskih frekvencija', oznaka: 'Š.3.6.5' },
    { naziv: 'Š.3.7. osvijetljenost', oznaka: 'Š.3.7' },
    { naziv: 'Š.3.7.1. nedovoljna osvijetljenost', oznaka: 'Š.3.7.1' },
    { naziv: 'Š.3.7.2. blještanje', oznaka: 'Š.3.7.2' },
    { naziv: 'Š.3.8. ostale fizikalne štetnosti', oznaka: 'Š.3.8' },
    { naziv: 'N.1. STATODINAMIČKI NAPORI', oznaka: 'N.1' },
    { naziv: 'N.1.1. statički: prisilan položaj tijela pri radu', oznaka: 'N.1.1' },
    { naziv: 'N.1.1.1. stalno sjedenje', oznaka: 'N.1.1.1' },
    { naziv: 'N.1.1.2. stalno stajanje', oznaka: 'N.1.1.2' },
    { naziv: 'N.1.1.3. pognut položaj tijela', oznaka: 'N.1.1.3' },
    { naziv: 'N.1.1.4. čučanje, klečanje', oznaka: 'N.1.1.4' },
    { naziv: 'N.1.1.5. rad u skučenom prostoru', oznaka: 'N.1.1.5' },
    { naziv: 'N.1.1.6. ruke iznad glave', oznaka: 'N.1.1.6' },
    { naziv: 'N.1.1.7. ostali statički napori', oznaka: 'N.1.1.7' },
    { naziv: 'N.1.2. dinamički: fizički rad', oznaka: 'N.1.2' },
    { naziv: 'N.1.2.1. ponavljajući pokreti sa i bez primjene sile', oznaka: 'N.1.2.1' },
    { naziv: 'N.1.2.2. brzi rad', oznaka: 'N.1.2.2' },
    { naziv: 'N.1.2.3. dizanje i nošenje tereta', oznaka: 'N.1.2.3' },
    { naziv: 'N.1.2.4. guranje i vučenje tereta', oznaka: 'N.1.2.4' },
    { naziv: 'N.1.2.5. težak fizički rad', oznaka: 'N.1.2.5' },
    { naziv: 'N.1.2.6. ostali dinamički napori', oznaka: 'N.1.2.6' },
    { naziv: 'N.2. PSIHOFIZIOLOŠKI NAPORI', oznaka: 'N.2' },
    { naziv: 'N.2.1. nepovoljan ritam rada', oznaka: 'N.2.1' },
    { naziv: 'N.2.1.1. rad na normu', oznaka: 'N.2.1.1' },
    { naziv: 'N.2.1.2. ritam uvjetovan radnim procesom', oznaka: 'N.2.1.2' },
    { naziv: 'N.2.1.3. neujednačen ritam', oznaka: 'N.2.1.3' },
    { naziv: 'N.2.2. poremećen bioritam', oznaka: 'N.2.2' },
    { naziv: 'N.2.2.2. noćni rad', oznaka: 'N.2.2.2' },
    { naziv: 'N.2.2.3. produljeni rad', oznaka: 'N.2.2.3' },
    { naziv: 'N.2.3. remećenje socijalnih potreba', oznaka: 'N.2.3' },
    { naziv: 'N.2.3.1. terenski rad', oznaka: 'N.2.3.1' },
    { naziv: 'N.2.3.2. rad na daljinu', oznaka: 'N.2.3.2' },
    { naziv: 'N.2.4. odgovornost za živote ljudi i materijalna dobra', oznaka: 'N.2.4' },
    { naziv: 'N.2.4.1. rukovođenje', oznaka: 'N.2.4.1' },
    { naziv: 'N.2.4.2. upravljanje prijevoznim sredstvima', oznaka: 'N.2.4.2' },
    { naziv: 'N.2.5. visoka vjerojatnost izvanrednih događaja', oznaka: 'N.2.5' },
    { naziv: 'N.2.6. otežan prijam informacija', oznaka: 'N.2.6' },
    { naziv: 'N.2.6.1. zvučni signali i znakovi', oznaka: 'N.2.6.1' },
    { naziv: 'N.2.6.2. svjetlosni signali i znakovi', oznaka: 'N.2.6.2' },
    { naziv: 'N.2.6.3. buka', oznaka: 'N.2.6.3' },
    { naziv: 'N.2.6.4. nedovoljna osvijetljenost', oznaka: 'N.2.6.4' },
    { naziv: 'N.2.7. radni zahtjevi', oznaka: 'N.2.7' },
    { naziv: 'N.2.7.1. neodgovarajući kvantitativni zahtjevi (premalo ili previše rada)', oznaka: 'N.2.7.1' },
    { naziv: 'N.2.7.2. premali utjecaj na rad', oznaka: 'N.2.7.2' },
    { naziv: 'N.2.7.3. zahtjev za visokom kvalitetom rada', oznaka: 'N.2.7.3' },
    { naziv: 'N.2.7.4. izolirani rad', oznaka: 'N.2.7.4' },
    { naziv: 'N.2.7.5. monotoni rad', oznaka: 'N.2.7.5' },
    { naziv: 'N.2.7.6. komunikacija s osobama', oznaka: 'N.2.7.6' },
    { naziv: 'N.2.8. maltretiranje', oznaka: 'N.2.8' },
    { naziv: 'N.2.8.1. mobing', oznaka: 'N.2.8.1' },
    { naziv: 'N.2.8.2. bulling', oznaka: 'N.2.8.2' },
    { naziv: 'N.2.9. burnout', oznaka: 'N.2.9' },
    { naziv: 'N.2.10. ostali psihofiziološki napori', oznaka: 'N.2.10' },
    { naziv: 'N.3. NAPORI VIDA', oznaka: 'N.3' },
    { naziv: 'N.4. NAPORI GOVORA', oznaka: 'N.4' },
];

export function seedDefaultData() {
    if (typeof window === 'undefined') return;
    const SEED_KEY = STORE_PREFIX + '__seeded_procjena_v2';
    if (localStorage.getItem(SEED_KEY)) return;

    // Seed person types if empty
    const existing_pt = getStore(COLLECTIONS.PERSON_TYPES);
    if (existing_pt.length === 0) {
        const seeded = DEFAULT_PERSON_TYPES.map(d => ({ ...d, id: genId() }));
        setStore(COLLECTIONS.PERSON_TYPES, seeded);
    }

    // Seed hazards if empty
    const existing_haz = getStore(COLLECTIONS.HAZARDS);
    if (existing_haz.length === 0) {
        const seeded = DEFAULT_HAZARDS.map((d, i) => {
            // Tiny delay between IDs to keep order
            const id = Date.now().toString(36) + i.toString(36).padStart(3, '0') + Math.random().toString(36).substr(2, 5);
            return { ...d, id };
        });
        setStore(COLLECTIONS.HAZARDS, seeded);
    }

    localStorage.setItem(SEED_KEY, '1');
}

// Auto-seed on module load
seedDefaultData();

export { formatDate, todayISO, genId, COMPANY_SCOPED };
