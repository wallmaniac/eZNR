'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import QuestionnaireBuilder from '@/components/SurveyCreator';
import EmailDispatchModal from '@/components/EmailDispatchModal';
import QuestionnaireResults from '@/components/QuestionnaireResults';

/* ═══════════════════════════════════════════════
   Upitnici — Questionnaire System
   Matching: https://app.zastitanaradu.hr/merkant/Upitnik
   ═══════════════════════════════════════════════ */

const ZA_VRSTU_OPTIONS = [
  'Djelatnik', 'DokumentTip', 'Posao', 'Tenant',
];

const DODAJ_PROCJENA_OPTIONS = [
  'Ne dodaje se u procjenu rizika',
  'Dodaje se u procjenu rizika',
];

const EMPTY_UPITNIK = {
  naziv: '',
  oznaka: '',
  zaVrstu: '',
  prikaziNaPortalu: false,
  dodajUPrilogProcjeniRizika: 'Ne dodaje se u procjenu rizika',
  emailZaRezultate: '',
  posaljiKopijuKorisniku: false,
  prikaziRezultateNakonRjesavanja: false,
  prikaziSamoZadovoljavaNezadovoljava: false,
  automatskiUpisUEvidenciju: false,
  prolazniPrag: 70, // pass threshold %
  izlazniTipDokumenta: '',
  zadaniIspisZaDokument: '',
  emailSubject: '',
  emailBody: '',
  porukaUspjesno: '',
  porukaNedovoljno: '',
  jezik: '',
  predlozak: false,
  // Survey JSON (simplified — stores the question definition)
  surveyJson: '{\n  "pages": [\n    {\n      "name": "page1",\n      "elements": []\n    }\n  ]\n}',
  // Responses
  responses: [],
};

// Built-in templates from reference app (WebZNR-ovi ugrađeni primjeri)
const BUILTIN_TEMPLATES = [
  { naziv: 'Alkotest ovlaštene osobe', oznaka: 'ALKO-oo', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Alkotest za poslodavce', oznaka: 'ALKO', zaVrstu: 'Djelatnik', prikaziNaPortalu: false },
  { naziv: 'Evidencija požara', oznaka: 'POŽAR', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Fizikalni v3', oznaka: 'FIv3', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Fizikalni v3 obavezna polja', oznaka: 'FIv3', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Kemijske v3', oznaka: 'KIv3', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Kemijske v3 bez prikaza (samo učitavanje iz Excela)', oznaka: 'KIv3', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Ocjenjivanje opterećenja / procjena rizika kod statodinamičkih napora', oznaka: 'STATO', zaVrstu: 'Posao', prikaziNaPortalu: true },
  { naziv: 'Primjer različitih mogućnosti upitnika', oznaka: 'PRIM', zaVrstu: 'Djelatnik', prikaziNaPortalu: false },
  { naziv: 'Procjena rizika - prikupljanje osnovnih podataka poslodavca', oznaka: '', zaVrstu: 'Tenant', prikaziNaPortalu: false },
  { naziv: 'Procjena rizika za sigurnost I zdravlje radnika pri obavljanju ponavljajućih zadataka', oznaka: 'PONAV', zaVrstu: 'Posao', prikaziNaPortalu: false },
  { naziv: 'Rad na računalu - upitnik za radnike', oznaka: 'RAČR', zaVrstu: 'Djelatnik', prikaziNaPortalu: true },
  { naziv: 'Rad na računalu - upitnik za stručnjake', oznaka: 'RAČ', zaVrstu: 'Djelatnik', prikaziNaPortalu: false },
  { naziv: 'Radna oprema v3', oznaka: 'ROv3', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Radna oprema v3 - čl. 41', oznaka: 'ROv3-41', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Radna oprema v3 - obavezni podaci', oznaka: 'ROv3', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Radni nalog - Ministarstvo', oznaka: 'RN-Min', zaVrstu: 'DokumentTip', prikaziNaPortalu: false },
  { naziv: 'Sudjelovanje radnika u procjeni rizika (Ministarstvo)', oznaka: 'SUD1', zaVrstu: 'Djelatnik', prikaziNaPortalu: false },
  { naziv: 'Test - radnik unosi svoje podatke', oznaka: 'Test', zaVrstu: 'Djelatnik', prikaziNaPortalu: true },
  { naziv: 'Test za rad na siguran način - predložak', oznaka: 'ZOS-TEST', zaVrstu: 'Djelatnik', prikaziNaPortalu: true },
];

export default function QuestionnairesPage() {
  const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();

  const [view, setView] = useState('list'); // list | form | results
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_UPITNIK });
  const [search, setSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null); // for Akcije dropdown
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 }); // fixed-position coords
  const menuButtonRef = useRef(null); // ref to the button that opened the menu
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchQuestionnaire, setDispatchQuestionnaire] = useState(null);
  const [resultsQuestionnaire, setResultsQuestionnaire] = useState(null);

  const loadData = useCallback(() => {
    setRecords(getAll(COLLECTIONS.QUESTIONNAIRES));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  // Navigate to form view (pushes history so browser back works)
  const goToForm = useCallback(() => {
    window.history.pushState({ upitnikView: 'form' }, '');
    setView('form');
  }, []);
  const goToList = useCallback(() => {
    setView('list');
    setOpenMenuId(null);
  }, []);

  // Browser back button handler
  useEffect(() => {
    const handlePopState = () => {
      if (view === 'form') {
        setView('list');
        setOpenMenuId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [view]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openMenuId) return;
    let id;
    const close = (e) => {
      // Don't close if clicking inside the dropdown
      if (e.target.closest && e.target.closest('[data-akcije-menu]')) return;
      setOpenMenuId(null);
    };
    // Delay adding listener to avoid catching the same click that opened it
    id = requestAnimationFrame(() => {
      document.addEventListener('mousedown', close);
    });
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('mousedown', close);
    };
  }, [openMenuId]);

  // Track scroll — reposition dropdown so it follows its trigger button
  useEffect(() => {
    if (!openMenuId || !menuButtonRef.current) return;
    const updatePos = () => {
      if (!menuButtonRef.current) return;
      const rect = menuButtonRef.current.getBoundingClientRect();
      // If button scrolled out of view, close the menu
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpenMenuId(null);
        return;
      }
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    };
    window.addEventListener('scroll', updatePos, true);
    return () => window.removeEventListener('scroll', updatePos, true);
  }, [openMenuId]);

  // CRUD
  const handleNew = () => {
    setFormData({ ...EMPTY_UPITNIK });
    setEditingId(null);
    goToForm();
  };
  const handleEdit = (item) => {
    setFormData({ ...EMPTY_UPITNIK, ...item });
    setEditingId(item.id);
    goToForm();
  };
  const handleDuplicate = (item) => {
    const dup = { ...EMPTY_UPITNIK, ...item };
    delete dup.id;
    delete dup.createdAt;
    delete dup.updatedAt;
    dup.naziv = (dup.naziv || '') + ' (kopija)';
    create(COLLECTIONS.QUESTIONNAIRES, dup);
    loadData();
    setOpenMenuId(null);
  };
  const handleTogglePortal = (item) => {
    update(COLLECTIONS.QUESTIONNAIRES, item.id, { prikaziNaPortalu: !item.prikaziNaPortalu });
    loadData();
    setOpenMenuId(null);
  };
  const handleDelete = async (id) => {
    setOpenMenuId(null);
    if (await confirm(lang === 'bs' ? 'Obrisati upitnik?' : 'Delete questionnaire?')) { remove(COLLECTIONS.QUESTIONNAIRES, id); loadData(); }
  };
  const handleSave = () => {
    if (editingId) update(COLLECTIONS.QUESTIONNAIRES, editingId, formData);
    else create(COLLECTIONS.QUESTIONNAIRES, formData);
    goToList(); loadData();
  };

  // Insert template
  const handleInsertTemplate = (tpl) => {
    create(COLLECTIONS.QUESTIONNAIRES, {
      ...EMPTY_UPITNIK,
      ...tpl,
      predlozak: true,
    });
    loadData();
  };

  const labelSt = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };
  const sectionTitle = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 };
  const menuItemStyle = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
    background: 'none', border: 'none', cursor: 'pointer', width: '100%',
    fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)',
    textAlign: 'left', transition: 'background 0.12s',
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     VIEW: LIST
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (view === 'list') {
    const filtered = search
      ? records.filter(r => (r.naziv || '').toLowerCase().includes(search.toLowerCase()) || (r.oznaka || '').toLowerCase().includes(search.toLowerCase()))
      : records;
    const filteredTemplates = templateSearch
      ? BUILTIN_TEMPLATES.filter(t => (t.naziv || '').toLowerCase().includes(templateSearch.toLowerCase()) || (t.oznaka || '').toLowerCase().includes(templateSearch.toLowerCase()))
      : BUILTIN_TEMPLATES;

    return (
      <div className="animate-fadeIn">
        <h1 style={{ marginBottom: 24 }}>❓ {t('questionnaires')}</h1>
        <DialogRenderer />

        {/* ═══ User Questionnaires ═══ */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={handleNew}>
              + {lang === 'bs' ? 'Novi' : 'New'}
            </button>
            <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
              <input placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
              <button className="btn btn-ghost btn-sm">{lang === 'bs' ? 'Traži' : 'Search'}</button>
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filtered.length} {lang === 'bs' ? 'zapisa' : 'records'}
            </span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 32 }}>
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('actions')}</th>
                    <th>{lang === 'bs' ? 'Naziv' : 'Name'}</th>
                    <th>{lang === 'bs' ? 'Povezan na' : 'Connected to'}</th>
                    <th>{lang === 'bs' ? 'Prikaži na portalu' : 'Show on portal'}</th>
                    <th>{lang === 'bs' ? 'Predložak' : 'Template'}</th>
                    <th>{lang === 'bs' ? 'Jezik' : 'Language'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ position: 'relative' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenuId === r.id) { setOpenMenuId(null); menuButtonRef.current = null; return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              menuButtonRef.current = e.currentTarget;
                              setMenuPos({ top: rect.bottom + 4, left: rect.left });
                              setOpenMenuId(r.id);
                            }}
                          >
                            {lang === 'bs' ? 'Akcije' : 'Actions'} ▼
                          </button>
                          {openMenuId === r.id && (
                            <div data-akcije-menu style={{
                              position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999,
                              background: 'var(--bg-card)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                              minWidth: 200, overflow: 'visible',
                            }}>
                              <button onClick={() => handleEdit(r)} style={menuItemStyle}>
                                📝 {lang === 'bs' ? 'Otvori' : 'Open'}
                              </button>
                              <button onClick={() => handleDuplicate(r)} style={menuItemStyle}>
                                📋 {lang === 'bs' ? 'Dupliciraj' : 'Duplicate'}
                              </button>
                              <button onClick={() => handleTogglePortal(r)} style={menuItemStyle}>
                                {r.prikaziNaPortalu ? '🔒' : '🌐'} {lang === 'bs'
                                  ? (r.prikaziNaPortalu ? 'Sakrij s portala' : 'Prikaži na portalu')
                                  : (r.prikaziNaPortalu ? 'Hide from portal' : 'Show on portal')}
                              </button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => { setOpenMenuId(null); setDispatchQuestionnaire(r); setDispatchModalOpen(true); }} style={menuItemStyle}>
                                📧 {lang === 'bs' ? 'Pošalji' : 'Send'}
                              </button>
                              <button onClick={() => { setOpenMenuId(null); setResultsQuestionnaire(r); setView('results'); }} style={menuItemStyle}>
                                📊 {lang === 'bs' ? 'Rezultati' : 'Results'}
                              </button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => handleDelete(r.id)} style={{ ...menuItemStyle, color: 'var(--danger)' }}>
                                🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span onClick={() => handleEdit(r)} style={{
                          fontWeight: 600, color: 'var(--primary)', cursor: 'pointer',
                          textDecoration: 'none', transition: 'opacity 0.15s',
                        }}
                          onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.target.style.textDecoration = 'none'}
                        >
                          {r.naziv || '—'}
                        </span>
                      </td>
                      <td>{r.zaVrstu || '—'}</td>
                      <td>{r.prikaziNaPortalu ? (lang === 'bs' ? 'Da' : 'Yes') : (lang === 'bs' ? 'Ne' : 'No')}</td>
                      <td>
                        {r.predlozak && <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>✔</span>}
                      </td>
                      <td>{r.jezik || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ═══ Built-in Templates (WebZNR-ovi ugrađeni primjeri) ═══ */}
        <h2 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          ❓ {lang === 'bs' ? 'WebZNR-ovi ugrađeni primjeri:' : 'Built-in Templates:'}
        </h2>

        <div className="card" style={{ marginBottom: 8 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
              <input placeholder={lang === 'bs' ? 'Pretraži predloške...' : 'Search templates...'} value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
              <button className="btn btn-ghost btn-sm">{lang === 'bs' ? 'Traži' : 'Search'}</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{lang === 'bs' ? 'Naziv' : 'Name'}</th>
                    <th>{lang === 'bs' ? 'Oznaka' : 'Code'}</th>
                    <th>{lang === 'bs' ? 'Za vrstu' : 'For type'}</th>
                    <th>{lang === 'bs' ? 'Prikaži na portalu' : 'Portal'}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTemplates.map((tpl, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{tpl.naziv}</td>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{tpl.oznaka || '—'}</span></td>
                      <td>{tpl.zaVrstu}</td>
                      <td>
                        {tpl.prikaziNaPortalu
                          ? <span style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>✔</span>
                          : ''}
                      </td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => handleInsertTemplate(tpl)}>
                          {lang === 'bs' ? 'Umetni' : 'Insert'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Email Dispatch Modal */}
        <EmailDispatchModal
          isOpen={dispatchModalOpen}
          onClose={() => { setDispatchModalOpen(false); setDispatchQuestionnaire(null); }}
          questionnaire={dispatchQuestionnaire}
          lang={lang}
        />
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     VIEW: RESULTS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (view === 'results' && resultsQuestionnaire) {
    return (
      <QuestionnaireResults
        questionnaire={resultsQuestionnaire}
        onBack={() => { setView('list'); setResultsQuestionnaire(null); }}
        lang={lang}
      />
    );
  }

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => { window.history.back(); }}>←</button>
        <h1 style={{ margin: 0 }}>
          ❓ {editingId
            ? (lang === 'bs' ? 'Uredi upitnik' : 'Edit questionnaire')
            : (lang === 'bs' ? 'Novi upitnik' : 'New questionnaire')}
        </h1>
      </div>
      <DialogRenderer />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ═══ Questionnaire Builder ═══ */}
        <div className="card">
          <div className="card-body" style={{ padding: 0, overflow: 'hidden' }}>
            <QuestionnaireBuilder
              json={formData.surveyJson}
              onJsonChange={(newJson) => set('surveyJson', newJson)}
              lang={lang}
            />
          </div>
        </div>

        {/* ═══ Detalji upitnika ═══ */}
        <div className="card">
          <div className="card-body">
            <div style={sectionTitle}>{lang === 'bs' ? 'Detalji upitnika' : 'Questionnaire Details'}</div>

            {/* Row 1: Naziv, Oznaka */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Naziv' : 'Name'}</div>
                <input className="form-input" value={formData.naziv} onChange={e => set('naziv', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Oznaka' : 'Code'}</div>
                <input className="form-input" value={formData.oznaka} onChange={e => set('oznaka', e.target.value)} />
              </div>
            </div>

            {/* Row 2: Za vrstu, Prikaži na portalu, Dodaj u prilog procjeni rizika */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Za vrstu' : 'For type'}</div>
                <select className="form-select" value={formData.zaVrstu} onChange={e => set('zaVrstu', e.target.value)}>
                  <option value="">{lang === 'bs' ? '— Odaberite —' : '— Select —'}</option>
                  {ZA_VRSTU_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={labelSt}>{lang === 'bs' ? 'Prikaži na portalu' : 'Show on portal'}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.prikaziNaPortalu} onChange={e => set('prikaziNaPortalu', e.target.checked)} />
                </label>
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Dodaj u prilog procjeni rizika' : 'Add to risk assessment'}</div>
                <select className="form-select" value={formData.dodajUPrilogProcjeniRizika} onChange={e => set('dodajUPrilogProcjeniRizika', e.target.value)}>
                  {DODAJ_PROCJENA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3: Email, checkboxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px 250px', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Email adresa za rezultate' : 'Email for results'}</div>
                <input className="form-input" type="email" value={formData.emailZaRezultate} onChange={e => set('emailZaRezultate', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={labelSt}>{lang === 'bs' ? 'Pošalji kopiju korisniku' : 'Send copy to user'}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.posaljiKopijuKorisniku} onChange={e => set('posaljiKopijuKorisniku', e.target.checked)} />
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={labelSt}>{lang === 'bs' ? 'Prikaži rezultate nakon rješavanja' : 'Show results after'}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.prikaziRezultateNakonRjesavanja} onChange={e => set('prikaziRezultateNakonRjesavanja', e.target.checked)} />
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={labelSt}>{lang === 'bs' ? 'Prikaži samo zadovoljava/nezadovoljava' : 'Show only pass/fail'}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.prikaziSamoZadovoljavaNezadovoljava} onChange={e => set('prikaziSamoZadovoljavaNezadovoljava', e.target.checked)} />
                </label>
              </div>
            </div>

            {/* Row 4: Automatski upis, Broj točnih */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 200px 1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={labelSt}>{lang === 'bs' ? 'Automatski upis u evidenciju' : 'Auto-record'}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.automatskiUpisUEvidenciju} onChange={e => set('automatskiUpisUEvidenciju', e.target.checked)} />
                </label>
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Prag prolaza (%)' : 'Pass threshold (%)'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="form-input" type="number" min={0} max={100}
                    value={formData.prolazniPrag ?? 70}
                    onChange={e => set('prolazniPrag', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    style={{ maxWidth: 100 }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>%</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                    ({lang === 'bs' ? 'npr. 70 znači 70% tačnih odgovora za prolaz' : 'e.g. 70 means 70% correct to pass'})
                  </span>
                </div>
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Izlazni tip dokumenta' : 'Output doc type'}</div>
                <select className="form-select" value={formData.izlazniTipDokumenta} onChange={e => set('izlazniTipDokumenta', e.target.value)}>
                  <option value="">—</option>
                  <option value="PDF">PDF</option>
                  <option value="Word">Word</option>
                  <option value="Excel">Excel</option>
                </select>
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Zadani ispis za dokument' : 'Default print for doc'}</div>
                <input className="form-input" value={formData.zadaniIspisZaDokument} onChange={e => set('zadaniIspisZaDokument', e.target.value)} />
              </div>
            </div>

            {/* Row 5: Email Subject, Email Body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Email Subject' : 'Email Subject'}</div>
                <input className="form-input" value={formData.emailSubject} onChange={e => set('emailSubject', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Email Body' : 'Email Body'}</div>
                <textarea className="form-input" rows={2} value={formData.emailBody} onChange={e => set('emailBody', e.target.value)} />
              </div>
            </div>

            {/* Row 6: Success / Failure messages */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Poruka za uspješno rješavanje' : 'Success message'}</div>
                <textarea className="form-input" rows={2} value={formData.porukaUspjesno} onChange={e => set('porukaUspjesno', e.target.value)} />
              </div>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Poruka za nedovoljan broj točnih odgovora' : 'Failure message'}</div>
                <textarea className="form-input" rows={2} value={formData.porukaNedovoljno} onChange={e => set('porukaNedovoljno', e.target.value)} />
              </div>
            </div>

            {/* Row 7: Jezik */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={labelSt}>{lang === 'bs' ? 'Jezik' : 'Language'}</div>
                <input className="form-input" value={formData.jezik} onChange={e => set('jezik', e.target.value)} placeholder={lang === 'bs' ? 'npr. hr, en' : 'e.g. hr, en'} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Action buttons ═══ */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              💾 {lang === 'bs' ? 'Snimi' : 'Save'}
            </button>
            <button className="btn btn-ghost" onClick={() => setView('list')}>
              ↩ {lang === 'bs' ? 'Odustani' : 'Cancel'}
            </button>
            {editingId && (
              <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={() => { handleDelete(editingId); setView('list'); }}>
                🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
