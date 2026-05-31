'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getOfflineQueueCount } from '@/lib/dataStore';

/**
 * OfflineIndicator — shows a subtle red bar when internet is disconnected.
 * Briefly shows a green "Back online" bar when reconnected.
 * Also shows pending offline write count while offline.
 */
export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);
    const [showReconnected, setShowReconnected] = useState(false);
    const [pendingOps, setPendingOps] = useState(0);
    const { lang } = useLanguage();

    useEffect(() => {
        const setOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            setTimeout(() => setShowReconnected(false), 3000);
        };
        const setOffline = () => {
            setIsOnline(false);
            setShowReconnected(false);
            setPendingOps(getOfflineQueueCount());
        };

        // Track offline queue changes
        const onQueueChange = (e) => {
            setPendingOps(e.detail?.count ?? getOfflineQueueCount());
        };

        // Initial check
        if (!navigator.onLine) setOffline();

        window.addEventListener('online', setOnline);
        window.addEventListener('offline', setOffline);
        window.addEventListener('eznr:offline-queue-changed', onQueueChange);
        return () => {
            window.removeEventListener('online', setOnline);
            window.removeEventListener('offline', setOffline);
            window.removeEventListener('eznr:offline-queue-changed', onQueueChange);
        };
    }, []);

    // Nothing to show
    if (isOnline && !showReconnected) return null;

    const offline = !isOnline;
    const showSynced = showReconnected && pendingOps === 0;

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
                ? (lang !== 'en'
                    ? `Nema internet konekcije${pendingOps > 0 ? ` — ${pendingOps} promjena čeka sinkronizaciju` : ' — možete nastaviti raditi'}`
                    : `No internet connection${pendingOps > 0 ? ` — ${pendingOps} changes pending sync` : ' — you can continue working'}`)
                : (lang !== 'en'
                    ? (showSynced ? 'Ponovo online — promjene sinkronizirane ✓' : 'Ponovo online — sinkronizacija...')
                    : (showSynced ? 'Back online — changes synced ✓' : 'Back online — syncing...'))
            }
        </div>
    );
}
