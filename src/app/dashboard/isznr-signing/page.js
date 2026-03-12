'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';

// Simulated digital signature generation
function generateSignatureHash() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let hash = '';
  for (let i = 0; i < 64; i++) hash += chars.charAt(Math.floor(Math.random() * chars.length));
  return hash;
}

export default function ISZNRSigningPage() {
  const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { user, activeCompanyId } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('sign');
  const [showSignModal, setShowSignModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [signStep, setSignStep] = useState(0); // 0=select, 1=pin, 2=signing, 3=done
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

  // Load ISZNR documents
  const loadData = useCallback(() => {
    setDocuments(getAll(COLLECTIONS.ISZNR_DOCUMENTS));
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  // Document types
  const docTypes = useMemo(() => getAll(COLLECTIONS.ISZNR_DOC_TYPES), []);
  const getDocTypeName = (id) => docTypes.find(dt => dt.id === id)?.naziv || id;

  // Filtered documents
  const filteredDocs = useMemo(() => {
    let result = documents;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(d => d.naslov.toLowerCase().includes(q));
    }
    if (activeTab === 'signed') result = result.filter(d => d.potpisano);
    if (activeTab === 'unsigned') result = result.filter(d => !d.potpisano);
    return result;
  }, [documents, searchTerm, activeTab]);

  // Stats
  const stats = useMemo(() => ({
    total: documents.length,
    signed: documents.filter(d => d.potpisano).length,
    unsigned: documents.filter(d => !d.potpisano).length,
  }), [documents]);

  // ── Sign Flow ──
  const openSignModal = (doc = null) => {
    setSelectedDoc(doc);
    setSignStep(doc ? 1 : 0); // If doc selected, go straight to PIN
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
    // Select first doc, we'll sign them sequentially
    const firstDoc = documents.find(d => d.id === batchSelected[0]);
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
      setPinError(lang === 'bs' ? 'PIN mora imati najmanje 4 znaka' : 'PIN must be at least 4 characters');
      return;
    }
    setPinError('');
    setSignStep(2);

    // Simulate signing process
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
      // In batch mode, sign ALL selected docs
      if (batchMode && batchSelected.length > 0) {
        batchSelected.forEach(docId => {
          update(COLLECTIONS.ISZNR_DOCUMENTS, docId, {
            ...signatureData,
            potpis: generateSignatureHash(), // unique hash per doc
          });
        });
      } else if (selectedDoc) {
        update(COLLECTIONS.ISZNR_DOCUMENTS, selectedDoc.id, signatureData);
      }
      loadData();
      setSignStep(3);
    }, 2500);
  };

  // ── Verify Flow ──
  const handleVerify = (doc) => {
    setShowDetailModal(null);
    setVerifyFile(doc);
    setVerifyResult(null);
    setShowVerifyModal(true);

    // Simulate verification
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
    const ok = await confirm(lang === 'bs' ? 'Poništiti digitalni potpis na ovom dokumentu?' : 'Revoke digital signature on this document?'); if (!ok) return;
    update(COLLECTIONS.ISZNR_DOCUMENTS, doc.id, {
      potpisano: false,
      datumPotpisa: null,
      potpis: null,
      potpisnik: null,
      certifikat: null,
    });
    loadData();
  };

  const handleDeleteDoc = async (doc) => {
    const ok = await confirm(lang === 'bs' ? 'Obrisati dokument?' : 'Delete document?'); if (!ok) return;
    remove(COLLECTIONS.ISZNR_DOCUMENTS, doc.id);
    loadData();
  };

  const tabs = [
    { key: 'all', label: lang === 'bs' ? 'Svi dokumenti' : 'All documents', icon: '📄', count: stats.total },
    { key: 'signed', label: lang === 'bs' ? 'Potpisani' : 'Signed', icon: '✅', count: stats.signed },
    { key: 'unsigned', label: lang === 'bs' ? 'Nepotpisani' : 'Unsigned', icon: '📝', count: stats.unsigned },
  ];

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dark)' }}>
            ✍️ {t('digitalSigning')}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {lang === 'bs' ? 'Digitalno potpisivanje i verifikacija dokumenata' : 'Digital document signing and verification'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openSignModal()}>
          ✍️ {lang === 'bs' ? 'Potpiši dokument' : 'Sign Document'}
        </button>
      </div>

      {/* Info banner */}
      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        ℹ️ {lang === 'bs'
          ? 'Digitalno potpisivanje dokumenata koristi kvalificirani elektronski certifikat (eZNR-CERT). Potpis osigurava autentičnost i integritet dokumenta u skladu sa Zakonom o elektronskom potpisu.'
          : 'Digital document signing uses a qualified electronic certificate (eZNR-CERT). The signature ensures document authenticity and integrity in compliance with the Electronic Signature Act.'}
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: lang === 'bs' ? 'Ukupno dokumenata' : 'Total documents', value: stats.total, icon: '📄', color: 'var(--primary)' },
          { label: lang === 'bs' ? 'Potpisano' : 'Signed', value: stats.signed, icon: '✅', color: '#2E7D32' },
          { label: lang === 'bs' ? 'Čeka potpis' : 'Pending', value: stats.unsigned, icon: '📝', color: '#F57C00' },
          { label: lang === 'bs' ? 'Certifikat' : 'Certificate', value: 'Aktivan', icon: '🔐', color: '#1565C0' },
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

      {/* Tabs & Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setActiveTab(tb.key)} style={{
            padding: '10px 20px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '0.82rem',
            background: activeTab === tb.key ? 'var(--dark)' : 'var(--bg-input)',
            color: activeTab === tb.key ? 'white' : 'var(--text)',
            boxShadow: activeTab === tb.key ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            transition: 'all 0.2s',
          }}>
            {tb.icon} {tb.label} <span style={{ marginLeft: 6, background: activeTab === tb.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-badge)', padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem' }}>{tb.count}</span>
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', width: 260 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
          <input className="form-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'}
            style={{ paddingLeft: 32, borderRadius: 'var(--radius-full)', fontSize: '0.82rem' }} />
        </div>
      </div>

      {/* Documents Table */}
      <div className="card">
        <div className="card-body">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('actions')}</th>
                  <th>{t('name')}</th>
                  <th>{lang === 'bs' ? 'Tip' : 'Type'}</th>
                  <th>{t('date')}</th>
                  <th>{t('status')}</th>
                  <th>{lang === 'bs' ? 'Potpisnik' : 'Signer'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    {t('noRecords')}
                  </td></tr>
                ) : filteredDocs.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!doc.potpisano && (
                          <button className="btn btn-primary btn-sm" onClick={() => openSignModal(doc)} title={lang === 'bs' ? 'Potpiši' : 'Sign'}>
                            ✍️
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowDetailModal(doc)} title={lang === 'bs' ? 'Detalji' : 'Details'}>
                          👁️
                        </button>
                        {doc.potpisano && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleVerify(doc)} title={lang === 'bs' ? 'Verifikuj' : 'Verify'}>
                            🔍
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteDoc(doc)} style={{ color: 'var(--danger)' }}>🗑️</button>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{doc.naslov}</td>
                    <td><span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 6, background: '#E3F2FD', color: '#1565C0', fontWeight: 600 }}>{getDocTypeName(doc.tipDokumentaId)}</span></td>
                    <td>{formatDate(doc.datum)}</td>
                    <td>
                      {doc.potpisano ? (
                        <span className="badge badge-success">✅ {lang === 'bs' ? 'Potpisano' : 'Signed'}</span>
                      ) : (
                        <span className="badge badge-warning">📝 {lang === 'bs' ? 'Čeka potpis' : 'Pending'}</span>
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

      {/* ── SIGN MODAL ── */}
      {showSignModal && (
        <div className="modal-overlay" onClick={() => setShowSignModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #1565C0, #42A5F5)' }}>
              <h2 style={{ color: 'white' }}>✍️ {lang === 'bs' ? 'Digitalno potpisivanje' : 'Digital Signing'}</h2>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowSignModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Step indicators */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
                {[
                  lang === 'bs' ? '1. Odaberi' : '1. Select',
                  lang === 'bs' ? '2. PIN' : '2. PIN',
                  lang === 'bs' ? '3. Potpis' : '3. Sign',
                  lang === 'bs' ? '4. Gotovo' : '4. Done'
                ].map((step, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '8px 4px',
                    fontSize: '0.72rem', fontWeight: 700,
                    background: signStep >= i ? 'var(--primary)' : 'var(--bg-input)',
                    color: signStep >= i ? 'white' : 'var(--text-muted)',
                    borderRadius: i === 0 ? '8px 0 0 8px' : i === 3 ? '0 8px 8px 0' : 0,
                  }}>
                    {step}
                  </div>
                ))}
              </div>

              {/* Step 0: Select/Create document */}
              {signStep === 0 && (() => {
                const unsignedDocs = documents.filter(d => !d.potpisano);
                const modalFiltered = modalDocSearch.trim()
                  ? unsignedDocs.filter(d => d.naslov.toLowerCase().includes(modalDocSearch.toLowerCase()))
                  : unsignedDocs;
                return (
                  <div>
                    <h4 style={{ marginBottom: 12 }}>📄 {lang === 'bs' ? 'Odaberite ili kreirajte dokument' : 'Select or create a document'}</h4>

                    {/* Existing unsigned docs */}
                    {unsignedDocs.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        {/* Header with count + batch toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {lang === 'bs' ? 'Nepotpisani dokumenti' : 'Unsigned documents'}
                            <span style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 10, background: '#FFF3E0', color: '#E65100', fontSize: '0.68rem' }}>
                              {unsignedDocs.length}
                            </span>
                          </div>
                          {unsignedDocs.length > 1 && (
                            <button onClick={() => { setBatchMode(!batchMode); setBatchSelected([]); }}
                              style={{
                                fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 8,
                                border: batchMode ? '2px solid var(--primary)' : '1px solid var(--border)',
                                background: batchMode ? 'rgba(0,191,166,0.08)' : 'transparent',
                                color: batchMode ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}>
                              {batchMode ? '✅' : '☐'} {lang === 'bs' ? 'Grupno potpisivanje' : 'Batch sign'}
                            </button>
                          )}
                        </div>

                        {/* Search inside modal — shown when more than 5 docs */}
                        {unsignedDocs.length > 5 && (
                          <div style={{ position: 'relative', marginBottom: 8 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem' }}>🔍</span>
                            <input
                              className="form-input"
                              value={modalDocSearch}
                              onChange={e => setModalDocSearch(e.target.value)}
                              placeholder={lang === 'bs' ? 'Filtriraj dokumente...' : 'Filter documents...'}
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

                        {/* Batch select all / deselect all */}
                        {batchMode && modalFiltered.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <button onClick={() => setBatchSelected(modalFiltered.map(d => d.id))}
                              style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
                              ✅ {lang === 'bs' ? 'Odaberi sve' : 'Select all'} ({modalFiltered.length})
                            </button>
                            <button onClick={() => setBatchSelected([])}
                              style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600 }}>
                              ☐ {lang === 'bs' ? 'Poništi izbor' : 'Deselect all'}
                            </button>
                          </div>
                        )}

                        {/* Scrollable document list */}
                        <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 8, border: unsignedDocs.length > 5 ? '1px solid var(--border-light)' : 'none' }}>
                          {modalFiltered.length === 0 ? (
                            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                              {lang === 'bs' ? 'Nema rezultata' : 'No results'}
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

                        {/* Batch sign button */}
                        {batchMode && batchSelected.length > 0 && (
                          <button className="btn btn-primary" onClick={handleBatchSign} style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}>
                            ✍️ {lang === 'bs' ? `Potpiši ${batchSelected.length} dokumenata` : `Sign ${batchSelected.length} documents`}
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                        {lang === 'bs' ? 'Ili kreirajte novi' : 'Or create new'}
                      </div>
                      <div className="form-group">
                        <label className="form-label">{lang === 'bs' ? 'Naziv dokumenta' : 'Document title'} *</label>
                        <input className="form-input" value={newDocForm.naslov} onChange={e => setNewDocForm(p => ({ ...p, naslov: e.target.value }))}
                          placeholder={lang === 'bs' ? 'npr. Zapisnik o ispitivanju' : 'e.g. Inspection Report'} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                        <div className="form-group">
                          <label className="form-label">{lang === 'bs' ? 'Tip dokumenta' : 'Document type'}</label>
                          <select className="form-input" value={newDocForm.tipDokumenta} onChange={e => setNewDocForm(p => ({ ...p, tipDokumenta: e.target.value }))}>
                            {docTypes.map(dt => <option key={dt.id} value={dt.oznaka}>{dt.naziv}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">{lang === 'bs' ? 'Napomena' : 'Note'}</label>
                          <input className="form-input" value={newDocForm.napomena} onChange={e => setNewDocForm(p => ({ ...p, napomena: e.target.value }))} />
                        </div>
                      </div>
                      <button className="btn btn-primary" onClick={handleNewDocForSigning} disabled={!newDocForm.naslov.trim()} style={{ marginTop: 12 }}>
                        📄 {lang === 'bs' ? 'Kreiraj i potpiši' : 'Create & Sign'}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Step 1: PIN Entry */}
              {signStep === 1 && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔐</div>
                  <h4 style={{ marginBottom: 4 }}>{lang === 'bs' ? 'Unesite PIN certifikata' : 'Enter Certificate PIN'}</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    {lang === 'bs' ? 'Dokument:' : 'Document:'} <strong>{selectedDoc?.naslov}</strong>
                  </p>
                  <input className="form-input" type="password" value={pinCode} onChange={e => setPinCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                    placeholder="PIN" autoFocus
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: 8, maxWidth: 200, margin: '0 auto' }} />
                  {pinError && <div style={{ color: '#C62828', fontSize: '0.82rem', marginTop: 8, fontWeight: 600 }}>⚠️ {pinError}</div>}
                  <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button className="btn btn-ghost" onClick={() => setSignStep(0)}>{lang === 'bs' ? 'Nazad' : 'Back'}</button>
                    <button className="btn btn-primary" onClick={handlePinSubmit} disabled={!pinCode}>
                      🔓 {lang === 'bs' ? 'Potvrdi' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Signing... */}
              {signStep === 2 && (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%', margin: '0 auto 16px',
                    border: '4px solid var(--primary)', borderTopColor: 'transparent',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  <h4>{lang === 'bs' ? 'Potpisivanje u toku...' : 'Signing in progress...'}</h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {lang === 'bs' ? 'Primjena SHA-256 + RSA-2048 algoritma' : 'Applying SHA-256 + RSA-2048 algorithm'}
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Step 3: Done */}
              {signStep === 3 && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '4rem', marginBottom: 12 }}>✅</div>
                  <h3 style={{ color: '#2E7D32', marginBottom: 8 }}>
                    {batchMode && batchSelected.length > 1
                      ? (lang === 'bs' ? `${batchSelected.length} dokumenata uspješno potpisano!` : `${batchSelected.length} documents successfully signed!`)
                      : (lang === 'bs' ? 'Dokument uspješno potpisan!' : 'Document successfully signed!')}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                    {batchMode && batchSelected.length > 1
                      ? (lang === 'bs' ? 'Grupno potpisivanje završeno' : 'Batch signing complete')
                      : selectedDoc?.naslov}
                  </p>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 12, padding: 16, textAlign: 'left', marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Potpisnik:' : 'Signer:'}</span> <strong>{user?.firstName} {user?.lastName}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Datum:' : 'Date:'}</span> <strong>{formatDate(new Date().toISOString().slice(0, 10))}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Algoritam:' : 'Algorithm:'}</span> <strong>SHA-256 + RSA-2048</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Certifikat:' : 'Certificate:'}</span> <strong>eZNR-CERT</strong></div>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => setShowSignModal(false)}>
                    ✅ {lang === 'bs' ? 'Zatvori' : 'Close'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── VERIFY MODAL ── */}
      {showVerifyModal && (
        <div className="modal-overlay" onClick={() => setShowVerifyModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #2E7D32, #66BB6A)' }}>
              <h2 style={{ color: 'white' }}>🔍 {lang === 'bs' ? 'Verifikacija potpisa' : 'Signature Verification'}</h2>
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
                  <p style={{ color: 'var(--text-muted)' }}>{lang === 'bs' ? 'Verifikacija u toku...' : 'Verifying...'}</p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : (
                <div>
                  <div style={{
                    textAlign: 'center', padding: 20, marginBottom: 16,
                    borderRadius: 12, border: `2px solid ${verifyResult.valid ? '#A5D6A7' : '#EF9A9A'}`,
                    background: verifyResult.valid ? '#E8F5E9' : '#FFEBEE',
                  }}>
                    <span style={{ fontSize: '3rem' }}>{verifyResult.valid ? '✅' : '❌'}</span>
                    <h3 style={{ color: verifyResult.valid ? '#2E7D32' : '#C62828', marginTop: 8 }}>
                      {verifyResult.valid
                        ? (lang === 'bs' ? 'Potpis je validan!' : 'Signature is valid!')
                        : (lang === 'bs' ? 'Potpis nije validan!' : 'Signature is not valid!')}
                    </h3>
                  </div>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 12, padding: 16, fontSize: '0.82rem' }}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>📄 {lang === 'bs' ? 'Dokument' : 'Document'}</span><strong>{verifyFile?.naslov}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>👤 {lang === 'bs' ? 'Potpisnik' : 'Signer'}</span><strong>{verifyResult.signer}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>📅 {lang === 'bs' ? 'Datum potpisa' : 'Sign date'}</span><strong>{formatDate(verifyResult.signDate)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>🔐 {lang === 'bs' ? 'Certifikat' : 'Certificate'}</span><strong>{verifyResult.certId}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>🔒 {lang === 'bs' ? 'Algoritam' : 'Algorithm'}</span><strong>{verifyResult.algorithm}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>🛡️ {lang === 'bs' ? 'Integritet' : 'Integrity'}</span><strong style={{ color: verifyResult.integrity === 'OK' ? '#2E7D32' : '#C62828' }}>{verifyResult.integrity}</strong></div>
                    </div>
                    {verifyResult.hash && verifyResult.hash !== 'NOT_SIGNED' && (
                      <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: '#ECEFF1', fontFamily: 'monospace', fontSize: '0.65rem', wordBreak: 'break-all', color: '#546E7A' }}>
                        {lang === 'bs' ? 'Hash:' : 'Hash:'} {verifyResult.hash}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowVerifyModal(false)}>{lang === 'bs' ? 'Zatvori' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {showDetailModal && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ background: showDetailModal.potpisano ? 'linear-gradient(135deg, #2E7D32, #66BB6A)' : 'linear-gradient(135deg, #F57C00, #FFB74D)' }}>
              <h2 style={{ color: 'white' }}>📄 {showDetailModal.naslov}</h2>
              <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setShowDetailModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{lang === 'bs' ? 'Tip' : 'Type'}</div><div style={{ fontWeight: 600 }}>{getDocTypeName(showDetailModal.tipDokumentaId)}</div></div>
                <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('date')}</div><div style={{ fontWeight: 600 }}>{formatDate(showDetailModal.datum)}</div></div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{t('status')}</div>
                  <div>{showDetailModal.potpisano
                    ? <span className="badge badge-success">✅ {lang === 'bs' ? 'Potpisano' : 'Signed'}</span>
                    : <span className="badge badge-warning">📝 {lang === 'bs' ? 'Čeka potpis' : 'Pending'}</span>
                  }</div>
                </div>
                {showDetailModal.potpisnik && (
                  <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{lang === 'bs' ? 'Potpisnik' : 'Signer'}</div><div style={{ fontWeight: 600 }}>{showDetailModal.potpisnik}</div></div>
                )}
                {showDetailModal.datumPotpisa && (
                  <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{lang === 'bs' ? 'Datum potpisa' : 'Sign date'}</div><div style={{ fontWeight: 600 }}>{formatDate(showDetailModal.datumPotpisa?.slice(0, 10))}</div></div>
                )}
                {showDetailModal.certifikat && (
                  <div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{lang === 'bs' ? 'Certifikat' : 'Certificate'}</div><div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.78rem' }}>{showDetailModal.certifikat}</div></div>
                )}
              </div>
              {showDetailModal.potpis && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#ECEFF1', fontFamily: 'monospace', fontSize: '0.6rem', wordBreak: 'break-all', color: '#546E7A' }}>
                  <strong>SHA-256 Hash:</strong> {showDetailModal.potpis}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!showDetailModal.potpisano && (
                <button className="btn btn-primary" onClick={() => { setShowDetailModal(null); openSignModal(showDetailModal); }}>
                  ✍️ {lang === 'bs' ? 'Potpiši' : 'Sign'}
                </button>
              )}
              {showDetailModal.potpisano && (
                <>
                  <button className="btn btn-ghost" onClick={() => handleVerify(showDetailModal)}>
                    🔍 {lang === 'bs' ? 'Verifikuj' : 'Verify'}
                  </button>
                  <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => { handleRevokeSignature(showDetailModal); setShowDetailModal(null); }}>
                    ❌ {lang === 'bs' ? 'Poništi potpis' : 'Revoke'}
                  </button>
                </>
              )}
              <button className="btn btn-ghost" onClick={() => setShowDetailModal(null)}>{lang === 'bs' ? 'Zatvori' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}
      <DialogRenderer />
    </div>
  );
}
