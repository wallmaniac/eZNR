const fs = require('fs');

function patchFile(filepath, searchStr) {
  let lines = fs.readFileSync(filepath, 'utf8').split('\n');
  let newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    newLines.push(lines[i]);
    if (lines[i].includes(searchStr)) {
      // Find the next '</tr>'
      let j = i + 1;
      while (j < lines.length && !lines[j].includes('</tr>')) {
        newLines.push(lines[j]);
        j++;
      }
      
      // We found the </tr> line
      if (j < lines.length) {
        // Insert the td before the tr
        newLines.push(`                      <td style={{ textAlign: 'center' }}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} onClick={e => e.stopPropagation()} /></td>`);
        newLines.push(lines[j]);
        i = j; // skip forward
      }
    }
  }
  
  fs.writeFileSync(filepath, newLines.join('\n'), 'utf8');
  console.log('Patched ' + filepath);
}

patchFile('c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/requests/page.js', "{(r.stavke || []).length}");
patchFile('c:/Users/zzida/Desktop/znrba/app/src/app/dashboard/form-ro1/page.js', "{r.posloviPravilnik ? 'Da' : 'Ne'}</span>");
