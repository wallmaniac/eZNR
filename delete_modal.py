import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if delete modal handles zIndex
    nav_old_modal = r"""{deleteEventTarget && (
                    <div className="modal-overlay" onClick={() => setDeleteEventTarget(null)}>"""
    nav_new_modal = r"""{deleteEventTarget && (
                    <div className="modal-overlay" onClick={() => setDeleteEventTarget(null)} style={{ zIndex: 100000 }}>"""
    content = content.replace(nav_old_modal, nav_new_modal)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\page.js')
