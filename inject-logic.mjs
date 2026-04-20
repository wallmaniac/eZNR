import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/app/dashboard/settings/page.js', 'utf8');

// Replace imports
content = content.replace(
  "import {\r\n  ACCENT_PRESETS, SIDEBAR_PRESETS, EZNR_DEFAULTS,\r\n  getCompanyBranding, savePdfBranding,\r\n  getUIBranding, saveUIBranding, applyUIBranding, resetUIBranding,\r\n} from '@/lib/brandingService';",
  "import {\n  ACCENT_PRESETS, SIDEBAR_PRESETS, EZNR_DEFAULTS,\n  PDF_DEFAULTS, UI_DEFAULTS, WATERMARK_POSITIONS, LOGO_POSITIONS,\n  getCompanyBranding, savePdfBranding,\n  getUIBranding, saveUIBranding, applyUIBranding, resetUIBranding,\n} from '@/lib/brandingService';"
);
content = content.replace(
  "import {\n  ACCENT_PRESETS, SIDEBAR_PRESETS, EZNR_DEFAULTS,\n  getCompanyBranding, savePdfBranding,\n  getUIBranding, saveUIBranding, applyUIBranding, resetUIBranding,\n} from '@/lib/brandingService';",
  "import {\n  ACCENT_PRESETS, SIDEBAR_PRESETS, EZNR_DEFAULTS,\n  PDF_DEFAULTS, UI_DEFAULTS, WATERMARK_POSITIONS, LOGO_POSITIONS,\n  getCompanyBranding, savePdfBranding,\n  getUIBranding, saveUIBranding, applyUIBranding, resetUIBranding,\n} from '@/lib/brandingService';"
);

// Replace state
const stateOld = `  // Branding state\n  const [pdfAccentColor, setPdfAccentColor] = useState(EZNR_DEFAULTS.accentColor);\n  const [uiPrimaryColor, setUiPrimaryColor] = useState('');\n  const [uiSidebarColor, setUiSidebarColor] = useState('');`;

const stateOldCr = `  // Branding state\r\n  const [pdfAccentColor, setPdfAccentColor] = useState(EZNR_DEFAULTS.accentColor);\r\n  const [uiPrimaryColor, setUiPrimaryColor] = useState('');\r\n  const [uiSidebarColor, setUiSidebarColor] = useState('');`;

const stateNew = `  // Branding state
  const [pdfAccentColor, setPdfAccentColor] = useState(EZNR_DEFAULTS.accentColor);
  const [wmEnabled, setWmEnabled] = useState(PDF_DEFAULTS.watermarkEnabled);
  const [wmPosition, setWmPosition] = useState(PDF_DEFAPositions || PDF_DEFAULTS.watermarkPosition); // fallback if I typo'd
  const [wmOpacity, setWmOpacity] = useState(PDF_DEFAULTS.watermarkOpacity);
  const [wmSize, setWmSize] = useState(PDF_DEFAULTS.watermarkSize);
  const [wmContent, setWmContent] = useState(PDF_DEFAULTS.watermarkContent);
  const [logoPosition, setLogoPosition] = useState(PDF_DEFAULTS.logoPosition);
  const [logoSize, setLogoSize] = useState(PDF_DEFAULTS.logoSize);
  const [headerText, setHeaderText] = useState('');
  const [headerFontSize, setHeaderFontSize] = useState(PDF_DEFAULTS.headerFontSize);
  const [headerBold, setHeaderBold] = useState(false);
  const [headerItalic, setHeaderItalic] = useState(false);
  const [headerUnderline, setHeaderUnderline] = useState(false);
  const [headerColor, setHeaderColor] = useState(PDF_DEFAULTS.headerColor);

  const [uiPrimaryColor, setUiPrimaryColor] = useState('');
  const [uiSidebarColor, setUiSidebarColor] = useState('');
  const [sidebarLogoEnabled, setSidebarLogoEnabled] = useState(false);
  const [sidebarText, setSidebarText] = useState(UI_DEFAULTS.sidebarText);

  // Color picker open state (toggle-to-close + X button)
  const [pdfPickerOpen, setPdfPickerOpen] = useState(false);
  const [headerColorPickerOpen, setHeaderColorPickerOpen] = useState(false);
  const [uiPrimaryPickerOpen, setUiPrimaryPickerOpen] = useState(false);
  const [uiSidebarPickerOpen, setUiSidebarPickerOpen] = useState(false);`;

content = content.replace(stateOldCr, stateNew.replace(/\n/g, '\r\n')).replace(stateOld, stateNew);

// Correct my fallback typo for wmPosition if needed
content = content.replace("PDF_DEFAPositions || PDF_DEFAULTS.watermarkPosition", "PDF_DEFAULTS.watermarkPosition");

// I also need to ensure that when reading branding the new states are populated.
// Wait, when loading profile data, I had added logic to restore these states from companyData.branding
// Let me just replace the 'if (data.branding?.pdf) {' block
const oldLoadBranding = `        if (data.branding?.pdf) {
          setPdfAccentColor(data.branding.pdf.accentColor || EZNR_DEFAULTS.accentColor);
        }
        if (data.branding?.ui) {
          setUiPrimaryColor(data.branding.ui.primaryColor || '');
          setUiSidebarColor(data.branding.ui.sidebarColor || '');
        }`;
const newLoadBranding = `        if (data.branding?.pdf) {
          setPdfAccentColor(data.branding.pdf.accentColor || EZNR_DEFAULTS.accentColor);
          if (data.branding.pdf.watermark) {
            setWmEnabled(data.branding.pdf.watermark.enabled ?? PDF_DEFAULTS.watermarkEnabled);
            setWmPosition(data.branding.pdf.watermark.position || PDF_DEFAULTS.watermarkPosition);
            setWmOpacity(data.branding.pdf.watermark.opacity || PDF_DEFAULTS.watermarkOpacity);
            setWmSize(data.branding.pdf.watermark.size || PDF_DEFAULTS.watermarkSize);
            setWmContent(data.branding.pdf.watermark.content || PDF_DEFAULTS.watermarkContent);
          }
          if (data.branding.pdf.logo) {
            setLogoPosition(data.branding.pdf.logo.position || PDF_DEFAULTS.logoPosition);
            setLogoSize(data.branding.pdf.logo.size || PDF_DEFAULTS.logoSize);
          }
          if (data.branding.pdf.headerText) {
            setHeaderText(data.branding.pdf.headerText.text || '');
            setHeaderFontSize(data.branding.pdf.headerText.fontSize || PDF_DEFAULTS.headerFontSize);
            setHeaderBold(data.branding.pdf.headerText.bold || false);
            setHeaderItalic(data.branding.pdf.headerText.italic || false);
            setHeaderUnderline(data.branding.pdf.headerText.underline || false);
            setHeaderColor(data.branding.pdf.headerText.color || PDF_DEFAULTS.headerColor);
          }
        }
        if (data.branding?.ui) {
          setUiPrimaryColor(data.branding.ui.primaryColor || '');
          setUiSidebarColor(data.branding.ui.sidebarColor || '');
          setSidebarLogoEnabled(data.branding.ui.sidebarLogoEnabled || false);
          setSidebarText(data.branding.ui.sidebarText ?? UI_DEFAULTS.sidebarText);
        }`;

content = content.replace(oldLoadBranding, newLoadBranding).replace(oldLoadBranding.replace(/\n/g, '\\r\\n'), newLoadBranding.replace(/\n/g, '\\r\\n'));

// Save branding block
const oldSaveBranding = `      const currentBranding = companyData.branding || {};
      const newBranding = {
        pdf: { ...currentBranding.pdf, accentColor: pdfAccentColor },
        ui: { ...currentBranding.ui, primaryColor: uiPrimaryColor, sidebarColor: uiSidebarColor }
      };`;
const newSaveBranding = `      const currentBranding = companyData.branding || {};
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
          sidebarLogoEnabled,
          sidebarText
        }
      };`;

content = content.replace(oldSaveBranding, newSaveBranding).replace(oldSaveBranding.replace(/\n/g, '\\r\\n'), newSaveBranding.replace(/\n/g, '\\r\\n'));

writeFileSync('src/app/dashboard/settings/page.js', content, 'utf8');
console.log("Done adding branding logic");
