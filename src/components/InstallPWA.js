'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function InstallPWA() {
    const { lang } = useLanguage();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

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
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    if (isInstalled || !deferredPrompt) return null;

    return (
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
            📱 {lang === 'bs' ? 'Instaliraj Aplikaciju' : 'Install App'}
        </button>
    );
}
