const mammoth = require('mammoth');
const fs = require('fs');

async function extract(file) {
    console.log("Extracting", file);
    try {
        const result = await mammoth.convertToHtml({path: file});
        fs.writeFileSync(file.replace('.docx', '.html'), result.value);
        console.log("Saved to html");
    } catch(e) {
        console.error(e);
    }
}

extract('c:/Users/zzida/Desktop/znrba/Test ZOP.docx');
extract('c:/Users/zzida/Desktop/znrba/3.1. TEST ZNR.docx');
