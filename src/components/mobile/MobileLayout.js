'use client';
import { useState } from 'react';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import MobileMoreSheet from './MobileMoreSheet';

export default function MobileLayout({ children }) {
    const [isMoreOpen, setIsMoreOpen] = useState(false);

    return (
        <div style={{
            position: 'relative',
            width: '100vw',
            minHeight: '100vh',
            background: 'var(--bg-page)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <MobileHeader />
            
            <main style={{
                flex: 1,
                marginTop: 56, // height of MobileHeader
                marginBottom: 70, // height of MobileBottomNav
                padding: '16px 12px',
                paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 12px))',
                overflowX: 'hidden',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}>
                {children}
            </main>

            <MobileBottomNav onOpenMore={() => setIsMoreOpen(true)} />

            <MobileMoreSheet isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
        </div>
    );
}
