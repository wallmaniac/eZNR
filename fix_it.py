import os

filepath = 'src/app/dashboard/settings/page.js'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.read().split('\n') # Not splitlines() to preserve \r if they exist, wait splitlines handles \r gracefully.

with open(filepath, 'r', encoding='utf-8') as f:
    orig = f.read()
    
# split using \n so we can join identically
lines = orig.split('\n')

# The corruption is from index 565 to index 593 (lines 566 to 594).
# We want to remove perfectly those indices.
# Let's verify line 565:
if '<style>' in lines[565]:
    del lines[565:594]
    
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        f.write('\n'.join(lines))
        
    print("SUCCESS")
else:
    print(f"FAILED. Line 565 is: {lines[565]}")
