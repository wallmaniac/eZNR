import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// The exact string to locate the start of the block.
const startAnchor = `<h3 style={{ margin: 0 }}>{lang === 'bs' ? 'Branding kompanije' : 'Company Branding'}</h3>`;
// The exact string to locate the end of the block.
const endAnchor = `Reset to defaults'}</button>\n                </div>`;

const idxStart = content.indexOf(startAnchor);
const idxEnd = content.indexOf(endAnchor, idxStart);

if (idxStart === -1 || idxEnd === -1) {
    console.error("Anchors not found!");
    process.exit(1);
}

// Find the line preceding startAnchor to catch the flex container if needed, but we'll just replace from the <hr> above it.
const hrAnchor = `<hr style={{ margin: '28px 0', border: 'none', borderTop: '2px solid var(--border)' }} />`;
const trueStart = content.indexOf(hrAnchor, idxStart - 300);

if(trueStart === -1) {
    console.error("HR Start not found");
    process.exit(1);
}

// We will replace from `trueStart` up to `idxEnd + endAnchor.length` + a few divs if needed.
// Wait, the end anchor `Reset to defaults'}</button>\n                </div>` is inside the PDF branding block or after it?
// Actually, earlier in `page.js`, we had the UI branding card.
// Let's find the absolute end of the UI Branding card.
const uiCardEndAnchor = `onChange={e => setSidebarText(e.target.value)}`;
const trueEnd = content.indexOf('</div>', content.indexOf(uiCardEndAnchor)) + 50; 
// We will replace up to the next safe component. Let's find the exact chunk manually with regex or substrings.

// BETTER STRATEGY: Read lines and slice into an array.
const lines = content.split('\n');
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('hr style={{ margin: \\'28px 0\\', border: \\'none\\', borderTop: \\'2px solid var(--border)\\' }}')) {
        startLine = i; // This is the start of the entire branding module
    }
    if (startLine !== -1 && lines[i].includes('setSidebarText(e.target.value)') ) {
        // Find the boundary of this div
        for (let j = i; j < i + 30; j++) {
            if (lines[j].includes('</div>{/* end pdf card body */}')) {
                // Not here
            }
            // We know the structure. We can just run from startLine until the end of the App Branding Card.
        }
    }
}
