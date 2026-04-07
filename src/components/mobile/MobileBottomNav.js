'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function MobileBottomNav({ onOpenMore }) {
    const pathname = usePathname();
    const router = useRouter();
    const { lang } = useLanguage();

    const tabs = [
        { key: 'home', icon: '🏠', label: lang === 'bs' ? 'Početna' : 'Home', path: '/dashboard' },
        { key: 'workers', icon: '👷', label: lang === 'bs' ? 'Radnici' : 'Workers', path: '/dashboard/workers' },
        { key: 'equipment', icon: '⚙️', label: lang === 'bs' ? 'Oprema' : 'Equipment', path: '/dashboard/equipment' },
        { key: 'docs', icon: '📑', label: lang === 'bs' ? 'Dokumenti' : 'Docs', path: '/dashboard/employer-docs' },
        { key: 'more', icon: '👤', label: lang === 'bs' ? 'Više' : 'More', action: onOpenMore },
    ];

    return (
        <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, height: 70, zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
            paddingBottom: 'env(safe-area-inset-bottom, 12px)', // handle iOS gesture bar
            boxShadow: '0 -4px 20px rgba(0,0,0,0.06)'
        }}>
            {tabs.map(tab => {
                const isActive = tab.path && (pathname === tab.path || pathname.startsWith(tab.path + '/'));
                return (
                    <button
                        key={tab.key}
                        onClick={() => tab.action ? tab.action() : router.push(tab.path)}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            flex: 1, padding: '8px 0', border: 'none', background: 'transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer', transition: 'color 0.2s', gap: 4
                        }}
                    >
                        <span style={{ fontSize: '1.4rem', filter: isActive ? 'drop-shadow(0 2px 4px rgba(0,191,166,0.3))' : 'grayscale(100%) opacity(60%)' }}>
                            {tab.icon}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: isActive ? 700 : 500 }}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
