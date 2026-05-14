import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update auto-open to capture returnTo
    nav_old_open = r"""const openId = searchParams?.get('openWorker');
        if (!openId) return;"""
    
    nav_new_open = r"""const openId = searchParams?.get('openWorker');
        const retPath = searchParams?.get('returnTo');
        if (retPath) setReturnPath(retPath);
        if (!openId) return;"""
    
    content = content.replace(nav_old_open, nav_new_open)

    # Update handleCancel to use returnTo
    nav_old_cancel = r"""const handleCancel = (skipHistoryBack = false) => {
        markClean();
        isDirtyRef.current = false;
        openWorkerHandledRef.current = null;
        openedViaUrlRef.current = false;
        if (editingWorker) setLastEditedId(editingWorker);
        setEditingWorker(null);
        setShowForm(false);
        // If closing via in-app button, pop the history entry we pushed
        if (!skipHistoryBack && typeof window !== 'undefined') {
            window.history.back();
        }
    };"""
    
    nav_new_cancel = r"""const handleCancel = (skipHistoryBack = false) => {
        markClean();
        isDirtyRef.current = false;
        openWorkerHandledRef.current = null;
        openedViaUrlRef.current = false;
        if (editingWorker) setLastEditedId(editingWorker);
        setEditingWorker(null);
        setShowForm(false);
        if (returnPath) {
            const path = returnPath;
            setReturnPath(null);
            router.push(path);
        } else if (!skipHistoryBack && typeof window !== 'undefined') {
            window.history.back();
        }
    };"""

    content = content.replace(nav_old_cancel, nav_new_cancel)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\workers\page.js')
