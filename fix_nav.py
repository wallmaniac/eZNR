import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update navigation to pass returnTo parameter
    nav_old_fleet1 = r"router.push('/dashboard/fleet?openId=' + ev.vehicleId);"
    nav_new_fleet1 = r"router.push('/dashboard/fleet?openId=' + ev.vehicleId + '&returnTo=/dashboard');"
    content = content.replace(nav_old_fleet1, nav_new_fleet1)

    nav_old_fleet2 = r"router.push('/dashboard/fleet?openId=' + ev.sourceId);"
    nav_new_fleet2 = r"router.push('/dashboard/fleet?openId=' + ev.sourceId + '&returnTo=/dashboard');"
    content = content.replace(nav_old_fleet2, nav_new_fleet2)

    nav_old_eq1 = r"router.push('/dashboard/equipment?openItem=' + ev.machineId);"
    nav_new_eq1 = r"router.push('/dashboard/equipment?openItem=' + ev.machineId + '&returnTo=/dashboard');"
    content = content.replace(nav_old_eq1, nav_new_eq1)

    nav_old_eq2 = r"router.push('/dashboard/equipment?openItem=' + ev.sourceId);"
    nav_new_eq2 = r"router.push('/dashboard/equipment?openItem=' + ev.sourceId + '&returnTo=/dashboard');"
    content = content.replace(nav_old_eq2, nav_new_eq2)

    nav_old_worker1 = r"router.push('/dashboard/workers?openWorker=' + certRecord.workerId + '&section=uvjerenja');"
    nav_new_worker1 = r"router.push('/dashboard/workers?openWorker=' + certRecord.workerId + '&section=uvjerenja&returnTo=/dashboard');"
    content = content.replace(nav_old_worker1, nav_new_worker1)

    nav_old_worker2 = r"router.push('/dashboard/workers?openWorker=' + ev.workerId + '&section=uvjerenja');"
    nav_new_worker2 = r"router.push('/dashboard/workers?openWorker=' + ev.workerId + '&section=uvjerenja&returnTo=/dashboard');"
    content = content.replace(nav_old_worker2, nav_new_worker2)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\page.js')
