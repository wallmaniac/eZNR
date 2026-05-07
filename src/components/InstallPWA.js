'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function InstallPWA() {
    const { lang } = useLanguage();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    useEffect(() => {
        // Check if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            setIsInstalled(true);
            return;
        }

        // Detect iOS (Safari doesn't fire beforeinstallprompt)
        const ua = navigator.userAgent || '';
        const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        setIsIOS(ios);

        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isIOS) {
            setShowIOSGuide(g => !g);
            return;
        }
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    // Hide if already installed, or if not iOS and no deferred prompt available
    if (isInstalled) return null;
    if (!isIOS && !deferredPrompt) return null;

    return (
        <div className="mobile-only">
            <button
                onClick={handleInstallClick}
                style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.2)',
                    color: 'var(--primary)', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center',
                    margin: '12px 0 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
            >
                📱 {lang !== 'en' ? 'Instaliraj Aplikaciju' : 'Install App'}
            </button>
            {isIOS && showIOSGuide && (
                <div style={{
                    marginTop: 8, padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(33,150,243,0.08)', border: '1px solid rgba(33,150,243,0.2)',
                    fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7,
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
                        {lang !== 'en' ? 'Upute za iOS:' : 'iOS Instructions:'}
                    </div>
                    1️⃣ {lang !== 'en' ? 'Klikni na' : 'Tap the'} <strong style={{ fontSize: '1.1rem' }}>⬆️</strong> (Share)<br/>
                    2️⃣ {lang !== 'en' ? 'Odaberi' : 'Select'} <strong>"{lang !== 'en' ? 'Dodaj na početni zaslon' : 'Add to Home Screen'}"</strong><br/>
                    3️⃣ {lang !== 'en' ? 'Potvrdi sa "Dodaj"' : 'Confirm with "Add"'}
                </div>
            )}
        </div>
    );
}
