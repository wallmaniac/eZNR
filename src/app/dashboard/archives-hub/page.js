'use client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

// Import existing standalone pages
import EmployerDocsPage from '../employer-docs/page';
import ObrasciPage from '../form-oir1/page'; // Need a dedicated wrapper actually if combining, or we can just import the specific one. Wait! Let's import Zapisnici instead.
import ZapisniciPage from '../zapisnici/page';
import Icon3D from '@/components/Icon3D';

// Actually, "Obrasci i uputnice" is a GROUP in the sidebar not a standalone page! It had children: OIR1, RA1, RO1, RO2, NightWork.
// We can just keep those separate inside this hub, or simply point users to the existing grouped menu.
// For now, I will create a hub with only "Dokumentacija Poslodavca" and "Zapisnici" to merge the top-level items!

export default function ArchivesHub() {
    const { lang , t } = useLanguage();
    
    const [tab, setTab] = useState('employer');
    
    return (
        <div style={{ padding: '0 0 20px 0', animation: 'fadeIn 0.3s ease' }}>
            <div style={{
                display: 'flex', gap: '12px', marginBottom: '24px', 
                borderBottom: '2px solid var(--border-light)', paddingBottom: '16px',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch'
            }}>
                <button 
                  onClick={() => setTab('employer')} 
                  style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px',
                      borderRadius: '16px',
                      border: tab === 'employer' ? '2px solid var(--primary)' : '2px solid transparent',
                      background: tab === 'employer' ? 'rgba(0,191,166,0.1)' : 'var(--bg-card)',
                      color: tab === 'employer' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: tab === 'employer' ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                  }}>
                    <Icon3D name="📑" size={18} />
                    {t('dokumentiPoslodavca')}
                </button>
                <button 
                  onClick={() => setTab('zapisnici')} 
                  style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px',
                      borderRadius: '16px',
                      border: tab === 'zapisnici' ? '2px solid var(--primary)' : '2px solid transparent',
                      background: tab === 'zapisnici' ? 'rgba(0,191,166,0.1)' : 'var(--bg-card)',
                      color: tab === 'zapisnici' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: tab === 'zapisnici' ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                  }}>
                    <Icon3D name="📋" size={18} />
                    {t('zapisniciAlat')}
                </button>
            </div>
            
            <div style={{ minHeight: '600px', padding: '0 4px' }}>
                <div style={{ display: tab === 'employer' ? 'block' : 'none' }}><EmployerDocsPage /></div>
                <div style={{ display: tab === 'zapisnici' ? 'block' : 'none' }}><ZapisniciPage /></div>
            </div>
        </div>
    );
}
