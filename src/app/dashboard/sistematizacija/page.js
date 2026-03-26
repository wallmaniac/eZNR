'use client';
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, create, update, remove, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSavedFlash } from '@/hooks/useSavedFlash';

/* ═══════════════════════════════════════════════
   Sistematizacija radnih mjesta
   ═══════════════════════════════════════════════ */

const labelSt = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 };
const COND_CATEGORIES = ['fizicki', 'kemijski', 'bioloski', 'ergonomski', 'psihosocijalni'];
const COND_LABELS = { fizicki: 'Fizički', kemijski: 'Kemijski', bioloski: 'Biološki', ergonomski: 'Ergonomski', psihosocijalni: 'Psihosocijalni' };

export default function SistematizacijaPage() {
    const { t, lang } = useLanguage();
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

    const loadData = useCallback(() => {
        setWorkplaces(getAll(COLLECTIONS.WORKPLACES));
        setSistematizacije(getAll(COLLECTIONS.SISTEMATIZACIJE));
        setOrgUnits(getAll(COLLECTIONS.ORG_UNITS));
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const getSistForWp = (wpId) => sistematizacije.find(s => s.radnoMjestoId === wpId);

    // ─── AI Generate ───
    const handleAIGenerate = async (wp) => {
        setAiLoading(true);
        setSelectedWp(wp.id);
        try {
            const ou = orgUnits.find(o => o.id === wp.orgUnitId);
            const res = await fetch('/api/generate-sistematizacija', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workplaceName: wp.naziv,
                    oznaka: wp.oznaka || '',
                    strucnaSprema: wp.strucnaSprema || '',
                    industry: '', // TODO: can pull from company data
                    numberOfWorkers: '',
                    orgUnit: ou?.naziv || '',
                    additionalInfo: wp.opis || '',
                }),
            });
            const data = await res.json();
            if (data.success && data.sistematizacija) {
                const existing = getSistForWp(wp.id);
                if (existing) {
                    update(COLLECTIONS.SISTEMATIZACIJE, existing.id, { ...data.sistematizacija, radnoMjestoId: wp.id, aiGenerated: true });
                } else {
                    create(COLLECTIONS.SISTEMATIZACIJE, { ...data.sistematizacija, radnoMjestoId: wp.id, aiGenerated: true });
                }
                loadData();
            } else { await alert('AI greška: ' + (data.error || 'Nepoznata greška')); }
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
            const res = await fetch('/api/parse-sistematizacija', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentText: text, workplaceName: wp.naziv }),
            });
            const data = await res.json();
            if (data.success && data.sistematizacija) {
                const existing = getSistForWp(wp.id);
                if (existing) {
                    update(COLLECTIONS.SISTEMATIZACIJE, existing.id, { ...data.sistematizacija, radnoMjestoId: wp.id, uploadedFile: file.name, aiGenerated: false });
                } else {
                    create(COLLECTIONS.SISTEMATIZACIJE, { ...data.sistematizacija, radnoMjestoId: wp.id, uploadedFile: file.name, aiGenerated: false });
                }
                loadData();
            } else { await alert('Greška: ' + (data.error || 'Neuspjelo parsiranje')); }
        } catch (err) { await alert('Greška: ' + err.message); }
        setUploadLoading(false);
        setSelectedWp(null);
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
                    <h1 style={{ margin: 0, fontSize: '1.4rem' }}>📑 {lang === 'bs' ? 'Sistematizacija radnih mjesta' : 'Job Systematization'}</h1>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {lang === 'bs' ? 'Definirajte poslove, uvjete rada i zahtjeve za svako radno mjesto' : 'Define duties, working conditions, and requirements for each workplace'}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: completedWp === totalWp && totalWp > 0 ? 'rgba(76,175,80,0.15)' : 'rgba(255,193,7,0.15)', border: `1px solid ${completedWp === totalWp && totalWp > 0 ? '#4caf50' : '#ffc107'}`, fontWeight: 700, fontSize: '0.82rem', color: completedWp === totalWp && totalWp > 0 ? '#4caf50' : '#ffc107' }}>
                        {completedWp}/{totalWp} {lang === 'bs' ? 'popunjeno' : 'completed'}
                    </div>
                    <SavedFlash />
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <div className="search-bar" style={{ maxWidth: 360 }}>
                    <input placeholder={lang === 'bs' ? 'Pretraži radna mjesta...' : 'Search workplaces...'} value={searchQ} onChange={e => setSearchQ(e.target.value)}
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
                                            <button className="btn btn-outline btn-sm" onClick={() => setEditData({ ...sist })}>✏️ {lang === 'bs' ? 'Detalji' : 'Details'}</button>
                                            <button className="btn btn-outline btn-sm" onClick={() => handleAIGenerate(wp)} disabled={isLoading}
                                                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.72rem' }}>
                                                {isLoading ? '⏳' : '🤖'} {lang === 'bs' ? 'Regeneriši' : 'Regenerate'}
                                            </button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteSist(wp.id)}>✖</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12, padding: 10, textAlign: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)' }}>
                                            {lang === 'bs' ? 'Nema sistematizacije. Generiši putem AI ili učitaj dokument.' : 'No systematization data. Generate via AI or upload a document.'}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => handleAIGenerate(wp)} disabled={isLoading}
                                                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                                {isLoading ? '⏳ Generiše...' : '🤖 AI Generiši'}
                                            </button>
                                            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                                                📄 {lang === 'bs' ? 'Učitaj dokument' : 'Upload document'}
                                                <input type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => handleFileUpload(wp, e)} />
                                            </label>
                                            <button className="btn btn-outline btn-sm" onClick={() => setEditData({ radnoMjestoId: wp.id, nazivPosla: '', opisPoslova: '', odgovornosti: '', strucnaSprema: wp.strucnaSprema || '', radnoIskustvo: '', posebniUvjeti: [], brojIzvrsilaca: 1, kategorijaRM: '', slozenostPoslova: '', probniRad: '', pravniOsnov: 'Čl. 118. Zakona o radu FBiH', uvjetiRada: { fizicki: [], kemijski: [], bioloski: [], ergonomski: [], psihosocijalni: [] }, potrebnaOZO: [], radnaOprema: [], zdravstveniZahtjevi: [], certifikati: [], potrebneObuke: [], napomena: '' })}>
                                                ✏️ {lang === 'bs' ? 'Ručno' : 'Manual'}
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
                    {lang === 'bs' ? 'Nema radnih mjesta. Kreirajte ih u modulu Radna mjesta.' : 'No workplaces found. Create them in the Workplaces module.'}
                </div></div>
            )}

            {/* Detail/Edit Modal */}
            {editData && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
                    onClick={e => { if (e.target === e.currentTarget) setEditData(null); }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 28, width: '90%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
                            📑 Sistematizacija — {workplaces.find(w => w.id === editData.radnoMjestoId)?.naziv || ''}
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
                        <div style={labelSt}>POSEBNI UVJETI</div>
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
                                <div style={labelSt}>POTREBNA OZO</div>
                                <textarea className="form-input" rows={2} value={(editData.potrebnaOZO || []).join('\n')} onChange={e => setEditData(p => ({ ...p, potrebnaOZO: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} />
                            </div>
                            <div>
                                <div style={labelSt}>RADNA OPREMA</div>
                                <textarea className="form-input" rows={2} value={(editData.radnaOprema || []).join('\n')} onChange={e => setEditData(p => ({ ...p, radnaOprema: e.target.value.split('\n').filter(Boolean) }))} placeholder="Jedna stavka po redu" style={{ fontSize: '0.78rem', resize: 'vertical' }} />
                            </div>
                            <div>
                                <div style={labelSt}>ZDRAVSTVENI ZAHTJEVI</div>
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
                                <input className="form-input" value={editData.pravniOsnov || ''} onChange={e => setEditData(p => ({ ...p, pravniOsnov: e.target.value }))} placeholder="Čl. 118. Zakona o radu FBiH" style={{ fontSize: '0.78rem' }} />
                            </div>
                        </div>

                        {/* Napomena */}
                        <div style={labelSt}>NAPOMENA</div>
                        <textarea className="form-input" rows={2} value={editData.napomena || ''} onChange={e => setEditData(p => ({ ...p, napomena: e.target.value }))} style={{ resize: 'vertical', marginBottom: 16 }} />

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" onClick={handleSaveEdit}>💾 {lang === 'bs' ? 'Sačuvaj' : 'Save'}</button>
                            <button className="btn btn-ghost" onClick={() => setEditData(null)}>{lang === 'bs' ? 'Zatvori' : 'Close'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
