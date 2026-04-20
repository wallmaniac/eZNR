import { readFileSync, writeFileSync } from 'fs';

let pageContent = readFileSync('src/app/dashboard/settings/page.js', 'utf8');

const oldHandleSave = `    try {
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

// We find the definition of newBranding BEFORE it.
const oldNewBranding = `    // Save standard and branding structure back to the company
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
    
    try {
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

const newNewBranding = `    // Save standard and branding structure back to the company
    const newBranding = {
        accentColor: pdfAccentColor,
        watermarkEnabled: wmEnabled, 
        watermarkPosition: wmPosition, 
        watermarkOpacity: wmOpacity, 
        watermarkSize: wmSize, 
        watermarkContent: wmContent,
        logoPosition: logoPosition, 
        logoSize: logoSize,
        headerText: headerText, 
        headerFontSize: headerFontSize, 
        headerBold: headerBold, 
        headerItalic: headerItalic, 
        headerUnderline: headerUnderline, 
        headerColor: headerColor,
        primaryColor: uiPrimaryColor, 
        sidebarColor: uiSidebarColor,
        sidebarLogoEnabled: sidebarLogoEnabled,
        sidebarText: sidebarText
    };
    
    try {
      const payload = { ...companyData, branding: newBranding };
      update(COLLECTIONS.COMPANIES, activeCompanyId, payload);
      applyUIBranding(activeCompanyId);
      clearDirty(); showSaved();
    } catch(err) {
      console.error('Save failed:', err);
      alert('Error: ' + err.message);
    }
  };`;

pageContent = pageContent.replace(oldNewBranding.replace(/\r/g, ''), newNewBranding);
writeFileSync('src/app/dashboard/settings/page.js', pageContent, 'utf8');

console.log('Fixed branding structure generation.');
