'use client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

// Import the existing pages exactly as they are
import OrgUnitsPage from '../org-units/page';
import WorkplacesPage from '../workplaces/page';
import SistematizacijaPage from '../sistematizacija/page';
import Icon3D from '@/components/Icon3D';

export default function CompanyProfileHub() {
    const { lang, t } = useLanguage();
    const bs = lang !== 'en';
    const [tab, setTab] = useState('org');
    
    return (
        <div style={{ padding: '0 0 20px 0', animation: 'fadeIn 0.3s ease' }}>
            <div style={{
                display: 'flex', gap: '12px', marginBottom: '24px', 
                borderBottom: '2px solid var(--border-light)', paddingBottom: '16px',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch'
            }}>
                <button 
                  onClick={() => setTab('org')} 
                  style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px',
                      borderRadius: '16px',
                      border: tab === 'org' ? '2px solid var(--primary)' : '2px solid transparent',
                      background: tab === 'org' ? 'rgba(0,191,166,0.1)' : 'var(--bg-card)',
                      color: tab === 'org' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: tab === 'org' ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                  }}>
                    <Icon3D name="🏢" size={18} />
                    {bs ? 'Organizacijske jedinice' : 'Organizational Units'}
                </button>
                <button 
                  onClick={() => setTab('work')} 
                  style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px',
                      borderRadius: '16px',
                      border: tab === 'work' ? '2px solid var(--primary)' : '2px solid transparent',
                      background: tab === 'work' ? 'rgba(0,191,166,0.1)' : 'var(--bg-card)',
                      color: tab === 'work' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: tab === 'work' ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                  }}>
                    <Icon3D name="🔧" size={18} />
                    {bs ? 'Radna mjesta' : 'Workplaces'}
                </button>
                <button 
                  onClick={() => setTab('sist')} 
                  style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 20px',
                      borderRadius: '16px',
                      border: tab === 'sist' ? '2px solid var(--primary)' : '2px solid transparent',
                      background: tab === 'sist' ? 'rgba(0,191,166,0.1)' : 'var(--bg-card)',
                      color: tab === 'sist' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: tab === 'sist' ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.2s'
                  }}>
                    <Icon3D name="📑" size={18} />
                    {bs ? 'Sistematizacija' : 'Systematization'}
                </button>
            </div>
            
            <div style={{ minHeight: '600px', padding: '0 4px' }}>
                <div style={{ display: tab === 'org' ? 'block' : 'none' }}><OrgUnitsPage /></div>
                <div style={{ display: tab === 'work' ? 'block' : 'none' }}><WorkplacesPage /></div>
                <div style={{ display: tab === 'sist' ? 'block' : 'none' }}><SistematizacijaPage /></div>
            </div>
        </div>
    );
}
