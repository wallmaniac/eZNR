'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function QRRedirect({ params }) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const id = resolvedParams.id;
  const router = useRouter();

  useEffect(() => {
    const moduleMap = {
      'fp': { path: 'fire-protection', param: 'openItem' },
      'eq': { path: 'equipment', param: 'openItem' },
      'fleet': { path: 'fleet', param: 'openId' },
    };

    const mod = moduleMap[token] || { path: token, param: 'openItem' };
    const targetPath = `/dashboard/${mod.path}?${mod.param}=${id}`;
    
    // Checking auth state directly to preserve deep-link. 
    // If we just pushed to dashboard, the layout component might drop the deep link when throwing to login.
    const isAuth = !!localStorage.getItem('eznr_user');
    
    if (isAuth) {
      router.replace(targetPath);
    } else {
      router.replace(`/?redirect=${encodeURIComponent(targetPath)}`);
    }

  }, [token, id, router]);

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0B2A3C', color: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: 40, height: 40, border: '4px solid rgba(0,191,166,0.3)', borderTopColor: '#00BFA6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <h3 style={{ marginTop: 20, fontFamily: 'sans-serif', fontWeight: 600, fontSize: '1.2rem' }}>Usmjeravanje...</h3>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
