'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { matchWorkers, confidenceLabel, extractNameTokens } from '@/lib/textMatch';

// ── CDN loader ────────────────────────────────────────────────────────────────
function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

// ── PDF text extraction via pdf.js ───────────────────────────────────────────
async function extractPdfText(arrayBuffer) {
    const PDFJS_CDN  = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    await loadScript(PDFJS_CDN);
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN;
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        text += tc.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
}

// ── DOCX text extraction via JSZip ───────────────────────────────────────────
async function extractDocxText(arrayBuffer) {
    const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    await loadScript(JSZIP_CDN);
    if (!window.JSZip) throw new Error('JSZip not loaded');
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) throw new Error('Not a valid .docx file');
    const xml = await xmlFile.async('string');
    // Preserve paragraph breaks, strip XML tags
    const text = xml
        .replace(/<w:p[ >]/g, '\n<w:p ')
        .replace(/<w:br[^>]*>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return text;
}

// ── Generate corrected DOCX (replace names in XML and re-zip) ────────────────
async function generateCorrectedDocx(originalArrayBuffer, nameReplacements) {
    const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    await loadScript(JSZIP_CDN);
    const zip = await window.JSZip.loadAsync(originalArrayBuffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) throw new Error('Not a valid .docx');
    let xml = await xmlFile.async('string');
    // Replace each name (case-insensitive, whole-word-ish)
    for (const { original, corrected } of nameReplacements) {
        if (!original || !corrected || original === corrected) continue;
        // Escape for regex
        const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        xml = xml.replace(new RegExp(escaped, 'gi'), corrected);
    }
    zip.file('word/document.xml', xml);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    return blob;
}

// ── Download helpers ─────────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, filename);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ZapisniciPage() {
    const { lang } = useLanguage();
    const { alert, DialogRenderer } = useDialog();

    // File state
    const [docFile, setDocFile]     = useState(null); // { name, arrayBuffer, type }
    const [dragging, setDragging]   = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [extractError, setExtractError] = useState('');
    const fileRef = useRef(null);

    // Processing state
    const [rawText, setRawText]     = useState('');
    const [step, setStep]           = useState('upload'); // 'upload' | 'review' | 'done'

    // Review rows: { id, original, matchedWorker, correctedName, confidence, keep }
    const [rows, setRows]           = useState([]);
    const [generating, setGenerating] = useState(false);

    const workers = useRef([]);
    useEffect(() => {
        workers.current = getAll(COLLECTIONS.WORKERS).filter(w => w.aktivan !== false);
    }, []);

    // ── File read ─────────────────────────────────────────────────────────────
    const handleFileRead = useCallback(async (file) => {
        if (file.size > 20 * 1024 * 1024) {
            await alert(lang === 'bs' ? 'Max veličina datoteke je 20MB!' : 'Max file size is 20MB!');
            return;
        }
        setDocFile({ name: file.name, type: file.type });
        setExtractError('');
        setExtracting(true);
        setStep('upload');

        try {
            const ab = await file.arrayBuffer();
            setDocFile({ name: file.name, type: file.type, arrayBuffer: ab });

            let text = '';
            if (file.name.toLowerCase().endsWith('.docx') || file.type.includes('wordprocessingml')) {
                text = await extractDocxText(ab);
            } else if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
                text = await extractPdfText(ab);
            } else {
                // Plain text fallback
                text = await file.text();
            }

            setRawText(text);

            // Extract name tokens and match against workers
            const tokens = extractNameTokens(text);
            const ws = workers.current;
            const newRows = tokens.map((tok, i) => {
                const matches = matchWorkers(tok.original, '', ws);
                const top = matches[0];
                return {
                    id: i,
                    original: tok.original,
                    matchedWorker: top?.worker || null,
                    correctedName: top ? `${top.worker.ime} ${top.worker.prezime}` : tok.original,
                    confidence: top?.score || 0,
                    keep: true,
                };
            });

            setRows(newRows);
            setStep('review');
        } catch (err) {
            setExtractError(err.message || 'Greška pri čitanju datoteke.');
        } finally {
            setExtracting(false);
        }
    }, [alert, lang]);

    const handleFileDrop = (e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFileRead(f);
    };

    // ── Row actions ───────────────────────────────────────────────────────────
    const updateRow = (id, patch) => setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

    // ── Generate corrected document ───────────────────────────────────────────
    const handleGenerate = async () => {
        const activeRows = rows.filter(r => r.keep && r.original !== r.correctedName);
        if (activeRows.length === 0) {
            await alert(lang === 'bs' ? 'Nema izmjena za primjeniti.' : 'No changes to apply.');
            return;
        }

        const replacements = activeRows.map(r => ({ original: r.original, corrected: r.correctedName }));
        const baseName = (docFile?.name || 'zapisnik').replace(/\.[^.]+$/, '');

        setGenerating(true);
        try {
            if (docFile?.arrayBuffer && (docFile.name.toLowerCase().endsWith('.docx'))) {
                // Corrected DOCX
                const blob = await generateCorrectedDocx(docFile.arrayBuffer, replacements);
                downloadBlob(blob, `${baseName}_ispravljen.docx`);
            } else {
                // Fallback: corrected plain text
                let corrected = rawText;
                for (const { original, corrected: rep } of replacements) {
                    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    corrected = corrected.replace(new RegExp(escaped, 'gi'), rep);
                }
                downloadText(corrected, `${baseName}_ispravljen.txt`);
            }
            setStep('done');
        } catch (err) {
            await alert(`Greška: ${err.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleReset = () => {
        setDocFile(null); setRawText(''); setRows([]); setStep('upload');
        setExtractError(''); setExtracting(false);
    };

    // ── UI helpers ─────────────────────────────────────────────────────────────
    const activeChanges = rows.filter(r => r.keep && r.original !== r.correctedName).length;
    const labelSt = { fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 };

    return (
        <div className="animate-fadeIn">
            <DialogRenderer />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '1.6rem' }}>📋</span>
                    <div>
                        <h1 style={{ margin: 0 }}>{lang === 'bs' ? 'Zapisnici — korekcija imena' : 'Minutes — Name Correction'}</h1>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {lang === 'bs'
                                ? 'Uvezi zapisnik, aplikacija pronalazi i ispravlja pogrešno napisana imena radnika.'
                                : 'Import a record, the app finds and corrects misspelled worker names.'}
                        </p>
                    </div>
                </div>
                {step !== 'upload' && (
                    <button className="btn btn-ghost btn-sm" onClick={handleReset}>
                        ↺ {lang === 'bs' ? 'Novi zapisnik' : 'New record'}
                    </button>
                )}
            </div>

            {/* ── Step 1: Upload ── */}
            {step === 'upload' && (
                <div className="card">
                    <div className="card-body">
                        <div
                            style={{
                                border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)',
                                borderRadius: 'var(--radius-md)', padding: '48px 20px', textAlign: 'center',
                                background: dragging ? 'rgba(0,191,166,0.04)' : 'transparent',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleFileDrop}
                            onClick={() => fileRef.current?.click()}
                        >
                            <div style={{ fontSize: '3rem', marginBottom: 12 }}>
                                {extracting ? '⏳' : dragging ? '📂' : '📋'}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>
                                {extracting
                                    ? (lang === 'bs' ? 'Čitanje dokumenta...' : 'Extracting text...')
                                    : dragging
                                    ? (lang === 'bs' ? 'Ispusti zapisnik ovdje' : 'Drop record here')
                                    : (lang === 'bs' ? 'Prevuci zapisnik ili klikni za odabir' : 'Drag & drop or click to select')}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                PDF, DOCX, TXT — max 20MB
                            </div>
                            {extractError && (
                                <div style={{ marginTop: 16, color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                                    ⚠️ {extractError}
                                </div>
                            )}
                            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: 'none' }}
                                onChange={e => { const f = e.target.files[0]; if (f) handleFileRead(f); e.target.value = ''; }} />
                        </div>

                        <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.82rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--secondary)' }}>
                                💡 {lang === 'bs' ? 'Kako funkcioniše?' : 'How does it work?'}
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, color: 'var(--text-muted)' }}>
                                <li>{lang === 'bs' ? 'Aplikacija iz dokumenta izvlači sva vlastita imena (2-3 zamalo pisane riječi).' : 'App extracts all proper names (2-3 capitalized words) from the document.'}</li>
                                <li>{lang === 'bs' ? 'Svako ime uspoređuje s radnicima u sustavu koristeći fuzzy matching.' : 'Each name is compared against workers in the system using fuzzy matching.'}</li>
                                <li>{lang === 'bs' ? 'Prikazuje se tabela s originalnim i ispravnim imenima — možete ih ručno ispraviti.' : 'A table shows original and corrected names — you can edit them manually.'}</li>
                                <li>{lang === 'bs' ? 'Na kraju se generira ispravljen dokument (.docx ili .txt) za preuzimanje.' : 'Finally, a corrected document (.docx or .txt) is generated for download.'}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Step 2: Review table ── */}
            {step === 'review' && (
                <>
                    {/* File info banner */}
                    <div style={{
                        padding: '12px 16px', marginBottom: 20, borderRadius: 'var(--radius-md)',
                        background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.25)',
                        display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.88rem',
                    }}>
                        <span style={{ fontSize: '1.4rem' }}>📋</span>
                        <div style={{ flex: 1 }}>
                            <strong>{docFile?.name}</strong>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>
                                {lang === 'bs'
                                    ? `Pronađeno ${rows.length} potencijalnih imena · ${activeChanges} izmjena`
                                    : `Found ${rows.length} potential names · ${activeChanges} changes`}
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || activeChanges === 0}>
                            {generating
                                ? (lang === 'bs' ? '⏳ Generisanje...' : '⏳ Generating...')
                                : `📥 ${lang === 'bs' ? 'Generiši ispravljen dokument' : 'Generate corrected document'}`}
                        </button>
                    </div>

                    {rows.length === 0 ? (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔎</div>
                                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                                    {lang === 'bs' ? 'Nije pronađeno nijedno vlastito ime.' : 'No proper names found in the document.'}
                                </div>
                                <div style={{ fontSize: '0.82rem' }}>
                                    {lang === 'bs'
                                        ? 'Provjerite da li dokument sadrži izlistan tekst s imenima radnika.'
                                        : 'Check that the document contains plain listed worker names.'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-body" style={{ padding: 0 }}>
                                <div className="data-table-wrapper">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 40 }}>{lang === 'bs' ? 'Uključi' : 'Include'}</th>
                                                <th>{lang === 'bs' ? 'Iz dokumenta (originalno)' : 'From document (original)'}</th>
                                                <th>{lang === 'bs' ? 'Radnik u sustavu' : 'Worker in system'}</th>
                                                <th style={{ width: 80, textAlign: 'center' }}>{lang === 'bs' ? 'Podudaranje' : 'Match'}</th>
                                                <th>{lang === 'bs' ? 'Ispravno ime (editabilno)' : 'Corrected name (editable)'}</th>
                                                <th style={{ width: 60 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map(row => {
                                                const conf = row.matchedWorker ? confidenceLabel(row.confidence) : null;
                                                const isChanged = row.correctedName !== row.original;
                                                return (
                                                    <tr key={row.id} style={{
                                                        opacity: row.keep ? 1 : 0.4,
                                                        background: isChanged && row.keep ? 'rgba(0,191,166,0.04)' : undefined,
                                                    }}>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <input type="checkbox" checked={row.keep}
                                                                onChange={e => updateRow(row.id, { keep: e.target.checked })}
                                                                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                                                        </td>
                                                        <td>
                                                            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{row.original}</span>
                                                        </td>
                                                        <td>
                                                            {row.matchedWorker ? (
                                                                <div>
                                                                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                                                                        {row.matchedWorker.ime} {row.matchedWorker.prezime}
                                                                    </div>
                                                                    {row.matchedWorker.datumRodjenja && (
                                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                            🎂 {row.matchedWorker.datumRodjenja}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                                                    {lang === 'bs' ? '— nije pronađen —' : '— not found —'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {conf ? (
                                                                <div>
                                                                    <div style={{ fontSize: '1.1rem' }}>{conf.emoji}</div>
                                                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: conf.color }}>{conf.label}</div>
                                                                </div>
                                                            ) : '—'}
                                                        </td>
                                                        <td>
                                                            <input
                                                                className="form-input"
                                                                style={{ fontSize: '0.88rem', padding: '5px 8px', borderColor: isChanged ? 'var(--primary)' : undefined }}
                                                                value={row.correctedName}
                                                                onChange={e => updateRow(row.id, { correctedName: e.target.value })}
                                                                disabled={!row.keep}
                                                            />
                                                        </td>
                                                        <td>
                                                            <button className="btn btn-ghost btn-sm"
                                                                title={lang === 'bs' ? 'Vrati original' : 'Reset to original'}
                                                                onClick={() => updateRow(row.id, { correctedName: row.original })}>
                                                                ↺
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom action bar */}
                    {rows.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
                            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || activeChanges === 0}>
                                {generating ? '⏳' : '📥'} {lang === 'bs' ? 'Generiši ispravljen dokument' : 'Generate corrected document'}
                                {activeChanges > 0 && <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem' }}>{activeChanges}</span>}
                            </button>
                            <button className="btn btn-ghost" onClick={() => { setRows(r => r.map(x => ({ ...x, keep: true }))); }}>
                                ✓ {lang === 'bs' ? 'Označi sve' : 'Select all'}
                            </button>
                            <button className="btn btn-ghost" onClick={() => { setRows(r => r.map(x => ({ ...x, keep: false }))); }}>
                                ✗ {lang === 'bs' ? 'Odznači sve' : 'Deselect all'}
                            </button>
                            <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {activeChanges} {lang === 'bs' ? 'izmjena odabrano' : 'changes selected'}
                            </span>
                        </div>
                    )}
                </>
            )}

            {/* ── Step 3: Done ── */}
            {step === 'done' && (
                <div className="card">
                    <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>✅</div>
                        <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }}>
                            {lang === 'bs' ? 'Ispravljen dokument generisan!' : 'Corrected document generated!'}
                        </div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
                            {lang === 'bs'
                                ? `${activeChanges} imena je ispravljen${activeChanges === 1 ? 'o' : 'o'}. Datoteka je preuzeta.`
                                : `${activeChanges} name${activeChanges === 1 ? '' : 's'} corrected. File downloaded.`}
                        </div>
                        <button className="btn btn-primary" onClick={handleReset}>
                            ↺ {lang === 'bs' ? 'Obradi novi zapisnik' : 'Process another record'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
