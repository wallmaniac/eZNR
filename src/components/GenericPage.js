'use client';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GenericPage({ title, icon, translationKey, children }) {
    const { t, lang } = useLanguage();
    const displayTitle = translationKey ? t(translationKey) : title;

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                {icon} {displayTitle}
            </h1>

            {children || (
                <div className="card">
                    <div className="card-body">
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                            <button className="btn btn-primary btn-sm">+ {t('add')}</button>
                            <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                                <input style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} placeholder={t('searchBtn') + '...'} />
                                <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                            </div>
                        </div>
                        <div className="empty-state">
                            <div className="empty-state-icon">{icon}</div>
                            <div className="empty-state-title">{t('noRecords')}</div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {t('klikniteNoviDaDodatePrvi')}
                            </p>
                            <button className="btn btn-primary" style={{ marginTop: 16 }}>+ {t('add')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
