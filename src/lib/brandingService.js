'use client';

/**
 * brandingService.js — Company Branding Engine for eZNR
 *
 * Provides two branding tiers:
 *   1. PDF Branding: accent color, watermark, logo position/size, header text formatting
 *   2. UI  Branding: primary color, sidebar color, sidebar logo, sidebar text
 *
 * All branding data is stored on the company record under `branding: { ... }`
 * and is company-scoped (NOT per-user).
 */

import { getById, update, getActiveCompanyId, COLLECTIONS } from './dataStore';

// ─── Default eZNR Brand Colors ──────────────────────────────────────────────

export const EZNR_DEFAULTS = {
  accentColor: '#00BFA6',
  primaryColor: '#00BFA6',
  sidebarColor: '#0B2A3C',
};

// ─── Default PDF branding settings ───────────────────────────────────────────

export const PDF_DEFAULTS = {
  accentColor: '#00BFA6',
  // Watermark
  watermarkEnabled: true,
  watermarkPosition: 'center',       // top-left, top-center, top-right, center-left, center, center-right, bottom-left, bottom-center, bottom-right
  watermarkOpacity: 5,               // Percentage 0-100
  watermarkSize: 280,                // px
  watermarkContent: 'both',          // 'logo', 'name', 'both'
  // Logo in header
  logoPosition: 'left',             // left, center, right
  logoSize: 40,                     // px (height)
  // Header text formatting
  headerEnabled: true,              // Entire document header feature
  showCompanyInfo: true,            // Show textual details block
  showCompanyName: true,             // Show company name under logo
  headerText: '',                   // Custom text (empty = use default report titles)
  headerFontSize: 12,              // pt
  headerBold: false,
  headerItalic: false,
  headerUnderline: false,
  headerColor: '#1a1a2e',
};

// ─── Default UI branding settings ────────────────────────────────────────────

export const UI_DEFAULTS = {
  primaryColor: '',
  sidebarColor: '',
  sidebarLogoEnabled: false,        // Use company logo in sidebar
  sidebarText: 'zastitanaradu.ba',  // Text under logo in sidebar
};

// ─── Preset Accent Color Palette ─────────────────────────────────────────────

export const ACCENT_PRESETS = [
  { color: '#00BFA6', name: 'eZNR Teal' },
  { color: '#1976D2', name: 'Corporate Blue' },
  { color: '#7B1FA2', name: 'Royal Purple' },
  { color: '#D32F2F', name: 'Enterprise Red' },
  { color: '#E64A19', name: 'Warm Orange' },
  { color: '#00838F', name: 'Deep Cyan' },
  { color: '#2E7D32', name: 'Forest Green' },
  { color: '#37474F', name: 'Slate Grey' },
  { color: '#C2185B', name: 'Magenta' },
  { color: '#F57C00', name: 'Amber' },
];

export const SIDEBAR_PRESETS = [
  { color: '#0B2A3C', name: 'eZNR Navy' },
  { color: '#1a1a2e', name: 'Dark Indigo' },
  { color: '#0d1b2a', name: 'Midnight' },
  { color: '#1b2838', name: 'Steel Blue' },
  { color: '#212121', name: 'Charcoal' },
  { color: '#263238', name: 'Blue Grey' },
  { color: '#1a237e', name: 'Deep Blue' },
  { color: '#311b92', name: 'Deep Purple' },
];

// ─── Watermark position options ──────────────────────────────────────────────

export const WATERMARK_POSITIONS = [
  { id: 'top-left',      label: '↖', row: 0, col: 0 },
  { id: 'top-center',    label: '↑', row: 0, col: 1 },
  { id: 'top-right',     label: '↗', row: 0, col: 2 },
  { id: 'center-left',   label: '←', row: 1, col: 0 },
  { id: 'center',        label: '●', row: 1, col: 1 },
  { id: 'center-right',  label: '→', row: 1, col: 2 },
  { id: 'bottom-left',   label: '↙', row: 2, col: 0 },
  { id: 'bottom-center', label: '↓', row: 2, col: 1 },
  { id: 'bottom-right',  label: '↘', row: 2, col: 2 },
];

// ─── Logo position options ───────────────────────────────────────────────────

export const LOGO_POSITIONS = [
  { id: 'left',   label: '← Lijevo / Left' },
  { id: 'center', label: '● Centar / Center' },
  { id: 'right',  label: '→ Desno / Right' },
];

// ─── Color Utility: HSL manipulation ─────────────────────────────────────────

function hexToHSL(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generate derived color variants from a primary color
 */
export function deriveColors(primaryHex) {
  const hsl = hexToHSL(primaryHex);
  return {
    primary: primaryHex,
    primaryLight: hslToHex(hsl.h, Math.min(hsl.s + 10, 100), Math.min(hsl.l + 12, 90)),
    primaryDark: hslToHex(hsl.h, hsl.s, Math.max(hsl.l - 12, 10)),
    primaryGlow: `rgba(${parseInt(primaryHex.slice(1, 3), 16)}, ${parseInt(primaryHex.slice(3, 5), 16)}, ${parseInt(primaryHex.slice(5, 7), 16)}, 0.15)`,
    primaryGlowStrong: `rgba(${parseInt(primaryHex.slice(1, 3), 16)}, ${parseInt(primaryHex.slice(3, 5), 16)}, ${parseInt(primaryHex.slice(5, 7), 16)}, 0.3)`,
    borderFocus: primaryHex,
    shadowGlow: `0 0 20px rgba(${parseInt(primaryHex.slice(1, 3), 16)}, ${parseInt(primaryHex.slice(3, 5), 16)}, ${parseInt(primaryHex.slice(5, 7), 16)}, 0.2)`,
  };
}

function deriveSidebarColors(sidebarHex) {
  const hsl = hexToHSL(sidebarHex);
  return {
    bgSidebar: sidebarHex,
    bgSidebarHover: hslToHex(hsl.h, hsl.s, Math.min(hsl.l + 8, 45)),
  };
}

// ─── PDF Branding API ────────────────────────────────────────────────────────

/**
 * Get full PDF branding config for a company.
 */
export function getPdfBranding(companyId) {
  const cId = companyId || getActiveCompanyId();
  if (!cId || cId === 'all') return { ...PDF_DEFAULTS, logo: '', companyName: '' };

  const company = getById(COLLECTIONS.COMPANIES, cId);
  if (!company) return { ...PDF_DEFAULTS, logo: '', companyName: '' };

  const branding = company.branding || {};

  return {
    ...PDF_DEFAULTS,
    ...branding,
    logo: company.logo || branding.logo || '',
    companyName: company.naziv || company.name || '',
    address: company.adresa || company.address || '',
    jib: company.oib || company.jib || '',
    telefon: company.telefon || '',
    mjesto: company.mjesto || '',
    postanskiBroj: company.postanskiBroj || '',
  };
}

// Backward-compat alias
export function getCompanyBranding(companyId) {
  return getPdfBranding(companyId);
}

/**
 * Save PDF branding settings to the company record.
 */
export function savePdfBranding(companyId, pdfSettings) {
  if (!companyId) return;
  const company = getById(COLLECTIONS.COMPANIES, companyId);
  const existing = company?.branding || {};
  update(COLLECTIONS.COMPANIES, companyId, {
    branding: { ...existing, ...pdfSettings },
  });
}

// ─── UI Branding API ─────────────────────────────────────────────────────────

/**
 * Get UI branding for dashboard theming.
 */
export function getUIBranding(companyId) {
  const cId = companyId || getActiveCompanyId();
  if (!cId || cId === 'all') return { ...UI_DEFAULTS, enabled: false };

  const company = getById(COLLECTIONS.COMPANIES, cId);
  if (!company) return { ...UI_DEFAULTS, enabled: false };

  const branding = company.branding || {};
  return {
    primaryColor: branding.primaryColor || '',
    sidebarColor: branding.sidebarColor || '',
    sidebarLogoEnabled: branding.sidebarLogoEnabled ?? false,
    sidebarText: branding.sidebarText ?? UI_DEFAULTS.sidebarText,
    logo: company.logo || '',
    enabled: !!branding.primaryColor || !!branding.sidebarColor,
  };
}

/**
 * Save UI branding settings to the company record.
 */
export function saveUIBranding(companyId, uiSettings) {
  if (!companyId) return;
  const company = getById(COLLECTIONS.COMPANIES, companyId);
  const existing = company?.branding || {};
  update(COLLECTIONS.COMPANIES, companyId, {
    branding: { ...existing, ...uiSettings },
  });
}

/**
 * Apply UI branding by overriding CSS custom properties on <html>.
 */
export function applyUIBranding(companyId) {
  if (typeof document === 'undefined') return;

  const branding = getUIBranding(companyId);
  const root = document.documentElement;

  if (branding.primaryColor) {
    const colors = deriveColors(branding.primaryColor);
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primary-light', colors.primaryLight);
    root.style.setProperty('--primary-dark', colors.primaryDark);
    root.style.setProperty('--primary-glow', colors.primaryGlow);
    root.style.setProperty('--primary-glow-strong', colors.primaryGlowStrong);
    root.style.setProperty('--border-focus', colors.borderFocus);
    root.style.setProperty('--shadow-glow', colors.shadowGlow);
    root.style.setProperty('--bg-sidebar-active', colors.primaryGlow);
    root.style.setProperty('--bg-badge', `${colors.primaryGlow}`);
  } else {
    ['--primary', '--primary-light', '--primary-dark', '--primary-glow',
     '--primary-glow-strong', '--border-focus', '--shadow-glow',
     '--bg-sidebar-active', '--bg-badge'].forEach(prop => root.style.removeProperty(prop));
  }

  if (branding.sidebarColor) {
    const sidebar = deriveSidebarColors(branding.sidebarColor);
    root.style.setProperty('--bg-sidebar', sidebar.bgSidebar);
    root.style.setProperty('--bg-sidebar-hover', sidebar.bgSidebarHover);
  } else {
    ['--bg-sidebar', '--bg-sidebar-hover'].forEach(prop => root.style.removeProperty(prop));
  }
}

/**
 * Reset all UI branding overrides.
 */
export function resetUIBranding() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  ['--primary', '--primary-light', '--primary-dark', '--primary-glow',
   '--primary-glow-strong', '--border-focus', '--shadow-glow',
   '--bg-sidebar-active', '--bg-badge',
   '--bg-sidebar', '--bg-sidebar-hover'].forEach(prop => root.style.removeProperty(prop));
}

/**
 * Get CSS positioning for watermark based on position ID.
 */
export function getWatermarkCSS(position) {
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
}
