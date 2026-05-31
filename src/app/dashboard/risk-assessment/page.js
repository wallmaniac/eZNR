'use client';
import DateInput from '@/components/DateInput';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, getById, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { getSessionsForQuestionnaire } from '@/lib/firebaseSync';
import HelpTip from '@/components/HelpTip';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useDialog } from '@/hooks/useDialog';
import { generateSafeWordDoc } from '@/lib/riskExportDocx';
import { riskLevel, fetchAiOpisProcesa, fetchAiMeasures, fetchAiDocAnalyze, fetchAiAutoConclusion, apiAnalyzeQuestionnaire, apiGenerateRiskTable } from '@/lib/riskAI';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useAuth } from '@/contexts/AuthContext';
import { useCountry } from '@/contexts/CountryContext';
import { apiGenerateSistematizacija } from '@/lib/sistematizacijaAI';
import { getDefaultPravniOsnov, getRiskAssessmentLabel } from '@/lib/lawConfig';

import PageHeader from '@/components/PageHeader';
/* ═══════════════════════════════════════════════
   5×5 Risk Matrix — Procjena rizika (multi-jurisdictional)
   ═══════════════════════════════════════════════ */

const EMPTY_PROCJENA = {
    nazivProcjene: '', nazivTvrtke: '', radnoMjestoId: '', sjediste: '', djelatnost: '', ukupnoZaposlenih: '',
    ovlOrganizacija: '', ovlOsobaIme: '', ovlOsobaKvalifikacije: '',
    revizija: '', datumIzrade: todayISO(),
    opisProcesa: '', analizaOrganizacije: '',
    zakljucak: '', status: 'draft',
};

const EMPTY_RISK_ITEM = {
    procjenaId: '', radnoMjestoId: '', opasnostId: '',
    opisOpasnosti: '', vjerovatnoca: 0, posljedica: 0,
    rizik: 0, nivoRizika: '',
    postojeceMjere: '', predlozeneMjere: '',
    odgovornaOsoba: '', rokProvedbe: '',
    // Residual risk (after measures)
    vjerovatnocaNakon: 0, posljedlicaNakon: 0,
    rizikNakon: 0, nivoRizikaNakon: '',
};

const V_LABELS = [
    '', 'Zanemarivo — Ekstremno rijedak', 'Malo — Rijedak događaj',
    'Moguće — Moguć događaj', 'Vjerovatno — Čest događaj', 'Gotovo sigurno',
];
const P_LABELS = [
    '', 'Zanemarivo — Bez opasnosti', 'Malo — Privremena nesposobnost',
    'Srednje — Značajno oštećenje', 'Ozbiljno — Trajna nesposobnost', 'Kritično — Smrt',
];

// riskLevel is now imported from @/lib/riskAI

function cellColor(score) {
    if (score <= 5) return '#4caf50';
    if (score <= 10) return '#ffc107';
    if (score <= 15) return '#ff9800';
    if (score <= 20) return '#f44336';
    return '#b71c1c';
}

/* ── 5×5 Matrix Component ── */
function RiskMatrix({ onCellClick, items = [], selectedV = 0, selectedP = 0 }) {
    const itemCounts = {};
    items.forEach(it => { const k = `${it.vjerovatnoca}-${it.posljedica}`; itemCounts[k] = (itemCounts[k] || 0) + 1; });
    return (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8, letterSpacing: '0.05em' }}>
                    Matrica rizika 5×5 (Vjerovatnoća × Posljedica)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '110px repeat(5, 64px)', gap: 2 }}>
                    <div />
                    {[1, 2, 3, 4, 5].map(p => (
                        <div key={p} style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, padding: 4 }}>
                            P={p}
                        </div>
                    ))}
                    {[5, 4, 3, 2, 1].map(v => (
                        <>
                            <div key={`l${v}`} style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', paddingRight: 6, fontWeight: 600 }}>
                                V={v}
                            </div>
                            {[1, 2, 3, 4, 5].map(p => {
                                const score = v * p;
                                const count = itemCounts[`${v}-${p}`] || 0;
                                const sel = selectedV === v && selectedP === p;
                                return (
                                    <div key={`${v}-${p}`} onClick={() => onCellClick?.(v, p)}
                                        style={{
                                            width: 64, height: 48, display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', justifyContent: 'center', borderRadius: 6,
                                            background: cellColor(score), color: score <= 10 ? '#000' : '#fff',
                                            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                                            border: sel ? '3px solid #fff' : '1px solid rgba(0,0,0,0.15)',
                                            boxShadow: sel ? '0 0 0 2px var(--primary)' : 'none',
                                            transition: 'transform 0.1s', position: 'relative',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                        {score}
                                        {count> 0 && (
                                            <span style={{ position: 'absolute', top: -6, right: -6, background: '#fff', color: '#333', borderRadius: '50%', width: 18, height: 18, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, border: '1px solid rgba(0,0,0,0.2)' }}>
                                                {count}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    ))}
                </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Legenda</div>
                {[
                    { min: 1, max: 5, label: 'Neznatan (Prihvatljiv)', desc: 'Nema potrebe za akcijom' },
                    { min: 6, max: 10, label: 'Dopustiv', desc: 'Praćenje, ekonomski isplativije mjere' },
                    { min: 11, max: 15, label: 'Umjeren', desc: 'Planirane mjere, definisani rokovi' },
                    { min: 16, max: 20, label: 'Znatan', desc: 'Brza reakcija, značajna ulaganja' },
                    { min: 21, max: 25, label: 'Nedopustiv', desc: 'Obustava aktivnosti, hitne mjere' },
                ].map(r => (
                    <div key={r.min} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: '0.78rem' }}>
                        <div style={{ width: 28, height: 18, borderRadius: 4, background: cellColor(r.min), flexShrink: 0 }} />
                        <div><strong>{r.min}–{r.max}</strong> {r.label} — <span style={{ color: 'var(--text-muted)' }}>{r.desc}</span></div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */

export default function RiskAssessmentPage() {
    const { t, lang } = useLanguage();
    const { alert, confirm, DialogRenderer } = useDialog();
    const { showFlash, SavedFlash } = useSavedFlash();
    const { markDirty, markClean, isDirty: contextIsDirty } = useUnsavedChanges(async () => await handleSave());
    const isDirtyRef = useRef(false);
    const { activeCompanyId } = useAuth();
    const country = useCountry();
    const activeCompany = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};
    // Sistematizacija tab state
    const [sistEditData, setSistEditData] = useState(null);
    const [sistAiLoading, setSistAiLoading] = useState(false);
    const [sistSelectedWp, setSistSelectedWp] = useState(null);

    const [view, setView] = useState('list');
    const [records, setRecords] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_PROCJENA });
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('opsti');
    const [sortConfig, setSortConfig] = useState({ key: 'datumIzrade', dir: 'desc' });
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const menuButtonRef = useRef(null);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [selectedRiIds, setSelectedRiIds] = useState(new Set());

    // Click outside listener for dropdown
    useEffect(() => {
        const close = (e) => {
            if (openMenuId && !e.target.closest('[data-menu]') && !e.target.closest('[data-menu-trigger]')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [openMenuId]);

    // Sub-views
    const [personTypes, setPersonTypes] = useState([]);
    const [ptEdit, setPtEdit] = useState(null);
    const [ptNaziv, setPtNaziv] = useState('');
    const [ptVrsta, setPtVrsta] = useState('');
    const [searchPt, setSearchPt] = useState('');
    const [hazards, setHazards] = useState([]);
    const [searchHaz, setSearchHaz] = useState('');
    const [hazEdit, setHazEdit] = useState(null);
    const [hazNaziv, setHazNaziv] = useState('');
    const [hazOznaka, setHazOznaka] = useState('');

    // Risk items
    const [riskItems, setRiskItems] = useState([]);
    const [riForm, setRiForm] = useState({ ...EMPTY_RISK_ITEM });
    const [riEditId, setRiEditId] = useState(null);
    const [lastEditedRiId, setLastEditedRiId] = useState(null);
    const [showRiForm, setShowRiForm] = useState(false);
    const [workplaces, setWorkplaces] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiOpisLoading, setAiOpisLoading] = useState(false);
    const [aiDocument, setAiDocument] = useState(null);
    // AI Document Analyzer
    const [showDocAiModal, setShowDocAiModal] = useState(false);
    const [docAiFiles, setDocAiFiles] = useState([]);
    const [docAiLoading, setDocAiLoading] = useState(false);
    const [docAiResult, setDocAiResult] = useState(null);
    // Import from questionnaire
    const [showImportModal, setShowImportModal] = useState(false);
    const [questionnaires, setQuestionnaires] = useState([]);
    const [importLoadingId, setImportLoadingId] = useState(null);
    const [importedIds, setImportedIds] = useState(new Set());
    const [conclusionLoading, setConclusionLoading] = useState(false);
    // Sistematizacija + response counts
    const [sistematizacije, setSistematizacije] = useState([]);
    const [responseCounts, setResponseCounts] = useState({});
    // AI Generation
    const [showAiGenTableModal, setShowAiGenTableModal] = useState(false);
    const [aiGenJobTitle, setAiGenJobTitle] = useState('');
    const [aiGenLoading, setAiGenLoading] = useState(false);
    const [aiGenSelectedWps, setAiGenSelectedWps] = useState([]); // Array of workplace IDs
    const [aiGenCustomWp, setAiGenCustomWp] = useState(''); // Custom workplace name
    // Equipment for context panel
    const [equipment, setEquipment] = useState([]);
    const [orgUnits, setOrgUnits] = useState([]);
    const [workers, setWorkers] = useState([]);
    // Bulk add hazards
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkWpId, setBulkWpId] = useState('');
    const [bulkSelected, setBulkSelected] = useState([]);
    // Mjere inline cell edit modal
    const [mjeraEdit, setMjeraEdit] = useState(null); // { riId, field, label, value, type }

    const loadData = useCallback(() => {
        setRecords(getAll(COLLECTIONS.RISK_ASSESSMENTS));
        setPersonTypes(getAll(COLLECTIONS.PERSON_TYPES));
        setHazards(getAll(COLLECTIONS.HAZARDS));
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        setQuestionnaires(getAll(COLLECTIONS.QUESTIONNAIRES).filter(q => q.dodajUPrilogProcjeniRizika === 'Dodaje se u procjenu rizika'));
        setSistematizacije(getAll(COLLECTIONS.SISTEMATIZACIJE));
        setEquipment(getAll(COLLECTIONS.EQUIPMENT));
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
        setWorkers(getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false));
    }, []);

    // Load response counts from Firestore for each questionnaire
    useEffect(() => {
        if (questionnaires.length === 0) return;
        const fetchCounts = async () => {
            const counts = {};
            for (const q of questionnaires) {
                try {
                    const sessions = await getSessionsForQuestionnaire(q.id);
                    counts[q.id] = sessions.filter(s => s.status === 'completed').length;
                } catch { counts[q.id] = 0; }
            }
            setResponseCounts(counts);
        };
        fetchCounts();
    }, [questionnaires]);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    const loadRiskItems = useCallback((procjenaId) => {
        if (!procjenaId) { setRiskItems([]); return; }
        setRiskItems(getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === procjenaId));
    }, []);

    const set = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        markDirty();
        isDirtyRef.current = true;
    };

    const handleCancel = (skipHistoryBack = false) => {
        markClean();
        isDirtyRef.current = false;
        setEditingId(null);
        setView('list');
        if (!skipHistoryBack && typeof window !== 'undefined') {
            window.history.back();
        }
    };

    const handleBack = () => {
        window.history.back();
    };

    useEffect(() => {
        const onPopState = () => {
            if (view === 'form' && !contextIsDirty) {
                handleCancel(true);
            }
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [view, contextIsDirty]);

    // ─── Procjene CRUD ───
    const handleNew = () => {
        let defaultCompany = '';
        let djelatnost = '';
        let sjediste = '';
        try {
            const activeId = localStorage.getItem('eznr_activeCompany');
            if (activeId && activeId !== 'all') {
                const comp = getAll(COLLECTIONS.COMPANIES).find(c => c.id === activeId);
                if (comp) {
                    defaultCompany = comp.naziv || '';
                    djelatnost = comp.djelatnost || '';
                    sjediste = comp.adresa || '';
                }
            }
        } catch(e){}
        
        setFormData({ 
            ...EMPTY_PROCJENA, 
            nazivTvrtke: defaultCompany, 
            djelatnost,
            sjediste,
            ukupnoZaposlenih: workers.length.toString(),
            datumIzrade: todayISO() 
        });
        setEditingId(null); setRiskItems([]); setActiveTab('opsti'); setView('form');
        markClean();
        isDirtyRef.current = false;
        if (typeof window !== 'undefined') window.history.pushState({ riskForm: true }, '');
    };
    const handleEdit = (item) => {
        setFormData({ ...EMPTY_PROCJENA, ...item });
        setEditingId(item.id); loadRiskItems(item.id); setActiveTab('opsti'); setView('form');
        markClean();
        isDirtyRef.current = false;
        if (typeof window !== 'undefined') window.history.pushState({ riskForm: true }, '');
    };
    const handleDelete = async (id) => {
        if (await confirm(t('obrisatiProcjenuISveStavke'))) {
            // cascade delete risk items
            const items = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === id);
            items.forEach(ri => remove(COLLECTIONS.RISK_ITEMS, ri.id));
            remove(COLLECTIONS.RISK_ASSESSMENTS, id); loadData();
        }
    };
    const handleCopy = async (r) => {
        if (!await confirm(`Kopirati procjenu "${r.nazivTvrtke || 'Bez naziva'}"?`)) return;
        const copyData = { ...r, status: 'draft', datumIzrade: todayISO() };
        delete copyData.id;
        if (copyData.nazivTvrtke) copyData.nazivTvrtke += ' (Kopija)';
        const newDoc = create(COLLECTIONS.RISK_ASSESSMENTS, copyData);
        
        const originalItems = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === r.id);
        originalItems.forEach(ri => {
            const copyRi = { ...ri, procjenaId: newDoc.id };
            delete copyRi.id;
            create(COLLECTIONS.RISK_ITEMS, copyRi);
        });
        
        loadData();
        showFlash();
    };
    const handleSave = async () => {
        if (!formData.nazivTvrtke) { alert(t('nazivTvrtkeJeObavezan')); return; }
        if (!formData.nazivProcjene) { alert(t('nazivProcjeneJeObavezan')); return; }
        
        let docData = null;
        let docName = `Procjena_rizika_${(formData.nazivTvrtke || 'export').replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
        try {
            if (typeof handleGenerateDocx === 'function') {
                docData = await handleGenerateDocx(false);
            }
        } catch (e) {
            console.error('Failed to generate DOCX for sync:', e);
        }

        let savedId = editingId;
        if (editingId) update(COLLECTIONS.RISK_ASSESSMENTS, editingId, formData);
        else { const n = create(COLLECTIONS.RISK_ASSESSMENTS, formData); savedId = n.id; setEditingId(savedId); }
        
        // --- Auto-sync Employer Docs "Akt procjene rizika zaštite na radu" ---
        try {
            const docs = getAll(COLLECTIONS.EMPLOYER_DOCS);
            const match = docs.find(d => d.naziv?.toLowerCase().includes('akt procjene rizika zaštite na radu') || d.naziv?.toLowerCase().includes('akt procjene rizika zastite na radu'));
            const datumIzd = formData.datumIzrade || todayISO();
            const dateObj = new Date(datumIzd);
            dateObj.setFullYear(dateObj.getFullYear() + 2);
            const datumIst = dateObj.toISOString().split('T')[0];

            if (match) {
                update(COLLECTIONS.EMPLOYER_DOCS, match.id, { 
                    datumIzdavanja: datumIzd, 
                    datumIsteka: datumIst, 
                    status: 'aktivan',
                    napomena: '', 
                    ...(docData ? { docData, docName, docType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } : {})
                });
            } else {
                create(COLLECTIONS.EMPLOYER_DOCS, {
                    naziv: 'Akt procjene rizika zaštite na radu',
                    kategorija: 'obavezna',
                    status: 'aktivan',
                    datumIzdavanja: datumIzd,
                    datumIsteka: datumIst,
                    napomena: '',
                    ...(docData ? { docData, docName, docType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } : {})
                });
            }
        } catch (e) {
            console.error('Error auto-syncing employer docs:', e);
        }
        // -------------------------------------------------------------------

        loadData();
        showFlash();
        markClean();
        isDirtyRef.current = false;
    };

    // ─── Risk Items CRUD ───
    const handleInlineRiUpdate = (id, field, value) => {
        update(COLLECTIONS.RISK_ITEMS, id, { [field]: value });
        setRiskItems(prev => prev.map(ri => ri.id === id ? { ...ri, [field]: value } : ri));
        showFlash();
    };

    const handleNewRi = () => {
        setRiForm({ ...EMPTY_RISK_ITEM, procjenaId: editingId }); setRiEditId(null); setShowRiForm(true);
    };
    const handleEditRi = (ri) => {
        if (riEditId === ri.id && showRiForm) {
            setShowRiForm(false); setRiEditId(null); return;
        }
        setRiForm({ ...ri }); setRiEditId(ri.id); setShowRiForm(true); setLastEditedRiId(null);
    };
    const handleDeleteRi = async (id) => {
        if (await confirm(t('obrisiStavku'))) {
            remove(COLLECTIONS.RISK_ITEMS, id); loadRiskItems(editingId);
        }
    };
    
    const handleBulkDeleteRi = async () => {
        if (selectedRiIds.size === 0) return;
        if (await confirm(lang !== 'en' ? `Obrisati ${selectedRiIds.size} odabranih stavki?` : `Delete ${selectedRiIds.size} selected items?`)) {
            for (const id of selectedRiIds) {
                remove(COLLECTIONS.RISK_ITEMS, id);
            }
            setSelectedRiIds(new Set());
            loadRiskItems(editingId);
        }
    };
    const handleSaveRi = () => {
        if (!riForm.opasnostId && !riForm.opisOpasnosti) { alert('Odaberite opasnost ili unesite opis!'); return; }
        if (!riForm.vjerovatnoca || !riForm.posljedica) { alert('Vjerovatnoća i Posljedica su obavezni (1-5)!'); return; }
        const score = riForm.vjerovatnoca * riForm.posljedica;
        const vN = riForm.vjerovatnocaNakon || 0;
        const pN = riForm.posljedlicaNakon || 0;
        const scoreAfter = vN> 0 && pN> 0 ? vN * pN : 0;
        const data = { ...riForm, rizik: score, nivoRizika: riskLevel(score).label, rizikNakon: scoreAfter, nivoRizikaNakon: scoreAfter> 0 ? riskLevel(scoreAfter).label : '' };
        if (riEditId) { update(COLLECTIONS.RISK_ITEMS, riEditId, data); setLastEditedRiId(riEditId); }
        else create(COLLECTIONS.RISK_ITEMS, data);
        setShowRiForm(false); setRiEditId(null); loadRiskItems(editingId);
        showFlash();
    };
    const handleAiOpis = async (mode = 'app') => {
        if (!formData.nazivTvrtke) {
            alert(t('molimoPrvoUnesiteNazivFirme'));
            return;
        }
        setAiOpisLoading(true);
        try {
            // Determine which workplaces to use:
            // If a specific workplace is selected, use it; otherwise use ALL from the company
            let wps;
            if (formData.radnoMjestoId) {
                const selectedWp = workplaces.find(w => w.id === formData.radnoMjestoId);
                wps = selectedWp ? [selectedWp] : workplaces;
            } else {
                // "Cijela firma" — use ALL workplaces
                wps = workplaces;
            }
            
            // Build context from user-written text and app data
            const companyDataWithContext = {
                ...formData,
                // Pass user-written text as additional context for the AI
                userOpisProcesa: mode === 'text' ? (formData.opisProcesa || '') : '',
                userAnalizaOrganizacije: mode === 'text' ? (formData.analizaOrganizacije || '') : '',
                // Include sistematizacija data for accurate AI generation
                ukupnoZaposlenih: workers.length,
            };
            
            // Build rich sistematizacija context for the AI
            const sistContext = wps.map(wp => {
                const sist = sistematizacije.find(s => s.radnoMjestoId === wp.id);
                if (!sist) return `${wp.naziv}: (nema sistematizacije)`;
                return `${wp.naziv}: ${sist.opisPoslova || 'Nema opisa'}. Složenost: ${sist.slozenostPoslova || '?'}. Kategorija: ${sist.kategorijaRM || '?'}. OZO: ${(sist.potrebnaOZO || []).join(', ') || 'Nema'}. Oprema: ${(sist.radnaOprema || []).join(', ') || 'Nema'}. Stručna sprema: ${sist.strucnaSprema || '?'}. Certifikati: ${(sist.certifikati || []).join(', ') || 'Nema'}. Zdravstveni zahtjevi: ${(sist.zdravstveniZahtjevi || []).join(', ') || 'Nema'}. Broj izvršilaca: ${sist.brojIzvrsilaca || '?'}.`;
            }).join('\n');
            
            // Pass sistematizacija context alongside other data
            if (sistContext) {
                companyDataWithContext.sistematizacijaKontekst = sistContext;
            }
            
            const result = await fetchAiOpisProcesa(companyDataWithContext, wps, hazards);
            setFormData(prev => ({
                ...prev,
                opisProcesa: result.opisProcesa || prev.opisProcesa,
                analizaOrganizacije: result.analizaOrganizacije || prev.analizaOrganizacije
            }));
            markDirty();
            isDirtyRef.current = true;
            showFlash();
        } catch (err) { alert('Greška: ' + err.message); }
        setAiOpisLoading(false);
    };

    // ─── AI Measures Suggestion ───
    const handleAiSuggest = async () => {
        if (!riForm.vjerovatnoca || !riForm.posljedica) { alert('Prvo unesite V i P!'); return; }
        setAiLoading(true);
        try {
            let docData = null;
            let docMimeType = null;
            if (aiDocument) {
                try {
                    const base64 = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result.split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(aiDocument);
                    });
                    docData = base64;
                    docMimeType = aiDocument.type;
                } catch (e) {
                    console.error('File read error', e);
                }
            }

            const hz = hazards.find(h => h.id === riForm.opasnostId);
            const wp = workplaces.find(w => w.id === riForm.radnoMjestoId);
            const m = await fetchAiMeasures({
                hazardName: hz?.naziv || '', hazardCode: hz?.oznaka || '',
                workplaceName: wp?.naziv || '', opisOpasnosti: riForm.opisOpasnosti || '',
                vjerovatnoca: riForm.vjerovatnoca, posljedica: riForm.posljedica,
                postojeceMjere: riForm.postojeceMjere || '',
                documentData: docData,
                documentMimeType: docMimeType
            });
            setRiForm(prev => ({
                ...prev,
                postojeceMjere: m.postojeceMjere || prev.postojeceMjere,
                predlozeneMjere: m.predlozeneMjere || prev.predlozeneMjere,
                vjerovatnocaNakon: m.vjerovatnocaNakon || prev.vjerovatnocaNakon,
                posljedlicaNakon: m.posljedlicaNakon || prev.posljedlicaNakon,
            }));
        } catch (err) { alert('Greška: ' + err.message); }
        setAiLoading(false);
    };
    const setRi = (f, v) => setRiForm(prev => ({ ...prev, [f]: v }));

    // ─── AI Document Analyzer ───
    const handleDocAiAnalyze = async () => {
        if (!docAiFiles || docAiFiles.length === 0) {
            alert('Molimo odaberite barem jedan dokument za analizu.');
            return;
        }
        setDocAiLoading(true);
        try {
            const documents = [];
            for (const file of docAiFiles) {
                const base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                documents.push({ data: base64, mimeType: file.type, name: file.name });
            }

            const analysis = await fetchAiDocAnalyze(documents, formData.nazivTvrtke);
            setDocAiResult(analysis);
        } catch (err) {
            alert('Greška pri analizi: ' + err.message);
        }
        setDocAiLoading(false);
    };

    const applyDocAiResults = () => {
        if (!docAiResult) return;
        setFormData(prev => ({
            ...prev,
            opisProcesa: docAiResult.opisProcesa || prev.opisProcesa,
            analizaOrganizacije: docAiResult.analizaOrganizacije || prev.analizaOrganizacije
        }));
        markDirty();
        isDirtyRef.current = true;
        
        // Predložena oprema (create unlinked array or just hint)
        // Ako želimo automatski integrirati, možda je bolje to ostaviti kao alert ili appendovati u opis procesa
        if (docAiResult.oprema && docAiResult.oprema.length> 0) {
            const opremaText = '\\n\\nStrojevi/Oprema izvučena iz dokumenata:\\n- ' + docAiResult.oprema.join('\\n- ');
            setFormData(prev => ({ ...prev, opisProcesa: (prev.opisProcesa || '') + opremaText }));
        }

        // Predložene opasnosti -> dodajemo kao draft Risk Items
        if (docAiResult.opasnosti && docAiResult.opasnosti.length> 0) {
            let addCount = 0;
            docAiResult.opasnosti.forEach(op => {
                if (!op) return;
                create(COLLECTIONS.RISK_ITEMS, {
                    procjenaId: editingId,
                    radnoMjestoId: '', // nepoznato s kojeg je radnog mjesta
                    opasnostId: '', // unknown from catalog
                    opisOpasnosti: op,
                    vjerovatnoca: 3, posljedica: 3,
                    rizik: 9, nivoRizika: riskLevel(9).label,
                    postojeceMjere: '', predlozeneMjere: '',
                    vjerovatnocaNakon: 0, posljedlicaNakon: 0,
                    rizikNakon: 0, nivoRizikaNakon: '',
                    odgovornaOsoba: '', rokProvedbe: '',
                    status: 'draft', aiGenerated: true,
                });
                addCount++;
            });
            loadRiskItems(editingId);
            showFlash();
            alert(`AI podaci preuzeti! Dodano ${addCount} predloženih opasnosti u stavke procjene.`);
        } else {
            showFlash();
            alert('AI podaci (Opis i Organizacija) preuzeti!');
        }
        
        setShowDocAiModal(false);
        setDocAiResult(null);
        setDocAiFiles([]);
    };

    // ─── Sistematizacija + Equipment context for selected workplace ───
    const selectedWpSist = useMemo(() => {
        if (!riForm.radnoMjestoId) return null;
        return sistematizacije.find(s => s.radnoMjestoId === riForm.radnoMjestoId) || null;
    }, [riForm.radnoMjestoId, sistematizacije]);

    const selectedWpEquipment = useMemo(() => {
        if (!riForm.radnoMjestoId) return [];
        const wp = workplaces.find(w => w.id === riForm.radnoMjestoId);
        if (!wp?.orgUnitId) return [];
        return equipment.filter(eq => eq.orgJedinicaId === wp.orgUnitId);
    }, [riForm.radnoMjestoId, workplaces, equipment]);

    // ─── Bulk Add Hazards ───
    const handleBulkAdd = () => {
        if (!editingId || !bulkWpId || bulkSelected.length === 0) return;
        bulkSelected.forEach(hazId => {
            const hz = hazards.find(h => h.id === hazId);
            create(COLLECTIONS.RISK_ITEMS, {
                procjenaId: editingId,
                radnoMjestoId: bulkWpId,
                opasnostId: hazId,
                opisOpasnosti: hz ? `${hz.oznaka ? hz.oznaka + ' ' : ''}${hz.naziv}` : '',
                vjerovatnoca: 1, posljedica: 1,
                rizik: 1, nivoRizika: riskLevel(1).label,
                postojeceMjere: '', predlozeneMjere: '',
                odgovornaOsoba: '', rokProvedbe: '',
                vjerovatnocaNakon: 0, posljedlicaNakon: 0,
                rizikNakon: 0, nivoRizikaNakon: '',
            });
        });
        loadRiskItems(editingId);
        setShowBulkModal(false);
        setBulkSelected([]);
        setBulkWpId('');
        showFlash();
    };

    // ─── Import from Questionnaire ───
    const handleImportFromQuestionnaire = async (q) => {
        if (!editingId) return;
        
        const existingItems = riskItems.filter(ri => ri.questionnaireId === q.id);
        if (existingItems.length> 0) {
            if (!await confirm(`Već ste uvezli ${existingItems.length} stavki iz ovog upitnika. Želite li izbrisati prethodne i generisati nove?`)) {
                return;
            }
            for (const item of existingItems) {
                remove(COLLECTIONS.RISK_ITEMS, item.id);
            }
        }

        setImportLoadingId(q.id);
        try {
            const wp = workplaces.find(w => w.id === q.radnoMjestoId);
            // Get sistematizacija for this workplace
            const sist = sistematizacije.find(s => s.radnoMjestoId === q.radnoMjestoId);
            // Get completed responses from Firestore
            let responses = [];
            try {
                const sessions = await getSessionsForQuestionnaire(q.id);
                responses = sessions.filter(s => s.status === 'completed');
            } catch { /* no responses */ }
            const { data, raw, error } = await apiAnalyzeQuestionnaire({
                workplaceName: wp?.naziv || q.naziv || '',
                surveyJson: q.surveyJson,
                responses,
                sistematizacija: sist ? {
                    opisPoslova: sist.opisPoslova,
                    posebniUvjeti: sist.posebniUvjeti,
                    uvjetiRada: sist.uvjetiRada,
                    potrebnaOZO: sist.potrebnaOZO,
                    radnaOprema: sist.radnaOprema,
                    zdravstveniZahtjevi: sist.zdravstveniZahtjevi,
                } : null,
            });

            if (data?.items) {
                const items = data.items;
                let created = 0;
                items.forEach(item => {
                    const v = Math.min(5, Math.max(1, item.vjerovatnoca || 3));
                    const p = Math.min(5, Math.max(1, item.posljedica || 3));
                    const vN = Math.min(5, Math.max(1, item.vjerovatnocaNakon || Math.max(1, v - 1)));
                    const pN = Math.min(5, Math.max(1, item.posljedlicaNakon || Math.max(1, p - 1)));
                    const score = v * p;
                    const scoreAfter = vN * pN;
                    const daysStr = item.rokProvedbe || '90';
                    const days = parseInt(daysStr) || 90;
                    const deadline = new Date(); deadline.setDate(deadline.getDate() + days);
                    create(COLLECTIONS.RISK_ITEMS, {
                        procjenaId: editingId,
                        radnoMjestoId: q.radnoMjestoId || '',
                        opasnostId: '',
                        opisOpasnosti: item.opisOpasnosti || '',
                        vjerovatnoca: v, posljedica: p,
                        rizik: score, nivoRizika: riskLevel(score).label,
                        postojeceMjere: item.postojeceMjere || '',
                        predlozeneMjere: item.predlozeneMjere || '',
                        vjerovatnocaNakon: vN, posljedlicaNakon: pN,
                        rizikNakon: scoreAfter, nivoRizikaNakon: riskLevel(scoreAfter).label,
                        odgovornaOsoba: '', rokProvedbe: deadline.toISOString().split('T')[0],
                        status: 'draft', aiGenerated: true, source: 'questionnaire',
                    });
                    created++;
                });
                loadRiskItems(editingId);
                setImportedIds(prev => new Set([...prev, q.id]));
                showFlash();
            } else {
                await alert('AI greška: ' + (error || 'Nepoznata greška') + (raw ? '\n\nRaw: ' + raw.substring(0, 200) : ''));
            }
        } catch (err) { await alert('Greška: ' + err.message); }
        setImportLoadingId(null);
    };

    // ─── Auto-Generate Risk Items Table (Multi-Workplace) ───
    const handleAiGenerateTableSubmit = async () => {
        if (!editingId) return;
        
        // Build list of workplace names/IDs to generate for
        const wpTargets = [];
        for (const wpId of aiGenSelectedWps) {
            const wp = workplaces.find(w => w.id === wpId);
            if (wp) wpTargets.push({ id: wp.id, naziv: wp.naziv });
        }
        // Add custom workplace if specified
        if (aiGenCustomWp.trim()) {
            wpTargets.push({ id: '', naziv: aiGenCustomWp.trim() });
        }
        // Fallback to the single input field
        if (wpTargets.length === 0 && aiGenJobTitle.trim()) {
            wpTargets.push({ id: formData.radnoMjestoId || '', naziv: aiGenJobTitle.trim() });
        }
        
        if (wpTargets.length === 0) {
            alert('Odaberite barem jedno radno mjesto ili unesite naziv!');
            return;
        }
        
        // ─── DEDUPLICATE by workplace name ───
        // If 15 workers have "Vozač", we only generate risks ONCE for "Vozač"
        const uniqueByName = new Map();
        for (const wp of wpTargets) {
            const key = wp.naziv.trim().toLowerCase();
            if (!uniqueByName.has(key)) {
                uniqueByName.set(key, wp);
            }
        }
        const dedupedTargets = [...uniqueByName.values()];
        
        setAiGenLoading(true);
        let totalCreated = 0;
        let errors = [];
        
        try {
            for (const wp of dedupedTargets) {
                try {
                    // Build sistematizacija context for this workplace
                    const sist = sistematizacije.find(s => s.radnoMjestoId === wp.id);
                    let sistContext = '';
                    if (sist) {
                        const parts = [];
                        if (sist.opisPoslova) parts.push(`Opis poslova: ${sist.opisPoslova}`);
                        if (sist.kategorijaRM) parts.push(`Kategorija: ${sist.kategorijaRM}`);
                        if (sist.slozenostPoslova) parts.push(`Složenost: ${sist.slozenostPoslova}`);
                        if (sist.potrebnaOZO?.length) parts.push(`OZO: ${sist.potrebnaOZO.join(', ')}`);
                        if (sist.radnaOprema?.length) parts.push(`Oprema: ${sist.radnaOprema.join(', ')}`);
                        if (sist.certifikati?.length) parts.push(`Certifikati: ${sist.certifikati.join(', ')}`);
                        if (sist.zdravstveniZahtjevi?.length) parts.push(`Zdravstveni zahtjevi: ${sist.zdravstveniZahtjevi.join(', ')}`);
                        if (sist.posebniUvjeti?.length) parts.push(`Posebni uvjeti: ${(Array.isArray(sist.posebniUvjeti) ? sist.posebniUvjeti : Object.values(sist.posebniUvjeti)).join(', ')}`);
                        if (sist.odgovornosti) parts.push(`Odgovornosti: ${sist.odgovornosti}`);
                        sistContext = parts.join('. ');
                    }
                    
                    const items = await apiGenerateRiskTable(
                        wp.naziv, 
                        formData.nazivTvrtke, 
                        formData.djelatnost,
                        sistContext
                    );
                    for (const item of items) {
                        const rizik = item.vjerovatnoca * item.posljedica;
                        const rizikNakon = (item.vjerovatnocaNakon || 0) * (item.posljedlicaNakon || 0);
                        create(COLLECTIONS.RISK_ITEMS, {
                            procjenaId: editingId,
                            radnoMjestoId: wp.id || formData.radnoMjestoId || '',
                            opasnostId: '',
                            opisOpasnosti: item.opisOpasnosti || '',
                            vjerovatnoca: item.vjerovatnoca,
                            posljedica: item.posljedica,
                            rizik: rizik,
                            nivoRizika: riskLevel(rizik).label,
                            postojeceMjere: item.postojeceMjere || '',
                            predlozeneMjere: item.predlozeneMjere || '',
                            vjerovatnocaNakon: item.vjerovatnocaNakon || 0,
                            posljedlicaNakon: item.posljedlicaNakon || 0,
                            rizikNakon: rizikNakon,
                            nivoRizikaNakon: rizikNakon> 0 ? riskLevel(rizikNakon).label : '',
                            odgovornaOsoba: formData.ovlOsobaIme || '',
                            rokProvedbe: '',
                            status: 'draft',
                            aiGenerated: true,
                            wpNaziv: wp.naziv, // Store which workplace this was generated for
                        });
                        totalCreated++;
                    }
                    
                    // Added sleep to prevent blasting the API and hitting 429/503 limits
                    await new Promise(r => setTimeout(r, 2000));
                } catch (wpErr) {
                    errors.push(`${wp.naziv}: ${wpErr.message}`);
                }
            }
            loadRiskItems(editingId);
            setShowAiGenTableModal(false);
            setAiGenJobTitle('');
            setAiGenSelectedWps([]);
            setAiGenCustomWp('');
            showFlash();
            if (errors.length> 0) {
                alert(`Generisano ${totalCreated} stavki. Greške za: ${errors.join('; ')}`);
            } else {
                const skipped = wpTargets.length - dedupedTargets.length;
                let msg = `Uspješno generisano ${totalCreated} stavki za ${dedupedTargets.length} jedinstveno/a radno/a mjesto/a.`;
                if (skipped> 0) msg += ` (${skipped} duplikata preskočeno)`;
                alert(msg);
            }
        } catch (err) {
            alert('Greška pri AI izradi: ' + err.message);
        }
        setAiGenLoading(false);
    };

    // ─── Word (.docx) Export ───
    const handleGenerateDocx = async (saveToFile = true, overrideData = null, overrideItems = null) => {
        return generateSafeWordDoc(
            overrideData || formData, 
            overrideItems || riskItems, 
            workplaces, 
            hazards, 
            saveToFile,
            country
        );
    };

    // ─── AI Auto-Conclusion ───
    const handleAutoConclusion = async () => {
        if (riskItems.length === 0) return;
        setConclusionLoading(true);
        try {
            const text = await fetchAiAutoConclusion(riskItems, formData, country);
            if (text) {
                set('zakljucak', text);
            }
        } catch (err) { await alert('Greška: ' + err.message); }
        setConclusionLoading(false);
    };

    // ─── PDF Report Generator ───
    const handleGenerateReport = (overrideData = null, overrideItems = null, autoPrint = false) => {
        const data = (overrideData && !overrideData.nativeEvent) ? overrideData : formData;
        const items = (overrideItems && !overrideItems.nativeEvent) ? overrideItems : riskItems;
        const itemsWithScores = items.filter(ri => ri.rizik> 0);
        const avgBefore = itemsWithScores.length> 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
        const itemsWithAfter = items.filter(ri => ri.rizikNakon> 0);
        const avgAfter = itemsWithAfter.length> 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;
        const gradeBefore = avgBefore> 0 ? riskLevel(Math.round(avgBefore)) : null;
        const gradeAfter = avgAfter> 0 ? riskLevel(Math.round(avgAfter)) : null;
        const sorted = [...items].sort((a, b) => (b.rizik || 0) - (a.rizik || 0));
        const highRiskItems = items.filter(ri => ri.rizik>= 6).sort((a, b) => b.rizik - a.rizik);
        const today = new Date().toLocaleDateString('hr-HR');

        const rlColor = (score) => {
            if (score <= 5) return '#4caf50'; if (score <= 10) return '#f59e0b';
            if (score <= 15) return '#ff9800'; if (score <= 20) return '#f44336'; return '#b71c1c';
        };
        const rlBg = (score) => {
            if (score <= 5) return '#e8f5e9'; if (score <= 10) return '#fff8e1';
            if (score <= 15) return '#fff3e0'; if (score <= 20) return '#ffebee'; return '#ffcdd2';
        };
        const rlLabel = (score) => riskLevel(score).label;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Akt o procjeni rizika — ${data.nazivTvrtke || 'Procjena'}</title>
<style>
@page { size: A4; margin: 20mm 15mm; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.5; padding: 0; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 6px; color: #1a237e; }
h2 { font-size: 14pt; color: #283593; border-bottom: 2px solid #3f51b5; padding-bottom: 4px; margin: 28px 0 12px; }
h3 { font-size: 12pt; color: #1a237e; margin: 18px 0 8px; }
.cover { text-align: center; padding: 60px 0 40px; page-break-after: always; }
.cover h1 { font-size: 28pt; margin-bottom: 12px; }
.cover .subtitle { font-size: 14pt; color: #555; margin-bottom: 40px; }
.cover .meta { font-size: 11pt; color: #666; margin: 6px 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; font-size: 9pt; }
th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
th { background: #e8eaf6; font-weight: 700; color: #283593; }
tr:nth-child(even) { background: #fafafa; }
.badge { padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 8pt; display: inline-block; }
.grade-box { display: inline-block; padding: 12px 20px; border-radius: 8px; text-align: center; margin: 0 12px 12px 0; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin: 8px 0 16px; }
.info-grid dt { font-weight: 600; color: #555; font-size: 9pt; }
.info-grid dd { margin: 0 0 4px; font-size: 10pt; }
.conclusion { background: #f5f5f5; border-left: 4px solid #3f51b5; padding: 16px 20px; margin: 16px 0; white-space: pre-wrap; }
.footer { font-size: 8pt; color: #999; text-align: center; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 8px; }
@media print { button { display: none !important; } }
</style></head><body>

<!-- COVER PAGE -->
<div class="cover">
    <div style="font-size:10pt;color:#999;margin-bottom:30px">Bosna i Hercegovina — Federacija BiH</div>
    <h1>AKT O PROCJENI RIZIKA</h1>
    <div class="subtitle">na radnim mjestima i u radnim prostorijama</div>
    <div style="margin:30px 0;padding:20px;background:#f5f5f5;border-radius:8px;display:inline-block;min-width:300px">
        <div style="font-size:16pt;font-weight:700;color:#1a237e">${data.nazivTvrtke || '—'}</div>
        <div style="font-size:10pt;color:#666;margin-top:4px">${data.sjediste || ''}</div>
        <div style="font-size:10pt;color:#666">${data.djelatnost || ''}</div>
    </div>
    <div class="meta">Datum izrade: ${data.datumIzrade ? new Date(data.datumIzrade).toLocaleDateString('hr-HR') : today}</div>
    <div class="meta">Revizija: ${data.revizija || '1'}</div>
    ${data.ovlOrganizacija ? `<div class="meta" style="margin-top:16px">Izradila: ${data.ovlOrganizacija}</div>` : ''}
    ${data.ovlOsobaIme ? `<div class="meta">Ovlaštena osoba: ${data.ovlOsobaIme} ${data.ovlOsobaKvalifikacije ? '(' + data.ovlOsobaKvalifikacije + ')' : ''}</div>` : ''}
</div>

<!-- SECTION 1: GENERAL DATA -->
<h2>1. Opšti podaci o poslodavcu</h2>
<div class="info-grid">
    <dt>Naziv:</dt><dd>${data.nazivTvrtke || '—'}</dd>
    <dt>Sjedište:</dt><dd>${data.sjediste || '—'}</dd>
    <dt>Djelatnost:</dt><dd>${data.djelatnost || '—'}</dd>
    <dt>Ukupno zaposlenih:</dt><dd>${data.ukupnoZaposlenih || '—'}</dd>
    <dt>Ovlaštena organizacija:</dt><dd>${data.ovlOrganizacija || '—'}</dd>
    <dt>Ovlaštena osoba:</dt><dd>${data.ovlOsobaIme || '—'} ${data.ovlOsobaKvalifikacije ? '(' + data.ovlOsobaKvalifikacije + ')' : ''}</dd>
</div>

<!-- SECTION 2: SISTEMATIZACIJA -->
<h2>2. Sistematizacija radnih mjesta</h2>
${workplaces.filter(wp => items.some(ri => ri.radnoMjestoId === wp.id)).map(wp => {
    const sist = sistematizacije.find(s => s.radnoMjestoId === wp.id);
    if (!sist) return `<h3>${wp.naziv}</h3><p>Nema unesenih podataka o sistematizaciji.</p>`;
    return `<h3>${wp.naziv} — ${sist.nazivPosla || wp.naziv}</h3>
    <div class="info-grid">
        <dt>Kategorija:</dt><dd>${sist.kategorijaRM || '—'}</dd>
        <dt>Složenost:</dt><dd>${sist.slozenostPoslova || '—'}</dd>
        <dt>Stručna sprema:</dt><dd>${sist.strucnaSprema || '—'}</dd>
        <dt>Radno iskustvo:</dt><dd>${sist.radnoIskustvo || '—'}</dd>
        <dt>Broj izvršilaca:</dt><dd>${sist.brojIzvrsilaca || 1}</dd>
        <dt>Probni rad:</dt><dd>${sist.probniRad || '—'}</dd>
    </div>
    <p><strong>Opis poslova:</strong><br>${(sist.opisPoslova || '—').replace(/\n/g, '<br>')}</p>
    <p><strong>Odgovornosti:</strong><br>${(sist.odgovornosti || '—').replace(/\n/g, '<br>')}</p>
    <div class="info-grid">
        <dt>Potrebna OZO:</dt><dd>${(sist.potrebnaOZO || []).join(', ') || '—'}</dd>
        <dt>Radna oprema:</dt><dd>${(sist.radnaOprema || []).join(', ') || '—'}</dd>
        <dt>Zdravstveni zahtjevi:</dt><dd>${(sist.zdravstveniZahtjevi || []).join(', ') || '—'}</dd>
        <dt>Certifikati:</dt><dd>${(sist.certifikati || []).join(', ') || '—'}</dd>
    </div>`;
}).join('')}

<!-- SECTION 3: PROCESS -->
<h2>3. Opis tehničko-tehnološkog procesa</h2>
<p>${(data.opisProcesa || 'Nije uneseno.').replace(/\n/g, '<br>')}</p>
${data.analizaOrganizacije ? `<h3>Analiza organizacije rada</h3><p>${data.analizaOrganizacije.replace(/\n/g, '<br>')}</p>` : ''}

<!-- SECTION 4: RISK MATRIX RESULTS -->
<h2>4. Procjena rizika — rezultati</h2>
<p>Ukupno procijenjeno: <strong>${items.length}</strong> stavki na <strong>${[...new Set(items.map(r => r.radnoMjestoId))].length}</strong> radnih mjesta.</p>
<table>
<thead><tr><th>#</th><th>Radno mjesto</th><th>Opasnost / Štetnost</th><th>V₀</th><th>P₀</th><th>R₀</th><th>Nivo</th><th>V₁</th><th>P₁</th><th>R₁</th><th>Nivo nakon</th></tr></thead>
<tbody>
${sorted.map((ri, i) => {
    const wp = workplaces.find(w => w.id === ri.radnoMjestoId);
    const hz = hazards.find(h => h.id === ri.opasnostId);
    const hasAfter = ri.rizikNakon> 0;
    return `<tr>
        <td>${i + 1}</td>
        <td>${wp?.naziv || '—'}</td>
        <td>${hz ? (hz.oznaka ? hz.oznaka + ' ' : '') + hz.naziv : ri.opisOpasnosti || '—'}</td>
        <td style="text-align:center">${ri.vjerovatnoca}</td>
        <td style="text-align:center">${ri.posljedica}</td>
        <td style="text-align:center;font-weight:700;color:${rlColor(ri.rizik)}">${ri.rizik}</td>
        <td><span class="badge" style="background:${rlBg(ri.rizik)};color:${rlColor(ri.rizik)}">${rlLabel(ri.rizik)}</span></td>
        <td style="text-align:center">${hasAfter ? ri.vjerovatnocaNakon : '—'}</td>
        <td style="text-align:center">${hasAfter ? ri.posljedlicaNakon : '—'}</td>
        <td style="text-align:center;font-weight:700;color:${hasAfter ? rlColor(ri.rizikNakon) : '#999'}">${hasAfter ? ri.rizikNakon : '—'}</td>
        <td>${hasAfter ? '<span class="badge" style="background:' + rlBg(ri.rizikNakon) + ';color:' + rlColor(ri.rizikNakon) + '">' + rlLabel(ri.rizikNakon) + '</span>' : '—'}</td>
    </tr>`;
}).join('')}
</tbody>
</table>

<!-- SECTION 5: OVERALL GRADE -->
<h2>5. Ukupna ocjena rizika</h2>
<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:12px 0">
    <div class="grade-box" style="background:${gradeBefore ? rlBg(Math.round(avgBefore)) : '#f5f5f5'};border:2px solid ${gradeBefore ? rlColor(Math.round(avgBefore)) : '#ddd'}">
        <div style="font-size:8pt;color:#666;margin-bottom:4px">PRIJE MJERA</div>
        <div style="font-size:20pt;font-weight:900;color:${gradeBefore ? rlColor(Math.round(avgBefore)) : '#999'}">${avgBefore> 0 ? avgBefore.toFixed(1) : '—'}</div>
        ${gradeBefore ? '<div style="font-size:9pt;font-weight:700;color:' + rlColor(Math.round(avgBefore)) + '">' + gradeBefore.label + '</div>' : ''}
    </div>
    ${gradeAfter ? '<div style="font-size:20pt;font-weight:900;color:#4caf50">→</div>' : ''}
    ${gradeAfter ? '<div class="grade-box" style="background:' + rlBg(Math.round(avgAfter)) + ';border:2px solid ' + rlColor(Math.round(avgAfter)) + '"><div style="font-size:8pt;color:#666;margin-bottom:4px">NAKON MJERA</div><div style="font-size:20pt;font-weight:900;color:' + rlColor(Math.round(avgAfter)) + '">' + avgAfter.toFixed(1) + '</div><div style="font-size:9pt;font-weight:700;color:' + rlColor(Math.round(avgAfter)) + '">' + gradeAfter.label + '</div></div>' : ''}
    ${gradeAfter && avgAfter < avgBefore ? '<div class="grade-box" style="background:#e8f5e9;border:2px solid #4caf50"><div style="font-size:8pt;color:#4caf50">SMANJENJE</div><div style="font-size:18pt;font-weight:900;color:#4caf50">↓ ' + ((1 - avgAfter / avgBefore) * 100).toFixed(0) + '%</div></div>' : ''}
</div>

<!-- SECTION 6: MEASURES -->
${highRiskItems.length> 0 ? `<h2>6. Plan mjera za smanjenje rizika</h2>
<p>Stavke sa početnim rizikom R₀ ≥ 6 koje zahtijevaju dodatne mjere:</p>
<table>
<thead><tr><th>#</th><th>Opasnost</th><th>R₀</th><th>Postojeće mjere</th><th>Predložene mjere</th><th>R₁</th><th>Odgovorna osoba</th><th>Rok</th></tr></thead>
<tbody>
${highRiskItems.map((ri, i) => {
    const hz = hazards.find(h => h.id === ri.opasnostId);
    const hasAfter = ri.rizikNakon> 0;
    return '<tr><td>' + (i + 1) + '</td><td>' + (hz ? (hz.oznaka ? hz.oznaka + ' ' : '') + hz.naziv : ri.opisOpasnosti || '—') + '</td><td style="text-align:center;font-weight:700;color:' + rlColor(ri.rizik) + '">' + ri.rizik + '</td><td>' + (ri.postojeceMjere || '—') + '</td><td style="font-weight:600">' + (ri.predlozeneMjere || '—') + '</td><td style="text-align:center;font-weight:700;color:' + (hasAfter ? rlColor(ri.rizikNakon) : '#999') + '">' + (hasAfter ? ri.rizikNakon : '—') + '</td><td>' + (ri.odgovornaOsoba || '—') + '</td><td>' + (ri.rokProvedbe ? new Date(ri.rokProvedbe).toLocaleDateString('hr-HR') : '—') + '</td></tr>';
}).join('')}
</tbody>
</table>` : ''}

<!-- SECTION 7: CONCLUSION -->
<h2>${highRiskItems.length> 0 ? '7' : '6'}. Zaključak</h2>
<div class="conclusion">${(data.zakljucak || 'Zaključak nije unesen.').replace(/\n/g, '<br>')}</div>

<div style="margin-top:60px;display:flex;justify-content:space-between">
    <div style="text-align:center;min-width:200px"><div style="border-top:1px solid #333;padding-top:6px;font-size:9pt">Poslodavac</div></div>
    <div style="text-align:center;min-width:200px"><div style="border-top:1px solid #333;padding-top:6px;font-size:9pt">Ovlaštena osoba za ZNR</div></div>
</div>

<div class="footer">Akt o procjeni rizika — ${data.nazivTvrtke || ''} — Generisano: ${today} — eZNR Platform</div>

<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:12px 24px;font-size:14px;cursor:pointer;background:#3f51b5;color:white;border:none;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:999">📄 Preuzmi PDF (Print)</button>
${autoPrint ? '<script>setTimeout(() => window.print(), 500);</script>' : ''}
</body></html>`;

        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    // ─── Person Types & Hazards CRUD (same as before) ───
    const startNewPt = () => { setPtEdit('__new__'); setPtNaziv(''); setPtVrsta(''); };
    const startEditPt = (p) => { setPtEdit(p.id); setPtNaziv(p.naziv || ''); setPtVrsta(p.vrsta || ''); };
    const cancelPt = () => setPtEdit(null);
    const savePt = () => { if (!ptNaziv.trim()) return; if (ptEdit === '__new__') create(COLLECTIONS.PERSON_TYPES, { naziv: ptNaziv, vrsta: ptVrsta }); else update(COLLECTIONS.PERSON_TYPES, ptEdit, { naziv: ptNaziv, vrsta: ptVrsta }); setPtEdit(null); loadData(); };
    const deletePt = async (id) => { if (await confirm(t('obrisati'))) { remove(COLLECTIONS.PERSON_TYPES, id); loadData(); } };
    const startNewHaz = () => { setHazEdit('__new__'); setHazNaziv(''); setHazOznaka(''); };
    const startEditHaz = (h) => { setHazEdit(h.id); setHazNaziv(h.naziv || ''); setHazOznaka(h.oznaka || ''); };
    const cancelHaz = () => setHazEdit(null);
    const saveHaz = () => { if (!hazNaziv.trim()) return; if (hazEdit === '__new__') create(COLLECTIONS.HAZARDS, { naziv: hazNaziv, oznaka: hazOznaka }); else update(COLLECTIONS.HAZARDS, hazEdit, { naziv: hazNaziv, oznaka: hazOznaka }); setHazEdit(null); loadData(); };
    const deleteHaz = async (id) => { if (await confirm(t('obrisati'))) { remove(COLLECTIONS.HAZARDS, id); loadData(); } };

    const labelSt = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };

    const tabs = [
        { key: 'opsti', label: '📋 Opšti podaci', en: '📋 General' },
        { key: 'sistematizacija', label: '📑 Sistematizacija', en: '📑 Systematization' },
        { key: 'opis', label: '🏭 Opis procesa', en: '🏭 Process' },
        { key: 'procjena', label: '📊 Procjena rizika', en: '📊 Assessment' },
        { key: 'mjere', label: '🛡️ Mjere', en: '🛡️ Measures' },
        { key: 'zakljucak', label: '📝 Zaključak', en: '📝 Conclusion' },
    ];

    /* ━━━ LIST VIEW ━━━ */
    if (view === 'list') {
        const sortedRecords = [...records].filter(r => search ? ((r.nazivTvrtke || '').toLowerCase().includes(search.toLowerCase()) || (r.nazivProcjene || '').toLowerCase().includes(search.toLowerCase())) : true);
        sortedRecords.sort((a, b) => {
            let aVal = a[sortConfig.key] || '';
            let bVal = b[sortConfig.key] || '';
            if (sortConfig.key === 'radnoMjestoId') {
                aVal = workplaces.find(w => w.id === aVal)?.naziv || '';
                bVal = workplaces.find(w => w.id === bVal)?.naziv || '';
            } else if (sortConfig.key === 'cnt') {
                aVal = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === a.id).length;
                bVal = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === b.id).length;
            } else if (sortConfig.key === 'datumIzrade') {
                aVal = new Date(aVal).getTime() || 0;
                bVal = new Date(bVal).getTime() || 0;
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase();
            }
            if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
            if (aVal> bVal) return sortConfig.dir === 'asc' ? 1 : -1;
            return 0;
        });

        const reqSort = (k) => {
            setSortConfig(prev => ({ key: k, dir: prev.key === k && prev.dir === 'asc' ? 'desc' : 'asc' }));
        };
        const getSortIcon = (k) => sortConfig.key === k ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : '';
        const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

        const allSelected = sortedRecords.length> 0 && sortedRecords.every(r => selectedIds.has(r.id));
        const toggleAll = () => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(sortedRecords.map(r => r.id))); };
        const toggleSelect = (id) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

        const bulkDelete = async () => {
            if (selectedIds.size === 0) return;
            const ok = await confirm(lang !== 'en' ? `Obrisati ${selectedIds.size} procjena?` : `Delete ${selectedIds.size} assessments?`);
            if (!ok) return;
            selectedIds.forEach(id => remove(COLLECTIONS.RISK_ASSESSMENTS, id));
            setSelectedIds(new Set()); loadData();
        };
        const bulkPrint = () => {
            const toPrint = sortedRecords.filter(r => selectedIds.has(r.id));
            toPrint.forEach(r => {
                const items = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === r.id);
                handleGenerateReport(r, items, true);
            });
        };

        return (
            <div className="animate-fadeIn">
                <style>{`.hover-row:hover { background: rgba(0,0,0,0.02); }`}</style>
                <PageHeader icon="📊" title={t('procjeneRizika')} />
                <DialogRenderer />
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-body scrollable-toolbar" style={{ padding: 0, gap: 10 }}>
                        <button className="btn btn-primary btn-sm" title="Započnite kreiranje nove procjene rizika od nule" onClick={handleNew}>+ {t('novaProcjena')}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input title="Pretražite procjene po nazivu tvrtke ili nazivu procjene" placeholder={t('pretrazi1')} value={search} onChange={e => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                        <button className="btn btn-outline btn-sm" title="Uredite šifarnik opcija za vrstu osoba (Zaposlenik, Učenik na praksi...)" onClick={() => setView('vrstaOsobe')}>👤 {t('vrstaOsobe')}</button>
                        <button className="btn btn-outline btn-sm" title="Uredite glavni katalog/šifarnik mogućih opasnosti i štetnosti" onClick={() => setView('opasnosti')}>⚠️ {t('opasnosti')}</button>

                        {/* ── Grupne akcije bar ── */}
                        {selectedIds.size> 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selectedIds.size} {t('odabrano')} &mdash; Grupne akcije:
                                </span>
                                <button className="btn btn-primary btn-sm" title="Otvorite prozor za pregled i preuzimanje označenih procjena" onClick={bulkPrint}>🖨️ {t('isprintaj')}</button>
                                <button className="btn btn-danger btn-sm" title="Trajno obrišite označene procjene u potpunosti" onClick={bulkDelete}>🗑️ {t('obrisi')}</button>
                            </div>
                        )}
                        {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sortedRecords.length} {t('zapisa')}</span>}
                    </div>
                </div>
                <div className="card"><div className="card-body"><div className="data-table-wrapper">
                    <table className="data-table" style={{ width: '100%' }}><thead><tr>
                        <th style={{ width: 40, textAlign: 'center' }}>
                            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                        </th>
                        <th style={{ width: 90 }}>{t('actions')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('nazivProcjene')} title="Naziv dokumenta / procjene">{t('nazivProcjene')}{getSortIcon('nazivProcjene')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('nazivTvrtke')} title="Naziv tvrtke za koju radite procjenu">{t('nazivTvrtke')}{getSortIcon('nazivTvrtke')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('radnoMjestoId')} title="Povezano radno mjesto">{t('radnoMjesto')}{getSortIcon('radnoMjestoId')}</th>
                        <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => reqSort('revizija')} title="Broj revizije">{t('rev')}{getSortIcon('revizija')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('datumIzrade')} title="Datum kad je procjena napravljena">{t('datum')}{getSortIcon('datumIzrade')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('status')} title="Status dokumenta (Nacrt, Aktivna, Arhivirana)">{t('status')}{getSortIcon('status')}</th>
                        <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => reqSort('cnt')} title="Ukupan broj prepoznatih rizika/opasnosti">{t('rizika')}{getSortIcon('cnt')}</th>
                    </tr></thead><tbody>
                        {sortedRecords.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                        : sortedRecords.map(r => {
                            const cnt = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === r.id).length;
                            const st = r.status || 'draft';
                            const isChecked = selectedIds.has(r.id);
                            return (
                                <tr key={r.id} onClick={() => handleEdit(r)} style={{ cursor: 'pointer' }} className="hover-row">
                                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                                        <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(r.id)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                                    </td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <div style={{ position: 'relative' }}>
                                            <button className="btn btn-primary btn-sm" data-menu-trigger title="Prikaži padajući izbornik akcija za dokument"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (openMenuId === r.id) { setOpenMenuId(null); return; }
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    menuButtonRef.current = e.currentTarget;
                                                    const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                    const spaceAbove = rect.top - 8;
                                                    const flipUp = spaceBelow < 280 && spaceAbove> spaceBelow;
                                                    setMenuPos(flipUp
                                                        ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove - 15) }
                                                        : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow - 15) }
                                                    );
                                                    setOpenMenuId(r.id);
                                                }}>
                                                Akcije ▼
                                            </button>
                                            {openMenuId === r.id && (
                                                <div data-menu onMouseDown={(e) => e.preventDefault()} style={{
                                                    position: 'fixed',
                                                    top: menuPos.top,
                                                    bottom: menuPos.bottom,
                                                    left: menuPos.left,
                                                    zIndex: 9999, userSelect: 'none', WebkitUserSelect: 'none',
                                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                                                    minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto',
                                                }}>
                                                    <button onClick={() => { setOpenMenuId(null); handleEdit(r); }} className="dropdown-item">✏️ Otvori</button>
                                                    <button onClick={() => { setOpenMenuId(null); handleCopy(r); }} className="dropdown-item">📋 Kopiraj</button>
                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                    <button onClick={() => { setOpenMenuId(null); const items = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === r.id); handleGenerateReport(r, items, true); }} className="dropdown-item">🖨️ Isprintaj (PDF)</button>
                                                    <button onClick={async () => { setOpenMenuId(null); const items = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === r.id); await handleGenerateDocx(true, r, items); }} className="dropdown-item">📗 Preuzmi Word (.docx)</button>
                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                    <button onClick={() => { setOpenMenuId(null); handleDelete(r.id); }} className="dropdown-item text-danger">🗑️ Izbriši</button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r.nazivProcjene || '—'}</td>
                                    <td style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.85rem' }}>{r.nazivTvrtke || '—'}</td>
                                    <td style={{ fontWeight: 500, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.radnoMjestoId ? workplaces.find(w => w.id === r.radnoMjestoId)?.naziv || '—' : '—'}</td>
                                    <td style={{ textAlign: 'center' }}>{r.revizija || '—'}</td>
                                    <td>{formatDate(r.datumIzrade)}</td>
                                    <td><span className={`badge ${st === 'active' ? 'badge-success' : st === 'archived' ? 'badge-warning' : ''}`} style={{ fontSize: '0.72rem' }}>
                                        {st === 'active' ? 'Aktivna' : st === 'archived' ? 'Arhivirana' : 'Nacrt'}
                                    </span></td>
                                    <td style={{ textAlign: 'center' }}>{cnt}</td>
                                </tr>
                            );
                        })}
                    </tbody></table>
                </div></div></div>
            </div>
        );
    }

    /* ━━━ FORM VIEW — Multi-tab wizard ━━━ */
    if (view === 'form') {
        const riSorted = [...riskItems].sort((a, b) => (b.rizik || 0) - (a.rizik || 0));
        const highRisk = riskItems.filter(ri => ri.rizik>= 6);
        // Summary stats
        const bands = { neznatan: 0, dopustiv: 0, umjeren: 0, znatan: 0, nedopustiv: 0 };
        riskItems.forEach(ri => {
            const s = ri.rizik || 0;
            if (s <= 5) bands.neznatan++; else if (s <= 10) bands.dopustiv++; else if (s <= 15) bands.umjeren++;
            else if (s <= 20) bands.znatan++; else bands.nedopustiv++;
        });

        const currentTabIndex = tabs.findIndex(t => t.key === activeTab);
        const hasPrevTab = currentTabIndex> 0;
        const hasNextTab = currentTabIndex < tabs.length - 1;

        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <button className="btn btn-ghost" onClick={handleBack}>← {t('procjene')}</button>
                    <h1 style={{ margin: 0 }}>📊 {editingId ? (t('urediProcjenu')) : (t('novaProcjenaRizika'))}</h1>
                </div>
                <DialogRenderer />

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
                    {tabs.map(tb => (
                        <button key={tb.key} title={`Prikaži stranicu: ${lang !== 'en' ? tb.label : tb.en}`} onClick={() => setActiveTab(tb.key)}
                            className={`tab-btn ${activeTab === tb.key ? 'active' : ''}`}>{lang !== 'en' ? tb.label : tb.en}</button>
                    ))}
                </div>

                {/* ── TAB: Opšti podaci ── */}
                {activeTab === 'opsti' && (
                    <div className="card"><div className="card-body">
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>PODACI O POSLODAVCU</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                            <div>
                                <div style={labelSt}>Naziv procjene *</div>
                                <input className="form-input" title="Glavni naslov ovog dokumenta, npr. 'Procjena za sektor proizvodnje'" placeholder="Npr. Akt o procjeni rizika..." value={formData.nazivProcjene || ''} onChange={e => set('nazivProcjene', e.target.value)} />
                            </div>
                            <div>
                                <div style={labelSt}>Naziv tvrtke *</div>
                                <input className="form-input" title="Automatski preuzeto iz odabrane tvrtke, ali možete izmijeniti po potrebi" value={formData.nazivTvrtke || ''} onChange={e => set('nazivTvrtke', e.target.value)} />
                            </div>
                            <div>
                                <div style={labelSt}>Radno mjesto</div>
                                <select className="form-input" title="Opcionalno povežite ovu procjenu sa specifičnim radnim mjestom iz sistematizacije" value={formData.radnoMjestoId || ''} onChange={e => set('radnoMjestoId', e.target.value)}>
                                    <option value="">-- Cijela tvrtka ili nije povezano --</option>
                                    {workplaces.map(w => <option key={w.id} value={w.id}>{w.naziv}</option>)}
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <div><div style={labelSt}>Sjedište / Adresa</div><input className="form-input" title="Adresa poslodavca" value={formData.sjediste || ''} onChange={e => set('sjediste', e.target.value)} /></div>
                            <div><div style={labelSt}>Djelatnost</div><input className="form-input" title="Glavna djelatnost poslodavca" value={formData.djelatnost || ''} onChange={e => set('djelatnost', e.target.value)} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <div><div style={labelSt}>Br. zaposlenih</div><input className="form-input" type="number" min="0" value={formData.ukupnoZaposlenih || ''} onChange={e => set('ukupnoZaposlenih', e.target.value)} /></div>
                            <div><div style={labelSt}>Revizija</div><input className="form-input" value={formData.revizija} onChange={e => set('revizija', e.target.value)} /></div>
                            <div><div style={labelSt}>Datum izrade</div><DateInput value={formData.datumIzrade} onChange={v => set('datumIzrade', v)} /></div>
                        </div>
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14, marginTop: 10 }}>OVLAŠTENA ORGANIZACIJA</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <div><div style={labelSt}>Naziv organizacije</div><input className="form-input" value={formData.ovlOrganizacija || ''} onChange={e => set('ovlOrganizacija', e.target.value)} /></div>
                            <div><div style={labelSt}>Ovlaštena osoba</div><input className="form-input" value={formData.ovlOsobaIme || ''} onChange={e => set('ovlOsobaIme', e.target.value)} /></div>
                            <div><div style={labelSt}>Kvalifikacije</div><input className="form-input" value={formData.ovlOsobaKvalifikacije || ''} onChange={e => set('ovlOsobaKvalifikacije', e.target.value)} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, marginBottom: 10 }}>
                            <div><div style={labelSt}>Status<HelpTip text="Nacrt = procjena se još priprema, nije finalizirana. Aktivna = procjena je trenutno na snazi i važeća. Arhivirana = zamijenjena novijom verzijom ili istekla." /></div>
                                <select className="form-select" value={formData.status || 'draft'} onChange={e => set('status', e.target.value)}>
                                    <option value="draft">Nacrt</option><option value="active">Aktivna</option><option value="archived">Arhivirana</option>
                                </select>
                            </div>
                        </div>
                    </div></div>
                )}

                {/* ── TAB: Sistematizacija radnih mjesta ── */}
                {activeTab === 'sistematizacija' && (
                    <div className="card"><div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div>
                                <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 4 }}>SISTEMATIZACIJA RADNIH MJESTA</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Definirajte poslove, uvjete rada i zahtjeve za svako radno mjesto — ovi podaci koriste se za generisanje opisa procesa.
                                </div>
                            </div>
                            <div style={{ padding: '6px 14px', borderRadius: 'var(--radius-md)', background: workplaces.filter(wp => sistematizacije.find(s => s.radnoMjestoId === wp.id)).length === workplaces.length && workplaces.length> 0 ? 'rgba(76,175,80,0.15)' : 'rgba(255,193,7,0.15)', border: `1px solid ${workplaces.filter(wp => sistematizacije.find(s => s.radnoMjestoId === wp.id)).length === workplaces.length && workplaces.length> 0 ? '#4caf50' : '#ffc107'}`, fontWeight: 700, fontSize: '0.78rem', color: workplaces.filter(wp => sistematizacije.find(s => s.radnoMjestoId === wp.id)).length === workplaces.length && workplaces.length> 0 ? '#4caf50' : '#ffc107' }}>
                                {workplaces.filter(wp => sistematizacije.find(s => s.radnoMjestoId === wp.id)).length}/{workplaces.length} popunjeno
                            </div>
                        </div>

                        {workplaces.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30 }}>
                                ⚠️ Nema radnih mjesta. Kreirajte ih u modulu Radna mjesta (Organizacija → Radna mjesta).
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                            {workplaces.map(wp => {
                                const sist = sistematizacije.find(s => s.radnoMjestoId === wp.id);
                                const ou = orgUnits.find(o => o.id === wp.orgUnitId);
                                const isLoading = sistAiLoading && sistSelectedWp === wp.id;

                                return (
                                    <div key={wp.id} style={{ border: sist ? '2px solid rgba(76,175,80,0.4)' : '2px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, transition: 'all 0.2s', background: 'var(--bg-card)' }}>
                                        {/* Workplace Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{wp.naziv}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {wp.oznaka && <span style={{ marginRight: 6, padding: '1px 5px', borderRadius: 4, background: 'rgba(102,126,234,0.15)', color: '#667eea', fontWeight: 600 }}>{wp.oznaka}</span>}
                                                    {ou?.naziv || ''} {wp.strucnaSprema && `• ${wp.strucnaSprema}`}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '1rem' }}>{sist ? '✅' : '⚠️'}</span>
                                        </div>

                                        {sist ? (
                                            <div>
                                                {sist.nazivPosla && <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 3 }}>{sist.nazivPosla}</div>}
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text)', lineHeight: 1.5, marginBottom: 8, maxHeight: 50, overflow: 'hidden' }}>
                                                    {sist.opisPoslova || '—'}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                                                    {sist.kategorijaRM && <span style={{ padding: '1px 6px', borderRadius: 10, background: 'rgba(102,126,234,0.12)', color: '#667eea', fontSize: '0.65rem', fontWeight: 600 }}>{sist.kategorijaRM}</span>}
                                                    {sist.slozenostPoslova && <span style={{ padding: '1px 6px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: '0.65rem', fontWeight: 600 }}>{sist.slozenostPoslova}</span>}
                                                    {(sist.potrebnaOZO || []).slice(0, 2).map((ozo, i) => (
                                                        <span key={i} style={{ padding: '1px 6px', borderRadius: 10, background: 'rgba(0,191,166,0.15)', color: 'var(--primary)', fontSize: '0.65rem', fontWeight: 600 }}>🦺 {ozo}</span>
                                                    ))}
                                                    {(sist.potrebnaOZO || []).length> 2 && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+{sist.potrebnaOZO.length - 2}</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: 4, fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                                    <span>📋 {sist.certifikati?.length || 0} cert.</span>
                                                    <span>⚙️ {sist.radnaOprema?.length || 0} oprema</span>
                                                    <span>👥 {sist.brojIzvrsilaca || '?'} izvrš.</span>
                                                    {sist.aiGenerated && <span style={{ color: '#667eea' }}>🤖 AI</span>}
                                                </div>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    <button className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem' }} onClick={() => setSistEditData({ ...sist })}>✏️ Detalji</button>
                                                    <button className="btn btn-outline btn-sm" onClick={async () => {
                                                        setSistAiLoading(true); setSistSelectedWp(wp.id);
                                                        try {
                                                            const { data, error } = await apiGenerateSistematizacija({ workplaceName: wp.naziv, oznaka: wp.oznaka || '', strucnaSprema: wp.strucnaSprema || '', industry: activeCompany.djelatnost || formData.djelatnost || '', companyName: activeCompany.naziv || formData.nazivTvrtke || '', numberOfWorkers: '', orgUnit: ou?.naziv || '', radnoVrijemeOd: wp.radnoVrijemeOd || '', radnoVrijemeDo: wp.radnoVrijemeDo || '', additionalInfo: wp.opis || '' });
                                                            if (data) { const existing = sistematizacije.find(s => s.radnoMjestoId === wp.id); if (existing) { update(COLLECTIONS.SISTEMATIZACIJE, existing.id, { ...data, radnoMjestoId: wp.id, aiGenerated: true }); } else { create(COLLECTIONS.SISTEMATIZACIJE, { ...data, radnoMjestoId: wp.id, aiGenerated: true }); } loadData(); showFlash(); }
                                                            else { alert('AI greška: ' + error); }
                                                        } catch (err) { alert('Greška: ' + err.message); }
                                                        setSistAiLoading(false); setSistSelectedWp(null);
                                                    }} disabled={sistAiLoading && sistSelectedWp === wp.id} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.7rem' }}>
                                                        {sistAiLoading && sistSelectedWp === wp.id ? '⏳ Regeneriše...' : '🤖 Regeneriši'}
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: '0.7rem' }} onClick={async () => {
                                                        if (await confirm('Obrisati sistematizaciju za ovo radno mjesto?')) {
                                                            const s = sistematizacije.find(s => s.radnoMjestoId === wp.id);
                                                            if (s) { remove(COLLECTIONS.SISTEMATIZACIJE, s.id); loadData(); }
                                                        }
                                                    }}>✖</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10, padding: 8, textAlign: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                                                    Nema sistematizacije. Generiši putem AI ili popuni ručno.
                                                </div>
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    <button className="btn btn-outline btn-sm" onClick={async () => {
                                                        setSistAiLoading(true); setSistSelectedWp(wp.id);
                                                        try {
                                                            const { data, error } = await apiGenerateSistematizacija({ workplaceName: wp.naziv, oznaka: wp.oznaka || '', strucnaSprema: wp.strucnaSprema || '', industry: activeCompany.djelatnost || formData.djelatnost || '', companyName: activeCompany.naziv || formData.nazivTvrtke || '', numberOfWorkers: '', orgUnit: ou?.naziv || '', radnoVrijemeOd: wp.radnoVrijemeOd || '', radnoVrijemeDo: wp.radnoVrijemeDo || '', additionalInfo: wp.opis || '' });
                                                            if (data) { create(COLLECTIONS.SISTEMATIZACIJE, { ...data, radnoMjestoId: wp.id, aiGenerated: true }); loadData(); showFlash(); }
                                                            else { alert('AI greška: ' + error); }
                                                        } catch (err) { alert('Greška: ' + err.message); }
                                                        setSistAiLoading(false); setSistSelectedWp(null);
                                                    }} disabled={isLoading} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                                                        {isLoading ? '⏳ Generiše...' : '🤖 AI Generiši'}
                                                    </button>
                                                    <button className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem' }} onClick={() => setSistEditData({ radnoMjestoId: wp.id, nazivPosla: '', opisPoslova: '', odgovornosti: '', strucnaSprema: wp.strucnaSprema || '', radnoIskustvo: '', posebniUvjeti: [], brojIzvrsilaca: 1, kategorijaRM: '', slozenostPoslova: '', probniRad: '', pravniOsnov: getDefaultPravniOsnov(country), uvjetiRada: {}, potrebnaOZO: [], radnaOprema: [], zdravstveniZahtjevi: [], certifikati: [], potrebneObuke: [], napomena: '' })}>
                                                        ✏️ Ručno
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sistematizacija Detail/Edit Modal */}
                        {sistEditData && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
                                onClick={e => { if (e.target === e.currentTarget) setSistEditData(null); }}>
                                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, width: '90%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                                            📑 Sistematizacija — {workplaces.find(w => w.id === sistEditData.radnoMjestoId)?.naziv || ''}
                                        </div>
                                        <button className="btn btn-ghost btn-icon" onClick={() => setSistEditData(null)} style={{ fontSize: '1.2rem', padding: 4 }}>✕</button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                                        <div><div style={labelSt}>NAZIV POSLA</div><input className="form-input" value={sistEditData.nazivPosla || ''} onChange={e => setSistEditData(p => ({ ...p, nazivPosla: e.target.value }))} placeholder="npr. Stručni saradnik za ZNR" /></div>
                                        <div><div style={labelSt}>KATEGORIJA RM</div><select className="form-select" value={sistEditData.kategorijaRM || ''} onChange={e => setSistEditData(p => ({ ...p, kategorijaRM: e.target.value }))}><option value="">—</option>{['Rukovodeće', 'Izvršno', 'Pomoćno'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                        <div><div style={labelSt}>SLOŽENOST</div><select className="form-select" value={sistEditData.slozenostPoslova || ''} onChange={e => setSistEditData(p => ({ ...p, slozenostPoslova: e.target.value }))}><option value="">—</option>{['Jednostavni', 'Srednje složeni', 'Složeni', 'Visoko složeni'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                    </div>
                                    <div style={labelSt}>OPIS POSLOVA I ZADATAKA</div>
                                    <textarea className="form-input" rows={3} value={sistEditData.opisPoslova || ''} onChange={e => setSistEditData(p => ({ ...p, opisPoslova: e.target.value }))} style={{ resize: 'vertical', marginBottom: 12 }} />
                                    <div style={labelSt}>ODGOVORNOSTI</div>
                                    <textarea className="form-input" rows={2} value={sistEditData.odgovornosti || ''} onChange={e => setSistEditData(p => ({ ...p, odgovornosti: e.target.value }))} placeholder="Ključne odgovornosti" style={{ resize: 'vertical', marginBottom: 12 }} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1fr', gap: 10, marginBottom: 12 }}>
                                        <div><div style={labelSt}>STRUČNA SPREMA</div><select className="form-select" value={sistEditData.strucnaSprema || ''} onChange={e => setSistEditData(p => ({ ...p, strucnaSprema: e.target.value }))}><option value="">—</option>{['NKV', 'PKV', 'KV', 'SSS', 'VŠS', 'VSS', 'Mr.', 'Dr.'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                        <div><div style={labelSt}>RADNO ISKUSTVO</div><input className="form-input" value={sistEditData.radnoIskustvo || ''} onChange={e => setSistEditData(p => ({ ...p, radnoIskustvo: e.target.value }))} placeholder="npr. 2 godine" /></div>
                                        <div><div style={labelSt}>IZVRŠILACA</div><input className="form-input" type="number" min={1} value={sistEditData.brojIzvrsilaca || 1} onChange={e => setSistEditData(p => ({ ...p, brojIzvrsilaca: +e.target.value }))} /></div>
                                        <div><div style={labelSt}>PROBNI RAD</div><input className="form-input" value={sistEditData.probniRad || ''} onChange={e => setSistEditData(p => ({ ...p, probniRad: e.target.value }))} placeholder="npr. 3 mjeseca" /></div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                        <div><div style={labelSt}>POTREBNA OZO</div><textarea className="form-input" rows={2} value={(sistEditData.potrebnaOZO || []).join('\n')} onChange={e => setSistEditData(p => ({ ...p, potrebnaOZO: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} /></div>
                                        <div><div style={labelSt}>RADNA OPREMA</div><textarea className="form-input" rows={2} value={(sistEditData.radnaOprema || []).join('\n')} onChange={e => setSistEditData(p => ({ ...p, radnaOprema: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} /></div>
                                        <div><div style={labelSt}>ZDRAVSTVENI ZAHTJEVI</div><textarea className="form-input" rows={2} value={(sistEditData.zdravstveniZahtjevi || []).join('\n')} onChange={e => setSistEditData(p => ({ ...p, zdravstveniZahtjevi: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} /></div>
                                        <div><div style={labelSt}>POTREBNI CERTIFIKATI</div><textarea className="form-input" rows={2} value={(sistEditData.certifikati || []).join('\n')} onChange={e => setSistEditData(p => ({ ...p, certifikati: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} /></div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-primary" onClick={() => {
                                            const existing = sistematizacije.find(s => s.radnoMjestoId === sistEditData.radnoMjestoId);
                                            if (existing) { update(COLLECTIONS.SISTEMATIZACIJE, existing.id, sistEditData); }
                                            else { create(COLLECTIONS.SISTEMATIZACIJE, sistEditData); }
                                            loadData(); setSistEditData(null); showFlash();
                                        }}>💾 {t('save')}</button>
                                        <button className="btn btn-ghost" onClick={() => setSistEditData(null)}>Zatvori</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div></div>
                )}

                {/* ── TAB: Opis procesa ── */}
                {activeTab === 'opis' && (
                    <div className="card"><div className="card-body">
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>OPIS TEHNIČKO-TEHNOLOŠKOG PROCESA</div>
                        <textarea className="form-input" rows={8} value={formData.opisProcesa || ''} onChange={e => set('opisProcesa', e.target.value)}
                            placeholder="Opišite tehničko-tehnološki i radni proces, sredstva rada, opremu... Možete pisati ručno ili koristiti AI generisanje ispod." style={{ resize: 'vertical', marginBottom: 20 }} />
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>ANALIZA ORGANIZACIJE RADA</div>
                        <textarea className="form-input" rows={6} value={formData.analizaOrganizacije || ''} onChange={e => set('analizaOrganizacije', e.target.value)}
                            placeholder="Opišite organizaciju rada, smjene, posebne uvjete... Možete pisati ručno ili koristiti AI generisanje ispod." style={{ resize: 'vertical', marginBottom: 20 }} />

                        {/* ── AI Generation Section ── */}
                        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, background: 'rgba(102,126,234,0.06)', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: '1.1rem' }}>✨</span>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>AI Generisanje opisa</div>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
                                {(formData.opisProcesa || formData.analizaOrganizacije)
                                    ? '💡 Već ste napisali tekst u gornjim poljima. AI može proširiti i poboljšati vaš tekst, ili generisati potpuno novi opis iz podataka aplikacije.'
                                    : '💡 AI može generisati profesionalni opis na osnovu radnih mjesta, djelatnosti i opasnosti iz vaše aplikacije.'}
                            </div>
                            {/* Data source indicators */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 12, background: 'rgba(76,175,80,0.15)', color: '#4caf50', fontWeight: 600 }}>
                                    📋 Radna mjesta: {formData.radnoMjestoId ? (workplaces.find(w => w.id === formData.radnoMjestoId)?.naziv || '1') : `Sva (${workplaces.length})`}
                                </span>
                                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 12, background: 'rgba(255,193,7,0.15)', color: '#ffc107', fontWeight: 600 }}>
                                    ⚠️ Opasnosti: {hazards.length}
                                </span>
                                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 12, background: 'rgba(33,150,243,0.15)', color: '#2196f3', fontWeight: 600 }}>
                                    🏢 Djelatnost: {formData.djelatnost || 'Nije navedeno'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button className="btn btn-outline btn-sm" onClick={() => handleAiOpis('app')} disabled={aiOpisLoading}
                                    title="Generiši opis iz podataka aplikacije (radna mjesta, djelatnost, sistematizacija)"
                                    style={{ background: aiOpisLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                    {aiOpisLoading ? '⏳ Generišem...' : '🤖 Generiši iz podataka aplikacije'}
                                </button>
                                {(formData.opisProcesa || formData.analizaOrganizacije) && (
                                    <button className="btn btn-outline btn-sm" onClick={() => handleAiOpis('text')} disabled={aiOpisLoading}
                                        title="Proširi i poboljšaj tekst koji ste već napisali koristeći AI"
                                        style={{ background: aiOpisLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                        {aiOpisLoading ? '⏳ Generišem...' : '📝 Proširi moj tekst s AI'}
                                    </button>
                                )}
                                <button className="btn btn-outline btn-sm" onClick={() => setShowDocAiModal(true)}
                                    title="Automatski izvuci podatke o procesu, organizaciji i opasnostima iz priloženih word/pdf dokumenata (zapisnici, protokoli)"
                                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                    📄 AI Analiza dokumenata
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button className="btn btn-primary" title="Spasite sve dosadašnje promjene" onClick={handleSave}>💾 {t('save')}</button>
                            <SavedFlash />
                        </div>
                        
                        {/* ── Document AI Modal ── */}
                        {showDocAiModal && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
                                onClick={(e) => { if (e.target === e.currentTarget && !docAiLoading) setShowDocAiModal(false); }}>
                                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, minWidth: 600, maxWidth: 800, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8, color: 'var(--primary)' }}>🤖 AI Analiza dokumenata</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                                        Učitajte zapisnike, mjerne protokole, tehničke listove ili drugu dokumentaciju. AI će ih pročitati i pokušati automatski formulisati Opis procesa, Organizaciju rada, te prepoznati opasnosti.
                                    </div>
                                    
                                    {!docAiResult ? (
                                        <>
                                            <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: 30, textAlign: 'center', background: 'var(--bg-input)', cursor: 'pointer', marginBottom: 20 }}
                                                 onClick={() => document.getElementById('docAiUpload').click()}>
                                                <input type="file" id="docAiUpload" multiple accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }}
                                                    onChange={e => setDocAiFiles(Array.from(e.target.files))} />
                                                <div style={{ fontSize: '2rem', marginBottom: 10 }}>📎</div>
                                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                                                    {docAiFiles.length> 0 ? `${docAiFiles.length} dokument(a) spremno` : 'Klikni ili povuci dokumente ovdje (PDF, Word)'}
                                                </div>
                                                {docAiFiles.length> 0 && (
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                                        {docAiFiles.map(f => f.name).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                                <button className="btn btn-ghost" onClick={() => setShowDocAiModal(false)} disabled={docAiLoading}>{t('cancel')}</button>
                                                <button className="btn btn-primary" onClick={handleDocAiAnalyze} disabled={docAiFiles.length === 0 || docAiLoading}
                                                    style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', border: 'none' }}>
                                                    {docAiLoading ? '⏳ AI čita...' : '⚡ Analiziraj dokumente'}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ padding: 16, background: 'rgba(76,175,80,0.1)', border: '1px solid #4caf50', borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
                                                <div style={{ fontWeight: 700, color: '#4caf50', marginBottom: 12 }}>✅ Analiza završena! Pregledajte rezultate:</div>
                                                
                                                <div style={{ ...labelSt, marginTop: 10 }}>Generisani opis procesa</div>
                                                <textarea className="form-input" rows={4} value={docAiResult.opisProcesa || ''} 
                                                    onChange={e => setDocAiResult(prev => ({...prev, opisProcesa: e.target.value}))} 
                                                    style={{ width: '100%', marginBottom: 12, fontSize: '0.85rem' }} />
                                                    
                                                <div style={{ ...labelSt }}>Analiza organizacije</div>
                                                <textarea className="form-input" rows={2} value={docAiResult.analizaOrganizacije || ''} 
                                                    onChange={e => setDocAiResult(prev => ({...prev, analizaOrganizacije: e.target.value}))} 
                                                    style={{ width: '100%', marginBottom: 12, fontSize: '0.85rem' }} />
                                                
                                                {docAiResult.oprema && docAiResult.oprema.length> 0 && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <div style={{ ...labelSt }}>Predloženi strojevi/alati (Bit će dodani u opis)</div>
                                                        <div style={{ fontSize: '0.8rem', background: 'var(--bg-input)', padding: 8, borderRadius: 6 }}>
                                                            {docAiResult.oprema.join(', ')}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {docAiResult.opasnosti && docAiResult.opasnosti.length> 0 && (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <div style={{ ...labelSt }}>Predložene opasnosti ({docAiResult.opasnosti.length} - Bit će dodane u predloške)</div>
                                                        <div style={{ maxHeight: 100, overflow: 'auto', fontSize: '0.8rem', background: 'var(--bg-input)', padding: 8, borderRadius: 6 }}>
                                                            {docAiResult.opasnosti.map((op, i) => <div key={i}>⚠️ {op}</div>)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                                <button className="btn btn-ghost" onClick={() => { setDocAiResult(null); setDocAiFiles([]); }}>❌ Poništi</button>
                                                <button className="btn btn-primary" onClick={applyDocAiResults}
                                                    style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', border: 'none' }}>
                                                    ✔ Potvrdi i integriraj u procjenu
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div></div>
                )}

                {/* ── TAB: Procjena (5×5 Matrix + Risk Items) ── */}
                {activeTab === 'procjena' && (
                    <div>
                        {!editingId && <div className="card" style={{ marginBottom: 16 }}><div className="card-body" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>
                            ⚠️ {t('prvoSacuvajteProcjenuTabOpsti')}
                        </div></div>}
                        {editingId && <>
                            <div className="card" style={{ marginBottom: 16 }}><div className="card-body">
                                <RiskMatrix items={riskItems} onCellClick={(v, p) => { setRiForm(prev => ({ ...prev, vjerovatnoca: v, posljedica: p })); if (!showRiForm) handleNewRi(); setRiForm(prev => ({ ...prev, vjerovatnoca: v, posljedica: p })); }}
                                    selectedV={showRiForm ? riForm.vjerovatnoca : 0} selectedP={showRiForm ? riForm.posljedica : 0} />
                            </div></div>

                            <div className="card" style={{ marginBottom: 16 }}><div className="card-body">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 0 }}>STAVKE PROCJENE ({riskItems.length})</div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {selectedRiIds.size> 0 && (
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginRight: 8 }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{selectedRiIds.size} {t('odabrano')}:</span>
                                                <button className="btn btn-danger btn-sm" onClick={handleBulkDeleteRi}>🗑️ {t('obrisi')}</button>
                                            </div>
                                        )}
                                        <button className="btn btn-outline btn-sm" onClick={() => setShowImportModal(true)} title="Uvezite prepoznate opasnosti i nedostatke iz odgovora radnika na online upitnike"
                                            style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                            📋 Uvezi iz upitnika
                                        </button>
                                        <button className="btn btn-outline btn-sm" onClick={() => {
                                            // Auto-detect workplaces: if Cijela firma, pre-select all; otherwise just the selected one
                                            if (!formData.radnoMjestoId) {
                                                setAiGenSelectedWps(workplaces.map(w => w.id));
                                            } else {
                                                setAiGenSelectedWps([formData.radnoMjestoId]);
                                            }
                                            setAiGenCustomWp('');
                                            setAiGenJobTitle('');
                                            setShowAiGenTableModal(true);
                                        }} title="Zia AI Automatski izrađuje tabelu rizika za odabrana radna mjesta sukladno normama"
                                            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                            ✨ Autoizradi s AI
                                        </button>
                                        <button className="btn btn-outline btn-sm" onClick={() => { setShowBulkModal(true); setBulkSelected([]); setBulkWpId(''); }} title="Brzo dodajte više gotovih rizika odjednom iz glavnog centralnog kataloga opasnosti"
                                            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                            ⚠️ Dodaj iz kataloga
                                        </button>
                                        <button className="btn btn-outline btn-sm" title="Ručno popunite formu i napravite procjenu za jedan pojedinačni rizik" onClick={handleNewRi}>+ {t('dodajStavku')}</button>
                                    </div>
                                </div>

                                {showAiGenTableModal && (
                                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
                                         onClick={(e) => { if (e.target === e.currentTarget && !aiGenLoading) setShowAiGenTableModal(false); }}>
                                        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, minWidth: 500, maxWidth: 650, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 8, color: 'var(--primary)' }}>✨ AI Generisanje Tabele Rizika</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                                                Zia AI će analizirati odabrana radna mjesta i kreirati standardne (8-15) opasnosti po radnom mjestu, zajedno sa standardiziranom procjenom posljedica, vjerovatnoće i listom mjera prevencije.
                                            </div>

                                            {/* Workplace selection from app data */}
                                            {workplaces.length> 0 && (
                                                <div style={{ marginBottom: 16 }}>
                                                    <div style={{ ...labelSt, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span>Radna mjesta iz aplikacije ({workplaces.length})</span>
                                                        <button style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
                                                            onClick={() => {
                                                                if (aiGenSelectedWps.length === workplaces.length) setAiGenSelectedWps([]);
                                                                else setAiGenSelectedWps(workplaces.map(w => w.id));
                                                            }}>
                                                            {aiGenSelectedWps.length === workplaces.length ? 'Odznači sve' : 'Označi sve'}
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                                        {workplaces.map(wp => {
                                                            const isSelected = aiGenSelectedWps.includes(wp.id);
                                                            const wpWorkers = workers.filter(w => w.radnoMjestoId === wp.id).length;
                                                            return (
                                                                <button key={wp.id} onClick={() => {
                                                                    if (isSelected) setAiGenSelectedWps(prev => prev.filter(id => id !== wp.id));
                                                                    else setAiGenSelectedWps(prev => [...prev, wp.id]);
                                                                }}
                                                                    disabled={aiGenLoading}
                                                                    style={{
                                                                        padding: '6px 12px', borderRadius: 16, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                                                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                                        background: isSelected ? 'rgba(102,126,234,0.15)' : 'var(--bg-input)',
                                                                        color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                                                                        transition: 'all 0.15s ease',
                                                                    }}>
                                                                    {isSelected ? '✓ ' : ''}{wp.naziv}
                                                                    {wpWorkers> 0 && <span style={{ marginLeft: 4, opacity: 0.6, fontSize: '0.7rem' }}>({wpWorkers}👤)</span>}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Custom workplace input */}
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={labelSt}>Dodaj vlastito radno mjesto (opciono)</div>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <input className="form-input" value={aiGenCustomWp} onChange={e => setAiGenCustomWp(e.target.value)}
                                                        placeholder="Npr. Zavarivač, Monter, Čistačica..." disabled={aiGenLoading}
                                                        style={{ flex: 1 }} />
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                    💡 Ako radno mjesto ne postoji u aplikaciji, možete ga upisati ručno.
                                                </div>
                                            </div>

                                            {/* Summary */}
                                            {(() => {
                                                const allSelected = aiGenSelectedWps.map(id => workplaces.find(w => w.id === id)?.naziv || '').filter(Boolean);
                                                if (aiGenCustomWp.trim()) allSelected.push(aiGenCustomWp.trim());
                                                const uniqueNames = new Set(allSelected.map(n => n.trim().toLowerCase()));
                                                const totalSelected = allSelected.length;
                                                const uniqueCount = uniqueNames.size;
                                                const hasDuplicates = totalSelected> uniqueCount;
                                                return (
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: 'rgba(102,126,234,0.06)', border: '1px solid var(--border)' }}>
                                                        📊 Generisat će se procjena za <strong style={{ color: 'var(--primary)' }}>{uniqueCount}</strong> jedinstveno/a radno/a mjesto/a
                                                        {uniqueCount> 0 && (
                                                            <span> — oko {uniqueCount * 10} stavki ukupno</span>
                                                        )}
                                                        {hasDuplicates && (
                                                            <div style={{ marginTop: 4, fontSize: '0.72rem', color: 'var(--warning)' }}>
                                                                ⚠️ {totalSelected - uniqueCount} duplikat(a) preskočeno — ista radna mjesta se procjenjuju samo jednom.
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                                <button className="btn btn-ghost" onClick={() => setShowAiGenTableModal(false)} disabled={aiGenLoading}>{t('cancel')}</button>
                                                <button className="btn btn-primary" onClick={handleAiGenerateTableSubmit}
                                                    disabled={(aiGenSelectedWps.length === 0 && !aiGenCustomWp.trim() && !aiGenJobTitle.trim()) || aiGenLoading}
                                                        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
                                                    {aiGenLoading ? '⏳ Generišem tabelu...' : '⚡ Generiši Tabelu'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(() => {
                                    const riFormContent = (
                                        <div style={{ padding: 16, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary)', marginBottom: 16 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                                <div><div style={labelSt}>Radno mjesto</div>
                                                    <select className="form-select" value={riForm.radnoMjestoId || ''} onChange={e => setRi('radnoMjestoId', e.target.value)}>
                                                        <option value="">— Odaberi —</option>
                                                        {workplaces.map(w => <option key={w.id} value={w.id}>{w.naziv}</option>)}
                                                    </select>
                                                </div>
                                                <div><div style={labelSt}>Opasnost / Štetnost</div>
                                                    <select className="form-select" value={riForm.opasnostId || ''} onChange={e => setRi('opasnostId', e.target.value)}>
                                                        <option value="">— Odaberi —</option>
                                                        {hazards.map(h => <option key={h.id} value={h.id}>{h.oznaka ? `${h.oznaka} — ` : ''}{h.naziv}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* ── Sistematizacija + Equipment Context Panel ── */}
                                            {riForm.radnoMjestoId && (selectedWpSist || selectedWpEquipment.length> 0) && (
                                                <div style={{ gridColumn: '1 / -1', padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.2)', marginBottom: 4 }}>
                                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 8 }}>📑 Kontekst radnog mjesta</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {selectedWpSist?.potrebnaOZO?.map((ozo, i) => (
                                                            <span key={`ozo-${i}`} onClick={() => setRi('opisOpasnosti', (riForm.opisOpasnosti ? riForm.opisOpasnosti + ', ' : '') + ozo)}
                                                                style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(0,191,166,0.15)', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                                                                title="Klikni da dodaš u opis">🦺 {ozo}</span>
                                                        ))}
                                                        {selectedWpSist?.radnaOprema?.map((op, i) => (
                                                            <span key={`rop-${i}`} onClick={() => setRi('opisOpasnosti', (riForm.opisOpasnosti ? riForm.opisOpasnosti + ', ' : '') + op)}
                                                                style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(102,126,234,0.15)', color: '#667eea', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                                title="Klikni da dodaš u opis">⚙️ {op}</span>
                                                        ))}
                                                        {selectedWpEquipment.map(eq => (
                                                            <span key={eq.id} onClick={() => setRi('opisOpasnosti', (riForm.opisOpasnosti ? riForm.opisOpasnosti + ', ' : '') + eq.naziv)}
                                                                style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(96,125,139,0.15)', color: '#607d8b', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                                                                title="Klikni da dodaš u opis">🏗️ {eq.naziv}</span>
                                                        ))}
                                                        {selectedWpSist?.posebniUvjeti?.map((pu, i) => (
                                                            <span key={`pu-${i}`} style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(244,67,54,0.12)', color: '#f44336', fontSize: '0.7rem', fontWeight: 600 }}>⚠️ {pu}</span>
                                                        ))}
                                                        {selectedWpSist?.zdravstveniZahtjevi?.map((zz, i) => (
                                                            <span key={`zz-${i}`} style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(233,30,99,0.12)', color: '#e91e63', fontSize: '0.7rem', fontWeight: 600 }}>🏥 {zz}</span>
                                                        ))}
                                                        {Object.entries(selectedWpSist?.uvjetiRada || {}).flatMap(([cat, items]) =>
                                                            (items || []).map((item, i) => (
                                                                <span key={`ur-${cat}-${i}`} style={{ padding: '3px 10px', borderRadius: 12, background: 'rgba(255,152,0,0.12)', color: '#ff9800', fontSize: '0.7rem', fontWeight: 600 }}>🔶 {item}</span>
                                                            ))
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 6 }}>💡 Kliknite na stavku da je dodate u opis opasnosti</div>
                                                </div>
                                            )}

                                            <div style={{ marginBottom: 12 }}><div style={labelSt}>Opis opasnosti na radnom mjestu</div>
                                                <input className="form-input" value={riForm.opisOpasnosti || ''} onChange={e => setRi('opisOpasnosti', e.target.value)} placeholder="Kratak opis specifične opasnosti..." />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12, marginBottom: 12 }}>
                                                <div><div style={labelSt}>Vjerovatnoća (V) 1–5<HelpTip text="Koliko je vjerovatno da će se opasnost dogoditi? 1 = Zanemarivo (gotovo nemoguće), 3 = Moguće, 5 = Gotovo sigurno da će se desiti." /></div>
                                                    <select className="form-select" value={riForm.vjerovatnoca || 0} onChange={e => setRi('vjerovatnoca', +e.target.value)}>
                                                        <option value={0}>—</option>
                                                        {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} — {V_LABELS[v]}</option>)}
                                                    </select>
                                                </div>
                                                <div><div style={labelSt}>Posljedica (P) 1–5<HelpTip text="Kolika bi bila šteta ako se opasnost dogodi? 1 = Zanemarivo (bez povrede), 3 = Značajno oštećenje zdravlja, 5 = Smrtni ishod." /></div>
                                                    <select className="form-select" value={riForm.posljedica || 0} onChange={e => setRi('posljedica', +e.target.value)}>
                                                        <option value={0}>—</option>
                                                        {[1,2,3,4,5].map(p => <option key={p} value={p}>{p} — {P_LABELS[p]}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <div style={labelSt}>Rizik (R=V×P)</div>
                                                    {riForm.vjerovatnoca> 0 && riForm.posljedica> 0 ? (() => {
                                                        const sc = riForm.vjerovatnoca * riForm.posljedica;
                                                        const rl = riskLevel(sc);
                                                        return <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: rl.bg, color: rl.color, fontWeight: 700, fontSize: '1rem', textAlign: 'center', border: `2px solid ${rl.color}` }}>{sc} — {rl.label}</div>;
                                                    })() : <div className="form-input" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</div>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <input type="file" accept=".pdf,.doc,.docx" id="aiDocInput" style={{ display: 'none' }} onChange={e => setAiDocument(e.target.files[0] || null)} />
                                                <button className="btn btn-outline btn-sm" onClick={() => document.getElementById('aiDocInput').click()} disabled={aiLoading}
                                                    style={{ borderColor: aiDocument ? '#11998e' : 'var(--border)', color: aiDocument ? '#11998e' : 'var(--text)', background: aiDocument ? 'rgba(17,153,142,0.1)' : 'transparent', fontWeight: 600 }}>
                                                    📎 {aiDocument ? aiDocument.name : 'Priloži dokument (PDF/Word)'}
                                                </button>
                                                <button className="btn btn-outline btn-sm" onClick={handleAiSuggest} disabled={aiLoading}
                                                    style={{ background: aiLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                                    {aiLoading ? '⏳ AI analizira...' : '🤖 AI Predloži mjere'}
                                                </button>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI u obzir uzima i priloženi dokument</span>
                                                {aiDocument && <button className="btn btn-ghost btn-sm" onClick={() => { setAiDocument(null); document.getElementById('aiDocInput').value = ''; }} style={{ color: 'var(--danger)', padding: '0 4px', fontSize: '1rem' }} title="Ukloni dokument">✖</button>}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                                <div><div style={labelSt}>Postojeće mjere</div><textarea className="form-input" rows={2} value={riForm.postojeceMjere || ''} onChange={e => setRi('postojeceMjere', e.target.value)} style={{ resize: 'vertical' }} /></div>
                                                <div><div style={labelSt}>Predložene mjere</div><textarea className="form-input" rows={2} value={riForm.predlozeneMjere || ''} onChange={e => setRi('predlozeneMjere', e.target.value)} style={{ resize: 'vertical' }} /></div>
                                            </div>
                                            <div style={{ ...labelSt, fontSize: '0.78rem', color: '#667eea', marginBottom: 10, marginTop: 6 }}>PREOSTALI RIZIK (NAKON MJERA)</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12, marginBottom: 12 }}>
                                                <div><div style={labelSt}>V nakon mjera (1–5)</div>
                                                    <select className="form-select" value={riForm.vjerovatnocaNakon || 0} onChange={e => setRi('vjerovatnocaNakon', +e.target.value)}>
                                                        <option value={0}>—</option>
                                                        {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} — {V_LABELS[v]}</option>)}
                                                    </select>
                                                </div>
                                                <div><div style={labelSt}>P nakon mjera (1–5)</div>
                                                    <select className="form-select" value={riForm.posljedlicaNakon || 0} onChange={e => setRi('posljedlicaNakon', +e.target.value)}>
                                                        <option value={0}>—</option>
                                                        {[1,2,3,4,5].map(p => <option key={p} value={p}>{p} — {P_LABELS[p]}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <div style={labelSt}>R nakon</div>
                                                    {riForm.vjerovatnocaNakon> 0 && riForm.posljedlicaNakon> 0 ? (() => {
                                                        const sc2 = riForm.vjerovatnocaNakon * riForm.posljedlicaNakon;
                                                        const rl2 = riskLevel(sc2);
                                                        return <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: rl2.bg, color: rl2.color, fontWeight: 700, fontSize: '1rem', textAlign: 'center', border: `2px solid ${rl2.color}` }}>{sc2} — {rl2.label}</div>;
                                                    })() : <div className="form-input" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</div>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12, marginBottom: 12 }}>
                                                <div><div style={labelSt}>Odgovorna osoba</div><input className="form-input" value={riForm.odgovornaOsoba || ''} onChange={e => setRi('odgovornaOsoba', e.target.value)} /></div>
                                                <div><div style={labelSt}>Rok provedbe</div><DateInput value={riForm.rokProvedbe || ''} onChange={v => setRi('rokProvedbe', v)} /></div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button className="btn btn-primary btn-sm" onClick={handleSaveRi}>✔ {t('save')}</button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => { setShowRiForm(false); setLastEditedRiId(riEditId); setRiEditId(null); }}>✖ {t('cancel')}</button>
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <>
                                            {showRiForm && !riEditId && riFormContent}

                                            {riSorted.length === 0 && !showRiForm && <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>{t('nemaStavkiKlikniteNaMatricu')}</div>}
                                            {riSorted.length> 0 && (
                                                <div className="data-table-wrapper"><table className="data-table"><thead><tr>
                                                    <th style={{ width: 85, paddingLeft: 8 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <input type="checkbox" checked={selectedRiIds.size === riSorted.length && riSorted.length> 0} onChange={() => {
                                                                if (selectedRiIds.size === riSorted.length) setSelectedRiIds(new Set());
                                                                else setSelectedRiIds(new Set(riSorted.map(ri => ri.id)));
                                                            }} style={{ cursor: 'pointer', accentColor: 'var(--primary)', width: 16, height: 16 }} title="Označi sve" />
                                                        </div>
                                                    </th><th>Radno mjesto</th><th>Opasnost</th>
                                                    <th style={{ width: 50, textAlign: 'center' }}>V</th><th style={{ width: 50, textAlign: 'center' }}>P</th>
                                                    <th style={{ width: 50, textAlign: 'center' }}>R₀</th><th>Prije</th>
                                                    <th style={{ width: 50, textAlign: 'center' }}>R₁</th><th>Nakon</th><th style={{ width: 40 }}></th>
                                                </tr></thead>
                                                {riSorted.map(ri => {
                                                    const rl = riskLevel(ri.rizik || 0);
                                                    const rlA = ri.rizikNakon> 0 ? riskLevel(ri.rizikNakon) : null;
                                                    const wp = workplaces.find(w => w.id === ri.radnoMjestoId);
                                                    const hz = hazards.find(h => h.id === ri.opasnostId);
                                                    const improved = rlA && ri.rizikNakon < ri.rizik;
                                                    return (
                                                        <tbody key={ri.id}>
                                                            <tr onClick={() => handleEditRi(ri)} style={{ ...(showRiForm && riEditId === ri.id ? { background: 'var(--bg-input)' } : lastEditedRiId === ri.id ? { background: 'rgba(102,126,234,0.15)', transition: 'background 0.5s ease' } : {}), cursor: 'pointer' }}>
                                                                <td onClick={(e) => e.stopPropagation()} style={{ paddingLeft: 8 }}><div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                                    <input type="checkbox" checked={selectedRiIds.has(ri.id)} onChange={() => {
                                                                        const next = new Set(selectedRiIds);
                                                                        if (next.has(ri.id)) next.delete(ri.id); else next.add(ri.id);
                                                                        setSelectedRiIds(next);
                                                                    }} style={{ cursor: 'pointer', accentColor: 'var(--primary)', width: 15, height: 15 }} />
                                                                    <button className="btn btn-ghost btn-sm" title={t('urediStavku')} onClick={(e) => { e.stopPropagation(); handleEditRi(ri); }}>✏️</button>
                                                                    <button className="btn btn-ghost btn-sm" title={t('obrisiStavku1')} style={{ color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); handleDeleteRi(ri.id); }}>🗑️</button>
                                                                </div></td>
                                                                <td style={{ fontSize: '0.82rem' }}>{wp?.naziv || '—'}</td>
                                                                <td style={{ fontSize: '0.82rem' }}>
                                                                    {hz ? `${hz.oznaka || ''} ${hz.naziv}` : (ri.opisOpasnosti || '—')}
                                                                    {ri.aiGenerated && !ri.source && <span style={{ marginLeft: 6, fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(102,126,234,0.15)', color: '#667eea', borderRadius: 10, fontWeight: 600 }}>✨ AI</span>}
                                                                    {ri.source === 'questionnaire' && <span style={{ marginLeft: 6, fontSize: '0.65rem', padding: '2px 6px', background: 'rgba(255,152,0,0.15)', color: '#ff9800', borderRadius: 10, fontWeight: 600 }}>📝 Upitnik AI</span>}
                                                                </td>
                                                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{ri.vjerovatnoca}</td>
                                                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{ri.posljedica}</td>
                                                                <td style={{ textAlign: 'center', fontWeight: 800, color: rl.color }}>{ri.rizik}</td>
                                                                <td><span style={{ padding: '3px 8px', borderRadius: 12, background: rl.bg, color: rl.color, fontWeight: 700, fontSize: '0.7rem' }}>{rl.label}</span></td>
                                                                <td style={{ textAlign: 'center', fontWeight: 800, color: rlA?.color || 'var(--text-muted)' }}>{ri.rizikNakon || '—'}</td>
                                                                <td>{rlA ? <span style={{ padding: '3px 8px', borderRadius: 12, background: rlA.bg, color: rlA.color, fontWeight: 700, fontSize: '0.7rem' }}>{rlA.label}</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>}</td>
                                                                <td>{improved && <span style={{ color: '#4caf50', fontWeight: 800 }}>↓</span>}</td>
                                                            </tr>
                                                            {showRiForm && riEditId === ri.id && (
                                                                <tr>
                                                                    <td colSpan={10} style={{ padding: 0, borderTop: 'none' }}>
                                                                        <div style={{ padding: '0 12px 16px 12px', borderLeft: '4px solid var(--primary)', background: 'var(--bg-input)' }}>
                                                                            {riFormContent}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    );
                                                })}
                                                </table></div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div></div>
                        </>}

                        {/* Import from Questionnaire Modal */}
                        {showImportModal && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
                                onClick={(e) => { if (e.target === e.currentTarget) setShowImportModal(false); }}>
                                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, minWidth: 450, maxWidth: 600, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>📋 Uvezi stavke iz upitnika</div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                                        AI će analizirati odgovore iz upitnika i automatski kreirati stavke procjene rizika sa V×P ocjenama i predloženim mjerama.
                                    </div>
                                    {questionnaires.length === 0 ? (
                                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                                            Nema upitnika označenih za procjenu rizika. Kreirajte upitnik u modulu Upitnici i označite &quot;Dodaje se u procjenu rizika&quot;.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                            {questionnaires.map(q => {
                                                const wp = workplaces.find(w => w.id === q.radnoMjestoId);
                                                const sist = sistematizacije.find(s => s.radnoMjestoId === q.radnoMjestoId);
                                                // Parse surveyJson to count questions
                                                let qCount = 0;
                                                try {
                                                    const sj = typeof q.surveyJson === 'string' ? JSON.parse(q.surveyJson || '{}') : (q.surveyJson || {});
                                                    if (sj.questions) qCount = sj.questions.filter(qq => qq.type !== 'heading').length;
                                                    else if (sj.pages) qCount = sj.pages.reduce((s, p) => s + (p.elements?.length || 0), 0);
                                                } catch { /* ignore */ }
                                                const rCount = responseCounts[q.id] || 0;
                                                return (
                                                    <div key={q.id} style={{ padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--bg-input)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{q.naziv || 'Bez naziva'}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                {wp ? `🏢 ${wp.naziv}` : ''} • {qCount} pitanja • {rCount} odgovora
                                                                {q.aiGenerated && <span style={{ color: '#667eea', marginLeft: 6 }}>🤖 AI</span>}
                                                                {sist && <span style={{ color: '#11998e', marginLeft: 6 }}>📑 Sistematizacija</span>}
                                                            </div>
                                                        </div>
                                                        <button 
                                                            className={`btn btn-sm ${importedIds.has(q.id) ? 'btn-outline' : 'btn-primary'}`} 
                                                            onClick={() => handleImportFromQuestionnaire(q)} 
                                                            disabled={importLoadingId !== null || importedIds.has(q.id)}
                                                            style={{ minWidth: 90 }}>
                                                            {importLoadingId === q.id ? '⏳ Uvozim...' : importedIds.has(q.id) ? '✔ Uvezeno' : '↓ Uvezi'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <button className="btn btn-ghost" onClick={() => setShowImportModal(false)} disabled={importLoadingId !== null}>Zatvori</button>
                                </div>
                            </div>
                        )}

                        {/* Bulk Add Hazards Modal */}
                        {showBulkModal && (
                            <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
                                onClick={(e) => { if (e.target === e.currentTarget) setShowBulkModal(false); }}>
                                <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, minWidth: 500, maxWidth: 650, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>⚠️ Dodaj opasnosti iz kataloga</div>
                                    <div style={{ marginBottom: 14 }}>
                                        <div style={{ ...labelSt, marginBottom: 6 }}>RADNO MJESTO</div>
                                        <select className="form-select" value={bulkWpId} onChange={e => setBulkWpId(e.target.value)}>
                                            <option value="">— Odaberi radno mjesto —</option>
                                            {workplaces.map(w => <option key={w.id} value={w.id}>{w.naziv}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ marginBottom: 14 }}>
                                        <div style={{ ...labelSt, marginBottom: 6 }}>OPASNOSTI ({bulkSelected.length} odabrano)</div>
                                        <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 8 }}>
                                            {hazards.length === 0 ? (
                                                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>Nema opasnosti u katalogu. Kreirajte ih na stranici "Opasnosti".</div>
                                            ) : hazards.map(h => {
                                                const checked = bulkSelected.includes(h.id);
                                                return (
                                                    <label key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: checked ? 'rgba(0,191,166,0.08)' : 'transparent', transition: 'background 0.15s' }}>
                                                        <input type="checkbox" checked={checked} onChange={() => setBulkSelected(prev => checked ? prev.filter(id => id !== h.id) : [...prev, h.id])} />
                                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{h.oznaka ? <span style={{ color: '#667eea', marginRight: 6 }}>{h.oznaka}</span> : null}{h.naziv}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setBulkSelected(hazards.map(h => h.id))}>Odaberi sve</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => setBulkSelected([])}>Poništi</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-primary" onClick={handleBulkAdd} disabled={!bulkWpId || bulkSelected.length === 0}>
                                            ✔ Dodaj {bulkSelected.length} stavk{bulkSelected.length === 1 ? 'u' : bulkSelected.length < 5 ? 'e' : 'i'}
                                        </button>
                                        <button className="btn btn-ghost" onClick={() => setShowBulkModal(false)}>Zatvori</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: Mjere ── */}
                {activeTab === 'mjere' && (() => {
                    // ── Cell-click edit modal ──
                    const editCellStyle = {
                        cursor: 'pointer', borderRadius: 6, padding: '4px 6px',
                        transition: 'background 0.15s',
                    };
                    const MjeraCell = ({ ri, field, label, type = 'textarea', display }) => (
                        <div
                            title={`Klikni za uređivanje: ${label}`}
                            onClick={() => setMjeraEdit({ riId: ri.id, field, label, value: ri[field] || '', type })}
                            style={{
                                ...editCellStyle,
                                minHeight: 32,
                                position: 'relative',
                            }}
                            className="mjera-cell">
                            {display || (
                                ri[field]
                                    ? <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ri[field]}</span>
                                    : <span style={{ color: field === 'predlozeneMjere' ? 'rgba(244,67,54,0.7)' : 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                                        {field === 'predlozeneMjere' ? '⚠ Nije definirano' : '—'}
                                      </span>
                            )}
                            <span className="mjera-cell-edit-hint" style={{ position: 'absolute', top: -4, right: -4, fontSize: '0.7rem', opacity: 0, background: 'var(--bg-card)', border: '1px solid var(--primary)', padding: '2px 4px', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.15)', transition: 'all 0.15s', pointerEvents: 'none', zIndex: 10 }}>✏️</span>
                        </div>
                    );
                    return (
                        <div className="card"><div className="card-body">
                            <style>{`.mjera-cell:hover { background: var(--bg-input) !important; } .mjera-cell:hover .mjera-cell-edit-hint { opacity: 1 !important; }`}</style>
                            <datalist id="workers-list">
                                {workers.map(w => <option key={w.id} value={`${w.ime} ${w.prezime}`} />)}
                            </datalist>

                            {/* ── Edit Modal ── */}
                            {mjeraEdit && (() => {
                                const ri = riskItems.find(r => r.id === mjeraEdit.riId);
                                return (
                                    <div
                                        onClick={(e) => { if (e.target === e.currentTarget) setMjeraEdit(null); }}
                                        style={{
                                            position: 'fixed', inset: 0, zIndex: 1100,
                                            background: 'rgba(0,0,0,0.55)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            backdropFilter: 'blur(2px)',
                                        }}>
                                        <div style={{
                                            background: 'var(--bg-card)', borderRadius: 16,
                                            padding: 28, width: '90%', maxWidth: 560,
                                            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
                                            border: '1px solid var(--border)',
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>✏️ {mjeraEdit.label}</div>
                                                <button onClick={() => setMjeraEdit(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
                                            </div>
                                            {mjeraEdit.type === 'select' ? (
                                                <select
                                                    className="form-select"
                                                    autoFocus
                                                    style={{ width: '100%', marginBottom: 20 }}
                                                    value={mjeraEdit.value}
                                                    onChange={e => setMjeraEdit(prev => ({ ...prev, value: e.target.value }))}>
                                                    <option value="">— Odaberi radno mjesto —</option>
                                                    {workplaces.map(w => <option key={w.id} value={w.id}>{w.naziv}</option>)}
                                                </select>
                                            ) : (
                                                <textarea
                                                    className="form-input"
                                                    autoFocus
                                                    rows={mjeraEdit.type === 'long' ? 8 : 4}
                                                    style={{ width: '100%', marginBottom: 20, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                                                    value={mjeraEdit.value}
                                                    onChange={e => setMjeraEdit(prev => ({ ...prev, value: e.target.value }))}
                                                    placeholder={`Unesite ${mjeraEdit.label.toLowerCase()}...`}
                                                />
                                            )}
                                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                                <button className="btn" onClick={() => setMjeraEdit(null)}
                                                    style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{t('cancel')}</button>
                                                <button className="btn btn-primary" onClick={() => {
                                                    handleInlineRiUpdate(mjeraEdit.riId, mjeraEdit.field, mjeraEdit.value);
                                                    setMjeraEdit(null);
                                                }}>💾 {t('save')}</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 0 }}>MJERE ZA SMANJENJE RIZIKA (Stavke sa R ≥ 6)</div>
                                {highRisk.length> 0 && (
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('dodijeliSvima')}</div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <input
                                                id="bulkOdgovornaOsoba"
                                                className="form-input"
                                                style={{ fontSize: '0.75rem', padding: '4px 8px', width: 160 }}
                                                list="workers-list"
                                                placeholder={t('odgovornaOsoba')}
                                            />
                                            <button className="btn btn-outline btn-sm" onClick={() => {
                                                const val = document.getElementById('bulkOdgovornaOsoba').value;
                                                if (val) {
                                                    setRiskItems(prev => prev.map(ri => ri.rizik>= 6 ? { ...ri, odgovornaOsoba: val } : ri));
                                                    markDirty();
                                                    document.getElementById('bulkOdgovornaOsoba').value = '';
                                                }
                                            }} style={{ padding: '4px 10px', height: 'auto', minHeight: 'auto' }}>
                                                {t('primijeni')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {highRisk.length === 0
                                ? <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>{t('nemaStavkiSaRizikom6')}</div>
                                : <div className="data-table-wrapper"><table className="data-table"><thead><tr>
                                    <th style={{ width: 48 }}>R₀</th>
                                    <th style={{ width: 48 }}>R₁</th>
                                    <th>Opasnost</th>
                                    <th>Radno mjesto</th>
                                    <th>Postojeće mjere</th>
                                    <th>Predložene mjere</th>
                                    <th>Odgovorna osoba</th>
                                    <th>Rok</th>
                                </tr></thead><tbody>
                                    {highRisk.sort((a, b) => b.rizik - a.rizik).map(ri => {
                                        const rl = riskLevel(ri.rizik);
                                        const rlA = ri.rizikNakon> 0 ? riskLevel(ri.rizikNakon) : null;
                                        const hp = hazards.find(h => h.id === ri.opasnostId);
                                        const wp = workplaces.find(w => w.id === ri.radnoMjestoId);
                                        return <tr key={ri.id}>
                                            {/* R₀ */}
                                            <td><span style={{ padding: '3px 10px', borderRadius: 12, background: rl.bg, color: rl.color, fontWeight: 800, fontSize: '0.78rem' }}>{ri.rizik}</span></td>
                                            {/* R₁ */}
                                            <td>{rlA ? <span style={{ padding: '3px 10px', borderRadius: 12, background: rlA.bg, color: rlA.color, fontWeight: 800, fontSize: '0.78rem' }}>{ri.rizikNakon}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                            {/* OPASNOST — click to edit */}
                                            <td style={{ fontSize: '0.82rem', maxWidth: 220 }}>
                                                <MjeraCell ri={ri} field="opisOpasnosti" label="Opasnost" type="textarea"
                                                    display={<>
                                                        {hp && <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>📋 {hp.oznaka ? `${hp.oznaka} ` : ''}{hp.naziv}</div>}
                                                        {ri.opisOpasnosti
                                                            ? <span>{ri.opisOpasnosti}</span>
                                                            : (hp ? null : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>—</span>)
                                                        }
                                                    </>}
                                                />
                                            </td>
                                            {/* RADNO MJESTO — click to edit */}
                                            <td style={{ fontSize: '0.82rem', maxWidth: 160 }}>
                                                <MjeraCell ri={ri} field="radnoMjestoId" label="Radno mjesto" type="select"
                                                    display={wp
                                                        ? <span>{wp.naziv}</span>
                                                        : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>—</span>
                                                    }
                                                />
                                            </td>
                                            {/* POSTOJEĆE MJERE — click to edit */}
                                            <td style={{ fontSize: '0.82rem', maxWidth: 200 }}>
                                                <MjeraCell ri={ri} field="postojeceMjere" label="Postojeće mjere" type="long" />
                                            </td>
                                            {/* PREDLOŽENE MJERE — click to edit */}
                                            <td style={{ fontSize: '0.82rem', maxWidth: 200 }}>
                                                <MjeraCell ri={ri} field="predlozeneMjere" label="Predložene mjere" type="long" />
                                            </td>
                                            {/* ODGOVORNA OSOBA — stays inline */}
                                            <td style={{ fontSize: '0.82rem' }}>
                                                <input
                                                    className="form-input"
                                                    style={{ fontSize: '0.75rem', padding: '4px 8px', width: '100%', minWidth: 130 }}
                                                    list="workers-list"
                                                    value={ri.odgovornaOsoba || ''}
                                                    onChange={(e) => handleInlineRiUpdate(ri.id, 'odgovornaOsoba', e.target.value)}
                                                    placeholder="Odaberi ili upiši..."
                                                />
                                            </td>
                                            {/* ROK — stays inline */}
                                            <td style={{ fontSize: '0.82rem' }}>
                                                <DateInput
                                                    value={ri.rokProvedbe || ''}
                                                    onChange={(v) => handleInlineRiUpdate(ri.id, 'rokProvedbe', v)}
                                                />
                                            </td>
                                        </tr>;
                                    })}
                                </tbody></table></div>
                            }
                        </div></div>
                    );
                })()}

                {/* ── TAB: Zaključak ── */}
                {activeTab === 'zakljucak' && (() => {
                    const itemsWithScores = riskItems.filter(ri => ri.rizik> 0);
                    const avgBefore = itemsWithScores.length> 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
                    const itemsWithAfter = riskItems.filter(ri => ri.rizikNakon> 0);
                    const avgAfter = itemsWithAfter.length> 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;
                    const gradeBefore = avgBefore> 0 ? riskLevel(Math.round(avgBefore)) : null;
                    const gradeAfter = avgAfter> 0 ? riskLevel(Math.round(avgAfter)) : null;
                    const bandsAfter = { neznatan: 0, dopustiv: 0, umjeren: 0, znatan: 0, nedopustiv: 0 };
                    itemsWithAfter.forEach(ri => {
                        const s = ri.rizikNakon || 0;
                        if (s <= 5) bandsAfter.neznatan++; else if (s <= 10) bandsAfter.dopustiv++; else if (s <= 15) bandsAfter.umjeren++;
                        else if (s <= 20) bandsAfter.znatan++; else bandsAfter.nedopustiv++;
                    });
                    return (
                    <div className="card"><div className="card-body">
                        {/* ── Overall Grade ── */}
                        {riskItems.length> 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>UKUPNA OCJENA RIZIKA</div>
                                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                                    <div style={{ textAlign: 'center', padding: '16px 24px', borderRadius: 'var(--radius-lg)', background: gradeBefore ? gradeBefore.bg : 'var(--bg-input)', border: gradeBefore ? `3px solid ${gradeBefore.color}` : '2px solid var(--border-light)', minWidth: 140 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Prije mjera (Početni rizik)</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: gradeBefore?.color || 'var(--text-muted)' }}>{avgBefore> 0 ? avgBefore.toFixed(1) : '—'}</div>
                                        {gradeBefore && <div style={{ fontSize: '0.82rem', fontWeight: 700, color: gradeBefore.color, marginTop: 4 }}>{gradeBefore.label}</div>}
                                    </div>
                                    {gradeAfter && <div style={{ fontSize: '2rem', fontWeight: 900, color: avgAfter < avgBefore ? '#4caf50' : '#f44336' }}>→</div>}
                                    {gradeAfter && (
                                        <div style={{ textAlign: 'center', padding: '16px 24px', borderRadius: 'var(--radius-lg)', background: gradeAfter.bg, border: `3px solid ${gradeAfter.color}`, minWidth: 140 }}>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Nakon mjera (Preostali rizik)</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 900, color: gradeAfter.color }}>{avgAfter.toFixed(1)}</div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: gradeAfter.color, marginTop: 4 }}>{gradeAfter.label}</div>
                                        </div>
                                    )}
                                    {gradeAfter && avgAfter < avgBefore && (
                                        <div style={{ padding: '12px 20px', borderRadius: 'var(--radius-md)', background: 'rgba(76,175,80,0.1)', border: '2px solid #4caf50', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#4caf50' }}>↓ {((1 - avgAfter / avgBefore) * 100).toFixed(0)}%</div>
                                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4caf50' }}>SMANJENJE RIZIKA</div>
                                        </div>
                                    )}
                                </div>
                                {!gradeAfter && itemsWithScores.length> 0 && (
                                    <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(255,193,7,0.1)', border: '1px solid #ffc107', fontSize: '0.82rem', color: '#ffc107' }}>
                                        ⚠ Koristite tab "Procjena rizika" i dugme "🤖 AI Predloži mjere" da dobijete ocjenu nakon mjera.
                                    </div>
                                )}
                            </div>
                        )}
                        {/* ── Distribution cards ── */}
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>DISTRIBUCIJA PO NIVOU RIZIKA</div>
                        {riskItems.length> 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 20 }}>
                                {[
                                    { k: 'neznatan', l: 'Neznatan', c: '#4caf50' }, { k: 'dopustiv', l: 'Dopustiv', c: '#ffc107' },
                                    { k: 'umjeren', l: 'Umjeren', c: '#ff9800' }, { k: 'znatan', l: 'Znatan', c: '#f44336' },
                                    { k: 'nedopustiv', l: 'Nedopustiv', c: '#b71c1c' },
                                ].map(b => (
                                    <div key={b.k} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: `${b.c}15`, border: `2px solid ${b.c}`, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'baseline' }}>
                                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: b.c }}>{bands[b.k]}</div>
                                            {itemsWithAfter.length> 0 && bandsAfter[b.k] !== bands[b.k] && (
                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: bandsAfter[b.k] < bands[b.k] ? '#4caf50' : '#f44336' }}>→ {bandsAfter[b.k]}</div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: b.c }}>{b.l}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14, marginTop: 10 }}>ZAKLJUČAK</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <button className="btn btn-outline btn-sm" onClick={handleAutoConclusion} disabled={conclusionLoading || riskItems.length === 0}
                                style={{ background: conclusionLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                {conclusionLoading ? '⏳ Generisanje...' : '🤖 AI Generiši zaključak'}
                            </button>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>AI će napisati profesionalni zaključak na osnovu procjene</span>
                        </div>
                        <textarea className="form-input" rows={6} value={formData.zakljucak || ''} onChange={e => set('zakljucak', e.target.value)}
                            placeholder="Na osnovu provedene procjene rizika, zaključuje se..." style={{ resize: 'vertical', marginBottom: 16 }} />
                        <div className="scrollable-toolbar" style={{ padding: 0, gap: 10 }}>
                            <button className="btn btn-outline" onClick={() => handleGenerateReport()}
                                style={{ background: 'linear-gradient(135deg, #1a237e 0%, #3f51b5 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                📄 {t('preuzmiPdf')}
                            </button>
                            <button className="btn btn-outline" onClick={() => handleGenerateDocx()}
                                style={{ background: 'linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                📗 {t('preuzmiWordDocx')}
                            </button>
                        </div>
                    </div></div>
                    );
                })()}
                    {/* Global Form Footer Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, padding: '16px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', position: 'sticky', bottom: 16, zIndex: 100 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-ghost" onClick={() => hasPrevTab && setActiveTab(tabs[currentTabIndex - 1].key)} disabled={!hasPrevTab} style={{ opacity: !hasPrevTab ? 0.3 : 1 }}>
                                ← {lang !== 'en' ? 'Nazad' : 'Previous'}
                            </button>
                            <button className="btn btn-outline" onClick={() => hasNextTab && setActiveTab(tabs[currentTabIndex + 1].key)} disabled={!hasNextTab} style={{ opacity: !hasNextTab ? 0.3 : 1, borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                                {t('dalje')} →
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <button className="btn btn-ghost" title="Zatvorite formu i vratite se na početnu listu" onClick={handleBack}>↩ {t('cancel')}</button>
                            <button className="btn btn-primary" title="Spasite sve dosadašnje promjene" onClick={handleSave} style={{ minWidth: 120 }}>💾 {t('save')}</button>
                            <SavedFlash />
                        </div>
                    </div>
            </div>
        );
    }

    /* ━━━ Vrsta osobe view (unchanged) ━━━ */
    if (view === 'vrstaOsobe') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn btn-ghost" onClick={() => { setView('list'); cancelPt(); }}>←</button>
                    <h1 style={{ margin: 0 }}>👤 {t('vrsteOsoba')}</h1>
                </div>
                <DialogRenderer />
                <div className="card"><div className="card-body">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={startNewPt}>+ {t('dodaj')}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input placeholder={t('pretrazi1')} value={searchPt} onChange={e => setSearchPt(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                    </div>
                    <div className="data-table-wrapper"><table className="data-table"><thead><tr>
                        <th style={{ width: 90 }}></th><th>{t('naziv')}</th><th>{t('vrsta')}</th>
                    </tr></thead><tbody>
                        {ptEdit === '__new__' && <tr style={{ background: 'var(--bg-input)' }}><td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-primary btn-sm" onClick={savePt}>✔</button><button className="btn btn-ghost btn-sm" onClick={cancelPt}>✖</button></div></td>
                            <td><input className="form-input" value={ptNaziv} onChange={e => setPtNaziv(e.target.value)} autoFocus /></td><td><input className="form-input" value={ptVrsta} onChange={e => setPtVrsta(e.target.value)} /></td></tr>}
                        {(searchPt ? personTypes.filter(p => `${p.naziv} ${p.vrsta}`.toLowerCase().includes(searchPt.toLowerCase())) : personTypes).map(p =>
                            ptEdit === p.id ? <tr key={p.id} style={{ background: 'var(--bg-input)' }}><td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-primary btn-sm" onClick={savePt}>✔</button><button className="btn btn-ghost btn-sm" onClick={cancelPt}>✖</button></div></td>
                                <td><input className="form-input" value={ptNaziv} onChange={e => setPtNaziv(e.target.value)} autoFocus /></td><td><input className="form-input" value={ptVrsta} onChange={e => setPtVrsta(e.target.value)} /></td></tr>
                            : <tr key={p.id}><td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-ghost btn-sm" onClick={() => startEditPt(p)}>✏️</button><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePt(p.id)}>✖</button></div></td>
                                <td>{p.naziv}</td><td>{p.vrsta || '—'}</td></tr>
                        )}
                    </tbody></table></div>
                </div></div>
            </div>
        );
    }

    /* ━━━ Opasnosti view (unchanged) ━━━ */
    if (view === 'opasnosti') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn btn-ghost" onClick={() => { setView('list'); cancelHaz(); }}>←</button>
                    <h1 style={{ margin: 0 }}>⚠️ {t('opasnosti')}</h1>
                </div>
                <DialogRenderer />
                <div className="card"><div className="card-body">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={startNewHaz}>+ {t('dodaj')}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input placeholder={t('pretrazi1')} value={searchHaz} onChange={e => setSearchHaz(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                    </div>
                    <div className="data-table-wrapper"><table className="data-table"><thead><tr>
                        <th style={{ width: 90 }}></th><th>{t('naziv')}</th><th>{t('oznaka')}</th>
                    </tr></thead><tbody>
                        {hazEdit === '__new__' && <tr style={{ background: 'var(--bg-input)' }}><td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-primary btn-sm" onClick={saveHaz}>✔</button><button className="btn btn-ghost btn-sm" onClick={cancelHaz}>✖</button></div></td>
                            <td><input className="form-input" value={hazNaziv} onChange={e => setHazNaziv(e.target.value)} autoFocus placeholder="npr. O.1. MEHANIČKE OPASNOSTI" /></td>
                            <td><input className="form-input" value={hazOznaka} onChange={e => setHazOznaka(e.target.value)} placeholder="npr. O.1" /></td></tr>}
                        {(searchHaz ? hazards.filter(h => `${h.naziv} ${h.oznaka}`.toLowerCase().includes(searchHaz.toLowerCase())) : hazards).map(h =>
                            hazEdit === h.id ? <tr key={h.id} style={{ background: 'var(--bg-input)' }}><td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-primary btn-sm" onClick={saveHaz}>✔</button><button className="btn btn-ghost btn-sm" onClick={cancelHaz}>✖</button></div></td>
                                <td><input className="form-input" value={hazNaziv} onChange={e => setHazNaziv(e.target.value)} autoFocus /></td><td><input className="form-input" value={hazOznaka} onChange={e => setHazOznaka(e.target.value)} /></td></tr>
                            : <tr key={h.id}><td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-ghost btn-sm" onClick={() => startEditHaz(h)}>✏️</button><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteHaz(h.id)}>✖</button></div></td>
                                <td>{h.naziv}</td><td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{h.oznaka || '—'}</span></td></tr>
                        )}
                    </tbody></table></div>
                </div></div>
            </div>
        );
    }

    return null;
}

