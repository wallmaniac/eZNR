'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Loading() {
    const { t } = useLanguage();
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 320, flexDirection: 'column', gap: 16,
        }}>
            <div style={{
                width: 40, height: 40,
                border: '3px solid var(--border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
            }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t('ucitavanje')}...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
