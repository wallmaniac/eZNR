const fs = require('fs');
const file = 'src/app/dashboard/workers/page.js';
let data = fs.readFileSync(file, 'utf8');
data = data.replace(
    'onClose={() => { setViewWorkerId(null); setViewWorkerInitialTab(null); openWorkerHandledRef.current = null; }}\\n                        onSaved={() => { loadData(); setViewWorkerId(null); setViewWorkerInitialTab(null); openWorkerHandledRef.current = null; }}',
    \onClose={() => { setViewWorkerId(null); setViewWorkerInitialTab(null); openWorkerHandledRef.current = null; }}
                        onSaved={() => { loadData(); setViewWorkerId(null); setViewWorkerInitialTab(null); openWorkerHandledRef.current = null; }}
                        onOpenFull={() => {
                            const found = workers.find(x => x.id === viewWorkerId);
                            setViewWorkerId(null);
                            setViewWorkerInitialTab(null);
                            if (found) {
                                openWorkerHandledRef.current = viewWorkerId;
                                openedViaUrlRef.current = true;
                                handleEdit(found);
                                const url = new URL(window.location);
                                url.searchParams.set('openWorker', viewWorkerId);
                                window.history.pushState(null, '', url.toString());
                            }
                        }}\
);
fs.writeFileSync(file, data);
console.log('done');
