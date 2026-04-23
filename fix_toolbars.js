const fs = require('fs');

function processFile(path, blockRegexps, replacerStr) {
  let text = fs.readFileSync(path, 'utf8');
  let match = text.match(blockRegexps);
  if (match) {
    text = text.replace(blockRegexps, replacerStr);
    fs.writeFileSync(path, text, 'utf8');
    console.log('Fixed', path);
  } else {
    console.log('No match in', path);
  }
}

// 1. equipment
processFile('src/app/dashboard/equipment/page.js', 
  /<button className="btn btn-primary btn-sm" onClick={handleNew}>\+ \{lang === 'bs' \? 'Nova oprema' : 'New Equipment'\}<\/button>[\s\S]*?<PDFExportButton buttonStyle={{ background: '#db2777'[\s\S]*?]} \/>[\s\S]*?<PDFExportButton label=\{lang === 'bs' \? '🖨️ QR Kod'[\s\S]*?]} \/>[\s\S]*?<SavedFlash \/>[\s\S]*?<div className="search-bar" style={{ flex: 1 }}>[\s\S]*?<\/div>/,
  `<button className="btn btn-primary btn-sm" onClick={handleNew}>+ {lang === 'bs' ? 'Nova oprema' : 'New Equipment'}</button>
                        <div className="search-bar" style={{ flex: 1 }}>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                            <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                        </div>
                        <PDFExportButton buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }} options={[
                            { label: lang === 'bs' ? 'Sva oprema' : 'All equipment', icon: '⚙️', onClick: () => generateEquipmentReport([], lang) },
                            ...(selectedIds.size > 0 ? [{ label: \`\${lang === 'bs' ? 'Odabrano' : 'Selected'} (\${selectedIds.size})\`, icon: '✓', onClick: () => generateEquipmentReport([...selectedIds], lang) }] : []),
                        ]} />
                        <PDFExportButton label={lang === 'bs' ? '🖨️ QR Kod' : '🖨️ QR Code'} buttonStyle={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', height: 38 }} options={[
                            { label: lang === 'bs' ? 'Svi kodovi' : 'All codes', icon: '🖨️', onClick: () => { setPrintSelection(sortedEquipment); setShowPrintModal(true); } },
                            ...(selectedIds.size > 0 ? [{ label: \`\${lang === 'bs' ? 'Odabrani' : 'Selected'} (\${selectedIds.size})\`, icon: '✓', onClick: () => { setPrintSelection(sortedEquipment.filter(eq => selectedIds.has(eq.id))); setShowPrintModal(true); } }] : []),
                        ]} />
                        <SavedFlash />`
);

// 2. fleet
processFile('src/app/dashboard/fleet/page.js',
  /<button className="btn btn-primary btn-sm" onClick=\{\(\) => \{ setEditingId\(null\); setFormData\(\{.*?\}\); setShowForm\(true\); \}\}>\+ \{lang === 'bs' \? 'Novo vozilo' : 'New Vehicle'\}<\/button>[\s\S]*?<PDFExportButton buttonStyle={{ background: '#db2777'[\s\S]*?]} \/>[\s\S]*?<PDFExportButton label=\{lang === 'bs' \? '🖨️ QR Kod'[\s\S]*?]} \/>[\s\S]*?<SavedFlash \/>[\s\S]*?<div className="search-bar" style={{ flex: 1 }}>[\s\S]*?<\/div>/,
  `<button className="btn btn-primary btn-sm" onClick={() => { setEditingId(null); setFormData({ marka: '', model: '', registracija: '', regOd: '', regDo: '', tipVozila: '', brojSjedista: 4, zapreminaMotora: '', snagaMotora: '', brojSasije: '', vozacId: '', uUpotrebiOd: '' }); setShowForm(true); }}>+ {lang === 'bs' ? 'Novo vozilo' : 'New Vehicle'}</button>
                        <div className="search-bar" style={{ flex: 1 }}>
                            <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                            <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                        </div>
                        <PDFExportButton buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }} options={[
                            { label: lang === 'bs' ? 'Sva vozila' : 'All vehicles', icon: '🚗', onClick: () => generateFleetReport([], lang) },
                            ...(selectedIds.size > 0 ? [{ label: \`\${lang === 'bs' ? 'Odabrano' : 'Selected'} (\${selectedIds.size})\`, icon: '✓', onClick: () => generateFleetReport([...selectedIds], lang) }] : []),
                        ]} />
                        <PDFExportButton label={lang === 'bs' ? '🖨️ QR Kod' : '🖨️ QR Code'} buttonStyle={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', height: 38 }} options={[
                            { label: lang === 'bs' ? 'Sva vozila' : 'All vehicles', icon: '🖨️', onClick: () => { setPrintSelection(sortedVehicles); setShowPrintModal(true); } },
                            ...(selectedIds.size > 0 ? [{ label: \`\${lang === 'bs' ? 'Odabrana' : 'Selected'} (\${selectedIds.size})\`, icon: '✓', onClick: () => { setPrintSelection(sortedVehicles.filter(v => selectedIds.has(v.id))); setShowPrintModal(true); } }] : []),
                        ]} />
                        <SavedFlash />`
);

// 3. fire protection - aparat
processFile('src/app/dashboard/fire-protection/page.js',
  /<button className="btn btn-primary btn-sm" onClick={handleNewItem}>\+ \{lang === 'bs' \? 'Novi aparat' : 'New Extinguisher'\}<\/button>[\s\S]*?<PDFExportButton buttonStyle={{ background: '#db2777'[\s\S]*?]} \/>[\s\S]*?<PDFExportButton label=\{lang === 'bs' \? '🖨️ QR Kod'[\s\S]*?]} \/>[\s\S]*?<SavedFlash \/>[\s\S]*?<div className="search-bar" style={{ flex: 1 }}>[\s\S]*?<\/div>/,
  `<button className="btn btn-primary btn-sm" onClick={handleNewItem}>+ {lang === 'bs' ? 'Novi aparat' : 'New Extinguisher'}</button>
                                    <div className="search-bar" style={{ flex: 1 }}>
                                        <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                                        <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                                    </div>
                                    <PDFExportButton buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }} options={[
                                        { label: lang === 'bs' ? 'Svi aparati' : 'All extinguishers', icon: '🧯', onClick: () => generateFireProtectionReport([], lang) },
                                        ...(selectedFEIds.size > 0 ? [{ label: \`\${lang === 'bs' ? 'Odabrano' : 'Selected'} (\${selectedFEIds.size})\`, icon: '✓', onClick: () => generateFireProtectionReport([...selectedFEIds], lang) }] : []),
                                    ]} />
                                    <PDFExportButton label={lang === 'bs' ? '🖨️ QR Kod' : '🖨️ QR Code'} buttonStyle={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', height: 38 }} options={[
                                        { label: lang === 'bs' ? 'Svi aparati' : 'All extinguishers', icon: '🖨️', onClick: () => { setPrintSelection(sortedFireExt); setShowPrintModal(true); } },
                                        ...(selectedFEIds.size > 0 ? [{ label: \`\${lang === 'bs' ? 'Odabrani' : 'Selected'} (\${selectedFEIds.size})\`, icon: '✓', onClick: () => { setPrintSelection(sortedFireExt.filter(fe => selectedFEIds.has(fe.id))); setShowPrintModal(true); } }] : []),
                                    ]} />
                                    <SavedFlash />`
);

// 4. fire protection - hydrant
processFile('src/app/dashboard/fire-protection/page.js',
  /<button className="btn btn-primary btn-sm" onClick=\{handleNewHydrant\}>\+ \{lang === 'bs' \? 'Novi hidrant' : 'New Hydrant'\}<\/button>[\s\S]*?<PDFExportButton buttonStyle={{ background: '#db2777'[\s\S]*?]} \/>[\s\S]*?<PDFExportButton label=\{lang === 'bs' \? '🖨️ QR Kod'[\s\S]*?]} \/>[\s\S]*?<SavedFlash \/>[\s\S]*?<div className="search-bar" style={{ flex: 1 }}>[\s\S]*?<\/div>/,
  `<button className="btn btn-primary btn-sm" onClick={handleNewHydrant}>+ {lang === 'bs' ? 'Novi hidrant' : 'New Hydrant'}</button>
                                    <div className="search-bar" style={{ flex: 1 }}>
                                        <input placeholder={t('searchBtn') + '...'} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.9rem', width: '100%' }} />
                                        <button className="btn btn-ghost btn-sm">{t('searchBtn')}</button>
                                    </div>
                                    <PDFExportButton buttonStyle={{ background: '#db2777', color: 'white', borderColor: '#db2777', height: 38 }} options={[
                                        { label: lang === 'bs' ? 'Svi hidranti' : 'All hydrants', icon: '🚰', onClick: () => generateFireProtectionReport([], lang) },
                                        ...(selectedHydrantIds.size > 0 ? [{ label: \`\${lang === 'bs' ? 'Odabrano' : 'Selected'} (\${selectedHydrantIds.size})\`, icon: '✓', onClick: () => generateFireProtectionReport([...selectedHydrantIds], lang) }] : []),
                                    ]} />
                                    <PDFExportButton label={lang === 'bs' ? '🖨️ QR Kod' : '🖨️ QR Code'} buttonStyle={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', height: 38 }} options={[
                                        { label: lang === 'bs' ? 'Svi hidranti' : 'All hydrants', icon: '🖨️', onClick: () => { setPrintSelection(sortedHydrants); setShowPrintModal(true); } },
                                        ...(selectedHydrantIds.size > 0 ? [{ label: \`\${lang === 'bs' ? 'Odabrani' : 'Selected'} (\${selectedHydrantIds.size})\`, icon: '✓', onClick: () => { setPrintSelection(sortedHydrants.filter(h => selectedHydrantIds.has(h.id))); setShowPrintModal(true); } }] : []),
                                    ]} />
                                    <SavedFlash />`
);
