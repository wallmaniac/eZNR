'use client';
import DateInput from '@/components/DateInput';
import TimeInput from '@/components/TimeInput';
import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO, getActiveCompanyId
} from '@/lib/dataStore';
import { uploadDocument } from '@/lib/storageService';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import PageHeader from '@/components/PageHeader';

const EMPTY_OIR1 = {
  // Section 1: General
  nadleznoTijelo: '',
  adresaTijela: '',
  dogadjajNastaoU: '',
  datumDogadjaja: todayISO(),
  vrijemeDogadjaja: '',
  // Section 2: Injured workers (up to 5)
  ozlijedjeni: [
    { workerId: '', mjesto: '' },
    { workerId: '', mjesto: '' },
    { workerId: '', mjesto: '' },
    { workerId: '', mjesto: '' },
    { workerId: '', mjesto: '' },
  ],
  // Section 3: Deceased workers (up to 4)
  poginuli: [
    { workerId: '' },
    { workerId: '' },
    { workerId: '' },
    { workerId: '' },
  ],
  // Section 4: Event details
  opisDogadjaja: '',
  rukovoditelj: '',
  primjenjeneMjere: '',
  prisutniZaposlenici: '',
  // Section 5: Filing
  podnositelj: '',
  mjestoPrijave: '',
  datumPrijave: todayISO(),
  docName: '',
  docData: '',
  fileObj: null,
};

export default function FormOIR1Page() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, confirm, DialogRenderer } = useDialog();

  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, maxH: 300 });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_OIR1 });
  const [search, setSearch] = useState('');
  const docInputRef = useRef(null);

  const toggleAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(records.map(x => x.id)));
    else setSelectedIds(new Set());
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (await confirm(t('deleteItems12').replace('{0}', selectedIds.size))) {
      for (let id of selectedIds) await remove(COLLECTIONS.FORMS_OIR1, id);
      setSelectedIds(new Set());
      loadData();
    }
  };

  const loadData = useCallback(() => {
    setRecords(getAll(COLLECTIONS.FORMS_OIR1));
    setWorkers(getAll(COLLECTIONS.WORKERS));
  }, []);

  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);

  useEffect(() => {
    const openId = searchParams?.get('openId');
    if (openId && records.length> 0 && !showForm) {
      const rec = records.find(r => r.id === openId);
      if (rec) handleEdit(rec);
    }
  }, [searchParams, records]);
  const filteredRecords = search
    ? records.filter(r => r.dogadjajNastaoU?.toLowerCase().includes(search.toLowerCase()) || r.podnositelj?.toLowerCase().includes(search.toLowerCase()))
    : records;
  // NOTE: enrichment happens below after getInjuredSummary is defined
  const { sorted, toggleSort, sortIcon, thStyle } = useSortedList(filteredRecords, 'datumDogadjaja');


  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const setInjured = (idx, field, value) => {
    setFormData(prev => {
      const arr = [...prev.ozlijedjeni];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, ozlijedjeni: arr };
    });
  };

  const setDeceased = (idx, field, value) => {
    setFormData(prev => {
      const arr = [...prev.poginuli];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, poginuli: arr };
    });
  };

  const handleNew = () => {
    setFormData({ ...EMPTY_OIR1, datumDogadjaja: todayISO(), datumPrijave: todayISO() });
    setEditingId(null);
    setShowForm(true);
  };

  const handleEdit = (item) => {
    setFormData({
      ...EMPTY_OIR1,
      ...item,
      ozlijedjeni: item.ozlijedjeni || EMPTY_OIR1.ozlijedjeni,
      poginuli: item.poginuli || EMPTY_OIR1.poginuli,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm(t('obrisatiObrazac'));
    if (ok) { remove(COLLECTIONS.FORMS_OIR1, id); loadData(); }
  };

  const handleSave = async () => {
    let uploadedUrl = formData.docData;
    if (formData.fileObj) {
      try {
        const cid = getActiveCompanyId();
        const res = await uploadDocument(formData.fileObj, cid, 'form-oir1');
        uploadedUrl = res.url;
      } catch (e) {
        await alert('Upload failed: ' + e.message); return;
      }
    }
    
    const payload = { ...formData, docData: uploadedUrl };
    delete payload.fileObj;

    if (editingId) {
      update(COLLECTIONS.FORMS_OIR1, editingId, payload);
    } else {
      create(COLLECTIONS.FORMS_OIR1, payload);
    }
    setShowForm(false);
    loadData();
  };

  const getWorkerName = (id) => {
    const w = workers.find(wk => wk.id === id);
    return w ? `${w.prezime} ${w.ime}` : '—';
  };

  // Gather display names for injured workers
  const getInjuredSummary = (rec) => {
    const names = (rec.ozlijedjeni || [])
      .filter(o => o.workerId)
      .map(o => getWorkerName(o.workerId));
    return names.length> 0 ? names.join(', ') : '—';
  };

  // Enrich sorted list with _injured for sorting (defined here after getInjuredSummary)
  const enrichedSorted = sorted.map(r => ({ ...r, _injured: getInjuredSummary(r) }));

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size> 15 * 1024 * 1024) {
      await alert(t('dokumentMoraBitiManjiOd'));
      return;
    }
    setFormData(prev => ({
      ...prev,
      docName: file.name,
      fileObj: file,
    }));
  };

  const downloadDoc = (log) => {
    if (!log.docData) return;
    if (log.docData.startsWith('http')) {
      window.open(log.docData, '_blank');
      return;
    }
    const a = document.createElement('a');
    a.href = log.docData;
    a.download = log.docName || 'prilog_dokumenta';
    a.click();
  };

  const openDoc = (docData, docName) => {
    if (!docData) return;
    if (docData.startsWith('http')) {
      window.open(docData, '_blank');
      return;
    }
    const w = window.open();
    if (w) {
      w.document.write('<html><head><title>' + (docName || 'Dokument') + '</title></head><body style="margin:0"><iframe src="' + docData + '" style="width:100%;height:100vh;border:none"></iframe></body></html>');
      w.document.close();
    }
  };

  const labelSt = {
    fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
  };
  const sectionTitle = {
    fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
  };
  const menuItemSt = {
    display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem',
    color: 'var(--text)', fontFamily: 'var(--font-body)', transition: 'background 0.12s',
  };

  // ── List view ──
  if (!showForm) {
    return (
      <div className="animate-fadeIn">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>📑 {t('formOIR1')}</h1>
        </div>
        <DialogRenderer />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body scrollable-toolbar" style={{ padding: 0, gap: 10 }}>
            <button className="btn btn-primary" onClick={handleNew} title={t('dodajNoviOir1Obrazac')}>
              + {t('noviOir1')}
            </button>
            <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
              <input
                placeholder={t('pretrazi1')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }}
              />
              {search && <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')} title={t('ponistiPretragu')}>✕</button>}
            </div>
            {/* Grupne akcije bar */}
            {selectedIds.size> 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedIds.size} {t('odabrano')}:</span>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()} title={t('isprintajOdabraneObrasce')}>🖨️ {t('isprintaj')}</button>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteSelected} title={t('obrisiOdabraneObrasce')}>🗑️ {t('obrisi')}</button>
              </div>
            )}
            {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{records.length} {t('zapisa')}</span>}
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === records.length && records.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} /></th>
                  <th>{t('akcije')}</th>
                  <th onClick={() => toggleSort('datumDogadjaja')} style={thStyle('datumDogadjaja')}>{t('datumDogaaja')}{sortIcon('datumDogadjaja')}</th>
                  <th onClick={() => toggleSort('dogadjajNastaoU')} style={thStyle('dogadjajNastaoU')}>{t('lokacija')}{sortIcon('dogadjajNastaoU')}</th>
                  <th onClick={() => toggleSort('_injured')} style={thStyle('_injured')}>{t('ozlijeeni')}{sortIcon('_injured')}</th>
                  <th onClick={() => toggleSort('podnositelj')} style={thStyle('podnositelj')}>{t('podnositelj')}{sortIcon('podnositelj')}</th>
                  <th onClick={() => toggleSort('datumPrijave')} style={thStyle('datumPrijave')}>{t('datumPrijave')}{sortIcon('datumPrijave')}</th>
                </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : enrichedSorted.map((r, idx) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => handleEdit(r)}>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>
                      <td style={{ position: 'relative' }}>
                        <button className="btn btn-primary btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={e => {
                          e.stopPropagation();
                          if (actionMenuId === r.id) { setActionMenuId(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const spaceAbove = rect.top;
                          const flipUp = spaceBelow < 180 && spaceAbove> spaceBelow;
                          setMenuPos(flipUp
                              ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                              : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                          );
                          setActionMenuId(r.id);
                        }} title={t('prikaziAkcijeZaObrazac')}>
                          {t('actions1')}
                        </button>
                        {actionMenuId === r.id && typeof document !== 'undefined' && createPortal(
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                            <div data-menu onMouseDown={(e) => e.preventDefault()} style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto' }}>
                              <button onClick={() => { setActionMenuId(null); handleEdit(r); }} className="dropdown-item">✏️ Otvori</button>
                              {r.docData && <button onClick={() => { setActionMenuId(null); downloadDoc(r); }} className="dropdown-item">📎 Preuzmi prilog</button>}
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => { setActionMenuId(null); handleDelete(r.id); }} className="dropdown-item text-danger">🗑️ Obriši</button>
                            </div>
                            </>, document.body
                          )}
                      </td>
                      <td>{formatDate(r.datumDogadjaja)}</td>
                      <td>{r.dogadjajNastaoU || '—'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getInjuredSummary(r)}</td>
                      <td>{r.podnositelj || '—'}</td>
                      <td>{formatDate(r.datumPrijave)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ──
  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={() => setShowForm(false)} title={t('nazad')}>←</button>
        <h1 style={{ margin: 0 }}>📄 {editingId ? (t('urediOir1')) : (t('noviOir1'))}</h1>
      </div>
      <DialogRenderer />

      {/* Page title */}
      <div style={{ marginBottom: 20, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {t('obavijestODogaajuNaRadu')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ SECTION 1: General info ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{t('obrazacOir1')}</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('nazivNadleznogTijelaInspekcijeRada')}</div>
              <input className="form-input" value={formData.nadleznoTijelo} onChange={e => set('nadleznoTijelo', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('adresa')}</div>
              <input className="form-input" value={formData.adresaTijela} onChange={e => set('adresaTijela', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('dogaajNaRaduNastaoJe')}</div>
              <input className="form-input" value={formData.dogadjajNastaoU} onChange={e => set('dogadjajNastaoU', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 140px', gap: 12 }}>
              <div>
                <div style={labelSt}>{t('danaDatum')}</div>
                <DateInput value={formData.datumDogadjaja} onChange={v => set('datumDogadjaja', v)} />
              </div>
              <div>
                <div style={labelSt}>{t('vrijeme')}</div>
                <TimeInput value={formData.vrijemeDogadjaja} onChange={v => set('vrijemeDogadjaja', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION 2: Injured workers ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{t('podaciOOzlijeenimZaposlenicima')}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              {t('mjestoIAdresaGdjeSe')}
            </div>

            {formData.ozlijedjeni.map((o, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>OR{idx + 1}:</div>
                <select className="form-select" value={o.workerId} onChange={e => setInjured(idx, 'workerId', e.target.value)}>
                  <option value="">{t('odaberiteOrObrazac')}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime} {w.oib ? `(${w.oib})` : ''}</option>
                  ))}
                </select>
                <input className="form-input" placeholder={t('mjestoadresaNakonDogaaja')}
                  value={o.mjesto} onChange={e => setInjured(idx, 'mjesto', e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        {/* ═══ SECTION 3: Deceased workers ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{t('podaciOPoginulimZaposlenicima')}</div>

            {formData.poginuli.map((p, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>OR{idx + 1}:</div>
                <select className="form-select" value={p.workerId} onChange={e => setDeceased(idx, 'workerId', e.target.value)}>
                  <option value="">{t('odaberiteOrObrazac')}</option>
                  {workers.filter(w => w.aktivan !== false).map(w => (
                    <option key={w.id} value={w.id}>{w.prezime} {w.ime} {w.oib ? `(${w.oib})` : ''}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ SECTION 4: Event description ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{t('detaljiDogaaja')}</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('opisDogaaja')}</div>
              <textarea className="form-input" rows={5} value={formData.opisDogadjaja} onChange={e => set('opisDogadjaja', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('rukovoditelj')}</div>
              <textarea className="form-input" rows={3} value={formData.rukovoditelj} onChange={e => set('rukovoditelj', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('primjenjeneMjere')}</div>
              <textarea className="form-input" rows={3} value={formData.primjenjeneMjere} onChange={e => set('primjenjeneMjere', e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('prisutniZaposlenici')}</div>
              <textarea className="form-input" rows={3} value={formData.prisutniZaposlenici} onChange={e => set('prisutniZaposlenici', e.target.value)} />
            </div>
          </div>
        </div>

        {/* ═══ SECTION 5: Filing ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{t('podnositeljPrijave')}</div>

            <div style={{ marginBottom: 14 }}>
              <div style={labelSt}>{t('podnositelj')}</div>
              <input className="form-input" value={formData.podnositelj} onChange={e => set('podnositelj', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
              <div>
                <div style={labelSt}>{t('mjestoPrijave')}</div>
                <input className="form-input" value={formData.mjestoPrijave} onChange={e => set('mjestoPrijave', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{t('datumPrijave')}</div>
                <DateInput value={formData.datumPrijave} onChange={v => set('datumPrijave', v)} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Document Upload ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>{t('prilog')}</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">📎 {t('dokumentPdfWordMaks2mb')}</label>
              {formData.docName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(33,150,243,0.06)', borderRadius: 8, border: '1px solid rgba(33,150,243,0.2)' }}>
                      <button type="button" onClick={() => openDoc(formData.docData, formData.docName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--info)', fontSize: '0.85rem', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationStyle: 'solid' }}>📎 {formData.docName}</button>
                      <div className="scrollable-toolbar" style={{ padding: 0, gap: 8 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDoc(formData.docData, formData.docName)} style={{ color: 'var(--info)' }} title={t('pregledPriloga')}>👁 {t('otvori')}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadDoc({ docData: formData.docData, docName: formData.docName })} style={{ color: 'var(--primary)' }} title={t('preuzmiPrilog')}>↓ {t('preuzmi')}</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); setFormData(p => ({ ...p, docName: '', docData: '' })); }} style={{ color: 'var(--danger)' }} title={t('ukloniPrilog')}>✕ {t('ukloni')}</button>
                      </div>
                  </div>
              ) : (
                  <div onClick={() => docInputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      📂 {t('klikniteZaUploadDokumentaWord')}
                  </div>
              )}
              <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleDocUpload} />
            </div>
          </div>
        </div>

        {/* ═══ Action buttons ═══ */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              💾 {t('sacuvajObrazac')}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>
              ↩ {t('cancel')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

