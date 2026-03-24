const cheerio = require('cheerio');
const fs = require('fs');

function cleanText(txt) {
    let t = txt.trim().replace(/\s+/g, ' ');
    // Remove "a) " or "A. " prefixes if they somehow got into text
    t = t.replace(/^[a-z]\)\s*/i, '');
    return t;
}

function parseHTML(filename) {
    const html = fs.readFileSync(filename, 'utf-8');
    const $ = cheerio.load(html);
    
    // We will just read all text nodes and rely on the text pattern!
    // Since Mammoth might flatten some lists, let's just grab all paragraph and list item texts in order.
    
    const allTexts = [];
    $('p, li').each((i, el) => {
        const t = $(el).text().trim();
        if (t) allTexts.push(t);
    });
    
    const questions = [];
    let currentQ = null;
    
    let started = false;
    let qCount = 1;
    
    for (let t of allTexts) {
        // Start heuristics
        if (t.includes('TEORETSKI DIO PROVJERE') || t.includes('DEFINISAN JE?') || t.includes('OBLAST ZAŠTITE OD POŽARA UVRĐENA')) {
            started = true;
        }
        if (t.includes('PRAKTIČNI DIO PROVJERE')) {
            started = false;
        }
        
        if (!started) continue;
        
        // Is it a question? (e.g. starts with "1. ")
        const mQ = t.match(/^(\d+)\.\s+(.*)/);
        // Is it an option? (e.g. "a) ")
        // Wait, mammoth might output "a)" as list numbering? 
        // If it's a list item, mammoth strips the "a)" and just gives the text!
        // We can check if it's an option if it's NOT a question and we have a current question.
        
        if (mQ && (t.endsWith('?') || t.endsWith(':') || t.length > 5) && !t.startsWith('1. OBLAST')) {
            if (currentQ) {
                questions.push(currentQ);
            }
            // Mammoth sometimes messes up exact numbers, so we just auto-increment
            currentQ = {
                id: qCount++,
                text: mQ[2],
                options: []
            };
        } else if (currentQ) {
            // Is it an option? If it has "a)" we strip it, else we assume it's an option.
            let isOption = false;
            let optText = t;
            
            const mOpt = t.match(/^([a-k])\)\s*(.*)/i);
            if (mOpt) {
                isOption = true;
                optText = mOpt[2];
            } else if (t.length > 0) {
                isOption = true; // It's just a bullet point
            }
            
            if (isOption) {
                // assign letter
                const letters = ['a', 'b', 'c', 'd', 'e'];
                const idx = currentQ.options.length;
                const letter = letters[idx] || 'x';
                currentQ.options.push({
                    label: letter,
                    text: optText
                });
            }
        }
    }
    if (currentQ) questions.push(currentQ);
    
    return questions;
}

try {
    const zop = parseHTML('Test ZOP.html');
    const znr = parseHTML('3.1. TEST ZNR.html');
    
    console.log("ZOP:", zop.length);
    console.log("ZNR:", znr.length);
    
    fs.writeFileSync('extracted_final.json', JSON.stringify({zop, znr}, null, 2));
} catch(e) {
    console.error(e);
}
