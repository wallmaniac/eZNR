import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// 1. Refactor handleSaveCompany
const oldSaveStr = `  const handleSaveCompany = () => {
    if (!activeCompanyId) return;
    update(COLLECTIONS.COMPANIES, activeCompanyId, companyData);
    // Save branding
    savePdfBranding(activeCompanyId, { accentColor: pdfAccentColor });
    saveUIBranding(activeCompanyId, { primaryColor: uiPrimaryColor, sidebarColor: uiSidebarColor });
    applyUIBranding(activeCompanyId);
    clearDirty(); showSaved();
  };`;

const newSaveStr = `  const handleSaveCompany = () => {
    if (!activeCompanyId) return;
    
    // Save standard and branding structure back to the company
    const currentBranding = companyData.branding || {};
    const newBranding = {
      pdf: { 
        ...currentBranding.pdf, 
        accentColor: pdfAccentColor,
        watermark: {
          enabled: wmEnabled, position: wmPosition, opacity: wmOpacity, size: wmSize, content: wmContent
        },
        logo: { position: logoPosition, size: logoSize },
        headerText: { text: headerText, fontSize: headerFontSize, bold: headerBold, italic: headerItalic, underline: headerUnderline, color: headerColor }
      },
      ui: { 
        ...currentBranding.ui, 
        primaryColor: uiPrimaryColor, 
        sidebarColor: uiSidebarColor,
        sidebarLogoEnabled: sidebarLogoEnabled,
        sidebarText: sidebarText
      }
    };
    
    update(COLLECTIONS.COMPANIES, activeCompanyId, { ...companyData, branding: newBranding });
    applyUIBranding(activeCompanyId);
    clearDirty(); showSaved();
  };`;

// Strip \r from both to ensure match
let contentNoCr = content.replace(/\r/g, '');
const oldSaveNoCr = oldSaveStr.replace(/\r/g, '');

contentNoCr = contentNoCr.replace(oldSaveNoCr, newSaveStr);

// 2. Refactor useEffect loader
const oldLoadStr = `      // Load branding
      const pdfBrand = getCompanyBranding(activeCompanyId);
      setPdfAccentColor(pdfBrand.accentColor || EZNR_DEFAULTS.accentColor);
      const uiBrand = getUIBranding(activeCompanyId);
      setUiPrimaryColor(uiBrand.primaryColor || '');
      setUiSidebarColor(uiBrand.sidebarColor || '');
    }
  }, [activeCompanyId, isAdmin]);`;

const newLoadStr = `      // Load branding
      const pdfBrand = getCompanyBranding(activeCompanyId);
      setPdfAccentColor(pdfBrand.accentColor);
      setWmEnabled(pdfBrand.watermarkEnabled);
      setWmPosition(pdfBrand.watermarkPosition);
      setWmOpacity(pdfBrand.watermarkOpacity);
      setWmSize(pdfBrand.watermarkSize);
      setWmContent(pdfBrand.watermarkContent);
      setLogoPosition(pdfBrand.logoPosition);
      setLogoSize(pdfBrand.logoSize);
      setHeaderText(pdfBrand.headerText);
      setHeaderFontSize(pdfBrand.headerFontSize);
      setHeaderBold(pdfBrand.headerBold);
      setHeaderItalic(pdfBrand.headerItalic);
      setHeaderUnderline(pdfBrand.headerUnderline);
      setHeaderColor(pdfBrand.headerColor);

      const uiBrand = getUIBranding(activeCompanyId);
      setUiPrimaryColor(uiBrand.primaryColor);
      setUiSidebarColor(uiBrand.sidebarColor);
      setSidebarLogoEnabled(uiBrand.sidebarLogoEnabled);
      setSidebarText(uiBrand.sidebarText);
    }
  }, [activeCompanyId, isAdmin]);`;

contentNoCr = contentNoCr.replace(oldLoadStr.replace(/\r/g, ''), newLoadStr);

// Modify UI buttons
// A. Replace the single "Spremi branding i firmu" at the bottom with standard "Sačuvaj / Save"
const oldBottomSaveBtn = `<button className="btn btn-primary" onClick={handleSaveCompany}>💾 {lang === 'bs' ? 'Spremi branding i firmu' : 'Save branding & company'}</button>`;
const newBottomSaveBtn = `<button className="btn btn-primary" onClick={handleSaveCompany}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>`;
contentNoCr = contentNoCr.replace(oldBottomSaveBtn, newBottomSaveBtn);

// B. Insert "Sačuvaj" after PDF card
const endPdfCardStr = `</div>{/* end pdf card body */}
                </div>{/* end pdf card */}`;
const addBtnPdfCard = `</div>{/* end pdf card body */}
                </div>{/* end pdf card */}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 30 }}>
                  <button className="btn btn-primary" onClick={handleSaveCompany}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                  <button onClick={()=>{
                    setPdfAccentColor(EZNR_DEFAULTS.accentColor);
                    setWmEnabled(PDF_DEFAULTS.watermarkEnabled); setWmPosition(PDF_DEFAULTS.watermarkPosition); 
                    setWmOpacity(PDF_DEFAULTS.watermarkOpacity); setWmSize(PDF_DEFAULTS.watermarkSize); setWmContent(PDF_DEFAULTS.watermarkContent);
                    setLogoPosition(PDF_DEFAULTS.logoPosition); setLogoSize(PDF_DEFAULTS.logoSize);
                    setHeaderText(''); setHeaderFontSize(PDF_DEFAULTS.headerFontSize); setHeaderBold(false); setHeaderItalic(false); setHeaderUnderline(false); setHeaderColor(PDF_DEFAULTS.headerColor);
                    setDirty('company');
                  }} style={{padding:'7px 16px',borderRadius:8,border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',cursor:'pointer',fontSize:'0.8rem',fontWeight:600}}>⟲ {lang==='bs'?'Vrati zadane vrijednosti':'Reset to defaults'}</button>
                </div>
`;
contentNoCr = contentNoCr.replace(endPdfCardStr.replace(/\r/g, ''), addBtnPdfCard);

// C. Fix Mobile Grid 3x3 layout
const oldGridStr = `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,36px)', gap: 4 }}>`;
const newGridStr = `<div style={{ display: 'flex', flexWrap: 'wrap', width: 120, gap: 4 }}>`;
contentNoCr = contentNoCr.replace(oldGridStr.replace(/\r/g, ''), newGridStr);

writeFileSync('src/app/dashboard/settings/page.js', contentNoCr, 'utf8');
console.log('Script ran successfully');
