// fix-encoding.mjs
import fs from 'fs';
const file = 'src/app/dashboard/settings/page.js';
const text = fs.readFileSync(file, 'utf8');

// The file was saved as windows-1252 (or ISO-8859-1 mapping) but contains UTF-8 bytes.
// We decode the JS string characters back into single bytes, then parse as UTF-8.
let buffer;
try {
  buffer = Buffer.from(text, 'latin1');
} catch (e) {
  console.log("Latin1 conversion failed, it's maybe not purely latin1 space");
}

if (buffer) {
    try {
        const fixed = buffer.toString('utf8');
        // Let's verify if "Spremi" appears in the fixed text
        if (fixed.includes("Sačuvano") || fixed.includes("Branding kompanije")) {
            fs.writeFileSync(file, fixed, 'utf8');
            console.log("Successfully fixed encoding!");
        } else {
            console.log("Fix didn't produce expected keywords.");
        }
    } catch (e) {
        console.log("Error interpreting as utf8:", e.message);
    }
}
