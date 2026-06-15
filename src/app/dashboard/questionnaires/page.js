'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAll, create, update, remove, COLLECTIONS, getUserCompanies,
} from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import QuestionnaireBuilder from '@/components/SurveyCreator';
import EmailDispatchModal from '@/components/EmailDispatchModal';
import QuestionnaireResults from '@/components/QuestionnaireResults';
import ReminderModal from '@/components/ReminderModal';
import HelpTip from '@/components/HelpTip';
import { getSessionsForQuestionnaire } from '@/lib/firebaseSync';
import { apiGenerateRiskQuestionnaire } from '@/lib/riskAI';
import { callFirebaseFunction } from '@/lib/firebaseCallable';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import PageHeader from '@/components/PageHeader';
/* ═══════════════════════════════════════════════
   Upitnici/Ankete — Questionnaire System
   Matching: https://app.zastitanaradu.hr/merkant/Upitnik
   ═══════════════════════════════════════════════ */

const ZA_VRSTU_OPTIONS = [
  'Anketa za radno mjesto',
  'Anketa za mentalno opterećenje',
  'Anketa za ručno prenošenje tereta',
  'Anketa za ergonomiju radnog mjesta',
  'Ostalo'
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

// Built-in templates from reference app (eZNR-ovi ugrađeni primjeri)
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

function QuestionnairesPageContent() {
  const { t, lang } = useLanguage();
  const { alert, confirm, DialogRenderer } = useDialog();
  const { user, activeCompanyId } = useAuth();
  const officerName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'eZNR Admin';
  const activeCompany = getUserCompanies(user?.id).find(c => c.id === activeCompanyId);
  const companyName = activeCompany?.naziv || '';
  const companyLogo = activeCompany?.logo || '';

  const [view, setView] = useState('list'); // list | form | results
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_UPITNIK });
  const [search, setSearch] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null); // for Akcije dropdown
  const [menuPos, setMenuPos] = useState({ top: 0, bottom: undefined, left: 0, maxH: 400 }); // fixed-position coords
  const menuButtonRef = useRef(null); // ref to the button that opened the menu
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchQuestionnaire, setDispatchQuestionnaire] = useState(null);
  const [resultsQuestionnaire, setResultsQuestionnaire] = useState(null);
  // Reminder
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderQuestionnaire, setReminderQuestionnaire] = useState(null);
  // Completion stats { [questId]: { total, completed } }
  const [completionStats, setCompletionStats] = useState({});
  // AI Questionnaire Generation
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiWorkplaces, setAiWorkplaces] = useState([]);
  const [selectedWpId, setSelectedWpId] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiVrstaAnkete, setAiVrstaAnkete] = useState('Anketa za radno mjesto');
  const [aiCustomVrsta, setAiCustomVrsta] = useState('');
  const [aiJezik, setAiJezik] = useState('Bosanski');
  const [translating, setTranslating] = useState(false);

  const filteredForList = search
    ? records.filter(r => (r.naziv || '').toLowerCase().includes(search.toLowerCase()))
    : records;
  const { sorted: sortedRecords, toggleSort, thStyle: tsRec_, sortIcon: siRec_, sortField, sortDir } = useSortedList(filteredForList, 'naziv');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleAll = (e) => { if (e.target.checked) setSelectedIds(new Set(sortedRecords.map(r => r.id))); else setSelectedIds(new Set()); };
  const toggleOne = (id) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };
  const tsRec = (field) => ({ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: sortField === field ? 'var(--primary)' : undefined, fontWeight: sortField === field ? 700 : undefined });
  const tRec = (field) => toggleSort(field);
  const siRec = (field) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  const loadData = useCallback(() => {
    const recs = getAll(COLLECTIONS.QUESTIONNAIRES);
    setRecords(recs);
    setAiWorkplaces(getAll(COLLECTIONS.WORKPLACES));
    // Load completion stats from Firestore (async, non-blocking)
    recs.forEach(q => {
      getSessionsForQuestionnaire(q.id)
        .then(sessions => {
          if (sessions && sessions.length> 0) {
            setCompletionStats(prev => ({
              ...prev,
              [q.id]: {
                total: sessions.length,
                completed: sessions.filter(s => s.status === 'completed').length,
              }
            }));
          }
        })
        .catch(() => { /* ignore */ });
    });
  }, []);

  useEffect(() => {
      loadData();
      window.addEventListener('eznr:data-synced', loadData);
      return () => window.removeEventListener('eznr:data-synced', loadData);
  }, [loadData]);

  // ── Zia agent: pick up dispatch intent set by open_dispatch_modal tool ──────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('zia_dispatch_intent');
      if (!raw) return;
      sessionStorage.removeItem('zia_dispatch_intent');
      const intent = JSON.parse(raw);
      if (!intent?.id) return;
      // Wait for records to load then open dispatch modal for that questionnaire
      const tryOpen = (attempts = 0) => {
        const allRecords = getAll(COLLECTIONS.QUESTIONNAIRES);
        const q = allRecords.find(r => r.id === intent.id);
        if (q) {
          setDispatchQuestionnaire(q);
          setDispatchModalOpen(true);
        } else if (attempts < 5) {
          setTimeout(() => tryOpen(attempts + 1), 200);
        }
      };
      setTimeout(() => tryOpen(), 100);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { markDirty, markClean, isDirty: contextIsDirty } = useUnsavedChanges(() => handleSave());

  const set = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markDirty();
  };

  // Navigate to form view (pushes history so browser back works)
  const goToForm = useCallback(() => {
    window.history.pushState({ upitnikView: 'form' }, '');
    setView('form');
  }, []);
  const handleCancel = useCallback(async () => {
    if (contextIsDirty) {
      const ok = await confirm(
        t('imateNesacuvanePromjeneZeliteLi1')
      );
      if (!ok) return;
    }
    const wasDirty = contextIsDirty;
    markClean();
    setView('list');
    window.history.go(wasDirty ? -2 : -1);
  }, [contextIsDirty, confirm, lang, markClean]);

  // Browser back button handler
  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state?.upitnikView !== 'form') {
        setView('list');
        setOpenMenuId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Close dropdown when clicking outside — ignore the trigger button itself
  useEffect(() => {
    if (!openMenuId) return;
    let id;
    const close = (e) => {
      if (e.target.closest && e.target.closest('[data-akcije-menu]')) return;
      if (e.target.closest && e.target.closest('[data-menu-trigger]')) return;
      setOpenMenuId(null);
    };
    id = requestAnimationFrame(() => { document.addEventListener('mousedown', close); });
    return () => { cancelAnimationFrame(id); document.removeEventListener('mousedown', close); };
  }, [openMenuId]);

  // Close menu if button scrolls off screen — do NOT reposition (causes bounce)
  useEffect(() => {
    if (!openMenuId || !menuButtonRef.current) return;
    const checkVisible = () => {
      if (!menuButtonRef.current) return;
      const rect = menuButtonRef.current.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top> window.innerHeight) setOpenMenuId(null);
    };
    window.addEventListener('scroll', checkVisible, true);
    return () => window.removeEventListener('scroll', checkVisible, true);
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
    if (await confirm(t('obrisatiUpitnik'))) { remove(COLLECTIONS.QUESTIONNAIRES, id); loadData(); }
  };
  const handleSave = () => {
    if (editingId) update(COLLECTIONS.QUESTIONNAIRES, editingId, formData);
    else create(COLLECTIONS.QUESTIONNAIRES, formData);
    const wasDirty = contextIsDirty;
    markClean();
    loadData();
    setView('list');
    window.history.go(wasDirty ? -2 : -1);
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

  // AI Generate Questionnaire for Workplace
  const handleAiGenerate = async () => {
    if (!selectedWpId) { await alert('Odaberite radno mjesto!'); return; }
    const wp = aiWorkplaces.find(w => w.id === selectedWpId);
    if (!wp) return;
    setAiGenerating(true);
    try {
      const allHazards = getAll(COLLECTIONS.HAZARDS);
      const allPpe = getAll(COLLECTIONS.PPE_TYPES || 'ppeTypes');
      const allEquip = getAll(COLLECTIONS.EQUIPMENT || 'equipment');
      // Load sistematizacija for this workplace (if available)
      const sist = getAll(COLLECTIONS.SISTEMATIZACIJE).find(s => s.radnoMjestoId === wp.id);
      const surveyJson = await apiGenerateRiskQuestionnaire({
          workplaceName: wp.naziv || '',
          workplaceDescription: wp.opis || wp.napomena || '',
          hazards: allHazards.map(h => h.naziv).filter(Boolean).slice(0, 20),
          existingPPE: allPpe.map(p => p.naziv).filter(Boolean).slice(0, 10),
          existingEquipment: allEquip.map(e => e.naziv).filter(Boolean).slice(0, 10),
          sistematizacija: sist ? {
            opisPoslova: sist.opisPoslova,
            strucnaSprema: sist.strucnaSprema,
            uvjetiRada: sist.uvjetiRada,
            potrebnaOZO: sist.potrebnaOZO,
            radnaOprema: sist.radnaOprema,
            zdravstveniZahtjevi: sist.zdravstveniZahtjevi,
            certifikati: sist.certifikati,
          } : null,
          vrstaAnkete: aiVrstaAnkete === 'Ostalo' ? aiCustomVrsta : aiVrstaAnkete,
          jezik: aiJezik,
      });

      if (surveyJson) {
        const newQ = create(COLLECTIONS.QUESTIONNAIRES, {
          ...EMPTY_UPITNIK,
          naziv: `${aiVrstaAnkete === 'Ostalo' ? aiCustomVrsta : aiVrstaAnkete} — ${wp.naziv}`,
          oznaka: 'AI-ANKETA',
          zaVrstu: aiVrstaAnkete === 'Ostalo' ? aiCustomVrsta : aiVrstaAnkete,
          dodajUPrilogProcjeniRizika: 'Dodaje se u procjenu rizika',
          surveyJson: surveyJson,
          radnoMjestoId: wp.id,
          jezik: aiJezik,
          aiGenerated: true,
        });
        setShowAiModal(false);
        setSelectedWpId('');
        loadData();
        handleEdit(newQ);
      }
    } catch (err) { await alert('Greška: ' + err.message); }
    setAiGenerating(false);
  };

  // Print / PDF questionnaire
  const handlePrintQuestionnaire = (q) => {
    setOpenMenuId(null);
    // Parse questions from either format
    let questions = [];
    try {
      const sj = typeof q.surveyJson === 'string' ? JSON.parse(q.surveyJson) : q.surveyJson;
      if (sj?.questions) {
        questions = sj.questions;
      } else if (sj?.pages) {
        sj.pages.forEach(p => {
          if (p.title) questions.push({ type: 'heading', title: p.title });
          (p.elements || []).forEach(el => questions.push({ ...el, type: el.type === 'radiogroup' ? 'radio' : (el.type === 'comment' ? 'textarea' : el.type) }));
        });
      }
    } catch { /* ignore */ }
    const logoHtml = companyLogo ? `<img src="${companyLogo}" style="height:60px;max-width:200px;object-fit:contain;margin-bottom:6px" />` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${q.naziv || 'Anketa'}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px 48px;color:#000;max-width:800px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}h3{font-size:15px;color:#333;border-bottom:2px solid #6366f1;padding-bottom:6px;margin:28px 0 14px}hr{border:none;border-top:2px solid #000;margin:16px 0 24px}.q{margin-bottom:18px;page-break-inside:avoid;padding:12px 16px;border:1px solid #e0e0e0;border-radius:8px}.qt{font-size:13px;font-weight:700;margin-bottom:6px}.opt{font-size:12px;padding:3px 0 3px 20px}.meta{font-size:11px;color:#666;margin-bottom:4px}.qimg{max-width:100%;max-height:200px;border-radius:6px;margin:8px 0;border:1px solid #ddd}@media print{button{display:none!important}.q{border:1px solid #ccc}}</style>
    </head><body>
      ${logoHtml}
      ${companyName ? `<div class="meta">${companyName}</div>` : ''}
      <h1>${q.naziv || 'Anketa'}</h1>
      <div class="meta">${officerName} &mdash; ${new Date().toLocaleDateString('hr-HR')}</div>
      ${q.koristiPragProlaza !== false ? `<div class="meta">Prag prolaza: ${q.prolazniPrag ?? 70}%</div>` : '<div class="meta">Tip: Anketa (bez ocjenjivanja)</div>'}
      <hr />
      ${questions.map((el, i) => {
        if (el.type === 'heading') return `<h3>${el.title || ''}</h3>`;
        const opts = el.choices || el.rateValues || [];
        const imgHtml = el.imageUrl ? `<img class="qimg" src="${el.imageUrl}" />` : '';
        return `<div class="q">
          <div class="qt">${i + 1}. ${el.title || el.name || ''}</div>
          ${el.description ? `<div style="font-size:11px;color:#666;margin-bottom:6px">${el.description}</div>` : ''}
          ${imgHtml}
          ${opts.map((o, j) => `<div class="opt">${String.fromCharCode(65+j)}) ${typeof o === 'string' ? o : (o.text || o.value || '')}</div>`).join('')}
          ${el.type === 'text' || el.type === 'textarea' ? '<div style="border-bottom:1px solid #ccc;margin-top:10px;min-height:24px"></div>' : ''}
          ${el.type === 'rating' ? '<div style="margin-top:6px">⭐ ⭐ ⭐ ⭐ ⭐</div>' : ''}
          ${el.type === 'boolean' || el.type === 'yesno' ? '<div class="opt">A) Da &nbsp; B) Ne</div>' : ''}
        </div>`;
      }).join('')}
      <div style="display:flex;gap:12px;margin-top:24px">
        <button onclick="window.print()" style="padding:10px 24px;font-size:14px;cursor:pointer;border:none;background:#6366f1;color:#fff;border-radius:8px;font-weight:700">🖨️ Isprintaj / Spremi PDF</button>
      </div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleTranslate = async () => {
    if (!formData.surveyJson) {
        await alert('Upitnik nema dodanih pitanja za prijevod.');
        return;
    }
    if (!formData.jezik) {
        await alert('Prvo odaberite "Jezik upitnika" na koji želite prevesti.');
        return;
    }
    const targetLang = formData.jezik;
    if (await confirm(`Da li ste sigurni da želite prevesti sva pitanja i odgovore na '${targetLang}' pomoću AI?\n\nOva akcija može prepisati vaše trenutne tekstove u pitanjima.`)) {
        setTranslating(true);
        try {
            const sj = typeof formData.surveyJson === 'string' ? JSON.parse(formData.surveyJson) : formData.surveyJson;
            const res = await callFirebaseFunction('translateQuestionnaire', {
                surveyJson: sj,
                targetLanguage: targetLang
            });
            if (res.success && res.surveyJson) {
                set('surveyJson', JSON.stringify(res.surveyJson));
                await alert(`Uspješno prevedeno na ${targetLang}!`);
            }
        } catch (err) {
            await alert('Greška pri prijevodu: ' + err.message);
        }
        setTranslating(false);
    }
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
    const filteredTemplates = templateSearch
      ? BUILTIN_TEMPLATES.filter(t => (t.naziv || '').toLowerCase().includes(templateSearch.toLowerCase()) || (t.oznaka || '').toLowerCase().includes(templateSearch.toLowerCase()))
      : BUILTIN_TEMPLATES;

    const filtered = filteredForList;

    return (
      <div className="animate-fadeIn">
        <PageHeader icon="❓" title={t('questionnaires')} />
        <DialogRenderer />

        {/* ═══ User Questionnaires ═══ */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body scrollable-toolbar" style={{ padding: 0, gap: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={handleNew}>
              + {t('novi')}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setShowAiModal(true)}
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
              🤖 {t('generisiZaRadnoMjesto')}
            </button>
            <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
              <input placeholder={t('pretrazi1')} value={search} onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
              <button className="btn btn-ghost btn-sm">{t('trazi')}</button>
            </div>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filtered.length} {t('zapisa')}
            </span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 32 }}>
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}><input type="checkbox" checked={selectedIds.size === sortedRecords.length && sortedRecords.length> 0} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} /></th>
                    <th style={{ width: 100 }}>{t('actions')}</th>
                    <th style={{ ...tsRec('naziv'), minWidth: 240 }} onClick={() => tRec('naziv')}>{t('naziv')}{siRec('naziv')}</th>
                    <th style={tsRec('zaVrstu')} onClick={() => tRec('zaVrstu')}>{t('vrstaAnkete')}{siRec('zaVrstu')}</th>
                    <th>{t('ispunjenost')}</th>
                    <th style={tsRec('rokIsteka')} onClick={() => tRec('rokIsteka')}>{t('rokIsteka')}{siRec('rokIsteka')}</th>
                    <th style={tsRec('prikaziNaPortalu')} onClick={() => tRec('prikaziNaPortalu')}>{t('prikaziNaPortalu')}{siRec('prikaziNaPortalu')}</th>
                    <th style={tsRec('predlozak')} onClick={() => tRec('predlozak')}>{t('predlozak')}{siRec('predlozak')}</th>
                    <th style={tsRec('jezik')} onClick={() => tRec('jezik')}>{t('jezik')}{siRec('jezik')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                  ) : sortedRecords.map(r => (
                    <tr key={r.id} onClick={() => handleEdit(r)} style={{ cursor: 'pointer', transition: 'background 0.12s' }}>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ position: 'relative' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            data-menu-trigger
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openMenuId === r.id) { setOpenMenuId(null); menuButtonRef.current = null; return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              menuButtonRef.current = e.currentTarget;
                              const spaceBelow = window.innerHeight - rect.bottom - 8;
                              const spaceAbove = rect.top - 8;
                              const flipUp = spaceBelow < 200 && spaceAbove> spaceBelow;
                              setMenuPos(flipUp
                                ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                                : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                              );
                              setOpenMenuId(r.id);
                            }}>
                            {t('akcije')} ▼
                          </button>
                          {openMenuId === r.id && (
                            <div data-akcije-menu style={{
                              position: 'fixed',
                              top: menuPos.top,
                              bottom: menuPos.bottom,
                              left: menuPos.left,
                              zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none',
                              background: 'var(--bg-card)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                              minWidth: 210, maxHeight: menuPos.maxH, overflowY: 'auto',
                            }}>
                              <button onClick={() => handleEdit(r)} style={menuItemStyle}>
                                📝 {t('otvori')}
                              </button>
                              <button onClick={() => handleDuplicate(r)} style={menuItemStyle}>
                                📋 {t('dupliciraj')}
                              </button>
                              <button onClick={() => handleTogglePortal(r)} style={menuItemStyle}>
                                {r.prikaziNaPortalu ? '🔒' : '🌐'} {lang !== 'en'
                                  ? (r.prikaziNaPortalu ? 'Sakrij s portala' : 'Prikaži na portalu')
                                  : (r.prikaziNaPortalu ? 'Hide from portal' : 'Show on portal')}
                              </button>
                              <button onClick={() => handlePrintQuestionnaire(r)} style={menuItemStyle}>
                                🖨️ {t('isprintaj')}
                              </button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => { setOpenMenuId(null); setDispatchQuestionnaire(r); setDispatchModalOpen(true); }} style={menuItemStyle}>
                                📧 {t('posalji')}
                              </button>
                              <button onClick={() => { setOpenMenuId(null); setReminderQuestionnaire(r); setReminderModalOpen(true); }} style={menuItemStyle}>
                                📩 {t('posaljiPodsjetnik')}
                              </button>
                              <button onClick={() => { setOpenMenuId(null); setResultsQuestionnaire(r); setView('results'); }} style={menuItemStyle}>
                                📊 {t('rezultati')}
                              </button>
                              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                              <button onClick={() => handleDelete(r.id)} style={{ ...menuItemStyle, color: 'var(--danger)' }}>
                                🗑️ {t('obrisi')}
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
                          onMouseLeave={e => e.target.style.textDecoration = 'none'}>
                          {r.naziv || '—'}
                        </span>
                      </td>
                      <td>{r.zaVrstu || '—'}</td>
                      <td>
                        {completionStats[r.id] ? (() => {
                          const cs = completionStats[r.id];
                          const pct = cs.total> 0 ? Math.round((cs.completed / cs.total) * 100) : 0;
                          return (
                            <div 
                                onClick={(e) => { e.stopPropagation(); setResultsQuestionnaire(r); setView('results'); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, transition: 'background 0.2s', margin: '-4px -8px' }}
                                
                                
                                title={t('klikniZaPregledRezultata')}>
                              <div style={{ flex: 1, maxWidth: 80, height: 6, borderRadius: 3, background: 'rgba(99,102,241,0.12)', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct === 100 ? '#22c55e' : '#6366f1', transition: 'width 0.4s' }} />
                              </div>
                              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: pct === 100 ? '#22c55e' : 'var(--text-muted)' }}>
                                {cs.completed}/{cs.total}
                              </span>
                            </div>
                          );
                        })() : <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {r.rokIsteka ? (() => {
                          const days = Math.ceil((new Date(r.rokIsteka) - new Date()) / (1000*60*60*24));
                          const col = days < 0 ? 'var(--danger)' : days <= 30 ? 'var(--danger)' : days <= 90 ? 'var(--warning)' : 'var(--success)';
                          const label = days < 0
                            ? (t('expiredDAgo').replace('{0}', Math.abs(days)))
                            : (t('inD').replace('{0}', days));
                          return <span style={{ fontSize: '0.78rem', fontWeight: 600, color: col }}>{label}</span>;
                        })() : <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>{r.prikaziNaPortalu ? (t('da')) : (t('ne'))}</td>
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

        {/* ═══ Built-in Templates (eZNR-ovi ugrađeni primjeri) ═══ */}
        <h2 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          ❓ {t('eznroviUgraeniPrimjeri')}
        </h2>

        <div className="card" style={{ marginBottom: 8 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
              <input placeholder={t('pretraziPredloske')} value={templateSearch} onChange={e => setTemplateSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
              <button className="btn btn-ghost btn-sm">{t('trazi')}</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 240 }}>{t('naziv')}</th>
                    <th>{t('oznaka')}</th>
                    <th>{t('vrstaAnkete')}</th>
                    <th>{t('prikaziNaPortalu')}</th>
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
                          {t('umetni')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI Generate Modal */}
        {showAiModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowAiModal(false); }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, minWidth: 400, maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🤖 {t('aiGeneratorUpitnikaZaProcjenu')}</span>
                <button className="btn btn-ghost btn-icon" onClick={() => setShowAiModal(false)} style={{ marginLeft: 'auto' }}>✕</button>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                AI će generisati upitnik specifičan za odabrano radno mjesto, pokrivajući opasnosti, zaštitnu opremu, osposobljavanje, radnu opremu i zdravstvene preglede.
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{t('odaberiteRadnoMjesto')}</div>
                <select className="form-select" value={selectedWpId} onChange={e => setSelectedWpId(e.target.value)} style={{ width: '100%' }}>
                  <option value="">— {t('odaberiteRadnoMjesto')} —</option>
                  {aiWorkplaces.map(wp => <option key={wp.id} value={wp.id}>{wp.naziv}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{t('vrstaAnkete')}</div>
                <select className="form-select" value={aiVrstaAnkete} onChange={e => setAiVrstaAnkete(e.target.value)} style={{ width: '100%' }}>
                  {ZA_VRSTU_OPTIONS.filter(o => !['Djelatnik', 'DokumentTip', 'Posao', 'Tenant'].includes(o)).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {aiVrstaAnkete === 'Ostalo' && (
                  <input className="form-input" style={{ width: '100%', marginTop: 8 }} placeholder={t('upisiteVrstuAnkete')} value={aiCustomVrsta} onChange={e => setAiCustomVrsta(e.target.value)} />
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{t('jezikAnkete')}</div>
                <select className="form-select" value={aiJezik} onChange={e => setAiJezik(e.target.value)} style={{ width: '100%' }}>
                  <option value="Bosanski">Bosanski</option>
                  <option value="Hrvatski">Hrvatski</option>
                  <option value="Srpski">Srpski</option>
                  <option value="Engleski">English</option>
                  <option value="Njemački">Deutsch</option>
                  <option value="Slovenački">Slovenščina</option>
                  <option value="Francuski">Français</option>
                  <option value="Španski">Español</option>
                  <option value="Turski">Türkçe</option>
                  <option value="Poljski">Polski</option>
                  <option value="Italijanski">Italiano</option>
                  <option value="Portugalski">Português</option>
                </select>
              </div>
              {aiWorkplaces.length === 0 && (
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(255,193,7,0.1)', border: '1px solid #ffc107', fontSize: '0.82rem', color: '#ffc107', marginBottom: 16 }}>
                  ⚠ Nemate definisana radna mjesta. Prvo ih dodajte u modulu "Radna mjesta".
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={handleAiGenerate} disabled={aiGenerating || !selectedWpId}
                  style={{ background: aiGenerating ? 'var(--bg-input)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                  {aiGenerating ? '⏳ Generisanje...' : '🤖 Generiši upitnik'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowAiModal(false)} disabled={aiGenerating}>
                  Odustani
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Dispatch Modal */}
        <EmailDispatchModal
          isOpen={dispatchModalOpen}
          onClose={() => { setDispatchModalOpen(false); setDispatchQuestionnaire(null); }}
          questionnaire={dispatchQuestionnaire}
          lang={lang}
          officerName={officerName}
          companyName={companyName}
          companyLogo={companyLogo}
        />

        {/* Reminder Modal */}
        <ReminderModal
          isOpen={reminderModalOpen}
          onClose={() => { setReminderModalOpen(false); setReminderQuestionnaire(null); }}
          questionnaire={reminderQuestionnaire}
          lang={lang}
          officerName={officerName}
          companyName={companyName}
        />
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     VIEW: RESULTS
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (view === 'results' && resultsQuestionnaire) {
    return (
      <>
        <QuestionnaireResults
          questionnaire={resultsQuestionnaire}
          onBack={() => { setView('list'); setResultsQuestionnaire(null); }}
          lang={lang}
          onReminderClick={() => { setReminderQuestionnaire(resultsQuestionnaire); setReminderModalOpen(true); }}
        />
        {/* Reminder Modal */}
        <ReminderModal
          isOpen={reminderModalOpen}
          onClose={() => { setReminderModalOpen(false); setReminderQuestionnaire(null); }}
          questionnaire={reminderQuestionnaire}
          lang={lang}
          officerName={officerName}
          companyName={companyName}
        />
      </>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={handleCancel}>←</button>
        <h1 style={{ margin: 0 }}>
          ❓ {editingId
            ? (t('urediUpitnik'))
            : (t('noviUpitnik'))}
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
            <div style={sectionTitle}>{t('detaljiUpitnika')}</div>

            {/* Row 1: Naziv, Oznaka */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('naziv')} <HelpTip text="Puno ime upitnika/ankete koje će se prikazivati u listi i na emailu koji se šalje radnicima." />
                </div>
                <input className="form-input" value={formData.naziv} onChange={e => set('naziv', e.target.value)} />
              </div>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('oznaka')} <HelpTip text="Kratka interna šifra upitnika (npr. ZOS-TEST, AI-ANKETA). Koristi se za brzo pretraživanje i identifikaciju u listama." />
                </div>
                <input className="form-input" value={formData.oznaka} onChange={e => set('oznaka', e.target.value)} />
              </div>
            </div>

            {/* Row 2: Za vrstu, Prikaži na portalu, Dodaj u prilog procjeni rizika */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('vrstaAnkete')}
                  <HelpTip text="Kategorizira upitnik po namjeni. Odaberite odgovarajuću vrstu ili 'Ostalo' za vlastitu kategoriju. Koristi se za filtriranje i AI generisanje." />
                </div>
                {/* Vrsta ankete: dropdown + optional free-text when Ostalo is picked */}
                {(() => {
                  const knownOpts = ZA_VRSTU_OPTIONS.filter(o => o !== 'Ostalo');
                  // dropdownVal: show known option, or 'Ostalo' for any custom/non-empty value, or '' for blank
                  const dropdownVal = knownOpts.includes(formData.zaVrstu)
                    ? formData.zaVrstu
                    : (formData.zaVrstu ? 'Ostalo' : '');
                  return (
                    <>
                      <select className="form-select" value={dropdownVal} onChange={e => {
                        // Set zaVrstu directly to the selected value.
                        // When 'Ostalo' is picked, zaVrstu = 'Ostalo' (not '') so dropdownVal stays 'Ostalo'
                        set('zaVrstu', e.target.value);
                      }}>
                        <option value="">{t('u2014OdaberiteU2014')}</option>
                        {ZA_VRSTU_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {dropdownVal === 'Ostalo' && (
                        <input
                          className="form-input"
                          style={{ marginTop: 8 }}
                          placeholder={t('unesiteNazivVrsteAnketeOpcionalno')}
                          value={formData.zaVrstu === 'Ostalo' ? '' : formData.zaVrstu}
                          onChange={e => set('zaVrstu', e.target.value.trim() || 'Ostalo')}
                        />
                      )}
                    </>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('prikaziNaPortalu')}
                  <HelpTip text="Kada je uključeno, upitnik je dostupan radnicima direktno na javnom portalu (bez slanja emaila). Radnici mogu popuniti sami." />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.prikaziNaPortalu} onChange={e => set('prikaziNaPortalu', e.target.checked)} />
                </label>
              </div>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('dodajUPrilogProcjeniRizika')}
                  <HelpTip text="Rezultati ovog upitnika automatski se dodaju kao prilog u procjenu rizika za odgovarajuće radno mjesto." />
                </div>
                <select className="form-select" value={formData.dodajUPrilogProcjeniRizika} onChange={e => set('dodajUPrilogProcjeniRizika', e.target.value)}>
                  {DODAJ_PROCJENA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3: Email, checkboxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px 250px', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('emailAdresaZaRezultate')}
                  <HelpTip text="Na ovu email adresu šalje se obavijest sa rezultatima svaki put kad radnik završi upitnik. Ostavite prazno ako ne trebate obavijesti." />
                </div>
                <input className="form-input" type="email" value={formData.emailZaRezultate} onChange={e => set('emailZaRezultate', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('posaljiKopijuKorisniku')}
                  <HelpTip text="Radnik koji popuni upitnik dobiva kopiju svojih odgovora i rezultata na email koji je unio pri ispunjavanju." />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.posaljiKopijuKorisniku} onChange={e => set('posaljiKopijuKorisniku', e.target.checked)} />
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('prikaziRezultateNakonRjesavanja')}
                  <HelpTip text="Nakon što radnik pošalje upitnik, odmah mu se prikazuje rezultat (koliko je % odgovora tačno i prolaz/ne prolaz)." />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.prikaziRezultateNakonRjesavanja} onChange={e => set('prikaziRezultateNakonRjesavanja', e.target.checked)} />
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('prikaziSamoZadovoljavanezadovoljava')}
                  <HelpTip text="Radnik vidi samo 'Zadovoljava' ili 'Ne zadovoljava' — bez postotka i bez detalja. Korisno za jednostavne provjere znanja." />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.prikaziSamoZadovoljavaNezadovoljava} onChange={e => set('prikaziSamoZadovoljavaNezadovoljava', e.target.checked)} />
                </label>
              </div>
            </div>

            {/* Row 4: Automatski upis, Prag prolaza toggle + value */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 200px 1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('automatskiUpisUEvidenciju')}
                  <HelpTip text="Kada radnik uspješno završi upitnik (tj. prođe prag prolaza), automatski se kreira zapis u evidenciji osposobljavanja za tog radnika." />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.automatskiUpisUEvidenciju} onChange={e => set('automatskiUpisUEvidenciju', e.target.checked)} />
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('koristiPragProlaza')}
                  <HelpTip text="'Da (test)' — upitnik se tretira kao TEST s prolaznim pragom (ocjenjuje se). 'Ne (anketa)' — upitnik je anketa bez ocjenjivanja, svaki odgovor je ispravan." />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" className="form-checkbox" checked={formData.koristiPragProlaza !== false} onChange={e => set('koristiPragProlaza', e.target.checked)} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formData.koristiPragProlaza !== false ? (t('daTest')) : (t('neAnketa'))}</span>
                </label>
              </div>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('pragProlaza')}
                  <HelpTip text="Minimalni postotak tačnih odgovora potreban za prolaz. Npr. 70 znači da radnik mora tačno odgovoriti na barem 70% pitanja. Aktivno samo kada je 'Koristi prag prolaza' uključeno." />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: formData.koristiPragProlaza !== false ? 1 : 0.35, pointerEvents: formData.koristiPragProlaza !== false ? 'auto' : 'none' }}>
                  <input className="form-input" type="number" min={0} max={100}
                    value={formData.prolazniPrag ?? 70}
                    onChange={e => set('prolazniPrag', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    style={{ maxWidth: 100 }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>%</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                    ({t('npr70Znaci70Tacnih')})
                  </span>
                </div>
              </div>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('izlazniTipDokumenta')}
                  <HelpTip text="Tip dokumenta koji se generiše kao rezultat popunjenog upitnika. Trenutno je polje informativno — document generacija je u pripremi." />
                </div>
                <select className="form-select" value={formData.izlazniTipDokumenta} onChange={e => set('izlazniTipDokumenta', e.target.value)}>
                  <option value="">—</option>
                  <option value="PDF">PDF</option>
                  <option value="Word">Word</option>
                  <option value="Excel">Excel</option>
                </select>
              </div>
              <div>
                <div style={labelSt}>{t('zadaniIspisZaDokument')}</div>
                <input className="form-input" value={formData.zadaniIspisZaDokument} onChange={e => set('zadaniIspisZaDokument', e.target.value)} />
              </div>
            </div>

            {/* Row 5: Email Subject, Email Body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('naslovEmaila')}
                  <HelpTip text="Naslov (subject) emaila koji se šalje radnicima kada im proslijedite upitnik. Ako ostavite prazno, koristi se automatski generisani naslov." />
                </div>
                <input className="form-input" value={formData.emailSubject} onChange={e => set('emailSubject', e.target.value)} />
              </div>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('sadrzajEmaila')}
                  <HelpTip text="Tekst poruke u emailu koji radnik prima sa linkom za popunjavanje upitnika. Ako ostavite prazno, koristi se standardna poruka." />
                </div>
                <textarea className="form-input" rows={2} value={formData.emailBody} onChange={e => set('emailBody', e.target.value)} />
              </div>
            </div>

            {/* Row 5.5: Rok isteka */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('rokIstekaOpcionalno')}
                  <HelpTip text="Datum do kojeg je moguće popuniti ovaj upitnik. Nakon tog datuma, link za popunjavanje prestaje biti aktivan. Ostavite prazno ako nema roka." />
                </div>
                <DateInput value={formData.rokIsteka || ''} onChange={v => set('rokIsteka', v)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {t('poslanimUpitnicimaIsticeRokNa')}
                </span>
              </div>
            </div>

            {/* Row 6: Success / Failure messages */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('porukaZaUspjesnoRjesavanje')}
                  <HelpTip text="Tekst koji se prikazuje radniku na ekranu kada uspješno prođe upitnik (dostigao prag prolaza). Npr. 'Čestitamo, položili ste test!'" />
                </div>
                <textarea className="form-input" rows={2} value={formData.porukaUspjesno} onChange={e => set('porukaUspjesno', e.target.value)} />
              </div>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('porukaZaNedovoljanBrojTocnih')}
                  <HelpTip text="Tekst koji se prikazuje radniku kada nije dostigao prag prolaza. Npr. 'Niste položili, molimo ponovite obuku i pokušajte ponovo.'" />
                </div>
                <textarea className="form-input" rows={2} value={formData.porukaNedovoljno} onChange={e => set('porukaNedovoljno', e.target.value)} />
              </div>
            </div>

            {/* Row 7: Jezik */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ ...labelSt, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {t('jezikUpitnika')}
                  <HelpTip text="Jezik na kojem je napisan upitnik. Koristi se pri AI generisanju i slanju emailova radnicima." />
                </div>
                <select className="form-select" value={formData.jezik || ''} onChange={e => set('jezik', e.target.value)}>
                  <option value="">{t('odaberite')}</option>
                  <option value="Bosanski">Bosanski</option>
                  <option value="Hrvatski">Hrvatski</option>
                  <option value="Srpski">Srpski</option>
                  <option value="Engleski">English</option>
                  <option value="Njemački">Deutsch</option>
                  <option value="Slovenački">Slovenščina</option>
                  <option value="Francuski">Français</option>
                  <option value="Španski">Español</option>
                  <option value="Turski">Türkçe</option>
                  <option value="Poljski">Polski</option>
                  <option value="Italijanski">Italiano</option>
                  <option value="Portugalski">Português</option>
                  <option value="Makedonski">Makedonski</option>
                </select>
                {formData.surveyJson && formData.jezik && (
                  <button 
                    className="btn btn-outline btn-sm" 
                    style={{ marginTop: 8, width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                    onClick={handleTranslate}
                    disabled={translating}>
                    {translating ? '⏳ Prevodim...' : '🤖 Prevedi pitanja (AI)'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Action buttons ═══ */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave}>
              💾 {t('save')}
            </button>
            <button className="btn btn-ghost" onClick={() => setView('list')}>
              ↩ {t('cancel')}
            </button>
            {editingId && (
              <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginLeft: 'auto' }} onClick={() => { handleDelete(editingId); setView('list'); }}>
                🗑️ {t('obrisi')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

import SubscriptionGate from '@/components/SubscriptionGate';

export default function QuestionnairesPage() {
  return (
    <SubscriptionGate moduleKey="questionnaires">
      <QuestionnairesPageContent />
    </SubscriptionGate>
  );
}
