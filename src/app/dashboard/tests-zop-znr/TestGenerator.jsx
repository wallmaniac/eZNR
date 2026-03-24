'use client';
import { useState, useEffect } from 'react';
import { zopQuestions, znrQuestions } from './defaultQuestions';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getById, COLLECTIONS } from '@/lib/dataStore';
import JSZip from 'jszip';
import PizZip from 'pizzip'; // Actually docxtemplater uses pizzip
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

export default function TestGenerator() {
    const { lang } = useLanguage();
    const bs = lang === 'bs';
    const { activeCompanyId } = useAuth();

    const [testType, setTestType] = useState('ZOP');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Editing state
    const [editingId, setEditingId] = useState(null);
    const [editText, setEditText] = useState('');
    const [editOptions, setEditOptions] = useState([]);

    useEffect(() => {
        // Load default questions when type changes
        if (testType === 'ZOP') {
            setQuestions(JSON.parse(JSON.stringify(zopQuestions)));
        } else {
            setQuestions(JSON.parse(JSON.stringify(znrQuestions)));
        }
        setEditingId(null);
    }, [testType]);

    const handleShuffleQuestions = () => {
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        // reassign IDs to keep numbering
        shuffled.forEach((q, i) => q.id = i + 1);
        setQuestions(shuffled);
    };

    const handleShuffleOptionsForQuestion = (qId) => {
        setQuestions(prev => prev.map(q => {
            if (q.id === qId) {
                const shuffledOpts = [...q.options].sort(() => Math.random() - 0.5);
                // reassign letters
                const letters = ['a', 'b', 'c', 'd', 'e'];
                shuffledOpts.forEach((opt, i) => opt.label = letters[i] || 'x');
                return { ...q, options: shuffledOpts };
            }
            return q;
        }));
    };

    const handleDeleteQuestion = (qId) => {
        setQuestions(prev => {
            const filtered = prev.filter(q => q.id !== qId);
            filtered.forEach((q, i) => q.id = i + 1);
            return filtered;
        });
    };

    const startEditing = (q) => {
        setEditingId(q.id);
        setEditText(q.text);
        setEditOptions(JSON.parse(JSON.stringify(q.options)));
    };

    const saveEditing = () => {
        setQuestions(prev => prev.map(q => 
            q.id === editingId ? { ...q, text: editText, options: editOptions } : q
        ));
        setEditingId(null);
    };

    const handleAddQuestion = () => {
        const newQ = {
            id: questions.length + 1,
            text: bs ? 'Novo pitanje' : 'New Question',
            options: [
                { label: 'a', text: bs ? 'Opcija A' : 'Option A' },
                { label: 'b', text: bs ? 'Opcija B' : 'Option B' }
            ]
        };
        setQuestions([...questions, newQ]);
        startEditing(newQ);
    };

    const handleAddOptionToEdit = () => {
        const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        setEditOptions([...editOptions, { label: letters[editOptions.length], text: '' }]);
    };

    const handleRemoveOptionFromEdit = (idx) => {
        const newOpts = editOptions.filter((_, i) => i !== idx);
        const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        newOpts.forEach((opt, i) => opt.label = letters[i]);
        setEditOptions(newOpts);
    };

    const handleUpdateOptionText = (idx, text) => {
        const newOpts = [...editOptions];
        newOpts[idx].text = text;
        setEditOptions(newOpts);
    };

    const handleDownload = async () => {
        try {
            setLoading(true);
            const response = await fetch('/templates/GeneratedTestTemplate.docx');
            const arrayBuffer = await response.arrayBuffer();

            // 1. Docxtemplater Replacement
            const tempZip = new PizZip(arrayBuffer);
            const doc = new Docxtemplater(tempZip, {
                paragraphLoop: true,
                linebreaks: true,
            });

            doc.render({
                testTitle: testType === 'ZOP' 
                    ? 'TEST ZA PROVJERU ZNANJA IZ OBLASTI ZAŠTITE OD POŽARA'
                    : 'TEST ZA PROVJERU ZNANJA IZ OBLASTI ZAŠTITE NA RADU',
                questions: questions.map((q, i) => ({
                    id: i + 1,
                    text: q.text,
                    options: q.options.map(opt => ({
                        label: opt.label,
                        text: opt.text
                    }))
                }))
            });

            const docxtemplaterBlob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

            // 2. JSZip Header Modifications
            const zip = await JSZip.loadAsync(docxtemplaterBlob);
            
            const usedMedia = new Set();
            for (let i = 1; i <= 3; i++) {
                const relFile = zip.file(`word/_rels/header${i}.xml.rels`);
                if (relFile) {
                    const relText = await relFile.async('string');
                    const matches = relText.match(/Target="media\/[^"]+"/g);
                    if (matches) {
                        matches.forEach(m => {
                            const imgName = m.split('"')[1];
                            usedMedia.add(`word/${imgName}`);
                        });
                    }
                }
            }

            if (activeCompanyId) {
                const company = getById(COLLECTIONS.COMPANIES, activeCompanyId);
                let companyName = "Vaša Kompanija";
                if (company) companyName = company.naziv || company.skraceniNaziv || companyName;
                
                for (let i = 1; i <= 3; i++) {
                    const f = zip.file(`word/header${i}.xml`);
                    if (f) {
                        let xmlData = await f.async('string');
                        xmlData = xmlData.replace(/{{COMPANY_NAME}}/g, companyName);
                        zip.file(`word/header${i}.xml`, xmlData);
                    }
                }
                
                if (company && company.logo) {
                    let base64Logo = company.logo;
                    if (base64Logo.includes('base64,')) {
                        base64Logo = base64Logo.split('base64,')[1];
                    }
                    usedMedia.forEach(mediaPath => {
                        if (zip.file(mediaPath)) zip.file(mediaPath, base64Logo, { base64: true });
                    });
                } else {
                    const transparentBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
                    usedMedia.forEach(mediaPath => {
                        if (zip.file(mediaPath)) zip.file(mediaPath, transparentBase64, { base64: true });
                    });
                }
            }

            const finalBlob = await zip.generateAsync({ type: "blob" });
            saveAs(finalBlob, `Prilagodjen_Test_${testType}.docx`);
            setLoading(false);

        } catch (error) {
            console.error(error);
            alert(bs ? "Greška pri generisanju testa" : "Error generating test");
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button 
                        className={`btn ${testType === 'ZOP' ? 'btn-danger' : 'btn-outline'}`}
                        onClick={() => setTestType('ZOP')}
                    >
                        🔥 ZOP Test
                    </button>
                    <button 
                        className={`btn ${testType === 'ZNR' ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => setTestType('ZNR')}
                    >
                        👷 ZNR Test
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline btn-sm" onClick={handleShuffleQuestions}>
                        🔀 {bs ? 'Izmiješaj pitanja' : 'Shuffle Questions'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={handleAddQuestion}>
                        ➕ {bs ? 'Dodaj pitanje' : 'Add Question'}
                    </button>
                    <button className="btn btn-primary" onClick={handleDownload} disabled={loading || editingId !== null}>
                        {loading ? '🔄...' : `📥 ${bs ? 'Preuzmi prilagođeni test' : 'Download Custom Test'}`}
                    </button>
                </div>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>
                    {bs 
                        ? 'Ovdje možete uređivati pitanja, mijenjati njihov redoslijed ili miješati odgovore. Kada završite, preuzmite dokument u DOCX formatu.' 
                        : 'Here you can edit questions, change their order or shuffle options. When done, download the document in DOCX format.'}
                </p>

                {questions.map((q) => (
                    <div key={q.id} style={{
                        padding: 16,
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        background: editingId === q.id ? 'var(--bg-hover)' : 'var(--bg-panel)'
                    }}>
                        {editingId === q.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Pitanje</label>
                                    <input 
                                        type="text" 
                                        className="input-field" 
                                        value={editText} 
                                        onChange={e => setEditText(e.target.value)}
                                        style={{ width: '100%', fontWeight: 'bold' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>Opcije</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {editOptions.map((opt, idx) => (
                                            <div key={idx} style={{ display: 'flex', gap: 8 }}>
                                                <span style={{ padding: '8px', background: 'var(--bg-element)', borderRadius: 'var(--radius-sm)' }}>{opt.label})</span>
                                                <input 
                                                    type="text" 
                                                    className="input-field" 
                                                    value={opt.text}
                                                    onChange={e => handleUpdateOptionText(idx, e.target.value)}
                                                    style={{ flex: 1 }}
                                                />
                                                <button className="btn btn-outline btn-sm btn-icon" onClick={() => handleRemoveOptionFromEdit(idx)}>
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={handleAddOptionToEdit}>
                                        + {bs ? 'Dodaj opciju' : 'Add Option'}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                                    <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>
                                        {bs ? 'Odustani' : 'Cancel'}
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={saveEditing}>
                                        {bs ? 'Sačuvaj promjene' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h4 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.4 }}>
                                        {q.id}. {q.text}
                                    </h4>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-outline btn-sm btn-icon" title="Izmiješaj opcije" onClick={() => handleShuffleOptionsForQuestion(q.id)}>
                                            🔀
                                        </button>
                                        <button className="btn btn-outline btn-sm btn-icon" title="Uredi" onClick={() => startEditing(q)}>
                                            ✏️
                                        </button>
                                        <button className="btn btn-outline-danger btn-sm btn-icon" title="Obriši" onClick={() => handleDeleteQuestion(q.id)}>
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {q.options.map(opt => (
                                        <div key={opt.label} style={{ paddingLeft: 12 }}>
                                            <strong>{opt.label})</strong> {opt.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

            </div>
        </div>
    );
}
