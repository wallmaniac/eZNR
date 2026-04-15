import os
import re

dashboard_dir = r"c:\Users\zzida\Desktop\znrba\app\src\app\dashboard"
count = 0

pattern = re.compile(r"^([ \t]*)useEffect\(\(\) => \{ loadData\(\); \}, \[loadData\]\);", re.MULTILINE)

for root, dirs, files in os.walk(dashboard_dir):
    for name in files:
        if name.endswith(".js"):
            path = os.path.join(root, name)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            if pattern.search(content):
                def replacer(match):
                    indent = match.group(1)
                    return (
                        f"{indent}useEffect(() => {{\n"
                        f"{indent}    loadData();\n"
                        f"{indent}    window.addEventListener('eznr:data-synced', loadData);\n"
                        f"{indent}    return () => window.removeEventListener('eznr:data-synced', loadData);\n"
                        f"{indent}}}, [loadData]);"
                    )
                new_content = pattern.sub(replacer, content)
                
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                count += 1
                print(f"Updated {path}")

print(f"Total files updated: {count}")
