const fs = require('fs');
let code = fs.readFileSync('src/app/dashboard/fleet-documents/page.js', 'utf8');

code = code.replace(/FleetDocumentsInner/g, 'ServiceRecordsInner')
           .replace(/FleetDocuments/g, 'ServiceRecords')
           .replace(/vehicles/g, 'equipmentItems')
           .replace(/setVehicles/g, 'setEquipmentItems')
           .replace(/vehicleId/g, 'equipmentId')
           .replace(/vehicleReg/g, 'equipmentName')
           .replace(/COLLECTIONS\.VEHICLES/g, 'COLLECTIONS.EQUIPMENT')
           .replace(/openInFleet/g, 'openInEquipment')
           .replace(/vehicleUpdates/g, 'equipmentUpdates')
           .replace(/setVehicleSearch/g, 'setEquipmentSearch')
           .replace(/vehicleSearch/g, 'equipmentSearch')
           .replace(/showVSearch/g, 'showESearch')
           .replace(/setShowVSearch/g, 'setShowESearch')
           .replace(/vRef/g, 'eRef')
           .replace(/\/dashboard\/fleet\?openId=/g, '/dashboard/equipment?openId=')
           .replace(/\/dashboard\/fleet-documents/g, '/dashboard/service-records')
           .replace(/fleet\-documents/g, 'service-records')
           .replace(/Dokumentacija Vozila/g, 'Servisni Zapisnici')
           .replace(/Vehicle Documents/g, 'Service Records')
           .replace(/Pregled svih učitanih dokumenata na nivou cijelog voznog parka/g, 'Pregled svih servisnih zapisnika za radnu opremu')
           .replace(/Central archive of all uploaded vehicle documents/g, 'Central archive of service records for equipment')
           .replace(/Vozilo/g, 'Radna oprema')
           .replace(/Vehicle/g, 'Equipment')
           .replace(/Pretraži vozila\.\.\./g, 'Pretraži opremu...')
           .replace(/v\.registracija/g, 'v.naziv')
           .replace(/v\.marka/g, 'v.inventarniBroj')
           .replace(/v\.model/g, '""');

fs.writeFileSync('src/app/dashboard/service-records/page.js', code);
console.log("Success!");
