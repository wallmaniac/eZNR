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
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { apiExtractQuestionsFromDocument } from '@/lib/testGeneratorAI';

export default function TestGenerator() {
    const { lang } = useLanguage();
    const bs = lang !== 'en';
    const { activeCompanyId } = useAuth();

    const [testType, setTestType] = useState('ZOP');
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            const systemPrompt = `Ti si asistent za ekstrakciju ispitnih pitanja.
Iz priloženog dokumenta izvuci sva pitanja sa višestrukim izborom (Multiple Choice Questions) i njihove ponuđene odgovore.
Odgovori ISKLJUČIVO u JSON formatu na sljedeći način:
[
  {
    "text": "Tekst pitanja?",
    "options": [
      { "label": "a", "text": "Prvi odgovor" },
      { "label": "b", "text": "Drugi odgovor" }
    ]
  }
]
Ne dodaj ništa osim JSON-a. Ako neki odgovor nema labelu (a, b, c), ti mu je dodijeli.`;

            const result = await apiExtractQuestionsFromDocument({
                systemPrompt,
                userPrompt: "Izdvoji pitanja u traženi JSON format.",
                base64Document: base64,
                mimeType: file.type
            });
            
            const startId = questions.length;
            const extracted = result.map((q, i) => ({ ...q, id: i + 1 + startId }));
            setQuestions(prev => [...prev, ...extracted]);
            alert(bs ? "Uspješno uvezeno " + extracted.length + " pitanja." : "Successfully imported " + extracted.length + " questions.");
        } catch (err) {
            console.error(err);
            alert('Greška pri parsiranju dokumenta: ' + err.message);
        }
        setUploading(false);
        e.target.value = null; // reset
    };

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
        shuffled.forEach((q, i) => q.id = i + 1);
        setQuestions(shuffled);
    };

    const handleShuffleOptionsForQuestion = (qId) => {
        setQuestions(prev => prev.map(q => {
            if (q.id === qId) {
                const shuffledOpts = [...q.options].sort(() => Math.random() - 0.5);
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
            id: 0, // temporary, will be mapped to 1
            text: bs ? 'Novo pitanje' : 'New Question',
            options: [
                { label: 'a', text: bs ? 'Opcija A' : 'Option A' },
                { label: 'b', text: bs ? 'Opcija B' : 'Option B' }
            ]
        };
        const newList = [newQ, ...questions];
        newList.forEach((q, i) => q.id = i + 1);
        setQuestions(newList);
        
        // Timeout to allow re-render with new states before editing
        setTimeout(() => {
            setEditingId(1);
            setEditText(newList[0].text);
            setEditOptions(JSON.parse(JSON.stringify(newList[0].options)));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
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

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const sourceIndex = result.source.index;
        const destIndex = result.destination.index;
        
        if (sourceIndex === destIndex) return;

        const newItems = Array.from(questions);
        const [removed] = newItems.splice(sourceIndex, 1);
        newItems.splice(destIndex, 0, removed);
        
        // Re-number
        newItems.forEach((q, i) => q.id = i + 1);
        setQuestions(newItems);
    };

    const handleDownload = async () => {
        try {
            setLoading(true);
            const response = await fetch('/templates/GeneratedTestTemplate.docx');
            const arrayBuffer = await response.arrayBuffer();

            const tempZip = new PizZip(arrayBuffer);
            const doc = new Docxtemplater(tempZip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '[[', end: ']]' }
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
                    let isBase64 = false;
                    let logoData;
                    
                    if (company.logo.startsWith('http')) {
                        try {
                            const res = await fetch(company.logo);
                            logoData = await res.arrayBuffer();
                        } catch (e) {
                            console.error("Failed to fetch remote logo:", e);
                        }
                    } else {
                        logoData = company.logo;
                        if (logoData.includes('base64,')) {
                            logoData = logoData.split('base64,')[1];
                        }
                        isBase64 = true;
                    }
                    
                    if (logoData) {
                        usedMedia.forEach(mediaPath => {
                            if (zip.file(mediaPath)) {
                                if (isBase64) {
                                    zip.file(mediaPath, logoData, { base64: true });
                                } else {
                                    zip.file(mediaPath, logoData);
                                }
                            }
                        });
                    }
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

    const inputStyles = {
        width: '100%', 
        padding: '10px 14px', 
        borderRadius: 'var(--radius-sm)', 
        border: '1px solid var(--border-color)', 
        background: 'var(--bg-element)', 
        color: 'var(--text)',
        fontSize: '0.95rem'
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
                    <input type="file" accept=".pdf,.doc,.docx" id="testUploadInput" style={{ display: 'none' }} onChange={handleFileUpload} />
                    <button className="btn btn-outline btn-sm" onClick={() => document.getElementById('testUploadInput').click()} disabled={uploading || loading} style={{ background: uploading ? 'var(--bg-input)' : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: '#fff', border: 'none', fontWeight: 700 }}>
                        {uploading ? '⏳...' : '📎 Učitaj postojeći test'}
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
                        ? 'Ovdje možete uređivati pitanja, mijenjati njihov redoslijed prevlačenjem (drag & drop) ili miješati odgovore. Kada završite, preuzmite dokument u DOCX formatu.' 
                        : 'Here you can edit questions, change their order using drag & drop, or shuffle options. When done, download the document in DOCX format.'}
                </p>

                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="questions-list">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {questions.map((q, index) => (
                                    <Draggable key={q.id.toString() + '-' + index} draggableId={q.id.toString()} index={index} isDragDisabled={editingId !== null}>
                                        {(provided, snapshot) => (
                                            <div 
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                style={{
                                                    ...provided.draggableProps.style,
                                                    padding: 16,
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: snapshot.isDragging ? 'var(--bg-hover)' : 'var(--bg-panel)',
                                                    opacity: editingId && editingId !== q.id ? 0.5 : 1,
                                                    transition: snapshot.isDragging ? 'none' : 'opacity 0.2s'
                                                }}
                                            >
                                                {editingId === q.id ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 6 }}>Pitanje</label>
                                                            <input 
                                                                type="text" 
                                                                value={editText} 
                                                                onChange={e => setEditText(e.target.value)}
                                                                style={{ ...inputStyles, fontWeight: 'bold' }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 6 }}>Opcije</label>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                {editOptions.map((opt, idx) => (
                                                                    <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                                        <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', width: '20px' }}>{opt.label})</span>
                                                                        <input 
                                                                            type="text" 
                                                                            value={opt.text}
                                                                            onChange={e => handleUpdateOptionText(idx, e.target.value)}
                                                                            style={{ ...inputStyles, flex: 1 }}
                                                                        />
                                                                        <button className="btn btn-outline-danger btn-sm btn-icon" onClick={() => handleRemoveOptionFromEdit(idx)}>
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={handleAddOptionToEdit}>
                                                                + {bs ? 'Dodaj opciju' : 'Add Option'}
                                                            </button>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                                                            <button className="btn btn-outline" onClick={() => setEditingId(null)}>
                                                                {bs ? 'Odustani' : 'Cancel'}
                                                            </button>
                                                            <button className="btn btn-primary" onClick={saveEditing}>
                                                                {bs ? 'Sačuvaj promjene' : 'Save Changes'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                                                        <div {...provided.dragHandleProps} style={{ padding: '4px', cursor: 'grab', color: 'var(--text-muted)' }}>
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle>
                                                                <circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle>
                                                            </svg>
                                                        </div>
                                                        <div style={{ flex: 1 }}>
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
                                                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                                {q.options.map(opt => (
                                                                    <div key={opt.label} style={{ paddingLeft: 12, color: 'var(--text)' }}>
                                                                        <strong style={{ color: 'var(--text-muted)', marginRight: 6 }}>{opt.label})</strong> {opt.text}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>
        </div>
    );
}
