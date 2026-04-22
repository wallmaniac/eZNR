import fs from 'fs';

let content = fs.readFileSync('src/app/dashboard/workers/page.js', 'utf8');

content = content.replace(
    /const \[exportColumns, setExportColumns\] = useState\(\{[\s\S]*?\}\);/m,
    `const [exportColumns, setExportColumns] = useState({
        ime: true, prezime: true, imeRoditelja: false, jmbg: true, oib: true, datumRodenja: true, spol: false,
        miestoRodenja: false, zivotnaDob: false, orgJedinicaId: true, radnoMjestoId: true, datumZaposlenja: true,
        datumOdlaska: false, stazDoDolaska: false, ukupniStaz: false, koef: false, lokacija: false, ulica: false, kucniBroj: false,
        mjestoId: false, opcina: false, telefonTvrtki: false, mobitel: false, email: false, napomena: false, aktivan: true, vanjskiSuradnik: false, evidencijskiBroj: false,
        uvjerenja: false, ljekarski: false, ozo: false
    });`
);

content = content.replace(
   /\[\s*\{\s*key:\s*'ime',\s*label:\s*'Ime'\s*\},[\s\S]*?\]\.map\(col/,
   `[
                                        { key: 'ime', label: 'Ime' }, { key: 'prezime', label: 'Prezime' }, { key: 'imeRoditelja', label: 'Ime roditelja' },
                                        { key: 'jmbg', label: 'JMBG' }, { key: 'oib', label: 'OIB' },
                                        { key: 'evidencijskiBroj', label: 'Evid. br.' },
                                        { key: 'datumRodenja', label: 'Datum rođenja' }, { key: 'miestoRodenja', label: 'Mjesto rođenja' },
                                        { key: 'spol', label: 'Spol' }, { key: 'zivotnaDob', label: 'Životna dob' },
                                        { key: 'orgJedinicaId', label: 'Organizacijska jed.' }, { key: 'radnoMjestoId', label: 'Radno mjesto' },
                                        { key: 'lokacija', label: 'Lokacija' },
                                        { key: 'datumZaposlenja', label: 'Datum zapošlj.' }, { key: 'stazDoDolaska', label: 'Staž do dolaska' },
                                        { key: 'datumOdlaska', label: 'Datum odlaska' }, { key: 'ukupniStaz', label: 'Ukupni staž' },
                                        { key: 'koef', label: 'Koeficijent' },
                                        { key: 'ulica', label: 'Ulica' }, { key: 'kucniBroj', label: 'Kućni broj' },
                                        { key: 'mjestoId', label: 'Mjesto' }, { key: 'opcina', label: 'Općina' },
                                        { key: 'telefonTvrtki', label: 'Tel (Firma)' }, { key: 'mobitel', label: 'Mobitel' },
                                        { key: 'email', label: 'Email' }, { key: 'napomena', label: 'Napomena' },
                                        { key: 'vanjskiSuradnik', label: 'Vanjski saradnik' }, { key: 'aktivan', label: 'Status (Aktivan)' },
                                        { key: 'uvjerenja', label: 'Uvjerenja ZNR..' }, { key: 'ljekarski', label: 'Ljekarski pregledi' },
                                        { key: 'ozo', label: 'Zadužena OZO' }
                                    ].map(col`
);

content = content.replace(
   /if\s*\(exportColumns\.ime\)\s*row\['Ime'\]\s*=\s*w\.ime;[\s\S]*?if\s*\(exportColumns\.aktivan\)\s*row\['Status'\]\s*=\s*w\.aktivan\s*\?\s*'Aktivan'\s*:\s*'Bivši radnik';/m,
   `if (exportColumns.ime) row['Ime'] = w.ime;
                                        if (exportColumns.prezime) row['Prezime'] = w.prezime;
                                        if (exportColumns.imeRoditelja) row['Ime roditelja'] = w.imeRoditelja;
                                        if (exportColumns.jmbg) row['JMBG'] = w.jmbg;
                                        if (exportColumns.oib) row['OIB/Osobni br.'] = w.oib;
                                        if (exportColumns.evidencijskiBroj) row['Evidencijski broj'] = w.evidencijskiBroj;
                                        if (exportColumns.datumRodenja) row['Datum rođenja'] = w.datumRodenja ? formatDate(w.datumRodenja) : '';
                                        if (exportColumns.miestoRodenja) row['Mjesto rođenja'] = w.miestoRodenja || w.miestoRodenja_;
                                        if (exportColumns.spol) row['Spol'] = w.spol;
                                        if (exportColumns.zivotnaDob) row['Životna dob'] = w.zivotnaDob;
                                        if (exportColumns.orgJedinicaId) row['Organizacijska jedinica'] = getOrgUnitName(w.orgJedinicaId);
                                        if (exportColumns.radnoMjestoId) row['Radno mjesto'] = getWorkplaceName(w.radnoMjestoId);
                                        if (exportColumns.lokacija) row['Lokacija'] = w.lokacija;
                                        if (exportColumns.datumZaposlenja) row['Datum zaposlenja'] = w.datumZaposlenja ? formatDate(w.datumZaposlenja) : '';
                                        if (exportColumns.datumOdlaska) row['Datum odlaska'] = w.datumOdlaska ? formatDate(w.datumOdlaska) : '';
                                        if (exportColumns.stazDoDolaska) row['Staž do dolaska'] = w.stazDoDolaska;
                                        if (exportColumns.ukupniStaz) row['Ukupni radni staž'] = w.ukupniStaz;
                                        if (exportColumns.koef) row['Koeficijent'] = w.koef;
                                        if (exportColumns.ulica) row['Ulica'] = w.ulica;
                                        if (exportColumns.kucniBroj) row['Kućni broj'] = w.kucniBroj;
                                        if (exportColumns.mjestoId) row['Mjesto'] = places.find(p => p.id === w.mjestoId)?.naziv || '';
                                        if (exportColumns.opcina) row['Općina'] = w.opcina;
                                        if (exportColumns.telefonTvrtki) row['Telefon (Firma)'] = w.telefonTvrtki;
                                        if (exportColumns.mobitel) row['Mobitel'] = w.mobitel;
                                        if (exportColumns.email) row['Email'] = w.email;
                                        if (exportColumns.napomena) row['Napomena'] = w.napomena;
                                        if (exportColumns.vanjskiSuradnik) row['Vanjski saradnik'] = w.vanjskiSuradnik ? 'DA' : 'NE';
                                        if (exportColumns.aktivan) row['Status'] = w.aktivan ? 'Aktivan' : 'Bivši radnik';`
);

fs.writeFileSync('src/app/dashboard/workers/page.js', content, 'utf8');
console.log('Worker Export fields patched successfully via regex script.');
