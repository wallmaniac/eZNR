import os
import re

app_dir = r"c:\Users\zzida\Desktop\znrba\app\src"
count = 0

for root, dirs, files in os.walk(app_dir):
    for name in files:
        if name.endswith(".js") or name.endswith(".jsx"):
            path = os.path.join(root, name)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            
            if "@/lib/storageAPI" in content:
                new_content = content.replace("@/lib/storageAPI", "@/lib/storageService")
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                count += 1
                print(f"Updated imports in {path}")

print(f"Total files updated: {count}")
