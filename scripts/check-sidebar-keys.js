const fs = require('fs');
const path = require('path');

const transPath = path.join(__dirname, '..', 'src', 'i18n', 'translations.js');
const fileContent = fs.readFileSync(transPath, 'utf-8');

const match = fileContent.match(/export const translations = (\{[\s\S]*?\n\};)/);
const translations = eval('(' + match[1].replace(/\};$/, '}') + ')');
const bsKeys = Object.keys(translations.bs);

const sidebarKeys = [
  'dashboard', 'home', 'grpWorkers', 'workers', 'workerCertificates', 'workerPPE', 'medicalExams',
  'grpOrganization', 'orgUnits', 'workplaces', 'sistematizacija', 'addressBook',
  'grpEquipment', 'equipment', 'serviceRecords',
  'grpSafety', 'injuryReport', 'diseaseReport', 'observations', 'annualInjuryReport',
  'grpTraining', 'trainings', 'testoviZopZnr', 'questionnaires', 'riskAssessment',
  'grpDocuments', 'employerDocs', 'requests', 'obrasciIUputnice', 'formOIR1', 'medicalReferralRA1',
  'formRO1', 'formRO2', 'nightWorkReferral', 'zapisniciAlat',
  'grpFleet', 'fleetVehicles', 'fleetAssignments', 'fleetDocuments', 'fleetOrders',
  'grpFireProtection', 'fireExtinguishers',
  'grpEvacuation', 'evacuationPlans', 'evacuationDrills',
  'alati', 'excelImport', 'converter', 'digitalArchive', 'settings',
  'admin', 'adminUsers', 'adminCompanies', 'workplaceList', 'ekWorkers', 'ekPPE', 'trainingMasterBook',
  'ekEquipment', 'grpISZNR', 'documents', 'parties', 'documentTypes', 'digitalSigning',
  'examiners', 'measureEquipment', 'grpCodebooks', 'countries', 'counties', 'places',
  'orgUnitGroups', 'authorizedCompanies', 'doctors', 'examTypes', 'certTypes', 'equipmentTypes',
  'ppe', 'fileTypes', 'extraFields'
];

const missing = sidebarKeys.filter(k => !bsKeys.includes(k));
console.log('Missing sidebar keys in translations:', missing);
