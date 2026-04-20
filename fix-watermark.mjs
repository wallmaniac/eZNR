import { readFileSync, writeFileSync } from 'fs';

// 1. Update brandingService.js
let branding = readFileSync('src/lib/brandingService.js', 'utf8');

const oldMap = `export function getWatermarkCSS(position) {
  const map = {
    'top-left':      { top: '8%',  left: '15%', transform: 'translate(-50%,-50%)' },
    'top-center':    { top: '8%',  left: '50%', transform: 'translate(-50%,-50%)' },
    'top-right':     { top: '8%',  left: '85%', transform: 'translate(-50%,-50%)' },
    'center-left':   { top: '50%', left: '15%', transform: 'translate(-50%,-50%)' },
    'center':        { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' },
    'center-right':  { top: '50%', left: '85%', transform: 'translate(-50%,-50%)' },
    'bottom-left':   { top: '88%', left: '15%', transform: 'translate(-50%,-50%)' },
    'bottom-center': { top: '88%', left: '50%', transform: 'translate(-50%,-50%)' },
    'bottom-right':  { top: '88%', left: '85%', transform: 'translate(-50%,-50%)' },
  };
  return map[position] || map['center'];
}`;

const newMap = `export function getWatermarkCSS(position) {
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

branding = branding.replace(oldMap.replace(/\r/g, ''), newMap);
writeFileSync('src/lib/brandingService.js', branding, 'utf8');


// 2. Update pdfReportGenerator.js
let pdfBase = readFileSync('src/lib/pdfReportGenerator.js', 'utf8');

// Update CSS
const oldCss = `  /* Watermark behind content */
  .watermark {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 0;
    pointer-events: none;
    opacity: 0.045;
    text-align: center;
  }
  .watermark img { max-width: 280px; max-height: 160px; object-fit: contain; display: block; margin: 0 auto 12px; }
  .watermark .wm-name { font-size: 28pt; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #000; }`;

const newCss = `  /* Watermark behind content */
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

pdfBase = pdfBase.replace(oldCss.replace(/\r/g, ''), newCss);


// Update html structure
const oldHtml = `  let watermarkHtml = '';
  if (wmEnabled && (company.logo || companyName)) {
    const showLogo = wmContent === 'logo' || wmContent === 'both';
    const showName = wmContent === 'name' || wmContent === 'both';
    watermarkHtml = \`
    <div class="watermark" style="top:\${wmPos.top};left:\${wmPos.left};transform:\${wmPos.transform};opacity:\${wmOpacity}">
      \${showLogo && company.logo ? \`<img src="\${company.logo}" alt="" style="max-width:\${wmSize}px;max-height:\${Math.round(wmSize * 0.6)}px" />\` : ''}
      \${showName && companyName ? \`<div class="wm-name" style="font-size:\${Math.round(wmSize / 10)}pt">\${companyName}</div>\` : ''}
    </div>\`;
  }`;

const newHtml = `  let watermarkHtml = '';
  if (wmEnabled && (company.logo || companyName)) {
    const showLogo = wmContent === 'logo' || wmContent === 'both';
    const showName = wmContent === 'name' || wmContent === 'both';
    // Calculate margin auto overrides based on ta
    const imgMargin = wmPos.ta === 'center' ? '0 auto 12px' : wmPos.ta === 'left' ? '0 auto 12px 0' : '0 0 12px auto';
    watermarkHtml = \`
    <div class="watermark-container" style="align-items:\${wmPos.ai};justify-content:\${wmPos.jc};">
      <div class="watermark" style="opacity:\${wmOpacity};text-align:\${wmPos.ta};align-items:\${wmPos.ai};">
        \${showLogo && company.logo ? \`<img src="\${company.logo}" alt="" style="max-width:\${wmSize}px;max-height:\${Math.round(wmSize * 0.6)}px;margin:\${imgMargin}" />\` : ''}
        \${showName && companyName ? \`<div class="wm-name" style="font-size:\${Math.round(wmSize / 10)}pt">\${companyName}</div>\` : ''}
      </div>
    </div>\`;
  }`;

pdfBase = pdfBase.replace(oldHtml.replace(/\r/g, ''), newHtml);

writeFileSync('src/lib/pdfReportGenerator.js', pdfBase, 'utf8');
console.log('Watermark script ran successfully');
