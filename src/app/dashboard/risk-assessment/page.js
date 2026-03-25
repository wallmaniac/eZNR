'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    getAll, create, update, remove, COLLECTIONS, formatDate, todayISO,
} from '@/lib/dataStore';
import { getSessionsForQuestionnaire } from '@/lib/firebaseSync';
import HelpTip from '@/components/HelpTip';
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

    const [view, setView] = useState('list');
    const [records, setRecords] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ ...EMPTY_PROCJENA });
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('opsti');

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

    const loadData = useCallback(() => {
        setRecords(getAll(COLLECTIONS.RISK_ASSESSMENTS));
        setPersonTypes(getAll(COLLECTIONS.PERSON_TYPES));
        setHazards(getAll(COLLECTIONS.HAZARDS));
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        setQuestionnaires(getAll(COLLECTIONS.QUESTIONNAIRES).filter(q => q.dodajUPrilogProcjeniRizika === 'Dodaje se u procjenu rizika'));
        setSistematizacije(getAll(COLLECTIONS.SISTEMATIZACIJE));
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
    const handleSave = () => {
        if (!formData.nazivTvrtke) { alert(lang === 'bs' ? 'Naziv tvrtke je obavezan!' : 'Company name is required!'); return; }
        let savedId = editingId;
        if (editingId) update(COLLECTIONS.RISK_ASSESSMENTS, editingId, formData);
        else { const n = create(COLLECTIONS.RISK_ASSESSMENTS, formData); savedId = n.id; setEditingId(savedId); }
        loadData();
    };

    // ─── Risk Items CRUD ───
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
                window.alert('AI greška: ' + (data.error || 'Nepoznata greška') + (data.raw ? '\n\nRaw: ' + data.raw.substring(0, 200) : ''));
            }
        } catch (err) { window.alert('Greška: ' + err.message); }
        setImportLoading(false);
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
        } catch (err) { window.alert('Greška: ' + err.message); }
        setConclusionLoading(false);
    };

    // ─── PDF Report Generator ───
    const handleGenerateReport = () => {
        const itemsWithScores = riskItems.filter(ri => ri.rizik > 0);
        const avgBefore = itemsWithScores.length > 0 ? itemsWithScores.reduce((s, ri) => s + ri.rizik, 0) / itemsWithScores.length : 0;
        const itemsWithAfter = riskItems.filter(ri => ri.rizikNakon > 0);
        const avgAfter = itemsWithAfter.length > 0 ? itemsWithAfter.reduce((s, ri) => s + ri.rizikNakon, 0) / itemsWithAfter.length : 0;
        const gradeBefore = avgBefore > 0 ? riskLevel(Math.round(avgBefore)) : null;
        const gradeAfter = avgAfter > 0 ? riskLevel(Math.round(avgAfter)) : null;
        const sorted = [...riskItems].sort((a, b) => (b.rizik || 0) - (a.rizik || 0));
        const highRiskItems = riskItems.filter(ri => ri.rizik >= 6).sort((a, b) => b.rizik - a.rizik);
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

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Akt o procjeni rizika — ${formData.nazivTvrtke || 'Procjena'}</title>
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
        <div style="font-size:16pt;font-weight:700;color:#1a237e">${formData.nazivTvrtke || '—'}</div>
        <div style="font-size:10pt;color:#666;margin-top:4px">${formData.sjediste || ''}</div>
        <div style="font-size:10pt;color:#666">${formData.djelatnost || ''}</div>
    </div>
    <div class="meta">Datum izrade: ${formData.datumIzrade ? new Date(formData.datumIzrade).toLocaleDateString('hr-HR') : today}</div>
    <div class="meta">Revizija: ${formData.revizija || '1'}</div>
    ${formData.ovlOrganizacija ? `<div class="meta" style="margin-top:16px">Izradila: ${formData.ovlOrganizacija}</div>` : ''}
    ${formData.ovlOsobaIme ? `<div class="meta">Ovlaštena osoba: ${formData.ovlOsobaIme} ${formData.ovlOsobaKvalifikacije ? '(' + formData.ovlOsobaKvalifikacije + ')' : ''}</div>` : ''}
</div>

<!-- SECTION 1: GENERAL DATA -->
<h2>1. Opšti podaci o poslodavcu</h2>
<div class="info-grid">
    <dt>Naziv:</dt><dd>${formData.nazivTvrtke || '—'}</dd>
    <dt>Sjedište:</dt><dd>${formData.sjediste || '—'}</dd>
    <dt>Djelatnost:</dt><dd>${formData.djelatnost || '—'}</dd>
    <dt>Ukupno zaposlenih:</dt><dd>${formData.ukupnoZaposlenih || '—'}</dd>
    <dt>Ovlaštena organizacija:</dt><dd>${formData.ovlOrganizacija || '—'}</dd>
    <dt>Ovlaštena osoba:</dt><dd>${formData.ovlOsobaIme || '—'} ${formData.ovlOsobaKvalifikacije ? '(' + formData.ovlOsobaKvalifikacije + ')' : ''}</dd>
</div>

<!-- SECTION 2: PROCESS -->
<h2>2. Opis tehničko-tehnološkog procesa</h2>
<p>${(formData.opisProcesa || 'Nije uneseno.').replace(/\n/g, '<br>')}</p>
${formData.analizaOrganizacije ? `<h3>Analiza organizacije rada</h3><p>${formData.analizaOrganizacije.replace(/\n/g, '<br>')}</p>` : ''}

<!-- SECTION 3: RISK MATRIX RESULTS -->
<h2>3. Procjena rizika — rezultati</h2>
<p>Ukupno procijenjeno: <strong>${riskItems.length}</strong> stavki na <strong>${[...new Set(riskItems.map(r => r.radnoMjestoId))].length}</strong> radnih mjesta.</p>
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
<div class="conclusion">${(formData.zakljucak || 'Zaključak nije unesen.').replace(/\n/g, '<br>')}</div>

<div style="margin-top:60px;display:flex;justify-content:space-between">
    <div style="text-align:center;min-width:200px"><div style="border-top:1px solid #333;padding-top:6px;font-size:9pt">Poslodavac</div></div>
    <div style="text-align:center;min-width:200px"><div style="border-top:1px solid #333;padding-top:6px;font-size:9pt">Ovlaštena osoba za ZNR</div></div>
</div>

<div class="footer">Akt o procjeni rizika — ${formData.nazivTvrtke || ''} — Generisano: ${today} — eZNR Platform</div>

<button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:12px 24px;font-size:14px;cursor:pointer;background:#3f51b5;color:white;border:none;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:999">📄 Preuzmi PDF (Print)</button>
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
        const filtered = search ? records.filter(r => (r.nazivTvrtke || '').toLowerCase().includes(search.toLowerCase())) : records;
        return (
            <div className="animate-fadeIn">
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
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} {lang === 'bs' ? 'zapisa' : 'records'}</span>
                    </div>
                </div>
                <div className="card"><div className="card-body"><div className="data-table-wrapper">
                    <table className="data-table"><thead><tr>
                        <th>{t('actions')}</th><th>{lang === 'bs' ? 'Naziv tvrtke' : 'Company'}</th>
                        <th>{lang === 'bs' ? 'Revizija' : 'Revision'}</th><th>{lang === 'bs' ? 'Datum' : 'Date'}</th>
                        <th>{lang === 'bs' ? 'Status' : 'Status'}</th><th>{lang === 'bs' ? 'Stavki' : 'Items'}</th>
                    </tr></thead><tbody>
                        {filtered.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t('noRecords')}</td></tr>
                        : filtered.map(r => {
                            const cnt = getAll(COLLECTIONS.RISK_ITEMS).filter(ri => ri.procjenaId === r.id).length;
                            const st = r.status || 'draft';
                            return (
                                <tr key={r.id}>
                                    <td><div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(r)}>✏️</button>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(r.id)}>🗑️</button>
                                    </div></td>
                                    <td style={{ fontWeight: 600 }}>{r.nazivTvrtke || '—'}</td>
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
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                            <button className="btn btn-ghost" onClick={() => setView('list')}>↩ {lang === 'bs' ? 'Odustani' : 'Cancel'}</button>
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
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
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
                    </div>
                )}

                {/* ── TAB: Mjere ── */}
                {activeTab === 'mjere' && (
                    <div className="card"><div className="card-body">
                        <div style={{ ...labelSt, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: 14 }}>MJERE ZA SMANJENJE RIZIKA (Stavke sa R ≥ 6)</div>
                        {highRisk.length === 0 ? <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>{lang === 'bs' ? 'Nema stavki sa rizikom ≥ 6. Sve je u prihvatljivom okviru.' : 'No items with risk ≥ 6.'}</div>
                        : <div className="data-table-wrapper"><table className="data-table"><thead><tr>
                            <th>R₀</th><th>R₁</th><th>Opasnost</th><th>Radno mjesto</th><th>Postojeće mjere</th><th>Predložene mjere</th><th>Odgovorna osoba</th><th>Rok</th>
                        </tr></thead><tbody>
                            {highRisk.sort((a, b) => b.rizik - a.rizik).map(ri => {
                                const rl = riskLevel(ri.rizik); const rlA = ri.rizikNakon > 0 ? riskLevel(ri.rizikNakon) : null;
                                const hp = hazards.find(h => h.id === ri.opasnostId); const wp = workplaces.find(w => w.id === ri.radnoMjestoId);
                                return <tr key={ri.id}>
                                    <td><span style={{ padding: '3px 10px', borderRadius: 12, background: rl.bg, color: rl.color, fontWeight: 800, fontSize: '0.78rem' }}>{ri.rizik}</span></td>
                                    <td>{rlA ? <span style={{ padding: '3px 10px', borderRadius: 12, background: rlA.bg, color: rlA.color, fontWeight: 800, fontSize: '0.78rem' }}>{ri.rizikNakon}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{hp ? `${hp.oznaka || ''} ${hp.naziv}` : ri.opisOpasnosti || '—'}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{wp?.naziv || '—'}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{ri.postojeceMjere || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{ri.predlozeneMjere || <span style={{ color: 'var(--danger)' }}>⚠ Nije definirano</span>}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{ri.odgovornaOsoba || '—'}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{ri.rokProvedbe ? formatDate(ri.rokProvedbe) : '—'}</td>
                                </tr>;
                            })}
                        </tbody></table></div>}
                    </div></div>
                )}

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
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-primary" onClick={handleSave}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                            <button className="btn btn-outline" onClick={handleGenerateReport}
                                style={{ background: 'linear-gradient(135deg, #1a237e 0%, #3f51b5 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                📄 {lang === 'bs' ? 'Preuzmi izvještaj (PDF)' : 'Download Report (PDF)'}
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
