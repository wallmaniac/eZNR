import { readFileSync, writeFileSync } from 'fs';

// 1. Fix page.js
let pageContent = readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// A. Mobile flexWrap fix -> change to pure un-wrappable Grid natively supporting columns
const oldGridStr = `<div style={{ display: 'flex', flexWrap: 'wrap', width: 120, gap: 4 }}>`;
const newGridStr = `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', width: '130px' }}>`;
pageContent = pageContent.replace(oldGridStr.replace(/\r/g, ''), newGridStr);

// B. Remove extra Sačuvaj buttons in Branding
const brandingPdfSaveStr = `<button className="btn btn-primary" onClick={handleSaveCompany}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>`;
pageContent = pageContent.replace(brandingPdfSaveStr, ''); // removes first instance (PDF block)
pageContent = pageContent.replace(brandingPdfSaveStr, ''); // removes second instance (UI block)

// C. Fix handleSaveCompany to explicitly log or catch if failure
const oldHandleSave = `    update(COLLECTIONS.COMPANIES, activeCompanyId, { ...companyData, branding: newBranding });
    applyUIBranding(activeCompanyId);
    clearDirty(); showSaved();
  };`;
const newHandleSave = `    try {
      // Create a cloned payload. Wait, update() function merges new fields. 
      const payload = { ...companyData, branding: newBranding };
      update(COLLECTIONS.COMPANIES, activeCompanyId, payload);
      // Wait, let's also update the activeCompany state directly if it's there
      applyUIBranding(activeCompanyId);
      clearDirty(); showSaved();
    } catch(err) {
      console.error('Save failed:', err);
      alert('Error: ' + err.message);
    }
  };`;
pageContent = pageContent.replace(oldHandleSave.replace(/\r/g, ''), newHandleSave);

writeFileSync('src/app/dashboard/settings/page.js', pageContent, 'utf8');


// 2. Fix Watermark Logo Distortion
let pdfContent = readFileSync('src/lib/pdfReportGenerator.js', 'utf8');
const oldImg = `<img src="\${company.logo}" alt="" style="max-width:\${wmSize}px;max-height:\${Math.round(wmSize * 0.6)}px;margin:\${imgMargin}" />`;
const newImg = `<img src="\${company.logo}" alt="" style="width:\${wmSize}px;height:auto;max-width:100%;margin:\${imgMargin};object-fit:contain" />`;
pdfContent = pdfContent.replace(oldImg.replace(/\r/g, ''), newImg);
writeFileSync('src/lib/pdfReportGenerator.js', pdfContent, 'utf8');

console.log('Fix script ran successfully');
