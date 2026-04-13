/**
 * fix-dates-surgical.mjs
 * 
 * Precisely replaces ONLY actual date input fields (not search bars, file inputs, etc.)
 * with DateInput component.
 *
 * Strategy: For each file, find lines with type="date", verify they're actual date <input> fields,
 * and generate precise replacements.
 */
import fs from 'fs';
import path from 'path';

const fixes = [];

function addFix(file, oldStr, newStr) {
    fixes.push({ file, old: oldStr, new: newStr });
}

// ═══════════════════════════════════════════════════
// equipment/page.js — 7 date inputs (THE SCREENSHOT!)
// ═══════════════════════════════════════════════════
const eq = 'src/app/dashboard/equipment/page.js';
addFix(eq,
    `<input className="form-input" type="date" value={formData.datumUpisa} onChange={e => updateField('datumUpisa', e.target.value)} />`,
    `<DateInput value={formData.datumUpisa} onChange={v => updateField('datumUpisa', v)} />`);
addFix(eq,
    `<input className="form-input" type="date" value={formData.uPrimjeniOd} onChange={e => updateField('uPrimjeniOd', e.target.value)} />`,
    `<DateInput value={formData.uPrimjeniOd} onChange={v => updateField('uPrimjeniOd', v)} />`);
addFix(eq,
    `<input className="form-input" type="date" value={formData.izvanUpotrebeOd} onChange={e => updateField('izvanUpotrebeOd', e.target.value)} />`,
    `<DateInput value={formData.izvanUpotrebeOd} onChange={v => updateField('izvanUpotrebeOd', v)} />`);
addFix(eq,
    `<input className="form-input" type="date" value={formData.posljednji} onChange={e => updateField('posljednji', e.target.value)} />`,
    `<DateInput value={formData.posljednji} onChange={v => updateField('posljednji', v)} />`);
addFix(eq,
    `<input className="form-input" type="date" value={formData.iduci} onChange={e => updateField('iduci', e.target.value)} />`,
    `<DateInput value={formData.iduci} onChange={v => updateField('iduci', v)} />`);
addFix(eq,
    `<input className="form-input" type="date" value={serviceFormData.datum} onChange={e => setServiceFormData(p => ({ ...p, datum: e.target.value }))} />`,
    `<DateInput value={serviceFormData.datum} onChange={v => setServiceFormData(p => ({ ...p, datum: v }))} />`);
addFix(eq,
    `<input className="form-input" type="date" value={serviceFormData.iduciServis} onChange={e => setServiceFormData(p => ({ ...p, iduciServis: e.target.value }))} />`,
    `<DateInput value={serviceFormData.iduciServis} onChange={v => setServiceFormData(p => ({ ...p, iduciServis: v }))} />`);

// ═══════════════════════════════════════════════════
// fire-protection/page.js — 5 date inputs
// ═══════════════════════════════════════════════════
const fp = 'src/app/dashboard/fire-protection/page.js';
addFix(fp,
    `<input className="form-input" type="date" value={extForm.datumNabavke} onChange={e => setExt('datumNabavke', e.target.value)} />`,
    `<DateInput value={extForm.datumNabavke} onChange={v => setExt('datumNabavke', v)} />`);
addFix(fp,
    `<input className="form-input" type="date" value={extForm.zadnjiServis} onChange={e => setExt('zadnjiServis', e.target.value)} />`,
    `<DateInput value={extForm.zadnjiServis} onChange={v => setExt('zadnjiServis', v)} />`);
addFix(fp,
    `<input className="form-input" type="date" value={extForm.sljedeciServis} onChange={e => setExt('sljedeciServis', e.target.value)} />`,
    `<DateInput value={extForm.sljedeciServis} onChange={v => setExt('sljedeciServis', v)} />`);
addFix(fp,
    `<input className="form-input" type="date" value={hydForm.datumZadnjegPregleda} onChange={e => setHyd('datumZadnjegPregleda', e.target.value)} />`,
    `<DateInput value={hydForm.datumZadnjegPregleda} onChange={v => setHyd('datumZadnjegPregleda', v)} />`);
addFix(fp,
    `<input className="form-input" type="date" value={hydForm.sljedeciPregled} onChange={e => setHyd('sljedeciPregled', e.target.value)} />`,
    `<DateInput value={hydForm.sljedeciPregled} onChange={v => setHyd('sljedeciPregled', v)} />`);

// ═══════════════════════════════════════════════════
// workers/page.js — remaining native date inputs (not the Field component ones)
// ═══════════════════════════════════════════════════
const wk = 'src/app/dashboard/workers/page.js';
addFix(wk,
    `<input className="form-input" type="date" value={certFormData.datum} onChange={e => setCertFormData({ ...certFormData, datum: e.target.value })} />`,
    `<DateInput value={certFormData.datum} onChange={v => setCertFormData({ ...certFormData, datum: v })} />`);
addFix(wk,
    `<input className="form-input" type="date" value={certFormData.vrijediDo} onChange={e => setCertFormData({ ...certFormData, vrijediDo: e.target.value })} />`,
    `<DateInput value={certFormData.vrijediDo} onChange={v => setCertFormData({ ...certFormData, vrijediDo: v })} />`);
addFix(wk,
    `<input className="form-input" type="date" value={ppeFormData.datumZaduzenja} onChange={e => setPpeFormData({ ...ppeFormData, datumZaduzenja: e.target.value })} />`,
    `<DateInput value={ppeFormData.datumZaduzenja} onChange={v => setPpeFormData({ ...ppeFormData, datumZaduzenja: v })} />`);
addFix(wk,
    `<input className="form-input" type="date" value={ppeFormData.datumRazduzenja} onChange={e => setPpeFormData({ ...ppeFormData, datumRazduzenja: e.target.value })} />`,
    `<DateInput value={ppeFormData.datumRazduzenja} onChange={v => setPpeFormData({ ...ppeFormData, datumRazduzenja: v })} />`);

// ═══════════════════════════════════════════════════
// ek-ppe/page.js — 1 date input  
// ═══════════════════════════════════════════════════
const ekppe = 'src/app/dashboard/ek-ppe/page.js';
addFix(ekppe,
    `<input className="form-input" type="date" value={assignForm.datumZaduzenja} onChange={e => setAssignForm(f => ({ ...f, datumZaduzenja: e.target.value }))} />`,
    `<DateInput value={assignForm.datumZaduzenja} onChange={v => setAssignForm(f => ({ ...f, datumZaduzenja: v }))} />`);

// ═══════════════════════════════════════════════════
// fleet-assignments/page.js — 1 date input
// ═══════════════════════════════════════════════════
const fa = 'src/app/dashboard/fleet-assignments/page.js';
addFix(fa,
    `<input className="form-input" type="date" value={formData.datumZaduzenja} onChange={e => setFormData(f => ({...f, datumZaduzenja: e.target.value}))} />`,
    `<DateInput value={formData.datumZaduzenja} onChange={v => setFormData(f => ({...f, datumZaduzenja: v}))} />`);

// ═══════════════════════════════════════════════════
// fleet-documents/page.js — 2 date inputs  
// ═══════════════════════════════════════════════════
const fd = 'src/app/dashboard/fleet-documents/page.js';
addFix(fd,
    `<input className="form-input" type="date" value={formData.datumIzdavanja} onChange={e => setFormData(f => ({...f, datumIzdavanja: e.target.value}))} />`,
    `<DateInput value={formData.datumIzdavanja} onChange={v => setFormData(f => ({...f, datumIzdavanja: v}))} />`);
addFix(fd,
    `<input className="form-input" type="date" value={formData.datumIsteka} onChange={e => setFormData(f => ({...f, datumIsteka: e.target.value}))} />`,
    `<DateInput value={formData.datumIsteka} onChange={v => setFormData(f => ({...f, datumIsteka: v}))} />`);

// ═══════════════════════════════════════════════════
// fleet-orders/page.js — 2 date inputs
// ═══════════════════════════════════════════════════
const fo = 'src/app/dashboard/fleet-orders/page.js';
addFix(fo,
    `<input className="form-input" type="date" value={formData.datumPolaska} onChange={e => setFormData(f => ({...f, datumPolaska: e.target.value}))} />`,
    `<DateInput value={formData.datumPolaska} onChange={v => setFormData(f => ({...f, datumPolaska: v}))} />`);
addFix(fo,
    `<input className="form-input" type="date" value={formData.datumPovratka} onChange={e => setFormData(f => ({...f, datumPovratka: e.target.value}))} />`,
    `<DateInput value={formData.datumPovratka} onChange={v => setFormData(f => ({...f, datumPovratka: v}))} />`);

// ═══════════════════════════════════════════════════
// worker-ppe/page.js — 1 date input
// ═══════════════════════════════════════════════════
const wppe = 'src/app/dashboard/worker-ppe/page.js';
addFix(wppe,
    `<input className="form-input" type="date" value={addForm.datumZaduzenja} onChange={e => setAddForm(f => ({ ...f, datumZaduzenja: e.target.value }))} />`,
    `<DateInput value={addForm.datumZaduzenja} onChange={v => setAddForm(f => ({ ...f, datumZaduzenja: v }))} />`);

// ═══════════════════════════════════════════════════
// isznr-documents/page.js — 1 date input
// ═══════════════════════════════════════════════════
const isznrdocs = 'src/app/dashboard/isznr-documents/page.js';
addFix(isznrdocs,
    `<input className="form-input" type="date" value={formData.datum} onChange={e => updateField('datum', e.target.value)} />`,
    `<DateInput value={formData.datum} onChange={v => updateField('datum', v)} />`);

// ═══════════════════════════════════════════════════
// Apply all fixes
// ═══════════════════════════════════════════════════
const byFile = {};
for (const f of fixes) {
    if (!byFile[f.file]) byFile[f.file] = [];
    byFile[f.file].push(f);
}

let totalFixed = 0;
for (const [file, fileFixes] of Object.entries(byFile)) {
    let content = fs.readFileSync(file, 'utf8');
    const orig = content;
    let fixedCount = 0;

    for (const fix of fileFixes) {
        if (content.includes(fix.old)) {
            content = content.replace(fix.old, fix.new);
            fixedCount++;
        } else {
            console.log(`  ⚠️ NOT FOUND in ${file}: ${fix.old.substring(0, 80)}...`);
        }
    }

    // Add DateInput import if needed and changes were made
    if (fixedCount > 0 && !content.includes("from '@/components/DateInput'") && !content.includes('from "@/components/DateInput"')) {
        content = content.replace(
            /^('use client';\r?\n)/,
            `$1import DateInput from '@/components/DateInput';\n`
        );
    }

    if (content !== orig) {
        fs.writeFileSync(file, content, 'utf8');
        totalFixed += fixedCount;
        console.log(`✅ ${file}: ${fixedCount}/${fileFixes.length} replaced`);
    }
}

console.log(`\nTotal: ${totalFixed} date inputs replaced`);
