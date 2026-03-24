const cheerio = require('cheerio');
const fs = require('fs');

function parseHTML(filename) {
    const html = fs.readFileSync(filename, 'utf-8');
    const $ = cheerio.load(html);
    const allTexts = [];
    $('p, li').each((i, el) => {
        const t = $(el).text().trim();
        if (t && t.length > 2 && !t.includes('...........')) allTexts.push(t);
    });
    
    const questions = [];
    let currentQ = null;
    let started = false;
    let qCount = 1;
    
    for (let i = 0; i < allTexts.length; i++) {
        let t = allTexts[i];
        
        // ZOP trigger
        if (t.includes('OBLAST ZAŠTITE OD POŽARA U FBIH DEFINISAN JE?')) {
            started = true;
            // parse as first question
            currentQ = { id: qCount++, text: 'OBLAST ZAŠTITE OD POŽARA U FBIH DEFINISAN JE?', options: [] };
            continue;
        }
        // ZNR trigger
        if (t.includes('ZAŠTITA NA RADU OBUHVATA:')) {
            started = true;
            currentQ = { id: qCount++, text: 'ZAŠTITA NA RADU OBUHVATA:', options: [] };
            continue;
        }
        
        if (t.includes('PRAKTIČNI DIO PROVJERE')) {
            started = false;
        }
        
        if (!started) continue;
        
        const mQ = t.match(/^(\d+)\.\s*(.*)/);
        
        if (mQ || t.endsWith(':') || t.endsWith('?')) {
            if (currentQ) questions.push(currentQ);
            let qText = mQ ? mQ[2] : t;
            currentQ = { id: qCount++, text: qText, options: [] };
        } else if (currentQ) {
            // Is option
            let optText = t;
            const mOpt = t.match(/^([a-k])\)\s*(.*)/i);
            if (mOpt) optText = mOpt[2];
            
            const letters = ['a', 'b', 'c', 'd', 'e'];
            const idx = currentQ.options.length;
            currentQ.options.push({ label: letters[idx] || 'x', text: optText });
        }
    }
    if (currentQ) questions.push(currentQ);
    return questions;
}

try {
    const zop = parseHTML('C:/Users/zzida/Desktop/znrba/Test ZOP.html');
    const znr = parseHTML('C:/Users/zzida/Desktop/znrba/3.1. TEST ZNR.html');
    console.log('ZOP:', zop.length);
    console.log('ZNR:', znr.length);
    fs.writeFileSync('extracted_tests.json', JSON.stringify({zop, znr}, null, 2));
} catch(e) {
    console.error(e);
}
