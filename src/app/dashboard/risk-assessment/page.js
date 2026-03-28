'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { getSessionsForQuestionnaire } from '@/lib/firebaseSync';
import HelpTip from '@/components/HelpTip';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import { useDialog } from '@/hooks/useDialog';

/* ═══════════════════════════════════════════════
   5×5 Risk Matrix — Procjena rizika (FBiH ZNR)
   ═══════════════════════════════════════════════ */

const EMPTY_PROCJENA = {
    nazivTvrtke: '', sjediste: '', djelatnost: '', ukupnoZaposlenih: '',
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

function riskLevel(score) {
    if (score <= 5) return { label: 'Neznatan', color: '#4caf50', bg: 'rgba(76,175,80,0.15)' };
    if (score <= 10) return { label: 'Dopustiv', color: '#ffc107', bg: 'rgba(255,193,7,0.15)' };
    if (score <= 15) return { label: 'Umjeren', color: '#ff9800', bg: 'rgba(255,152,0,0.15)' };
    if (score <= 20) return { label: 'Znatan', color: '#f44336', bg: 'rgba(244,67,54,0.15)' };
    return { label: 'Nedopustiv', color: '#b71c1c', bg: 'rgba(183,28,28,0.2)' };
}

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
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                        {score}
                                        {count > 0 && (
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
    const [showRiForm, setShowRiForm] = useState(false);
    const [workplaces, setWorkplaces] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    // Import from questionnaire
    const [showImportModal, setShowImportModal] = useState(false);
    const [questionnaires, setQuestionnaires] = useState([]);
    const [importLoading, setImportLoading] = useState(false);
    const [conclusionLoading, setConclusionLoading] = useState(false);
    // Sistematizacija + response counts
    const [sistematizacije, setSistematizacije] = useState([]);
    const [responseCounts, setResponseCounts] = useState({});
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

    useEffect(() => { loadData(); }, [loadData]);

    const loadRiskItems = useCallback((procjenaId) => {
        if (!procjenaId) { setRiskItems([]); return; }
        setRiskItems(getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === procjenaId));
    }, []);

    const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    // ─── Procjene CRUD ───
    const handleNew = () => {
        setFormData({ ...EMPTY_PROCJENA, datumIzrade: todayISO() });
        setEditingId(null); setRiskItems([]); setActiveTab('opsti'); setView('form');
    };
    const handleEdit = (item) => {
        setFormData({ ...EMPTY_PROCJENA, ...item });
        setEditingId(item.id); loadRiskItems(item.id); setActiveTab('opsti'); setView('form');
    };
    const handleDelete = async (id) => {
        if (await confirm(lang === 'bs' ? 'Obrisati procjenu i sve stavke?' : 'Delete assessment and all items?')) {
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
        if (!formData.nazivTvrtke) { alert(lang === 'bs' ? 'Naziv tvrtke je obavezan!' : 'Company name is required!'); return; }
        
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
        setRiForm({ ...ri }); setRiEditId(ri.id); setShowRiForm(true);
    };
    const handleDeleteRi = async (id) => {
        if (await confirm(lang === 'bs' ? 'Obrisati stavku?' : 'Delete item?')) {
            remove(COLLECTIONS.RISK_ITEMS, id); loadRiskItems(editingId);
        }
    };
    const handleSaveRi = () => {
        if (!riForm.opasnostId && !riForm.opisOpasnosti) { alert('Odaberite opasnost ili unesite opis!'); return; }
        if (!riForm.vjerovatnoca || !riForm.posljedica) { alert('Vjerovatnoća i Posljedica su obavezni (1-5)!'); return; }
        const score = riForm.vjerovatnoca * riForm.posljedica;
        const vN = riForm.vjerovatnocaNakon || 0;
        const pN = riForm.posljedlicaNakon || 0;
        const scoreAfter = vN > 0 && pN > 0 ? vN * pN : 0;
        const data = { ...riForm, rizik: score, nivoRizika: riskLevel(score).label, rizikNakon: scoreAfter, nivoRizikaNakon: scoreAfter > 0 ? riskLevel(scoreAfter).label : '' };
        if (riEditId) update(COLLECTIONS.RISK_ITEMS, riEditId, data);
        else create(COLLECTIONS.RISK_ITEMS, data);
        setShowRiForm(false); setRiEditId(null); loadRiskItems(editingId);
        showFlash();
    };
    // ─── AI Measures Suggestion ───
    const handleAiSuggest = async () => {
        if (!riForm.vjerovatnoca || !riForm.posljedica) { alert('Prvo unesite V i P!'); return; }
        setAiLoading(true);
        try {
            const hz = hazards.find(h => h.id === riForm.opasnostId);
            const wp = workplaces.find(w => w.id === riForm.radnoMjestoId);
            const res = await fetch('/api/risk-measures', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hazardName: hz?.naziv || '', hazardCode: hz?.oznaka || '',
                    workplaceName: wp?.naziv || '', opisOpasnosti: riForm.opisOpasnosti || '',
                    vjerovatnoca: riForm.vjerovatnoca, posljedica: riForm.posljedica,
                    postojeceMjere: riForm.postojeceMjere || '',
                }),
            });
            const data = await res.json();
            if (data.success && data.measures) {
                const m = data.measures;
                setRiForm(prev => ({
                    ...prev,
                    postojeceMjere: m.postojeceMjere || prev.postojeceMjere,
                    predlozeneMjere: m.predlozeneMjere || prev.predlozeneMjere,
                    vjerovatnocaNakon: m.vjerovatnocaNakon || prev.vjerovatnocaNakon,
                    posljedlicaNakon: m.posljedlicaNakon || prev.posljedlicaNakon,
                }));
            } else { alert('AI greška: ' + (data.error || 'Nepoznata greška')); }
        } catch (err) { alert('Greška: ' + err.message); }
        setAiLoading(false);
    };
    const setRi = (f, v) => setRiForm(prev => ({ ...prev, [f]: v }));

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
        setImportLoading(true);
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
            const res = await fetch('/api/analyze-questionnaire', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                }),
            });
            const data = await res.json();
            if (data.success && data.analysis?.items) {
                const items = data.analysis.items;
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
                        status: 'draft', aiGenerated: true,
                    });
                    created++;
                });
                loadRiskItems(editingId);
                setShowImportModal(false);
            } else {
                await alert('AI greška: ' + (data.error || 'Nepoznata greška') + (data.raw ? '\n\nRaw: ' + data.raw.substring(0, 200) : ''));
            }
        } catch (err) { await alert('Greška: ' + err.message); }
        setImportLoading(false);
    };

    // ─── Word (.docx) Export ───
    const handleGenerateDocx = async (saveToFile = true, overrideData = null, overrideItems = null) => {
        const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType } = await import('docx');

        const data = overrideData || formData;
        const items = overrideItems || riskItems;

        const sorted = [...items].sort((a, b) => (b.rizik || 0) - (a.rizik || 0));
        const highRiskItems = items.filter(ri => ri.rizik >= 6).sort((a, b) => b.rizik - a.rizik);
        const itemsWithScores = items.filter(ri => ri.rizik > 0);
        const avgBefore = itemsWithScores.length > 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
        const itemsWithAfter = items.filter(ri => ri.rizikNakon > 0);
        const avgAfter = itemsWithAfter.length > 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;
        const today = new Date().toLocaleDateString('hr-HR');

        const mkCell = (text, opts = {}) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(text || '—'), size: opts.size || 18, bold: opts.bold, color: opts.color })], alignment: opts.align || AlignmentType.LEFT })],
            width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
            shading: opts.bg ? { type: ShadingType.SOLID, color: opts.bg } : undefined,
        });

        const headerRow = (cells) => new TableRow({
            children: cells.map(c => mkCell(c, { bold: true, bg: 'D1C4E9', size: 18 })),
            tableHeader: true,
        });

        // Risk items table
        const riTableRows = [headerRow(['#', 'Radno mjesto', 'Opasnost', 'V₀', 'P₀', 'R₀', 'Nivo', 'V₁', 'P₁', 'R₁', 'Nivo nakon'])];
        sorted.forEach((ri, i) => {
            const wp = workplaces.find(w => w.id === ri.radnoMjestoId);
            const hz = hazards.find(h => h.id === ri.opasnostId);
            const hasA = ri.rizikNakon > 0;
            riTableRows.push(new TableRow({
                children: [
                    mkCell(i + 1, { align: AlignmentType.CENTER }),
                    mkCell(wp?.naziv || '—'),
                    mkCell(hz ? `${hz.oznaka || ''} ${hz.naziv}` : ri.opisOpasnosti || '—'),
                    mkCell(ri.vjerovatnoca, { align: AlignmentType.CENTER }),
                    mkCell(ri.posljedica, { align: AlignmentType.CENTER }),
                    mkCell(ri.rizik, { align: AlignmentType.CENTER, bold: true }),
                    mkCell(riskLevel(ri.rizik).label),
                    mkCell(hasA ? ri.vjerovatnocaNakon : '—', { align: AlignmentType.CENTER }),
                    mkCell(hasA ? ri.posljedlicaNakon : '—', { align: AlignmentType.CENTER }),
                    mkCell(hasA ? ri.rizikNakon : '—', { align: AlignmentType.CENTER, bold: true }),
                    mkCell(hasA ? riskLevel(ri.rizikNakon).label : '—'),
                ],
            }));
        });

        // Measures table
        const measuresRows = [headerRow(['#', 'Opasnost', 'R₀', 'Postojeće mjere', 'Predložene mjere', 'R₁', 'Odg. osoba', 'Rok'])];
        highRiskItems.forEach((ri, i) => {
            const hz = hazards.find(h => h.id === ri.opasnostId);
            measuresRows.push(new TableRow({
                children: [
                    mkCell(i + 1, { align: AlignmentType.CENTER }),
                    mkCell(hz ? `${hz.oznaka || ''} ${hz.naziv}` : ri.opisOpasnosti || '—'),
                    mkCell(ri.rizik, { align: AlignmentType.CENTER, bold: true }),
                    mkCell(ri.postojeceMjere),
                    mkCell(ri.predlozeneMjere, { bold: true }),
                    mkCell(ri.rizikNakon > 0 ? ri.rizikNakon : '—', { align: AlignmentType.CENTER, bold: true }),
                    mkCell(ri.odgovornaOsoba),
                    mkCell(ri.rokProvedbe ? new Date(ri.rokProvedbe).toLocaleDateString('hr-HR') : '—'),
                ],
            }));
        });

        const doc = new Document({
            sections: [{
                properties: { page: { margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 } } },
                children: [
                    // Cover
                    new Paragraph({ text: 'Bosna i Hercegovina — Federacija BiH', alignment: AlignmentType.CENTER, spacing: { before: 2400 }, children: [new TextRun({ text: 'Bosna i Hercegovina — Federacija BiH', size: 20, color: '999999' })] }),
                    new Paragraph({ text: '', spacing: { before: 600 } }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'AKT O PROCJENI RIZIKA', size: 56, bold: true, color: '1A237E' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: 'na radnim mjestima i u radnim prostorijama', size: 28, color: '555555' })] }),
                    new Paragraph({ text: '', spacing: { before: 600 } }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.nazivTvrtke || '—', size: 32, bold: true, color: '1A237E' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${data.sjediste || ''} • ${data.djelatnost || ''}`, size: 20, color: '666666' })] }),
                    new Paragraph({ text: '', spacing: { before: 400 } }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Datum izrade: ${data.datumIzrade ? new Date(data.datumIzrade).toLocaleDateString('hr-HR') : today}`, size: 22, color: '666666' })] }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Revizija: ${data.revizija || '1'}`, size: 22, color: '666666' })] }),
                    ...(data.ovlOrganizacija ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300 }, children: [new TextRun({ text: `Izradila: ${data.ovlOrganizacija}`, size: 22, color: '666666' })] })] : []),
                    ...(data.ovlOsobaIme ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Ovlaštena osoba: ${data.ovlOsobaIme} ${data.ovlOsobaKvalifikacije ? '(' + data.ovlOsobaKvalifikacije + ')' : ''}`, size: 22, color: '666666' })] })] : []),

                    // Section 1
                    new Paragraph({ text: '', pageBreakBefore: true }),
                    new Paragraph({ text: '1. Opšti podaci o poslodavcu', heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
                    new Table({ rows: [
                        new TableRow({ children: [mkCell('Naziv', { bold: true, bg: 'E8EAF6', width: 30 }), mkCell(data.nazivTvrtke, { width: 70 })] }),
                        new TableRow({ children: [mkCell('Sjedište', { bold: true, bg: 'E8EAF6' }), mkCell(data.sjediste)] }),
                        new TableRow({ children: [mkCell('Djelatnost', { bold: true, bg: 'E8EAF6' }), mkCell(data.djelatnost)] }),
                        new TableRow({ children: [mkCell('Ukupno zaposlenih', { bold: true, bg: 'E8EAF6' }), mkCell(data.ukupnoZaposlenih)] }),
                        new TableRow({ children: [mkCell('Ovlaštena organizacija', { bold: true, bg: 'E8EAF6' }), mkCell(data.ovlOrganizacija)] }),
                        new TableRow({ children: [mkCell('Ovlaštena osoba', { bold: true, bg: 'E8EAF6' }), mkCell(`${data.ovlOsobaIme || '—'} ${data.ovlOsobaKvalifikacije ? '(' + data.ovlOsobaKvalifikacije + ')' : ''}`)] }),
                    ], width: { size: 100, type: WidthType.PERCENTAGE } }),

                    // Section 2
                    new Paragraph({ text: '2. Opis tehničko-tehnološkog procesa', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Paragraph({ text: data.opisProcesa || 'Nije uneseno.', spacing: { after: 200 } }),
                    ...(data.analizaOrganizacije ? [
                        new Paragraph({ text: 'Analiza organizacije rada', heading: HeadingLevel.HEADING_2, spacing: { before: 200 } }),
                        new Paragraph({ text: data.analizaOrganizacije }),
                    ] : []),

                    // Section 3
                    new Paragraph({ text: '3. Procjena rizika — rezultati', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Paragraph({ children: [
                        new TextRun({ text: `Ukupno procijenjeno: `, size: 22 }),
                        new TextRun({ text: `${items.length}`, size: 22, bold: true }),
                        new TextRun({ text: ` stavki na `, size: 22 }),
                        new TextRun({ text: `${[...new Set(items.map(r => r.radnoMjestoId))].length}`, size: 22, bold: true }),
                        new TextRun({ text: ` radnih mjesta.`, size: 22 }),
                    ], spacing: { after: 200 } }),
                    ...(sorted.length > 0 ? [new Table({ rows: riTableRows, width: { size: 100, type: WidthType.PERCENTAGE } })] : []),

                    // Section 4
                    new Paragraph({ text: '4. Ukupna ocjena rizika', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Paragraph({ children: [
                        new TextRun({ text: `Prosječna ocjena PRIJE mjera: `, size: 22 }),
                        new TextRun({ text: avgBefore > 0 ? `${avgBefore.toFixed(1)} (${riskLevel(Math.round(avgBefore)).label})` : '—', size: 22, bold: true }),
                    ] }),
                    new Paragraph({ children: [
                        new TextRun({ text: `Prosječna ocjena NAKON mjera: `, size: 22 }),
                        new TextRun({ text: avgAfter > 0 ? `${avgAfter.toFixed(1)} (${riskLevel(Math.round(avgAfter)).label})` : '—', size: 22, bold: true }),
                    ] }),
                    ...(avgAfter > 0 && avgBefore > 0 ? [new Paragraph({ children: [
                        new TextRun({ text: `Smanjenje rizika: `, size: 22 }),
                        new TextRun({ text: `${((1 - avgAfter / avgBefore) * 100).toFixed(0)}%`, size: 22, bold: true, color: '4CAF50' }),
                    ] })] : []),

                    // Section 5 — Measures
                    ...(highRiskItems.length > 0 ? [
                        new Paragraph({ text: '5. Plan mjera za smanjenje rizika', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                        new Paragraph({ text: 'Stavke sa početnim rizikom R₀ ≥ 6 koje zahtijevaju dodatne mjere:', spacing: { after: 200 } }),
                        new Table({ rows: measuresRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
                    ] : []),

                    // Section 6 — Conclusion
                    new Paragraph({ text: `${highRiskItems.length > 0 ? '6' : '5'}. Zaključak`, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
                    new Paragraph({ text: data.zakljucak || 'Zaključak nije unesen.', spacing: { after: 400 } }),

                    // Signatures
                    new Paragraph({ text: '', spacing: { before: 800 } }),
                    new Table({ rows: [new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ text: '________________________', alignment: AlignmentType.CENTER }), new Paragraph({ text: 'Poslodavac', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Poslodavac', size: 18 })] })], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
                            new TableCell({ children: [new Paragraph({ text: '________________________', alignment: AlignmentType.CENTER }), new Paragraph({ text: 'Ovlaštena osoba za ZNR', alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Ovlaštena osoba za ZNR', size: 18 })] })], borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } } }),
                        ],
                    })], width: { size: 100, type: WidthType.PERCENTAGE } }),

                    // Footer
                    new Paragraph({ text: '', spacing: { before: 400 } }),
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Akt o procjeni rizika — ${data.nazivTvrtke || ''} — Generisano: ${today} — eZNR Platform`, size: 16, color: '999999' })] }),
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);
        if (saveToFile) {
            const { saveAs } = await import('file-saver');
            saveAs(blob, `Procjena_rizika_${(data.nazivTvrtke || 'export').replace(/[^a-zA-Z0-9]/g, '_')}.docx`);
        }
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    };

    // ─── AI Auto-Conclusion ───
    const handleAutoConclusion = async () => {
        if (riskItems.length === 0) return;
        setConclusionLoading(true);
        try {
            const itemsWithScores = riskItems.filter(ri => ri.rizik > 0);
            const avgBefore = itemsWithScores.length > 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
            const itemsWithAfter = riskItems.filter(ri => ri.rizikNakon > 0);
            const avgAfter = itemsWithAfter.length > 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;
            const res = await fetch('/api/zia', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemPrompt: 'Ti si stručnjak za zaštitu na radu u FBiH. Piši formalno, profesionalno, na bosanskom jeziku. Generiši zaključak za akt o procjeni rizika.',
                    messages: [{ role: 'user', parts: [{ text: `Na osnovu procjene rizika sa ${riskItems.length} stavki:
- Prosječna ocjena PRIJE mjera: ${avgBefore.toFixed(1)} (${avgBefore > 0 ? riskLevel(Math.round(avgBefore)).label : 'N/A'})
- Prosječna ocjena NAKON mjera: ${avgAfter > 0 ? avgAfter.toFixed(1) : 'N/A'} ${avgAfter > 0 ? '(' + riskLevel(Math.round(avgAfter)).label + ')' : ''}
- Smanjenje: ${avgAfter > 0 && avgBefore > 0 ? ((1-avgAfter/avgBefore)*100).toFixed(0) + '%' : 'N/A'}
- Stavke sa visokim rizikom (R≥6): ${riskItems.filter(r => r.rizik >= 6).length}
- Stavke sa nedopustivim rizikom (R>20): ${riskItems.filter(r => r.rizik > 20).length}
- Naziv tvrtke: ${formData.nazivTvrtke || 'N/A'}
- Djelatnost: ${formData.djelatnost || 'N/A'}

Napiši profesionalni zaključak za akt o procjeni rizika (3-5 paragrafa). Uključi: opći zaključak, ključne rizike, obaveze poslodavca, rok za reviziju.` }] }],
                }),
            });
            const data = await res.json();
            if (data.text) {
                set('zakljucak', data.text);
            }
        } catch (err) { await alert('Greška: ' + err.message); }
        setConclusionLoading(false);
    };

    // ─── PDF Report Generator ───
    const handleGenerateReport = (overrideData = null, overrideItems = null, autoPrint = false) => {
        const data = overrideData || formData;
        const items = overrideItems || riskItems;
        const itemsWithScores = items.filter(ri => ri.rizik > 0);
        const avgBefore = itemsWithScores.length > 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
        const itemsWithAfter = items.filter(ri => ri.rizikNakon > 0);
        const avgAfter = itemsWithAfter.length > 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;
        const gradeBefore = avgBefore > 0 ? riskLevel(Math.round(avgBefore)) : null;
        const gradeAfter = avgAfter > 0 ? riskLevel(Math.round(avgAfter)) : null;
        const sorted = [...items].sort((a, b) => (b.rizik || 0) - (a.rizik || 0));
        const highRiskItems = items.filter(ri => ri.rizik >= 6).sort((a, b) => b.rizik - a.rizik);
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

<!-- SECTION 2: PROCESS -->
<h2>2. Opis tehničko-tehnološkog procesa</h2>
<p>${(data.opisProcesa || 'Nije uneseno.').replace(/\n/g, '<br>')}</p>
${data.analizaOrganizacije ? `<h3>Analiza organizacije rada</h3><p>${data.analizaOrganizacije.replace(/\n/g, '<br>')}</p>` : ''}

<!-- SECTION 3: RISK MATRIX RESULTS -->
<h2>3. Procjena rizika — rezultati</h2>
<p>Ukupno procijenjeno: <strong>${items.length}</strong> stavki na <strong>${[...new Set(items.map(r => r.radnoMjestoId))].length}</strong> radnih mjesta.</p>
<table>
<thead><tr><th>#</th><th>Radno mjesto</th><th>Opasnost / Štetnost</th><th>V₀</th><th>P₀</th><th>R₀</th><th>Nivo</th><th>V₁</th><th>P₁</th><th>R₁</th><th>Nivo nakon</th></tr></thead>
<tbody>
${sorted.map((ri, i) => {
    const wp = workplaces.find(w => w.id === ri.radnoMjestoId);
    const hz = hazards.find(h => h.id === ri.opasnostId);
    const hasAfter = ri.rizikNakon > 0;
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

<!-- SECTION 4: OVERALL GRADE -->
<h2>4. Ukupna ocjena rizika</h2>
<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin:12px 0">
    <div class="grade-box" style="background:${gradeBefore ? rlBg(Math.round(avgBefore)) : '#f5f5f5'};border:2px solid ${gradeBefore ? rlColor(Math.round(avgBefore)) : '#ddd'}">
        <div style="font-size:8pt;color:#666;margin-bottom:4px">PRIJE MJERA</div>
        <div style="font-size:20pt;font-weight:900;color:${gradeBefore ? rlColor(Math.round(avgBefore)) : '#999'}">${avgBefore > 0 ? avgBefore.toFixed(1) : '—'}</div>
        ${gradeBefore ? '<div style="font-size:9pt;font-weight:700;color:' + rlColor(Math.round(avgBefore)) + '">' + gradeBefore.label + '</div>' : ''}
    </div>
    ${gradeAfter ? '<div style="font-size:20pt;font-weight:900;color:#4caf50">→</div>' : ''}
    ${gradeAfter ? '<div class="grade-box" style="background:' + rlBg(Math.round(avgAfter)) + ';border:2px solid ' + rlColor(Math.round(avgAfter)) + '"><div style="font-size:8pt;color:#666;margin-bottom:4px">NAKON MJERA</div><div style="font-size:20pt;font-weight:900;color:' + rlColor(Math.round(avgAfter)) + '">' + avgAfter.toFixed(1) + '</div><div style="font-size:9pt;font-weight:700;color:' + rlColor(Math.round(avgAfter)) + '">' + gradeAfter.label + '</div></div>' : ''}
    ${gradeAfter && avgAfter < avgBefore ? '<div class="grade-box" style="background:#e8f5e9;border:2px solid #4caf50"><div style="font-size:8pt;color:#4caf50">SMANJENJE</div><div style="font-size:18pt;font-weight:900;color:#4caf50">↓ ' + ((1 - avgAfter / avgBefore) * 100).toFixed(0) + '%</div></div>' : ''}
</div>

<!-- SECTION 5: MEASURES -->
${highRiskItems.length > 0 ? `<h2>5. Plan mjera za smanjenje rizika</h2>
<p>Stavke sa početnim rizikom R₀ ≥ 6 koje zahtijevaju dodatne mjere:</p>
<table>
<thead><tr><th>#</th><th>Opasnost</th><th>R₀</th><th>Postojeće mjere</th><th>Predložene mjere</th><th>R₁</th><th>Odgovorna osoba</th><th>Rok</th></tr></thead>
<tbody>
${highRiskItems.map((ri, i) => {
    const hz = hazards.find(h => h.id === ri.opasnostId);
    const hasAfter = ri.rizikNakon > 0;
    return '<tr><td>' + (i + 1) + '</td><td>' + (hz ? (hz.oznaka ? hz.oznaka + ' ' : '') + hz.naziv : ri.opisOpasnosti || '—') + '</td><td style="text-align:center;font-weight:700;color:' + rlColor(ri.rizik) + '">' + ri.rizik + '</td><td>' + (ri.postojeceMjere || '—') + '</td><td style="font-weight:600">' + (ri.predlozeneMjere || '—') + '</td><td style="text-align:center;font-weight:700;color:' + (hasAfter ? rlColor(ri.rizikNakon) : '#999') + '">' + (hasAfter ? ri.rizikNakon : '—') + '</td><td>' + (ri.odgovornaOsoba || '—') + '</td><td>' + (ri.rokProvedbe ? new Date(ri.rokProvedbe).toLocaleDateString('hr-HR') : '—') + '</td></tr>';
}).join('')}
</tbody>
</table>` : ''}

<!-- SECTION 6: CONCLUSION -->
<h2>${highRiskItems.length > 0 ? '6' : '5'}. Zaključak</h2>
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
    const deletePt = async (id) => { if (await confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?')) { remove(COLLECTIONS.PERSON_TYPES, id); loadData(); } };
    const startNewHaz = () => { setHazEdit('__new__'); setHazNaziv(''); setHazOznaka(''); };
    const startEditHaz = (h) => { setHazEdit(h.id); setHazNaziv(h.naziv || ''); setHazOznaka(h.oznaka || ''); };
    const cancelHaz = () => setHazEdit(null);
    const saveHaz = () => { if (!hazNaziv.trim()) return; if (hazEdit === '__new__') create(COLLECTIONS.HAZARDS, { naziv: hazNaziv, oznaka: hazOznaka }); else update(COLLECTIONS.HAZARDS, hazEdit, { naziv: hazNaziv, oznaka: hazOznaka }); setHazEdit(null); loadData(); };
    const deleteHaz = async (id) => { if (await confirm(lang === 'bs' ? 'Obrisati?' : 'Delete?')) { remove(COLLECTIONS.HAZARDS, id); loadData(); } };

    const labelSt = { fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };

    const tabs = [
        { key: 'opsti', label: '📋 Opšti podaci', en: '📋 General' },
        { key: 'opis', label: '🏭 Opis procesa', en: '🏭 Process' },
        { key: 'procjena', label: '📊 Procjena rizika', en: '📊 Assessment' },
        { key: 'mjere', label: '🛡️ Mjere', en: '🛡️ Measures' },
        { key: 'zakljucak', label: '📝 Zaključak', en: '📝 Conclusion' },
    ];

    /* ━━━ LIST VIEW ━━━ */
    if (view === 'list') {
        const sortedRecords = [...records].filter(r => search ? (r.nazivTvrtke || '').toLowerCase().includes(search.toLowerCase()) : true);
        sortedRecords.sort((a, b) => {
            let aVal = a[sortConfig.key] || '';
            let bVal = b[sortConfig.key] || '';
            if (sortConfig.key === 'cnt') {
                aVal = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === a.id).length;
                bVal = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === b.id).length;
            } else if (sortConfig.key === 'datumIzrade') {
                aVal = new Date(aVal).getTime() || 0;
                bVal = new Date(bVal).getTime() || 0;
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase(); bVal = bVal.toLowerCase();
            }
            if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
            return 0;
        });

        const reqSort = (k) => {
            setSortConfig(prev => ({ key: k, dir: prev.key === k && prev.dir === 'asc' ? 'desc' : 'asc' }));
        };
        const getSortIcon = (k) => sortConfig.key === k ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : '';
        const menuItemSt = { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text)', textAlign: 'left', transition: 'background 0.12s' };

        const allSelected = sortedRecords.length > 0 && sortedRecords.every(r => selectedIds.has(r.id));
        const toggleAll = () => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(sortedRecords.map(r => r.id))); };
        const toggleSelect = (id) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

        const bulkDelete = async () => {
            if (selectedIds.size === 0) return;
            const ok = await confirm(lang === 'bs' ? `Obrisati ${selectedIds.size} procjena?` : `Delete ${selectedIds.size} assessments?`);
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
                <h1 style={{ marginBottom: 24 }}>📊 {lang === 'bs' ? 'Procjene rizika' : 'Risk Assessments'}</h1>
                <DialogRenderer />
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ {lang === 'bs' ? 'Nova procjena' : 'New'}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'} value={search} onChange={e => setSearch(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => setView('vrstaOsobe')}>👤 {lang === 'bs' ? 'Vrsta osobe' : 'Person types'}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setView('opasnosti')}>⚠️ {lang === 'bs' ? 'Opasnosti' : 'Hazards'}</button>

                        {/* ── Grupne akcije bar ── */}
                        {selectedIds.size > 0 && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', padding: '6px 14px', background: 'rgba(0,191,166,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,191,166,0.25)' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    {selectedIds.size} {lang === 'bs' ? 'odabrano' : 'selected'} &mdash; Grupne akcije:
                                </span>
                                <button className="btn btn-primary btn-sm" onClick={bulkPrint}>🖨️ {lang === 'bs' ? 'Isprintaj' : 'Print'}</button>
                                <button className="btn btn-danger btn-sm" onClick={bulkDelete}>🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>
                            </div>
                        )}
                        {selectedIds.size === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{sortedRecords.length} {lang === 'bs' ? 'zapisa' : 'records'}</span>}
                    </div>
                </div>
                <div className="card"><div className="card-body"><div className="data-table-wrapper">
                    <table className="data-table" style={{ width: '100%' }}><thead><tr>
                        <th style={{ width: 40, textAlign: 'center' }}>
                            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                        </th>
                        <th style={{ width: 90 }}>{t('actions')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('nazivTvrtke')}>{lang === 'bs' ? 'Naziv tvrtke' : 'Company'}{getSortIcon('nazivTvrtke')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('revizija')}>{lang === 'bs' ? 'Revizija' : 'Revision'}{getSortIcon('revizija')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('datumIzrade')}>{lang === 'bs' ? 'Datum' : 'Date'}{getSortIcon('datumIzrade')}</th>
                        <th style={{ cursor: 'pointer' }} onClick={() => reqSort('status')}>{lang === 'bs' ? 'Status' : 'Status'}{getSortIcon('status')}</th>
                        <th style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => reqSort('cnt')}>{lang === 'bs' ? 'Stavki' : 'Items'}{getSortIcon('cnt')}</th>
                    </tr></thead><tbody>
                        {sortedRecords.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
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
                                            <button className="btn btn-primary btn-sm" data-menu-trigger
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (openMenuId === r.id) { setOpenMenuId(null); return; }
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    menuButtonRef.current = e.currentTarget;
                                                    const spaceBelow = window.innerHeight - rect.bottom - 8;
                                                    const spaceAbove = rect.top - 8;
                                                    const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
                                                    setMenuPos(flipUp
                                                        ? { top: undefined, bottom: window.innerHeight - rect.top + 4, left: rect.left, maxH: Math.max(120, spaceAbove) }
                                                        : { top: rect.bottom + 4, bottom: undefined, left: rect.left, maxH: Math.max(120, spaceBelow) }
                                                    );
                                                    setOpenMenuId(r.id);
                                                }}>
                                                Akcije ▼
                                            </button>
                                            {openMenuId === r.id && (
                                                <div data-menu style={{
                                                    position: 'fixed',
                                                    top: menuPos.top,
                                                    bottom: menuPos.bottom,
                                                    left: menuPos.left,
                                                    zIndex: 9999,
                                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                                                    minWidth: 220, maxHeight: menuPos.maxH, overflowY: 'auto',
                                                }}>
                                                    <button onClick={() => { setOpenMenuId(null); handleEdit(r); }} style={menuItemSt}>✏️ Otvori</button>
                                                    <button onClick={() => { setOpenMenuId(null); handleCopy(r); }} style={menuItemSt}>📋 Kopiraj</button>
                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                    <button onClick={() => { setOpenMenuId(null); const items = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === r.id); handleGenerateReport(r, items, true); }} style={menuItemSt}>🖨️ Isprintaj (PDF)</button>
                                                    <button onClick={async () => { setOpenMenuId(null); const items = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === r.id); await handleGenerateDocx(true, r, items); }} style={menuItemSt}>📗 Preuzmi Word (.docx)</button>
                                                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
                                                    <button onClick={() => { setOpenMenuId(null); handleDelete(r.id); }} style={{ ...menuItemSt, color: 'var(--danger)' }}>🗑️ Izbriši</button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{r.nazivTvrtke || '—'}</td>
                                    <td>{r.revizija || '—'}</td>
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
        const highRisk = riskItems.filter(ri => ri.rizik >= 6);
        // Summary stats
        const bands = { neznatan: 0, dopustiv: 0, umjeren: 0, znatan: 0, nedopustiv: 0 };
        riskItems.forEach(ri => {
            const s = ri.rizik || 0;
            if (s <= 5) bands.neznatan++; else if (s <= 10) bands.dopustiv++; else if (s <= 15) bands.umjeren++;
            else if (s <= 20) bands.znatan++; else bands.nedopustiv++;
        });

        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <button className="btn btn-ghost" onClick={() => setView('list')}>← {lang === 'bs' ? 'Procjene' : 'Assessments'}</button>
                    <h1 style={{ margin: 0 }}>📊 {editingId ? (lang === 'bs' ? 'Uredi procjenu' : 'Edit') : (lang === 'bs' ? 'Nova procjena rizika' : 'New assessment')}</h1>
                </div>
                <DialogRenderer />

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                    {tabs.map(tb => (
                        <button key={tb.key} onClick={() => setActiveTab(tb.key)} style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
                            cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem',
                            background: activeTab === tb.key ? 'var(--primary)' : 'var(--bg-card)',
                            color: activeTab === tb.key ? '#fff' : 'var(--text)', transition: 'all 0.15s',
                        }}>{lang === 'bs' ? tb.label : tb.en}</button>
                    ))}
                </div>

                {/* ── TAB: Opšti podaci ── */}
                {activeTab === 'opsti' && (
                    <div className="card"><div className="card-body">
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>PODACI O POSLODAVCU</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <div><div style={labelSt}>Naziv tvrtke *</div><input className="form-input" value={formData.nazivTvrtke} onChange={e => set('nazivTvrtke', e.target.value)} /></div>
                            <div><div style={labelSt}>Sjedište / Adresa</div><input className="form-input" value={formData.sjediste || ''} onChange={e => set('sjediste', e.target.value)} /></div>
                            <div><div style={labelSt}>Djelatnost</div><input className="form-input" value={formData.djelatnost || ''} onChange={e => set('djelatnost', e.target.value)} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <div><div style={labelSt}>Br. zaposlenih</div><input className="form-input" type="number" min="0" value={formData.ukupnoZaposlenih || ''} onChange={e => set('ukupnoZaposlenih', e.target.value)} /></div>
                            <div><div style={labelSt}>Revizija</div><input className="form-input" value={formData.revizija} onChange={e => set('revizija', e.target.value)} /></div>
                            <div><div style={labelSt}>Datum izrade</div><input className="form-input" type="date" value={formData.datumIzrade} onChange={e => set('datumIzrade', e.target.value)} /></div>
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
                        <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                            <button className="btn btn-ghost" onClick={() => setView('list')}>↩ {lang === 'bs' ? 'Odustani' : 'Cancel'}</button>
                            <SavedFlash />
                        </div>
                    </div></div>
                )}

                {/* ── TAB: Opis procesa ── */}
                {activeTab === 'opis' && (
                    <div className="card"><div className="card-body">
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>OPIS TEHNIČKO-TEHNOLOŠKOG PROCESA</div>
                        <textarea className="form-input" rows={6} value={formData.opisProcesa || ''} onChange={e => set('opisProcesa', e.target.value)}
                            placeholder="Opišite tehničko-tehnološki i radni proces, sredstva rada, opremu..." style={{ resize: 'vertical', marginBottom: 20 }} />
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>ANALIZA ORGANIZACIJE RADA</div>
                        <textarea className="form-input" rows={4} value={formData.analizaOrganizacije || ''} onChange={e => set('analizaOrganizacije', e.target.value)}
                            placeholder="Opišite organizaciju rada, smjene, posebne uvjete..." style={{ resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                            <SavedFlash />
                        </div>
                    </div></div>
                )}

                {/* ── TAB: Procjena (5×5 Matrix + Risk Items) ── */}
                {activeTab === 'procjena' && (
                    <div>
                        {!editingId && <div className="card" style={{ marginBottom: 16 }}><div className="card-body" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>
                            ⚠️ {lang === 'bs' ? 'Prvo sačuvajte procjenu (tab Opšti podaci) da biste mogli dodavati stavke.' : 'Save the assessment first to add risk items.'}
                        </div></div>}
                        {editingId && <>
                            <div className="card" style={{ marginBottom: 16 }}><div className="card-body">
                                <RiskMatrix items={riskItems} onCellClick={(v, p) => { setRiForm(prev => ({ ...prev, vjerovatnoca: v, posljedica: p })); if (!showRiForm) handleNewRi(); setRiForm(prev => ({ ...prev, vjerovatnoca: v, posljedica: p })); }}
                                    selectedV={showRiForm ? riForm.vjerovatnoca : 0} selectedP={showRiForm ? riForm.posljedica : 0} />
                            </div></div>

                            <div className="card" style={{ marginBottom: 16 }}><div className="card-body">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                    <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 0 }}>STAVKE PROCJENE ({riskItems.length})</div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-outline btn-sm" onClick={() => setShowImportModal(true)}
                                            style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                            📋 Uvezi iz upitnika
                                        </button>
                                        <button className="btn btn-outline btn-sm" onClick={() => { setShowBulkModal(true); setBulkSelected([]); setBulkWpId(''); }}
                                            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                            ⚠️ Dodaj iz kataloga
                                        </button>
                                        <button className="btn btn-outline btn-sm" onClick={handleNewRi}>+ {lang === 'bs' ? 'Dodaj stavku' : 'Add item'}</button>
                                    </div>
                                </div>

                                {showRiForm && (
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
                                        {riForm.radnoMjestoId && (selectedWpSist || selectedWpEquipment.length > 0) && (
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
                                                {riForm.vjerovatnoca > 0 && riForm.posljedica > 0 ? (() => {
                                                    const sc = riForm.vjerovatnoca * riForm.posljedica;
                                                    const rl = riskLevel(sc);
                                                    return <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: rl.bg, color: rl.color, fontWeight: 700, fontSize: '1rem', textAlign: 'center', border: `2px solid ${rl.color}` }}>{sc} — {rl.label}</div>;
                                                })() : <div className="form-input" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <button className="btn btn-outline btn-sm" onClick={handleAiSuggest} disabled={aiLoading}
                                                style={{ background: aiLoading ? 'var(--bg-input)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                                {aiLoading ? '⏳ AI analizira...' : '🤖 AI Predloži mjere'}
                                            </button>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI će predložiti mjere i novu ocjenu nakon mjera</span>
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
                                                {riForm.vjerovatnocaNakon > 0 && riForm.posljedlicaNakon > 0 ? (() => {
                                                    const sc2 = riForm.vjerovatnocaNakon * riForm.posljedlicaNakon;
                                                    const rl2 = riskLevel(sc2);
                                                    return <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: rl2.bg, color: rl2.color, fontWeight: 700, fontSize: '1rem', textAlign: 'center', border: `2px solid ${rl2.color}` }}>{sc2} — {rl2.label}</div>;
                                                })() : <div className="form-input" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12, marginBottom: 12 }}>
                                            <div><div style={labelSt}>Odgovorna osoba</div><input className="form-input" value={riForm.odgovornaOsoba || ''} onChange={e => setRi('odgovornaOsoba', e.target.value)} /></div>
                                            <div><div style={labelSt}>Rok provedbe</div><input className="form-input" type="date" value={riForm.rokProvedbe || ''} onChange={e => setRi('rokProvedbe', e.target.value)} /></div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-primary btn-sm" onClick={handleSaveRi}>✔ {lang === 'bs' ? 'Spremi' : 'Save'}</button>
                                            <button className="btn btn-ghost btn-sm" onClick={() => { setShowRiForm(false); setRiEditId(null); }}>✖ {lang === 'bs' ? 'Odustani' : 'Cancel'}</button>
                                        </div>
                                    </div>
                                )}

                                {riSorted.length === 0 && !showRiForm && <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>{lang === 'bs' ? 'Nema stavki. Kliknite na matricu ili "Dodaj stavku".' : 'No items yet.'}</div>}
                                {riSorted.length > 0 && (
                                    <div className="data-table-wrapper"><table className="data-table"><thead><tr>
                                        <th style={{ width: 70 }}></th><th>Radno mjesto</th><th>Opasnost</th>
                                        <th style={{ width: 50, textAlign: 'center' }}>V</th><th style={{ width: 50, textAlign: 'center' }}>P</th>
                                        <th style={{ width: 50, textAlign: 'center' }}>R₀</th><th>Prije</th>
                                        <th style={{ width: 50, textAlign: 'center' }}>R₁</th><th>Nakon</th><th style={{ width: 40 }}></th>
                                    </tr></thead><tbody>
                                        {riSorted.map(ri => {
                                            const rl = riskLevel(ri.rizik || 0);
                                            const rlA = ri.rizikNakon > 0 ? riskLevel(ri.rizikNakon) : null;
                                            const wp = workplaces.find(w => w.id === ri.radnoMjestoId);
                                            const hz = hazards.find(h => h.id === ri.opasnostId);
                                            const improved = rlA && ri.rizikNakon < ri.rizik;
                                            return (
                                                <tr key={ri.id}>
                                                    <td><div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => handleEditRi(ri)}>✏️</button>
                                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteRi(ri.id)}>✖</button>
                                                    </div></td>
                                                    <td style={{ fontSize: '0.82rem' }}>{wp?.naziv || '—'}</td>
                                                    <td style={{ fontSize: '0.82rem' }}>{hz ? `${hz.oznaka || ''} ${hz.naziv}` : '—'}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{ri.vjerovatnoca}×{ri.posljedica}</td>
                                                    <td style={{ textAlign: 'center', fontWeight: 600 }}></td>
                                                    <td style={{ textAlign: 'center', fontWeight: 800, color: rl.color }}>{ri.rizik}</td>
                                                    <td><span style={{ padding: '3px 8px', borderRadius: 12, background: rl.bg, color: rl.color, fontWeight: 700, fontSize: '0.7rem' }}>{rl.label}</span></td>
                                                    <td style={{ textAlign: 'center', fontWeight: 800, color: rlA?.color || 'var(--text-muted)' }}>{ri.rizikNakon || '—'}</td>
                                                    <td>{rlA ? <span style={{ padding: '3px 8px', borderRadius: 12, background: rlA.bg, color: rlA.color, fontWeight: 700, fontSize: '0.7rem' }}>{rlA.label}</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>—</span>}</td>
                                                    <td>{improved && <span style={{ color: '#4caf50', fontWeight: 800 }}>↓</span>}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody></table></div>
                                )}
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
                                                        <button className="btn btn-primary btn-sm" onClick={() => handleImportFromQuestionnaire(q)} disabled={importLoading}
                                                            style={{ minWidth: 90 }}>
                                                            {importLoading ? '⏳' : '↓ Uvezi'}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <button className="btn btn-ghost" onClick={() => setShowImportModal(false)} disabled={importLoading}>Zatvori</button>
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
                            className="mjera-cell"
                        >
                            {display || (
                                ri[field]
                                    ? <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ri[field]}</span>
                                    : <span style={{ color: field === 'predlozeneMjere' ? 'rgba(244,67,54,0.7)' : 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                                        {field === 'predlozeneMjere' ? '⚠ Nije definirano' : '—'}
                                      </span>
                            )}
                            <span className="mjera-cell-edit-hint" style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.65rem', opacity: 0, color: 'var(--primary)', transition: 'opacity 0.15s', pointerEvents: 'none' }}>✏️</span>
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
                                        }}
                                    >
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
                                                    onChange={e => setMjeraEdit(prev => ({ ...prev, value: e.target.value }))}
                                                >
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
                                                    style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                                >Odustani</button>
                                                <button className="btn btn-primary" onClick={() => {
                                                    handleInlineRiUpdate(mjeraEdit.riId, mjeraEdit.field, mjeraEdit.value);
                                                    setMjeraEdit(null);
                                                }}>💾 Spremi</button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>MJERE ZA SMANJENJE RIZIKA (Stavke sa R ≥ 6)</div>
                            {highRisk.length === 0
                                ? <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>{lang === 'bs' ? 'Nema stavki sa rizikom ≥ 6. Sve je u prihvatljivom okviru.' : 'No items with risk ≥ 6.'}</div>
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
                                        const rlA = ri.rizikNakon > 0 ? riskLevel(ri.rizikNakon) : null;
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
                                                <input
                                                    className="form-input"
                                                    type="date"
                                                    style={{ fontSize: '0.75rem', padding: '4px 8px', width: '100%', minWidth: 110 }}
                                                    value={ri.rokProvedbe || ''}
                                                    onChange={(e) => handleInlineRiUpdate(ri.id, 'rokProvedbe', e.target.value)}
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
                    const itemsWithScores = riskItems.filter(ri => ri.rizik > 0);
                    const avgBefore = itemsWithScores.length > 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
                    const itemsWithAfter = riskItems.filter(ri => ri.rizikNakon > 0);
                    const avgAfter = itemsWithAfter.length > 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;
                    const gradeBefore = avgBefore > 0 ? riskLevel(Math.round(avgBefore)) : null;
                    const gradeAfter = avgAfter > 0 ? riskLevel(Math.round(avgAfter)) : null;
                    const bandsAfter = { neznatan: 0, dopustiv: 0, umjeren: 0, znatan: 0, nedopustiv: 0 };
                    itemsWithAfter.forEach(ri => {
                        const s = ri.rizikNakon || 0;
                        if (s <= 5) bandsAfter.neznatan++; else if (s <= 10) bandsAfter.dopustiv++; else if (s <= 15) bandsAfter.umjeren++;
                        else if (s <= 20) bandsAfter.znatan++; else bandsAfter.nedopustiv++;
                    });
                    return (
                    <div className="card"><div className="card-body">
                        {/* ── Overall Grade ── */}
                        {riskItems.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>UKUPNA OCJENA RIZIKA</div>
                                <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                                    <div style={{ textAlign: 'center', padding: '16px 24px', borderRadius: 'var(--radius-lg)', background: gradeBefore ? gradeBefore.bg : 'var(--bg-input)', border: gradeBefore ? `3px solid ${gradeBefore.color}` : '2px solid var(--border-light)', minWidth: 140 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Prije mjera (Početni rizik)</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 900, color: gradeBefore?.color || 'var(--text-muted)' }}>{avgBefore > 0 ? avgBefore.toFixed(1) : '—'}</div>
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
                                {!gradeAfter && itemsWithScores.length > 0 && (
                                    <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(255,193,7,0.1)', border: '1px solid #ffc107', fontSize: '0.82rem', color: '#ffc107' }}>
                                        ⚠ Koristite tab "Procjena rizika" i dugme "🤖 AI Predloži mjere" da dobijete ocjenu nakon mjera.
                                    </div>
                                )}
                            </div>
                        )}
                        {/* ── Distribution cards ── */}
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>DISTRIBUCIJA PO NIVOU RIZIKA</div>
                        {riskItems.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 20 }}>
                                {[
                                    { k: 'neznatan', l: 'Neznatan', c: '#4caf50' }, { k: 'dopustiv', l: 'Dopustiv', c: '#ffc107' },
                                    { k: 'umjeren', l: 'Umjeren', c: '#ff9800' }, { k: 'znatan', l: 'Znatan', c: '#f44336' },
                                    { k: 'nedopustiv', l: 'Nedopustiv', c: '#b71c1c' },
                                ].map(b => (
                                    <div key={b.k} style={{ padding: '10px', borderRadius: 'var(--radius-md)', background: `${b.c}15`, border: `2px solid ${b.c}`, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'baseline' }}>
                                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: b.c }}>{bands[b.k]}</div>
                                            {itemsWithAfter.length > 0 && bandsAfter[b.k] !== bands[b.k] && (
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
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                            <SavedFlash />
                            <button className="btn btn-outline" onClick={handleGenerateReport}
                                style={{ background: 'linear-gradient(135deg, #1a237e 0%, #3f51b5 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                📄 {lang === 'bs' ? 'Preuzmi PDF' : 'Download PDF'}
                            </button>
                            <button className="btn btn-outline" onClick={handleGenerateDocx}
                                style={{ background: 'linear-gradient(135deg, #2E7D32 0%, #66BB6A 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                📗 {lang === 'bs' ? 'Preuzmi Word (.docx)' : 'Download Word (.docx)'}
                            </button>
                        </div>
                    </div></div>
                    );
                })()}
            </div>
        );
    }

    /* ━━━ Vrsta osobe view (unchanged) ━━━ */
    if (view === 'vrstaOsobe') {
        return (
            <div className="animate-fadeIn">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <button className="btn btn-ghost" onClick={() => { setView('list'); cancelPt(); }}>←</button>
                    <h1 style={{ margin: 0 }}>👤 {lang === 'bs' ? 'Vrste osoba' : 'Person Types'}</h1>
                </div>
                <DialogRenderer />
                <div className="card"><div className="card-body">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={startNewPt}>+ {lang === 'bs' ? 'Dodaj' : 'Add'}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'} value={searchPt} onChange={e => setSearchPt(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                    </div>
                    <div className="data-table-wrapper"><table className="data-table"><thead><tr>
                        <th style={{ width: 90 }}></th><th>{lang === 'bs' ? 'Naziv' : 'Name'}</th><th>{lang === 'bs' ? 'Vrsta' : 'Type'}</th>
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
                    <h1 style={{ margin: 0 }}>⚠️ {lang === 'bs' ? 'Opasnosti' : 'Hazards'}</h1>
                </div>
                <DialogRenderer />
                <div className="card"><div className="card-body">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={startNewHaz}>+ {lang === 'bs' ? 'Dodaj' : 'Add'}</button>
                        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}>
                            <input placeholder={lang === 'bs' ? 'Pretraži...' : 'Search...'} value={searchHaz} onChange={e => setSearchHaz(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                        </div>
                    </div>
                    <div className="data-table-wrapper"><table className="data-table"><thead><tr>
                        <th style={{ width: 90 }}></th><th>{lang === 'bs' ? 'Naziv' : 'Name'}</th><th>{lang === 'bs' ? 'Oznaka' : 'Code'}</th>
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

