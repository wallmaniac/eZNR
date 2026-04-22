const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/observations/page.js', 'utf8');

const OLD_VAR = `const { items: sortedItems, requestSort, sortConfig, sortIcon, thStyle } = useSortedList(items, { key: 'datum', direction: 'desc' });`;
const NEW_VAR = `const { sorted: sortedItems, toggleSort: requestSort, sortIcon, thStyle } = useSortedList(items, 'datum', 'desc');`;

content = content.replace(OLD_VAR, NEW_VAR);

fs.writeFileSync('src/app/dashboard/observations/page.js', content, 'utf8');
console.log('patched the crash!');
