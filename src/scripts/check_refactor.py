import os
import re

dashboard_dir = r"c:\Users\zzida\Desktop\znrba\app\src\app\dashboard"
count = 0

for root, dirs, files in os.walk(dashboard_dir):
    for name in files:
        if name.endswith(".js"):
            path = os.path.join(root, name)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Match variations of useEffect(() => { loadData(); }, [loadData]);
            pattern = r"([ \t]*)useEffect\(\(\) => \{ loadData\(\); \}, \[loadData\]\);"
            
            if re.search(pattern, content):
                count += 1

print(f"Found {count} files to refactor")
