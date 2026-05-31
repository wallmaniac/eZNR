/**
 * Automated script to convert hardcoded `lang !== 'en' ? 'BS text' : 'EN text'`
 * patterns to `t('key')` calls across the entire codebase.
 * 
 * Run: node scripts/extract-i18n.js
 * 
 * Strategy:
 * 1. Scan all .js files in src/app/dashboard/ and src/components/
 * 2. Find all `lang !== 'en' ? 'text1' : 'text2'` patterns
 * 3. Generate a key from the BS text (slugified)
 * 4. Add to translations.js for all 6 languages
 * 5. Replace inline ternary with t('key')
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ── Patterns to match ──
// Handles: lang !== 'en' ? 'text' : 'text'
//          lang === 'bs' ? 'text' : 'text'  
//          lang === 'en' ? 'text' : 'text'  (inverted)
const PATTERNS = [
  // lang !== 'en' ? 'BS' : 'EN'  (most common — single quotes)
  /lang\s*!==\s*'en'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g,
  // lang !== 'en' ? "BS" : "EN"  (double quotes)
  /lang\s*!==\s*'en'\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g,
  // lang === 'bs' ? 'BS' : 'EN' 
  /lang\s*===\s*'bs'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g,
  // lang === 'en' ? 'EN' : 'BS' (inverted)  
  /lang\s*===\s*'en'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g,
];

// ── Key generation ──
function slugify(text) {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9\s]/g, '') // remove special chars
    .trim()
    .split(/\s+/)
    .slice(0, 5)  // max 5 words
    .map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

// ── Translation lookup maps ──
// For de/sl/sr, we use a best-effort approach: map the BS text to a known translation
// For now, we keep BS text as fallback for de/sl/sr if no translation exists
const transPath = path.join(__dirname, '..', 'src', 'i18n', 'translations.js');

function readTranslations() {
  // Temporarily load the translations object
  const content = fs.readFileSync(transPath, 'utf-8');
  // Extract just the object (skip `export const translations = ` and trailing `export function`)
  const match = content.match(/export const translations = (\{[\s\S]*?\n\};)/);
  if (!match) throw new Error('Could not parse translations.js');
  // eslint-disable-next-line no-eval
  const translations = eval('(' + match[1].replace(/\};$/, '}') + ')');
  return translations;
}

// ── Collect all unique strings first ──
function collectStrings(files) {
  const collected = new Map(); // key -> { bs, en }
  const usedKeys = new Set();
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    
    for (const pattern of PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let bs, en;
        
        // Determine which group is BS and which is EN based on the pattern
        if (pattern.source.includes("=== 'en'")) {
          // lang === 'en' ? EN : BS (inverted)
          en = match[1];
          bs = match[2];
        } else {
          // lang !== 'en' ? BS : EN or lang === 'bs' ? BS : EN
          bs = match[1];
          en = match[2];
        }
        
        // Skip very short strings (likely not translatable)
        if (bs.length < 2 && en.length < 2) continue;
        
        // Generate key
        let key = slugify(bs);
        if (!key || key.length < 2) key = slugify(en);
        if (!key || key.length < 2) continue;
        
        // Handle duplicates — ensure unique keys
        let finalKey = key;
        let counter = 1;
        while (usedKeys.has(finalKey) && collected.get(finalKey)?.bs !== bs) {
          finalKey = key + counter;
          counter++;
        }
        
        if (!collected.has(finalKey)) {
          collected.set(finalKey, { bs, en });
          usedKeys.add(finalKey);
        }
      }
    }
  }
  
  return collected;
}

// ── Replace in files ──
function replaceInFiles(files, keyMap) {
  let totalReplacements = 0;
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;
    
    // Check if file already imports t from translations or useLanguage
    const hasUseLanguage = content.includes('useLanguage');
    const hasT = content.includes('const { t') || content.includes('const {t') || 
                 content.includes(', t }') || content.includes(', t,') || content.includes(', t }');
    
    for (const [fullPattern, isInverted] of [
      [/lang\s*!==\s*'en'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g, false],
      [/lang\s*!==\s*'en'\s*\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g, false],
      [/lang\s*===\s*'bs'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g, false],
      [/lang\s*===\s*'en'\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g, true],
    ]) {
      fullPattern.lastIndex = 0;
      content = content.replace(fullPattern, (match, g1, g2) => {
        const bs = isInverted ? g2 : g1;
        const en = isInverted ? g1 : g2;
        
        // Find the key for this pair
        for (const [key, val] of keyMap) {
          if (val.bs === bs && val.en === en) {
            totalReplacements++;
            modified = true;
            return `t('${key}')`;
          }
        }
        return match; // no match found, keep original
      });
    }
    
    if (modified) {
      // Ensure t is destructured from useLanguage if it uses useLanguage
      if (hasUseLanguage && !hasT) {
        // Add t to the existing useLanguage destructuring
        content = content.replace(
          /const\s*\{\s*lang\s*(,\s*setLang)?\s*\}\s*=\s*useLanguage\(\)/,
          (m, setLangPart) => {
            if (m.includes(', t')) return m; // already has t
            return m.replace('}', ', t }');
          }
        );
      }
      
      fs.writeFileSync(file, content, 'utf-8');
    }
  }
  
  return totalReplacements;
}

// ── Add keys to translations.js ──
function addKeysToTranslations(keyMap) {
  let content = fs.readFileSync(transPath, 'utf-8');
  
  // For each language, add the new keys at the end of their block
  const languages = ['bs', 'hr', 'en', 'de', 'sl', 'sr'];
  
  // Simple approach: add new keys to the bs block's end, then use the `t()` fallback
  // The t() function already falls back to bs, so we primarily need bs and en
  
  // Build the new keys string for bs
  const newBsKeys = [];
  const newEnKeys = [];
  
  for (const [key, { bs, en }] of keyMap) {
    // Check if key already exists
    if (content.includes(`${key}: '`)) continue;
    
    const escapedBs = bs.replace(/'/g, "\\'");
    const escapedEn = en.replace(/'/g, "\\'");
    newBsKeys.push(`    ${key}: '${escapedBs}',`);
    newEnKeys.push(`    ${key}: '${escapedEn}',`);
  }
  
  if (newBsKeys.length === 0) {
    console.log('No new keys to add to translations.js');
    return 0;
  }
  
  // Insert new bs keys before the closing of bs block
  // Find first `  },` after `bs: {`
  const bsStart = content.indexOf("  bs: {");
  const bsEnd = content.indexOf("\n  },", bsStart);
  if (bsEnd === -1) {
    console.error('Could not find bs block end');
    return 0;
  }
  
  const bsInsert = '\n    // ── Auto-extracted strings ──\n' + newBsKeys.join('\n') + '\n';
  content = content.substring(0, bsEnd) + bsInsert + content.substring(bsEnd);
  
  // Now find en block and add en keys
  const enStart = content.indexOf("  en: {");
  const enEnd = content.indexOf("\n  },", enStart);
  if (enEnd !== -1) {
    const enInsert = '\n    // ── Auto-extracted strings ──\n' + newEnKeys.join('\n') + '\n';
    content = content.substring(0, enEnd) + enInsert + content.substring(enEnd);
  }
  
  // For hr, de, sl, sr — the t() fallback to bs handles missing keys
  // But we should add hr keys (same as bs for most strings)
  
  fs.writeFileSync(transPath, content, 'utf-8');
  return newBsKeys.length;
}

// ── Main ──
async function main() {
  console.log('🔍 Scanning for hardcoded i18n strings...\n');
  
  const dashboardFiles = glob.sync(path.join(__dirname, '..', 'src', 'app', 'dashboard', '**', '*.js'));
  const componentFiles = glob.sync(path.join(__dirname, '..', 'src', 'components', '**', '*.js'));
  const allFiles = [...dashboardFiles, ...componentFiles];
  
  console.log(`   Found ${allFiles.length} JS files to scan`);
  
  // Step 1: Collect all unique string pairs
  const keyMap = collectStrings(allFiles);
  console.log(`   Found ${keyMap.size} unique translation pairs\n`);
  
  // Step 2: Add new keys to translations.js
  const added = addKeysToTranslations(keyMap);
  console.log(`   Added ${added} new keys to translations.js\n`);
  
  // Step 3: Replace ternaries with t() calls
  const replaced = replaceInFiles(allFiles, keyMap);
  console.log(`✅ Replaced ${replaced} hardcoded ternaries with t() calls\n`);
  
  // Show sample keys
  let count = 0;
  for (const [key, { bs, en }] of keyMap) {
    if (count < 10) {
      console.log(`   ${key}: '${bs}' → '${en}'`);
      count++;
    }
  }
  if (keyMap.size > 10) console.log(`   ... and ${keyMap.size - 10} more`);
}

main().catch(console.error);
