const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/settings/page.js', 'utf8');

const brokenBlock = `                } else {
                  clearDirty();
                }
          <style>{\`.settings-tabs-container::-webkit-scrollbar { display: none; }\`}</style>
        {tabs.map(tb => (
          <button key={tb.key}
            className={\`tab-btn \${currentTab === tb.key ? 'active' : ''}\`}
            onClick={async () => {
              if (dirtyTab && dirtyTab !== tb.key) {
                const saveFns = {
                  notifications: handleSaveNotifSettings,
                  display: handleSaveAppSettings,
                  profile: handleSaveProfile,
                  company: handleSaveCompany,
                };
                const action = await choose(
                  lang === 'bs'
                    ? 'Imate nesačuvane promjene.\\nŽelite li ih sačuvati prije promjene taba?'
                    : 'You have unsaved changes.\\nDo you want to save them before switching tabs?',
                  [
                    { label: '💾 Spremi i nastavi', value: 'save', primary: true },
                    { label: '🗑️ Odbaci promjene', value: 'discard', danger: true },
                    { label: 'Odustani', value: null }
                  ]
                );
                if (action === null) return;
                
                if (action === 'save' && saveFns[dirtyTab]) {
                  await saveFns[dirtyTab]();
                } else {
                  clearDirty();
                }
              }
              setActiveTab(tb.key);
            }}
          >
            {tb.icon} {tb.label}
            {dirtyTab === tb.key && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)', marginLeft: 6, verticalAlign: 'middle', boxShadow: '0 0 4px var(--warning)' }} title="Nesačuvane promjene" />}
          </button>`;

const fixedBlock = `                } else {
                  clearDirty();
                }
              }
              setActiveTab(tb.key);
            }}
          >
            {tb.icon} {tb.label}
            {dirtyTab === tb.key && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)', marginLeft: 6, verticalAlign: 'middle', boxShadow: '0 0 4px var(--warning)' }} title="Nesačuvane promjene" />}
          </button>`;

function normalizeSpaces(str) {
    return str.replace(/\\r\\n/g, '\\n').trim();
}

const nCode = normalizeSpaces(code);
const nBrokenBlock = normalizeSpaces(brokenBlock);

if (nCode.includes(nBrokenBlock)) {
    // Exact replacement via indexOf if possible, to preserve surround
    const beforeIdx = code.indexOf(brokenBlock.split('\\n')[0]);
    if(beforeIdx > -1) {
        code = code.replace(brokenBlock, fixedBlock);
        code = code.replace(brokenBlock.replace(/\\n/g, '\\r\\n'), fixedBlock.replace(/\\n/g, '\\r\\n'));
        fs.writeFileSync('src/app/dashboard/settings/page.js', code, 'utf8');
        console.log("SUCCESSFULLY FIXED FILE CORRUPTION");
    } else {
        // use regex block replacement
        const regexHack = new RegExp(nBrokenBlock.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&').replace(/\\n/g, '\\\\r?\\\\n\\\\s*'));
        code = code.replace(regexHack, fixedBlock);
        fs.writeFileSync('src/app/dashboard/settings/page.js', code, 'utf8');
        console.log("SUCCESSFULLY FIXED FILE CORRUPTION (REGEX)");
    }
} else {
    console.log("COULD NOT FIND BROKEN BLOCK");
}
