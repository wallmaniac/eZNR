'use client';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS, getOrgUnitName, formatDate } from '@/lib/dataStore';

export default function AddressBookPage() {
  const { t, lang } = useLanguage();
  const workers = useMemo(() => getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan), []);

  return (
    <div className="animate-fadeIn">
      <h1 style={{ marginBottom: 24 }}>📒 {t('addressBook')}</h1>
      <div className="card"><div className="card-body">
        <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{workers.length} {t('records')}</div>
        <div className="data-table-wrapper"><table className="data-table"><thead><tr>
          <th>{t('workerName')}</th><th>{t('workerSurname')}</th><th>{t('orgUnit')}</th><th>{t('mobilePhone')}</th><th>{t('email')}</th><th>{t('address')}</th>
        </tr></thead><tbody>
            {workers.map(w => (
              <tr key={w.id}>
                <td style={{ fontWeight: 600 }}>{w.ime}</td>
                <td style={{ fontWeight: 600 }}>{w.prezime}</td>
                <td>{getOrgUnitName(w.orgJedinicaId)}</td>
                <td>{w.mobitel || '-'}</td>
                <td>{w.email ? <a href={`mailto:${w.email}`}>{w.email}</a> : '-'}</td>
                <td>{w.ulica ? `${w.ulica} ${w.kucniBroj || ''}` : '-'}</td>
              </tr>
            ))}
          </tbody></table></div>
      </div></div>
    </div>
  );
}
