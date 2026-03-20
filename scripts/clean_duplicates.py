import os, re

# Remove duplicate upload blocks - keep the newer one (=== Document Upload ===) 
# The old one is labeled {/* Document Upload Block */}

files = [
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\requests\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro1\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-ro2\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\night-work\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\form-oir1\page.js',
    r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\referral-ra1\page.js',
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8', newline='') as f:
        raw = f.read()
    
    content = raw.replace('\r\n', '\n')
    name = os.path.basename(os.path.dirname(filepath))
    changed = False

    # Count upload blocks
    count_old = content.count('{/* Document Upload Block */}')
    count_new = content.count('{/* ═══ Document Upload ═══ */}')
    
    print(f"[{name}] Old blocks: {count_old}, New blocks: {count_new}")
    
    # Remove the old "Document Upload Block" block if both exist
    if count_old > 0 and count_new > 0:
        # Find and remove the old block - it ends at the next card closing before "Action buttons"
        # Pattern: from {/* Document Upload Block */} to the closing </div>\n\n        {/* ═══ Document Upload ═══ */}
        old_block_start = '        {/* Document Upload Block */}\n'
        old_block_end = '\n\n        {/* ═══ Document Upload ═══ */}'
        
        idx_start = content.find(old_block_start)
        idx_end = content.find(old_block_end)
        
        if idx_start != -1 and idx_end != -1 and idx_start < idx_end:
            # Remove from start of old block to start of new block anchor  
            content = content[:idx_start] + '        {/* ═══ Document Upload ═══ */}' + content[idx_end + len(old_block_end):]
            changed = True
            print(f"  [{name}] Removed duplicate old upload block")
        else:
            print(f"  [{name}] WARNING: Could not find duplicate block boundaries (start={idx_start}, end={idx_end})")
    elif count_old > 0 and count_new == 0:
        print(f"  [{name}] Only old block present - renaming to standard")
        content = content.replace('{/* Document Upload Block */}', '{/* ═══ Document Upload ═══ */}')
        changed = True
    elif count_new > 0 and count_old == 0:
        print(f"  [{name}] Only new block present - OK")
    elif count_new == 0 and count_old == 0:
        print(f"  [{name}] WARNING: No upload block found!")

    if changed:
        out = content.replace('\n', '\r\n') if '\r\n' in raw else content
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            f.write(out)
        print(f"[{name}] Cleaned!")
