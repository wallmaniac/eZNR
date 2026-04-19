'use client';
import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeLabel({ type, id, title, subtitle, companyLogo }) {
  // Format the deep-link URL (in production this would be standard https)
  // We use standard host + /q/[type]/[id]
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://zastitanaradu.ba';
  const qrUrl = `${baseUrl}/q/${type}/${id}`;

  return (
    <div style={{
      width: '60mm',
      height: '40mm',
      border: '2px solid #000',
      borderRadius: '4mm',
      padding: '2mm',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#fff',
      pageBreakInside: 'avoid',
      fontFamily: 'sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        {companyLogo ? (
          <img src={companyLogo} alt="Logo" style={{ maxHeight: '8mm', maxWidth: '30mm', objectFit: 'contain', display: 'block' }} />
        ) : (
          <div style={{ fontWeight: 900, fontSize: '10px', color: '#000' }}>eZNR Platforma</div>
        )}
        
        <div style={{ marginTop: '2mm' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.1, color: '#000' }}>
            {title}
          </div>
          <div style={{ fontSize: '8px', fontWeight: 600, color: '#555', marginTop: '1mm' }}>
            ID: {subtitle}
          </div>
        </div>

        <div style={{ fontSize: '6px', fontWeight: 700, marginTop: 'auto', padding: '1mm 2mm', background: '#000', color: '#fff', borderRadius: '1mm', alignSelf: 'flex-start' }}>
          SKENIRATI ZA SERVIS
        </div>
      </div>

      <div style={{ padding: '1mm', flexShrink: 0, border: '1px solid #ccc', borderRadius: '2mm' }}>
        <QRCodeSVG value={qrUrl} size={90} level="M" />
      </div>
    </div>
  );
}
