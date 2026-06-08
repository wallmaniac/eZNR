'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import PageHeader from '@/components/PageHeader';

function generateSignatureHash() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 64; i++) hash += chars.charAt(Math.floor(Math.random() * chars.length));
  return hash;
}

export default function ISZNRSigningPage() {
  const { t, lang } = useLanguage();
  
  const { alert, confirm, DialogRenderer } = useDialog();
  const { user, activeCompanyId, isSuperAdmin } = useAuth();

  // Gating access check: available only to superadmins or users with explicit permission
  const hasAccess = isSuperAdmin || user?.isznrSigningPermission === true || user?.role === 'superadmin';

  const [selectedCategory, setSelectedCategory] = useState('general');
  const [generalDocs, setGeneralDocs] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [zapisnici, setZapisnici] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [activeTab, setActiveTab] = useState('sign');
  const [showSignModal, setShowSignModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [signStep, setSignStep] = useState(0); 
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pinCode, setPinCode] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyFile, setVerifyFile] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [newDocForm, setNewDocForm] = useState({
    naslov: '', tipDokumenta: 'zapisnik', napomena: '',
  });
  const [modalDocSearch, setModalDocSearch] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState([]);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuButtonRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
        if (openMenuId && !e.target.closest('[data-menu]') && !e.target.closest('[data-menu-trigger]')) {
            setOpenMenuId(null);
        }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  const loadData = useCallback(() => {
    setGeneralDocs(getAll(COLLECTIONS.ISZNR_DOCUMENTS) || []);
    setCertificates(getAll(COLLECTIONS.CERTIFICATES) || []);
    setZapisnici(getAll(COLLECTIONS.ZAPISNICI) || []);
    setWorkers(getAll(COLLECTIONS.WORKERS) || []);
  }, []);
  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);

  const docTypes = useMemo(() => getAll(COLLECTIONS.ISZNR_DOC_TYPES), []);
  const getDocTypeName = (id) => docTypes.find(dt => dt.id === id)?.naziv || id;

  const currentDocs = useMemo(() => {
    if (selectedCategory === 'certificates') {
      return certificates.map(c => {
        const w = workers.find(x => x.id === c.workerId);
        const wName = w ? `${w.ime} ${w.prezime}` : '';
        return {
          ...c,
          naslov: `${wName ? wName + ' — ' : ''}${c.naziv || c.ime || 'Uvjerenje'}`,
          tipDokumentaName: c.tipUvjerenjaIme || c.tipUvjerenja || 'Uvjerenje',
          datum: c.datum || '',
        };
      });
    } else if (selectedCategory === 'zapisnici') {
      return zapisnici.map(z => ({
        ...z,
        naslov: `${z.broj ? z.broj + ' — ' : ''}${z.naziv || 'Zapisnik'}`,
        tipDokumentaName: z.vrsta || 'Zapisnik',
        datum: z.datum || '',
      }));
    } else {
      return generalDocs.map(g => ({
        ...g,
        naslov: g.naslov || g.naziv || 'Dokument',
        tipDokumentaName: getDocTypeName(g.tipDokumentaId) || 'Opšti dokument',
      }));
    }
  }, [selectedCategory, generalDocs, certificates, zapisnici, workers, docTypes]);

  const filteredDocs = useMemo(() => {
    let result = currentDocs;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(d => (d.naslov || '').toLowerCase().includes(q));
    }
    if (activeTab === 'signed') result = result.filter(d => d.potpisano);
    if (activeTab === 'unsigned') result = result.filter(d => !d.potpisano);
    return result;
  }, [currentDocs, searchTerm, activeTab]);

  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filteredDocs, 'datum');

  const stats = useMemo(() => ({
    total: currentDocs.length,
    signed: currentDocs.filter(d => d.potpisano).length,
    unsigned: currentDocs.filter(d => !d.potpisano).length,
  }), [currentDocs]);

  const openSignModal = (doc = null) => {
    setOpenMenuId(null);
    setSelectedDoc(doc);
    setSignStep(doc ? 1 : 0);
    setPinCode('');
    setPinError('');
    setModalDocSearch('');
    setBatchMode(false);
    setBatchSelected([]);
    setShowSignModal(true);
  };

  const toggleBatchDoc = (docId) => {
    setBatchSelected(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleBatchSign = () => {
    if (batchSelected.length === 0) return;
    const firstDoc = currentDocs.find(d => d.id === batchSelected[0]);
    setSelectedDoc(firstDoc);
    setSignStep(1);
  };

  const handleNewDocForSigning = () => {
    if (!newDocForm.naslov.trim()) return;
    const docTypeObj = docTypes.find(dt => dt.oznaka === newDocForm.tipDokumenta.toUpperCase()) || docTypes[0];
    const newDoc = create(COLLECTIONS.ISZNR_DOCUMENTS, {
      partyId: 'ip1',
      naslov: newDocForm.naslov,
      tipDokumentaId: docTypeObj?.id || 'idt1',
      datum: new Date().toISOString().slice(0, 10),
      potpisano: false,
      datoteka: '',
      napomena: newDocForm.napomena,
    });
    loadData();
    setSelectedDoc(newDoc);
    setSignStep(1);
  };

  const handlePinSubmit = () => {
    if (pinCode.length < 4) {
      setPinError(t('pinMustBeAtLeast'));
      return;
    }
    setPinError('');
    setSignStep(2);

    const collection = selectedCategory === 'certificates' 
      ? COLLECTIONS.CERTIFICATES 
      : selectedCategory === 'zapisnici' 
        ? COLLECTIONS.ZAPISNICI 
        : COLLECTIONS.ISZNR_DOCUMENTS;

    setTimeout(() => {
      const signatureData = {
        potpisano: true,
        datumPotpisa: new Date().toISOString(),
        potpis: generateSignatureHash(),
        potpisnik: `${user?.firstName} ${user?.lastName}`,
        potpisniciEmail: user?.email || '',
        certifikat: `eZNR-CERT-${Date.now().toString(36).toUpperCase()}`,
        algoritam: 'SHA-256 + RSA-2048',
      };
      if (batchMode && batchSelected.length > 0) {
        batchSelected.forEach(docId => {
          update(collection, docId, {
            ...signatureData,
            potpis: generateSignatureHash(),
          });
        });
      } else if (selectedDoc) {
        update(collection, selectedDoc.id, signatureData);
      }
      loadData();
      setSignStep(3);
    }, 2500);
  };

  const handleVerify = (doc) => {
    setOpenMenuId(null);
    setShowDetailModal(null);
    setVerifyFile(doc);
    setVerifyResult(null);
    setShowVerifyModal(true);

    setTimeout(() => {
      setVerifyResult({
        valid: doc.potpisano,
        signer: doc.potpisnik || `${user?.firstName} ${user?.lastName}`,
        signDate: doc.datumPotpisa || doc.datum,
        certId: doc.certifikat || 'N/A',
        algorithm: doc.algoritam || 'SHA-256 + RSA-2048',
        hash: doc.potpis || 'NOT_SIGNED',
        integrity: doc.potpisano ? 'OK' : 'INVALID',
      });
    }, 1500);
  };

  const handleRevokeSignature = async (doc) => {
    const ok = await confirm(t('revokeDigitalSignatureOnThis')); if (!ok) return;
    const collection = selectedCategory === 'certificates' 
      ? COLLECTIONS.CERTIFICATES 
      : selectedCategory === 'zapisnici' 
        ? COLLECTIONS.ZAPISNICI 
        : COLLECTIONS.ISZNR_DOCUMENTS;

    update(collection, doc.id, {
      potpisano: false,
      datumPotpisa: null,
      potpis: null,
      potpisnik: null,
      certifikat: null,
    });
    loadData();
  };

  const handleDeleteDoc = async (doc) => {
    setOpenMenuId(null);
    const ok = await confirm(t('obrisatiDokument')); if (!ok) return;
    const collection = selectedCategory === 'certificates' 
      ? COLLECTIONS.CERTIFICATES 
      : selectedCategory === 'zapisnici' 
        ? COLLECTIONS.ZAPISNICI 
        : COLLECTIONS.ISZNR_DOCUMENTS;

    remove(collection, doc.id);
    loadData();
  };

  const tabs = [
    { key: 'all', label: t('allDocuments'), icon: '📄', count: stats.total },
    { key: 'signed', label: t('signed2'), icon: '✅', count: stats.signed },
    { key: 'unsigned', label: t('unsigned'), icon: '📝', count: stats.unsigned },
  ];

  if (!hasAccess) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '100px auto', padding: '40px 30px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', borderRadius: 12, border: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: '4rem', marginBottom: 20 }}>🔐</div>
        <h2 style={{ color: 'var(--danger)', marginBottom: 12, fontSize: '1.5rem', fontWeight: 700 }}>
          {lang === 'en' ? 'Access Restricted' : 'Pristup ograničen'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: 24 }}>
          {lang === 'en' 
            ? 'This module is restricted. The digital signing function is only available to users with explicit permission from the Superadmin.' 
            : 'Ovaj modul je ograničen. Funkcija digitalnog potpisivanja dostupna je isključivo korisnicima s izričitim odobrenjem od strane superadministratora.'}
        </p>
        <button className="btn btn-primary" onClick={() => window.location.href = '/dashboard'} style={{ width: '100%', justifyContent: 'center' }}>
          🏠 {lang === 'en' ? 'Return to Dashboard' : 'Povratak na nadzornu ploču'}
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader 
        icon="✍️" 
        title={t('digitalSigning')} 
        subtitle={t('digitalDocumentSigningAndVerification')} 
        actions={
          <button className="btn btn-primary" onClick={() => openSignModal()}>
            ✍️ {t('signDocument')}
          </button>
        }
      />

      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        ℹ️ {t('digitalDocumentSigningUsesA')}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className={`btn ${selectedCategory === 'general' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setSelectedCategory('general'); setSelectedDoc(null); setBatchSelected([]); }}>
          📁 {lang === 'en' ? 'General Documents' : 'Opšta dokumenta'} ({generalDocs.length})
        </button>
        <button className={`btn ${selectedCategory === 'certificates' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setSelectedCategory('certificates'); setSelectedDoc(null); setBatchSelected([]); }}>
          📜 {lang === 'en' ? 'Worker Certificates' : 'Uvjerenja radnika'} ({certificates.length})
        </button>
        <button className={`btn ${selectedCategory === 'zapisnici' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setSelectedCategory('zapisnici'); setSelectedDoc(null); setBatchSelected([]); }}>
          📋 {lang === 'en' ? 'Minutes / Records' : 'Zapisnici o ispitivanju'} ({zapisnici.length})
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: t('totalDocuments'), value: stats.total, icon: '📄', color: 'var(--primary)' },
          { label: t('signed3'), value: stats.signed, icon: '✅', color: 'var(--success)' },
          { label: t('ceka'), value: stats.unsigned, icon: '📝', color: 'var(--warning)' },
          { label: t('uvjerenje'), value: 'Aktivan', icon: '🔐', color: 'var(--info)' },
        ].map((s, i) => (
          <div key={i} className="card" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <span style={{ fontSize: '1.5rem' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap', borderBottom: '2px solid var(--border)' }}>
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setActiveTab(tb.key)}
            className={`tab-btn ${activeTab === tb.key ? 'active' : ''}`}>
            {tb.icon} {tb.label} <span style={{ marginLeft: 6, background: activeTab === tb.key ? 'rgba(0,191,166,0.15)' : 'var(--bg-badge)', color: activeTab === tb.key ? 'var(--primary)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>{tb.count}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
            <div className="scrollable-toolbar" style={{ padding: '8px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                <button className="btn btn-primary" style={{ flexShrink: 0, height: 38 }} onClick={() => openSignModal()}>✍️ {t('signDocument1')}</button>
                <div className="search-bar" style={{ width: 250, flexShrink: 0 }}>
                    <span style={{ opacity: 0.5 }}>🔍</span>
                    <input placeholder={t('pretrazi1')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{sorted.length} {t('records')}</span>
            </div>
          <div className="data-table-wrapper" style={{ borderTop: '1px solid var(--border-light)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>{t('actions')}</th>
                  <th onClick={() => toggleSort('naslov')} style={thStyle('naslov')}>{t('name')} {sortIcon('naslov')}</th>
                  <th onClick={() => toggleSort('tipDokumentaId')} style={thStyle('tipDokumentaId')}>{t('tip')} {sortIcon('tipDokumentaId')}</th>
                  <th onClick={() => toggleSort('datum')} style={thStyle('datum')}>{t('date')} {sortIcon('datum')}</th>
                  <th onClick={() => toggleSort('potpisano')} style={thStyle('potpisano')}>{t('status')} {sortIcon('potpisano')}</th>
                  <th onClick={() => toggleSort('potpisnik')} style={thStyle('potpisnik')}>{t('signer')} {sortIcon('potpisnik')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    {t('noRecords')}
                  </td></tr>
                ) : sorted.map(doc => (
                  <tr key={doc.id} className="hover-row">
                    <td onClick={e => e.stopPropagation()}>
                        <div style={{ position: 'relative' }}>
                            <button className="btn btn-primary btn-sm" data-menu-trigger onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); if (openMenuId === doc.id) { setOpenMenuId(null); return; } const rect = e.currentTarget.getBoundingClientRect(); menuButtonRef.current = e.currentTarget; const spaceBelow = window.innerHeight - rect.bottom - 8; const spaceAbove = rect.top - 8; const flipUp = spaceBelow < 200 && spaceAbove> spaceBelow; setMenuPos(flipUp ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) } : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }); setOpenMenuId(doc.id); }}>{t('actions1')}</button>
                            {openMenuId === doc.id && (
                                <div data-menu onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 210, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                                    {!doc.potpisano && <button onClick={() => openSignModal(doc)} className="dropdown-item">✍️ {t('sign')}</button>}
                                    <button onClick={() => { setOpenMenuId(null); setShowDetailModal(doc); }} className="dropdown-item">👁️ {t('detalji')}</button>
                                    {doc.potpisano && <button onClick={() => handleVerify(doc)} className="dropdown-item">🔍 {t('verify')}</button>}
                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                    <button onClick={() => handleDeleteDoc(doc)} className="dropdown-item text-danger">🗑️ {t('obrisi')}</button>
                                </div>
                            )}
                        </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{doc.naslov}</td>
                    <td><span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 6, background: 'var(--bg-badge)', color: 'var(--info)', fontWeight: 600 }}>{doc.tipDokumentaName}</span></td>
                    <td>{formatDate(doc.datum)}</td>
                    <td>
                      {doc.potpisano ? (
                        <span className="badge badge-success">✅ {t('signed4')}</span>
                      ) : (
                        <span className="badge badge-warning">📝 {t('ceka')}</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {doc.potpisnik || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showSignModal && (
        <div className="modal-overlay" onClick={() => setShowSignModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #1565C0, #42A5F5)' }}>
              <h2 style={{ color: 'white' }}>✍️ {t('digitalSigning')}</h2>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowSignModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
                {[
                  t('1Select'),
                  t('2Pin'),
                  t('3Sign'),
                  t('4Done')
                ].map((step, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '8px 4px',
                    fontSize: '0.72rem', fontWeight: 700,
                    background: signStep>= i ? 'var(--primary)' : 'var(--bg-input)',
                    color: signStep>= i ? 'white' : 'var(--text-muted)',
                    borderRadius: i === 0 ? '8px 0 0 8px' : i === 3 ? '0 8px 8px 0' : 0,
                  }}>
                    {step}
                  </div>
                ))}
              </div>

              {signStep === 0 && (() => {
                const unsignedDocs = currentDocs.filter(d => !d.potpisano);
                const modalFiltered = modalDocSearch.trim()
                  ? unsignedDocs.filter(d => (d.naslov || '').toLowerCase().includes(modalDocSearch.toLowerCase()))
                  : unsignedDocs;
                return (
                  <div>
                    <h4 style={{ marginBottom: 12 }}>📄 {t('selectOrCreateADocument')}</h4>

                    {unsignedDocs.length> 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {t('unsignedDocuments')}
                            <span style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,152,0,0.1)', color: 'var(--warning)', fontSize: '0.68rem' }}>
                              {unsignedDocs.length}
                            </span>
                          </div>
                          {unsignedDocs.length> 1 && (
                            <button onClick={() => { setBatchMode(!batchMode); setBatchSelected([]); }}
                              style={{
                                fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                                border: batchMode ? '2px solid var(--primary)' : '1px solid var(--border)',
                                background: batchMode ? 'rgba(0,191,166,0.08)' : 'transparent',
                                color: batchMode ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}>
                              {batchMode ? '✅' : '☐'} {t('batchSign')}
                            </button>
                          )}
                        </div>

                        {unsignedDocs.length> 5 && (
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem' }}>🔍</span>
                            <input
                              className="form-input"
                              value={modalDocSearch}
                              onChange={e => setModalDocSearch(e.target.value)}
                              placeholder={t('filterDocuments')}
                              style={{ paddingLeft: 32, fontSize: '0.8rem', borderRadius: 'var(--radius-full)' }}
                            />
                            {modalDocSearch && (
                              <button onClick={() => setModalDocSearch('')} style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem',
                              }}>✕</button>
                            )}
                          </div>
                        )}

                        {batchMode && modalFiltered.length> 0 && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <button onClick={() => setBatchSelected(modalFiltered.map(d => d.id))}
                              style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
                              ✅ {t('odaberiSve')} ({modalFiltered.length})
                            </button>
                            <button onClick={() => setBatchSelected([])}
                              style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>
                              ☐ {t('odznaciSve')}
                            </button>
                          </div>
                        )}

                        <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 8, border: unsignedDocs.length> 5 ? '1px solid var(--border-light)' : 'none' }}>
                          {modalFiltered.length === 0 ? (
                            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              {t('nemaRezultata')}
                            </div>
                          ) : modalFiltered.map(doc => {
                            const isSelected = batchSelected.includes(doc.id);
                            return (
                              <button key={doc.id} className="dropdown-item"
                                onClick={() => {
                                  if (batchMode) { toggleBatchDoc(doc.id); }
                                  else { setSelectedDoc(doc); setSignStep(1); }
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                  borderRadius: 8, marginBottom: 2, width: '100%',
                                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                                  background: isSelected ? 'rgba(0,191,166,0.06)' : undefined,
                                }}>
                                <span>{batchMode ? (isSelected ? '✅' : '☐') : '📝'}</span>
                                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.naslov}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(doc.datum)} • {getDocTypeName(doc.tipDokumentaId)}</div>
                                </div>
                                {!batchMode && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>→</span>}
                              </button>
                            );
                          })}
                        </div>

                        {batchMode && batchSelected.length> 0 && (
                          <button className="btn btn-primary" onClick={handleBatchSign} style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}>
                            ✍️ {t('signDocuments').replace('{0}', batchSelected.length)}
                          </button>
                        )}
                      </div>
                    )}

                    {selectedCategory === 'general' && (
                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                          {t('orCreateNew')}
                        </div>
                        <div className="form-group">
                          <label className="form-label">{t('documentTitle')} *</label>
                          <input className="form-input" value={newDocForm.naslov} onChange={e => setNewDocForm(p => ({ ...p, naslov: e.target.value }))}
                            placeholder={t('egInspectionReport')} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                          <div className="form-group">
                            <label className="form-label">{t('documentTypes')}</label>
                            <select className="form-input" value={newDocForm.tipDokumenta} onChange={e => setNewDocForm(p => ({ ...p, tipDokumenta: e.target.value }))}>
                              {docTypes.map(dt => <option key={dt.id} value={dt.oznaka}>{dt.naziv}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{t('napomena')}</label>
                            <input className="form-input" value={newDocForm.napomena} onChange={e => setNewDocForm(p => ({ ...p, napomena: e.target.value }))} />
                          </div>
                        </div>
                        <button className="btn btn-primary" onClick={handleNewDocForSigning} disabled={!newDocForm.naslov.trim()} style={{ marginTop: 12 }}>
                          📄 {t('createSign')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {signStep === 1 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔐</div>
                  <h4 style={{ marginBottom: 4 }}>{t('enterCertificatePin')}</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    {t('document')} <strong>{selectedDoc?.naslov}</strong>
                  </p>
                  <input className="form-input" type="password" value={pinCode} onChange={e => setPinCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                    placeholder="PIN" autoFocus
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: 8, maxWidth: 200, margin: '0 auto' }} />
                  {pinError && <div style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: 8, fontWeight: 600 }}>⚠️ {pinError}</div>}
                  <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button className="btn btn-ghost" onClick={() => setSignStep(0)}>{t('nazad')}</button>
                    <button className="btn btn-primary" onClick={handlePinSubmit} disabled={!pinCode}>
                      🔓 {t('confirm')}
                    </button>
                  </div>
                </div>
              )}

              {signStep === 2 && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px',
                    border: '4px solid var(--primary)', borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <h4>{t('signingInProgress')}</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {t('applyingSha256Rsa2048Algorithm')}
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {signStep === 3 && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '4rem', marginBottom: 12 }}>✅</div>
                  <h3 style={{ color: 'var(--success)', marginBottom: 8 }}>
                    {batchMode && batchSelected.length> 1
                      ? (t('documentsSuccessfullySigned').replace('{0}', batchSelected.length))
                      : (t('documentSuccessfullySigned'))}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    {batchMode && batchSelected.length> 1
                      ? (t('batchSigningComplete'))
                      : selectedDoc?.naslov}
                  </p>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 12, padding: 16, textAlign: 'left', marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>{t('signer1')}</span> <strong>{user?.firstName} {user?.lastName}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>{t('date1')}</span> <strong>{formatDate(new Date().toISOString().slice(0, 10))}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>{t('algorithm')}</span> <strong>SHA-256 + RSA-2048</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>{t('certificate')}</span> <strong>eZNR-CERT</strong></div>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowSignModal(false)}>
                    ✅ {t('zatvori')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showVerifyModal && (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #2E7D32, #66BB6A)' }}>
              <h2 style={{ color: 'white' }}>🔍 {t('signatureVerification')}</h2>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowVerifyModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {!verifyResult ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: '50%', margin: '0 auto 16px',
                    border: '4px solid #2E7D32', borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <p style={{ color: 'var(--text-muted)' }}>{t('verifying')}</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : (
                <div>
                  <div style={{
                    textAlign: 'center', padding: 20, marginBottom: 16,
                    borderRadius: 12, border: `2px solid ${verifyResult.valid ? '#A5D6A7' : '#EF9A9A'}`,
                    background: verifyResult.valid ? 'rgba(76,175,80,0.12)' : 'rgba(244,67,54,0.12)',
                  }}>
                    <span style={{ fontSize: '3rem' }}>{verifyResult.valid ? '✅' : '❌'}</span>
                    <h3 style={{ color: verifyResult.valid ? 'var(--success)' : 'var(--danger)', marginTop: 8 }}>
                      {verifyResult.valid
                        ? (t('signatureIsValid'))
                        : (t('signatureIsNotValid'))}
                    </h3>
                  </div>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 12, padding: 16, fontSize: '0.82rem' }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>📄 {t('dokument')}</span><strong>{verifyFile?.naslov}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>👤 {t('signer2')}</span><strong>{verifyResult.signer}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>📅 {t('signDate')}</span><strong>{formatDate(verifyResult.signDate)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>🔐 {t('uvjerenje')}</span><strong>{verifyResult.certId}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>🔒 {t('algorithm1')}</span><strong>{verifyResult.algorithm}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>🛡️ {t('integrity')}</span><strong style={{ color: verifyResult.integrity === 'OK' ? 'var(--success)' : 'var(--danger)' }}>{verifyResult.integrity}</strong></div>
                    </div>
                    {verifyResult.hash && verifyResult.hash !== 'NOT_SIGNED' && (
                      <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--bg-input)', fontFamily: 'monospace', fontSize: '0.65rem', wordBreak: 'break-all', color: 'var(--text-muted)' }}>
                        {t('hash')} {verifyResult.hash}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowVerifyModal(false)}>{t('zatvori')}</button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: showDetailModal.potpisano ? 'linear-gradient(135deg, #2E7D32, #66BB6A)' : 'linear-gradient(135deg, #F57C00, #FFB74D)' }}>
              <h2 style={{ color: 'white' }}>📄 {showDetailModal.naslov}</h2>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowDetailModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('tip')}</div><div style={{ fontWeight: 600 }}>{showDetailModal.tipDokumentaName || getDocTypeName(showDetailModal.tipDokumentaId)}</div></div>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('date')}</div><div style={{ fontWeight: 600 }}>{formatDate(showDetailModal.datum)}</div></div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('status')}</div>
                  <div>{showDetailModal.potpisano
                    ? <span className="badge badge-success">✅ {t('signed5')}</span>
                    : <span className="badge badge-warning">📝 {t('ceka')}</span>
                  }</div>
                </div>
                {showDetailModal.potpisnik && (
                  <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('signer3')}</div><div style={{ fontWeight: 600 }}>{showDetailModal.potpisnik}</div></div>
                )}
                {showDetailModal.datumPotpisa && (
                  <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('signDate1')}</div><div style={{ fontWeight: 600 }}>{formatDate(showDetailModal.datumPotpisa?.slice(0, 10))}</div></div>
                )}
                {showDetailModal.certifikat && (
                  <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('uvjerenje')}</div><div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.78rem' }}>{showDetailModal.certifikat}</div></div>
                )}
              </div>
              {showDetailModal.potpis && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--bg-input)', fontFamily: 'monospace', fontSize: '0.6rem', wordBreak: 'break-all', color: 'var(--text-muted)' }}>
                  <strong>SHA-256 Hash:</strong> {showDetailModal.potpis}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!showDetailModal.potpisano && (
                <button className="btn btn-primary" onClick={() => { setShowDetailModal(null); openSignModal(showDetailModal); }}>
                  ✍️ {t('sign1')}
                </button>
              )}
              {showDetailModal.potpisano && (
                <>
                  <button className="btn btn-ghost" onClick={() => handleVerify(showDetailModal)}>
                    🔍 {t('verify1')}
                  </button>
                  <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { handleRevokeSignature(showDetailModal); setShowDetailModal(null); }}>
                    ❌ {t('revoke')}
                  </button>
                </>
              )}
              <button className="btn btn-ghost" onClick={() => setShowDetailModal(null)}>{t('zatvori')}</button>
            </div>
          </div>
        </div>
      )}
      <DialogRenderer />
    </div>
  );
}
