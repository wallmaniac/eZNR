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

    // Extract ?c=companyId from this page's URL
    const qs = new URLSearchParams(window.location.search);
    const targetCompanyId = qs.get('c');

    // Check auth state
    const isAuth = !!localStorage.getItem('eznr_user');
    
    if (!isAuth) {
      // Not logged in — redirect to login with deep-link preserved
      // Include company info in redirect so it can be handled post-login
      const fullTarget = targetCompanyId
        ? `${targetPath}&_qrc=${targetCompanyId}`
        : targetPath;
      router.replace(`/?redirect=${encodeURIComponent(fullTarget)}`);
      return;
    }

    // User is logged in — check if company switch is needed
    if (targetCompanyId) {
      const currentCompanyId = localStorage.getItem('eznr_activeCompany');
      
      if (currentCompanyId !== targetCompanyId) {
        // Check if user has access to this company
        try {
          const userStr = localStorage.getItem('eznr_user');
          const user = userStr ? JSON.parse(userStr) : null;
          const isSuperAdmin = user?.role === 'superadmin';
          const hasAccess = isSuperAdmin || (user?.companyIds || []).includes(targetCompanyId);
          
          if (hasAccess) {
            // Switch company via localStorage — the AuthContext will pick it up
            // We set the localStorage value and dispatch a storage event
            localStorage.setItem('eznr_activeCompany', targetCompanyId);
            localStorage.setItem('eznr_qr_company_switch', JSON.stringify({
              companyId: targetCompanyId,
              targetPath,
              timestamp: Date.now(),
            }));
            // Force a full page navigation so AuthContext re-initializes with the new company
            window.location.href = targetPath;
            return;
          }
          // User doesn't have access — just redirect to current company's page
          // (item won't be found, but that's expected)
        } catch (e) {
          console.warn('[QR] Error checking company access:', e);
        }
      }
    }

    // Same company or no company info — simple redirect
    router.replace(targetPath);

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
