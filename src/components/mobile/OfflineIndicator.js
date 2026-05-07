'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * OfflineIndicator — shows a subtle red bar when internet is disconnected.
 * Briefly shows a green "Back online" bar when reconnected.
 */
export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);
    const [showReconnected, setShowReconnected] = useState(false);
    const { lang } = useLanguage();

    useEffect(() => {
        const setOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            setTimeout(() => setShowReconnected(false), 2500);
        };
        const setOffline = () => {
            setIsOnline(false);
            setShowReconnected(false);
        };

        // Initial check
        if (!navigator.onLine) setOffline();

        window.addEventListener('online', setOnline);
        window.addEventListener('offline', setOffline);
        return () => {
            window.removeEventListener('online', setOnline);
            window.removeEventListener('offline', setOffline);
        };
    }, []);

    // Nothing to show
    if (isOnline && !showReconnected) return null;

    const offline = !isOnline;

    return (
        <div style={{
            position: 'fixed',
            top: 48, left: 0, right: 0,
            zIndex: 600,
            padding: '6px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: offline
                ? 'linear-gradient(135deg, #D32F2F, #B71C1C)'
                : 'linear-gradient(135deg, #00BFA6, #009985)',
            color: 'white',
            fontSize: '0.78rem',
            fontWeight: 700,
            fontFamily: 'var(--font-heading)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
            animation: 'fadeIn 0.3s ease',
            transition: 'background 0.3s ease',
        }}>
            <span style={{ fontSize: '0.9rem' }}>{offline ? '📡' : '✅'}</span>
            {offline
                ? (lang !== 'en' ? 'Nema internet konekcije' : 'No internet connection')
                : (lang !== 'en' ? 'Ponovo online' : 'Back online')
            }
        </div>
    );
}
