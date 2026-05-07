'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCountry } from '@/contexts/CountryContext';
import { getAll, getById, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';
import HelpTip from '@/components/HelpTip';
import { apiGenerateSistematizacija, apiParseSistematizacija } from '@/lib/sistematizacijaAI';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { getDefaultPravniOsnov } from '@/lib/lawConfig';


/* ═══════════════════════════════════════════════
   Sistematizacija radnih mjesta
   ═══════════════════════════════════════════════ */

const labelSt = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 };
const COND_CATEGORIES = ['fizicki', 'kemijski', 'bioloski', 'ergonomski', 'psihosocijalni'];
const COND_LABELS = { fizicki: 'Fizički', kemijski: 'Kemijski', bioloski: 'Biološki', ergonomski: 'Ergonomski', psihosocijalni: 'Psihosocijalni' };

export default function SistematizacijaPage() {
    const { t, lang } = useLanguage();
    const country = useCountry();
    const { alert, confirm, DialogRenderer } = useDialog();
    const [workplaces, setWorkplaces] = useState([]);
    const [sistematizacije, setSistematizacije] = useState([]);
    const [orgUnits, setOrgUnits] = useState([]);
    const [selectedWp, setSelectedWp] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [editData, setEditData] = useState(null);
    const [searchQ, setSearchQ] = useState('');
    const { showFlash, SavedFlash } = useSavedFlash();
    const { activeCompanyId } = useAuth();
    const activeCompany = getById(COLLECTIONS.COMPANIES, activeCompanyId) || {};

    const loadData = useCallback(() => {
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        setSistematizacije(getAll(COLLECTIONS.SISTEMATIZACIJE));
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
    }, []);

    useEffect(() => {
        loadData();
        window.addEventListener('eznr:data-synced', loadData);
        return () => window.removeEventListener('eznr:data-synced', loadData);
    }, [loadData]);

    const getSistForWp = (wpId) => sistematizacije.find(s => s.radnoMjestoId === wpId);

    // ─── AI Generate ───
    const handleAIGenerate = async (wp) => {
        setAiLoading(true);
        setSelectedWp(wp.id);
        try {
            const ou = orgUnits.find(o => o.id === wp.orgUnitId);
            const { data, error } = await apiGenerateSistematizacija({
                workplaceName: wp.naziv,
                oznaka: wp.oznaka || '',
                strucnaSprema: wp.strucnaSprema || '',
                industry: activeCompany.djelatnost || '',
                companyName: activeCompany.naziv || '',
                numberOfWorkers: '',
                orgUnit: ou?.naziv || '',
                radnoVrijemeOd: wp.radnoVrijemeOd || '',
                radnoVrijemeDo: wp.radnoVrijemeDo || '',
                additionalInfo: wp.opis || '',
            });
            
            if (data) {
                const existing = getSistForWp(wp.id);
                if (existing) {
                    update(COLLECTIONS.SISTEMATIZACIJE, existing.id, { ...data, radnoMjestoId: wp.id, aiGenerated: true });
                } else {
                    create(COLLECTIONS.SISTEMATIZACIJE, { ...data, radnoMjestoId: wp.id, aiGenerated: true });
                }
                loadData();
            } else { await alert('AI greška: ' + error); }
        } catch (err) { await alert('Greška: ' + err.message); }
        setAiLoading(false);
        setSelectedWp(null);
    };

    // ─── Upload & Parse ───
    const handleFileUpload = async (wp, event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setUploadLoading(true);
        setSelectedWp(wp.id);
        try {
            const text = await file.text();
            const { data, error } = await apiParseSistematizacija(text, wp.naziv);
            
            if (data) {
                const existing = getSistForWp(wp.id);
                if (existing) {
                    update(COLLECTIONS.SISTEMATIZACIJE, existing.id, { ...data, radnoMjestoId: wp.id, uploadedFile: file.name, aiGenerated: false });
                } else {
                    create(COLLECTIONS.SISTEMATIZACIJE, { ...data, radnoMjestoId: wp.id, uploadedFile: file.name, aiGenerated: false });
                }
                loadData();
            } else { await alert('Greška: ' + error); }
        } catch (err) { await alert('Greška: ' + err.message); }
        setUploadLoading(false);
        setSelectedWp(null);
    };

    // ─── Print / Export ───
    const handlePrintSist = (sist, wp, ou) => {
        const logoHtml = activeCompany.logo ? `<img src="${activeCompany.logo}" style="height:60px;max-width:200px;object-fit:contain;margin-bottom:10px" />` : '';
        const today = new Date().toLocaleDateString('bs-BA');
        
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
            <title>Sistematizacija - ${wp?.naziv}</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; padding: 40px; margin: 0 auto; max-width: 800px; line-height: 1.5; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                h1 { font-size: 18pt; margin: 5px 0; text-transform: uppercase; letter-spacing: 1px; }
                .comp-name { font-size: 12pt; font-weight: bold; color: #555; }
                .sect { margin-bottom: 20px; }
                .s-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; color: #555; border-bottom: 1px solid #ccc; margin-bottom: 8px; padding-bottom: 2px; }
                .val { font-weight: bold; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
                ul { margin: 5px 0; padding-left: 20px; }
                .footer { margin-top: 50px; display: flex; justify-content: space-between; font-size: 10pt; }
                .sig-box { text-align: center; width: 220px; }
                .sig-line { border-bottom: 1px solid #000; height: 40px; margin-bottom: 5px; }
                @media print { body { padding: 0; } button { display: none !important; } }
            </style></head><body>
            <div class="header">
                ${logoHtml}
                <div class="comp-name">${activeCompany.naziv || ''}</div>
                <h1>OPIS I POPIS POSLOVA</br>(SISTEMATIZACIJA)</h1>
            </div>
            
            <div class="grid">
                <div><span class="s-title">RADNO MJESTO:</span><br/><span class="val">${wp?.naziv || ''}</span></div>
                <div><span class="s-title">ORG. JEDINICA:</span><br/><span class="val">${ou?.naziv || '—'}</span></div>
                <div><span class="s-title">KATEGORIJA:</span><br/><span class="val">${sist.kategorijaRM || '—'}</span></div>
                <div><span class="s-title">SLOŽENOST POSLOVA:</span><br/><span class="val">${sist.slozenostPoslova || '—'}</span></div>
            </div>

            <div class="sect">
                <div class="s-title">OPIS POSLOVA I ZADATAKA</div>
                <div>${(sist.opisPoslova || '—').replace(/\\n/g, '<br/>')}</div>
            </div>

            <div class="sect">
                <div class="s-title">ODGOVORNOSTI</div>
                <div>${(sist.odgovornosti || '—').replace(/\\n/g, '<br/>')}</div>
            </div>

            <div class="grid">
                <div><span class="s-title">STRUČNA SPREMA:</span> <span class="val">${sist.strucnaSprema || wp?.strucnaSprema || '—'}</span></div>
                <div><span class="s-title">RADNO ISKUSTVO:</span> <span class="val">${sist.radnoIskustvo || '—'}</span></div>
                <div><span class="s-title">BROJ IZVRŠILACA:</span> <span class="val">${sist.brojIzvrsilaca || 1}</span></div>
                <div><span class="s-title">PROBNI RAD:</span> <span class="val">${sist.probniRad || '—'}</span></div>
            </div>

            <div class="sect">
                <div class="s-title">POSEBNI UVJETI RADA</div>
                <div>${sist.posebniUvjeti?.length > 0 ? Object.values(sist.posebniUvjeti).join(', ') : 'Nema posebnih uvjeta'}</div>
            </div>

            <div class="grid">
                <div>
                    <div class="s-title">POTREBNA LZO (OZO)</div>
                    <ul>${(sist.potrebnaOZO || []).map(o => '<li>'+o+'</li>').join('') || '<li>—</li>'}</ul>
                </div>
                <div>
                    <div class="s-title">ZDRAVSTVENI ZAHTJEVI</div>
                    <ul>${(sist.zdravstveniZahtjevi || []).map(o => '<li>'+o+'</li>').join('') || '<li>—</li>'}</ul>
                </div>
                <div>
                    <div class="s-title">RADNA OPREMA</div>
                    <ul>${(sist.radnaOprema || []).map(o => '<li>'+o+'</li>').join('') || '<li>—</li>'}</ul>
                </div>
                <div>
                    <div class="s-title">POTREBNE OBUKE / CERTIFIKATI</div>
                    <ul>${([...(sist.potrebneObuke || []), ...(sist.certifikati || [])]).map(o => '<li>'+o+'</li>').join('') || '<li>—</li>'}</ul>
                </div>
            </div>

            <div class="sect" style="margin-top:40px; font-size:9pt; color:#666;">
                <i>Pravni osnov: ${sist.pravniOsnov || 'Zakon o radu FBiH'}</i>
            </div>

            <button onclick="window.print()" style="margin-top: 20px; padding: 12px 24px; background: #000; color: #fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">🖨️ Isprintaj / Spremi PDF</button>

            <div class="footer">
                <div class="sig-box">
                    <div style="margin-bottom: 40px; text-align: left;">Sastavio:</div>
                    <div class="sig-line"></div>
                    <div>Stručno lice za ZNR</div>
                </div>
                <div class="sig-box">
                    <div style="margin-bottom: 40px; text-align:left;">Odobrio:</div>
                    <div class="sig-line"></div>
                    <div>Direktor / Ovlašteno lice</div>
                </div>
            </div>
            
        </body></html>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); }
    };

    // ─── Manual Edit ───
    const handleSaveEdit = () => {
        if (!editData) return;
        const existing = getSistForWp(editData.radnoMjestoId);
        if (existing) {
            update(COLLECTIONS.SISTEMATIZACIJE, existing.id, editData);
        } else {
            create(COLLECTIONS.SISTEMATIZACIJE, editData);
        }
        loadData();
        setEditData(null);
        showFlash();
    };

    const handleDeleteSist = (wpId) => {
        const s = getSistForWp(wpId);
        if (s) { remove(COLLECTIONS.SISTEMATIZACIJE, s.id); loadData(); }
    };

    // Filter workplaces by search
    const filtered = workplaces.filter(wp => {
        if (!searchQ) return true;
        const q = searchQ.toLowerCase();
        return (wp.naziv || '').toLowerCase().includes(q) || (wp.oznaka || '').toLowerCase().includes(q);
    });

    // Stats
    const totalWp = workplaces.length;
    const completedWp = workplaces.filter(wp => getSistForWp(wp.id)).length;

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <DialogRenderer />
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.4rem' }}>📑 {lang !== 'en' ? 'Sistematizacija radnih mjesta' : 'Job Systematization'}</h1>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {lang !== 'en' ? 'Definirajte poslove, uvjete rada i zahtjeve za svako radno mjesto' : 'Define duties, working conditions, and requirements for each workplace'}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: completedWp === totalWp && totalWp > 0 ? 'rgba(76,175,80,0.15)' : 'rgba(255,193,7,0.15)', border: `1px solid ${completedWp === totalWp && totalWp > 0 ? '#4caf50' : '#ffc107'}`, fontWeight: 700, fontSize: '0.82rem', color: completedWp === totalWp && totalWp > 0 ? '#4caf50' : '#ffc107' }}>
                        {completedWp}/{totalWp} {lang !== 'en' ? 'popunjeno' : 'completed'}
                    </div>
                    <SavedFlash />
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <div className="search-bar" style={{ maxWidth: 360 }}>
                    <input placeholder={lang !== 'en' ? 'Pretraži radna mjesta...' : 'Search workplaces...'} value={searchQ} onChange={e => setSearchQ(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', flex: 1 }} />
                </div>
            </div>

            {/* Workplaces Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))', gap: 14 }}>
                {filtered.map(wp => {
                    const sist = getSistForWp(wp.id);
                    const ou = orgUnits.find(o => o.id === wp.orgUnitId);
                    const isLoading = (aiLoading || uploadLoading) && selectedWp === wp.id;

                    return (
                        <div key={wp.id} className="card" style={{ border: sist ? '2px solid rgba(76,175,80,0.4)' : '2px solid var(--border)', transition: 'all 0.2s' }}>
                            <div className="card-body" style={{ padding: 16 }}>
                                {/* Workplace Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{wp.naziv}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {wp.oznaka && <span style={{ marginRight: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(102,126,234,0.15)', color: '#667eea', fontWeight: 600 }}>{wp.oznaka}</span>}
                                            {ou?.naziv || ''} {wp.strucnaSprema && `• ${wp.strucnaSprema}`}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '1.2rem' }}>{sist ? '✅' : '⚠️'}</div>
                                </div>

                                {/* Sistematizacija Content */}
                                {sist ? (
                                    <div>
                                        {sist.nazivPosla && <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>{sist.nazivPosla}</div>}
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.5, marginBottom: 10, maxHeight: 60, overflow: 'hidden' }}>
                                            {sist.opisPoslova || '—'}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                            {sist.kategorijaRM && <span style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(102,126,234,0.12)', color: '#667eea', fontSize: '0.68rem', fontWeight: 600 }}>{sist.kategorijaRM}</span>}
                                            {sist.slozenostPoslova && <span style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: '0.68rem', fontWeight: 600 }}>{sist.slozenostPoslova}</span>}
                                            {(sist.potrebnaOZO || []).slice(0, 3).map((ozo, i) => (
                                                <span key={i} style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(0,191,166,0.15)', color: 'var(--primary)', fontSize: '0.68rem', fontWeight: 600 }}>🦺 {ozo}</span>
                                            ))}
                                            {(sist.potrebnaOZO || []).length > 3 && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>+{sist.potrebnaOZO.length - 3}</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                                            <span>📋 {sist.certifikati?.length || 0} cert.</span>
                                            <span>⚙️ {sist.radnaOprema?.length || 0} oprema</span>
                                            <span>👥 {sist.brojIzvrsilaca || '?'} izvrš.</span>
                                            {sist.probniRad && <span>⏱️ {sist.probniRad}</span>}
                                            {sist.aiGenerated && <span style={{ color: '#667eea' }}>🤖 AI</span>}
                                            {sist.uploadedFile && <span style={{ color: '#f59e0b' }}>📄 {sist.uploadedFile}</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => setEditData({ ...sist })}>✏️ {lang !== 'en' ? 'Detalji' : 'Details'}</button>
                                            <button className="btn btn-outline btn-sm" onClick={() => handlePrintSist(sist, wp, ou)} style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>🖨️ {lang !== 'en' ? 'Isprintaj' : 'Print'}</button>
                                            <button className="btn btn-outline btn-sm" onClick={() => handleAIGenerate(wp)} disabled={isLoading}
                                                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                                                {isLoading ? (lang !== 'en' ? '⏳ Regeneriše...' : '⏳ Regenerating...') : (lang !== 'en' ? '🤖 Regeneriši' : '🤖 Regenerate')}
                                            </button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteSist(wp.id)}>✖</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12, padding: 10, textAlign: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                                            {lang !== 'en' ? 'Nema sistematizacije. Generiši putem AI ili učitaj dokument.' : 'No systematization data. Generate via AI or upload a document.'}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => handleAIGenerate(wp)} disabled={isLoading}
                                                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                                {isLoading ? '⏳ Generiše...' : '🤖 AI Generiši'}
                                            </button>
                                            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                                📄 {lang !== 'en' ? 'Učitaj dokument' : 'Upload document'}
                                                <input type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleFileUpload(wp, e)} />
                                            </label>
                                            <button className="btn btn-outline btn-sm" onClick={() => setEditData({ radnoMjestoId: wp.id, nazivPosla: '', opisPoslova: '', odgovornosti: '', strucnaSprema: wp.strucnaSprema || '', radnoIskustvo: '', posebniUvjeti: [], brojIzvrsilaca: 1, kategorijaRM: '', slozenostPoslova: '', probniRad: '', pravniOsnov: getDefaultPravniOsnov(country), uvjetiRada: { fizicki: [], kemijski: [], bioloski: [], ergonomski: [], psihosocijalni: [] }, potrebnaOZO: [], radnaOprema: [], zdravstveniZahtjevi: [], certifikati: [], potrebneObuke: [], napomena: '' })}>
                                                ✏️ {lang !== 'en' ? 'Ručno' : 'Manual'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {workplaces.length === 0 && (
                <div className="card"><div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    {lang !== 'en' ? 'Nema radnih mjesta. Kreirajte ih u modulu Radna mjesta.' : 'No workplaces found. Create them in the Workplaces module.'}
                </div></div>
            )}

            {/* Detail/Edit Modal */}
            {editData && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
                    onClick={e => { if (e.target === e.currentTarget) setEditData(null); }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, width: '90%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                                📑 Sistematizacija — {workplaces.find(w => w.id === editData.radnoMjestoId)?.naziv || ''}
                            </div>
                            <button className="btn btn-ghost btn-icon" onClick={() => setEditData(null)} style={{ fontSize: '1.2rem', padding: 4 }}>✕</button>
                        </div>

                        {/* Naziv posla + Kategorija + Složenost */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                            <div>
                                <div style={labelSt}>NAZIV POSLA</div>
                                <input className="form-input" value={editData.nazivPosla || ''} onChange={e => setEditData(p => ({ ...p, nazivPosla: e.target.value }))} placeholder="npr. Stručni saradnik za ZNR" />
                            </div>
                            <div>
                                <div style={labelSt}>KATEGORIJA RM</div>
                                <select className="form-select" value={editData.kategorijaRM || ''} onChange={e => setEditData(p => ({ ...p, kategorijaRM: e.target.value }))}>
                                    <option value="">—</option>
                                    {['Rukovodeće', 'Izvršno', 'Pomoćno'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <div style={labelSt}>SLOŽENOST</div>
                                <select className="form-select" value={editData.slozenostPoslova || ''} onChange={e => setEditData(p => ({ ...p, slozenostPoslova: e.target.value }))}>
                                    <option value="">—</option>
                                    {['Jednostavni', 'Srednje složeni', 'Složeni', 'Visoko složeni'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Opis poslova */}
                        <div style={labelSt}>OPIS POSLOVA I ZADATAKA</div>
                        <textarea className="form-input" rows={3} value={editData.opisPoslova || ''} onChange={e => setEditData(p => ({ ...p, opisPoslova: e.target.value }))} style={{ resize: 'vertical', marginBottom: 12 }} />

                        {/* Odgovornosti */}
                        <div style={labelSt}>ODGOVORNOSTI</div>
                        <textarea className="form-input" rows={2} value={editData.odgovornosti || ''} onChange={e => setEditData(p => ({ ...p, odgovornosti: e.target.value }))} placeholder="Ključne odgovornosti na radnom mjestu" style={{ resize: 'vertical', marginBottom: 12 }} />

                        {/* Grid: Sprema + Iskustvo + Broj + Probni rad */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 1fr', gap: 10, marginBottom: 12 }}>
                            <div>
                                <div style={labelSt}>STRUČNA SPREMA</div>
                                <select className="form-select" value={editData.strucnaSprema || ''} onChange={e => setEditData(p => ({ ...p, strucnaSprema: e.target.value }))}>
                                    <option value="">—</option>
                                    {['NKV', 'PKV', 'KV', 'SSS', 'VŠS', 'VSS', 'Mr.', 'Dr.'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <div style={labelSt}>RADNO ISKUSTVO</div>
                                <input className="form-input" value={editData.radnoIskustvo || ''} onChange={e => setEditData(p => ({ ...p, radnoIskustvo: e.target.value }))} placeholder="npr. 2 godine" />
                            </div>
                            <div>
                                <div style={labelSt}>IZVRŠILACA</div>
                                <input className="form-input" type="number" min={1} value={editData.brojIzvrsilaca || 1} onChange={e => setEditData(p => ({ ...p, brojIzvrsilaca: +e.target.value }))} />
                            </div>
                            <div>
                                <div style={labelSt}>PROBNI RAD</div>
                                <input className="form-input" value={editData.probniRad || ''} onChange={e => setEditData(p => ({ ...p, probniRad: e.target.value }))} placeholder="npr. 3 mjeseca" />
                            </div>
                        </div>

                        {/* Posebni uvjeti */}
                        <div style={{...labelSt, display: 'flex', alignItems: 'center', gap: 6}}>POSEBNI UVJETI <HelpTip text="Označite specifične uvjete rada zbog kojih ovo mjesto ima poseban tretman pri zaštiti na radu (npr. Rad na visini preko 3m, Rad sa otrovima, Podzemni radovi...)" /></div>
                        <input className="form-input" value={(editData.posebniUvjeti || []).join(', ')} onChange={e => setEditData(p => ({ ...p, posebniUvjeti: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="Razdvojite zarezom" style={{ marginBottom: 12 }} />

                        {/* Uvjeti rada */}
                        <div style={labelSt}>UVJETI RADA</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                            {COND_CATEGORIES.map(cat => (
                                <div key={cat}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{COND_LABELS[cat]}</div>
                                    <input className="form-input" value={(editData.uvjetiRada?.[cat] || []).join(', ')} onChange={e => setEditData(p => ({ ...p, uvjetiRada: { ...(p.uvjetiRada || {}), [cat]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } }))} placeholder="Razdvojite zarezom" style={{ fontSize: '0.78rem' }} />
                                </div>
                            ))}
                        </div>

                        {/* OZO + Oprema + Zdravstvo + Certifikati + Obuke */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                            <div>
                                <div style={{...labelSt, display: 'flex', alignItems: 'center', gap: 6}}>POTREBNA OZO <HelpTip text="Najbitnija lična/osobna zaštitna oprema (Osobna Zaštitna Oprema) koju radnik obavezno zadužuje na ovom radnom mjestu (npr. Sigurnosni šljem, Cipele S3, Vizir...)" /></div>
                                <textarea className="form-input" rows={2} value={(editData.potrebnaOZO || []).join('\n')} onChange={e => setEditData(p => ({ ...p, potrebnaOZO: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} />
                            </div>
                            <div>
                                <div style={{...labelSt, display: 'flex', alignItems: 'center', gap: 6}}>RADNA OPREMA <HelpTip text="Sva velika/kritična oprema koju mašinista ili vozač koristi, zbog koje radnik polaže certifikate (npr. Bager, Viljuškar, Cirkular, Dizalica...)" /></div>
                                <textarea className="form-input" rows={2} value={(editData.radnaOprema || []).join('\n')} onChange={e => setEditData(p => ({ ...p, radnaOprema: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} />
                            </div>
                            <div>
                                <div style={{...labelSt, display: 'flex', alignItems: 'center', gap: 6}}>ZDRAVSTVENI ZAHTJEVI <HelpTip text="Medicinska ograničenja (npr. Očuvan vid, Sluh bez pomagala, Psihička stabilnost...). Doktor ukazuje na ove zahtjeve na Ljekarskom uvjerenju." /></div>
                                <textarea className="form-input" rows={2} value={(editData.zdravstveniZahtjevi || []).join('\n')} onChange={e => setEditData(p => ({ ...p, zdravstveniZahtjevi: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} />
                            </div>
                            <div>
                                <div style={labelSt}>POTREBNI CERTIFIKATI</div>
                                <textarea className="form-input" rows={2} value={(editData.certifikati || []).join('\n')} onChange={e => setEditData(p => ({ ...p, certifikati: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} />
                            </div>
                            <div>
                                <div style={labelSt}>POTREBNE OBUKE</div>
                                <textarea className="form-input" rows={2} value={(editData.potrebneObuke || []).join('\n')} onChange={e => setEditData(p => ({ ...p, potrebneObuke: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} />
                            </div>
                            <div>
                                <div style={labelSt}>PRAVNI OSNOV</div>
                                <input className="form-input" value={editData.pravniOsnov || ''} onChange={e => setEditData(p => ({ ...p, pravniOsnov: e.target.value }))} placeholder={getDefaultPravniOsnov(country)} style={{ fontSize: '0.78rem' }} />
                            </div>
                        </div>

                        {/* Napomena */}
                        <div style={labelSt}>NAPOMENA</div>
                        <textarea className="form-input" rows={2} value={editData.napomena || ''} onChange={e => setEditData(p => ({ ...p, napomena: e.target.value }))} style={{ resize: 'vertical', marginBottom: 16 }} />

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" onClick={handleSaveEdit}>💾 {t('save')}</button>
                            <button className="btn btn-ghost" onClick={() => setEditData(null)}>{lang !== 'en' ? 'Zatvori' : 'Close'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
