const fs = require('fs');
const JSZip = require('jszip');

async function fixTemplate() {
    const data = fs.readFileSync('public/templates/Test ZOP.docx');
    const zip = await JSZip.loadAsync(data);
    let docXml = await zip.file('word/document.xml').async('string');
    
    // Find where sectPr starts and ends
    const sectStart = docXml.lastIndexOf('<w:sectPr');
    let lastSectPr = '';
    
    if (sectStart !== -1) {
        lastSectPr = docXml.substring(sectStart);
    }
    
    docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>[[testTitle]]</w:t></w:r></w:p>
        
        <w:p><w:r><w:t>[[#questions]]</w:t></w:r></w:p>
        <w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>[[id]]. [[text]]</w:t></w:r></w:p>
        
        <w:p><w:r><w:t>[[#options]]</w:t></w:r></w:p>
        <w:p><w:pPr><w:ind w:left="400"/></w:pPr><w:r><w:t>[[label]]) [[text]]</w:t></w:r></w:p>
        <w:p><w:r><w:t>[[/options]]</w:t></w:r></w:p>
        <w:p><w:pPr><w:spacing w:after="120"/></w:pPr></w:p>
        <w:p><w:r><w:t>[[/questions]]</w:t></w:r></w:p>
        
        <w:p><w:pPr><w:spacing w:before="480" w:after="240"/></w:pPr><w:r><w:t>Potpis kandidata: _________________</w:t></w:r></w:p>
        <w:p><w:r><w:t>Broj tačnih odgovora: ____/____</w:t></w:r></w:p>
        <w:p><w:r><w:t>Kandidat je:</w:t></w:r></w:p>
        <w:p><w:r><w:t>a) Položio</w:t></w:r></w:p>
        <w:p><w:r><w:t>b) Nije položio</w:t></w:r></w:p>
        <w:p><w:pPr><w:spacing w:before="240"/></w:pPr><w:r><w:t>Stručno lice koje je vršilo obuku i provjeru znanja:</w:t></w:r></w:p>
        <w:p><w:r><w:t>________________________</w:t></w:r></w:p>
        ${lastSectPr}
    </w:body>
</w:document>`;

    zip.file('word/document.xml', docXml);
    const content = await zip.generateAsync({type: 'nodebuffer'});
    fs.writeFileSync('public/templates/GeneratedTestTemplate.docx', content);
    console.log('Fixed template created!');
}

fixTemplate().catch(console.error);
