import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    content = content.replace(
        "setCalEvents(getAllForCompany(COLLECTIONS.CALENDAR_EVENTS, activeCompanyId, user?.companyIds));",
        "loadDashboardData();"
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\page.js')
