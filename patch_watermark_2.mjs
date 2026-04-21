import { readFileSync, writeFileSync } from 'fs';

// 1. Update brandingService.js getWatermarkCSS
let bsCode = readFileSync('src/lib/brandingService.js', 'utf8');
const oldWM = `export function getWatermarkCSS(position) {
  const map = {
    'top-left':      { ai: 'flex-start', jc: 'flex-start', ta: 'left' },
    'top-center':    { ai: 'flex-start', jc: 'center', ta: 'center' },
    'top-right':     { ai: 'flex-start', jc: 'flex-end', ta: 'right' },
    'center-left':   { ai: 'center', jc: 'flex-start', ta: 'left' },
    'center':        { ai: 'center', jc: 'center', ta: 'center' },
    'center-right':  { ai: 'center', jc: 'flex-end', ta: 'right' },
    'bottom-left':   { ai: 'flex-end', jc: 'flex-start', ta: 'left' },
    'bottom-center': { ai: 'flex-end', jc: 'center', ta: 'center' },
    'bottom-right':  { ai: 'flex-end', jc: 'flex-end', ta: 'right' },
  };
  return map[position] || map['center'];
}`;

const newWM = `export function getWatermarkCSS(position) {
  const map = {
    'top-left':      { top: '0', left: '0', transform: 'none', ta: 'left' },
    'top-center':    { top: '0', left: '50%', transform: 'translateX(-50%)', ta: 'center' },
    'top-right':     { top: '0', left: 'auto', right: '0', transform: 'none', ta: 'right' },
    'center-left':   { top: '50%', left: '0', transform: 'translateY(-50%)', ta: 'left' },
    'center':        { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', ta: 'center' },
    'center-right':  { top: '50%', left: 'auto', right: '0', transform: 'translateY(-50%)', ta: 'right' },
    'bottom-left':   { top: 'auto', bottom: '0', left: '0', transform: 'none', ta: 'left' },
    'bottom-center': { top: 'auto', bottom: '0', left: '50%', transform: 'translateX(-50%)', ta: 'center' },
    'bottom-right':  { top: 'auto', bottom: '0', left: 'auto', right: '0', transform: 'none', ta: 'right' },
  };
  return map[position] || map['center'];
}`;
bsCode = bsCode.replace(oldWM.replace(/\r/g, ''), newWM);
writeFileSync('src/lib/brandingService.js', bsCode, 'utf8');

// 2. Update pdfReportGenerator.js
let pdfCode = readFileSync('src/lib/pdfReportGenerator.js', 'utf8');

// The CSS section
const oldCssBlock = `  /* Watermark behind content */
  .watermark-container {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 0;
    pointer-events: none;
    display: flex;
    padding: 10mm;
  }
  .watermark {
    opacity: 0.045;
    display: flex;
    flex-direction: column;
  }
  .watermark img { max-width: 280px; max-height: 160px; object-fit: contain; display: block; margin-bottom: 12px; }
  .watermark .wm-name { font-size: 28pt; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #000; }`;

const newCssBlock = `  /* Watermark behind content */
  .watermark {
    position: fixed;
    z-index: 0;
    pointer-events: none;
    opacity: 0.045;
    padding: 10mm;
  }
  .watermark img { object-fit: contain; display: block; }
  .watermark .wm-name { font-size: 28pt; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #000; }`;
pdfCode = pdfCode.replace(oldCssBlock.replace(/\r/g, ''), newCssBlock);

// The JS HTML structure section
const oldHtmlBlock = `    watermarkHtml = \`
    <div class="watermark-container" style="align-items:\${wmPos.ai};justify-content:\${wmPos.jc};">
      <div class="watermark" style="opacity:\${wmOpacity};text-align:\${wmPos.ta};align-items:\${wmPos.ai};">
        \${showLogo && company.logo ? \`<img src="\${company.logo}" alt="" style="width:\${wmSize}px;height:auto;max-width:100%;margin:\${imgMargin};object-fit:contain" />\` : ''}
        \${showName && companyName ? \`<div class="wm-name" style="font-size:\${Math.round(wmSize / 10)}pt">\${companyName}</div>\` : ''}
      </div>
    </div>\`;`;

const newHtmlBlock = `    watermarkHtml = \`
      <div class="watermark" style="opacity:\${wmOpacity}; text-align:\${wmPos.ta}; top:\${wmPos.top || 'auto'}; bottom:\${wmPos.bottom || 'auto'}; left:\${wmPos.left || 'auto'}; right:\${wmPos.right || 'auto'}; transform:\${wmPos.transform};">
        \${showLogo && company.logo ? \`<img src="\${company.logo}" alt="" style="width:\${wmSize}px;height:auto;max-width:100%;margin:\${imgMargin};object-fit:contain" />\` : ''}
        \${showName && companyName ? \`<div class="wm-name" style="font-size:\${Math.round(wmSize / 10)}pt">\${companyName}</div>\` : ''}
      </div>\`;`;
pdfCode = pdfCode.replace(oldHtmlBlock.replace(/\r/g, ''), newHtmlBlock);

// Next: Make company name BOLD on PDFs in the header
const oldBrandName = `<div style="font-size:8pt;font-weight:600;color:#555;margin-top:3px;text-align:\${logoPos === 'center' ? 'center' : 'left'}">\${companyName}</div>`;
const newBrandName = `<div style="font-size:9pt;font-weight:800;color:#222;margin-top:3px;text-align:\${logoPos === 'center' ? 'center' : 'left'}">\${companyName}</div>`;
pdfCode = pdfCode.replace(oldBrandName.replace(/\r/g, ''), newBrandName);

// Toggle for company info visibility
const oldCompanyInfoBlock = `      \${logoPos !== 'center' ? \`
      <div class="company-info">
        \${company.adresa || company.address ? \`<div>\${company.adresa || company.address}</div>\` : ''}
        \${company.mjesto ? \`<div>\${company.mjesto}\${company.postanskiBroj ? \` \${company.postanskiBroj}\` : ''}</div>\` : ''}
        \${company.jib || company.oib || company.id_number ? \`<div>JIB: \${company.jib || company.oib || company.id_number}</div>\` : ''}
        \${company.telefon ? \`<div>Tel: \${company.telefon}</div>\` : ''}
      </div>\` : ''}`;

const newCompanyInfoBlock = `      \${logoPos !== 'center' && (company.showCompanyInfo !== false) ? \`
      <div class="company-info">
        \${company.adresa || company.address ? \`<div>\${company.adresa || company.address}</div>\` : ''}
        \${company.mjesto ? \`<div>\${company.mjesto}\${company.postanskiBroj ? \` \${company.postanskiBroj}\` : ''}</div>\` : ''}
        \${company.jib || company.oib || company.id_number ? \`<div>JIB: \${company.jib || company.oib || company.id_number}</div>\` : ''}
        \${company.telefon ? \`<div>Tel: \${company.telefon}</div>\` : ''}
      </div>\` : ''}`;
pdfCode = pdfCode.replace(oldCompanyInfoBlock.replace(/\r/g, ''), newCompanyInfoBlock);

writeFileSync('src/lib/pdfReportGenerator.js', pdfCode, 'utf8');

console.log('Watermark script ran successfully');
