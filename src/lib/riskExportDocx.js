export function riskLevel(score) {
    if (score <= 5) return { label: 'Neznatan', color: '#4caf50', bg: 'rgba(76,175,80,0.15)' };
    if (score <= 10) return { label: 'Dopustiv', color: '#ffc107', bg: 'rgba(255,193,7,0.15)' };
    if (score <= 15) return { label: 'Umjeren', color: '#ff9800', bg: 'rgba(255,152,0,0.15)' };
    if (score <= 20) return { label: 'Znatan', color: '#f44336', bg: 'rgba(244,67,54,0.15)' };
    return { label: 'Nedopustiv', color: '#b71c1c', bg: 'rgba(183,28,28,0.2)' };
}

export const generateSafeWordDoc = async (
    data,
    items,
    workplaces,
    hazards,
    saveToFile = true,
    country = 'BA'
) => {
    const {
        Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
        HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType
    } = await import('docx');

    const sorted = [...items].sort((a, b) => (b.rizik || 0) - (a.rizik || 0));
    const highRiskItems = items.filter(ri => ri.rizik >= 6).sort((a, b) => b.rizik - a.rizik);
    const itemsWithScores = items.filter(ri => ri.rizik > 0);
    const avgBefore = itemsWithScores.length > 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
    const itemsWithAfter = items.filter(ri => ri.rizikNakon > 0);
    const avgAfter = itemsWithAfter.length > 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;
    const today = new Date().toLocaleDateString('hr-HR');

    const mkCell = (text, opts = {}) => new TableCell({
        children: [new Paragraph({
            children: [new TextRun({ text: String(text || '—'), size: opts.size || 18, bold: opts.bold, color: opts.color })],
            alignment: opts.align || AlignmentType.LEFT
        })],
        width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
        shading: opts.bg ? { type: ShadingType.SOLID, color: opts.bg } : undefined,
    });

    const headerRow = (cells) => new TableRow({
        children: cells.map(c => mkCell(c, { bold: true, bg: 'D1C4E9', size: 18 })),
        tableHeader: true,
    });

    // Risk items table
    const riTableRows = [headerRow(['#', 'Radno mjesto', 'Opasnost', 'V₀', 'P₀', 'R₀', 'Nivo', 'V₁', 'P₁', 'R₁', 'Nivo nakon'])];
    sorted.forEach((ri, i) => {
        const wp = workplaces.find(w => w.id === ri.radnoMjestoId);
        const hz = hazards.find(h => h.id === ri.opasnostId);
        const hasA = ri.rizikNakon > 0;
        riTableRows.push(new TableRow({
            children: [
                mkCell(i + 1, { align: AlignmentType.CENTER }),
                mkCell(wp?.naziv || '—'),
                mkCell(hz ? `${hz.oznaka || ''} ${hz.naziv}` : ri.opisOpasnosti || '—'),
                mkCell(ri.vjerovatnoca, { align: AlignmentType.CENTER }),
                mkCell(ri.posljedica, { align: AlignmentType.CENTER }),
                mkCell(ri.rizik, { align: AlignmentType.CENTER, bold: true }),
                mkCell(riskLevel(ri.rizik).label),
                mkCell(hasA ? ri.vjerovatnocaNakon : '—', { align: AlignmentType.CENTER }),
                mkCell(hasA ? ri.posljedlicaNakon : '—', { align: AlignmentType.CENTER }),
                mkCell(hasA ? ri.rizikNakon : '—', { align: AlignmentType.CENTER, bold: true }),
                mkCell(hasA ? riskLevel(ri.rizikNakon).label : '—'),
            ],
        }));
    });

    // Measures table
    const measuresRows = [headerRow(['#', 'Opasnost', 'R₀', 'Postojeće mjere', 'Predložene mjere', 'R₁', 'Odg. osoba', 'Rok'])];
    highRiskItems.forEach((ri, i) => {
        const hz = hazards.find(h => h.id === ri.opasnostId);
        measuresRows.push(new TableRow({
            children: [
                mkCell(i + 1, { align: AlignmentType.CENTER }),
                mkCell(hz ? `${hz.oznaka || ''} ${hz.naziv}` : ri.opisOpasnosti || '—'),
                mkCell(ri.rizik, { align: AlignmentType.CENTER, bold: true }),
                mkCell(ri.postojeceMjere),
                mkCell(ri.predlozeneMjere, { bold: true }),
                mkCell(ri.rizikNakon > 0 ? ri.rizikNakon : '—', { align: AlignmentType.CENTER, bold: true }),
                mkCell(ri.odgovornaOsoba),
                mkCell(ri.rokProvedbe ? new Date(ri.rokProvedbe).toLocaleDateString('hr-HR') : '—'),
            ],
        }));
    });

    const doc = new Document({
        sections: [{
            properties: { page: { margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 } } },
            children: [
                new Paragraph({ text: country === 'HR' ? 'Republika Hrvatska' : 'Bosna i Hercegovina — Federacija BiH', alignment: AlignmentType.CENTER, spacing: { before: 2400 }, children: [new TextRun({ text: country === 'HR' ? 'Republika Hrvatska' : 'Bosna i Hercegovina — Federacija BiH', size: 20, color: '999999' })] }),
                new Paragraph({ text: '', spacing: { before: 600 } }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'AKT O PROCJENI RIZIKA', size: 56, bold: true, color: '1A237E' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: 'na radnim mjestima i u radnim prostorijama', size: 28, color: '555555' })] }),
                new Paragraph({ text: '', spacing: { before: 600 } }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.nazivTvrtke || '—', size: 32, bold: true, color: '1A237E' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${data.sjediste || ''} • ${data.djelatnost || ''}`, size: 20, color: '666666' })] }),
                new Paragraph({ text: '', spacing: { before: 400 } }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Datum izrade: ${data.datumIzrade ? new Date(data.datumIzrade).toLocaleDateString('hr-HR') : today}`, size: 22, color: '666666' })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Revizija: ${data.revizija || '1'}`, size: 22, color: '666666' })] }),
                ...(data.ovlOrganizacija ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: `Izradila: ${data.ovlOrganizacija}`, size: 22, color: '666666' })] })] : []),
                ...(data.ovlOsobaIme ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Ovlaštena osoba: ${data.ovlOsobaIme} ${data.ovlOsobaKvalifikacije ? '(' + data.ovlOsobaKvalifikacije + ')' : ''}`, size: 22, color: '666666' })] })] : []),

                new Paragraph({ text: '', pageBreakBefore: true }),
                new Paragraph({ text: '1. Opšti podaci o poslodavcu', heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
                new Table({ rows: [
                    new TableRow({ children: [mkCell('Naziv', { bold: true, bg: 'E8EAF6', width: 30 }), mkCell(data.nazivTvrtke, { width: 70 })] }),
                    new TableRow({ children: [mkCell('Sjedište', { bold: true, bg: 'E8EAF6' }), mkCell(data.sjediste)] }),
                    new TableRow({ children: [mkCell('Djelatnost', { bold: true, bg: 'E8EAF6' }), mkCell(data.djelatnost)] }),
                    new TableRow({ children: [mkCell('Ukupno zaposlenih', { bold: true, bg: 'E8EAF6' }), mkCell(data.ukupnoZaposlenih)] }),
                    new TableRow({ children: [mkCell('Ovlaštena organizacija', { bold: true, bg: 'E8EAF6' }), mkCell(data.ovlOrganizacija)] }),
                    new TableRow({ children: [mkCell('Ovlaštena osoba', { bold: true, bg: 'E8EAF6' }), mkCell(`${data.ovlOsobaIme || '—'} ${data.ovlOsobaKvalifikacije ? '(' + data.ovlOsobaKvalifikacije + ')' : ''}`)] }),
                ], width: { size: 100, type: WidthType.PERCENTAGE } }),

                new Paragraph({ text: '2. Opis tehničko-tehnološkog procesa', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                new Paragraph({ text: data.opisProcesa || 'Nije uneseno.', spacing: { after: 200 } }),
                ...(data.analizaOrganizacije ? [
                    new Paragraph({ text: 'Analiza organizacije rada', heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }),
                    new Paragraph({ text: data.analizaOrganizacije }),
                ] : []),

                new Paragraph({ text: '3. Procjena rizika — rezultati', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                new Paragraph({ children: [
                    new TextRun({ text: `Ukupno procijenjeno: `, size: 22 }),
                    new TextRun({ text: `${items.length}`, size: 22, bold: true }),
                    new TextRun({ text: ` stavki na `, size: 22 }),
                    new TextRun({ text: `${[...new Set(items.map(r => r.radnoMjestoId))].length}`, size: 22, bold: true }),
                    new TextRun({ text: ` radnih mjesta.`, size: 22 }),
                ], spacing: { after: 200 } }),
                ...(sorted.length > 0 ? [new Table({ rows: riTableRows, width: { size: 100, type: WidthType.PERCENTAGE } })] : []),

                new Paragraph({ text: '4. Ukupna ocjena rizika', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                new Paragraph({ children: [
                    new TextRun({ text: `Prosječna ocjena PRIJE mjera: `, size: 22 }),
                    new TextRun({ text: avgBefore > 0 ? `${avgBefore.toFixed(1)} (${riskLevel(Math.round(avgBefore)).label})` : '—', size: 22, bold: true }),
                ] }),
                new Paragraph({ children: [
                    new TextRun({ text: `Prosječna ocjena NAKON mjera: `, size: 22 }),
                    new TextRun({ text: avgAfter > 0 ? `${avgAfter.toFixed(1)} (${riskLevel(Math.round(avgAfter)).label})` : '—', size: 22, bold: true }),
                ] }),
                ...(avgAfter > 0 && avgBefore > 0 ? [new Paragraph({ children: [
                    new TextRun({ text: `Smanjenje rizika: `, size: 22 }),
                    new TextRun({ text: `${((1 - avgAfter / avgBefore) * 100).toFixed(0)}%`, size: 22, bold: true, color: '4CAF50' }),
                ] })] : []),

                ...(highRiskItems.length > 0 ? [
                    new Paragraph({ text: '5. Plan mjera za smanjenje rizika', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Paragraph({ text: 'Stavke sa početnim rizikom R₀ ≥ 6 koje zahtijevaju dodatne mjere:', spacing: { after: 200 } }),
                    new Table({ rows: measuresRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
                ] : []),

                new Paragraph({ text: `${highRiskItems.length > 0 ? '6' : '5'}. Zaključak`, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                new Paragraph({ text: data.zakljucak || 'Zaključak nije unesen.', spacing: { after: 400 } }),

                new Paragraph({ text: '', spacing: { before: 800 } }),
                new Table({ rows: [new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: '________________________', alignment: AlignmentType.CENTER }), new Paragraph({ text: 'Poslodavac', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Poslodavac', size: 18 })] })], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
                        new TableCell({ children: [new Paragraph({ text: '________________________', alignment: AlignmentType.CENTER }), new Paragraph({ text: 'Ovlaštena osoba za ZNR', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Ovlaštena osoba za ZNR', size: 18 })] })], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
                    ],
                })], width: { size: 100, type: WidthType.PERCENTAGE } }),

                new Paragraph({ text: '', spacing: { before: 400 } }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Akt o procjeni rizika — ${data.nazivTvrtke || ''} — Generisano: ${today} — eZNR Platform`, size: 16, color: '999999' })] }),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    if (saveToFile) {
        const fileSaver = await import('file-saver');
        const saveAs = fileSaver.saveAs || fileSaver.default;
        saveAs(blob, `Procjena_rizika_${(data.nazivTvrtke || 'export').replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
    }
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
};
