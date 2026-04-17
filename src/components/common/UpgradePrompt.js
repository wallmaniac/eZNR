'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function UpgradePrompt({ title, description, benefits = [] }) {
    const { lang } = useLanguage();
    
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            minHeight: '60vh', padding: '40px 20px', textAlign: 'center',
            background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)', margin: '40px auto', maxWidth: 640
        }}>
            <div style={{
                width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #FF9800, #F44336)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.5rem', marginBottom: 24, boxShadow: '0 8px 24px rgba(244,67,54,0.3)'
            }}>
                🔒
            </div>
            
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: 12 }}>
                {title || (lang === 'bs' ? 'Pretplata potrebna' : 'Subscription Required')}
            </h2>
            
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 32, maxWidth: 480, lineHeight: 1.6 }}>
                {description || (lang === 'bs' ? 'Ovaj modul je dostupan samo na višim paketima. Nadogradite svoj paket kako biste otključali napredne značajke.' : 'This module is restricted to higher plans. Please upgrade to unlock advanced features.')}
            </p>

            {benefits.length > 0 && (
                <div style={{ textAlign: 'left', background: 'var(--bg-input)', padding: 24, borderRadius: 12, width: '100%', marginBottom: 32 }}>
                    <div style={{ fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
                        {lang === 'bs' ? 'Što dobivate nadogradnjom?' : 'What do you get by upgrading?'}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {benefits.map((b, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.9rem', color: 'var(--text)' }}>
                                <span style={{ color: 'var(--success)' }}>✔️</span>
                                <span>{b}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <a href="mailto:podrska@eznr.ba?subject=Upit za nadogradnju paketa" className="btn btn-primary" style={{ padding: '12px 32px', fontSize: '1.05rem' }}>
                ⭐ {lang === 'bs' ? 'Zatražite nadogradnju' : 'Request Upgrade'}
            </a>
            
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 16 }}>
                {lang === 'bs' ? 'Ili nas kontaktirajte na ' : 'Or contact us at '} podrska@eznr.ba
            </div>
        </div>
    );
}
