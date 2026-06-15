'use client';
import { useEffect } from 'react';

export default function PWAAutoUpdater() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        // 1. Check for updates on load and set up periodic checks
        navigator.serviceWorker.ready.then((registration) => {
            // Check immediately when app starts
            registration.update().catch((err) => {
                console.warn('PWA immediate update check failed:', err);
            });

            // Periodically check for updates (every 15 minutes)
            const interval = setInterval(() => {
                registration.update().catch((err) => {
                    console.warn('PWA background update check failed:', err);
                });
            }, 15 * 60 * 1000);

            return () => clearInterval(interval);
        });

        // 2. Automatically reload when a new service worker takes control
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }, []);

    return null;
}
