'use client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, getWorkplaceName, getOrgUnitName } from '@/lib/dataStore';

export default function RiskAssessmentPage() {
    const { t, lang } = useLanguage();
    const [activeTab, setActiveTab] = useState('risk');

    const workplaces = getAll(COLLECTIONS.WORKPLACES);
    const equipment = getAll(COLLECTIONS.EQUIPMENT);

    const riskItems = workplaces.map(wp => ({
        id: wp.id,
        naziv: wp.naziv,
        oznaka: wp.oznaka,
        orgUnit: getOrgUnitName(wp.orgUnitId),
        rizik: wp.posebniUvjetiRada ? 'Visok' : 'Nizak',
        status: 'Aktivna',
    }));

    return (
        <div className="animate-fadeIn">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>📊 {t('riskAssessment')}</h1>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="card" style={{ borderTop: '4px solid var(--primary)' }}>
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--primary)' }}>{workplaces.length}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('workplaces')}</div>
                    </div>
                </div>
                <div className="card" style={{ borderTop: '4px solid var(--danger)' }}>
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--danger)' }}>{workplaces.filter(w => w.posebniUvjetiRada).length}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('highRisk')}</div>
                    </div>
                </div>
                <div className="card" style={{ borderTop: '4px solid var(--secondary)' }}>
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--secondary)' }}>{workplaces.filter(w => !w.posebniUvjetiRada).length}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('lowRisk')}</div>
                    </div>
                </div>
                <div className="card" style={{ borderTop: '4px solid var(--info)' }}>
                    <div className="card-body" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--info)' }}>{equipment.length}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('workEquipment')}</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <button onClick={() => setActiveTab('risk')} style={{
                    padding: '12px 24px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.85rem',
                    background: activeTab === 'risk' ? 'var(--dark)' : 'white',
                    color: activeTab === 'risk' ? 'white' : 'var(--text)',
                    boxShadow: activeTab === 'risk' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                }}>
                    📊 {t('riskAssessment')}
                </button>
                <button onClick={() => setActiveTab('sds')} style={{
                    padding: '12px 24px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.85rem',
                    background: activeTab === 'sds' ? 'var(--dark)' : 'white',
                    color: activeTab === 'sds' ? 'white' : 'var(--text)',
                    boxShadow: activeTab === 'sds' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                }}>
                    🧪 {t('sdsDatabase')}
                </button>
            </div>

            {activeTab === 'risk' && (
                <div className="card">
                    <div className="card-body">
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                            <button className="btn btn-primary btn-sm">+ {t('add')}</button>
                            <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                                <input placeholder={t('searchBtn') + '...'} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                                <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                            </div>
                        </div>

                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('actions')}</th>
                                        <th>{t('name')}</th>
                                        <th>{lang === 'bs' ? 'Oznaka' : 'Code'}</th>
                                        <th>{t('orgUnit')}</th>
                                        <th>{t('riskLevel')}</th>
                                        <th>{t('status')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {riskItems.map((item) => (
                                        <tr key={item.id}>
                                            <td><button className="btn btn-primary btn-sm">{t('actions')} ▼</button></td>
                                            <td style={{ fontWeight: 600 }}>{item.naziv}</td>
                                            <td>{item.oznaka}</td>
                                            <td>{item.orgUnit}</td>
                                            <td>
                                                <span className={`badge ${item.rizik === 'Visok' ? 'badge-danger' : 'badge-success'}`}>
                                                    {item.rizik === 'Visok' ? (lang === 'bs' ? '⚠ Visok rizik' : '⚠ High risk') : (lang === 'bs' ? '✓ Nizak rizik' : '✓ Low risk')}
                                                </span>
                                            </td>
                                            <td><span className="badge badge-success">✓ {item.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sds' && (
                <div className="card">
                    <div className="card-body">
                        <div className="alert alert-info" style={{ marginBottom: 16 }}>
                            ℹ️ {lang === 'bs'
                                ? 'SDS baza podataka sadrži sigurnosno-tehničke listove (SDS) za hemikalije koje se koriste na radnom mjestu.'
                                : 'The SDS database contains Safety Data Sheets for chemicals used in the workplace.'}
                        </div>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                            <button className="btn btn-primary btn-sm">+ {lang === 'bs' ? 'Dodaj hemikaliju' : 'Add chemical'}</button>
                            <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
                                <input placeholder={lang === 'bs' ? 'Pretraži hemikalije...' : 'Search chemicals...'} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                                <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                            </div>
                        </div>
                        <div className="data-table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('actions')}</th>
                                        <th>{t('name')}</th>
                                        <th>{lang === 'bs' ? 'CAS broj' : 'CAS number'}</th>
                                        <th>{lang === 'bs' ? 'GHS oznake' : 'GHS labels'}</th>
                                        <th>{lang === 'bs' ? 'Opasnosti' : 'Hazards'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
