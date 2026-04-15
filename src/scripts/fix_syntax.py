import os
import re

app_dir = r"c:\Users\zzida\Desktop\znrba\app\src\app\dashboard"
count = 0

for root, dirs, files in os.walk(app_dir):
    for name in files:
        if name.endswith(".js"):
            path = os.path.join(root, name)
            with open(path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            modified = False
            for i, line in enumerate(lines):
                # Pattern: a line starting with spaces then "getAll, create"
                if line.lstrip().startswith("getAll, create"):
                    # Check if the line before is EXACTLY "import {" ignoring whitespace
                    if i > 0 and lines[i-1].strip() != "import {":
                        lines.insert(i, "import {\n")
                        modified = True
                        break

            if modified:
                with open(path, "w", encoding="utf-8") as f:
                    f.writelines(lines)
                count += 1
                print(f"Fixed import in {path}")

print(f"Total files fixed: {count}")
