import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// EMOJI DEDUP MAP — give each page a unique, contextually meaningful emoji
// ═══════════════════════════════════════════════════════════════════════════════

const emojiMap = {
  // DUPLICATES FIXED:
  // ⚙️ was: equipment, equipment-types, settings
  'equipment/page.js':        { old: '⚙️', new: '🔩' },           // Gears → Nut & bolt (specific equipment)
  'equipment-types/page.js':  { old: '⚙️', new: '🏭' },           // Gears → Factory (types catalog)
  'settings/page.js':         { old: '⚙️', new: '⚙️' },           // Keep ⚙️ — most intuitive for Settings

  // 🏛️ was: isznr-documents, isznr-parties
  'isznr-documents/page.js':  { old: '🏛️', new: '🏛️' },           // Keep — official documents
  'isznr-parties/page.js':    { old: '🏛️', new: '🤝' },           // Buildings → Handshake (parties)

  // 🏢 was: admin/companies, org-units
  'admin/companies/page.js':  { old: '🏢', new: '🏢' },           // Keep — companies
  'org-units/page.js':        { old: '🏢', new: '🗂️' },           // Building → Card index (org structure)

  // 📄 was: form-oir1, form-ro1, form-ro2, worker-certificates/edit
  'form-oir1/page.js':        { old: '📄', new: '📑' },           // Page → Bookmark tabs
  'form-ro1/page.js':         { old: '📄', new: '📃' },           // Page → Page with curl
  'form-ro2/page.js':         { old: '📄', new: '📄' },           // Keep one as 📄
  'worker-certificates/edit/[id]/page.js': { old: '📄', new: '✏️' }, // Page → Pencil (editing)

  // 📇 was: ek-equipment, ek-workers
  'ek-equipment/page.js':     { old: '📇', new: '📇' },           // Keep — card index
  'ek-workers/page.js':       { old: '📇', new: '🪪' },           // Card → ID card

  // 📋 was: exam-types, isznr-doc-types, workplace-list
  'exam-types/page.js':       { old: '📋', new: '🧪' },           // Clipboard → Test tube
  'isznr-doc-types/page.js':  { old: '📋', new: '🗃️' },           // Clipboard → Card file box
  'workplace-list/page.js':   { old: '📋', new: '📋' },           // Keep

  // 📍 was: counties, places
  'counties/page.js':         { old: '📍', new: '🗺️' },           // Pin → World map
  'places/page.js':           { old: '📍', new: '📍' },           // Keep

  // 📝 was: requests, tests-zop-znr
  'requests/page.js':         { old: '📝', new: '📨' },           // Memo → Incoming envelope
  'tests-zop-znr/page.js':    { old: '📝', new: '📝' },           // Keep

  // 🦺 was: ek-ppe, ppe, worker-ppe
  'ek-ppe/page.js':           { old: '🦺', new: '🧤' },           // Vest → Gloves (PPE catalog)
  'ppe/page.js':              { old: '🦺', new: '🦺' },           // Keep — main PPE page
  'worker-ppe/page.js':       { old: '🦺', new: '🥽' },           // Vest → Goggles (worker-specific)

  // 🩺 was: doctors, referral-ra1
  'doctors/page.js':          { old: '🩺', new: '👨‍⚕️' },          // Stethoscope → Doctor
  'referral-ra1/page.js':     { old: '🩺', new: '🩺' },           // Keep — medical referral
};

// ═══════════════════════════════════════════════════════════════════════════════
// APPLY EMOJI CHANGES
// ═══════════════════════════════════════════════════════════════════════════════

let changed = 0;
for (const [relPath, { old: oldEmoji, new: newEmoji }] of Object.entries(emojiMap)) {
  if (oldEmoji === newEmoji) continue; // skip unchanged

  const fullPath = path.join('src/app/dashboard', relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${fullPath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace ONLY the first occurrence in <h1> tag context to avoid replacing emojis
  // used in other places (buttons, tooltips, etc.)
  const h1Regex = new RegExp(`(<h1[^>]*>\\s*\\n?\\s*)${oldEmoji.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, '');
  if (h1Regex.test(content)) {
    content = content.replace(h1Regex, `$1${newEmoji}`);
    fs.writeFileSync(fullPath, content);
    changed++;
    console.log(`✅ ${relPath}: ${oldEmoji} → ${newEmoji}`);
  } else {
    console.log(`⏭️  ${relPath}: pattern not found in <h1>`);
  }
}

console.log(`\n🎉 Changed ${changed} page header emojis.`);
