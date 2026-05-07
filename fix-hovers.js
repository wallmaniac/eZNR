const fs = require('fs');
function fixFile(file) {
    let c = fs.readFileSync(file, 'utf8');
    c = c.split(" onMouseEnter={e => e.currentTarget.style.background='var(--bg-table-row-hover)'} onMouseLeave={e => e.currentTarget.style.background=''}").join(' className="action-menu-item"');
    c = c.split(" onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.06)'} onMouseLeave={e => e.currentTarget.style.background=''}").join(' className="action-menu-item-danger"');
    fs.writeFileSync(file, c);
    console.log('Fixed', file);
}
fixFile('src/app/dashboard/worker-certificates/page.js');
fixFile('src/app/dashboard/worker-ppe/page.js');
