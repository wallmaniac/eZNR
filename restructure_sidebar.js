const fs = require('fs');
const path = 'src/components/Sidebar.js';

let code = fs.readFileSync(path, 'utf8');

// I need to accurately replace the `menuItems` array. I'll read everything from `const menuItems = [` to `// ── Tooltip explanations`.
const menuItemsStart = code.indexOf('const menuItems = [');
const menuItemsEnd = code.indexOf('// ── Tooltip explanations');

if (menuItemsStart === -1 || menuItemsEnd === -1) {
    console.error("Could not find bounds of menuItems array");
    process.exit(1);
}

const newMenuItems = `const menuItems = [
    { key: 'dashboard', icon: '📊', path: '/dashboard' },
    { key: 'home',      icon: '🏠', path: '/dashboard/news' },

    {
        key: 'grpWorkers', icon: 'Radnici.png',
        children: [
            { key: 'workers',            icon: 'Radnici.png', path: '/dashboard/workers' },
            { key: 'workerCertificates', icon: 'Uvjerenja.png', path: '/dashboard/worker-certificates' },
            { key: 'workerPPE',          icon: 'OZO.png', path: '/dashboard/worker-ppe' },
            { key: 'medicalExams',       icon: 'Ljekarski pregledi.png', path: '/dashboard/medical-exams' },
        ],
    },

    {
        key: 'grpOrganization', icon: '🏢',
        children: [
            { key: 'companyProfile', icon: '🏢', path: '/dashboard/company-profile', label_bs: 'Profil kompanije', label_en: 'Company Profile' },
            { key: 'addressBook',    icon: '📒', path: '/dashboard/address-book' },
        ],
    },

    {
        key: 'grpEquipment', icon: 'Oprema.png',
        children: [
            { key: 'equipment',          icon: 'Oprema.png', path: '/dashboard/equipment', label_bs: 'Popis radne opreme i objekata', label_en: 'Equipment & Facilities List' },
            { key: 'serviceRecords',     icon: '🔧', path: '/dashboard/service-records', label_bs: 'Servisni zapisnici', label_en: 'Service Records' },
        ],
    },

    {
        key: 'grpSafety', icon: '🩹',
        children: [
            { key: 'injuryReport',       icon: '🩹', path: '/dashboard/injuries' },
            { key: 'diseaseReport',      icon: '🏥', path: '/dashboard/diseases' },
            { key: 'annualInjuryReport', icon: '📈', path: '/dashboard/annual-injuries' },
        ],
    },

    {
        key: 'grpTraining', icon: '🎓',
        children: [
            { key: 'trainings',      icon: '🎬', path: '/dashboard/trainings' },
            { key: 'testoviZopZnr',  icon: '📝', path: '/dashboard/tests-zop-znr', label_bs: 'Testovi ZOP i ZNR', label_en: 'ZOP & ZNR Tests' },
            { key: 'questionnaires', icon: '❓', path: '/dashboard/questionnaires' },
            { key: 'riskAssessment', icon: '⚠️', path: '/dashboard/risk-assessment' },
        ],
    },

    {
        key: 'grpDocuments', icon: '📑',
        children: [
            { key: 'documentationArchive', icon: '📂', path: '/dashboard/archives-hub', label_bs: 'Dokumentacija / Arhiva', label_en: 'Documentation / Archive' },
        ],
    },

    {
        key: 'grpFleet', icon: 'Vozni park.png',
        children: [
            { key: 'fleetVehicles', icon: 'Vozni park.png', path: '/dashboard/fleet', label_bs: 'Popis vozila', label_en: 'Vehicle List' },
            { key: 'fleetAssignments', icon: '🔄', path: '/dashboard/fleet-assignments', label_bs: 'Zaduženja', label_en: 'Assignments' },
            { key: 'fleetDocuments', icon: '📁', path: '/dashboard/fleet-documents', label_bs: 'Dokumentacija', label_en: 'Documents' },
            { key: 'fleetOrders', icon: '📝', path: '/dashboard/fleet-orders', label_bs: 'Putni nalozi', label_en: 'Travel Orders' },
        ],
    },

    {
        key: 'grpFireProtection', icon: '🧯',
        children: [
            { key: 'fireExtinguishers', icon: '🧯', path: '/dashboard/fire-protection', label_bs: 'Protupožarna oprema', label_en: 'Fire Equipment' },
        ],
    },

    {
        key: 'grpEvacuation', icon: '🚨',
        children: [
            { key: 'evacuationPlans',  icon: '🗺️', path: '/dashboard/evacuation', label_bs: 'Planovi evakuacije', label_en: 'Evacuation Plans' },
            { key: 'evacuationDrills', icon: '🏃', path: '/dashboard/evacuation-drills', label_bs: 'Vježbe evakuacije', label_en: 'Evacuation Drills' },
        ],
    },

    {
        key: 'alati', icon: '🛠️',
        children: [
            { key: 'excelImport',    icon: '📥', path: '/dashboard/import', label_bs: 'Excel Import/Export', label_en: 'Excel Import/Export' },
            { key: 'converter',      icon: '🔄', path: '/dashboard/converter' },
            { key: 'digitalArchive', icon: '🗄️', path: '/dashboard/archive' },
        ],
    },

    { key: 'settings',    icon: '⚙️', path: '/dashboard/settings' },
];

`;

const newCode = code.slice(0, menuItemsStart) + newMenuItems + code.slice(menuItemsEnd);

const finalCode = newCode.replace(
\`        if (isAdmin) {
            items.push({
                key: 'admin',
                icon: '👑',
                children: [
                    { key: 'adminUsers', icon: '👥', path: '/dashboard/admin/users' },
                    { key: 'adminCompanies', icon: '🏢', path: '/dashboard/admin/companies' },
                ],
            });
        }\`,
\`        if (isAdmin) {
            items.push({
                key: 'admin',
                icon: '👑',
                label_bs: 'Superadmin / Napredno',
                label_en: 'Superadmin / Advanced',
                children: [
                    { key: 'adminUsers', icon: '👥', path: '/dashboard/admin/users' },
                    { key: 'adminCompanies', icon: '🏢', path: '/dashboard/admin/companies' },
                    
                    // Migrated Advanced Items
                    { key: 'workplaceList',  icon: '📋', path: '/dashboard/workplace-list' },
                    { key: 'ekWorkers',      icon: '📇', path: '/dashboard/ek-workers' },
                    { key: 'ekPPE',          icon: 'OZO.png', path: '/dashboard/ek-ppe' },
                    { key: 'trainingMasterBook', icon: '📚', path: '/dashboard/training-book' },
                    { key: 'ekEquipment',    icon: 'Oprema.png', path: '/dashboard/ek-equipment' },
                    
                    {
                        key: 'grpISZNR', icon: '🏛️',
                        label_bs: 'Interni akti ZNR', label_en: 'Internal OSH Acts',
                        children: [
                            { key: 'documents',       icon: '📄', path: '/dashboard/isznr-documents' },
                            { key: 'parties',         icon: '👥', path: '/dashboard/isznr-parties' },
                            { key: 'documentTypes',   icon: '📋', path: '/dashboard/isznr-doc-types' },
                            { key: 'digitalSigning',  icon: '✍️', path: '/dashboard/isznr-signing' },
                            { key: 'examiners',       icon: '🔍', path: '/dashboard/isznr-examiners' },
                            { key: 'measureEquipment',icon: '📏', path: '/dashboard/isznr-measure-equipment' },
                        ],
                    },
                    
                    {
                        key: 'grpCodebooks', icon: '🔗',
                        label_bs: 'Šifarnici', label_en: 'Codebooks',
                        children: [
                            { key: 'countries',          icon: '🌍', path: '/dashboard/countries' },
                            { key: 'counties',           icon: '📍', path: '/dashboard/counties' },
                            { key: 'places',             icon: '🏘️', path: '/dashboard/places' },
                            { key: 'orgUnitGroups',      icon: '📁', path: '/dashboard/org-groups' },
                            { key: 'authorizedCompanies',icon: '✅', path: '/dashboard/authorized-companies' },
                            { key: 'examiners',          icon: '🔍', path: '/dashboard/examiners' },
                            { key: 'doctors',            icon: 'Doktori.png', path: '/dashboard/doctors' },
                            { key: 'examTypes',          icon: '📋', path: '/dashboard/exam-types' },
                            { key: 'certTypes',          icon: 'Uvjerenja.png', path: '/dashboard/cert-types' },
                            { key: 'equipmentTypes',     icon: '🔩', path: '/dashboard/equipment-types' },
                            { key: 'ppe',               icon: 'OZO.png', path: '/dashboard/ppe' },
                            { key: 'fileTypes',         icon: '📂', path: '/dashboard/file-types' },
                            { key: 'extraFields',       icon: '➕', path: '/dashboard/extra-fields' },
                        ],
                    }
                ],
            });
        }\`
);

fs.writeFileSync(path, finalCode);
console.log("Success rewriting Sidebar!");
