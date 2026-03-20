const fs = require('fs');
const path = require('path');

const replaceInFile = (file, fromStr, toStr) => {
  const p = path.join(__dirname, '../src/app/dashboard', file);
  if (!fs.existsSync(p)) return;
  let text = fs.readFileSync(p, 'utf8');
  text = text.split(fromStr).join(toStr);
  fs.writeFileSync(p, text, 'utf8');
  console.log(`Replaced in ${file}`);
};

const fixButtons = (file) => {
  replaceInFile(file, `✏️ {lang === 'bs' ? 'Otvori' : 'Open'}</button>`, 
    `<span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📝</span> {lang === 'bs' ? 'Otvori' : 'Open'}
                            </button>`);
  
  replaceInFile(file, `📋 {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}</button>`,
    `<span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>📋</span> {lang === 'bs' ? 'Kopiraj' : 'Duplicate'}
                            </button>`);
                            
  replaceInFile(file, `🗑️ {lang === 'bs' ? 'Obriši' : 'Delete'}</button>`,
    `<span style={{ fontSize: '1.2rem', paddingBottom: '3px' }}>🗑️</span> {lang === 'bs' ? 'Obriši' : 'Delete'}
                            </button>`);
};

['medical-exams/page.js', 'injuries/page.js', 'injury-list/page.js'].forEach(fixButtons);

// Check if they need zIndex: 9999 fix too?
['medical-exams/page.js', 'injuries/page.js', 'injury-list/page.js'].forEach(f => {
    replaceInFile(f, `zIndex: 999, display: 'block'`, `zIndex: 9999, display: 'block'`);
});
