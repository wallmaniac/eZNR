import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the modal close buttons in page.js
    content = content.replace(
        "onClick={() => setShowForm(false)}",
        "onClick={() => { setShowForm(false); if(returnPath) { router.push(returnPath); setReturnPath(null); } }}"
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\equipment\page.js')
