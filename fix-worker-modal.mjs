/**
 * fix-worker-modal.mjs
 * Fixes WorkerProfileModal.js ModalField component to use DateInput + fmtDate
 */
import fs from 'fs';

const file = 'src/components/WorkerProfileModal.js';
let c = fs.readFileSync(file, 'utf8');
const orig = c;

// 1. Add fmtDate import after DateInput import
if (!c.includes("from '@/lib/dateUtils'")) {
    c = c.replace(
        `import DateInput from '@/components/DateInput';\n`,
        `import DateInput from '@/components/DateInput';\nimport { fmtDate } from '@/lib/dateUtils';\n`
    );
}

// 2. Fix ModalField - replace the else clause to handle type="date" in edit mode
// And in view mode show fmtDate for dates
// The patterns with both \r\n and \n line endings

// Fix edit mode: replace the plain input to use DateInput for type="date"
const oldEditInput = `                ) : (\r\n                    <input className="form-input" type={type} value={formData[field] || ''} onChange={e => set(field, type === 'number' ? Number(e.target.value) : e.target.value)} />\r\n                )`;
const newEditInput = `                ) : type === 'date' ? (\r\n                    <DateInput value={formData[field] || ''} onChange={v => set(field, v)} />\r\n                ) : (\r\n                    <input className="form-input" type={type} value={formData[field] || ''} onChange={e => set(field, type === 'number' ? Number(e.target.value) : e.target.value)} />\r\n                )`;

c = c.replace(oldEditInput, newEditInput);

// Fix view mode: show fmtDate for date fields
const oldViewDate = `                    type === 'checkbox' ? (formData[field] ? (lang === 'bs' ? 'Da' : 'Yes') : (lang === 'bs' ? 'Ne' : 'No'))\r\n                        : opts ? (opts.find(o => o.value === formData[field])?.label || '—')\r\n                            : (formData[field] || '—')`;
const newViewDate = `                    type === 'checkbox' ? (formData[field] ? (lang === 'bs' ? 'Da' : 'Yes') : (lang === 'bs' ? 'Ne' : 'No'))\r\n                        : opts ? (opts.find(o => o.value === formData[field])?.label || '—')\r\n                        : type === 'date' ? (fmtDate(formData[field]) || '—')\r\n                        : (formData[field] || '—')`;

c = c.replace(oldViewDate, newViewDate);

if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    console.log('WorkerProfileModal.js FIXED');
} else {
    console.log('NO CHANGE - check patterns manually');
    // Try to find the exact bytes
    const idx1 = orig.indexOf('type === \'number\' ? Number');
    console.log('Found number check at index:', idx1);
    if (idx1 > -1) {
        console.log('Context:', JSON.stringify(orig.substring(idx1 - 50, idx1 + 100)));
    }
}
