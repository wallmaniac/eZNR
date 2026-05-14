import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the service handling block in dashboard page.js
    old_service_block = r"""                                    // 10. Service → update equipment dates and history
                                    if (tip === 'service' && machineId) {
                                        const eq = equipment.find(e => e.id === machineId);
                                        if (eq) {
                                            const in1y = new Date(new Date(eventFormDate).getTime() + 365 * 86400000).toISOString().split('T')[0];
                                            const newLog = {
                                                id: Date.now().toString(),
                                                datum: eventFormDate,
                                                tip: 'pregled',
                                                servisirao: 'Kalendar',
                                                napomena: opis || '',
                                                iduciServis: in1y
                                            };
                                            const updatedHistory = [...(eq.history || []), newLog].sort((a, b) => b.datum.localeCompare(a.datum));
                                            update(COLLECTIONS.EQUIPMENT, machineId, { posljednji: eventFormDate, iduci: in1y, history: updatedHistory });
                                            newSourceId = machineId;
                                        }
                                    }"""

    new_service_block = r"""                                    // 10. Service → update equipment dates and history
                                    if (tip === 'service' && machineId) {
                                        const eq = equipment.find(e => e.id === machineId);
                                        if (eq) {
                                            const in1y = new Date(new Date(eventFormDate).getTime() + 365 * 86400000).toISOString().split('T')[0];
                                            const newLog = {
                                                id: Date.now().toString(),
                                                equipmentId: machineId,
                                                datum: eventFormDate,
                                                tip: 'pregled',
                                                servisirao: 'Kalendar',
                                                napomena: opis || '',
                                                iduciServis: in1y
                                            };
                                            // Create log in SERVICE_LOG collection to match equipment page logic
                                            create(COLLECTIONS.SERVICE_LOG, newLog);
                                            update(COLLECTIONS.EQUIPMENT, machineId, { posljednji: eventFormDate, iduci: in1y });
                                            newSourceId = machineId;
                                        }
                                    }"""

    content = content.replace(old_service_block, new_service_block)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\page.js')
