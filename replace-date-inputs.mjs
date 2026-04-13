/**
 * replace-date-inputs.mjs
 * 
 * Safely replaces <input ... type="date" ... /> with <DateInput ... /> across all pages.
 * Uses Node.js fs with explicit UTF-8 encoding to preserve special characters.
 *
 * Run from: c:\Users\zzida\Desktop\znrba\app
 * Command: node replace-date-inputs.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, 'src');

// Files to skip (already handled manually, or the DateInput component itself)
const SKIP = [
    'src/components/DateInput.js',
    'src/app/dashboard/workers/page.js', // already fixed with custom DateField
];

let totalFiles = 0;
let modifiedFiles = 0;

function processFile(filePath) {
    const rel = path.relative(__dirname, filePath).replace(/\\/g, '/');
    if (SKIP.some(s => rel.endsWith(s.replace(/\\/g, '/')))) {
        console.log(`  SKIP: ${rel}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Only process files that have type="date"
    if (!content.includes('type="date"') && !content.includes("type='date'")) return;

    totalFiles++;

    // 1. Add DateInput import if not already present
    const hasDateInputImport = content.includes("from '@/components/DateInput'") || content.includes('from "@/components/DateInput"');
    
    if (!hasDateInputImport) {
        // Add after 'use client'; or first import line
        content = content.replace(
            /^('use client';\n|"use client";\n)/,
            `$1import DateInput from '@/components/DateInput';\n`
        );
    }

    // 2. Replace standalone <input ... type="date" ... /> patterns
    // Pattern: <input className="form-input" type="date" value={X} onChange={Y} />
    // → <DateInput value={X} onChange={e => Y(e.target.value)} />
    // This regex handles: className="form-input" type="date" in any order, with value and onChange

    // Replace the most common pattern: value={X} onChange={e => set('field', e.target.value)}
    // We do several targeted replacements

    // Pattern A: <input className="form-input" type="date" value={VAR} onChange={HANDLER} />
    // common in diseases, injuries, medical-exams, etc.
    content = content.replace(
        /<input\s+className="form-input"\s+type="date"\s+value=\{([^}]+)\}\s+onChange=\{[^}]*e\s*=>\s*set\('([^']+)',\s*e\.target\.value\)\}\s*\/>/g,
        (_, val, field) => `<DateInput value={${val}} onChange={v => set('${field}', v)} />`
    );

    // Pattern B: <input className="form-input" type="date" value={X} onChange={e => setX(e.target.value)} />
    content = content.replace(
        /<input\s+className="form-input"\s+type="date"\s+value=\{([^}]+)\}\s+onChange=\{e\s*=>\s*(\w+)\(e\.target\.value\)\}\s*\/>/g,
        (_, val, setter) => `<DateInput value={${val}} onChange={${setter}} />`
    );

    // Pattern C: <input className="form-input" type="date" value={X} onChange={e => onChange(e.target.value)} />  
    content = content.replace(
        /<input\s+className="form-input"\s+type="date"\s+value=\{([^}]+)\}\s+onChange=\{e\s*=>\s*onChange\(e\.target\.value\)\}\s*\/>/g,
        (_, val) => `<DateInput value={${val}} onChange={onChange} />`
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  MODIFIED: ${rel}`);
        modifiedFiles++;
    } else {
        console.log(`  UNCHANGED (manual review needed): ${rel} - has type="date" but pattern not matched`);
    }
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.next') continue;
            walkDir(full);
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
            processFile(full);
        }
    }
}

console.log('Starting date input replacement...\n');
walkDir(srcDir);
console.log(`\nDone. ${modifiedFiles} of ${totalFiles} files with type="date" were modified.`);
console.log('Files with unmatched patterns need manual review.');
