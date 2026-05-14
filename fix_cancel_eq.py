import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update handleCancel
    nav_old = r"""const handleCancel = () => {
        if (editingId) setLastEditedId(editingId);
        setEditingId(null);
        setShowForm(false);
    };"""
    
    nav_new = r"""const handleCancel = () => {
        if (editingId) setLastEditedId(editingId);
        setEditingId(null);
        setShowForm(false);
        if (returnPath) { router.push(returnPath); setReturnPath(null); }
    };"""
    
    content = content.replace(nav_old, nav_new)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\equipment\page.js')
