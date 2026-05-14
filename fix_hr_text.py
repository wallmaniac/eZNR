import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # In Evacuation plans page, replace 'Odgovorna osoba'
    content = content.replace(
        "label className=\"form-label\">{bs ? 'Odgovorna osoba' : 'Responsible Person'}</label>",
        "label className=\"form-label\">{hr ? 'Odgovorna osoba' : bs ? 'Odgovorna osoba' : 'Responsible Person'}</label>"
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\evacuation\page.js')

def process_file_2(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    content = content.replace(
        "label className=\"form-label\">{hr ? 'Voditelj vježbe' : bs ? 'Rukovodilac vježbe' : 'Drill Supervisor'}</label>",
        "label className=\"form-label\">{hr ? 'Voditelj vježbe' : bs ? 'Rukovodilac vježbe' : 'Drill Supervisor'}</label>"
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file_2(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\evacuation-drills\page.js')
