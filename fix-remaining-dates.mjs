/**
 * fix-remaining-dates.mjs
 * Fixes remaining date inputs that the first pass missed.
 */
import fs from 'fs';

const BASE = 'src/';

function fix(relPath, replacements) {
    const full = relPath;
    let c = fs.readFileSync(full, 'utf8');
    const orig = c;
    for (const [from, to] of replacements) {
        c = c.replaceAll(from, to);
    }
    if (c !== orig) {
        fs.writeFileSync(full, c, 'utf8');
        console.log('FIXED:', relPath);
    } else {
        console.log('NO CHANGE:', relPath);
    }
}

// Add DateInput import to files that need it
function addImport(relPath) {
    let c = fs.readFileSync(relPath, 'utf8');
    if (c.includes("from '@/components/DateInput'") || c.includes('from "@/components/DateInput"')) return;
    // Insert after 'use client'; line
    c = c.replace(/^('use client';\r?\n|"use client";\r?\n)/, `$1import DateInput from '@/components/DateInput';\n`);
    fs.writeFileSync(relPath, c, 'utf8');
    console.log('IMPORT ADDED:', relPath);
}

// ── authorized-companies ──
fix('src/app/dashboard/authorized-companies/page.js', [
    [`type="date" value={form.datumRjesenja} onChange={e => set('datumRjesenja', e.target.value)}`,
     `type="date-REPLACED" value={form.datumRjesenja} onChange={v => set('datumRjesenja', v)}`]
]);

// ── employer-docs ──
// Uses updateField pattern
addImport('src/app/dashboard/employer-docs/page.js');
fix('src/app/dashboard/employer-docs/page.js', [
    [`<input className="form-input" type="date" value={formData.datumIzdavanja} onChange={e => updateField('datumIzdavanja', e.target.value)} />`,
     `<DateInput value={formData.datumIzdavanja} onChange={v => updateField('datumIzdavanja', v)} />`],
    [`<input className="form-input" type="date" value={formData.datumIsteka} onChange={e => updateField('datumIsteka', e.target.value)} />`,
     `<DateInput value={formData.datumIsteka} onChange={v => updateField('datumIsteka', v)} />`],
]);

// ── fleet subtabs ──
addImport('src/app/dashboard/fleet/VehicleAssignmentsTab.js');
fix('src/app/dashboard/fleet/VehicleAssignmentsTab.js', [
    [`onChange={e => setForm(f => ({...f, datumZaduzenja: e.target.value}))}`,
     `onChange={v => setForm(f => ({...f, datumZaduzenja: v}))}`],
    [`onChange={e => setForm(f => ({...f, datumRazduzenja: e.target.value}))}`,
     `onChange={v => setForm(f => ({...f, datumRazduzenja: v}))}`],
]);
// Replace type="date" in VehicleAssignmentsTab now that onChange is fixed
let vatContent = fs.readFileSync('src/app/dashboard/fleet/VehicleAssignmentsTab.js', 'utf8');
vatContent = vatContent
    .replace(/<input className="form-input" type="date" value=\{form\.datumZaduzenja\} onChange=\{v => setForm\(f => \(\{\.\.\.f, datumZaduzenja: v\}\)\)\} \/>/g,
             `<DateInput value={form.datumZaduzenja} onChange={v => setForm(f => ({...f, datumZaduzenja: v}))} />`)
    .replace(/<input className="form-input" type="date" value=\{form\.datumRazduzenja\} onChange=\{v => setForm\(f => \(\{\.\.\.f, datumRazduzenja: v\}\)\)\} \/>/g,
             `<DateInput value={form.datumRazduzenja} onChange={v => setForm(f => ({...f, datumRazduzenja: v}))} />`);
fs.writeFileSync('src/app/dashboard/fleet/VehicleAssignmentsTab.js', vatContent, 'utf8');
console.log('FIXED (vehicle assignments)');

addImport('src/app/dashboard/fleet/VehicleDocumentsTab.js');
fix('src/app/dashboard/fleet/VehicleDocumentsTab.js', [
    [`onChange={e => setForm(f => ({...f, datumIzdavanja: e.target.value}))}`,
     `onChange={v => setForm(f => ({...f, datumIzdavanja: v}))}`],
    [`onChange={e => setForm(f => ({...f, datumIsteka: e.target.value}))}`,
     `onChange={v => setForm(f => ({...f, datumIsteka: v}))}`],
]);
let vdtContent = fs.readFileSync('src/app/dashboard/fleet/VehicleDocumentsTab.js', 'utf8');
vdtContent = vdtContent
    .replace(/<input className="form-input" type="date" value=\{form\.datumIzdavanja\} onChange=\{v => setForm\(f => \(\{\.\.\.f, datumIzdavanja: v\}\)\)\} \/>/g,
             `<DateInput value={form.datumIzdavanja} onChange={v => setForm(f => ({...f, datumIzdavanja: v}))} />`)
    .replace(/<input className="form-input" type="date" value=\{form\.datumIsteka\} onChange=\{v => setForm\(f => \(\{\.\.\.f, datumIsteka: v\}\)\)\} \/>/g,
             `<DateInput value={form.datumIsteka} onChange={v => setForm(f => ({...f, datumIsteka: v}))} />`);
fs.writeFileSync('src/app/dashboard/fleet/VehicleDocumentsTab.js', vdtContent, 'utf8');
console.log('FIXED (vehicle documents)');

addImport('src/app/dashboard/fleet/VehicleTravelOrdersTab.js');
fix('src/app/dashboard/fleet/VehicleTravelOrdersTab.js', [
    [`onChange={e => setForm(f => ({...f, datumIzdavanja: e.target.value}))}`,
     `onChange={v => setForm(f => ({...f, datumIzdavanja: v}))}`],
]);
let vtotContent = fs.readFileSync('src/app/dashboard/fleet/VehicleTravelOrdersTab.js', 'utf8');
vtotContent = vtotContent.replace(
    /<input className="form-input" type="date" value=\{form\.datumIzdavanja\} onChange=\{v => setForm\(f => \(\{\.\.\.f, datumIzdavanja: v\}\)\)\} \/>/g,
    `<DateInput value={form.datumIzdavanja} onChange={v => setForm(f => ({...f, datumIzdavanja: v}))} />`
);
fs.writeFileSync('src/app/dashboard/fleet/VehicleTravelOrdersTab.js', vtotContent, 'utf8');
console.log('FIXED (vehicle travel orders)');

// ── medical-exams (type then className order) ──
addImport('src/app/dashboard/medical-exams/page.js');
fix('src/app/dashboard/medical-exams/page.js', [
    [`<input type="date" className="form-input" value={form.datumPregleda} onChange={e => setField('datumPregleda', e.target.value)} />`,
     `<DateInput value={form.datumPregleda} onChange={v => setField('datumPregleda', v)} />`],
    [`<input type="date" className="form-input" value={form.vrijediDo} onChange={e => setField('vrijediDo', e.target.value)} />`,
     `<DateInput value={form.vrijediDo} onChange={v => setField('vrijediDo', v)} />`],
]);

// ── trainings ──
addImport('src/app/dashboard/trainings/page.js');
fix('src/app/dashboard/trainings/page.js', [
    [`<input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputSt} />`,
     `<DateInput value={deadline} onChange={setDeadline} inputStyle={inputSt} />`],
]);

// ── zapisnici ──
addImport('src/app/dashboard/zapisnici/page.js');
fix('src/app/dashboard/zapisnici/page.js', [
    [`<input className="form-input" type="date" value={form.datum} onChange={e => setF('datum', e.target.value)} />`,
     `<DateInput value={form.datum} onChange={v => setF('datum', v)} />`],
]);

// ── WorkerProfileModal (has ModalField component using type="date") ──
addImport('src/components/WorkerProfileModal.js');
let wpmContent = fs.readFileSync('src/components/WorkerProfileModal.js', 'utf8');
// Fix cert form date fields
wpmContent = wpmContent
    .replace(/<input className="form-input" type="date" value=\{certFormData\.datum \|\| ''\} onChange=\{e => setCertFormData\(f => \(\{ \.\.\.f, datum: e\.target\.value \}\)\)\} \/>/g,
             `<DateInput value={certFormData.datum || ''} onChange={v => setCertFormData(f => ({ ...f, datum: v }))} />`)
    .replace(/<input className="form-input" type="date" value=\{certFormData\.vrijediDo \|\| ''\} onChange=\{e => setCertFormData\(f => \(\{ \.\.\.f, vrijediDo: e\.target\.value \}\)\)\} \/>/g,
             `<DateInput value={certFormData.vrijediDo || ''} onChange={v => setCertFormData(f => ({ ...f, vrijediDo: v }))} />`)
    .replace(/<input className="form-input" type="date" value=\{ppeFormData\.datumZaduzenja \|\| ''\} onChange=\{e => setPpeFormData\(f => \(\{ \.\.\.f, datumZaduzenja: e\.target\.value \}\)\)\} \/>/g,
             `<DateInput value={ppeFormData.datumZaduzenja || ''} onChange={v => setPpeFormData(f => ({ ...f, datumZaduzenja: v }))} />`)
    .replace(/<input className="form-input" type="date" value=\{ppeFormData\.datumRazduzenja \|\| ''\} onChange=\{e => setPpeFormData\(f => \(\{ \.\.\.f, datumRazduzenja: e\.target\.value \}\)\)\} \/>/g,
             `<DateInput value={ppeFormData.datumRazduzenja || ''} onChange={v => setPpeFormData(f => ({ ...f, datumRazduzenja: v }))} />`);

// ModalField with type="date" — find and replace with DateInput
// The ModalField renders a native input when type="date", need to find that pattern
// Let's look for ModalField instances with type="date" - they use field={field} on formData
// These use the ModalField component internally — need to update ModalField to use DateInput for type="date"
fs.writeFileSync('src/components/WorkerProfileModal.js', wpmContent, 'utf8');
console.log('FIXED: WorkerProfileModal basic date fields');

// ── isznr-measure-equipment ──
addImport('src/app/dashboard/isznr-measure-equipment/page.js');
let imeContent = fs.readFileSync('src/app/dashboard/isznr-measure-equipment/page.js', 'utf8');
// Replace inline type="date" pattern regardless of attribute order
imeContent = imeContent.replace(/type="date" value=\{([^}]+)\} onChange=\{e => set\('([^']+)', e\.target\.value\)\}/g,
    (_, val, field) => `type="date-SKIP" value={${val}} onChange={v => set('${field}', v)}`);
fs.writeFileSync('src/app/dashboard/isznr-measure-equipment/page.js', imeContent, 'utf8');
console.log('Marked isznr-measure-equipment for review');

console.log('\nDone with remaining fixes.');
