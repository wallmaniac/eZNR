'use client';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';

export default function SubscriptionGate({ moduleKey, children }) {
    const { hasAccess, tier } = useSubscription();
    const { t, lang } = useLanguage();
    const router = useRouter();

    if (hasAccess(moduleKey)) {
        return children;
    }

    const isBs = lang === 'bs';

    return (
        <div style={styles.container} className="animate-fadeIn">
            <div style={styles.card}>
                <div style={styles.iconWrapper}>
                    <span style={{ fontSize: '3rem' }}>🔒</span>
                </div>
                <h2 style={styles.title}>
                    {isBs ? 'Premium Modul' : 'Premium Module'}
                </h2>
                <p style={styles.badge}>
                    {tier} ➔ ENTERPRISE
                </p>
                <p style={styles.description}>
                    {isBs 
                        ? 'Ovaj napredni modul (Zaštita od požara / Evakuacija / Vozni park) dostupan je isključivo korisnicima sa Enterprise paketom pretplate.' 
                        : 'This advanced module (Fire Protection / Evacuation / Fleet Management) is exclusively available to users with the Enterprise subscription plan.'}
                </p>
                <div style={styles.featuresList}>
                    <div style={styles.featureItem}>
                        <span style={styles.featureCheck}>✓</span>
                        <span>{isBs ? 'Napredno praćenje rokova i ispitivanja' : 'Advanced expiry and testing tracking'}</span>
                    </div>
                    <div style={styles.featureItem}>
                        <span style={styles.featureCheck}>✓</span>
                        <span>{isBs ? 'Automatska upozorenja i notifikacije' : 'Automated alerts and notifications'}</span>
                    </div>
                    <div style={styles.featureItem}>
                        <span style={styles.featureCheck}>✓</span>
                        <span>{isBs ? 'Detaljni izvještaji i izvoz u PDF/Excel' : 'Detailed PDF/Excel reports and export'}</span>
                    </div>
                </div>
                <div style={styles.buttonGroup}>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => router.push('/dashboard/settings')}
                        style={styles.upgradeBtn}
                    >
                        ⚡ {isBs ? 'Nadogradite na Enterprise' : 'Upgrade to Enterprise'}
                    </button>
                    <button 
                        className="btn btn-ghost" 
                        onClick={() => router.push('/dashboard')}
                        style={styles.backBtn}
                    >
                        ← {isBs ? 'Nazad na početnu' : 'Back to Dashboard'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: '24px',
    },
    card: {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
    },
    iconWrapper: {
        marginBottom: '20px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'rgba(0, 191, 166, 0.08)',
        border: '2px solid rgba(0, 191, 166, 0.2)',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: 'var(--text)',
        margin: '0 0 10px 0',
        fontFamily: 'var(--font-heading)',
    },
    badge: {
        display: 'inline-block',
        fontSize: '0.75rem',
        fontWeight: '700',
        color: 'var(--primary)',
        background: 'rgba(0, 191, 166, 0.1)',
        padding: '4px 12px',
        borderRadius: '20px',
        margin: '0 0 20px 0',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    description: {
        fontSize: '0.9rem',
        color: 'var(--text-muted)',
        lineHeight: '1.6',
        margin: '0 0 24px 0',
        fontFamily: 'var(--font-body)',
    },
    featuresList: {
        textAlign: 'left',
        background: 'var(--bg-input)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        marginBottom: '30px',
        border: '1px solid var(--border-light)',
    },
    featureItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.82rem',
        color: 'var(--text)',
        marginBottom: '8px',
        fontFamily: 'var(--font-body)',
    },
    featureCheck: {
        color: 'var(--primary)',
        fontWeight: '700',
    },
    buttonGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    upgradeBtn: {
        width: '100%',
        padding: '12px',
        fontWeight: '600',
        cursor: 'pointer',
    },
    backBtn: {
        width: '100%',
        padding: '10px',
        color: 'var(--text-muted)',
        cursor: 'pointer',
    }
};
