'use client';
import dynamic from 'next/dynamic';

const SettingsContent = dynamic(() => import('./SettingsContent'), {
  loading: () => (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, border: '3px solid var(--border-light)',
          borderTopColor: 'var(--primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>
          Učitavanje postavki...
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ),
  ssr: false,
});

export default function SettingsPage() {
  return <SettingsContent />;
}
